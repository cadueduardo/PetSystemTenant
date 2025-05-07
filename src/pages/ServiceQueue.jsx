import { useState, useEffect, useCallback } from "react";
// import { useNavigate } from "react-router-dom"; // Remover
import { format, /* isBefore, isAfter, addMinutes, */ differenceInMinutes, parseISO, /* isSameDay, */ startOfDay, endOfDay } from "date-fns"; // Remover não usados
import { ptBR } from "date-fns/locale";
import { QueueService, Pet, Customer, Service, Appointment, /* CancellationReason */ } from "@/api/entities"; // Remover CancellationReason
// import { db } from '@/lib/firebaseConfig'; // <<< REMOVER db
import { Timestamp, collection, query, where, orderBy, limit, getDocs, startAfter, endBefore } from "firebase/firestore"; // <<< ADICIONAR imports firestore
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
  RefreshCcw, // <<< MANTER RefreshCcw
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
import { db } from "@/lib/firebaseConfig"; // <<< ADICIONAR db
import PaginationControls from "@/components/ui/PaginationControls"; // <<< ADICIONAR PaginationControls
// import { Checkbox } from "@/components/ui/checkbox"; // Remover
// import { Play, Pause, CheckCircle, Ban, MoreHorizontal, CalendarDays, Edit2, X, Info, } from "lucide-react"; // <<< REMOVER Bloco Lucide não usado
// import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"; // <<< REMOVER Tooltip (se não usado em outro lugar)
import { AlertCircle } from "lucide-react";

export default function ServiceQueue() {
  const [queueItems, setQueueItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [currentView, setCurrentView] = useState("list");
  const [selectedService, setSelectedService] = useState(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [filterStatus, setFilterStatus] = useState("all");
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [notes, setNotes] = useState("");
  const [showAddNotesDialog, setShowAddNotesDialog] = useState(false);
  const [isRemoveModalOpen, setIsRemoveModalOpen] = useState(false);
  const [itemToRemove, setItemToRemove] = useState(null);
  const { toast } = useToast();

  // <<< ESTADOS DE PAGINAÇÃO >>>
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [lastVisibleDoc, setLastVisibleDoc] = useState(null);
  const [firstVisibleDoc, setFirstVisibleDoc] = useState(null);
  const [isLoadingPage, setIsLoadingPage] = useState(false); // Loading específico da página
  const [sortField, setSortField] = useState('entry_time'); // Ordenar por hora de entrada?
  const [sortDirection, setSortDirection] = useState('asc');
  // const [totalItems, setTotalItems] = useState(0); // Opcional

  const fetchQueueData = useCallback(async (direction = 'current', newPageSize = pageSize) => {
      console.log(`[ServiceQueue Fetch] Direction: ${direction}, Size: ${newPageSize}, Page: ${currentPage}, Date: ${selectedDate.toDateString()}, Status Filter: ${filterStatus}`);
      setIsLoadingPage(true);
      if (direction === 'current' && newPageSize === pageSize) setIsLoading(true); // Loading inicial

      try {
        const currentTenant = localStorage.getItem('current_tenant');
        if (!currentTenant) throw new Error("Tenant não identificado.");

        const queueCollectionRef = collection(db, 'queueEntries');
        
        // Definir Timestamps para o início e fim do dia selecionado
        const dayStart = startOfDay(selectedDate);
        const dayEnd = endOfDay(selectedDate);
        const dayStartTimestamp = Timestamp.fromDate(dayStart);
        const dayEndTimestamp = Timestamp.fromDate(dayEnd);
        
        // Construir a query base
        let conditions = [
          where('tenant_id', '==', currentTenant),
          where('module', '==', 'petshop'), // <<< FILTRAR APENAS PETSHOP AQUI? >>>
          // Adicionar filtro de data (PRECISA DE ÍNDICE!)
          // Assumindo que `appointment_date_ts` é um campo Timestamp no documento da fila
          // Se o campo for outro (ex: `entry_time`), ajuste aqui.
          where('entry_time_ts', '>=', dayStartTimestamp), // <<< PRECISA TER ESSE CAMPO ou similar
          where('entry_time_ts', '<=', dayEndTimestamp)  // <<< PRECISA TER ESSE CAMPO ou similar
        ];

        // Adicionar filtro de status se não for "all"
        if (filterStatus !== "all") {
          conditions.push(where('status', '==', filterStatus));
        }

        let q = query(queueCollectionRef, ...conditions, orderBy(sortField, sortDirection), limit(newPageSize));

        // Aplicar cursores de paginação
        if (direction === 'next' && lastVisibleDoc) {
          q = query(q, startAfter(lastVisibleDoc));
        } else if (direction === 'prev' && firstVisibleDoc) {
          // Query reversa para "previous"
          const reversedOrderBy = sortDirection === 'asc' ? 'desc' : 'asc';
          q = query(queueCollectionRef, ...conditions, orderBy(sortField, reversedOrderBy), endBefore(firstVisibleDoc), limit(newPageSize));
        }

        const documentSnapshots = await getDocs(q);
        let queueDocs = documentSnapshots.docs;

        if (direction === 'prev') {
            queueDocs.reverse(); // Reverte a ordem para ficar correta
        }

        // Popular dados APENAS para os itens da página atual
        const populatedItemsPromises = queueDocs.map(async (docSnapshot) => {
            const item = { id: docSnapshot.id, ...docSnapshot.data() };
             try {
                if (!item.pet_id || !item.customer_id || !item.service_id) return null;
                 
                const [pet, customer, service, appointment] = await Promise.all([
                    Pet.get(item.pet_id).catch(() => null),
                    Customer.get(item.customer_id).catch(() => null),
                    Service.get(item.service_id).catch(() => null),
                    item.appointment_id ? Appointment.get(item.appointment_id).catch(() => null) : Promise.resolve(null)
                ]);
                
                if (!pet || !customer || !service) return null; // Ignora se dados essenciais falharam
                 
                return {
                    ...item,
                    pet: pet,
                    customer: customer,
                    service: service,
                    osNumber: appointment ? appointment.osNumber : null,
                };
            } catch (error) {
                console.error("Erro ao popular item da fila:", item.id, error);
                return null;
            }
        });
        
        const populatedItems = (await Promise.all(populatedItemsPromises)).filter(item => item !== null);

        setQueueItems(populatedItems);

        // Atualizar cursores e página
        const newLastVisible = queueDocs[queueDocs.length - 1];
        const newFirstVisible = queueDocs[0];
        setLastVisibleDoc(newLastVisible || null);
        setFirstVisibleDoc(newFirstVisible || null);

        if (direction === 'next') setCurrentPage(prev => prev + 1);
        else if (direction === 'prev') setCurrentPage(prev => Math.max(1, prev - 1));
        else if (direction === 'current') setCurrentPage(1); // Reset

      } catch (error) {
           console.error("Erro ao carregar fila:", error);
            if (error.code === 'failed-precondition') {
                setError("Erro: Índice do Firestore ausente para esta consulta/ordenação. Verifique o console para detalhes e crie o índice necessário.");
                toast({ title: "Erro de Índice", description: "Índice do Firestore necessário para filtrar/ordenar a fila. Crie o índice indicado no console do navegador.", variant: "destructive", duration: 10000 });
            } else {
                setError("Não foi possível carregar a fila de atendimento.");
                toast({ title: "Erro", description: "Não foi possível carregar a fila de atendimento.", variant: "destructive" });
            }
           setQueueItems([]); // Limpa em caso de erro
      } finally {
          setIsLoading(false);
          setIsLoadingPage(false);
      }
  }, [selectedDate, toast, pageSize, sortField, sortDirection, filterStatus, lastVisibleDoc, firstVisibleDoc, currentPage]);

  // <<< useEffect para carregar na montagem E QUANDO FILTROS MUDAM >>>
  useEffect(() => {
    console.log("[ServiceQueue] Triggering initial load or filter change.");
    // Reseta paginação antes de carregar com novos filtros
    setLastVisibleDoc(null);
    setFirstVisibleDoc(null);
    setCurrentPage(1);
    fetchQueueData('current', pageSize);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate, filterStatus, sortField, sortDirection]); // Recarrega se data, status ou ordenação mudar

  // <<< FUNÇÕES HANDLER PARA PAGINAÇÃO >>>
  const handlePageChange = (direction) => {
    fetchQueueData(direction, pageSize);
  };

  const handlePageSizeChange = (newPageSize) => {
    setPageSize(newPageSize);
    // Reseta para a primeira página ao mudar o tamanho
    setLastVisibleDoc(null); 
    setFirstVisibleDoc(null);
    setCurrentPage(1);
    fetchQueueData('current', newPageSize); 
  };

  // <<< ADICIONAR HANDLER PARA ORDENAÇÃO (Exemplo) >>>
  const handleSort = (field) => {
      if (sortField === field) {
        setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
      } else {
        setSortField(field);
        setSortDirection('asc');
      }
      // O useEffect [selectedDate, filterStatus, sortField, sortDirection] vai recarregar
  };

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
      
      fetchQueueData('current', pageSize);
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
      fetchQueueData('current', pageSize);
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
      
      fetchQueueData('current', pageSize);
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

  // <<< ADICIONAR RENDERIZAÇÃO DE ERRO >>>
  if (error) {
    return (
      <div className="flex justify-center items-center h-full p-8 text-red-600">
        <AlertCircle className="h-6 w-6 mr-2" />
        <span>{error}</span>
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
              <div className="flex items-center gap-2 ml-2">
                 <span className="text-sm text-muted-foreground hidden md:inline">
                    Não encontrou? Atualize a lista.
                 </span>
                 <Button 
                    variant="outline" 
                    size="icon" 
                    onClick={() => {
                      console.log("[ServiceQueue] Refresh button clicked. Calling debouncedFetchData...");
                      fetchQueueData('current', pageSize);
                    }}
                    disabled={isLoadingPage}
                 >
                    <RefreshCcw className={`h-4 w-4 ${isLoadingPage ? 'animate-spin' : ''}`} />
                    <span className="sr-only">Atualizar Lista</span>
                 </Button>
               </div>
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
                        <TableHead><button onClick={() => handleSort('entry_time')}>Horário</button></TableHead>
                        <TableHead><button onClick={() => handleSort('pet.name')}>Pet</button></TableHead>
                        <TableHead>OS</TableHead>
                        <TableHead><button onClick={() => handleSort('customer.full_name')}>Cliente</button></TableHead>
                        <TableHead><button onClick={() => handleSort('service.name')}>Serviço</button></TableHead>
                        <TableHead><button onClick={() => handleSort('status')}>Status</button></TableHead>
                        <TableHead>Tempo</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {isLoadingPage ? (
                         <TableRow><TableCell colSpan={8} className="text-center py-8"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></TableCell></TableRow>
                      ) : filteredItems.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                            {queueItems.length === 0 ? 'Nenhum atendimento para esta data/filtros.' : 'Nenhum atendimento encontrado com o termo de busca nesta página.'}
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
                <PaginationControls 
                   currentPage={currentPage}
                   pageSize={pageSize}
                   hasNextPage={queueItems.length === pageSize}
                   hasPreviousPage={currentPage > 1}
                   itemCountOnPage={queueItems.length}
                   onPageChange={handlePageChange}
                   onPageSizeChange={handlePageSizeChange}
                   isLoading={isLoadingPage}
                />
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
