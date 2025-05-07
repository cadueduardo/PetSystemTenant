import axios from 'axios';
import * as logger from "firebase-functions/logger";
import { HttpsError } from "firebase-functions/v2/https";
import { CODE_VERSION } from "../config/constants"; // Assumindo que CODE_VERSION é necessário aqui

export function getWahaApiHeaders(apiKey: string): Record<string, string> {
    return { 'X-Api-Key': apiKey };
}

export function logWahaAxiosError(functionName: string, sessionName: string | null, tenantId: string | null, error: any) {
    if (axios.isAxiosError(error)) {
        logger.error(
            `${functionName} / v: ${CODE_VERSION}: Axios error details${sessionName ? ` for session ${sessionName}` : ''}:`,
            {
                tenantId,
                axiosErrorCode: error.code,
                wahaResponseStatus: error.response?.status,
                wahaResponseData: Buffer.isBuffer(error.response?.data)
                    ? Buffer.from(error.response.data).toString('utf8')
                    : error.response?.data,
                requestUrl: error.config?.url,
                requestMethod: error.config?.method,
                originalErrorMessage: error.message
            }
        );
    } else {
        logger.error(`${functionName} / v: ${CODE_VERSION}: Non-Axios error${sessionName ? ` for session ${sessionName}` : ''}:`, { tenantId, error: error?.message || 'Unknown error', errorObject: error });
    }
}

export function handleWahaApiError(error: any, sessionName?: string): HttpsError {
     if (axios.isAxiosError(error)) {
         const status = error.response?.status;
         const responseData = error.response?.data;
         const responseDataString = Buffer.isBuffer(responseData)
             ? Buffer.from(responseData).toString('utf8')
             : JSON.stringify(responseData);

         if (status === 401) {
              return new HttpsError("unauthenticated", `Autenticação com a API WhatsApp falhou (401). Verifique a API Key configurada.`);
          }
          if (status === 404) {
               const message = sessionName
                  ? `Sessão ${sessionName} não encontrada (404).`
                  : `Recurso não encontrado na API WhatsApp (404).`;
               return new HttpsError("not-found", message);
          }
          if (status === 400) {
              const wahaMsg = responseDataString || '';
              if (wahaMsg.includes('Session already exists')) {
                   return new HttpsError("already-exists", `A sessão ${sessionName || 'desconhecida'} já existe ou está ativa.`);
              }
              return new HttpsError("invalid-argument", `Erro da API WhatsApp (400 - Bad Request): ${wahaMsg || 'Verifique os dados enviados.'}`);
          }
          if (status === 422) {
               const wahaMsg = responseDataString || '';
               if (wahaMsg.includes("WAHA Core support only 'default' session")) {
                    return new HttpsError("failed-precondition", `A versão atual do WAHA não suporta múltiplas sessões. Use a sessão 'default' ou considere o WAHA Plus.`);
               }
               return new HttpsError("invalid-argument", `Erro da API WhatsApp (422 - Unprocessable Entity): ${wahaMsg || 'Verifique os dados enviados.'}`);
          }
          if (status === 500 ) {
              if(responseDataString?.includes('Session not started')) {
                  return new HttpsError("failed-precondition", `A sessão ${sessionName || 'desconhecida'} não foi iniciada.`);
              }
              return new HttpsError("internal", `Erro interno da API WhatsApp (500).`, { wahaData: responseDataString });
          }
          if(error.response) {
             return new HttpsError("internal", `Erro na API WhatsApp (${status}).`, { wahaData: responseDataString });
          }
          return new HttpsError("unavailable", `Não foi possível conectar à API WhatsApp (${error.code || error.message || 'erro desconhecido'}). Verifique a URL e a rede.`);
     }
     return new HttpsError("internal", "Erro interno inesperado.", { error: error?.message || 'Unknown internal error' });
} 