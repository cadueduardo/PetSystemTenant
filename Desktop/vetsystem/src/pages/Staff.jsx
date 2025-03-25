
import React, { useState, useEffect } from "react";
import { TenantUser } from "@/api/entities";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "@/components/ui/use-toast";
import {
  Plus,
  Search,
  Loader2,
  UserPlus,
  Mail,
  Phone,
  Shield,
  Trash2,
  Edit,
} from "lucide-react";
import StaffForm from "../components/staff/StaffForm";

export default function StaffPage() {
  const [staff, setStaff] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingStaff, setEditingStaff] = useState(null);
  const tenantId = localStorage.getItem('current_tenant');

  useEffect(() => {
    loadStaff();
  }, []);

  const loadStaff = async () => {
    setIsLoading(true);
    try {
      const staffData = await TenantUser.filter({ tenant_id: tenantId });
      setStaff(staffData);
    } catch (error) {
      console.error("Erro ao carregar colaboradores:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os colaboradores.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("Tem certeza que deseja remover este colaborador?")) return;

    try {
      await TenantUser.delete(id);
      toast({
        title: "Sucesso",
        description: "Colaborador removido com sucesso!"
      });
      loadStaff();
    } catch (error) {
      toast({
        title: "Erro",
        description: "Não foi possível remover o colaborador.",
        variant: "destructive"
      });
    }
  };

  const handleEdit = (staffMember) => {
    setEditingStaff(staffMember);
    setShowForm(true);
  };

  const getRoleBadge = (role) => {
    const roleStyles = {
      admin: "bg-red-100 text-red-800",
      manager: "bg-purple-100 text-purple-800",
      veterinarian: "bg-blue-100 text-blue-800",
      receptionist: "bg-green-100 text-green-800",
      groomer: "bg-amber-100 text-amber-800",
      accountant: "bg-indigo-100 text-indigo-800",
      staff: "bg-gray-100 text-gray-800"
    };

    const roleNames = {
      admin: "Administrador",
      manager: "Gerente",
      veterinarian: "Veterinário",
      receptionist: "Recepcionista",
      groomer: "Tosador",
      accountant: "Contador",
      staff: "Colaborador"
    };

    return (
      <Badge className={roleStyles[role]}>
        {roleNames[role]}
      </Badge>
    );
  };

  const filteredStaff = staff.filter(member =>
    member.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    member.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-full p-8">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Colaboradores</h1>
        <Button onClick={() => {
          setEditingStaff(null);
          setShowForm(true);
        }}>
          <UserPlus className="h-4 w-4 mr-2" />
          Novo Colaborador
        </Button>
      </div>

      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
          <Input
            placeholder="Buscar colaboradores..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Contato</TableHead>
              <TableHead>Cargo</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredStaff.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-gray-500">
                  Nenhum colaborador encontrado.
                </TableCell>
              </TableRow>
            ) : (
              filteredStaff.map((member) => (
                <TableRow key={member.id}>
                  <TableCell>
                    <div className="font-medium">{member.full_name}</div>
                    {member.specialty && (
                      <div className="text-sm text-gray-500">{member.specialty}</div>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center text-sm text-gray-600">
                        <Mail className="h-4 w-4 mr-2" />
                        {member.email}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    {getRoleBadge(member.role)}
                  </TableCell>
                  <TableCell>
                    <Badge
                      className={
                        member.status === "active"
                          ? "bg-green-100 text-green-800"
                          : member.status === "pending"
                          ? "bg-yellow-100 text-yellow-800"
                          : "bg-gray-100 text-gray-800"
                      }
                    >
                      {member.status === "active" ? "Ativo" : 
                       member.status === "pending" ? "Pendente" : "Inativo"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEdit(member)}
                      >
                        <Edit className="h-4 w-4 mr-2" />
                        Editar
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-red-600 hover:text-red-700"
                        onClick={() => handleDelete(member.id)}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Remover
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <StaffForm
        open={showForm}
        onOpenChange={setShowForm}
        staff={editingStaff}
        onSuccess={loadStaff}
      />
    </div>
  );
}
