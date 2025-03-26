import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { User } from "@/api/entities"; 
import { Customization } from "@/api/entities"; 
import { Tenant } from "@/api/entities"; 
import { toast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import Settings from "@/pages/Settings";
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
  LogOut,
  Menu,
  X,
  Shield,
  ShieldCheck,
  Syringe,
  Pill,
  AlertTriangle,
  Clock,
  Moon,
  Sun
} from "lucide-react";
import { useTheme } from "next-themes";

const classNames = (...classes) => {
  return classes.filter(Boolean).join(' ');
};

export default function Layout({ children, currentPageName }) {
  const publicPages = [
    "Landing",
    "Login",
    "Register",
    "ForgotPassword",
    "ResetPassword",
    "VerifyEmail",
    "ResendVerification",
    "AdminLogin",
    "Contratar"
  ];
  const adminPages = ["AdminDashboard", "AdminSettings", "AdminReports", "AdminTools"];
  
  if (publicPages.includes(currentPageName)) {
    return <>{children}</>;
  }
  
  if (adminPages.includes(currentPageName)) {
    return <AdminLayout currentPageName={currentPageName}>{children}</AdminLayout>;
  }

  return <AuthenticatedLayout currentPageName={currentPageName}>{children}</AuthenticatedLayout>;
}

function AdminLayout({ children, currentPageName }) {
  const navigate = useNavigate();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  useEffect(() => {
    const adminAuthenticated = localStorage.getItem('admin_authenticated') === 'true';
    setIsAuthenticated(adminAuthenticated);
    
    if (!adminAuthenticated) {
      navigate(createPageUrl("AdminLogin"));
    }
  }, [navigate]);
  
  const handleLogout = () => {
    localStorage.removeItem('admin_authenticated');
    localStorage.removeItem('admin_email');
    localStorage.removeItem('admin_role');
    navigate(createPageUrl("AdminLogin"));
  };
  
  if (!isAuthenticated) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }
  
  return (
    <div className="flex min-h-screen bg-gray-50">
      {sidebarOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      
      <div 
        className={classNames(
          "fixed inset-y-0 z-50 flex w-72 flex-col bg-white shadow-lg transition-transform duration-300 ease-in-out lg:static lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-16 items-center justify-between px-6 border-b">
          <div className="flex items-center">
            <Shield className="h-8 w-8 text-blue-600 mr-2" />
            <span className="font-bold text-lg text-gray-900">
              Admin PetClinic
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
              to={createPageUrl("AdminDashboard")}
              className={`flex items-center gap-3 rounded-md px-3 py-2 text-gray-700 hover:bg-gray-100 ${
                currentPageName === "AdminDashboard" ? "bg-gray-100 font-medium" : ""
              }`}
            >
              <LayoutDashboard className="h-5 w-5" />
              <span>Dashboard</span>
            </Link>
            
            <Link
              to={createPageUrl("AdminSettings")}
              className={`flex items-center gap-3 rounded-md px-3 py-2 text-gray-700 hover:bg-gray-100 ${
                currentPageName === "AdminSettings" ? "bg-gray-100 font-medium" : ""
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
              <AvatarFallback className="bg-blue-100 text-blue-600">
                A
              </AvatarFallback>
            </Avatar>
            <div className="overflow-hidden">
              <p className="truncate font-medium">Administrador</p>
              <p className="truncate text-sm text-gray-500">
                {localStorage.getItem('admin_email') || 'admin@petclinic.com'}
              </p>
            </div>
          </div>
          <Button 
            variant="ghost" 
            className="mt-4 w-full text-red-600 hover:bg-red-50 hover:text-red-700"
            onClick={handleLogout}
          >
            <LogOut className="h-4 w-4 mr-2" />
            Sair
          </Button>
        </div>
      </div>

      <div className="flex flex-1 flex-col">
        <header className="sticky top-0 z-10 flex h-16 items-center gap-4 border-b bg-white px-6">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-6 w-6" />
          </Button>
          <div className="flex-1"></div>
        </header>
        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}

function AuthenticatedLayout({ children, currentPageName }) {
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const [user, setUser] = useState(null);
  const [customization, setCustomization] = useState(null);
  const [tenant, setTenant] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedModules, setSelectedModules] = useState([]);
  const [storeParam, setStoreParam] = useState("");

  const publicPages = [
    "Landing",
    "Login",
    "Register",
    "ForgotPassword",
    "ResetPassword",
    "VerifyEmail",
    "ResendVerification",
    "AdminLogin",
    "Contratar"
  ];

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const store = params.get('store');
    if (store) {
      setStoreParam(store);
    }
  }, []);

  const getPageUrl = (pageName) => {
    if (storeParam) {
      return `${createPageUrl(pageName)}?store=${storeParam}`;
    }
    return createPageUrl(pageName);
  };

  const validateAndLoadTenant = async () => {
    try {
      const accessUrl = localStorage.getItem('current_tenant');
      
      if (publicPages.includes(currentPageName)) {
        setIsLoading(false);
        return;
      }

      // Verificar autenticação
      const isAuthenticated = await checkAuth();
      if (!isAuthenticated) {
        console.log('Usuário não autenticado, redirecionando para login');
        navigate(createPageUrl("Login"));
        setIsLoading(false);
        return;
      }

      if (!accessUrl) {
        if (currentPageName !== "Dashboard" && currentPageName !== "Settings") {
          navigate(createPageUrl("Landing"));
        }
        setIsLoading(false);
        return;
      }

      try {
        const tenant = await Tenant.get(accessUrl);
        if (tenant) {
          setTenant(tenant);
          setSelectedModules(tenant.selected_modules || []);
          localStorage.setItem('tenant_name', tenant.company_name);
          localStorage.setItem('tenant_modules', JSON.stringify(tenant.selected_modules || []));
          setIsLoading(false);
        } else {
          const newTenant = {
            access_url: accessUrl,
            company_name: accessUrl,
            selected_modules: ["clinic_management", "petshop"]
          };
          await Tenant.create(newTenant);
          setTenant(newTenant);
          setSelectedModules(newTenant.selected_modules);
          localStorage.setItem('tenant_name', newTenant.company_name);
          localStorage.setItem('tenant_modules', JSON.stringify(newTenant.selected_modules));

          const defaultCustomization = {
            tenant_id: newTenant.id,
            primary_color: '#3B82F6',
            secondary_color: '#1E40AF',
            use_logo_in_header: false,
            company_logo_url: null
          };
          await Customization.create(defaultCustomization);
          setCustomization(defaultCustomization);
          
          setIsLoading(false);
        }
      } catch (error) {
        console.error("Erro ao carregar tenant específico:", error);
        if (error.message === 'Usuário não autenticado') {
          navigate(createPageUrl("Login"));
        } else {
          const newTenant = {
            access_url: accessUrl,
            company_name: accessUrl,
            selected_modules: ["clinic_management", "petshop"]
          };
          await Tenant.create(newTenant);
          setTenant(newTenant);
          setSelectedModules(newTenant.selected_modules);
          localStorage.setItem('tenant_name', newTenant.company_name);
          localStorage.setItem('tenant_modules', JSON.stringify(newTenant.selected_modules));

          const defaultCustomization = {
            tenant_id: newTenant.id,
            primary_color: '#3B82F6',
            secondary_color: '#1E40AF',
            use_logo_in_header: false,
            company_logo_url: null
          };
          await Customization.create(defaultCustomization);
          setCustomization(defaultCustomization);
        }
        setIsLoading(false);
      }
    } catch (error) {
      console.error("Erro ao validar tenant:", error);
      if (!publicPages.includes(currentPageName) && currentPageName !== "Dashboard" && currentPageName !== "Settings") {
        navigate(createPageUrl("Landing"));
      }
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const loadTenant = async () => {
      setIsLoading(true);
      await validateAndLoadTenant();
    };
    loadTenant();
  }, [currentPageName]);

  useEffect(() => {
    const loadUser = async () => {
      try {
        const userData = {
          id: localStorage.getItem('user_id'),
          full_name: localStorage.getItem('user_name'),
          email: localStorage.getItem('user_email')
        };
        setUser(userData);
      } catch (error) {
        console.error("Erro ao carregar usuário:", error);
      }
    };
    loadUser();
  }, []);

  useEffect(() => {
    const loadCustomization = () => {
      try {
        if (tenant?.id && tenant.id !== "default") {
          // Tenta carregar do localStorage primeiro
          const savedCustomization = localStorage.getItem(`customization_${tenant.id}`);
          
          if (savedCustomization) {
            setCustomization(JSON.parse(savedCustomization));
            return;
          }

          // Se não existir no localStorage, cria uma nova
          const defaultCustomization = {
            id: tenant.id,
            primary_color: '#3B82F6',
            secondary_color: '#1E40AF',
            use_logo_in_header: false,
            company_logo_url: null
          };
          
          // Salva no localStorage
          localStorage.setItem(`customization_${tenant.id}`, JSON.stringify(defaultCustomization));
          setCustomization(defaultCustomization);
        } else {
          setCustomization({
            primary_color: '#3B82F6',
            secondary_color: '#1E40AF',
            use_logo_in_header: false,
            company_logo_url: null
          });
        }
      } catch (error) {
        console.error("Erro ao carregar customização:", error);
        setCustomization({
          primary_color: '#3B82F6',
          secondary_color: '#1E40AF',
          use_logo_in_header: false,
          company_logo_url: null
        });
      }
    };
    if (tenant?.id) {
      loadCustomization();
    }
  }, [tenant?.id]);

  const handleSaveCustomization = (newCustomization) => {
    try {
      if (tenant?.id) {
        // Salva no localStorage
        localStorage.setItem(`customization_${tenant.id}`, JSON.stringify(newCustomization));
        setCustomization(newCustomization);
        toast({
          title: "Sucesso",
          description: "Configurações salvas com sucesso!",
        });
      }
    } catch (error) {
      console.error("Erro ao salvar customização:", error);
      toast({
        title: "Erro",
        description: "Não foi possível salvar as configurações.",
        variant: "destructive",
      });
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('current_tenant');
    localStorage.removeItem('tenant_name');
    localStorage.removeItem('tenant_modules');
    navigate(createPageUrl("Landing"));
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!tenant && !publicPages.includes(currentPageName)) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background">
      {sidebarOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      
      <style>{customization?.primary_color ? `
        :root {
          --primary-color: ${customization.primary_color || '#3B82F6'};
          --secondary-color: ${customization.secondary_color || '#1E40AF'};
        }

        .bg-primary { background-color: var(--primary-color); }
        .text-primary { color: var(--primary-color); }
        .border-primary { border-color: var(--primary-color); }
        .bg-secondary { background-color: var(--secondary-color); }
        .text-secondary { color: var(--secondary-color); }
        .hover\\:bg-primary:hover { background-color: var(--primary-color); }
        .bg-blue-600 { background-color: var(--primary-color); }
        .hover\\:bg-blue-700:hover { background-color: var(--secondary-color); }
        .text-blue-600 { color: var(--primary-color); }
      ` : ''}</style>
      
      <div
        className={classNames(
          "fixed inset-y-0 z-50 flex w-72 flex-col bg-card shadow-lg transition-transform duration-300 ease-in-out lg:static lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-16 items-center border-b px-4">
          {customization?.use_logo_in_header && customization?.company_logo_url ? (
            <img
              src={customization.company_logo_url}
              alt="Logo"
              className="h-8 w-auto object-contain"
            />
          ) : (
            <h1 className="text-xl font-bold text-foreground">
              {tenant?.company_name || "VetSystem"}
            </h1>
          )}
        </div>

        <div className="flex-1 overflow-auto py-4">
          <nav className="flex flex-col gap-1 px-4">
            <Link
              to={getPageUrl("Dashboard")}
              className={`flex items-center gap-3 rounded-md px-3 py-2 text-gray-700 hover:bg-gray-100 ${
                currentPageName === "Dashboard" ? "bg-gray-100 font-medium" : ""
              }`}
            >
              <LayoutDashboard className="h-5 w-5" />
              <span>Dashboard</span>
            </Link>
            
            <Link
              to={getPageUrl("Customers")}
              className={`flex items-center gap-3 rounded-md px-3 py-2 text-gray-700 hover:bg-gray-100 ${
                currentPageName === "Customers" || currentPageName === "CustomerDetails" || currentPageName === "EditCustomer" ? "bg-gray-100 font-medium" : ""
              }`}
            >
              <Users className="h-5 w-5" />
              <span>Clientes e Pets</span>
            </Link>
            
            {selectedModules.includes('clinic_management') && (
              <Link
                to={getPageUrl("Calendar")}
                className={`flex items-center gap-3 rounded-md px-3 py-2 text-gray-700 hover:bg-gray-100 ${
                  currentPageName === "Calendar" || currentPageName === "AppointmentForm" ? "bg-gray-100 font-medium" : ""
                }`}
              >
                <Calendar className="h-5 w-5" />
                <span>Agenda de Consultas</span>
              </Link>
            )}

            <div className="mt-4 mb-2">
              <h3 className="px-3 text-sm font-medium text-gray-500">Cadastros</h3>
            </div>

            {selectedModules.includes('petshop') && (
              <Link
                to={getPageUrl("Services")}
                className={`flex items-center gap-3 rounded-md px-3 py-2 text-gray-700 hover:bg-gray-100 ${
                  currentPageName === "Services" ? "bg-gray-100 font-medium" : ""
                }`}
              >
                <Package className="h-5 w-5" />
                <span>Serviços</span>
              </Link>
            )}

            <Link
              to={getPageUrl("HealthPlans")}
              className={`flex items-center gap-3 rounded-md px-3 py-2 text-gray-700 hover:bg-gray-100 ${
                currentPageName === "HealthPlans" ? "bg-gray-100 font-medium" : ""
              }`}
            >
              <ShieldCheck className="h-5 w-5" />
              <span>Planos de Saúde</span>
            </Link>

            <Link
              to={getPageUrl("Vaccines")}
              className={`flex items-center gap-3 rounded-md px-3 py-2 text-gray-700 hover:bg-gray-100 ${
                currentPageName === "Vaccines" ? "bg-gray-100 font-medium" : ""
              }`}
            >
              <Syringe className="h-5 w-5" />
              <span>Vacinas</span>
            </Link>

            <Link
              to={getPageUrl("Medications")}
              className={`flex items-center gap-3 rounded-md px-3 py-2 text-gray-700 hover:bg-gray-100 ${
                currentPageName === "Medications" ? "bg-gray-100 font-medium" : ""
              }`}
            >
              <Pill className="h-5 w-5" />
              <span>Medicamentos</span>
            </Link>

            <Link
              to={getPageUrl("Allergies")}
              className={`flex items-center gap-3 rounded-md px-3 py-2 text-gray-700 hover:bg-gray-100 ${
                currentPageName === "Allergies" ? "bg-gray-100 font-medium" : ""
              }`}
            >
              <AlertTriangle className="h-5 w-5" />
              <span>Alergias</span>
            </Link>
            
            {selectedModules.includes('transport') && (
              <Link
                to={getPageUrl("TransportServices")}
                className={`flex items-center gap-3 rounded-md px-3 py-2 text-gray-700 hover:bg-gray-100 ${
                  currentPageName === "TransportServices" ? "bg-gray-100 font-medium" : ""
                }`}
              >
                <Truck className="h-5 w-5" />
                <span>Leva e Traz</span>
              </Link>
            )}
            
            {selectedModules.includes('financial') && (
              <Link
                to={getPageUrl("Financial")}
                className={`flex items-center gap-3 rounded-md px-3 py-2 text-gray-700 hover:bg-gray-100 ${
                  currentPageName === "Financial" ? "bg-gray-100 font-medium" : ""
                }`}
              >
                <DollarSign className="h-5 w-5" />
                <span>Financeiro</span>
              </Link>
            )}

            {selectedModules.includes('petshop') && (
              <Link
                to={getPageUrl("Sales")}
                className={`flex items-center gap-3 rounded-md px-3 py-2 text-gray-700 hover:bg-gray-100 ${
                  currentPageName === "Sales" ? "bg-gray-100 font-medium" : ""
                }`}
              >
                <ShoppingBag className="h-5 w-5" />
                <span>Vendas</span>
              </Link>
            )}

            <Link
              to={getPageUrl("Staff")}
              className={`flex items-center gap-3 rounded-md px-3 py-2 text-gray-700 hover:bg-gray-100 ${
                currentPageName === "Staff" ? "bg-gray-100 font-medium" : ""
              }`}
            >
              <Users className="h-5 w-5" />
              <span>Colaboradores</span>
            </Link>

            {selectedModules.includes('petshop') && (
              <Link
                to={getPageUrl("ServiceQueue")}
                className={`flex items-center gap-3 rounded-md px-3 py-2 text-gray-700 hover:bg-gray-100 ${
                  currentPageName === "ServiceQueue" ? "bg-gray-100 font-medium" : ""
                }`}
              >
                <Clock className="h-5 w-5" />
                <span>Fila de Atendimento</span>
              </Link>
            )}
          </nav>

          <Separator className="my-4" />

          <nav className="flex flex-col gap-1 px-4">
            <Link
              to={getPageUrl("Settings")}
              className={`flex items-center gap-3 rounded-md px-3 py-2 text-gray-700 hover:bg-gray-100 ${
                currentPageName === "Settings" ? "bg-gray-100 font-medium" : ""
              }`}
            >
              <SettingsIcon className="h-5 w-5" />
              <span>Configurações</span>
            </Link>
            
            <Button
              variant="ghost"
              className="flex items-center justify-start gap-3 rounded-md px-3 py-2 text-red-600 hover:bg-red-50"
              onClick={handleLogout}
            >
              <LogOut className="h-5 w-5" />
              <span>Sair</span>
            </Button>
          </nav>
        </div>

        {user && (
          <div className="border-t p-4">
            <div className="flex items-center gap-3">
              <Avatar>
                <AvatarFallback className="bg-blue-100 text-blue-600">
                  {user.full_name?.charAt(0) || user.email?.charAt(0)}
                </AvatarFallback>
              </Avatar>
              <div className="overflow-hidden">
                <p className="truncate font-medium">{user.full_name}</p>
                <p className="truncate text-sm text-gray-500">{user.email}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col">
        <header className="sticky top-0 z-10 flex h-16 items-center gap-4 border-b bg-card px-6">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-6 w-6" />
          </Button>
          <div className="flex-1"></div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          >
            {theme === "dark" ? (
              <Sun className="h-5 w-5" />
            ) : (
              <Moon className="h-5 w-5" />
            )}
          </Button>
        </header>
        <main className="flex-1 p-4">
          {currentPageName === "Settings" ? (
            <Settings 
              onSaveCustomization={handleSaveCustomization} 
              tenant={tenant}
              customization={customization}
            />
          ) : (
            children
          )}
        </main>
      </div>
    </div>
  );
}