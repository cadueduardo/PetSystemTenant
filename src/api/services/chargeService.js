import { db } from '@/lib/firebaseConfig';
import { collection, addDoc, Timestamp } from 'firebase/firestore';

/**
 * Cria um novo documento de cobrança pendente na subcoleção charges de um tenant.
 * 
 * @param {string} tenantId - O ID do tenant.
 * @param {object} chargeData - Os dados da cobrança a serem criados.
 * @param {string} chargeData.tutorId - ID do tutor.
 * @param {string} [chargeData.petId] - ID do pet (opcional).
 * @param {'episode' | 'os' | 'direct_sale'} chargeData.originType - Tipo da origem da cobrança.
 * @param {string} chargeData.originId - ID da origem (ID do episódio, OS, etc.).
 * @param {string} [chargeData.prontuarioId] - ID do prontuário (se a origem for episódio).
 * @param {Array<object>} chargeData.items - Array de itens da cobrança.
 * @param {number} chargeData.totalAmount - Valor total da cobrança.
 * // Adicionar outros campos necessários conforme a estrutura definida.
 * 
 * @returns {Promise<DocumentReference>} Uma promessa que resolve com a referência do documento criado.
 * @throws {Error} Lança um erro se a criação falhar.
 */
const createPendingCharge = async (tenantId, chargeData) => {
  if (!tenantId) {
    throw new Error("Tenant ID é obrigatório para criar uma cobrança.");
  }
  if (!chargeData || !chargeData.tutorId || !chargeData.originType || !chargeData.originId || !chargeData.items || chargeData.totalAmount === undefined) {
      console.error("Dados incompletos para criar cobrança:", chargeData);
    throw new Error("Dados essenciais (tutorId, originType, originId, items, totalAmount) são obrigatórios para criar a cobrança.");
  }

  const chargesCollectionRef = collection(db, `tenants/${tenantId}/charges`);

  const dataToSave = {
    ...chargeData,
    tenantId: tenantId, // Garante que o tenantId esteja no documento
    status: 'pending', // Define o status inicial
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  };

  console.log(`[chargeService] Criando cobrança pendente para tenant ${tenantId}:`, dataToSave);

  try {
    const docRef = await addDoc(chargesCollectionRef, dataToSave);
    console.log(`[chargeService] Cobrança pendente criada com ID: ${docRef.id}`);
    return docRef;
  } catch (error) {
    console.error(`[chargeService] Erro ao criar cobrança pendente para tenant ${tenantId}:`, error);
    throw new Error(`Falha ao criar cobrança pendente: ${error.message}`);
  }
};

// Poderíamos adicionar outras funções aqui (getCharge, updateChargeStatus, etc.)

const chargeService = {
  createPendingCharge,
};

export default chargeService; 