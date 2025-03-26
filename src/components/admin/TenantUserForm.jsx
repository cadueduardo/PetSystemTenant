import React, { useState } from "react";
import { TenantUser } from "@/api/entities";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { toast } from "@/components/ui/use-toast";

export default function TenantUserForm({ tenantId, user, onSuccess, onCancel }) {
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState(user || {
    tenant_id: tenantId,
    email: "",
    full_name: "",
    role: "staff",
    status: "pending",
    permissions: [
      "view_customers",
      "view_pets",
      "view_appointments",
    ],
    specialty: "",
    bio: "",
    profile_image_url: ""
  });

  const roleOptions = [
    { value: "admin", label: "Administrador" },
    { value: "manager", label: "Gerente" },
    { value: "veterinarian", label: "Veterinário" },
    { value: "receptionist", label: "Recepcionista" },
    { value: "groomer", label: "Tosador" },
    { value: "accountant", label: "Contador" },
    { value: "staff", label: "Funcionário" }
  ];

  const statusOptions = [
    { value: "active", label: "Ativo" },
    { value: "inactive", label: "Inativo" },
    { value: "pending", label: "Pendente" }
  ];

  const permissionOptions = [
    { value: "manage_customers", label: "Gerenciar Clientes" },
    { value: "view_customers", label: "Visualizar Clientes" },
    { value: "manage_pets", label: "Gerenciar Pets" },
    { value: "view_pets", label: "Visualizar Pets" },
    { value: "manage_appointments", label: "Gerenciar Agendamentos" },
    { value: "view_appointments", label: "Visualizar Agendamentos" },
    { value: "manage_medical_records", label: "Gerenciar Prontuários" },
    { value: "view_medical_records", label: "Visualizar Prontuários" },
    { value: "manage_hospitalizations", label: "Gerenciar Internações" },
    { value: "view_hospitalizations", label: "Visualizar Internações" },
    { value: "manage_products", label: "Gerenciar Produtos" },
    { value: "view_products", label: "Visualizar Produtos" },
    { value: "manage_inventory", label: "Gerenciar Estoque" },
    { value: "view_inventory", label: "Visualizar Estoque" },
    { value: "manage_sales", label: "Gerenciar Vendas" },
    { value: "view_sales", label: "Visualizar Vendas" },
    { value: "manage_services", label: "Gerenciar Serviços" },
    { value: "view_services", label: "Visualizar Serviços" },
    { value: "manage_finance", label: "Gerenciar Finanças" },
    { value: "view_finance", label: "Visualizar Finanças" },
    { value: "manage_reports", label: "Gerenciar Relatórios" },
    { value: "view_reports", label: "Visualizar Relatórios" },
    { value: "manage_users", label: "Gerenciar Usuários" }
  ];

  const handleChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handlePermissionChange = (permission) => {
    setFormData(prev => {
      const permissions = [...(prev.permissions || [])];
      if (permissions.includes(permission)) {
        return { ...prev, permissions: permissions.filter(p => p !== permission) };
      } else {
        return { ...prev, permissions: [...permissions, permission] };
      }
    });
  };

  const handleRolePresets = (role) => {
    let presetPermissions = [];
    
    switch (role) {
      case "admin":
        presetPermissions = permissionOptions.map(p => p.value);
        break;
      case "manager":
        presetPermissions = permissionOptions
          .filter(p => !p.value.includes("medical_records"))
          .map(p => p.value);
        break;
      case "veterinarian":
        presetPermissions = [
          "view_customers", "view_pets", "manage_medical_records", 
          "view_medical_records", "manage_appointments", "view_appointments",
          "manage_hospitalizations", "view_hospitalizations"
        ];
        break;
      case "receptionist":
        presetPermissions = [
          "view_customers", "manage_customers", "view_pets", 
          "manage_appointments", "view_appointments", "view_services",
          "manage_sales", "view_sales"
        ];
        break;
      case "groomer":
        presetPermissions = [
          "view_customers", "view_pets", "view_appointments", 
          "manage_appointments", "view_services"
        ];
        break;
      case "accountant":
        presetPermissions = [
          "view_sales", "view_finance", "manage_finance",
          "view_reports", "manage_reports"
        ];
        break;
      default:
        presetPermissions = ["view_customers", "view_pets", "view_appointments"];
    }
    
    setFormData(prev => ({
      ...prev,
      role,
      permissions: presetPermissions
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      if (user) {
        await TenantUser.update(user.id, formData);
        toast({
          title: "Usuário atualizado",
          description: "O usuário foi atualizado com sucesso."
        });
      } else {
        await TenantUser.create(formData);
        toast({
          title: "Usuário adicionado",
          description: "Um novo usuário foi adicionado ao sistema."
        });
      }
      onSuccess(formData);
    } catch (error) {
      console.error("Erro ao salvar usuário:", error);
      toast({
        title: "Erro ao salvar usuário",
        description: "Ocorreu um erro ao salvar os dados do usuário.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <Label htmlFor="full_name">Nome Completo</Label>
          <Input
            id="full_name"
            value={formData.full_name}
            onChange={(e) => handleChange("full_name", e.target.value)}
            placeholder="Nome completo do usuário"
            required
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={formData.email}
            onChange={(e) => handleChange("email", e.target.value)}
            placeholder="email@exemplo.com"
            required
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="role">Função</Label>
          <Select
            id="role"
            value={formData.role}
            onValueChange={(value) => handleRolePresets(value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione uma função" />
            </SelectTrigger>
            <SelectContent>
              {roleOptions.map(option => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="status">Status</Label>
          <Select
            id="status"
            value={formData.status}
            onValueChange={(value) => handleChange("status", value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione um status" />
            </SelectTrigger>
            <SelectContent>
              {statusOptions.map(option => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="specialty">Especialidade</Label>
          <Input
            id="specialty"
            value={formData.specialty || ""}
            onChange={(e) => handleChange("specialty", e.target.value)}
            placeholder="Ex: Cirurgia, Dermatologia, etc."
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="profile_image_url">URL da Imagem de Perfil</Label>
          <Input
            id="profile_image_url"
            value={formData.profile_image_url || ""}
            onChange={(e) => handleChange("profile_image_url", e.target.value)}
            placeholder="https://exemplo.com/imagem.jpg"
          />
        </div>
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="bio">Biografia/Descrição</Label>
        <Textarea
          id="bio"
          value={formData.bio || ""}
          onChange={(e) => handleChange("bio", e.target.value)}
          placeholder="Informações sobre o usuário"
          rows={3}
        />
      </div>
      
      <Separator />
      
      <div className="space-y-4">
        <Label>Permissões</Label>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {permissionOptions.map(permission => (
            <div key={permission.value} className="flex items-center space-x-2">
              <Checkbox
                id={permission.value}
                checked={(formData.permissions || []).includes(permission.value)}
                onCheckedChange={() => handlePermissionChange(permission.value)}
              />
              <Label htmlFor={permission.value} className="text-sm">
                {permission.label}
              </Label>
            </div>
          ))}
        </div>
      </div>
      
      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={isLoading}
        >
          Cancelar
        </Button>
        <Button
          type="submit"
          disabled={isLoading || !formData.full_name || !formData.email}
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {user ? "Atualizando..." : "Criando..."}
            </>
          ) : (
            user ? "Atualizar Usuário" : "Adicionar Usuário"
          )}
        </Button>
      </div>
    </form>
  );
}