import { 
  getFirestore, 
  collection, 
  doc, 
  getDoc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  getDocs,
  serverTimestamp 
} from 'firebase/firestore';
// Assuming you have Firebase initialized and db exported elsewhere
// import { db } from '@/firebaseConfig'; // Adjust the import path as needed

const db = getFirestore(); // Use getFirestore() directly if db is not exported globally
const collectionName = 'consultations';

// Helper function to get the tenant ID
const getCurrentTenantId = () => {
  const tenantId = localStorage.getItem('current_tenant');
  // console.log(`[getCurrentTenantId] Found tenant: ${tenantId}`); // Debug log
  return tenantId || null; 
};

const consultationService = {
  /**
   * Filters consultations based on criteria.
   * Requires tenant_id unless filters.ignoreTenant is true.
   * @param {object} filters - Object containing field-value pairs to filter by.
   *                           Example: { appointmentId: 'xyz', status: 'pending', ignoreTenant: false }
   * @returns {Promise<Array>} - Promise resolving to an array of consultation objects.
   */
  filter: async (filters = {}) => {
    const tenantId = getCurrentTenantId();
    const ignoreTenant = filters.ignoreTenant || false;

    if (!tenantId && !ignoreTenant) {
       console.warn('[consultationService.filter] Tenant ID not found and ignoreTenant is false. Returning empty array.');
       return [];
    }

    try {
      let conditions = [];
      // Apply tenant filter unless explicitly ignored
      if (tenantId && !ignoreTenant) {
         conditions.push(where('tenant_id', '==', tenantId));
      }

      // Apply other filters passed in the 'filters' object
      for (const key in filters) {
        // Use Object.prototype.hasOwnProperty.call for safer check
        if (Object.prototype.hasOwnProperty.call(filters, key) && key !== 'ignoreTenant') { 
           const value = filters[key];
           // Ensure filter value is valid (not undefined)
           // Allow null checks specifically if needed, otherwise skip null/undefined
           if (value !== undefined) { 
              // Add specific query types if needed (e.g., array-contains, >, <)
              // if (key === 'status' && Array.isArray(value)) {
              //    conditions.push(where(key, 'in', value));
              // } else 
              conditions.push(where(key, '==', value));
           } else {
              console.warn(`[consultationService.filter] Skipping filter for key "${key}" due to undefined value.`);
           }
        }
      }
      
      const q = query(collection(db, collectionName), ...conditions);
      
      // console.log(`[consultationService.filter] Executing query with filters:`, filters, `Tenant: ${tenantId || 'None (ignored)'}`);
      const querySnapshot = await getDocs(q);
      const consultations = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      // console.log(`[consultationService.filter] Found ${consultations.length} consultations.`);
      return consultations;
    } catch (error) {
      console.error('[consultationService.filter] Error filtering consultations:', error);
      // Consider logging the error to a monitoring service
      // logAction('error', 'Error filtering consultations', { error: error.message, filters });
      throw error; // Re-throw the error for higher-level handling
    }
  },

  /**
   * Gets a single consultation by its ID.
   * @param {string} id - The ID of the consultation document.
   * @returns {Promise<object|null>} - Promise resolving to the consultation object or null if not found.
   */
  get: async (id) => {
     if (!id) {
        console.error('[consultationService.get] ID is required.');
        return null;
     }
     try {
        const docRef = doc(db, collectionName, id);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const consultation = { id: docSnap.id, ...docSnap.data() };
            // Optional: Add tenant verification here if needed, comparing consultation.tenant_id
            // console.log(`[consultationService.get] Consultation found: ${id}`);
            return consultation;
        } else {
            console.warn(`[consultationService.get] No consultation found with ID: ${id}`);
            return null;
        }
     } catch (error) {
        console.error(`[consultationService.get] Error fetching consultation ${id}:`, error);
        // logAction('error', 'Error fetching consultation', { error: error.message, consultationId: id });
        throw error;
     }
  },

  /**
   * Creates a new consultation document.
   * Requires a tenant_id to be set.
   * @param {object} data - The data for the new consultation. Must include necessary fields.
   * @returns {Promise<object>} - Promise resolving to the newly created consultation object with its ID.
   */
  create: async (data) => {
    const tenantId = getCurrentTenantId();
    if (!tenantId) {
       console.error('[consultationService.create] Tenant ID is required to create a consultation.');
       throw new Error('Tenant ID is required.');
    }
    
    try {
       const docData = {
          ...data,
          tenant_id: tenantId, // Ensure tenant_id is automatically added
          created_at: serverTimestamp(),
          updated_at: serverTimestamp(),
       };
       // Remove id field if accidentally passed in data
       delete docData.id; 

       const docRef = await addDoc(collection(db, collectionName), docData);
       console.log(`[consultationService.create] Consultation created with ID: ${docRef.id}`);
       // logAction('create', 'Consultation created', { consultationId: docRef.id, tenantId });
       // Return the data that was actually saved, including the ID
       return { id: docRef.id, ...docData, created_at: new Date(), updated_at: new Date() }; // Return approximate client-side timestamps
    } catch (error) {
       console.error('[consultationService.create] Error creating consultation:', error);
       // logAction('error', 'Error creating consultation', { error: error.message, data, tenantId });
       throw error;
    }
  },

  /**
   * Updates an existing consultation document.
   * @param {string} id - The ID of the consultation document to update.
   * @param {object} data - An object containing the fields to update.
   * @returns {Promise<boolean>} - Promise resolving to true if successful.
   */
  update: async (id, data) => {
     if (!id) {
        console.error('[consultationService.update] ID is required.');
        return false;
     }
     try {
        const docRef = doc(db, collectionName, id);
        // Prevent updating tenant_id or created_at
        const updateData = {
            ...data,
            tenant_id: undefined, // Ensure tenant_id is not accidentally changed
            created_at: undefined, // Ensure created_at is not accidentally changed
            updated_at: serverTimestamp(), // Always update the timestamp
        };
        // Clean undefined fields from updateData
        Object.keys(updateData).forEach(key => updateData[key] === undefined && delete updateData[key]);

        await updateDoc(docRef, updateData);
        // console.log(`[consultationService.update] Consultation updated: ${id}`);
        // logAction('update', 'Consultation updated', { consultationId: id, changes: updateData });
        return true; // Indicate success
     } catch (error) {
        console.error(`[consultationService.update] Error updating consultation ${id}:`, error);
        // logAction('error', 'Error updating consultation', { error: error.message, consultationId: id, data });
        throw error;
     }
  },

  /**
   * Deletes a consultation document.
   * @param {string} id - The ID of the consultation document to delete.
   * @returns {Promise<boolean>} - Promise resolving to true if successful.
   */
  delete: async (id) => {
     if (!id) {
        console.error('[consultationService.delete] ID is required.');
        return false;
     }
     try {
        const docRef = doc(db, collectionName, id);
        // Optional: Add verification here - fetch the doc first and check tenant_id
        await deleteDoc(docRef);
        console.log(`[consultationService.delete] Consultation deleted: ${id}`);
        // logAction('delete', 'Consultation deleted', { consultationId: id });
        return true;
     } catch (error) {
        console.error(`[consultationService.delete] Error deleting consultation ${id}:`, error);
        // logAction('error', 'Error deleting consultation', { error: error.message, consultationId: id });
        throw error;
     }
  },
};

// Export the service object
export { consultationService };
