import { useState, useEffect } from 'react';
import { getFirestore, collection, query, where, onSnapshot, doc, getDocs, deleteDoc, updateDoc } from 'firebase/firestore';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, PlusCircle, Pencil, Trash2, ToggleLeft, ToggleRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTenant } from '@/components/tenant/TenantContext';
import { useToast } from "@/components/ui/use-toast";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

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
  const [loading, setLoading] = useState(true); 
  const [error, setError] = useState(null);
  const tenantContext = useTenant();
  const db = getFirestore();
  const navigate = useNavigate();
  const { toast } = useToast();

  // --- Log para depurar o contexto DEPOIS de obtê-lo ---
  console.log('[EmployeesPage] Rendering. Actual tenantContext value:', tenantContext);
  // -------------------------------------------------

  // Efeito para buscar colaboradores (Firestore ATIVADO)
  useEffect(() => {
    console.log(`[EmployeesPage] useEffect triggered. isLoading: ${tenantContext.isLoading}, error: ${tenantContext.error}, currentTenant:`, tenantContext.currentTenant);

    if (tenantContext.isLoading) {
      console.log('[EmployeesPage] TenantContext is loading...');
      setLoading(true);
      setError(null);
      return;
    }

    if (tenantContext.error) {
       console.error('[EmployeesPage] Error reported by TenantContext:', tenantContext.error);
       setError(`Erro ao carregar informações da loja: ${tenantContext.error}`);
       setLoading(false);
       return;
    }

    const tenantId = tenantContext.currentTenant?.id;

    if (!tenantId) {
      console.error('[EmployeesPage] TenantContext is ready, but tenantId is missing. currentTenant:', tenantContext.currentTenant);
      setError("ID da Loja não encontrado após carregamento do contexto. Não é possível buscar colaboradores.");
      setLoading(false); 
      return;
    }
    
    // --- FIRESTORE QUERY ATIVADA --- 
    console.log(`[EmployeesPage] TenantId found: ${tenantId}. Fetching collaborators...`);
    setLoading(true); // Inicia loading dos colaboradores
    setError(null); // Limpa erros anteriores

    const employeesCollection = collection(db, 'colaboradores');
    const q = query(employeesCollection, where("tenantId", "==", tenantId));

    // --- RESTAURAR onSnapshot ---
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      console.log('[EmployeesPage] Collaborators snapshot received.');
      const employeesData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setEmployees(employeesData);
      fetchProfileNames(employeesData); // Chama a função para buscar nomes dos perfis
      setLoading(false); // Finaliza loading APÓS receber dados
    }, (err) => {
      console.error("[EmployeesPage] Error fetching collaborators: ", err);
      setError("Falha ao carregar colaboradores. Tente novamente mais tarde.");
      setLoading(false); // Finaliza loading em caso de erro
    });

    return () => {
      console.log('[EmployeesPage] Unsubscribing from collaborators snapshot.');
      unsubscribe(); // Limpa o listener ao desmontar ou antes de re-executar
    };
    // --- FIM RESTAURAÇÃO ---

    // const fetchWithGetDocs = async () => {
    //   try {
    //     console.log('[EmployeesPage] Fetching collaborators with getDocs...');
    //     const querySnapshot = await getDocs(q);
    //     console.log('[EmployeesPage] Collaborators getDocs successful.');
    //     const employeesData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    //     setEmployees(employeesData);
    //     fetchProfileNames(employeesData);
    //     setLoading(false);
    //   } catch (err) {
    //     console.error("[EmployeesPage] Error fetching collaborators with getDocs: ", err);
    //     setError("Falha ao carregar colaboradores (getDocs). Tente novamente mais tarde.");
    //     setLoading(false);
    //   }
    // };

    // fetchWithGetDocs(); // Chama a função assíncrona

    // // Como não há mais listener, não precisamos retornar uma função de limpeza


  }, [tenantContext.isLoading, tenantContext.currentTenant, tenantContext.error, db]); // Dependências corretas

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
          {/* Lógica de Loading/Erro original */}
          {(tenantContext.isLoading || loading) && <p>Carregando...</p>}
          {!tenantContext.isLoading && error && (
            <div className="text-red-600 flex items-center">
              <AlertCircle className="mr-2 h-5 w-5" /> {error}
            </div>
          )}
          {/* Tabela Restaurada */}
          {!tenantContext.isLoading && !loading && !error && (
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
                      Nenhum colaborador cadastrado ainda.
                    </TableCell>
                  </TableRow>
                ) : (
                  employees.map((employee) => (
                    <TableRow key={employee.id}>
                      <TableCell className="font-medium">{employee.nome}</TableCell>
                      <TableCell>{employee.email}</TableCell>
                      <TableCell>{profilesMap[employee.perfilId] || 'Carregando...'}</TableCell>
                      <TableCell>
                        {(() => { // IIFE para usar a lógica de status
                          const display = getEmployeeStatusDisplay(employee);
                          // Definir classes de cor diretamente se a variant não for suficiente ou customizada
                          let badgeClass = "";
                          if (display.variant === 'warning') badgeClass = 'bg-yellow-100 text-yellow-800 border-yellow-300';
                          else if (display.variant === 'success') badgeClass = 'bg-green-100 text-green-800 border-green-300';
                          else if (display.variant === 'secondary') badgeClass = 'bg-gray-100 text-gray-600 border-gray-300';
                          else if (display.variant === 'destructive') badgeClass = 'bg-red-100 text-red-800 border-red-300';
                          else badgeClass = 'bg-white text-gray-500 border-gray-300'; // outline/default
                          
                          return (
                            <div className="flex items-center space-x-2">
                              <Badge className={cn("border", badgeClass)}>{display.text}</Badge>
                              
                              {/* Mostrar Switch apenas se status for 'ativo' ou 'inativo' */}
                              {(employee.authUid && (employee.status === true || employee.status === false)) && (
                                <TooltipProvider delayDuration={100}>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                        {/* Envolver o Switch para Tooltip */}
                                        <div> 
                                            <Switch
                                                checked={employee.status === true} // Checked se for ativo
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
                          );
                        })()}
                      </TableCell>
                      <TableCell className="text-right space-x-1">
                         {/* Botões restaurados e conectados aos handlers */}
                         <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleToggleStatus(employee.id, employee.status)}
                            title={employee.status ? 'Desativar' : 'Ativar'}
                            className={employee.status ? 'text-gray-500 hover:text-gray-700' : 'text-green-600 hover:text-green-700'}
                         >
                           {employee.status ? <ToggleRight className="h-5 w-5" /> : <ToggleLeft className="h-5 w-5" />}
                         </Button>
                         <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => navigate(`/tenant/colaborador/editar/${employee.id}`)}
                            title="Editar"
                            className="text-blue-600 hover:text-blue-700"
                         >
                             <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                             variant="ghost"
                             size="icon"
                             onClick={() => handleDeleteEmployee(employee.id, employee.nome)}
                             title="Excluir Colaborador"
                             className="text-red-600 hover:text-red-700"
                           >
                              <Trash2 className="h-4 w-4" />
                           </Button>
                       </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default EmployeesPage;