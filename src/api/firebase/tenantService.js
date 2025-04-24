import { db } from '@/lib/firebaseConfig';
import {
  collection,
  query,
  where,
  getDocs,
  limit,
  doc,
  getDoc
} from "firebase/firestore";

const tenantsCollection = collection(db, "tenants");

export const tenantService = {

  /**
   * Filters tenants based on criteria. 
   * Primarily used to find a tenant by access_url.
   * @param {object} filters - Filtering criteria (e.g., { access_url: 'subdomain' })
   * @returns {Promise<Array<object>>} - Array containing the matching tenant object(s).
   */
  filter: async (filters = {}) => {
    const conditions = [];
    console.log(`[tenantService.filter] Filtering tenants with:`, filters);

    if (filters.access_url) {
      conditions.push(where("access_url", "==", filters.access_url));
    }
    if (filters.status) {
        conditions.push(where("status", "==", filters.status));
    }
    // Add other filters if needed in the future

    // Limit to 1 if filtering by access_url as it should be unique
    if (filters.access_url) {
        conditions.push(limit(1));
    }

    try {
      const q = query(tenantsCollection, ...conditions);
      const querySnapshot = await getDocs(q);
      const tenants = querySnapshot.docs.map(docSnap => ({
        id: docSnap.id,
        ...docSnap.data(),
        created_at: docSnap.data().created_at?.toDate ? docSnap.data().created_at.toDate().toISOString() : docSnap.data().created_at,
        updated_at: docSnap.data().updated_at?.toDate ? docSnap.data().updated_at.toDate().toISOString() : docSnap.data().updated_at,
      }));
      console.log(`[tenantService.filter] Found ${tenants.length} tenants matching criteria.`);
      return tenants;
    } catch (error) {
      console.error("[tenantService.filter] Error fetching tenants:", error);
      throw error;
    }
  },

  /**
   * Gets a single tenant by its ID.
   * Typically used after login when the tenant ID is known.
   * @param {string} id - The ID of the tenant.
   * @returns {Promise<object|null>} - The tenant object or null if not found.
   */
  get: async (id) => {
    if (!id) {
        console.error("[tenantService.get] Error: Tenant ID is required.");
        return null;
    }
    console.log(`[tenantService.get] Getting tenant ID: ${id}`);

    try {
      const docRef = doc(db, "tenants", id);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data();
        console.log(`[tenantService.get] Found tenant ID: ${id}`);
        return {
            id: docSnap.id,
            ...data,
            created_at: data.created_at?.toDate ? data.created_at.toDate().toISOString() : data.created_at,
            updated_at: data.updated_at?.toDate ? data.updated_at.toDate().toISOString() : data.updated_at,
        };
      } else {
        console.warn(`[tenantService.get] Tenant with ID ${id} not found.`);
        return null; 
      }
    } catch (error) {
      console.error(`[tenantService.get] Error fetching tenant ${id}:`, error);
      throw error;
    }
  },

  // Note: Update and Create functions are likely handled by Admin or Cloud Functions.
  // Add update here only if tenants need to update specific fields themselves.
  /*
  update: async (id, data) => {
    // ... implementation with security checks ...
  }
  */
}; 