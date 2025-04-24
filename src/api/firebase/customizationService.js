import { db } from '@/lib/firebaseConfig';
import {
  collection,
  query,
  where,
  getDocs,
  limit,
  doc,
  addDoc,
  updateDoc,
  serverTimestamp,
  getDoc
} from "firebase/firestore";

const customizationsCollection = collection(db, "customizations");

export const customizationService = {

  /**
   * Filters customizations based on criteria. 
   * Primarily used to find the customization for a specific tenant_id.
   * @param {object} filters - Filtering criteria (e.g., { tenant_id: '...' })
   * @returns {Promise<Array<object>>} - Array containing the matching customization object(s) (usually one).
   */
  filter: async (filters = {}) => {
    const conditions = [];
    console.log(`[customizationService.filter] Filtering customizations with:`, filters);

    if (filters.tenant_id) {
      conditions.push(where("tenant_id", "==", filters.tenant_id));
    }
    // Add other filters if needed

    // Limit to 1 if filtering by tenant_id as there should only be one per tenant
    if (filters.tenant_id) {
        conditions.push(limit(1));
    }

    try {
      const q = query(customizationsCollection, ...conditions);
      const querySnapshot = await getDocs(q);
      const customizations = querySnapshot.docs.map(docSnap => ({
        id: docSnap.id,
        ...docSnap.data(),
        // Convert timestamps if needed, though this object might not have them directly
      }));
      console.log(`[customizationService.filter] Found ${customizations.length} customizations matching criteria.`);
      return customizations;
    } catch (error) {
      console.error("[customizationService.filter] Error fetching customizations:", error);
      throw error;
    }
  },

  /**
   * Creates a new customization document.
   * Automatically adds the tenant_id based on localStorage.
   * @param {object} customizationData - Data for the new customization (tenant_id is ignored/overwritten).
   * @returns {Promise<object>} - The created customization object with its ID.
   */
  create: async (customizationData) => {
    const tenantId = localStorage.getItem('current_tenant');
    if (!tenantId) {
      console.error("[customizationService.create] Error: Tenant ID not found in localStorage.");
      throw new Error('Tenant não identificado. Faça login novamente.');
    }
    console.log(`[customizationService.create] Creating customization for Tenant ID: ${tenantId}`);
    
    const { tenant_id, ...restData } = customizationData; // Ignore tenant_id from input
    if (tenant_id) {
        console.warn("[customizationService.create] tenant_id in input data ignored.");
    }

    const dataToSave = {
        ...restData,
        tenant_id: tenantId, // <<< Set tenant ID
        created_at: serverTimestamp(), // Add timestamps if desired
        updated_at: serverTimestamp()
    };

    try {
        const docRef = await addDoc(customizationsCollection, dataToSave);
        console.log(`[customizationService.create] Customization created with ID: ${docRef.id} for Tenant ID: ${tenantId}`);
        return { id: docRef.id, ...dataToSave }; // Return optimistic data (no server timestamps yet)
    } catch (error) {
        console.error(`[customizationService.create] Error creating customization for Tenant ID ${tenantId}:`, error);
        throw new Error(`Erro ao criar customização: ${error.message}`);
    }
  },

  /**
   * Updates an existing customization document.
   * Verifies tenant ownership before updating.
   * @param {string} id - The ID of the customization document to update.
   * @param {object} customizationData - Data to update (tenant_id is ignored).
   * @returns {Promise<object>} - The updated customization object (optimistic).
   */
  update: async (id, customizationData) => {
     const tenantId = localStorage.getItem('current_tenant');
     if (!tenantId) {
       console.error("[customizationService.update] Error: Tenant ID not found in localStorage.");
       throw new Error('Tenant não identificado. Faça login novamente.');
     }
     console.log(`[customizationService.update] Updating customization ID: ${id} for Tenant ID: ${tenantId}`);

    try {
      const docRef = doc(db, "customizations", id);
      
      // Verify tenant ownership (important!)
      const docSnap = await getDoc(docRef); // Need getDoc here to read before update
      if (!docSnap.exists()) {
          console.error(`[customizationService.update] Error: Customization ${id} not found.`);
          throw new Error('Configuração de customização não encontrada.');
      }
      const existingData = docSnap.data();
      if (existingData.tenant_id !== tenantId) {
           console.error(`[customizationService.update] Access Denied: Tenant ${tenantId} cannot update customization ${id} owned by ${existingData.tenant_id}.`);
           throw new Error('Permissão negada para atualizar esta configuração.');
      }

      // Prepare update data, excluding forbidden fields
      const { tenant_id, created_at, id: inputId, ...restUpdateData } = customizationData;
       if (tenant_id || created_at || inputId) {
            console.warn(`[customizationService.update] Attempted to update restricted fields (tenant_id, created_at, id) for customization ${id}. These fields were ignored.`);
       }
      
      const dataToUpdate = {
          ...restUpdateData,
          updated_at: serverTimestamp()
      };

      await updateDoc(docRef, dataToUpdate);
      console.log(`[customizationService.update] Customization updated with ID: ${id} for Tenant ID: ${tenantId}`);
      return { id: id, ...dataToUpdate }; // Return optimistic data

    } catch (error) {
      console.error(`[customizationService.update] Error updating customization ${id} for Tenant ID ${tenantId}:`, error);
      if (error.message.includes('Permissão negada') || error.message.includes('não encontrada')) {
          throw error; // Re-throw specific errors
      }
      throw new Error(`Erro ao atualizar customização: ${error.message}`);
    }
  },
}; 