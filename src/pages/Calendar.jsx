import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Appointment, QueueService /*, Service, Pet, Customer */ } from "@/api/entities";
import { getMockData, addRemovalReason /*, getRemovalReasons */ } from "@/api/mockData";
import { createPageUrl } from "@/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { format, isToday, isBefore, startOfDay, endOfDay, differenceInMinutes, differenceInSeconds, parseISO } from "date-fns";
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
  Info
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

const calculateDuration = (start, end) => {
  if (!start || !end) return null;
  try {
    const startDate = parseISO(start);
    const endDate = parseISO(end);
    const minutes = differenceInMinutes(endDate, startDate);
    if (isNaN(minutes) || minutes < 0) return null;
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours}h ${remainingMinutes > 0 ? `${remainingMinutes}min` : ''}`.trim();
  } catch (e) {
    console.error("Erro ao calcular duração:", e);
    return null;
  }
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
      } catch (e) { /* ignora erro */ }
    }

    return null;

  }, [appointment.date, appointment.start_time, appointment.end_time, appointment.duration_minutes]); 

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
            {appointment.date && !isNaN(new Date(appointment.date).getTime()) 
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
      const selectedDayStart = startOfDay(date);
      const selectedDayEnd = endOfDay(date);

      const mockData = getMockData();
      const isViewingHistory = isBefore(selectedDayStart, startOfDay(new Date())); 

      const allAppointmentsData = await Appointment.filter({
        tenant_id: tenantId,
        date: { 
          $gte: selectedDayStart.toISOString(),
          $lte: selectedDayEnd.toISOString()
        }
      });

      const allQueueServicesData = await QueueService.filter({
        tenant_id: tenantId,
        appointment_date: {
          $gte: selectedDayStart.toISOString(),
          $lte: selectedDayEnd.toISOString()
        }
      });

      const allServices = mockData.services || [];
      const enrichedAppointments = allAppointmentsData.map(appointment => {
        if (appointment.status === 'cancelled') {
          console.log("[loadData] Enriquecendo cancelado:", { 
            id: appointment.id, 
            customerId: appointment.customer_id, 
            foundCustomer: !!appointment.customer, 
            reason: appointment.removal_reason
          });
        }
        
        const pet = mockData.pets.find(p => p.id === appointment.pet_id);
        const customer = mockData.customers.find(c => c.id === appointment.customer_id);
        const service = allServices.find(s => s.id === appointment.service_id);
        
        return {
          ...appointment,
          pet: pet || { name: "Pet não encontrado" },
          customer: customer || null,
          service: service || { name: "Serviço não encontrado" } 
        };
      });

      const active = enrichedAppointments.filter(a => a.status === 'scheduled' || a.status === 'confirmed');
      const cancelled = enrichedAppointments.filter(a => a.status === 'cancelled');
      const completed = enrichedAppointments.filter(a => a.status === 'completed');
      
      setAllAppointments(active);
      setCancelledAppointments(cancelled);
      setCompletedAppointments(completed);

      const enrichedServices = allQueueServicesData.map(service => ({
        ...service,
        pet: mockData.pets.find(p => p.id === service.pet_id),
        customer: mockData.customers.find(c => c.id === service.customer_id)
      }));

      setQueueServices(enrichedServices);
      setIsViewingHistory(isViewingHistory);
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os agendamentos.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const waitingCount = allAppointments.length;
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

    let finalReason = reason;
    if (reason === '__other__' && newReason) {
      finalReason = newReason.trim();
      if(!finalReason) {
        toast({ title: "Erro", description: "Especifique o motivo em 'Outros'.", variant: "destructive" });
        return;
      }
      try { addRemovalReason(finalReason); } catch (error) { console.error("Erro salvando motivo:", error); }
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

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <Card className="lg:col-span-4">
          <CardContent className="p-4">
            <CalendarComponent
              mode="single"
              selected={selectedDate}
              onSelect={handleDateSelect}
              className="rounded-md border"
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

        <div className="lg:col-span-8">
          <Tabs defaultValue="awaiting" value={currentTab} onValueChange={setCurrentTab}>
            <div className="flex justify-between items-center mb-4">
              <TabsList>
                <TabsTrigger value="awaiting">Aguardando ({waitingCount})</TabsTrigger>
                <TabsTrigger value="queue">Fila Atend.</TabsTrigger>
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
              {allAppointments.length === 0 ? (
                 <div className="text-center py-8 text-gray-500">
                   {isToday(selectedDate)
                     ? "Nenhum agendamento aguardando para hoje."
                     : isViewingHistory
                     ? "Nenhum agendamento aguardando registrado para este dia."
                     : "Nenhum agendamento aguardando para este dia."}
                 </div>
               ) : (
                 allAppointments.map((appointment) => (
                   <AppointmentCard
                     key={`app-awaiting-${appointment.id}`}
                     appointment={appointment}
                     onNavigate={navigate}
                     onCancelClick={handleOpenCancelModal}
                     onRemovalReasonClick={openRemovalReasonModal}
                   />
                 ))
               )}
            </TabsContent>

            <TabsContent value="queue" className="space-y-4">
              {queueServices.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  {isToday(selectedDate)
                    ? "Nenhum atendimento em andamento."
                    : isViewingHistory
                    ? "Nenhum atendimento registrado para este dia."
                    : "Nenhum atendimento para este dia."}
                </div>
              ) : (
                queueServices.map((service) => (
                  <QueueServiceCard
                    key={`queue-${service.id}`}
                    service={service}
                    isQueueItem={true}
                    onLoadData={() => loadData(selectedDate)}
                    onNavigate={navigate}
                  />
                ))
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
                cancelledAppointments.map((appointment) => (
                  <AppointmentCard
                    key={`app-canceled-${appointment.id}`}
                    appointment={appointment}
                    onNavigate={navigate}
                    onCancelClick={() => {}}
                    onRemovalReasonClick={openRemovalReasonModal}
                  />
                ))
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

function QueueServiceCard({ service, isQueueItem, onLoadData, onNavigate }) {
  const formatServiceDate = (dateString) => {
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        return "Data inválida";
      }
      return format(date, "HH:mm");
    } catch {
      return "Data inválida";
    }
  };

  const mockData = getMockData();
  const pet = mockData.pets.find(p => p.id === service.pet_id);
  const customer = mockData.customers.find(c => c.id === service.customer_id);

  console.log('Dados do pet:', pet);
  console.log('Dados do serviço:', service);

  const displayDate = isQueueItem ? service.appointment_date : service.date;

  const handleCancel = async () => {
    try {
      console.log("Cancelando direto do QueueServiceCard:", service.appointment_id);
      if (!service.appointment_id) {
        console.error("Erro: ID do agendamento não encontrado no serviço:", service);
        toast({ title: "Erro", description: "ID do agendamento não encontrado.", variant: "destructive" });
        return;
      }
      await Appointment.update(service.appointment_id, { status: "cancelled" });
      toast({ title: "Sucesso", description: "Agendamento cancelado." });
      onLoadData();
    } catch (error) {
      console.error("Erro ao cancelar agendamento:", error);
      toast({
        title: "Erro",
        description: "Não foi possível cancelar o agendamento.",
        variant: "destructive"
      });
    }
  };

  const handleEdit = () => {
    onNavigate(createPageUrl(`AppointmentForm?id=${service.appointment_id}`));
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
                  {formatServiceDate(displayDate)}
                </Badge>
                {getStatusBadge(service.status)}
              </div>
              <h3 className="font-medium">{pet?.name || "Pet não encontrado"}</h3>
              <p className="text-sm text-gray-500">{customer?.full_name || "Cliente não encontrado"}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleEdit}>
                  <Edit className="h-4 w-4 mr-2" />
                  Editar
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleCancel} className="text-red-600">
                  <X className="h-4 w-4 mr-2" />
                  Cancelar
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

QueueServiceCard.propTypes = {
  service: PropTypes.shape({
    id: PropTypes.string,
    appointment_id: PropTypes.string,
    pet_id: PropTypes.string,
    customer_id: PropTypes.string,
    status: PropTypes.string,
    appointment_date: PropTypes.string,
    date: PropTypes.string
  }).isRequired,
  isQueueItem: PropTypes.bool.isRequired,
  onLoadData: PropTypes.func.isRequired,
  onNavigate: PropTypes.func.isRequired
};