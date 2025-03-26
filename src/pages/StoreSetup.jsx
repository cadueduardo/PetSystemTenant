
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Tenant } from "@/api/entities";
import { Customization } from "@/api/entities";
import { User } from "@/api/entities";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { toast } from "@/components/ui/use-toast";
import { UploadFile } from "@/api/integrations";
import { 
  Loader2, 
  Upload, 
  Palette, 
  Layout, 
  Building2, 
  Settings,
  ArrowRight,
  ArrowLeft,
  Check
} from "lucide-react";

export default function StoreSetup() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [step, setStep] = useState(1);
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

  const loadData = async () => {
    try {
      const tenantsData = await Tenant.filter({ status: "active" });
      if (tenantsData.length === 0) {
        navigate(createPageUrl("Contratar"));
        return;
      }

      const currentTenant = tenantsData[0];
      setTenant(currentTenant);

      let customizationData;
      const customizations = await Customization.filter({ trial_id: currentTenant.id });
      
      if (customizations.length > 0) {
        customizationData = customizations[0];
        
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
      } else {
        customizationData = await Customization.create({
          trial_id: currentTenant.id,
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

      setCustomization(customizationData);

    } catch (error) {
      console.error("Erro ao carregar dados:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os dados da loja.",
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
      
      const updatedCustomization = {
        ...customization,
        company_logo_url: file_url
      };
      setCustomization(updatedCustomization);

      if (customization.id) {
        await Customization.update(customization.id, updatedCustomization);
      }

    } catch (error) {
      console.error("Erro ao fazer upload do logo:", error);
      toast({
        title: "Erro",
        description: "Não foi possível fazer upload do logo.",
        variant: "destructive"
      });
    }
  };

  const handleComplete = async () => {
    try {
      if (!customization.id) {
        throw new Error("ID da customização não encontrado");
      }

      const updatedCustomization = {
        ...customization,
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

      await Customization.update(customization.id, updatedCustomization);

      if (tenant && tenant.id) {
        await Tenant.update(tenant.id, {
          setup_status: "completed"
        });
      }

      toast({
        title: "Configuração concluída!",
        description: "Sua loja foi configurada com sucesso."
      });

      navigate(createPageUrl("StoreDashboard"));
    } catch (error) {
      console.error("Erro ao finalizar configuração:", error);
      toast({
        title: "Erro",
        description: "Não foi possível finalizar a configuração. Verifique se todos os dados foram preenchidos corretamente.",
        variant: "destructive"
      });
    }
  };

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <div className="space-y-6">
            <div className="text-center mb-6">
              <h3 className="text-lg font-semibold">Logo e Cores</h3>
              <p className="text-gray-500">Configure a identidade visual da sua loja</p>
            </div>

            <div className="space-y-4">
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
            </div>

            <div className="flex justify-end">
              <Button onClick={() => setStep(2)}>
                Próximo
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-6">
            <div className="text-center mb-6">
              <h3 className="text-lg font-semibold">Layout da Loja</h3>
              <p className="text-gray-500">Escolha como sua loja será exibida</p>
            </div>

            <div className="space-y-4">
              {/* Adicionar opções de layout aqui */}
            </div>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(1)}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Anterior
              </Button>
              <Button onClick={() => setStep(3)}>
                Próximo
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-6">
            <div className="text-center mb-6">
              <h3 className="text-lg font-semibold">Informações da Empresa</h3>
              <p className="text-gray-500">Adicione os dados de contato da sua empresa</p>
            </div>

            <div className="space-y-4">
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
            </div>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(2)}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Anterior
              </Button>
              <Button onClick={() => setStep(4)}>
                Próximo
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        );

      case 4:
        return (
          <div className="space-y-6">
            <div className="text-center mb-6">
              <h3 className="text-lg font-semibold">Preferências do Sistema</h3>
              <p className="text-gray-500">Configure as preferências gerais do seu sistema</p>
            </div>

            <div className="space-y-4">
              {/* Adicionar configurações gerais aqui */}
            </div>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(3)}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Anterior
              </Button>
              <Button onClick={handleComplete} className="bg-green-600 hover:bg-green-700">
                Finalizar Configuração
                <Check className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        );
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle className="text-2xl text-center">
            Configuração da Loja
          </CardTitle>
          <Progress value={(step / 4) * 100} className="mt-4" />
        </CardHeader>
        <CardContent>
          {renderStep()}
        </CardContent>
      </Card>
    </div>
  );
}
