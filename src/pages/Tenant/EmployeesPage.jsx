import { useState, useEffect } from 'react';
import { getFirestore, collection, query, where, onSnapshot, doc, getDoc, deleteDoc, updateDoc } from 'firebase/firestore';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, PlusCircle, Pencil, Trash2, ToggleLeft, ToggleRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom'; // Para navegação
import { useTenant } from '@/components/tenant/TenantContext'; // Adicionado useTenant
import { useToast } from "@/components/ui/use-toast"; // Adicionado useToast

// ----- SIMULAÇÃO DAS CLAIMS - REMOVER DEPOIS E BUSCAR REAL ----
// const useAuth = () => ({
//   userClaims: { isAdmin: true, tenant_id: 'test-tenant' } // Precisa ser o tenantId real
// });
// -----------------------------------------------------------

function EmployeesPage() {
  const [employees, setEmployees] = useState([]);
  const [profilesMap, setProfilesMap] = useState({}); // Para mapear ID do perfil para nome
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  // const { userClaims } = useAuth(); // Remover hook simulado
  // const tenantId = userClaims?.tenant_id; // Remover claim simulado
  const { tenantId } = useTenant(); // Usar o hook useTenant
  const db = getFirestore();
  const navigate = useNavigate(); // Hook para navegação
  const { toast } = useToast(); // Obter função toast

  // Efeito para buscar colaboradores
  useEffect(() => {
    if (!tenantId) {
      setError("Tenant ID não encontrado. Não é possível buscar colaboradores.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    const employeesCollection = collection(db, 'colaboradores');
    const q = query(employeesCollection, where("tenantId", "==", tenantId));

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const employeesData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setEmployees(employeesData);
       // Buscar nomes dos perfis referenciados (uma vez ou sempre que a lista mudar)
       fetchProfileNames(employeesData);
      setLoading(false);
    }, (err) => {
      console.error("Erro ao buscar colaboradores: ", err);
      setError("Falha ao carregar colaboradores. Tente novamente mais tarde.");
      setLoading(false);
    });

    return () => unsubscribe();

  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId]); // Removido db da dependência, getFirestore() é estável

  // Função para buscar nomes dos perfis associados aos colaboradores
  const fetchProfileNames = async (employeeList) => {
    const profileIds = [...new Set(employeeList.map(emp => emp.perfilId).filter(Boolean))]; // IDs únicos de perfil
    if (profileIds.length === 0) {
        setProfilesMap({}); // Limpa se não houver perfis
        return;
    }

    const newProfilesMap = { ...profilesMap }; // Copia o mapa existente

    // Busca apenas os perfis que ainda não estão no mapa
    const profilesToFetch = profileIds.filter(id => !newProfilesMap[id]);

    if (profilesToFetch.length > 0) {
        const promises = profilesToFetch.map(id => getDoc(doc(db, 'perfis', id)));
        try {
            const profileDocs = await Promise.all(promises);
            profileDocs.forEach(docSnap => {
            if (docSnap.exists()) {
                newProfilesMap[docSnap.id] = docSnap.data().nome; // Armazena nome por ID
            } else {
                 newProfilesMap[docSnap.id] = 'Perfil não encontrado'; // Fallback
            }
            });
            setProfilesMap(newProfilesMap);
        } catch (error) {
            console.error("Erro ao buscar nomes dos perfis:", error);
            // Poderia definir um erro específico aqui
        }
    }
  };

 // Função para lidar com ativação/desativação
 const handleToggleStatus = async (employeeId, currentStatus) => {
    const newStatus = !currentStatus; // Inverte o status atual
    const statusLabel = newStatus ? "Ativo" : "Inativo";
    console.log(`Tentando alterar status de ${employeeId} para ${statusLabel}`);
    
    const docRef = doc(db, 'colaboradores', employeeId);

    try {
      await updateDoc(docRef, { status: newStatus });
      toast({
        title: "Status Alterado",
        description: `Status do colaborador alterado para ${statusLabel}.`,
      });
      // O listener onSnapshot atualizará a UI automaticamente.
    } catch (error) {
      console.error("Erro ao alterar status do colaborador:", error);
      toast({
        variant: "destructive",
        title: "Erro ao Alterar Status",
        description: `Não foi possível alterar o status. (${error.message})`,
      });
    }
 };

  // --- Função para Excluir Colaborador ---
  const handleDeleteEmployee = async (employeeId, employeeName) => {
    if (!tenantId) {
        toast({ variant: "destructive", title: "Erro", description: "ID do Tenant não encontrado." });
        return;
    }

    if (!window.confirm(`Tem certeza que deseja excluir o colaborador "${employeeName}"?`)) {
        return;
    }

    try {
      // Indicar visualmente que algo está acontecendo (opcional, poderia usar estado de loading por linha)
      const docRef = doc(db, 'colaboradores', employeeId);
      await deleteDoc(docRef);
      toast({
          title: "Colaborador Excluído",
          description: `O colaborador "${employeeName}" foi excluído com sucesso.`,
      });
      // A lista será atualizada automaticamente pelo onSnapshot
    } catch (err) {
      console.error("Erro ao excluir colaborador:", err);
      toast({
          variant: "destructive",
          title: "Erro ao Excluir",
          description: `Falha ao excluir o colaborador "${employeeName}". (${err.message})`,
      });
    }
  };
  // -----------------------------------

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold">Gestão de Colaboradores</h1>
        <Button onClick={() => navigate('/tenant/colaborador/novo')}> {/* Navega para form de novo */}
          <PlusCircle className="mr-2 h-4 w-4" /> Adicionar Colaborador
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Colaboradores Cadastrados</CardTitle>
        </CardHeader>
        <CardContent>
          {loading && <p>Carregando colaboradores...</p>}

          {error && (
            <div className="text-red-600 flex items-center">
              <AlertCircle className="mr-2 h-5 w-5" /> {error}
            </div>
          )}

          {!loading && !error && (
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
                        <Badge variant={employee.status ? 'default' : 'destructive'}>
                          {employee.status ? 'Ativo' : 'Inativo'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right space-x-1">
                         {/* Botão de Status */}
                         <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleToggleStatus(employee.id, employee.status)}
                            title={employee.status ? 'Desativar' : 'Ativar'}
                            className={employee.status ? 'text-gray-500 hover:text-gray-700' : 'text-green-600 hover:text-green-700'}
                         >
                           {employee.status ? <ToggleRight className="h-5 w-5" /> : <ToggleLeft className="h-5 w-5" />}
                         </Button>
                         {/* Botão Editar */}
                         <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => navigate(`/tenant/colaborador/editar/${employee.id}`)}
                            title="Editar"
                            className="text-blue-600 hover:text-blue-700"
                         >
                            <Pencil className="h-4 w-4" />
                         </Button>
                         {/* Botão Excluir */}
                         <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteEmployee(employee.id, employee.nome)} // Conectado ao handler
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