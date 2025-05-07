import { onDocumentWritten, FirestoreEvent, Change } from "firebase-functions/v2/firestore";
import { DocumentSnapshot } from "firebase-admin/firestore";
import { onRequest } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import { db, admin } from "../config/firebase";
import { REGION } from "../config/constants";
import { wahaApiUrl, wahaApiKey } from "../config/params";
import {
    formatDateTime,
    getWahaApiHeaders,
    cancelTaskIfExists
} from "../utils";
import axios from 'axios';

// --- Cloud Tasks Constants & Client (Movido de index.ts) ---
const TASKS_QUEUE_ID = "waha-confirmations"; // Mesmo que usado em utils/tasks.utils.ts, pode ser específico aqui para a URL do handler
const TASKS_LOCATION_ID = REGION; // Usar a REGION principal
const TASKS_HANDLER_FUNCTION_NAME = "wahaConfirmationTaskHandler"; // Nome da função HTTP handler abaixo
const PROJECT_ID = process.env.GCLOUD_PROJECT;

if (!PROJECT_ID) {
    logger.error("[WAHA Tasks Config] GCLOUD_PROJECT environment variable is not set.");
    // Não lançar erro aqui para permitir que outras funções do módulo sejam importadas,
    // mas as funções de task não funcionarão.
}

// tasksClient e parent são importados de utils/tasks.utils.ts e usados por cancelTaskIfExists.
// Se createTask for chamado diretamente aqui, precisaremos do tasksClient e parent daqui também.
// Por enquanto, cancelTaskIfExists é suficiente.
// Para createTask, vamos instanciar um novo cliente ou reusar o de utils.
// Reusar o de utils é melhor para consistência.
import { tasksClient as globalTasksClient, parent as globalTasksParent } from "../utils/tasks.utils";

export const scheduleWahaConfirmationTask = onDocumentWritten(
    { document: "appointments/{appointmentId}", region: REGION },
    async (event: FirestoreEvent<Change<DocumentSnapshot> | undefined, { appointmentId: string }>) => {
        const functionStartTime = Date.now();
        const appointmentId = event.params.appointmentId;
        logger.info(`[TaskScheduler - ${appointmentId}] scheduleWahaConfirmationTask STARTED.`);

        const change = event.data;
        const taskId = `waha-confirm-${appointmentId}`;

        await cancelTaskIfExists(taskId);

        if (!change || !change.after.exists) {
            logger.info(`[TaskScheduler - ${appointmentId}] Document deleted or does not exist after write. No new task scheduled.`);
            return;
        }

        const appointmentData = change.after.data();
        if (!appointmentData) {
            logger.warn(`[TaskScheduler - ${appointmentId}] Appointment data is undefined after ensuring existence. Skipping.`);
            return;
        }
        const status = appointmentData?.status;
        const startTime = appointmentData?.start_time as admin.firestore.Timestamp | undefined;
        const tenantId = appointmentData?.tenant_id;

        if (!tenantId || status !== 'scheduled' || !startTime) {
            logger.info(`[TaskScheduler - ${appointmentId}] Appointment not eligible for scheduling (status: ${status}, tenant: ${tenantId}, startTime: ${startTime}).`);
            return;
        }

        let messagingSettings = null;
        let sendBeforeHours = 24;
        try {
            const customQuery = await db.collection('customizations').where('tenant_id', '==', tenantId).limit(1).get();
            if (!customQuery.empty) {
                messagingSettings = customQuery.docs[0].data()?.messaging_settings;
                if (messagingSettings?.auto_send_confirmation === false) {
                    logger.info(`[TaskScheduler - ${appointmentId}] Auto-confirmation disabled for tenant ${tenantId}.`);
                    return;
                }
                sendBeforeHours = messagingSettings?.send_before_hours || 24;
            } else {
                logger.warn(`[TaskScheduler - ${appointmentId}] No customization document found for tenant ${tenantId}. Using defaults.`);
            }
        } catch (configError) {
            logger.error(`[TaskScheduler - ${appointmentId}] Failed to load messaging settings for tenant ${tenantId}`, { error: configError });
            return;
        }

        const startTimeMillis = startTime.toMillis();
        const dispatchTimeMillis = startTimeMillis - (sendBeforeHours * 60 * 60 * 1000);
        const nowMillis = Date.now();

        if (dispatchTimeMillis <= nowMillis + (5 * 60 * 1000)) {
             logger.info(`[TaskScheduler - ${appointmentId}] Dispatch time is in the past or too soon. Skipping task scheduling.`, { dispatchTimeMillis, nowMillis });
             return;
        }

        if (dispatchTimeMillis > nowMillis + (30 * 24 * 60 * 60 * 1000)) {
             logger.warn(`[TaskScheduler - ${appointmentId}] Dispatch time is too far in the future (> 30 days). Skipping task scheduling.`);
             return;
        }

        const serviceAccountEmail = process.env.FUNCTIONS_EMULATOR
            ? 'firebase-sa-emulator@example.com' // Emulador
            : `${PROJECT_ID}@appspot.gserviceaccount.com`; // Ambiente de produção

        if (!PROJECT_ID) {
            logger.error("[TaskScheduler] Cannot schedule task: GCLOUD_PROJECT is not set.");
            return; // Não pode continuar sem PROJECT_ID
        }
        
        // A URL do handler deve ser a da função exportada abaixo
        const taskHandlerUrl = `https://${TASKS_LOCATION_ID}-${PROJECT_ID}.cloudfunctions.net/${TASKS_HANDLER_FUNCTION_NAME}`;
        logger.info(`[TaskScheduler - ${appointmentId}] Target Task Handler URL: ${taskHandlerUrl}`);

        const task = {
            httpRequest: {
                httpMethod: 'POST' as const,
                url: taskHandlerUrl,
                headers: { 'Content-Type': 'application/json' },
                body: Buffer.from(JSON.stringify({ appointmentId, tenantId })).toString('base64'),
                 oidcToken: {
                   serviceAccountEmail: serviceAccountEmail,
                 },
            },
            scheduleTime: {
                seconds: Math.floor(dispatchTimeMillis / 1000),
            },
             name: `${globalTasksParent}/tasks/${taskId}` // Usar globalTasksParent de utils
        };

        try {
            logger.info(`[TaskScheduler - ${appointmentId}] Scheduling task for ${new Date(dispatchTimeMillis).toISOString()}. Task Name: ${task.name}`);
            await globalTasksClient.createTask({ parent: globalTasksParent, task }); // Usar globalTasksClient e parent de utils
            logger.info(`[TaskScheduler - ${appointmentId}] Task scheduled successfully.`);
        } catch (error: any) {
             if (error.code === 6) { // ALREADY_EXISTS
                 logger.warn(`[TaskScheduler - ${appointmentId}] Task with name ${task.name} already exists. It might be processing or cancellation failed.`, { errorInfo: error.message });
             } else {
                 logger.error(`[TaskScheduler - ${appointmentId}] Failed to schedule task.`, { error: error.message, errorCode: error.code, taskName: task.name });
             }
        }
         logger.info(`[TaskScheduler - ${appointmentId}] scheduleWahaConfirmationTask FINISHED (Duration: ${Date.now() - functionStartTime}ms).`);
    }
);

export const wahaConfirmationTaskHandler = onRequest(
    {
        region: TASKS_LOCATION_ID, // Usar a constante definida acima
        timeoutSeconds: 540,
        memory: '256MiB',
        // Se estiver usando OIDC token com a service account da função, o invoker pode ser configurado para essa SA.
        // Por simplicidade e para permitir testes locais com o emulador (onde OIDC pode ser mais complexo de simular para tasks), 
        // pode-se manter 'public' e adicionar uma verificação de header X-CloudTasks-QueueName.
        invoker: ["public"], 
    },
    async (req, res) => {
        const functionStartTime = Date.now();
        logger.info(`[TaskHandler] wahaConfirmationTaskHandler STARTED.`);

        if (req.method !== 'POST') {
            logger.warn('[TaskHandler] Received non-POST request.');
            res.status(405).send('Method Not Allowed');
            return;
        }

        // Verificação de Segurança: Garantir que a requisição veio do Cloud Tasks
        const queueNameHeader = req.headers['x-cloudtasks-queuename'];
        if (!queueNameHeader || queueNameHeader !== TASKS_QUEUE_ID) {
            logger.error('[TaskHandler] SECURITY ALERT: Missing or invalid X-CloudTasks-QueueName header.', { received: queueNameHeader, expected: TASKS_QUEUE_ID });
            res.status(403).send('Forbidden: Invalid Cloud Tasks origin.');
            return;
        }
        logger.info(`[TaskHandler] Cloud Tasks header validated. Queue: ${queueNameHeader}`);

        try {
            const { appointmentId, tenantId } = req.body;

            if (!appointmentId || !tenantId) {
                logger.error('[TaskHandler] Missing appointmentId or tenantId in payload.', { body: req.body });
                res.status(400).send('Bad Request: Missing parameters.');
                return;
            }
            logger.info(`[TaskHandler - ${appointmentId}] Processing task for tenant ${tenantId}.`);

            const appointmentRef = db.collection('appointments').doc(appointmentId);
            const appointmentDoc = await appointmentRef.get();

            if (!appointmentDoc.exists) {
                logger.warn(`[TaskHandler - ${appointmentId}] Appointment document not found. Task likely stale. Skipping.`);
                res.status(200).send('OK: Appointment not found.'); // Responde OK para a task não tentar novamente
                return;
            }

            const appointmentData = appointmentDoc.data();
            if (!appointmentData) {
                logger.warn(`[TaskHandler - ${appointmentId}] Appointment data is undefined after ensuring existence. Skipping.`);
                res.status(200).send('OK: Appointment data missing.');
                return;
            }

            if (appointmentData.status !== 'scheduled') {
                logger.info(`[TaskHandler - ${appointmentId}] Appointment status is no longer 'scheduled' (${appointmentData.status}). Skipping.`);
                res.status(200).send('OK: Status changed.');
                return;
            }
             if (appointmentData.last_confirmation_sent_at) {
                 const sentAtDate = (appointmentData.last_confirmation_sent_at as admin.firestore.Timestamp).toDate();
                 logger.info(`[TaskHandler - ${appointmentId}] Confirmation already marked as sent at ${sentAtDate.toISOString()}. Skipping duplicate send.`);
                 res.status(200).send('OK: Already sent.');
                 return;
             }

            let messagingSettings = null;
            let companyName = `Tenant ${tenantId}`;
            try {
                 const tenantDoc = await db.collection('tenants').doc(tenantId).get();
                 if (tenantDoc.exists) {
                    companyName = tenantDoc.data()?.name || tenantDoc.data()?.company_name || companyName;
                 }

                 const customQuery = await db.collection('customizations').where('tenant_id', '==', tenantId).limit(1).get();
                 if (!customQuery.empty) {
                     messagingSettings = customQuery.docs[0].data()?.messaging_settings;
                     if (messagingSettings?.auto_send_confirmation === false) {
                         logger.info(`[TaskHandler - ${appointmentId}] Auto-confirmation disabled for tenant ${tenantId}. Skipping.`);
                         res.status(200).send('OK: Disabled.');
                         return;
                     }
                 } else {
                     logger.warn(`[TaskHandler - ${appointmentId}] Customization not found for tenant ${tenantId}. Will use global WAHA settings if available.`);
                 }
            } catch (configError) {
                 logger.error(`[TaskHandler - ${appointmentId}] Failed to load config before sending. Will use global WAHA settings if available.`, { error: configError });
            }

            logger.info(`[TaskHandler - ${appointmentId}] Calling send confirmation logic...`);
            try {
                 const customerId = appointmentData.customer_id;
                 if (!customerId) {
                     logger.error(`[TaskHandler - ${appointmentId}] Missing customer_id in appointment.`);
                     throw new Error("Missing customer_id");
                 }
                
                 const customerRef = db.collection('tenants').doc(tenantId).collection('customers').doc(customerId);
                 const customerDoc = await customerRef.get();

                 if (!customerDoc.exists) {
                     logger.error(`[TaskHandler - ${appointmentId}] Customer ${customerId} for tenant ${tenantId} not found.`);
                     throw new Error("Customer not found");
                 }
                 const customerData = customerDoc.data()!;
                 const customerPhone = customerData?.phone_waha_id || customerData?.phone;
                 const customerName = customerData?.full_name || 'Cliente';
                 const petName = appointmentData.pet_name || 'seu pet';
                 const startTime = appointmentData.start_time as admin.firestore.Timestamp;
                 const formattedTime = formatDateTime(startTime);

                 if (!customerPhone) {
                     logger.error(`[TaskHandler - ${appointmentId}] Customer phone not found.`);
                     throw new Error("Customer phone not found");
                 }
                 const chatIdForWaha = customerPhone.includes('@') ? customerPhone : `55${customerPhone.replace(/\D/g, '')}@c.us`;

                const defaultTemplate = "ERRO: Template de confirmação padrão não encontrado ou configurado.";
                let messageText = defaultTemplate;

                const specificTemplate = messagingSettings?.template_confirmation;
                if (specificTemplate && typeof specificTemplate === 'string' && specificTemplate.trim() !== '') {
                    messageText = specificTemplate;
                } else {
                    logger.warn(`[TaskHandler - ${appointmentId}] Specific confirmation template not found/empty for tenant ${tenantId}.`);
                }

                messageText = messageText.replace('{cliente}', customerName);
                messageText = messageText.replace('{clinica}', companyName);
                messageText = messageText.replace('{pet}', petName);
                messageText = messageText.replace('{data_hora}', formattedTime);

                 if (messageText === defaultTemplate || messageText.startsWith("ERRO:")) {
                     logger.error(`[TaskHandler - ${appointmentId}] Skipping send due to missing or error in template configuration. Final template: "${messageText}"`);
                     throw new Error("Missing or error in template configuration");
                 }

                 const tenantWahaApiKey = messagingSettings?.waha_api_key;
                 const tenantWahaApiUrl = messagingSettings?.waha_api_url;

                 const effectiveWahaApiKey = (tenantWahaApiKey && typeof tenantWahaApiKey === 'string' && tenantWahaApiKey.trim() !== '') 
                                            ? tenantWahaApiKey 
                                            : wahaApiKey.value();
                 const effectiveWahaApiUrl = (tenantWahaApiUrl && typeof tenantWahaApiUrl === 'string' && tenantWahaApiUrl.trim() !== '')
                                           ? tenantWahaApiUrl
                                           : wahaApiUrl.value();
                                           
                 const sessionName = `session_${tenantId}`;

                 if (!effectiveWahaApiUrl || !effectiveWahaApiKey) {
                     logger.error(`[TaskHandler - ${appointmentId}] WAHA API URL or Key is effectively missing (Tenant or Global).`);
                      throw new Error("WAHA config (URL/Key) missing");
                 }

                 const sendUrl = `${effectiveWahaApiUrl.replace(/\/$/, '')}/api/sendText`;
                 const payload = { session: sessionName, chatId: chatIdForWaha, text: messageText };
                 const headers = getWahaApiHeaders(effectiveWahaApiKey as string);
                 headers['Content-Type'] = 'application/json';

                 logger.info(`[TaskHandler - ${appointmentId}] Sending WAHA message to ${chatIdForWaha}. URL: ${sendUrl}`);
                 await axios.post(sendUrl, payload, { headers });
                 logger.info(`[TaskHandler - ${appointmentId}] WAHA message sent successfully.`);

                  await appointmentRef.update({
                      last_confirmation_sent_at: admin.firestore.FieldValue.serverTimestamp(),
                      status: 'pending_confirmation',
                      updated_at: admin.firestore.FieldValue.serverTimestamp()
                  });
                  logger.info(`[TaskHandler - ${appointmentId}] Appointment status updated to pending_confirmation.`);
                  res.status(200).send('OK: Confirmation Sent');

            } catch (sendError: any) {
                 logger.error(`[TaskHandler - ${appointmentId}] Error during confirmation sending logic.`, { error: sendError.message || sendError, stack: sendError.stack });
                 res.status(500).send(`Error sending confirmation: ${sendError.message}`);
                 return;
            }
        } catch (error: any) {
            logger.error('[TaskHandler] Unexpected error processing task.', { error: error.message || error, stack: error.stack });
            res.status(200).send('OK: Internal Server Error, task will not be retried.');
        } finally {
             logger.info(`[TaskHandler] wahaConfirmationTaskHandler FINISHED (Duration: ${Date.now() - functionStartTime}ms).`);
        }
    }
);