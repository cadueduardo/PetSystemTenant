import { createContext, useContext, useState, useEffect, useMemo } from 'react';
import PropTypes from 'prop-types';
import { getFirestore, collection, query, where, getDocs, limit, doc, getDoc } from 'firebase/firestore';
import { useAuth } from '@/context/AuthContext';

// Criar contexto do tenant
const TenantContext = createContext(null);

// Componente Provider
export function TenantProvider({ children }) {
  const [currentTenant, setCurrentTenant] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const db = getFirestore();
  const auth = useAuth();

  useEffect(() => {
    const loadTenantBasedOnAuth = async () => {
      if (auth.loadingAuth) {
        console.log('[TenantProvider] Waiting for AuthProvider to finish loading...');
        setIsLoading(true);
        setCurrentTenant(null);
        setError(null);
        return;
      }

      const user = auth.currentUser;
      setIsLoading(true);
      setError(null);
      setCurrentTenant(null);
      console.log('[TenantProvider] AuthProvider finished. Current user:', user ? user.uid : 'null');

      let tenantIdToLoad = null;
      let loadSource = null;

      if (user) {
        console.log('[TenantProvider] User found. Forcing token refresh to get claims...');
        try {
          const idTokenResult = await user.getIdTokenResult(true);
          const claims = idTokenResult.claims;
          console.log('[TenantProvider] Claims fetched inside TenantProvider:', claims);

          if (claims && claims.tenant_id) {
            tenantIdToLoad = claims.tenant_id;
            loadSource = 'claims';
            console.log(`[TenantProvider] Found tenant_id in fetched claims: ${tenantIdToLoad}`);
          } else {
            console.error('[TenantProvider] User logged in, claims fetched BUT tenant_id is missing.');
            setError('Usuário logado, mas não associado a uma loja corretamente.');
          }
        } catch (tokenError) {
          console.error('[TenantProvider] Error forcing token refresh:', tokenError);
          setError('Erro ao verificar permissões do usuário.');
        }
      } else {
        const urlParams = new URLSearchParams(window.location.search);
        const storeParam = urlParams.get('store');
        if (storeParam) {
          console.log(`[TenantProvider] No user logged in. Searching tenant by access_url from URL: ${storeParam}`);
          try {
            const tenantsCol = collection(db, 'tenants');
            const q = query(tenantsCol, where("access_url", "==", storeParam), where("status", "==", "active"), limit(1));
            const querySnapshot = await getDocs(q);
            if (!querySnapshot.empty) {
              tenantIdToLoad = querySnapshot.docs[0].id;
              loadSource = 'url';
              console.log(`[TenantProvider] Found tenant ID ${tenantIdToLoad} matching access_url ${storeParam}`);
            } else {
              console.warn(`[TenantProvider] Active tenant not found for access_url: ${storeParam}`);
              setError(`Tenant não encontrado ou inativo: ${storeParam}`);
            }
          } catch (queryError) {
            console.error('[TenantProvider] Error querying tenant by access_url:', queryError);
            setError('Erro ao buscar informações da loja pela URL.');
          }
        } else {
          console.log('[TenantProvider] No user logged in and no store parameter.');
        }
      }

      if (tenantIdToLoad) {
        console.log(`[TenantProvider] Attempting to load tenant data for ID: ${tenantIdToLoad} (Source: ${loadSource})`);
        try {
          const tenantRef = doc(db, 'tenants', tenantIdToLoad);
          const docSnap = await getDoc(tenantRef);

          if (docSnap.exists() && docSnap.data().status === 'active') {
            const tenantData = docSnap.data();
            setCurrentTenant({ id: docSnap.id, ...tenantData });
            console.log(`[TenantProvider] Successfully loaded tenant: ${tenantData.name} (ID: ${docSnap.id})`);
            localStorage.setItem('current_tenant', docSnap.id);
            localStorage.setItem('tenant_name', tenantData.name);
          } else {
            console.error(`[TenantProvider] Tenant document not found or inactive for ID: ${tenantIdToLoad}`);
            setError(`Tenant não encontrado ou inativo: ${tenantIdToLoad}`);
            setCurrentTenant(null);
            localStorage.removeItem('current_tenant');
            localStorage.removeItem('tenant_name');
          }
        } catch (fetchError) {
          console.error(`[TenantProvider] Error fetching tenant document (ID: ${tenantIdToLoad}):`, fetchError);
          setError('Erro ao carregar dados da loja.');
          setCurrentTenant(null);
        }
      } else if (!error) {
        console.log('[TenantProvider] No tenant ID determined to load.');
      }

      setIsLoading(false);
      console.log('[TenantProvider] Finished tenant load attempt.');
    };

    loadTenantBasedOnAuth();
  }, [db, auth.loadingAuth, auth.currentUser]);

  const value = useMemo(() => ({
    currentTenant,
    isLoading,
    error,
    setCurrentTenant
  }), [currentTenant, isLoading, error]);

  // Log para verificar o valor exato sendo passado ao Provider
  console.log("[TenantProvider Value Check] Value being provided:", { tenant: value.currentTenant?.id, isLoading: value.isLoading, error: value.error });

  return (
    <TenantContext.Provider value={value}>
      {children}
    </TenantContext.Provider>
  );
}

TenantProvider.propTypes = {
  children: PropTypes.node.isRequired
};

export function useTenant() {
  const context = useContext(TenantContext);
  if (!context) {
    throw new Error('useTenant must be used within a TenantProvider');
  }
  return context;
}