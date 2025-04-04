import React from "react";
import { Button } from "@/components/ui/button";
import { X as XIcon } from "lucide-react";

export default function PetImageModal({ imageUrl, petName, onClose }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg overflow-hidden max-w-2xl w-full">
        <div className="flex justify-between items-center p-4 border-b">
          <h3 className="text-lg font-medium">Foto de {petName || "Pet"}</h3>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <XIcon className="h-5 w-5" />
          </Button>
        </div>
        <div className="p-4 flex items-center justify-center max-h-[70vh] overflow-hidden">
          <img 
            src={imageUrl} 
            alt={`Foto de ${petName || "Pet"}`} 
            className="max-w-full max-h-[65vh] object-contain"
          />
        </div>
      </div>
    </div>
  );
}