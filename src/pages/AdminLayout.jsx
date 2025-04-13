// import React from "react"; // Remove unused import
import { Link, Outlet, useNavigate } from "react-router-dom";
// Remove unused icons
// import { LayoutGrid, FileBarChart2, Settings2, LogOut } from "lucide-react"; 
import { LogOut, LayoutDashboard, Building, UserCog } from "lucide-react"; // Keep used icons
import { Button } from "@/components/ui/button";
import { getAuth, signOut } from "firebase/auth";
import { toast } from "@/components/ui/use-toast";
// import { useAuth } from '@/hooks/useAuth'; // REMOVE this import - Path is wrong

export default function AdminLayout() {
  const navigate = useNavigate();
  // const { user, claims } = useAuth(); // REMOVE - Need to find correct way to get user/claims
  // const isSuperAdmin = user && (!claims || claims.tenant_id === undefined || claims.tenant_id === null); // REMOVE - Depends on removed lines

  // TEMPORARY: Assume user is Super Admin for layout testing
  // TODO: Replace with actual Super Admin check
  const isSuperAdmin = true; 

  const handleLogout = async () => {
    const auth = getAuth();
    try {
      await signOut(auth);
      toast({
        title: "Logout realizado",
        description: "Você foi desconectado com sucesso."
      });
      navigate("/adminlogin");
    } catch (error) {
      console.error("Erro ao fazer logout:", error);
      toast({
        title: "Erro no Logout",
        description: "Não foi possível desconectar. Tente novamente.",
        variant: "destructive"
      });
    }
  };

  const sidebarNavItems = [
    {
      title: "Dashboard",
      href: "/admin/dashboard",
      icon: <LayoutDashboard className="h-4 w-4" />,
    },
    {
      title: "Gerenciar Tenants",
      href: "/admin/multitenant",
      icon: <Building className="h-4 w-4" />,
    },
    isSuperAdmin && { // This condition now uses the temporary variable
      title: "Cadastro de Perfil",
      href: "/admin/superadmins",
      icon: <UserCog className="h-4 w-4" />,
    },
  ].filter(Boolean);

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <div className="w-64 bg-white shadow-lg flex flex-col">
        <div className="p-4 border-b">
          <h2 className="text-xl font-bold text-gray-800">Administração</h2>
          <p className="text-sm text-gray-600">Gerenciamento Multi-tenant</p>
        </div>
        <nav className="p-4 flex-grow">
          <ul className="space-y-2">
            {sidebarNavItems.map((item) => (
              <li key={item.title}>
                <Link
                  to={item.href}
                  className="flex items-center p-2 text-gray-700 rounded hover:bg-blue-50 hover:text-blue-700"
                >
                  {item.icon}
                  {item.title}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="p-4 border-t">
          <Button 
            variant="ghost" 
            className="w-full justify-start text-red-600 hover:bg-red-50 hover:text-red-700" 
            onClick={handleLogout}
          >
            <LogOut className="w-5 h-5 mr-3" />
            Sair
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        {/* Header */}
        <header className="bg-white shadow-sm">
          <div className="px-4 py-3">
            <h1 className="text-lg font-semibold text-gray-900">Painel Administrativo</h1>
          </div>
        </header>

        {/* Page Content */}
        <main className="p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
} 