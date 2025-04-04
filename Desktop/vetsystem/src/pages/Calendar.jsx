import React, { useState, useEffect } from "react";
import { format, isSameDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Appointment } from "@/api/entities";
import { QueueService } from "@/api/entities";
import { Customer } from "@/api/entities";
import { Service } from "@/api/entities";
import { Pet } from "@/api/entities";
import { getMockData } from "@/api/mockData";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Separator } from "@/components/ui/separator";
import { toast } from "@/components/ui/use-toast";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import ServiceTimer from "../components/queue/ServiceTimer";
import AppointmentList from "@/components/calendar/AppointmentList";
import {
  Plus,
  Calendar as CalendarIcon,
  Clock,
  Loader2,
  ArrowRight,
  RefreshCw,
  Filter,
  Search,
  Dog,
  Cat,
  MoreVertical,
  Edit,
  X
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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
  const [appointments, setAppointments] = useState([]);
  const [queueServices, setQueueServices] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [view, setView] = useState("calendar");
  const [currentTab, setCurrentTab] = useState("all");

  useEffect(() => {
    loadData();
  }, [selectedDate]);

  const clearCacheAndReload = () => {
    // Limpar o localStorage
    localStorage.removeItem('appointments');
    localStorage.removeItem('queueServices');
    localStorage.removeItem('customers');
    localStorage.removeItem('pets');
    localStorage.removeItem('services');
    
    // Recarregar os dados
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
      
      // Carregar agendamentos
      const appointmentsData = await Appointment.filter({
        tenant_id: tenantId,
        date: formattedDate
      });
      
      console.log('Agendamentos carregados:', appointmentsData);
      
      // Filtrar agendamentos cancelados
      const activeAppointments = appointmentsData.filter(app => app.status !== "cancelled");
      console.log('Agendamentos ativos:', activeAppointments);
      setAppointments(activeAppointments);
      
      // Carregar serviços da fila
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

  // Função para filtrar serviços concluídos
  const getCompletedServices = () => {
    return queueServices.filter(service => service.status === "completed");
  };

  // Função para filtrar serviços ativos
  const getActiveServices = () => {
    return queueServices.filter(service => service.status !== "completed");
  };

  const addToQueue = async (appointment) => {
    try {
      const queueService = {
        appointment_id: appointment.id,
        pet_id: appointment.pet_id,
        customer_id: appointment.customer_id,
        service_id: appointment.service_id,
        appointment_date: appointment.date,
        status: "scheduled",
        tenant_id: localStorage.getItem('current_tenant')
      };

      await QueueService.create(queueService);
      toast({
        title: "Sucesso",
        description: "Serviço adicionado à fila com sucesso!"
      });
      loadData(); // Recarrega os dados para atualizar a lista
    } catch (error) {
      console.error("Erro ao adicionar à fila:", error);
      toast({
        title: "Erro",
        description: "Não foi possível adicionar o serviço à fila.",
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
                    {appointments.length}
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
              </TabsList>
              <Button variant="ghost" onClick={loadData} size="icon">
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>

            <TabsContent value="all" className="space-y-4">
              {appointments.length === 0 && queueServices.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  Nenhum agendamento ou serviço para este dia.
                </div>
              ) : (
                <>
                  <AppointmentList 
                    appointments={appointments} 
                    onUpdate={loadData}
                  />
                  {getActiveServices().map((service) => (
                    <QueueServiceCard
                      key={service.id}
                      service={service}
                      onLoadData={loadData}
                      onNavigate={navigate}
                    />
                  ))}
                </>
              )}
            </TabsContent>

            <TabsContent value="appointments" className="space-y-4">
              {appointments.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  Nenhum agendamento para este dia.
                </div>
              ) : (
                <AppointmentList 
                  appointments={appointments} 
                  onUpdate={loadData}
                />
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

function AppointmentCard({ appointment, onAddToQueue }) {
  const formatAppointmentDate = (dateString) => {
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        return "Data inválida";
      }
      return format(date, "HH:mm");
    } catch (error) {
      return "Data inválida";
    }
  };

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex justify-between items-start">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="outline">
                {formatAppointmentDate(appointment.date)}
              </Badge>
              {getStatusBadge(appointment.status)}
            </div>
            <h3 className="font-medium">{appointment.pet?.name || "Pet não encontrado"}</h3>
            <p className="text-sm text-gray-500">{appointment.customer?.full_name || "Cliente não encontrado"}</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onAddToQueue(appointment)}
          >
            Adicionar à Fila
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function QueueServiceCard({ service, onLoadData, onNavigate }) {
  const formatServiceDate = (dateString) => {
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        return "Data inválida";
      }
      return format(date, "HH:mm");
    } catch (error) {
      return "Data inválida";
    }
  };

  // Carrega os dados do pet e cliente
  const mockData = getMockData();
  const pet = mockData.pets.find(p => p.id === service.pet_id);
  const customer = mockData.customers.find(c => c.id === service.customer_id);

  console.log('Dados do pet:', pet);
  console.log('Dados do serviço:', service);

  const handleCancel = async () => {
    try {
      await QueueService.update(service.id, {
        ...service,
        status: "cancelled"
      });
      toast({
        title: "Sucesso",
        description: "Serviço cancelado com sucesso!"
      });
      onLoadData(); // Usa a função passada como prop
    } catch (error) {
      console.error("Erro ao cancelar serviço:", error);
      toast({
        title: "Erro",
        description: "Não foi possível cancelar o serviço.",
        variant: "destructive"
      });
    }
  };

  const handleEdit = () => {
    onNavigate(createPageUrl(`AppointmentForm?id=${service.appointment_id}`));
  };

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex justify-between items-start">
          <div className="flex items-start gap-3">
            {pet?.photo_url ? (
              <img
                src={pet.photo_url}
                alt={pet.name}
                className="w-12 h-12 rounded-full object-cover"
                onError={(e) => {
                  console.error('Erro ao carregar foto:', e);
                  e.target.onerror = null;
                  e.target.src = "https://via.placeholder.com/48";
                }}
              />
            ) : (
              <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center">
                {pet?.species?.toLowerCase().includes('cachorro') ? (
                  <Dog className="h-6 w-6 text-gray-500" />
                ) : pet?.species?.toLowerCase().includes('gato') ? (
                  <Cat className="h-6 w-6 text-gray-500" />
                ) : (
                  <span className="text-gray-500 text-sm">?</span>
                )}
              </div>
            )}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Badge variant="outline">
                  {formatServiceDate(service.appointment_date)}
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