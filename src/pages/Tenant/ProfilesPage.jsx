import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getFirestore, collection, query, where, doc, deleteDoc, getDocs, limit as firestoreLimit } from 'firebase/firestore';
import { Button } from "@/components/ui/button"; // Para futuro botão "Adicionar"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"; // Para layout
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"; // Para exibir dados
import { Badge } from "@/components/ui/badge"; // Para exibir módulos/permissões
import { AlertCircle, PlusCircle, Trash2, Loader2 } from 'lucide-react'; // Ícones
import { useTenant } from '@/components/tenant/TenantContext'; // CORRIGIDO: Importar o hook useTenant
import { useToast } from "@/components/ui/use-toast"; // Adicionado useToast
import { profileService } from '@/api/firebase/profileService'; // <<< Adicionar importação do serviço
import PaginationControls from "@/components/ui/PaginationControls"; // <<< Adicionar importação

// ----- SIMULAÇÃO DAS CLAIMS - REMOVER DEPOIS E BUSCAR REAL ----
// Mesmo hook simulado do Layout.jsx
// const useAuth = () => ({
//   userClaims: { isAdmin: true, tenant_id: 'test-tenant' } // Precisa ser o tenantId real para buscar dados
// });
// -----------------------------------------------------------

function ProfilesPage() {
  const [profiles, setProfiles] = useState([]);
  const [isLoadingInitial, setIsLoadingInitial] = useState(true);
  const [error, setError] = useState(null);
  const tenantContext = useTenant(); // <-- CORREÇÃO: Obter contexto completo
  const navigate = useNavigate(); // Obter a função navigate
  const db = getFirestore(); // Obter instância do DB aqui
  const { toast } = useToast(); // Obter função toast

  // Estados de Paginação
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [lastVisibleDoc, setLastVisibleDoc] = useState(null);
  const [firstVisibleDoc, setFirstVisibleDoc] = useState(null);
  const [totalProfiles, setTotalProfiles] = useState(0);
  const [isLoadingPage, setIsLoadingPage] = useState(false);

  // Ordenação padrão (pode ser expandida com UI no futuro)
  const sortBy = 'nome'; // Fixo por enquanto
  const sortOrder = 'asc'; // Fixo por enquanto

  const loadProfilesPage = useCallback(async (direction = 'current', newPageSize = pageSize, forFiltersReset = false) => {
    const tenantId = tenantContext.currentTenant?.id;
    if (!tenantId) {
      setError("ID da Loja não encontrado. Não é possível buscar perfis.");
      setIsLoadingInitial(false);
      setIsLoadingPage(false);
      setProfiles([]);
      return;
    }
    console.log(`[ProfilesPage loadProfilesPage] Dir: ${direction}, Size: ${newPageSize}, Page: ${currentPage}, Tenant: ${tenantId}`);
    setIsLoadingPage(true);
    if (direction === 'current' || forFiltersReset) setIsLoadingInitial(true);

    try {
      const filterOptions = { tenantId, orderByField: sortBy, orderByDirection: sortOrder, limitNum: newPageSize };

      if (direction === 'current' || forFiltersReset) {
        const count = await profileService.getCount({ tenantId });
        setTotalProfiles(count);
        setCurrentPage(1);
        setFirstVisibleDoc(null);
        setLastVisibleDoc(null);
        filterOptions.startAfterDoc = null;
      } else if (direction === 'next' && lastVisibleDoc) {
        filterOptions.startAfterDoc = lastVisibleDoc;
      } else if (direction === 'prev' && firstVisibleDoc) {
        // Lógica de 'prev' simplificada, similar aos outros componentes
        console.warn("[ProfilesPage] 'Previous' page logic is simplified.");
        filterOptions.orderByDirection = sortOrder === 'asc' ? 'desc' : 'asc';
        // filterOptions.endBeforeDoc = firstVisibleDoc; // Idealmente, o service suportaria isso
      }

      const { profiles: fetchedProfiles, lastVisibleDoc: newLastVisible } = await profileService.list(filterOptions);
      let profilesData = fetchedProfiles || [];

      if (direction === 'prev' && firstVisibleDoc && filterOptions.orderByDirection !== sortOrder) {
        profilesData.reverse();
      }

      setProfiles(profilesData);
      setLastVisibleDoc(newLastVisible || null);
      setFirstVisibleDoc(profilesData.length > 0 ? profilesData[0] : null);

      if (direction === 'next') {
        setCurrentPage(prev => prev + 1);
      } else if (direction === 'prev' && currentPage > 1) {
        setCurrentPage(prev => prev - 1);
      }

    } catch (err) {
      console.error("[ProfilesPage] Error loading profiles:", err);
      setError("Falha ao carregar perfis. Tente novamente mais tarde.");
      setProfiles([]);
      setTotalProfiles(0);
    } finally {
      setIsLoadingInitial(false);
      setIsLoadingPage(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantContext.currentTenant?.id, pageSize, toast]); // sortBy e sortOrder são fixos, não precisam estar nas deps do useCallback se não mudam

  useEffect(() => {
    if (tenantContext.isLoading) {
      setIsLoadingInitial(true); setError(null); return;
    }
    if (tenantContext.error) {
      setError(`Erro ao carregar informações da loja: ${tenantContext.error}`); setIsLoadingInitial(false); return;
    }
    if (tenantContext.currentTenant?.id) {
      loadProfilesPage('current', pageSize, true); 
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantContext.isLoading, tenantContext.currentTenant?.id, tenantContext.error]);

  const handleAddProfile = () => {
    navigate('/tenant/perfis/novo');
  };

  const handleDeleteProfile = async (profileId, profileName) => {
    const currentTenantId = tenantContext.currentTenant?.id;
    if (!currentTenantId) {
        toast({ variant: "destructive", title: "Erro", description: "ID da Loja não encontrado para exclusão." });
        return;
    }
    if (!window.confirm(`Tem certeza que deseja excluir o perfil "${profileName}"? Esta ação não pode ser desfeita.`)) return;

    setIsLoadingPage(true); // Usar isLoadingPage para feedback na tabela
    try {
        const employeesRef = collection(db, 'colaboradores');
        const q = query(
            employeesRef, 
            where("tenantId", "==", currentTenantId), 
            where("perfilId", "==", profileId), 
            firestoreLimit(1) // Usando o alias importado
        );
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
            toast({ variant: "destructive", title: "Erro ao Excluir Perfil", description: `Não é possível excluir "${profileName}" pois está em uso.` });
        } else {
            const profileDocRef = doc(db, 'perfis', profileId);
            await deleteDoc(profileDocRef);
            toast({ title: "Perfil Excluído", description: `O perfil "${profileName}" foi excluído.` });
            loadProfilesPage('current', pageSize, true); // Recarrega e reseta após exclusão
        }
    } catch (err) {
        console.error("[ProfilesPage] Erro ao excluir perfil:", err);
        toast({ variant: "destructive", title: "Erro ao Excluir", description: `Falha ao excluir o perfil. (${err.message})` });
    } finally {
        setIsLoadingPage(false);
    }
  };

  const handlePageChange = (directionOrPageNumber) => {
    if (typeof directionOrPageNumber === 'string') {
      loadProfilesPage(directionOrPageNumber, pageSize, false);
    } else {
      console.warn("[ProfilesPage] Direct page number navigation not fully implemented.");
    }
  };

  const handlePageSizeChange = (newPageSize) => {
    setPageSize(newPageSize);
    loadProfilesPage('current', newPageSize, true);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold">Gestão de Perfis</h1>
        <Button onClick={handleAddProfile}>
          <PlusCircle className="mr-2 h-4 w-4" /> Adicionar Perfil
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Perfis Cadastrados</CardTitle>
        </CardHeader>
        <CardContent>
          {(isLoadingInitial) && <div className="flex justify-center items-center py-10"><Loader2 className="h-8 w-8 animate-spin text-primary" /> <p className="ml-2">Carregando...</p></div>}
          {!isLoadingInitial && error && (
            <div className="text-red-600 flex items-center my-4 p-3 border border-red-200 rounded-md bg-red-50">
              <AlertCircle className="mr-2 h-5 w-5 flex-shrink-0" /> {error}
            </div>
          )}
          {!isLoadingInitial && !error && (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Módulos</TableHead>
                    <TableHead>Permissões Principais</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {profiles.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground">
                        {totalProfiles === 0 ? "Nenhum perfil cadastrado ainda." : "Nenhum perfil nesta página."}
                      </TableCell>
                    </TableRow>
                  ) : (
                    profiles.map((profile) => (
                      <TableRow key={profile.id}>
                        <TableCell className="font-medium">{profile.nome}</TableCell>
                        <TableCell>
                          {profile.modulos?.map(modulo => (
                            <Badge key={modulo} variant="secondary" className="mr-1 mb-1 capitalize">{modulo}</Badge>
                          ))}
                        </TableCell>
                        <TableCell>
                          {profile.permissoes?.slice(0, 3).map(perm => (
                            <Badge key={perm} variant="outline" className="mr-1 mb-1 text-xs">{perm}</Badge>
                          ))}
                          {profile.permissoes?.length > 3 && <Badge variant="outline">...</Badge>}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" className="mr-2" onClick={() => navigate(`/tenant/perfis/editar/${profile.id}`)}> 
                            Editar
                          </Button>
                          <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700" onClick={() => handleDeleteProfile(profile.id, profile.nome)} disabled={isLoadingPage}> 
                            <Trash2 className="mr-1 h-4 w-4" />
                            Excluir
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
              {totalProfiles > 0 && (
                <PaginationControls
                  currentPage={currentPage}
                  pageSize={pageSize}
                  totalItems={totalProfiles}
                  onPageChange={handlePageChange}
                  onPageSizeChange={handlePageSizeChange}
                  isLoading={isLoadingPage}
                  itemCountOnPage={profiles.length}
                  hasNextPage={!!lastVisibleDoc && profiles.length === pageSize}
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

export default ProfilesPage;