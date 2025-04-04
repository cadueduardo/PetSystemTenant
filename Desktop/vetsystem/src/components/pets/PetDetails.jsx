import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Pet } from "@/api/entities";
import { Customer } from "@/api/entities";
import ClinicalDataTab from "./ClinicalDataTab";

export default function PetDetails({ petId }) {
  const navigate = useNavigate();
  const [pet, setPet] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedModules, setSelectedModules] = useState([]);

  useEffect(() => {
    loadPet();
    const modules = JSON.parse(localStorage.getItem('tenant_modules') || '[]');
    setSelectedModules(modules);
  }, [petId]);

  const loadPet = async () => {
    try {
      const petData = await Pet.get(petId);
      setPet(petData);
      setIsLoading(false);
    } catch (error) {
      console.error("Erro ao carregar pet:", error);
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return <div>Carregando...</div>;
  }

  return (
    <Tabs defaultValue="info" className="w-full">
      <TabsList>
        <TabsTrigger value="info">Informações Básicas</TabsTrigger>
        {selectedModules.includes('clinic_management') && (
          <TabsTrigger value="clinical">Dados Clínicos</TabsTrigger>
        )}
      </TabsList>

      <TabsContent value="info">
        {/* Conteúdo das informações básicas */}
      </TabsContent>

      {selectedModules.includes('clinic_management') && (
        <TabsContent value="clinical">
          <ClinicalDataTab petId={petId} />
        </TabsContent>
      )}
    </Tabs>
  );
}