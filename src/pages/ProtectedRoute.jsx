import { Navigate, Outlet } from 'react-router-dom';
// Remover import não usado de Loader2 se não houver mais uso
// import { Loader2 } from 'lucide-react'; 
import { useAuth } from '@/context/AuthContext'; // <-- Usar o novo hook
import { useLocation } from 'react-router-dom'; // Para state no Navigate
import { TenantProvider } from '@/components/tenant/TenantContext'; // Verifique o caminho!

const ProtectedRoute = () => {
  // Remover loadingAuth da desestruturação
  const { currentUser, userClaims } = useAuth(); // <-- Pegar dados do AuthContext
  const location = useLocation(); // Para passar location state

  // Verifica se está autenticado E se tem a claim tenant_id
  const hasTenantAccess = currentUser && userClaims?.tenant_id;

  console.log(`[ProtectedRoute] Rendering decision: hasTenantAccess=${!!hasTenantAccess} (User: ${currentUser?.uid}, Tenant Claim: ${userClaims?.tenant_id})`);

  // Se tiver acesso ao tenant, renderiza a rota filha (<Outlet />) dentro do TenantProvider
  // Se não, redireciona para /login, passando a localização original no state
  return hasTenantAccess ? (
    <TenantProvider>
      <Outlet />
    </TenantProvider>
  ) : <Navigate to="/login" state={{ from: location }} replace />;
};

export default ProtectedRoute; 