
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Pet } from "@/api/entities";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";
import { 
  Plus, 
  Edit, 
  Trash2,
  Dog,
  Cat,
  Calendar,
  Mars, 
  Venus 
} from "lucide-react";

import PetForm from "./PetForm";

export default function PetList({ pets, customerId, onUpdate }) {
  const navigate = useNavigate();
  const [showForm, setShowForm] = useState(false);
  const [editingPet, setEditingPet] = useState(null);
  const storeParam = localStorage.getItem('current_tenant');

  const handleView = (pet) => {
    navigate(createPageUrl(`PetDetails?id=${pet.id}&store=${storeParam}`));
  };

  const handleEdit = (pet) => {
    setEditingPet(pet);
    setShowForm(true);
  };

  const handleDelete = async (petId) => {
    if (window.confirm("Tem certeza que deseja excluir este pet?")) {
      try {
        await Pet.delete(petId);
        toast({
          title: "Sucesso",
          description: "Pet excluído com sucesso!"
        });
        if (onUpdate) onUpdate();
      } catch (error) {
        console.error("Erro ao excluir pet:", error);
        toast({
          title: "Erro",
          description: "Não foi possível excluir o pet.",
          variant: "destructive"
        });
      }
    }
  };

  const handleAddPet = () => {
    setEditingPet(null);
    setShowForm(true);
  };

  const getPetIcon = (species) => {
    if (species === "dog") {
      return <Dog className="h-5 w-5 text-blue-500" />;
    } else if (species === "cat") {
      return <Cat className="h-5 w-5 text-purple-500" />;
    }
    return null;
  };

  const getGenderIcon = (gender) => {
    if (gender === "male") {
      return <Mars className="h-4 w-4 text-blue-500" />;
    } else if (gender === "female") {
      return <Venus className="h-4 w-4 text-pink-500" />;
    }
    return null;
  };

  const formatBirthDate = (dateString) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    return date.toLocaleDateString("pt-BR");
  };

  const calculateAge = (birthDate) => {
    if (!birthDate) return "";
    
    const today = new Date();
    const birth = new Date(birthDate);
    
    let years = today.getFullYear() - birth.getFullYear();
    const months = today.getMonth() - birth.getMonth();
    
    if (months < 0 || (months === 0 && today.getDate() < birth.getDate())) {
      years--;
    }
    
    if (years < 1) {
      const monthsDiff = (today.getFullYear() - birth.getFullYear()) * 12 + (today.getMonth() - birth.getMonth());
      return `${monthsDiff} meses`;
    }
    
    return `${years} anos`;
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">Pets</h2>
        <Button 
          onClick={handleAddPet}
          variant="outline" 
          size="sm"
        >
          <Plus className="h-4 w-4 mr-2" />
          Adicionar Pet
        </Button>
      </div>

      {pets.length === 0 ? (
        <div className="text-center py-8 text-gray-500 border rounded-lg">
          Este cliente ainda não possui pets cadastrados.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {pets.map((pet) => (
            <div
              key={pet.id}
              className="border rounded-lg p-4 hover:bg-gray-50 transition"
            >
              <div className="flex justify-between">
                <div className="flex items-start gap-3">
                  <div className="mt-1">{getPetIcon(pet.species)}</div>
                  <div>
                    <h3 className="font-medium text-lg">
                      {pet.name} {getGenderIcon(pet.gender)}
                    </h3>
                    <p className="text-sm text-gray-600">
                      {pet.species === "dog" ? "Cão" : "Gato"} • {pet.breed}
                    </p>
                    <div className="flex items-center mt-1 text-sm text-gray-500">
                      <Calendar className="h-3.5 w-3.5 mr-1" />
                      {formatBirthDate(pet.birth_date)} ({calculateAge(pet.birth_date)})
                    </div>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => handleView(pet)}
                  >
                    Ver
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => handleEdit(pet)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => handleDelete(pet.id)}
                  >
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <PetForm
          open={showForm}
          onOpenChange={setShowForm}
          onSuccess={() => {
            setShowForm(false);
            if (onUpdate) onUpdate();
          }}
          customerId={customerId}
          pet={editingPet}
        />
      )}
    </div>
  );
}
