import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { TransportService } from "@/api/entities";
import { TransportZonePricing } from "@/api/entities";
import { TransportDriver } from "@/api/entities";
import { TransportVehicle } from "@/api/entities";
import { TransportRoute } from "@/api/entities";
import { Customer } from "@/api/entities";
import { Pet } from "@/api/entities";
import { User } from "@/api/entities";
import { Tenant } from "@/api/entities";
import { Appointment } from "@/api/entities";
import { toast } from "@/components/ui/use-toast";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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
  BarChart,
  PlusCircle,
  ArrowRight,
  Home,
  ExternalLink,
  Eye,
  Pencil,
  Plus,
  Stethoscope,
  ShoppingBag,
  DollarSign,
  Truck,
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";

import TenantDetails from "../components/admin/TenantDetails";
import TenantForm from "../components/admin/TenantForm";

export default function GerenciamentoMultiTenant() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("tenants");
  const [showNewTenantForm, setShowNewTenantForm] = useState(false);
  const [selectedTenant, setSelectedTenant] = useState(null);
  const [tenants, setTenants] = useState([]);
  const [isLoadingTenants, setIsLoadingTenants] = useState(false);
  const [tenantSearchTerm, setTenantSearchTerm] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const tenantsData = await Tenant.list().catch(() => []);
      setTenants(tenantsData || []);
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
      toast({
        title: "Erro ao carregar dados",
        description: "Não foi possível carregar a lista de clínicas.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleTenantCreated = (newTenant) => {
    setShowNewTenantForm(false);
    loadData();
    toast({
      title: "Tenant criado com sucesso",
      description: "A nova clínica foi adicionada à plataforma."
    });
  };

  const handleStatusChange = async (id, status) => {
    try {
      const tenant = tenants.find(t => t.id === id);
      if (tenant) {
        await Tenant.update(id, { ...tenant, status });
        loadData();
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

  const TenantsTab = () => {
    const [showModuleEditor, setShowModuleEditor] = useState(false);
    const [editingTenant, setEditingTenant] = useState(null);
    const [editingModules, setEditingModules] = useState({
      clinic_management: false,
      petshop: false,
      financial: false,
      transport: false,
    });
    const [isLoading, setIsLoading] = useState(false);

    const handleEditModules = async (tenant) => {
      try {
        setEditingTenant(tenant);
        setShowModuleEditor(true);

        setEditingModules({
          clinic_management: tenant.selected_modules.includes("clinic_management"),
          petshop: tenant.selected_modules.includes("petshop"),
          financial: tenant.selected_modules.includes("financial"),
          transport: tenant.selected_modules.includes("transport"),
        });
      } catch (error) {
        console.error("Erro ao editar módulos:", error);
      }
    };

    const handleSaveModules = async () => {
      try {
        setIsLoading(true);

        const updatedModules = Object.entries(editingModules)
          .filter(([_, isSelected]) => isSelected)
          .map(([moduleName]) => moduleName);

        if (updatedModules.length === 0) {
          toast({
            title: "Erro",
            description: "Selecione pelo menos um módulo",
            variant: "destructive"
          });
          setIsLoading(false);
          return;
        }

        await Tenant.update(editingTenant.id, {
          selected_modules: updatedModules
        });

        toast({
          title: "Sucesso",
          description: "Módulos atualizados com sucesso"
        });

        await loadData();
        setShowModuleEditor(false);
        setEditingTenant(null);
      } catch (error) {
        console.error("Erro ao salvar módulos:", error);
        toast({
          title: "Erro",
          description: "Não foi possível atualizar os módulos",
          variant: "destructive"
        });
      } finally {
        setIsLoading(false);
      }
    };

    const handleToggleModule = (module) => {
      setEditingModules(prev => ({
        ...prev,
        [module]: !prev[module]
      }));
    };

    return (
      <div>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID/URL</TableHead>
                <TableHead>Empresa</TableHead>
                <TableHead>Tipo de Negócio</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Módulos</TableHead>
                <TableHead>Plano</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTenants.map((tenant) => (
                <TableRow key={tenant.id}>
                  <TableCell className="font-medium">
                    <div className="text-sm font-medium">
                      {tenant.id.substring(0, 8)}...
                    </div>
                    {tenant.access_url && (
                      <div className="text-xs text-gray-500">
                        <span className="font-mono bg-gray-100 px-1 rounded">
                          /{tenant.access_url}
                        </span>
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <div>{tenant.company_name}</div>
                    <div className="text-xs text-gray-500">{tenant.email}</div>
                  </TableCell>
                  <TableCell>
                    {tenant.business_type === "clinic" ? "Clínica" : 
                     tenant.business_type === "petshop" ? "Petshop" : 
                     "Clínica e Petshop"}
                  </TableCell>
                  <TableCell>
                    <Badge
                      className={
                        tenant.status === "active" ? "bg-green-100 text-green-800" : 
                        tenant.status === "suspended" ? "bg-red-100 text-red-800" : 
                        "bg-gray-100 text-gray-800"
                      }
                    >
                      {tenant.status === "active" ? "Ativo" : 
                       tenant.status === "suspended" ? "Suspenso" : 
                       "Expirado"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {tenant.selected_modules?.includes("clinic_management") && (
                        <Badge variant="outline" className="bg-blue-50 text-blue-800 border-blue-200">
                          Clínica
                        </Badge>
                      )}
                      {tenant.selected_modules?.includes("petshop") && (
                        <Badge variant="outline" className="bg-green-50 text-green-800 border-green-200">
                          Petshop
                        </Badge>
                      )}
                      {tenant.selected_modules?.includes("financial") && (
                        <Badge variant="outline" className="bg-purple-50 text-purple-800 border-purple-200">
                          Financeiro
                        </Badge>
                      )}
                      {tenant.selected_modules?.includes("transport") && (
                        <Badge variant="outline" className="bg-amber-50 text-amber-800 border-amber-200">
                          Leva e Traz
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {tenant.payment_plan === "monthly" ? "Mensal" : 
                     tenant.payment_plan === "quarterly" ? "Trimestral" : 
                     tenant.payment_plan === "biannual" ? "Semestral" : 
                     tenant.payment_plan === "annual" ? "Anual" : "N/A"}
                  </TableCell>
                  <TableCell>
                    <div className="flex space-x-2">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => handleEditTenant(tenant)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => handleEditModules(tenant)}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {showModuleEditor && editingTenant && (
          <Dialog open={showModuleEditor} onOpenChange={setShowModuleEditor}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Editar Módulos</DialogTitle>
                <DialogDescription>
                  Gerencie os módulos contratados para {editingTenant.company_name}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="flex items-start space-x-3 p-4 rounded-lg border hover:bg-gray-50 transition-colors">
                  <Checkbox 
                    id="clinic_management" 
                    checked={editingModules.clinic_management} 
                    onCheckedChange={() => handleToggleModule("clinic_management")}
                  />
                  <div>
                    <label htmlFor="clinic_management" className="text-sm font-medium flex items-center cursor-pointer">
                      <Stethoscope className="h-5 w-5 mr-2 text-blue-600" />
                      Gestão Clínica Veterinária
                    </label>
                    <p className="text-sm text-gray-500 mt-1">
                      Gerenciamento completo para clínicas veterinárias
                    </p>
                  </div>
                </div>

                <div className="flex items-start space-x-3 p-4 rounded-lg border hover:bg-gray-50 transition-colors">
                  <Checkbox 
                    id="petshop" 
                    checked={editingModules.petshop}
                    onCheckedChange={() => handleToggleModule("petshop")}
                  />
                  <div>
                    <label htmlFor="petshop" className="text-sm font-medium flex items-center cursor-pointer">
                      <ShoppingBag className="h-5 w-5 mr-2 text-green-600" />
                      Petshop
                    </label>
                    <p className="text-sm text-gray-500 mt-1">
                      Gerencie serviços de banho e tosa, vendas de produtos
                    </p>
                  </div>
                </div>

                <div className="flex items-start space-x-3 p-4 rounded-lg border hover:bg-gray-50 transition-colors">
                  <Checkbox 
                    id="financial" 
                    checked={editingModules.financial}
                    onCheckedChange={() => handleToggleModule("financial")}
                  />
                  <div>
                    <label htmlFor="financial" className="text-sm font-medium flex items-center cursor-pointer">
                      <DollarSign className="h-5 w-5 mr-2 text-purple-600" />
                      Financeiro
                    </label>
                    <p className="text-sm text-gray-500 mt-1">
                      Controle financeiro completo
                    </p>
                  </div>
                </div>

                <div className="flex items-start space-x-3 p-4 rounded-lg border hover:bg-gray-50 transition-colors">
                  <Checkbox 
                    id="transport" 
                    checked={editingModules.transport}
                    onCheckedChange={() => handleToggleModule("transport")}
                  />
                  <div>
                    <label htmlFor="transport" className="text-sm font-medium flex items-center cursor-pointer">
                      <Truck className="h-5 w-5 mr-2 text-amber-600" />
                      Leva e Traz
                    </label>
                    <p className="text-sm text-gray-500 mt-1">
                      Gestão de serviço de transporte de pets
                    </p>
                  </div>
                </div>
              </div>
              <DialogFooter className="sm:justify-between">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setShowModuleEditor(false)}
                >
                  Cancelar
                </Button>
                <Button
                  type="button"
                  onClick={handleSaveModules}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    "Salvar Alterações"
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>
    );
  };

  return (
    <div className="container mx-auto py-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="icon"
            onClick={() => navigate(createPageUrl("DashboardMultiTenant"))}
          >
            <Home className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Gerenciamento Multi-Tenant</h1>
            <p className="text-gray-500">Administração de clínicas e petshops</p>
          </div>
        </div>
        <Button 
          variant="outline" 
          onClick={() => navigate(createPageUrl("Landing"))}
        >
          Voltar para Landing Page
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="tenants" className="flex items-center">
            <Building className="mr-2 h-4 w-4" />
            Clínicas e Petshops
          </TabsTrigger>
          <TabsTrigger value="users" className="flex items-center">
            <Users className="mr-2 h-4 w-4" />
            Usuários
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
                <CardDescription>Adicionar uma nova clínica ou petshop à plataforma</CardDescription>
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
            <TenantsTab />
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
                  <PlusCircle className="h-4 w-4 mr-2" />
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
