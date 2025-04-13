import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getFirestore, doc, getDoc, addDoc, updateDoc, collection, query, where, onSnapshot, serverTimestamp, getDocs, limit, documentId } from 'firebase/firestore';
import { useTenant } from '@/components/tenant/TenantContext';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { AlertCircle, Loader2 } from 'lucide-react';
import { Switch } from "@/components/ui/switch";
import { MultiSelect } from "@/components/ui/multi-select";
import { useToast } from "@/components/ui/use-toast";
// TODO: Adicionar import para componente MultiSelect/Checkbox para especialidades
// TODO: Adicionar import para Switch/Checkbox para status

function EmployeeFormPage() {
  const { employeeId } = useParams(); // Para modo de edição
  const navigate = useNavigate();
  const db = getFirestore();
  const { tenantId } = useTenant();
  const isEditing = Boolean(employeeId);
  const { toast } = useToast();

  // Estado para os dados do formulário do colaborador
  const [formData, setFormData] = useState({
    nome: '',
    email: '',
    telefone: '',
    perfilId: '',       // ID do perfil selecionado
    especialidades: [],
    status: true,        // Default para ativo
  });

  // Estado para armazenar a lista de perfis disponíveis (com id, nome, tipo)
  const [profiles, setProfiles] = useState([]);
  // Estado para armazenar os dados completos do perfil selecionado no dropdown
  const [selectedProfile, setSelectedProfile] = useState(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [loadingProfiles, setLoadingProfiles] = useState(true);

  // Estado para armazenar a lista de especialidades disponíveis
  const [availableSpecialties, setAvailableSpecialties] = useState([]);
  const [loadingSpecialties, setLoadingSpecialties] = useState(false);

  const [loadingEditData, setLoadingEditData] = useState(false);

  // Estado para campo de nova especialidade
  const [showNewSpecialtyInput, setShowNewSpecialtyInput] = useState(false);
  const [newSpecialtyName, setNewSpecialtyName] = useState("");
  const [addingSpecialty, setAddingSpecialty] = useState(false); // Estado para o botão Adicionar

  const [originalEmployeeData, setOriginalEmployeeData] = useState(null); // Estado para dados originais na edição

  // --- Efeito para buscar perfis do tenant --- 
  useEffect(() => {
    if (!tenantId) return;

    setLoadingProfiles(true);
    const profilesCollection = collection(db, 'perfis');
    const q = query(profilesCollection, where("tenantId", "==", tenantId));

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const profilesData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        nome: doc.data().nome, // Guardar nome para exibição
        tipo: doc.data().tipo, // Guardar TIPO para lógica condicional
        // Não precisamos guardar permissões aqui, só nome e tipo
      }));
      setProfiles(profilesData);
      setLoadingProfiles(false);
    }, (err) => {
      console.error("Erro ao buscar perfis para formulário: ", err);
      setError("Falha ao carregar a lista de perfis.");
      setLoadingProfiles(false);
    });

    return () => unsubscribe();
  }, [db, tenantId]);

  // --- Efeito para buscar especialidades compartilhadas --- 
  useEffect(() => {
    setLoadingSpecialties(true);
    const specialtiesCollection = collection(db, 'sharedVetSpecialties');
    const q = query(specialtiesCollection);
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const specialtiesData = querySnapshot.docs.map(doc => doc.data().name);
      setAvailableSpecialties(specialtiesData.sort()); // Apenas especialidades reais
      setLoadingSpecialties(false);
    }, (err) => {
      console.error("Erro ao buscar especialidades: ", err);
      setError(prev => prev || "Falha ao carregar a lista de especialidades."); 
      setLoadingSpecialties(false);
    });
    return () => unsubscribe();
  }, [db]);

  // --- Efeito para buscar dados do colaborador em modo de edição --- 
  useEffect(() => {
    if (isEditing && tenantId && profiles.length > 0) { // Só busca se tiver perfis carregados também
        setLoadingEditData(true);
        setError(null);
        console.log("Modo Edição - Buscando Colaborador ID:", employeeId);
        
        const employeeDocRef = doc(db, 'colaboradores', employeeId);

        getDoc(employeeDocRef).then(async (docSnap) => {
            if (docSnap.exists() && docSnap.data().tenantId === tenantId) {
                const employeeData = { id: docSnap.id, ...docSnap.data() }; // Inclui ID para referência futura
                setOriginalEmployeeData(employeeData); // Guarda os dados originais
                
                // Popula o formulário
                setFormData({
                    nome: employeeData.nome || '',
                    email: employeeData.email || '',
                    telefone: employeeData.telefone || '',
                    perfilId: employeeData.perfilId || '',
                    especialidades: employeeData.especialidades || [],
                    status: employeeData.status !== undefined ? employeeData.status : true, // Default true se não existir
                });

                // Busca e define o perfil selecionado para lógica condicional
                if (employeeData.perfilId) {
                    // Tenta encontrar no estado local primeiro
                    const foundProfile = profiles.find(p => p.id === employeeData.perfilId);
                    if (foundProfile) {
                        console.log("Perfil associado encontrado no estado:", foundProfile);
                        setSelectedProfile(foundProfile);
                    } else {
                        // Se não encontrou no estado (caso raro), busca no DB
                        console.warn("Perfil não encontrado no estado, buscando no DB:", employeeData.perfilId);
                        try {
                            const profileDocRef = doc(db, 'perfis', employeeData.perfilId);
                            const profileDocSnap = await getDoc(profileDocRef);
                            if (profileDocSnap.exists()) {
                                const profileData = { id: profileDocSnap.id, ...profileDocSnap.data() };
                                console.log("Perfil associado buscado no DB:", profileData);
                                setSelectedProfile(profileData);
                            } else {
                                console.error("Perfil associado não encontrado no DB!");
                                setError("Perfil associado ao colaborador não foi encontrado.")
                                setSelectedProfile(null);
                            }
                        } catch (profileErr) {
                            console.error("Erro ao buscar perfil associado:", profileErr);
                             setError("Erro ao carregar dados do perfil associado.")
                            setSelectedProfile(null);
                        }
                    }
                } else {
                    setSelectedProfile(null); // Sem perfil associado
                }

            } else {
                setError("Colaborador não encontrado ou pertence a outro tenant.");
                navigate('/tenant/colaboradores'); // Redireciona se não encontrar
            }
        }).catch(err => {
            console.error("Erro ao buscar colaborador para edição:", err);
            setError("Falha ao carregar dados do colaborador.");
        }).finally(() => {
            setLoadingEditData(false);
        });
    }
  // Depende de employeeId, isEditing, tenantId, db, e profiles (para garantir que perfis foram carregados antes de tentar associar)
  }, [employeeId, isEditing, tenantId, db, profiles, navigate]);

  // --- Handlers (TODO) ---
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleProfileChange = (profileId) => {
    // Encontra o objeto completo do perfil selecionado na lista `profiles`
    const profileData = profiles.find(p => p.id === profileId) || null;
    setSelectedProfile(profileData); // Atualiza o estado do perfil selecionado
    setFormData(prev => ({ 
        ...prev, 
        perfilId: profileId, 
        // Limpa especialidades se o novo perfil não for veterinário
        especialidades: profileData?.tipo === 'veterinario' ? prev.especialidades : []
    })); 
  };
  
  // Handler para o Switch de Status
  const handleStatusChange = (checked) => {
    setFormData(prev => ({ ...prev, status: checked }));
  };

  // Handler PRINCIPAL para mudança no MultiSelect (recebe array de valores REAIS)
  const handleSpecialtyChange = (selectedActualSpecialties) => {
     setFormData(prev => ({ ...prev, especialidades: selectedActualSpecialties }));
  };
  
  // Handler para quando a OPÇÃO "Outros" é clicada no MultiSelect
  const handleOtherSpecialtyToggle = () => {
      setShowNewSpecialtyInput(!showNewSpecialtyInput); // Simplesmente inverte a visibilidade
      if (showNewSpecialtyInput) { // Se estava visível e vai esconder, limpa o nome
          setNewSpecialtyName("");
      }
  };

  // Handler para o BOTÃO "Adicionar" Nova Especialidade
  const handleAddNewSpecialty = async () => {
      const specialtyName = newSpecialtyName.trim();
      if (!specialtyName) {
          toast({ variant: "destructive", title: "Erro", description: "Digite o nome da nova especialidade." });
          return;
      }
      // Validação extra: Case-insensitive check
      const alreadyExists = availableSpecialties.some(s => s.toLowerCase() === specialtyName.toLowerCase());
      if (alreadyExists) {
          toast({ variant: "destructive", title: "Erro", description: `Especialidade "${specialtyName}" já existe.` });
          return;
      }

      setAddingSpecialty(true); // Ativa loading do botão
      try {
          console.log(`Adicionando nova especialidade: ${specialtyName}`);
          const specialtiesRef = collection(db, 'sharedVetSpecialties');
          await addDoc(specialtiesRef, { name: specialtyName });
          toast({ title: "Sucesso", description: `Especialidade "${specialtyName}" adicionada.` });
          
          // Adiciona a nova especialidade à seleção atual do formulário
          setFormData(prev => ({ ...prev, especialidades: [...prev.especialidades, specialtyName] }));
          
          // Limpa e esconde o input
          setNewSpecialtyName("");
          setShowNewSpecialtyInput(false);
          // O onSnapshot atualizará availableSpecialties eventualmente

      } catch (err) {
          console.error("Erro ao adicionar nova especialidade:", err);
          toast({ variant: "destructive", title: "Erro", description: `Falha ao salvar a especialidade "${specialtyName}".` });
      } finally {
          setAddingSpecialty(false); // Desativa loading do botão
      }
  };

  // --- Handler para Submissão --- 
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null); // Limpa erros gerais

    // --- Validações Iniciais --- 
    if (!tenantId) {
      toast({ variant: "destructive", title: "Erro", description: "ID do Tenant não encontrado." }); // Usar toast aqui também?
      return;
    }
    if (!formData.nome.trim()) {
      toast({ variant: "destructive", title: "Erro", description: "Nome completo é obrigatório." });
      return;
    }
    if (!formData.email.trim()) {
      toast({ variant: "destructive", title: "Erro", description: "Email é obrigatório." });
      return;
    }
    if (!formData.perfilId) {
      toast({ variant: "destructive", title: "Erro", description: "Selecione um perfil." });
      return;
    }

    const currentEmail = formData.email.trim().toLowerCase();

    setLoading(true);

    // --- Validação de Unicidade de Email (CRIAÇÃO E EDIÇÃO SE EMAIL MUDOU) --- 
    let emailCheckNeeded = false;
    if (isEditing) {
        // Verifica se o email foi alterado em relação ao original
        if (originalEmployeeData && currentEmail !== originalEmployeeData.email.toLowerCase()) {
            console.log("Email alterado durante edição. Verificando unicidade...");
            emailCheckNeeded = true;
        }
    } else {
        // Sempre verifica na criação
        emailCheckNeeded = true;
    }

    if (emailCheckNeeded) {
      try {
        const employeesRef = collection(db, 'colaboradores');
        let q;
        if (isEditing) {
          // Na edição, verifica se o NOVO email existe em OUTRO documento
          q = query(
            employeesRef,
            where("tenantId", "==", tenantId),
            where("email", "==", currentEmail),
            where(documentId(), "!=", employeeId), // Exclui o próprio documento
            limit(1)
          );
        } else {
          // Na criação, verifica se o email existe em QUALQUER documento do tenant
          q = query(
            employeesRef,
            where("tenantId", "==", tenantId),
            where("email", "==", currentEmail),
            limit(1)
          );
        }
        
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
          toast({
            variant: "destructive",
            title: isEditing ? "Erro ao Atualizar" : "Erro ao Adicionar",
            description: "Este email já está em uso por outro colaborador neste tenant.",
          });
          setLoading(false);
          return;
        }
      } catch (err) {
        console.error("Erro ao verificar unicidade de email:", err);
        setError("Ocorreu um erro ao verificar o email. Tente novamente."); 
        setLoading(false);
        return;
      }
    }
    // ------------------------------------------------------------

    // --- Preparar Dados --- 
    const employeeData = {
        ...formData,
        especialidades: formData.especialidades, // Usa o array já atualizado
        nome: formData.nome.trim(),
        email: currentEmail,
        tenantId: tenantId,
        atualizadoEm: serverTimestamp(),
    };
    // Remove perfilId dos dados a serem salvos se não houver um (evita salvar string vazia)
    if (!employeeData.perfilId) delete employeeData.perfilId;

    // --- Salvar/Atualizar --- 
    try {
      if (isEditing) {
        // ... (lógica de update - NÃO verifica email duplicado aqui, 
        //      assumindo que o usuário pode manter seu próprio email. 
        //      Se precisar validar mudança de email na edição, a lógica é similar à de criação)
        const docRef = doc(db, 'colaboradores', employeeId);
        await updateDoc(docRef, employeeData); 
      } else {
        // Criar Novo Colaborador
        employeeData.criadoEm = serverTimestamp();
        await addDoc(collection(db, 'colaboradores'), employeeData);
      }
      navigate('/tenant/colaboradores'); 
    } catch (err) {
      console.error("Erro ao salvar colaborador: ", err);
      toast({ 
        variant: "destructive",
        title: "Erro ao Salvar",
        description: `Falha ao salvar colaborador. (${err.message || 'Verifique os dados e tente novamente.'})`,
      });
    } finally {
      setLoading(false);
    }
  };

  // --- Renderização --- 
  if (loadingProfiles || loadingSpecialties || loadingEditData) {
    return <div className="flex justify-center items-center h-32"><Loader2 className="h-8 w-8 animate-spin" /> Carregando dados...</div>;
  }
  
  if (error && !loadingProfiles && !loadingSpecialties && !loadingEditData) {
     return <p className="text-red-500">{error}</p>;
  }

  // TODO: Lógica de loading para edição

  return (
    <form onSubmit={handleSubmit}>
      <Card>
        <CardHeader>
          <CardTitle>{isEditing ? 'Editar Colaborador' : 'Adicionar Novo Colaborador'}</CardTitle>
          <CardDescription>Preencha os dados do colaborador.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Nome */}
          <div className="space-y-1">
            <Label htmlFor="nome">Nome Completo</Label>
            <Input id="nome" name="nome" value={formData.nome} onChange={handleInputChange} required disabled={loading} />
          </div>

          {/* Email */}
          <div className="space-y-1">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" value={formData.email} onChange={handleInputChange} required disabled={loading} />
            {/* TODO: Adicionar validação de unicidade? */}
          </div>

          {/* Telefone */}
          <div className="space-y-1">
            <Label htmlFor="telefone">Telefone</Label>
            <Input id="telefone" name="telefone" value={formData.telefone} onChange={handleInputChange} disabled={loading} />
          </div>

          {/* Perfil */}
          <div className="space-y-1">
            <Label htmlFor="perfilId">Perfil</Label>
            <Select 
              name="perfilId"
              value={formData.perfilId}
              onValueChange={handleProfileChange} // Usa o handler específico
              required 
              disabled={loading || profiles.length === 0}
            >
              <SelectTrigger id="perfilId">
                <SelectValue placeholder={profiles.length > 0 ? "Selecione um perfil" : "Nenhum perfil cadastrado"} />
              </SelectTrigger>
              <SelectContent>
                {profiles.map((profile) => (
                  <SelectItem key={profile.id} value={profile.id}>
                    {profile.nome} ({profile.tipo}) {/* Mostra nome e tipo */}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Especialidades (Condicional) */}
          {selectedProfile?.tipo === 'veterinario' && (
            <div className="space-y-1">
              <Label>Especialidades (Veterinário)</Label>
              <MultiSelect
                options={[...availableSpecialties, "Outros (Especificar)"]} // Adiciona "Outros" dinamicamente
                selected={formData.especialidades} // Passa apenas os valores reais
                onChange={handleSpecialtyChange} // Handler principal para seleção
                onOtherToggle={handleOtherSpecialtyToggle} // Handler para clique em "Outros"
                placeholder="Selecione ou especifique..."
                disabled={loading || addingSpecialty}
                className="w-full"
              />
              {/* Input e Botão para Nova Especialidade */} 
              {showNewSpecialtyInput && (
                <div className="flex items-end gap-2 pt-2">
                   <div className="flex-grow space-y-1">
                       <Label htmlFor="newSpecialtyName">Nome da Nova Especialidade</Label>
                        <Input 
                            id="newSpecialtyName"
                            value={newSpecialtyName}
                            onChange={(e) => setNewSpecialtyName(e.target.value)}
                            placeholder="Digite o nome aqui"
                            disabled={loading || addingSpecialty}
                        />
                   </div>
                   <Button 
                      type="button" // Impede submissão do form principal
                      onClick={handleAddNewSpecialty}
                      disabled={loading || addingSpecialty || !newSpecialtyName.trim()}
                      size="sm"
                    >
                       {addingSpecialty ? <Loader2 className="h-4 w-4 animate-spin" /> : "Adicionar"}
                   </Button>
                </div>
              )}
              {availableSpecialties.length === 0 && !loadingSpecialties && 
                 <p className="text-sm text-muted-foreground">Nenhuma especialidade cadastrada.</p>
               }
            </div>
          )}

          {/* Status (Ativo/Inativo) */}
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <Label htmlFor="status-switch" className="text-base">Status</Label>
              <CardDescription>
                {formData.status ? "Colaborador Ativo" : "Colaborador Inativo"}
              </CardDescription>
            </div>
            <Switch
              id="status-switch"
              checked={formData.status}
              onCheckedChange={handleStatusChange}
              disabled={loading}
            />
          </div>

          {/* TODO: Error display */}
          {error && <p className="text-red-500 text-sm">{error}</p>}
          
        </CardContent>
        <CardFooter className="flex justify-end gap-2">
           <Button 
            type="button" // Impede submissão do form
            variant="outline"
            onClick={() => navigate(-1)} // Navega para a página anterior
            disabled={loading || addingSpecialty} // Desabilitar se estiver salvando ou adicionando especialidade
           > 
            Cancelar
          </Button>
          <Button type="submit" disabled={loading || addingSpecialty}> 
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {isEditing ? 'Salvar Alterações' : 'Adicionar Colaborador'}
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
}

export default EmployeeFormPage;