import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getFirestore, collection, query, where, onSnapshot, doc, deleteDoc, getDocs, limit } from 'firebase/firestore';
import { Button } from "@/components/ui/button"; // Para futuro botão "Adicionar"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"; // Para layout
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"; // Para exibir dados
import { Badge } from "@/components/ui/badge"; // Para exibir módulos/permissões
import { AlertCircle, PlusCircle, Trash2 } from 'lucide-react'; // Ícones
import { useTenant } from '@/components/tenant/TenantContext'; // CORRIGIDO: Importar o hook useTenant
import { useToast } from "@/components/ui/use-toast"; // Adicionado useToast

// ----- SIMULAÇÃO DAS CLAIMS - REMOVER DEPOIS E BUSCAR REAL ----
// Mesmo hook simulado do Layout.jsx
// const useAuth = () => ({
//   userClaims: { isAdmin: true, tenant_id: 'test-tenant' } // Precisa ser o tenantId real para buscar dados
// });
// -----------------------------------------------------------

function ProfilesPage() {
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const tenantContext = useTenant(); // <-- CORREÇÃO: Obter contexto completo
  const navigate = useNavigate(); // Obter a função navigate
  const db = getFirestore(); // Obter instância do DB aqui
  const { toast } = useToast(); // Obter função toast

  // Log para depuração
  console.log('[ProfilesPage] Rendering. Actual tenantContext value:', tenantContext);

  useEffect(() => {
    console.log(`[ProfilesPage] useEffect triggered. isLoading: ${tenantContext.isLoading}, error: ${tenantContext.error}, currentTenant:`, tenantContext.currentTenant);

    // 1. Esperar TenantContext carregar
    if (tenantContext.isLoading) {
      console.log('[ProfilesPage] TenantContext is loading...');
      setLoading(true);
      setError(null);
      return;
    }

    // 2. Verificar erro no TenantContext
    if (tenantContext.error) {
       console.error('[ProfilesPage] Error reported by TenantContext:', tenantContext.error);
       setError(`Erro ao carregar informações da loja: ${tenantContext.error}`);
       setLoading(false);
       return;
    }

    // 3. Obter tenantId APÓS contexto carregado e sem erro
    const currentTenantId = tenantContext.currentTenant?.id;
    if (!currentTenantId) {
      console.error('[ProfilesPage] TenantId missing after context load. CurrentTenant:', tenantContext.currentTenant);
      setError("ID da Loja não encontrado no contexto. Não é possível buscar perfis.");
      setLoading(false);
      return;
    }

    // 4. Buscar perfis com tenantId válido
    console.log(`[ProfilesPage] TenantId found: ${currentTenantId}. Fetching profiles...`);
    setLoading(true);
    setError(null);
    const profilesCollection = collection(db, 'perfis');
    const q = query(profilesCollection, where("tenantId", "==", currentTenantId));

    // Listener em tempo real
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      console.log('[ProfilesPage] Profiles snapshot received.');
      const profilesData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setProfiles(profilesData);
      setLoading(false);
    }, (err) => {
      console.error("[ProfilesPage] Erro ao buscar perfis: ", err);
      setError("Falha ao carregar perfis. Tente novamente mais tarde.");
      setLoading(false);
    });

    // Limpeza
    return () => {
      console.log('[ProfilesPage] Unsubscribing from profiles snapshot.');
      unsubscribe();
    };

  // Dependências corretas
  }, [db, tenantContext.isLoading, tenantContext.currentTenant, tenantContext.error]);

  const handleAddProfile = () => {
    navigate('/tenant/perfis/novo');
  };

  // --- Função para Excluir Perfil (Corrigida) ---
  const handleDeleteProfile = async (profileId, profileName) => {
    // Obter tenantId do contexto NO MOMENTO da ação
    const currentTenantId = tenantContext.currentTenant?.id;
    if (!currentTenantId) {
        toast({ variant: "destructive", title: "Erro", description: "ID da Loja não encontrado para exclusão." });
        return;
    }

    // 1. Confirmação
    if (!window.confirm(`Tem certeza que deseja excluir o perfil "${profileName}"? Esta ação não pode ser desfeita.`)) {
        return;
    }

    // 2. Verificar se algum colaborador usa este perfil
    setLoading(true); // Ativa loading GERAL aqui?
    setError(null);
    try {
        const employeesRef = collection(db, 'colaboradores');
        const q = query(
            employeesRef, 
            where("tenantId", "==", currentTenantId), // Usa currentTenantId
            where("perfilId", "==", profileId), 
            limit(1) 
        );
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
            toast({
                variant: "destructive",
                title: "Erro ao Excluir Perfil",
                description: `Não é possível excluir "${profileName}" pois está em uso por ${querySnapshot.size} colaborador(es).`,
            });
        } else {
            const profileDocRef = doc(db, 'perfis', profileId);
            // Validação extra (opcional): verificar se o perfil pertence ao tenant antes de deletar
            // const profileSnap = await getDoc(profileDocRef);
            // if (!profileSnap.exists() || profileSnap.data()?.tenantId !== currentTenantId) throw new Error("Perfil não encontrado ou não pertence a esta loja.")
            await deleteDoc(profileDocRef);
            console.log(`[ProfilesPage] Perfil ${profileId} (${profileName}) excluído com sucesso.`);
            toast({
                title: "Perfil Excluído",
                description: `O perfil "${profileName}" foi excluído com sucesso.`,
            });
        }

    } catch (err) {
        console.error("[ProfilesPage] Erro ao excluir perfil:", err);
        toast({
            variant: "destructive",
            title: "Erro ao Excluir",
            description: `Falha ao excluir o perfil "${profileName}". (${err.message})`,
        });
    } finally {
        setLoading(false); // Desativa loading GERAL
    }
  };
  // --------------------------------

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
          {/* Lógica de loading/erro original */}
          {(tenantContext.isLoading || loading) && <p>Carregando...</p>}
          {!tenantContext.isLoading && error && (
            <div className="text-red-600 flex items-center my-4 p-3 border border-red-200 rounded-md bg-red-50">
              <AlertCircle className="mr-2 h-5 w-5 flex-shrink-0" /> {error}
            </div>
          )}

          {/* Tabela */} 
          {!tenantContext.isLoading && !loading && !error && (
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
                      Nenhum perfil cadastrado ainda.
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
                        <Button 
                           variant="ghost" 
                           size="sm" 
                           className="mr-2"
                           onClick={() => navigate(`/tenant/perfis/editar/${profile.id}`)}
                        > 
                          Editar
                        </Button>
                        <Button 
                           variant="ghost" 
                           size="sm" 
                           className="text-red-600 hover:text-red-700"
                           onClick={() => handleDeleteProfile(profile.id, profile.nome)}
                           disabled={loading} // Desabilitar durante loading geral
                        >
                          <Trash2 className="mr-1 h-4 w-4" />
                          Excluir
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

export default ProfilesPage;