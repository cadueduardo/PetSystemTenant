import PropTypes from 'prop-types';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from 'lucide-react';

function AddressForm({ 
  address = {}, 
  onAddressChange, 
  searchCepFunction, // Função para buscar CEP (ex: searchAddressByCep)
  isLoadingCep = false, 
  className = '' 
}) {

  // Handler genérico para mudanças nos inputs de endereço
  const handleChange = (e) => {
    const { name, value } = e.target;
    if (onAddressChange) {
      onAddressChange(name, value);
    }
    // Disparar busca de CEP se o campo CEP for alterado e tiver 8 dígitos
    if (name === 'cep' && value.replace(/[^0-9]/g, "").length === 8 && searchCepFunction) {
        searchCepFunction(value.replace(/[^0-9]/g, ""));
    }
  };

  // Handler específico para o Select de Estado
  const handleStateChange = (value) => {
     if (onAddressChange) {
      onAddressChange('state', value);
    }
  };

  return (
    <div className={`space-y-4 ${className}`}>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1 sm:col-span-1">
              <Label htmlFor="address_cep">CEP *</Label>
              <div className="flex">
                <Input
                  id="address_cep"
                  name="cep"
                  value={address.cep || ""}
                  onChange={handleChange}
                  maxLength={9} // Permitir digitar o traço (8 dígitos + traço)
                  placeholder="00000-000"
                  required
                />
                {isLoadingCep && (
                  <div className="ml-2 flex items-center">
                    <Loader2 className="h-5 w-5 animate-spin text-gray-500" />
                  </div>
                )}
              </div>
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="address_street">Logradouro *</Label>
              <Input
                id="address_street"
                name="street"
                value={address.street || ""}
                onChange={handleChange}
                required
              />
            </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1">
                <Label htmlFor="address_number">Número *</Label>
                <Input
                  id="address_number"
                  name="number"
                  value={address.number || ""}
                  onChange={handleChange}
                  required
                />
            </div>
            <div className="space-y-1">
                <Label htmlFor="address_complement">Complemento</Label>
                <Input
                  id="address_complement"
                  name="complement"
                  value={address.complement || ""}
                  onChange={handleChange}
                />
            </div>
             <div className="space-y-1">
                <Label htmlFor="address_neighborhood">Bairro *</Label>
                <Input
                  id="address_neighborhood"
                  name="neighborhood"
                  value={address.neighborhood || ""}
                  onChange={handleChange}
                  required
                />
            </div>
        </div>

       <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1">
              <Label htmlFor="address_city">Cidade *</Label>
              <Input
                id="address_city"
                name="city"
                value={address.city || ""}
                onChange={handleChange}
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="address_state">Estado (UF) *</Label>
              <Select 
                value={address.state || ""} 
                onValueChange={handleStateChange}
              >
                <SelectTrigger id="address_state">
                  <SelectValue placeholder="UF" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="AC">AC</SelectItem>
                  <SelectItem value="AL">AL</SelectItem>
                  <SelectItem value="AP">AP</SelectItem>
                  <SelectItem value="AM">AM</SelectItem>
                  <SelectItem value="BA">BA</SelectItem>
                  <SelectItem value="CE">CE</SelectItem>
                  <SelectItem value="DF">DF</SelectItem>
                  <SelectItem value="ES">ES</SelectItem>
                  <SelectItem value="GO">GO</SelectItem>
                  <SelectItem value="MA">MA</SelectItem>
                  <SelectItem value="MT">MT</SelectItem>
                  <SelectItem value="MS">MS</SelectItem>
                  <SelectItem value="MG">MG</SelectItem>
                  <SelectItem value="PA">PA</SelectItem>
                  <SelectItem value="PB">PB</SelectItem>
                  <SelectItem value="PR">PR</SelectItem>
                  <SelectItem value="PE">PE</SelectItem>
                  <SelectItem value="PI">PI</SelectItem>
                  <SelectItem value="RJ">RJ</SelectItem>
                  <SelectItem value="RN">RN</SelectItem>
                  <SelectItem value="RS">RS</SelectItem>
                  <SelectItem value="RO">RO</SelectItem>
                  <SelectItem value="RR">RR</SelectItem>
                  <SelectItem value="SC">SC</SelectItem>
                  <SelectItem value="SP">SP</SelectItem>
                  <SelectItem value="SE">SE</SelectItem>
                  <SelectItem value="TO">TO</SelectItem>
                </SelectContent>
              </Select>
            </div>
             <div className="space-y-1">
                <Label htmlFor="address_ibge_code">Código IBGE Município</Label>
                <Input
                  id="address_ibge_code"
                  name="ibge_code" // Nome do campo no objeto address
                  value={address.ibge_code || ""} // Acessando o campo ibge_code
                  onChange={handleChange}
                  placeholder="Código de 7 dígitos"
                />
                <p className="text-xs text-muted-foreground">Necessário para emissão de NFS-e.</p>
            </div>
        </div>
    </div>
  );
}

AddressForm.propTypes = {
  address: PropTypes.shape({
    cep: PropTypes.string,
    street: PropTypes.string,
    number: PropTypes.string,
    complement: PropTypes.string,
    neighborhood: PropTypes.string,
    city: PropTypes.string,
    state: PropTypes.string,
    ibge_code: PropTypes.string, // Adicionado prop type
  }),
  onAddressChange: PropTypes.func.isRequired,
  searchCepFunction: PropTypes.func, 
  isLoadingCep: PropTypes.bool,
  className: PropTypes.string,
};

export default AddressForm; 