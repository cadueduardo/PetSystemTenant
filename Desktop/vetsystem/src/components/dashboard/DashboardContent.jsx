import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { createPageUrl } from "@/utils";
import { useNavigate } from "react-router-dom";
import {
  User,
  CalendarClock,
  PiggyBank,
  Clipboard,
  TrendingUp,
  Package,
  ShoppingBag,
  Truck,
  ArrowRight,
  FileText,
  AreaChart,
  DollarSign,
  PawPrint
} from "lucide-react";

export default function DashboardContent({ tenant, user, customization, storeParam }) {
  const navigate = useNavigate();
  
  const getStoreUrl = (pageName) => {
    return createPageUrl(`${pageName}?store=${storeParam || 'demo'}`);
  };
  
  const hasClinicAccess = () => {
    if (tenant?.selected_modules) {
      return tenant.selected_modules.includes('clinic_management');
    }
    return false;
  };
  
  const hasPetshopAccess = () => {
    if (tenant?.selected_modules) {
      return tenant.selected_modules.includes('petshop');
    }
    return false;
  };
  
  const hasFinancialAccess = () => {
    if (tenant?.selected_modules) {
      return tenant.selected_modules.includes('financial');
    }
    return false;
  };
  
  const hasTransportAccess = () => {
    if (tenant?.selected_modules) {
      return tenant.selected_modules.includes('transport');
    }
    return false;
  };

  const quickStats = [
    {
      title: "Clientes Ativos",
      value: "346",
      trend: "+14%",
      trendUp: true,
      icon: <User className="h-5 w-5 text-blue-600" />
    },
    {
      title: "Agendamentos",
      value: "24",
      subtitle: "Próximos 7 dias",
      icon: <CalendarClock className="h-5 w-5 text-purple-600" />
    },
    {
      title: "Faturamento",
      value: "R$ 21.234",
      trend: "+5%",
      trendUp: true,
      subtitle: "Mês atual",
      icon: <PiggyBank className="h-5 w-5 text-green-600" />
    },
    {
      title: "Pets Atendidos",
      value: "1.428",
      subtitle: "Total",
      icon: <PawPrint className="h-5 w-5 text-amber-600" />
    }
  ];

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {quickStats.map((stat, index) => (
          <Card key={index}>
            <CardContent className="p-6">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm font-medium text-gray-500">{stat.title}</p>
                  <div className="flex items-baseline mt-1">
                    <p className="text-2xl font-bold">{stat.value}</p>
                    {stat.trend && (
                      <p className={`ml-2 text-xs font-medium ${stat.trendUp ? 'text-green-600' : 'text-red-600'}`}>
                        {stat.trend}
                      </p>
                    )}
                  </div>
                  {stat.subtitle && <p className="text-xs text-gray-500 mt-1">{stat.subtitle}</p>}
                </div>
                <div className="p-3 bg-gray-100 rounded-full">
                  {stat.icon}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Clientes e pets */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex justify-between items-center">
              <div>
                <CardTitle>Clientes e Pets</CardTitle>
                <CardDescription>Gerencie suas informações de clientes</CardDescription>
              </div>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => navigate(getStoreUrl("Customers"))}
              >
                Ver todos
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center p-3 rounded-lg border hover:bg-gray-50">
                <div className="p-2 bg-blue-100 rounded-full mr-3">
                  <User className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="font-medium">Gerenciar Clientes</p>
                  <p className="text-sm text-gray-500">Cadastre e edite informações de clientes</p>
                </div>
              </div>

              <div className="flex items-center p-3 rounded-lg border hover:bg-gray-50">
                <div className="p-2 bg-amber-100 rounded-full mr-3">
                  <PawPrint className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <p className="font-medium">Gerenciar Pets</p>
                  <p className="text-sm text-gray-500">Visualize e edite informações dos pets</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Agenda */}
        {(hasClinicAccess() || hasPetshopAccess()) && (
          <Card>
            <CardHeader className="pb-2">
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>Agenda</CardTitle>
                  <CardDescription>
                    {hasClinicAccess() ? "Consultas e atendimentos" : "Serviços e atendimentos"}
                  </CardDescription>
                </div>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => navigate(getStoreUrl("Calendar"))}
                >
                  Ver agenda
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center p-3 rounded-lg border hover:bg-gray-50">
                  <div className="p-2 bg-purple-100 rounded-full mr-3">
                    <CalendarClock className="h-5 w-5 text-purple-600" />
                  </div>
                  <div>
                    <p className="font-medium">
                      {hasClinicAccess() ? "Agendar Consultas" : "Agendar Serviços"}
                    </p>
                    <p className="text-sm text-gray-500">
                      {hasClinicAccess() 
                        ? "Consultas, exames e cirurgias" 
                        : "Banho, tosa e outros serviços"}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Financeiro */}
        {hasFinancialAccess() && (
          <Card>
            <CardHeader className="pb-2">
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>Financeiro</CardTitle>
                  <CardDescription>Gestão financeira do negócio</CardDescription>
                </div>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => navigate(getStoreUrl("Financial"))}
                >
                  Ver financeiro
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center p-3 rounded-lg border hover:bg-gray-50">
                  <div className="p-2 bg-green-100 rounded-full mr-3">
                    <DollarSign className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <p className="font-medium">Fluxo de Caixa</p>
                    <p className="text-sm text-gray-500">Acompanhe entradas e saídas</p>
                  </div>
                </div>

                <div className="flex items-center p-3 rounded-lg border hover:bg-gray-50">
                  <div className="p-2 bg-orange-100 rounded-full mr-3">
                    <AreaChart className="h-5 w-5 text-orange-600" />
                  </div>
                  <div>
                    <p className="font-medium">Relatórios</p>
                    <p className="text-sm text-gray-500">Análise financeira detalhada</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Pet Shop */}
        {hasPetshopAccess() && (
          <Card>
            <CardHeader className="pb-2">
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>Pet Shop</CardTitle>
                  <CardDescription>Gestão de produtos e vendas</CardDescription>
                </div>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => navigate(getStoreUrl("Sales"))}
                >
                  Ver vendas
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center p-3 rounded-lg border hover:bg-gray-50">
                  <div className="p-2 bg-pink-100 rounded-full mr-3">
                    <Package className="h-5 w-5 text-pink-600" />
                  </div>
                  <div>
                    <p className="font-medium">Produtos</p>
                    <p className="text-sm text-gray-500">Gerenciar estoque e produtos</p>
                  </div>
                </div>

                <div className="flex items-center p-3 rounded-lg border hover:bg-gray-50">
                  <div className="p-2 bg-indigo-100 rounded-full mr-3">
                    <ShoppingBag className="h-5 w-5 text-indigo-600" />
                  </div>
                  <div>
                    <p className="font-medium">Vendas</p>
                    <p className="text-sm text-gray-500">Realizar e consultar vendas</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Transporte */}
        {hasTransportAccess() && (
          <Card>
            <CardHeader className="pb-2">
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>Leva e Traz</CardTitle>
                  <CardDescription>Serviço de transporte</CardDescription>
                </div>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => navigate(getStoreUrl("TransportServices"))}
                >
                  Ver transporte
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center p-3 rounded-lg border hover:bg-gray-50">
                  <div className="p-2 bg-cyan-100 rounded-full mr-3">
                    <Truck className="h-5 w-5 text-cyan-600" />
                  </div>
                  <div>
                    <p className="font-medium">Agendar Transporte</p>
                    <p className="text-sm text-gray-500">Solicitar serviço de leva e traz</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}