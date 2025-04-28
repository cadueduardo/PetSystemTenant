import { createContext, useContext, useState, useEffect, useMemo } from 'react';
import PropTypes from 'prop-types';
import { getFirestore, collection, query, where, getDocs, limit, doc, getDoc } from 'firebase/firestore';
import { useAuth } from '@/context/AuthContext';

const TenantContext = createContext(null);

export function TenantProvider({ children }) {
  const [currentTenant, setCurrentTenant] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const db = getFirestore();
  const auth = useAuth();
  const currentUserId = auth.currentUser?.uid; // Obter UID fora do useEffect

  useEffect(() => {
    const loadTenant = async () => {
      console.log(`[TenantProvider useEffect] Running. Auth Loading: ${auth.loadingAuth}, User UID: ${currentUserId}`);

      // Lógica principal envolvida em try...finally
      try {
        // --- Checagens Iniciais ---
        if (auth.loadingAuth) {
          console.log('[TenantProvider] Waiting for AuthProvider...');
          // Garante estado de loading enquanto auth carrega
          if (!isLoading) setIsLoading(true);
          // Sai cedo, o finally cuidará do isLoading se necessário, mas é melhor esperar a próxima execução do efeito
          return;
        }

        // --- Resetar Estado na Mudança de Usuário ---
        // Reseta apenas se o ID do usuário realmente difere do ID do usuário do tenant carregado
        if (currentTenant && currentTenant.userId !== currentUserId) {
            console.log(`[TenantProvider] User changed (${currentTenant.userId} -> ${currentUserId}). Resetting tenant state.`);
            setCurrentTenant(null);
            setError(null);
            // Precisa iniciar o processo de loading para o novo usuário
            if (!isLoading) setIsLoading(true);
        } else if (!currentTenant && currentUserId && isLoading) {
             // Trata carregamento inicial ou caso onde usuário loga quando tenant era null
             console.log(`[TenantProvider] Initial load or user logged in (${currentUserId}). Ensuring loading state.`);
             if (!isLoading) setIsLoading(true); // Já deveria ser true do useState ou passo anterior
             if (error) setError(null); // Limpa erro anterior
        } else if (!currentUserId && currentTenant) {
            // Usuário deslogou, reseta tenant
            console.log(`[TenantProvider] User logged out. Resetting tenant state.`);
            setCurrentTenant(null);
            setError(null);
             if (!isLoading) setIsLoading(true); // Indica mudança de estado de loading brevemente
        }


        // --- Verificar se Já Carregado ---
        // Se não estamos em estado de loading E o tenant para o usuário atual já está carregado, sair.
        if (!isLoading && currentTenant && currentTenant.userId === currentUserId) {
            console.log(`[TenantProvider] Tenant ${currentTenant.id} already loaded for user ${currentUserId}. No reload needed.`);
            return; // Já carregado e não está loading, nada a fazer.
        }

        // --- Iniciar Processo de Carregamento ---
        // Se chegamos aqui, precisamos determinar o tenant ou confirmar que não existe. Garante estado de loading.
         if (!isLoading) setIsLoading(true);
         // Limpa erro anterior antes de tentar carregar
         if (error) setError(null);


        const user = auth.currentUser; // Re-checa usuário caso estado tenha mudado sutilmente
        let tenantIdToLoad = null;
        // let loadSource = null; // Erro de Linter: Variável não usada, removida

        // --- Determinar ID do Tenant ---
        if (user) { // Usuário está logado
          console.log('[TenantProvider] User found. Getting claims...');
          try {
            const idTokenResult = await user.getIdTokenResult(true); // Forçar refresh é importante aqui
            const claims = idTokenResult.claims;
            console.log('[TenantProvider] Claims fetched:', claims);
            if (claims && claims.tenant_id) {
              tenantIdToLoad = claims.tenant_id;
              // loadSource = 'claims';
            } else {
              // Logado mas sem claim de tenant - estado de erro
              console.error('[TenantProvider] User logged in, but tenant_id missing in claims.');
              throw new Error('Usuário logado, mas não associado a uma loja corretamente.');
            }
          } catch (tokenError) {
            console.error('[TenantProvider] Error getting claims:', tokenError);
            setError(tokenError.message || 'Erro ao verificar permissões.');
            setCurrentTenant(null); // Garante que tenant é null no erro
            // Deixa o finally cuidar do isLoading
            return; // Para processamento se claims falharem
          }
        } else { // Nenhum usuário logado - checa URL
          const urlParams = new URLSearchParams(window.location.search);
          const storeParam = urlParams.get('store');
          if (storeParam) {
            console.log(`[TenantProvider] No user logged in. Searching tenant by access_url: ${storeParam}`);
            try {
              const tenantsCol = collection(db, 'tenants');
              const q = query(tenantsCol, where("access_url", "==", storeParam), where("status", "==", "active"), limit(1));
              const querySnapshot = await getDocs(q);
              if (!querySnapshot.empty) {
                tenantIdToLoad = querySnapshot.docs[0].id;
                // loadSource = 'url';
                console.log(`[TenantProvider] Found tenant ID ${tenantIdToLoad} via access_url.`);
              } else {
                console.warn(`[TenantProvider] Active tenant not found for access_url: ${storeParam}`);
                setError(`Loja não encontrada ou inativa: ${storeParam}`);
                // Deixa o finally cuidar do isLoading
                return;
              }
            } catch (queryError) {
              console.error('[TenantProvider] Error querying tenant by access_url:', queryError);
              setError('Erro ao buscar informações da loja pela URL.');
              // Deixa o finally cuidar do isLoading
              return;
            }
          } else {
            // Sem usuário, sem parâmetro URL
            console.log('[TenantProvider] No user logged in and no store parameter.');
             setCurrentTenant(null); // Garante que nenhum tenant está definido
             setError(null); // Garante que nenhum erro está definido
             // Deixa o finally cuidar do isLoading
             return;
          }
        }

        // --- Buscar Dados do Tenant ---
        if (tenantIdToLoad) {
          // Verifica se este tenant específico já está carregado (pode acontecer com race conditions/mudanças rápidas)
           if (currentTenant?.id === tenantIdToLoad && !isLoading) {
               console.log(`[TenantProvider] Tenant ${tenantIdToLoad} already matches loaded tenant. Skipping fetch.`);
               // Garante associação de user ID se faltar (ex: carregado via URL e depois usuário logou)
                if (!currentTenant.userId && user) {
                   setCurrentTenant(prev => ({...prev, userId: user.uid}));
                }
               return; // Já carregado
           }

           console.log(`[TenantProvider] Attempting to load tenant data for ID: ${tenantIdToLoad}`);
          try {
            const tenantRef = doc(db, 'tenants', tenantIdToLoad);
            console.log(`[TenantProvider] Getting document reference: ${tenantRef.path}`);
            const docSnap = await getDoc(tenantRef);
            console.log(`[TenantProvider] Firestore getDoc finished. Document exists: ${docSnap?.exists()}`);

            if (docSnap?.exists()) {
              const tenantData = docSnap.data();
              console.log(`[TenantProvider] Document data received, checking status: ${tenantData?.status}`);
              if (tenantData?.status === 'active') {
                // Caso de sucesso
                setCurrentTenant({ id: docSnap.id, ...tenantData, userId: currentUserId || null }); // Associa userId
                setError(null); // Limpa erro anterior
                console.log(`[TenantProvider] Successfully loaded tenant: ${tenantData.name} (ID: ${docSnap.id}) for user ${currentUserId || 'public'}`);
                localStorage.setItem('current_tenant', docSnap.id);
                localStorage.setItem('tenant_name', tenantData.name);
              } else {
                // Encontrado mas inativo
                const status = tenantData?.status || 'unknown';
                console.error(`[TenantProvider] Tenant found but status not active: ${status} (ID: ${tenantIdToLoad})`);
                setError(`A loja selecionada (${tenantData?.name || tenantIdToLoad}) não está ativa (${status}).`);
                setCurrentTenant(null);
                localStorage.removeItem('current_tenant');
                localStorage.removeItem('tenant_name');
              }
            } else {
              // Não encontrado no Firestore
              console.error(`[TenantProvider] Tenant document not found in Firestore for ID: ${tenantIdToLoad}`);
              setError(`Tenant não encontrado: ${tenantIdToLoad}`);
              setCurrentTenant(null);
              localStorage.removeItem('current_tenant');
              localStorage.removeItem('tenant_name');
            }
          } catch (fetchError) {
             // Erro durante busca no Firestore
            console.error(`[TenantProvider] Error fetching/processing tenant document (ID: ${tenantIdToLoad}):`, fetchError);
            setError('Erro ao carregar dados da loja. Verifique as permissões ou a conexão.');
            setCurrentTenant(null);
            localStorage.removeItem('current_tenant');
            localStorage.removeItem('tenant_name');
             // Deixa o finally cuidar do isLoading
             return;
          }
        } else if (!error) {
          // Nenhum ID de tenant determinado (ex: usuário deslogou, sem URL, ou usuário sem claim) E nenhum erro ocorreu ainda
          console.log('[TenantProvider] No tenant ID determined to load and no previous error.');
          setCurrentTenant(null); // Garante que tenant é null
          // Deixa o finally cuidar do isLoading
        }

      } finally {
        // --- Garante que isLoading é definido como false ---
        console.log('[TenantProvider] Reached finally block.');
        // Verifica estado atual antes de definir para evitar re-renders desnecessários
         if (isLoading) { // Verifica a variável de estado diretamente
             console.log('[TenantProvider] Setting isLoading to false.');
             setIsLoading(false);
         } else {
              console.log('[TenantProvider] isLoading was already false.');
         }
      }
    };

    // Chama a função assíncrona
    loadTenant();

  // Depende apenas da instância db, estado de loading do Auth, e UID do usuário
  }, [db, auth.loadingAuth, currentUserId]);

  // Memoiza o valor do contexto
  const value = useMemo(() => ({
    currentTenant,
    isLoading,
    error,
    setCurrentTenant // Mantém isso se precisar de definição manual em outro lugar
  }), [currentTenant, isLoading, error]);

  // Loga o valor fornecido para debug
  console.log("[TenantProvider Value Check] Value being provided:", { tenant: value.currentTenant?.id, isLoading: value.isLoading, error: value.error });

  // Fornece o contexto
  return (
    <TenantContext.Provider value={value}>
      {children}
    </TenantContext.Provider>
  );
}

TenantProvider.propTypes = {
  children: PropTypes.node.isRequired
};

// Hook customizado para usar o contexto Tenant
export function useTenant() {
  const context = useContext(TenantContext);
  if (!context) {
    throw new Error('useTenant must be used within a TenantProvider');
  }
  return context;
}