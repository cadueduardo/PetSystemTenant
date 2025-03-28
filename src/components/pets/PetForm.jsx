import React, { useState, useEffect } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
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
import { uploadFile } from "@/api/upload";

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

export default function PetForm({ pet, onSubmit, onCancel, customerId }) {
  const [isLoading, setIsLoading] = useState(false);
  const [healthPlans, setHealthPlans] = useState([]);
  const [dateInputValue, setDateInputValue] = useState("");
  const [formData, setFormData] = useState({
    name: pet?.name || "",
    species: pet?.species || "",
    breed: pet?.breed || "",
    gender: pet?.gender || "",
    birth_date: pet?.birth_date || "",
    health_plan_id: pet?.health_plan_id || "",
    image_url: pet?.image_url || "",
    owner_id: pet?.owner_id || customerId,
    tenant_id: localStorage.getItem('current_tenant')
  });
  const [imagePreview, setImagePreview] = useState(pet?.image_url || null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  useEffect(() => {
    loadHealthPlans();
    if (pet?.birth_date) {
      setDateInputValue(format(new Date(pet.birth_date), 'dd/MM/yyyy'));
    }
  }, [pet]);

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
    if (!file) return;

    setIsUploadingImage(true);
    try {
      // Primeiro vamos criar o preview da imagem
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result);
      };
      reader.readAsDataURL(file);

      // Agora vamos fazer o upload
      const response = await uploadFile(file);
      
      setFormData(prev => ({
        ...prev,
        image_url: response.file_url
      }));

      toast({
        title: "Sucesso",
        description: "Imagem carregada com sucesso!"
      });
    } catch (error) {
      console.error("Erro ao fazer upload da imagem:", error);
      toast({
        title: "Erro",
        description: "Não foi possível fazer upload da imagem.",
        variant: "destructive"
      });
      // Limpa o preview em caso de erro
      setImagePreview(null);
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
    e.preventDefault();
    setIsLoading(true);

    try {
      const petData = {
        ...formData,
        tenant_id: localStorage.getItem('current_tenant')
      };

      if (onSubmit) {
        await onSubmit(petData);
      } else {
        // Se não houver onSubmit, significa que é uma criação
        await Pet.create(petData);
      }
      
      toast({
        title: "Sucesso",
        description: "Pet salvo com sucesso!"
      });

      // Se houver onCancel, chama para fechar o modal
      if (onCancel) {
        onCancel();
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
          {(imagePreview || formData.image_url) && (
            <img
              src={imagePreview || formData.image_url}
              alt="Preview"
              className="w-full h-full rounded-full object-cover"
            />
          )}
          {!imagePreview && !formData.image_url && (
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
              {formData.image_url ? "Trocar Foto" : "Adicionar Foto"}
            </Button>
          </Label>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="name">Nome do Pet *</Label>
          <Input
            id="name"
            name="name"
            value={formData.name}
            onChange={handleChange}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="species">Espécie *</Label>
          <Select
            value={formData.species}
            onValueChange={handleSpeciesChange}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione a espécie" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="dog">Cachorro</SelectItem>
              <SelectItem value="cat">Gato</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="breed">Raça *</Label>
          <Select
            value={formData.breed}
            onValueChange={(value) => setFormData(prev => ({ ...prev, breed: value }))}
            disabled={!formData.species}
          >
            <SelectTrigger>
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
          <Label htmlFor="gender">Sexo *</Label>
          <Select
            value={formData.gender}
            onValueChange={(value) => setFormData(prev => ({ ...prev, gender: value }))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione o sexo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="male">Macho</SelectItem>
              <SelectItem value="female">Fêmea</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="birth_date">Data de Nascimento *</Label>
          <div className="flex gap-2">
            <Input
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
          <Label htmlFor="health_plan_id">Plano de Saúde</Label>
          <Select
            value={formData.health_plan_id}
            onValueChange={(value) => setFormData(prev => ({ ...prev, health_plan_id: value }))}
          >
            <SelectTrigger>
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
