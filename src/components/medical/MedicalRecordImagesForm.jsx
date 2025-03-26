import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UploadFile } from "@/api/integrations";
import { toast } from "@/components/ui/use-toast";
import { Loader2, Plus, X } from "lucide-react";

export default function MedicalRecordImagesForm({ onSave, currentImages = [] }) {
  const [images, setImages] = useState(currentImages);
  const [isUploading, setIsUploading] = useState(false);

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      setIsUploading(true);
      const { file_url } = await UploadFile({ file });
      setImages([...images, file_url]);
      toast({
        title: "Sucesso",
        description: "Imagem adicionada com sucesso!"
      });
    } catch (error) {
      console.error("Erro ao fazer upload:", error);
      toast({
        title: "Erro no upload",
        description: "Não foi possível fazer o upload da imagem.",
        variant: "destructive"
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemoveImage = (index) => {
    const newImages = images.filter((_, i) => i !== index);
    setImages(newImages);
  };

  const handleSave = () => {
    onSave(images);
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Adicionar Imagens</Label>
        <div className="flex items-center gap-4">
          <Input
            type="file"
            accept="image/*"
            onChange={handleFileUpload}
            disabled={isUploading}
            className="w-full"
          />
          {isUploading && <Loader2 className="h-4 w-4 animate-spin" />}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {images.map((url, index) => (
          <div key={index} className="relative group">
            <img
              src={url}
              alt={`Imagem ${index + 1}`}
              className="w-full h-40 object-cover rounded-lg"
            />
            <button
              onClick={() => handleRemoveImage(index)}
              className="absolute top-2 right-2 bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>

      <Button onClick={handleSave} className="w-full">
        Salvar Imagens
      </Button>
    </div>
  );
}