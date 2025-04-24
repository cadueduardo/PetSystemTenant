import { useState, useEffect } from "react";
// import { useNavigate } from "react-router-dom"; // Remover
import { format, /* isBefore, isAfter, addMinutes, */ differenceInMinutes, parseISO, isSameDay } from "date-fns"; // Remover não usados
import { ptBR } from "date-fns/locale";
import { QueueService, Pet, Customer, Service, Appointment, /* CancellationReason */ } from "@/api/entities"; // Remover CancellationReason
import { db } from '@/lib/firebaseConfig'; // Importar db para onSnapshot
import { collection, query, where, onSnapshot, Timestamp } from "firebase/firestore"; // Importar funções do Firestore
// import { useTenant } from "@/components/tenant/TenantContext"; // Remover
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "../components/ui/use-toast";
import {
  // Calendar, // Remover
  Search,
  Clock,
  Loader2,
  CheckCircle2,
  PlayCircle,
  PauseCircle,
  XCircle,
  // Filter, // Remover
  // ChevronUp, // Remover
  // ChevronDown, // Remover
  Calendar as CalendarIcon,
  UserCircle,
  ClipboardList,
  Trophy,
  UserCheck,
  // Dog, // Remover
  // Cat // Remover
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "../components/ui/popover";
import { Calendar as CalendarComponent } from "../components/ui/calendar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import ServiceTimer from "../components/queue/ServiceTimer";
import ServiceDetailsPanel from "../components/queue/ServiceDetailsPanel";
import PetAvatar from "@/components/pets/PetAvatar";
import RemoveFromQueueModal from '../components/queue/RemoveFromQueueModal';
import { addRemovalReason } from '@/api/mockData';
import { addPendingItems } from "@/api/mock/chargeableItemService";
// import { Checkbox } from "@/components/ui/checkbox"; // Remover
import {
  // Play, // Remover
  // Pause, // Remover
  // CheckCircle, // Remover
  // Ban, // Remover
  // MoreHorizontal, // Remover
  // CalendarDays, // Remover
  // Edit2, // Remover
  // X, // Remover
  // Info, // Remover
} from "lucide-react"; // Remover bloco inteiro se vazio

export default function ServiceQueue() {
  const [queueItems, setQueueItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [currentView, setCurrentView] = useState("list");
  const [selectedService, setSelectedService] = useState(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [filterStatus, setFilterStatus] = useState("waiting");
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [notes, setNotes] = useState("");
  const [showAddNotesDialog, setShowAddNotesDialog] = useState(false);
  const [isRemoveModalOpen, setIsRemoveModalOpen] = useState(false);
  const [itemToRemove, setItemToRemove] = useState(null);
  const { toast } = useToast();

  // Define fetchQueueData FORA do useEffect para ser acessível por outros handlers
  const fetchQueueData = async () => {
      setIsLoading(true);
      try {
        const startOfDay = new Date(selectedDate);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(selectedDate);
        endOfDay.setHours(23, 59, 59, 999);
        const currentTenant = localStorage.getItem('current_tenant');

        // Busca os itens da QueueService usando .list()
        const queueItemsFromDB = await QueueService.list({
          // Filtro por data (ajustar se necessário para a implementação exata de .list)
          /* 
          appointment_date: {
            $gte: startOfDay.toISOString(),
            $lte: endOfDay.toISOString()
          },
          */
          tenant_id: currentTenant,
          // Pedir explicitamente os status relevantes para esta tela
          status: ['waiting', 'scheduled', 'in_progress', 'paused', 'completed']
        });
        // console.log('[ServiceQueue] Itens brutos da QueueService:', queueItemsFromDB); // Comentado - Muita informação

        // Mapeia e popula os dados corretamente
        const populatedAppointmentsPromises = queueItemsFromDB.map(async (item) => {
            try {
                if (!item.pet_id || !item.customer_id || !item.service_id) { 
                    console.warn("Item da fila com IDs faltando:", item); // Manter - Importante para dados inválidos
                    return { 
                        ...item, 
                        pet: { name: "Pet Inválido" }, 
                        customer: { full_name: "Cliente Inválido" },
                        service: { name: "Serviço Inválido" }
                    };
                 }
                 
                // Busca os dados relacionados em paralelo, incluindo o Appointment
                const [pet, customer, service, appointment] = await Promise.all([
                    Pet.get(item.pet_id).catch(e => { console.error(`Erro Pet ${item.pet_id}:`, e); return null; }), // Manter erro
                    Customer.get(item.customer_id).catch(e => { console.error(`Erro Customer ${item.customer_id}:`, e); return null; }), // Manter erro
                    Service.get(item.service_id).catch(e => { console.error(`Erro Service ${item.service_id}:`, e); return null; }), // Manter erro
                    // Adiciona a busca pelo Appointment usando appointment_id
                    item.appointment_id 
                        ? Appointment.get(item.appointment_id).catch(e => { console.error(`Erro Appointment ${item.appointment_id}:`, e); return null; }) // Manter erro
                        : Promise.resolve(null) // Resolve para null se não houver appointment_id
                ]);
                
                // Retorna o item populado, incluindo osNumber do appointment
                return {
                    ...item,
                    pet: pet || { name: "Pet não encontrado" },
                    customer: customer || { full_name: "Cliente não encontrado" },
                    service: service || { name: "Serviço não encontrado" },
                    // Adiciona osNumber do appointment, se existir
                    osNumber: appointment ? appointment.osNumber : null 
                };
            } catch (error) {
                console.error("Erro ao popular item da fila:", item.id, error); // Manter erro
                return { 
                    ...item, 
                    pet: { name: "Erro Pet" }, 
                    customer: { full_name: "Erro Cliente" },
                    service: { name: "Erro Serviço" }
                };
            }
        }); // Fim do .map

        // Aguarda todas as promises do map serem resolvidas
        const populatedAppointments = await Promise.all(populatedAppointmentsPromises);

        // Filtrar para incluir apenas itens cujo serviço seja do módulo 'petshop'
        const filteredPetshopAppointments = populatedAppointments.filter(item => {
          // Verifica se o serviço foi carregado e se pertence ao módulo 'petshop'
          // TODO: Confirmar se 'module' é o campo correto para identificar serviços de petshop
          return item.service && item.service.module === 'petshop';
        });

        // Log para verificar as datas antes de setar o estado (usar lista filtrada)
        // Comentado - Muita informação para debug atual
        // filteredPetshopAppointments.forEach(appt => {
        //     console.log(`[ServiceQueue Debug] ID: ${appt.id}, appointment_date: ${JSON.stringify(appt.appointment_date)}, typeof: ${typeof appt.appointment_date}`);
        // });

        // Define o estado com a lista filtrada
        setQueueItems(filteredPetshopAppointments);

      } catch (error) {
           console.error("Erro ao carregar fila:", error); // Manter erro principal
           toast({
             title: "Erro",
             description: "Não foi possível carregar a fila de atendimento.",
             variant: "destructive"
           });
      } finally {
          setIsLoading(false);
      }
  };

  // Listener em tempo real para a fila
  useEffect(() => {
    setIsLoading(true);
    const currentTenant = localStorage.getItem('current_tenant');
    if (!currentTenant) {
      console.error("[ServiceQueue Realtime] Tenant ID not found.");
      setIsLoading(false);
      setQueueItems([]);
      toast({ title: "Erro", description: "Tenant não identificado.", variant: "destructive" });
      return () => {}; // Retorna função vazia para cleanup
    }

    console.log(`[ServiceQueue Realtime] Setting up listener for tenant: ${currentTenant}`);

    // Status relevantes para buscar na fila
    const relevantStatuses = ['waiting', 'scheduled', 'in_progress', 'paused', 'completed', 'cancelled'];

    const q = query(
      collection(db, "queueEntries"),
      where("tenant_id", "==", currentTenant),
      where("status", "in", relevantStatuses) // Busca todos os status relevantes de uma vez
      // Não filtramos por data aqui, pois a data vem do Appointment relacionado
    );

    const unsubscribe = onSnapshot(q, async (querySnapshot) => {
      console.log("[ServiceQueue Realtime] Snapshot received.");
      const queueItemsFromDB = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      // Lógica de Mapeamento e População (adaptada de fetchQueueData)
      const populatedAppointmentsPromises = queueItemsFromDB.map(async (item) => {
          try {
              if (!item.pet_id || !item.customer_id || !item.service_id) {
                  console.warn("Item da fila com IDs faltando (Realtime):", item);
                  return null; // Ignorar itens inválidos completamente
              }

              const [pet, customer, service, appointment] = await Promise.all([
                  Pet.get(item.pet_id).catch(e => { console.error(`Erro Pet ${item.pet_id}:`, e); return null; }),
                  Customer.get(item.customer_id).catch(e => { console.error(`Erro Customer ${item.customer_id}:`, e); return null; }),
                  Service.get(item.service_id).catch(e => { console.error(`Erro Service ${item.service_id}:`, e); return null; }),
                  item.appointment_id
                      ? Appointment.get(item.appointment_id).catch(e => { console.error(`Erro Appointment ${item.appointment_id}:`, e); return null; })
                      : Promise.resolve(null)
              ]);

              // Validar se dados essenciais foram carregados
              if (!pet || !customer || !service) {
                 console.warn("Dados essenciais (Pet, Customer, Service) não carregados para item:", item.id);
                 return null; // Ignorar se dados essenciais falharam
              }

              return {
                  ...item,
                  pet: pet,
                  customer: customer,
                  service: service,
                  osNumber: appointment ? appointment.osNumber : null,
                  // Adiciona a data do agendamento populada para filtro posterior
                  populated_appointment_date: appointment?.start_time // Guarda o timestamp ou ISO string
              };
          } catch (error) {
              console.error("Erro ao popular item da fila (Realtime):", item.id, error);
              return null; // Ignorar itens com erro de população
          }
      });

      const populatedItemsRaw = (await Promise.all(populatedAppointmentsPromises)).filter(item => item !== null);

      // Filtrar por Módulo Petshop
      const petshopItems = populatedItemsRaw.filter(item => item.service && item.service.module === 'petshop');

      // Filtrar pela Data Selecionada (usando a data populada do agendamento)
      const finalFilteredItems = petshopItems.filter(item => {
         if (!item.populated_appointment_date) return false; // Ignora se não tem data do agendamento
         try {
             let appointmentDate;
             if (item.populated_appointment_date instanceof Timestamp) {
                 appointmentDate = item.populated_appointment_date.toDate();
             } else if (typeof item.populated_appointment_date === 'string') {
                 appointmentDate = parseISO(item.populated_appointment_date);
             } else {
                 return false; // Não consegue determinar a data
             }
             return isSameDay(appointmentDate, selectedDate);
         } catch (dateError) {
             console.error("Erro ao comparar datas (Realtime):", item.id, item.populated_appointment_date, dateError);
             return false;
         }
      });

      console.log(`[ServiceQueue Realtime] Setting ${finalFilteredItems.length} items for date ${selectedDate.toDateString()}`);
      setQueueItems(finalFilteredItems);
      setIsLoading(false); // Desativa o loading após o primeiro processamento bem-sucedido

    }, (error) => { // Tratamento de erro do listener
      console.error("[ServiceQueue Realtime] Listener error:", error);
      setIsLoading(false);
      setQueueItems([]);
      toast({ title: "Erro de Conexão", description: "Falha ao carregar atualizações da fila.", variant: "destructive" });
    });

    // Função de cleanup para remover o listener
    return () => {
        console.log("[ServiceQueue Realtime] Cleaning up listener.");
        unsubscribe();
    };
  }, [selectedDate, toast]);

  /* // Remover função checkUpcomingServices não usada
  const checkUpcomingServices = () => {
    const now = new Date();
    const soon = addMinutes(now, 15);
    
    const upcomingSoon = queueItems.filter(item => {
      const appointmentTime = new Date(item.appointment_date);
      return item.status === "scheduled" && 
             isAfter(appointmentTime, now) && 
             isBefore(appointmentTime, soon);
    });
    
    if (upcomingSoon.length > 0) {
      upcomingSoon.forEach(item => {
        toast({
          title: "Serviço em breve",
          description: `${item.pet?.name} está agendado para ${format(new Date(item.appointment_date), "HH:mm")}`,
          duration: 5000
        });
      });
    }
    
    const delayed = queueItems.filter(item => {
      const appointmentTime = new Date(item.appointment_date);
      const tenMinutesAgo = addMinutes(now, -10);
      return item.status === "scheduled" && 
             isBefore(appointmentTime, tenMinutesAgo);
    });
    
    if (delayed.length > 0) {
      delayed.forEach(item => {
        toast({
          title: "Atendimento atrasado",
          description: `${item.pet?.name} está aguardando há mais de 10 minutos`,
          variant: "destructive",
          duration: 5000
        });
      });
    }
  };
  */

  const handleStatusChange = async (itemId, newStatus, additionalData = {}) => {
    // console.log(`[handleStatusChange] ID: ${itemId}, Novo Status: ${newStatus}`); // Comentado - Informativo
    try {
      const now = new Date().toISOString();
      let updateData = {
        status: newStatus
      };
      const currentItem = queueItems.find(item => item.id === itemId);
      if (!currentItem) {
        console.error("[handleStatusChange] Item da fila não encontrado:", itemId); // Manter erro
        throw new Error("Item da fila não encontrado.");
      }

      // <<< INÍCIO: Atualizar Appointment se status for in_progress >>>
      if (newStatus === 'in_progress' && currentItem.appointment_id) {
          try {
              console.log(`[handleStatusChange] Updating corresponding Appointment ${currentItem.appointment_id} status to in_progress.`);
              await Appointment.update(currentItem.appointment_id, { status: 'in_progress' });
              console.log(`[handleStatusChange] Appointment ${currentItem.appointment_id} status updated successfully.`);
          } catch (apptError) {
              console.error(`[handleStatusChange] Failed to update Appointment ${currentItem.appointment_id} status:`, apptError);
              toast({ title: "Aviso", description: "Status da fila atualizado, mas houve erro ao sincronizar com o agendamento principal.", variant: "warning" });
          }
      }
      // <<< FIM: Atualizar Appointment se status for in_progress >>>

      switch (newStatus) {
        case "in_progress":
          if (!currentItem.start_time) {
            updateData.start_time = now;
          }
          if (currentItem.pauses?.length > 0) {
            const lastPause = currentItem.pauses[currentItem.pauses.length - 1];
            if (!lastPause.end) {
              updateData.pauses = [
                ...currentItem.pauses.slice(0, -1),
                { ...lastPause, end: now }
              ];
            }
          }
          break;
        case "completed":
          updateData.end_time = now;
          if (currentItem.appointment_id) {
            const startTime = currentItem.start_time || currentItem.appointment_date;
            let duration = null;
            try {
                const startDate = parseISO(startTime);
                const endDate = parseISO(now);
                const minutes = differenceInMinutes(endDate, startDate);
                if (!isNaN(minutes) && minutes >= 0) {
                    duration = minutes;
                }
            } catch (e) { console.error("Erro calculando duração para Appointment:", e); }
            
            const appointmentUpdateData = {
               status: 'completed',
               end_time: now,
               ...(duration !== null && { duration_minutes: duration })
            };
            // console.log(`[handleStatusChange] Atualizando Appointment ${currentItem.appointment_id} para concluído:`, appointmentUpdateData); // Comentado - Informativo
            try {
               await Appointment.update(currentItem.appointment_id, appointmentUpdateData);
               // console.log(`[handleStatusChange] Appointment ${currentItem.appointment_id} atualizado com sucesso.`); // Comentado - Informativo
            } catch (apptError) {
               console.error("[handleStatusChange] Erro ao atualizar Appointment:", apptError); // Manter erro
               toast({ title: "Aviso", description: "Status da fila atualizado, mas houve erro ao finalizar o agendamento principal.", variant: "warning" });
            }

            // <<< INÍCIO: Enviar para Cobrança >>>
            if (currentItem.appointment_id && currentItem.service) {
               const serviceItemToCharge = {
                 id: currentItem.service.id,
                 name: currentItem.service.name,
                 price: currentItem.service.price || 0, // Garante que preço existe
                 quantity: 1,
                 type: 'service',
               };
               // console.log(`[handleStatusChange] Enviando serviço ${serviceItemToCharge.name} para cobrança (Appointment ID: ${currentItem.appointment_id})`); // Comentado - Informativo
               try {
                 await addPendingItems(currentItem.appointment_id, [serviceItemToCharge]);
                 // console.log(`[handleStatusChange] Serviço enviado para cobrança com sucesso.`); // Comentado - Informativo
                 // Não precisa de toast aqui, o toast de "Serviço concluído" já informa o usuário
               } catch (billingError) {
                 console.error("[handleStatusChange] Erro ao enviar para cobrança:", billingError); // Manter erro
                 toast({ title: "Erro de Cobrança", description: "Serviço finalizado, mas houve erro ao enviar para a lista de cobrança.", variant: "destructive" });
               }
            } else {
               console.warn("[handleStatusChange] Não foi possível enviar para cobrança: ID do agendamento ou detalhes do serviço ausentes.", currentItem); // Manter warn
            }
            // <<< FIM: Enviar para Cobrança >>>

          } else {
             console.warn("[handleStatusChange] appointment_id não encontrado no item da fila para concluir agendamento."); // Manter warn
          }
          break;
        case "paused":
          {
            const pauses = currentItem.pauses || [];
            updateData.pauses = [
              ...pauses,
              {
                start: now,
                reason: additionalData.pauseReason || 'Pausado pelo usuário'
              }
            ];
          }
          break;
      }

      if (additionalData.notes) {
        updateData.notes = additionalData.notes;
      }

      // console.log("[handleStatusChange] Atualizando QueueService:", itemId, updateData); // Comentado - Informativo
      await QueueService.update(itemId, updateData);
      toast({
        title: "Status atualizado",
        description: "O status do atendimento foi atualizado com sucesso!"
      });
      
      if (newStatus === "completed") {
        toast({
          title: "Serviço concluído",
          description: `O serviço para ${currentItem.pet?.name} foi finalizado!`,
          variant: "success"
        });
      }
      
      fetchQueueData();
    } catch (error) {
      console.error("Erro ao atualizar status:", error); // Manter erro principal
      toast({
        title: "Erro",
        description: `Não foi possível atualizar o status: ${error.message}`,
        variant: "destructive"
      });
    }
  };

  const handleSelectService = (service) => {
    setSelectedService(service);
    setIsDetailsOpen(true);
  };

  const handleAddNotes = (serviceId) => {
    const service = queueItems.find(item => item.id === serviceId);
    setNotes(service?.notes || "");
    setSelectedService(service);
    setShowAddNotesDialog(true);
  };

  const saveNotes = async () => {
    if (!selectedService) return;
    
    try {
      await QueueService.update(selectedService.id, { notes });
      toast({
        title: "Observações salvas",
        description: "As observações foram salvas com sucesso!"
      });
      setShowAddNotesDialog(false);
      fetchQueueData();
    } catch (error) {
      console.error("Erro ao salvar observações:", error); // Manter erro principal
      toast({
        title: "Erro",
        description: "Não foi possível salvar as observações.",
        variant: "destructive"
      });
    }
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      scheduled: {
        label: "Agendado",
        className: "bg-blue-100 text-blue-800"
      },
      waiting: {
        label: "Aguardando",
        className: "bg-orange-100 text-orange-800"
      },
      in_progress: {
        label: "Em Atendimento",
        className: "bg-purple-100 text-purple-800 border border-purple-300"
      },
      paused: {
        label: "Pausado",
        className: "bg-amber-100 text-amber-800"
      },
      completed: {
        label: "Concluído",
        className: "bg-green-100 text-green-800"
      },
      cancelled: {
        label: "Cancelado",
        className: "bg-red-100 text-red-800"
      }
    };

    const config = statusConfig[status] || { 
      label: status ? String(status) : "Indefinido", 
      className: "bg-gray-100 text-gray-800" 
    }; // <-- Fallback para status desconhecido
    
    // Log para depurar o status recebido
    if (!statusConfig[status]) {
        console.warn(`[getStatusBadge] Status desconhecido recebido: '${status}', aplicando fallback.`); // Manter warn
    }
    
    return <Badge className={config.className}>{config.label}</Badge>;
  };

  const sortedQueueItems = [...queueItems].sort((a, b) => {
    const statusOrder = {
      in_progress: 0,
      paused: 1,
      scheduled: 2,
      completed: 3,
      cancelled: 4
    };
    
    if (statusOrder[a.status] !== statusOrder[b.status]) {
      return statusOrder[a.status] - statusOrder[b.status];
    }
    
    return new Date(a.appointment_date) - new Date(b.appointment_date);
  });

  const filteredItems = sortedQueueItems.filter(item => {
    const matchesSearch = 
      item.pet?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.customer?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.service?.name?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = filterStatus === "all" || item.status === filterStatus;
    
    return matchesSearch && matchesStatus;
  });

  const handleOpenRemoveModal = (item) => {
    setItemToRemove(item);
    setIsRemoveModalOpen(true);
  };

  const handleCloseRemoveModal = () => {
    setItemToRemove(null);
    setIsRemoveModalOpen(false);
  };

  const handleConfirmRemove = async (reason, newReason = null) => {
    if (!itemToRemove) return;

    let finalReason = reason;

    if (reason === '__other__' && newReason) {
      finalReason = newReason.trim();
      try {
        addRemovalReason(finalReason);
      } catch (error) {
        console.error("Erro ao salvar novo motivo de remoção:", error); // Manter erro
      }
    } else if (reason === '__other__' && !newReason) {
       console.error("Tentativa de remover com 'Outros' sem especificar motivo."); // Manter erro
       toast({
          title: "Erro",
          description: "Motivo 'Outros' selecionado, mas nenhum texto foi fornecido.",
          variant: "destructive"
       });
       return;
    }

    // console.log(`Removendo item ${itemToRemove.id} da fila com motivo: ${finalReason}`); // Comentado - Informativo

    try {
      await QueueService.update(itemToRemove.id, { 
        status: 'cancelled', 
        removal_reason: finalReason 
      });
      
      if (itemToRemove.appointment_id) {
          try {
              await Appointment.update(itemToRemove.appointment_id, {
                  status: 'cancelled',
                  removal_reason: finalReason 
              });
              // console.log(`Agendamento ${itemToRemove.appointment_id} atualizado para cancelado com motivo.`); // Comentado - Informativo
          } catch (appointmentError) {
              console.error("Erro ao atualizar status do agendamento original:", appointmentError); // Manter erro
              toast({
                  title: "Aviso",
                  description: "Item removido da fila, mas houve um erro ao atualizar o status do agendamento principal.",
                  variant: "destructive"
              });
          }
      } else {
          console.warn("Não foi possível atualizar o agendamento original: appointment_id não encontrado no item da fila."); // Manter warn
      }
      
      toast({
        title: "Item Removido",
        description: `O atendimento de ${itemToRemove.pet?.name || 'Pet'} foi removido da fila.`
      });
      
      fetchQueueData();
      handleCloseRemoveModal();
      
    } catch (error) {
      console.error("Erro ao atualizar status para cancelado na fila:", error); // Manter erro principal
      toast({
        title: "Erro ao Remover",
        description: "Não foi possível remover o item da fila.",
        variant: "destructive"
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-full p-8">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <Tabs
          defaultValue="list"
          value={currentView}
          onValueChange={setCurrentView}
          className="w-full"
        >
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
            <div className="flex items-center">
              <h1 className="text-2xl font-bold mr-4">Fila de Atendimento</h1>
              <TabsList>
                <TabsTrigger value="list" className="flex items-center gap-2">
                  <ClipboardList className="h-4 w-4" />
                  <span className="hidden sm:inline">Lista</span>
                </TabsTrigger>
                <TabsTrigger value="board" className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4" />
                  <span className="hidden sm:inline">Quadro</span>
                </TabsTrigger>
              </TabsList>
            </div>
            
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="justify-start text-left font-normal w-full sm:w-auto"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(selectedDate, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarComponent
                    mode="single"
                    selected={selectedDate}
                    onSelect={(date) => {
                      setSelectedDate(date || new Date());
                      setCalendarOpen(false);
                    }}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
              <Input
                placeholder="Buscar por pet, cliente ou serviço..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 w-full"
              />
            </div>
            
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder="Filtrar por status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="waiting">Aguardando</SelectItem>
                <SelectItem value="in_progress">Em Atendimento</SelectItem>
                <SelectItem value="paused">Pausados</SelectItem>
                <SelectItem value="completed">Concluídos</SelectItem>
                <SelectItem value="cancelled">Cancelados</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <TabsContent value="list" className="mt-0">
            <Card>
              <CardContent className="p-0">
                <div className="rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[100px]">Horário</TableHead>
                        <TableHead>Pet</TableHead>
                        <TableHead>OS</TableHead>
                        <TableHead>Cliente</TableHead>
                        <TableHead>Serviço</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Tempo</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredItems.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                            Nenhum atendimento encontrado com os filtros selecionados.
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredItems.map((item) => (
                          <TableRow key={item.id} className={
                            item.status === "in_progress" ? "bg-purple-50" :
                            item.status === "completed" ? "bg-green-50" :
                            item.status === "paused" ? "bg-amber-50" :
                            ""
                          }>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Clock className="h-4 w-4 text-gray-500" />
                                {item.entry_time && !isNaN(new Date(item.entry_time).getTime())
                                  ? format(new Date(item.entry_time), "HH:mm")
                                  : '--:--'
                                }
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="font-medium">{item.pet?.name}</div>
                            </TableCell>
                            <TableCell>
                              <div className="text-xs text-gray-500">{item.osNumber || '-'}</div>
                            </TableCell>
                            <TableCell>{item.customer?.full_name}</TableCell>
                            <TableCell>{item.service?.name}</TableCell>
                            <TableCell>{getStatusBadge(item.status)}</TableCell>
                            <TableCell>
                              <ServiceTimer 
                                service={item} 
                                onUpdateStatus={(newStatus, additionalData) => 
                                  handleStatusChange(item.id, newStatus, additionalData)
                                } 
                              />
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                {item.status === 'waiting' && (
                                  <Button
                                    size="sm"
                                    onClick={() => handleStatusChange(item.id, "in_progress")}
                                    className="bg-purple-600 hover:bg-purple-700 text-white"
                                  >
                                    <PlayCircle className="h-4 w-4 mr-1" />
                                    Iniciar
                                  </Button>
                                )}
                                <Button 
                                  variant="ghost" 
                                  size="icon"
                                  onClick={() => handleSelectService(item)}
                                >
                                  <UserCircle className="h-4 w-4" />
                                </Button>
                                <Button 
                                  variant="outline" 
                                  size="icon"
                                  onClick={() => handleAddNotes(item.id)}
                                >
                                  <ClipboardList className="h-4 w-4" />
                                </Button>
                                <Button 
                                  variant="outline" 
                                  size="icon"
                                  onClick={() => handleOpenRemoveModal(item)}
                                >
                                  <XCircle className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="board" className="mt-0">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card>
                <CardHeader className="pb-2 bg-yellow-50">
                  <CardTitle className="text-center text-yellow-800 flex items-center justify-center gap-2">
                    <UserCheck className="h-5 w-5" />
                    Aguardando ({sortedQueueItems.filter(i => i.status === "waiting").length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-3 max-h-[600px] overflow-y-auto">
                  {sortedQueueItems
                    .filter(item => item.status === "waiting")
                    .map(item => (
                      <Card key={item.id} className="mb-3 shadow-sm hover:shadow-md transition-shadow">
                        <CardContent className="p-3">
                          <div className="flex items-start gap-3">
                            <div className="flex-shrink-0">
                              <PetAvatar pet={item.pet} size="lg" />
                            </div>
                            <div className="flex-1">
                              <div className="flex justify-between items-start mb-1">
                                <div className="font-medium">{item.pet?.name}</div>
                                {item.entry_time && !isNaN(new Date(item.entry_time).getTime())
                                  ? <div className="text-xs text-gray-500"><Clock className="h-3 w-3 inline mr-1"/>{format(new Date(item.entry_time), "HH:mm")}</div>
                                  : <div className="text-xs text-gray-500"><Clock className="h-3 w-3 inline mr-1"/>--:--</div>
                                }
                              </div>
                              {item.osNumber && <div className="text-xs text-gray-500 mb-1">OS: {item.osNumber}</div>}
                              <div className="text-sm text-gray-600 mb-1">{item.service?.name}</div>
                              <div className="text-xs text-gray-500 mb-2">{item.customer?.full_name}</div>
                              <div className="flex justify-between items-center">
                                <Button 
                                  size="sm" 
                                  className="w-full"
                                  onClick={() => handleStatusChange(item.id, "in_progress")}
                                >
                                  <PlayCircle className="h-4 w-4 mr-2" />
                                  Iniciar
                                </Button>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  {sortedQueueItems.filter(i => i.status === "waiting").length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      Nenhum serviço agendado
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2 bg-purple-50">
                  <CardTitle className="text-center text-purple-800 flex items-center justify-center gap-2">
                    <PlayCircle className="h-5 w-5" />
                    Em Andamento ({sortedQueueItems.filter(i => i.status === "in_progress" || i.status === "paused").length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-3 max-h-[600px] overflow-y-auto">
                  {sortedQueueItems
                    .filter(item => item.status === "in_progress" || item.status === "paused")
                    .map(item => (
                      <Card key={item.id} className={`mb-3 shadow-sm hover:shadow-md transition-shadow ${item.status === "paused" ? "border-l-4 border-amber-500" : ""}`}>
                        <CardContent className="p-3">
                          <div className="flex items-start gap-3">
                            <div className="flex-shrink-0">
                              <PetAvatar pet={item.pet} size="lg" />
                            </div>
                            <div className="flex-1">
                              <div className="flex justify-between items-start mb-1">
                                <div className="font-medium">{item.pet?.name}</div>
                                <Badge variant={item.status === "paused" ? "secondary" : "default"}>
                                  {item.status === "paused" ? "Pausado" : "Em Atendimento"}
                                </Badge>
                              </div>
                              {item.osNumber && <div className="text-xs text-gray-500 mb-1">OS: {item.osNumber}</div>}
                              <div className="text-sm text-gray-600 mb-1">{item.service?.name}</div>
                              <div className="text-xs text-gray-500 mb-2">{item.customer?.full_name}</div>
                              <div className="flex gap-2">
                                {item.status === "in_progress" ? (
                                  <>
                                    <Button 
                                      size="sm" 
                                      variant="outline"
                                      className="flex-1"
                                      onClick={() => {
                                        setSelectedService(item);
                                        setShowAddNotesDialog(true);
                                      }}
                                    >
                                      <PauseCircle className="h-4 w-4 mr-2" />
                                      Pausar
                                    </Button>
                                    <Button 
                                      size="sm"
                                      className="flex-1"
                                      onClick={() => handleStatusChange(item.id, "completed")}
                                    >
                                      <CheckCircle2 className="h-4 w-4 mr-2" />
                                      Concluir
                                    </Button>
                                  </>
                                ) : (
                                  <Button 
                                    size="sm"
                                    className="w-full"
                                    onClick={() => handleStatusChange(item.id, "in_progress")}
                                  >
                                    <PlayCircle className="h-4 w-4 mr-2" />
                                    Retomar
                                  </Button>
                                )}
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  {sortedQueueItems.filter(i => i.status === "in_progress" || i.status === "paused").length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      Nenhum serviço em andamento
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2 bg-gray-100">
                  <CardTitle className="text-center text-gray-700 flex items-center justify-center gap-2">
                    <Trophy className="h-5 w-5" />
                    Concluídos ({sortedQueueItems.filter(i => i.status === "completed").length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-3 max-h-[600px] overflow-y-auto">
                  {sortedQueueItems
                    .filter(item => item.status === "completed")
                    .sort((a, b) => {
                      const timeA = a.end_time ? new Date(a.end_time).getTime() : 0;
                      const timeB = b.end_time ? new Date(b.end_time).getTime() : 0;
                      // Ordena do mais recente (maior tempo) para o mais antigo (menor tempo)
                      return timeB - timeA; 
                    })
                    .map(item => (
                      <Card key={item.id} className="mb-3 shadow-sm opacity-90">
                        <CardContent className="p-3">
                          <div className="flex items-start gap-3">
                            <div className="flex-shrink-0">
                              <PetAvatar pet={item.pet} size="lg" />
                            </div>
                            <div className="flex-1">
                              <div className="flex justify-between items-start mb-1">
                                <div className="font-medium">{item.pet?.name}</div>
                                <Badge className="bg-green-100 text-green-800">Concluído</Badge>
                              </div>
                              {item.osNumber && <div className="text-xs text-gray-500 mb-1">OS: {item.osNumber}</div>}
                              <div className="text-sm text-gray-600 mb-1">{item.service?.name}</div>
                              <div className="text-xs text-gray-500 mb-1">{item.customer?.full_name}</div>
                              {item.start_time && !isNaN(new Date(item.start_time).getTime()) && item.end_time && !isNaN(new Date(item.end_time).getTime()) && (
                                <div className="text-xs text-gray-400">
                                  Duração: {format(new Date(item.start_time), "HH:mm")} - {format(new Date(item.end_time), "HH:mm")}
                                </div>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  {sortedQueueItems.filter(i => i.status === "completed").length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      Nenhum serviço concluído
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {selectedService && (
        <ServiceDetailsPanel
          open={isDetailsOpen}
          onOpenChange={setIsDetailsOpen}
          service={selectedService}
          onStatusChange={handleStatusChange}
          onRefresh={fetchQueueData}
        />
      )}

      <Dialog open={showAddNotesDialog} onOpenChange={setShowAddNotesDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Observações do Atendimento</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Textarea
              placeholder="Adicione observações sobre o atendimento..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={5}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddNotesDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={saveNotes}>
              Salvar Observações
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {isRemoveModalOpen && itemToRemove && (
        <RemoveFromQueueModal 
          isOpen={isRemoveModalOpen} 
          onClose={handleCloseRemoveModal} 
          onConfirm={handleConfirmRemove}
          item={itemToRemove}
        />
      )}
    </div>
  );
}
