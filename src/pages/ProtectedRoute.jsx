import { Navigate, Outlet } from 'react-router-dom';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react'; // Para indicador de loading

const auth = getAuth();

const ProtectedRoute = () => {
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
            setTenantId(currentTenantId);
            localStorage.setItem('current_tenant', currentTenantId); // Garante que está no localStorage
            setIsAuthenticated(true);
            console.log('[ProtectedRoute] Authenticated as Tenant Admin.');
          } else {
            console.warn("[ProtectedRoute] User logged in but lacks tenant_id claim.");
            setTenantId(null);
            setIsAuthenticated(false); 
            localStorage.removeItem('current_tenant'); // Limpa se não tiver tenant_id
            // Considerar deslogar se não for o super admin?
            // await auth.signOut();
          }
        } catch (error) {
           console.error("[ProtectedRoute] Error fetching token/claims:", error);
           setTenantId(null);
           setIsAuthenticated(false);
           localStorage.removeItem('current_tenant');
        }
      } else {
        // Não logado
        console.log('[ProtectedRoute] No user logged in.');
        setTenantId(null);
        localStorage.removeItem('current_tenant');
        setIsAuthenticated(false);
      }
    });

    // Cleanup subscription on unmount
    return () => unsubscribe();
  }, []);

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