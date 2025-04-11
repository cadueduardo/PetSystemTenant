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
  // deleteDoc // Only if you plan to hard-delete
} from "firebase/firestore";

const servicesCollection = collection(db, "services");

export const serviceService = {

  /**
   * Lists services for the current tenant based on filters.
   * @param {object} filters - Object with filters (e.g., { module, category, is_active }). tenant_id is ignored.
   * @returns {Promise<Array<object>>} - Array of service objects.
   */
  list: async (filters = {}) => {
    const tenantId = localStorage.getItem('current_tenant');
    if (!tenantId) {
      console.error('[serviceService.list] Tenant ID not found in localStorage.');
      throw new Error('Tenant não identificado. Faça login novamente.');
    }
    const { tenant_id, ...restFilters } = filters;
    if (tenant_id) {
        console.warn("[serviceService.list] tenant_id filter ignored. Using tenant from localStorage.");
    }
    console.log(`[serviceService.list] Filtering Services for Tenant ID: ${tenantId} with:`, restFilters);

    let queryConstraints = []; // Define outside try
    try {
       queryConstraints.push(where("tenant_id", "==", tenantId)); // <<< Always filter by tenant
      
      if (restFilters.module) {
        queryConstraints.push(where("module", "==", restFilters.module));
      }
      if (restFilters.category) {
        queryConstraints.push(where("category", "==", restFilters.category));
      }
      // Use hasOwnProperty check for boolean filter
      if (Object.prototype.hasOwnProperty.call(restFilters, 'is_active')) { 
        queryConstraints.push(where("is_active", "==", restFilters.is_active));
      } else {
        // Default to only active services if not specified
        queryConstraints.push(where("is_active", "==", true));
      }
      
      queryConstraints.push(orderBy("name")); 

      const q = query(servicesCollection, ...queryConstraints);

      const querySnapshot = await getDocs(q);
      const services = querySnapshot.docs.map(docSnap => ({
        id: docSnap.id,
        ...docSnap.data(),
      }));
      console.log(`[serviceService.list] Found ${services.length} services for Tenant ${tenantId}.`);
      return services;
    } catch (error) {
      console.error(`[serviceService.list] Error fetching services for Tenant ${tenantId}:`, error);
      if (error.code === 'permission-denied') {
           console.error("PERMISSION DENIED: Check Firestore rules for reading services.");
           throw new Error('Permissão negada para acessar os serviços. Verifique as regras.');
      }
      if (error.code === 'failed-precondition') {
           console.error("FAILED PRECONDITION: Missing Firestore index for services query?");
           console.error("Filters applied:", queryConstraints.map(c => JSON.stringify(c)));
           throw new Error('Erro de configuração do Firestore (índice ausente?). Verifique o console.');
       }
      throw error;
    }
  },

  /**
   * Gets a specific service by its ID, verifying tenant ownership.
   * @param {string} serviceId - The ID of the service to fetch.
   * @returns {Promise<object|null>} - The service object or null if not found/not owned.
   */
  get: async (serviceId) => {
    const tenantId = localStorage.getItem('current_tenant');
    if (!tenantId) {
      console.error('[serviceService.get] Tenant ID not found in localStorage.');
      throw new Error('Tenant não identificado. Faça login novamente.');
    }
    if (!serviceId) {
      console.error("[serviceService.get] Service ID is required.");
      return null;
    }
    try {
      console.log(`[serviceService.get] Fetching service ID: ${serviceId} for Tenant ID: ${tenantId}`);
      const docRef = doc(db, "services", serviceId);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data();
        // <<< Verify tenant ownership >>>
        if (data.tenant_id !== tenantId) {
             console.warn(`[serviceService.get] Access Denied. Service ${serviceId} belongs to tenant ${data.tenant_id}.`);
             return null; // Not found for this tenant
        }
        const serviceData = { id: docSnap.id, ...data };
        console.log(`[serviceService.get] Service found for Tenant ${tenantId}:`, serviceData);
        return serviceData;
      } else {
        console.warn(`[serviceService.get] Service with ID ${serviceId} not found.`);
        return null;
      }
    } catch (error) {
      console.error(`[serviceService.get] Error fetching service ${serviceId} for Tenant ${tenantId}:`, error);
      throw error;
    }
  },

  /**
   * Creates a new service for the current tenant.
   * @param {object} serviceData - Data for the new service (module and name required). tenant_id is ignored.
   * @returns {Promise<object>} - The created service object with its ID.
   */
  create: async (serviceData) => {
     const tenantId = localStorage.getItem('current_tenant');
     if (!tenantId) {
       console.error('[serviceService.create] Tenant ID not found in localStorage.');
       throw new Error('Tenant não identificado. Faça login novamente.');
     }
     const { tenant_id, name, module, ...restData } = serviceData;
     if (tenant_id) {
        console.warn("[serviceService.create] tenant_id ignored. Using tenant from localStorage.");
     }
    if (!name || !module) {
         throw new Error("Name and module are required to create a service.");
    }
    console.log(`[serviceService.create] Creating service for Tenant ${tenantId} with:`, { name, module, ...restData });
    try {
        const dataToSave = {
            ...restData,
            name, // Ensure name is included
            module, // Ensure module is included
            tenant_id: tenantId, // <<< Set tenant ID
            is_active: restData.is_active !== undefined ? restData.is_active : true,
            created_at: serverTimestamp(),
            updated_at: serverTimestamp()
        };
      const docRef = await addDoc(servicesCollection, dataToSave);
      console.log(`[serviceService.create] Service created with ID: ${docRef.id} for Tenant ${tenantId}`);
      // Return the newly created object with ID
      const createdService = await this.get(docRef.id); // Use get to ensure consistency
      return createdService;
    } catch (error) {
      console.error(`[serviceService.create] Error creating service for Tenant ${tenantId}:`, error);
      if (error.code === 'permission-denied') {
           console.error("PERMISSION DENIED: Check Firestore rules for creating services.");
      }
      throw error;
    }
  },
  
  /**
   * Updates an existing service, verifying tenant ownership.
   * @param {string} serviceId - The ID of the service to update.
   * @param {object} updateData - Fields to update. tenant_id is ignored.
   * @returns {Promise<void>} // Or return updated object?
   */
  update: async (serviceId, updateData) => {
     const tenantId = localStorage.getItem('current_tenant');
     if (!tenantId) {
       console.error('[serviceService.update] Tenant ID not found in localStorage.');
       throw new Error('Tenant não identificado. Faça login novamente.');
     }
     console.log(`[serviceService.update] Updating service ${serviceId} for Tenant ${tenantId} with:`, updateData);
     if (!serviceId || !updateData) {
        throw new Error("Service ID and update data are required.");
     }
     
     // Prevent changing tenant_id
     const { tenant_id, ...restUpdateData } = updateData;
     if (tenant_id) {
         console.warn("[serviceService.update] Attempted to change tenant_id. Ignoring.");
     }
     
     try {
         const docRef = doc(db, "services", serviceId);
         
         // <<< Verify tenant ownership BEFORE updating >>>
         const docSnap = await getDoc(docRef);
         if (!docSnap.exists()) {
             throw new Error('Service not found.');
         }
         const existingData = docSnap.data();
         if (existingData.tenant_id !== tenantId) {
             console.error(`[serviceService.update] Access Denied: Tenant ${tenantId} cannot update service ${serviceId}.`);
             throw new Error('Permissão negada para atualizar este serviço.');
         }
        // <<< END Verification >>>
         
        const dataToUpdate = {
            ...restUpdateData,
            updated_at: serverTimestamp()
        };
        await updateDoc(docRef, dataToUpdate);
        console.log(`[serviceService.update] Service ${serviceId} updated successfully by Tenant ${tenantId}.`);
        // Return updated? await this.get(serviceId);
     } catch(error) {
        console.error(`[serviceService.update] Error updating service ${serviceId} for Tenant ${tenantId}:`, error);
        if (error.message.includes('Permissão negada') || error.message.includes('not found')) {
           throw error; // Re-throw specific errors
       }
        if (error.code === 'permission-denied') {
            console.error("PERMISSION DENIED: Check Firestore rules for updating services.");
        }
        throw error;
     }
  },
  
   /**
   * Deactivates a service (sets is_active to false), verifying ownership.
   * @param {string} serviceId - The ID of the service to deactivate.
   * @returns {Promise<void>}
   */
  deactivate: async (serviceId) => {
     // Verification will happen inside update
     console.log(`[serviceService.deactivate] Deactivating service ${serviceId}`);
     return serviceService.update(serviceId, { is_active: false });
  },
  
   /**
   * Reactivates a service (sets is_active to true), verifying ownership.
   * @param {string} serviceId - The ID of the service to reactivate.
   * @returns {Promise<void>}
   */
  reactivate: async (serviceId) => {
     // Verification will happen inside update
     console.log(`[serviceService.reactivate] Reactivating service ${serviceId}`);
     return serviceService.update(serviceId, { is_active: true });
  }
  
  // delete: async (serviceId) => { ... } // Implement hard delete + tenant verification if needed
};