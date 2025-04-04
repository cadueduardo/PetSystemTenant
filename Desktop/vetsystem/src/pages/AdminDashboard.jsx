
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import {
  Building,
  Globe,
  Users,
  Package,
  PlusCircle,
  Trash2,
  Edit,
  ArrowRight,
  Shield,
  Settings,
  LogOut,
  Search,
  BarChart3,
  Loader2,
  CheckCircle,
  XCircle,
  CalendarCheck
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/use-toast";
import { Badge } from "@/components/ui/badge";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import TenantForm from "../components/admin/TenantForm";

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [tenants, setTenants] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedTenant, setSelectedTenant] = useState(null);
  const [showNewTenantForm, setShowNewTenantForm] = useState(false);
  const [editingTenant, setEditingTenant] = useState(null);
  
  useEffect(() => {
    const isAuthenticated = localStorage.getItem('admin_authenticated') === 'true';
    if (!isAuthenticated) {
      navigate(createPageUrl("AdminLogin"));
      return;
    }
    
    const persistentTenants = localStorage.getItem('persistent_tenants');
    const currentTenants = localStorage.getItem('admin_tenants');
    
    let tenants = [];
    if (persistentTenants) {
      tenants = JSON.parse(persistentTenants);
      localStorage.setItem('admin_tenants', persistentTenants);
    } else if (currentTenants) {
      tenants = JSON.parse(currentTenants);
      localStorage.setItem('persistent_tenants', currentTenants);
    }
    
    setTenants(tenants);
    setIsLoading(false);
  }, [navigate]);
  
  const handleAccessTenant = (tenant) => {
    if (tenant && tenant.access_url) {
      localStorage.setItem('current_tenant', tenant.access_url);
      localStorage.setItem('tenant_name', tenant.company_name);
      localStorage.setItem('tenant_modules', JSON.stringify(tenant.selected_modules || []));
      
      window.open(`/Dashboard?store=${tenant.access_url}`, '_blank');
    }
  };
  
  const handleEditTenant = (tenant) => {
    setEditingTenant(tenant);
    setShowNewTenantForm(true);
  };
  
  const handleDeleteTenant = (tenant) => {
    setSelectedTenant(tenant);
    setShowDeleteDialog(true);
  };
  
  const confirmDeleteTenant = async () => {
    if (!selectedTenant) return;
    
    setIsLoading(true);
    
    setTimeout(() => {
      const updatedTenants = tenants.filter(t => t.id !== selectedTenant.id);
      setTenants(updatedTenants);
      
      localStorage.setItem('admin_tenants', JSON.stringify(updatedTenants));
      localStorage.setItem('persistent_tenants', JSON.stringify(updatedTenants));
      
      toast({
        title: "Tenant excluído",
        description: `${selectedTenant.company_name} foi removido com sucesso.`,
      });
      
      setIsLoading(false);
      setShowDeleteDialog(false);
      setSelectedTenant(null);
    }, 800);
  };
  
  const handleTenantFormSuccess = (updatedTenant, isNew = true) => {
    if (isNew) {
      const newTenants = [updatedTenant, ...tenants];
      setTenants(newTenants);
      
      localStorage.setItem('admin_tenants', JSON.stringify(newTenants));
      localStorage.setItem('persistent_tenants', JSON.stringify(newTenants));
      
      toast({
        title: "Tenant criado com sucesso",
        description: `${updatedTenant.company_name} foi adicionado à plataforma.`
      });
    } else {
      const updatedTenants = tenants.map(t => t.id === updatedTenant.id ? updatedTenant : t);
      setTenants(updatedTenants);
      
      localStorage.setItem('admin_tenants', JSON.stringify(updatedTenants));
      localStorage.setItem('persistent_tenants', JSON.stringify(updatedTenants));
      
      toast({
        title: "Tenant atualizado",
        description: `${updatedTenant.company_name} foi atualizado com sucesso.`
      });
    }
    
    setShowNewTenantForm(false);
    setEditingTenant(null);
  };
  
  const handleFormClose = () => {
    setShowNewTenantForm(false);
    setEditingTenant(null);
  };
  
  const filteredTenants = tenants.filter(tenant => {
    const matchesSearch = tenant.company_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        tenant.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        tenant.access_url?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = selectedStatus === "all" || tenant.status === selectedStatus;
    
    return matchesSearch && matchesStatus;
  });
  
  const getBusinessTypeDisplay = (type) => {
    switch (type) {
      case "clinic": return "Clínica Veterinária";
      case "petshop": return "Pet Shop";
      case "both": return "Clínica + Pet Shop";
      default: return type;
    }
  };
  
  const getStatusBadge = (status) => {
    switch (status) {
      case "active":
        return <Badge className="bg-green-100 text-green-800 hover:bg-green-200">Ativo</Badge>;
      case "suspended":
        return <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-200">Suspenso</Badge>;
      case "expired":
        return <Badge className="bg-red-100 text-red-800 hover:bg-red-200">Expirado</Badge>;
      default:
        return <Badge className="bg-gray-100 text-gray-800 hover:bg-gray-200">{status}</Badge>;
    }
  };
  
  return (
    <div className="p-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="bg-blue-100 p-3 rounded-full">
                <Building className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-gray-500 text-sm">Total de Tenants</p>
                <p className="text-2xl font-bold">{tenants.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="bg-green-100 p-3 rounded-full">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="text-gray-500 text-sm">Tenants Ativos</p>
                <p className="text-2xl font-bold">{tenants.filter(t => t.status === "active").length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="bg-amber-100 p-3 rounded-full">
                <CalendarCheck className="h-6 w-6 text-amber-600" />
              </div>
              <div>
                <p className="text-gray-500 text-sm">Este Mês</p>
                <p className="text-2xl font-bold">{
                  tenants.filter(t => {
                    const createdDate = new Date(t.created_date);
                    const now = new Date();
                    return createdDate.getMonth() === now.getMonth() && 
                           createdDate.getFullYear() === now.getFullYear();
                  }).length
                }</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="bg-red-100 p-3 rounded-full">
                <XCircle className="h-6 w-6 text-red-600" />
              </div>
              <div>
                <p className="text-gray-500 text-sm">Expirados</p>
                <p className="text-2xl font-bold">{tenants.filter(t => t.status === "expired").length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input 
              placeholder="Buscar tenants..." 
              className="pl-10"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          
          <Select value={selectedStatus} onValueChange={setSelectedStatus}>
            <SelectTrigger className="w-full sm:w-40">
              <SelectValue placeholder="Filtrar por status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="active">Ativos</SelectItem>
              <SelectItem value="suspended">Suspensos</SelectItem>
              <SelectItem value="expired">Expirados</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        <div className="flex gap-3 w-full sm:w-auto">
          <Button 
            className="bg-blue-600 hover:bg-blue-700 w-full sm:w-auto"
            onClick={() => {
              setEditingTenant(null);
              setShowNewTenantForm(true);
            }}
          >
            <PlusCircle className="h-4 w-4 mr-2" />
            Novo Tenant
          </Button>
        </div>
      </div>
      
      {isLoading ? (
        <div className="flex justify-center items-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      ) : (
        <Card className="overflow-hidden">
          <CardHeader className="p-6 pb-0">
            <CardTitle>Gerenciamento de Tenants</CardTitle>
            <CardDescription>
              Gerencie todas as clínicas veterinárias e pet shops no sistema
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6">
            {filteredTenants.length === 0 ? (
              <div className="text-center py-10">
                <p className="text-gray-500">Nenhum tenant encontrado. Clique em "Novo Tenant" para adicionar uma clínica ou pet shop.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Empresa</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>URL</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Módulos</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredTenants.map((tenant) => (
                      <TableRow key={tenant.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{tenant.company_name}</p>
                            <p className="text-sm text-gray-500">{tenant.email}</p>
                          </div>
                        </TableCell>
                        <TableCell>{getBusinessTypeDisplay(tenant.business_type)}</TableCell>
                        <TableCell>{tenant.access_url}</TableCell>
                        <TableCell>{getStatusBadge(tenant.status)}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {tenant.selected_modules?.map((module) => {
                              let label = "", bgColor = "";
                              
                              switch(module) {
                                case "clinic_management":
                                  label = "Clínica";
                                  bgColor = "bg-indigo-100 text-indigo-800";
                                  break;
                                case "petshop":
                                  label = "Petshop";
                                  bgColor = "bg-green-100 text-green-800";
                                  break;
                                case "financial":
                                  label = "Financeiro";
                                  bgColor = "bg-purple-100 text-purple-800";
                                  break;
                                case "transport":
                                  label = "Transporte";
                                  bgColor = "bg-amber-100 text-amber-800";
                                  break;
                                default:
                                  label = module;
                                  bgColor = "bg-gray-100 text-gray-800";
                              }
                              
                              return <Badge key={module} className={bgColor}>{label}</Badge>;
                            })}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <span className="sr-only">Abrir menu</span>
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                                  <circle cx="12" cy="12" r="1" />
                                  <circle cx="12" cy="5" r="1" />
                                  <circle cx="12" cy="19" r="1" />
                                </svg>
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleAccessTenant(tenant)}>
                                <Globe className="h-4 w-4 mr-2" />
                                Acessar
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleEditTenant(tenant)}>
                                <Edit className="h-4 w-4 mr-2" />
                                Editar
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem 
                                className="text-red-600 focus:text-red-600"
                                onClick={() => handleDeleteTenant(tenant)}
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Excluir
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
      )}
      
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar exclusão</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir o tenant <strong>{selectedTenant?.company_name}</strong>?
              Esta ação é irreversível e todos os dados relacionados serão perdidos.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)} disabled={isLoading}>
              Cancelar
            </Button>
            <Button 
              variant="destructive" 
              onClick={confirmDeleteTenant}
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Excluindo...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Excluir
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      <TenantForm 
        open={showNewTenantForm} 
        onOpenChange={handleFormClose}
        onSuccess={handleTenantFormSuccess}
        tenant={editingTenant}
      />
    </div>
  );
}
