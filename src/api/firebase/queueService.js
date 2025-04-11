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
} from "firebase/firestore";

// Decide on the collection name. 'queueEntries' is generic.
// You could use 'vetQueue' or 'petshopQueue' if they are strictly separate.
// Let's use 'queueEntries' for now.
const queueCollection = collection(db, "queueEntries");

export const queueService = {

  /**
   * Lists queue entries for the current tenant based on filters.
   * @param {object} filters - Filters (e.g., { queue_type, status, date }). tenant_id is ignored.
   * @returns {Promise<Array<object>>} - Array of queue entry objects.
   */
  list: async (filters = {}) => {
    const tenantId = localStorage.getItem('current_tenant');
    if (!tenantId) {
      console.error('[queueService.list] Tenant ID not found in localStorage.');
      throw new Error('Tenant não identificado. Faça login novamente.'); // Throw error
    }
    // Remove tenant_id from filters if present, as we use the one from localStorage
    const { tenant_id, ...restFilters } = filters; 
    if (tenant_id) {
        console.warn("[queueService.list] tenant_id filter ignored. Using tenant from localStorage.");
    }
    console.log(`[queueService.list] Filtering Queue Entries for Tenant ID: ${tenantId} with:`, restFilters);

    let queryConstraints = []; // Define outside the try block
    try {
       queryConstraints.push(where("tenant_id", "==", tenantId)); // <<< Always filter by tenant_id

      if (restFilters.queue_type) {
        queryConstraints.push(where("queue_type", "==", restFilters.queue_type));
      }

      if (restFilters.status) {
         if (Array.isArray(restFilters.status)) {
           if (restFilters.status.length > 0) { 
                queryConstraints.push(where("status", "in", restFilters.status));
           } else {
                console.warn("[queueService.list] Received empty array for status filter.");
           }
         } else {
           queryConstraints.push(where("status", "==", restFilters.status));
         }
      }

      // Add other filters as needed based on restFilters
      // Example: filter by date if applicable (assuming 'date' field exists and is a Timestamp)
      // if (restFilters.date) {
      //    queryConstraints.push(where("date", "==", Timestamp.fromDate(new Date(restFilters.date))));
      // }

      queryConstraints.push(orderBy("entry_time", "asc"));

      const q = query(queueCollection, ...queryConstraints);

      const querySnapshot = await getDocs(q);
      const queueEntries = querySnapshot.docs.map(docSnap => ({
        id: docSnap.id,
        ...docSnap.data(),
        // Convert Timestamps if needed for frontend consistency
        entry_time: docSnap.data().entry_time?.toDate ? docSnap.data().entry_time.toDate().toISOString() : docSnap.data().entry_time,
      }));
      console.log(`[queueService.list] Found ${queueEntries.length} queue entries for Tenant ${tenantId}.`);
      return queueEntries;
    } catch (error) {
      console.error(`[queueService.list] Error fetching queue entries for Tenant ${tenantId}:`, error);
      // Add check for permission denied specifically
      if (error.code === 'permission-denied') {
           console.error("PERMISSION DENIED: Check Firestore rules for reading queueEntries.");
           throw new Error('Permissão negada para acessar a fila. Verifique as regras.');
      }
      // Add check for missing index
      if (error.code === 'failed-precondition') {
           console.error("FAILED PRECONDITION: Missing Firestore index for queueEntries query?");
           console.error("Filters applied:", queryConstraints.map(c => JSON.stringify(c)));
           throw new Error('Erro de configuração do Firestore (índice ausente?). Verifique o console.');
       }
      throw error; // Re-throw other errors
    }
  },

  /**
   * Gets a specific queue entry by its ID, verifying tenant ownership.
   * @param {string} entryId - The ID of the queue entry to fetch.
   * @returns {Promise<object|null>} - The queue entry object or null if not found/not owned.
   */
  get: async (entryId) => {
     const tenantId = localStorage.getItem('current_tenant');
     if (!tenantId) {
       console.error('[queueService.get] Tenant ID not found in localStorage.');
       throw new Error('Tenant não identificado. Faça login novamente.');
     }
     if (!entryId) return null;
      try {
        const docRef = doc(db, "queueEntries", entryId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            const data = docSnap.data();
            if (data.tenant_id !== tenantId) {
                console.warn(`[queueService.get] Access denied. Queue entry ${entryId} belongs to tenant ${data.tenant_id}.`);
                return null; // Not found for this tenant
            }
            return { id: docSnap.id, ...data };
        } else {
             return null;
        }
      } catch (error) {
         console.error(`[queueService.get] Error fetching entry ${entryId} for Tenant ${tenantId}:`, error);
         throw error;
      }
  },

  /**
   * Creates a new queue entry for the current tenant.
   * @param {object} entryData - Data for the new entry (must include customer_id, pet_id, service_id, queue_type). tenant_id is ignored.
   * @returns {Promise<object>} - The created queue entry object with its ID.
   */
  create: async (entryData) => {
    const tenantId = localStorage.getItem('current_tenant');
    if (!tenantId) {
      console.error('[queueService.create] Tenant ID not found in localStorage.');
      throw new Error('Tenant não identificado. Faça login novamente.');
    }
    const { tenant_id, customer_id, pet_id, service_id, queue_type, ...restData } = entryData;
    if (tenant_id) {
        console.warn("[queueService.create] tenant_id filter ignored. Using tenant from localStorage.");
    }
    console.log(`[queueService.create] Creating queue entry for Tenant ${tenantId} with:`, restData);
    if (!customer_id || !pet_id || !service_id || !queue_type) {
      throw new Error("Missing required fields (customer, pet, service, type) to create queue entry.");
    }

    // <<< TODO: Add validation: Check if customer, pet, service belong to the tenantId >>>
    // Similar to appointmentService.create
    console.warn("[queueService.create] TODO: Validate if customer, pet, service belong to tenant.");

    try {
      const dataToSave = {
        ...restData,
        tenant_id: tenantId, // <<< Set tenant ID
        customer_id,
        pet_id,
        service_id,
        queue_type,
        entry_time: serverTimestamp(),
        status: restData.status || 'waiting',
        created_at: serverTimestamp()
      };
      const docRef = await addDoc(queueCollection, dataToSave);
      console.log(`[queueService.create] Queue entry created with ID: ${docRef.id} for Tenant ${tenantId}`);

      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() };
      } else {
        console.error(`[queueService.create] Failed to fetch the created document ${docRef.id}`);
        return { id: docRef.id, ...dataToSave, entry_time: new Date(), created_at: new Date() };
      }
    } catch (error) {
      console.error(`[queueService.create] Error creating queue entry for Tenant ${tenantId}:`, error);
      if (error.code === 'permission-denied') {
           console.error("PERMISSION DENIED: Check Firestore rules for creating queueEntries.");
      }
      throw error;
    }
  },

  /**
   * Updates an existing queue entry, verifying tenant ownership.
   * @param {string} entryId - The ID of the entry to update.
   * @param {object} updateData - Fields to update.
   * @returns {Promise<void>} // Or return updated object?
   */
  update: async (entryId, updateData) => {
    const tenantId = localStorage.getItem('current_tenant');
    if (!tenantId) {
      console.error('[queueService.update] Tenant ID not found in localStorage.');
      throw new Error('Tenant não identificado. Faça login novamente.');
    }
    console.log(`[queueService.update] Updating entry ${entryId} for Tenant ${tenantId} with:`, updateData);
    if (!entryId || !updateData) {
      throw new Error("Entry ID and update data are required.");
    }
    
    // Prevent changing key identifiers
    const { tenant_id, customer_id, pet_id, service_id, queue_type, entry_time, created_at, ...restUpdateData } = updateData;
    if (tenant_id || customer_id || pet_id || service_id || queue_type || entry_time || created_at) {
        console.warn("[queueService.update] Attempt to update restricted fields ignored.");
    }

    try {
      const docRef = doc(db, "queueEntries", entryId);
      
      // <<< Verify tenant ownership BEFORE updating >>>
      const docSnap = await getDoc(docRef);
      if (!docSnap.exists()) {
          throw new Error('Queue entry not found.');
      }
      const existingData = docSnap.data();
      if (existingData.tenant_id !== tenantId) {
          console.error(`[queueService.update] Access Denied: Tenant ${tenantId} cannot update entry ${entryId}.`);
          throw new Error('Permissão negada para atualizar esta entrada da fila.');
      }
      // <<< END Verification >>>
      
      const dataToUpdate = {
        ...restUpdateData,
        updated_at: serverTimestamp()
      };
      await updateDoc(docRef, dataToUpdate);
      console.log(`[queueService.update] Queue entry ${entryId} updated successfully by Tenant ${tenantId}.`);
      // Maybe return the updated doc? await this.get(entryId);
    } catch (error) {
      console.error(`[queueService.update] Error updating entry ${entryId} for Tenant ${tenantId}:`, error);
       if (error.message.includes('Permissão negada') || error.message.includes('not found')) {
          throw error; // Re-throw specific errors
      }
      if (error.code === 'permission-denied') {
           console.error("PERMISSION DENIED: Check Firestore rules for updating queueEntries.");
      }
      throw error;
    }
  },

  /**
   * Deletes a specific queue entry by its ID, verifying tenant ownership.
   * @param {string} entryId - The ID of the entry to delete.
   * @returns {Promise<void>}
   */
  delete: async (entryId) => {
     const tenantId = localStorage.getItem('current_tenant');
     if (!tenantId) {
       console.error('[queueService.delete] Tenant ID not found in localStorage.');
       throw new Error('Tenant não identificado. Faça login novamente.');
     }
    console.log(`[queueService.delete] Deleting entry ${entryId} for Tenant ${tenantId}`);
    if (!entryId) {
      throw new Error("Entry ID is required for deletion.");
    }
    try {
      const docRef = doc(db, "queueEntries", entryId);
      
      // <<< Verify tenant ownership BEFORE deleting >>>
       const docSnap = await getDoc(docRef);
      if (!docSnap.exists()) {
          console.warn(`[queueService.delete] Queue entry ${entryId} not found. Nothing to delete.`);
          return; // Already deleted or never existed
      }
      const existingData = docSnap.data();
      if (existingData.tenant_id !== tenantId) {
          console.error(`[queueService.delete] Access Denied: Tenant ${tenantId} cannot delete entry ${entryId}.`);
          throw new Error('Permissão negada para deletar esta entrada da fila.');
      }
      // <<< END Verification >>>
      
      await deleteDoc(docRef);
      console.log(`[queueService.delete] Queue entry ${entryId} deleted successfully by Tenant ${tenantId}.`);
    } catch (error) {
      console.error(`[queueService.delete] Error deleting entry ${entryId} for Tenant ${tenantId}:`, error);
       if (error.message.includes('Permissão negada')) {
          throw error; // Re-throw specific errors
      }
      if (error.code === 'permission-denied') {
           console.error("PERMISSION DENIED: Check Firestore rules for deleting queueEntries.");
      }
      throw error;
    }
  }
};