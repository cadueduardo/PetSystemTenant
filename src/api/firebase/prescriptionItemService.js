import { db } from '@/lib/firebaseConfig';
import { 
  collection, 
  doc, 
  addDoc, 
  getDoc, 
  getDocs, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy, 
  serverTimestamp 
} from "firebase/firestore";
import { getCurrentTenantId } from '@/utils/auth';

const itemCollection = collection(db, "prescriptionItems");
const sharedItemCollection = collection(db, "sharedPrescriptionItems");

// Helper (pode ser movido para um utilitário compartilhado)
const mapDocument = (docSnap) => {
  if (!docSnap.exists()) return null;
  const data = docSnap.data();
  return { id: docSnap.id, ...data };
};

export const prescriptionItemService = {

  /**
   * Lista itens de prescrição (compartilhados + específicos do tenant) opcionalmente filtrados por tipo.
   * @param {object} filters - Optional filters (e.g., { prescriptionTypeId: '...', name: '...' })
   * @returns {Promise<Array<object>>} - Array of prescription item objects.
   */
  list: async (filters = {}) => {
    const tenantId = getCurrentTenantId();
    if (!tenantId) throw new Error("Tenant não identificado.");

    const allItems = [];
    let errorOccurred = null;
    const { prescriptionTypeId, ...otherFilters } = filters;

    try {
      // 1. Buscar Itens Compartilhados
      console.log('[PrescriptionItemService] Buscando itens compartilhados...');
      let sharedQuery = query(sharedItemCollection, orderBy("nome"));
      if (prescriptionTypeId) {
        sharedQuery = query(sharedQuery, where("prescriptionTypeId", "==", prescriptionTypeId));
      }
      // Adicionar outros filtros se necessário
      const sharedSnapshot = await getDocs(sharedQuery);
      sharedSnapshot.forEach(docSnap => {
        allItems.push(mapDocument(docSnap));
      });
      console.log(`[PrescriptionItemService] ${sharedSnapshot.size} itens compartilhados encontrados (Filtro Tipo: ${prescriptionTypeId || 'Nenhum'}).`);

      // 2. Buscar Itens Específicos do Tenant
      console.log(`[PrescriptionItemService] Buscando itens para Tenant ID: ${tenantId}...`);
      let tenantQuery = query(itemCollection, where("tenant_id", "==", tenantId), orderBy("nome"));
      if (prescriptionTypeId) {
        tenantQuery = query(tenantQuery, where("prescriptionTypeId", "==", prescriptionTypeId));
      }
      // Aplicar outros filtros (ex: nome)
      if (otherFilters.name) {
          tenantQuery = query(tenantQuery, where("nome", ">=", otherFilters.name), where("nome", "<=", otherFilters.name + '\uf8ff'));
      }

      const tenantSnapshot = await getDocs(tenantQuery);
      tenantSnapshot.forEach(docSnap => {
        // Evita duplicatas
        if (!allItems.some(item => item.id === docSnap.id)) {
          allItems.push(mapDocument(docSnap));
        }
      });
       console.log(`[PrescriptionItemService] ${tenantSnapshot.size} itens do tenant ${tenantId} encontrados (Filtro Tipo: ${prescriptionTypeId || 'Nenhum'}).`);

    } catch (error) {
       console.error("[PrescriptionItemService] Erro ao listar itens:", error);
       errorOccurred = error;
    }
    
    // Ordena final (pode ser redundante)
    allItems.sort((a, b) => a.nome.localeCompare(b.nome));
    
    if (errorOccurred) {
       console.warn("[PrescriptionItemService] Retornando lista parcial de itens devido a erro.");
       // throw errorOccurred;
    }

    console.log(`[PrescriptionItemService] Total de itens combinados: ${allItems.length}`);
    return allItems;
  },

  /**
   * Busca um item específico pelo ID (procura primeiro nos do tenant, depois nos compartilhados).
   * @param {string} itemId - ID do item.
   * @returns {Promise<object|null>} - O objeto do item ou null se não encontrado.
   */
  get: async (itemId) => {
    if (!itemId) throw new Error("ID do Item é obrigatório.");
    const tenantId = getCurrentTenantId();

    try {
      // Tenta buscar no específico do tenant primeiro
      if (tenantId) {
        const docRef = doc(db, "prescriptionItems", itemId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists() && docSnap.data().tenant_id === tenantId) {
           console.log(`[PrescriptionItemService] Item ${itemId} encontrado na coleção do tenant ${tenantId}.`);
           return mapDocument(docSnap);
        }
      }
      
      // Se não encontrou ou não pertence ao tenant, busca nos compartilhados
      const sharedDocRef = doc(db, "sharedPrescriptionItems", itemId);
      const sharedDocSnap = await getDoc(sharedDocRef);
      if (sharedDocSnap.exists()) {
         console.log(`[PrescriptionItemService] Item ${itemId} encontrado na coleção compartilhada.`);
         return mapDocument(sharedDocSnap);
      }

      console.log(`[PrescriptionItemService] Item ${itemId} não encontrado.`);
      return null;

    } catch (error) {
       console.error(`[PrescriptionItemService] Erro ao buscar item ${itemId}:`, error);
       throw error;
    }
  },

  /**
   * Cria um novo item de prescrição PARA O TENANT ATUAL.
   * @param {object} itemData - Dados do item (prescriptionTypeId, nome, detalhes, dose, frequencia, valorAdministracao, etc.). tenant_id será adicionado.
   * @returns {Promise<object>} - O objeto do item criado com seu ID.
   */
  create: async (itemData) => {
    const tenantId = getCurrentTenantId();
    if (!tenantId) throw new Error("Tenant não identificado para criar item.");
    if (!itemData || !itemData.nome || !itemData.prescriptionTypeId) {
      throw new Error("Nome e ID do Tipo são obrigatórios para criar item.");
    }

    console.log(`[PrescriptionItemService] Criando item para Tenant ${tenantId}:`, itemData);
    try {
      // Validação extra (opcional, regra do Firestore já valida): 
      // Verificar se o prescriptionTypeId existe na coleção DO TENANT
      const typeRef = doc(db, "prescriptionTypes", itemData.prescriptionTypeId);
      const typeSnap = await getDoc(typeRef);
      if (!typeSnap.exists() || typeSnap.data().tenant_id !== tenantId) {
          throw new Error(`Tipo de prescrição (${itemData.prescriptionTypeId}) não encontrado ou inválido para este tenant.`);
      }

      const dataToSave = {
        ...itemData,
        tenant_id: tenantId,
        valorAdministracao: parseFloat(itemData.valorAdministracao) || 0, // Garante que seja número
        created_at: serverTimestamp(),
        updated_at: serverTimestamp()
      };
      const docRef = await addDoc(itemCollection, dataToSave);
      console.log(`[PrescriptionItemService] Item criado com ID: ${docRef.id} para Tenant ${tenantId}`);
      
      const createdDoc = await getDoc(docRef);
      return mapDocument(createdDoc);

    } catch (error) {
       console.error(`[PrescriptionItemService] Erro ao criar item para Tenant ${tenantId}:`, error);
       if (error.code === 'permission-denied') {
         console.error("PERMISSION DENIED: Verifique regras do Firestore para criar prescriptionItems (e se o tipo existe).");
       }
       throw error;
    }
  },

  /**
   * Atualiza um item de prescrição DO TENANT ATUAL.
   * @param {string} itemId - ID do item a ser atualizado.
   * @param {object} updateData - Campos para atualizar. tenant_id e prescriptionTypeId não podem ser mudados.
   * @returns {Promise<object>} - O objeto do item atualizado.
   */
  update: async (itemId, updateData) => {
    const tenantId = getCurrentTenantId();
    if (!tenantId) throw new Error("Tenant não identificado para atualizar item.");
    if (!itemId || !updateData) throw new Error("ID e dados são obrigatórios para atualizar item.");

    // Impede a atualização de campos protegidos
    const { tenant_id, created_at, prescriptionTypeId, ...restUpdateData } = updateData;
    if (tenant_id || created_at || prescriptionTypeId) {
        console.warn("[PrescriptionItemService] Tentativa de atualizar campos protegidos (tenant_id, created_at, prescriptionTypeId) ignorada.");
    }
    if (Object.keys(restUpdateData).length === 0) {
         console.warn("[PrescriptionItemService] Nenhum dado válido para atualizar.");
         return this.get(itemId); // Retorna o doc existente
    }

    console.log(`[PrescriptionItemService] Atualizando item ${itemId} para Tenant ${tenantId}:`, restUpdateData);
    try {
      const docRef = doc(db, "prescriptionItems", itemId);
      
      // Verifica se o item pertence ao tenant
      const docSnap = await getDoc(docRef);
      if (!docSnap.exists() || docSnap.data().tenant_id !== tenantId) {
          console.error(`[PrescriptionItemService] Update negado: Item ${itemId} não encontrado ou não pertence ao Tenant ${tenantId}.`);
          throw new Error("Item não encontrado ou permissão negada.");
      }

      const dataToUpdate = {
        ...restUpdateData,
        // Atualiza o valor se ele foi explicitamente passado, convertendo para número
        ...(restUpdateData.valorAdministracao !== undefined && { valorAdministracao: parseFloat(restUpdateData.valorAdministracao) || 0 }),
        updated_at: serverTimestamp()
      };
      
      await updateDoc(docRef, dataToUpdate);
      console.log(`[PrescriptionItemService] Item ${itemId} atualizado para Tenant ${tenantId}.`);
      
      const updatedDoc = await getDoc(docRef);
      return mapDocument(updatedDoc);

    } catch (error) {
       console.error(`[PrescriptionItemService] Erro ao atualizar item ${itemId} para Tenant ${tenantId}:`, error);
       if (error.code === 'permission-denied') {
         console.error("PERMISSION DENIED: Verifique regras do Firestore para atualizar prescriptionItems.");
       }
       throw error;
    }
  },

  /**
   * Deleta um item de prescrição DO TENANT ATUAL.
   * @param {string} itemId - ID do item a ser deletado.
   * @returns {Promise<void>}
   */
  delete: async (itemId) => {
    const tenantId = getCurrentTenantId();
    if (!tenantId) throw new Error("Tenant não identificado para deletar item.");
    if (!itemId) throw new Error("ID é obrigatório para deletar item.");

    console.log(`[PrescriptionItemService] Deletando item ${itemId} para Tenant ${tenantId}...`);
    try {
      const docRef = doc(db, "prescriptionItems", itemId);

      // Verifica se o item pertence ao tenant
      const docSnap = await getDoc(docRef);
      if (!docSnap.exists() || docSnap.data().tenant_id !== tenantId) {
          console.error(`[PrescriptionItemService] Delete negado: Item ${itemId} não encontrado ou não pertence ao Tenant ${tenantId}.`);
          throw new Error("Item não encontrado ou permissão negada.");
      }

      await deleteDoc(docRef);
      console.log(`[PrescriptionItemService] Item ${itemId} deletado para Tenant ${tenantId}.`);

    } catch (error) {
       console.error(`[PrescriptionItemService] Erro ao deletar item ${itemId} para Tenant ${tenantId}:`, error);
       if (error.code === 'permission-denied') {
         console.error("PERMISSION DENIED: Verifique regras do Firestore para deletar prescriptionItems.");
       }
       throw error;
    }
  }
}; 