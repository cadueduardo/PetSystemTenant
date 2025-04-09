// import React, { useState, useEffect } from "react"; // Comentado ou Removido
import { useState, useEffect } from "react"; // Mantém apenas o necessário
import PropTypes from 'prop-types';
import { Customer } from "@/api/entities";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/use-toast";
import { Loader2 } from "lucide-react";

export default function CustomerForm({ customer, onSuccess }) {
  // console.log('[CustomerForm] Renderizando...', { customerProp: customer });

  const [formData, setFormData] = useState({
    full_name: "",
    cpf: "",
    phone: "",
    email: "",
    address: "",
    address_number: "",
    address_complement: "",
    neighborhood: "",
    city: "",
    state: "",
    cep: "",
    tenant_id: localStorage.getItem('current_tenant') || ""
  });
  
  const [isLoading, setIsLoading] = useState(false);
  const [isSearchingCep, setIsSearchingCep] = useState(false);

  useEffect(() => {
    // console.log('[CustomerForm] useEffect executando com customer:', customer);
    if (customer) {
      // console.log('[CustomerForm] Populando formulário com dados do cliente.');
      setFormData({
        ...customer
      });
    } else {
      // console.log('[CustomerForm] Resetando formulário (sem cliente para editar).');
      setFormData({
        full_name: "",
        cpf: "",
        phone: "",
        email: "",
        address: "",
        address_number: "",
        address_complement: "",
        neighborhood: "",
        city: "",
        state: "",
        cep: "",
        tenant_id: localStorage.getItem('current_tenant') || ""
      });
    }
  }, [customer]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    
    if (!formData.full_name || !formData.phone || !formData.email) {
      toast({
        title: "Erro",
        description: "Os campos Nome, Telefone e Email são obrigatórios.",
        variant: "destructive"
      });
      setIsLoading(false);
      return;
    }
    
    try {
      const currentTenant = localStorage.getItem('current_tenant') || "default";
      const customerData = {
        ...formData,
        tenant_id: currentTenant
      };

      if (customer) {
        await Customer.update(customer.id, customerData);
        toast({
          title: "Sucesso",
          description: "Cliente atualizado com sucesso!"
        });
      } else {
        await Customer.create(customerData);
        toast({
          title: "Sucesso",
          description: "Cliente criado com sucesso!"
        });
      }
      
      onSuccess();
    } catch (error) {
      console.error("Erro ao salvar cliente:", error);
      toast({
        title: "Erro",
        description: error.message || "Não foi possível salvar os dados do cliente.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCepBlur = async () => {
    const cep = formData.cep.replace(/\D/g, '');
    
    if (cep.length !== 8) return;
    
    setIsSearchingCep(true);
    
    try {
      const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const data = await response.json();
      
      if (!data.erro) {
        setFormData(prev => ({
          ...prev,
          address: data.logradouro,
          neighborhood: data.bairro,
          city: data.localidade,
          state: data.uf
        }));
      }
    } catch (error) {
      console.error("Erro ao buscar CEP:", error);
    } finally {
      setIsSearchingCep(false);
    }
  };

  // console.log('[CustomerForm] Estado atual antes do return:', { formData, isLoading, isSearchingCep });

  return (
    <form id="customer-form" onSubmit={handleSubmit} className="space-y-6">
      {/* {console.log('[CustomerForm] Dentro do return, renderizando o <form>')} */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <Label htmlFor="full_name">Nome Completo*</Label>
          <Input
            id="full_name"
            name="full_name"
            value={formData.full_name}
            onChange={handleChange}
            required
            disabled={isLoading}
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="cpf">CPF</Label>
          <Input
            id="cpf"
            name="cpf"
            placeholder="000.000.000-00"
            value={formData.cpf}
            onChange={handleChange}
            disabled={isLoading}
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="phone">Telefone*</Label>
          <Input
            id="phone"
            name="phone"
            placeholder="(00) 00000-0000"
            value={formData.phone}
            onChange={handleChange}
            required
            disabled={isLoading}
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="email">Email*</Label>
          <Input
            id="email"
            name="email"
            type="email"
            value={formData.email}
            onChange={handleChange}
            required
            disabled={isLoading}
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="cep">CEP*</Label>
          <div className="relative">
            <Input
              id="cep"
              name="cep"
              placeholder="00000-000"
              value={formData.cep}
              onChange={handleChange}
              onBlur={handleCepBlur}
              required
              disabled={isLoading || isSearchingCep}
            />
            {isSearchingCep && (
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                <Loader2 className="h-4 w-4 animate-spin text-gray-500" />
              </div>
            )}
          </div>
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="address">Endereço*</Label>
          <Input
            id="address"
            name="address"
            value={formData.address}
            onChange={handleChange}
            required
            disabled={isLoading}
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="address_number">Número*</Label>
          <Input
            id="address_number"
            name="address_number"
            value={formData.address_number}
            onChange={handleChange}
            required
            disabled={isLoading}
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="address_complement">Complemento</Label>
          <Input
            id="address_complement"
            name="address_complement"
            value={formData.address_complement}
            onChange={handleChange}
            disabled={isLoading}
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="neighborhood">Bairro*</Label>
          <Input
            id="neighborhood"
            name="neighborhood"
            value={formData.neighborhood}
            onChange={handleChange}
            required
            disabled={isLoading}
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="city">Cidade*</Label>
          <Input
            id="city"
            name="city"
            value={formData.city}
            onChange={handleChange}
            required
            disabled={isLoading}
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="state">Estado*</Label>
          <Input
            id="state"
            name="state"
            value={formData.state}
            onChange={handleChange}
            required
            disabled={isLoading}
          />
        </div>
      </div>
    </form>
  );
}

CustomerForm.propTypes = {
  customer: PropTypes.shape({
    id: PropTypes.string,
  }),
  onSuccess: PropTypes.func.isRequired,
};