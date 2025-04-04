import React, { useState, useEffect } from "react";
import { User } from "@/api/entities";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Users,
  Loader2,
  Plus,
  UserPlus,
  Mail,
  Key,
  User as UserIcon,
  MoreHorizontal,
  Lock,
  Settings
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "@/components/ui/use-toast";

const ROLES = [
  { value: "administrator", label: "Administrador", description: "Acesso completo a todas as funcionalidades" },
  { value: "manager", label: "Gerente", description: "Acesso a maioria das funcionalidades, exceto configurações críticas" },
  { value: "veterinarian", label: "Veterinário", description: "Acesso a prontuários, agendamentos e registros médicos" },
  { value: "receptionist", label: "Recepcionista", description: "Acesso a agendamentos e cadastro de clientes" },
  { value: "assistant", label: "Assistente", description: "Acesso limitado, apenas visualização" }
];

const PERMISSIONS = [
  { id: "manage_appointments", label: "Gerenciar Agendamentos", description: "Criar, editar e cancelar agendamentos" },
  { id: "view_appointments", label: "Visualizar Agendamentos", description: "Ver os agendamentos, sem poder modificá-los" },
  { id: "manage_customers", label: "Gerenciar Clientes", description: "Adicionar, editar e remover clientes" },
  { id: "view_customers", label: "Visualizar Clientes", description: "Ver os dados dos clientes, sem poder modificá-los" },
  { id: "manage_pets", label: "Gerenciar Pets", description: "Adicionar, editar e remover pets" },
  { id: "view_pets", label: "Visualizar Pets", description: "Ver os dados dos pets, sem poder modificá-los" },
  { id: "manage_medical_records", label: "Gerenciar Prontuários", description: "Criar e editar registros médicos" },
  { id: "view_medical_records", label: "Visualizar Prontuários", description: "Ver prontuários, sem poder modificá-los" },
  { id: "manage_inventory", label: "Gerenciar Estoque", description: "Adicionar, editar e remover produtos" },
  { id: "view_inventory", label: "Visualizar Estoque", description: "Ver produtos, sem poder modificá-los" },
  { id: "manage_financial", label: "Gerenciar Financeiro", description: "Acesso completo ao módulo financeiro" },
  { id: "view_financial", label: "Visualizar Financeiro", description: "Ver dados financeiros, sem poder modificá-los" },
  { id: "manage_users", label: "Gerenciar Usuários", description: "Adicionar, editar e remover usuários" },
  { id: "manage_settings", label: "Gerenciar Configurações", description: "Modificar configurações do sistema" },
  { id: "view_reports", label: "Visualizar Relatórios", description: "Acessar e exportar relatórios" }
];

// Predefined permission sets for each role
const ROLE_PERMISSIONS = {
  administrator: PERMISSIONS.map(p => p.id),
  manager: ["manage_appointments", "view_appointments", "manage_customers", "view_customers", 
            "manage_pets", "view_pets", "manage_medical_records", "view_medical_records",
            "manage_inventory", "view_inventory", "manage_financial", "view_financial", 
            "view_reports"],
  veterinarian: ["view_appointments", "manage_appointments", "view_customers", "view_pets", 
                "manage_medical_records", "view_medical_records", "view_inventory"],
  receptionist: ["manage_appointments", "view_appointments", "manage_customers", "view_customers", 
                "view_pets", "view_medical_records"],
  assistant: ["view_appointments", "view_customers", "view_pets"]
};

export default function UserManagement({ trialId }) {
  const [isLoading, setIsLoading] = useState(true);
  const [users, setUsers] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [showAddUserDialog, setShowAddUserDialog] = useState(false);
  const [showEditUserDialog, setShowEditUserDialog] = useState(false);
  const [newUser, setNewUser] = useState({
    email: "",
    role_in_clinic: "assistant",
    permissions: [],
    phone: "",
    two_factor_enabled: false
  });
  const [editingUser, setEditingUser] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadUsers();
    loadCurrentUser();
  }, []);

  const loadCurrentUser = async () => {
    try {
      const user = await User.me();
      setCurrentUser(user);
    } catch (error) {
      console.error("Error loading current user:", error);
    }
  };

  const loadUsers = async () => {
    setIsLoading(true);
    try {
      // TODO: User é um modelo do sistema que não podemos ver todos os usuários
      // Mas isso é um mockup para demonstrar a funcionalidade
      const usersData = [
        {
          id: "1",
          email: "admin@example.com",
          full_name: "Administrador do Sistema",
          role: "admin",
          role_in_clinic: "administrator",
          permissions: ROLE_PERMISSIONS.administrator,
          two_factor_enabled: true
        },
        {
          id: "2",
          email: "vet@example.com",
          full_name: "Dr. Carlos Silva",
          role: "user",
          role_in_clinic: "veterinarian",
          permissions: ROLE_PERMISSIONS.veterinarian,
          two_factor_enabled: false
        },
        {
          id: "3",
          email: "recepcao@example.com",
          full_name: "Ana Santos",
          role: "user",
          role_in_clinic: "receptionist",
          permissions: ROLE_PERMISSIONS.receptionist,
          two_factor_enabled: false
        }
      ];
      
      setUsers(usersData);
    } catch (error) {
      console.error("Error loading users:", error);
      toast({
        title: "Erro ao carregar usuários",
        description: "Não foi possível carregar a lista de usuários",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRoleChange = (role) => {
    setNewUser(prev => ({
      ...prev,
      role_in_clinic: role,
      permissions: ROLE_PERMISSIONS[role] || []
    }));
  };

  const handleEditRoleChange = (role) => {
    setEditingUser(prev => ({
      ...prev,
      role_in_clinic: role,
      permissions: ROLE_PERMISSIONS[role] || []
    }));
  };

  const togglePermission = (permissionId) => {
    setNewUser(prev => {
      const permissions = [...prev.permissions];
      if (permissions.includes(permissionId)) {
        return { ...prev, permissions: permissions.filter(id => id !== permissionId) };
      } else {
        return { ...prev, permissions: [...permissions, permissionId] };
      }
    });
  };

  const toggleEditPermission = (permissionId) => {
    setEditingUser(prev => {
      const permissions = [...prev.permissions];
      if (permissions.includes(permissionId)) {
        return { ...prev, permissions: permissions.filter(id => id !== permissionId) };
      } else {
        return { ...prev, permissions: [...permissions, permissionId] };
      }
    });
  };

  const inviteUser = async () => {
    setIsSaving(true);
    
    try {
      // Simulação de convite de usuário
      toast({
        title: "Convite enviado",
        description: `Um convite foi enviado para ${newUser.email}`,
      });
      
      setShowAddUserDialog(false);
      // Reset form
      setNewUser({
        email: "",
        role_in_clinic: "assistant",
        permissions: ROLE_PERMISSIONS.assistant || [],
        phone: "",
        two_factor_enabled: false
      });
      
      // Reload users (in a real app)
      // await loadUsers();
      
    } catch (error) {
      console.error("Error inviting user:", error);
      toast({
        title: "Erro ao convidar usuário",
        description: "Não foi possível enviar o convite",
        variant: "destructive"
      });
    } finally {
      setIsSaving(false);
    }
  };

  const saveUserChanges = async () => {
    setIsSaving(true);
    
    try {
      // Simulação de atualização de usuário
      toast({
        title: "Usuário atualizado",
        description: `As permissões de ${editingUser.full_name} foram atualizadas`,
      });
      
      setShowEditUserDialog(false);
      
      // Update user in list
      const updatedUsers = users.map(user => 
        user.id === editingUser.id ? editingUser : user
      );
      setUsers(updatedUsers);
      
    } catch (error) {
      console.error("Error updating user:", error);
      toast({
        title: "Erro ao atualizar usuário",
        description: "Não foi possível salvar as alterações",
        variant: "destructive"
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditUser = (user) => {
    setEditingUser({ ...user });
    setShowEditUserDialog(true);
  };

  const getRoleBadge = (role) => {
    const roleColors = {
      administrator: "bg-purple-100 text-purple-800 border-purple-200",
      manager: "bg-blue-100 text-blue-800 border-blue-200",
      veterinarian: "bg-green-100 text-green-800 border-green-200",
      receptionist: "bg-orange-100 text-orange-800 border-orange-200",
      assistant: "bg-gray-100 text-gray-800 border-gray-200"
    };
    
    const roleLabels = {
      administrator: "Administrador",
      manager: "Gerente",
      veterinarian: "Veterinário",
      receptionist: "Recepcionista",
      assistant: "Assistente"
    };
    
    return (
      <Badge className={roleColors[role]}>
        {roleLabels[role]}
      </Badge>
    );
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-blue-500" />
                Gerenciamento de Usuários
              </CardTitle>
              <CardDescription>
                Controle de acesso e permissões da equipe
              </CardDescription>
            </div>
            <Button onClick={() => setShowAddUserDialog(true)} className="gap-2">
              <UserPlus className="w-4 h-4" />
              Convidar Usuário
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Usuário</TableHead>
                    <TableHead>Função</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-[90px]">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
                            <UserIcon className="w-5 h-5 text-gray-500" />
                          </div>
                          <div>
                            <div className="font-medium">{user.full_name}</div>
                            <div className="text-sm text-gray-500 flex items-center gap-1">
                              <Mail className="w-3 h-3" />
                              {user.email}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {getRoleBadge(user.role_in_clinic)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {user.two_factor_enabled ? (
                            <Badge className="bg-green-100 text-green-800 border-green-200">
                              <Lock className="w-3 h-3 mr-1" />
                              2FA Ativo
                            </Badge>
                          ) : (
                            <Badge variant="outline">
                              <Key className="w-3 h-3 mr-1" />
                              2FA Inativo
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Ações</DropdownMenuLabel>
                            <DropdownMenuItem onClick={() => handleEditUser(user)}>
                              <Settings className="h-4 w-4 mr-2" />
                              Permissões
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-red-600">
                              <Lock className="h-4 w-4 mr-2" />
                              Bloquear Acesso
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add User Dialog */}
      <Dialog open={showAddUserDialog} onOpenChange={setShowAddUserDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Convidar Novo Usuário</DialogTitle>
            <DialogDescription>
              Envie um convite e defina as permissões iniciais do usuário
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email do Usuário</Label>
              <Input
                id="email"
                type="email"
                placeholder="email@exemplo.com"
                value={newUser.email}
                onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>Função no Sistema</Label>
              <Select
                value={newUser.role_in_clinic}
                onValueChange={handleRoleChange}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma função" />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map((role) => (
                    <SelectItem key={role.value} value={role.value}>
                      <div className="flex flex-col">
                        <span>{role.label}</span>
                        <span className="text-xs text-gray-500">{role.description}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Separator />

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium">Permissões</h4>
                  <p className="text-sm text-gray-500">
                    Permissões baseadas na função selecionada
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    id="customPermissions"
                    // Add custom permissions logic if needed
                  />
                  <Label htmlFor="customPermissions">Personalizar</Label>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {PERMISSIONS.map((permission) => (
                  <div key={permission.id} className="flex items-start gap-2">
                    <Checkbox
                      id={permission.id}
                      checked={newUser.permissions.includes(permission.id)}
                      onCheckedChange={() => togglePermission(permission.id)}
                    />
                    <div>
                      <Label htmlFor={permission.id} className="font-medium">
                        {permission.label}
                      </Label>
                      <p className="text-xs text-gray-500">
                        {permission.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowAddUserDialog(false)}
              disabled={isSaving}
            >
              Cancelar
            </Button>
            <Button
              onClick={inviteUser}
              disabled={!newUser.email || isSaving}
            >
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Enviando...
                </>
              ) : (
                "Enviar Convite"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog open={showEditUserDialog} onOpenChange={setShowEditUserDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Editar Permissões do Usuário</DialogTitle>
            <DialogDescription>
              Modifique a função e permissões do usuário no sistema
            </DialogDescription>
          </DialogHeader>

          {editingUser && (
            <div className="space-y-6 py-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
                  <UserIcon className="w-6 h-6 text-gray-500" />
                </div>
                <div>
                  <h3 className="font-medium">{editingUser.full_name}</h3>
                  <p className="text-sm text-gray-500">{editingUser.email}</p>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Função no Sistema</Label>
                <Select
                  value={editingUser.role_in_clinic}
                  onValueChange={handleEditRoleChange}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione uma função" />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLES.map((role) => (
                      <SelectItem key={role.value} value={role.value}>
                        <div className="flex flex-col">
                          <span>{role.label}</span>
                          <span className="text-xs text-gray-500">{role.description}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Separator />

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium">Permissões</h4>
                    <p className="text-sm text-gray-500">
                      Permissões associadas à função selecionada
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {PERMISSIONS.map((permission) => (
                    <div key={permission.id} className="flex items-start gap-2">
                      <Checkbox
                        id={`edit-${permission.id}`}
                        checked={editingUser.permissions.includes(permission.id)}
                        onCheckedChange={() => toggleEditPermission(permission.id)}
                      />
                      <div>
                        <Label htmlFor={`edit-${permission.id}`} className="font-medium">
                          {permission.label}
                        </Label>
                        <p className="text-xs text-gray-500">
                          {permission.description}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowEditUserDialog(false)}
              disabled={isSaving}
            >
              Cancelar
            </Button>
            <Button
              onClick={saveUserChanges}
              disabled={isSaving}
            >
              {isSaving ? (
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
    </>
  );
}