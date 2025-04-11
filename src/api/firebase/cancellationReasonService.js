import { db } from '../../lib/firebaseConfig'; 
import { 
  collection, 
  getDocs, 
  addDoc, 
  query, 
  where, 
  serverTimestamp,
  orderBy,
  doc,
  getDoc
} from "firebase/firestore";

const reasonsCollection = collection(db, "cancellationReasons");

export const cancellationReasonService = {

  /**
   * Lists all cancellation reasons for the current tenant.
   * @returns {Promise<Array<object>>} - Array of cancellation reason objects.
   */
  list: async () => {
    const tenantId = localStorage.getItem('current_tenant');
    if (!tenantId) {
      console.error("[cancellationReasonService.list] Tenant ID not found in localStorage.");
      throw new Error('Tenant não identificado. Faça login novamente.');
    }
    console.log(`[cancellationReasonService.list] Fetching reasons for tenant: ${tenantId}`);
    
    let queryConstraints = [];
    try {
      queryConstraints.push(where("tenant_id", "==", tenantId));
      queryConstraints.push(orderBy("reason")); 
      
      const q = query(reasonsCollection, ...queryConstraints);
      
      const querySnapshot = await getDocs(q);
      const reasons = querySnapshot.docs.map(docSnap => ({
        id: docSnap.id,
        ...docSnap.data(),
      }));
      console.log(`[cancellationReasonService.list] Found ${reasons.length} reasons for Tenant ${tenantId}.`);
      return reasons;
    } catch (error) {
      console.error(`[cancellationReasonService.list] Error fetching reasons for tenant ${tenantId}:`, error);
      if (error.code === 'permission-denied') {
           console.error("PERMISSION DENIED: Check Firestore rules for reading cancellationReasons.");
           throw new Error('Permissão negada para listar motivos. Verifique as regras.');
      }
      if (error.code === 'failed-precondition') {
           console.error("FAILED PRECONDITION: Missing Firestore index for cancellationReasons query?");
           console.error("Filters applied:", queryConstraints.map(c => JSON.stringify(c)));
           throw new Error('Erro de configuração do Firestore (índice ausente?). Verifique o console.');
       }
      throw error;
    }
  },

  /**
   * Creates a new cancellation reason for the current tenant.
   * @param {object} reasonData - Data for the new reason (e.g., { reason: '...' }). tenant_id is ignored.
   * @returns {Promise<object>} - The created reason object with its ID.
   */
  create: async (reasonData) => {
    const tenantId = localStorage.getItem('current_tenant');
    if (!tenantId) {
      console.error("[cancellationReasonService.create] Tenant ID not found in localStorage.");
      throw new Error('Tenant não identificado. Faça login novamente.');
    }
    const { tenant_id, reason, ...restData } = reasonData;
    if (tenant_id) {
        console.warn("[cancellationReasonService.create] tenant_id ignored. Using tenant from localStorage.");
    }
    if (!reason) {
         throw new Error("Reason text is required to create a cancellation reason.");
    }
    console.log(`[cancellationReasonService.create] Creating reason for Tenant ${tenantId}:`, reason);
    try {
        const dataToSave = {
            ...restData,
            reason: reason.trim(),
            tenant_id: tenantId,
            created_at: serverTimestamp()
        };
      const docRef = await addDoc(reasonsCollection, dataToSave);
      console.log(`[cancellationReasonService.create] Reason created with ID: ${docRef.id} for Tenant ${tenantId}`);
      const createdReason = await cancellationReasonService.get(docRef.id);
      return createdReason;
    } catch (error) {
      console.error(`[cancellationReasonService.create] Error creating reason for Tenant ${tenantId}:`, error);
      if (error.code === 'permission-denied') {
           console.error("PERMISSION DENIED: Check Firestore rules for creating cancellationReasons.");
      }
      throw error;
    }
  },

  /**
   * Gets a specific cancellation reason by its ID, verifying tenant ownership.
   * @param {string} reasonId - The ID of the reason to fetch.
   * @returns {Promise<object|null>} - The reason object or null if not found/not owned.
   */
  get: async (reasonId) => {
    const tenantId = localStorage.getItem('current_tenant');
    if (!tenantId) {
      console.error("[cancellationReasonService.get] Tenant ID not found in localStorage.");
      throw new Error('Tenant não identificado. Faça login novamente.');
    }
    if (!reasonId) {
      console.error("[cancellationReasonService.get] Reason ID is required.");
      return null;
    }
    try {
      console.log(`[cancellationReasonService.get] Fetching reason ID: ${reasonId} for Tenant ID: ${tenantId}`);
      const docRef = doc(db, "cancellationReasons", reasonId);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.tenant_id !== tenantId) {
             console.warn(`[cancellationReasonService.get] Access Denied. Reason ${reasonId} belongs to tenant ${data.tenant_id}.`);
             return null;
        }
        const reasonData = { id: docSnap.id, ...data };
        console.log(`[cancellationReasonService.get] Reason found for Tenant ${tenantId}:`, reasonData);
        return reasonData;
      } else {
        console.warn(`[cancellationReasonService.get] Reason with ID ${reasonId} not found.`);
        return null;
      }
    } catch (error) {
      console.error(`[cancellationReasonService.get] Error fetching reason ${reasonId} for Tenant ${tenantId}:`, error);
      throw error;
    }
  },
  
  // Optional: Add update/delete functions if needed later, ensuring tenant verification
}; 