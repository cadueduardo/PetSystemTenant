
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { User } from "@/api/entities";
import { Tenant } from "@/api/entities";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/use-toast";
import {
  Loader2, 
  Users, 
  ArrowLeft, 
  Search, 
  Lock, 
  ShieldCheck, 
  Key,
  Settings as SettingsIcon,
  Building,
  AlertCircle,
  BarChart
} from "lucide-react";

import TenantDetails from "../components/admin/TenantDetails";
import TenantForm from "../components/admin/TenantForm";
import UsageStatistics from "../components/admin/UsageStatistics";

export default function Admin() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [adminMode, setAdminMode] = useState(true); // Presumindo que é um admin
  const [activeTab, setActiveTab] = useState("tenants");
  const [showNewTenantForm, setShowNewTenantForm] = useState(false);
  const [selectedTenant, setSelectedTenant] = useState(null);
  const [tenants, setTenants] = useState([]);
  const [isLoadingTenants, setIsLoadingTenants] = useState(false);
  const [tenantSearchTerm, setTenantSearchTerm] = useState("");

  useEffect(() => {
    // Simulando verificação de admin
    setIsLoading(false);
    loadTenants(); // Carrega os tenants ao iniciar
  }, []);

  const loadTenants = async () => {
    setIsLoadingTenants(true);
    try {
      // Tenta carregar os tenants, se houver
      let tenantsData = [];
      try {
        tenantsData = await Tenant.list();
      } catch(e) {
        console.log("Erro ao buscar tenants, possivelmente não existem: ", e);
        // Não precisamos tratar este erro, apenas inicializamos como array vazio
      }
      setTenants(tenantsData || []);
    } catch (error) {
      console.error("Erro ao carregar tenants:", error);
      toast({
        title: "Erro ao carregar clínicas",
        description: "Não foi possível carregar a lista de clínicas.",
        variant: "destructive"
      });
    } finally {
      setIsLoadingTenants(false);
    }
  };

  const handleTenantCreated = (newTenant) => {
    setShowNewTenantForm(false);
    loadTenants();
    toast({
      title: "Tenant criado com sucesso",
      description: "A nova clinica foi adicionada à plataforma."
    });
  };

  const handleStatusChange = async (id, status) => {
    try {
      const tenant = tenants.find(t => t.id === id);
      if (tenant) {
        await Tenant.update(id, { ...tenant, status });
        loadTenants();
        return true;
      }
      return false;
    } catch (error) {
      console.error("Erro ao atualizar status:", error);
      return false;
    }
  };

  const filteredTenants = tenants.filter(tenant => 
    tenant.company_name.toLowerCase().includes(tenantSearchTerm.toLowerCase()) ||
    (tenant.legal_name && tenant.legal_name.toLowerCase().includes(tenantSearchTerm.toLowerCase())) ||
    (tenant.email && tenant.email.toLowerCase().includes(tenantSearchTerm.toLowerCase()))
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-12 w-12 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6">
      <div className="flex items-center gap-4 mb-6">
        <Button
          variant="outline"
          size="icon"
          onClick={() => navigate(createPageUrl("Landing"))}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Administração</h1>
          <p className="text-gray-500">Gerenciamento Multi-Tenant</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="tenants" className="flex items-center">
            <Building className="mr-2 h-4 w-4" />
            Clinicas e Petshops
          </TabsTrigger>
          <TabsTrigger value="users" className="flex items-center">
            <Users className="mr-2 h-4 w-4" />
            Usuários
          </TabsTrigger>
          <TabsTrigger value="analytics" className="flex items-center">
            <BarChart className="mr-2 h-4 w-4" />
            Analytics
          </TabsTrigger>
          <TabsTrigger value="settings" className="flex items-center">
            <SettingsIcon className="mr-2 h-4 w-4" />
            Configurações
          </TabsTrigger>
        </TabsList>

        <TabsContent value="tenants">
          {showNewTenantForm ? (
            <Card>
              <CardHeader>
                <CardTitle>Novo Tenant</CardTitle>
                <CardDescription>Adicionar uma nova clinica ou petshop à plataforma</CardDescription>
              </CardHeader>
              <CardContent>
                <TenantForm 
                  onCancel={() => setShowNewTenantForm(false)}
                  onSuccess={handleTenantCreated}
                />
              </CardContent>
            </Card>
          ) : selectedTenant ? (
            <TenantDetails 
              tenantId={selectedTenant} 
              onBack={() => setSelectedTenant(null)}
              onStatusChange={handleStatusChange}
            />
          ) : (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <div className="relative w-full md:w-64">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
                  <Input
                    type="search"
                    placeholder="Buscar clinicas..."
                    className="pl-8"
                    value={tenantSearchTerm}
                    onChange={(e) => setTenantSearchTerm(e.target.value)}
                  />
                </div>
                <Button onClick={() => setShowNewTenantForm(true)}>
                  Adicionar Nova Clinica
                </Button>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Clinicas e Petshops</CardTitle>
                  <CardDescription>Gerencie todas as clinicas e petshops da plataforma</CardDescription>
                </CardHeader>
                <CardContent>
                  {isLoadingTenants ? (
                    <div className="flex justify-center py-8">
                      <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                    </div>
                  ) : filteredTenants.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      {tenantSearchTerm ? "Nenhuma clínica encontrada com esses termos de busca." : "Nenhuma clínica cadastrada ainda."}
                    </div>
                  ) : (
                    <div className="divide-y">
                      {filteredTenants.map((tenant) => (
                        <div key={tenant.id} className="py-4 flex items-center justify-between">
                          <div>
                            <h3 className="font-medium">{tenant.company_name}</h3>
                            <div className="flex items-center gap-2 mt-1">
                              <p className="text-sm text-gray-500">ID: {tenant.id.substring(0, 10)}...</p>
                              <Badge className={
                                tenant.status === "active" ? "bg-green-100 text-green-800" :
                                tenant.status === "trial" ? "bg-blue-100 text-blue-800" :
                                tenant.status === "suspended" ? "bg-red-100 text-red-800" :
                                "bg-gray-100 text-gray-800"
                              }>
                                {tenant.status === "active" ? "Ativo" :
                                 tenant.status === "trial" ? "Trial" :
                                 tenant.status === "suspended" ? "Suspenso" :
                                 "Expirado"}
                              </Badge>
                            </div>
                          </div>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => setSelectedTenant(tenant.id)}
                          >
                            Gerenciar
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        <TabsContent value="users">
          <Card>
            <CardHeader>
              <CardTitle>Usuários</CardTitle>
              <CardDescription>Gerenciar usuários da plataforma</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex justify-between items-center mb-6">
                <div className="relative w-full md:w-64">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
                  <Input
                    type="search"
                    placeholder="Buscar usuários..."
                    className="pl-8"
                  />
                </div>
                <Button>
                  Adicionar Usuário
                </Button>
              </div>

              <div className="divide-y">
                {Array.from({ length: 5 }).map((_, index) => (
                  <div key={index} className="py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                        <span className="text-blue-600 font-medium">U{index + 1}</span>
                      </div>
                      <div>
                        <h3 className="font-medium">Usuário Exemplo {index + 1}</h3>
                        <p className="text-sm text-gray-500">usuario{index + 1}@exemplo.com</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={index % 2 === 0 ? "bg-green-100 text-green-800" : "bg-blue-100 text-blue-800"}>
                        {index % 2 === 0 ? "Admin" : "Usuário"}
                      </Badge>
                      <Button variant="outline" size="sm">
                        <ShieldCheck className="h-4 w-4 mr-2" />
                        Permissões
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics">
          <UsageStatistics />
        </TabsContent>

        <TabsContent value="settings">
          <Card>
            <CardHeader>
              <CardTitle>Configurações da Plataforma</CardTitle>
              <CardDescription>Configurações gerais do sistema multi-tenant</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-medium mb-4">Segurança</h3>
                  <div className="space-y-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-medium">Autenticação de Dois Fatores</h4>
                        <p className="text-sm text-gray-500">Requisitar autenticação de dois fatores para todos os usuários admin</p>
                      </div>
                      <Button variant="outline">
                        <Lock className="h-4 w-4 mr-2" />
                        Configurar
                      </Button>
                    </div>
                    <Separator />
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-medium">Gerenciamento de API Keys</h4>
                        <p className="text-sm text-gray-500">Gerenciar chaves de API para integração externa</p>
                      </div>
                      <Button variant="outline">
                        <Key className="h-4 w-4 mr-2" />
                        Gerenciar Keys
                      </Button>
                    </div>
                  </div>
                </div>

                <Separator />

                <div>
                  <h3 className="text-lg font-medium mb-4">Preferências</h3>
                  <div className="space-y-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-medium">Alertas e Notificações</h4>
                        <p className="text-sm text-gray-500">Configurar notificações do sistema administrativo</p>
                      </div>
                      <Button variant="outline">
                        Configurar
                      </Button>
                    </div>
                    <Separator />
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-medium">Período de Teste (Trial)</h4>
                        <p className="text-sm text-gray-500">Configurar duração e condições do período trial</p>
                      </div>
                      <Button variant="outline">
                        Configurar
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
