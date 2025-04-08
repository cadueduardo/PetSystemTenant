import { useState } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
  Pill
} from "lucide-react";
import { useTheme } from "next-themes";
import { useTenant } from "@/components/tenant/TenantContext";
// import TransportServices from './TransportServices'; // Removido não usado
// import TransportSettings from './TransportSettings';
// import AdminDashboard from './AdminDashboard'; // Removido não usado

const classNames = (...classes) => {
  return classes.filter(Boolean).join(' ');
};

export default function Layout() {
  const { theme, setTheme } = useTheme();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const { navigateWithStore } = useTenant();

  const isActive = (href) => {
    return location.pathname.startsWith(href);
  };

  const handleNavigation = (e, path) => {
    e.preventDefault();
    navigateWithStore(path);
  };

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
            <span className="font-bold text-lg">
              PetClinic
            </span>
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
            
            <Link
              to="/tenant/calendario"
              onClick={(e) => handleNavigation(e, "/tenant/calendario")}
              className={classNames(
                `flex items-center gap-3 rounded-md px-3 py-2 hover:bg-accent`,
                isActive("/tenant/calendario") ? "bg-accent font-medium" : ""
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

            {/* <<< COMENTANDO/REMOVENDO O LINK DE TRANSPORTE >>>
              <Link
              to="/tenant/transporte"
              onClick={(e) => handleNavigation(e, "/tenant/transporte")}
              className={classNames(
                `flex items-center gap-3 rounded-md px-3 py-2 hover:bg-accent`,
                isActive("/tenant/transporte") ? "bg-accent font-medium" : ""
              )}
            >
              <Truck className="h-5 w-5" />
              <span>Transporte</span>
              </Link>
            */}

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
              </p>
            </div>
          </div>
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
        <header className="sticky top-0 z-10 flex h-16 items-center gap-4 border-b bg-background px-6">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-6 w-6" />
          </Button>
        </header>
        <main className="flex-1 p-4">
          <Outlet />
        </main>
      </div>
    </div>
  );
}