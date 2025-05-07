import { onRequest } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import { db, admin } from "../config/firebase";
import { DocumentReference } from "firebase-admin/firestore";
import { CODE_VERSION, REGION, FIRESTORE_WAHA_DOC } from "../config/constants";
import { wahaWebhookHmacKey, wahaApiUrl, wahaApiKey } from "../config/params";
import { WahaWebhookPayload } from "../types";
import { getWahaApiHeaders, logWahaAxiosError } from "../utils"; // logWahaAxiosError se for tratar erros de axios.post no "did not understand"
import axios from 'axios'; // Para enviar a mensagem "Não entendi"
// import crypto from 'crypto'; // Se for habilitar a verificação HMAC

export const handleWahaWebhook = onRequest(
  {
      secrets: [wahaWebhookHmacKey],
      region: REGION
  },
  async (req, res) => {
      const functionName = 'handleWahaWebhook';
      logger.info(`${functionName} / v: ${CODE_VERSION}: Webhook received.`);

      // HMAC Verification (Optional - Uncomment to use)
      /*
      const rawBody = req.rawBody;
      if (!rawBody) {
          logger.warn(`${functionName} / v: ${CODE_VERSION}: Request body missing.`);
          res.status(400).send('Bad Request: Missing body');
          return;
      }
      const expectedHmac = crypto
          .createHmac('sha256', wahaWebhookHmacKey.value())
          .update(rawBody)
          .digest('hex');
      const receivedHmac = req.headers['x-waha-hmac-sha256'] as string;

      if (wahaWebhookHmacKey.value() && expectedHmac !== receivedHmac) {
           logger.error(`${functionName} / v: ${CODE_VERSION}: Invalid HMAC signature.`);
           res.status(401).send('Unauthorized: Invalid signature');
           return;
      } else if (wahaWebhookHmacKey.value()) {
          logger.info(`${functionName} / v: ${CODE_VERSION}: HMAC signature verified.`);
      } else {
          logger.info(`${functionName} / v: ${CODE_VERSION}: HMAC check skipped (key not configured).`);
      }
      */

      const webhookData = req.body as WahaWebhookPayload;
      const event = webhookData.event;
      const sessionName = webhookData.session || webhookData?.payload?.name;
      const startTime = Date.now();

      logger.info(`${functionName} / v: ${CODE_VERSION}: Event '${event}' for session '${sessionName}' received.`, { payload: webhookData.payload || '{}'});

      let tenantId: string | null = null;
      if (sessionName && sessionName.startsWith('session_')) {
          tenantId = sessionName.substring('session_'.length);
          logger.info(`${functionName} / v: ${CODE_VERSION}: Extracted tenantId: ${tenantId}`);
      } else {
           logger.warn(`${functionName} / v: ${CODE_VERSION}: Could not extract tenantId from session name: ${sessionName}. Ignoring webhook.`);
           res.status(200).send({ message: "Webhook received, but tenantId could not be determined." });
           return;
      }

      try {
          switch (event) {
              case 'session.status':
                  const statusPayload = webhookData.payload;
                  const status = statusPayload?.status;

                  if (!status) {
                       logger.warn(`${functionName} / v: ${CODE_VERSION}: Received 'session.status' without a status field for tenant ${tenantId}. Payload:`, statusPayload);
                       res.status(400).send({ message: "Bad Request: Missing status field in session.status event." });
                       return;
                  }
                  logger.info(`${functionName} / v: ${CODE_VERSION}: Processing ${event}: ${status} for tenant ${tenantId}`);

                  const integrationDocPath = `tenants/${tenantId}/integrations/${FIRESTORE_WAHA_DOC}`;
                  const integrationDocRef = db.doc(integrationDocPath);
                  try {
                      const integrationDocSnap = await integrationDocRef.get();
                      if (!integrationDocSnap.exists) {
                          logger.warn(`[${functionName} / v: ${CODE_VERSION}] Received '${event}:${status}' for non-existent/inactive integration: ${integrationDocPath}. Ignoring.`);
                          res.status(200).send({ message: "Webhook received, integration ignored." });
                          return;
                      }
                      logger.info(`[${functionName} / v: ${CODE_VERSION}] Integration document ${integrationDocPath} exists. Proceeding with status update.`);

                      let dataToUpdate: any = {
                          lastEventTimestamp: admin.firestore.FieldValue.serverTimestamp(),
                          lastEventType: event,
                          status: 'Desconhecido'
                      };
                      switch (status) {
                          case 'SCAN_QR_CODE':
                              dataToUpdate.status = 'QRCode';
                              dataToUpdate.qrCodeDataUri = null;
                              break;
                          case 'CONNECTED':
                              dataToUpdate.status = 'Conectado';
                              dataToUpdate.qrCodeDataUri = null;
                              break;
                          case 'DISCONNECTED':
                          case 'LOGGED_OUT':
                              dataToUpdate.status = 'Desconectado';
                              dataToUpdate.qrCodeDataUri = null;
                              break;
                          case 'STARTING':
                              dataToUpdate.status = 'Iniciando';
                              dataToUpdate.qrCodeDataUri = null;
                              break;
                         default:
                             dataToUpdate.status = 'Desconhecido';
                             break;
                      }
                      await integrationDocRef.set(dataToUpdate, { merge: true });
                      logger.info(`${functionName} / v: ${CODE_VERSION}: Firestore updated successfully for tenant ${tenantId}.`);
                  } catch (dbError) {
                      logger.error(`[${functionName} / v: ${CODE_VERSION}] Firestore error checking/updating integration document ${integrationDocPath}:`, dbError);
                      res.status(500).send({ message: "Internal server error processing webhook." });
                      return;
                  }
                  break;

              case 'message':
              case 'message.any': 
                  if (!webhookData.payload) {
                      logger.warn(`[${functionName} / v: ${CODE_VERSION}] Received message event without payload.`, { tenantId });
                      break;
                  }
                  const messagePayload = webhookData.payload;
                  const chatId = messagePayload.from;
                  const messageBody = messagePayload.body?.toLowerCase().trim();

                  if (messagePayload.fromMe) {
                      logger.info(`[${functionName} / v: ${CODE_VERSION}] Ignoring outgoing message echo for chat: ${chatId}.`, { tenantId });
                      break; 
                  }
                  if (!chatId || !chatId.endsWith('@c.us') || !messageBody) {
                      logger.info(`[${functionName} / v: ${CODE_VERSION}] Ignoring message (not from user chat '@c.us' or empty body). ChatID: ${chatId}`, { tenantId });
                      break;
                  }
                  logger.info(`[${functionName} / v: ${CODE_VERSION}] Processing INCOMING message from: ${chatId}, body: \"${messageBody}\"`, { tenantId });

                  let pendingAppointmentDocRef: DocumentReference | null = null;
                  let customerIdFound: string | null = null;
                  try {
                      if (!tenantId) {
                           logger.error(`[${functionName} Lookup] Tenant ID is null, cannot query customer for chat ${chatId}.`);
                           throw new Error("Tenant ID is null in message handler.");
                      }
                      const customerQuery = db.collection('tenants').doc(tenantId).collection('customers')
                                            .where('phone_waha_id', '==', chatId)
                                            .limit(1);
                      const customerSnap = await customerQuery.get();
                      if (!customerSnap.empty) {
                          customerIdFound = customerSnap.docs[0].id;
                          const appointmentQuery = db.collection('appointments')
                              .where('tenant_id', '==', tenantId)
                              .where('customer_id', '==', customerIdFound)
                              .where('status', '==', 'pending_confirmation')
                              .orderBy('last_confirmation_sent_at', 'desc')
                              .limit(1);
                          const appointmentSnap = await appointmentQuery.get();
                          if (!appointmentSnap.empty) {
                              pendingAppointmentDocRef = appointmentSnap.docs[0].ref;
                          }
                      }
                  } catch (lookupError) {
                      logger.error(`[${functionName} Lookup] Error looking up customer/appointment for ${chatId}:`, { tenantId, error: lookupError });
                  }

                  if (pendingAppointmentDocRef) {
                      const containsSim = /\b(sim|s)\b/i.test(messageBody);
                      const containsNao = /\b(n[aã]o|n)\b/i.test(messageBody);
                      try {
                          if (containsSim && !containsNao) {
                              await pendingAppointmentDocRef.update({
                                  status: 'confirmed',
                                  updated_at: admin.firestore.FieldValue.serverTimestamp()
                              });
                          } else if (containsNao) {
                              await pendingAppointmentDocRef.update({
                                  status: 'canceled',
                                  cancellation_reason: 'Cancelado pelo cliente via WhatsApp',
                                  cancelled_via: 'whatsapp_reply',
                                  updated_at: admin.firestore.FieldValue.serverTimestamp()
                              });
                          } else {
                              const sessionNameForReply = `session_${tenantId}`;
                              const apiUrl = wahaApiUrl.value();
                              const apiKey = wahaApiKey.value();
                              if (!apiUrl || !apiKey) {
                                   logger.error(`[${functionName} Other] Cannot send reply - WAHA API URL or Key missing.`, { tenantId });
                              } else {
                                   const sendUrl = `${apiUrl.replace(/\/$/, '')}/api/sendText`;
                                   const payload = { session: sessionNameForReply, chatId: chatId, text: "Desculpe, não entendi sua resposta. Por favor, responda apenas com SIM ou NÃO para confirmar ou cancelar seu agendamento." };
                                   const headers = getWahaApiHeaders(apiKey);
                                   headers['Content-Type'] = 'application/json';
                                   try {
                                       await axios.post(sendUrl, payload, { headers });
                                   } catch (replyError: any) {
                                       logWahaAxiosError(`${functionName} (Did not understand Reply Send)`, sessionNameForReply, tenantId, replyError);
                                   }
                              }
                          }
                      } catch (updateError) {
                           logger.error(`[${functionName} Update] Error updating appointment ${pendingAppointmentDocRef.id} status:`, { tenantId, error: updateError });
                      }
                  }
                  break;

              case 'message.ack':
                   logger.info(`[${functionName} / v: ${CODE_VERSION}] Processing message ack for tenant ${tenantId}. Payload:`, webhookData.payload);
                   break;
              default:
                  logger.info(`[${functionName} / v: ${CODE_VERSION}] Received unhandled event type '${event}' for tenant ${tenantId}. Ignoring.`);
                  break;
          }

          const duration = Date.now() - startTime;
          logger.info(`${functionName} / v: ${CODE_VERSION}: Processed event '${event}' for session '${sessionName}'. Duration: ${duration}ms.`);
           if (!res.headersSent) {
               res.status(200).send({ message: "Webhook processed successfully." });
           }
      } catch (error: any) {
           logger.error(`${functionName} / v: ${CODE_VERSION}: Uncaught error processing event '${event}' for session '${sessionName}':`, error);
           if (!res.headersSent) {
                res.status(500).send({ message: `Internal Server Error: ${error.message || 'Unknown error'}` });
           }
      }
  }
); 