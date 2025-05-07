import {
  getFirestore,
  collection,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  getDocs,
  getCountFromServer
} from 'firebase/firestore';

const db = getFirestore();
const COLLABORATORS_COLLECTION = 'colaboradores';

export const collaboratorService = {
  /**
   * Lists collaborators for a tenant with pagination and ordering.
   * @param {object} filterObject -
   *    { tenantId, orderByField = 'nome', orderByDirection = 'asc', limitNum, startAfterDoc }
   * @returns {Promise<{ collaborators: Array<object>, lastVisibleDoc: object|null }>} 
   */
  list: async (filterObject = {}) => {
    const { 
      tenantId,
      orderByField = 'nome', 
      orderByDirection = 'asc', 
      limitNum,
      startAfterDoc
      // Adicionar outros filtros se necessário (ex: por perfilId, status)
    } = filterObject;

    if (!tenantId) {
      throw new Error('Tenant ID é obrigatório para listar colaboradores.');
    }

    const collaboratorsRef = collection(db, COLLABORATORS_COLLECTION);
    const queryConstraints = [];

    queryConstraints.push(where("tenantId", "==", tenantId));

    // Adicionar outros filtros baseados em filterObject aqui, se houver.
    // Ex: if (filterObject.status) { queryConstraints.push(where("status", "==", filterObject.status)); }

    queryConstraints.push(orderBy(orderByField, orderByDirection));

    if (startAfterDoc) {
      queryConstraints.push(startAfter(startAfterDoc));
    }

    if (limitNum) {
      queryConstraints.push(limit(limitNum));
    }

    const q = query(collaboratorsRef, ...queryConstraints);
    const snapshot = await getDocs(q);

    const collaborators = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    const lastVisible = snapshot.docs.length > 0 ? snapshot.docs[snapshot.docs.length - 1] : null;

    console.log(`[collaboratorService.list] Found ${collaborators.length} collaborators for tenant ${tenantId}.`);
    return { collaborators, lastVisibleDoc: lastVisible };
  },

  /**
   * Gets the total count of collaborators for a tenant based on filters.
   * @param {object} filterObject - { tenantId 
   *    // Adicionar outros filtros se necessário (ex: por perfilId, status)
   * }
   * @returns {Promise<number>} 
   */
  getCount: async (filterObject = {}) => {
    const { 
      tenantId
      // Adicionar outros filtros se necessário
    } = filterObject;

    if (!tenantId) {
      throw new Error('Tenant ID é obrigatório para contar colaboradores.');
    }

    const collaboratorsRef = collection(db, COLLABORATORS_COLLECTION);
    const queryConstraints = [];

    queryConstraints.push(where("tenantId", "==", tenantId));

    // Adicionar outros filtros baseados em filterObject aqui, se houver.

    const q = query(collaboratorsRef, ...queryConstraints);
    const snapshot = await getCountFromServer(q);

    console.log(`[collaboratorService.getCount] Total collaborators for tenant ${tenantId}:`, snapshot.data().count);
    return snapshot.data().count;
  }
  // Adicionar outras funções CRUD (get, create, update, delete) se necessário,
  // adaptando-as para usar este padrão e a coleção 'colaboradores'.
  // Por enquanto, focaremos em list e getCount para a paginação.
}; 