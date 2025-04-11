import { db } from '../../lib/firebaseConfig'; 
import { 
  collection, 
  getDocs, 
  addDoc, 
  query, 
  where, 
  Timestamp,
  orderBy,
  doc,
  getDoc
} from "firebase/firestore";

const reasonsCollection = collection(db, "cancellationReasons");

export const cancellationReasonService = {

  /**
   * Lists all cancellation reasons for a specific tenant.
   * @param {string} tenantId - The ID of the tenant.
   * @returns {Promise<Array<object>>} - Array of cancellation reason objects.
   */
  list: async (tenantId) => {
    if (!tenantId) {
      console.error("[cancellationReasonService.list] Tenant ID is required.");
      // throw new Error("Tenant ID is required to list cancellation reasons."); 
      return []; // Return empty if no tenantId to avoid breaking UI maybe?
    }
    try {
      // Query by tenant_id and optionally order by reason text or creation date
      const q = query(
        reasonsCollection, 
        where("tenant_id", "==", tenantId),
        orderBy("reason") // Example: order alphabetically
        // orderBy("created_at", "desc") // Example: order by creation date
      );
      
      console.log(`[cancellationReasonService.list] Fetching reasons for tenant: ${tenantId}`);
      const querySnapshot = await getDocs(q);
      const reasons = querySnapshot.docs.map(docSnap => ({
        id: docSnap.id,
        ...docSnap.data(),
      }));
      console.log(`[cancellationReasonService.list] Found ${reasons.length} reasons.`);
      return reasons;
    } catch (error) {
      console.error(`[cancellationReasonService.list] Error fetching reasons for tenant ${tenantId}:`, error);
      throw error;
    }
  },

  /**
   * Creates a new cancellation reason for a specific tenant.
   * @param {object} reasonData - Data for the new reason (e.g., { reason: '...', tenant_id: '...' }).
   * @returns {Promise<object>} - The created reason object with its ID.
   */
  create: async (reasonData) => {
    if (!reasonData.reason || !reasonData.tenant_id) {
         throw new Error("Reason text and tenant_id are required to create a cancellation reason.");
    }
    try {
        const dataToSave = {
            reason: reasonData.reason.trim(), // Trim whitespace
            tenant_id: reasonData.tenant_id,
            created_at: Timestamp.now() // Add creation timestamp
        };
      // Note: This doesn't check for duplicates. You might add a check here if needed.
      const docRef = await addDoc(reasonsCollection, dataToSave);
      console.log(`[cancellationReasonService.create] Reason created with ID: ${docRef.id} for tenant ${reasonData.tenant_id}`);
      return { id: docRef.id, ...dataToSave };
    } catch (error) {
      console.error("[cancellationReasonService.create] Error creating reason:", error);
      throw error;
    }
  },

  /**
   * Gets a specific cancellation reason by its ID.
   * @param {string} reasonId - The ID of the reason to fetch.
   * @returns {Promise<object|null>} - The reason object or null if not found.
   */
  get: async (reasonId) => {
    if (!reasonId) {
      console.error("[cancellationReasonService.get] Reason ID is required.");
      return null;
    }
    try {
      console.log(`[cancellationReasonService.get] Fetching reason with ID: ${reasonId}`);
      const docRef = doc(db, "cancellationReasons", reasonId);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const reasonData = { id: docSnap.id, ...docSnap.data() };
        console.log("[cancellationReasonService.get] Reason found:", reasonData);
        return reasonData;
      } else {
        console.warn(`[cancellationReasonService.get] Reason with ID ${reasonId} not found.`);
        return null;
      }
    } catch (error) {
      console.error(`[cancellationReasonService.get] Error fetching reason ${reasonId}:`, error);
      throw error; // Re-throw to allow calling code to handle
    }
  },
  
  // Optional: Add update/delete functions if needed later
}; 