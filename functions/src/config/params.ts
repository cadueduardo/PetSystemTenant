import { defineString, defineSecret } from "firebase-functions/params";

// --- CONFIGURAÇÃO WAHA ---
export const wahaApiUrl = defineString("WAHA_API_URL");
export const wahaApiKey = defineString("WAHA_API_KEY");
export const wahaWebhookHmacKey = defineSecret("WAHA_WEBHOOK_HMAC_KEY"); 