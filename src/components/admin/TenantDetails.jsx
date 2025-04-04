
import React, { useState, useEffect } from "react";
import { Tenant } from "@/api/entities";
import { TenantUser } from "@/api/entities";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { format } from "date-fns";
import {
  Building,
  Mail,
  Phone,
  Calendar,
  Users,
  Palette,
  Package,
  CheckCircle,
  XCircle,
  Clock,
  FileText,
  Loader2,
  DollarSign,
  User as UserIcon,
  ArrowLeft,
  Link as LinkIcon,
  Plus,
  PenSquare,
  Shield,
  AlertCircle,
  Save,
  ExternalLink,
  Trash2,
  ShoppingBag,
  Truck,
  Stethoscope
} from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import TenantUserForm from "./TenantUserForm";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export default function TenantDetails({ tenantId, onStatusChange, onClose, onBack }) {
  const [activeTab, setActiveTab] = useState("info");
  const [isLoading, setIsLoading] = useState(true);
  const [tenant, setTenant] = useState(null);
  const [tenantUsers, setTenantUsers] = useState([]);
  const [showNewUserForm, setShowNewUserForm] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [customization, setCustomization] = useState({
    company_logo_url: "",
    primary_color: "#4f46e5",
    secondary_color: "#eff6ff"
  });
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    if (tenantId) {
      loadTenantData();
    }
  }, [tenantId]);

  const loadTenantData = async () => {
    setIsLoading(true);
    try {
      const tenantData = await Tenant.get(tenantId);
      setTenant(tenantData);
      
      if (tenantData.customization) {
        setCustomization({
          company_logo_url: tenantData.customization.company_logo_url || "",
          primary_color: tenantData.customization.primary_color || "#4f46e5",
          secondary_color: tenantData.customization.secondary_color || "#eff6ff"
        });
      }

      try {
        const users = await TenantUser.filter({ tenant_id: tenantId });
        setTenantUsers(users);
      } catch (userError) {
        console.error("Erro ao carregar usuários do tenant:", userError);
        setTenantUsers([]);
      }
    } catch (error) {
      console.error("Erro ao carregar tenant:", error);
      toast({
        title: "Erro ao carregar dados",
        description: "Não foi possível carregar os detalhes da clínica.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleModuleChange = async (module, enabled) => {
    try {
      setIsUpdating(true);

      const currentModules = [...tenant.selected_modules || []];

      if (enabled && !currentModules.includes(module)) {
        currentModules.push(module);
      } else if (!enabled && currentModules.includes(module)) {
        const index = currentModules.indexOf(module);
        currentModules.splice(index, 1);
      }

      await Tenant.update(tenantId, { 
        selected_modules: currentModules 
      });

      setTenant({
        ...tenant,
        selected_modules: currentModules
      });

      toast({
        title: "Módulos atualizados",
        description: `Os módulos foram atualizados com sucesso.`
      });
    } catch (error) {
      console.error("Erro ao atualizar módulos:", error);
      toast({
        title: "Erro",
        description: "Não foi possível atualizar os módulos",
        variant: "destructive"
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const confirmDeleteUser = (user) => {
    setUserToDelete(user);
    setShowDeleteDialog(true);
  };

  const handleDeleteUser = async () => {
    if (!userToDelete) return;
    
    setIsLoading(true);
    try {
      await TenantUser.delete(userToDelete.id);
      
      toast({
        title: "Usuário removido",
        description: "O usuário foi removido com sucesso."
      });
      
      setTenantUsers(tenantUsers.filter(u => u.id !== userToDelete.id));
    } catch (error) {
      console.error("Erro ao remover usuário:", error);
      toast({
        title: "Erro ao remover usuário",
        description: "Não foi possível remover o usuário.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
      setShowDeleteDialog(false);
      setUserToDelete(null);
    }
  };

  if (isLoading) {
    return (
      <div className="p-8 text-center">
        <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-600" />
        <p>Carregando detalhes do tenant...</p>
      </div>
    );
  }

  if (!tenant) {
    return (
      <div className="p-8 text-center">
        <AlertCircle className="h-8 w-8 mx-auto mb-4 text-red-600" />
        <p>Não foi possível carregar os detalhes da clínica.</p>
        <Button 
          variant="outline" 
          className="mt-4"
          onClick={onBack || onClose}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar
        </Button>
      </div>
    );
  }

  const formatDate = (dateString) => {
    try {
      return format(new Date(dateString), "dd/MM/yyyy");
    } catch (error) {
      return "Data inválida";
    }
  };

  const getTrialInfo = () => {
    if (!tenant.trial_ends_at) {
      return <Badge className="bg-gray-100 text-gray-800">Sem informação de trial</Badge>;
    }

    const trialEndDate = new Date(tenant.trial_ends_at);
    const today = new Date();
    const daysLeft = Math.max(0, Math.ceil((trialEndDate - today) / (1000 * 60 * 60 * 24)));
    
    if (tenant.status === "active") {
      return <Badge className="bg-green-100 text-green-800">Assinatura Ativa</Badge>;
    } else if (tenant.status === "expired") {
      return <Badge className="bg-red-100 text-red-800">Trial Expirado</Badge>;
    } else if (daysLeft === 0) {
      return <Badge className="bg-amber-100 text-amber-800">Trial Termina Hoje</Badge>;
    } else {
      return (
        <Badge className="bg-blue-100 text-blue-800">
          {daysLeft} dias restantes
        </Badge>
      );
    }
  };

  const handleActivate = async () => {
    setIsLoading(true);
    try {
      const success = await onStatusChange(tenant.id, "active");
      if (success) {
        toast({
          title: "Tenant ativado",
          description: "O tenant foi ativado com sucesso."
        });
        setTenant({...tenant, status: "active"});
      } else {
        throw new Error("Falha ao atualizar status");
      }
    } catch (error) {
      console.error("Erro ao ativar tenant:", error);
      toast({
        title: "Erro ao ativar tenant",
        description: "Ocorreu um erro ao ativar o tenant.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSuspend = async () => {
    setIsLoading(true);
    try {
      const success = await onStatusChange(tenant.id, "suspended");
      if (success) {
        toast({
          title: "Tenant suspenso",
          description: "O tenant foi suspenso com sucesso."
        });
        setTenant({...tenant, status: "suspended"});
      } else {
        throw new Error("Falha ao atualizar status");
      }
    } catch (error) {
      console.error("Erro ao suspender tenant:", error);
      toast({
        title: "Erro ao suspender tenant",
        description: "Ocorreu um erro ao suspender o tenant.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const saveCustomization = async () => {
    setIsSaving(true);
    try {
      await Tenant.update(tenant.id, {
        ...tenant,
        customization
      });
      
      toast({
        title: "Personalização salva",
        description: "As configurações de personalização foram salvas com sucesso."
      });
      
      setTenant({...tenant, customization});
    } catch (error) {
      console.error("Erro ao salvar personalização:", error);
      toast({
        title: "Erro ao salvar personalização",
        description: "Ocorreu um erro ao salvar as configurações de personalização.",
        variant: "destructive"
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleUserCreated = async (newUser) => {
    setShowNewUserForm(false);
    setEditingUser(null);
    await loadTenantData();
    toast({
      title: "Usuário adicionado com sucesso",
      description: "O usuário foi adicionado à clínica."
    });
  };

  const ModuleStatusBadge = ({ isEnabled }) => (
    <span className={`text-xs font-medium rounded-full px-2 py-1 ${
      isEnabled 
        ? "bg-green-100 text-green-800" 
        : "bg-gray-100 text-gray-600"
    }`}>
      {isEnabled ? "Ativo" : "Inativo"}
    </span>
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <Button 
          variant="outline" 
          size="sm"
          onClick={onBack || onClose}
          className="mb-4"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar
        </Button>
      </div>
      
      <div className="flex flex-col lg:flex-row gap-6">
        <div className="lg:w-1/4">
          <div className="flex flex-col items-center p-6 bg-white rounded-lg shadow-sm border">
            <div className="w-24 h-24 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden mb-4">
              {tenant.customization?.company_logo_url ? (
                <img 
                  src={tenant.customization.company_logo_url} 
                  alt={tenant.company_name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <Building className="h-12 w-12 text-gray-400" />
              )}
            </div>
            <h2 className="text-xl font-bold text-center">{tenant.company_name}</h2>
            <p className="text-sm text-gray-500 text-center mt-1">{tenant.legal_name || tenant.company_name}</p>
            
            <div className="w-full mt-6 space-y-4">
              <div className="flex justify-center">
                {getTrialInfo()}
              </div>
              
              {tenant.access_url && (
                <div className="flex items-center justify-center">
                  <a 
                    href={tenant.access_url} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="text-blue-600 hover:text-blue-800 text-sm flex items-center gap-1"
                  >
                    <ExternalLink className="h-3 w-3" />
                    Acessar Interface
                  </a>
                </div>
              )}
              
              <div className="flex justify-center gap-2 mt-4">
                {tenant.status !== "active" && (
                  <Button
                    size="sm"
                    onClick={handleActivate}
                    disabled={isLoading}
                    className="flex items-center gap-1"
                  >
                    {isLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <CheckCircle className="h-4 w-4" />
                    )}
                    Ativar
                  </Button>
                )}
                
                {tenant.status !== "suspended" && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSuspend}
                    disabled={isLoading}
                    className="flex items-center gap-1 text-red-600 hover:text-red-700"
                  >
                    {isLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <XCircle className="h-4 w-4" />
                    )}
                    Suspender
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
        
        <div className="lg:w-3/4">
          <Card className="shadow-sm">
            <CardHeader className="pb-4">
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="w-full justify-start mb-0">
                  <TabsTrigger value="info" className="flex items-center gap-1">
                    <Building className="h-4 w-4" />
                    Informações
                  </TabsTrigger>
                  <TabsTrigger value="modules" className="flex items-center gap-1">
                    <Package className="h-4 w-4" />
                    Módulos
                  </TabsTrigger>
                  <TabsTrigger value="users" className="flex items-center gap-1">
                    <Users className="h-4 w-4" />
                    Usuários
                  </TabsTrigger>
                  <TabsTrigger value="customization" className="flex items-center gap-1">
                    <Palette className="h-4 w-4" />
                    Personalização
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </CardHeader>
            
            <CardContent>
              <TabsContent value="info" className="space-y-4 mt-0">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <div className="flex items-center gap-2 text-gray-700 bg-gray-50 p-2 rounded">
                      <Mail className="h-4 w-4 text-gray-500" />
                      {tenant.email || "Email não disponível"}
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Telefone</Label>
                    <div className="flex items-center gap-2 text-gray-700 bg-gray-50 p-2 rounded">
                      <Phone className="h-4 w-4 text-gray-500" />
                      {tenant.phone || "Telefone não disponível"}
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Tipo de Negócio</Label>
                    <div className="flex items-center gap-2 text-gray-700 bg-gray-50 p-2 rounded">
                      <Building className="h-4 w-4 text-gray-500" />
                      {tenant.business_type === "clinic" ? "Clínica Veterinária" : 
                       tenant.business_type === "petshop" ? "Petshop" : 
                       tenant.business_type === "both" ? "Clínica e Petshop" :
                       "Não especificado"}
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Data de Criação</Label>
                    <div className="flex items-center gap-2 text-gray-700 bg-gray-50 p-2 rounded">
                      <Calendar className="h-4 w-4 text-gray-500" />
                      {tenant.created_date ? formatDate(tenant.created_date) : "Data não disponível"}
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Término do Trial</Label>
                    <div className="flex items-center gap-2 text-gray-700 bg-gray-50 p-2 rounded">
                      <Clock className="h-4 w-4 text-gray-500" />
                      {tenant.trial_ends_at ? formatDate(tenant.trial_ends_at) : "Data não disponível"}
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Status</Label>
                    <div className="flex items-center gap-2 text-gray-700 bg-gray-50 p-2 rounded">
                      {tenant.status === "active" ? (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      ) : tenant.status === "trial" ? (
                        <Clock className="h-4 w-4 text-blue-500" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-500" />
                      )}
                      {tenant.status === "active" ? "Ativo" : 
                       tenant.status === "trial" ? "Em Trial" : 
                       tenant.status === "expired" ? "Expirado" : "Suspenso"}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>URL de Acesso</Label>
                    <div className="flex items-center gap-2 text-gray-700 bg-gray-50 p-2 rounded">
                      <LinkIcon className="h-4 w-4 text-gray-500" />
                      <a href={tenant.access_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                        {tenant.access_url || "URL não disponível"}
                      </a>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Limite de Usuários</Label>
                    <div className="flex items-center gap-2 text-gray-700 bg-gray-50 p-2 rounded">
                      <Users className="h-4 w-4 text-gray-500" />
                      {tenant.max_users || 5} usuários
                    </div>
                  </div>
                </div>
              </TabsContent>
              
              <TabsContent value="modules" className="mt-0">
                <Card className="mt-6">
                  <CardHeader>
                    <CardTitle>Módulos Contratados</CardTitle>
                    <CardDescription>Gerenciar acesso aos módulos do sistema</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex justify-between items-center p-3 border rounded-md">
                        <div className="flex items-center">
                          <Stethoscope className="h-5 w-5 text-blue-600 mr-3" />
                          <div>
                            <h3 className="font-medium">Gestão Clínica Veterinária</h3>
                            <p className="text-sm text-gray-500">
                              Prontuário médico, agendamento de consultas e hospitalização
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <ModuleStatusBadge isEnabled={tenant?.selected_modules?.includes("clinic_management")} />
                          <Switch 
                            checked={tenant?.selected_modules?.includes("clinic_management")} 
                            onCheckedChange={(checked) => handleModuleChange("clinic_management", checked)}
                            disabled={isUpdating || !tenant}
                          />
                        </div>
                      </div>

                      <div className="flex justify-between items-center p-3 border rounded-md">
                        <div className="flex items-center">
                          <ShoppingBag className="h-5 w-5 text-green-600 mr-3" />
                          <div>
                            <h3 className="font-medium">Petshop</h3>
                            <p className="text-sm text-gray-500">
                              Vendas, produtos, serviços de banho e tosa
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <ModuleStatusBadge isEnabled={tenant?.selected_modules?.includes("petshop")} />
                          <Switch 
                            checked={tenant?.selected_modules?.includes("petshop")} 
                            onCheckedChange={(checked) => handleModuleChange("petshop", checked)}
                            disabled={isUpdating || !tenant}
                          />
                        </div>
                      </div>

                      <div className="flex justify-between items-center p-3 border rounded-md">
                        <div className="flex items-center">
                          <DollarSign className="h-5 w-5 text-purple-600 mr-3" />
                          <div>
                            <h3 className="font-medium">Financeiro</h3>
                            <p className="text-sm text-gray-500">
                              Contas a pagar, contas a receber e fluxo de caixa
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <ModuleStatusBadge isEnabled={tenant?.selected_modules?.includes("financial")} />
                          <Switch 
                            checked={tenant?.selected_modules?.includes("financial")} 
                            onCheckedChange={(checked) => handleModuleChange("financial", checked)}
                            disabled={isUpdating || !tenant}
                          />
                        </div>
                      </div>

                      <div className="flex justify-between items-center p-3 border rounded-md">
                        <div className="flex items-center">
                          <Truck className="h-5 w-5 text-amber-600 mr-3" />
                          <div>
                            <h3 className="font-medium">Leva e Traz</h3>
                            <p className="text-sm text-gray-500">
                              Transporte de pets e gestão de rotas
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <ModuleStatusBadge isEnabled={tenant?.selected_modules?.includes("transport")} />
                          <Switch 
                            checked={tenant?.selected_modules?.includes("transport")} 
                            onCheckedChange={(checked) => handleModuleChange("transport", checked)}
                            disabled={isUpdating || !tenant}
                          />
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
              
              <TabsContent value="users" className="mt-0">
                {showNewUserForm || editingUser ? (
                  <TenantUserForm 
                    tenantId={tenant.id}
                    user={editingUser}
                    onCancel={() => {
                      setShowNewUserForm(false);
                      setEditingUser(null);
                    }}
                    onSuccess={handleUserCreated}
                  />
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Label className="text-lg">Usuários ({tenantUsers.length} de {tenant.max_users})</Label>
                      <Button 
                        size="sm"
                        onClick={() => setShowNewUserForm(true)}
                        disabled={tenantUsers.length >= tenant.max_users}
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Adicionar Usuário
                      </Button>
                    </div>
                    
                    {tenantUsers.length === 0 ? (
                      <div className="text-center py-8 bg-gray-50 rounded-lg">
                        <UserIcon className="h-10 w-10 text-gray-300 mx-auto mb-2" />
                        <h3 className="text-lg font-medium text-gray-700">Nenhum usuário cadastrado</h3>
                        <p className="text-sm text-gray-500 mb-4">
                          Adicione usuários para que possam acessar o sistema
                        </p>
                        <Button 
                          size="sm"
                          onClick={() => setShowNewUserForm(true)}
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Adicionar Primeiro Usuário
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {tenantUsers.map((user) => (
                          <div key={user.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden">
                                {user.profile_image_url ? (
                                  <img
                                    src={user.profile_image_url}
                                    alt={user.full_name}
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <UserIcon className="h-5 w-5 text-gray-500" />
                                )}
                              </div>
                              <div>
                                <h4 className="font-medium">{user.full_name}</h4>
                                <div className="flex items-center gap-2">
                                  <p className="text-sm text-gray-500">{user.email}</p>
                                  <Badge 
                                    variant="outline"
                                    className={
                                      user.status === "active" ? "bg-green-100 text-green-800" :
                                      user.status === "inactive" ? "bg-red-100 text-red-800" :
                                      "bg-yellow-100 text-yellow-800"
                                    }
                                  >
                                    {user.status === "active" ? "Ativo" :
                                     user.status === "inactive" ? "Inativo" : "Pendente"}
                                  </Badge>
                                </div>
                                <p className="text-sm font-medium mt-1">
                                  {user.role === "admin" ? "Administrador" :
                                  user.role === "manager" ? "Gerente" : 
                                  user.role === "veterinarian" ? "Veterinário" :
                                  user.role === "receptionist" ? "Recepcionista" :
                                  user.role === "groomer" ? "Tosador" :
                                  user.role === "accountant" ? "Contador" : "Funcionário"}
                                </p>
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => setEditingUser(user)}
                                    >
                                      <PenSquare className="h-4 w-4 text-gray-500" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Editar usuário</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>

                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => confirmDeleteUser(user)}
                                    >
                                      <Trash2 className="h-4 w-4 text-red-500" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Remover usuário</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </TabsContent>
              
              <TabsContent value="customization" className="mt-0">
                <div className="space-y-6">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="logo_url">URL do Logotipo</Label>
                      <Input
                        id="logo_url"
                        value={customization.company_logo_url || ""}
                        onChange={e => setCustomization({...customization, company_logo_url: e.target.value})}
                        placeholder="https://exemplo.com/logo.png"
                      />
                      <p className="text-xs text-gray-500">URL da imagem do logotipo da empresa</p>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="primary_color">Cor Primária</Label>
                        <div className="flex gap-2">
                          <div 
                            className="w-10 h-10 rounded border" 
                            style={{backgroundColor: customization.primary_color}}
                          />
                          <Input
                            id="primary_color"
                            type="color"
                            value={customization.primary_color || "#4f46e5"}
                            onChange={e => setCustomization({...customization, primary_color: e.target.value})}
                            className="w-full"
                          />
                        </div>
                        <p className="text-xs text-gray-500">Cor principal usada para botões e elementos interativos</p>
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="secondary_color">Cor Secundária</Label>
                        <div className="flex gap-2">
                          <div 
                            className="w-10 h-10 rounded border" 
                            style={{backgroundColor: customization.secondary_color}}
                          />
                          <Input
                            id="secondary_color"
                            type="color"
                            value={customization.secondary_color || "#eff6ff"}
                            onChange={e => setCustomization({...customization, secondary_color: e.target.value})}
                            className="w-full"
                          />
                        </div>
                        <p className="text-xs text-gray-500">Cor secundária usada para fundos e elementos não interativos</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-gray-50 p-6 rounded-lg">
                    <h4 className="font-medium mb-4">Prévia</h4>
                    <div 
                      className="p-6 rounded-lg flex flex-col items-center justify-center shadow-sm"
                      style={{
                        backgroundColor: customization.secondary_color || "#eff6ff",
                        color: customization.primary_color || "#4f46e5"
                      }}
                    >
                      <div className="w-16 h-16 mb-2 rounded bg-white flex items-center justify-center overflow-hidden shadow-sm">
                        {customization.company_logo_url ? (
                          <img 
                            src={customization.company_logo_url} 
                            alt="Logo"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <Building className="h-8 w-8" style={{color: customization.primary_color || "#4f46e5"}} />
                        )}
                      </div>
                      <h3 className="font-bold text-lg" style={{color: customization.primary_color || "#4f46e5"}}>
                        {tenant.company_name}
                      </h3>
                      <p className="text-sm opacity-75">Sistema personalizado</p>
                      
                      <div className="mt-4 w-full max-w-xs">
                        <Button 
                          className="w-full"
                          style={{
                            backgroundColor: customization.primary_color || "#4f46e5",
                            color: "white"
                          }}
                        >
                          Exemplo de Botão
                        </Button>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex justify-end">
                    <Button
                      onClick={saveCustomization}
                      disabled={isSaving}
                    >
                      {isSaving ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Salvando...
                        </>
                      ) : (
                        <>
                          <Save className="mr-2 h-4 w-4" />
                          Salvar Personalização
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </TabsContent>
            </CardContent>
          </Card>
        </div>
      </div>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover usuário</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover este usuário? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteUser}>
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
