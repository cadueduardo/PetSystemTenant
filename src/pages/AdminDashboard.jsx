import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getAuth, onAuthStateChanged, getIdTokenResult, signInWithCustomToken, signOut } from "firebase/auth";
import {
  Building,
  PlusCircle,
  Search,
  Loader2,
  CheckCircle,
  XCircle,
  CalendarCheck,
  MoreVertical,
  KeyRound,
  ShieldAlert
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
  // Removing unused imports below
  // Dialog,
  // DialogContent,
  // DialogDescription,
  // DialogFooter,
  // DialogHeader,
  // DialogTitle, 
} from "@/components/ui/dialog"; // Comment out or remove the entire import if Dialog is not used anywhere else
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
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
import { 
    AlertDialog, 
    AlertDialogAction, 
    AlertDialogCancel, 
    AlertDialogContent, 
    AlertDialogDescription,
    AlertDialogFooter, 
    AlertDialogHeader, 
    AlertDialogTitle 
} from "@/components/ui/alert-dialog";
import { adminTenantService } from "@/api/firebase/adminTenantService";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";
import { httpsCallable } from "firebase/functions";
import { db, functions } from '@/lib/firebaseConfig';

// Callable usando 'functions' importado
const generateSupportTokenCallable = httpsCallable(functions, 'generateSupportToken');

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [tenants, setTenants] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [showNewTenantForm, setShowNewTenantForm] = useState(false);
  const [editingTenant, setEditingTenant] = useState(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [tenantToDelete, setTenantToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState(null);
  const [isEnteringSupportMode, setIsEnteringSupportMode] = useState(null);
  
  useEffect(() => {
    const auth = getAuth();

    // Listener for authentication state changes
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        // User is signed in.
        console.log(`[AdminDashboard Auth Listener] User is authenticated: ${user.uid}`);
        setIsLoading(true);
        setError(null);
        try {
          console.log("[AdminDashboard Auth Listener] Forcing token refresh...");
          // Forçar refresh e obter resultado completo do token
          const idTokenResult = await getIdTokenResult(user, true); 
          console.log("[AdminDashboard Auth Listener] Token refreshed. Checking claims...");

          // ---> VERIFICAÇÃO EXPLÍCITA DE SUPER ADMIN <--- 
          if (idTokenResult.claims.tenant_id) {
             console.error(`[AdminDashboard Auth Listener] Permission Denied: User ${user.uid} has tenant_id claim, but is trying to access Admin Dashboard.`, idTokenResult.claims);
             setError("Acesso negado. Esta conta parece ser de um administrador de loja, não um Super Administrador.");
             // Opcional: Deslogar o usuário ou redirecionar
             // await signOut(auth);
             // navigate("/adminlogin"); 
             setIsLoading(false);
             return; // Impede a busca de tenants
          }
          console.log(`[AdminDashboard Auth Listener] User ${user.uid} confirmed as Super Admin (no tenant_id claim). Fetching tenants...`);
          // ---> FIM DA VERIFICAÇÃO <--- 

          const fetchedTenants = await adminTenantService.listAll();
          console.log("[AdminDashboard Auth Listener] Tenants fetched successfully:", fetchedTenants);
          setTenants(fetchedTenants);
        } catch (err) {
          console.error("[AdminDashboard Auth Listener] Error fetching tenants:", err);
          setError(err.message || "Falha ao carregar tenants.");
        } finally {
          setIsLoading(false);
        }
      } else {
        // User is signed out.
        console.log("[AdminDashboard Auth Listener] User is not authenticated. Redirecting to login.");
        setTenants([]); // Clear tenants state
        setIsLoading(false); // Set loading false when redirecting
        navigate("/adminlogin"); // Redirect to admin login page
      }
    });

    // Cleanup function to unsubscribe when the component unmounts
    return () => unsubscribe();

  }, [navigate]);
  
  const handleAccessTenant = (tenant) => {
    if (tenant && tenant.access_url) {
      // ... localStorage calls ...
      const tenantDashboardUrl = `/tenant/dashboard?store=${tenant.access_url}`; // <-- VERIFIQUE ESTA LINHA
      console.log(`[AdminDashboard] Opening tenant dashboard: ${tenantDashboardUrl}`);
      window.open(tenantDashboardUrl, '_blank');
    }
  };
  
  const handleEditTenant = (tenant) => {
    setEditingTenant(tenant);
    setShowNewTenantForm(true);
  };
  
  const promptDeleteTenant = (tenant) => {
    setTenantToDelete(tenant);
    setIsDeleteDialogOpen(true);
  };
  
  const confirmDeleteTenant = async () => {
    if (!tenantToDelete) return;
    
    setIsDeleting(true);
    try {
      console.log(`[AdminDashboard] Deleting tenant ID: ${tenantToDelete.id}`);
      
      // Call the actual delete service function
      await adminTenantService.delete(tenantToDelete.id);

      // Update the local state AFTER successful deletion
      const updatedTenants = tenants.filter(t => t.id !== tenantToDelete.id);
      setTenants(updatedTenants);
      
      toast({
        title: "Tenant Excluído",
        description: `${tenantToDelete.company_name || tenantToDelete.name} foi removido com sucesso.`,
      });
      
    } catch (error) {
       console.error("[AdminDashboard] Error during tenant deletion:", error);
       toast({ title: "Erro ao Excluir", description: error.message || "Não foi possível excluir o tenant.", variant: "destructive" });
    } finally {
      setIsDeleting(false);
      setIsDeleteDialogOpen(false); 
      setTenantToDelete(null);
    }
  };
  
  const handleTenantFormSuccess = (updatedTenant, isNew = true) => {
    if (isNew) {
      setTenants(prevTenants => [updatedTenant, ...prevTenants]);
      toast({
        title: "Tenant criado com sucesso",
        description: `${updatedTenant.company_name} foi adicionado à plataforma.`
      });
    } else {
      setTenants(prevTenants => 
        prevTenants.map(t => t.id === updatedTenant.id ? updatedTenant : t)
      );
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
    const nameMatch = (tenant.name || tenant.company_name) && typeof (tenant.name || tenant.company_name) === 'string' 
                      ? (tenant.name || tenant.company_name).toLowerCase().includes(searchQuery.toLowerCase()) 
                      : false; 
    const emailMatch = tenant.email && typeof tenant.email === 'string' 
                       ? tenant.email.toLowerCase().includes(searchQuery.toLowerCase()) 
                       : false;

    const urlMatch = tenant.access_url && typeof tenant.access_url === 'string' 
                     ? tenant.access_url.toLowerCase().includes(searchQuery.toLowerCase()) 
                     : false;

    const matchesSearch = nameMatch || emailMatch || urlMatch;
    
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
  
  const handleSupportAccess = async (tenant) => {
    if (!tenant || !tenant.id) {
      console.error("Informações inválidas do tenant para acesso de suporte.");
      toast({ title: "Erro", description: "ID do Tenant inválido.", variant: "destructive" });
      return;
    }
    
    setIsEnteringSupportMode(tenant.id);
    setError(null);
    
    try {
      console.log(`[handleSupportAccess] Chamando generateSupportToken (onCall) para tenant ID: ${tenant.id}`);
      
      const result = await generateSupportTokenCallable({ targetTenantId: tenant.id });
      const resultData = result.data;

      if (resultData?.success && resultData.customToken) {
        console.log("[handleSupportAccess] Token customizado recebido. Fazendo signOut...");
        const auth = getAuth();
        await signOut(auth);
        console.log("[handleSupportAccess] SignIn com token customizado...");
        await signInWithCustomToken(auth, resultData.customToken);
        console.log("[handleSupportAccess] Login com token customizado bem-sucedido! Redirecionando...");
        navigate("/tenant/dashboard"); 
      } else {
         const errorMessage = resultData?.message || "Falha ao obter token customizado (resposta inesperada da função).";
         console.error("[handleSupportAccess] Falha na chamada da função onCall:", errorMessage, resultData);
         throw new Error(errorMessage);
      }

    } catch (error) {
      console.error("[handleSupportAccess] Erro ao entrar em modo suporte (onCall):", error);
      const message = error.message || "Ocorreu um erro desconhecido.";
      setError(`Falha ao iniciar modo suporte para ${tenant.name || tenant.company_name}: ${message}`);
      toast({ title: "Erro", description: `Falha ao iniciar modo suporte: ${message}`, variant: "destructive" });
    } finally {
      setIsEnteringSupportMode(null); 
    }
  };
  
  return (
    <div className="container mx-auto py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Admin Dashboard - Tenants</h1>
         {/* <Button onClick={() => {}}>Adicionar Novo Tenant</Button> */}
      </div>

      {/* Exibir Erro */}
      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Erro</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Indicador de Carregamento */}
      {isLoading && (
        <div className="flex justify-center items-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      )}

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
                <p className="text-gray-500">Nenhum tenant encontrado. Clique em &quot;Novo Tenant&quot; para adicionar uma clínica ou pet shop.</p>
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
                    {filteredTenants.map((tenant) => {
                      const isSupportAccessActive = tenant.supportAccessGranted === true && 
                                                    (!tenant.supportAccessExpiresAt || tenant.supportAccessExpiresAt.toMillis() > Date.now());
                      
                      const isLoadingSupport = isEnteringSupportMode === tenant.id;

                      return (
                        <TableRow key={tenant.id}>
                          <TableCell>
                            <div>
                              <p className="font-medium">{tenant.name || tenant.company_name}</p>
                              <p className="text-sm text-gray-500">{tenant.email}</p>
                            </div>
                          </TableCell>
                          <TableCell>{getBusinessTypeDisplay(tenant.business_type)}</TableCell>
                          <TableCell>
                            <a 
                              href={`http://${tenant.access_url}.petgestor.com.br`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:underline text-sm"
                            >
                              {tenant.access_url}.petgestor.com.br
                            </a>
                          </TableCell>
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
                            <div className="flex items-center justify-end space-x-1">
                              {isSupportAccessActive && !isLoadingSupport && (
                                <ShieldAlert 
                                  className="h-5 w-5 text-orange-500 flex-shrink-0"
                                  title={`Acesso de suporte concedido até ${new Date(tenant.supportAccessExpiresAt.seconds * 1000).toLocaleString('pt-BR')}`}
                                />
                              )}

                              <Button 
                                variant="outline"
                                size="sm"
                                onClick={() => handleSupportAccess(tenant)}
                                title="Acessar conta como suporte"
                                className="h-8 px-2 flex-shrink-0"
                                disabled={isLoadingSupport}
                              >
                                {isLoadingSupport ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <>
                                    <KeyRound className="h-4 w-4 mr-1" />
                                    Acessar
                                  </>
                                )}
                              </Button>

                              {!isLoadingSupport && (
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" className="h-8 w-8 p-0 flex-shrink-0">
                                      <span className="sr-only">Abrir menu</span>
                                      <MoreVertical className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuLabel>Ações</DropdownMenuLabel>
                                    <DropdownMenuItem onClick={() => handleAccessTenant(tenant)} disabled={isLoadingSupport}>
                                      Abrir Painel
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => handleEditTenant(tenant)} disabled={isLoadingSupport}>
                                      Editar
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem 
                                      className="text-red-600 focus:text-red-700 focus:bg-red-50"
                                      onClick={() => promptDeleteTenant(tenant)}
                                      disabled={isLoadingSupport}
                                    >
                                      Excluir Tenant
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
      
      <TenantForm 
        open={showNewTenantForm} 
        onOpenChange={handleFormClose}
        onSuccess={handleTenantFormSuccess}
        tenant={editingTenant}
      />

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              {`Tem certeza que deseja excluir o tenant "${tenantToDelete?.name || tenantToDelete?.company_name}"? Esta ação não pode ser desfeita e removerá todos os dados associados.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setTenantToDelete(null)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmDeleteTenant} 
              className="bg-red-600 hover:bg-red-700"
              disabled={isDeleting}
            >
              {isDeleting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Confirmar Exclusão
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
