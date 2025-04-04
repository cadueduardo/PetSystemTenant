import PropTypes from "prop-types";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Cat, Dog, Bird, PawPrint } from "lucide-react";
import { useState, useEffect } from "react";

export default function PetAvatar({ pet, size = "md", className = "" }) {
  const [imageUrl, setImageUrl] = useState("");

  useEffect(() => {
    if (!pet) {
      console.log('[PetAvatar] Pet não definido');
      setImageUrl("");
      return;
    }

    if (!pet.photo_url) {
      console.log('[PetAvatar] Pet sem foto:', {
        id: pet.id,
        name: pet.name,
        species: pet.species
      });
      setImageUrl("");
      return;
    }

    console.log('[PetAvatar] Recebido pet com foto:', {
      id: pet.id,
      name: pet.name,
      photo_url_length: pet.photo_url.length,
      photo_url_start: pet.photo_url.substring(0, 50) + '...',
      photo_url_type: typeof pet.photo_url,
      is_base64: pet.photo_url.startsWith('data:'),
      photo_url_mime: pet.photo_url.split(';')[0]
    });

    setImageUrl(pet.photo_url);
  }, [pet]);

  // Definir tamanhos
  const sizes = {
    sm: "h-8 w-8",
    md: "h-12 w-12",
    lg: "h-16 w-16",
    xl: "h-24 w-24"
  };

  const sizeClass = sizes[size] || sizes.md;
  
  // Tamanhos dos ícones baseados no tamanho do avatar
  const iconSizes = {
    sm: "h-4 w-4",
    md: "h-6 w-6",
    lg: "h-8 w-8",
    xl: "h-10 w-10"
  };
  
  const iconSizeClass = iconSizes[size] || iconSizes.md;
  
  // Função para obter o ícone baseado na espécie do pet
  const getSpeciesIcon = () => {
    const species = pet?.species?.toLowerCase() || 'unknown';
    
    switch (species) {
      case "cat":
        return <Cat className={`${iconSizeClass} text-indigo-600`} />;
      case "dog":
        return <Dog className={`${iconSizeClass} text-amber-600`} />;
      case "bird":
        return <Bird className={`${iconSizeClass} text-sky-600`} />;
      default:
        return <PawPrint className={`${iconSizeClass} text-gray-600`} />;
    }
  };

  return (
    <Avatar className={`${sizeClass} ${className}`}>
      {imageUrl ? (
        <AvatarImage
          src={imageUrl}
          alt={`Foto de ${pet?.name || 'Pet'}`}
          className="object-cover"
          onError={(e) => {
            console.error('[PetAvatar] Erro ao carregar imagem:', {
              error: e.message,
              imageUrl: imageUrl.substring(0, 50) + '...',
              target: e.target,
              type: e.type,
              currentSrc: e.target.currentSrc?.substring(0, 50) + '...',
              naturalWidth: e.target.naturalWidth,
              naturalHeight: e.target.naturalHeight
            });
            setImageUrl("");
          }}
          onLoad={(e) => {
            console.log('[PetAvatar] Imagem carregada com sucesso:', {
              petId: pet?.id,
              petName: pet?.name,
              imageUrl: imageUrl.substring(0, 50) + '...',
              currentSrc: e.target.currentSrc?.substring(0, 50) + '...',
              naturalWidth: e.target.naturalWidth,
              naturalHeight: e.target.naturalHeight
            });
          }}
        />
      ) : (
        <AvatarFallback className="bg-primary/10 flex items-center justify-center">
          {getSpeciesIcon()}
        </AvatarFallback>
      )}
    </Avatar>
  );
}

PetAvatar.propTypes = {
  pet: PropTypes.shape({
    id: PropTypes.string,
    name: PropTypes.string,
    species: PropTypes.string,
    photo_url: PropTypes.string
  }),
  size: PropTypes.oneOf(["sm", "md", "lg", "xl"]),
  className: PropTypes.string
}; 