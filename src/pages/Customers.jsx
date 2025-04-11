import { useState, useEffect } from "react";
import { Customer, Pet, CancellationReason } from "@/api/entities";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
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
  PawPrint,
  Phone,
  Mail,
  MapPin,
  Loader2,
  MoreHorizontal,
  Eye,
  ToggleRight,
  UserX
} from "lucide-react";
import CustomerForm from "../components/customers/CustomerForm";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  AlertDialog, 
  AlertDialogAction, 
  AlertDialogCancel, 
  AlertDialogContent, 
  AlertDialogDescription, 
  AlertDialogFooter, 
  AlertDialogHeader, 
  AlertDialogTitle 
} from "@/components/ui/alert-dialog";

export default function CustomersPage() {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState([]);
  const [pets, setPets] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [showInactive, setShowInactive] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [showInactivateModal, setShowInactivateModal] = useState(false);
  const [inactivatingCustomer, setInactivatingCustomer] = useState(null);
  const [inactivateReasons, setInactivateReasons] = useState([]);
  const [isLoadingInactivateReasons, setIsLoadingInactivateReasons] = useState(false);
  const [selectedInactivateReason, setSelectedInactivateReason] = useState('');
  const [otherInactivateReason, setOtherInactivateReason] = useState('');
  const [showOtherInactivateInput, setShowOtherInactivateInput] = useState(false);
  const [showPetConfirmationAlert, setShowPetConfirmationAlert] = useState(false);
  const [reactivatedCustomerData, setReactivatedCustomerData] = useState(null);
  const storeParam = localStorage.getItem('current_tenant');

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (showInactivateModal) {
      const loadReasons = async () => {
        setIsLoadingInactivateReasons(true);
        try {
          const tenantId = localStorage.getItem('current_tenant');
          if (!tenantId) throw new Error("Tenant ID não encontrado");
          console.log("[CustomersPage] Loading inactivation reasons for tenant:", tenantId);
          const loadedReasons = await CancellationReason.list(tenantId);
          setInactivateReasons(Array.isArray(loadedReasons) ? loadedReasons : []);
        } catch (error) {
           console.error("Error loading inactivation reasons:", error);
           toast({ title: "Erro", description: "Não foi possível carregar os motivos de inativação.", variant: "destructive" });
           setInactivateReasons([]); 
        } finally {
            setIsLoadingInactivateReasons(false);
        }
      };
      loadReasons();
      setSelectedInactivateReason('');
      setOtherInactivateReason('');
      setShowOtherInactivateInput(false);
    }
  }, [showInactivateModal]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [customersData, petsData] = await Promise.all([
        Customer.filter({ tenant_id: storeParam }),
        Pet.filter({ tenant_id: storeParam })
      ]);
      
      customersData.sort((a, b) => a.full_name.localeCompare(b.full_name));

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

  const navigateToCustomerDetails = (customerId) => {
      navigate(createPageUrl('CustomerDetails', { id: customerId }));
  };

  const handleViewDetails = (customerId) => {
      navigateToCustomerDetails(customerId);
  };

  const handleOpenEditModal = async (customerId) => {
    console.log('[CustomersPage] handleOpenEditModal for customer ID:', customerId);
    setIsLoading(true);
    try {
      const customerData = await Customer.get(customerId);
      if (customerData) {
        setEditingCustomer(customerData);
        setShowEditModal(true);
      } else {
        toast({ title: "Erro", description: "Cliente não encontrado para edição.", variant: "destructive" });
      }
    } catch (error) {
      console.error("Erro ao buscar cliente para edição:", error);
      toast({ title: "Erro", description: "Não foi possível carregar dados para edição.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenInactivateModal = (customerId) => {
    const customerToInactivate = customers.find(c => c.id === customerId);
    if (customerToInactivate) {
       console.log('[CustomersPage] Opening inactivate modal for:', customerToInactivate);
       setInactivatingCustomer(customerToInactivate);
       setShowInactivateModal(true);
    } else {
       console.error("Cliente não encontrado na lista local para inativar:", customerId);
       toast({ title: "Erro", description: "Cliente não encontrado.", variant: "destructive" });
    }
  };

  const handleInactivateReasonChange = (value) => {
    setSelectedInactivateReason(value);
    setShowOtherInactivateInput(value === '__other__');
    if (value !== '__other__') {
      setOtherInactivateReason('');
    }
  };

  const handleConfirmInactivate = async () => {
     if (!inactivatingCustomer || !selectedInactivateReason || (selectedInactivateReason === '__other__' && !otherInactivateReason.trim())) {
       toast({ title: "Erro", description: "Selecione ou digite um motivo válido.", variant: "destructive" });
       return;
     }
     
     let finalReasonId = selectedInactivateReason;
     const reasonValue = otherInactivateReason.trim();
     const tenantId = localStorage.getItem('current_tenant');
     const customerIdToInactivate = inactivatingCustomer.id;

     if (!tenantId) {
       toast({ title: "Erro", description: "Tenant não identificado.", variant: "destructive" });
       return;
     }

     setIsLoading(true);
     try {
       if (finalReasonId === '__other__') {
         console.log("[CustomersPage] Creating new inactivation reason:", reasonValue);
         const newReason = await CancellationReason.create({ reason: reasonValue, tenant_id: tenantId });
         finalReasonId = newReason.id;
       }

       console.log(`[CustomersPage] Inactivating customer ${customerIdToInactivate} with reason ID: ${finalReasonId}`);
       await Customer.inactivate(customerIdToInactivate, finalReasonId);

       toast({ title: "Sucesso", description: "Cliente inativado com sucesso!" });
       setShowInactivateModal(false);
       setInactivatingCustomer(null);
       loadData();

     } catch (error) {
       console.error("Erro ao inativar cliente:", error);
       toast({ title: "Erro", description: `Não foi possível inativar o cliente: ${error.message}`, variant: "destructive" });
     } finally {
       setIsLoading(false);
     }
  };

  const getPetsForCustomer = (customerId) => {
    return pets.filter(pet => pet.owner_id === customerId);
  };

  const filteredCustomers = customers.filter(customer => {
    const matchesSearch = 
      customer.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      customer.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      customer.phone?.includes(searchQuery) ||
      customer.cpf?.includes(searchQuery);

    const matchesStatus = showInactive ? customer.status === 'inactive' : customer.status !== 'inactive';
    
    return matchesSearch && matchesStatus;
  });

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

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div className="relative flex-grow w-full md:w-auto">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
          <Input
            placeholder="Buscar por nome, email, telefone ou CPF..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex items-center space-x-2">
          <Switch 
            id="show-inactive"
            checked={showInactive}
            onCheckedChange={setShowInactive} 
          />
          <Label htmlFor="show-inactive">Mostrar inativos</Label>
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
                const isInactive = customer.status === 'inactive';
                
                return (
                  <TableRow key={customer.id} className={isInactive ? 'opacity-60' : ''} data-testid={`customer-row-${customer.id}`}>
                    <TableCell onClick={() => handleViewDetails(customer.id)} className="cursor-pointer">
                      <div className="font-medium flex items-center gap-2">
                        {customer.full_name}
                        {isInactive && <Badge variant="outline" className="text-xs">Inativo</Badge>}
                      </div>
                      <div className="text-sm text-gray-500">{customer.cpf}</div>
                    </TableCell>
                    <TableCell onClick={() => handleViewDetails(customer.id)} className="cursor-pointer">
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
                    <TableCell onClick={() => handleViewDetails(customer.id)} className="cursor-pointer">
                      <div className="flex items-start text-sm text-gray-600">
                        <MapPin className="h-4 w-4 mr-2 mt-0.5" />
                        <div>
                          {customer.address}, {customer.address_number}
                          <br />
                          {customer.neighborhood}, {customer.city}/{customer.state}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell onClick={() => handleViewDetails(customer.id)} className="cursor-pointer">
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
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                            <span className="sr-only">Abrir menu</span>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleViewDetails(customer.id)}>
                            <Eye className="mr-2 h-4 w-4" />
                            <span>Ver Detalhes</span>
                          </DropdownMenuItem>

                          {isInactive ? (
                            <DropdownMenuItem onClick={() => handleOpenEditModal(customer.id)}>
                              <ToggleRight className="mr-2 h-4 w-4" />
                              <span>Reativar / Editar</span>
                            </DropdownMenuItem>
                          ) : (
                            <>
                              <DropdownMenuItem onClick={() => handleOpenEditModal(customer.id)}>
                                <Edit className="mr-2 h-4 w-4" />
                                <span>Editar Dados</span>
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                onClick={() => handleOpenInactivateModal(customer.id)}
                                className="text-red-600 focus:text-red-700 focus:bg-red-50"
                              >
                                <UserX className="mr-2 h-4 w-4" />
                                <span>Inativar Cliente</span>
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="sm:max-w-[625px]">
          <DialogHeader>
            <DialogTitle>Novo Cliente</DialogTitle>
            <DialogDescription>
              Preencha os dados do novo cliente.
            </DialogDescription>
          </DialogHeader>
          <CustomerForm 
             customer={null}
             onSuccess={() => { 
               setShowForm(false);
               loadData();
             }}
          />
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">Cancelar</Button>
            </DialogClose>
            <Button 
              type="submit" 
              form="customer-form"
            >
              Salvar Cliente
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent className="sm:max-w-[625px]">
          <DialogHeader>
            <DialogTitle>{editingCustomer?.status === 'inactive' ? 'Reativar / Editar Cliente' : 'Editar Cliente'}</DialogTitle>
            <DialogDescription>
              {editingCustomer?.status === 'inactive' 
                ? `Revise e atualize os dados de ${editingCustomer?.full_name} antes de reativar.`
                : `Atualize os dados de ${editingCustomer?.full_name}.`
              }
            </DialogDescription>
          </DialogHeader>
          {editingCustomer && (
            <CustomerForm 
              key={editingCustomer.id}
              customer={editingCustomer} 
              onSuccess={(updatedCustomerData) => {
                setShowEditModal(false);
                toast({ title: "Sucesso", description: `Cliente ${updatedCustomerData?.status === 'active' ? 'reativado' : 'atualizado'} com sucesso!` });
                loadData();
                setEditingCustomer(null);
                if (updatedCustomerData?.status === 'active') {
                    console.log("Cliente reativado, mostrando alerta de pet para:", updatedCustomerData);
                    setReactivatedCustomerData(updatedCustomerData);
                    setShowPetConfirmationAlert(true);
                }
              }}
            />
          )}
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">Cancelar</Button>
            </DialogClose>
            <Button 
              type="submit" 
              form="customer-form"
            >
              {editingCustomer?.status === 'inactive' ? 'Salvar e Reativar' : 'Salvar Alterações'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showInactivateModal} onOpenChange={setShowInactivateModal}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="text-red-600">Inativar Cliente</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja inativar o cliente <strong>{inactivatingCustomer?.full_name}</strong>? 
              Selecione o motivo abaixo.
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4 space-y-4">
             <div className="space-y-2">
               <Label htmlFor="inactivate-reason-select">Motivo da Inativação*</Label>
               <Select 
                 value={selectedInactivateReason} 
                 onValueChange={handleInactivateReasonChange} 
                 disabled={isLoadingInactivateReasons || isLoading}
               >
                 <SelectTrigger id="inactivate-reason-select">
                   <SelectValue placeholder={isLoadingInactivateReasons ? "Carregando..." : "Selecione..."} />
                 </SelectTrigger>
                 <SelectContent>
                   {inactivateReasons.map((reasonDoc) => (
                     <SelectItem key={reasonDoc.id} value={reasonDoc.id}> 
                       {reasonDoc.reason} 
                     </SelectItem>
                   ))}
                   <SelectItem value="__other__">Outros...</SelectItem>
                 </SelectContent>
               </Select>
             </div>

             {showOtherInactivateInput && (
               <div className="space-y-2">
                 <Label htmlFor="other-inactivate-reason">Especificar Motivo*</Label>
                 <Input 
                   id="other-inactivate-reason"
                   value={otherInactivateReason}
                   onChange={(e) => setOtherInactivateReason(e.target.value)}
                   placeholder="Digite o novo motivo..."
                   disabled={isLoading}
                 />
               </div>
             )}
           </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={isLoading}>Cancelar</Button> 
            </DialogClose>
            <Button 
              variant="destructive" 
              onClick={handleConfirmInactivate} 
              disabled={isLoading || isLoadingInactivateReasons || !selectedInactivateReason || (selectedInactivateReason === '__other__' && !otherInactivateReason.trim())}
            >
               {isLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <UserX className="h-4 w-4 mr-2" />} 
               Confirmar Inativação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showPetConfirmationAlert} onOpenChange={setShowPetConfirmationAlert}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Pets</AlertDialogTitle>
            <AlertDialogDescription>
              O cliente <strong>{reactivatedCustomerData?.full_name}</strong> foi reativado. Os pets associados a ele ainda são os mesmos?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setReactivatedCustomerData(null)}>Sim, manter pets</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => {
                if (reactivatedCustomerData?.id) {
                   navigateToCustomerDetails(reactivatedCustomerData.id);
                }
                setReactivatedCustomerData(null);
              }}
            >
              Não, gerenciar pets
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}