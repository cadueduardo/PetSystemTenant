import * as logger from "firebase-functions/logger";
import { HttpsError, onCall, CallableRequest } from "firebase-functions/v2/https";
import { db, admin } from "../config/firebase"; // admin for admin.firestore.FieldValue and admin.firestore.DocumentReference
import { REGION, CODE_VERSION } from "../config/constants";
import { PaymentData, CancelChargeItemData, AddCancellationReasonData } from "../types";

export const processPayment = onCall<
  PaymentData,
  Promise<{ success: boolean; message: string; chargeId?: string; transactionId?: string }>
>(
  {
    region: REGION,
    cors: ["http://localhost:5173", "https://petfacil.app"],
    enforceAppCheck: false, 
  },
  async (request) => {
    logger.info(`[processPayment / BillingCallable / v: ${CODE_VERSION}] Function called.`, { uid: request.auth?.uid });

    if (!request.auth?.uid) {
      logger.error("[processPayment / BillingCallable] Unauthenticated user.");
      throw new HttpsError("unauthenticated", "Usuário não autenticado.");
    }
    const tenantId = request.auth.token.tenant_id;
    if (!tenantId) {
      logger.error(`[processPayment / BillingCallable] User ${request.auth.uid} is missing tenant_id claim.`);
      throw new HttpsError("failed-precondition", "Usuário não pertence a um tenant.");
    }
    const cashierId = request.auth.uid;

    const data = request.data;
    logger.info(`[processPayment / BillingCallable] Received data for tenant ${tenantId}:`, data);

    if (!data.paymentMethod || data.amountPaid == null || data.amountPaid <= 0) {
        logger.error("[processPayment / BillingCallable] Invalid input data (missing/invalid paymentMethod or amountPaid).", data);
        throw new HttpsError("invalid-argument", "Método de pagamento e valor pago (positivo) são obrigatórios.");
    }
    
    const hasExistingItems = (data.chargeIds && data.chargeIds.length > 0) || (data.continuedOsIds && data.continuedOsIds.length > 0);
    if (hasExistingItems && !data.customerId) {
        logger.error("[processPayment / BillingCallable] Invalid input data (missing customerId for existing charge/OS).", data);
        throw new HttpsError("invalid-argument", "ID do Cliente é necessário ao pagar cobranças ou OS existentes.");
    }

    const hasCartItems = data.cartItems && data.cartItems.length > 0;
    if (!hasExistingItems && !hasCartItems) {
        logger.error("[processPayment / BillingCallable] Invalid input data (no items provided).", data);
        throw new HttpsError("invalid-argument", "É necessário fornecer IDs de cobrança/OS ou itens no carrinho.");
    }
    if (hasExistingItems && hasCartItems) {
        logger.error("[processPayment / BillingCallable] Invalid input data (both existing items and cartItems provided).", data);
        throw new HttpsError("invalid-argument", "Não é possível processar cobranças/OS existentes e itens de carrinho simultaneamente.");
    }

    if ((data.paymentMethod === 'credit_card' || data.paymentMethod === 'debit_card') && 
        (!data.cardInfo || !data.cardInfo.number || !data.cardInfo.holder || !data.cardInfo.expiry || !data.cardInfo.cvv)) {
        logger.error("[processPayment / BillingCallable] Invalid card data.", data.cardInfo);
        throw new HttpsError("invalid-argument", "Dados do cartão incompletos.");
    }

    try {
      let transactionId: string | undefined;

      await db.runTransaction(async (transaction) => {
        logger.info(`[processPayment / BillingCallable / Tx ${tenantId}] Starting Firestore transaction.`);
        const customerIdForTransaction = data.customerId;
        
        // --- CASO 1: Pagamento Combinado (Charges + OS) --- 
        if (data.chargeIds && data.chargeIds.length > 0 && data.continuedOsIds && data.continuedOsIds.length > 0) {
            logger.info(`[processPayment / BillingCallable / Tx ${tenantId}] Processing COMBINED payment: Charges [${data.chargeIds.join(', ')}] + OS [${data.continuedOsIds.join(', ')}]`);
            if (!customerIdForTransaction) throw new HttpsError("internal", "Erro interno: Customer ID ausente no caso combinado.");

            const chargeRefs: admin.firestore.DocumentReference[] = [];
            const osRefs: admin.firestore.DocumentReference[] = [];
            const validDocsData: { [id: string]: { ref: admin.firestore.DocumentReference, data: FirebaseFirestore.DocumentData, type: 'charge' | 'order_service' } } = {};
            let totalAmountFromDocs = 0;

            logger.info(`[processPayment / BillingCallable / Tx Read ${tenantId}] Reading ${data.chargeIds.length} charge(s)...`);
            for (const chargeId of data.chargeIds) {
                const chargeRef = db.collection('tenants').doc(tenantId).collection('charges').doc(chargeId);
                chargeRefs.push(chargeRef);
                const chargeDoc = await transaction.get(chargeRef);
                if (!chargeDoc.exists || !chargeDoc.data()) {
                    logger.error(`[processPayment / BillingCallable / Tx Read ${tenantId}] Charge ${chargeId} not found or data missing.`);
                } else {
                    const docData = chargeDoc.data()!;
                    if (docData.status === 'paid') {
                        logger.warn(`[processPayment / BillingCallable / Tx Read ${tenantId}] Charge ${chargeId} already paid. Skipping.`);
                    } else {
                        validDocsData[chargeId] = { ref: chargeRef, data: docData, type: 'charge' };
                        totalAmountFromDocs += docData.totalAmount || 0;
                    }
                }
            }

            logger.info(`[processPayment / BillingCallable / Tx Read ${tenantId}] Reading ${data.continuedOsIds.length} order service(s)...`);
            for (const osId of data.continuedOsIds) {
                const osRef = db.collection('tenants').doc(tenantId).collection('order_services').doc(osId);
                osRefs.push(osRef);
                const osDoc = await transaction.get(osRef);
                if (!osDoc.exists || !osDoc.data()) {
                    logger.error(`[processPayment / BillingCallable / Tx Read ${tenantId}] Order Service ${osId} not found or data missing.`);
                } else {
                    const docData = osDoc.data()!;
                    if (docData.status !== 'pending_cashier') {
                        logger.warn(`[processPayment / BillingCallable / Tx Read ${tenantId}] Order Service ${osId} status is not 'pending_cashier' (${docData.status}). Skipping.`);
                    } else {
                        logger.info(`[processPayment / BillingCallable / Tx Read ${tenantId}] Reading items from subcollection for OS ${osId}...`);
                        const osItemsRef = osRef.collection('os_items');
                        const osItemsSnap = await transaction.get(osItemsRef);
                        let osTotalFromItems = 0;
                        const osItemsData = osItemsSnap.docs.map(itemDoc => {
                            const itemData = itemDoc.data();
                            osTotalFromItems += itemData.totalPrice || 0;
                            return { osItemId: itemDoc.id, ...itemData };
                        });
                        logger.info(`[processPayment / BillingCallable / Tx Read ${tenantId}] Found ${osItemsData.length} items for OS ${osId}. Calculated total: ${osTotalFromItems}`);

                        validDocsData[osId] = { 
                            ref: osRef, 
                            data: { ...docData, items: osItemsData },
                            type: 'order_service' 
                        };
                        totalAmountFromDocs += osTotalFromItems; 
                    }
                }
            }
            logger.info(`[processPayment / BillingCallable / Tx Read ${tenantId}] Finished reading. Total amount from valid docs: ${totalAmountFromDocs}`);
            
            logger.info(`[processPayment / BillingCallable / Tx Write ${tenantId}] Writing transaction and doc updates...`);
            const newTransactionRef = db.collection('tenants').doc(tenantId).collection('transactions').doc();
            transactionId = newTransactionRef.id;

            logger.info(`[processPayment / BillingCallable / Tx Write ${tenantId}] Creating transaction ${transactionId} for amount ${data.amountPaid}`);
            transaction.set(newTransactionRef, {
                chargeIds: data.chargeIds,
                orderServiceIds: data.continuedOsIds,
                tenantId: tenantId,
                tutorId: customerIdForTransaction,
                method: data.paymentMethod,
                amount: data.amountPaid,
                status: 'completed',
                transactionTimestamp: admin.firestore.FieldValue.serverTimestamp(),
                cashierId: cashierId,
                notes: `Pagamento referente a Charges: [${data.chargeIds?.join(', ') || 'N/A'}] e OS: [${data.continuedOsIds?.join(', ') || 'N/A'}]`,
            });

            for (const docId in validDocsData) {
                const { ref, data: docData, type } = validDocsData[docId];
                const updateTimestamp = admin.firestore.FieldValue.serverTimestamp();
                const paidAtTimestamp = updateTimestamp;

                if (type === 'charge') {
                    logger.info(`[processPayment / BillingCallable / Tx Write ${tenantId}] Updating charge ${docId} status to paid.`);
                    const chargeAmountToPay = docData.totalAmount || 0;
                    transaction.update(ref, {
                        status: 'paid',
                        amountPaid: chargeAmountToPay,
                        paymentMethod: data.paymentMethod,
                        updatedAt: updateTimestamp,
                        paidAt: paidAtTimestamp,
                        cashierId: cashierId,
                    });
                } else { // type === 'order_service'
                    logger.info(`[processPayment / BillingCallable / Tx Write ${tenantId}] Updating order_service ${docId} status to paid.`);
                    const osTotalFromItems = (docData.items || []).reduce((sum: number, item: any) => sum + (item.totalPrice || 0), 0);
                    
                    logger.info(`[processPayment / BillingCallable / Tx Write ${tenantId}] PREPARING update for OS ${docId}`, { 
                        status: 'paid', 
                        totalCalculated: osTotalFromItems, 
                        method: data.paymentMethod 
                    });

                    transaction.update(ref, {
                        status: 'paid',
                        paymentStatus: 'paid',
                        paymentMethod: data.paymentMethod,
                        totalValue: Math.round(osTotalFromItems * 100) / 100,
                        paidAt: paidAtTimestamp,
                        updatedAt: updateTimestamp,
                        cashierId: cashierId,
                    });
                    logger.info(`[processPayment / BillingCallable / Tx Write ${tenantId}] SCHEDULED update for OS ${docId}`);
                }
            }
            logger.info(`[processPayment / BillingCallable / Tx Write ${tenantId}] Finished writing combined updates.`);
            
        // --- CASO 2: Pagamento apenas de Charges Existentes --- 
        } else if (data.chargeIds && data.chargeIds.length > 0) {
          logger.info(`[processPayment / BillingCallable / Tx ${tenantId}] Processing payment for existing charges ONLY: ${data.chargeIds.join(', ')}`);
          if (!customerIdForTransaction) throw new HttpsError("internal", "Erro interno: Customer ID ausente no caso de charges.");

          const chargeRefs: admin.firestore.DocumentReference[] = [];
          const chargeDocsData: { [id: string]: FirebaseFirestore.DocumentData | null } = {}; 
          let totalAmountFromCharges = 0; 

          logger.info(`[processPayment / BillingCallable / Tx Read ${tenantId}] Reading ${data.chargeIds.length} charge document(s)...`);
          for (const chargeId of data.chargeIds) {
            const chargeRef = db.collection('tenants').doc(tenantId).collection('charges').doc(chargeId);
            chargeRefs.push(chargeRef); 
            const chargeDoc = await transaction.get(chargeRef);
            if (!chargeDoc.exists || !chargeDoc.data()) {
                logger.error(`[processPayment / BillingCallable / Tx Read ${tenantId}] Charge ${chargeId} not found or data missing.`);
                chargeDocsData[chargeId] = null; 
            } else {
                const docData = chargeDoc.data()!;
                if (docData.status === 'paid') {
                   logger.warn(`[processPayment / BillingCallable / Tx Read ${tenantId}] Charge ${chargeId} already paid. Skipping.`);
                   chargeDocsData[chargeId] = null;
                } else {
                   chargeDocsData[chargeId] = docData;
                   totalAmountFromCharges += docData.totalAmount || 0;
                }
            }
          }
          logger.info(`[processPayment / BillingCallable / Tx Read ${tenantId}] Finished reading charges. Total amount: ${totalAmountFromCharges}`);

          logger.info(`[processPayment / BillingCallable / Tx Write ${tenantId}] Writing transaction and charge updates...`);
          const newTransactionRef = db.collection('tenants').doc(tenantId).collection('transactions').doc();
          transactionId = newTransactionRef.id;

          logger.info(`[processPayment / BillingCallable / Tx Write ${tenantId}] Creating single transaction ${transactionId} for amount ${data.amountPaid}`);
          transaction.set(newTransactionRef, {
            chargeIds: data.chargeIds,
            tenantId: tenantId,
            tutorId: customerIdForTransaction, 
            method: data.paymentMethod,
            amount: data.amountPaid,
            status: 'completed',
            transactionTimestamp: admin.firestore.FieldValue.serverTimestamp(),
            cashierId: cashierId,
            notes: `Pagamento referente às cobranças: ${data.chargeIds.join(', ')}`,
          });

          for (const chargeRef of chargeRefs) {
              const chargeId = chargeRef.id;
              const chargeData = chargeDocsData[chargeId];
              if (!chargeData) { 
                  logger.info(`[processPayment / BillingCallable / Tx Write ${tenantId}] Skipping update for charge ${chargeId}.`);
                  continue; 
              }
              logger.info(`[processPayment / BillingCallable / Tx Write ${tenantId}] Updating charge ${chargeId} status to paid.`);
              transaction.update(chargeRef, {
                status: 'paid', 
                amountPaid: chargeData.totalAmount, 
                paymentMethod: data.paymentMethod,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                paidAt: admin.firestore.FieldValue.serverTimestamp(),
                cashierId: cashierId,
              });
          }
          logger.info(`[processPayment / BillingCallable / Tx Write ${tenantId}] Finished writing charge updates.`);

        // --- CASO 3: Pagamento de Venda Direta (cartItems) --- 
        } else if (data.cartItems && data.cartItems.length > 0) {
          logger.info(`[processPayment / BillingCallable / Tx ${tenantId}] Processing payment for direct sale (cart items).`);
          const newChargeRef = db.collection('tenants').doc(tenantId).collection('charges').doc();
          const finalChargeId = newChargeRef.id;
          
          const totalAmount = data.cartItems.reduce((sum, item) => sum + item.totalPrice, 0);
          if (Math.abs(totalAmount - data.amountPaid) > 0.01) { 
              logger.error(`[processPayment / BillingCallable / Tx ${tenantId}] Direct sale amount mismatch. Cart: ${totalAmount}, Paid: ${data.amountPaid}`);
              throw new HttpsError("invalid-argument", `Valor pago (${data.amountPaid.toFixed(2)}) não corresponde ao total do carrinho (${totalAmount.toFixed(2)}).`);
          }

          logger.info(`[processPayment / BillingCallable / Tx ${tenantId}] Creating new charge ${finalChargeId} for direct sale.`);
          transaction.set(newChargeRef, {
            tenantId: tenantId,
            tutorId: data.customerId || null,
            petId: null, 
            totalAmount: totalAmount,
            amountPaid: data.amountPaid,
            status: 'paid', 
            paymentMethod: data.paymentMethod, 
            sourceType: 'cashier_direct',
            cashierId: cashierId,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            paidAt: admin.firestore.FieldValue.serverTimestamp(),
            nfseUrl: null,
            nfceUrl: null,
          });

          const itemsCollectionRef = newChargeRef.collection('charge_items');
           data.cartItems.forEach(itemData => {
               const newItemRef = itemsCollectionRef.doc();
               transaction.set(newItemRef, {
                   itemId: itemData.itemId,
                   description: itemData.description,
                   quantity: itemData.quantity,
                   unitPrice: itemData.unitPrice,
                   totalPrice: itemData.totalPrice,
                   itemType: itemData.itemType,
                   chargeId: finalChargeId, 
                   tenantId: tenantId,
                   addedAt: admin.firestore.FieldValue.serverTimestamp()
               });
          });

          const newTransactionRef = db.collection('tenants').doc(tenantId).collection('transactions').doc();
          transactionId = newTransactionRef.id; 
          logger.info(`[processPayment / BillingCallable / Tx ${tenantId}] Creating transaction ${transactionId} for new charge ${finalChargeId}`);
          transaction.set(newTransactionRef, {
            chargeId: finalChargeId,
            tenantId: tenantId,
            tutorId: data.customerId || null,
            method: data.paymentMethod,
            amount: data.amountPaid,
            status: 'completed',
            transactionTimestamp: admin.firestore.FieldValue.serverTimestamp(),
            cashierId: cashierId,
            notes: `Pagamento para venda direta no caixa.`,
          });
          logger.info(`[processPayment / BillingCallable / Tx ${tenantId}] Finished writing direct sale charge and transaction.`);

        } else {
          logger.error("[processPayment / BillingCallable / Tx ${tenantId}] Transaction error: No valid items found to process.");
          throw new HttpsError("internal", "Erro inesperado: Nenhum item válido para processar pagamento.");
        }
        logger.info(`[processPayment / BillingCallable / Tx ${tenantId}] Firestore transaction function completed successfully.`);
      });

      logger.info(`[processPayment / BillingCallable / ${tenantId}] Payment processed successfully. Returning success.`, { transactionId });
      return { success: true, message: "Pagamento processado com sucesso!", transactionId: transactionId };

    } catch (error: any) {
      logger.error(`[processPayment / BillingCallable / ${tenantId}] Error processing payment:`, error);
      if (error instanceof HttpsError) {
        throw error; 
      } else {
        throw new HttpsError("internal", "Ocorreu um erro interno ao processar o pagamento.", { originalError: error.message });
      }
    }
  } 
);

export const cancelChargeItem = onCall<CancelChargeItemData>(
  {
    region: REGION,
    cors: ["http://localhost:5173", "https://petfacil.app"],
    memory: "256MiB",
    timeoutSeconds: 60,
  },
  async (request: CallableRequest<CancelChargeItemData>) => {
    logger.info(`[cancelChargeItem / BillingCallable / v2.1 ENTRY] Called by UID: ${request.auth?.uid}.`);

    if (!request.auth) {
      logger.error("[cancelChargeItem / BillingCallable / v2.1] Authentication check failed: request.auth is missing.");
      throw new HttpsError("unauthenticated", "Usuário não autenticado.");
    }
    const tenantId = request.auth.token.tenant_id;
    if (!tenantId) {
      logger.error(`[cancelChargeItem / BillingCallable / v2.1] Tenant ID check failed: tenant_id is missing from token for UID ${request.auth.uid}.`, { token: request.auth.token });
      throw new HttpsError("failed-precondition", "Tenant ID não encontrado no token de autenticação.");
    }
    const userId = request.auth.uid;

    const { chargeId, itemId, reason } = request.data;
    if (!chargeId || !itemId || !reason) {
      throw new HttpsError("invalid-argument", "Parâmetros chargeId, itemId (ID do documento na subcoleção) e reason são obrigatórios.");
    }
    if (typeof reason !== "string" || reason.trim().length === 0) {
      throw new HttpsError("invalid-argument", "O motivo (reason) não pode estar vazio.");
    }

    logger.info(`[cancelChargeItem / BillingCallable / v2.1 / Tx] Request: Tenant: ${tenantId}, Charge: ${chargeId}, Item Doc ID: ${itemId}, Reason: ${reason}, User: ${userId}`);

    const chargeRef = db.collection("tenants").doc(tenantId).collection("charges").doc(chargeId);
    const itemRef = chargeRef.collection("charge_items").doc(itemId);
    const itemsCollectionRef = chargeRef.collection("charge_items");

    try {
      await db.runTransaction(async (transaction) => {
        const chargeDoc = await transaction.get(chargeRef);
        const itemDoc = await transaction.get(itemRef);
        const allItemsSnapshot = await transaction.get(itemsCollectionRef);
        logger.info(`[cancelChargeItem / BillingCallable / v2.1 / Tx Read] Lendo charge ${chargeId}, item ${itemId}, e todos os itens...`);
        logger.info(`[cancelChargeItem / BillingCallable / v2.1 / Tx Read] Leituras concluídas.`);

        if (!chargeDoc.exists) {
          throw new HttpsError("not-found", `Charge ${chargeId} não encontrada.`);
        }
        if (!itemDoc.exists) {
          throw new HttpsError("not-found", `Item com ID ${itemId} não encontrado na subcoleção charge_items da charge ${chargeId}.`);
        }

        const chargeData = chargeDoc.data();
        if (!chargeData) {
          throw new HttpsError("internal", `Falha ao ler dados da charge ${chargeId}.`);
        }
        const itemData = itemDoc.data();
        if (!itemData) {
          throw new HttpsError("internal", `Falha ao ler dados do item ${itemId}.`);
        }

        if (chargeData.status === "paid" || chargeData.status === "canceled") {
          throw new HttpsError("failed-precondition", `Não é possível cancelar item de uma charge que já está ${chargeData.status}.`);
        }

        if (itemData.cancelled === true) {
          logger.warn(`[cancelChargeItem / BillingCallable / v2.1 / Tx] Item ${itemId} na charge ${chargeId} já está cancelado. Nenhuma ação necessária.`);
          return;
        }

        logger.info(`[cancelChargeItem / BillingCallable / v2.1 / Tx Calc] Recalculando totalAmount para charge ${chargeId}...`);
        let newTotalAmount = 0;
        allItemsSnapshot.forEach(doc => {
          const docData = doc.data();
          if (doc.id !== itemId && docData.cancelled !== true) {
            newTotalAmount += docData.totalPrice || 0;
          }
        });
        newTotalAmount = Math.round(newTotalAmount * 100) / 100;
        logger.info(`[cancelChargeItem / BillingCallable / v2.1 / Tx Calc] Novo totalAmount calculado: ${newTotalAmount}`);

        logger.info(`[cancelChargeItem / BillingCallable / v2.1 / Tx Write] Marcando item ${itemId} como cancelado.`);
        transaction.update(itemRef, {
          cancelled: true,
          cancellationReason: reason,
          cancelledBy: userId,
          cancelledAt: admin.firestore.FieldValue.serverTimestamp()
        });

        logger.info(`[cancelChargeItem / BillingCallable / v2.1 / Tx Write] Atualizando charge ${chargeId} com novo totalAmount e updatedAt.`);
        transaction.update(chargeRef, {
          totalAmount: newTotalAmount,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        logger.info(`[cancelChargeItem / BillingCallable / v2.1 / Tx Write] Transação concluída para item ${itemId} e charge ${chargeId}.`);
      });

      logger.info(`[cancelChargeItem / BillingCallable / v2.1] Item ${itemId} cancelado e charge ${chargeId} atualizada com sucesso.`);
      return { success: true, message: "Item cancelado e charge atualizada com sucesso." };

    } catch (error: any) {
      logger.error(`[cancelChargeItem / BillingCallable / v2.1] Erro ao cancelar item ${itemId} na charge ${chargeId} para tenant ${tenantId}:`, error);
      if (error instanceof HttpsError) {
        throw error;
      }
      const errorMessage = error instanceof Error ? error.message : "Erro interno desconhecido.";
      throw new HttpsError(
        "internal",
        "Erro interno ao processar o cancelamento do item.",
        errorMessage
      );
    }
});

export const addCancellationReason = onCall<AddCancellationReasonData>(
  { region: REGION, enforceAppCheck: false },
  async (request: CallableRequest<AddCancellationReasonData>) => {
    logger.info(`[addCancellationReason / BillingCallable / v: ${CODE_VERSION}] Iniciando...`, { auth: request.auth?.token.email });

    if (!request.auth) {
      logger.warn("[addCancellationReason / BillingCallable] Usuário não autenticado.");
      throw new HttpsError("unauthenticated", "Usuário não autenticado.");
    }
    if (!request.auth.token.tenant_id) {
      logger.error("[addCancellationReason / BillingCallable] Claim tenant_id ausente no token.", { uid: request.auth.uid });
      throw new HttpsError("failed-precondition", "Tenant ID não encontrado no token.");
    }
    if (!request.data.reasonText || typeof request.data.reasonText !== 'string' || request.data.reasonText.trim().length === 0) {
      logger.warn("[addCancellationReason / BillingCallable] reasonText inválido ou ausente.", { data: request.data });
      throw new HttpsError("invalid-argument", "O motivo do cancelamento (reasonText) é obrigatório.");
    }

    const tenantId = request.auth.token.tenant_id;
    const userId = request.auth.uid;
    const newReasonText = request.data.reasonText.trim();
    const reasonsCollectionRef = db.collection('tenants').doc(tenantId).collection('cancellation_reasons');

    logger.info(`[addCancellationReason / BillingCallable] Parâmetros: tenantId=${tenantId}, userId=${userId}, reasonText=\"${newReasonText}\"`);

    try {
      const existingReasonsSnapshot = await reasonsCollectionRef.get();
      const alreadyExists = existingReasonsSnapshot.docs.some(doc => 
        doc.data().reasonText?.toLowerCase() === newReasonText.toLowerCase()
      );

      if (alreadyExists) {
        logger.warn(`[addCancellationReason / BillingCallable] Motivo \"${newReasonText}\" já existe para o tenant ${tenantId}.`);
        return { success: true, message: "Motivo já existente." }; 
      }

      logger.info(`[addCancellationReason / BillingCallable] Adicionando novo motivo \"${newReasonText}\" para o tenant ${tenantId}.`);
      await reasonsCollectionRef.add({
        reasonText: newReasonText,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        createdBy: userId,
        isActive: true
      });

      logger.info(`[addCancellationReason / BillingCallable] Motivo \"${newReasonText}\" adicionado com sucesso.`);
      return { success: true };

    } catch (error) {
      logger.error("[addCancellationReason / BillingCallable] Erro ao adicionar motivo:", error);
      throw new HttpsError("internal", "Erro interno ao salvar o motivo do cancelamento.", error);
    }
  }
); 