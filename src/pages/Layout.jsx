import { useState } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { getAuth, signOut } from "firebase/auth"; // Import auth functions
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
} from "lucide-react";
import { useTheme } from "next-themes";
// import { useTenant } from "@/components/tenant/TenantContext"; // Removido useTenant

// ----- SIMULAÇÃO DAS CLAIMS - REMOVER DEPOIS E BUSCAR REAL -----
// Assumindo que o hook de autenticação traria algo assim para um Admin
const useAuth = () => ({ 
  userClaims: { isAdmin: true, tenant_id: 'test-tenant' } 
});
// ---------------------------------------------------------------

const classNames = (...classes) => {
  return classes.filter(Boolean).join(' ');
};

export default function Layout() {
  const { theme, setTheme } = useTheme();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate(); // Obter a função navigate
  // const { navigateWithStore } = useTenant(); // Removida desestruturação

  // ----- Obter claims (simulado por enquanto) -----
  const { userClaims } = useAuth(); 
  // -----------------------------------------------

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
            
             {/* Usar /tenant/agenda consistentemente */}
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

            <Link
              to="/tenant/produtos"
              onClick={(e) => handleNavigation(e, "/tenant/produtos")}
              className={classNames(
                `flex items-center gap-3 rounded-md px-3 py-2 hover:bg-accent`,
                isActive("/tenant/produtos") ? "bg-accent font-medium" : ""
              )}
            >
              <Package className="h-5 w-5" />
              <span>Produtos</span>
            </Link>
            
              <Link
              to="/tenant/vendas"
              onClick={(e) => handleNavigation(e, "/tenant/vendas")}
              className={classNames(
                `flex items-center gap-3 rounded-md px-3 py-2 hover:bg-accent`,
                isActive("/tenant/vendas") ? "bg-accent font-medium" : ""
              )}
              >
                <ShoppingBag className="h-5 w-5" />
                <span>Vendas</span>
              </Link>

            <Link
              to="/tenant/servicos"
              onClick={(e) => handleNavigation(e, "/tenant/servicos")}
              className={classNames(
                `flex items-center gap-3 rounded-md px-3 py-2 hover:bg-accent`,
                isActive("/tenant/servicos") ? "bg-accent font-medium" : ""
              )}
            >
              <FileText className="h-5 w-5" />
              <span>Serviços</span>
            </Link>

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

            {/* Link de Transporte Comentado */}

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

            <Link
              to="/tenant/configuracoes"
              onClick={(e) => handleNavigation(e, "/tenant/configuracoes")}
              className={classNames(
                `flex items-center gap-3 rounded-md px-3 py-2 hover:bg-accent`,
                isActive("/tenant/configuracoes") ? "bg-accent font-medium" : ""
              )}
            >
              <SettingsIcon className="h-5 w-5" />
              <span>Configurações</span>
            </Link>

            {/* --- NOVOS LINKS: Perfis e Colaboradores (Somente Admin) --- */}
            {userClaims?.isAdmin && (
              <>
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
              </>
            )}
            {/* --- FIM NOVOS LINKS --- */}

            {/* Adicionando o Link de Suporte aqui */}
            {supportLink}

            {/* --- Logout Button --- */}
            <button
                onClick={handleLogout}
                className="mt-auto flex items-center gap-3 rounded-md px-3 py-2 text-red-500 hover:bg-destructive/10" // Added margin-top auto to push it down potentially, added specific styling
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
              <AvatarFallback className="bg-primary/10 text-primary">
                U
                </AvatarFallback>
              </Avatar>
              <div className="overflow-hidden">
              <p className="truncate font-medium">Usuário</p>
              <p className="truncate text-sm text-muted-foreground">
                usuario@email.com {/* TODO: Obter email real */}
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