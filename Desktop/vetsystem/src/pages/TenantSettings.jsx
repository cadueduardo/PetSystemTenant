
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
import { toast } from "@/components/ui/use-toast";
import { UploadFile } from "@/api/integrations";
import { 
  Loader2, 
  Upload, 
  Building2, 
  Settings as SettingsIcon,
  Save,
  Image,
  ArrowLeft
} from "lucide-react";

export default function TenantSettings() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("visual");
  const [tenant, setTenant] = useState(null);
  const [customization, setCustomization] = useState({
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
    
    throw lastError;
  };

  const loadData = async () => {
    try {
      setIsLoading(true);
      
      const urlParams = new URLSearchParams(window.location.search);
      const storeParam = urlParams.get('store');
      
      console.log("TenantSettings - Parâmetro de loja:", storeParam);
      
      if (storeParam) {
        let currentTenant;
        try {
          const tenantsData = await fetchWithRetry(
            () => Tenant.filter({ access_url: storeParam, status: "active" })
          );
          
          if (tenantsData.length === 0) {
            console.error("Tenant não encontrado com access_url:", storeParam);
            toast({
              title: "Erro",
              description: "Loja não encontrada. Verifique o URL.",
              variant: "destructive"
            });
            navigate(createPageUrl("Contratar"));
            return;
          }
          
          currentTenant = tenantsData[0];
          console.log("TenantSettings - Tenant encontrado:", currentTenant);
          setTenant(currentTenant);
        } catch (error) {
          console.error("Erro fatal ao buscar tenant:", error);
          toast({
            title: "Erro",
            description: "Não foi possível carregar os dados da loja.",
            variant: "destructive"
          });
          navigate(createPageUrl("Contratar"));
          return;
        }

        await new Promise(resolve => setTimeout(resolve, 1000));

        try {
          const customizations = await fetchWithRetry(
            () => Customization.filter({ tenant_id: currentTenant.id })
          );
          
          if (customizations.length > 0) {
            let customizationData = customizations[0];
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
          } else {
            try {
              await new Promise(resolve => setTimeout(resolve, 500));
              
              const newCustomization = await fetchWithRetry(() => 
                Customization.create({
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
                })
              );
              
              setCustomization(newCustomization);
            } catch (createError) {
              console.error("Erro ao criar customização:", createError);
              toast({
                title: "Aviso",
                description: "Usando configurações padrão. Algumas opções poderão não ser salvas.",
                variant: "warning"
              });
            }
          }
        } catch (error) {
          console.error("Erro ao carregar customização:", error);
          toast({
            title: "Aviso",
            description: "Não foi possível carregar as configurações personalizadas. Usando configurações padrão.",
            variant: "warning"
          });
        }
      } else {
        try {
          const tenantsData = await fetchWithRetry(
            () => Tenant.filter({ status: "active" })
          );
          
          if (tenantsData.length === 0) {
            console.error("Nenhum tenant ativo encontrado");
            navigate(createPageUrl("Contratar"));
            return;
          }
          
          const currentTenant = tenantsData[0];
          console.log("TenantSettings - Primeiro tenant ativo:", currentTenant);
          setTenant(currentTenant);
          
          if (currentTenant.access_url) {
            const redirectUrl = createPageUrl(`TenantSettings?store=${currentTenant.access_url}`);
            console.log("TenantSettings - Redirecionando para URL com store:", redirectUrl);
            navigate(redirectUrl);
            return;
          }

          await new Promise(resolve => setTimeout(resolve, 1000));
          
          try {
            const customizations = await fetchWithRetry(
              () => Customization.filter({ tenant_id: currentTenant.id })
            );
            
            if (customizations.length > 0) {
              setCustomization({
                ...customizations[0],
                company_info: customizations[0].company_info || {
                  address: "",
                  phone: "",
                  email: "",
                  social_media: {
                    facebook: "",
                    instagram: "",
                    whatsapp: ""
                  }
                }
              });
            } else {
              await new Promise(resolve => setTimeout(resolve, 500));
              
              const newCustomization = await fetchWithRetry(() => 
                Customization.create({
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
                })
              );
              
              setCustomization(newCustomization);
            }
          } catch (customizationError) {
            console.error("Erro ao gerenciar customização:", customizationError);
          }
        } catch (error) {
          console.error("Erro ao carregar tenants:", error);
          navigate(createPageUrl("Contratar"));
          return;
        }
      }
    } catch (error) {
      console.error("Erro geral ao carregar dados:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar as configurações.",
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
    setIsSaving(true);
    try {
      console.log("Salvando configurações de customização");
      
      if (!tenant || !tenant.id) {
        throw new Error("Dados da loja não encontrados");
      }
      
      const updatedCustomizationData = {
        ...customization,
        tenant_id: tenant.id,
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
        },
        is_setup_complete: true
      };

      if (customization.id) {
        await fetchWithRetry(() => 
          Customization.update(customization.id, updatedCustomizationData)
        );
        console.log("Customização atualizada com sucesso");
      } else {
        await fetchWithRetry(() => 
          Customization.create(updatedCustomizationData)
        );
        console.log("Customização criada com sucesso");
      }

      await fetchWithRetry(() => 
        Tenant.update(tenant.id, { setup_status: "completed" })
      );
      console.log("Tenant atualizado com sucesso");

      toast({
        title: "Sucesso",
        description: "Configurações salvas com sucesso!",
      });

      if (tenant.access_url) {
        navigate(createPageUrl(`Dashboard?store=${tenant.access_url}`));
      } else {
        navigate(createPageUrl("Dashboard"));
      }
    } catch (error) {
      console.error("Erro ao salvar configurações:", error);
      toast({
        title: "Erro",
        description: "Não foi possível salvar as configurações: " + (error.message || "Erro desconhecido"),
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
          <div className="flex items-center gap-2">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => navigate(createPageUrl(`Dashboard${tenant?.access_url ? `?store=${tenant.access_url}` : ''}`)) }
              className="p-0 mr-2"
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              Voltar
            </Button>
            <h1 className="text-2xl font-bold">Configurações da Loja</h1>
          </div>
          <p className="text-gray-500 mt-1">{tenant?.company_name}</p>
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
              <div>
                <Label>Logo da Empresa</Label>
                <div className="mt-2 flex items-center gap-4">
                  {customization?.company_logo_url ? (
                    <img 
                      src={customization.company_logo_url} 
                      alt="Logo" 
                      className="h-16 w-16 object-contain"
                    />
                  ) : (
                    <div className="h-16 w-16 bg-gray-100 rounded-lg flex items-center justify-center">
                      <Building2 className="h-8 w-8 text-gray-400" />
                    </div>
                  )}
                  <Button variant="outline" onClick={() => document.getElementById('logo-upload').click()}>
                    <Upload className="w-4 h-4 mr-2" />
                    Upload Logo
                  </Button>
                  <input
                    id="logo-upload"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleLogoUpload}
                  />
                </div>
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
