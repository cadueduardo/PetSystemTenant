
import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Loader2, 
  CreditCard, 
  Building, 
  User, 
  MapPin,
  DollarSign,
  Package,
  CheckCircle2
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

export default function TenantForm({ open, onOpenChange, tenant, onSuccess }) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSearchingCep, setIsSearchingCep] = useState(false);
  const [activeTab, setActiveTab] = useState("company");
  
  const [formData, setFormData] = useState({
    company_name: "",
    legal_name: "",
    document_type: "cnpj",
    document: "",
    responsible_name: "",
    email: "",
    phone: "",
    address: {
      cep: "",
      street: "",
      number: "",
      complement: "",
      neighborhood: "",
      city: "",
      state: ""
    },
    business_type: "both",
    selected_modules: ["clinic_management", "petshop"],
    access_url: "",
    status: "active",
    subscription_tier: "basic",
    payment_plan: "monthly",
    payment_method: "credit_card",
    card_info: {
      number: "",
      holder_name: "",
      expiry: "",
      cvv: ""
    }
  });

  useEffect(() => {
    if (tenant) {
      setFormData({
        company_name: tenant.company_name || "",
        legal_name: tenant.legal_name || "",
        document_type: tenant.document_type || "cnpj",
        document: tenant.document || "",
        responsible_name: tenant.responsible_name || "",
        email: tenant.email || "",
        phone: tenant.phone || "",
        address: tenant.address || {
          cep: "",
          street: "",
          number: "",
          complement: "",
          neighborhood: "",
          city: "",
          state: ""
        },
        business_type: tenant.business_type || "both",
        selected_modules: tenant.selected_modules || ["clinic_management", "petshop"],
        access_url: tenant.access_url || "",
        status: tenant.status || "active",
        subscription_tier: tenant.subscription_tier || "basic",
        payment_plan: tenant.payment_plan || "monthly",
        payment_method: tenant.payment_method || "credit_card",
        card_info: tenant.card_info || {
          number: "",
          holder_name: "",
          expiry: "",
          cvv: ""
        }
      });
    } else {
      setFormData({
        company_name: "",
        legal_name: "",
        document_type: "cnpj",
        document: "",
        responsible_name: "",
        email: "",
        phone: "",
        address: {
          cep: "",
          street: "",
          number: "",
          complement: "",
          neighborhood: "",
          city: "",
          state: ""
        },
        business_type: "both",
        selected_modules: ["clinic_management", "petshop"],
        access_url: "",
        status: "active",
        subscription_tier: "basic",
        payment_plan: "monthly",
        payment_method: "credit_card",
        card_info: {
          number: "",
          holder_name: "",
          expiry: "",
          cvv: ""
        }
      });
    }
  }, [tenant]);

  const formatAccessUrl = (name) => {
    return name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
  };

  const generateUrl = () => {
    if (!formData.company_name) return "";
    
    let baseUrl = formData.company_name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]/g, "")
      .substring(0, 20);
    
    return baseUrl;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      if (!formData.access_url || formData.access_url.trim() === "") {
        formData.access_url = generateUrl();
      }
      
      let tenants = [];
      const tenantsStr = localStorage.getItem('admin_tenants');
      if (tenantsStr) {
        tenants = JSON.parse(tenantsStr);
      }

      const newTenant = {
        ...formData,
        id: tenant?.id || Date.now().toString(),
        created_date: tenant?.created_date || new Date().toISOString()
      };
      
      if (tenant) {
        const index = tenants.findIndex(t => t.id === tenant.id);
        if (index !== -1) {
          tenants[index] = newTenant;
        }
      } else {
        tenants.unshift(newTenant);
      }
      
      localStorage.setItem('admin_tenants', JSON.stringify(tenants));
      
      const persistentTenants = JSON.parse(localStorage.getItem('persistent_tenants') || '[]');
      if (tenant) {
        const index = persistentTenants.findIndex(t => t.id === tenant.id);
        if (index !== -1) {
          persistentTenants[index] = newTenant;
        } else {
          persistentTenants.unshift(newTenant);
        }
      } else {
        persistentTenants.unshift(newTenant);
      }
      localStorage.setItem('persistent_tenants', JSON.stringify(persistentTenants));
      
      onSuccess(newTenant, !tenant);
      setIsSubmitting(false);
    } catch (error) {
      console.error("Erro ao processar tenant:", error);
      setIsSubmitting(false);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    
    if (name === "company_name") {
      setFormData(prev => ({
        ...prev,
        [name]: value,
        access_url: formatAccessUrl(value)
      }));
    } else {
      if (name.includes('.')) {
        const [objectName, fieldName] = name.split('.');
        setFormData(prev => ({
          ...prev,
          [objectName]: {
            ...prev[objectName],
            [fieldName]: type === 'checkbox' ? checked : value
          }
        }));
      } else {
        setFormData(prev => ({
          ...prev,
          [name]: type === 'checkbox' ? checked : value
        }));
      }
    }
  };

  const handleAddressChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      address: {
        ...prev.address,
        [name]: value
      }
    }));
    
    if (name === 'cep' && value.length === 8) {
      searchAddressByCep(value);
    }
  };
  
  const handleCardInfoChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      card_info: {
        ...prev.card_info,
        [name]: value
      }
    }));
  };

  const searchAddressByCep = async (cep) => {
    if (cep.length !== 8) return;
    
    setIsSearchingCep(true);
    
    try {
      const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const data = await response.json();
      
      if (!data.erro) {
        setFormData(prev => ({
          ...prev,
          address: {
            ...prev.address,
            cep: cep,
            street: data.logradouro,
            neighborhood: data.bairro,
            city: data.localidade,
            state: data.uf
          }
        }));
      }
      
      setIsSearchingCep(false);
    } catch (error) {
      console.error("Erro ao buscar CEP:", error);
      setIsSearchingCep(false);
    }
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

  const validateCPF = (cpf) => {
    return cpf.length === 11;
  };
  
  const validateCNPJ = (cnpj) => {
    return cnpj.length === 14;
  };
  
  const getTierDetails = (tier) => {
    switch(tier) {
      case "basic":
        return {
          name: "Básico",
          price: { monthly: 99, quarterly: 89, annual: 79 },
          features: ["Até 5 usuários", "Suporte por email", "Armazenamento básico"]
        };
      case "professional":
        return {
          name: "Profissional",
          price: { monthly: 199, quarterly: 179, annual: 159 },
          features: ["Até 15 usuários", "Suporte prioritário", "Armazenamento ampliado", "Relatórios avançados"]
        };
      case "enterprise":
        return {
          name: "Empresarial",
          price: { monthly: 299, quarterly: 269, annual: 239 },
          features: ["Usuários ilimitados", "Suporte 24/7", "Armazenamento ilimitado", "API completa", "Customização total"]
        };
      default:
        return { name: "", price: { monthly: 0, quarterly: 0, annual: 0 }, features: [] };
    }
  };
  
  const calculatePrice = () => {
    const tierDetails = getTierDetails(formData.subscription_tier);
    return tierDetails.price[formData.payment_plan];
  };
  
  const formatDocumentPlaceholder = () => {
    return formData.document_type === "cpf" ? "000.000.000-00" : "00.000.000/0000-00";
  };
  
  const nextTab = () => {
    if (activeTab === "company") setActiveTab("modules");
    else if (activeTab === "modules") setActiveTab("address");
    else if (activeTab === "address") setActiveTab("subscription");
    else if (activeTab === "subscription") setActiveTab("payment");
  };
  
  const prevTab = () => {
    if (activeTab === "payment") setActiveTab("subscription");
    else if (activeTab === "subscription") setActiveTab("address");
    else if (activeTab === "address") setActiveTab("modules");
    else if (activeTab === "modules") setActiveTab("company");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[800px] max-h-[90vh]">
        <ScrollArea className="h-[80vh] pr-4">
          <DialogHeader>
            <DialogTitle>{tenant ? "Editar Tenant" : "Novo Tenant"}</DialogTitle>
            <DialogDescription>
              {tenant
                ? "Edite os dados do tenant existente."
                : "Preencha os dados para criar um novo tenant."}
            </DialogDescription>
          </DialogHeader>
          
          <form onSubmit={handleSubmit} className="mt-4">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid grid-cols-5 mb-6">
                <TabsTrigger value="company">Empresa</TabsTrigger>
                <TabsTrigger value="modules">Módulos</TabsTrigger>
                <TabsTrigger value="address">Endereço</TabsTrigger>
                <TabsTrigger value="subscription">Plano</TabsTrigger>
                <TabsTrigger value="payment">Pagamento</TabsTrigger>
              </TabsList>
              
              <TabsContent value="company" className="space-y-4">
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="company_name">Nome da Empresa *</Label>
                    <Input
                      id="company_name"
                      name="company_name"
                      value={formData.company_name}
                      onChange={handleChange}
                      required
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="legal_name">Razão Social</Label>
                    <Input
                      id="legal_name"
                      name="legal_name"
                      value={formData.legal_name}
                      onChange={handleChange}
                    />
                  </div>
                  
                  <div>
                    <Label>Tipo de Documento *</Label>
                    <RadioGroup 
                      value={formData.document_type} 
                      onValueChange={(value) => setFormData(prev => ({ ...prev, document_type: value }))}
                      className="flex space-x-4 mt-1"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="cpf" id="cpf" />
                        <Label htmlFor="cpf">CPF</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="cnpj" id="cnpj" />
                        <Label htmlFor="cnpj">CNPJ</Label>
                      </div>
                    </RadioGroup>
                  </div>
                  
                  <div>
                    <Label htmlFor="document">{formData.document_type === "cpf" ? "CPF" : "CNPJ"} *</Label>
                    <Input
                      id="document"
                      name="document"
                      value={formData.document}
                      onChange={handleChange}
                      placeholder={formatDocumentPlaceholder()}
                      required
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="responsible_name">Nome do Responsável *</Label>
                    <Input
                      id="responsible_name"
                      name="responsible_name"
                      value={formData.responsible_name}
                      onChange={handleChange}
                      required
                    />
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="email">Email *</Label>
                      <Input
                        id="email"
                        name="email"
                        type="email"
                        value={formData.email}
                        onChange={handleChange}
                        required
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="phone">Telefone *</Label>
                      <Input
                        id="phone"
                        name="phone"
                        value={formData.phone}
                        onChange={handleChange}
                        required
                      />
                    </div>
                  </div>
                  
                  <div className="flex justify-between mt-6">
                    <div></div>
                    <Button type="button" onClick={nextTab}>Próximo</Button>
                  </div>
                </div>
              </TabsContent>
              
              <TabsContent value="modules" className="space-y-4">
                <div>
                  <Label>Tipo de Negócio *</Label>
                  <RadioGroup 
                    value={formData.business_type} 
                    onValueChange={handleBusinessTypeChange}
                    className="flex flex-col space-y-3 mt-2"
                  >
                    <div className="flex items-start space-x-3">
                      <RadioGroupItem value="clinic" id="clinic" className="mt-1" />
                      <div>
                        <Label htmlFor="clinic" className="font-medium">Clínica Veterinária</Label>
                        <p className="text-sm text-gray-500">Gerenciamento exclusivo para clínicas veterinárias</p>
                      </div>
                    </div>
                    
                    <div className="flex items-start space-x-3">
                      <RadioGroupItem value="petshop" id="petshop" className="mt-1" />
                      <div>
                        <Label htmlFor="petshop" className="font-medium">Pet Shop</Label>
                        <p className="text-sm text-gray-500">Gerenciamento exclusivo para pet shops</p>
                      </div>
                    </div>
                    
                    <div className="flex items-start space-x-3">
                      <RadioGroupItem value="both" id="both" className="mt-1" />
                      <div>
                        <Label htmlFor="both" className="font-medium">Clínica + Pet Shop</Label>
                        <p className="text-sm text-gray-500">Solução completa para ambos os serviços</p>
                      </div>
                    </div>
                  </RadioGroup>
                </div>
                
                <div className="mt-6">
                  <Label className="mb-3 block">Módulos Adicionais</Label>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {formData.business_type === 'clinic' || formData.business_type === 'both' ? (
                      <div className="flex items-start space-x-3 p-4 border rounded-md hover:bg-gray-50">
                        <Checkbox 
                          id="module-clinic" 
                          checked={formData.selected_modules.includes('clinic_management')}
                          onCheckedChange={() => handleModuleChange('clinic_management')}
                          disabled
                        />
                        <div>
                          <Label htmlFor="module-clinic" className="font-medium cursor-pointer">Gestão Clínica</Label>
                          <p className="text-sm text-gray-500">Prontuários, exames, histórico médico</p>
                        </div>
                      </div>
                    ) : null}
                    
                    {formData.business_type === 'petshop' || formData.business_type === 'both' ? (
                      <div className="flex items-start space-x-3 p-4 border rounded-md hover:bg-gray-50">
                        <Checkbox 
                          id="module-petshop" 
                          checked={formData.selected_modules.includes('petshop')}
                          onCheckedChange={() => handleModuleChange('petshop')}
                          disabled
                        />
                        <div>
                          <Label htmlFor="module-petshop" className="font-medium cursor-pointer">Pet Shop</Label>
                          <p className="text-sm text-gray-500">Vendas, estoque, serviços</p>
                        </div>
                      </div>
                    ) : null}
                    
                    <div className="flex items-start space-x-3 p-4 border rounded-md hover:bg-gray-50">
                      <Checkbox 
                        id="module-financial" 
                        checked={formData.selected_modules.includes('financial')}
                        onCheckedChange={() => handleModuleChange('financial')}
                      />
                      <div>
                        <Label htmlFor="module-financial" className="font-medium cursor-pointer">Financeiro</Label>
                        <p className="text-sm text-gray-500">Controle financeiro completo</p>
                      </div>
                    </div>
                    
                    <div className="flex items-start space-x-3 p-4 border rounded-md hover:bg-gray-50">
                      <Checkbox 
                        id="module-transport" 
                        checked={formData.selected_modules.includes('transport')}
                        onCheckedChange={() => handleModuleChange('transport')}
                      />
                      <div>
                        <Label htmlFor="module-transport" className="font-medium cursor-pointer">Leva e Traz</Label>
                        <p className="text-sm text-gray-500">Transporte de pets</p>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div>
                  <Label htmlFor="access_url">URL da Loja *</Label>
                  <div className="flex">
                    <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-gray-300 bg-gray-50 text-gray-500">
                      petmanager.com/
                    </span>
                    <Input
                      id="access_url"
                      name="access_url"
                      value={formData.access_url}
                      onChange={handleChange}
                      className="rounded-l-none"
                      required
                    />
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={generateUrl}
                      className="ml-2"
                    >
                      Gerar
                    </Button>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Esta será a URL de acesso à loja</p>
                </div>
                
                <div className="flex justify-between mt-6">
                  <Button type="button" variant="outline" onClick={prevTab}>Voltar</Button>
                  <Button type="button" onClick={nextTab}>Próximo</Button>
                </div>
              </TabsContent>
              
              <TabsContent value="address" className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="cep">CEP *</Label>
                    <div className="flex">
                      <Input
                        id="cep"
                        name="cep"
                        value={formData.address.cep}
                        onChange={handleAddressChange}
                        maxLength={8}
                        required
                      />
                      {isSearchingCep && (
                        <div className="ml-2 flex items-center">
                          <Loader2 className="h-5 w-5 animate-spin text-gray-500" />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                
                <div>
                  <Label htmlFor="street">Logradouro *</Label>
                  <Input
                    id="street"
                    name="street"
                    value={formData.address.street}
                    onChange={handleAddressChange}
                    required
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="number">Número *</Label>
                    <Input
                      id="number"
                      name="number"
                      value={formData.address.number}
                      onChange={handleAddressChange}
                      required
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="complement">Complemento</Label>
                    <Input
                      id="complement"
                      name="complement"
                      value={formData.address.complement}
                      onChange={handleAddressChange}
                    />
                  </div>
                </div>
                
                <div>
                  <Label htmlFor="neighborhood">Bairro *</Label>
                  <Input
                    id="neighborhood"
                    name="neighborhood"
                    value={formData.address.neighborhood}
                    onChange={handleAddressChange}
                    required
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="city">Cidade *</Label>
                    <Input
                      id="city"
                      name="city"
                      value={formData.address.city}
                      onChange={handleAddressChange}
                      required
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="state">Estado *</Label>
                    <Select 
                      value={formData.address.state} 
                      onValueChange={(value) => setFormData(prev => ({
                        ...prev,
                        address: {
                          ...prev.address,
                          state: value
                        }
                      }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o estado" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="AC">Acre</SelectItem>
                        <SelectItem value="AL">Alagoas</SelectItem>
                        <SelectItem value="AP">Amapá</SelectItem>
                        <SelectItem value="AM">Amazonas</SelectItem>
                        <SelectItem value="BA">Bahia</SelectItem>
                        <SelectItem value="CE">Ceará</SelectItem>
                        <SelectItem value="DF">Distrito Federal</SelectItem>
                        <SelectItem value="ES">Espírito Santo</SelectItem>
                        <SelectItem value="GO">Goiás</SelectItem>
                        <SelectItem value="MA">Maranhão</SelectItem>
                        <SelectItem value="MT">Mato Grosso</SelectItem>
                        <SelectItem value="MS">Mato Grosso do Sul</SelectItem>
                        <SelectItem value="MG">Minas Gerais</SelectItem>
                        <SelectItem value="PA">Pará</SelectItem>
                        <SelectItem value="PB">Paraíba</SelectItem>
                        <SelectItem value="PR">Paraná</SelectItem>
                        <SelectItem value="PE">Pernambuco</SelectItem>;
                        <SelectItem value="PI">Piauí</SelectItem>;
                        <SelectItem value="RJ">Rio de Janeiro</SelectItem>;
                        <SelectItem value="RN">Rio Grande do Norte</SelectItem>;
                        <SelectItem value="RS">Rio Grande do Sul</SelectItem>;
                        <SelectItem value="RO">Rondônia</SelectItem>;
                        <SelectItem value="RR">Roraima</SelectItem>;
                        <SelectItem value="SC">Santa Catarina</SelectItem>;
                        <SelectItem value="SP">São Paulo</SelectItem>;
                        <SelectItem value="SE">Sergipe</SelectItem>;
                        <SelectItem value="TO">Tocantins</SelectItem>;
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                <div className="flex justify-between mt-6">
                  <Button type="button" variant="outline" onClick={prevTab}>Voltar</Button>
                  <Button type="button" onClick={nextTab}>Próximo</Button>
                </div>
              </TabsContent>
              
              <TabsContent value="subscription" className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card className={`border-2 ${formData.subscription_tier === 'basic' ? 'border-blue-500' : ''}`}>
                    <CardHeader className="bg-blue-50">
                      <CardTitle>Plano Básico</CardTitle>
                      <CardDescription>Para pequenas clínicas e pet shops</CardDescription>
                    </CardHeader>
                    <CardContent className="pt-4">
                      <p className="text-2xl font-bold mb-4">R$ 99 <span className="text-sm font-normal">/mês</span></p>
                      <ul className="space-y-2">
                        <li className="flex items-center">
                          <CheckCircle2 className="h-4 w-4 text-green-500 mr-2" />
                          <span className="text-sm">Até 5 usuários</span>
                        </li>
                        <li className="flex items-center">
                          <CheckCircle2 className="h-4 w-4 text-green-500 mr-2" />
                          <span className="text-sm">Suporte por email</span>
                        </li>
                        <li className="flex items-center">
                          <CheckCircle2 className="h-4 w-4 text-green-500 mr-2" />
                          <span className="text-sm">Armazenamento básico</span>
                        </li>
                      </ul>
                      <Button
                        type="button"
                        variant={formData.subscription_tier === 'basic' ? 'default' : 'outline'}
                        className="w-full mt-4"
                        onClick={() => setFormData(prev => ({ ...prev, subscription_tier: 'basic' }))}
                      >
                        {formData.subscription_tier === 'basic' ? 'Selecionado' : 'Selecionar'}
                      </Button>
                    </CardContent>
                  </Card>
                  
                  <Card className={`border-2 ${formData.subscription_tier === 'professional' ? 'border-blue-500' : ''}`}>
                    <CardHeader className="bg-purple-50">
                      <CardTitle>Plano Profissional</CardTitle>
                      <CardDescription>Para negócios em crescimento</CardDescription>
                    </CardHeader>
                    <CardContent className="pt-4">
                      <p className="text-2xl font-bold mb-4">R$ 199 <span className="text-sm font-normal">/mês</span></p>
                      <ul className="space-y-2">
                        <li className="flex items-center">
                          <CheckCircle2 className="h-4 w-4 text-green-500 mr-2" />
                          <span className="text-sm">Até 15 usuários</span>
                        </li>
                        <li className="flex items-center">
                          <CheckCircle2 className="h-4 w-4 text-green-500 mr-2" />
                          <span className="text-sm">Suporte prioritário</span>
                        </li>
                        <li className="flex items-center">
                          <CheckCircle2 className="h-4 w-4 text-green-500 mr-2" />
                          <span className="text-sm">Armazenamento ampliado</span>
                        </li>
                        <li className="flex items-center">
                          <CheckCircle2 className="h-4 w-4 text-green-500 mr-2" />
                          <span className="text-sm">Relatórios avançados</span>
                        </li>
                      </ul>
                      <Button
                        type="button"
                        variant={formData.subscription_tier === 'professional' ? 'default' : 'outline'}
                        className="w-full mt-4"
                        onClick={() => setFormData(prev => ({ ...prev, subscription_tier: 'professional' }))}
                      >
                        {formData.subscription_tier === 'professional' ? 'Selecionado' : 'Selecionar'}
                      </Button>
                    </CardContent>
                  </Card>
                  
                  <Card className={`border-2 ${formData.subscription_tier === 'enterprise' ? 'border-blue-500' : ''}`}>
                    <CardHeader className="bg-indigo-50">
                      <CardTitle>Plano Empresarial</CardTitle>
                      <CardDescription>Para grandes negócios</CardDescription>
                    </CardHeader>
                    <CardContent className="pt-4">
                      <p className="text-2xl font-bold mb-4">R$ 299 <span className="text-sm font-normal">/mês</span></p>
                      <ul className="space-y-2">
                        <li className="flex items-center">
                          <CheckCircle2 className="h-4 w-4 text-green-500 mr-2" />
                          <span className="text-sm">Usuários ilimitados</span>
                        </li>
                        <li className="flex items-center">
                          <CheckCircle2 className="h-4 w-4 text-green-500 mr-2" />
                          <span className="text-sm">Suporte 24/7</span>
                        </li>
                        <li className="flex items-center">
                          <CheckCircle2 className="h-4 w-4 text-green-500 mr-2" />
                          <span className="text-sm">Armazenamento ilimitado</span>
                        </li>
                        <li className="flex items-center">
                          <CheckCircle2 className="h-4 w-4 text-green-500 mr-2" />
                          <span className="text-sm">API completa</span>
                        </li>
                        <li className="flex items-center">
                          <CheckCircle2 className="h-4 w-4 text-green-500 mr-2" />
                          <span className="text-sm">Customização total</span>
                        </li>
                      </ul>
                      <Button
                        type="button"
                        variant={formData.subscription_tier === 'enterprise' ? 'default' : 'outline'}
                        className="w-full mt-4"
                        onClick={() => setFormData(prev => ({ ...prev, subscription_tier: 'enterprise' }))}
                      >
                        {formData.subscription_tier === 'enterprise' ? 'Selecionado' : 'Selecionar'}
                      </Button>
                    </CardContent>
                  </Card>
                </div>
                
                <div className="mt-6">
                  <Label>Período de Cobrança</Label>
                  <RadioGroup 
                    value={formData.payment_plan} 
                    onValueChange={(value) => setFormData(prev => ({ ...prev, payment_plan: value }))}
                    className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-4 mt-2"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="monthly" id="monthly" />
                      <Label htmlFor="monthly">Mensal</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="quarterly" id="quarterly" />
                      <Label htmlFor="quarterly">Trimestral (-10%)</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="annual" id="annual" />
                      <Label htmlFor="annual">Anual (-20%)</Label>
                    </div>
                  </RadioGroup>
                </div>
                
                <div className="bg-blue-50 p-4 rounded-md mt-4">
                  <h3 className="font-medium mb-2">Resumo do Plano</h3>
                  <div className="flex justify-between mb-2">
                    <span>Plano {getTierDetails(formData.subscription_tier).name}</span>
                    <span>
                      R$ {calculatePrice()},00 / 
                      {formData.payment_plan === 'monthly' ? 'mês' : 
                       formData.payment_plan === 'quarterly' ? 'trimestre' : 'ano'}
                    </span>
                  </div>
                  
                  <div className="flex justify-between font-semibold">
                    <span>Total</span>
                    <span>
                      R$ {calculatePrice() * 
                         (formData.payment_plan === 'monthly' ? 1 : 
                          formData.payment_plan === 'quarterly' ? 3 : 12)},00
                    </span>
                  </div>
                </div>
                
                <div className="flex justify-between mt-6">
                  <Button type="button" variant="outline" onClick={prevTab}>Voltar</Button>
                  <Button type="button" onClick={nextTab}>Próximo</Button>
                </div>
              </TabsContent>
              
              <TabsContent value="payment" className="space-y-4">
                <div>
                  <Label>Método de Pagamento</Label>
                  <RadioGroup 
                    value={formData.payment_method} 
                    onValueChange={(value) => setFormData(prev => ({ ...prev, payment_method: value }))}
                    className="flex flex-col space-y-3 mt-2"
                  >
                    <div className="flex items-center space-x-3 p-3 border rounded-md hover:bg-gray-50">
                      <RadioGroupItem value="credit_card" id="credit_card" />
                      <CreditCard className="h-5 w-5 text-gray-600" />
                      <Label htmlFor="credit_card">Cartão de Crédito</Label>
                    </div>
                    
                    <div className="flex items-center space-x-3 p-3 border rounded-md hover:bg-gray-50">
                      <RadioGroupItem value="pix" id="pix" />
                      <DollarSign className="h-5 w-5 text-gray-600" />
                      <Label htmlFor="pix">PIX</Label>
                    </div>
                  </RadioGroup>
                </div>
                
                {formData.payment_method === 'credit_card' && (
                  <div className="mt-4 space-y-4">
                    <div>
                      <Label htmlFor="card_number">Número do Cartão *</Label>
                      <Input
                        id="card_number"
                        name="number"
                        value={formData.card_info.number}
                        onChange={handleCardInfoChange}
                        placeholder="0000 0000 0000 0000"
                        maxLength={19}
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="holder_name">Nome no Cartão *</Label>
                      <Input
                        id="holder_name"
                        name="holder_name"
                        value={formData.card_info.holder_name}
                        onChange={handleCardInfoChange}
                        placeholder="NOME COMO ESTÁ NO CARTÃO"
                      />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="expiry">Validade *</Label>
                        <Input
                          id="expiry"
                          name="expiry"
                          value={formData.card_info.expiry}
                          onChange={handleCardInfoChange}
                          placeholder="MM/AA"
                          maxLength={5}
                        />
                      </div>
                      
                      <div>
                        <Label htmlFor="cvv">Código de Segurança (CVV) *</Label>
                        <Input
                          id="cvv"
                          name="cvv"
                          value={formData.card_info.cvv}
                          onChange={handleCardInfoChange}
                          placeholder="123"
                          maxLength={4}
                          type="password"
                        />
                      </div>
                    </div>
                  </div>
                )}
                
                {formData.payment_method === 'pix' && (
                  <div className="mt-4 p-4 bg-gray-50 rounded-md border text-center">
                    <p>Após a confirmação, exibiremos um QR Code para pagamento via PIX.</p>
                  </div>
                )}
                
                <div className="flex justify-between mt-6">
                  <Button type="button" variant="outline" onClick={prevTab}>Voltar</Button>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        {tenant ? 'Atualizando...' : 'Criando...'}
                      </>
                    ) : (
                      tenant ? 'Atualizar Tenant' : 'Criar Tenant'
                    )}
                  </Button>
                </div>
              </TabsContent>
            </Tabs>
          </form>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
