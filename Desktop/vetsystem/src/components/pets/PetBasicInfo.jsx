import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { 
  Dog, 
  Cat, 
  Circle,
  CircleDot,
  Calendar, 
  User 
} from "lucide-react";

// Função simples para calcular idade
const calculateAge = (birthDate) => {
  const today = new Date();
  
  let years = today.getFullYear() - birthDate.getFullYear();
  let months = today.getMonth() - birthDate.getMonth();
  
  if (months < 0 || (months === 0 && today.getDate() < birthDate.getDate())) {
    years--;
    months += 12;
  }
  
  if (years === 0) {
    if (months === 1) {
      return "1 mês";
    }
    return `${months} meses`;
  } else if (years === 1) {
    if (months === 0) {
      return "1 ano";
    } else if (months === 1) {
      return "1 ano e 1 mês";
    }
    return `1 ano e ${months} meses`;
  } else {
    if (months === 0) {
      return `${years} anos`;
    } else if (months === 1) {
      return `${years} anos e 1 mês`;
    }
    return `${years} anos e ${months} meses`;
  }
};

export default function PetBasicInfo({ pet, owner }) {
  if (!pet) return null;
  
  // Calcular idade
  let age = "Idade desconhecida";
  try {
    if (pet.birth_date) {
      age = calculateAge(new Date(pet.birth_date));
    }
  } catch (error) {
    console.error("Erro ao calcular idade:", error);
  }
  
  // Espécie
  const getSpeciesIcon = () => {
    if (pet.species === "dog") {
      return <Dog className="h-5 w-5 text-amber-600" />;
    } else if (pet.species === "cat") {
      return <Cat className="h-5 w-5 text-indigo-600" />;
    }
    return null;
  };
  
  // Gênero
  const getGenderIcon = () => {
    if (pet.gender === "male") {
      return <Circle className="h-5 w-5 text-blue-600" />;
    } else if (pet.gender === "female") {
      return <CircleDot className="h-5 w-5 text-pink-600" />;
    }
    return null;
  };
  
  // Mapear espécies e gênero para texto
  const getSpeciesText = () => {
    return pet.species === "dog" ? "Cachorro" : pet.species === "cat" ? "Gato" : pet.species;
  };
  
  const getGenderText = () => {
    return pet.gender === "male" ? "Macho" : pet.gender === "female" ? "Fêmea" : pet.gender;
  };
  
  // Formatação de data de nascimento
  let birthDateFormatted = "Não informada";
  try {
    if (pet.birth_date) {
      birthDateFormatted = format(new Date(pet.birth_date), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
    }
  } catch (error) {
    console.error("Erro ao formatar data:", error);
  }
  
  return (
    <Card>
      <CardContent className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <div className="flex items-center gap-4 mb-4">
              <div className="w-[100px] h-[100px] rounded-full overflow-hidden bg-gray-100 flex items-center justify-center">
                {pet.image_url ? (
                  <img 
                    src={pet.image_url} 
                    alt={pet.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Dog className="h-8 w-8 text-gray-400" />
                )}
              </div>
              <h2 className="text-2xl font-bold">{pet.name}</h2>
            </div>
            
            <div className="flex flex-wrap gap-3 mt-3 mb-4">
              <Badge variant="secondary" className="flex items-center gap-1 px-3 py-1 bg-blue-50 text-blue-700 hover:bg-blue-100">
                {getSpeciesIcon()}
                <span>{getSpeciesText()}</span>
              </Badge>
              
              <Badge variant="secondary" className="flex items-center gap-1 px-3 py-1 bg-blue-50 text-blue-700 hover:bg-blue-100">
                {getGenderIcon()}
                <span>{getGenderText()}</span>
              </Badge>
              
              <Badge variant="secondary" className="flex items-center gap-1 px-3 py-1 bg-blue-50 text-blue-700 hover:bg-blue-100">
                <Calendar className="h-4 w-4" />
                <span>{age}</span>
              </Badge>
            </div>
            
            <div className="space-y-2">
              <div>
                <span className="text-gray-500 text-sm">Raça:</span>
                <p className="font-medium">{pet.breed || "Não informado"}</p>
              </div>
              
              <div>
                <span className="text-gray-500 text-sm">Data de Nascimento:</span>
                <p className="font-medium">{birthDateFormatted}</p>
              </div>
            </div>
          </div>
          
          <div className="border-t md:border-t-0 md:border-l border-gray-200 pt-4 md:pt-0 md:pl-6">
            <h3 className="font-semibold text-gray-600 mb-2 flex items-center gap-2">
              <User className="h-4 w-4" />
              Tutor
            </h3>
            
            {owner ? (
              <div className="space-y-2">
                <p className="font-medium">{owner.full_name}</p>
                
                <div className="text-sm">
                  <div className="flex items-center">
                    <span className="text-gray-500 mr-2">CPF:</span>
                    <span>{owner.cpf}</span>
                  </div>
                  
                  <div className="flex items-center">
                    <span className="text-gray-500 mr-2">Telefone:</span>
                    <span>{owner.phone}</span>
                  </div>
                  
                  <div className="flex items-center">
                    <span className="text-gray-500 mr-2">Email:</span>
                    <span>{owner.email}</span>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-gray-500">Informações do tutor não disponíveis</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}