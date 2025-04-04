import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Appointment, QueueService } from "@/api/entities";
import { createPageUrl } from "@/utils";
import { getMockData } from "@/api/mockData";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { format } from "date-fns";
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
  Plus
} from "lucide-react";
import ServiceTimer from "../components/queue/ServiceTimer";
import PetAvatar from "@/components/pets/PetAvatar";

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

export default function CalendarPage() {
  const navigate = useNavigate();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [allAppointments, setAllAppointments] = useState([]);
  const [queueServices, setQueueServices] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentTab, setCurrentTab] = useState("all");

  useEffect(() => {
    loadData();
  }, [selectedDate]);

  const clearCacheAndReload = () => {
    localStorage.removeItem('appointments');
    localStorage.removeItem('queueServices');
    localStorage.removeItem('customers');
    localStorage.removeItem('pets');
    localStorage.removeItem('services');
    loadData();
  };

  const handleDateSelect = (date) => {
    setSelectedDate(date);
    loadData(date);
  };

  const loadData = async () => {
    try {
      setIsLoading(true);
      const tenantId = localStorage.getItem('current_tenant');
      const date = selectedDate || new Date();
      const formattedDate = format(date, "yyyy-MM-dd");
      
      console.log('Carregando dados para a data:', formattedDate);
      console.log('Tenant ID:', tenantId);
      
      const appointmentsData = await Appointment.filter({
        tenant_id: tenantId,
        date: formattedDate
      });
      
      console.log('Todos agendamentos carregados:', appointmentsData);
      setAllAppointments(appointmentsData);
      
      const queueServicesData = await QueueService.filter({
        tenant_id: tenantId,
        appointment_date: formattedDate
      });
      
      console.log('Serviços da fila carregados:', queueServicesData);
      setQueueServices(queueServicesData);
      
      setIsLoading(false);
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os agendamentos.",
        variant: "destructive"
      });
      setIsLoading(false);
    }
  };

  const getCompletedServices = () => {
    return queueServices.filter(service => service.status === "completed");
  };

  const getActiveServices = () => {
    return queueServices.filter(service => service.status !== "completed");
  };

  const getActiveAppointments = () => {
    return allAppointments.filter(app => app.status !== 'cancelled');
  };

  const getCanceledAppointments = () => {
    return allAppointments.filter(app => app.status === 'cancelled');
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
              const storeParam = localStorage.getItem('current_tenant');
              navigate(createPageUrl(`AppointmentForm?store=${storeParam}`));
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
                    {getActiveServices().length}
                  </div>
                  <div className="text-sm text-yellow-600">Em Atendimento</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="lg:col-span-8">
          <Tabs defaultValue="all" value={currentTab} onValueChange={setCurrentTab}>
            <div className="flex justify-between items-center mb-4">
              <TabsList>
                <TabsTrigger value="all">Todos</TabsTrigger>
                <TabsTrigger value="appointments">Agendamentos</TabsTrigger>
                <TabsTrigger value="queue">Fila de Atendimento</TabsTrigger>
                <TabsTrigger value="completed">Atendimentos Concluídos</TabsTrigger>
                <TabsTrigger value="canceled">Cancelados</TabsTrigger>
              </TabsList>
              <Button variant="ghost" onClick={loadData} size="icon">
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>

            <TabsContent value="all" className="space-y-4">
              {getActiveAppointments().length === 0 && getActiveServices().length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  Nenhum agendamento ativo ou serviço em atendimento para este dia.
                </div>
              ) : (
                <>
                  {getActiveServices().map((service) => (
                    <QueueServiceCard
                      key={`queue-${service.id}`}
                      service={service}
                      isQueueItem={true}
                      onLoadData={loadData}
                      onNavigate={navigate}
                    />
                  ))}
                  {getActiveAppointments()
                    .filter(app => !queueServices.some(q => q.appointment_id === app.id))
                    .map((appointment) => (
                    <QueueServiceCard
                      key={`appt-${appointment.id}`}
                      service={appointment}
                      isQueueItem={false}
                      onLoadData={loadData}
                      onNavigate={navigate}
                    />
                  ))}
                </>
              )}
            </TabsContent>

            <TabsContent value="appointments" className="space-y-4">
              {getActiveAppointments().length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  Nenhum agendamento para este dia.
                </div>
              ) : (
                <div className="space-y-4">
                  {getActiveAppointments().map((appointment) => (
                    <QueueServiceCard
                      key={appointment.id}
                      service={appointment}
                      isQueueItem={false}
                      onLoadData={loadData}
                      onNavigate={navigate}
                    />
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="queue" className="space-y-4">
              {getActiveServices().length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  Nenhum serviço na fila para este dia.
                </div>
              ) : (
                getActiveServices().map((service) => (
                  <QueueServiceCard
                    key={service.id}
                    service={service}
                    isQueueItem={true}
                    onLoadData={loadData}
                    onNavigate={navigate}
                  />
                ))
              )}
            </TabsContent>

            <TabsContent value="completed" className="space-y-4">
              {getCompletedServices().length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  Nenhum atendimento concluído para este dia.
                </div>
              ) : (
                getCompletedServices().map((service) => (
                  <QueueServiceCard
                    key={service.id}
                    service={service}
                    isQueueItem={true}
                    onLoadData={loadData}
                    onNavigate={navigate}
                  />
                ))
              )}
            </TabsContent>

            <TabsContent value="canceled" className="space-y-4">
              {getCanceledAppointments().length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  Nenhum agendamento cancelado para este dia.
                </div>
              ) : (
                getCanceledAppointments().map((appointment) => (
                  <QueueServiceCard
                    key={appointment.id}
                    service={appointment}
                    isQueueItem={false}
                    onLoadData={loadData}
                    onNavigate={navigate}
                  />
                ))
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>
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
      console.log("Tentando cancelar agendamento com ID:", service.appointment_id);
      if (!service.appointment_id) {
        console.error("Erro: ID do agendamento não encontrado no serviço:", service);
        toast({ title: "Erro", description: "ID do agendamento não encontrado.", variant: "destructive" });
        return;
      }
      await Appointment.update(service.appointment_id, { 
        status: "cancelled"
      });
      toast({
        title: "Sucesso",
        description: "Agendamento cancelado com sucesso!"
      });
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
            <ServiceTimer service={service} compact />
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