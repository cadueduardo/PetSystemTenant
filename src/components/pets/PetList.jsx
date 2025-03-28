import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/components/ui/use-toast";
import { Plus, Dog, Cat, Bird, Loader2, Heart, Weight, Cake, User, PawPrint } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

import PetForm from "../pets/PetForm";
import PetImageModal from "../pets/PetImageModal";
import { Pet } from "@/lib/models/pet";

export default function PetList({ pets, customerId, tenantId, onPetAdded }) {
  const navigate = useNavigate();
  const [showPetForm, setShowPetForm] = useState(false);
  const [isAddingPet, setIsAddingPet] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false);
  const [selectedImageUrl, setSelectedImageUrl] = useState("");
  const [selectedPetName, setSelectedPetName] = useState("");
  const [storeParam, setStoreParam] = useState("");

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    setStoreParam(urlParams.get('store') || "");
  }, []);

  const getSpeciesIcon = (species) => {
    switch (species) {
      case "dog":
        return <Dog className="h-5 w-5" />;
      case "cat":
        return <Cat className="h-5 w-5" />;
      case "bird":
        return <Bird className="h-5 w-5" />;
      default:
        return <PawPrint className="h-5 w-5" />;
    }
  };

  const getGenderLabel = (gender) => {
    return gender === "male" ? "Macho" : "Fêmea";
  };

  const getSpeciesLabel = (species) => {
    const speciesLabels = {
      dog: "Cão",
      cat: "Gato",
      bird: "Pássaro",
      rodent: "Roedor",
      reptile: "Réptil",
      other: "Outro"
    };
    return speciesLabels[species] || species;
  };

  const getAgeFromBirthDate = (birthDate) => {
    if (!birthDate) return "Idade desconhecida";
    
    const today = new Date();
    const birth = new Date(birthDate);
    
    let years = today.getFullYear() - birth.getFullYear();
    let months = today.getMonth() - birth.getMonth();
    
    if (months < 0 || (months === 0 && today.getDate() < birth.getDate())) {
      years--;
      months += 12;
    }
    
    if (years > 0) {
      return `${years} ${years === 1 ? 'ano' : 'anos'}`;
    } else {
      return `${months} ${months === 1 ? 'mês' : 'meses'}`;
    }
  };

  const getAvatarFallback = (pet) => {
    if (!pet || !pet.name) return "?";
    
    return pet.name.charAt(0).toUpperCase();
  };

  const getAvatarColor = (species) => {
    switch (species) {
      case "dog":
        return "bg-amber-100 text-amber-800";
      case "cat":
        return "bg-indigo-100 text-indigo-800";
      case "bird":
        return "bg-emerald-100 text-emerald-800";
      case "rodent":
        return "bg-orange-100 text-orange-800";
      case "reptile":
        return "bg-green-100 text-green-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const handlePetClick = (petId) => {
    navigate(createPageUrl(`PetDetails?id=${petId}${storeParam ? `&store=${storeParam}` : ''}`));
  };

  const handleFormSubmit = async (petData) => {
    setIsAddingPet(true);
    
    try {
      let newPet;
      
      // Se for loja demo, adicionar o pet direto à lista
      if (storeParam === 'demo') {
        newPet = {
          ...petData,
          id: `demo-pet-${Date.now()}`,
          tenant_id: "demo-tenant",
          owner_id: customerId
        };
      } else {
        // Lógica para ambiente real
        newPet = await Pet.create({
          ...petData,
          owner_id: customerId,
          tenant_id: tenantId
        });
      }
      
      // Atualiza a lista de pets
      if (onPetAdded) {
        await onPetAdded(newPet);
      }
      
      // Fecha o modal
      setShowPetForm(false);
      
      toast({
        title: "Pet adicionado com sucesso!",
        description: `${petData.name} foi adicionado à lista de pets.`
      });
    } catch (error) {
      console.error("Erro ao adicionar pet:", error);
      toast({
        title: "Erro ao adicionar pet",
        description: "Não foi possível salvar os dados do pet.",
        variant: "destructive"
      });
    } finally {
      setIsAddingPet(false);
    }
  };

  const handleImageClick = (url, petName) => {
    setSelectedImageUrl(url);
    setSelectedPetName(petName);
    setShowImageModal(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Pets do Cliente</h2>
        <Button onClick={() => setShowPetForm(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Adicionar Pet
        </Button>
      </div>

      {pets.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-10">
            <div className="bg-blue-100 rounded-full p-3 mb-4">
              <Dog className="h-8 w-8 text-blue-600" />
            </div>
            <h3 className="text-lg font-medium mb-2">Nenhum pet cadastrado</h3>
            <p className="text-gray-500 mb-4 text-center">
              Este cliente ainda não possui pets cadastrados.
              <br />
              Adicione o primeiro pet para começar.
            </p>
            <Button onClick={() => setShowPetForm(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Adicionar Pet
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {pets.map((pet) => (
            <Card 
              key={pet.id} 
              className="overflow-hidden hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => handlePetClick(pet.id)}
            >
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-4">
                    <Avatar className={getAvatarColor(pet.species)}>
                      {pet.photo_url && (
                        <AvatarImage 
                          src={pet.photo_url} 
                          alt={pet.name} 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleImageClick(pet.photo_url, pet.name);
                          }}
                        />
                      )}
                      <AvatarFallback className={getAvatarColor(pet.species)}>
                        {getAvatarFallback(pet)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <CardTitle className="text-lg">{pet.name}</CardTitle>
                      <CardDescription className="flex items-center gap-1">
                        {getSpeciesIcon(pet.species)}
                        {getSpeciesLabel(pet.species)}
                        {pet.breed && ` • ${pet.breed}`}
                      </CardDescription>
                    </div>
                  </div>
                  <Badge className="mt-1">
                    {getGenderLabel(pet.gender)}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="pb-3">
                <div className="grid grid-cols-2 gap-2">
                  {pet.birth_date && (
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Cake className="h-4 w-4 text-gray-400" />
                      <span>{getAgeFromBirthDate(pet.birth_date)}</span>
                    </div>
                  )}
                  {pet.weight && (
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Weight className="h-4 w-4 text-gray-400" />
                      <span>{pet.weight} kg</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Heart className="h-4 w-4 text-gray-400" />
                    <span>{pet.neutered ? "Castrado" : "Não castrado"}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={showPetForm} onOpenChange={setShowPetForm}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Adicionar Novo Pet</DialogTitle>
            <DialogDescription>
              Preencha os dados do pet para cadastrá-lo.
            </DialogDescription>
          </DialogHeader>
          <PetForm
            customerId={customerId}
            onSubmit={handleFormSubmit}
            onCancel={() => setShowPetForm(false)}
          />
        </DialogContent>
      </Dialog>

      {showImageModal && (
        <PetImageModal
          imageUrl={selectedImageUrl}
          petName={selectedPetName}
          onClose={() => setShowImageModal(false)}
        />
      )}
    </div>
  );
}
