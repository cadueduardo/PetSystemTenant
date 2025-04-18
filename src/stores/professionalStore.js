import { create } from 'zustand';
import { getFirestore, collection, query, where, getDocs, /* doc, */ onSnapshot, documentId } from 'firebase/firestore';

// Helper function to fetch profile names (can be reused)
async function fetchProfileDetails(db, profileIds) {
    if (!profileIds || profileIds.length === 0) return {};
    
    const profilesMap = {};
    const profilesCollection = collection(db, 'perfis');
    // Firestore 'in' query limit is 30 as of v9+ web sdk
    const MAX_IDS_PER_QUERY = 30; 
    
    try {
        for (let i = 0; i < profileIds.length; i += MAX_IDS_PER_QUERY) {
            const batchIds = profileIds.slice(i, i + MAX_IDS_PER_QUERY);
            if (batchIds.length > 0) {
                 console.log('[professionalStore] Fetching profile batch:', batchIds);
                 const profilesQuery = query(profilesCollection, where(documentId(), 'in', batchIds));
                 const profilesSnapshot = await getDocs(profilesQuery);
                 profilesSnapshot.forEach(docSnap => {
                     profilesMap[docSnap.id] = docSnap.data()?.tipo || 'Desconhecido';
                 });
            }
        }
        console.log('[professionalStore] Profile details fetched:', profilesMap);
    } catch(error) {
        console.error("[professionalStore] Error fetching profile details:", error);
        // Return partial map or empty? Returning empty might be safer.
        return {}; 
    }
    return profilesMap;
}

let unsubscribeProfessionalListener = null; // Keep listener reference outside the store creator

const useProfessionalStore = create((set, get) => ({
  professionals: [],
  isLoading: true, // Start loading true until listener provides first data
  error: null,
  currentTenantId: null, // Track the tenantId the listener is attached to

  // Action to setup the real-time listener
  setupProfessionalListener: (tenantId) => {
    if (!tenantId) {
      console.warn('[professionalStore] setupListener called without tenantId. Clearing data.');
      get().clearProfessionalListener(); // Ensure cleanup
      set({ professionals: [], isLoading: false, error: 'Tenant ID não fornecido.', currentTenantId: null });
      return;
    }

    // If listener already exists for the same tenant, do nothing
    if (unsubscribeProfessionalListener && get().currentTenantId === tenantId) {
      console.log('[professionalStore] Listener already active for tenant:', tenantId);
      // Ensure loading is false if we already have data
      if (get().professionals.length > 0) set({ isLoading: false });
      return; 
    }

    // If listener exists for a different tenant, clear the old one first
    if (unsubscribeProfessionalListener) {
      console.log('[professionalStore] Cleaning up old listener for tenant:', get().currentTenantId);
      get().clearProfessionalListener();
    }

    console.log('[professionalStore] Setting up new listener for tenant:', tenantId);
    set({ isLoading: true, error: null, professionals: [], currentTenantId: tenantId }); // Set loading, clear errors/old data

    const db = getFirestore();
    const employeesQuery = query(
      collection(db, 'colaboradores'),
      where("tenantId", "==", tenantId),
      where("status", "==", "ativo") // Listen only to active employees
    );

    unsubscribeProfessionalListener = onSnapshot(employeesQuery, async (snapshot) => {
      console.log('[professionalStore] Snapshot received. Processing...');
      const collaboratorsData = snapshot.docs.map(doc => {
          // <<< REMOVE RAW DATA LOG >>>
          /*
          if (doc.id === 'YykUtBAs3XLdCu7n5kfh') { // Log specifically for Davi Eduardo
              console.log('[professionalStore] Raw snapshot data for Davi:', JSON.stringify(doc.data(), null, 2));
          }
          */
          // <<< END REMOVE >>>
          return { id: doc.id, ...doc.data() };
      });
      
      if (collaboratorsData.length === 0) {
         console.log('[professionalStore] Snapshot empty or no active collaborators found.');
         set({ professionals: [], isLoading: false }); 
         return;
      }

      const uniqueProfileIds = [...new Set(collaboratorsData.map(c => c.perfilId).filter(Boolean))];
      const profilesMap = await fetchProfileDetails(db, uniqueProfileIds);
      // <<< REMOVE PROFILE MAP LOG >>>
      // console.log('[professionalStore] Profiles map fetched:', profilesMap);
      // <<< END REMOVE >>>

      const professionalsWithTypes = collaboratorsData.map(collab => {
        const professionalEntry = {
            id: collab.id,
            title: collab.nome || `Profissional ${collab.id.substring(0, 4)}`,
            tipo: profilesMap[collab.perfilId] || 'Sem Perfil',
            specialties: collab.especialidades || []
        };
        // <<< REMOVE PROCESSED ENTRY LOG >>>
        /*
        if (collab.id === 'YykUtBAs3XLdCu7n5kfh') { // Log specifically for Davi Eduardo
             console.log('[professionalStore] Processed entry for Davi:', JSON.stringify(professionalEntry, null, 2));
        }
        */
        // <<< END REMOVE >>>
        return professionalEntry;
      });

      // <<< REMOVE FINAL STATE LOG >>>
      // console.log('[professionalStore] Final data being set to state:', JSON.stringify(professionalsWithTypes, null, 2));
      
      console.log('[professionalStore] Processed professionals from snapshot:', professionalsWithTypes);
      set({ professionals: professionalsWithTypes, isLoading: false, error: null }); 

    }, (err) => {
      console.error('[professionalStore] Listener error:', err);
      set({ isLoading: false, error: 'Erro ao ouvir atualizações de colaboradores.', professionals: [] });
      get().clearProfessionalListener(); // Stop listening on error
    });
    
    // Store the tenantId for which the listener is active
    // set({ currentTenantId: tenantId }); // Already set above
  },

  // Action to clear the listener
  clearProfessionalListener: () => {
    if (unsubscribeProfessionalListener) {
      console.log('[professionalStore] Unsubscribing professional listener.');
      unsubscribeProfessionalListener();
      unsubscribeProfessionalListener = null;
    }
    // Optionally reset state here too, or leave it as is until next setup?
    // set({ currentTenantId: null, isLoading: false }); // Keep isLoading false
  },

  // Reset action might need to clear listener too
  reset: () => {
      get().clearProfessionalListener();
      set({ professionals: [], isLoading: false, error: null, currentTenantId: null });
  },
}));

export default useProfessionalStore; 