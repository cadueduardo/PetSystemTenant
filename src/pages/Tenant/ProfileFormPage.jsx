import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getFirestore, doc, getDoc, addDoc, updateDoc, collection, serverTimestamp } from 'firebase/firestore';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { AlertCircle, Loader2 } from 'lucide-react';
import { useTenant } from '@/components/tenant/TenantContext';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
// Importar do arquivo de configuração
import { PERMISSION_RESOURCES, PERMISSION_ACTIONS, formatPermission, parsePermission, AVAILABLE_MODULES } from '@/config/permissions';

// --- Log Módulo ---
console.log("--- MODULE LOAD: src/pages/Tenant/ProfileFormPage.jsx ---");
// -----------------

// ----- SIMULAÇÃO DAS CLAIMS - REMOVER DEPOIS E BUSCAR REAL ----
// const useAuth = () => ({
//   userClaims: { isAdmin: true, tenant_id: 'test-tenant' } // Precisa ser o tenantId real
// });
// -----------------------------------------------------------

// --- REMOVER Definição dos Recursos e Ações para Permissões ---
// const PERMISSION_RESOURCES = [
//     { id: 'clientes', label: 'Clientes', modules: ['vet', 'shop'] },
//     { id: 'agenda_vet', label: 'Agenda (Vet)', modules: ['vet'] },
//     { id: 'agenda_shop', label: 'Agenda (Shop)', modules: ['shop'] },
//     { id: 'prontuarios', label: 'Prontuários (Vet)', modules: ['vet'] },
//     { id: 'produtos', label: 'Produtos (Shop)', modules: ['shop'] },
//     { id: 'servicos', label: 'Serviços', modules: ['vet', 'shop'] },
//     { id: 'financeiro', label: 'Financeiro', modules: ['vet', 'shop'] },
//     { id: 'perfis_colaboradores', label: 'Perfis/Colaboradores', modules: ['vet', 'shop'] }, // Gerenciar permissões/acessos
// ];
// const PERMISSION_ACTIONS = ['ler', 'escrever']; // 'criar', 'editar', 'excluir' poderiam ser adicionados
// --------------------------------------------------------

// --- Adicionar Tipos de Perfil Predefinidos ---
const PROFILE_TYPES = [
  { value: 'veterinario', label: 'Veterinário' },
  { value: 'recepcionista', label: 'Recepcionista' },
  { value: 'gerente', label: 'Gerente' },
  { value: 'financeiro', label: 'Financeiro' },
  { value: 'banho_tosa', label: 'Banho & Tosa' },
  { value: 'outro', label: 'Outro' },
];
// ------------------------------------------

function ProfileFormPage() {
  // --- Log Renderização ---
  console.log("[ProfileFormPage] Component rendering.");
  // ----------------------

  const { profileId } = useParams();
  const navigate = useNavigate();
  const db = getFirestore();
  const tenantContext = useTenant(); // <-- CORREÇÃO: Obter contexto completo
  const isEditing = Boolean(profileId);

  const [formData, setFormData] = useState({
    nome: '',
    tipo: '',
    descricao: '',
    modulos: [],
    permissoes: []
  });
  const [permissionSelections, setPermissionSelections] = useState({});
  const [loading, setLoading] = useState(false); // Loading geral (edição + submit)
  const [error, setError] = useState(null);

  // Efeito para buscar dados do perfil se estiver editando
  useEffect(() => {
    console.log(`[ProfileFormPage] Edit useEffect triggered. isEditing: ${isEditing}, isLoading: ${tenantContext.isLoading}, error: ${tenantContext.error}, currentTenant:`, tenantContext.currentTenant);

    // 1. Só roda em modo de edição
    if (!isEditing) {
        console.log("[ProfileFormPage] Not in edit mode, skipping fetch.");
        return;
    }

    // 2. Esperar TenantContext
    if (tenantContext.isLoading) {
        console.log("[ProfileFormPage] TenantContext is loading (Edit mode)...");
        setLoading(true); // Usa loading geral
        setError(null);
        return;
    }

    // 3. Tratar erro do TenantContext
    if (tenantContext.error) {
        console.error("[ProfileFormPage] TenantContext error (Edit mode):", tenantContext.error);
        setError(`Erro ao carregar dados da loja: ${tenantContext.error}`);
        setLoading(false);
        return;
    }

    // 4. Obter tenantId APÓS contexto carregado
    const currentTenantId = tenantContext.currentTenant?.id;
    if (!currentTenantId) {
        console.error("[ProfileFormPage] TenantId missing after context load (Edit mode). CurrentTenant:", tenantContext.currentTenant);
        setError("ID da Loja não encontrado no contexto. Não é possível buscar perfil para edição.");
        setLoading(false);
        return;
    }

    // 5. Buscar dados do perfil para edição
    console.log(`[ProfileFormPage] Fetching profile ${profileId} for tenant ${currentTenantId}...`);
    setLoading(true);
    setError(null);

    const docRef = doc(db, 'perfis', profileId);
    getDoc(docRef).then(docSnap => {
      if (docSnap.exists() && docSnap.data().tenantId === currentTenantId) { // Valida tenantId do perfil
        console.log("[ProfileFormPage] Profile data fetched successfully.");
        const data = docSnap.data();
        setFormData({
          nome: data.nome || '',
          tipo: data.tipo || '',
          descricao: data.descricao || '',
          modulos: data.modulos || [],
          permissoes: data.permissoes || []
        });
        // Preencher o estado auxiliar dos checkboxes de permissão
        const initialSelections = {};
        data.permissoes?.forEach(perm => {
            const parsed = parsePermission(perm);
            if (parsed) {
                const { resource, action } = parsed;
                if (!initialSelections[resource]) initialSelections[resource] = {};
                initialSelections[resource][action] = true;
            }
        });
        setPermissionSelections(initialSelections);
      } else {
        console.error(`[ProfileFormPage] Profile ${profileId} not found or wrong tenant.`);
        setError("Perfil não encontrado ou pertence a outra loja.");
        // navigate('/tenant/perfis'); // Considerar não redirecionar imediatamente no erro
      }
    }).catch(err => {
      console.error("[ProfileFormPage] Error fetching profile for edit:", err);
      setError("Falha ao carregar dados do perfil.");
    }).finally(() => {
      setLoading(false);
    });

  // Dependências corretas
  }, [profileId, isEditing, db, tenantContext.isLoading, tenantContext.currentTenant, tenantContext.error]); // Removido navigate

  // Handler para campos de texto e select
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // Handler específico para o Select (shadcn/ui)
  const handleTypeChange = (value) => {
    setFormData(prev => ({ ...prev, tipo: value }));
  };

  // Handler para checkboxes de módulos
  const handleModuleChange = (moduleId) => {
    // Precisa usar a forma de callback do setFormData para acessar o estado mais recente de formData.modulos
    setFormData(prevFormData => {
      const currentModules = prevFormData.modulos;
      const newModules = currentModules.includes(moduleId)
        ? currentModules.filter(m => m !== moduleId)
        : [...currentModules, moduleId];
      
      // Limpa permissões APÓS atualizar os módulos
      setPermissionSelections(prevSelections => {
        const clearedSelections = { ...prevSelections };
        PERMISSION_RESOURCES.forEach(resource => {
            if (!resource.modules.some(rm => newModules.includes(rm))) {
                delete clearedSelections[resource.id];
            }
        });
        return clearedSelections;
      });
      
      return { ...prevFormData, modulos: newModules };
    });
  };

   // Handler para checkboxes de permissões
   const handlePermissionChange = (resourceId, actionId) => {
        setPermissionSelections(prev => {
            const newSelections = { ...prev };
            if (!newSelections[resourceId]) newSelections[resourceId] = {};
            // Se estiver desmarcando 'ler', desmarca 'escrever' também (opcional)
            // if (actionId === 'ler' && !newSelections[resourceId]?.[actionId]) {
            //    if (newSelections[resourceId]) newSelections[resourceId]['escrever'] = false;
            // }
            // Se estiver marcando 'escrever', marca 'ler' também (opcional)
            // if (actionId === 'escrever' && !newSelections[resourceId]?.[actionId]) {
            //     if (!newSelections[resourceId]) newSelections[resourceId] = {};
            //     newSelections[resourceId]['ler'] = true;
            // }
            newSelections[resourceId][actionId] = !newSelections[resourceId]?.[actionId]; // Toggle
            return newSelections;
        });
   };

  // Função para converter seleções em array de strings de permissão
  const generatePermissionStrings = () => {
    const permissionStrings = [];
    PERMISSION_RESOURCES.forEach(resource => {
      // Só gera permissão se o recurso for relevante para os módulos selecionados
      if (resource.modules.some(rm => formData.modulos.includes(rm))) {
        PERMISSION_ACTIONS.forEach(action => {
          if (permissionSelections[resource.id]?.[action]) {
            // Usa a função de formatar do config
            permissionStrings.push(formatPermission(resource.id, action)); // ex: clientes:ler
            // REMOVER lógica do prefixo do módulo
            // let moduloPrefix = 'ambos'; // Padrão se aplica a ambos
            // if (resource.modules.length === 1) {
            //     moduloPrefix = resource.modules[0]; // Usa o único módulo se for específico
            // }
            // permissionStrings.push(`${moduloPrefix}:${resource.id}:${action}`);
          }
        });
      }
    });
    return permissionStrings;
  };

  // Handler para submissão do formulário
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    const currentTenantId = tenantContext.currentTenant?.id;
    if (!currentTenantId) {
      console.error("[ProfileFormPage] Submit Error: Tenant ID missing from context.");
      setError("Erro crítico: ID da Loja não encontrado. Não é possível salvar.");
      return;
    }
    if (!formData.nome.trim()) {
        setError("Erro: Nome do perfil é obrigatório.");
        return;
    }
    if (!formData.tipo) {
        setError("Erro: Selecione o tipo do perfil.");
        return;
    }
    if (formData.modulos.length === 0) {
        setError("Erro: Selecione pelo menos um módulo.");
        return;
    }

    setLoading(true);
    console.log("[handleSubmit - ProfileForm] Submit button clicked, state set to loading."); // <-- Log 1

    const finalPermissions = generatePermissionStrings();
    const profileData = {
      nome: formData.nome.trim(),
      tipo: formData.tipo,
      descricao: formData.descricao.trim(),
      modulos: formData.modulos,
      permissoes: finalPermissions,
      tenantId: currentTenantId,
      atualizadoEm: serverTimestamp(),
    };

    try {
      if (isEditing) {
        console.log(`[handleSubmit - ProfileForm] Updating profile ${profileId}...`); // <-- Log 2a
        const docRef = doc(db, 'perfis', profileId);
        await updateDoc(docRef, profileData);
        console.log(`[handleSubmit - ProfileForm] Profile ${profileId} updated.`); // <-- Log 3a
      } else {
        console.log(`[handleSubmit - ProfileForm] Creating new profile...`); // <-- Log 2b
        profileData.criadoEm = serverTimestamp();
        const addedDoc = await addDoc(collection(db, 'perfis'), profileData);
        console.log(`[handleSubmit - ProfileForm] New profile created with ID: ${addedDoc.id}.`); // <-- Log 3b
      }
      console.log("[handleSubmit - ProfileForm] Navigating back to list..."); // <-- Log 4 (Success)
      navigate('/tenant/perfis');
    } catch (err) {
      console.error("[handleSubmit - ProfileForm] Error saving profile: ", err);
      setError(`Falha ao salvar perfil. ${err.message}`);
      console.log("[handleSubmit - ProfileForm] Error occurred, loading set to false."); // <-- Log 5 (Error)
      setLoading(false);
    } 
    // Removido finally para não setar loading false em caso de sucesso ANTES da navegação
  };

  // ----- Renderização Condicional -----
  // 1. Loading do Contexto
  if (tenantContext.isLoading) {
    return (
      <div className="flex justify-center items-center h-40">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-2">Carregando dados da loja...</p>
      </div>
    );
  }

  // 2. Erro no Contexto OU Erro geral da página
  if (tenantContext.error || error) {
    return (
      <div className="text-red-600 flex items-center justify-center h-40">
        <AlertCircle className="mr-2 h-5 w-5" />
        {error || `Erro ao carregar dados da loja: ${tenantContext.error}`}
      </div>
    );
  }
  
  // 3. Renderização principal do formulário (se contexto ok e sem erro geral)
  return (
    <form onSubmit={handleSubmit}>
      <Card>
        <CardHeader>
          <CardTitle>{isEditing ? 'Editar Perfil' : 'Criar Novo Perfil'}</CardTitle>
          <CardDescription>Defina o nome, módulos e permissões para este perfil.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Mostrar loading GERAL se estiver salvando/carregando edição */}
          {loading && (
            <div className="absolute inset-0 bg-white bg-opacity-75 flex justify-center items-center z-10">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="ml-2">{isEditing ? "Carregando dados do perfil..." : "Salvando..."}</p>
            </div>
          )}

          {/* Campos do Formulário */} 
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
             {/* Coluna Esquerda: Nome, Tipo, Descrição */} 
            <div className="space-y-4">
               {/* ... Nome ... */} 
              <div className="space-y-2">
                <Label htmlFor="nome">Nome do Perfil</Label>
                <Input id="nome" name="nome" value={formData.nome} onChange={handleInputChange} required />
              </div>
              {/* ... Tipo ... */} 
              <div className="space-y-2">
                <Label htmlFor="tipo">Tipo de Perfil</Label>
                <Select name="tipo" value={formData.tipo} onValueChange={handleTypeChange} required>
                  <SelectTrigger id="tipo">
                    <SelectValue placeholder="Selecione um tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    {PROFILE_TYPES.map(type => (
                      <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
               {/* ... Descrição ... */} 
              <div className="space-y-2">
                <Label htmlFor="descricao">Descrição (Opcional)</Label>
                <Textarea id="descricao" name="descricao" value={formData.descricao} onChange={handleInputChange} />
              </div>
            </div>

             {/* Coluna Direita: Módulos e Permissões */} 
            <div className="space-y-6"> 
              {/* ... Módulos ... */} 
               <div className="space-y-2">
                <Label>Módulos Acessíveis</Label>
                <div className="grid grid-cols-2 gap-2">
                  {AVAILABLE_MODULES.map(module => (
                    <div key={module.id} className="flex items-center space-x-2">
                      <Checkbox 
                        id={`module-${module.id}`}
                        checked={formData.modulos.includes(module.id)}
                        onCheckedChange={() => handleModuleChange(module.id)}
                      />
                      <Label htmlFor={`module-${module.id}`} className="font-normal capitalize">{module.label}</Label>
                    </div>
                  ))}
                </div>
               </div>

              {/* ... Permissões ... */} 
               <div className="space-y-4">
                <Label>Permissões Detalhadas</Label>
                {formData.modulos.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Selecione um módulo para ver as permissões.</p>
                ) : (
                  PERMISSION_RESOURCES
                    .filter(resource => resource.modules.some(rm => formData.modulos.includes(rm))) // Filtra por módulo selecionado
                    .map(resource => (
                      <div key={resource.id} className="space-y-2 p-3 border rounded-md">
                        <Label className="font-semibold capitalize">{resource.label}</Label>
                        <div className="flex space-x-4">
                          {PERMISSION_ACTIONS.map(action => (
                            <div key={action} className="flex items-center space-x-2">
                              <Checkbox
                                id={`perm-${resource.id}-${action}`}
                                checked={!!permissionSelections[resource.id]?.[action]}
                                onCheckedChange={() => handlePermissionChange(resource.id, action)}
                              />
                              <Label htmlFor={`perm-${resource.id}-${action}`} className="font-normal capitalize">{action}</Label>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))
                )}
               </div>
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex justify-end space-x-2">
          <Button type="button" variant="outline" onClick={() => navigate('/tenant/perfis')} disabled={loading}>Cancelar</Button>
          <Button type="submit" disabled={loading}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {isEditing ? 'Salvar Alterações' : 'Criar Perfil'}
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
}

export default ProfileFormPage;