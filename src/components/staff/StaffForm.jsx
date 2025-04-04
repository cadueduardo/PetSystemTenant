import React, { useState, useEffect } from "react";
import { TenantUser } from "@/api/entities";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/components/ui/use-toast";
import { Loader2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";

export default function StaffForm({ open, onOpenChange, staff, onSuccess }) {
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    tenant_id: localStorage.getItem('current_tenant') || "",
    email: "",
    full_name: "",
    role: "staff",
    status: "active",
    permissions: [],
    specialty: "",
    bio: "",
    profile_image_url: ""
  });

  useEffect(() => {
    if (staff) {
      setFormData({
        ...staff,
        tenant_id: staff.tenant_id || localStorage.getItem('current_tenant') || ""
      });
    } else {
      setFormData({
        tenant_id: localStorage.getItem('current_tenant') || "",
        email: "",
        full_name: "",
        role: "staff",
        status: "active",
        permissions: [],
        specialty: "",
        bio: "",
        profile_image_url: ""
      });
    }
  }, [staff, open]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handlePermissionChange = (permission) => {
    setFormData(prev => {
      const permissions = [...prev.permissions];
      
      if (permissions.includes(permission)) {
        return {
          ...prev,
          permissions: permissions.filter(p => p !== permission)
        };
      } else {
        return {
          ...prev,
          permissions: [...permissions, permission]
        };
      }
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (staff?.id) {
        await TenantUser.update(staff.id, formData);
        toast({
          title: "Sucesso",
          description: "Colaborador atualizado com sucesso!"
        });
      } else {
        await TenantUser.create(formData);
        toast({
          title: "Sucesso",
          description: "Colaborador adicionado com sucesso!"
        });
      }
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error("Erro ao salvar colaborador:", error);
      toast({
        title: "Erro",
        description: "Não foi possível salvar o colaborador.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>
            {staff ? "Editar Colaborador" : "Novo Colaborador"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="full_name">Nome Completo*</Label>
              <Input
                id="full_name"
                name="full_name"
                value={formData.full_name}
                onChange={handleChange}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email*</Label>
              <Input
                id="email"
                name="email"
                type="email"
                value={formData.email}
                onChange={handleChange}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="role">Cargo*</Label>
              <Select
                value={formData.role}
                onValueChange={(value) => handleChange({ target: { name: 'role', value }})}
              >
                <SelectTrigger id="role">
                  <SelectValue placeholder="Selecione o cargo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Administrador</SelectItem>
                  <SelectItem value="manager">Gerente</SelectItem>
                  <SelectItem value="veterinarian">Veterinário</SelectItem>
                  <SelectItem value="receptionist">Recepcionista</SelectItem>
                  <SelectItem value="groomer">Tosador</SelectItem>
                  <SelectItem value="accountant">Contador</SelectItem>
                  <SelectItem value="staff">Auxiliar</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Status*</Label>
              <Select
                value={formData.status}
                onValueChange={(value) => handleChange({ target: { name: 'status', value }})}
              >
                <SelectTrigger id="status">
                  <SelectValue placeholder="Selecione o status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Ativo</SelectItem>
                  <SelectItem value="inactive">Inativo</SelectItem>
                  <SelectItem value="pending">Pendente</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="specialty">Especialidade</Label>
            <Input
              id="specialty"
              name="specialty"
              value={formData.specialty}
              onChange={handleChange}
              placeholder="Especialidade (para veterinários)"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="bio">Biografia</Label>
            <Textarea
              id="bio"
              name="bio"
              value={formData.bio}
              onChange={handleChange}
              placeholder="Informações adicionais sobre o colaborador"
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label>Permissões</Label>
            <div className="grid grid-cols-2 gap-2 mt-2">
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="permission-customers" 
                  checked={formData.permissions.includes('manage_customers')}
                  onCheckedChange={() => handlePermissionChange('manage_customers')}
                />
                <label htmlFor="permission-customers" className="text-sm">Gerenciar Clientes</label>
              </div>
              
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="permission-pets" 
                  checked={formData.permissions.includes('manage_pets')}
                  onCheckedChange={() => handlePermissionChange('manage_pets')}
                />
                <label htmlFor="permission-pets" className="text-sm">Gerenciar Pets</label>
              </div>
              
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="permission-appointments" 
                  checked={formData.permissions.includes('manage_appointments')}
                  onCheckedChange={() => handlePermissionChange('manage_appointments')}
                />
                <label htmlFor="permission-appointments" className="text-sm">Gerenciar Agendamentos</label>
              </div>
              
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="permission-records" 
                  checked={formData.permissions.includes('manage_medical_records')}
                  onCheckedChange={() => handlePermissionChange('manage_medical_records')}
                />
                <label htmlFor="permission-records" className="text-sm">Prontuários Médicos</label>
              </div>
              
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="permission-sales" 
                  checked={formData.permissions.includes('manage_sales')}
                  onCheckedChange={() => handlePermissionChange('manage_sales')}
                />
                <label htmlFor="permission-sales" className="text-sm">Gerenciar Vendas</label>
              </div>
              
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="permission-inventory" 
                  checked={formData.permissions.includes('manage_inventory')}
                  onCheckedChange={() => handlePermissionChange('manage_inventory')}
                />
                <label htmlFor="permission-inventory" className="text-sm">Gerenciar Estoque</label>
              </div>
              
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="permission-finance" 
                  checked={formData.permissions.includes('manage_clinic_finance')}
                  onCheckedChange={() => handlePermissionChange('manage_clinic_finance')}
                />
                <label htmlFor="permission-finance" className="text-sm">Gerenciar Financeiro</label>
              </div>
              
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="permission-users" 
                  checked={formData.permissions.includes('manage_users')}
                  onCheckedChange={() => handlePermissionChange('manage_users')}
                />
                <label htmlFor="permission-users" className="text-sm">Gerenciar Usuários</label>
              </div>
              
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="permission-settings" 
                  checked={formData.permissions.includes('manage_settings')}
                  onCheckedChange={() => handlePermissionChange('manage_settings')}
                />
                <label htmlFor="permission-settings" className="text-sm">Configurações</label>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                'Salvar'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
