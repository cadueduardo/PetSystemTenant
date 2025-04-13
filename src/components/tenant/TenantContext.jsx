import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { getFirestore, collection, query, where, getDocs, limit } from 'firebase/firestore'; // Import firestore functions

// Criar contexto do tenant
const TenantContext = createContext(null);

// Componente Provider
export function TenantProvider({ children }) {
  const [currentTenant, setCurrentTenant] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const location = useLocation();
  const db = getFirestore(); // Get Firestore instance

  useEffect(() => {
    const loadTenant = async () => {
      try {
        setIsLoading(true);
        setError(null);
        setCurrentTenant(null); // Reset tenant on load

        const urlParams = new URLSearchParams(window.location.search);
        const storeParam = urlParams.get('store');
        let foundTenantData = null;
        let foundTenantId = null;

        const tenantsCol = collection(db, 'tenants');

        if (storeParam) {
          console.log(`TenantContext: Searching tenant by access_url: ${storeParam}`);
          const q = query(tenantsCol, where("access_url", "==", storeParam), where("status", "==", "active"), limit(1));
          const querySnapshot = await getDocs(q);
          if (!querySnapshot.empty) {
            const docSnap = querySnapshot.docs[0];
            foundTenantId = docSnap.id;
            foundTenantData = docSnap.data();
            console.log(`TenantContext - Tenant loaded from URL: ${storeParam}`, { id: foundTenantId, ...foundTenantData });
          } else {
            console.error(`TenantContext: Active tenant not found for access_url: ${storeParam}`);
            setError(`Tenant não encontrado ou inativo: ${storeParam}`);
          }
        } else {
          // Se não houver storeParam, NÃO tentamos buscar um tenant ativo genérico
          // O tenant deve ser definido pelo login ou pelo acesso via Super Admin
          // Se precisar carregar o tenant do usuário logado aqui, precisaria importar getAuth, onAuthStateChanged, getIdTokenResult
          console.log("TenantContext: No store parameter in URL. Tenant will be set by login/claims.");
          // Poderíamos tentar pegar o tenantId dos claims se o usuário JÁ ESTIVER logado?
          // Isso complica o fluxo, melhor deixar o ProtectedRoute/Login cuidarem disso.
        }

        if (foundTenantId && foundTenantData) {
            setCurrentTenant({ id: foundTenantId, ...foundTenantData });
        }

      } catch (err) {
        console.error('TenantContext: Error loading tenant:', err);
        setError('Não foi possível carregar os dados do tenant.');
      } finally {
        setIsLoading(false);
      }
    };

    loadTenant();
    // Re-executar se o search param (ex: ?store=...) mudar
  }, [location.search, db]); 

  // Envolver setTenantFromAuth com useCallback
  const setTenantFromAuth = useCallback((tenantDataWithId) => {
    console.log("TenantContext: Setting tenant from Auth/Claims", tenantDataWithId);
    setCurrentTenant(tenantDataWithId);
    setIsLoading(false); // Marca como carregado
    setError(null);
  }, []); // Array de dependências vazio, pois não depende de nada externo a esta função

  // O valor do contexto agora inclui a função memoizada
  const contextValue = useMemo(() => ({ 
    currentTenant, 
    tenantId: currentTenant?.id, // Adiciona tenantId diretamente para conveniência
    isLoading, 
    error,
    setTenantFromAuth // Exporta a função para setar o tenant
  }), [currentTenant, isLoading, error, setTenantFromAuth]); // Dependências do useMemo

  return (
    <TenantContext.Provider value={contextValue}>
      {children}
    </TenantContext.Provider>
  );
}

// Hook personalizado para usar o contexto
export function useTenant() {
  const context = useContext(TenantContext);
  if (!context) {
    throw new Error("useTenant deve ser usado dentro de um TenantProvider");
  }
  return context;
}