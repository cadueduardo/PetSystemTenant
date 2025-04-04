import React, { useState, useEffect } from "react";
import { TenantUser } from "@/api/entities";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "@/components/ui/use-toast";
import {
  Loader2,
  Search,
  Users,
  UserPlus,
  UserCog,
  Check,
  X,
  Save,
  Stethoscope,
  ShoppingBag,
  FileSpreadsheet,
  Calendar,
  FilePlus2,
  Bed,
  Skull,
  Receipt,
  Package,
  BarChart,
  Truck,
  CircleDollarSign
} from "lucide-react";

const ROLE_LABELS = {
  admin: "Administrador",
  manager: "Gerente",
  veterinarian: "Veterinário",
  receptionist: "Recepcionista",
  groomer: "Tosador/Banhista",
  accountant: "Financeiro",
  staff: "Funcionário"
};

const PERMISSION_CATEGORIES = {
  clinic_management: {
    title: "Gestão Clínica Veterinária",
    icon: Stethoscope,
    permissions: [
      {
        id: "manage_customers",
        label: "Cadastro de clientes/pets",
        icon: FilePlus2,
        description: "Adicionar, editar e remover clientes e seus pets"
      },
      {
        id: "manage_appointments",
        label: "Agendamento de consultas",
        icon: Calendar,
        description: "Gerenciar agenda de consultas e atendimentos"
      },
      {
        id: "manage_hospitalizations",
        label: "Gestão de internações",
        icon: Bed,
        description: "Controlar internações e tratamentos hospitalares"
      },
      {
        id: "manage_deaths",
        label: "Registro de óbitos",
        icon: Skull,
        description: "Registrar e gerenciar óbitos de animais"
      },
      {
        id: "manage_medical_records",
        label: "Prontuário eletrônico",
        icon: FilePlus2,
        description: "Acessar e gerenciar prontuários e histórico médico"
      },
      {
        id: "manage_clinic_finance",
        label: "Gestão financeira clínica",
        icon: Receipt,
        description: "Gerenciar finanças relacionadas à clínica"
      }
    ]
  },

  petshop: {
    title: "Gestão Petshop",
    icon: ShoppingBag,
    permissions: [
      {
        id: "manage_products",
        label: "Cadastro/edição produtos",
        icon: Package,
        description: "Adicionar, editar e remover produtos do catálogo"
      },
      {
        id: "manage_inventory",
        label: "Controle estoque",
        icon: BarChart,
        description: "Gerenciar o estoque de produtos"
      },
      {
        id: "manage_sales",
        label: "PDV e vendas",
        icon: ShoppingBag,
        description: "Realizar e gerenciar vendas no ponto de venda"
      },
      {
        id: "manage_services",
        label: "Agendamento serviços estéticos",
        icon: Calendar,
        description: "Gerenciar serviços de banho, tosa e estética"
      },
      {
        id: "manage_delivery",
        label: "Delivery e retirada",
        icon: Truck,
        description: "Gerenciar entregas e retiradas de produtos"
      }
    ]
  },

  administrative: {
    title: "Administrativo",
    icon: Users,
    permissions: [
      {
        id: "manage_reports",
        label: "Relatórios financeiros",
        icon: FileSpreadsheet,
        description: "Acessar e gerar relatórios financeiros"
      },
      {
        id: "manage_users",
        label: "Cadastro/remoção usuários",
        icon: UserCog,
        description: "Gerenciar usuários do sistema"
      },
      {
        id: "manage_settings",
        label: "Configurações gerais",
        icon: CircleDollarSign,
        description: "Ajustar configurações gerais do sistema"
      }
    ]
  }
};

const PERMISSION_LEVELS = [
  { id: "view", label: "Visualizar", description: "Apenas visualizar informações" },
  { id: "edit", label: "Editar", description: "Visualizar e editar informações" },
  { id: "full", label: "Total", description: "Visualizar, editar e excluir" }
];

const DEFAULT_ROLE_PERMISSIONS = {
  admin: {
    // Administrador tem todas as permissões
    permissions: Object.values(PERMISSION_CATEGORIES)
      .flatMap(category => category.permissions.map(perm => perm.id))
      .reduce((acc, perm) => ({ ...acc, [perm]: "full" }), {})
  },
  manager: {
    // Gerente tem permissões de edição em quase tudo, exceto algumas áreas administrativas
    permissions: Object.values(PERMISSION_CATEGORIES)
      .flatMap(category => category.permissions.map(perm => perm.id))
      .reduce((acc, perm) => ({
        ...acc,
        [perm]: perm === "manage_users" || perm === "manage_settings" ? "view" : "edit"
      }), {})
  },
  veterinarian: {
    // Veterinário tem acesso principalmente à área clínica
    permissions: {
      manage_customers: "edit",
      manage_appointments: "edit",
      manage_hospitalizations: "edit",
      manage_deaths: "edit",
      manage_medical_records: "full",
      manage_clinic_finance: "view",
      manage_products: "view",
      manage_inventory: "view",
      manage_sales: "view",
      manage_services: "view",
      manage_delivery: "view",
      manage_reports: "view",
      manage_users: null,
      manage_settings: null
    }
  },
  receptionist: {
    // Recepcionista gerencia agendamentos e clientes
    permissions: {
      manage_customers: "edit",
      manage_appointments: "edit",
      manage_hospitalizations: "view",
      manage_deaths: "view",
      manage_medical_records: "view",
      manage_clinic_finance: "view",
      manage_products: "view",
      manage_inventory: null,
      manage_sales: "edit",
      manage_services: "edit",
      manage_delivery: "view",
      manage_reports: null,
      manage_users: null,
      manage_settings: null
    }
  },
  groomer: {
    // Tosador/Banhista gerencia serviços estéticos
    permissions: {
      manage_customers: "view",
      manage_appointments: "view",
      manage_hospitalizations: null,
      manage_deaths: null,
      manage_medical_records: null,
      manage_clinic_finance: null,
      manage_products: "view",
      manage_inventory: null,
      manage_sales: null,
      manage_services: "edit",
      manage_delivery: null,
      manage_reports: null,
      manage_users: null,
      manage_settings: null
    }
  },
  accountant: {
    // Financeiro gerencia finanças e relatórios
    permissions: {
      manage_customers: "view",
      manage_appointments: "view",
      manage_hospitalizations: null,
      manage_deaths: null,
      manage_medical_records: null,
      manage_clinic_finance: "full",
      manage_products: "view",
      manage_inventory: "view",
      manage_sales: "view",
      manage_services: "view",
      manage_delivery: null,
      manage_reports: "full",
      manage_users: null,
      manage_settings: "view"
    }
  },
  staff: {
    // Funcionário básico tem acesso limitado
    permissions: {
      manage_customers: "view",
      manage_appointments: "view",
      manage_hospitalizations: null,
      manage_deaths: null,
      manage_medical_records: null,
      manage_clinic_finance: null,
      manage_products: "view",
      manage_inventory: null,
      manage_sales: "view",
      manage_services: "view",
      manage_delivery: null,
      manage_reports: null,
      manage_users: null,
      manage_settings: null
    }
  }
};

export default function PermissionsManager({ trialId }) {
  const [isLoading, setIsLoading] = useState(true);
  const [users, setUsers] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [userPermissions, setUserPermissions] = useState({});
  const [hasChanges, setHasChanges] = useState(false);
  const [showNewUserForm, setShowNewUserForm] = useState(false);
  const [newUserData, setNewUserData] = useState({
    full_name: "",
    email: "",
    role: "staff",
    permissions: {}
  });
  const [activeTab, setActiveTab] = useState("clinic_management");

  useEffect(() => {
    if (trialId) {
      loadUsers();
    }
  }, [trialId]);

  const loadUsers = async () => {
    setIsLoading(true);
    try {
      const usersData = await TenantUser.filter({ tenant_id: trialId });
      setUsers(usersData);
      
      if (usersData.length > 0 && !selectedUserId) {
        setSelectedUserId(usersData[0].id);
        loadUserPermissions(usersData[0]);
      }
    } catch (error) {
      console.error("Erro ao carregar usuários:", error);
      toast({
        title: "Erro ao carregar usuários",
        description: "Não foi possível carregar a lista de usuários.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const loadUserPermissions = (user) => {
    // Se o usuário já tem permissões definidas, use-as
    if (user.permissions && user.permissions.length > 0) {
      // Converte o array de permissões para o formato de objeto usado no componente
      const permissionsObj = {};
      user.permissions.forEach(permId => {
        // Identifica a categoria e a permissão correspondente
        for (const categoryKey in PERMISSION_CATEGORIES) {
          const category = PERMISSION_CATEGORIES[categoryKey];
          const permission = category.permissions.find(p => p.id === permId);
          if (permission) {
            permissionsObj[permId] = "full"; // Aqui você pode ajustar o nível conforme necessário
            break;
          }
        }
      });
      setUserPermissions(permissionsObj);
    } else {
      // Se não tem permissões definidas, use as padrões para o cargo
      const rolePermissions = DEFAULT_ROLE_PERMISSIONS[user.role] || DEFAULT_ROLE_PERMISSIONS.staff;
      setUserPermissions(rolePermissions.permissions);
    }
    
    setHasChanges(false);
  };

  const handleUserSelect = (userId) => {
    if (hasChanges) {
      if (window.confirm("Você tem alterações não salvas. Deseja continuar sem salvar?")) {
        const selectedUser = users.find(u => u.id === userId);
        setSelectedUserId(userId);
        if (selectedUser) {
          loadUserPermissions(selectedUser);
        }
      }
    } else {
      const selectedUser = users.find(u => u.id === userId);
      setSelectedUserId(userId);
      if (selectedUser) {
        loadUserPermissions(selectedUser);
      }
    }
  };

  const handlePermissionChange = (permissionId, level) => {
    setUserPermissions(prev => ({
      ...prev,
      [permissionId]: level === prev[permissionId] ? null : level
    }));
    setHasChanges(true);
  };

  const savePermissions = async () => {
    if (!selectedUserId) return;

    setIsLoading(true);
    try {
      const selectedUser = users.find(user => user.id === selectedUserId);
      
      if (!selectedUser) {
        throw new Error("Usuário não encontrado");
      }

      // Converter o objeto de permissões para o formato esperado pela API
      const permissionsArray = Object.entries(userPermissions)
        .filter(([_, level]) => level !== null)
        .map(([permId, _]) => permId);

      // Atualizar usuário com as novas permissões
      await TenantUser.update(selectedUserId, {
        ...selectedUser,
        permissions: permissionsArray
      });

      toast({
        title: "Permissões salvas",
        description: "As permissões do usuário foram atualizadas com sucesso.",
      });

      setHasChanges(false);
      loadUsers(); // Recarregar a lista para refletir as mudanças
    } catch (error) {
      console.error("Erro ao salvar permissões:", error);
      toast({
        title: "Erro ao salvar permissões",
        description: "Não foi possível atualizar as permissões do usuário.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleNewUserSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Aplicar permissões do cargo selecionado
      const rolePermissions = DEFAULT_ROLE_PERMISSIONS[newUserData.role] || DEFAULT_ROLE_PERMISSIONS.staff;
      
      // Converter para array de permissões
      const permissionsArray = Object.entries(rolePermissions.permissions)
        .filter(([_, level]) => level !== null)
        .map(([permId, _]) => permId);

      // Criar novo usuário
      const newUser = await TenantUser.create({
        tenant_id: trialId,
        full_name: newUserData.full_name,
        email: newUserData.email,
        role: newUserData.role,
        status: "pending",
        permissions: permissionsArray
      });

      toast({
        title: "Usuário criado",
        description: "Novo usuário foi adicionado com sucesso.",
      });

      // Resetar form e recarregar lista
      setNewUserData({
        full_name: "",
        email: "",
        role: "staff",
        permissions: {}
      });
      setShowNewUserForm(false);
      loadUsers();

      // Selecionar o novo usuário
      setSelectedUserId(newUser.id);
      loadUserPermissions(newUser);
    } catch (error) {
      console.error("Erro ao criar usuário:", error);
      toast({
        title: "Erro ao criar usuário",
        description: "Não foi possível adicionar o novo usuário.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const filteredUsers = users.filter(user => 
    user.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const selectedUser = users.find(user => user.id === selectedUserId);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Gerenciamento de Permissões</CardTitle>
          <CardDescription>
            Configure as permissões de acesso para cada usuário do sistema
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading && users.length === 0 ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            </div>
          ) : (
            <div className="grid md:grid-cols-3 gap-6">
              <div className="md:col-span-1 border rounded-lg p-4">
                <div className="space-y-4">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="font-medium">Funcionários</h3>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowNewUserForm(!showNewUserForm)}
                    >
                      {showNewUserForm ? (
                        <X className="h-4 w-4 mr-2" />
                      ) : (
                        <UserPlus className="h-4 w-4 mr-2" />
                      )}
                      {showNewUserForm ? "Cancelar" : "Novo"}
                    </Button>
                  </div>

                  {showNewUserForm && (
                    <div className="bg-gray-50 p-4 rounded-lg mb-4">
                      <h4 className="font-medium mb-3">Adicionar Novo Usuário</h4>
                      <form onSubmit={handleNewUserSubmit} className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="full_name">Nome Completo</Label>
                          <Input
                            id="full_name"
                            value={newUserData.full_name}
                            onChange={e => setNewUserData({...newUserData, full_name: e.target.value})}
                            placeholder="Nome do funcionário"
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="email">E-mail</Label>
                          <Input
                            id="email"
                            type="email"
                            value={newUserData.email}
                            onChange={e => setNewUserData({...newUserData, email: e.target.value})}
                            placeholder="email@exemplo.com"
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="role">Cargo</Label>
                          <Select
                            value={newUserData.role}
                            onValueChange={value => setNewUserData({...newUserData, role: value})}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione um cargo" />
                            </SelectTrigger>
                            <SelectContent>
                              {Object.entries(ROLE_LABELS).map(([role, label]) => (
                                <SelectItem key={role} value={role}>
                                  {label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="pt-2">
                          <Button type="submit" disabled={isLoading}>
                            {isLoading ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Criando...
                              </>
                            ) : (
                              "Adicionar Usuário"
                            )}
                          </Button>
                        </div>
                      </form>
                    </div>
                  )}

                  <div className="relative">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-500" />
                    <Input
                      placeholder="Buscar funcionários..."
                      className="pl-8"
                      value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)}
                    />
                  </div>

                  <div className="max-h-[400px] overflow-y-auto">
                    {filteredUsers.length === 0 ? (
                      <div className="text-center py-6 text-gray-500">
                        {searchTerm ? "Nenhum usuário encontrado." : "Nenhum usuário cadastrado."}
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {filteredUsers.map(user => (
                          <div
                            key={user.id}
                            className={`p-3 rounded-md cursor-pointer transition-colors ${
                              selectedUserId === user.id
                                ? "bg-blue-50 border border-blue-200"
                                : "hover:bg-gray-50 border border-transparent"
                            }`}
                            onClick={() => handleUserSelect(user.id)}
                          >
                            <div className="flex justify-between items-center">
                              <div>
                                <p className="font-medium">{user.full_name}</p>
                                <p className="text-sm text-gray-500">{user.email}</p>
                              </div>
                              <Badge>
                                {ROLE_LABELS[user.role] || user.role}
                              </Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="md:col-span-2 border rounded-lg p-4">
                {selectedUser ? (
                  <div className="space-y-6">
                    <div className="flex justify-between items-center">
                      <div>
                        <h3 className="text-lg font-medium">{selectedUser.full_name}</h3>
                        <p className="text-gray-500">{selectedUser.email}</p>
                      </div>
                      <Badge className="capitalize">
                        {ROLE_LABELS[selectedUser.role] || selectedUser.role}
                      </Badge>
                    </div>

                    <Tabs value={activeTab} onValueChange={setActiveTab}>
                      <TabsList className="mb-4">
                        {Object.entries(PERMISSION_CATEGORIES).map(([key, category]) => (
                          <TabsTrigger key={key} value={key} className="flex items-center gap-2">
                            <category.icon className="h-4 w-4" />
                            <span className="hidden sm:inline">{category.title}</span>
                          </TabsTrigger>
                        ))}
                      </TabsList>

                      {Object.entries(PERMISSION_CATEGORIES).map(([key, category]) => (
                        <TabsContent key={key} value={key} className="space-y-6">
                          <div className="bg-gray-50 p-3 rounded-md">
                            <h4 className="font-medium flex items-center gap-2">
                              <category.icon className="h-5 w-5 text-blue-600" />
                              {category.title}
                            </h4>
                            <p className="text-sm text-gray-500 mt-1">
                              {category.title === "Gestão Clínica Veterinária" && 
                                "Permissões para gerenciar pacientes, consultas e procedimentos veterinários."}
                              {category.title === "Gestão Petshop" && 
                                "Permissões para gerenciar produtos, serviços e vendas do petshop."}
                              {category.title === "Administrativo" && 
                                "Permissões para gerenciar aspectos administrativos do sistema."}
                            </p>
                          </div>

                          <div className="grid gap-4">
                            {category.permissions.map(permission => (
                              <div key={permission.id} className="border rounded-md p-4">
                                <div className="flex items-start justify-between mb-2">
                                  <div className="flex items-center gap-2">
                                    <permission.icon className="h-5 w-5 text-gray-600" />
                                    <h5 className="font-medium">{permission.label}</h5>
                                  </div>
                                </div>
                                <p className="text-sm text-gray-500 mb-4">
                                  {permission.description}
                                </p>
                                
                                <div className="flex flex-wrap gap-3">
                                  {PERMISSION_LEVELS.map(level => (
                                    <Label
                                      key={level.id}
                                      className={`flex items-center gap-2 p-3 rounded-md border cursor-pointer ${
                                        userPermissions[permission.id] === level.id 
                                          ? "bg-blue-50 border-blue-200" 
                                          : "hover:bg-gray-50"
                                      }`}
                                      htmlFor={`${permission.id}-${level.id}`}
                                    >
                                      <div className="flex items-center gap-2">
                                        <Checkbox
                                          id={`${permission.id}-${level.id}`}
                                          checked={userPermissions[permission.id] === level.id}
                                          onCheckedChange={() => handlePermissionChange(permission.id, level.id)}
                                        />
                                        <div>
                                          <p className="font-medium text-sm">{level.label}</p>
                                          <p className="text-xs text-gray-500">{level.description}</p>
                                        </div>
                                      </div>
                                    </Label>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        </TabsContent>
                      ))}
                    </Tabs>

                    <div className="flex justify-end">
                      {hasChanges && (
                        <Alert className="mb-4">
                          <AlertTitle>Alterações não salvas</AlertTitle>
                          <AlertDescription>
                            Você precisa salvar as alterações para que elas sejam aplicadas.
                          </AlertDescription>
                        </Alert>
                      )}
                      <Button
                        onClick={savePermissions}
                        disabled={!hasChanges || isLoading}
                        className="flex items-center gap-2"
                      >
                        {isLoading ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Salvando...
                          </>
                        ) : (
                          <>
                            <Save className="h-4 w-4" />
                            Salvar Permissões
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <UserCog className="mx-auto h-12 w-12 text-gray-300" />
                    <h3 className="mt-2 text-lg font-medium">Nenhum usuário selecionado</h3>
                    <p className="mt-1 text-gray-500">
                      Selecione um usuário para configurar suas permissões
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}