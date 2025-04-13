import { db } from '@/lib/firebaseConfig';
import {
  collection,
  getDocs,
  query,
  doc,
  deleteDoc
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

  /**
   * Deletes a tenant document from Firestore.
   * Should only be callable by authorized Super Admins.
   * @param {string} tenantId - The ID of the tenant to delete.
   * @returns {Promise<void>}
   */
  delete: async (tenantId) => {
    if (!tenantId) {
      throw new Error("Tenant ID is required for deletion.");
    }
    console.log(`[adminTenantService.delete] Attempting to delete tenant ID: ${tenantId}`);
    try {
      const tenantDocRef = doc(db, "tenants", tenantId);
      await deleteDoc(tenantDocRef);
      console.log(`[adminTenantService.delete] Tenant ${tenantId} deleted successfully.`);
    } catch (error) {
      console.error(`[adminTenantService.delete] Error deleting tenant ${tenantId}:`, error);
      if (error.code === 'permission-denied') {
           console.error("PERMISSION DENIED: Check Firestore rules for admin deleting from the tenants collection.");
           throw new Error('Permissão negada para excluir tenant. Verifique as regras do Firestore para administradores.');
      }
      throw new Error(`Failed to delete tenant: ${error.message}`);
    }
  },

  // Add other admin-specific functions here later if needed:
  // get: async (tenantId) => { ... }
  // updateStatus: async (tenantId, status) => { ... }
  // hardDelete: async (tenantId) => { ... } // Be careful with hard deletes!

};