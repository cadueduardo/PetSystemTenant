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
  serverTimestamp,
  // writeBatch // Removido, pois não está em uso ativo
} from "firebase/firestore";
import { getCurrentTenantId } from '@/utils/auth'; // Assume que existe um helper para pegar tenantId

const typeCollection = collection(db, "prescriptionTypes");
const sharedTypeCollection = collection(db, "sharedPrescriptionTypes");

// Helper para converter Timestamp do Firestore para Date, se necessário
const mapDocument = (docSnap) => {
  if (!docSnap.exists()) return null;
  const data = docSnap.data();
  // Converte Timestamps para Date (opcional, depende de como você quer usar)
  // for (const key in data) {
  //   if (data[key]?.toDate) {
  //     data[key] = data[key].toDate();
  //   }
  // }
  return { id: docSnap.id, ...data };
};

export const prescriptionTypeService = {

  /**
   * Lista todos os tipos de prescrição (compartilhados + específicos do tenant atual).
   * @param {object} filters - Optional filters (e.g., { name: '...' }) - Note: Filtering might be complex across collections.
   * @returns {Promise<Array<object>>} - Array of prescription type objects.
   */
  list: async (filters = {}) => {
    const tenantId = getCurrentTenantId();
    if (!tenantId) throw new Error("Tenant não identificado.");

    const allTypes = [];
    let errorOccurred = null;

    try {
      // 1. Buscar Tipos Compartilhados
      // Adicione filtros se necessário e suportado (ex: query(sharedTypeCollection, where(...)))
      console.log('[PrescriptionTypeService] Buscando tipos compartilhados...');
      const sharedQuery = query(sharedTypeCollection, orderBy("nome")); // Ordena por nome
      const sharedSnapshot = await getDocs(sharedQuery);
      sharedSnapshot.forEach(docSnap => {
        allTypes.push(mapDocument(docSnap));
      });
      console.log(`[PrescriptionTypeService] ${sharedSnapshot.size} tipos compartilhados encontrados.`);

      // 2. Buscar Tipos Específicos do Tenant
      console.log(`[PrescriptionTypeService] Buscando tipos para Tenant ID: ${tenantId}...`);
      let tenantQuery = query(typeCollection, where("tenant_id", "==", tenantId), orderBy("nome"));

      // Aplicar filtros adicionais (se houver) - Exemplo simples para 'nome'
      if (filters.name) {
          tenantQuery = query(tenantQuery, where("nome", ">=", filters.name), where("nome", "<=", filters.name + '\uf8ff'));
      }
      // Adicionar mais filtros conforme necessário

      const tenantSnapshot = await getDocs(tenantQuery);
      tenantSnapshot.forEach(docSnap => {
        // Evita duplicatas se um tenant recriar um tipo com mesmo ID/nome (improvável com IDs únicos)
        if (!allTypes.some(t => t.id === docSnap.id)) {
          allTypes.push(mapDocument(docSnap));
        }
      });
       console.log(`[PrescriptionTypeService] ${tenantSnapshot.size} tipos do tenant ${tenantId} encontrados.`);

    } catch (error) {
       console.error("[PrescriptionTypeService] Erro ao listar tipos:", error);
       errorOccurred = error;
       // Não joga o erro imediatamente para tentar retornar o que foi possível buscar
    }

    // Ordena a lista combinada (pode ser redundante se as queries já ordenam)
    allTypes.sort((a, b) => a.nome.localeCompare(b.nome));

    if (errorOccurred) {
      // Você pode decidir jogar o erro aqui, ou retornar a lista parcial com um aviso
      // throw errorOccurred; 
       console.warn("[PrescriptionTypeService] Retornando lista parcial devido a erro.")
    }

    console.log(`[PrescriptionTypeService] Total de tipos combinados: ${allTypes.length}`);
    return allTypes;
  },

  /**
   * Busca um tipo específico pelo ID (procura primeiro nos do tenant, depois nos compartilhados).
   * @param {string} typeId - ID do tipo.
   * @returns {Promise<object|null>} - O objeto do tipo ou null se não encontrado.
   */
  get: async (typeId) => {
    if (!typeId) throw new Error("ID do Tipo é obrigatório.");
    const tenantId = getCurrentTenantId(); // Precisa para buscar no específico do tenant

    try {
      // Tenta buscar no específico do tenant primeiro
      if (tenantId) {
        const docRef = doc(db, "prescriptionTypes", typeId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists() && docSnap.data().tenant_id === tenantId) {
           console.log(`[PrescriptionTypeService] Tipo ${typeId} encontrado na coleção do tenant ${tenantId}.`);
           return mapDocument(docSnap);
        }
      }
      
      // Se não encontrou ou não pertence ao tenant, busca nos compartilhados
      const sharedDocRef = doc(db, "sharedPrescriptionTypes", typeId);
      const sharedDocSnap = await getDoc(sharedDocRef);
      if (sharedDocSnap.exists()) {
         console.log(`[PrescriptionTypeService] Tipo ${typeId} encontrado na coleção compartilhada.`);
         return mapDocument(sharedDocSnap);
      }

      console.log(`[PrescriptionTypeService] Tipo ${typeId} não encontrado.`);
      return null;

    } catch (error) {
       console.error(`[PrescriptionTypeService] Erro ao buscar tipo ${typeId}:`, error);
       throw error;
    }
  },

  /**
   * Cria um novo tipo de prescrição PARA O TENANT ATUAL.
   * @param {object} typeData - Dados do tipo (nome, descricao). tenant_id será adicionado automaticamente.
   * @returns {Promise<object>} - O objeto do tipo criado com seu ID.
   */
  create: async (typeData) => {
    const tenantId = getCurrentTenantId();
    if (!tenantId) throw new Error("Tenant não identificado para criar tipo.");
    if (!typeData || !typeData.nome) throw new Error("Nome é obrigatório para criar tipo.");

    console.log(`[PrescriptionTypeService] Criando tipo para Tenant ${tenantId}:`, typeData);
    try {
      const dataToSave = {
        ...typeData,
        tenant_id: tenantId,
        created_at: serverTimestamp(),
        updated_at: serverTimestamp()
      };
      const docRef = await addDoc(typeCollection, dataToSave);
      console.log(`[PrescriptionTypeService] Tipo criado com ID: ${docRef.id} para Tenant ${tenantId}`);
      
      // Busca o documento recém-criado para retornar dados consistentes
      const createdDoc = await getDoc(docRef);
      return mapDocument(createdDoc);

    } catch (error) {
       console.error(`[PrescriptionTypeService] Erro ao criar tipo para Tenant ${tenantId}:`, error);
       if (error.code === 'permission-denied') {
         console.error("PERMISSION DENIED: Verifique regras do Firestore para criar prescriptionTypes.");
       }
       throw error;
    }
  },

  /**
   * Atualiza um tipo de prescrição DO TENANT ATUAL.
   * @param {string} typeId - ID do tipo a ser atualizado.
   * @param {object} updateData - Campos para atualizar (nome, descricao). tenant_id não pode ser mudado.
   * @returns {Promise<object>} - O objeto do tipo atualizado.
   */
  update: async (typeId, updateData) => {
    const tenantId = getCurrentTenantId();
    if (!tenantId) throw new Error("Tenant não identificado para atualizar tipo.");
    if (!typeId || !updateData) throw new Error("ID e dados são obrigatórios para atualizar tipo.");

    // Impede a atualização de campos protegidos
    const { tenant_id, created_at, ...restUpdateData } = updateData;
    if (tenant_id || created_at) {
        console.warn("[PrescriptionTypeService] Tentativa de atualizar campos protegidos ignorada.");
    }
    if (Object.keys(restUpdateData).length === 0) {
         console.warn("[PrescriptionTypeService] Nenhum dado válido para atualizar.");
         return this.get(typeId); // Retorna o doc existente
    }


    console.log(`[PrescriptionTypeService] Atualizando tipo ${typeId} para Tenant ${tenantId}:`, restUpdateData);
    try {
      const docRef = doc(db, "prescriptionTypes", typeId);
      
      // VERIFICAÇÃO IMPORTANTE: Garante que o documento pertence ao tenant antes de atualizar
      const docSnap = await getDoc(docRef);
      if (!docSnap.exists() || docSnap.data().tenant_id !== tenantId) {
          console.error(`[PrescriptionTypeService] Update negado: Tipo ${typeId} não encontrado ou não pertence ao Tenant ${tenantId}.`);
          throw new Error("Tipo não encontrado ou permissão negada.");
      }

      const dataToUpdate = {
        ...restUpdateData,
        updated_at: serverTimestamp()
      };
      await updateDoc(docRef, dataToUpdate);
      console.log(`[PrescriptionTypeService] Tipo ${typeId} atualizado para Tenant ${tenantId}.`);
      
      const updatedDoc = await getDoc(docRef);
      return mapDocument(updatedDoc);

    } catch (error) {
       console.error(`[PrescriptionTypeService] Erro ao atualizar tipo ${typeId} para Tenant ${tenantId}:`, error);
       if (error.code === 'permission-denied') {
         console.error("PERMISSION DENIED: Verifique regras do Firestore para atualizar prescriptionTypes.");
       }
       throw error;
    }
  },

  /**
   * Deleta um tipo de prescrição DO TENANT ATUAL.
   * ATENÇÃO: Considerar o que acontece com os itens associados! Deletar em cascata? Bloquear deleção se houver itens?
   * @param {string} typeId - ID do tipo a ser deletado.
   * @returns {Promise<void>}
   */
  delete: async (typeId) => {
    const tenantId = getCurrentTenantId();
    if (!tenantId) throw new Error("Tenant não identificado para deletar tipo.");
    if (!typeId) throw new Error("ID é obrigatório para deletar tipo.");

    console.log(`[PrescriptionTypeService] Deletando tipo ${typeId} para Tenant ${tenantId}...`);
    try {
      const docRef = doc(db, "prescriptionTypes", typeId);

      // VERIFICAÇÃO IMPORTANTE: Garante que o documento pertence ao tenant antes de deletar
      const docSnap = await getDoc(docRef);
      if (!docSnap.exists() || docSnap.data().tenant_id !== tenantId) {
          console.error(`[PrescriptionTypeService] Delete negado: Tipo ${typeId} não encontrado ou não pertence ao Tenant ${tenantId}.`);
          throw new Error("Tipo não encontrado ou permissão negada.");
      }

      // <<< LÓGICA DE VALIDAÇÃO/CASCATA (Exemplo: Bloquear se houver itens) >>>
      const itemsQuery = query(collection(db, "prescriptionItems"), where("tenant_id", "==", tenantId), where("prescriptionTypeId", "==", typeId));
      const itemsSnapshot = await getDocs(itemsQuery);
      if (!itemsSnapshot.empty) {
        console.warn(`[PrescriptionTypeService] Deleção bloqueada: Tipo ${typeId} possui ${itemsSnapshot.size} itens associados.`);
        throw new Error("Não é possível deletar este tipo pois existem itens de prescrição associados a ele.");
        // Alternativa: Deletar itens em cascata (requer cuidado e talvez batch write)
        // const batch = writeBatch(db);
        // itemsSnapshot.forEach(itemDoc => batch.delete(itemDoc.ref));
        // await batch.commit();
        // console.log(`[PrescriptionTypeService] Deletados ${itemsSnapshot.size} itens associados ao tipo ${typeId}.`);
      }
      // <<< FIM VALIDAÇÃO >>>

      await deleteDoc(docRef);
      console.log(`[PrescriptionTypeService] Tipo ${typeId} deletado para Tenant ${tenantId}.`);

    } catch (error) {
       console.error(`[PrescriptionTypeService] Erro ao deletar tipo ${typeId} para Tenant ${tenantId}:`, error);
       if (error.code === 'permission-denied') {
         console.error("PERMISSION DENIED: Verifique regras do Firestore para deletar prescriptionTypes.");
       }
       // Re-throw errors específicos como o de bloqueio por itens existentes
       if (error.message.includes("itens de prescrição associados")) {
           throw error;
       }
       throw error; // Re-throw outros erros genéricos
    }
  }
}; 