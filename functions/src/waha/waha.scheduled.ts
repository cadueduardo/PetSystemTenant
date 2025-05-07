import { onSchedule, ScheduledEvent } from "firebase-functions/v2/scheduler";
import * as logger from "firebase-functions/logger";
import axios from 'axios';
import { db, admin } from "../config/firebase"; // Importar admin (namespace)
import { CODE_VERSION, REGION } from "../config/constants";
import { wahaApiUrl, wahaApiKey } from "../config/params";
import { QueryDocumentSnapshot } from "firebase-functions/v2/firestore"; // Para tipo de appointmentDoc
import {
    formatDateTime,
    getWahaApiHeaders,
    logWahaAxiosError
} from "../utils";

// Função Auxiliar Refatorada para Processar Agendamento (WAHA Confirmation)
async function processAndSendConfirmation(
    appointmentDoc: QueryDocumentSnapshot, // Usar tipo importado
    tenantId: string,
    companyName: string,
    messagingSettings: any // Considerar criar uma interface para messagingSettings
) {
    const appointmentId = appointmentDoc.id;
    const appointmentData = appointmentDoc.data();
    logger.info(`[Scheduler Process] Processing appointment ${appointmentId} for tenant ${tenantId}.`);

    if (appointmentData.last_confirmation_sent_at) {
        logger.info(`[Scheduler Process] Appointment ${appointmentId} already has last_confirmation_sent_at. Skipping.`);
        return;
    }

    const customerId = appointmentData.customer_id;
    const petName = appointmentData.pet_name || 'seu pet';
    const appointmentStartTime = appointmentData.start_time as admin.firestore.Timestamp; // Usar admin.firestore.Timestamp

    if (!customerId) {
        logger.warn(`[Scheduler Process] Appointment ${appointmentId} for tenant ${tenantId} has no customer_id. Skipping.`);
        return;
    }

    try {
        // <<< ATENÇÃO: db.collection('customers') é uma coleção raiz. Se for subcoleção, ajustar path. >>>
        // No código original do index.ts, parecia ser raiz, mas em sendWahaConfirmation é subcoleção.
        // Assumindo que para a função agendada, o cliente pode ser de uma coleção raiz ou precisa de tenantId no path.
        // Se for subcoleção: const customerDoc = await db.collection('tenants').doc(tenantId).collection('customers').doc(customerId).get();
        const customerDoc = await db.collection('customers').doc(customerId).get(); 
        if (!customerDoc.exists) {
            logger.warn(`[Scheduler Process] Customer ${customerId} not found for appointment ${appointmentId}. Skipping.`);
            return;
        }
        const customerData = customerDoc.data();
        const customerPhone = customerData?.phone_waha_id || customerData?.phone;
        const customerName = customerData?.full_name || 'Cliente';

        if (!customerPhone) {
            logger.warn(`[Scheduler Process] Customer ${customerId} has no phone number. Skipping appointment ${appointmentId}.`);
            return;
        }
        const chatIdForWaha = customerPhone.includes('@') ? customerPhone : `55${customerPhone.replace(/\D/g, '')}@c.us`;

        const defaultTemplate = "ERRO: Template de confirmação padrão não encontrado ou configurado.";
        let messageText = defaultTemplate;

        if (messagingSettings && typeof messagingSettings.template_confirmation === 'string' && messagingSettings.template_confirmation.trim() !== '') {
            messageText = messagingSettings.template_confirmation;
            logger.info(`[Scheduler Process] Using specific confirmation template for tenant ${tenantId}: \"${messageText.substring(0, 50)}...\"`);
        } else {
            logger.warn(`[Scheduler Process] Specific confirmation template not found or empty for tenant ${tenantId}. Falling back to default/error message.`);
        }

        messageText = messageText.replace('{cliente}', customerName);
        messageText = messageText.replace('{clinica}', companyName);
        messageText = messageText.replace('{pet}', petName);
        messageText = messageText.replace('{data_hora}', formatDateTime(appointmentStartTime));

        if (messageText === defaultTemplate) {
            logger.error(`[Scheduler Process] Skipping send for appointment ${appointmentId} due to missing template configuration.`);
           return;
        }

        logger.info(`[Scheduler Process] Tenant ${tenantId}: Preparing to send confirmation for appointment ${appointmentId} to ${chatIdForWaha}. Message: \"${messageText}\"`);

        // Usar waha_api_key e waha_api_url de messagingSettings se disponíveis, senão usar os globais
        const effectiveApiKey = messagingSettings?.waha_api_key || wahaApiKey.value();
        const effectiveApiUrl = messagingSettings?.waha_api_url || wahaApiUrl.value();
        const sessionName = `session_${tenantId}`;

        if (!effectiveApiUrl || !effectiveApiKey) {
            logger.error(`[Scheduler Process] Cannot send message for tenant ${tenantId}: WAHA API URL or Key missing (checked tenant and global config).`);
            return;
        }

        const sendUrl = `${effectiveApiUrl.replace(/\/$/, '')}/api/sendText`;
        const payload = { session: sessionName, chatId: chatIdForWaha, text: messageText };
        const headers = getWahaApiHeaders(effectiveApiKey as string); // Cast se effectiveApiKey pode ser undefined, mas a checagem acima deve cobrir
        headers['Content-Type'] = 'application/json';

        try {
            const response = await axios.post(sendUrl, payload, { headers });
            if (response.status >= 200 && response.status < 300) {
                logger.info(`[Scheduler Process] WAHA confirmation sent successfully for appointment ${appointmentId}. Updating status.`);
                await appointmentDoc.ref.update({
                    status: 'pending_confirmation',
                    last_confirmation_sent_at: admin.firestore.FieldValue.serverTimestamp(), // Usar admin.firestore.FieldValue
                    updated_at: admin.firestore.FieldValue.serverTimestamp() // Usar admin.firestore.FieldValue
                });
            } else {
                logger.error(`[Scheduler Process] WAHA API responded with ${response.status} for appointment ${appointmentId}.`);
            }
        } catch (sendError: any) {
            logWahaAxiosError(`scheduledWahaConfirmationSender (Send - Helper)`, sessionName, tenantId, sendError);
            logger.error(`[Scheduler Process] Failed to send WAHA message for appointment ${appointmentId}.`);
        }

    } catch (innerError) {
        logger.error(`[Scheduler Process] Error processing appointment ${appointmentId} for tenant ${tenantId}:`, { error: innerError });
    }
}

export const scheduledWahaConfirmationSender = onSchedule(
    {
        schedule: "every 15 minutes",
        region: REGION
    },
    async (event: ScheduledEvent): Promise<void> => {
        const functionStartTime = Date.now();
        logger.info(`>>>>>>>>>> scheduledWahaConfirmationSender (v: ${CODE_VERSION}) STARTED <<<<<<<<<<`);

        try {
            const tenantsSnapshot = await db.collection('tenants').where('status', '==', 'active').get();
            logger.info(`[Scheduler] Found ${tenantsSnapshot.size} active tenants.`);

            if (tenantsSnapshot.empty) {
                logger.info("[Scheduler] No active tenants found. Exiting function.");
                return;
            }

            const processingPromises = tenantsSnapshot.docs.map(async (tenantDoc) => {
                const tenantId = tenantDoc.id;
                const tenantData = tenantDoc.data();
                const companyName = tenantData.name || `Tenant ${tenantId}`;
                logger.info(`[Scheduler] Processing tenant: ${companyName} (${tenantId})`);

                let messagingSettings = null;
                try {
                    const customQuery = await db.collection('customizations')
                                                .where('tenant_id', '==', tenantId)
                                                .limit(1)
                                                .get();
                    if (!customQuery.empty) {
                        messagingSettings = customQuery.docs[0].data()?.messaging_settings;
                        logger.info(`[Scheduler] Found messaging settings for tenant ${tenantId}.`);
                    } else {
                        logger.warn(`[Scheduler] No customization document found for tenant ${tenantId}. Skipping tenant.`);
                        return;
                    }
                } catch (configError) {
                    logger.error(`[Scheduler] Failed to load messaging settings for tenant ${tenantId}`, { error: configError });
                    return;
                }

                if (!messagingSettings?.auto_send_confirmation) {
                    logger.info(`[Scheduler] Auto-confirmation disabled for tenant ${tenantId}. Skipping.`);
                    return;
                }
                logger.info(`[Scheduler] Auto-confirmation ENABLED for tenant ${tenantId}.`);

                const sendBeforeHours = messagingSettings.send_before_hours || 24;
                const now = new Date();
                const nowTimestamp = admin.firestore.Timestamp.fromDate(now); // Usar admin.firestore.Timestamp
                const windowStart = new Date(now.getTime() + sendBeforeHours * 60 * 60 * 1000);
                const windowStartTimestamp = admin.firestore.Timestamp.fromDate(windowStart); // Usar admin.firestore.Timestamp
                const windowEnd = new Date(windowStart.getTime() + 15 * 60 * 1000);
                const windowEndTimestamp = admin.firestore.Timestamp.fromDate(windowEnd); // Usar admin.firestore.Timestamp

                logger.info(`[Scheduler Query 1] Tenant ${tenantId}: Checking standard window ${windowStart.toISOString()} to ${windowEnd.toISOString()}`);
                const standardAppointmentsQuery = db.collection('appointments')
                    .where('tenant_id', '==', tenantId)
                    .where('status', '==', 'scheduled')
                    .where('start_time', '>=', windowStartTimestamp)
                    .where('start_time', '<', windowEndTimestamp);

                logger.info(`[Scheduler Query 2] Tenant ${tenantId}: Checking near-term window ${now.toISOString()} to ${windowStart.toISOString()}`);
                const nearTermAppointmentsQuery = db.collection('appointments')
                    .where('tenant_id', '==', tenantId)
                    .where('status', '==', 'scheduled')
                    .where('start_time', '>=', nowTimestamp)
                    .where('start_time', '<', windowStartTimestamp);

                try {
                    const [standardSnapshot, nearTermSnapshot] = await Promise.all([
                        standardAppointmentsQuery.get(),
                        nearTermAppointmentsQuery.get()
                    ]);

                    logger.info(`[Scheduler Results] Tenant ${tenantId}: Found ${standardSnapshot.size} in standard window, ${nearTermSnapshot.size} in near-term window.`);

                    for (const appointmentDoc of standardSnapshot.docs) {
                        await processAndSendConfirmation(appointmentDoc, tenantId, companyName, messagingSettings);
                    }

                    for (const appointmentDoc of nearTermSnapshot.docs) {
                        await processAndSendConfirmation(appointmentDoc, tenantId, companyName, messagingSettings);
                    }

                } catch (queryError: any) {
                     logger.error(`[Scheduler] Tenant ${tenantId}: !!! FAILED TO EXECUTE APPOINTMENT QUERIES !!!`, {
                         error_message: queryError.message,
                         error_code: queryError.code,
                         error_details: queryError.details,
                     });
                     return;
                }
            });

            await Promise.all(processingPromises);

        } catch (error) {
            logger.error(`!!!!!!!!!! scheduledWahaConfirmationSender (v: ${CODE_VERSION}) FAILED !!!!!!!!!!`, { error: error });
        } finally {
            const functionEndTime = Date.now();
            logger.info(`>>>>>>>>>> scheduledWahaConfirmationSender (v: ${CODE_VERSION}) FINISHED (Duration: ${functionEndTime - functionStartTime}ms) <<<<<<<<<<`);
        }
    }
); 