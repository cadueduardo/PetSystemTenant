import { Link, Outlet } from "react-router-dom";
import { LayoutGrid, FileBarChart2, Settings2 } from "lucide-react";

export default function AdminLayout() {
  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <div className="w-64 bg-white shadow-lg">
        <div className="p-4 border-b">
          <h2 className="text-xl font-bold text-gray-800">Administração</h2>
          <p className="text-sm text-gray-600">Gerenciamento Multi-tenant</p>
        </div>
        <nav className="p-4">
          <ul className="space-y-2">
            <li>
              <Link
                to="/admindashboard"
                className="flex items-center p-2 text-gray-700 rounded hover:bg-blue-50 hover:text-blue-700"
              >
                <LayoutGrid className="w-5 h-5 mr-3" />
                Dashboard
              </Link>
            </li>
            <li>
              <Link
                to="/admintools"
                className="flex items-center p-2 text-gray-700 rounded hover:bg-blue-50 hover:text-blue-700"
              >
                <Settings2 className="w-5 h-5 mr-3" />
                Ferramentas
              </Link>
            </li>
            <li>
              <Link
                to="/adminreports"
                className="flex items-center p-2 text-gray-700 rounded hover:bg-blue-50 hover:text-blue-700"
              >
                <FileBarChart2 className="w-5 h-5 mr-3" />
                Relatórios
              </Link>
            </li>
          </ul>
        </nav>
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