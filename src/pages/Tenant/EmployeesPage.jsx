import { useState, useEffect, useCallback } from 'react';
import { getFirestore, doc, deleteDoc, updateDoc, getDocs, collection, query, where } from 'firebase/firestore';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, PlusCircle, Pencil, Trash2, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTenant } from '@/components/tenant/TenantContext';
import { useToast } from "@/components/ui/use-toast";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { collaboratorService } from '@/api/firebase/collaboratorService';
import PaginationControls from "@/components/ui/PaginationControls";

// --- Log para verificar se o módulo JS está sendo carregado --- 
console.log("--- MODULE LOAD: src/pages/Tenant/EmployeesPage.jsx (Restoring Firestore Query) ---");
// -------------------------------------------------------------

// --- Objeto para mapear status e estilos --- 
const statusConfig = {
  convite_pendente: { text: 'Aguard. Conf.', variant: 'warning' },
  ativo: { text: 'Ativo', variant: 'success' }, // Usar variant 'success' (precisa definir no CSS ou usar classes)
  inativo: { text: 'Inativo', variant: 'secondary' },
  convite_expirado: { text: 'Expirado', variant: 'destructive' },
  erro_no_convite: { text: 'Erro Convite', variant: 'destructive' },
  erro_email_ja_existente: { text: 'Email Existe', variant: 'destructive' },
  default: { text: 'Desconhecido', variant: 'outline' }
};

// --- Função auxiliar para obter display do status ---
const getEmployeeStatusDisplay = (employee) => {
  const statusValue = employee.status;
  const hasAuthUid = !!employee.authUid; // Verifica se já aceitou o convite

  if (statusValue === 'convite_pendente' && !hasAuthUid) {
    return statusConfig.convite_pendente;
  } else if (hasAuthUid && statusValue === true) {
    return statusConfig.ativo;
  } else if (hasAuthUid && statusValue === false) {
    return statusConfig.inativo;
  } else if (statusValue === 'convite_expirado') {
    return statusConfig.convite_expirado;
  } else if (statusValue === 'erro_no_convite') {
    return statusConfig.erro_no_convite;
  } else if (statusValue === 'erro_email_ja_existente') {
    return statusConfig.erro_email_ja_existente;
  } else {
    // Fallback para status desconhecidos ou booleanos sem authUid
    console.warn(`[EmployeesPage] Status desconhecido ou inconsistente para colaborador ${employee.id}:`, statusValue, `Has authUid: ${hasAuthUid}`);
    return statusConfig.default;
  }
};

function EmployeesPage() {
  const [employees, setEmployees] = useState([]);
  const [profilesMap, setProfilesMap] = useState({});
  const [isLoadingInitial, setIsLoadingInitial] = useState(true);
  const [error, setError] = useState(null);
  const tenantContext = useTenant();
  const db = getFirestore();
  const navigate = useNavigate();
  const { toast } = useToast();

  // Estados de Paginação
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [lastVisibleDoc, setLastVisibleDoc] = useState(null);
  const [firstVisibleDoc, setFirstVisibleDoc] = useState(null);
  const [totalEmployees, setTotalEmployees] = useState(0);
  const [isLoadingPage, setIsLoadingPage] = useState(false);

  // Ordenação padrão (pode ser expandida com UI no futuro)
  const sortBy = 'nome'; // Fixo por enquanto
  const sortOrder = 'asc'; // Fixo por enquanto

  const loadEmployeesPage = useCallback(async (direction = 'current', newPageSize = pageSize, forFiltersReset = false) => {
    const tenantId = tenantContext.currentTenant?.id;
    if (!tenantId) {
      setError("ID da Loja não encontrado. Não é possível buscar colaboradores.");
      setIsLoadingInitial(false);
      setIsLoadingPage(false);
      setEmployees([]);
      return;
    }

    console.log(`[EmployeesPage loadEmployeesPage] Dir: ${direction}, Size: ${newPageSize}, Page: ${currentPage}, Tenant: ${tenantId}`);
    setIsLoadingPage(true);
    if (direction === 'current' || forFiltersReset) setIsLoadingInitial(true);

    try {
      const filterOptions = {
        tenantId,
        orderByField: sortBy,
        orderByDirection: sortOrder,
        limitNum: newPageSize,
      };

      if (direction === 'current' || forFiltersReset) {
        const count = await collaboratorService.getCount({ tenantId });
        setTotalEmployees(count);
        setCurrentPage(1);
        setFirstVisibleDoc(null);
        setLastVisibleDoc(null);
        filterOptions.startAfterDoc = null;
      } else if (direction === 'next' && lastVisibleDoc) {
        filterOptions.startAfterDoc = lastVisibleDoc;
      } else if (direction === 'prev' && firstVisibleDoc) {
        // Lógica de 'prev' ainda simplificada. Idealmente, o service lidaria com endBefore.
        // Por ora, vamos tentar inverter a ordem e pegar o "startAfter" do que seria o fim da página anterior.
        // Esta lógica de 'prev' é complexa sem endBeforeDoc no service.
        // A melhoria seria adicionar isso ao collaboratorService.list
        // Temporariamente, pode não funcionar perfeitamente ou ser menos eficiente.
        console.warn("[EmployeesPage] 'Previous' page logic is simplified.");
        filterOptions.orderByDirection = sortOrder === 'asc' ? 'desc' : 'asc';
        // Sem endBeforeDoc, a query buscaria a partir do início na ordem reversa.
        // Precisamos buscar "até" o firstVisibleDoc.
        // A solução de Customers.jsx usa `endBefore` diretamente na query, o que não temos no service.
        // Solução pragmática: recarregar a primeira página se o usuário tentar ir para trás.
        // Isso é feito efetivamente pelo PaginationControls se hasPreviousPage for gerenciado corretamente.
        // Ou, para tentar uma navegação, faríamos a query reversa e pegaríamos os últimos, depois reverteríamos.
        // Esta parte é complexa de acertar sem o `endBefore` no `collaboratorService.list`.
        // Para este passo, vamos manter a lógica de `prev` mais simples: decrementar `currentPage`
        // e o `PaginationControls` gerenciará a disponibilidade do botão.
        // A busca efetiva da página anterior correta precisará de `endBefore`.
        // Por agora, apenas preparamos a query para ordem reversa, mas `startAfterDoc` não é usado para `prev` aqui.
        // A query em collaboratorService.list fará orderBy invertido. A reversão dos dados será feita após a busca.
      }

      const { collaborators: fetchedCollaborators, lastVisibleDoc: newLastVisible } = await collaboratorService.list(filterOptions);
      
      let employeesData = fetchedCollaborators || [];
      if (direction === 'prev' && firstVisibleDoc && filterOptions.orderByDirection !== sortOrder) {
         // Se a ordem da query foi invertida para buscar a página anterior,
         // precisamos reverter os resultados para a ordem de exibição correta.
         employeesData.reverse();
      }

      setEmployees(employeesData);
      setLastVisibleDoc(newLastVisible || null);
      setFirstVisibleDoc(employeesData.length > 0 ? employeesData[0] : null);

      if (employeesData.length > 0) {
        fetchProfileNames(employeesData);
      }

      if (direction === 'next') {
        setCurrentPage(prev => prev + 1);
      } else if (direction === 'prev' && currentPage > 1) {
        setCurrentPage(prev => prev - 1);
      }
      // Se direction === 'current' ou forFiltersReset, setCurrentPage(1) já foi chamado.

    } catch (err) {
      console.error("[EmployeesPage] Error loading collaborators:", err);
      setError("Falha ao carregar colaboradores. Tente novamente mais tarde.");
      setTotalEmployees(0);
      setEmployees([]);
    } finally {
      setIsLoadingInitial(false);
      setIsLoadingPage(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantContext.currentTenant?.id, pageSize, toast]); // Adicionado toast às dependências

  useEffect(() => {
    if (tenantContext.isLoading) {
      setIsLoadingInitial(true);
      setError(null);
      return;
    }
    if (tenantContext.error) {
      setError(`Erro ao carregar informações da loja: ${tenantContext.error}`);
      setIsLoadingInitial(false);
      return;
    }
    if (tenantContext.currentTenant?.id) {
      loadEmployeesPage('current', pageSize, true); // Carga inicial ou reset por mudança de tenant
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantContext.isLoading, tenantContext.currentTenant?.id, tenantContext.error]); // Apenas estas dependências para a carga inicial

  // --- Função para buscar nomes dos perfis (Restaurada) ---
  const fetchProfileNames = async (employeeList) => {
    const profileIds = [...new Set(employeeList.map(emp => emp.perfilId).filter(Boolean))];
    if (profileIds.length === 0) {
        setProfilesMap({}); 
        return;
    }

    const newProfilesMap = { ...profilesMap }; 
    const profilesToFetch = profileIds.filter(id => !newProfilesMap[id]);

    if (profilesToFetch.length > 0) {
        // Verifica se o tenantId está disponível antes de buscar perfis
        const currentTenantId = tenantContext.currentTenant?.id;
        if (!currentTenantId) {
            console.warn("[fetchProfileNames] TenantId not available, cannot fetch profiles.");
            return; 
        }
        console.log("[fetchProfileNames] Fetching missing profiles:", profilesToFetch);
        // Busca apenas os documentos de perfis pertencentes ao tenant atual
        const profilesRef = collection(db, 'perfis');
        // Simplificação: Buscar todos os perfis do tenant e filtrar depois
        // const q = query(profilesRef, where(documentId(), 'in', profilesToFetch), where('tenantId', '==', currentTenantId)); 
        const q_all_tenant_profiles = query(profilesRef, where('tenantId', '==', currentTenantId));
        
        try {
            // const querySnapshot = await getDocs(q);
            const allProfilesSnapshot = await getDocs(q_all_tenant_profiles);

            // Filtra e mapeia os perfis necessários no lado do cliente
            allProfilesSnapshot.forEach(docSnap => {
                if (profilesToFetch.includes(docSnap.id)) { // Verifica se o ID está na lista que precisamos
                if (docSnap.exists()) {
                    newProfilesMap[docSnap.id] = docSnap.data().nome; 
                } else {
                        // Este caso é menos provável aqui, mas mantém por segurança
                    newProfilesMap[docSnap.id] = 'Perfil não encontrado'; 
                    }
                }
            });
            // Preenche IDs não encontrados (caso a query não retorne ou não esteja na lista inicial)
            profilesToFetch.forEach(id => {
                if (!newProfilesMap[id]) {
                     newProfilesMap[id] = 'Perfil inválido/não pertence';
                }
            });
            setProfilesMap(newProfilesMap);
        } catch (error) {
            console.error("[fetchProfileNames] Error fetching profile names:", error);
            // Preenche os não encontrados com erro
            profilesToFetch.forEach(id => {
                newProfilesMap[id] = 'Erro ao buscar';
            });
             setProfilesMap(newProfilesMap);
        }
    }
  };
  // ---------------------------------------------------------

  // --- Função para lidar com ativação/desativação (Restaurada) ---
  const handleToggleStatus = async (employeeId, currentStatus) => {
    const newStatus = !currentStatus;
    const statusLabel = newStatus ? "Ativo" : "Inativo";
    console.log(`[EmployeesPage] Toggling status for ${employeeId} to ${statusLabel}`);
    
    // Verificar tenantId aqui também por segurança
    const currentTenantId = tenantContext.currentTenant?.id;
    if (!currentTenantId) {
        toast({ variant: "destructive", title: "Erro", description: "ID da Loja não encontrado para alterar status." });
        return;
    }

    const docRef = doc(db, 'colaboradores', employeeId);
    try {
      // Validação extra: garantir que o doc pertence ao tenant?
      // const docSnap = await getDoc(docRef); // Opcional, pode adicionar custo de leitura
      // if (!docSnap.exists() || docSnap.data().tenantId !== currentTenantId) throw new Error("Documento não encontrado ou pertence a outro tenant");
      
      await updateDoc(docRef, { status: newStatus });
      toast({
        title: "Status Alterado",
        description: `Status do colaborador alterado para ${statusLabel}.`,
      });
    } catch (error) {
      console.error("[EmployeesPage] Error toggling status:", error);
      toast({
        variant: "destructive",
        title: "Erro ao Alterar Status",
        description: `Não foi possível alterar o status. (${error.message})`,
      });
    }
  };
  // ------------------------------------------------------------

  // --- Função para Excluir Colaborador (Restaurada) ---
  const handleDeleteEmployee = async (employeeId, employeeName) => {
    const currentTenantId = tenantContext.currentTenant?.id; 
    if (!currentTenantId) {
        toast({ variant: "destructive", title: "Erro", description: "ID da Loja não disponível para exclusão." });
        return;
    }

    if (!window.confirm(`Tem certeza que deseja excluir o colaborador "${employeeName}"?`)) {
        return;
    }

    console.log(`[EmployeesPage] Deleting employee ${employeeId} for tenant ${currentTenantId}`);
    try {
      const docRef = doc(db, 'colaboradores', employeeId);
      // Validação extra (opcional):
      // const docSnap = await getDoc(docRef);
      // if (!docSnap.exists() || docSnap.data().tenantId !== currentTenantId) throw new Error("Documento não encontrado ou pertence a outro tenant");
      
      await deleteDoc(docRef);
      toast({
          title: "Colaborador Excluído",
          description: `O colaborador "${employeeName}" foi excluído com sucesso.`,
      });
    } catch (err) {
      console.error("[EmployeesPage] Error deleting employee:", err);
      toast({
          variant: "destructive",
          title: "Erro ao Excluir",
          description: `Falha ao excluir o colaborador "${employeeName}". (${err.message})`,
      });
    }
  };
  // ----------------------------------------------------

  // Funções de Paginação
  const handlePageChange = (directionOrPageNumber) => {
    if (typeof directionOrPageNumber === 'string') {
      loadEmployeesPage(directionOrPageNumber, pageSize, false);
    } else {
      console.warn("[EmployeesPage] Direct page number navigation not fully implemented.");
    }
  };

  const handlePageSizeChange = (newPageSize) => {
    setPageSize(newPageSize);
    loadEmployeesPage('current', newPageSize, true); // true para forFiltersReset
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold">Gestão de Colaboradores</h1>
        <Button onClick={() => navigate('/tenant/colaborador/novo')}> 
          <PlusCircle className="mr-2 h-4 w-4" /> Adicionar Colaborador
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Colaboradores Cadastrados</CardTitle>
        </CardHeader>
        <CardContent>
          {(isLoadingInitial) && <div className="flex justify-center items-center py-10"><Loader2 className="h-8 w-8 animate-spin text-primary" /> <p className="ml-2">Carregando...</p></div>}
          {!isLoadingInitial && error && (
            <div className="text-red-600 flex items-center">
              <AlertCircle className="mr-2 h-5 w-5" /> {error}
            </div>
          )}
          {!isLoadingInitial && !error && (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Perfil</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {employees.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground">
                        {totalEmployees === 0 ? "Nenhum colaborador cadastrado ainda." : "Nenhum colaborador nesta página."}
                      </TableCell>
                    </TableRow>
                  ) : (
                    employees.map((employee) => {
                      const display = getEmployeeStatusDisplay(employee);
                      let badgeClass = "";
                      if (display.variant === 'warning') badgeClass = 'bg-yellow-100 text-yellow-800 border-yellow-300';
                      else if (display.variant === 'success') badgeClass = 'bg-green-100 text-green-800 border-green-300';
                      else if (display.variant === 'secondary') badgeClass = 'bg-gray-100 text-gray-600 border-gray-300';
                      else if (display.variant === 'destructive') badgeClass = 'bg-red-100 text-red-800 border-red-300';
                      else badgeClass = 'bg-white text-gray-500 border-gray-300';
                      
                      return (
                        <TableRow key={employee.id}>
                          <TableCell className="font-medium">{employee.nome}</TableCell>
                          <TableCell>{employee.email}</TableCell>
                          <TableCell>{profilesMap[employee.perfilId] || 'Carregando...'}</TableCell>
                          <TableCell>
                            <div className="flex items-center space-x-2">
                              <Badge className={cn("border", badgeClass)}>{display.text}</Badge>
                              {(employee.authUid && (employee.status === true || employee.status === false)) && (
                                <TooltipProvider delayDuration={100}>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <div> 
                                        <Switch
                                          checked={employee.status === true}
                                          onCheckedChange={() => handleToggleStatus(employee.id, employee.status)}
                                          aria-label={employee.status === true ? "Desativar colaborador" : "Ativar colaborador"}
                                        />
                                      </div>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p>{employee.status === true ? "Clique para desativar" : "Clique para ativar"}</p>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-right space-x-1">
                            <Button variant="ghost" size="icon" onClick={() => navigate(`/tenant/colaborador/editar/${employee.id}`)} title="Editar" className="text-blue-600 hover:text-blue-700">
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => handleDeleteEmployee(employee.id, employee.nome)} title="Excluir Colaborador" className="text-red-600 hover:text-red-700">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
              {totalEmployees > 0 && (
                <PaginationControls
                  currentPage={currentPage}
                  pageSize={pageSize}
                  totalItems={totalEmployees}
                  onPageChange={handlePageChange}
                  onPageSizeChange={handlePageSizeChange}
                  isLoading={isLoadingPage}
                  itemCountOnPage={employees.length}
                  hasNextPage={!!lastVisibleDoc && employees.length === pageSize}
                  hasPreviousPage={currentPage > 1}
                />
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default EmployeesPage;