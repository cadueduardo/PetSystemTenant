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
  // const { userClaims } = useAuth(); // Remover uso do hook simulado
  const { tenantId } = useTenant(); // CORRIGIDO: Usar o hook useTenant e obter tenantId diretamente
  const navigate = useNavigate(); // Obter a função navigate
  const db = getFirestore(); // Obter instância do DB aqui
  const { toast } = useToast(); // Obter função toast

  useEffect(() => {
    if (!tenantId) {
      setError("Tenant ID não encontrado. Não é possível buscar perfis.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    const profilesCollection = collection(db, 'perfis');

    // Query para buscar perfis apenas do tenantId logado
    const q = query(profilesCollection, where("tenantId", "==", tenantId));

    // Listener em tempo real
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const profilesData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setProfiles(profilesData);
      setLoading(false);
    }, (err) => {
      console.error("Erro ao buscar perfis: ", err);
      setError("Falha ao carregar perfis. Tente novamente mais tarde.");
      setLoading(false);
    });

    // Limpeza: Cancelar o listener quando o componente desmontar
    return () => unsubscribe();

  }, [tenantId]); // Dependência: re-executar se o tenantId mudar

  const handleAddProfile = () => {
    navigate('/tenant/perfis/novo'); // CORRIGIDO: Usar o caminho da rota definida
  };

  // --- Função para Excluir Perfil ---
  const handleDeleteProfile = async (profileId, profileName) => {
    if (!tenantId) {
        alert("Erro: ID do Tenant não encontrado."); // Ou usar um modal/toast
        return;
    }

    // 1. Confirmação
    if (!window.confirm(`Tem certeza que deseja excluir o perfil "${profileName}"? Esta ação não pode ser desfeita.`)) {
        return;
    }

    // 2. Verificar se algum colaborador usa este perfil
    try {
        setLoading(true);
        setError(null);

        const employeesRef = collection(db, 'colaboradores');
        const q = query(
            employeesRef, 
            where("tenantId", "==", tenantId),
            where("perfilId", "==", profileId), 
            limit(1) // Só precisamos saber se existe pelo menos 1
        );
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
            // 3a. Perfil em uso - Mostrar Toast de Erro
            toast({
                variant: "destructive",
                title: "Erro ao Excluir Perfil",
                description: `Não é possível excluir "${profileName}" pois está em uso por ${querySnapshot.size} colaborador(es).`,
            });
        } else {
            // 3b. Perfil não está em uso - pode excluir
            const profileDocRef = doc(db, 'perfis', profileId);
            await deleteDoc(profileDocRef);
            console.log(`Perfil ${profileId} (${profileName}) excluído com sucesso.`);
            toast({ // Adiciona toast de sucesso (opcional)
                title: "Perfil Excluído",
                description: `O perfil "${profileName}" foi excluído com sucesso.`,
            });
        }

    } catch (err) {
        console.error("Erro ao excluir perfil:", err);
        toast({
            variant: "destructive",
            title: "Erro ao Excluir",
            description: `Falha ao excluir o perfil "${profileName}". (${err.message})`,
        });
    } finally {
        setLoading(false);
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
          {loading && <p>Carregando perfis...</p>}

          {error && (
            <div className="text-red-600 flex items-center my-4 p-3 border border-red-200 rounded-md bg-red-50">
              <AlertCircle className="mr-2 h-5 w-5 flex-shrink-0" /> {error}
            </div>
          )}

          {!loading && !error && (
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
                        {/* Mostrar apenas algumas permissões ou um resumo */}
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
                           disabled={loading}
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