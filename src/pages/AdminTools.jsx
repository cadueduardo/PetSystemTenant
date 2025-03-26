import React, { useState, useEffect } from "react";
import { User } from "@/api/entities";
import { Tenant } from "@/api/entities";
import { Customization } from "@/api/entities";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { toast } from "@/components/ui/use-toast";
import { Trash2, Loader2, ArrowLeft, Database, Wrench, Shield } from "lucide-react";
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

export default function AdminTools() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [tenants, setTenants] = useState([]);
  const [customizations, setCustomizations] = useState([]);
  const [isDeleting, setIsDeleting] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteType, setDeleteType] = useState(null);

  useEffect(() => {
    checkAdmin();
  }, []);

  const checkAdmin = async () => {
    try {
      const userData = await User.me();
      if (userData.role === 'admin') {
        setIsAdmin(true);
        loadData();
      } else {
        toast({
          title: "Acesso negado",
          description: "Você não tem permissão para acessar esta página.",
          variant: "destructive"
        });
        navigate(createPageUrl("Landing"));
      }
    } catch (error) {
      console.error("Erro ao verificar admin:", error);
      navigate(createPageUrl("Landing"));
    } finally {
      setIsLoading(false);
    }
  };

  const loadData = async () => {
    try {
      const [tenantData, customizationData] = await Promise.all([
        Tenant.list(),
        Customization.list()
      ]);
      
      setTenants(tenantData || []);
      setCustomizations(customizationData || []);
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
      toast({
        title: "Erro",
        description: "Falha ao carregar dados.",
        variant: "destructive"
      });
    }
  };

  const handleDelete = async () => {
    if (!selectedItem) return;
    
    setIsDeleting(true);
    
    try {
      if (deleteType === 'tenant') {
        // Primeiro excluir customizações relacionadas a este tenant
        const relatedCustomizations = customizations.filter(c => c.tenant_id === selectedItem.id);
        
        for (const customization of relatedCustomizations) {
          await Customization.delete(customization.id);
        }
        
        await Tenant.delete(selectedItem.id);
        toast({
          title: "Tenant excluído",
          description: `Tenant ${selectedItem.company_name} foi excluído com sucesso.`
        });
      } else if (deleteType === 'customization') {
        await Customization.delete(selectedItem.id);
        toast({
          title: "Customização excluída",
          description: `Customização ID ${selectedItem.id} foi excluída com sucesso.`
        });
      }
      
      loadData();
    } catch (error) {
      console.error("Erro ao excluir:", error);
      toast({
        title: "Erro",
        description: "Falha ao excluir item.",
        variant: "destructive"
      });
    } finally {
      setIsDeleting(false);
      setDeleteDialogOpen(false);
      setSelectedItem(null);
    }
  };

  const confirmDelete = (item, type) => {
    setSelectedItem(item);
    setDeleteType(type);
    setDeleteDialogOpen(true);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Loader2 className="w-10 h-10 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="container mx-auto py-10">
      <div className="flex items-center gap-4 mb-6">
        <Button 
          variant="outline" 
          size="icon" 
          onClick={() => navigate(createPageUrl("Landing"))}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-2xl font-bold">Ferramentas Administrativas</h1>
      </div>

      <div className="flex gap-4 mb-6">
        <Card className="flex-1">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5 text-blue-600" />
              Total de Tenants
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{tenants.length}</p>
          </CardContent>
        </Card>
        
        <Card className="flex-1">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-purple-600" />
              Customizações
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{customizations.length}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Tenants</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>URL</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tenants.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center">Nenhum tenant encontrado</TableCell>
                  </TableRow>
                ) : (
                  tenants.map((tenant) => (
                    <TableRow key={tenant.id}>
                      <TableCell className="font-mono text-xs">{tenant.id.substring(0, 8)}...</TableCell>
                      <TableCell>{tenant.company_name}</TableCell>
                      <TableCell>{tenant.access_url}</TableCell>
                      <TableCell>{tenant.status}</TableCell>
                      <TableCell className="text-right">
                        <Button 
                          variant="destructive" 
                          size="sm"
                          onClick={() => confirmDelete(tenant, 'tenant')}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Customizações</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Tenant ID</TableHead>
                  <TableHead>Cor Primária</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customizations.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center">Nenhuma customização encontrada</TableCell>
                  </TableRow>
                ) : (
                  customizations.map((customization) => (
                    <TableRow key={customization.id}>
                      <TableCell className="font-mono text-xs">{customization.id.substring(0, 8)}...</TableCell>
                      <TableCell className="font-mono text-xs">{customization.tenant_id ? customization.tenant_id.substring(0, 8) + "..." : "N/A"}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-4 h-4 rounded-full" 
                            style={{ backgroundColor: customization.primary_color || '#3B82F6' }}
                          ></div>
                          {customization.primary_color || 'Padrão'}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button 
                          variant="destructive" 
                          size="sm"
                          onClick={() => confirmDelete(customization, 'customization')}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar exclusão</DialogTitle>
            <DialogDescription>
              {deleteType === 'tenant' && `Tem certeza que deseja excluir o tenant "${selectedItem?.company_name}"?`}
              {deleteType === 'customization' && `Tem certeza que deseja excluir esta customização?`}
              <br /><br />
              Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setDeleteDialogOpen(false)}
              disabled={isDeleting}
            >
              Cancelar
            </Button>
            <Button 
              variant="destructive"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Excluindo...
                </>
              ) : (
                'Excluir'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}