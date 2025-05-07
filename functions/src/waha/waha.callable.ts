import { https } from "firebase-functions/v2";
import { HttpsError, CallableRequest } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import axios from 'axios';
import { db, adminFirestore } from "../config/firebase"; // REMOVED: auth. adminFirestore is used for FieldValue.
import { CODE_VERSION, REGION } from "../config/constants";
import { wahaApiUrl, wahaApiKey } from "../config/params";
import { SendWahaConfirmationData } from "../types";
import {
    formatDateTime,
    getWahaApiHeaders,
    logWahaAxiosError,
    handleWahaApiError
} from "../utils";

export const sendWahaConfirmation = https.onCall(
  {
    region: REGION,
    timeoutSeconds: 60,
    memory: '256MiB',
    cors: ["http://localhost:5173", "https://petfacil.app"]
  },
  async (request: CallableRequest<SendWahaConfirmationData>) => {
    logger.info(`sendWahaConfirmation / v: ${CODE_VERSION}: Function called.`);

    if (!request.auth?.token?.tenant_id) {
      throw new HttpsError("permission-denied", "Ação permitida apenas para usuários logados com tenant.");
    }
    const tenantId = request.auth.token.tenant_id;
    const callerUid = request.auth.uid;
    logger.info(`sendWahaConfirmation / v: ${CODE_VERSION}: Caller: ${callerUid}, Tenant: ${tenantId}`);

    const { appointmentId } = request.data;
    if (!appointmentId) {
      throw new HttpsError("invalid-argument", "ID do agendamento é obrigatório.");
    }
    logger.info(`sendWahaConfirmation / v: ${CODE_VERSION}: Received appointmentId: ${appointmentId}`);

    const apiUrl = wahaApiUrl.value();
    const apiKey = wahaApiKey.value();
    if (!apiUrl || !apiKey) {
      logger.error("sendWahaConfirmation: WAHA API URL or API Key is not configured.", { tenantId });
      throw new HttpsError("internal", "Configuração interna do servidor WAHA está incompleta (URL ou API Key).");
    }

    const sessionName = `session_${tenantId}`;

    try {
      const appointmentRef = db.collection("appointments").doc(appointmentId);
      const appointmentSnap = await appointmentRef.get();
      if (!appointmentSnap.exists || !appointmentSnap.data()) throw new HttpsError("not-found", `Agendamento ${appointmentId} não encontrado.`);
      const appointmentData = appointmentSnap.data()!;
      if (appointmentData.tenant_id !== tenantId) throw new HttpsError("permission-denied", `Agendamento ${appointmentId} não pertence ao seu tenant.`);
      logger.info(`sendWahaConfirmation / v: ${CODE_VERSION}: Fetched appointment data for ID: ${appointmentId}`);

      const customerId = appointmentData.customer_id;
      if (!customerId) throw new HttpsError("failed-precondition", `Agendamento ${appointmentId} sem ID de cliente.`);
      
      const customerRef = db.collection("tenants").doc(tenantId).collection("customers").doc(customerId);
      
      const customerSnap = await customerRef.get();
      if (!customerSnap.exists || !customerSnap.data()) {
          logger.error(`sendWahaConfirmation / v: ${CODE_VERSION}: Cliente ${customerId} não encontrado no caminho tenants/${tenantId}/customers/${customerId}`);
          throw new HttpsError("not-found", `Cliente ${customerId} não encontrado.`);
      }
      const customerData = customerSnap.data()!;
      logger.info(`sendWahaConfirmation / v: ${CODE_VERSION}: Fetched customer data for ID: ${customerId} from subcollection.`);

      const customerPhone = customerData.phone;
      if (!customerPhone) throw new HttpsError("failed-precondition", `Cliente ${customerId} sem telefone.`);
      const formattedPhone = `55${customerPhone.replace(/\D/g, '')}`;
      const chatIdForWaha = `${formattedPhone}@c.us`;
      logger.info(`sendWahaConfirmation / v: ${CODE_VERSION}: Customer phone (Original): ${customerPhone} -> Formatted: ${chatIdForWaha}`);

      if (customerData.phone_waha_id !== chatIdForWaha) {
         try {
            await customerRef.update({ phone_waha_id: chatIdForWaha });
            logger.info(`sendWahaConfirmation / v: ${CODE_VERSION}: Updated customer ${customerId} with phone_waha_id: ${chatIdForWaha}`);
         } catch (updateError) {
             logger.warn(`sendWahaConfirmation / v: ${CODE_VERSION}: Failed to update phone_waha_id for customer ${customerId}:`, updateError);
         }
      }

      let tenantName = "sua clínica";
      try {
          const tenantDoc = await db.collection('tenants').doc(tenantId).get();
          if (tenantDoc.exists) tenantName = tenantDoc.data()?.company_name || tenantName;
      } catch (e) { logger.warn(`Could not fetch tenant name for ${tenantId}:`, e); }

      let messagingSettings = null;
      let finalMessageText = "ERRO: Template de confirmação não pôde ser carregado.";
      try {
          const customQuery = await db.collection('customizations')
                                        .where('tenant_id', '==', tenantId)
                                        .limit(1)
                                        .get();
          if (!customQuery.empty) {
              messagingSettings = customQuery.docs[0].data()?.messaging_settings;
              logger.info(`[sendWahaConfirmation] Found messaging settings for tenant ${tenantId}.`);
              if (messagingSettings && typeof messagingSettings.template_confirmation === 'string' && messagingSettings.template_confirmation.trim() !== '') {
                  finalMessageText = messagingSettings.template_confirmation;
                  logger.info(`[sendWahaConfirmation] Using specific template: \"${finalMessageText.substring(0, 50)}...\"`);
              } else {
                  logger.warn(`[sendWahaConfirmation] Specific template not found or empty for tenant ${tenantId}. Using default error message.`);
              }
          } else {
              logger.warn(`[sendWahaConfirmation] No customization document found for tenant ${tenantId}. Cannot load template.`);
          }
      } catch (configError) {
          logger.error(`[sendWahaConfirmation] Failed to load messaging settings for tenant ${tenantId}`, { error: configError });
      }

      finalMessageText = finalMessageText.replace('{cliente}', appointmentData.customer_name || 'Cliente');
      finalMessageText = finalMessageText.replace('{clinica}', tenantName);
      finalMessageText = finalMessageText.replace('{pet}', appointmentData.pet_name || 'seu pet');
      finalMessageText = finalMessageText.replace('{data_hora}', formatDateTime(appointmentData.start_time));

      if (finalMessageText.startsWith("ERRO:")) {
          logger.error(`[sendWahaConfirmation] Cannot send confirmation for ${appointmentId} due to missing template configuration.`);
          throw new HttpsError("failed-precondition", "Não foi possível carregar o modelo de mensagem configurado.");
      }

      logger.info(`sendWahaConfirmation / v: ${CODE_VERSION}: Final message prepared: \"${finalMessageText}\"`);

      const sendUrl = `${apiUrl.replace(/\/$/, '')}/api/sendText`;
      const payload = { session: sessionName, chatId: chatIdForWaha, text: finalMessageText };
      const headers = getWahaApiHeaders(apiKey);
      headers['Content-Type'] = 'application/json';

      logger.info(`sendWahaConfirmation / v: ${CODE_VERSION}: Sending request to WAHA: ${sendUrl} for session ${sessionName}`);
      const response = await axios.post(sendUrl, payload, { headers });

      logger.info(`sendWahaConfirmation / v: ${CODE_VERSION}: WAHA API Response Status: ${response.status}`);

      if (response.status >= 200 && response.status < 300) {
        logger.info(`sendWahaConfirmation / v: ${CODE_VERSION}: WAHA response OK. Updating Firestore status for ${appointmentId}.`);
        try {
           await appointmentRef.update({
             status: "pending_confirmation",
             last_confirmation_sent_at: adminFirestore.FieldValue.serverTimestamp(), // Correto
             updated_at: adminFirestore.FieldValue.serverTimestamp() // Correto
           });
           logger.info(`sendWahaConfirmation / v: ${CODE_VERSION}: Successfully updated status for ${appointmentId}.`);
           return { success: true, message: "Mensagem de confirmação enviada com sucesso!" };
        } catch (updateError: any) {
            logger.error(`sendWahaConfirmation / v: ${CODE_VERSION}: !!! FAILED TO UPDATE FIRESTORE STATUS for ${appointmentId} !!!`, updateError);
            throw new HttpsError("internal", `Mensagem WAHA enviada, mas falha ao atualizar status no banco: ${updateError.message}`);
        }
      } else {
        logger.error(`sendWahaConfirmation / v: ${CODE_VERSION}: WAHA API responded with non-success status: ${response.status}`);
        throw handleWahaApiError({ response }, sessionName);
      }

    } catch (error: any) {
      logWahaAxiosError('sendWahaConfirmation', sessionName, tenantId, error);
      if (error instanceof HttpsError) {
        throw error;
      } else {
        throw handleWahaApiError(error, sessionName);
      }
    }
  }
);

export const getWahaSessionStatus = https.onCall(
    {
        region: REGION,
        cors: ["http://localhost:5173", "https://petfacil.app"],
        timeoutSeconds: 180,
    },
    async (request) => {
        logger.info(`getWahaSessionStatus / v: ${CODE_VERSION}: Function called`, { structuredData: true });

        const uid = request.auth?.uid;
        const tenantId = request.auth?.token.tenant_id;
        if (!uid || !tenantId) throw new HttpsError("unauthenticated", "Usuário não autenticado ou sem tenant ID.");
        logger.info(`getWahaSessionStatus / v: ${CODE_VERSION}: User ${uid}, Tenant ${tenantId}`, { uid, tenantId });

        const apiUrl = wahaApiUrl.value();
        const apiKey = wahaApiKey.value();

        logger.info(`getWahaSessionStatus / v: ${CODE_VERSION}: Config read - apiUrl: [${apiUrl}], apiKey: [${apiKey ? 'present' : 'missing'}]`, { tenantId });

        if (!apiUrl || !apiKey) {
            logger.error(`getWahaSessionStatus / v: ${CODE_VERSION}: WAHA API URL or API Key is not configured.`, { tenantId });
            throw new HttpsError("internal", "Configuração interna do servidor WAHA está incompleta (URL ou API Key).");
        }

        const sessionName = `session_${tenantId}`;
        const statusUrl = `${apiUrl}/api/sessions/${sessionName}/status`;
        logger.info(`getWahaSessionStatus / v: ${CODE_VERSION}: Checking status for ${sessionName} at ${statusUrl}`, { tenantId });

        const headers = getWahaApiHeaders(apiKey);

        try {
            const response = await axios.get(statusUrl, { headers });
            logger.info(`getWahaSessionStatus / v: ${CODE_VERSION}: WAHA API response for ${sessionName}:`, { status: response.status, data: response.data });

            const wahaStatus = response.data?.status;
            let frontendStatus = "Desconhecido";
            if (wahaStatus === 'authenticated' || wahaStatus === 'online' || wahaStatus === 'connected') frontendStatus = "Conectado";
            else if (wahaStatus === 'scanQrCode' || wahaStatus === 'gotQrCode') frontendStatus = "QRCode";
            else if (wahaStatus === 'disconnected' || wahaStatus === 'offline') frontendStatus = "Desconectado";
            else if (wahaStatus === 'connecting' || wahaStatus === 'init') frontendStatus = "Iniciando";
            else logger.warn(`getWahaSessionStatus / v: ${CODE_VERSION}: Unknown WAHA status '${wahaStatus}' for ${sessionName}.`, { tenantId });

            logger.info(`getWahaSessionStatus / v: ${CODE_VERSION}: Mapped status for ${sessionName}: ${frontendStatus}`, { tenantId });
            return { status: frontendStatus };

        } catch (error: any) {
            if (axios.isAxiosError(error) && error.response?.status === 404) {
                logger.info(`getWahaSessionStatus / v: ${CODE_VERSION}: Session ${sessionName} not found (404). Assuming disconnected.`, { tenantId });
                return { status: "Desconectado" };
            }
            logWahaAxiosError('getWahaSessionStatus', sessionName, tenantId, error);
            throw handleWahaApiError(error, sessionName);
        }
    }
);

export const getWahaQrCode = https.onCall(
    {
        region: REGION,
        cors: ["http://localhost:5173", "https://petfacil.app"],
    },
    async (request) => {
        logger.info(`getWahaQrCode / v: ${CODE_VERSION}: Function called`, { structuredData: true });

        const uid = request.auth?.uid;
        const tenantId = request.auth?.token.tenant_id;
        if (!uid || !tenantId) throw new HttpsError("unauthenticated", "Usuário não autenticado ou sem tenant ID.");
        logger.info(`getWahaQrCode / v: ${CODE_VERSION}: User ${uid}, Tenant ${tenantId}`, { uid, tenantId });

        const apiUrl = wahaApiUrl.value();
        const apiKey = wahaApiKey.value();

        logger.info(`getWahaQrCode / v: ${CODE_VERSION}: Config read - apiUrl: [${apiUrl}], apiKey: [${apiKey ? 'present' : 'missing'}]`, { tenantId });

        if (!apiUrl || !apiKey) {
            logger.error(`getWahaQrCode / v: ${CODE_VERSION}: WAHA API URL or API Key is not configured.`, { tenantId });
            throw new HttpsError("internal", "Configuração interna do servidor WAHA está incompleta (URL ou API Key).");
        }

        const sessionName = `session_${tenantId}`;
        const qrCodeUrl = `${apiUrl}/api/${sessionName}/auth/qr?format=image`;
        logger.info(`getWahaQrCode / v: ${CODE_VERSION}: Fetching QR Code for ${sessionName} at ${qrCodeUrl}`, { tenantId });

        const headers = getWahaApiHeaders(apiKey);

        try {
            const response = await axios.get(qrCodeUrl, { headers, responseType: 'arraybuffer' });
            logger.info(`getWahaQrCode / v: ${CODE_VERSION}: WAHA API response status for ${sessionName} QR Code: ${response.status}`);

            const contentType = response.headers['content-type'];
            if (!contentType || !contentType.startsWith('image/')) {
                 logger.error(`getWahaQrCode / v: ${CODE_VERSION}: Received non-image content type from WAHA QR endpoint: ${contentType}`, { tenantId });
                 let errorText = 'Resposta inesperada (não imagem).';
                 try { errorText = Buffer.from(response.data).toString('utf8'); } catch(_) {}
                 throw new HttpsError("internal", "A API não retornou uma imagem de QR Code.", { response: errorText });
            }

            const base64 = Buffer.from(response.data, 'binary').toString('base64');
            const qrCodeDataUri = `data:${contentType};base64,${base64}`;
            logger.info(`getWahaQrCode / v: ${CODE_VERSION}: Successfully generated QR Code Data URI for ${sessionName}. Size: ${qrCodeDataUri.length} chars.`, { tenantId });
            return { qrCodeDataUri };

        } catch (error: any) {
             logWahaAxiosError('getWahaQrCode', sessionName, tenantId, error);
             if (axios.isAxiosError(error) && error.response?.status === 404) {
                 logger.warn(`getWahaQrCode / v: ${CODE_VERSION}: Received 404 for QR Code for session ${sessionName}.`, { tenantId });
                 throw new HttpsError("not-found", "QR Code não disponível no momento. Verifique o status da conexão.");
             }
            throw handleWahaApiError(error, sessionName);
        }
    }
);

export const startWahaSession = https.onCall(
  {
      region: REGION,
      cors: ["http://localhost:5173", "https://petfacil.app"],
      timeoutSeconds: 60,
  },
  async (request) => {
      logger.info(`startWahaSession / v: ${CODE_VERSION}: Function called`, { structuredData: true });

      const uid = request.auth?.uid;
      const tenantId = request.auth?.token.tenant_id;
      if (!uid || !tenantId) throw new HttpsError("unauthenticated", "Usuário não autenticado ou sem tenant ID.");
      logger.info(`startWahaSession / v: ${CODE_VERSION}: User ${uid}, Tenant ${tenantId}`, { uid, tenantId });

      const apiUrl = wahaApiUrl.value();
      const apiKey = wahaApiKey.value();

      logger.info(`startWahaSession / v: ${CODE_VERSION}: Config read - apiUrl: [${apiUrl}], apiKey: [${apiKey ? 'present' : 'missing'}]`, { tenantId });

      if (!apiUrl || !apiKey) {
          logger.error(`startWahaSession / v: ${CODE_VERSION}: WAHA API URL or API Key is not configured.`, { tenantId });
          throw new HttpsError("internal", "Configuração interna do servidor WAHA está incompleta (URL ou API Key).");
      }

      const sessionName = `session_${tenantId}`;
      const startSessionUrl = `${apiUrl}/api/sessions/start`;
      logger.info(`startWahaSession / v: ${CODE_VERSION}: Attempting to start session ${sessionName} at ${startSessionUrl}`, { tenantId });

      const headers = getWahaApiHeaders(apiKey);
      headers['Content-Type'] = 'application/json';
      const requestBody = { name: sessionName };

      try {
          logger.info(`startWahaSession / v: ${CODE_VERSION}: Sending POST request to ${startSessionUrl} with body:`, { body: requestBody });
          const response = await axios.post(startSessionUrl, requestBody, { headers });
          logger.info(`startWahaSession / v: ${CODE_VERSION}: WAHA API response for starting ${sessionName}:`, { status: response.status, data: response.data });

          if (response.status >= 200 && response.status < 300) {
              logger.info(`startWahaSession / v: ${CODE_VERSION}: Session start request successful for ${sessionName}.`, { tenantId });
              return { success: true, message: "Solicitação para iniciar sessão enviada.", data: response.data };
          } else {
              logger.warn(`startWahaSession / v: ${CODE_VERSION}: Unexpected WAHA API status for starting ${sessionName}: ${response.status}`, { tenantId });
              throw handleWahaApiError({ response }, sessionName);
          }

      } catch (error: any) {
           logWahaAxiosError('startWahaSession', sessionName, tenantId, error);

           if (axios.isAxiosError(error) && error.response?.status === 422) {
               const responseDataString = Buffer.isBuffer(error.response?.data)
                  ? Buffer.from(error.response.data).toString('utf8')
                  : JSON.stringify(error.response?.data);
               if (responseDataString?.includes("is already started")) {
                  logger.info(`startWahaSession / v: ${CODE_VERSION}: Received 422 'already started' for session ${sessionName}. Considering it a success.`, { tenantId });
                  return { success: true, message: "Sessão já iniciada.", code: 'already-started', data: error.response?.data };
               }
           }

           if (axios.isAxiosError(error) && error.response?.status === 409 && startSessionUrl.endsWith('/api/sessions')) {
               logger.info(`startWahaSession / v: ${CODE_VERSION}: Received 409 Conflict for session ${sessionName} on POST /sessions. Assuming already exists/starting.`, { tenantId });
               return { success: true, message: "Sessão já existe ou está iniciando.", code: 'already-exists', data: error.response?.data };
           }
          throw handleWahaApiError(error, sessionName);
      }
  }
);

export const stopWahaSession = https.onCall(
  {
      region: REGION,
      cors: ["http://localhost:5173", "https://petfacil.app"],
      timeoutSeconds: 60,
  },
  async (request) => {
      logger.info(`stopWahaSession / v: ${CODE_VERSION}: Function called`, { structuredData: true });

      const uid = request.auth?.uid;
      const tenantId = request.auth?.token.tenant_id;
      if (!uid || !tenantId) throw new HttpsError("unauthenticated", "Usuário não autenticado ou sem tenant ID.");
      logger.info(`stopWahaSession / v: ${CODE_VERSION}: User ${uid}, Tenant ${tenantId}`, { uid, tenantId });

      const apiUrl = wahaApiUrl.value();
      const apiKey = wahaApiKey.value();

      logger.info(`stopWahaSession / v: ${CODE_VERSION}: Config read - apiUrl: [${apiUrl}], apiKey: [${apiKey ? 'present' : 'missing'}]`, { tenantId });

      if (!apiUrl || !apiKey) {
          logger.error(`stopWahaSession / v: ${CODE_VERSION}: WAHA API URL or API Key is not configured.`, { tenantId });
          throw new HttpsError("internal", "Configuração interna do servidor WAHA está incompleta (URL ou API Key).");
      }

      const sessionName = `session_${tenantId}`;
      const deleteUrl = `${apiUrl.replace(/\/$/, '')}/api/sessions/${sessionName}`;
      logger.info(`stopWahaSession / v: ${CODE_VERSION}: Attempting to DELETE session ${sessionName} at ${deleteUrl}`, { tenantId });

      const headers = getWahaApiHeaders(apiKey);

      try {
          logger.info(`stopWahaSession / v: ${CODE_VERSION}: Sending DELETE request to ${deleteUrl}`);
          const response = await axios.delete(deleteUrl, { headers });
          logger.info(`stopWahaSession / v: ${CODE_VERSION}: WAHA API response for deleting ${sessionName}:`, { status: response.status, data: response.data });

          if (response.status >= 200 && response.status < 300) {
              logger.info(`stopWahaSession / v: ${CODE_VERSION}: Session delete request successful for ${sessionName}. WAHA webhook might send disconnected status.`, { tenantId });
              return { success: true, message: "Solicitação para deletar sessão enviada." };
          } else {
              logger.warn(`stopWahaSession / v: ${CODE_VERSION}: Unexpected WAHA API status for deleting ${sessionName}: ${response.status}`, { tenantId });
              throw handleWahaApiError({ response }, sessionName);
          }

       } catch (error: any) {
           logWahaAxiosError('stopWahaSession', sessionName, tenantId, error);
           if (axios.isAxiosError(error) && error.response?.status === 404) {
               logger.info(`stopWahaSession / v: ${CODE_VERSION}: Received 404 for delete for session ${sessionName}. Assuming already deleted.`, { tenantId });
                return { success: true, message: "Sessão já deletada ou não encontrada.", code: 'not-found' };
           }
           throw handleWahaApiError(error, sessionName);
       }
  }
); 