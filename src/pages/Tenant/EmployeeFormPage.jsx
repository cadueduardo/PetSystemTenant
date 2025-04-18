import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getFirestore, doc, getDoc, addDoc, collection, query, where, onSnapshot, serverTimestamp, getDocs, limit, updateDoc } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
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

// --- Log para verificar se o módulo JS está sendo carregado --- 
console.log("--- MODULE LOAD: src/pages/Tenant/EmployeeFormPage.jsx ---");
// -------------------------------------------------------------

// Definir a constante que falta
// const OTHER_SPECIALTY_DISPLAY_VALUE = "Outros (Especificar)";

function EmployeeFormPage() {
  // --- Log para depurar renderização do componente ---
  console.log("[EmployeeFormPage] Component rendering.");
  // -------------------------------------------------

  const { employeeId } = useParams(); // Para modo de edição
  const navigate = useNavigate();
  const db = getFirestore();
  const functions = getFunctions();
  const sendCustomInviteFunction = httpsCallable(functions, 'sendCustomInvite');
  const tenantContext = useTenant(); // <-- CORREÇÃO: Obter contexto completo
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
  const [submitting, setSubmitting] = useState(false);
  const [pageError, setPageError] = useState(null);
  const [loadingProfiles, setLoadingProfiles] = useState(true);

  // Estado para armazenar a lista de especialidades disponíveis
  const [availableSpecialties, setAvailableSpecialties] = useState([]);
  const [loadingSpecialties, setLoadingSpecialties] = useState(true);

  const [loadingEditData, setLoadingEditData] = useState(false);

  // Estado para campo de nova especialidade
  const [showNewSpecialtyInput, setShowNewSpecialtyInput] = useState(false);
  const [newSpecialtyName, setNewSpecialtyName] = useState("");
  const [addingSpecialty, setAddingSpecialty] = useState(false); // Estado para o botão Adicionar

  const [originalEmployeeData, setOriginalEmployeeData] = useState(null); // Estado para dados originais na edição

  // --- Efeito para buscar perfis do tenant --- 
  useEffect(() => {
    // 1. Esperar TenantContext carregar
    if (tenantContext.isLoading) {
      console.log('[EmployeeFormPage] Waiting for TenantContext (Profiles)...');
      setLoadingProfiles(true); // Manter loading de perfis ativo
      setPageError(null);
      return;
    }
    // 2. Verificar erro no TenantContext
    if (tenantContext.error) {
      console.error('[EmployeeFormPage] TenantContext error (Profiles):', tenantContext.error);
      setPageError(`Erro ao carregar dados da loja: ${tenantContext.error}`);
      setLoadingProfiles(false);
      return;
    }
    // 3. Obter tenantId APÓS contexto carregado e sem erro
    const currentTenantId = tenantContext.currentTenant?.id;
    if (!currentTenantId) {
      console.error('[EmployeeFormPage] TenantId missing after context load (Profiles). CurrentTenant:', tenantContext.currentTenant);
      setPageError("ID da Loja não encontrado no contexto. Não é possível buscar perfis.");
      setLoadingProfiles(false);
      return;
    }

    // 4. Buscar perfis com tenantId válido
    console.log(`[EmployeeFormPage] Fetching profiles for tenant: ${currentTenantId}`);
    setLoadingProfiles(true); // Inicia loading dos perfis
    setPageError(null);

    const profilesCollection = collection(db, 'perfis');
    const q = query(profilesCollection, where("tenantId", "==", currentTenantId));

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      console.log('[EmployeeFormPage] Profiles snapshot received.');
      const profilesData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        nome: doc.data().nome,
        tipo: doc.data().tipo,
      }));
      setProfiles(profilesData);
      setLoadingProfiles(false);
    }, (err) => {
      console.error("Erro ao buscar perfis para formulário: ", err);
      setPageError("Falha ao carregar a lista de perfis.");
      setLoadingProfiles(false);
    });

    return () => {
      console.log('[EmployeeFormPage] Unsubscribing from profiles snapshot.');
      unsubscribe();
    };
  // Depender do estado do contexto e do tenantId (derivado)
  }, [db, tenantContext.isLoading, tenantContext.currentTenant, tenantContext.error]);

  // --- Efeito para buscar especialidades compartilhadas (não depende do tenant) --- 
  useEffect(() => {
    setLoadingSpecialties(true);
    const specialtiesCollection = collection(db, 'sharedVetSpecialties');
    const q = query(specialtiesCollection);
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const specialtiesData = querySnapshot.docs.map(doc => doc.data().name);
      setAvailableSpecialties(specialtiesData.sort());
      setLoadingSpecialties(false);
    }, (err) => {
      console.error("Erro ao buscar especialidades: ", err);
      setPageError(prev => prev || "Falha ao carregar a lista de especialidades.");
      setLoadingSpecialties(false);
    });
    return () => unsubscribe();
  }, [db]);

  // --- Efeito para buscar dados do colaborador em modo de edição --- 
  useEffect(() => {
    // 1. Sair se não for modo de edição ou se TenantContext ainda estiver carregando/com erro
    if (!isEditing || tenantContext.isLoading || tenantContext.error) {
      console.log(`[EmployeeFormPage] Skipping fetch edit data. isEditing: ${isEditing}, isLoading: ${tenantContext.isLoading}, error: ${tenantContext.error}`);
      // Não define loadingEditData aqui, pois pode não ser relevante ainda
      return;
    }

    // 2. Obter tenantId AGORA que sabemos que o contexto carregou sem erro
    const currentTenantId = tenantContext.currentTenant?.id;
    if (!currentTenantId) {
        console.error('[EmployeeFormPage] TenantId missing after context load (Edit Mode). CurrentTenant:', tenantContext.currentTenant);
        setPageError("ID da Loja não encontrado no contexto. Não é possível buscar dados para edição.");
        setLoadingEditData(false); // Parar loading de edição
        return;
    }
    
    // 3. Prosseguir com a busca de dados para edição
    setLoadingEditData(true);
    setPageError(null);
    console.log(`[EmployeeFormPage] Edit Mode - Fetching Employee ID: ${employeeId} for Tenant ID: ${currentTenantId}`);

    const employeeDocRef = doc(db, 'colaboradores', employeeId);

    getDoc(employeeDocRef).then(async (docSnap) => {
        if (docSnap.exists() && docSnap.data().tenantId === currentTenantId) { // Verifica tenantId do documento
            const employeeData = { id: docSnap.id, ...docSnap.data() };
            setOriginalEmployeeData(employeeData);
            // ... (resto da lógica para popular formData e selectedProfile igual)
            setFormData({
                nome: employeeData.nome || '',
                email: employeeData.email || '',
                telefone: employeeData.telefone || '',
                perfilId: employeeData.perfilId || '',
                especialidades: employeeData.especialidades || [],
                status: employeeData.status !== undefined ? employeeData.status : true,
            });
            if (employeeData.perfilId) {
                // Tenta encontrar no estado local primeiro (pode ter carregado no outro useEffect)
                const foundProfile = profiles.find(p => p.id === employeeData.perfilId);
                if (foundProfile) {
                    console.log("[EmployeeFormPage] Associated profile found in state:", foundProfile);
                    setSelectedProfile(foundProfile);
                } else if (profiles.length > 0 || !loadingProfiles) { // Só busca no DB se perfis carregaram (ou falharam)
                    console.warn("[EmployeeFormPage] Profile not found in state, fetching from DB:", employeeData.perfilId);
                    try {
                        const profileDocRef = doc(db, 'perfis', employeeData.perfilId);
                        const profileDocSnap = await getDoc(profileDocRef);
                        if (profileDocSnap.exists() && profileDocSnap.data().tenantId === currentTenantId) { // Verifica tenant do perfil
                            const profileData = { id: profileDocSnap.id, ...profileDocSnap.data() };
                            console.log("[EmployeeFormPage] Associated profile fetched from DB:", profileData);
                            setSelectedProfile(profileData);
                        } else {
                            console.error("[EmployeeFormPage] Associated profile not found in DB or wrong tenant!");
                            setPageError("Perfil associado ao colaborador não foi encontrado ou pertence a outra loja.")
                            setSelectedProfile(null);
                        }
                    } catch (profileErr) {
                        console.error("[EmployeeFormPage] Error fetching associated profile:", profileErr);
                         setPageError("Erro ao carregar dados do perfil associado.")
                        setSelectedProfile(null);
                    }
                } else {
                    console.log("[EmployeeFormPage] Profiles not loaded yet, skipping DB fetch for profile.");
                    // Perfil será definido quando 'profiles' atualizar e este useEffect re-rodar
                }
            } else {
                setSelectedProfile(null);
            }
        } else {
            console.error(`[EmployeeFormPage] Collaborator ${employeeId} not found or belongs to another tenant.`);
            setPageError("Colaborador não encontrado ou pertence a outra loja.");
            // navigate('/tenant/colaboradores'); // Comentado para debug - não redirecionar imediatamente
        }
    }).catch(err => {
        console.error("[EmployeeFormPage] Error fetching collaborator for edit:", err);
        setPageError("Falha ao carregar dados do colaborador.");
    }).finally(() => {
        setLoadingEditData(false);
    });

  // Depender do estado do contexto, tenantId (derivado) E profiles (para associar)
  }, [employeeId, isEditing, db, navigate, tenantContext.isLoading, tenantContext.currentTenant, tenantContext.error, profiles, loadingProfiles]); // Adicionado profiles/loadingProfiles

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
     // Log para verificar as especialidades recebidas e o estado após atualização
     console.log("[handleSpecialtyChange] Received specialties:", selectedActualSpecialties);
     setFormData(prev => {
       const newState = { ...prev, especialidades: selectedActualSpecialties };
       console.log("[handleSpecialtyChange] New formData state (before commit):", newState);
       return newState;
     });
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
    console.log("[EmployeeFormPage] handleSubmit triggered.");
    setSubmitting(true);
    setPageError(null);
    setLoading(true);

    const currentTenantId = tenantContext.currentTenant?.id;
    if (!currentTenantId) {
      console.error("[EmployeeFormPage] TenantId missing during submit!");
      setPageError("Erro crítico: ID da Loja não encontrado. Não é possível salvar.");
      setSubmitting(false);
      setLoading(false);
      return;
    }

    // Email existence check (unchanged)
    if (!isEditing) {
        console.log(`[EmployeeFormPage] Checking if email ${formData.email} exists for tenant ${currentTenantId}...`);
        const q = query(
            collection(db, "colaboradores"),
            where("tenantId", "==", currentTenantId),
            where("email", "==", formData.email),
            limit(1)
        );
        try {
            const querySnapshot = await getDocs(q);
            if (!querySnapshot.empty) {
                console.warn("[EmployeeFormPage] Email already exists.");
                setPageError("Este e-mail já está cadastrado para outro colaborador nesta loja.");
                setSubmitting(false);
                setLoading(false);
                return;
            }
            console.log("[EmployeeFormPage] Email is unique.");
        } catch (checkError) {
            console.error("[EmployeeFormPage] Error checking email existence:", checkError);
            setPageError("Erro ao verificar e-mail. Tente novamente.");
            setSubmitting(false);
            setLoading(false);
            return;
        }
    }

    // Prepare dataToSave (unchanged)
    const dataToSave = {
      nome: formData.nome.trim(),
      email: formData.email.trim().toLowerCase(),
      telefone: formData.telefone.trim(),
      perfilId: formData.perfilId,
      especialidades: selectedProfile?.tipo === 'veterinario' ? formData.especialidades : [],
      status: formData.status,
      tenantId: currentTenantId,
      updated_at: serverTimestamp()
    };
    console.log("[EmployeeFormPage] Data prepared for saving:", dataToSave);

    try {
      let employeeDocId = employeeId;

      if (isEditing) {
        console.log(`[EmployeeFormPage] Updating collaborator ${employeeId}...`);
        const employeeDocRef = doc(db, 'colaboradores', employeeId);
        await updateDoc(employeeDocRef, dataToSave);
        console.log("[EmployeeFormPage] updateDoc completed for:", employeeId);
        console.log("[EmployeeFormPage] Collaborator updated successfully.");
        toast({ title: "Sucesso!", description: "Colaborador atualizado." });
      } else {
        console.log("[EmployeeFormPage] Creating new collaborator...");
        const createData = { ...dataToSave, created_at: serverTimestamp() };
        const docRef = await addDoc(collection(db, 'colaboradores'), createData);
        employeeDocId = docRef.id;
        console.log("[EmployeeFormPage] addDoc completed. New ID:", employeeDocId);
        console.log(`[EmployeeFormPage] New collaborator created with ID: ${employeeDocId}`);
        
        // Send invite logic (unchanged)
        console.log(`[EmployeeFormPage] Attempting to send invite to ${createData.email}...`);
        try {
           const result = await sendCustomInviteFunction({
            email: createData.email,
            displayName: createData.nome,
            tenantId: currentTenantId, 
            storeName: tenantContext.currentTenant?.company_name || 'sua loja'
          });
          console.log("[EmployeeFormPage] Invite function result:", result);
          if (result.data.success) {
            toast({ title: "Convite Enviado!", description: `Convite enviado para ${createData.email}.` });
          } else {
            throw new Error(result.data.error || 'Falha no envio do convite pela função.');
          }
        } catch (inviteError) {
          console.error("[EmployeeFormPage] Error sending invite:", inviteError);
          toast({
            variant: "destructive",
            title: "Erro no Convite",
            description: `Não foi possível enviar o convite (${inviteError.message || inviteError}). O colaborador foi criado.`,
            duration: 7000
          });
        }
        toast({ title: "Sucesso!", description: "Colaborador criado." });
      }

      // Navigate AFTER save
      navigate('/tenant/colaboradores');

    } catch (err) {
      console.error("[EmployeeFormPage] Error saving collaborator:", err);
      setPageError(`Falha ao salvar colaborador: ${err.message}`);
      toast({ variant: "destructive", title: "Erro ao Salvar", description: "Não foi possível salvar os dados." });
    } finally {
      setSubmitting(false);
      setLoading(false);
    }
  };

  // --- Renderização Condicional --- 
  const pageIsLoading = loading || loadingProfiles || loadingSpecialties || loadingEditData;

  if (pageIsLoading && !pageError) {
    return <div className="flex justify-center items-center h-screen"><Loader2 className="h-8 w-8 animate-spin" /> Carregando...</div>;
  }

  // Renderização principal do formulário (quando TenantContext está ok)
  return (
    <div className="container mx-auto p-4 max-w-3xl">
      <Card>
        <CardHeader>
          <CardTitle>{isEditing ? "Editar Colaborador" : "Adicionar Novo Colaborador"}</CardTitle>
          <CardDescription>
            {isEditing ? `Modifique os dados de ${originalEmployeeData?.nome || 'colaborador'}.` : "Preencha os dados para convidar um novo membro para a equipe."}
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-6">
            {/* Mostrar loading específico se estiver carregando dados de edição */}
            {loadingEditData && (
              <div className="flex justify-center items-center h-20">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <p className="ml-2">Carregando dados para edição...</p>
              </div>
            )}

            {/* Renderiza campos apenas se não estiver carregando dados de edição */}
            {!loadingEditData && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Coluna Esquerda */}
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="nome">Nome Completo</Label>
                      <Input id="nome" name="nome" value={formData.nome} onChange={handleInputChange} required />
                    </div>
                    <div>
                      <Label htmlFor="email">Email</Label>
                      <Input id="email" name="email" type="email" value={formData.email} onChange={handleInputChange} required />
                    </div>
                    <div>
                      <Label htmlFor="telefone">Telefone (Opcional)</Label>
                      <Input id="telefone" name="telefone" value={formData.telefone} onChange={handleInputChange} />
                    </div>
                  </div>

                  {/* Coluna Direita */}
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="perfilId">Perfil de Acesso</Label>
                      <Select
                        name="perfilId"
                        value={formData.perfilId}
                        onValueChange={handleProfileChange}
                        required
                      >
                        <SelectTrigger disabled={loadingProfiles}>
                          <SelectValue placeholder={loadingProfiles ? "Carregando perfis..." : "Selecione um perfil"} />
                        </SelectTrigger>
                        <SelectContent>
                          {!loadingProfiles && profiles.length === 0 && <SelectItem value="" disabled>Nenhum perfil encontrado</SelectItem>}
                          {profiles.map((profile) => (
                            <SelectItem key={profile.id} value={profile.id}>
                              {profile.nome}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Especialidades - Condicional baseado no tipo do perfil SELECIONADO */}
                    {selectedProfile?.tipo === 'veterinario' && (
                      <div className="space-y-2">
                        <Label htmlFor="especialidades">Especialidades (Veterinário)</Label>
                        <MultiSelect
                           options={availableSpecialties}
                           selected={formData.especialidades || []}
                           onChange={handleSpecialtyChange}
                           onOtherToggle={handleOtherSpecialtyToggle}
                           placeholder="Selecionar especialidades..."
                           disabled={loading || submitting || loadingProfiles || loadingSpecialties || loadingEditData}
                           className="mb-4"
                        />
                        {showNewSpecialtyInput && (
                          <div className="mt-2 flex items-center space-x-2">
                              <Input
                                  type="text"
                                  value={newSpecialtyName}
                                  onChange={(e) => setNewSpecialtyName(e.target.value)}
                                  placeholder="Nova Especialidade"
                                  disabled={addingSpecialty}
                              />
                              <Button type="button" onClick={handleAddNewSpecialty} disabled={addingSpecialty || !newSpecialtyName.trim()}>
                                  {addingSpecialty ? <Loader2 className="h-4 w-4 animate-spin" /> : "Adicionar"}
                              </Button>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Status - Sempre visível */}
                    <div className="flex items-center space-x-2 pt-2">
                      <Switch
                        id="status"
                        checked={formData.status}
                        onCheckedChange={handleStatusChange}
                      />
                      <Label htmlFor="status">
                        {formData.status ? "Ativo" : "Inativo"}
                      </Label>
                      <span className="text-xs text-muted-foreground">
                        (Colaboradores inativos não podem acessar o sistema)
                      </span>
                    </div>

                  </div>
                </div>
              </>
            )}

            {/* Error Message */} 
            {pageError && (
                <div className="text-red-600 bg-red-100 p-3 rounded-md flex items-center">
                    <AlertCircle className="h-5 w-5 mr-2" />
                    <span>{pageError}</span>
                </div>
            )}
          </CardContent>
          <CardFooter className="flex justify-end space-x-4">
              <Button type="button" variant="outline" onClick={() => navigate('/tenant/colaboradores')} disabled={submitting || loading}> 
                Cancelar
              </Button>
              <Button type="submit" disabled={submitting || pageIsLoading || (isEditing && !originalEmployeeData) }>
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Salvando...
                  </>
                ) : (
                  isEditing ? 'Salvar Alterações' : 'Criar Colaborador'
                )}
              </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}

export default EmployeeFormPage;