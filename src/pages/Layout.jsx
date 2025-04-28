import { useState, useEffect } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { getAuth, signOut } from "firebase/auth"; // Import auth functions
import { useAuth } from "@/context/AuthContext"; // <<< IMPORTAR O REAL
import { getFirestore, doc, getDoc } from "firebase/firestore"; // <<< Adicionar imports Firestore
import {
  LayoutDashboard,
  Users,
  Calendar,
  Package,
  ShoppingBag,
  FileText,
  DollarSign,
  Settings as SettingsIcon,
  Menu,
  X,
  Moon,
  Sun,
  Clock,
  Stethoscope,
  Pill,
  ClipboardList,
  LifeBuoy,
  LogOut, // Import Logout icon
  UsersRound, // <--- Adicionar ícone para Perfis/Funções
  Webhook, // <-- Adicionar ícone para Integrações
} from "lucide-react";
import { useTheme } from "next-themes";

// ----- REMOVER SIMULAÇÃO ----- 
/*
const useAuth = () => ({ 
  userClaims: { isAdmin: true, tenant_id: 'test-tenant' } 
});
*/
// -----------------------------

const classNames = (...classes) => {
  return classes.filter(Boolean).join(' ');
};

export default function Layout() {
  const { theme, setTheme } = useTheme();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate(); // Obter a função navigate
  // const { navigateWithStore } = useTenant(); // Removida desestruturação

  // ----- USAR O useAuth REAL ----- 
  const { currentUser, userClaims } = useAuth(); 
  // ---------------------------------

  // <<< Definir variável isAdmin >>>
  const isAdmin = userClaims?.isAdmin === true;

  // <<< Calcular inicial do usuário >>>
  const userInitial = currentUser?.displayName?.charAt(0).toUpperCase() || currentUser?.email?.charAt(0).toUpperCase() || 'U';

  // <<< Estado para permissões do perfil >>>
  const [profilePermissions, setProfilePermissions] = useState(null);
  const [loadingPermissions, setLoadingPermissions] = useState(false); // Iniciar como false, ativar se buscar

  // <<< Buscar permissões do perfil no Firestore >>>
  useEffect(() => {
    const fetchProfilePermissions = async () => {
      if (!isAdmin && userClaims?.profile_id) {
        setLoadingPermissions(true);
        setProfilePermissions(null); // Limpar permissões antigas
        console.log(`[Layout] Fetching permissions for profile ID: ${userClaims.profile_id}`);
        const db = getFirestore();
        const profileRef = doc(db, "perfis", userClaims.profile_id);
        try {
          const docSnap = await getDoc(profileRef);
          if (docSnap.exists()) {
            // Assumindo que as permissões estão em um campo chamado 'permissoes'
            const permissionsData = docSnap.data()?.permissoes;
            console.log("[Layout] Permissions fetched:", permissionsData);
            setProfilePermissions(permissionsData || {}); // Define como objeto vazio se não houver
          } else {
            console.error(`[Layout] Profile document not found for ID: ${userClaims.profile_id}`);
            setProfilePermissions({}); // Define como vazio para não dar erro
          }
        } catch (error) {
          console.error("[Layout] Error fetching profile permissions:", error);
          setProfilePermissions({}); // Define como vazio em caso de erro
        } finally {
          setLoadingPermissions(false);
        }
      } else if (isAdmin) {
         // Admin tem todas as permissões, não precisa buscar
         setProfilePermissions({}); // Pode deixar como vazio ou um marcador especial
         setLoadingPermissions(false);
      } else {
         // Usuário não é admin e não tem profile_id, ou claims não carregaram
         setProfilePermissions(null);
         setLoadingPermissions(false);
      }
    };

    fetchProfilePermissions();
    // Dependências: buscar se userClaims mudar (contém profile_id e isAdmin)
  }, [isAdmin, userClaims]); 

  // <<< ATUALIZAR LÓGICA da função helper hasPermission >>>
  const hasPermission = (resourceId, action = 'ler') => { 
    if (isAdmin) return true; // Admin pode tudo
    // Garante que as permissões foram carregadas e são um array
    if (loadingPermissions || !Array.isArray(profilePermissions)) return false;

    // Verifica se alguma string no array corresponde, ignorando o prefixo
    return profilePermissions.some(permString => {
      const parts = permString.split(':');
      // Verifica se o formato é prefixo:recurso:acao OU recurso:acao
      if (parts.length === 3) { // Formato prefixo:recurso:acao
        // Compara a segunda parte (recurso) e a terceira (acao)
        return parts[1] === resourceId && parts[2] === action;
      } else if (parts.length === 2) { // Formato recurso:acao (como fallback)
          // Compara a primeira parte (recurso) e a segunda (acao)
          return parts[0] === resourceId && parts[1] === action;
      }
      return false; // Formato inválido na string de permissão
    });
  };

  const isActive = (href) => {
    // Adicionada verificação para path exato do dashboard
    if (href === "/tenant/dashboard") {
       return location.pathname === href;
    }
    // Adicionada verificação para path exato da agenda/calendário
     if (href === "/tenant/agenda" || href === "/tenant/calendario") {
       return location.pathname === "/tenant/agenda" || location.pathname === "/tenant/calendario";
    }
    return location.pathname.startsWith(href);
  };

  const handleNavigation = (e, path) => {
    e.preventDefault();
    // navigateWithStore(path); // Removido navigateWithStore
    navigate(path); // Usar navigate
    if (sidebarOpen) { // Fecha a sidebar mobile se estiver aberta
        setSidebarOpen(false);
    }
  };

  // --- Logout Handler ---
  const handleLogout = async () => {
    const auth = getAuth();
    try {
      await signOut(auth);
      console.log("User signed out successfully.");
      navigate("/login"); // Redirect to login page after sign out
    } catch (error) {
      console.error("Error signing out: ", error);
      // Handle sign-out errors here (e.g., show a notification)
    }
  };
  // --- End Logout Handler ---

  // Adicionado link de Suporte (se estava faltando na versão restaurada)
  const supportLink = (
      <Link
        to="/tenant/suporte"
        onClick={(e) => handleNavigation(e, "/tenant/suporte")}
        className={classNames(
          `flex items-center gap-3 rounded-md px-3 py-2 hover:bg-accent`,
          isActive("/tenant/suporte") ? "bg-accent font-medium" : ""
        )}
      >
        <LifeBuoy className="h-5 w-5" />
        <span>Suporte</span>
      </Link>
  );

  // Mostrar loading enquanto busca permissões?
  if (loadingPermissions) {
      // Pode mostrar um spinner diferente ou integrado ao layout
      return <div className="flex justify-center items-center min-h-screen">Carregando permissões...</div>;
  }

  return (
    <div className="flex min-h-screen bg-background">
      {sidebarOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      
      <div 
        className={classNames(
          "fixed inset-y-0 z-50 flex w-72 flex-col border-r bg-card transition-transform duration-300 ease-in-out lg:static lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-16 items-center justify-between px-6 border-b">
          <div className="flex items-center">
             {/* Usando Link para o logo também */}
             <Link to="/tenant/dashboard" onClick={(e) => handleNavigation(e, "/tenant/dashboard")} className="font-bold text-lg">
                PetClinic
             </Link>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="flex-1 overflow-auto py-4">
          <nav className="flex flex-col gap-1 px-4">
            {/* Dashboard: Assumir que todos veem? Ou usar hasPermission('dashboard', 'ler')? */}
            {/* Por enquanto, todos veem */}
            <Link
              to="/tenant/dashboard"
              onClick={(e) => handleNavigation(e, "/tenant/dashboard")}
              className={classNames(
                `flex items-center gap-3 rounded-md px-3 py-2 hover:bg-accent`,
                isActive("/tenant/dashboard") ? "bg-accent font-medium" : ""
              )}
            >
              <LayoutDashboard className="h-5 w-5" />
              <span>Dashboard</span>
            </Link>
            
            {/* Clientes */} 
            {hasPermission('clientes', 'ler') && (
                <Link
                  to="/tenant/clientes"
                  onClick={(e) => handleNavigation(e, "/tenant/clientes")}
                  className={classNames(
                    `flex items-center gap-3 rounded-md px-3 py-2 hover:bg-accent`,
                    isActive("/tenant/clientes") ? "bg-accent font-medium" : ""
                  )}
                >
                  <Users className="h-5 w-5" />
                  <span>Clientes</span>
                </Link>
            )}
            
            {/* Agenda */} 
            {hasPermission('agenda', 'ler') && (
                <Link
                  to="/tenant/agenda" 
                  onClick={(e) => handleNavigation(e, "/tenant/agenda")}
                  className={classNames(
                    `flex items-center gap-3 rounded-md px-3 py-2 hover:bg-accent`,
                    isActive("/tenant/agenda") ? "bg-accent font-medium" : "" 
                  )}
                >
                  <Calendar className="h-5 w-5" />
                  <span>Agenda</span>
                </Link>
            )}

            {/* Live Vet */} 
            {hasPermission('live_vet', 'ler') && (
                <Link
                  to="/tenant/live-vet"
                  onClick={(e) => handleNavigation(e, "/tenant/live-vet")}
                  className={classNames(
                    `flex items-center gap-3 rounded-md px-3 py-2 hover:bg-accent`,
                    isActive("/tenant/live-vet") ? "bg-accent font-medium" : ""
                  )}
                >
                  <Stethoscope className="h-5 w-5" />
                  <span>Live Vet</span>
                </Link>
            )}

            {/* Fila de Atendimento */} 
            {hasPermission('fila_atendimento', 'ler') && (
                <Link
                  to="/tenant/fila-atendimento"
                  onClick={(e) => handleNavigation(e, "/tenant/fila-atendimento")}
                  className={classNames(
                    `flex items-center gap-3 rounded-md px-3 py-2 hover:bg-accent`,
                    isActive("/tenant/fila-atendimento") ? "bg-accent font-medium" : ""
                  )}
                >
                  <Clock className="h-5 w-5" />
                  <span>Fila de Atendimento</span>
                </Link>
            )}

            {/* Medicação Interna */} 
            {hasPermission('medicacao_interna', 'ler') && (
                <Link
                  to="/tenant/medicacao"
                  onClick={(e) => handleNavigation(e, "/tenant/medicacao")}
                  className={classNames(
                    `flex items-center gap-3 rounded-md px-3 py-2 hover:bg-accent`,
                    isActive("/tenant/medicacao") ? "bg-accent font-medium" : ""
                  )}
                >
                  <Pill className="h-5 w-5" />
                  <span>Medicação Interna</span>
                </Link>
            )}

            {/* Produtos Cadastro (Shop) */} 
            {hasPermission('produtos_cadastro', 'ler') && (
                <Link
                  to="/tenant/produtos" // Ajustar ROTA se for diferente
                  onClick={(e) => handleNavigation(e, "/tenant/produtos")}
                  className={classNames(
                    `flex items-center gap-3 rounded-md px-3 py-2 hover:bg-accent`,
                    isActive("/tenant/produtos") ? "bg-accent font-medium" : ""
                  )}
                >
                  <Package className="h-5 w-5" />
                  {/* Mudar label? Produtos (Cadastro)? */} 
                  <span>Produtos</span> 
                </Link>
            )}
            
            {/* Caixa (Antigo Vendas) */} 
            {hasPermission('caixa', 'ler') && (
                <Link
                  to="/tenant/caixa"
                  onClick={(e) => handleNavigation(e, "/tenant/caixa")}
                  className={classNames(
                    `flex items-center gap-3 rounded-md px-3 py-2 hover:bg-accent`,
                    isActive("/tenant/caixa") ? "bg-accent font-medium" : ""
                  )}
                >
                  <ShoppingBag className="h-5 w-5" />
                  <span>Caixa</span>
                </Link>
            )}

            {/* Serviços Cadastro */} 
            {hasPermission('servicos_cadastro', 'ler') && (
                <Link
                  to="/tenant/servicos" // Ajustar ROTA se for diferente
                  onClick={(e) => handleNavigation(e, "/tenant/servicos")}
                  className={classNames(
                    `flex items-center gap-3 rounded-md px-3 py-2 hover:bg-accent`,
                    isActive("/tenant/servicos") ? "bg-accent font-medium" : ""
                  )}
                >
                  <FileText className="h-5 w-5" />
                   {/* Mudar label? Serviços (Cadastro)? */} 
                  <span>Serviços</span>
                </Link>
            )}

            {/* Modelos Prescrição (Vet) */} 
            {hasPermission('modelos_prescricao', 'ler') && (
                <Link
                  to="/tenant/prescription-manager"
                  onClick={(e) => handleNavigation(e, "/tenant/prescription-manager")}
                  className={classNames(
                    `flex items-center gap-3 rounded-md px-3 py-2 hover:bg-accent`,
                    isActive("/tenant/prescription-manager") ? "bg-accent font-medium" : ""
                  )}
                >
                  <ClipboardList className="h-5 w-5" />
                  <span>Modelos Prescrição</span>
                </Link>
            )}

            {/* Financeiro */} 
            {hasPermission('financeiro', 'ler') && (
                <Link
                  to="/tenant/financeiro"
                  onClick={(e) => handleNavigation(e, "/tenant/financeiro")}
                  className={classNames(
                    `flex items-center gap-3 rounded-md px-3 py-2 hover:bg-accent`,
                    isActive("/tenant/financeiro") ? "bg-accent font-medium" : ""
                  )}
                >
                  <DollarSign className="h-5 w-5" />
                  <span>Financeiro</span>
                </Link>
            )}

            {/* --- Links Admin --- */} 
            {/* Configurações Tenant */} 
            {isAdmin && (
                <Link
                  to="/tenant/configuracoes" // Rota pode ser tenant/configuracoes?
                  onClick={(e) => handleNavigation(e, "/tenant/configuracoes")}
                  className={classNames(
                    `flex items-center gap-3 rounded-md px-3 py-2 hover:bg-accent`,
                    isActive("/tenant/configuracoes") ? "bg-accent font-medium" : ""
                  )}
                >
                  <SettingsIcon className="h-5 w-5" />
                  <span>Configurações</span>
                </Link>
            )}

            {/* Perfis Gestão */} 
            {isAdmin && (
                <Link
                  to="/tenant/perfis"
                  onClick={(e) => handleNavigation(e, "/tenant/perfis")}
                  className={classNames(
                    `flex items-center gap-3 rounded-md px-3 py-2 hover:bg-accent`,
                    isActive("/tenant/perfis") ? "bg-accent font-medium" : ""
                  )}
                >
                  <UsersRound className="h-5 w-5" /> 
                  <span>Perfis</span>
                </Link>
            )}
            
            {/* Colaboradores Gestão */} 
            {isAdmin && (
                <Link
                  to="/tenant/colaboradores"
                  onClick={(e) => handleNavigation(e, "/tenant/colaboradores")}
                  className={classNames(
                    `flex items-center gap-3 rounded-md px-3 py-2 hover:bg-accent`,
                    isActive("/tenant/colaboradores") ? "bg-accent font-medium" : ""
                  )}
                >
                  <Users className="h-5 w-5" />
                  <span>Colaboradores</span>
                </Link>
            )}

            {/* Integrações (Admin) */}
            {isAdmin && (
                <Link
                  to="/tenant/integracoes"
                  onClick={(e) => handleNavigation(e, "/tenant/integracoes")}
                  className={classNames(
                    `flex items-center gap-3 rounded-md px-3 py-2 hover:bg-accent`,
                    isActive("/tenant/integracoes") ? "bg-accent font-medium" : ""
                  )}
                >
                  <Webhook className="h-5 w-5" /> 
                  <span>Integrações</span>
                </Link>
            )}
            {/* --- Fim Links Admin --- */}

            {/* Suporte (todos veem) */} 
            {supportLink}

            {/* Botão Sair (todos veem) */} 
            <button
                onClick={handleLogout}
                className="mt-auto flex items-center gap-3 rounded-md px-3 py-2 text-red-500 hover:bg-destructive/10"
             >
               <LogOut className="h-5 w-5" />
               <span>Sair</span>
             </button>
             {/* --- End Logout Button --- */}

          </nav>
        </div>

        <div className="border-t p-4">
            <div className="flex items-center gap-3">
              <Avatar>
              {/* <<< Usar a variável userInitial >>> */}
              <AvatarFallback className="bg-primary/10 text-primary">
                {userInitial}
                </AvatarFallback>
              </Avatar>
              <div className="overflow-hidden">
              <p className="truncate font-medium">{currentUser?.displayName || currentUser?.email || 'Usuário'}</p>
              <p className="truncate text-sm text-muted-foreground">
                {currentUser?.email || 'email@exemplo.com'}
              </p>
              </div>
            </div>
            
            <Link 
              to="/tenant/suporte" 
              onClick={(e) => handleNavigation(e, "/tenant/suporte")}
              className="block text-center text-xs text-muted-foreground hover:text-primary hover:underline mt-4 mb-2"
            >
              Está com problemas? Acesse nosso suporte
            </Link>

            <Button 
              variant="ghost" 
              size="icon" 
              className="mt-4 w-full" 
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            >
              {theme === 'dark' ? (
                <Sun className="h-5 w-5" />
              ) : (
                <Moon className="h-5 w-5" />
              )}
            </Button>
          </div>
      </div>

      <div className="flex flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-background px-6 lg:justify-end">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden"
          >
            <Menu className="h-6 w-6" />
          </Button>
          {/* Aqui pode ir outros itens do header, como busca ou menu do usuário */}
        </header>
        <main className="flex-1 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}