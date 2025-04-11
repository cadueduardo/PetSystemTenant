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
   * Lists queue entries based on filters.
   * @param {object} filters - Filters (e.g., { tenant_id, queue_type, status, date }).
   * @returns {Promise<Array<object>>} - Array of queue entry objects.
   */
  list: async (filters = {}) => {
    console.log('[queueService.list] Filtering Queue Entries with:', filters);
    try {
      const queryConstraints = [];

      if (filters.tenant_id) {
        queryConstraints.push(where("tenant_id", "==", filters.tenant_id));
      } else {
        console.error('[queueService.list] Missing tenant_id filter!');
        // return []; // Or throw error based on security rules
      }

      if (filters.queue_type) {
        queryConstraints.push(where("queue_type", "==", filters.queue_type));
      }

      // Often, you only want 'waiting' or 'in_progress' entries for the active queue view
      if (filters.status) {
         if (Array.isArray(filters.status)) {
           // Usa 'in' se filters.status for um array
           if (filters.status.length > 0) { // Evita query 'in' com array vazio
                queryConstraints.push(where("status", "in", filters.status));
           } else {
                // Se um array vazio for passado, talvez não retornar nada?
                // Ou buscar todos? Por ora, não adiciona filtro de status.
                console.warn("[queueService.list] Received empty array for status filter.");
           }
         } else {
           // Mantém '==' se for uma string única
           queryConstraints.push(where("status", "==", filters.status));
         }
      }

      // Order by entry time (FIFO)
      queryConstraints.push(orderBy("entry_time", "asc"));

      const q = query(queueCollection, ...queryConstraints);

      const querySnapshot = await getDocs(q);
      const queueEntries = querySnapshot.docs.map(docSnap => ({
        id: docSnap.id,
        ...docSnap.data(),
      }));
      console.log(`[queueService.list] Found ${queueEntries.length} queue entries.`);
      return queueEntries;
    } catch (error) {
      console.error("[queueService.list] Error fetching queue entries:", error);
      throw error;
    }
  },

  /**
   * Gets a specific queue entry by its ID.
   * @param {string} entryId - The ID of the queue entry to fetch.
   * @returns {Promise<object|null>} - The queue entry object or null if not found.
   */
  get: async (entryId) => {
     // Implementation similar to serviceService.get
     if (!entryId) return null;
      try {
        const docRef = doc(db, "queueEntries", entryId);
        const docSnap = await getDoc(docRef);
        return docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } : null;
      } catch (error) {
         console.error(`[queueService.get] Error fetching entry ${entryId}:`, error);
         throw error;
      }
  },

  /**
   * Creates a new queue entry.
   * @param {object} entryData - Data for the new entry (must include tenant_id, customer_id, pet_id, service_id, queue_type).
   * @returns {Promise<object>} - The created queue entry object with its ID.
   */
  create: async (entryData) => {
    console.log('[queueService.create] Creating queue entry with:', entryData);
    if (!entryData.tenant_id || !entryData.customer_id || !entryData.pet_id || !entryData.service_id || !entryData.queue_type) {
      throw new Error("Missing required fields (tenant, customer, pet, service, type) to create queue entry.");
    }
    try {
      const dataToSave = {
        ...entryData,
        entry_time: serverTimestamp(), // Set entry time on creation
        status: entryData.status || 'waiting', // Default status
        created_at: serverTimestamp() // Optional: track creation of the doc itself
      };
      const docRef = await addDoc(queueCollection, dataToSave);
      console.log(`[queueService.create] Queue entry created with ID: ${docRef.id}`);
      return { id: docRef.id, ...dataToSave };
    } catch (error) {
      console.error("[queueService.create] Error creating queue entry:", error);
      throw error;
    }
  },

  /**
   * Updates an existing queue entry.
   * @param {string} entryId - The ID of the entry to update.
   * @param {object} updateData - Fields to update (e.g., { status, assigned_vet_id }).
   * @returns {Promise<void>}
   */
  update: async (entryId, updateData) => {
    console.log(`[queueService.update] Updating entry ${entryId} with:`, updateData);
    if (!entryId || !updateData) {
      throw new Error("Entry ID and update data are required.");
    }
    // Prevent changing key identifiers like tenant_id, pet_id etc.
    delete updateData.tenant_id;
    delete updateData.customer_id;
    delete updateData.pet_id;
    delete updateData.service_id;
    delete updateData.queue_type;
    delete updateData.entry_time;
    delete updateData.created_at;

    try {
      const dataToUpdate = {
        ...updateData,
        updated_at: serverTimestamp() // Track last update
      };
      const docRef = doc(db, "queueEntries", entryId);
      await updateDoc(docRef, dataToUpdate);
      console.log(`[queueService.update] Queue entry ${entryId} updated successfully.`);
    } catch (error) {
      console.error(`[queueService.update] Error updating entry ${entryId}:`, error);
      throw error;
    }
  },

  /**
   * Deletes a specific queue entry by its ID. Use cautiously.
   * Often updating status to 'cancelled' or 'finished' is preferred over deletion.
   * @param {string} entryId - The ID of the entry to delete.
   * @returns {Promise<void>}
   */
  delete: async (entryId) => {
    console.log(`[queueService.delete] Deleting entry ${entryId}`);
    if (!entryId) {
      throw new Error("Entry ID is required for deletion.");
    }
    try {
      const docRef = doc(db, "queueEntries", entryId);
      await deleteDoc(docRef);
      console.log(`[queueService.delete] Queue entry ${entryId} deleted successfully.`);
    } catch (error) {
      console.error(`[queueService.delete] Error deleting entry ${entryId}:`, error);
      throw error;
    }
  }
};