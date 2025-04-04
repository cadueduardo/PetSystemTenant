
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import {
  BarChart3,
  CalendarCheck,
  Users,
  ShoppingBag,
  TrendingUp,
  Package,
  Clock,
  CreditCard,
  Check,
  Truck,
  AlertTriangle,
  Calendar,
  Loader2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default function Dashboard() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [tenantInfo, setTenantInfo] = useState(null);
  const [selectedModules, setSelectedModules] = useState([]);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    let storeParam = urlParams.get('store');
    
    if (!storeParam) {
      storeParam = localStorage.getItem('current_tenant');
    }
    
    if (!storeParam) {
      navigate(createPageUrl("Landing"));
      return;
    }
    
    localStorage.setItem('current_tenant', storeParam);
    
    const modules = JSON.parse(localStorage.getItem('tenant_modules') || '[]');
    const tenantName = localStorage.getItem('tenant_name') || 'PetClinic';
    
    setTenantInfo({
      name: tenantName,
      accessUrl: storeParam
    });
    
    setSelectedModules(modules);
    console.log("Módulos carregados:", modules);
    
    setIsLoading(false);
  }, [navigate]);

  const hasModule = (moduleNames) => {
    if (!Array.isArray(moduleNames)) {
      moduleNames = [moduleNames];
    }
    return moduleNames.some(module => selectedModules.includes(module));
  };

  const navigateTo = (page) => {
    const currentStore = localStorage.getItem('current_tenant');
    if (currentStore) {
      window.location.href = `/${page}?store=${currentStore}`;
    } else {
      navigate(createPageUrl("Landing"));
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-gray-500">
            Bem-vindo ao painel de controle de {tenantInfo?.name}
          </p>
        </div>
        <div className="flex mt-4 md:mt-0 gap-3">
          {hasModule('clinic_management') && (
            <Button 
              onClick={() => navigateTo("AppointmentForm")}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Calendar className="h-4 w-4 mr-2" />
              Nova Consulta
            </Button>
          )}
          {hasModule('petshop') && (
            <Button 
              variant="outline"
              onClick={() => navigateTo("Sales")}
            >
              <ShoppingBag className="h-4 w-4 mr-2" />
              Nova Venda
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm">Atendimentos</p>
                <p className="text-2xl font-bold">24</p>
              </div>
              <div className="p-3 bg-blue-100 rounded-full">
                <CalendarCheck className="h-5 w-5 text-blue-600" />
              </div>
            </div>
            <p className="text-sm text-green-600 mt-2 flex items-center">
              <TrendingUp className="h-4 w-4 mr-1" />
              <span>18% mais que ontem</span>
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm">Clientes</p>
                <p className="text-2xl font-bold">157</p>
              </div>
              <div className="p-3 bg-green-100 rounded-full">
                <Users className="h-5 w-5 text-green-600" />
              </div>
            </div>
            <p className="text-sm text-green-600 mt-2 flex items-center">
              <TrendingUp className="h-4 w-4 mr-1" />
              <span>3 novos hoje</span>
            </p>
          </CardContent>
        </Card>

        {hasModule('petshop') && (
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-500 text-sm">Vendas</p>
                  <p className="text-2xl font-bold">R$ 3.240</p>
                </div>
                <div className="p-3 bg-purple-100 rounded-full">
                  <ShoppingBag className="h-5 w-5 text-purple-600" />
                </div>
              </div>
              <p className="text-sm text-green-600 mt-2 flex items-center">
                <TrendingUp className="h-4 w-4 mr-1" />
                <span>12 vendas hoje</span>
              </p>
            </CardContent>
          </Card>
        )}

        {hasModule('petshop') && (
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-500 text-sm">Serviços</p>
                  <p className="text-2xl font-bold">18</p>
                </div>
                <div className="p-3 bg-amber-100 rounded-full">
                  <Package className="h-5 w-5 text-amber-600" />
                </div>
              </div>
              <p className="text-sm text-amber-600 mt-2 flex items-center">
                <Clock className="h-4 w-4 mr-1" />
                <span>5 pendentes</span>
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {hasModule('clinic_management') && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-medium">Próximas Consultas</CardTitle>
              <CardDescription>Consultas agendadas para hoje</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-start justify-between pb-3 border-b">
                  <div>
                    <p className="font-medium">Rex (Labrador)</p>
                    <p className="text-sm text-gray-500">Cliente: Maria Silva</p>
                  </div>
                  <div className="text-right">
                    <Badge className="mb-1 bg-blue-100 text-blue-800 hover:bg-blue-200">14:30</Badge>
                    <p className="text-sm text-gray-500">Dr. Carlos</p>
                  </div>
                </div>
                <div className="flex items-start justify-between pb-3 border-b">
                  <div>
                    <p className="font-medium">Nina (Persa)</p>
                    <p className="text-sm text-gray-500">Cliente: João Pereira</p>
                  </div>
                  <div className="text-right">
                    <Badge className="mb-1 bg-green-100 text-green-800 hover:bg-green-200">15:00</Badge>
                    <p className="text-sm text-gray-500">Dra. Ana</p>
                  </div>
                </div>
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium">Luna (Poodle)</p>
                    <p className="text-sm text-gray-500">Cliente: Pedro Santos</p>
                  </div>
                  <div className="text-right">
                    <Badge className="mb-1 bg-amber-100 text-amber-800 hover:bg-amber-200">16:15</Badge>
                    <p className="text-sm text-gray-500">Dr. Carlos</p>
                  </div>
                </div>
              </div>
              <Button 
                variant="link" 
                className="mt-4 p-0"
                onClick={() => navigateTo("Calendar")}
              >
                Ver todas as consultas
              </Button>
            </CardContent>
          </Card>
        )}

        {hasModule('petshop') && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-medium">Vendas Recentes</CardTitle>
              <CardDescription>Últimas transações realizadas</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-start justify-between pb-3 border-b">
                  <div>
                    <p className="font-medium">Venda #4872</p>
                    <p className="text-sm text-gray-500">Cliente: Ana Souza</p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">R$ 187,50</p>
                    <Badge className="bg-green-100 text-green-800 hover:bg-green-200">
                      <Check className="h-3 w-3 mr-1" />
                      Pago
                    </Badge>
                  </div>
                </div>
                <div className="flex items-start justify-between pb-3 border-b">
                  <div>
                    <p className="font-medium">Venda #4871</p>
                    <p className="text-sm text-gray-500">Cliente: Carlos Mendes</p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">R$ 97,30</p>
                    <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-200">
                      <CreditCard className="h-3 w-3 mr-1" />
                      Crédito
                    </Badge>
                  </div>
                </div>
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium">Venda #4870</p>
                    <p className="text-sm text-gray-500">Cliente: Julia Lima</p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">R$ 254,99</p>
                    <Badge className="bg-green-100 text-green-800 hover:bg-green-200">
                      <Check className="h-3 w-3 mr-1" />
                      Pago
                    </Badge>
                  </div>
                </div>
              </div>
              <Button 
                variant="link" 
                className="mt-4 p-0"
                onClick={() => navigateTo("SalesHistory")}
              >
                Ver histórico completo
              </Button>
            </CardContent>
          </Card>
        )}

        {hasModule('transport') && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-medium">Transporte de Pets</CardTitle>
              <CardDescription>Serviços de leva e traz agendados</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-start justify-between pb-3 border-b">
                  <div>
                    <p className="font-medium">Thor (Golden Retriever)</p>
                    <p className="text-sm text-gray-500">Cliente: Roberto Alves</p>
                  </div>
                  <div className="text-right">
                    <Badge className="mb-1 bg-blue-100 text-blue-800 hover:bg-blue-200">13:00</Badge>
                    <p className="text-sm text-gray-500 flex items-center justify-end">
                      <Truck className="h-3 w-3 mr-1" />
                      Ida e volta
                    </p>
                  </div>
                </div>
                <div className="flex items-start justify-between pb-3 border-b">
                  <div>
                    <p className="font-medium">Bella (Shih-tzu)</p>
                    <p className="text-sm text-gray-500">Cliente: Fernanda Costa</p>
                  </div>
                  <div className="text-right">
                    <Badge className="mb-1 bg-purple-100 text-purple-800 hover:bg-purple-200">15:30</Badge>
                    <p className="text-sm text-gray-500 flex items-center justify-end">
                      <Truck className="h-3 w-3 mr-1" />
                      Apenas ida
                    </p>
                  </div>
                </div>
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium">Simba (Maine Coon)</p>
                    <p className="text-sm text-gray-500">Cliente: Luciana Martins</p>
                  </div>
                  <div className="text-right">
                    <Badge className="mb-1 bg-amber-100 text-amber-800 hover:bg-amber-200">17:00</Badge>
                    <p className="text-sm text-gray-500 flex items-center justify-end">
                      <Truck className="h-3 w-3 mr-1" />
                      Apenas volta
                    </p>
                  </div>
                </div>
              </div>
              <Button 
                variant="link" 
                className="mt-4 p-0"
                onClick={() => navigateTo("TransportServices")}
              >
                Ver todos os transportes
              </Button>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-medium">Alertas e Pendências</CardTitle>
            <CardDescription>Itens que precisam de atenção</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {hasModule('petshop') && (
                <div className="flex items-start gap-3 pb-3 border-b">
                  <div className="p-2 bg-amber-100 rounded-full">
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                  </div>
                  <div>
                    <p className="font-medium">Estoque baixo</p>
                    <p className="text-sm text-gray-500">5 produtos estão com estoque abaixo do mínimo</p>
                  </div>
                </div>
              )}
              {hasModule('clinic_management') && (
                <div className="flex items-start gap-3 pb-3 border-b">
                  <div className="p-2 bg-blue-100 rounded-full">
                    <Calendar className="h-4 w-4 text-blue-600" />
                  </div>
                  <div>
                    <p className="font-medium">Consultas não confirmadas</p>
                    <p className="text-sm text-gray-500">3 consultas para amanhã ainda não foram confirmadas</p>
                  </div>
                </div>
              )}
              {hasModule('financial') && (
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-red-100 rounded-full">
                    <CreditCard className="h-4 w-4 text-red-600" />
                  </div>
                  <div>
                    <p className="font-medium">Pagamentos vencidos</p>
                    <p className="text-sm text-gray-500">2 contas a receber estão vencidas há mais de 7 dias</p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
