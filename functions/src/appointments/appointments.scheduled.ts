import { onSchedule, ScheduledEvent } from "firebase-functions/v2/scheduler";
import * as logger from "firebase-functions/logger";
import axios from 'axios';
import { db, admin } from "../config/firebase";
import { CODE_VERSION, REGION } from "../config/constants";
import { wahaApiUrl, wahaApiKey } from "../config/params";
import { formatDateTime, getWahaApiHeaders, logWahaAxiosError } from "../utils";

export const scheduledAutoCancellation = onSchedule(
    { schedule: "every 15 minutes", region: REGION },
    async (event: ScheduledEvent): Promise<void> => {
        const functionStartTime = Date.now();
        logger.info(`>>>>>>>>>> scheduledAutoCancellation (ApptScheduled / v: ${CODE_VERSION}) STARTED <<<<<<<<<<`);

        try {
            const tenantsSnapshot = await db.collection('tenants').where('status', '==', 'active').get();
            logger.info(`[AutoCancel / ApptScheduled] Found ${tenantsSnapshot.size} active tenants.`);

            if (tenantsSnapshot.empty) {
                logger.info("[AutoCancel / ApptScheduled] No active tenants found. Exiting.");
                return;
            }

            const processingPromises = tenantsSnapshot.docs.map(async (tenantDoc: admin.firestore.QueryDocumentSnapshot) => {
                const tenantId = tenantDoc.id;
                const tenantData = tenantDoc.data();
                const companyName = tenantData.name || `Tenant ${tenantId}`;
                logger.info(`[AutoCancel / ApptScheduled] Processing tenant: ${companyName} (${tenantId})`);

                let messagingSettings = null;
                try {
                    const customQuery = await db.collection('customizations')
                                                .where('tenant_id', '==', tenantId)
                                                .limit(1)
                                                .get();
                    if (!customQuery.empty) {
                        messagingSettings = customQuery.docs[0].data()?.messaging_settings;
                        logger.info(`[AutoCancel / ApptScheduled] Found messaging settings for tenant ${tenantId}.`);
                    } else {
                        logger.warn(`[AutoCancel / ApptScheduled] No customization document found for tenant ${tenantId}. Skipping tenant.`);
                        return;
                    }
                } catch (configError) {
                    logger.error(`[AutoCancel / ApptScheduled] Failed to load messaging settings for tenant ${tenantId}. Skipping tenant.`, { error: configError });
                    return;
                }

                if (!messagingSettings?.enable_auto_cancel) {
                    logger.info(`[AutoCancel / ApptScheduled] Auto-cancellation disabled for tenant ${tenantId}. Skipping.`);
                    return;
                }
                logger.info(`[AutoCancel / ApptScheduled] Auto-cancellation ENABLED for tenant ${tenantId}.`);

                const cancelBeforeHours = messagingSettings.cancel_if_unconfirmed_hours_before || 3;
                const now = new Date();
                const cancelDeadline = new Date(now.getTime() + cancelBeforeHours * 60 * 60 * 1000);
                const cancelDeadlineTimestamp = admin.firestore.Timestamp.fromDate(cancelDeadline);
                const nowTimestamp = admin.firestore.Timestamp.fromDate(now);

                logger.info(`[AutoCancel Query / ApptScheduled] Tenant ${tenantId}: Checking for pending appointments before ${cancelDeadline.toISOString()}`);
                const appointmentsToCancelQuery = db.collection('appointments')
                    .where('tenant_id', '==', tenantId)
                    .where('status', '==', 'pending_confirmation')
                    .where('start_time', '<=', cancelDeadlineTimestamp)
                    .where('start_time', '>', nowTimestamp);

                try {
                    const cancelSnapshot = await appointmentsToCancelQuery.get();
                    logger.info(`[AutoCancel Results / ApptScheduled] Tenant ${tenantId}: Found ${cancelSnapshot.size} appointments to auto-cancel.`);

                    if (cancelSnapshot.empty) {
                        return;
                    }

                    for (const appointmentDoc of cancelSnapshot.docs) {
                        const appointmentId = appointmentDoc.id;
                        const appointmentData = appointmentDoc.data();
                        const customerId = appointmentData.customer_id;

                        logger.info(`[AutoCancel Proc / ApptScheduled] Processing cancellation for appointment ${appointmentId}...`);

                        if (!customerId) {
                            logger.warn(`[AutoCancel Proc - ${appointmentId} / ApptScheduled] Missing customerId. Cannot send notification.`);
                             await appointmentDoc.ref.update({
                                 status: 'canceled',
                                 cancelled_via: 'auto_system',
                                 cancellation_reason: 'Falta de confirmação (automático)',
                                 updated_at: admin.firestore.FieldValue.serverTimestamp()
                             });
                             logger.info(`[AutoCancel Proc - ${appointmentId} / ApptScheduled] Appointment status updated to canceled (no notification sent).`);
                             continue;
                        }

                        await appointmentDoc.ref.update({
                            status: 'canceled',
                            cancelled_via: 'auto_system',
                            cancellation_reason: 'Falta de confirmação (automático)',
                            updated_at: admin.firestore.FieldValue.serverTimestamp()
                        });
                        logger.info(`[AutoCancel Proc - ${appointmentId} / ApptScheduled] Appointment status updated to canceled.`);

                        const notificationTemplate = messagingSettings.template_auto_cancel_notification;
                        if (!notificationTemplate || typeof notificationTemplate !== 'string' || notificationTemplate.trim() === '') {
                            logger.warn(`[AutoCancel Proc - ${appointmentId} / ApptScheduled] Auto-cancel notification template empty or missing for tenant ${tenantId}. No notification sent.`);
                            continue;
                        }

                        try {
                            const customerDoc = await db.collection('customers').doc(customerId).get();
                            if (!customerDoc.exists) {
                                logger.error(`[AutoCancel Notify - ${appointmentId} / ApptScheduled] Customer ${customerId} not found. Cannot send notification.`);
                                continue;
                            }
                            const customerData = customerDoc.data();
                            const customerPhone = customerData?.phone_waha_id || customerData?.phone;
                            const customerName = customerData?.full_name || 'Cliente';

                            if (!customerPhone) {
                                logger.error(`[AutoCancel Notify - ${appointmentId} / ApptScheduled] Customer ${customerId} has no phone number. Cannot send notification.`);
                                continue;
                            }
                            const chatId = customerPhone.includes('@') ? customerPhone : `55${customerPhone.replace(/\D/g, '')}@c.us`;

                            let messageText = notificationTemplate;
                            messageText = messageText.replace('{cliente}', customerName);
                            messageText = messageText.replace('{clinica}', companyName);
                            messageText = messageText.replace('{pet}', appointmentData.pet_name || 'seu pet');
                            messageText = messageText.replace('{data_hora}', formatDateTime(appointmentData.start_time));

                            const apiUrl = wahaApiUrl.value();
                            const apiKey = wahaApiKey.value();
                            const sessionName = `session_${tenantId}`;

                            if (!apiUrl || !apiKey) {
                                logger.error(`[AutoCancel Notify - ${appointmentId} / ApptScheduled] Cannot send notification for tenant ${tenantId}: WAHA API URL or Key missing.`);
                                continue;
                            }

                            const sendUrl = `${apiUrl.replace(/\/$/, '')}/api/sendText`;
                            const payload = { session: sessionName, chatId: chatId, text: messageText };
                            const headers = getWahaApiHeaders(apiKey);
                            headers['Content-Type'] = 'application/json';

                            logger.info(`[AutoCancel Notify - ${appointmentId} / ApptScheduled] Sending notification to ${chatId}: "${messageText.substring(0, 50)}..."`);
                            const response = await axios.post(sendUrl, payload, { headers });
                            logger.info(`[AutoCancel Notify - ${appointmentId} / ApptScheduled] WAHA API response for notification:`, { status: response.status });

                        } catch (notifyError) {
                            logWahaAxiosError(`scheduledAutoCancellation (Notify - ${appointmentId} / ApptScheduled)`, `session_${tenantId}`, tenantId, notifyError);
                            logger.error(`[AutoCancel Notify - ${appointmentId} / ApptScheduled] FAILED to send notification.`, { error: notifyError });
                        }
                    }

                } catch (queryError: any) {
                     logger.error(`[AutoCancel Query / ApptScheduled] Tenant ${tenantId}: !!! FAILED TO EXECUTE APPOINTMENT QUERY !!!`, {
                         error_message: queryError.message,
                         error_code: queryError.code,
                         error_details: queryError.details,
                     });
                     return;
                }
            });

            await Promise.all(processingPromises);

        } catch (error) {
            logger.error(`!!!!!!!!!! scheduledAutoCancellation (ApptScheduled / v: ${CODE_VERSION}) FAILED !!!!!!!!!!`, { error: error });
        } finally {
            const functionEndTime = Date.now();
            logger.info(`>>>>>>>>>> scheduledAutoCancellation (ApptScheduled / v: ${CODE_VERSION}) FINISHED (Duration: ${functionEndTime - functionStartTime}ms) <<<<<<<<<<`);
        }
    }
); 