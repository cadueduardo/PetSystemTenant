import { onDocumentUpdated, Change, FirestoreEvent, QueryDocumentSnapshot } from "firebase-functions/v2/firestore";
import * as logger from "firebase-functions/logger";
import axios from 'axios';

import { db, admin } from "../config/firebase"; // REMOVED: adminFirestore. admin still provides FieldValue and types
import { CODE_VERSION, REGION } from "../config/constants";
import { wahaApiUrl, wahaApiKey } from "../config/params";
import { 
    // formatDateTime, // REMOVED: Not used in this file
    getWahaApiHeaders, 
    logWahaAxiosError 
} from "../utils";
import { getOrCreateProntuario, createEpisode } from "../medical";
import { addItemsToPendingCharge } from "../billing";

// --- Funções Auxiliares ---

// Helper para adicionar itens à charge (usado por onAppointmentCompletedCreateCharge)
// async function addItemsToPendingCharge(
//     tenantId: string,
//     tutorId: string,
//     petId: string | null,
//     items: any[],
//     petName?: string | null,
//     osNumber?: string | null,
//     episodeId?: string | null,
//     prontuarioId?: string | null
// ) {
//   logger.info(`[Charge Helper / AppointmentsTrigger / ${tenantId}] Attempting to CREATE A NEW charge for tutor ${tutorId}. Items count: ${items.length}`, { petId, petName, osNumber, episodeId, prontuarioId });
//   if (!items || items.length === 0) {
//     logger.warn(`[Charge Helper / AppointmentsTrigger / ${tenantId}] No items provided for tutor ${tutorId}. Aborting.`);
//     return { success: false, message: "Nenhum item fornecido." };
//   }

//   const chargesRef = db.collection('tenants').doc(tenantId).collection('charges');

//   try {
//     const transactionResult = await db.runTransaction(async (transaction) => {
//       const newChargeRef = chargesRef.doc();
//       const targetChargeId = newChargeRef.id;
//       logger.info(`[Charge Helper / AppointmentsTrigger / ${tenantId} / Tx] Creating new charge ${targetChargeId}.`);
//       const newItemsTotal = items.reduce((sum, item) => sum + (item.totalPrice || 0), 0);

//       transaction.set(newChargeRef, {
//           tenantId: tenantId,
//           tutorId: tutorId,
//           petId: petId || null,
//           petName: petName || null,
//           osNumber: osNumber || null,
//           episodeId: episodeId || null,
//           prontuarioId: prontuarioId || null,
//           totalAmount: newItemsTotal,
//           amountPaid: 0,
//           status: 'pending',
//           sourceType: 'service_completion',
//           createdAt: admin.firestore.FieldValue.serverTimestamp(),
//           updatedAt: admin.firestore.FieldValue.serverTimestamp(),
//       });

//       const itemsCollectionRef = newChargeRef.collection('charge_items');
//       items.forEach((itemData, index) => {
//           const newItemRef = itemsCollectionRef.doc();
//           logger.debug(`[Charge Helper / AppointmentsTrigger / ${tenantId} / Tx / Charge ${targetChargeId}] Adding item ${index + 1} to subcollection:`, itemData);
//           transaction.set(newItemRef, {
//               ...itemData,
//               chargeId: targetChargeId,
//               tenantId: tenantId,
//               addedAt: admin.firestore.FieldValue.serverTimestamp()
//           });
//       });

//       return { chargeId: targetChargeId };
//     });

//     logger.info(`[Charge Helper / AppointmentsTrigger / ${tenantId}] Transaction successful. NEW Charge ID created: ${transactionResult.chargeId}`);
//     return { success: true, chargeId: transactionResult.chargeId };

//   } catch (error: any) {
//     logger.error(`[Charge Helper / AppointmentsTrigger / ${tenantId}] Error CREATING charge for tutor ${tutorId}:`, { error: error.message, stack: error.stack, details: error.details });
//     return { success: false, message: `Erro ao criar cobrança: ${error.message}`, errorDetails: error };
//   }
// }

// --- Gatilhos Firestore para Appointments ---

export const sendWahaReplyOnStatusChange = onDocumentUpdated(
    {
        region: REGION,
        document: "appointments/{appointmentId}"
    },
    async (event: FirestoreEvent<Change<QueryDocumentSnapshot> | undefined, { appointmentId: string }>) => {
        logger.info(`[sendWahaReplyOnStatusChange / AppointmentsTrigger - ENTRY] Function invoked for appointment ID: ${event.params.appointmentId}`);
        const functionStartTime = Date.now();
        const appointmentId = event.params.appointmentId;
        logger.info(`[sendWahaReplyOnStatusChange / AppointmentsTrigger - ${appointmentId}] STARTED (v: ${CODE_VERSION}).`);

        const change = event.data;
        if (!change) {
             logger.warn(`[sendWahaReplyOnStatusChange / AppointmentsTrigger - ${appointmentId}] Event data is missing. Exiting.`);
             return null;
        }
        const beforeData = change.before.data();
        const afterData = change.after.data();

        if (!beforeData || !afterData) {
            logger.warn(`[sendWahaReplyOnStatusChange / AppointmentsTrigger - ${appointmentId}] Before or After data is missing. Exiting.`);
            return null;
        }

        const statusBefore = beforeData?.status;
        const statusAfter = afterData?.status;

        if (!statusAfter || statusAfter === statusBefore) {
            logger.info(`[sendWahaReplyOnStatusChange / AppointmentsTrigger - ${appointmentId}] No status change detected or new status missing. Exiting.`, { statusBefore, statusAfter });
            return null;
        }

        if (statusBefore !== 'pending_confirmation' || (statusAfter !== 'confirmed' && statusAfter !== 'canceled')) {
             logger.info(`[sendWahaReplyOnStatusChange / AppointmentsTrigger - ${appointmentId}] Status change (${statusBefore} -> ${statusAfter}) is not relevant for sending WAHA reply. Exiting.`);
             return null;
        }

        const tenantId = afterData.tenant_id;
        const customerId = afterData.customer_id;
        if (!tenantId || !customerId) {
             logger.error(`[sendWahaReplyOnStatusChange / AppointmentsTrigger - ${appointmentId}] Missing tenantId or customerId in appointment data. Cannot send reply.`, { tenantId, customerId });
             return null;
        }

        const sessionName = `session_${tenantId}`;
        logger.info(`[sendWahaReplyOnStatusChange / AppointmentsTrigger - ${appointmentId}] Relevant status change detected for tenant ${tenantId}. Processing reply for customer ${customerId}.`);

        try {
            let messagingSettings = null;
            let templateKey = statusAfter === 'confirmed' ? 'template_confirmed_reply' : 'template_canceled_reply';
            let defaultReply = statusAfter === 'confirmed'
                ? "Obrigado por confirmar seu agendamento!"
                : "Ok, seu agendamento foi cancelado. Obrigado por nos avisar!";
            let finalReplyMessage = defaultReply;

            try {
                const customQuery = await db.collection('customizations').where('tenant_id', '==', tenantId).limit(1).get();
                if (!customQuery.empty) {
                    messagingSettings = customQuery.docs[0].data()?.messaging_settings;
                    const specificTemplate = messagingSettings?.[templateKey];
                    if (specificTemplate && typeof specificTemplate === 'string' && specificTemplate.trim() !== '') {
                        finalReplyMessage = specificTemplate;
                        logger.info(`[sendWahaReplyOnStatusChange / AppointmentsTrigger - ${appointmentId}] Using specific reply template (${templateKey}).`);
                    } else { logger.warn(`[sendWahaReplyOnStatusChange / AppointmentsTrigger - ${appointmentId}] Specific reply template (${templateKey}) not found/empty. Using default.`); }
                } else { logger.warn(`[sendWahaReplyOnStatusChange / AppointmentsTrigger - ${appointmentId}] No customization doc found for tenant ${tenantId}. Using default reply.`); }
            } catch (configError) {
                logger.error(`[sendWahaReplyOnStatusChange / AppointmentsTrigger - ${appointmentId}] Failed to load customization settings for tenant ${tenantId}. Using default reply.`, { error: configError });
            }

            const customerRef = db.collection('tenants').doc(tenantId).collection('customers').doc(customerId);
            const customerDoc = await customerRef.get();
            if (!customerDoc.exists) {
                logger.error(`[sendWahaReplyOnStatusChange / AppointmentsTrigger - ${appointmentId}] Customer ${customerId} for tenant ${tenantId} not found. Cannot send reply.`);
                return null;
            }
            const customerData = customerDoc.data();
             if (!customerData) {
                logger.error(`[sendWahaReplyOnStatusChange / AppointmentsTrigger - ${appointmentId}] Customer data missing for customer ${customerId}.`);
                return null;
            }
            const customerPhone = customerData?.phone_waha_id || customerData?.phone;
            if (!customerPhone) {
                logger.error(`[sendWahaReplyOnStatusChange / AppointmentsTrigger - ${appointmentId}] Customer ${customerId} has no phone number. Cannot send reply.`);
                return null;
            }
            const chatId = customerPhone.includes('@') ? customerPhone : `55${customerPhone.replace(/\D/g, '')}@c.us`;

            const apiUrl = wahaApiUrl.value();
            const apiKey = wahaApiKey.value();
            if (!apiUrl || !apiKey) {
                logger.error(`[sendWahaReplyOnStatusChange / AppointmentsTrigger - ${appointmentId}] Cannot send reply for tenant ${tenantId}: WAHA API URL or Key missing.`);
                return null;
            }

            const sendUrl = `${apiUrl.replace(/\/$/, '')}/api/sendText`;
            const payload = { session: sessionName, chatId: chatId, text: finalReplyMessage };
            const headers = getWahaApiHeaders(apiKey);
            headers['Content-Type'] = 'application/json';

            logger.info(`[sendWahaReplyOnStatusChange / AppointmentsTrigger - ${appointmentId}] Sending reply to ${chatId}: "${finalReplyMessage.substring(0, 50)}..."`);
            const response = await axios.post(sendUrl, payload, { headers });
            logger.info(`[sendWahaReplyOnStatusChange / AppointmentsTrigger - ${appointmentId}] WAHA API response for reply:`, { status: response.status });

            const functionEndTime = Date.now();
            logger.info(`[sendWahaReplyOnStatusChange / AppointmentsTrigger - ${appointmentId}] FINISHED SUCCESSFULLY (Duration: ${functionEndTime - functionStartTime}ms).`);
            return null;

        } catch (error) {
            logWahaAxiosError(`sendWahaReplyOnStatusChange (Trigger - ${appointmentId})`, sessionName, tenantId, error);
            logger.error(`[sendWahaReplyOnStatusChange / AppointmentsTrigger - ${appointmentId}] FAILED to process or send reply.`, { error });
            return null;
        }
    });

export const onAppointmentArrived = onDocumentUpdated(
  { document: 'appointments/{appointmentId}', region: REGION },
  async (event: FirestoreEvent<Change<QueryDocumentSnapshot> | undefined, { appointmentId: string }>) => {
    const functionStartTime = Date.now();
    const appointmentId = event.params.appointmentId;
    logger.info(`[onAppointmentArrived / AppointmentsTrigger - ENTRY - ${appointmentId}] Function invoked.`);

    if (!event.data) {
      logger.warn(`[onAppointmentArrived / AppointmentsTrigger - ${appointmentId}] Event data is missing. Exiting.`);
      return null;
    }
    const before = event.data.before.data();
    const after = event.data.after.data();

    if (!before || !after) {
        logger.warn(`[onAppointmentArrived / AppointmentsTrigger - ${appointmentId}] Before or After data is missing. Exiting.`);
        return null;
    }

    if (after?.status !== 'arrived' || before?.status === 'arrived') {
      logger.info(`[onAppointmentArrived / AppointmentsTrigger - ${appointmentId}] Status not changed to 'arrived' or already was 'arrived'. Exiting. Before: ${before?.status}, After: ${after?.status}`);
      return null;
    }

    const tenantId = after.tenant_id;
    const petId = after.pet_id;
    const tutorId = after.customer_id;
    const serviceId = after.service_id;
    const professionalId = after.professionalId;
    const professionalName = after.professionalName;
    const specialtyId = after.specialty_id || null;

    if (!tenantId || !petId || !tutorId || !serviceId ) {
      logger.error(`[onAppointmentArrived / AppointmentsTrigger - ${appointmentId}] Missing required data: tenantId, petId, tutorId, or serviceId.`, { after });
      return null;
    }

    logger.info(`[onAppointmentArrived / AppointmentsTrigger - ${appointmentId}] Processing 'arrived' status change.`);

    try {
      logger.info(`[onAppointmentArrived / AppointmentsTrigger - ${appointmentId}] Fetching service details for serviceId: ${serviceId}`);
      const serviceRef = db.collection('services').doc(serviceId);
      const serviceSnap = await serviceRef.get();

      if (!serviceSnap.exists) {
        logger.error(`[onAppointmentArrived / AppointmentsTrigger - ${appointmentId}] Service with ID ${serviceId} not found! Cannot proceed.`);
        return null;
      }

      const serviceData = serviceSnap.data()!;
      const serviceModule = serviceData.module;
      const serviceName = serviceData.name;
      logger.info(`[onAppointmentArrived / AppointmentsTrigger - ${appointmentId}] Service module: ${serviceModule}, Service name: ${serviceName}`);

      if (serviceModule === 'clinica') {
        logger.info(`[onAppointmentArrived / AppointmentsTrigger - ${appointmentId}] Service is clinical. Processing Prontuario and Episode...`);

        logger.info(`[onAppointmentArrived / AppointmentsTrigger - ${appointmentId}] Getting/Creating Prontuario...`);
        const prontuario = await getOrCreateProntuario(tenantId, petId, tutorId);
        const prontuarioId = prontuario.id;
        logger.info(`[onAppointmentArrived / AppointmentsTrigger - ${appointmentId}] Prontuario ID: ${prontuarioId}`);

        logger.info(`[onAppointmentArrived / AppointmentsTrigger - ${appointmentId}] Creating Clinical Episode...`);
        const episodeId = await createEpisode(prontuarioId, appointmentId, {
          tenantId,
          petId,
          tutorId,
          serviceId,
          serviceName,
          module: serviceModule,
          professionalId: professionalId || "",
          professionalName: professionalName || "",
          specialtyId
        });
        logger.info(`[onAppointmentArrived / AppointmentsTrigger - ${appointmentId}] Clinical Episode ${episodeId} created.`);

        logger.info(`[onAppointmentArrived / AppointmentsTrigger - ${appointmentId}] Updating appointment with prontuarioId, currentEpisodeId, and check_in_time...`);
        const appointmentRef = db.collection('appointments').doc(appointmentId);
        await appointmentRef.update({
            prontuarioId: prontuarioId,
            currentEpisodeId: episodeId,
            check_in_time: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        logger.info(`[onAppointmentArrived / AppointmentsTrigger - ${appointmentId}] Appointment updated successfully.`);

      } else if (serviceModule === 'petshop') {
        logger.info(`[onAppointmentArrived / AppointmentsTrigger - ${appointmentId}] Service is petshop (${serviceName}). Creating Queue Entry...`);

        try {
          const queueCollectionRef = db.collection('queueEntries');
          const osNumberFromAppointment = after.osNumber || null;

          const queueEntryData = {
            tenant_id: tenantId,
            appointment_id: appointmentId,
            pet_id: petId,
            customer_id: tutorId,
            service_id: serviceId,
            professional_id: professionalId || null,
            status: 'waiting',
            entry_time: admin.firestore.FieldValue.serverTimestamp(),
            osNumber: osNumberFromAppointment,
            pet_name: after.pet_name || null,
            customer_name: after.customer_name || null,
            service_name: serviceName,
            appointment_date: after.start_time
          };

          logger.info(`[onAppointmentArrived / AppointmentsTrigger - ${appointmentId}] Creating queue entry for petshop service:`, queueEntryData);
          await queueCollectionRef.add(queueEntryData);
          logger.info(`[onAppointmentArrived / AppointmentsTrigger - ${appointmentId}] Queue entry created successfully for petshop service.`);

        } catch (queueError) {
          logger.error(`[onAppointmentArrived / AppointmentsTrigger - ${appointmentId}] FAILED to create queue entry for petshop service:`, queueError);
        }

      } else {
        logger.warn(`[onAppointmentArrived / AppointmentsTrigger - ${appointmentId}] Unknown service module: ${serviceModule}. Skipping Prontuario/Episode/OS creation.`);
      }

      const functionEndTime = Date.now();
      logger.info(`[onAppointmentArrived / AppointmentsTrigger - ${appointmentId}] Successfully processed 'arrived' status. Duration: ${functionEndTime - functionStartTime}ms.`);
      return null;

    } catch (error: any) {
      logger.error(`[onAppointmentArrived / AppointmentsTrigger - ${appointmentId}] CRITICAL ERROR processing 'arrived' status:`, { error: error.message, stack: error.stack });
      return null;
    }
  }
);

export const onAppointmentCompletedCreateCharge = onDocumentUpdated(
  {
    region: REGION,
    document: "appointments/{appointmentId}",
    memory: "256MiB",
    timeoutSeconds: 60,
  },
  async (event: FirestoreEvent<Change<QueryDocumentSnapshot> | undefined, { appointmentId: string }>) => {
    const functionStartTime = Date.now();
    const appointmentId = event.params.appointmentId;

    if (!event.data) {
      logger.warn(`[onAppointmentCompletedCreateCharge / AppointmentsTrigger / ${appointmentId}] Event data missing. Exiting.`);
      return;
    }

    const beforeData = event.data.before.data();
    const afterData = event.data.after.data();

    if (!beforeData || !afterData) { 
        logger.warn(`[onAppointmentCompletedCreateCharge / AppointmentsTrigger / ${appointmentId}] Before or After data is missing. Exiting.`);
        return;
    }
    
    const tenantId = afterData?.tenant_id || beforeData?.tenant_id;

    if (!tenantId) {
       logger.error(`[onAppointmentCompletedCreateCharge / AppointmentsTrigger / ${appointmentId}] Tenant ID missing in both before and after data. Cannot process.`);
       return;
    }

    logger.info(`[onAppointmentCompletedCreateCharge / AppointmentsTrigger / ${tenantId}] Triggered for appointment ${appointmentId}.`);

    const statusBefore = beforeData?.status;
    const statusAfter = afterData?.status;

    if (statusAfter === 'completed' && statusBefore !== 'completed') {
      logger.info(`[onAppointmentCompletedCreateCharge / AppointmentsTrigger / ${tenantId}] Appointment ${appointmentId} status changed to 'completed'. Processing charge creation.`);

      if (!afterData) {
          logger.error(`[onAppointmentCompletedCreateCharge / AppointmentsTrigger / ${tenantId}] CRITICAL: afterData is missing even after status change! Aborting.`);
          return;
      }

      try {
          const fetchedTenantId = afterData.tenant_id;
          const serviceType = afterData.service_type; 
          const tutorId = afterData.tutorId ?? afterData.customer_id;
          const serviceId = afterData.service_id;
          const serviceName = afterData.service_name; 
          const servicePrice = afterData.price; 
          const petId = afterData.petId ?? afterData.pet_id ?? null;
          const osNumber = afterData.osNumber ?? null;
          const prontuarioId = afterData.prontuarioId ?? null;
          const currentEpisodeId = afterData.currentEpisodeId ?? null;
          let petName: string | null = afterData.pet_name ?? null;

          logger.info(`[onAppointmentCompletedCreateCharge / AppointmentsTrigger / ${tenantId}] Data extracted from afterData:`, { fetchedTenantId, serviceType, tutorId, serviceId, serviceName, servicePrice, petId, petName, osNumber, prontuarioId, currentEpisodeId });

          if (fetchedTenantId !== tenantId) {
              logger.error(`[onAppointmentCompletedCreateCharge / AppointmentsTrigger / ${tenantId}] Mismatch between tenantId in event context (${tenantId}) and afterData (${fetchedTenantId}). Aborting.`);
              return;
          }
          if (!tutorId || !serviceId || !serviceName || typeof servicePrice !== 'number') {
              logger.error(`[onAppointmentCompletedCreateCharge / AppointmentsTrigger / ${tenantId}] Missing required data (tutorId, serviceId, serviceName, price) in afterData for appointment ${appointmentId}. Cannot create charge item.`, { tutorId, serviceId, serviceName, servicePrice });
              return;
          }
          if (servicePrice < 0) {
              logger.warn(`[onAppointmentCompletedCreateCharge / AppointmentsTrigger / ${tenantId}] Appointment ${appointmentId} has negative price (${servicePrice}). Skipping charge item creation.`);
              return;
          }

          if (petId && !petName) {
              try {
                  logger.info(`[onAppointmentCompletedCreateCharge / AppointmentsTrigger / ${tenantId}] Pet name missing in afterData, fetching pet document ${petId}...`);
                  const petRef = db.collection('tenants').doc(tenantId).collection('pets').doc(petId);
                  const petSnap = await petRef.get();
                  if (petSnap.exists) {
                      petName = petSnap.data()?.name ?? null;
                      logger.info(`[onAppointmentCompletedCreateCharge / AppointmentsTrigger / ${tenantId}] Fetched pet name from document: ${petName}`);
                  } else {
                      logger.warn(`[onAppointmentCompletedCreateCharge / AppointmentsTrigger / ${tenantId}] Pet document ${petId} not found in subcollection.`);
                  }
              } catch (petError) {
                  logger.error(`[onAppointmentCompletedCreateCharge / AppointmentsTrigger / ${tenantId}] Error fetching pet ${petId} from subcollection:`, petError);
              }
          }

          let chargeItems: any[] = [];
          let consultationId: string | null = null;

          const mainServiceItem = {
            itemId: serviceId,
            sourceType: 'appointment',
            sourceId: appointmentId,
            description: serviceName,
            quantity: 1,
            unitPrice: servicePrice,
            totalPrice: servicePrice,
            itemType: serviceType === 'clinica' ? 'clinic' : 'petshop',
          };
          chargeItems.push(mainServiceItem);

          if (serviceType === 'clinica') {
            try {
              logger.info(`[onAppointmentCompletedCreateCharge / AppointmentsTrigger / ${tenantId}] Clinical service. Searching for Consultation linked to appointment ${appointmentId}...`);
              const consultationQuery = db.collection('consultations')
                                        .where('appointmentId', '==', appointmentId)
                                        .where('tenant_id', '==', tenantId)
                                        .limit(1);
              const consultationSnapshot = await consultationQuery.get();

              if (!consultationSnapshot.empty) {
                const consultationDoc = consultationSnapshot.docs[0];
                consultationId = consultationDoc.id;
                const consultationData = consultationDoc.data();
                logger.info(`[onAppointmentCompletedCreateCharge / AppointmentsTrigger / ${tenantId}] Found consultation ${consultationId}. Processing consumedItems...`);

                if (consultationData && Array.isArray(consultationData.consumedItems) && consultationData.consumedItems.length > 0) {
                  logger.info(`[onAppointmentCompletedCreateCharge / AppointmentsTrigger / ${tenantId}] Found ${consultationData.consumedItems.length} consumed items.`);

                  const validConsumedItems = consultationData.consumedItems.filter((item: any) =>
                      item && (item.productId || item.id || item.itemId) && item.name
                  );

                  if (validConsumedItems.length !== consultationData.consumedItems.length) {
                     logger.warn(`[onAppointmentCompletedCreateCharge / AppointmentsTrigger / ${tenantId}] Some consumed items were filtered out due to missing required fields. Original: ${consultationData.consumedItems.length}, Valid: ${validConsumedItems.length}`);
                  }

                  const consumedChargeItems = validConsumedItems.map((item: any) => ({
                      itemId: item.productId || item.id || item.itemId,
                      sourceType: 'consultation',
                      sourceId: consultationId,
                      description: item.name || 'Item Consumido',
                      quantity: item.quantity || 1,
                      unitPrice: item.price || item.unit_price || 0,
                      totalPrice: item.total_price || (item.price || item.unit_price || 0) * (item.quantity || 1),
                      itemType: 'product',
                  }));
                  chargeItems = chargeItems.concat(consumedChargeItems);
                  logger.info(`[onAppointmentCompletedCreateCharge / AppointmentsTrigger / ${tenantId}] Added ${consumedChargeItems.length} consumed items to the charge list.`);
                } else {
                   logger.info(`[onAppointmentCompletedCreateCharge / AppointmentsTrigger / ${tenantId}] Consultation ${consultationId} found, but no consumedItems array or it's empty.`);
                }
              } else {
                logger.warn(`[onAppointmentCompletedCreateCharge / AppointmentsTrigger / ${tenantId}] No consultation document found linked to completed clinical appointment ${appointmentId}. Charge will only contain the main service.`);
              }
            } catch (error) {
              logger.error(`[onAppointmentCompletedCreateCharge / AppointmentsTrigger / ${tenantId}] Error querying consultation for appointment ${appointmentId}:`, error);
            }
          }

          if (chargeItems.length === 0) {
              logger.warn(`[onAppointmentCompletedCreateCharge / AppointmentsTrigger / ${tenantId}] No valid items found for charge creation for appointment ${appointmentId}. Skipping.`);
           return;
        }

          logger.info(`[onAppointmentCompletedCreateCharge / AppointmentsTrigger / ${tenantId}] Preparing to add ${chargeItems.length} items to charge for tutor ${tutorId}.`);

          const chargeResult = await addItemsToPendingCharge(
            tenantId,
              tutorId,
              petId,
              chargeItems,
              petName,
              serviceType === 'petshop' ? osNumber : null,
              serviceType === 'clinica' ? currentEpisodeId : null,
              serviceType === 'clinica' ? prontuarioId : null
          );

          if (chargeResult.success) {
              logger.info(`[onAppointmentCompletedCreateCharge / AppointmentsTrigger / ${tenantId}] Successfully processed charge (ID: ${chargeResult.chargeId}) for appointment ${appointmentId}.`);
          } else {
               logger.error(`[onAppointmentCompletedCreateCharge / AppointmentsTrigger / ${tenantId}] Failed to process charge for appointment ${appointmentId}. Error: ${chargeResult.message}`, chargeResult.errorDetails);
          }

        } catch (error) {
          logger.error(`[onAppointmentCompletedCreateCharge / AppointmentsTrigger / ${tenantId}] Unhandled error processing appointment ${appointmentId}:`, error);
        }
    } else {
      if (statusAfter !== 'completed') {
        logger.log(`[onAppointmentCompletedCreateCharge / AppointmentsTrigger / ${tenantId}] Triggered for appointment ${appointmentId}, but status is now '${statusAfter}' (not 'completed'). No action taken.`);
      } else {
         logger.log(`[onAppointmentCompletedCreateCharge / AppointmentsTrigger / ${tenantId}] Triggered for appointment ${appointmentId}, but status was already 'completed'. No action taken.`);
      }
    }

    const functionEndTime = Date.now();
    logger.info(`[onAppointmentCompletedCreateCharge / AppointmentsTrigger / ${tenantId}] Function execution finished for appointment ${appointmentId}. Duration: ${functionEndTime - functionStartTime}ms`);
  }
); 