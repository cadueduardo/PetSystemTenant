import React, { useState, useEffect } from "react";
import { Customer } from "@/api/entities";
import { Pet } from "@/api/entities";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "@/components/ui/use-toast";
import {
  Plus,
  Search,
  Edit,
  Trash2,
  PawPrint,
  Phone,
  Mail,
  MapPin,
  Loader2
} from "lucide-react";
import CustomerForm from "../components/customers/CustomerForm";

export default function CustomersPage() {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState([]);
  const [pets, setPets] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [showForm, setShowForm] = useState(false);
  const storeParam = localStorage.getItem('current_tenant');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      // Carregar clientes e pets em paralelo, filtrando por tenant
      const [customersData, petsData] = await Promise.all([
        Customer.filter({ tenant_id: storeParam }),
        Pet.filter({ tenant_id: storeParam })
      ]);
      
      setCustomers(customersData);
      setPets(petsData);
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os dados.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleEdit = (customerId) => {
    navigate(createPageUrl(`CustomerDetails?id=${customerId}&store=${storeParam}`));
  };

  const handleDelete = async (id) => {
    if (!confirm("Tem certeza que deseja excluir este cliente?")) return;

    try {
      await Customer.delete(id);
      toast({
        title: "Sucesso",
        description: "Cliente excluído com sucesso!"
      });
      loadData();
    } catch (error) {
      toast({
        title: "Erro",
        description: "Não foi possível excluir o cliente.",
        variant: "destructive"
      });
    }
  };

  const getPetsForCustomer = (customerId) => {
    return pets.filter(pet => pet.owner_id === customerId);
  };

  const filteredCustomers = customers.filter(customer =>
    customer.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    customer.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    customer.phone?.includes(searchQuery)
  );

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-full p-8">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Clientes</h1>
        <Button onClick={() => setShowForm(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Cliente
        </Button>
      </div>

      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
          <Input
            placeholder="Buscar clientes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Contato</TableHead>
              <TableHead>Endereço</TableHead>
              <TableHead>Pets</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredCustomers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-gray-500">
                  Nenhum cliente encontrado.
                </TableCell>
              </TableRow>
            ) : (
              filteredCustomers.map((customer) => {
                const customerPets = getPetsForCustomer(customer.id);
                
                return (
                  <TableRow key={customer.id}>
                    <TableCell onClick={() => handleEdit(customer.id)} className="cursor-pointer">
                      <div className="font-medium">{customer.full_name}</div>
                      <div className="text-sm text-gray-500">{customer.cpf}</div>
                    </TableCell>
                    <TableCell onClick={() => handleEdit(customer.id)} className="cursor-pointer">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center text-sm text-gray-600">
                          <Phone className="h-4 w-4 mr-2" />
                          {customer.phone}
                        </div>
                        <div className="flex items-center text-sm text-gray-600">
                          <Mail className="h-4 w-4 mr-2" />
                          {customer.email}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell onClick={() => handleEdit(customer.id)} className="cursor-pointer">
                      <div className="flex items-start text-sm text-gray-600">
                        <MapPin className="h-4 w-4 mr-2 mt-0.5" />
                        <div>
                          {customer.address}, {customer.address_number}
                          <br />
                          {customer.neighborhood}, {customer.city}/{customer.state}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell onClick={() => handleEdit(customer.id)} className="cursor-pointer">
                      {customerPets.length > 0 ? (
                        <div className="flex flex-col gap-1">
                          {customerPets.map(pet => (
                            <div key={pet.id} className="flex items-center text-sm">
                              <PawPrint className="h-4 w-4 mr-1.5 text-gray-500" />
                              <span>{pet.name} ({pet.species === 'dog' ? 'Cão' : 'Gato'}, {pet.breed})</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="text-sm text-gray-500">Sem pets cadastrados</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEdit(customer.id);
                          }}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="destructive" 
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(customer.id);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {showForm && (
        <CustomerForm
          open={showForm}
          onOpenChange={setShowForm}
          onSuccess={() => {
            setShowForm(false);
            loadData();
          }}
        />
      )}
    </div>
  );
}