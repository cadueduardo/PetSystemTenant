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
  Timestamp // Import Timestamp for date comparisons
} from "firebase/firestore";

const appointmentsCollection = collection(db, "appointments");

export const appointmentService = {
  /**
   * Filters appointments based on provided criteria.
   * Supports filtering by tenant_id and a date range.
   * @param {object} filters - Filtering criteria (e.g., { tenant_id: '...', date: { $gte: '...', $lte: '...' } })
   * @returns {Promise<Array<object>>} - Array of appointment objects
   */
  filter: async (filters = {}) => {
    try {
      let q = query(appointmentsCollection);
      const conditions = [];

      // Filter by tenant_id (required)
      if (filters.tenant_id) {
        conditions.push(where("tenant_id", "==", filters.tenant_id));
      } else {
        // It's generally a good idea to require tenant_id for security/scoping
        console.warn('[appointmentService.filter] Filtering appointments without tenant_id.');
        // Depending on your rules, you might want to throw an error or return empty
        // throw new Error("Tenant ID is required to filter appointments.");
      }

      // Filter by date range
      if (filters.date && typeof filters.date === 'object') {
        if (filters.date.$gte) {
          try {
             // Convert ISO string to Firebase Timestamp
            conditions.push(where("date", ">=", Timestamp.fromDate(new Date(filters.date.$gte))));
          } catch (e) { console.error('Invalid $gte date format:', filters.date.$gte, e); }
        }
        if (filters.date.$lte) {
          try {
             // Convert ISO string to Firebase Timestamp
            conditions.push(where("date", "<=", Timestamp.fromDate(new Date(filters.date.$lte))));
          } catch (e) { console.error('Invalid $lte date format:', filters.date.$lte, e); }
        }
      }
      
      // Add other simple equality filters if needed (add them to the function signature comment too)
      // Example: Filter by status
      if (filters.status) {
          conditions.push(where("status", "==", filters.status));
      }
      // Example: Filter by pet_id
      if (filters.pet_id) {
          conditions.push(where("pet_id", "==", filters.pet_id));
      }
      // ... add more simple filters as needed

      if (conditions.length > 0) {
        q = query(appointmentsCollection, ...conditions);
      } else {
        // If no specific filters (other than maybe tenant), fetch all (respecting security rules)
        q = query(appointmentsCollection); 
      }

      console.log(`[appointmentService.filter] Executing query with conditions:`, conditions.map(c => c._op + c._field + c._value)); // Basic logging

      const querySnapshot = await getDocs(q);
      const appointments = querySnapshot.docs.map(docSnap => ({
        id: docSnap.id,
        ...docSnap.data(),
        // Convert Firestore Timestamps back to ISO strings or Date objects if needed by the frontend
        // Example: Convert 'date' field if it's a Timestamp
        date: docSnap.data().date?.toDate ? docSnap.data().date.toDate().toISOString() : docSnap.data().date,
        start_time: docSnap.data().start_time?.toDate ? docSnap.data().start_time.toDate().toISOString() : docSnap.data().start_time,
        end_time: docSnap.data().end_time?.toDate ? docSnap.data().end_time.toDate().toISOString() : docSnap.data().end_time,
      }));
      console.log(`[appointmentService.filter] Found ${appointments.length} appointments.`);
      return appointments;
    } catch (error) {
      console.error("[appointmentService.filter] Error fetching appointments:", error);
      throw error; // Re-throw the error to be handled by the caller
    }
  },

  /**
   * Gets a single appointment by its ID.
   * @param {string} id - The ID of the appointment.
   * @returns {Promise<object|null>} - The appointment object or null if not found.
   */
  get: async (id) => {
    try {
      const docRef = doc(db, "appointments", id);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        console.log(`[appointmentService.get] Found appointment with ID: ${id}`);
        const data = docSnap.data();
        return {
            id: docSnap.id,
            ...data,
             // Convert Timestamps back
            date: data.date?.toDate ? data.date.toDate().toISOString() : data.date,
            start_time: data.start_time?.toDate ? data.start_time.toDate().toISOString() : data.start_time,
            end_time: data.end_time?.toDate ? data.end_time.toDate().toISOString() : data.end_time,
        };
      } else {
        console.warn(`[appointmentService.get] Appointment with ID ${id} not found.`);
        return null; // Or throw new Error('Appointment not found');
      }
    } catch (error) {
      console.error(`[appointmentService.get] Error fetching appointment ${id}:`, error);
      throw error;
    }
  },

  /**
   * Creates a new appointment.
   * @param {object} appointmentData - Data for the new appointment.
   * @returns {Promise<object>} - The created appointment object with its ID.
   */
  create: async (appointmentData) => {
    try {
        // Convert date strings to Timestamps before saving
        const dataToSave = {
            ...appointmentData,
            date: appointmentData.date ? Timestamp.fromDate(new Date(appointmentData.date)) : null,
            start_time: appointmentData.start_time ? Timestamp.fromDate(new Date(appointmentData.start_time)) : null,
            end_time: appointmentData.end_time ? Timestamp.fromDate(new Date(appointmentData.end_time)) : null,
            created_at: Timestamp.now(), // Add creation timestamp
            updated_at: Timestamp.now()  // Add update timestamp
        };
      const docRef = await addDoc(appointmentsCollection, dataToSave);
      console.log(`[appointmentService.create] Appointment created with ID: ${docRef.id}`);
      return { id: docRef.id, ...appointmentData }; // Return original data + ID for simplicity
    } catch (error) {
      console.error("[appointmentService.create] Error creating appointment:", error);
      throw error;
    }
  },

  /**
   * Updates an existing appointment.
   * @param {string} id - The ID of the appointment to update.
   * @param {object} appointmentData - Data to update.
   * @returns {Promise<void>}
   */
  update: async (id, appointmentData) => {
    try {
      const docRef = doc(db, "appointments", id);
       // Convert date strings to Timestamps before saving
      const dataToUpdate = {
          ...appointmentData,
          updated_at: Timestamp.now() // Update the update timestamp
      };
       // Handle potential date updates specifically
      if (appointmentData.date !== undefined) {
          dataToUpdate.date = appointmentData.date ? Timestamp.fromDate(new Date(appointmentData.date)) : null;
      }
      if (appointmentData.start_time !== undefined) {
           dataToUpdate.start_time = appointmentData.start_time ? Timestamp.fromDate(new Date(appointmentData.start_time)) : null;
      }
       if (appointmentData.end_time !== undefined) {
           dataToUpdate.end_time = appointmentData.end_time ? Timestamp.fromDate(new Date(appointmentData.end_time)) : null;
       }
       // Remove id if it exists in the update data, as it shouldn't be updated
       delete dataToUpdate.id; 
       delete dataToUpdate.created_at; // Don't allow updating created_at
       
      await updateDoc(docRef, dataToUpdate);
      console.log(`[appointmentService.update] Appointment updated with ID: ${id}`);
    } catch (error) {
      console.error(`[appointmentService.update] Error updating appointment ${id}:`, error);
      throw error;
    }
  },

  /**
   * Deletes an appointment.
   * @param {string} id - The ID of the appointment to delete.
   * @returns {Promise<void>}
   */
  delete: async (id) => {
    try {
      const docRef = doc(db, "appointments", id);
      await deleteDoc(docRef);
      console.log(`[appointmentService.delete] Appointment deleted with ID: ${id}`);
    } catch (error) {
      console.error(`[appointmentService.delete] Error deleting appointment ${id}:`, error);
      throw error;
    }
  },
}; 