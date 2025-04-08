import { useState, useEffect } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import PropTypes from "prop-types";
import { Calendar as CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Loader2 } from "lucide-react"; // Adicionado para o loader

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
  customerId: PropTypes.string.isRequired
};

export default function PetForm({ onSuccess, customerId }) {
  console.log('[PetForm] Renderizado com customerId:', customerId);
  const [isLoading, setIsLoading] = useState(false);
  const [healthPlans, setHealthPlans] = useState([]);
  const [dateInputValue, setDateInputValue] = useState("");
  const [formData, setFormData] = useState({
    name: "",
    species: "",
    breed: "",
    gender: "",
    birth_date: "",
    health_plan_id: "",
    photo_url: "",
    owner_id: customerId,
    tenant_id: localStorage.getItem('current_tenant')
  });
  const [imagePreview, setImagePreview] = useState(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  useEffect(() => {
    loadHealthPlans();
  }, []);

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
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
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
      const { UploadFile } = await import("@/api/integrations");
      const result = await UploadFile(file);
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

  const handleDateChange = (date) => {
    setFormData(prev => ({
      ...prev,
      birth_date: date ? format(date, 'yyyy-MM-dd') : ''
    }));
    setDateInputValue(date ? format(date, 'dd/MM/yyyy') : '');
  };

  const handleDateInputChange = (e) => {
    const value = e.target.value;
    setDateInputValue(value);
    
    const parts = value.split('/');
    if (parts.length === 3) {
      const date = new Date(parts[2], parts[1] - 1, parts[0]);
      if (!isNaN(date.getTime())) {
        setFormData(prev => ({
          ...prev,
          birth_date: format(date, 'yyyy-MM-dd')
        }));
      }
    }
  };

  const handleSpeciesChange = (value) => {
    setFormData(prev => ({
      ...prev,
      species: value,
      breed: ""
    }));
  };

  const handleSubmit = async (e) => {
    console.log('[PetForm] handleSubmit iniciado!');
    e.preventDefault();
    setIsLoading(true);

    try {
      const petData = {
        ...formData,
        owner_id: customerId,
        tenant_id: localStorage.getItem('current_tenant')
      };
      
      console.log('[PetForm] Dados a serem enviados para Pet.create:', petData);
      
      await Pet.create(petData);
      
      console.log('[PetForm] Pet.create executado com sucesso (aparentemente).');
      
      toast({
        title: "Sucesso",
        description: "Pet cadastrado com sucesso!"
      });

      if (onSuccess) {
        console.log('[PetForm] Chamando onSuccess...');
        onSuccess();
      }
    } catch (error) {
      console.error("Erro ao salvar pet:", error);
      toast({
        title: "Erro",
        description: "Não foi possível salvar o pet. Tente novamente.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
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

        <div className="space-y-2">
          <Label htmlFor="pet-breed">Raça *</Label>
          <Select
            value={formData.breed}
            onValueChange={(value) => setFormData(prev => ({ ...prev, breed: value }))}
            disabled={!formData.species}
          >
            <SelectTrigger id="pet-breed">
              <SelectValue placeholder="Selecione a raça" />
            </SelectTrigger>
            <SelectContent>
              {formData.species && breedsBySpecies[formData.species].map((breed) => (
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
              id="pet-birth-date"
              type="text"
              value={dateInputValue}
              onChange={handleDateInputChange}
              placeholder="DD/MM/AAAA"
              className="flex-1"
            />
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="icon">
                  <CalendarIcon className="h-4 w-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar
                  mode="single"
                  selected={formData.birth_date ? new Date(formData.birth_date) : undefined}
                  onSelect={handleDateChange}
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

      <div className="flex justify-end gap-3">
        <Button type="submit" disabled={isLoading}>
          {isLoading ? "Salvando..." : "Salvar Pet"}
        </Button>
      </div>
    </form>
  );
}
