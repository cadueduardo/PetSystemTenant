import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Tenant } from "@/api/entities";
import { Customization } from "@/api/entities";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/components/ui/use-toast";
import { UploadFile } from "@/api/integrations";
import { 
  Loader2, 
  Upload, 
  Building2, 
  Settings as SettingsIcon,
  Save,
  Image,
  Clock, 
  MessageSquare 
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import AddressForm from "@/components/shared/AddressForm";
import { getFunctions, httpsCallable } from "firebase/functions";
import { getApp } from "firebase/app";

const safeApiCall = async (apiFunction, params, fallback = []) => {
  try {
    if (typeof apiFunction === 'function' && apiFunction !== undefined) {
      return await apiFunction(params);
    }
    console.error("API function is not defined:", apiFunction);
    return fallback;
  } catch (error) {
    console.error("Error in API call:", error);
    return fallback;
  }
};

export default function Settings() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("visual");
  const [tenant, setTenant] = useState(null);
  const [isSearchingCep, setIsSearchingCep] = useState(false);
  const [customization, setCustomization] = useState({
    company_logo_url: "",
    primary_color: "#3B82F6",
    secondary_color: "#1E40AF",
    use_logo_in_header: false,
    company_info: {
      social_media: {
        facebook: "",
        instagram: "",
        whatsapp: ""
      }
    },
    layout_preferences: {
      show_hero: true,
      show_featured_products: true,
      show_categories: true,
      show_testimonials: true
    },
    operating_hours: {
      monday: { enabled: true, start: '08:00', end: '18:00' },
      tuesday: { enabled: true, start: '08:00', end: '18:00' },
      wednesday: { enabled: true, start: '08:00', end: '18:00' },
      thursday: { enabled: true, start: '08:00', end: '18:00' },
      friday: { enabled: true, start: '08:00', end: '18:00' },
      saturday: { enabled: false, start: '09:00', end: '12:00' },
      sunday: { enabled: false, start: '09:00', end: '12:00' },
    },
    messaging_settings: {
      auto_send_confirmation: false,
      send_before_hours: 24,
      retry_enabled: false,
      retry_after_hours: 4,
      template_confirmation: "Olá {cliente}, tudo bem? Confirmando seu agendamento em {clinica} para {pet} no dia {data_hora}. Responda SIM para confirmar ou NÃO para cancelar. Obrigado!",
      template_confirmed_reply: "Obrigado por confirmar seu agendamento!",
      template_canceled_reply: "Ok, seu agendamento foi cancelado. Obrigado por nos avisar!",
      enable_auto_cancel: false,
      cancel_if_unconfirmed_hours_before: 3,
      template_auto_cancel_notification: "Seu agendamento em {clinica} para {pet} no dia {data_hora} foi cancelado automaticamente por falta de confirmação. Por favor, entre em contato para reagendar."
    }
  });

  useEffect(() => {
    loadData();
  }, []);

  const fetchWithRetry = async (fetchFn, maxRetries = 3, baseDelay = 1000) => {
    let lastError;
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await fetchFn();
      } catch (error) {
        console.log(`Tentativa ${attempt + 1} falhou:`, error);
        lastError = error;

        if (!error.message?.includes("429") && !error.message?.includes("Rate limit")) {
          throw error;
        }

        const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 1000;
        console.log(`Aguardando ${Math.round(delay)}ms antes da próxima tentativa`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    console.error("Todas as tentativas falharam, usando dados padrão:", lastError);
    return null;
  };

  const loadData = async () => {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const storeParam = urlParams.get('store');
      
      const loadCustomization = async (filter) => {
        try {
          const results = await safeApiCall(Customization.filter, filter, []);
          if (results && results.length > 0) {
            let customizationData = results[0];
            customizationData.company_info = customizationData.company_info || {};
            customizationData.company_info.social_media = customizationData.company_info.social_media || {
              facebook: "",
              instagram: "",
              whatsapp: ""
            };
            
            customizationData.operating_hours = {
              ...(customization.operating_hours),
              ...(customizationData.operating_hours || {}),
              monday: { ...(customization.operating_hours.monday), ...(customizationData.operating_hours?.monday || {}) },
              tuesday: { ...(customization.operating_hours.tuesday), ...(customizationData.operating_hours?.tuesday || {}) },
              wednesday: { ...(customization.operating_hours.wednesday), ...(customizationData.operating_hours?.wednesday || {}) },
              thursday: { ...(customization.operating_hours.thursday), ...(customizationData.operating_hours?.thursday || {}) },
              friday: { ...(customization.operating_hours.friday), ...(customizationData.operating_hours?.friday || {}) },
              saturday: { ...(customization.operating_hours.saturday), ...(customizationData.operating_hours?.saturday || {}) },
              sunday: { ...(customization.operating_hours.sunday), ...(customizationData.operating_hours?.sunday || {}) },
            };
            customizationData.messaging_settings = {
              ...(customization.messaging_settings),
              ...(customizationData.messaging_settings || {}),
            };
            setCustomization(customizationData);
            return true;
          }
          return false;
        } catch (error) {
          console.error("Erro ao carregar customização:", error);
          return false;
        }
      };
      
      const createNewCustomization = async (tenantId) => {
        try {
          const newCustomizationData = {
            tenant_id: tenantId,
            company_logo_url: "",
            primary_color: "#3B82F6",
            secondary_color: "#1E40AF",
            use_logo_in_header: false,
            company_info: {
              social_media: {
                facebook: "",
                instagram: "",
                whatsapp: ""
              }
            },
            layout_preferences: {
              show_hero: true,
              show_featured_products: true,
              show_categories: true,
              show_testimonials: true
            },
            operating_hours: customization.operating_hours,
            messaging_settings: customization.messaging_settings,
            is_setup_complete: false
          };
          const newCustomization = await safeApiCall(Customization.create, newCustomizationData, null);
          if (newCustomization) {
            setCustomization(newCustomization);
            return true;
          }
          return false;
        } catch (error) {
          console.error("Erro ao criar customização:", error);
          return false;
        }
      };
      
      if (storeParam) {
        const tenantsData = await safeApiCall(
          Tenant.filter, 
          { access_url: storeParam, status: "active" },
          []
        );

        if (!tenantsData || tenantsData.length === 0) {
          navigate(createPageUrl("Contratar"));
          return;
        }
        
        const currentTenant = tenantsData[0];
        setTenant(currentTenant);
        
        await new Promise(resolve => setTimeout(resolve, 500));
        
        const customizationLoaded = await loadCustomization({ tenant_id: currentTenant.id });
        
        if (!customizationLoaded) {
          await new Promise(resolve => setTimeout(resolve, 500));
          
          await createNewCustomization(currentTenant.id);
        }
      } else {
        const tenantId = localStorage.getItem('current_tenant');
        if (!tenantId) {
          console.error("Tenant ID not found in localStorage. Redirecting to login or home.");
          navigate('/');
          setIsLoading(false);
          return;
        }

        const currentTenant = await safeApiCall(() => Tenant.get(tenantId));

        if (!currentTenant) {
           console.error(`Tenant with ID ${tenantId} not found or error fetching. Redirecting.`);
           navigate(createPageUrl("Contratar", { store: tenantId }));
           setIsLoading(false);
           return;
        }

        setTenant(currentTenant);

        const customizationLoaded = await loadCustomization({ tenant_id: currentTenant.id });

        if (!customizationLoaded) {
          await createNewCustomization(currentTenant.id);
        }
      }
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar as configurações. Por favor, tente novamente mais tarde.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      const { file_url } = await UploadFile({ file });
      
      setCustomization(prev => ({
        ...prev,
        company_logo_url: file_url
      }));

    } catch (error) {
      console.error("Erro ao fazer upload do logo:", error);
      toast({
        title: "Erro",
        description: "Não foi possível fazer upload do logo.",
        variant: "destructive"
      });
    }
  };

  const handleSaveSettings = async () => {
    if (!tenant?.id) {
      toast({
        title: "Erro",
        description: "ID do tenant não encontrado para salvar as configurações.",
        variant: "destructive"
      });
      return;
    }

    setIsSaving(true);
    try {
      const app = getApp();
      const firebaseFunctionsInstance = getFunctions(app, "southamerica-east1");
      const updateTenantCallable = httpsCallable(firebaseFunctionsInstance, 'updateTenantSettings');
      
      // Dados do Tenant para atualização (apenas os campos editáveis em Settings.jsx)
      const tenantDataToUpdate = {
        company_name: tenant.company_name,
        legal_name: tenant.legal_name,
        document_type: tenant.document_type,
        document: tenant.document,
        responsible_name: tenant.responsible_name,
        email: tenant.email, 
        phone: tenant.phone,
        address: tenant.address, // Envie o objeto de endereço inteiro conforme definido na interface UpdateTenantData
        inscricao_estadual: tenant.inscricao_estadual,
        inscricao_municipal: tenant.inscricao_municipal,
        cnae_principal: tenant.cnae_principal,
        regime_tributario: tenant.regime_tributario,
      };

      // Dados da Customização para atualização
      const customizationDataToUpdate = {
        ...customization,
        company_info: {
          social_media: {
            facebook: customization.company_info?.social_media?.facebook || "",
            instagram: customization.company_info?.social_media?.instagram || "",
            whatsapp: customization.company_info?.social_media?.whatsapp || ""
          }
        },
        messaging_settings: {
          ...(customization.messaging_settings || {}),
          cancel_if_unconfirmed_hours_before: parseInt(String(customization.messaging_settings?.cancel_if_unconfirmed_hours_before || 3)) || 3,
        }
      };
      // O tenant_id já está no objeto customization se ele foi carregado, ou será adicionado se for uma criação.
      // Se o seu Customization.update não espera o ID no corpo do payload, você pode precisar remover:
      // delete customizationDataToUpdate.id; 

      const promises = [];

      // Promessa para atualizar dados do Tenant
      promises.push(updateTenantCallable({ tenantId: tenant.id, updates: tenantDataToUpdate }));

      // Promessa para atualizar/criar dados de Customization
      if (customization?.id && typeof Customization.update === 'function') {
        promises.push(fetchWithRetry(() => Customization.update(customization.id, customizationDataToUpdate)));
      } else if (!customization?.id && typeof Customization.create === 'function') {
        // Se não tem ID, é uma criação. Garanta que tenant_id está incluído.
        const dataToCreate = { ...customizationDataToUpdate, tenant_id: tenant.id };
        delete dataToCreate.id; // Remove ID se existir, pois é uma criação
        promises.push(fetchWithRetry(() => Customization.create(dataToCreate)));
      } else {
        console.warn("[Settings] Customization.update ou Customization.create não é uma função ou ID está ausente. Pulando salvamento da customização.");
      }

      const results = await Promise.allSettled(promises);

      let overallSuccess = true;
      const successMessages = [];
      const errorMessages = [];

      // Processar resultado da atualização do Tenant (primeira promessa)
      if (results[0]) {
        const tenantResult = results[0];
        if (tenantResult.status === 'fulfilled' && tenantResult.value?.data?.success) {
          successMessages.push(tenantResult.value.data.message || "Dados da empresa atualizados.");
        } else {
          overallSuccess = false;
          const errorMessage = tenantResult.status === 'rejected' ? tenantResult.reason?.message : tenantResult.value?.data?.message;
          errorMessages.push(errorMessage || "Erro ao atualizar dados da empresa.");
          console.error("Erro ao atualizar tenant:", tenantResult.status === 'rejected' ? tenantResult.reason : tenantResult.value);
        }
      }

      // Processar resultado da atualização/criação da Customization (segunda promessa, se existir)
      if (results.length > 1 && results[1]) {
        const customizationResult = results[1];
        if (customizationResult.status === 'fulfilled') { 
          // Supondo que Customization.update/create resolve diretamente ou com dados de sucesso
          // Se retornar um objeto {data:{success:true, message:"..."}}, ajuste aqui:
          // successMessages.push(customizationResult.value?.data?.message || "Customizações salvas.");
          successMessages.push("Customizações salvas."); 
        } else {
          overallSuccess = false;
          errorMessages.push(customizationResult.reason?.message || "Erro ao salvar customizações.");
          console.error("Erro ao salvar customização:", customizationResult.reason);
        }
      }

      if (overallSuccess && successMessages.length > 0) {
        toast({
          title: "Sucesso!",
          description: successMessages.filter(Boolean).join(" ") || "Configurações salvas com sucesso!",
        });
        if (typeof loadData === 'function') {
          loadData(); // Recarrega os dados do tenant e customization
        } else {
          window.location.reload(); // Fallback se loadData não estiver disponível
        }
      } else if (!overallSuccess) {
        toast({
          title: "Atenção",
          description: `Algumas configurações não puderam ser salvas: ${errorMessages.filter(Boolean).join("; ")}`,
          variant: "destructive",
        });
      } else {
        // Caso onde não houve erros mas também nenhuma mensagem de sucesso (ex: nenhuma operação realizada)
        toast({
            title: "Concluído",
            description: "Nenhuma alteração detectada ou necessária."
        });
      }

    } catch (error) { 
      console.error("Erro geral não capturado em handleSaveSettings:", error);
      toast({
        title: "Erro Crítico",
        description: "Ocorreu um problema inesperado ao tentar salvar. Verifique o console.",
        variant: "destructive"
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Nova função para lidar com mudanças nos campos diretos do tenant
  const handleTenantChange = (e) => {
    const { name, value, type, checked } = e.target;
    setTenant(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  // Nova função para lidar com mudanças nos campos de endereço do tenant
  const handleTenantAddressChange = ({ name, value }) => {
    setTenant(prev => ({
      ...prev,
      address: {
        ...prev.address,
        [name]: value
      }
    }));
    
    if (name === 'cep' && value.replace(/[^0-9]/g, "").length === 8) {
      searchAddressByCepInSettings(value.replace(/[^0-9]/g, ""));
    }
  };

  // Nova função para buscar CEP dentro de Settings.jsx
  const searchAddressByCepInSettings = async (cep) => {
    if (cep.length !== 8) return;
    
    setIsSearchingCep(true);
    try {
      const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      if (!response.ok) { 
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      
      if (!data.erro) {
        setTenant(prev => ({
          ...prev,
          address: {
            ...prev.address,
            cep: cep,
            street: data.logradouro || prev.address.street || "",
            neighborhood: data.bairro || prev.address.neighborhood || "",
            city: data.localidade || prev.address.city || "",
            state: data.uf || prev.address.state || "",
            ibge_code: data.ibge || prev.address.ibge_code || "",
            number: prev.address.number || "",
            complement: prev.address.complement || ""
          }
        }));
      } else {
        toast({
          title: "CEP não encontrado",
          description: "Não foi possível encontrar o CEP informado. Por favor, verifique.",
          variant: "warning"
        });
      }
    } catch (error) {
      console.error("Erro ao buscar CEP:", error);
      toast({
        title: "Erro ao buscar CEP",
        description: "Ocorreu um problema ao tentar buscar o CEP. Tente novamente.",
        variant: "destructive"
      });
    } finally {
      setIsSearchingCep(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-12 w-12 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Configurações</h1>
          <p className="text-gray-500">Personalize sua loja</p>
        </div>
        <Button 
          onClick={handleSaveSettings} 
          disabled={isSaving}
          className="bg-green-600 hover:bg-green-700"
        >
          {isSaving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Salvando...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              Salvar Alterações
            </>
          )}
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="visual" className="flex items-center gap-2">
            <Image className="h-4 w-4" />
            Identidade Visual
          </TabsTrigger>
          <TabsTrigger value="info" className="flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            Informações da Empresa
          </TabsTrigger>
          <TabsTrigger value="preferences" className="flex items-center gap-2">
            <SettingsIcon className="h-4 w-4" />
            Preferências
          </TabsTrigger>
          <TabsTrigger value="hours" className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Horários
          </TabsTrigger>
          <TabsTrigger value="messaging" className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            Mensagens
          </TabsTrigger>
        </TabsList>

        <TabsContent value="visual">
          <Card>
            <CardHeader>
              <CardTitle>Identidade Visual</CardTitle>
              <CardDescription>
                Configure o logo e as cores da sua loja
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div>
                  <Label>Logo da Empresa</Label>
                  <div className="mt-2 flex items-center gap-4">
                    <div className="relative h-24 w-24 rounded-lg border-2 border-dashed border-gray-300 overflow-hidden">
                      {customization.company_logo_url ? (
                        <img
                          src={customization.company_logo_url}
                          alt="Logo da empresa"
                          className="h-full w-full object-contain"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center">
                          <Image className="h-8 w-8 text-gray-400" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1">
                      <Input
                        type="file"
                        accept="image/*"
                        onChange={handleLogoUpload}
                        className="hidden"
                        id="logo-upload"
                      />
                      <Label
                        htmlFor="logo-upload"
                        className="flex cursor-pointer items-center gap-2 rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                      >
                        <Upload className="h-4 w-4" />
                        Alterar Logo
                      </Label>
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    id="use-logo"
                    checked={customization.use_logo_in_header}
                    onCheckedChange={(checked) => setCustomization(prev => ({
                      ...prev,
                      use_logo_in_header: checked
                    }))}
                  />
                  <Label htmlFor="use-logo">
                    Usar logo no cabeçalho em vez do nome da loja
                  </Label>
                </div>

                <div>
                  <Label>Cor Primária</Label>
                  <div className="flex items-center gap-3 mt-2">
                    <Input
                      type="color"
                      value={customization?.primary_color || "#3B82F6"}
                      onChange={(e) => setCustomization(prev => ({
                        ...prev,
                        primary_color: e.target.value
                      }))}
                      className="w-16 h-10"
                    />
                    <Input
                      type="text"
                      value={customization?.primary_color || "#3B82F6"}
                      onChange={(e) => setCustomization(prev => ({
                        ...prev,
                        primary_color: e.target.value
                      }))}
                      className="w-32"
                    />
                  </div>
                </div>

                <div>
                  <Label>Cor Secundária</Label>
                  <div className="flex items-center gap-3 mt-2">
                    <Input
                      type="color"
                      value={customization?.secondary_color || "#1E40AF"}
                      onChange={(e) => setCustomization(prev => ({
                        ...prev,
                        secondary_color: e.target.value
                      }))}
                      className="w-16 h-10"
                    />
                    <Input
                      type="text"
                      value={customization?.secondary_color || "#1E40AF"}
                      onChange={(e) => setCustomization(prev => ({
                        ...prev,
                        secondary_color: e.target.value
                      }))}
                      className="w-32"
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="info">
          <Card>
            <CardHeader>
              <CardTitle>Informações da Empresa</CardTitle>
              <CardDescription>
                Edite os dados cadastrais e fiscais da sua empresa.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="settings_company_name">Nome Fantasia *</Label>
                <Input
                  id="settings_company_name"
                  name="company_name"
                  value={tenant?.company_name || ""}
                  onChange={handleTenantChange}
                  required
                />
              </div>
              
              <div>
                <Label htmlFor="settings_legal_name">Razão Social</Label>
                <Input
                  id="settings_legal_name"
                  name="legal_name"
                  value={tenant?.legal_name || ""}
                  onChange={handleTenantChange}
                />
              </div>
              
              <div>
                <Label>Tipo de Documento *</Label>
                <RadioGroup 
                  value={tenant?.document_type || "cnpj"} 
                  onValueChange={(newValue) => setTenant(prev => ({ ...prev, document_type: newValue }))}
                  className="flex space-x-4 mt-1"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="cpf" id="settings_cpf" />
                    <Label htmlFor="settings_cpf">CPF</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="cnpj" id="settings_cnpj" />
                    <Label htmlFor="settings_cnpj">CNPJ</Label>
                  </div>
                </RadioGroup>
              </div>
              
              <div>
                <Label htmlFor="settings_document">{tenant?.document_type === "cpf" ? "CPF" : "CNPJ"} *</Label>
                <Input
                  id="settings_document"
                  name="document"
                  value={tenant?.document || ""}
                  onChange={handleTenantChange}
                  placeholder={tenant?.document_type === "cpf" ? "000.000.000-00" : "00.000.000/0000-00"}
                  required
                />
              </div>
              
              <div>
                <Label htmlFor="settings_responsible_name">Nome do Responsável *</Label>
                <Input
                  id="settings_responsible_name"
                  name="responsible_name"
                  value={tenant?.responsible_name || ""}
                  onChange={handleTenantChange}
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="settings_email">Email (Contato Geral) *</Label>
                  <Input
                    id="settings_email"
                    name="email"
                    type="email"
                    value={tenant?.email || ""}
                    onChange={handleTenantChange}
                    required
                  />
                </div>
                
                <div>
                  <Label htmlFor="settings_phone">Telefone *</Label>
                  <Input
                    id="settings_phone"
                    name="phone"
                    value={tenant?.phone || ""}
                    onChange={handleTenantChange}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="settings_inscricao_estadual">Inscrição Estadual</Label>
                  <Input
                    id="settings_inscricao_estadual"
                    name="inscricao_estadual"
                    value={tenant?.inscricao_estadual || ""}
                    onChange={handleTenantChange}
                    placeholder="IE (apenas números ou ISENTO)"
                  />
                </div>
                <div>
                  <Label htmlFor="settings_inscricao_municipal">Inscrição Municipal</Label>
                  <Input
                    id="settings_inscricao_municipal"
                    name="inscricao_municipal"
                    value={tenant?.inscricao_municipal || ""}
                    onChange={handleTenantChange}
                    placeholder="IM (apenas números ou ISENTO)"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="settings_cnae_principal">CNAE Principal</Label>
                  <Input
                    id="settings_cnae_principal"
                    name="cnae_principal"
                    value={tenant?.cnae_principal || ""}
                    onChange={handleTenantChange}
                    placeholder="Ex: 4789004 (apenas números)"
                  />
                </div>
                <div>
                  <Label htmlFor="settings_regime_tributario">Regime Tributário</Label>
                  <Select
                    value={tenant?.regime_tributario || ""}
                    onValueChange={(newValue) => setTenant(prev => ({ ...prev, regime_tributario: newValue }))}
                  >
                    <SelectTrigger id="settings_regime_tributario">
                      <SelectValue placeholder="Selecione o regime" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="simples_nacional">Simples Nacional</SelectItem>
                      <SelectItem value="simples_nacional_excesso">Simples Nacional - excesso de sublimite</SelectItem>
                      <SelectItem value="lucro_presumido">Lucro Presumido</SelectItem>
                      <SelectItem value="lucro_real">Lucro Real</SelectItem>
                      <SelectItem value="mei">MEI - Microempreendedor Individual</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <h3 className="text-lg font-medium pt-4 border-t mt-6 mb-2">Endereço Fiscal</h3>
              <AddressForm 
                 address={tenant?.address || {}}
                 onAddressChange={handleTenantAddressChange}
                 searchCepFunction={searchAddressByCepInSettings}
                 isLoadingCep={isSearchingCep}
                 className="pt-2"
              />

              <div className="pt-6 border-t mt-6">
                <Label className="text-lg font-medium">Redes Sociais</Label>
                <div className="space-y-2 mt-2">
                  <Input
                    value={customization?.company_info?.social_media?.facebook || ""}
                    onChange={(e) => setCustomization(prev => ({
                      ...prev,
                      company_info: {
                        ...prev.company_info,
                        social_media: {
                          ...prev.company_info?.social_media,
                          facebook: e.target.value
                        }
                      }
                    }))}
                    placeholder="Facebook URL"
                  />
                  <Input
                    value={customization?.company_info?.social_media?.instagram || ""}
                    onChange={(e) => setCustomization(prev => ({
                      ...prev,
                      company_info: {
                        ...prev.company_info,
                        social_media: {
                          ...prev.company_info?.social_media,
                          instagram: e.target.value
                        }
                      }
                    }))}
                    placeholder="Instagram URL"
                  />
                  <Input
                    value={customization?.company_info?.social_media?.whatsapp || ""}
                    onChange={(e) => setCustomization(prev => ({
                      ...prev,
                      company_info: {
                        ...prev.company_info,
                        social_media: {
                          ...prev.company_info?.social_media,
                          whatsapp: e.target.value
                        }
                      }
                    }))}
                    placeholder="WhatsApp (com DDD)"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="preferences">
          <Card>
            <CardHeader>
              <CardTitle>Preferências do Sistema</CardTitle>
              <CardDescription>
                Configure as preferências gerais do seu sistema
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-sm">
                Mais opções de configuração serão adicionadas em breve...
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="hours">
          <Card>
            <CardHeader>
              <CardTitle>Horários de Atendimento</CardTitle>
              <CardDescription>
                Defina os horários de funcionamento e dias em que a clínica está aberta.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {[ 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday' ].map((day) => {
                const dayLabels = {
                  monday: 'Segunda-feira',
                  tuesday: 'Terça-feira',
                  wednesday: 'Quarta-feira',
                  thursday: 'Quinta-feira',
                  friday: 'Sexta-feira',
                  saturday: 'Sábado',
                  sunday: 'Domingo'
                };
                const dayData = customization.operating_hours?.[day] || { enabled: false, start: '08:00', end: '18:00' };

                const handleTimeChange = (e, field) => {
                  const { value } = e.target;
                  setCustomization(prev => ({
                    ...prev,
                    operating_hours: {
                      ...prev.operating_hours,
                      [day]: { ...prev.operating_hours[day], [field]: value }
                    }
                  }));
                };

                const handleEnabledChange = (checked) => {
                  setCustomization(prev => ({
                    ...prev,
                    operating_hours: {
                      ...prev.operating_hours,
                      [day]: { ...prev.operating_hours[day], enabled: checked }
                    }
                  }));
                };

                return (
                  <div key={day} className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-3 border rounded-md bg-gray-50/50">
                    <div className="flex items-center gap-3 flex-1 min-w-[150px]">
                      <Switch
                        id={`enabled-${day}`}
                        checked={dayData.enabled}
                        onCheckedChange={handleEnabledChange}
                      />
                      <Label htmlFor={`enabled-${day}`} className="font-medium">
                        {dayLabels[day]}
                      </Label>
                    </div>
                    <div className="flex items-center gap-3 flex-wrap">
                      <div className="flex items-center gap-2">
                        <Label htmlFor={`start-${day}`} className="text-sm text-muted-foreground">Início</Label>
                        <Input
                          id={`start-${day}`}
                          type="time"
                          value={dayData.start}
                          onChange={(e) => handleTimeChange(e, 'start')}
                          disabled={!dayData.enabled}
                          className="w-28"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <Label htmlFor={`end-${day}`} className="text-sm text-muted-foreground">Fim</Label>
                        <Input
                          id={`end-${day}`}
                          type="time"
                          value={dayData.end}
                          onChange={(e) => handleTimeChange(e, 'end')}
                          disabled={!dayData.enabled}
                          className="w-28"
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="messaging">
          <Card>
            <CardHeader>
              <CardTitle>Mensagens Automáticas (WhatsApp)</CardTitle>
              <CardDescription>
                Configure o envio automático de confirmações e os modelos de mensagem.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center space-x-2">
                  <Switch
                    id="auto-send-confirmation"
                    checked={customization.messaging_settings?.auto_send_confirmation || false}
                    onCheckedChange={(checked) => setCustomization(prev => ({
                      ...prev,
                      messaging_settings: { ...prev.messaging_settings, auto_send_confirmation: checked }
                    }))}
                  />
                  <Label htmlFor="auto-send-confirmation">
                    Habilitar envio automático de mensagem de confirmação
                  </Label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
                <Label htmlFor="send-before-hours">Enviar automaticamente</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="send-before-hours"
                    type="number"
                    min="1"
                    value={customization.messaging_settings?.send_before_hours || 24}
                    onChange={(e) => setCustomization(prev => ({
                      ...prev,
                      messaging_settings: { ...prev.messaging_settings, send_before_hours: parseInt(e.target.value) || 1 }
                    }))}
                    disabled={!customization.messaging_settings?.auto_send_confirmation}
                    className="w-20"
                  />
                  <span>horas antes do agendamento</span>
                </div>
              </div>

              <div className="flex items-center space-x-2 pt-4 border-t">
                  <Switch
                    id="retry-enabled"
                    checked={customization.messaging_settings?.retry_enabled || false}
                    onCheckedChange={(checked) => setCustomization(prev => ({
                      ...prev,
                      messaging_settings: { ...prev.messaging_settings, retry_enabled: checked }
                    }))}
                    disabled={!customization.messaging_settings?.auto_send_confirmation}
                  />
                  <Label htmlFor="retry-enabled">
                    Reenviar mensagem se não houver resposta
                  </Label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
                 <Label htmlFor="retry-after-hours">Repetir após</Label>
                 <div className="flex items-center gap-2">
                   <Input
                    id="retry-after-hours"
                    type="number"
                    min="1"
                    value={customization.messaging_settings?.retry_after_hours || 4}
                    onChange={(e) => setCustomization(prev => ({
                      ...prev,
                      messaging_settings: { ...prev.messaging_settings, retry_after_hours: parseInt(e.target.value) || 1 }
                    }))}
                    disabled={!customization.messaging_settings?.auto_send_confirmation || !customization.messaging_settings?.retry_enabled}
                    className="w-20"
                  />
                  <span>horas sem resposta</span>
                 </div>
              </div>

              <div className="pt-6 border-t">
                <Label className="text-lg font-semibold">Cancelamento Automático</Label>
                <p className="text-sm text-muted-foreground mb-4">Cancele automaticamente agendamentos que não foram confirmados pelo cliente.</p>

                <div className="flex items-center space-x-2 mb-4">
                  <Switch
                    id="enable-auto-cancel"
                    checked={customization.messaging_settings?.enable_auto_cancel || false}
                    onCheckedChange={(checked) => setCustomization(prev => ({
                      ...prev,
                      messaging_settings: { ...prev.messaging_settings, enable_auto_cancel: checked }
                    }))}
                  />
                  <Label htmlFor="enable-auto-cancel">
                    Habilitar cancelamento automático por falta de confirmação
                  </Label>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center mb-4">
                  <Label htmlFor="cancel-before-hours">Cancelar automaticamente se não confirmado</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="cancel-before-hours"
                      type="number"
                      min="1"
                      value={customization.messaging_settings?.cancel_if_unconfirmed_hours_before || 3}
                      onChange={(e) => setCustomization(prev => ({
                        ...prev,
                        messaging_settings: { ...prev.messaging_settings, cancel_if_unconfirmed_hours_before: parseInt(e.target.value) || 1 }
                      }))}
                      disabled={!customization.messaging_settings?.enable_auto_cancel}
                      className="w-20"
                    />
                    <span>horas antes do horário agendado</span>
                  </div>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="template-auto-cancel">Mensagem de Cancelamento Automático</Label>
                   <p className="text-xs text-muted-foreground">
                    Variáveis disponíveis: <code>{'{cliente}'}</code>, <code>{'{clinica}'}</code>, <code>{'{pet}'}</code>, <code>{'{data_hora}'}</code>.
                  </p>
                  <Textarea
                    id="template-auto-cancel"
                    rows={3}
                    value={customization.messaging_settings?.template_auto_cancel_notification || ''}
                    onChange={(e) => setCustomization(prev => ({
                      ...prev,
                      messaging_settings: { ...prev.messaging_settings, template_auto_cancel_notification: e.target.value }
                    }))}
                    placeholder="Ex: Seu agendamento para {data_hora} foi cancelado por falta de confirmação..."
                    className="resize-y"
                    disabled={!customization.messaging_settings?.enable_auto_cancel}
                  />
                </div>
              </div>

              <div className="space-y-4 pt-4 border-t">
                  <Label className="font-semibold">Modelos de Mensagem</Label>
                  <p className="text-xs text-muted-foreground">
                    Variáveis disponíveis: <code>{'{cliente}'}</code>, <code>{'{clinica}'}</code>, <code>{'{pet}'}</code>, <code>{'{data_hora}'}</code>.
                  </p>
                  
                  <div className="space-y-1">
                    <Label htmlFor="template-confirmation">Mensagem de Confirmação Inicial</Label>
                    <Textarea
                      id="template-confirmation"
                      rows={4}
                      value={customization.messaging_settings?.template_confirmation || ''}
                      onChange={(e) => setCustomization(prev => ({
                        ...prev,
                        messaging_settings: { ...prev.messaging_settings, template_confirmation: e.target.value }
                      }))}
                      placeholder="Ex: Olá {cliente}, confirme seu agendamento... Responda SIM ou NÃO."
                      className="resize-y"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="template-confirmed-reply">Resposta Automática (Confirmado)</Label>
                    <Textarea
                      id="template-confirmed-reply"
                      rows={2}
                      value={customization.messaging_settings?.template_confirmed_reply || ''}
                      onChange={(e) => setCustomization(prev => ({
                        ...prev,
                        messaging_settings: { ...prev.messaging_settings, template_confirmed_reply: e.target.value }
                      }))}
                      placeholder="Ex: Obrigado por confirmar!"
                      className="resize-y"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="template-canceled-reply">Resposta Automática (Cancelado)</Label>
                    <Textarea
                      id="template-canceled-reply"
                      rows={2}
                      value={customization.messaging_settings?.template_canceled_reply || ''}
                      onChange={(e) => setCustomization(prev => ({
                        ...prev,
                        messaging_settings: { ...prev.messaging_settings, template_canceled_reply: e.target.value }
                      }))}
                      placeholder="Ex: Ok, agendamento cancelado."
                      className="resize-y"
                    />
                  </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
