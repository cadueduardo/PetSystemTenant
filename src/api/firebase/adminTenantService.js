import { db } from '@/lib/firebaseConfig';
import {
  collection,
  getDocs,
  query,
  // orderBy // Removed as it's not currently used
  // Import other functions like getDoc, updateDoc, deleteDoc as needed
} from "firebase/firestore";

const tenantsCollection = collection(db, "tenants");

export const adminTenantService = {

  /**
   * Lists ALL tenants from the Firestore collection.
   * Accessible only via admin dashboard/functions.
   * @returns {Promise<Array<object>>} - Array of all tenant objects.
   */
  listAll: async () => {
    console.log('[adminTenantService.listAll] Fetching all tenants from Firestore...');
    try {
      // Optional: Add ordering - Temporarily removed for debugging
      // const q = query(tenantsCollection, orderBy("company_name", "asc"));
      const q = query(tenantsCollection); // Simple query without ordering

      const querySnapshot = await getDocs(q);
      const tenants = querySnapshot.docs.map(docSnap => ({
        id: docSnap.id,
        ...docSnap.data(),
        // Convert any Timestamps to strings/numbers if necessary for display
        created_at: docSnap.data().created_at?.toDate ? docSnap.data().created_at.toDate().toISOString() : docSnap.data().created_at,
        // Add other date conversions if needed
      }));
      console.log(`[adminTenantService.listAll] Found ${tenants.length} tenants.`);
      return tenants;
    } catch (error) {
      console.error("[adminTenantService.listAll] Error fetching all tenants:", error);
      // Depending on Firestore rules, this might fail if admin isn't properly authenticated/authorized
      if (error.code === 'permission-denied') {
           console.error("PERMISSION DENIED: Check Firestore rules for admin reading the tenants collection.");
           throw new Error('Permissão negada para listar tenants. Verifique as regras do Firestore para administradores.');
      }
      throw error; // Re-throw other errors
    }
  },

  // Add other admin-specific functions here later if needed:
  // get: async (tenantId) => { ... }
  // updateStatus: async (tenantId, status) => { ... }
  // hardDelete: async (tenantId) => { ... } // Be careful with hard deletes!

};