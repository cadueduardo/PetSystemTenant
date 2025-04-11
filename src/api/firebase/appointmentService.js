import { db } from '../../lib/firebaseConfig'; // Correct path to firebaseConfig
import { 
  collection, 
  getDocs, 
  getDoc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  query, 
  where, 
  Timestamp, // Import Timestamp for date comparisons
  serverTimestamp // <<< Import serverTimestamp
} from "firebase/firestore";
// <<< Import other services for validation >>>
import { customerService } from './customerService'; 
import { petService } from './petService';

const appointmentsCollection = collection(db, "appointments");

// Helper function to convert Firestore Timestamps to ISO strings
const convertTimestampsToISO = (data) => {
  const converted = { ...data };
  for (const key in converted) {
    if (converted[key] instanceof Timestamp) {
      converted[key] = converted[key].toDate().toISOString();
    }
  }
  return converted;
};

// Helper function to convert potential date/time strings or Date objects to Timestamps
const convertInputDatesToTimestamps = (data) => {
    const converted = { ...data };
    const dateFields = ['date', 'start_time', 'end_time', 'created_at', 'updated_at', 'inactivation_date']; // Add other relevant date fields
    for (const key of dateFields) {
        if (converted[key]) {
            try {
                // Attempt conversion only if it's not already a Timestamp
                if (!(converted[key] instanceof Timestamp)) {
                    const dateObj = new Date(converted[key]);
                    // Check if the date is valid before converting
                    if (!isNaN(dateObj.getTime())) {
                       converted[key] = Timestamp.fromDate(dateObj);
                    } else {
                        console.warn(`[appointmentService] Invalid date format for field ${key}:`, converted[key]);
                        // Keep original invalid value or set to null? Setting to null might be safer.
                        converted[key] = null; 
                    }
                }
            } catch (e) {
                 console.warn(`[appointmentService] Could not convert field ${key} to Timestamp:`, converted[key], e);
                 converted[key] = null; // Set to null on error
            }
        } else if (Object.prototype.hasOwnProperty.call(converted, key)) { 
             // Ensure fields explicitly set to null/undefined are handled correctly (e.g., remove end_time)
             converted[key] = null; 
        }
    }
    return converted;
};

export const appointmentService = {
  /**
   * Filters appointments for the current tenant based on provided criteria.
   * Supports filtering by a date range, status, pet_id.
   * @param {object} filters - Filtering criteria (e.g., { date: { $gte: '...', $lte: '...' }, status: '...', pet_id: '...' })
   * @returns {Promise<Array<object>>} - Array of appointment objects with ISO date strings.
   */
  filter: async (filters = {}) => {
    const tenantId = localStorage.getItem('current_tenant');
    let conditions = []; // Define conditions outside try block
    if (!tenantId) {
      console.error("[appointmentService.filter] Error: Tenant ID not found in localStorage.");
      throw new Error('Tenant não identificado. Faça login novamente.');
    }
    console.log(`[appointmentService.filter] Filtering appointments for Tenant ID: ${tenantId} with filters:`, filters);

    try {
      conditions.push(where("tenant_id", "==", tenantId)); // <<< Always filter by tenant_id

      // Filter by date range (using Timestamps for comparison)
      if (filters.date && typeof filters.date === 'object') {
          const dateFilter = convertInputDatesToTimestamps({ date_gte: filters.date.$gte, date_lte: filters.date.$lte });
          if (dateFilter.date_gte instanceof Timestamp) {
             conditions.push(where("date", ">=", dateFilter.date_gte));
          }
          if (dateFilter.date_lte instanceof Timestamp) {
             conditions.push(where("date", "<=", dateFilter.date_lte));
          }
      }
      
      // Add other simple equality filters
      if (filters.status) {
          conditions.push(where("status", "==", filters.status));
      }
      if (filters.pet_id) {
          conditions.push(where("pet_id", "==", filters.pet_id));
      }
      // ... add more filters as needed

      const q = query(appointmentsCollection, ...conditions);

      console.log(`[appointmentService.filter] Executing query for Tenant ID: ${tenantId}`);

      const querySnapshot = await getDocs(q);
      const appointments = querySnapshot.docs.map(docSnap => {
         const data = docSnap.data();
         // <<< Log raw date value from Firestore >>>
         console.log(`[appointmentService.filter] Raw data.date for doc ${docSnap.id}:`, data.date);
         // Convert Timestamps to ISO Strings for frontend
         return convertTimestampsToISO({ id: docSnap.id, ...data });
      });

      console.log(`[appointmentService.filter] Found ${appointments.length} appointments for Tenant ID: ${tenantId}.`);
      return appointments;
    } catch (error) {
      console.error(`[appointmentService.filter] Error fetching appointments for Tenant ID ${tenantId}:`, error);
       if (error.code === 'failed-precondition') {
           console.error("*************************************************************************");
           console.error("ERRO FIREBASE: Provavelmente falta um ÍNDICE COMPOSTO no Firestore!");
           console.error("Verifique as Regras de Segurança e os Índices no console do Firebase.");
           console.error("Filtros aplicados:", conditions.map(c => JSON.stringify(c))); // Log filters better
           console.error("*************************************************************************");
           throw new Error('Erro de configuração do Firestore (índice composto ausente?). Verifique o console.');
       }
      throw error; // Re-throw the error
    }
  },

  /**
   * Gets a single appointment by its ID, verifying tenant ownership.
   * @param {string} id - The ID of the appointment.
   * @returns {Promise<object|null>} - The appointment object with ISO date strings, or null if not found or not owned by tenant.
   */
  get: async (id) => {
    const tenantId = localStorage.getItem('current_tenant');
    if (!tenantId) {
      console.error("[appointmentService.get] Error: Tenant ID not found in localStorage.");
      throw new Error('Tenant não identificado. Faça login novamente.');
    }
    console.log(`[appointmentService.get] Getting appointment ID: ${id} for Tenant ID: ${tenantId}`);

    try {
      const docRef = doc(db, "appointments", id);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data();
        
        // <<< Verify Tenant Ownership >>>
        if (data.tenant_id !== tenantId) {
            console.warn(`[appointmentService.get] Access denied. Appointment ${id} belongs to tenant ${data.tenant_id}, not ${tenantId}.`);
            return null; // Return null as if not found for this tenant
        }

        console.log(`[appointmentService.get] Found appointment ID: ${id} for Tenant ID: ${tenantId}`);
        // <<< Convert Timestamps to ISO Strings >>>
        return convertTimestampsToISO({ id: docSnap.id, ...data });
      } else {
        console.warn(`[appointmentService.get] Appointment with ID ${id} not found.`);
        return null; 
      }
    } catch (error) {
      console.error(`[appointmentService.get] Error fetching appointment ${id} for Tenant ID ${tenantId}:`, error);
      throw error;
    }
  },

  /**
   * Creates a new appointment for the current tenant.
   * @param {object} appointmentData - Data for the new appointment (must include pet_id, customer_id, date, start_time). tenant_id is ignored.
   * @returns {Promise<object>} - The created appointment object with its ID and ISO date strings.
   */
  create: async (appointmentData) => {
    const tenantId = localStorage.getItem('current_tenant');
    if (!tenantId) {
      console.error("[appointmentService.create] Error: Tenant ID not found in localStorage.");
      throw new Error('Tenant não identificado. Faça login novamente.');
    }
    console.log(`[appointmentService.create] Creating appointment for Tenant ID: ${tenantId} with data:`, appointmentData);

    try {
        // <<< Destructure data, date is the combined start time >>>
        const { tenant_id, pet_id, customer_id, date, ...restData } = appointmentData;

        // <<< Basic Validation (removed start_time check) >>>
        if (!pet_id || !customer_id || !date) {
             console.error('[appointmentService.create] Missing required fields (pet_id, customer_id, date)', appointmentData);
             throw new Error('Dados insuficientes para criar o agendamento.');
        }
        if (tenant_id) {
            console.warn("[appointmentService.create] tenant_id in input data ignored. Using current tenant ID.");
        }

        // <<< CRUCIAL VALIDATION: Check if customer and pet belong to the tenant >>>
        const customer = await customerService.get(customer_id); // Assumes customerService.get checks tenant
        if (!customer) { // customerService.get returns null if not found OR not owned by tenant
             console.error(`[appointmentService.create] Error: Customer ${customer_id} not found or does not belong to tenant ${tenantId}.`);
             throw new Error(`Cliente com ID ${customer_id} não encontrado ou inválido para este tenant.`);
        }
        // No need to check customer.tenant_id === tenantId again if customerService.get does it.
        
        const pet = await petService.get(pet_id); // Assumes petService.get checks tenant
        if (!pet) { // petService.get returns null if not found OR not owned by tenant
             console.error(`[appointmentService.create] Error: Pet ${pet_id} not found or does not belong to tenant ${tenantId}.`);
             throw new Error(`Pet com ID ${pet_id} não encontrado ou inválido para este tenant.`);
        }
         // Double-check pet's owner matches the customer
        if (pet.owner_id !== customer_id) {
             console.error(`[appointmentService.create] Error: Pet ${pet_id} (owner: ${pet.owner_id}) does not belong to Customer ${customer_id}.`);
             throw new Error(`Pet ${pet.name} não pertence ao cliente ${customer.name}.`);
        }

        // <<< Prepare data with Timestamps and tenant_id >>>
        let dataToSave = {
            ...restData,
            pet_id,
            customer_id,
            tenant_id: tenantId, // <<< Set tenant ID
            date: date, // <<< CORRIGIDO: Incluir o campo 'date' original
            // Convert input dates just before saving
        };
        dataToSave = convertInputDatesToTimestamps(dataToSave); // Handles date conversion
        dataToSave.created_at = serverTimestamp(); // Use server timestamp for creation
        dataToSave.updated_at = serverTimestamp(); // Use server timestamp for update

        const docRef = await addDoc(appointmentsCollection, dataToSave);
        console.log(`[appointmentService.create] Appointment created with ID: ${docRef.id} for Tenant ID: ${tenantId}`);
        
        // Fetch the created doc to return data with server-resolved timestamps
        const createdDoc = await appointmentService.get(docRef.id); // <<< CORRIGIDO: Usar appointmentService.get em vez de this.get
        return createdDoc; // Return data with ISO strings

    } catch (error) {
      console.error(`[appointmentService.create] Error creating appointment for Tenant ID ${tenantId}:`, error);
      // Check for specific errors if needed (e.g., validation errors thrown above)
      if (error.message.includes('não encontrado ou inválido') || error.message.includes('não pertence ao cliente')) {
          throw error; // Re-throw validation errors
      }
      // Firestore permission errors might be caught by rules, but log anyway
      if (error.code === 'permission-denied') {
           console.error("PERMISSION DENIED: Check Firestore rules for creating appointments (tenant_id match, customer/pet ownership checks).");
      }
      throw new Error(`Erro ao criar agendamento: ${error.message}`);
    }
  },

  /**
   * Updates an existing appointment, verifying tenant ownership.
   * @param {string} id - The ID of the appointment to update.
   * @param {object} appointmentData - Data to update (tenant_id, pet_id, customer_id are ignored).
   * @returns {Promise<object>} - The updated appointment object with ISO date strings.
   */
  update: async (id, appointmentData) => {
     const tenantId = localStorage.getItem('current_tenant');
     if (!tenantId) {
       console.error("[appointmentService.update] Error: Tenant ID not found in localStorage.");
       throw new Error('Tenant não identificado. Faça login novamente.');
     }
     console.log(`[appointmentService.update] Updating appointment ID: ${id} for Tenant ID: ${tenantId} with data:`, appointmentData);

    try {
      const docRef = doc(db, "appointments", id);

      // <<< Get existing data AND verify tenant ownership >>>
      const docSnap = await getDoc(docRef);
      if (!docSnap.exists()) {
          console.error(`[appointmentService.update] Error: Appointment ${id} not found.`);
          throw new Error('Agendamento não encontrado.');
      }
      const existingData = docSnap.data();
      if (existingData.tenant_id !== tenantId) {
           console.error(`[appointmentService.update] Access Denied: Tenant ${tenantId} cannot update appointment ${id} owned by ${existingData.tenant_id}.`);
           throw new Error('Permissão negada para atualizar este agendamento.');
      }

      // <<< Prepare update data, excluding forbidden fields and converting dates >>>
      const { tenant_id, pet_id, customer_id, created_at, id: inputId, ...restUpdateData } = appointmentData;
       if (tenant_id || pet_id || customer_id || created_at || inputId) {
            console.warn(`[appointmentService.update] Attempted to update restricted fields (tenant_id, pet_id, customer_id, created_at, id) for appointment ${id}. These fields were ignored.`);
       }
      
      let dataToUpdate = convertInputDatesToTimestamps(restUpdateData); // Convert date fields
      dataToUpdate.updated_at = serverTimestamp(); // Always update the timestamp

      await updateDoc(docRef, dataToUpdate);
      console.log(`[appointmentService.update] Appointment updated with ID: ${id} for Tenant ID: ${tenantId}`);
      
      // Fetch the updated doc to return fresh data
      const updatedDoc = await appointmentService.get(id); // <<< VERIFICADO: Já estava correto ou corrigido anteriormente
      return updatedDoc; // Return data with ISO strings

    } catch (error) {
      console.error(`[appointmentService.update] Error updating appointment ${id} for Tenant ID ${tenantId}:`, error);
       if (error.message.includes('Permissão negada') || error.message.includes('Agendamento não encontrado')) {
          throw error; // Re-throw specific errors
      }
       if (error.code === 'permission-denied') {
           console.error("PERMISSION DENIED: Check Firestore rules for updating appointments (tenant_id match).");
       }
      throw new Error(`Erro ao atualizar agendamento: ${error.message}`);
    }
  },

  /**
   * Deletes an appointment, verifying tenant ownership.
   * @param {string} id - The ID of the appointment to delete.
   * @returns {Promise<void>}
   */
  delete: async (id) => {
    const tenantId = localStorage.getItem('current_tenant');
    if (!tenantId) {
      console.error("[appointmentService.delete] Error: Tenant ID not found in localStorage.");
      throw new Error('Tenant não identificado. Faça login novamente.');
    }
    console.log(`[appointmentService.delete] Deleting appointment ID: ${id} for Tenant ID: ${tenantId}`);

    try {
      const docRef = doc(db, "appointments", id);

       // <<< Get existing data AND verify tenant ownership before deleting >>>
      const docSnap = await getDoc(docRef);
      if (!docSnap.exists()) {
          console.warn(`[appointmentService.delete] Appointment ${id} not found. Nothing to delete.`);
          return; // Or throw error depending on desired behavior
      }
      const existingData = docSnap.data();
      if (existingData.tenant_id !== tenantId) {
           console.error(`[appointmentService.delete] Access Denied: Tenant ${tenantId} cannot delete appointment ${id} owned by ${existingData.tenant_id}.`);
           throw new Error('Permissão negada para deletar este agendamento.');
      }

      await deleteDoc(docRef);
      console.log(`[appointmentService.delete] Appointment deleted with ID: ${id} for Tenant ID: ${tenantId}`);
    } catch (error) {
      console.error(`[appointmentService.delete] Error deleting appointment ${id} for Tenant ID ${tenantId}:`, error);
       if (error.message.includes('Permissão negada')) {
          throw error; // Re-throw specific errors
      }
       if (error.code === 'permission-denied') {
           console.error("PERMISSION DENIED: Check Firestore rules for deleting appointments (tenant_id match).");
       }
       throw new Error(`Erro ao deletar agendamento: ${error.message}`);
    }
  },
}; 