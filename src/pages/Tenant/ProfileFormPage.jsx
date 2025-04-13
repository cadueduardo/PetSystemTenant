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

// ----- SIMULAÇÃO DAS CLAIMS - REMOVER DEPOIS E BUSCAR REAL ----
// const useAuth = () => ({
//   userClaims: { isAdmin: true, tenant_id: 'test-tenant' } // Precisa ser o tenantId real
// });
// -----------------------------------------------------------

// --- Definição dos Recursos e Ações para Permissões ---
// (Simplificado - pode ser movido para um arquivo de configuração)
const PERMISSION_RESOURCES = [
    { id: 'clientes', label: 'Clientes', modules: ['vet', 'shop'] },
    { id: 'agenda_vet', label: 'Agenda (Vet)', modules: ['vet'] },
    { id: 'agenda_shop', label: 'Agenda (Shop)', modules: ['shop'] },
    { id: 'prontuarios', label: 'Prontuários (Vet)', modules: ['vet'] },
    { id: 'produtos', label: 'Produtos (Shop)', modules: ['shop'] },
    { id: 'servicos', label: 'Serviços', modules: ['vet', 'shop'] },
    { id: 'financeiro', label: 'Financeiro', modules: ['vet', 'shop'] },
    { id: 'perfis_colaboradores', label: 'Perfis/Colaboradores', modules: ['vet', 'shop'] }, // Gerenciar permissões/acessos
];
const PERMISSION_ACTIONS = ['ler', 'escrever']; // 'criar', 'editar', 'excluir' poderiam ser adicionados
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
  const { profileId } = useParams(); // Pega o ID da URL, se existir (edição)
  const navigate = useNavigate();
  const db = getFirestore();
  // const { userClaims } = useAuth(); // Remover hook simulado
  // const tenantId = userClaims?.tenant_id; // Remover claim simulado
  const { tenantId } = useTenant(); // Usar o hook useTenant

  const [formData, setFormData] = useState({
    nome: '',
    tipo: '',
    descricao: '',
    modulos: [],
    permissoes: [] // Armazenará as strings completas: modulo:recurso:acao
  });
  const [permissionSelections, setPermissionSelections] = useState({}); // Estado auxiliar para os checkboxes de permissão
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const isEditing = Boolean(profileId);

  // Efeito para buscar dados do perfil se estiver editando
  useEffect(() => {
    if (isEditing && tenantId) {
      setLoading(true);
      const docRef = doc(db, 'perfis', profileId);
      getDoc(docRef).then(docSnap => {
        if (docSnap.exists() && docSnap.data().tenantId === tenantId) {
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
              const parts = perm.split(':'); // ex: vet:agenda_vet:ler
              if (parts.length === 3) {
                  const [, resource, action] = parts;
                  if (!initialSelections[resource]) initialSelections[resource] = {};
                  initialSelections[resource][action] = true;
              }
          });
          setPermissionSelections(initialSelections);
        } else {
          setError("Perfil não encontrado ou pertence a outro tenant.");
          navigate('/tenant/perfis'); // Redireciona se não encontrar
        }
      }).catch(err => {
        console.error("Erro ao buscar perfil:", err);
        setError("Falha ao carregar dados do perfil.");
      }).finally(() => {
        setLoading(false);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileId, isEditing, db, tenantId]); // Removido navigate da dependência para evitar loop se erro ocorrer

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
            // Define o prefixo do módulo
            let moduloPrefix = 'ambos'; // Padrão se aplica a ambos
            if (resource.modules.length === 1) {
                moduloPrefix = resource.modules[0]; // Usa o único módulo se for específico
            }

            permissionStrings.push(`${moduloPrefix}:${resource.id}:${action}`);
          }
        });
      }
    });
    return permissionStrings;
  };

  // Handler para submissão do formulário
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!tenantId) {
      setError("Erro: Tenant ID não disponível.");
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
    setError(null);

    const finalPermissions = generatePermissionStrings();
    const profileData = {
      nome: formData.nome.trim(),
      tipo: formData.tipo,
      descricao: formData.descricao.trim(),
      modulos: formData.modulos,
      permissoes: finalPermissions,
      tenantId: tenantId,
      atualizadoEm: serverTimestamp(),
    };

    try {
      if (isEditing) {
        const docRef = doc(db, 'perfis', profileId);
        await updateDoc(docRef, profileData);
      } else {
        profileData.criadoEm = serverTimestamp();
        await addDoc(collection(db, 'perfis'), profileData);
      }
      navigate('/tenant/perfis'); // Volta para a lista após salvar
    } catch (err) {
      console.error("Erro ao salvar perfil: ", err);
      setError("Falha ao salvar perfil. Verifique os dados e tente novamente.");
      setLoading(false);
    }
  };

  if (!tenantId && !loading) return <p className="text-red-500">Erro: Tenant não identificado.</p>;
 // Se estiver carregando dados para edição
 if (loading && isEditing) {
    return <div className="flex justify-center items-center h-32"><Loader2 className="h-8 w-8 animate-spin" /> Carregando dados do perfil...</div>;
 }

  return (
    <form onSubmit={handleSubmit}>
      <Card>
        <CardHeader>
          <CardTitle>{isEditing ? 'Editar Perfil' : 'Criar Novo Perfil'}</CardTitle>
          <CardDescription>Defina o nome, módulos e permissões para este perfil.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Campo Nome */}
          <div className="space-y-2">
            <Label htmlFor="nome">Nome do Perfil</Label>
            <Input
              id="nome"
              name="nome"
              value={formData.nome}
              onChange={handleInputChange}
              placeholder="Ex: Veterinário, Recepcionista, Gerente"
              required
              disabled={loading}
            />
          </div>

          {/* Campo Tipo (Novo) */}
          <div className="space-y-2">
            <Label htmlFor="tipo">Tipo do Perfil</Label>
            <Select 
              name="tipo"
              value={formData.tipo}
              onValueChange={handleTypeChange}
              required 
              disabled={loading}
            >
              <SelectTrigger id="tipo">
                <SelectValue placeholder="Selecione o tipo principal" />
              </SelectTrigger>
              <SelectContent>
                {PROFILE_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Campo Descrição */}
          <div className="space-y-2">
            <Label htmlFor="descricao">Descrição (Opcional)</Label>
            <Textarea
              id="descricao"
              name="descricao"
              value={formData.descricao}
              onChange={handleInputChange}
              placeholder="Descreva brevemente a função deste perfil"
              disabled={loading}
            />
          </div>

          {/* Seleção de Módulos */}
          <div className="space-y-2">
            <Label>Módulos Aplicáveis</Label>
            <div className="flex gap-4 pt-1">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="modulo-vet"
                  checked={formData.modulos.includes('vet')}
                  onCheckedChange={() => handleModuleChange('vet')}
                  disabled={loading}
                 />
                <Label htmlFor="modulo-vet">Clínica Veterinária</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="modulo-shop"
                  checked={formData.modulos.includes('shop')}
                  onCheckedChange={() => handleModuleChange('shop')}
                  disabled={loading}
                 />
                <Label htmlFor="modulo-shop">Pet Shop</Label>
              </div>
            </div>
          </div>

          {/* Seleção de Permissões */}
          <div className="space-y-4">
            <Label>Permissões Detalhadas</Label>
            {PERMISSION_RESOURCES.map(resource => {
              // Só mostra o recurso se for relevante para ALGUM dos módulos selecionados
              const isResourceRelevant = resource.modules.some(rm => formData.modulos.includes(rm));
              if (!isResourceRelevant) return null;

              return (
                <div key={resource.id} className="p-3 border rounded space-y-2">
                   <p className="font-medium text-sm">{resource.label}</p>
                   <div className="flex gap-4">
                    {PERMISSION_ACTIONS.map(action => (
                      <div key={action} className="flex items-center space-x-2">
                        <Checkbox
                          id={`perm-${resource.id}-${action}`}
                          checked={permissionSelections[resource.id]?.[action] || false}
                          onCheckedChange={() => handlePermissionChange(resource.id, action)}
                          disabled={loading}
                        />
                        <Label htmlFor={`perm-${resource.id}-${action}`} className="capitalize text-sm">{action}</Label>
                      </div>
                    ))}
                   </div>
                </div>
              );
            })}
          </div>

        </CardContent>
        <CardFooter className="flex justify-end gap-2">
          <Button 
            type="button"
            variant="outline"
            onClick={() => navigate(-1)}
            disabled={loading}
           > 
            Cancelar
          </Button>
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