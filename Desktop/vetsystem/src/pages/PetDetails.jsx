import React, { useState, useEffect } from "react";
import { Pet } from "@/api/entities";
import { Customer } from "@/api/entities";
import { PurchaseHistory } from "@/api/entities";
import { QueueService } from "@/api/entities";
import { MedicalRecord } from "@/api/entities";
import { Appointment } from "@/api/entities";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { toast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, ChevronLeft, Pencil, Plus, Calendar } from "lucide-react";

// Componentes
import PetBasicInfo from "../components/pets/PetBasicInfo";
import ClinicalDataTab from "../components/pets/ClinicalDataTab";
import PetshopDataTab from "../components/pets/PetshopDataTab";
import MedicalRecordList from "../components/pets/MedicalRecordList";
import AppointmentList from "../components/pets/AppointmentList";
import PetForm from "../components/pets/PetForm";
import PetPurchaseHistory from "../components/pets/PetPurchaseHistory";
import PetGroomingHistory from "../components/pets/PetGroomingHistory";

export default function PetDetails() {
  const navigate = useNavigate();
  const [pet, setPet] = useState(null);
  const [owner, setOwner] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showEditForm, setShowEditForm] = useState(false);
  const [selectedModules, setSelectedModules] = useState([]);
  const [purchaseHistory, setPurchaseHistory] = useState([]);
  const [groomingHistory, setGroomingHistory] = useState([]);
  
  // Obter parâmetros da URL
  const urlParams = new URLSearchParams(window.location.search);
  const petId = urlParams.get('id');
  const storeParam = urlParams.get('store') || localStorage.getItem('current_tenant');
  
  // Carregar dados do pet e do dono
  useEffect(() => {
    const loadData = async () => {
      if (!petId) {
        navigate(createPageUrl(`Customers?store=${storeParam}`));
        return;
      }
      
      setIsLoading(true);
      try {
        // Carregar dados do pet
        const petData = await Pet.get(petId);
        if (!petData) {
          throw new Error("Pet não encontrado");
        }
        setPet(petData);
        
        // Carregar dados do dono
        if (petData.owner_id) {
          try {
            const ownerData = await Customer.get(petData.owner_id);
            setOwner(ownerData);
          } catch (error) {
            console.error("Erro ao carregar dados do dono:", error);
            toast({
              title: "Aviso",
              description: "Não foi possível carregar dados do dono.",
              variant: "warning"
            });
          }
        }
        
        // Carregar módulos do tenant
        try {
          const modules = JSON.parse(localStorage.getItem('tenant_modules') || '[]');
          setSelectedModules(modules);
        } catch (error) {
          console.error("Erro ao carregar módulos:", error);
          setSelectedModules([]);
        }
        
        // Carregar histórico de compras do pet
        try {
          const purchases = await PurchaseHistory.filter({
            customer_id: petData.owner_id,
            "items": {
              "$elemMatch": {
                "pet_id": petId
              }
            }
          });
          setPurchaseHistory(purchases);
        } catch (error) {
          console.error("Erro ao carregar histórico de compras:", error);
          setPurchaseHistory([]);
        }
        
        // Carregar histórico de banho e tosa
        try {
          const grooming = await QueueService.filter({
            pet_id: petId,
            status: "completed"
          });
          setGroomingHistory(grooming);
        } catch (error) {
          console.error("Erro ao carregar histórico de banho e tosa:", error);
          setGroomingHistory([]);
        }
        
      } catch (error) {
        console.error("Erro ao carregar dados:", error);
        toast({
          title: "Erro",
          description: "Não foi possível carregar os dados do pet.",
          variant: "destructive"
        });
        navigate(createPageUrl(`Customers?store=${storeParam}`));
      } finally {
        setIsLoading(false);
      }
    };
    
    loadData();
  }, [petId, navigate, storeParam]);
  
  // Verificar se o tenant possui o módulo Petshop
  const hasPetshopModule = selectedModules.includes('petshop');
  
  // Atualizar dados do pet
  const handleUpdatePet = async (updatedPet) => {
    try {
      const updated = await Pet.update(petId, updatedPet);
      setPet(updated);
      setShowEditForm(false);
      toast({
        title: "Sucesso",
        description: "Dados do pet atualizados com sucesso!"
      });
    } catch (error) {
      console.error("Erro ao atualizar pet:", error);
      toast({
        title: "Erro",
        description: "Não foi possível atualizar os dados do pet.",
        variant: "destructive"
      });
    }
  };
  
  // Voltar para a página de detalhes do cliente
  const handleBackToCustomer = () => {
    if (owner) {
      navigate(createPageUrl(`CustomerDetails?id=${owner.id}&store=${storeParam}`));
    } else {
      navigate(createPageUrl(`Customers?store=${storeParam}`));
    }
  };
  
  // Navegar para o formulário de agendamento
  const handleNewAppointment = () => {
    navigate(createPageUrl(`AppointmentForm?pet_id=${petId}&customer_id=${owner?.id || ''}&store=${storeParam}`));
  };
  
  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-full p-8">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }
  
  if (!pet) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="py-10 text-center">
            <p className="text-lg text-gray-500 mb-4">Pet não encontrado</p>
            <Button onClick={() => navigate(createPageUrl(`Customers?store=${storeParam}`))}>
              Voltar para Clientes
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  return (
    <div className="p-6">
      {showEditForm ? (
        <Card>
          <CardContent className="pt-6">
            <div className="flex justify-between items-center mb-6">
              <h1 className="text-2xl font-bold">Editar Pet</h1>
              <Button variant="outline" onClick={() => setShowEditForm(false)}>
                Cancelar
              </Button>
            </div>
            <PetForm 
              pet={pet} 
              onSubmit={handleUpdatePet} 
              onCancel={() => setShowEditForm(false)}
            />
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                size="icon" 
                onClick={handleBackToCustomer}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <h1 className="text-2xl font-bold">{pet.name}</h1>
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={handleNewAppointment}>
                <Calendar className="h-4 w-4 mr-2" />
                Novo Agendamento
              </Button>
              <Button onClick={() => setShowEditForm(true)}>
                <Pencil className="h-4 w-4 mr-2" />
                Editar Pet
              </Button>
            </div>
          </div>
          
          <div className="mb-6">
            <PetBasicInfo pet={pet} owner={owner} />
          </div>
          
          <Tabs defaultValue="medical">
            <TabsList className="mb-4">
              <TabsTrigger value="medical">Dados Clínicos</TabsTrigger>
              <TabsTrigger value="records">Prontuários</TabsTrigger>
              <TabsTrigger value="appointments">Agendamentos</TabsTrigger>
              {hasPetshopModule && (
                <>
                  <TabsTrigger value="petshop">Petshop</TabsTrigger>
                  <TabsTrigger value="grooming">Banho e Tosa</TabsTrigger>
                  <TabsTrigger value="purchases">Compras</TabsTrigger>
                </>
              )}
            </TabsList>
            
            <TabsContent value="medical">
              <ClinicalDataTab pet={pet} />
            </TabsContent>
            
            <TabsContent value="records">
              <MedicalRecordList pet={pet} />
            </TabsContent>
            
            <TabsContent value="appointments">
              <AppointmentList pet={pet} />
            </TabsContent>
            
            {hasPetshopModule && (
              <>
                <TabsContent value="petshop">
                  <PetshopDataTab pet={pet} />
                </TabsContent>
                
                <TabsContent value="grooming">
                  <PetGroomingHistory 
                    petId={pet.id} 
                    groomingHistory={groomingHistory} 
                    setGroomingHistory={setGroomingHistory}
                  />
                </TabsContent>
                
                <TabsContent value="purchases">
                  <PetPurchaseHistory 
                    petId={pet.id} 
                    ownerId={pet.owner_id}
                    purchaseHistory={purchaseHistory}
                    setPurchaseHistory={setPurchaseHistory}
                  />
                </TabsContent>
              </>
            )}
          </Tabs>
        </>
      )}
    </div>
  );
}