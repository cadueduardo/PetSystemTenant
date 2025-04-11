import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Appointment, QueueService, Customer, Pet, Service, CancellationReason } from "@/api/entities";
import { createPageUrl } from "@/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { format, isToday, isBefore, startOfDay, endOfDay, differenceInSeconds, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "@/components/ui/use-toast";
import PropTypes from "prop-types";
import {
  Loader2,
  MoreVertical,
  Clock,
  X,
  Edit,
  RefreshCw,
  Plus,
  Info,
  Play,
  CheckSquare
} from "lucide-react";
import PetAvatar from "@/components/pets/PetAvatar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import RemoveFromQueueModal from '@/components/queue/RemoveFromQueueModal';

const getStatusBadge = (status) => {
  const statusConfig = {
    scheduled: { label: "Agendado", className: "bg-blue-100 text-blue-800" },
    confirmed: { label: "Confirmado", className: "bg-green-100 text-green-800" },
    in_progress: { label: "Em Andamento", className: "bg-yellow-100 text-yellow-800" },
    completed: { label: "Concluído", className: "bg-green-100 text-green-800" },
    cancelled: { label: "Cancelado", className: "bg-red-100 text-red-800" },
    paused: { label: "Pausado", className: "bg-orange-100 text-orange-800" }
  };

  return <Badge className={statusConfig[status]?.className || "bg-gray-100 text-gray-800"}>
    {statusConfig[status]?.label || "Desconhecido"}
  </Badge>;
};

const AppointmentCard = ({ appointment, onNavigate, onCancelClick, onRemovalReasonClick }) => {
  const handleEdit = () => {
    onNavigate(createPageUrl(`EditAppointment`, { id: appointment.id }));
  };

  const durationDisplay = useMemo(() => { 
    const savedMinutes = appointment.duration_minutes;

    if (savedMinutes > 0) {
      if (savedMinutes < 60) return `${savedMinutes} min`;
      const hours = Math.floor(savedMinutes / 60);
      const remainingMinutes = savedMinutes % 60;
      return `${hours}h ${remainingMinutes > 0 ? `${remainingMinutes}min` : ''}`.trim();
    }
    
    if (savedMinutes === 0 && appointment.start_time && appointment.end_time) {
      try {
        const seconds = differenceInSeconds(parseISO(appointment.end_time), parseISO(appointment.start_time || appointment.date));
        if (seconds > 0) {
          return '< 1 min';
        }
      } catch {
        /* ignora erro */ 
      }
    }

    return null;

  }, [appointment.date, appointment.start_time, appointment.end_time, appointment.duration_minutes]); 

  console.log("[AppointmentCard] Received date value:", appointment.date);
  const isValidDate = appointment.date && !isNaN(new Date(appointment.date).getTime());
  console.log("[AppointmentCard] Is date valid for format(HH:mm)?", isValidDate);

  return (
    <Card className="p-4 relative group">
      <div className="flex justify-between items-start">
        <div className="flex items-center gap-4">
          <PetAvatar pet={appointment.pet} size="lg" />
          <div>
            <h3 className="font-medium">{appointment.pet?.name || 'Pet não encontrado'}</h3>
            <p className="text-sm text-gray-500">
              {appointment.customer?.full_name || `Cliente (ID: ${appointment.customer_id}) não encontrado`}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Tipo: <span className="font-medium capitalize">{appointment.type === 'clinica' ? 'Clínica' : 'Petshop'}</span>
            </p>
            <p className="text-xs text-gray-500">
              Serviço: <span className="font-medium">{appointment.service?.name || 'N/A'}</span>
            </p>
            <div className="mt-1 flex items-center gap-2">
              {getStatusBadge(appointment.status)}
              
              {appointment.status === 'cancelled' && appointment.removal_reason && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info 
                        className="h-4 w-4 text-gray-500 cursor-pointer" 
                        onClick={(e) => { 
                          e.stopPropagation();
                          onRemovalReasonClick(appointment.removal_reason); 
                        }}
                      />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Motivo: {appointment.removal_reason}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
              
              {appointment.status === 'completed' && durationDisplay && (
                <span className="text-xs text-muted-foreground flex items-center">
                  <Clock className="h-3 w-3 mr-1" /> {durationDisplay}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">
            {isValidDate 
              ? format(new Date(appointment.date), 'HH:mm')
              : '--:--'}
          </span>
          {(appointment.status === 'scheduled' || appointment.status === 'confirmed') && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={handleEdit}>
                    <Edit className="h-4 w-4 mr-2" />
                    Editar
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onCancelClick(appointment)} className="text-red-600 focus:text-red-700 focus:bg-red-50">
                    <X className="h-4 w-4 mr-2" />
                    Cancelar
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
          )}
        </div>
      </div>
    </Card>
  );
};

AppointmentCard.propTypes = {
  appointment: PropTypes.object.isRequired,
  onNavigate: PropTypes.func.isRequired,
  onCancelClick: PropTypes.func.isRequired,
  onRemovalReasonClick: PropTypes.func.isRequired,
};

export default function CalendarPage() {
  const navigate = useNavigate();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [allAppointments, setAllAppointments] = useState([]);
  const [queueServices, setQueueServices] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentTab, setCurrentTab] = useState("awaiting");
  const [isViewingHistory, setIsViewingHistory] = useState(false);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [itemToCancel, setItemToCancel] = useState(null);
  const [awaitingAppointments, setAwaitingAppointments] = useState([]);
  const [cancelledAppointments, setCancelledAppointments] = useState([]);
  const [completedAppointments, setCompletedAppointments] = useState([]);

  useEffect(() => {
    const initialDate = new Date();
    setSelectedDate(initialDate);
    setIsViewingHistory(isBefore(startOfDay(initialDate), startOfDay(new Date())));
    loadData(initialDate);
  }, []);

  const clearCacheAndReload = () => {
    localStorage.removeItem('appointments');
    localStorage.removeItem('queueServices');
    localStorage.removeItem('customers');
    localStorage.removeItem('pets');
    localStorage.removeItem('services');
    localStorage.removeItem('removalReasons');
    loadData(selectedDate);
    toast({ title: "Cache Limpo", description: "Dados recarregados." });
  };

  const handleDateSelect = (date) => {
    if (!date || isNaN(date.getTime())) return;
    setSelectedDate(date);
    const isHistory = isBefore(startOfDay(date), startOfDay(new Date()));
    setIsViewingHistory(isHistory);
    console.log('Data selecionada:', format(date, 'dd/MM/yyyy'), 'É histórico:', isHistory);
    loadData(date);
  };

  const loadData = async (date) => {
    if (!date) {
      console.warn("loadData chamado sem data definida.");
      return; 
    }
    try {
      setIsLoading(true);
      const tenantId = localStorage.getItem('current_tenant');
      if (!tenantId) {
        // Handle missing tenant ID (e.g., redirect to login or tenant selection)
        console.error("Tenant ID não encontrado no localStorage.");
        toast({ title: "Erro", description: "Tenant não identificado.", variant: "destructive" });
        setIsLoading(false);
        // navigate('/login'); // Example redirect
        return; 
      }
      
      const selectedDayStart = startOfDay(date);
      const selectedDayEnd = endOfDay(date);

      // --- 1. Fetch data --- 
      console.log(`[loadData] Buscando dados para ${format(date, 'dd/MM/yyyy')} Tenant: ${tenantId}`);
      const [appointmentsData, queueServicesData, allCustomers, allPets, allServices] = await Promise.all([
        Appointment.filter({ 
          date: { 
            $gte: selectedDayStart.toISOString(),
            $lte: selectedDayEnd.toISOString()
          }
        }),
        QueueService.list({ 
          status: ['in_progress']
        }),
        Customer.filter(),
        Pet.filter(),
        Service.list()
      ]);
      console.log(`[loadData] Dados brutos: Appts(${appointmentsData.length}), Queue(${queueServicesData.length}), Cust(${allCustomers.length}), Pets(${allPets.length}), Serv(${allServices.length})`);

      // --- 2. Create Lookup Maps --- 
      const customerMap = new Map(allCustomers.map(c => [c.id, c]));
      const petMap = new Map(allPets.map(p => [p.id, p]));
      const serviceMap = new Map(allServices.map(s => [s.id, s]));

      // --- 3. Enrich Appointments --- 
      const enrichedAppointments = appointmentsData.map(appointment => {
        const pet = petMap.get(appointment.pet_id);
        const customer = customerMap.get(appointment.customer_id);
        const service = serviceMap.get(appointment.service_id);
        
        console.log(`[Calendar loadData enrich] Date for appt ${appointment.id} before enrich:`, appointment.date);

        return {
          ...appointment,
          // Provide fallback objects to prevent errors in the UI
          pet: pet || { id: appointment.pet_id, name: "Pet não encontrado" }, 
          customer: customer || { id: appointment.customer_id, full_name: "Cliente não encontrado" },
          service: service || { id: appointment.service_id, name: "Serviço não encontrado" } 
        };
      });

      // --- 4. Enrich Queue Services --- 
      const enrichedQueueServices = queueServicesData.map(queueEntry => {
        const pet = petMap.get(queueEntry.pet_id);
        const customer = customerMap.get(queueEntry.customer_id);
        const service = serviceMap.get(queueEntry.service_id);
        const appointment = queueEntry.appointment_id ? appointmentsData.find(a => a.id === queueEntry.appointment_id) : null;
        
        return {
          ...queueEntry,
          pet: pet || { id: queueEntry.pet_id, name: "Pet não encontrado" },
          customer: customer || { id: queueEntry.customer_id, full_name: "Cliente não encontrado" },
          service: service || { id: queueEntry.service_id, name: "Serviço não encontrado" },
          appointment: appointment
        };
      });
      console.log('[loadData] Queue Services Enriched:', enrichedQueueServices);

      // --- 5. Update State --- 
      // Filtrar agendamentos aguardando
      const awaiting = enrichedAppointments.filter(a => a.status === 'scheduled' || a.status === 'confirmed');
      const cancelled = enrichedAppointments.filter(a => a.status === 'cancelled');
      const completed = enrichedAppointments.filter(a => a.status === 'completed');

      setAllAppointments(enrichedAppointments); // Mantém todos para referência, se necessário
      setAwaitingAppointments(awaiting); // <--- USA O NOVO ESTADO
      setQueueServices(enrichedQueueServices);
      setCancelledAppointments(cancelled);
      setCompletedAppointments(completed);

      // Ajusta a lógica da aba ativa para considerar 'awaiting' primeiro
      const activeAppointments = awaiting.length > 0;
      const activeQueue = enrichedQueueServices.length > 0;
      
      // Mantém a aba 'awaiting' se houver itens, senão tenta 'queue', 'completed', etc.
      if (currentTab === 'awaiting' && !activeAppointments && !activeQueue) {
        // Se estava em 'awaiting' e não há mais itens aguardando nem na fila,
        // muda para 'completed' se houver, ou mantém 'awaiting' (vazio)
        setCurrentTab(completed.length > 0 ? 'completed' : 'awaiting'); 
      } else if (currentTab === 'queue' && !activeQueue) {
        // Se estava na fila e não há mais itens, tenta voltar para 'awaiting' se tiver,
        // senão para 'completed' ou mantém 'awaiting'
        setCurrentTab(activeAppointments ? 'awaiting' : (completed.length > 0 ? 'completed' : 'awaiting'));
      } else if (!['awaiting', 'queue'].includes(currentTab) && (activeAppointments || activeQueue)){
        // Se estava em outra aba (completed/canceled) e apareceram itens aguardando ou na fila,
        // muda para 'awaiting' se houver, senão para 'queue'
        setCurrentTab(activeAppointments ? 'awaiting' : 'queue');
      }

      console.log(`[loadData] Estados atualizados: Awaiting(${awaiting.length}), Queue(${enrichedQueueServices.length}), Cancelled(${cancelled.length}), Completed(${completed.length})`);

    } catch (error) {
      console.error('Erro ao carregar dados do calendário:', error);
      toast({
        title: "Erro de Carregamento",
        description: `Não foi possível carregar os dados: ${error.message}`,
        variant: "destructive"
      });
      setAllAppointments([]);
      setQueueServices([]);
      setCancelledAppointments([]);
      setCompletedAppointments([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Atualiza as contagens para usar os estados corretos
  const waitingCount = awaitingAppointments.length; // <--- USA O NOVO ESTADO
  const cancelledCount = cancelledAppointments.length;
  const completedCount = completedAppointments.length;

  const handleOpenCancelModal = (appointment) => {
    console.log("Abrindo modal para cancelar:", appointment);
    setItemToCancel(appointment);
    setIsCancelModalOpen(true);
  };

  const handleCloseCancelModal = () => {
    setItemToCancel(null);
    setIsCancelModalOpen(false);
  };
  
  const handleConfirmCalendarCancel = async (reason, newReason = null) => {
    if (!itemToCancel) return;
    const tenantId = localStorage.getItem('current_tenant');
    if (!tenantId) {
        toast({ title: "Erro", description: "ID da clínica não encontrado.", variant: "destructive" });
        return;
    }

    let finalReason = reason;
    if (reason === '__other__' && newReason) {
      finalReason = newReason.trim();
      if(!finalReason) {
        toast({ title: "Erro", description: "Especifique o motivo em 'Outros'.", variant: "destructive" });
        return;
      }
      try { 
          await CancellationReason.create({ reason: finalReason, tenant_id: tenantId });
          console.log(`[handleConfirmCalendarCancel] Novo motivo "${finalReason}" salvo no Firebase.`);
      } catch (error) { 
          console.error("Erro salvando novo motivo no Firebase:", error); 
      }
    } else if (reason === '__other__') {
      toast({ title: "Erro", description: "Especifique o motivo em 'Outros'.", variant: "destructive" });
      return;
    } else if (!reason) {
      toast({ title: "Erro", description: "Selecione um motivo.", variant: "destructive" });
      return;
    }

    console.log(`Cancelando Agendamento ${itemToCancel.id} com motivo: ${finalReason}`);

    try {
      await Appointment.update(itemToCancel.id, {
        status: 'cancelled',
        removal_reason: finalReason
      });
      toast({ title: "Sucesso", description: "Agendamento cancelado." });
      loadData(selectedDate);
      handleCloseCancelModal();
    } catch (error) {
      console.error("Erro ao cancelar agendamento:", error);
      toast({ title: "Erro", description: "Não foi possível cancelar.", variant: "destructive" });
    }
  };

  const openRemovalReasonModal = (reason) => {
    console.log("Exibir motivo:", reason);
    alert(`Motivo do Cancelamento: ${reason}`);
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
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">Agenda</h1>
          <p className="text-gray-500">
            {format(selectedDate, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
            {isViewingHistory && (
              <span className="ml-2 text-yellow-600 font-semibold">(Visualizando histórico)</span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={clearCacheAndReload}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Limpar Cache
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate(createPageUrl("ServiceQueue"))}
          >
            <Clock className="h-4 w-4 mr-2" />
            Fila de Atendimento
          </Button>
          <Button
            onClick={() => {
              navigate(createPageUrl(`AppointmentForm`));
            }}
          >
            <Plus className="h-4 w-4 mr-2" />
            Novo Agendamento
          </Button>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        <Card className="lg:w-[300px] flex-shrink-0">
          <CardContent className="p-4">
            <CalendarComponent
              mode="single"
              selected={selectedDate}
              onSelect={handleDateSelect}
              className="rounded-md border w-full"
              locale={ptBR}
            />
            
            <Separator className="my-4" />
            
            <div className="space-y-4">
              <h3 className="font-medium">Resumo do Dia</h3>
              <div className="grid grid-cols-2 gap-2">
                <div className="p-3 bg-blue-50 rounded-lg">
                  <div className="text-2xl font-bold text-blue-700">
                    {allAppointments.length}
                  </div>
                  <div className="text-sm text-blue-600">Agendamentos</div>
                </div>
                <div className="p-3 bg-yellow-50 rounded-lg">
                  <div className="text-2xl font-bold text-yellow-700">
                    {queueServices.length}
                  </div>
                  <div className="text-sm text-yellow-600">Em Atendimento</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex-1 min-w-0">
          <Tabs defaultValue="awaiting" value={currentTab} onValueChange={setCurrentTab}>
            <div className="flex justify-between items-center mb-4">
              <TabsList>
                <TabsTrigger value="awaiting">Aguardando ({waitingCount})</TabsTrigger>
                <TabsTrigger value="queue">Em Atendimento ({queueServices.length})</TabsTrigger>
                <TabsTrigger value="completed">Concluídos ({completedCount})</TabsTrigger>
                <TabsTrigger 
                  value="canceled"
                  className={cancelledCount > 0 ? 'text-red-600 font-bold' : ''}
                >
                  Cancelados {cancelledCount > 0 ? `(${cancelledCount})` : ''}
                </TabsTrigger>
              </TabsList>
              <Button variant="ghost" onClick={() => loadData(selectedDate)} size="icon">
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>

            <TabsContent value="awaiting" className="space-y-4">
              {awaitingAppointments.length === 0 ? (
                 <div className="text-center py-8 text-gray-500">
                   {isToday(selectedDate)
                     ? "Nenhum agendamento aguardando para hoje."
                     : isViewingHistory
                     ? "Nenhum agendamento aguardando registrado para este dia."
                     : "Nenhum agendamento aguardando para este dia."}
                 </div>
               ) : (
                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                   {awaitingAppointments.map((appointment) => (
                     <AppointmentCard
                       key={`app-awaiting-${appointment.id}`}
                       appointment={appointment}
                       onNavigate={navigate}
                       onCancelClick={handleOpenCancelModal}
                       onRemovalReasonClick={openRemovalReasonModal}
                     />
                   ))}
                 </div>
               )}
            </TabsContent>

            <TabsContent value="queue" className="space-y-4">
              {queueServices.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  {isToday(selectedDate)
                    ? "Nenhum atendimento em andamento no momento."
                    : isViewingHistory
                    ? "Nenhum atendimento em andamento registrado para este dia."
                    : "Nenhum atendimento em andamento para este dia."}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {queueServices.map((service) => (
                    <QueueServiceCard
                      key={`queue-${service.id}`}
                      service={service}
                      onLoadData={() => loadData(selectedDate)}
                      showActions={false}
                    />
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="completed" className="space-y-4">
              {completedAppointments.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  {isToday(selectedDate)
                    ? "Nenhum atendimento concluído hoje."
                    : isViewingHistory
                    ? "Nenhum atendimento concluído registrado para este dia."
                    : "Nenhum atendimento concluído para este dia."}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {completedAppointments.map((appointment) => (
                    <AppointmentCard
                      key={`app-completed-${appointment.id}`}
                      appointment={appointment}
                      onNavigate={navigate}
                      onCancelClick={() => {}}
                      onRemovalReasonClick={() => {}}
                    />
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="canceled" className="space-y-4">
              {cancelledAppointments.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  {isToday(selectedDate)
                    ? "Nenhum agendamento cancelado hoje."
                    : isViewingHistory
                    ? "Nenhum agendamento cancelado registrado para este dia."
                    : "Nenhum agendamento cancelado para este dia."}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {cancelledAppointments.map((appointment) => (
                    <AppointmentCard
                      key={`app-canceled-${appointment.id}`}
                      appointment={appointment}
                      onNavigate={navigate}
                      onCancelClick={() => {}}
                      onRemovalReasonClick={openRemovalReasonModal}
                    />
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {isCancelModalOpen && itemToCancel && (
        <RemoveFromQueueModal 
          isOpen={isCancelModalOpen} 
          onClose={handleCloseCancelModal} 
          onConfirm={handleConfirmCalendarCancel}
          item={itemToCancel}
        />
      )}
    </div>
  );
}

function QueueServiceCard({ service, onLoadData, showActions = true }) {
  const pet = service.pet;
  const customer = service.customer;
  const serviceInfo = service.service;
  const [isUpdating, setIsUpdating] = useState(false);

  console.log('Dados recebidos no QueueServiceCard:', service);

  const displayDate = service.entry_time?.toDate() || (service.appointment_date ? parseISO(service.appointment_date) : null);

  const handleCancel = async () => {
    if (!confirm(`Tem certeza que deseja remover ${pet?.name || 'este pet'} da fila?`)) return;
    
    setIsUpdating(true);
    try {
      await QueueService.update(service.id, { status: "cancelled" });
      toast({ title: "Sucesso", description: "Atendimento removido da fila." });
      onLoadData();
    } catch (error) {
      console.error("Erro ao remover da fila:", error);
      toast({
        title: "Erro",
        description: "Não foi possível remover o atendimento da fila.",
        variant: "destructive"
      });
    } finally {
       setIsUpdating(false);
    }
  };

  const handleStartService = async () => {
     setIsUpdating(true);
     try {
        await QueueService.update(service.id, { status: 'in_progress' });
        toast({ title: "Sucesso", description: "Atendimento iniciado." });
        onLoadData();
     } catch (error) {
        console.error("Erro ao iniciar atendimento:", error);
        toast({ title: "Erro", description: "Não foi possível iniciar o atendimento.", variant: "destructive" });
     } finally {
        setIsUpdating(false);
     }
  };
  
  const handleFinishService = async () => {
     setIsUpdating(true);
     try {
        await QueueService.update(service.id, { status: 'finished' });
        toast({ title: "Sucesso", description: "Atendimento finalizado." });
        onLoadData();
     } catch (error) {
        console.error("Erro ao finalizar atendimento:", error);
        toast({ title: "Erro", description: "Não foi possível finalizar o atendimento.", variant: "destructive" });
     } finally {
        setIsUpdating(false);
     }
  };

  return (
    <Card className="mb-4">
      <CardContent className="p-4">
        <div className="flex justify-between items-start">
          <div className="flex items-start gap-3">
            <PetAvatar pet={pet} size="md" />
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Badge variant="outline">
                  {displayDate ? format(displayDate, 'HH:mm') : "N/A"}
                </Badge>
                {getStatusBadge(service.status)}
              </div>
              <h3 className="font-semibold">
                    Pet: {pet?.name || "Não encontrado"}
                </h3>
                <p className="text-sm text-gray-500">
                    Tutor: {customer?.full_name || "Não encontrado"}
                </p>
                 <p className="text-sm text-gray-500">
                    Serviço: {serviceInfo?.name || "Não encontrado"}
                </p>
            </div>
          </div>
          {showActions && (
            <div className="flex items-center gap-2">
              {isUpdating ? (
                 <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  {service.status === 'waiting' && (
                    <Button variant="outline" size="sm" onClick={handleStartService} title="Iniciar Atendimento">
                      <Play className="h-4 w-4" />
                    </Button>
                  )}
                  {service.status === 'in_progress' && (
                    <Button variant="outline" size="sm" onClick={handleFinishService} title="Finalizar Atendimento" className="text-green-600 border-green-600 hover:bg-green-50">
                      <CheckSquare className="h-4 w-4" />
                    </Button>
                  )}
                  {(service.status === 'waiting' || service.status === 'in_progress') && (
                    <Button variant="destructive" size="sm" onClick={handleCancel} title="Remover da Fila">
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

QueueServiceCard.propTypes = {
  service: PropTypes.shape({
    id: PropTypes.string.isRequired,
    appointment_date: PropTypes.string,
    entry_time: PropTypes.oneOfType([PropTypes.object, PropTypes.string]),
    pet_id: PropTypes.string,
    customer_id: PropTypes.string,
    service_id: PropTypes.string,
    appointment_id: PropTypes.string,
    status: PropTypes.string,
    pet: PropTypes.shape({ name: PropTypes.string }), 
    customer: PropTypes.shape({ full_name: PropTypes.string }),
    service: PropTypes.shape({ name: PropTypes.string })
  }).isRequired,
  onLoadData: PropTypes.func.isRequired,
  showActions: PropTypes.bool
};