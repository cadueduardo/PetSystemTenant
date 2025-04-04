import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
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
  Truck,
  DollarSign,
  Settings as SettingsIcon,
  Menu,
  X,
  Moon,
  Sun,
  Clock
} from "lucide-react";
import { useTheme } from "next-themes";
import PropTypes from 'prop-types';

const classNames = (...classes) => {
  return classes.filter(Boolean).join(' ');
};

export default function Layout({ children, currentPageName }) {
  const publicPages = ["Landing", "Login", "Register", "ForgotPassword", "ResetPassword"];
  
  if (publicPages.includes(currentPageName)) {
    return <>{children}</>;
  }

  return <AuthenticatedLayout currentPageName={currentPageName}>{children}</AuthenticatedLayout>;
}

function AuthenticatedLayout({ children, currentPageName }) {
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [storeParam] = useState(localStorage.getItem('current_tenant') || '');

  const getPageUrl = (pageName) => {
    if (storeParam) {
      return `${createPageUrl(pageName)}?store=${storeParam}`;
    }
    return createPageUrl(pageName);
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
              to={getPageUrl("Dashboard")}
              className={`flex items-center gap-3 rounded-md px-3 py-2 hover:bg-accent ${
                currentPageName === "Dashboard" ? "bg-accent font-medium" : ""
              }`}
            >
              <LayoutDashboard className="h-5 w-5" />
              <span>Dashboard</span>
            </Link>

            <Link
              to={getPageUrl("Customers")}
              className={`flex items-center gap-3 rounded-md px-3 py-2 hover:bg-accent ${
                currentPageName === "Customers" ? "bg-accent font-medium" : ""
              }`}
            >
              <Users className="h-5 w-5" />
              <span>Clientes</span>
            </Link>

            <Link
              to={getPageUrl("Calendar")}
              className={`flex items-center gap-3 rounded-md px-3 py-2 hover:bg-accent ${
                currentPageName === "Calendar" ? "bg-accent font-medium" : ""
              }`}
            >
              <Calendar className="h-5 w-5" />
              <span>Agenda</span>
            </Link>

            <Link
              to={getPageUrl("ServiceQueue")}
              className={`flex items-center gap-3 rounded-md px-3 py-2 hover:bg-accent ${
                currentPageName === "ServiceQueue" ? "bg-accent font-medium" : ""
              }`}
            >
              <Clock className="h-5 w-5" />
              <span>Fila de Atendimento</span>
            </Link>

            <Link
              to={getPageUrl("Products")}
              className={`flex items-center gap-3 rounded-md px-3 py-2 hover:bg-accent ${
                currentPageName === "Products" ? "bg-accent font-medium" : ""
              }`}
            >
              <Package className="h-5 w-5" />
              <span>Produtos</span>
            </Link>

            <Link
              to={getPageUrl("Sales")}
              className={`flex items-center gap-3 rounded-md px-3 py-2 hover:bg-accent ${
                currentPageName === "Sales" ? "bg-accent font-medium" : ""
              }`}
            >
              <ShoppingBag className="h-5 w-5" />
              <span>Vendas</span>
            </Link>

            <Link
              to={getPageUrl("Services")}
              className={`flex items-center gap-3 rounded-md px-3 py-2 hover:bg-accent ${
                currentPageName === "Services" ? "bg-accent font-medium" : ""
              }`}
            >
              <FileText className="h-5 w-5" />
              <span>Serviços</span>
            </Link>

            <Link
              to={getPageUrl("Transport")}
              className={`flex items-center gap-3 rounded-md px-3 py-2 hover:bg-accent ${
                currentPageName === "Transport" ? "bg-accent font-medium" : ""
              }`}
            >
              <Truck className="h-5 w-5" />
              <span>Transporte</span>
            </Link>

            <Link
              to={getPageUrl("Financial")}
              className={`flex items-center gap-3 rounded-md px-3 py-2 hover:bg-accent ${
                currentPageName === "Financial" ? "bg-accent font-medium" : ""
              }`}
            >
              <DollarSign className="h-5 w-5" />
              <span>Financeiro</span>
            </Link>

            <Link
              to={getPageUrl("Settings")}
              className={`flex items-center gap-3 rounded-md px-3 py-2 hover:bg-accent ${
                currentPageName === "Settings" ? "bg-accent font-medium" : ""
              }`}
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
                {storeParam}
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
        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}

Layout.propTypes = {
  children: PropTypes.node.isRequired,
  currentPageName: PropTypes.string.isRequired
};

AuthenticatedLayout.propTypes = {
  children: PropTypes.node.isRequired,
  currentPageName: PropTypes.string.isRequired
};