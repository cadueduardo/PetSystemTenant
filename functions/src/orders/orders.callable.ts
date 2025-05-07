import * as logger from "firebase-functions/logger";
import { HttpsError, onCall, CallableRequest } from "firebase-functions/v2/https";
import { https } from "firebase-functions/v2"; // Required for https.onCall structure
import { db, admin } from "../config/firebase";
import { REGION, CODE_VERSION } from "../config/constants";
import { CreateContinuedOsData, DeleteOsData } from "../types";
import { _internalGenerateOsNumber } from "../utils/generators.utils"; // Specific import

// Função HTTP generateOsNumber (Wrapper para a interna)
export const generateOsNumber = https.onCall(
  {
    region: REGION,
    cors: ["http://localhost:5173", "https://petfacil.app"],
  },
  async (request: CallableRequest) => { // Explicitly type request as CallableRequest
    logger.info(`[generateOsNumber / OrdersCallable / v: ${CODE_VERSION}] Function called.`);

    if (!request.auth?.token?.tenant_id) {
      logger.error("[generateOsNumber / OrdersCallable] Permission denied: User is not authenticated or missing tenant_id.");
      throw new HttpsError("permission-denied", "Ação permitida apenas para usuários logados com tenant.");
    }
    const tenantId = request.auth.token.tenant_id;
    
    try {
      const osNumber = _internalGenerateOsNumber(tenantId);
      return { success: true, osNumber: osNumber };
    } catch (error: any) {
      throw new HttpsError("internal", "Erro interno ao gerar número da OS.", error.message);
    }
  }
);

export const createContinuedOrderService = onCall<CreateContinuedOsData>(
  { 
    region: REGION, 
    cors: true,
    memory: "256MiB",
  },
  async (request: CallableRequest<CreateContinuedOsData>) => {
    logger.info(`[createContinuedOrderService / OrdersCallable / v1.3 ENTRY] Called by UID: ${request.auth?.uid}. Data:`, request.data);

    if (!request.auth) {
       logger.error("[createContinuedOrderService / OrdersCallable / v1.3] Authentication check failed: request.auth is missing.");
       throw new HttpsError("unauthenticated", "Usuário não autenticado.");
    }
    const tenantId = request.auth.token.tenant_id;
    if (!tenantId) {
       logger.error("[createContinuedOrderService / OrdersCallable / v1.3] Tenant ID missing in token:", request.auth.token);
       throw new HttpsError("failed-precondition", "Tenant ID não encontrado no token.");
    }
    const customerId = request.data.customerId;
    if (!customerId) {
        logger.error("[createContinuedOrderService / OrdersCallable / v1.3] Customer ID is missing in request data:", request.data);
        throw new HttpsError("invalid-argument", "Customer ID é obrigatório.");
    }
    logger.info(`[createContinuedOrderService / OrdersCallable / v1.3 Auth/Data OK] Tenant: ${tenantId}, Customer: ${customerId}`);

    let osNumber: string;
    try {
      osNumber = _internalGenerateOsNumber(tenantId);
      logger.info(`[createContinuedOrderService / OrdersCallable / v1.3 OS Num OK] Generated OS Number: ${osNumber}`);
    } catch (error: any) {
        logger.error("[createContinuedOrderService / OrdersCallable / v1.3] Error generating OS number:", error);
        throw new HttpsError("internal", "Erro ao gerar número da OS.", error.message);
    }

    const osCollection = db.collection('tenants').doc(tenantId).collection('order_services');
    const newOsData = {
      osNumber: osNumber,
      customerId: customerId,
      status: "pending_cashier",
      totalValue: 0,
      paymentStatus: "pending",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      createdBy: request.auth?.uid || "unknown",
      createdFrom: "cashier_continue_shopping",
      tenantId: tenantId, 
    };
    logger.info(`[createContinuedOrderService / OrdersCallable / v1.3 OS Data Ready] Data to be saved:`, newOsData);

    try {
      logger.info(`[createContinuedOrderService / OrdersCallable / v1.3 DB Write] Attempting to add new OS document...`);
      const docRef = await osCollection.add(newOsData);
      logger.info(`[createContinuedOrderService / OrdersCallable / v1.3 DB Write OK] Successfully created OS with ID: ${docRef.id}`);
      return { success: true, osId: docRef.id, osNumber: osNumber };
    } catch (error: any) {
        logger.error("[createContinuedOrderService / OrdersCallable / v1.3 DB Write FAILED] Error adding OS document:", error);
        if (error instanceof HttpsError) throw error;
        throw new HttpsError("internal", "Erro ao salvar a nova Ordem de Serviço.", error.message);
    }
  }
);


export const deleteEmptyCashierOs = onCall<
  DeleteOsData,
  Promise<{ success: boolean; deleted: boolean; message?: string }>
>(
  {
    region: REGION,
    cors: ["http://localhost:5173", "https://petfacil.app"],
    memory: "128MiB",
  },
  async (request: CallableRequest<DeleteOsData>) => { // Explicitly type request
    logger.info(`[deleteEmptyCashierOs / OrdersCallable / v: ${CODE_VERSION}] Function called.`);

    if (!request.auth?.uid) {
      logger.error("[deleteEmptyCashierOs / OrdersCallable] Unauthenticated user.");
      throw new HttpsError("unauthenticated", "Usuário não autenticado.");
    }
    const tenantId = request.auth.token.tenant_id;
    if (!tenantId) {
      logger.error(`[deleteEmptyCashierOs / OrdersCallable] User ${request.auth.uid} is missing tenant_id claim.`);
      throw new HttpsError("failed-precondition", "Usuário não pertence a um tenant.");
    }
    const callerUid = request.auth.uid;

    const { osId } = request.data;
    if (!osId) {
      logger.error("[deleteEmptyCashierOs / OrdersCallable] Missing required data: osId.", { tenantId });
      throw new HttpsError("invalid-argument", "ID da Ordem de Serviço é obrigatório.");
    }

    logger.info(`[deleteEmptyCashierOs / OrdersCallable] Request validated for tenant ${tenantId}, osId ${osId}, caller ${callerUid}.`);

    try {
      const osDocRef = db.collection('tenants').doc(tenantId).collection('order_services').doc(osId);
      const osDocSnap = await osDocRef.get();

      if (!osDocSnap.exists) {
        logger.warn(`[deleteEmptyCashierOs / OrdersCallable] OS document ${osId} not found for tenant ${tenantId}. Cannot delete.`);
        return { success: true, deleted: false, message: "OS não encontrada." };
      }

      const osData = osDocSnap.data();
      if (!osData) {
         logger.error(`[deleteEmptyCashierOs / OrdersCallable] OS document ${osId} data is undefined. Cannot process.`);
         throw new HttpsError("internal", "Erro ao ler dados da OS.");
      }

      const itemsSubcollectionRef = osDocRef.collection('os_items');
      const itemsSnapshot = await itemsSubcollectionRef.limit(1).get();

      if (itemsSnapshot.empty) {
        logger.info(`[deleteEmptyCashierOs / OrdersCallable] OS ${osId} has no items in subcollection 'os_items'. Deleting...`);
        await osDocRef.delete();
        logger.info(`[deleteEmptyCashierOs / OrdersCallable] OS ${osId} deleted successfully.`);
        return { success: true, deleted: true, message: "OS vazia deletada com sucesso." };
      } else {
        logger.info(`[deleteEmptyCashierOs / OrdersCallable] OS ${osId} is not empty (has items in 'os_items' subcollection). Not deleting.`);
        return { success: true, deleted: false, message: "OS não está vazia, não foi deletada." };
      }

    } catch (error: any) {
      logger.error(`[deleteEmptyCashierOs / OrdersCallable] Error processing OS ${osId} for tenant ${tenantId}:`, error);
      if (error instanceof HttpsError) {
        throw error;
      }
      throw new HttpsError("internal", "Erro interno ao tentar deletar OS vazia.", { originalError: error.message });
    }
  }
); 