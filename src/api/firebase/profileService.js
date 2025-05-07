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
const PROFILES_COLLECTION = 'perfis';

export const profileService = {
  /**
   * Lists profiles for a tenant with pagination and ordering.
   * @param {object} filterObject -
   *    { tenantId, orderByField = 'nome', orderByDirection = 'asc', limitNum, startAfterDoc }
   * @returns {Promise<{ profiles: Array<object>, lastVisibleDoc: object|null }>} 
   */
  list: async (filterObject = {}) => {
    const { 
      tenantId,
      orderByField = 'nome', 
      orderByDirection = 'asc', 
      limitNum,
      startAfterDoc
      // Adicionar outros filtros se necessário
    } = filterObject;

    if (!tenantId) {
      throw new Error('Tenant ID é obrigatório para listar perfis.');
    }

    const profilesRef = collection(db, PROFILES_COLLECTION);
    const queryConstraints = [];

    queryConstraints.push(where("tenantId", "==", tenantId));

    // Adicionar outros filtros baseados em filterObject aqui, se houver.

    queryConstraints.push(orderBy(orderByField, orderByDirection));

    if (startAfterDoc) {
      queryConstraints.push(startAfter(startAfterDoc));
    }

    if (limitNum) {
      queryConstraints.push(limit(limitNum));
    }

    const q = query(profilesRef, ...queryConstraints);
    const snapshot = await getDocs(q);

    const profiles = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    const lastVisible = snapshot.docs.length > 0 ? snapshot.docs[snapshot.docs.length - 1] : null;

    console.log(`[profileService.list] Found ${profiles.length} profiles for tenant ${tenantId}.`);
    return { profiles, lastVisibleDoc: lastVisible };
  },

  /**
   * Gets the total count of profiles for a tenant based on filters.
   * @param {object} filterObject - { tenantId 
   *    // Adicionar outros filtros se necessário
   * }
   * @returns {Promise<number>} 
   */
  getCount: async (filterObject = {}) => {
    const { 
      tenantId
      // Adicionar outros filtros se necessário
    } = filterObject;

    if (!tenantId) {
      throw new Error('Tenant ID é obrigatório para contar perfis.');
    }

    const profilesRef = collection(db, PROFILES_COLLECTION);
    const queryConstraints = [];

    queryConstraints.push(where("tenantId", "==", tenantId));

    // Adicionar outros filtros baseados em filterObject aqui, se houver.

    const q = query(profilesRef, ...queryConstraints);
    const snapshot = await getCountFromServer(q);

    console.log(`[profileService.getCount] Total profiles for tenant ${tenantId}:`, snapshot.data().count);
    return snapshot.data().count;
  }
  // Adicionar outras funções CRUD (get, create, update, delete) se necessário.
}; 