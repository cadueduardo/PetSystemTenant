import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Customer } from "@/api/entities";
import { Pet } from "@/api/entities";
import { 
  ArrowLeft, 
  User, 
  Mail, 
  Phone, 
  MapPin, 
  Plus, 
  Edit,
  Calendar,
  Loader2,
  Dog
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import PetForm from "../components/pets/PetForm";
import CustomerForm from "../components/customers/CustomerForm";

export default function CustomerDetailsPage() {
  const navigate = useNavigate();
  const [customer, setCustomer] = useState(null);
  const [pets, setPets] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showNewPetDialog, setShowNewPetDialog] = useState(false);
  const [showEditCustomerDialog, setShowEditCustomerDialog] = useState(false);
  const [selectedModules, setSelectedModules] = useState([]);

  useEffect(() => {
    const modules = JSON.parse(localStorage.getItem('tenant_modules') || '[]');
    setSelectedModules(modules);
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const customerId = urlParams.get('id');
      const currentTenant = localStorage.getItem('current_tenant');

      if (!currentTenant) {
        navigate(createPageUrl("Landing"));
        return;
      }

      if (!customerId) {
        navigate(createPageUrl("Customers"));
        return;
      }

      const [customerData, petsData] = await Promise.all([
        Customer.get(customerId),
        Pet.filter({ owner_id: customerId })
      ]);

      if (customerData.tenant_id !== currentTenant) {
        throw new Error("Cliente não pertence a este tenant");
      }

      setCustomer(customerData);
      setPets(petsData);
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

  const handlePetSuccess = () => {
    setShowNewPetDialog(false);
    loadData();
    toast({
      title: "Sucesso",
      description: "Pet salvo com sucesso!"
    });
  };

  const handleCustomerSuccess = () => {
    setShowEditCustomerDialog(false);
    loadData();
    toast({
      title: "Sucesso",
      description: "Cliente atualizado com sucesso!"
    });
  };

  const handleViewPet = (petId) => {
    const storeParam = localStorage.getItem('current_tenant');
    navigate(createPageUrl(`PetDetails?id=${petId}&store=${storeParam}`));
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (!customer) {
    return null;
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate(createPageUrl("Customers"))}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{customer.full_name}</h1>
            <p className="text-gray-500">Cliente desde {new Date(customer.created_date).toLocaleDateString()}</p>
          </div>
        </div>
        <Button onClick={() => setShowEditCustomerDialog(true)}>
          <Edit className="h-4 w-4 mr-2" />
          Editar Cliente
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <Card>
          <CardHeader>
            <CardTitle>Informações Pessoais</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <User className="h-5 w-5 text-gray-500" />
                <div>
                  <p className="text-sm text-gray-500">Nome</p>
                  <p className="font-medium">{customer.full_name}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="h-5 w-5 text-gray-500" />
                <div>
                  <p className="text-sm text-gray-500">Email</p>
                  <p className="font-medium">{customer.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="h-5 w-5 text-gray-500" />
                <div>
                  <p className="text-sm text-gray-500">Telefone</p>
                  <p className="font-medium">{customer.phone}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="h-5 w-5 text-gray-500" />
                <div>
                  <p className="text-sm text-gray-500">Endereço</p>
                  <p className="font-medium">
                    {customer.address}, {customer.address_number}
                    {customer.address_complement && ` - ${customer.address_complement}`}
                  </p>
                  <p className="text-sm text-gray-500">
                    {customer.neighborhood}, {customer.city} - {customer.state}
                  </p>
                  <p className="text-sm text-gray-500">CEP: {customer.cep}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Estatísticas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-2">
                  <Dog className="h-5 w-5 text-blue-500" />
                  <span className="text-gray-600">Total de Pets</span>
                </div>
                <p className="text-2xl font-bold mt-2">{pets.length}</p>
              </div>
              
              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-purple-500" />
                  <span className="text-gray-600">Agendamentos</span>
                </div>
                <p className="text-2xl font-bold mt-2">0</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Pets</CardTitle>
              <CardDescription>Gerencie os pets deste cliente</CardDescription>
            </div>
            <Button onClick={() => setShowNewPetDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Novo Pet
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {pets.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-gray-500">Este cliente ainda não tem pets cadastrados.</p>
              <Button 
                variant="outline" 
                className="mt-4"
                onClick={() => setShowNewPetDialog(true)}
              >
                <Plus className="h-4 w-4 mr-2" />
                Adicionar Primeiro Pet
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {pets.map((pet) => (
                <div
                  key={pet.id}
                  className="p-4 border rounded-lg hover:bg-gray-50 cursor-pointer"
                  onClick={() => handleViewPet(pet.id)}
                >
                  <div className="flex items-center gap-3 mb-2">
                    <div className="bg-blue-100 p-2 rounded-full w-12 h-12 flex items-center justify-center overflow-hidden">
                      {pet.image_url ? (
                        <img 
                          src={pet.image_url} 
                          alt={pet.name}
                          className="w-full h-full object-cover rounded-full"
                        />
                      ) : (
                        <Dog className="h-5 w-5 text-blue-600" />
                      )}
                    </div>
                    <div>
                      <h3 className="font-medium">{pet.name}</h3>
                      <p className="text-sm text-gray-500">
                        {pet.species === 'dog' ? 'Cachorro' : 'Gato'} • {pet.breed}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={showNewPetDialog} onOpenChange={setShowNewPetDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Novo Pet</DialogTitle>
            <DialogDescription>
              Adicione um novo pet para {customer.full_name}
            </DialogDescription>
          </DialogHeader>
          <div className="overflow-y-auto max-h-[60vh] pr-2">
            <PetForm 
              onSuccess={handlePetSuccess} 
              customerId={customer.id}
            />
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showEditCustomerDialog} onOpenChange={setShowEditCustomerDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Cliente</DialogTitle>
            <DialogDescription>
              Atualize as informações de {customer.full_name}
            </DialogDescription>
          </DialogHeader>
          <div className="overflow-y-auto max-h-[60vh] pr-2">
            <CustomerForm 
              onSuccess={handleCustomerSuccess} 
              customerId={customer.id}
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
