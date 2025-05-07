// import { https } from "firebase-functions/v2"; // REMOVED: Not used
import { onRequest } from "firebase-functions/v2/https"; // Explicit import for onRequest
import * as logger from "firebase-functions/logger";
import axios from 'axios';
import { corsHandler } from "../config/cors";
import { CODE_VERSION, REGION } from "../config/constants";

export const lookupBarcode = onRequest(
  {
    region: REGION,
    timeoutSeconds: 30,
    memory: '128MiB'
  },
  (request, response) => {
    corsHandler(request, response, async () => {
        const functionStartTime = Date.now();
        logger.info(`[lookupBarcode (Cosmos) / BarcodesHttp / v: ${CODE_VERSION}] Function called.`);

        if (request.method !== 'GET') {
            logger.warn(`[lookupBarcode (Cosmos) / BarcodesHttp] Received non-GET request: ${request.method}`);
            response.setHeader('Allow', 'GET');
            response.status(405).send({ error: 'Method Not Allowed' });
            return;
        }

        const barcode = request.query.upc as string;

        if (!barcode) {
            logger.error("[lookupBarcode (Cosmos) / BarcodesHttp] Barcode (upc query parameter) is missing.");
            response.status(400).send({ error: "Missing 'upc' query parameter" });
            return;
        }

        const cleanBarcode = barcode.replace(/\D/g, '');
        logger.info(`[lookupBarcode (Cosmos) / BarcodesHttp] Received request for barcode: ${barcode} (Cleaned: ${cleanBarcode})`);

        // TODO: Consider moving token to params.ts or environment variables
        const cosmosApiUrl = `https://api.cosmos.bluesoft.com.br/gtins/${cleanBarcode}`;
        const cosmosToken = "c8HjHKo6nEbchtVkMJy9qg";
        const headers = {
            'X-Cosmos-Token': cosmosToken,
            'Accept': 'application/json'
        };

        try {
            logger.info(`[lookupBarcode (Cosmos) / BarcodesHttp] Sending request to Cosmos API: ${cosmosApiUrl}`);
            const apiResponse = await axios.get(cosmosApiUrl, {
                 headers: headers,
                 timeout: 15000 // 15 seconds
            });

            logger.info(`[lookupBarcode (Cosmos) / BarcodesHttp] Cosmos API response status: ${apiResponse.status}`);

            if (apiResponse.status === 200 && apiResponse.data) {
                const cosmosData = apiResponse.data;
                logger.info(`[lookupBarcode (Cosmos) / BarcodesHttp] Product found for barcode ${cleanBarcode}. Data:`, cosmosData);

                const itemData = {
                    title: cosmosData.description || null,
                    description: cosmosData.description || null,
                    brand: cosmosData.brand?.name || null,
                    ncm: cosmosData.ncm?.code || null,
                    image_url: cosmosData.thumbnail || cosmosData.gtin?.image || null,
                    barcode: cleanBarcode,
                };

                response.status(200).send({ code: "OK", item: itemData });

            } else {
                logger.warn(`[lookupBarcode (Cosmos) / BarcodesHttp] Barcode ${cleanBarcode} potentially not found or unexpected status ${apiResponse.status}. Data:`, apiResponse.data);
                response.status(200).send({ code: "NOT_FOUND", message: `Product not found or unexpected status ${apiResponse.status}` });
            }

        } catch (error: any) {
            const duration = Date.now() - functionStartTime;
            if (axios.isAxiosError(error)) {
                 const status = error.response?.status;
                 const responseData = error.response?.data;
                 logger.error(
                    `[lookupBarcode (Cosmos) / BarcodesHttp / v: ${CODE_VERSION}] Axios error fetching GTIN ${cleanBarcode} (Duration: ${duration}ms):`,
                    {
                        axiosErrorCode: error.code,
                        cosmosApiStatus: status,
                        cosmosApiResponse: responseData,
                        requestUrl: error.config?.url,
                        originalErrorMessage: error.message
                    }
                 );

                 if (status === 404) {
                      logger.info(`[lookupBarcode (Cosmos) / BarcodesHttp] Barcode ${cleanBarcode} not found in Cosmos (404).`);
                      response.status(200).send({ code: "NOT_FOUND", message: "Produto não encontrado na base Cosmos (404)." });
                 } else if (status === 401 || status === 403) {
                      logger.error(`[lookupBarcode (Cosmos) / BarcodesHttp] Authentication/Authorization error with Cosmos API (${status}). Check token.`);
                      response.status(500).send({ error: "Configuration Error", message: "Falha na autenticação com a API de produtos. Verifique o token configurado." });
                 } else if (status === 429) {
                      logger.warn(`[lookupBarcode (Cosmos) / BarcodesHttp] Rate limit exceeded for Cosmos API (429).`);
                      response.status(429).send({ error: "Rate Limit Exceeded", message: "Limite de consultas à API de produtos foi atingido. Tente novamente mais tarde." });
                 } else {
                      response.status(502).send({ error: "Bad Gateway", message: `Falha ao consultar a API de produtos. Status: ${status || error.code || 'Unknown'}` });
                 }
            } else {
                 logger.error(`[lookupBarcode (Cosmos) / BarcodesHttp / v: ${CODE_VERSION}] Non-Axios error processing barcode ${cleanBarcode} (Duration: ${duration}ms):`, { error: error?.message || 'Unknown error', errorObject: error });
                 response.status(500).send({ error: "Internal Server Error", message: "Erro interno inesperado ao processar a busca de código de barras." });
            }
        }
    });
  }
); 