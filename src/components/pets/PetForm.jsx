import { useState, useEffect } from "react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import PropTypes from "prop-types";
import { Calendar as CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Pet } from "@/api/entities";
import { HealthPlan } from "@/api/entities";
import { toast } from "@/components/ui/use-toast";
import { Loader2 } from "lucide-react";
import { UploadFile } from "@/api/entities";

const breedsBySpecies = {
  dog: [
    "Akita",
    "Basset Hound",
    "Beagle",
    "Bernese Mountain Dog",
    "Border Collie",
    "Boxer",
    "Bulldog Francês",
    "Bulldog Inglês",
    "Cane Corso",
    "Chihuahua",
    "Chow Chow",
    "Cocker Spaniel",
    "Dachshund",
    "Dálmata",
    "Doberman",
    "Dog Alemão",
    "Golden Retriever",
    "Husky Siberiano",
    "Labrador",
    "Lhasa Apso",
    "Maltês",
    "Pastor Alemão",
    "Pastor Australiano",
    "Pequinês",
    "Pinscher",
    "Pit Bull",
    "Poodle",
    "Pug",
    "Rottweiler",
    "Schnauzer",
    "Shih Tzu",
    "Spitz Alemão",
    "Yorkshire Terrier",
    "SRD (Sem Raça Definida)"
  ],
  cat: [
    "Angorá",
    "Bengal",
    "British Shorthair",
    "Burmese",
    "Himalaio",
    "Maine Coon",
    "Persa",
    "Ragdoll",
    "Russian Blue",
    "Siamês",
    "Sphynx",
    "SRD (Sem Raça Definida)"
  ]
};

PetForm.propTypes = {
  onSuccess: PropTypes.func.isRequired,
  customerId: PropTypes.string,
  pet: PropTypes.object
};

export default function PetForm({ onSuccess, customerId, pet = null }) {
  console.log('[PetForm] Renderizado com:', { customerId, pet });
  const [isLoading, setIsLoading] = useState(false);
  const [healthPlans, setHealthPlans] = useState([]);
  const [birthDateInputValue, setBirthDateInputValue] = useState("");
  const [deathDateInputValue, setDeathDateInputValue] = useState("");
  const [breedOptions, setBreedOptions] = useState([]);
  const [formData, setFormData] = useState({
    name: "",
    species: "",
    breed: "",
    gender: "",
    birth_date: "",
    health_plan_id: "",
    photo_url: "",
    owner_id: customerId || "",
    tenant_id: localStorage.getItem('current_tenant') || "",
    is_inactive: false,
    inactivation_reason: "",
    date_of_death: null
  });
  const [imagePreview, setImagePreview] = useState(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  useEffect(() => {
    loadHealthPlans();
  }, []);

  useEffect(() => {
    if (pet) {
      console.log('[PetForm] Populando formulário com dados do pet:', pet);
      setFormData(prev => ({
        ...prev,
        name: pet.name || "",
        species: pet.species || "",
        gender: pet.gender || "",
        birth_date: pet.birth_date || "",
        health_plan_id: pet.health_plan_id || "",
        photo_url: pet.photo_url || "",
        owner_id: pet.owner_id || customerId || "",
        tenant_id: pet.tenant_id || localStorage.getItem('current_tenant') || "",
        is_inactive: pet.is_inactive || false,
        inactivation_reason: pet.inactivation_reason || "",
        date_of_death: pet.date_of_death || null,
      }));
      
      if (pet.photo_url) {
        setImagePreview(pet.photo_url);
      }
      if (pet.birth_date) {
        try {
          setBirthDateInputValue(format(parseISO(pet.birth_date), 'dd/MM/yyyy', { locale: ptBR }));
        } catch {
           // console.warn("Invalid birth date format:", pet.birth_date);
           setBirthDateInputValue("");
        }
      }
      if (pet.is_inactive && pet.inactivation_reason === 'Óbito' && pet.date_of_death) {
         try {
           setDeathDateInputValue(format(parseISO(pet.date_of_death), 'dd/MM/yyyy', { locale: ptBR }));
         } catch {
           // console.warn("Invalid date of death format:", pet.date_of_death);
           setDeathDateInputValue("");
         }
      }
    } else {
      setFormData({
        name: "",
        species: "",
        breed: "",
        gender: "",
        birth_date: "",
        health_plan_id: "",
        photo_url: "",
        owner_id: customerId || "",
        tenant_id: localStorage.getItem('current_tenant') || "",
        is_inactive: false,
        inactivation_reason: "",
        date_of_death: null,
      });
      setImagePreview(null);
      setBirthDateInputValue("");
      setDeathDateInputValue("");
    }
  }, [pet, customerId]);

  useEffect(() => {
    if (formData.species && breedsBySpecies[formData.species]) {
      setBreedOptions(breedsBySpecies[formData.species]);
    } else {
      setBreedOptions([]);
    }
  }, [formData.species]);

  useEffect(() => {
    if (pet && pet.breed && breedOptions.length > 0) {
      if (breedOptions.includes(pet.breed)) {
         console.log(`[PetForm Breed useEffect] Setting breed to: ${pet.breed}`);
         setFormData(prev => ({ ...prev, breed: pet.breed }));
      } else {
         console.warn(`[PetForm Breed useEffect] Pet's breed "${pet.breed}" not found in options for species "${pet.species}". Resetting breed.`);
         setFormData(prev => ({ ...prev, breed: "" }));
      }
    }
  }, [pet, breedOptions]);

  const loadHealthPlans = async () => {
    try {
      const plans = await HealthPlan.list();
      setHealthPlans(plans.filter(plan => plan.is_active));
    } catch (error) {
      console.error("Erro ao carregar planos de saúde:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os planos de saúde.",
        variant: "destructive"
      });
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    const newValue = type === 'checkbox' ? checked : value;

    setFormData(prev => {
      const updated = { ...prev, [name]: newValue };
      if (name === 'is_inactive' && !newValue) {
        updated.inactivation_reason = "";
        updated.date_of_death = null;
        setDeathDateInputValue("");
      }
      if (name === 'inactivation_reason' && newValue !== 'Óbito') {
        updated.date_of_death = null;
        setDeathDateInputValue("");
      }
      return updated;
    });
  };

  const handleImageChange = async (e) => {
    const file = e.target.files[0];
    if (!file) {
      console.log('[PetForm] Nenhum arquivo selecionado');
      return;
    }

    setIsUploadingImage(true);
    try {
      if (!file.type.startsWith('image/')) {
        throw new Error('Por favor, selecione um arquivo de imagem válido.');
      }

      console.log('[PetForm] Iniciando upload do arquivo:', file);
      const result = await UploadFile.uploadFile(file, 'pet_avatars/');
      console.log('[PetForm] Resultado do upload:', result);
      
      if (result.success && result.url) {
        console.log('[PetForm] URL da imagem recebida:', result.url?.substring(0, 50) + '...');
        setFormData(prev => ({
          ...prev,
          photo_url: result.url
        }));
        
        const reader = new FileReader();
        reader.onloadend = () => {
          setImagePreview(reader.result);
        };
        reader.readAsDataURL(file);

        toast({
          title: "Sucesso",
          description: "Imagem carregada com sucesso!"
        });
      } else {
        throw new Error(result.error || 'URL da imagem não recebida do servidor');
      }
    } catch (error) {
      console.error("[PetForm] Erro ao fazer upload da imagem:", error);
      setImagePreview(null);
      setFormData(prev => ({
        ...prev,
        photo_url: ""
      }));
      toast({
        title: "Erro",
        description: error.message || "Não foi possível fazer upload da imagem.",
        variant: "destructive"
      });
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleDateChange = (date, fieldName, setInputValueFunc) => {
    const formattedDate = date ? format(date, 'yyyy-MM-dd') : '';
    setFormData(prev => ({
      ...prev,
      [fieldName]: formattedDate
    }));
    setInputValueFunc(date ? format(date, 'dd/MM/yyyy', { locale: ptBR }) : '');
  };

  const handleDateInputChange = (e, fieldName, setInputValueFunc) => {
    let value = e.target.value;
    
    // Remove non-digit characters
    value = value.replace(/\D/g, '');

    // Apply mask DD/MM/AAAA
    if (value.length > 2) {
      value = value.substring(0, 2) + '/' + value.substring(2);
    }
    if (value.length > 5) {
      value = value.substring(0, 5) + '/' + value.substring(5, 9); // Limit to 8 digits (DDMMYYYY)
    }

    // Limit total length (including slashes)
    value = value.substring(0, 10);

    setInputValueFunc(value);

    // --- Validation logic (remains the same) ---
    const parts = value.split('/');
    if (parts.length === 3 && parts[0].length === 2 && parts[1].length === 2 && parts[2].length === 4) {
      const day = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1; // Month is 0-indexed
      const year = parseInt(parts[2], 10);
      // Basic validation for year range and valid date parts
      if (year >= 1900 && year <= new Date().getFullYear() + 1 && month >= 0 && month <= 11 && day >= 1 && day <= 31) {
        const date = new Date(year, month, day);
        // Final check for valid date object (handles month days, leap years implicitly)
        if (!isNaN(date.getTime()) && date.getDate() === day && date.getMonth() === month && date.getFullYear() === year) {
          setFormData(prev => ({
            ...prev,
            [fieldName]: format(date, 'yyyy-MM-dd')
          }));
        } else {
           setFormData(prev => ({ ...prev, [fieldName]: '' })); // Clear if invalid date (e.g., 31/02/2024)
        }
      } else {
         setFormData(prev => ({ ...prev, [fieldName]: '' })); // Clear if invalid date parts (e.g., month 13)
      }
    } else {
      // Clear if format is not complete DD/MM/AAAA
      setFormData(prev => ({ ...prev, [fieldName]: '' }));
    }
  };

  const handleSpeciesChange = (newSpeciesValue) => {
    console.log(`[PetForm handleSpeciesChange] Setting species to ${newSpeciesValue}, resetting breed.`);
    setFormData(prev => ({
      ...prev,
      species: newSpeciesValue,
      breed: ""
    }));
  };

  const handleSubmit = async (e) => {
    console.log('[PetForm] handleSubmit iniciado!');
    e.preventDefault();
    setIsLoading(true);

    if (!formData.name || !formData.species || !formData.breed || !formData.gender || !formData.birth_date) {
      toast({
          title: "Erro de Validação",
          description: "Por favor, preencha todos os campos obrigatórios (*).",
          variant: "destructive",
      });
      setIsLoading(false);
      return;
    }
    
    if (formData.is_inactive && !formData.inactivation_reason) {
       toast({
          title: "Erro de Validação",
          description: "Por favor, selecione um motivo para a inativação.",
          variant: "destructive",
      });
      setIsLoading(false);
      return;
    }
     if (formData.is_inactive && formData.inactivation_reason === 'Óbito' && !formData.date_of_death) {
       toast({
          title: "Erro de Validação",
          description: "Por favor, informe a data do óbito.",
          variant: "destructive",
      });
      setIsLoading(false);
      return;
    }

    try {
      const currentTenant = localStorage.getItem('current_tenant') || "";
      const petData = {
        ...formData,
        tenant_id: currentTenant,
        owner_id: formData.owner_id || customerId,
        inactivation_reason: formData.is_inactive ? formData.inactivation_reason : "",
        date_of_death: formData.is_inactive && formData.inactivation_reason === 'Óbito' ? formData.date_of_death : null,
      };

      let successMessage = "";

      if (pet) {
        console.log('[PetForm] Dados a serem enviados para Pet.update:', pet.id, petData);
        await Pet.update(pet.id, petData);
        successMessage = "Pet atualizado com sucesso!";
      } else {
        console.log('[PetForm] Dados a serem enviados para Pet.create:', petData);
        await Pet.create(petData);
        successMessage = "Pet cadastrado com sucesso!";
      }

      console.log('[PetForm] Operação (create/update) executada com sucesso (aparentemente).');

      toast({
        title: "Sucesso",
        description: successMessage
      });

      if (onSuccess) {
        console.log('[PetForm] Chamando onSuccess...');
        onSuccess();
      }
    } catch (error) {
      console.error("Erro ao salvar pet:", error);
      toast({
        title: "Erro",
        description: error.message || "Não foi possível salvar o pet. Tente novamente.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form id="pet-form" onSubmit={handleSubmit} className="space-y-6">
      <div className="flex flex-col items-center gap-4 mb-6">
        <div className="relative w-32 h-32">
          {(imagePreview || formData.photo_url) && (
            <img
              src={imagePreview || formData.photo_url}
              alt="Preview"
              className="w-full h-full rounded-full object-cover"
            />
          )}
          {!imagePreview && !formData.photo_url && (
            <div className="w-full h-full rounded-full bg-gray-100 flex items-center justify-center">
              <span className="text-gray-400">Foto</span>
            </div>
          )}
          {isUploadingImage && (
            <div className="absolute inset-0 bg-black bg-opacity-50 rounded-full flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-white" />
            </div>
          )}
        </div>
        <div>
          <Input
            type="file"
            accept="image/*"
            onChange={handleImageChange}
            className="hidden"
            id="pet-image"
          />
          <Label htmlFor="pet-image" className="cursor-pointer">
            <Button type="button" variant="outline" onClick={() => document.getElementById('pet-image').click()}>
              {formData.photo_url ? "Trocar Foto" : "Adicionar Foto"}
            </Button>
          </Label>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="pet-name">Nome do Pet *</Label>
          <Input
            id="pet-name"
            name="name"
            value={formData.name}
            onChange={handleChange}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="pet-species">Espécie *</Label>
          <Select
            value={formData.species}
            onValueChange={handleSpeciesChange}
          >
            <SelectTrigger id="pet-species">
              <SelectValue placeholder="Selecione a espécie" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="dog">Cachorro</SelectItem>
              <SelectItem value="cat">Gato</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Log values just before rendering Breed Select */}
        {console.log('[PetForm Render] Breed Select - Species:', formData.species, 'Breed:', formData.breed, 'Options:', formData.species ? breedsBySpecies[formData.species] : 'N/A')}

        <div className="space-y-2">
          <Label htmlFor="pet-breed">Raça *</Label>
          <Select
            value={formData.breed}
            onValueChange={(value) => setFormData(prev => ({ ...prev, breed: value }))}
            disabled={!formData.species || isLoading}
          >
            <SelectTrigger id="pet-breed">
              <SelectValue placeholder="Selecione a raça" />
            </SelectTrigger>
            <SelectContent>
              {breedOptions.map((breed) => (
                <SelectItem key={breed} value={breed}>
                  {breed}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="pet-gender">Sexo *</Label>
          <Select
            value={formData.gender}
            onValueChange={(value) => setFormData(prev => ({ ...prev, gender: value }))}
          >
            <SelectTrigger id="pet-gender">
              <SelectValue placeholder="Selecione o sexo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="male">Macho</SelectItem>
              <SelectItem value="female">Fêmea</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="pet-birth-date">Data de Nascimento *</Label>
          <div className="flex gap-2">
            <Input
              id="pet-birth-date-input"
              type="text"
              value={birthDateInputValue}
              onChange={(e) => handleDateInputChange(e, 'birth_date', setBirthDateInputValue)}
              placeholder="DD/MM/AAAA"
              className="flex-1"
              disabled={isLoading}
            />
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="icon" disabled={isLoading}>
                  <CalendarIcon className="h-4 w-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar
                  mode="single"
                  selected={formData.birth_date ? parseISO(formData.birth_date) : undefined}
                  onSelect={(date) => handleDateChange(date, 'birth_date', setBirthDateInputValue)}
                  locale={ptBR}
                  captionLayout="dropdown-buttons"
                  fromYear={1990}
                  toYear={new Date().getFullYear()}
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="pet-health-plan">Plano de Saúde</Label>
          <Select
            value={formData.health_plan_id}
            onValueChange={(value) => setFormData(prev => ({ ...prev, health_plan_id: value }))}
          >
            <SelectTrigger id="pet-health-plan">
              <SelectValue placeholder="Selecione o plano" />
            </SelectTrigger>
            <SelectContent>
              {healthPlans.map((plan) => (
                <SelectItem key={plan.id} value={plan.id}>
                  {plan.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* --- Inactivation Section - Only show when editing (pet prop exists) --- */}
      {pet && (
        <div className="space-y-4 border-t pt-6 mt-6">
            <h3 className="text-lg font-medium">Status do Pet</h3>
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="is_inactive"
                name="is_inactive"
                checked={formData.is_inactive}
                onCheckedChange={(checked) => {
                  handleChange({ target: { name: 'is_inactive', type: 'checkbox', checked } });
                }}
                disabled={isLoading}
              />
              <Label htmlFor="is_inactive" className="cursor-pointer">
                Inativar Pet (ex: óbito, doação)
              </Label>
            </div>

            {formData.is_inactive && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-6 border-l-2 ml-2">
                <div className="space-y-2">
                   <Label htmlFor="inactivation_reason">Motivo da Inativação *</Label>
                   <Select
                     value={formData.inactivation_reason}
                     onValueChange={(value) => handleChange({ target: { name: 'inactivation_reason', value } })}
                     disabled={isLoading}
                   >
                     <SelectTrigger id="inactivation_reason">
                       <SelectValue placeholder="Selecione o motivo" />
                     </SelectTrigger>
                     <SelectContent>
                       <SelectItem value="Óbito">Óbito</SelectItem>
                       <SelectItem value="Doado">Doado</SelectItem>
                       <SelectItem value="Fugiu">Fugiu</SelectItem>
                       <SelectItem value="Perdido">Perdido</SelectItem>
                       <SelectItem value="Outro">Outro</SelectItem>
                     </SelectContent>
                   </Select>
                </div>

                {formData.inactivation_reason === 'Óbito' && (
                  <div className="space-y-2">
                    <Label htmlFor="date_of_death">Data do Óbito *</Label>
                     <div className="flex gap-2">
                        <Input
                          id="date_of_death-input"
                          type="text"
                          value={deathDateInputValue}
                          onChange={(e) => handleDateInputChange(e, 'date_of_death', setDeathDateInputValue)}
                          placeholder="DD/MM/AAAA"
                          className="flex-1"
                          disabled={isLoading}
                        />
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="outline" size="icon" disabled={isLoading}>
                              <CalendarIcon className="h-4 w-4" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="end">
                            <Calendar
                              mode="single"
                              selected={formData.date_of_death ? parseISO(formData.date_of_death) : undefined}
                              onSelect={(date) => handleDateChange(date, 'date_of_death', setDeathDateInputValue)}
                              locale={ptBR}
                              captionLayout="dropdown-buttons"
                              fromYear={1990}
                              toYear={new Date().getFullYear()}
                            />
                          </PopoverContent>
                        </Popover>
                      </div>
                  </div>
                )}
              </div>
            )}
        </div>
      )}
      {/* End Inactivation Section */}

    </form>
  );
}
