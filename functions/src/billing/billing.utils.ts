import * as logger from "firebase-functions/logger";
import { db, admin } from "../config/firebase"; // admin for admin.firestore.FieldValue

export async function addItemsToPendingCharge(
    tenantId: string,
    tutorId: string,
    petId: string | null,
    items: any[],
    petName?: string | null,
    osNumber?: string | null,
    episodeId?: string | null,
    prontuarioId?: string | null
) {
  logger.info(`[addItemsToPendingCharge / BillingUtils / ${tenantId}] Attempting to CREATE A NEW charge for tutor ${tutorId}. Items count: ${items.length}`, { petId, petName, osNumber, episodeId, prontuarioId });
  if (!items || items.length === 0) {
    logger.warn(`[addItemsToPendingCharge / BillingUtils / ${tenantId}] No items provided for tutor ${tutorId}. Aborting.`);
    return { success: false, message: "Nenhum item fornecido." };
  }

  const chargesRef = db.collection('tenants').doc(tenantId).collection('charges');

  try {
    const transactionResult = await db.runTransaction(async (transaction) => {
      const newChargeRef = chargesRef.doc();
      const targetChargeId = newChargeRef.id;
      logger.info(`[addItemsToPendingCharge / BillingUtils / ${tenantId} / Tx] Creating new charge ${targetChargeId}.`);
      const newItemsTotal = items.reduce((sum, item) => sum + (item.totalPrice || 0), 0);

      transaction.set(newChargeRef, {
          tenantId: tenantId,
          tutorId: tutorId,
          petId: petId || null,
          petName: petName || null,
          osNumber: osNumber || null,
          episodeId: episodeId || null,
          prontuarioId: prontuarioId || null,
          totalAmount: newItemsTotal,
          amountPaid: 0,
          status: 'pending',
          sourceType: 'service_completion',
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      const itemsCollectionRef = newChargeRef.collection('charge_items');
      items.forEach((itemData, index) => {
          const newItemRef = itemsCollectionRef.doc();
          logger.debug(`[addItemsToPendingCharge / BillingUtils / ${tenantId} / Tx / Charge ${targetChargeId}] Adding item ${index + 1} to subcollection:`, itemData);
          transaction.set(newItemRef, {
              ...itemData,
              chargeId: targetChargeId,
              tenantId: tenantId,
              addedAt: admin.firestore.FieldValue.serverTimestamp()
          });
      });

      return { chargeId: targetChargeId };
    });

    logger.info(`[addItemsToPendingCharge / BillingUtils / ${tenantId}] Transaction successful. NEW Charge ID created: ${transactionResult.chargeId}`);
    return { success: true, chargeId: transactionResult.chargeId };

  } catch (error: any) {
    logger.error(`[addItemsToPendingCharge / BillingUtils / ${tenantId}] Error CREATING charge for tutor ${tutorId}:`, { error: error.message, stack: error.stack, details: error.details });
    return { success: false, message: `Erro ao criar cobrança: ${error.message}`, errorDetails: error };
  }
} 