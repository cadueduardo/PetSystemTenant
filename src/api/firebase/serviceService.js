import { db } from '@/lib/firebaseConfig';
import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  updateDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  deleteDoc // Only if you plan to hard-delete
} from "firebase/firestore";

const servicesCollection = collection(db, "services");

export const serviceService = {

  /**
   * Lists services based on filters.
   * @param {object} filters - Object with filters (e.g., { tenant_id, module, category, is_active }).
   * @returns {Promise<Array<object>>} - Array of service objects.
   */
  list: async (filters = {}) => {
    console.log('[serviceService.list] Filtering Services with:', filters);
    try {
      let q = query(servicesCollection);
      const queryConstraints = [];

      if (filters.tenant_id) {
        queryConstraints.push(where("tenant_id", "==", filters.tenant_id));
      } else {
         // Should always filter by tenant in a multi-tenant app
         console.error('[serviceService.list] Missing tenant_id filter!');
         // Depending on your rules, this might return an error or empty results
         // For now, let it proceed but log the error.
         // return []; // Or throw new Error('Tenant ID is required');
      }
      if (filters.module) {
        queryConstraints.push(where("module", "==", filters.module));
      }
      if (filters.category) {
        queryConstraints.push(where("category", "==", filters.category));
      }
      if (filters.hasOwnProperty('is_active')) { // Check for explicit true/false
        queryConstraints.push(where("is_active", "==", filters.is_active));
      } else {
        // Default to only active services if not specified
        queryConstraints.push(where("is_active", "==", true));
      }
      
      // Apply ordering if needed
      queryConstraints.push(orderBy("name")); // Example: order by name

      q = query(servicesCollection, ...queryConstraints);

      const querySnapshot = await getDocs(q);
      const services = querySnapshot.docs.map(docSnap => ({
        id: docSnap.id,
        ...docSnap.data(),
      }));
      console.log(`[serviceService.list] Found ${services.length} services.`);
      return services;
    } catch (error) {
      console.error("[serviceService.list] Error fetching services:", error);
      // Handle specific errors like missing indexes if necessary
      throw error;
    }
  },

  /**
   * Gets a specific service by its ID.
   * @param {string} serviceId - The ID of the service to fetch.
   * @returns {Promise<object|null>} - The service object or null if not found.
   */
  get: async (serviceId) => {
    if (!serviceId) {
      console.error("[serviceService.get] Service ID is required.");
      return null;
    }
    try {
      console.log(`[serviceService.get] Fetching service with ID: ${serviceId}`);
      const docRef = doc(db, "services", serviceId);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const serviceData = { id: docSnap.id, ...docSnap.data() };
        console.log("[serviceService.get] Service found:", serviceData);
        return serviceData;
      } else {
        console.warn(`[serviceService.get] Service with ID ${serviceId} not found.`);
        return null;
      }
    } catch (error) {
      console.error(`[serviceService.get] Error fetching service ${serviceId}:`, error);
      throw error;
    }
  },

  /**
   * Creates a new service.
   * @param {object} serviceData - Data for the new service.
   * @returns {Promise<object>} - The created service object with its ID.
   */
  create: async (serviceData) => {
    if (!serviceData.name || !serviceData.tenant_id || !serviceData.module) {
         throw new Error("Name, tenant_id, and module are required to create a service.");
    }
    try {
        const dataToSave = {
            ...serviceData,
            is_active: serviceData.is_active !== undefined ? serviceData.is_active : true, // Default to active
            created_at: serverTimestamp(),
            updated_at: serverTimestamp()
        };
      const docRef = await addDoc(servicesCollection, dataToSave);
      console.log(`[serviceService.create] Service created with ID: ${docRef.id} for tenant ${serviceData.tenant_id}`);
      return { id: docRef.id, ...dataToSave };
    } catch (error) {
      console.error("[serviceService.create] Error creating service:", error);
      throw error;
    }
  },
  
  /**
   * Updates an existing service.
   * @param {string} serviceId - The ID of the service to update.
   * @param {object} updateData - Fields to update.
   * @returns {Promise<void>}
   */
  update: async (serviceId, updateData) => {
     if (!serviceId || !updateData) {
        throw new Error("Service ID and update data are required.");
     }
     // Prevent changing tenant_id
     if (updateData.tenant_id) {
         console.warn("[serviceService.update] Attempted to change tenant_id. Ignoring.");
         delete updateData.tenant_id;
     }
     
     try {
        const dataToUpdate = {
            ...updateData,
            updated_at: serverTimestamp()
        };
        const docRef = doc(db, "services", serviceId);
        await updateDoc(docRef, dataToUpdate);
        console.log(`[serviceService.update] Service ${serviceId} updated successfully.`);
     } catch(error) {
        console.error(`[serviceService.update] Error updating service ${serviceId}:`, error);
        throw error;
     }
  },
  
   /**
   * Deactivates a service (sets is_active to false).
   * @param {string} serviceId - The ID of the service to deactivate.
   * @returns {Promise<void>}
   */
  deactivate: async (serviceId) => {
     return serviceService.update(serviceId, { is_active: false });
  },
  
   /**
   * Reactivates a service (sets is_active to true).
   * @param {string} serviceId - The ID of the service to reactivate.
   * @returns {Promise<void>}
   */
  reactivate: async (serviceId) => {
     return serviceService.update(serviceId, { is_active: true });
  }
  
  // delete: async (serviceId) => { ... } // Implement hard delete if truly needed
};