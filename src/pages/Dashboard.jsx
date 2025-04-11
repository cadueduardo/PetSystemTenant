import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import {
  CalendarCheck,
  Users,
  ShoppingBag,
  TrendingUp,
  Package,
  Clock,
  Loader2,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useTheme } from "next-themes";
// import { db } from '@/lib/firebaseConfig'; // Keep commented for now
// import { doc, getDoc } from "firebase/firestore"; // Keep commented for now
// import { getAuth } from "firebase/auth"; // Keep commented for now
// import { toast } from "@/components/ui/use-toast"; // Keep commented for now

/* // Keep getTenantDetails function commented out
async function getTenantDetails(tenantId) {
  if (!tenantId) return null;
  console.log(`[Firestore] Buscando detalhes do Tenant ID: ${tenantId}`);
  try {
    const docRef = doc(db, "tenants", tenantId); 
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      console.log("[Firestore] Tenant encontrado:", { id: docSnap.id, ...docSnap.data() });
      return { id: docSnap.id, ...docSnap.data() };
    } else {
      console.warn(`[Firestore] Tenant com ID ${tenantId} não encontrado.`);
      return null;
    }
  } catch (error) {
    console.error("[Firestore] Erro ao buscar Tenant:", error);
    throw new Error('Erro ao buscar informações da loja.'); 
  }
}
*/

export default function Dashboard() {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const [isLoading, setIsLoading] = useState(true); // Start as true
  const [tenantInfo, setTenantInfo] = useState(null);

  useEffect(() => {
    // <<< Reverted to original logic >>>
    setIsLoading(true); // Set loading at the beginning
    const urlParams = new URLSearchParams(window.location.search);
    let storeParam = urlParams.get('store');
    
    if (!storeParam) {
      storeParam = localStorage.getItem('current_tenant');
    }
    
    if (!storeParam) {
      console.warn("Dashboard: Tenant ID/store param not found. Redirecting...");
      // Decide where to redirect, maybe TenantLogin is better than Landing
      navigate(createPageUrl("TenantLogin")); 
      return;
    }
    
    // Ensure current_tenant is set in localStorage
    localStorage.setItem('current_tenant', storeParam); 

    // Get name from localStorage or use fallback
    const tenantName = localStorage.getItem('tenant_name') || 'PetClinic'; // Using fallback
    
    setTenantInfo({
      name: tenantName, // Use the potentially stale name or fallback
      accessUrl: storeParam // Use the ID as accessUrl for now
    });
    
    // Simulate loading or finish immediately
    // If you have other async operations, manage isLoading accordingly
    setIsLoading(false); // Set loading to false after setup

  }, [navigate]);

  if (isLoading) { // Check isLoading state
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div>
      <h2 className={`text-xl mb-6 ${theme === 'dark' ? 'text-gray-200' : 'text-gray-800'}`}>
        Bem-vindo ao painel de controle de {tenantInfo?.name || 'Loja'}
      </h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card className={theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white'}>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>Atendimentos</p>
                <p className={`text-2xl font-bold ${theme === 'dark' ? 'text-gray-100' : 'text-gray-900'}`}>24</p>
              </div>
              <div className={`p-3 rounded-full ${theme === 'dark' ? 'bg-blue-900/50' : 'bg-blue-100'}`}>
                <CalendarCheck className={`h-5 w-5 ${theme === 'dark' ? 'text-blue-400' : 'text-blue-600'}`} />
              </div>
            </div>
            <p className={`text-sm mt-2 flex items-center ${theme === 'dark' ? 'text-green-400' : 'text-green-600'}`}>
              <TrendingUp className="h-4 w-4 mr-1" />
              <span>18% mais que ontem</span>
            </p>
          </CardContent>
        </Card>

        <Card className={theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white'}>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>Clientes</p>
                <p className={`text-2xl font-bold ${theme === 'dark' ? 'text-gray-100' : 'text-gray-900'}`}>157</p>
              </div>
              <div className={`p-3 rounded-full ${theme === 'dark' ? 'bg-green-900/50' : 'bg-green-100'}`}>
                <Users className={`h-5 w-5 ${theme === 'dark' ? 'text-green-400' : 'text-green-600'}`} />
              </div>
            </div>
            <p className={`text-sm mt-2 flex items-center ${theme === 'dark' ? 'text-green-400' : 'text-green-600'}`}>
              <TrendingUp className="h-4 w-4 mr-1" />
              <span>3 novos hoje</span>
            </p>
          </CardContent>
        </Card>

        <Card className={theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white'}>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>Vendas</p>
                <p className={`text-2xl font-bold ${theme === 'dark' ? 'text-gray-100' : 'text-gray-900'}`}>R$ 3.240</p>
              </div>
              <div className={`p-3 rounded-full ${theme === 'dark' ? 'bg-purple-900/50' : 'bg-purple-100'}`}>
                <ShoppingBag className={`h-5 w-5 ${theme === 'dark' ? 'text-purple-400' : 'text-purple-600'}`} />
              </div>
            </div>
            <p className={`text-sm mt-2 flex items-center ${theme === 'dark' ? 'text-green-400' : 'text-green-600'}`}>
              <TrendingUp className="h-4 w-4 mr-1" />
              <span>12 vendas hoje</span>
            </p>
          </CardContent>
        </Card>

        <Card className={theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white'}>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>Serviços</p>
                <p className={`text-2xl font-bold ${theme === 'dark' ? 'text-gray-100' : 'text-gray-900'}`}>18</p>
              </div>
              <div className={`p-3 rounded-full ${theme === 'dark' ? 'bg-amber-900/50' : 'bg-amber-100'}`}>
                <Package className={`h-5 w-5 ${theme === 'dark' ? 'text-amber-400' : 'text-amber-600'}`} />
              </div>
            </div>
            <p className={`text-sm mt-2 flex items-center ${theme === 'dark' ? 'text-amber-400' : 'text-amber-600'}`}>
              <Clock className="h-4 w-4 mr-1" />
              <span>5 pendentes</span>
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className={theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white'}>
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className={`text-lg font-medium ${theme === 'dark' ? 'text-gray-100' : 'text-gray-900'}`}>
                  Próximas Consultas
                </h3>
                <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                  Consultas agendadas para hoje
                </p>
              </div>
            </div>
            <div className="space-y-4">
              <div className={`p-4 rounded-lg ${theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className={`font-medium ${theme === 'dark' ? 'text-gray-200' : 'text-gray-900'}`}>
                      Rex (Labrador)
                    </p>
                    <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                      Cliente: Maria Silva
                    </p>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-medium ${theme === 'dark' ? 'text-gray-200' : 'text-gray-900'}`}>
                      14:30
                    </p>
                    <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                      Dr. Carlos
                    </p>
                  </div>
                </div>
              </div>

              <div className={`p-4 rounded-lg ${theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className={`font-medium ${theme === 'dark' ? 'text-gray-200' : 'text-gray-900'}`}>
                      Nina (Persa)
                    </p>
                    <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                      Cliente: João Pereira
                    </p>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-medium ${theme === 'dark' ? 'text-gray-200' : 'text-gray-900'}`}>
                      15:00
                    </p>
                    <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                      Dra. Ana
                    </p>
                  </div>
                </div>
              </div>

              <div className={`p-4 rounded-lg ${theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className={`font-medium ${theme === 'dark' ? 'text-gray-200' : 'text-gray-900'}`}>
                      Luna (Poodle)
                    </p>
                    <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                      Cliente: Pedro Santos
                    </p>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-medium ${theme === 'dark' ? 'text-gray-200' : 'text-gray-900'}`}>
                      16:15
                    </p>
                    <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                      Dr. Carlos
                    </p>
                  </div>
                </div>
              </div>

              <a 
                href="#" 
                className={`block text-sm text-center ${
                  theme === 'dark' ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-700'
                }`}
              >
                Ver todas as consultas
              </a>
            </div>
          </div>
        </Card>

        <Card className={theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white'}>
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className={`text-lg font-medium ${theme === 'dark' ? 'text-gray-100' : 'text-gray-900'}`}>
                  Vendas Recentes
                </h3>
                <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                  Últimas transações realizadas
                </p>
              </div>
            </div>
            <div className="space-y-4">
              <div className={`p-4 rounded-lg ${theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className={`font-medium ${theme === 'dark' ? 'text-gray-200' : 'text-gray-900'}`}>
                      Venda #4872
                    </p>
                    <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                      Cliente: Ana Souza
                    </p>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-medium ${theme === 'dark' ? 'text-gray-200' : 'text-gray-900'}`}>
                      R$ 187,50
                    </p>
                    <span className={`inline-block px-2 py-1 text-xs rounded ${
                      theme === 'dark' ? 'bg-green-900 text-green-300' : 'bg-green-100 text-green-700'
                    }`}>
                      Pago
                    </span>
                  </div>
                </div>
              </div>

              <div className={`p-4 rounded-lg ${theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className={`font-medium ${theme === 'dark' ? 'text-gray-200' : 'text-gray-900'}`}>
                      Venda #4871
                    </p>
                    <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                      Cliente: Carlos Mendes
                    </p>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-medium ${theme === 'dark' ? 'text-gray-200' : 'text-gray-900'}`}>
                      R$ 97,30
                    </p>
                    <span className={`inline-block px-2 py-1 text-xs rounded ${
                      theme === 'dark' ? 'bg-yellow-900 text-yellow-300' : 'bg-yellow-100 text-yellow-700'
                    }`}>
                      Crédito
                    </span>
                  </div>
                </div>
              </div>

              <div className={`p-4 rounded-lg ${theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className={`font-medium ${theme === 'dark' ? 'text-gray-200' : 'text-gray-900'}`}>
                      Venda #4870
                    </p>
                    <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                      Cliente: Julia Lima
                    </p>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-medium ${theme === 'dark' ? 'text-gray-200' : 'text-gray-900'}`}>
                      R$ 254,99
                    </p>
                    <span className={`inline-block px-2 py-1 text-xs rounded ${
                      theme === 'dark' ? 'bg-green-900 text-green-300' : 'bg-green-100 text-green-700'
                    }`}>
                      Pago
                    </span>
                  </div>
                </div>
              </div>

              <a 
                href="#" 
                className={`block text-sm text-center ${
                  theme === 'dark' ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-700'
                }`}
              >
                Ver histórico completo
              </a>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
