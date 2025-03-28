
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { User } from "@/api/entities";
import { Tenant } from "@/api/entities";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toast } from "@/components/ui/use-toast";
import {
  PawPrint,
  Stethoscope,
  ShoppingBag,
  DollarSign,
  Truck,
  Check,
  ArrowRight
} from "lucide-react";

export default function Contratar() {
  const navigate = useNavigate();

  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    company_name: "",
    legal_name: "",
    email: "",
    phone: "",
    business_type: "both",
    selected_modules: ["clinic_management", "petshop"],
    access_url: "",
    accept_terms: false
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [generatedUrl, setGeneratedUrl] = useState("");

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleModuleChange = (module) => {
    setFormData(prev => {
      const newModules = prev.selected_modules.includes(module)
        ? prev.selected_modules.filter(m => m !== module)
        : [...prev.selected_modules, module];
      
      return {
        ...prev,
        selected_modules: newModules
      };
    });
  };

  const handleBusinessTypeChange = (value) => {
    let newModules = [...formData.selected_modules];
    
    if (value === "clinic") {
      newModules = newModules.filter(m => m !== "petshop");
      if (!newModules.includes("clinic_management")) {
        newModules.push("clinic_management");
      }
    } else if (value === "petshop") {
      newModules = newModules.filter(m => m !== "clinic_management");
      if (!newModules.includes("petshop")) {
        newModules.push("petshop");
      }
    } else if (value === "both") {
      if (!newModules.includes("clinic_management")) {
        newModules.push("clinic_management");
      }
      if (!newModules.includes("petshop")) {
        newModules.push("petshop");
      }
    }
    
    setFormData(prev => ({
      ...prev,
      business_type: value,
      selected_modules: newModules
    }));
  };

  const generateUrl = () => {
    if (!formData.company_name) return "";
    
    let baseUrl = formData.company_name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]/g, "")
      .substring(0, 20);
    
    const uniqueString = Date.now().toString(36).substring(4, 8);
    return `${baseUrl}-${uniqueString}`;
  };

  const nextStep = () => {
    if (step === 1) {
      if (!formData.company_name || !formData.email || !formData.phone) {
        toast({
          title: "Campos obrigatórios",
          description: "Por favor, preencha todos os campos obrigatórios.",
          variant: "destructive"
        });
        return;
      }
      
      const url = generateUrl();
      setGeneratedUrl(url);
      setFormData(prev => ({ ...prev, access_url: url }));
    }
    
    if (step === 3 && !formData.accept_terms) {
      toast({
        title: "Termos de uso",
        description: "Você precisa aceitar os termos de uso para continuar.",
        variant: "destructive"
      });
      return;
    }
    
    setStep(prev => prev + 1);
  };

  const prevStep = () => {
    setStep(prev => prev - 1);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      const tenantData = {
        company_name: formData.company_name,
        legal_name: formData.legal_name || formData.company_name,
        email: formData.email,
        phone: formData.phone,
        business_type: formData.business_type,
        selected_modules: formData.selected_modules,
        access_url: formData.access_url,
        status: "active",
        setup_status: "pending"
      };
      
      const newTenant = await Tenant.create(tenantData);
      
      if (!newTenant || !newTenant.id) {
        throw new Error("Erro ao criar tenant");
      }
      
      await User.updateMyUserData({
        tenant_id: newTenant.id,
        role: "admin"
      });
      
      toast({
        title: "Sucesso!",
        description: "Sua loja foi criada com sucesso!",
      });
      
      setTimeout(() => {
        navigate(createPageUrl(`Dashboard?store=${formData.access_url}`));
      }, 1500);
    } catch (error) {
      console.error("Erro ao criar tenant:", error);
      toast({
        title: "Erro",
        description: "Não foi possível criar sua loja. Tente novamente.",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderStep = () => {
    switch(step) {
      case 1:
        return (
          <>
            <CardHeader>
              <CardTitle className="text-2xl font-bold text-center">Dados da Empresa</CardTitle>
              <CardDescription className="text-center">
                Informe os dados básicos da sua empresa
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="company_name">Nome da Empresa *</Label>
                  <Input
                    id="company_name"
                    name="company_name"
                    placeholder="Pet Shop Exemplo"
                    value={formData.company_name}
                    onChange={handleChange}
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="legal_name">Razão Social</Label>
                  <Input
                    id="legal_name"
                    name="legal_name"
                    placeholder="Exemplo Ltda"
                    value={formData.legal_name}
                    onChange={handleChange}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="contato@exemplo.com"
                    value={formData.email}
                    onChange={handleChange}
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="phone">Telefone *</Label>
                  <Input
                    id="phone"
                    name="phone"
                    placeholder="(11) 99999-9999"
                    value={formData.phone}
                    onChange={handleChange}
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <Label>Tipo de Negócio *</Label>
                  <RadioGroup 
                    value={formData.business_type} 
                    onValueChange={handleBusinessTypeChange}
                    className="flex flex-col space-y-1"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="clinic" id="option-clinic" />
                      <Label htmlFor="option-clinic" className="cursor-pointer">Clínica Veterinária</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="petshop" id="option-petshop" />
                      <Label htmlFor="option-petshop" className="cursor-pointer">Pet Shop</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="both" id="option-both" />
                      <Label htmlFor="option-both" className="cursor-pointer">Ambos</Label>
                    </div>
                  </RadioGroup>
                </div>
              </div>
            </CardContent>
            <CardFooter>
              <Button 
                onClick={nextStep} 
                className="w-full"
              >
                Próximo
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </CardFooter>
          </>
        );
        
      case 2:
        return (
          <>
            <CardHeader>
              <CardTitle className="text-2xl font-bold text-center">Escolha os Módulos</CardTitle>
              <CardDescription className="text-center">
                Selecione os módulos que deseja utilizar
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {formData.business_type === 'clinic' || formData.business_type === 'both' ? (
                  <div className="flex items-start space-x-3 p-4 rounded-lg border hover:bg-gray-50">
                    <Checkbox 
                      id="module-clinic" 
                      checked={formData.selected_modules.includes('clinic_management')}
                      onCheckedChange={() => handleModuleChange('clinic_management')}
                      disabled
                    />
                    <div className="space-y-1">
                      <div className="flex items-center">
                        <Stethoscope className="h-5 w-5 text-blue-600 mr-2" />
                        <Label 
                          htmlFor="module-clinic" 
                          className="font-medium cursor-pointer"
                        >
                          Gestão Clínica Veterinária
                        </Label>
                      </div>
                      <p className="text-sm text-gray-500">
                        Gerenciamento de pacientes, prontuários, exames e histórico médico
                      </p>
                    </div>
                  </div>
                ) : null}
                
                {formData.business_type === 'petshop' || formData.business_type === 'both' ? (
                  <div className="flex items-start space-x-3 p-4 rounded-lg border hover:bg-gray-50">
                    <Checkbox 
                      id="module-petshop" 
                      checked={formData.selected_modules.includes('petshop')}
                      onCheckedChange={() => handleModuleChange('petshop')}
                      disabled
                    />
                    <div className="space-y-1">
                      <div className="flex items-center">
                        <ShoppingBag className="h-5 w-5 text-blue-600 mr-2" />
                        <Label 
                          htmlFor="module-petshop" 
                          className="font-medium cursor-pointer"
                        >
                          Pet Shop
                        </Label>
                      </div>
                      <p className="text-sm text-gray-500">
                        Gestão de estoque, vendas, serviços de banho e tosa
                      </p>
                    </div>
                  </div>
                ) : null}
                
                <div className="flex items-start space-x-3 p-4 rounded-lg border hover:bg-gray-50">
                  <Checkbox 
                    id="module-financial" 
                    checked={formData.selected_modules.includes('financial')}
                    onCheckedChange={() => handleModuleChange('financial')}
                  />
                  <div className="space-y-1">
                    <div className="flex items-center">
                      <DollarSign className="h-5 w-5 text-blue-600 mr-2" />
                      <Label 
                        htmlFor="module-financial" 
                        className="font-medium cursor-pointer"
                      >
                        Financeiro
                      </Label>
                    </div>
                    <p className="text-sm text-gray-500">
                      Controle financeiro, contas a pagar e receber, fluxo de caixa
                    </p>
                  </div>
                </div>
                
                <div className="flex items-start space-x-3 p-4 rounded-lg border hover:bg-gray-50">
                  <Checkbox 
                    id="module-transport" 
                    checked={formData.selected_modules.includes('transport')}
                    onCheckedChange={() => handleModuleChange('transport')}
                  />
                  <div className="space-y-1">
                    <div className="flex items-center">
                      <Truck className="h-5 w-5 text-blue-600 mr-2" />
                      <Label 
                        htmlFor="module-transport" 
                        className="font-medium cursor-pointer"
                      >
                        Leva e Traz
                      </Label>
                    </div>
                    <p className="text-sm text-gray-500">
                      Serviço de transporte de pets, agendamento e rotas
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex justify-between">
              <Button 
                variant="outline" 
                onClick={prevStep}
              >
                Voltar
              </Button>
              <Button 
                onClick={nextStep}
              >
                Próximo
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </CardFooter>
          </>
        );
        
      case 3:
        return (
          <>
            <CardHeader>
              <CardTitle className="text-2xl font-bold text-center">URL e Termos</CardTitle>
              <CardDescription className="text-center">
                Configure sua URL personalizada e aceite os termos
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="access_url">URL Personalizada</Label>
                  <div className="flex items-center">
                    <span className="bg-gray-100 px-3 py-2 rounded-l-md text-gray-500 border border-r-0">
                      petmanager.com/
                    </span>
                    <Input
                      id="access_url"
                      name="access_url"
                      className="rounded-l-none"
                      value={formData.access_url}
                      onChange={handleChange}
                      required
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Esta será a URL de acesso à sua loja
                  </p>
                </div>
                
                <div className="p-4 bg-blue-50 rounded-lg">
                  <h3 className="font-medium text-blue-800 mb-2">Resumo do Plano</h3>
                  <ul className="space-y-2">
                    <li className="flex items-center">
                      <Check className="h-4 w-4 text-green-600 mr-2" />
                      <span className="text-sm text-blue-700">Tipo de Negócio: {formData.business_type === 'both' ? 'Clínica e Pet Shop' : formData.business_type === 'clinic' ? 'Clínica Veterinária' : 'Pet Shop'}</span>
                    </li>
                    <li className="flex items-center">
                      <Check className="h-4 w-4 text-green-600 mr-2" />
                      <span className="text-sm text-blue-700">Módulos: {formData.selected_modules.length}</span>
                    </li>
                    <li className="flex items-center">
                      <Check className="h-4 w-4 text-green-600 mr-2" />
                      <span className="text-sm text-blue-700">Usuários: 5 inclusos</span>
                    </li>
                  </ul>
                </div>
                
                <div className="flex items-start space-x-2">
                  <Checkbox 
                    id="accept_terms" 
                    name="accept_terms"
                    checked={formData.accept_terms}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, accept_terms: checked }))}
                  />
                  <div>
                    <Label 
                      htmlFor="accept_terms" 
                      className="cursor-pointer text-sm"
                    >
                      Concordo com os <span className="text-blue-600 underline">Termos de Uso</span> e <span className="text-blue-600 underline">Política de Privacidade</span>
                    </Label>
                    <p className="text-xs text-gray-500 mt-1">
                      Ao criar sua conta, você concorda em receber atualizações por email
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex justify-between">
              <Button 
                variant="outline" 
                onClick={prevStep}
              >
                Voltar
              </Button>
              <Button 
                onClick={handleSubmit}
                disabled={isSubmitting || !formData.accept_terms}
              >
                {isSubmitting ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-3 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Processando...
                  </>
                ) : (
                  <>
                    Criar Minha Loja
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            </CardFooter>
          </>
        );
        
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 py-12 px-4">
      <div className="max-w-5xl mx-auto mb-8 text-center">
        <div className="flex justify-center mb-4">
          <div className="p-3 bg-blue-100 rounded-full">
            <PawPrint className="h-8 w-8 text-blue-600" />
          </div>
        </div>
        <h1 className="text-3xl font-bold mb-2">Contrate o PetManager</h1>
        <p className="text-gray-600 max-w-xl mx-auto">
          Comece a usar hoje mesmo nossa plataforma completa para gerenciamento de clínicas veterinárias e pet shops
        </p>
      </div>
      
      <div className="max-w-md mx-auto mb-12">
        <div className="flex justify-between items-center mb-8">
          <div className={`flex flex-col items-center ${step >= 1 ? 'text-blue-600' : 'text-gray-400'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center mb-2 ${step >= 1 ? 'bg-blue-100' : 'bg-gray-100'}`}>
              <span className={`text-sm font-medium ${step >= 1 ? 'text-blue-600' : 'text-gray-400'}`}>1</span>
            </div>
            <span className="text-xs">Dados</span>
          </div>
          
          <div className={`flex-1 h-px mx-2 ${step >= 2 ? 'bg-blue-300' : 'bg-gray-200'}`}></div>
          
          <div className={`flex flex-col items-center ${step >= 2 ? 'text-blue-600' : 'text-gray-400'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center mb-2 ${step >= 2 ? 'bg-blue-100' : 'bg-gray-100'}`}>
              <span className={`text-sm font-medium ${step >= 2 ? 'text-blue-600' : 'text-gray-400'}`}>2</span>
            </div>
            <span className="text-xs">Módulos</span>
          </div>
          
          <div className={`flex-1 h-px mx-2 ${step >= 3 ? 'bg-blue-300' : 'bg-gray-200'}`}></div>
          
          <div className={`flex flex-col items-center ${step >= 3 ? 'text-blue-600' : 'text-gray-400'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center mb-2 ${step >= 3 ? 'bg-blue-100' : 'bg-gray-100'}`}>
              <span className={`text-sm font-medium ${step >= 3 ? 'text-blue-600' : 'text-gray-400'}`}>3</span>
            </div>
            <span className="text-xs">Finalizar</span>
          </div>
        </div>
        
        <Card className="w-full shadow-lg">
          {renderStep()}
        </Card>
      </div>
    </div>
  );
}
