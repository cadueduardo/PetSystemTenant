import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Tenant } from "@/api/entities";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowRight, Building, CheckCircle, Package, ShoppingBag, Stethoscope, Users } from "lucide-react";

export default function DashboardMultiTenant() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [tenants, setTenants] = useState([]);

  useEffect(() => {
    console.log("DashboardMultiTenant - Inicializando...");
    const loadData = async () => {
      try {
        console.log("DashboardMultiTenant - Carregando dados...");
        // Buscando todos os tenants
        let tenantData = [];
        try {
          tenantData = await Tenant.list();
          console.log("DashboardMultiTenant - Tenants carregados:", tenantData);
          setTenants(tenantData);
        } catch (error) {
          console.error("Erro ao carregar tenants:", error);
          // Continuar mesmo com erro (pode ser que não tenha permissão)
        }
      } catch (error) {
        console.error("Erro geral:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, []);

  // Função para exibir o status do tenant em português
  const getStatusDisplay = (status) => {
    const statusMap = {
      active: "Ativo",
      suspended: "Suspenso",
      trial: "Em teste",
      expired: "Expirado",
      converted: "Convertido"
    };
    return statusMap[status] || status;
  };

  // Função para exibir o tipo de negócio em português
  const getBusinessTypeDisplay = (type) => {
    const typeMap = {
      clinic: "Clínica Veterinária",
      petshop: "Pet Shop",
      both: "Clínica e Pet Shop"
    };
    return typeMap[type] || type;
  };

  // Mock de dados para demonstração, caso não obtenha dados reais
  const demoTenants = [
    {
      id: "demo-tenant-1",
      company_name: "Clínica Pet Vida",
      business_type: "clinic",
      status: "active",
      access_url: "petvida",
      selected_modules: ["clinic_management", "financial"]
    },
    {
      id: "demo-tenant-2",
      company_name: "Petshop Amigo Fiel",
      business_type: "petshop",
      status: "active",
      access_url: "amigofiel",
      selected_modules: ["petshop", "financial"]
    },
    {
      id: "demo-tenant-3",
      company_name: "Centro Veterinário Total",
      business_type: "both",
      status: "trial",
      access_url: "vetotal",
      selected_modules: ["clinic_management", "petshop", "financial", "transport"]
    }
  ];

  // Use dados mock caso não haja dados reais
  const displayTenants = tenants.length > 0 ? tenants : demoTenants;

  // Renderização com dados demo
  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-2xl font-bold">Painel Administrativo Multi-Tenant</h1>
          <Button 
            onClick={() => navigate(createPageUrl("AdminTools"))}
            className="bg-blue-600 hover:bg-blue-700"
          >
            Ferramentas Administrativas
          </Button>
        </div>

        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building className="h-6 w-6 text-blue-600" />
                Lojas Ativas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4">
                {displayTenants.map(tenant => (
                  <div key={tenant.id} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold text-lg">{tenant.company_name}</h3>
                        <div className="flex flex-wrap gap-2 mt-1">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            {getBusinessTypeDisplay(tenant.business_type)}
                          </span>
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            tenant.status === 'active' ? 'bg-green-100 text-green-800' : 
                            tenant.status === 'trial' ? 'bg-amber-100 text-amber-800' : 
                            'bg-red-100 text-red-800'
                          }`}>
                            {getStatusDisplay(tenant.status)}
                          </span>
                        </div>
                        <div className="mt-3">
                          <p className="text-sm text-gray-500">
                            <span className="font-medium text-gray-700">URL de acesso:</span> {tenant.access_url}
                          </p>
                          <p className="text-sm text-gray-500 mt-1">
                            <span className="font-medium text-gray-700">Módulos ativos:</span>
                          </p>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {tenant.selected_modules && tenant.selected_modules.includes("clinic_management") && (
                              <span className="inline-flex items-center px-2 py-0.5 text-xs bg-indigo-50 text-indigo-700 rounded">
                                <Stethoscope className="h-3 w-3 mr-1" /> Clínica
                              </span>
                            )}
                            {tenant.selected_modules && tenant.selected_modules.includes("petshop") && (
                              <span className="inline-flex items-center px-2 py-0.5 text-xs bg-green-50 text-green-700 rounded">
                                <ShoppingBag className="h-3 w-3 mr-1" /> Petshop
                              </span>
                            )}
                            {tenant.selected_modules && tenant.selected_modules.includes("financial") && (
                              <span className="inline-flex items-center px-2 py-0.5 text-xs bg-purple-50 text-purple-700 rounded">
                                <Package className="h-3 w-3 mr-1" /> Financeiro
                              </span>
                            )}
                            {tenant.selected_modules && tenant.selected_modules.includes("transport") && (
                              <span className="inline-flex items-center px-2 py-0.5 text-xs bg-amber-50 text-amber-700 rounded">
                                <Package className="h-3 w-3 mr-1" /> Transporte
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <Button 
                        onClick={() => {
                          const url = tenant.access_url ? 
                            createPageUrl(`Dashboard?store=${tenant.access_url}`) : 
                            createPageUrl("Dashboard");
                          console.log("Navegando para:", url);
                          navigate(url);
                        }}
                        className="bg-blue-600 hover:bg-blue-700"
                      >
                        Acessar
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}