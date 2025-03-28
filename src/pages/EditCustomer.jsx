import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Customer } from "@/api/entities";
import { Pet } from "@/api/entities";
import { Tenant } from "@/api/entities";
import { User } from "@/api/entities";
import { createPageUrl } from "@/utils";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Loader2, ArrowLeft, UserCircle, PawPrint, Plus } from "lucide-react";
import { toast } from "@/components/ui/use-toast";

import EditCustomerForm from "../components/customers/EditCustomerForm";
import PetForm from "../components/customers/PetForm";
import PetList from "../components/customers/PetList";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function EditCustomerPage() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [customer, setCustomer] = useState(null);
  const [pets, setPets] = useState([]);
  const [currentTenant, setCurrentTenant] = useState(null);
  const [activeTab, setActiveTab] = useState("details");
  const [showAddPetDialog, setShowAddPetDialog] = useState(false);
  const [editingPet, setEditingPet] = useState(null);

  const urlParams = new URLSearchParams(window.location.search);
  const customerId = urlParams.get("id");

  useEffect(() => {
    if (!customerId) {
      navigate(createPageUrl("Customers"));
      return;
    }

    loadData();
  }, [customerId]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const tenants = await Tenant.list();
      const activeTenant = tenants.find(t => t.status === "active");
      
      if (!activeTenant) {
        toast({
          title: "Erro",
          description: "Nenhuma clínica ativa encontrada.",
          variant: "destructive"
        });
        navigate(createPageUrl("Dashboard"));
        return;
      }

      setCurrentTenant(activeTenant);

      // Carregar cliente
      const customerData = await Customer.get(customerId);
      if (!customerData || customerData.tenant_id !== activeTenant.id) {
        toast({
          title: "Erro",
          description: "Cliente não encontrado.",
          variant: "destructive"
        });
        navigate(createPageUrl("Customers"));
        return;
      }
      
      setCustomer(customerData);

      // Carregar pets do cliente
      loadPets();
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os dados do cliente.",
        variant: "destructive"
      });
      navigate(createPageUrl("Customers"));
    } finally {
      setIsLoading(false);
    }
  };

  const loadPets = async () => {
    try {
      const petsData = await Pet.filter({ 
        customer_id: customerId,
        tenant_id: currentTenant?.id 
      });
      setPets(petsData || []);
    } catch (error) {
      console.error("Erro ao carregar pets:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os pets do cliente.",
        variant: "destructive"
      });
      setPets([]);
    }
  };

  const handleCustomerSave = () => {
    toast({
      title: "Cliente atualizado",
      description: "As informações do cliente foram atualizadas com sucesso."
    });
    loadData();
  };

  const handlePetSave = async (newPet) => {
    try {
      // Atualiza a lista de pets imediatamente
      if (newPet) {
        setPets(prevPets => [...prevPets, newPet]);
      } else {
        // Se não houver novo pet (caso de edição), recarrega a lista
        await loadPets();
      }
      
      // Fecha o modal
      setShowAddPetDialog(false);
      setEditingPet(null);
      
      toast({
        title: "Pet salvo",
        description: "As informações do pet foram salvas com sucesso."
      });
    } catch (error) {
      console.error("Erro ao salvar pet:", error);
      toast({
        title: "Erro",
        description: "Não foi possível salvar o pet.",
        variant: "destructive"
      });
    }
  };

  const handleEditPet = (pet) => {
    setEditingPet(pet);
    setShowAddPetDialog(true);
  };

  const handlePetClick = (petId) => {
    navigate(createPageUrl(`PetDetails?id=${petId}`));
  };

  if (isLoading) {
    return (
      <div className="container mx-auto py-6 flex justify-center items-center min-h-[80vh]">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6">
      <Button
        variant="ghost"
        className="mb-6"
        onClick={() => navigate(createPageUrl("CustomerDetails?id=" + customerId))}
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Voltar para detalhes do cliente
      </Button>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-2xl flex items-center">
            <UserCircle className="w-6 h-6 mr-2 text-blue-500" />
            Editar Cliente: {customer.full_name}
          </CardTitle>
        </CardHeader>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="details">Dados do Cliente</TabsTrigger>
          <TabsTrigger value="pets">Pets ({pets.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="details">
          <EditCustomerForm
            customerId={customerId}
            onSuccess={handleCustomerSave}
            onCancel={() => navigate(createPageUrl("CustomerDetails?id=" + customerId))}
          />
        </TabsContent>

        <TabsContent value="pets">
          <Card className="mb-6">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xl">
                <div className="flex items-center">
                  <PawPrint className="w-5 h-5 mr-2 text-blue-500" />
                  Pets do Cliente
                </div>
              </CardTitle>
              <Button onClick={() => setShowAddPetDialog(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Adicionar Pet
              </Button>
            </CardHeader>
            <CardContent>
              <PetList 
                pets={pets} 
                customerId={customerId}
                tenantId={currentTenant?.id}
                onPetAdded={handlePetSave}
                onEditPet={handleEditPet} 
                onPetClick={handlePetClick}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={showAddPetDialog} onOpenChange={setShowAddPetDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingPet ? `Editar Pet: ${editingPet.name}` : "Adicionar Novo Pet"}
            </DialogTitle>
            <DialogDescription>
              {editingPet 
                ? "Edite as informações do pet selecionado." 
                : "Preencha as informações para adicionar um novo pet ao cliente."}
            </DialogDescription>
          </DialogHeader>
          <PetForm
            pet={editingPet}
            ownerId={customerId}
            trialId={currentTenant?.id}
            onSuccess={handlePetSave}
            onCancel={() => {
              setShowAddPetDialog(false);
              setEditingPet(null);
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}