import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Customer, Pet, CancellationReason } from "@/api/entities";
import { createPageUrl } from "@/utils";
import { toast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dog, CalendarDays as Calendar, Plus, Edit, ArrowLeft, User, Mail, Phone, MapPin, Loader2, Settings, Trash2, AlertCircle, ToggleRight, UserX } from "lucide-react";
import PetForm from "@/components/pets/PetForm";
import CustomerForm from "@/components/customers/CustomerForm";
import PetAvatar from "@/components/pets/PetAvatar";
import { format, parseISO } from "date-fns";

export default function CustomerDetailsPage() {
  console.log('[CustomerDetailsPage] Componente montado/renderizado.');
  const navigate = useNavigate();
  const { id } = useParams();
  const [customer, setCustomer] = useState(null);
  const [pets, setPets] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showNewPetDialog, setShowNewPetDialog] = useState(false);
  const [showEditCustomerDialog, setShowEditCustomerDialog] = useState(false);
  const [showInactivateDialog, setShowInactivateDialog] = useState(false);
  const [reasons, setReasons] = useState([]);
  const [isLoadingReasons, setIsLoadingReasons] = useState(false);
  const [selectedReason, setSelectedReason] = useState('');
  const [otherReason, setOtherReason] = useState('');
  const [showOtherInput, setShowOtherInput] = useState(false);
  const [inactivationReasonName, setInactivationReasonName] = useState('Carregando motivo...');

  useEffect(() => {
    loadData();
  }, [id]);

  useEffect(() => {
    if (showInactivateDialog) {
      const loadReasons = async () => {
        setIsLoadingReasons(true);
        try {
          const tenantId = localStorage.getItem('current_tenant');
          if (!tenantId) {
             console.error("Tenant ID not found for loading reasons.");
             toast({ title: "Erro", description: "ID da clínica não encontrado.", variant: "destructive" });
             setReasons([]);
             return;
          }
          console.log("[CustomerDetailsPage] Loading cancellation reasons for tenant:", tenantId);
          const loadedReasons = await CancellationReason.list(tenantId);
          console.log("[CustomerDetailsPage] Reasons loaded:", loadedReasons);
          setReasons(Array.isArray(loadedReasons) ? loadedReasons : []);
        } catch (error) {
           console.error("Error loading cancellation reasons:", error);
           toast({ title: "Erro", description: "Não foi possível carregar os motivos.", variant: "destructive" });
           setReasons([]); 
        } finally {
            setIsLoadingReasons(false);
        }
      };
      loadReasons();
      
      setSelectedReason('');
      setOtherReason('');
      setShowOtherInput(false);
    }
  }, [showInactivateDialog]);

  useEffect(() => {
    const fetchInactivationReason = async () => {
      if (customer?.status === 'inactive' && customer.inactivation_reason_id) {
        console.log("[CustomerDetailsPage] Fetching inactivation reason name for ID:", customer.inactivation_reason_id);
        setInactivationReasonName('Carregando motivo...');
        try {
          const reasonDoc = await CancellationReason.get(customer.inactivation_reason_id);
          if (reasonDoc && reasonDoc.reason) {
             console.log("[CustomerDetailsPage] Reason name found:", reasonDoc.reason);
             setInactivationReasonName(reasonDoc.reason);
          } else {
             console.warn("Reason document or reason field not found for ID:", customer.inactivation_reason_id);
             setInactivationReasonName('Motivo não encontrado');
          }
        } catch (error) {
          console.error("Error fetching inactivation reason name:", error);
          setInactivationReasonName('Erro ao buscar motivo');
        }
      } else {
        setInactivationReasonName('');
      }
    };

    fetchInactivationReason();

  }, [customer]);

  const handleReasonChange = (value) => {
    console.log("[CustomerDetailsPage] Reason selected:", value);
    setSelectedReason(value);
    if (value === '__other__') {
      setShowOtherInput(true);
    } else {
      setShowOtherInput(false);
      setOtherReason(''); 
    }
  };

  const loadData = async () => {
    console.log('[CustomerDetailsPage] loadData iniciado com id:', id);
    setIsLoading(true);
    try {
      const currentTenant = localStorage.getItem('current_tenant');

      if (!currentTenant) {
        console.log('[CustomerDetailsPage] Tenant não encontrado, redirecionando para Landing.');
        navigate(createPageUrl("Landing"));
        return;
      }

      if (!id) {
        console.log('[CustomerDetailsPage] ID do cliente não encontrado (via useParams), redirecionando para Customers.');
        navigate(createPageUrl("Customers"));
        return;
      }
      
      console.log(`[CustomerDetailsPage] Buscando Customer.get(${id}) e Pet.filter({ owner_id: ${id} })`);
      const [customerData, petsData] = await Promise.all([
        Customer.get(id),
        Pet.filter(id)
      ]);

      if (!customerData) {
        console.warn(`[CustomerDetailsPage] Cliente com ID ${id} não encontrado no Firestore.`);
        toast({
          title: "Erro",
          description: "Cliente não encontrado.",
          variant: "destructive"
        });
        navigate(createPageUrl("Customers"));
        return;
      }

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
    navigate(`/tenant/pet/${petId}?store=${storeParam}`);
  };

  const handleInactivate = async () => {
    if (!selectedReason || (selectedReason === '__other__' && !otherReason.trim())) {
       toast({ title: "Erro", description: "Selecione ou digite um motivo válido.", variant: "destructive" });
       return;
    }
    
    let finalReasonId = selectedReason;
    const reasonValue = otherReason.trim();
    const tenantId = localStorage.getItem('current_tenant');

    if (!tenantId) {
       toast({ title: "Erro", description: "Tenant não identificado.", variant: "destructive" });
       return;
    }

    setIsLoading(true); 
    try {
      if (finalReasonId === '__other__') {
         console.log("[CustomerDetailsPage] Creating new 'other' reason:", reasonValue);
         const newReason = await CancellationReason.create({
           reason: reasonValue,
           tenant_id: tenantId
         });
         finalReasonId = newReason.id;
         console.log("[CustomerDetailsPage] New reason created with ID:", finalReasonId);
      }

      console.log(`[CustomerDetailsPage] Inactivating customer ${id} with reason ID: ${finalReasonId}`);
      await Customer.inactivate(id, finalReasonId);

      toast({
        title: "Sucesso",
        description: "Cliente inativado com sucesso!",
      });
      setShowInactivateDialog(false);
      loadData(); 

    } catch (error) {
      console.error("Erro ao inativar cliente:", error);
      toast({
        title: "Erro",
        description: `Não foi possível inativar o cliente: ${error.message}`,
        variant: "destructive"
      });
    } finally {
      setIsLoading(false); 
    }
  };

  // <<< Função auxiliar para formatar Timestamp do Firebase >>>
  const formatDateSafe = (timestamp) => {
    // Tenta usar o timestamp diretamente se for válido
    if (timestamp && typeof timestamp.toDate === 'function') { 
      try {
        // <<< Adiciona HH:mm para mostrar horário >>>
        return format(timestamp.toDate(), 'dd/MM/yyyy HH:mm'); 
      } catch (e) {
        console.error("Erro ao formatar data (Timestamp inválido?):", timestamp, e);
        return "Data inválida";
      }
    } 
    // Fallback se o timestamp não for um objeto Timestamp válido
    // Isso pode acontecer se for string ou número, ou se o campo não existir
    console.warn("[formatDateSafe] Recebido valor não-Timestamp ou nulo:", timestamp);
    // Tentativa de converter se for uma string/número que possa ser data (menos ideal)
    try {
       const date = new Date(timestamp); 
       if (!isNaN(date.getTime())) { 
            return format(date, 'dd/MM/yyyy HH:mm');
       }
    } catch (e) {
        // Ignora o erro se a conversão falhar, prossegue para o retorno padrão
        console.log("Ignorando erro ao tentar converter data não-timestamp:", e); 
    }
    
    return "Data não informada"; // Retorno padrão
  };

  if (isLoading && !customer) {
    return (
      <div className="flex justify-center items-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (!customer) {
    return null;
  }

  const isInactive = customer?.status === 'inactive';

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
            <h1 className="text-2xl font-bold flex items-center gap-2">
              {customer.full_name}
              {isInactive && <Badge variant="destructive">Inativo</Badge>}
            </h1>
            <p className="text-sm text-gray-500">
             Cliente desde {formatDateSafe(customer.created_at || customer.created_date)}
             {/* Mostra data de reativação se ativo e tiver o campo */}
             {customer.status !== 'inactive' && customer.last_reactivation_at &&
               ` | Reativado em: ${formatDateSafe(customer.last_reactivation_at)}`
             } {/* <--- Esta chave pode estar causando o problema */}
          </p>
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" disabled={isLoading}>
              <Settings className="h-4 w-4 mr-2" />
              Ações
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {isInactive ? (
              <DropdownMenuItem 
                onClick={() => setShowEditCustomerDialog(true)}
                disabled={isLoading}
              >
                <ToggleRight className="mr-2 h-4 w-4" />
                <span>Reativar / Editar</span>
              </DropdownMenuItem>
            ) : (
              <>
                <DropdownMenuItem 
                  onClick={() => setShowEditCustomerDialog(true)} 
                  disabled={isLoading} 
                >
                  <Edit className="mr-2 h-4 w-4" />
                  <span>Editar Dados</span>
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => setShowInactivateDialog(true)}
                  disabled={isLoading}
                  className="text-red-600 focus:text-red-700 focus:bg-red-50"
                >
                  <UserX className="mr-2 h-4 w-4" />
                  <span>Inativar Cliente</span>
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Card de Histórico de Inativação - Mostra sempre que houver data */}
      {customer.inactivation_date && (
        <Card className={`mb-6 ${isInactive ? 'border-red-200 bg-red-50' : 'border-gray-200 bg-gray-50'}`}> {/* Muda estilo se ativo */}
          <CardHeader>
             {/* Mantém título vermelho se inativo, senão um título neutro */}
            <CardTitle className={`${isInactive ? 'text-red-700' : 'text-gray-700'} flex items-center gap-2`}>
              {isInactive ? <AlertCircle className="h-5 w-5"/> : <Calendar className="h-5 w-5"/> } 
              Histórico de Status
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
             <p><strong>Última Inativação:</strong> {formatDateSafe(customer.inactivation_date)}</p>
             {/* Só mostra o motivo se ele existir (pode não ter sido buscado ainda se reativado recentemente) */}
             {inactivationReasonName && 
                <p><strong>Motivo:</strong> {inactivationReasonName}</p> 
             }
             {/* Mostra reativação se aplicável */}
             {customer.last_reactivation_at &&
                <p><strong>Última Reativação:</strong> {formatDateSafe(customer.last_reactivation_at)}</p>
             }
          </CardContent>
        </Card>
      )}

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
              {pets.map((pet) => {
                let deathDateFormatted = '';
                if (pet.is_inactive && pet.inactivation_reason === 'Óbito' && pet.date_of_death) {
                  try {
                    deathDateFormatted = format(parseISO(pet.date_of_death), 'dd/MM/yyyy');
                  } catch {
                    deathDateFormatted = 'Data inválida';
                  }
                }

                return (
                  <div
                    key={pet.id}
                    className={`p-4 border rounded-lg hover:bg-gray-50 cursor-pointer ${pet.is_inactive ? 'opacity-60' : ''}`}
                    onClick={() => handleViewPet(pet.id)}
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <PetAvatar pet={pet} size="md" />
                      <div>
                        <h3 className="font-medium">{pet.name}</h3>
                        <p className="text-sm text-gray-500">
                          {pet.species === 'dog' ? 'Cachorro' : pet.species === 'cat' ? 'Gato' : pet.species} • {pet.breed}
                        </p>
                      </div>
                    </div>
                    {pet.is_inactive && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        <Badge variant="destructive">Inativo</Badge>
                        {pet.inactivation_reason && (
                          <Badge variant="secondary">{pet.inactivation_reason}</Badge>
                        )}
                        {deathDateFormatted && (
                           <Badge variant="secondary">{deathDateFormatted}</Badge>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
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
          <DialogFooter className="mt-4">
            <DialogClose asChild>
              <Button type="button" variant="outline">Cancelar</Button>
            </DialogClose>
            <Button type="submit" form="pet-form">Salvar Novo Pet</Button>
          </DialogFooter>
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
              customer={customer}
            />
          </div>
          <DialogFooter className="mt-4">
            <DialogClose asChild>
              <Button type="button" variant="outline">Cancelar</Button>
            </DialogClose>
            <Button type="submit" form="customer-form">Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showInactivateDialog} onOpenChange={setShowInactivateDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="text-red-600">Inativar Cliente</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja inativar o cliente <strong>{customer?.full_name}</strong>? 
              Esta ação não pode ser desfeita facilmente. Selecione o motivo abaixo.
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4 space-y-4">
             <div className="space-y-2">
               <Label htmlFor="reason-select">Motivo da Inativação*</Label>
               <Select value={selectedReason} onValueChange={handleReasonChange} disabled={isLoadingReasons}>
                 <SelectTrigger id="reason-select">
                   <SelectValue placeholder={isLoadingReasons ? "Carregando motivos..." : "Selecione um motivo..."} />
                 </SelectTrigger>
                 <SelectContent>
                   {reasons.map((reasonDoc) => (
                     <SelectItem key={reasonDoc.id} value={reasonDoc.id}> 
                       {reasonDoc.reason} 
                     </SelectItem>
                   ))}
                   <SelectItem value="__other__">Outros...</SelectItem>
                 </SelectContent>
               </Select>
             </div>

             {showOtherInput && (
               <div className="space-y-2">
                 <Label htmlFor="other-reason">Especificar Motivo*</Label>
                 <Input 
                   id="other-reason"
                   value={otherReason}
                   onChange={(e) => setOtherReason(e.target.value)}
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
              onClick={handleInactivate} 
              disabled={isLoading || isLoadingReasons || !selectedReason || (selectedReason === '__other__' && !otherReason.trim())}
            >
               {isLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Trash2 className="h-4 w-4 mr-2" />} 
               Confirmar Inativação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
