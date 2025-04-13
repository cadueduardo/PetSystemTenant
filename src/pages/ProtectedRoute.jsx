import { Navigate, Outlet } from 'react-router-dom';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react'; // Para indicador de loading
import { useTenant } from '@/components/tenant/TenantContext'; // Importar useTenant
import { doc, getDoc } from 'firebase/firestore'; // Importar funções do Firestore
import { db } from '@/lib/firebaseConfig'; // Importar instância do DB

const auth = getAuth();

const ProtectedRoute = () => {
  const { setTenantFromAuth } = useTenant(); // Obter função do contexto
  const [isAuthenticated, setIsAuthenticated] = useState(null); // null = loading, false = not auth, true = auth
  const [tenantId, setTenantId] = useState(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          console.log('[ProtectedRoute] User is logged in. Fetching token result...');
          const idTokenResult = await user.getIdTokenResult(true); // Force refresh
          const currentTenantId = idTokenResult.claims.tenant_id;
          console.log('[ProtectedRoute] Claims tenant_id:', currentTenantId);
          
          if (currentTenantId) {
            // Buscar dados completos do Tenant no Firestore
            console.log(`[ProtectedRoute] Fetching tenant document for ID: ${currentTenantId}`);
            const tenantRef = doc(db, 'tenants', currentTenantId);
            const tenantSnap = await getDoc(tenantRef);

            if (tenantSnap.exists()) {
              const tenantData = { id: tenantSnap.id, ...tenantSnap.data() };
              console.log('[ProtectedRoute] Tenant document found:', tenantData);
              setTenantFromAuth(tenantData); // Popular o contexto com os dados do tenant
              setTenantId(currentTenantId); // Manter ID localmente também
              localStorage.setItem('current_tenant', currentTenantId); // Garante que está no localStorage
              setIsAuthenticated(true);
              console.log('[ProtectedRoute] Authenticated as Tenant Admin and context populated.');
            } else {
               // Tenant não encontrado no Firestore, mesmo com claim!
               console.error(`[ProtectedRoute] Tenant claim found (${currentTenantId}), but document not found in Firestore!`);
               setTenantFromAuth(null); // Limpar contexto
               setTenantId(null);
               setIsAuthenticated(false); 
               localStorage.removeItem('current_tenant');
               // Considerar deslogar ou mostrar erro grave
               // await auth.signOut(); 
            }

          } else {
            console.warn("[ProtectedRoute] User logged in but lacks tenant_id claim.");
            setTenantFromAuth(null); // Limpar contexto
            setTenantId(null);
            setIsAuthenticated(false); 
            localStorage.removeItem('current_tenant');
          }
        } catch (error) {
           console.error("[ProtectedRoute] Error fetching token/claims or tenant document:", error);
           setTenantFromAuth(null); // Limpar contexto
           setTenantId(null);
           setIsAuthenticated(false);
           localStorage.removeItem('current_tenant');
        }
      } else {
        // Não logado
        console.log('[ProtectedRoute] No user logged in.');
        setTenantFromAuth(null); // Limpar contexto
        setTenantId(null);
        localStorage.removeItem('current_tenant');
        setIsAuthenticated(false);
      }
    });

    // Cleanup subscription on unmount
    return () => unsubscribe();
  }, [setTenantFromAuth]); // Adicionar setTenantFromAuth como dependência

  if (isAuthenticated === null) {
    // Enquanto verifica o auth, mostra um loading centralizado
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2">Verificando autenticação...</span>
      </div>
    ); 
  }

  // Se autenticado E com tenantId, renderiza a rota filha (<Outlet />)
  // Se não, redireciona para /login
  console.log(`[ProtectedRoute] Rendering decision: isAuthenticated=${isAuthenticated}, tenantId=${tenantId}`);
  return isAuthenticated && tenantId ? <Outlet /> : <Navigate to="/login" replace />;
};

export default ProtectedRoute; 