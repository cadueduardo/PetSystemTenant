import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Tenant } from "@/api/entities";
import { Customization } from "@/api/entities";
import { User } from "@/api/entities";
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
  Palette,
  Layout,
  Sun,
  Moon
} from "lucide-react";

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
  const [customization, setCustomization] = useState({
    company_logo_url: "",
    primary_color: "#3B82F6",
    secondary_color: "#1E40AF",
    use_logo_in_header: false,
    company_info: {
      address: "",
      phone: "",
      email: "",
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
            customizationData = {
              ...customizationData,
              company_info: customizationData.company_info || {
                address: "",
                phone: "",
                email: "",
                social_media: {
                  facebook: "",
                  instagram: "",
                  whatsapp: ""
                }
              }
            };
            if (!customizationData.company_info.social_media) {
              customizationData.company_info.social_media = {
                facebook: "",
                instagram: "",
                whatsapp: ""
              };
            }
            setCustomization(customizationData);
            return true;
          }
          return false;
        } catch (error) {
          console.error("Erro ao carregar customização:", error);
          return false;
        }
      };
      
      const createNewCustomization = async (data) => {
        try {
          const newCustomization = await safeApiCall(Customization.create, data, null);
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
          
          await createNewCustomization({
            tenant_id: currentTenant.id,
            company_logo_url: "",
            primary_color: "#3B82F6",
            secondary_color: "#1E40AF",
            company_info: {
              address: "",
              phone: "",
              email: "",
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
            is_setup_complete: false
          });
        }
      } else {
        const tenantsData = await safeApiCall(() => Tenant.filter({ status: "active" }));

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
          
          await createNewCustomization({
            tenant_id: currentTenant.id,
            company_logo_url: "",
            primary_color: "#3B82F6",
            secondary_color: "#1E40AF",
            company_info: {
              address: "",
              phone: "",
              email: "",
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
            is_setup_complete: false
          });
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
    if (!customization.id) {
      toast({
        title: "Erro",
        description: "ID da customização não encontrado.",
        variant: "destructive"
      });
      return;
    }

    setIsSaving(true);
    try {
      const entityId = tenant?.id;
      
      const updatedCustomization = {
        ...customization,
        tenant_id: tenant?.id || null,
        company_logo_url: customization.company_logo_url || "",
        primary_color: customization.primary_color || "#3B82F6",
        secondary_color: customization.secondary_color || "#1E40AF",
        company_info: {
          address: customization.company_info?.address || "",
          phone: customization.company_info?.phone || "",
          email: customization.company_info?.email || "",
          social_media: {
            facebook: customization.company_info?.social_media?.facebook || "",
            instagram: customization.company_info?.social_media?.instagram || "",
            whatsapp: customization.company_info?.social_media?.whatsapp || ""
          }
        },
        layout_preferences: {
          show_hero: true,
          show_featured_products: true,
          show_categories: true,
          show_testimonials: true
        }
      };

      await fetchWithRetry(() => Customization.update(customization.id, updatedCustomization));

      if (tenant && tenant.id) {
        await fetchWithRetry(() => Tenant.update(tenant.id, {
          setup_status: "completed"
        }));
      }

      toast({
        title: "Sucesso",
        description: "Configurações salvas com sucesso!",
      });

      window.location.reload();

    } catch (error) {
      console.error("Erro ao salvar configurações:", error);
      toast({
        title: "Erro",
        description: "Não foi possível salvar as configurações. Por favor, tente novamente mais tarde.",
        variant: "destructive"
      });
    } finally {
      setIsSaving(false);
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
                Adicione os dados de contato da sua empresa
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Endereço</Label>
                <Input
                  value={customization?.company_info?.address || ""}
                  onChange={(e) => setCustomization(prev => ({
                    ...prev,
                    company_info: {
                      ...prev.company_info,
                      address: e.target.value
                    }
                  }))}
                  placeholder="Endereço completo"
                />
              </div>

              <div>
                <Label>Telefone</Label>
                <Input
                  value={customization?.company_info?.phone || ""}
                  onChange={(e) => setCustomization(prev => ({
                    ...prev,
                    company_info: {
                      ...prev.company_info,
                      phone: e.target.value
                    }
                  }))}
                  placeholder="(00) 0000-0000"
                />
              </div>

              <div>
                <Label>Email</Label>
                <Input
                  value={customization?.company_info?.email || ""}
                  onChange={(e) => setCustomization(prev => ({
                    ...prev,
                    company_info: {
                      ...prev.company_info,
                      email: e.target.value
                    }
                  }))}
                  placeholder="contato@empresa.com"
                />
              </div>

              <div>
                <Label>Redes Sociais</Label>
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
      </Tabs>
    </div>
  );
}
