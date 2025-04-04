import React, { useState, useEffect } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";
import { MoreVertical, Pencil, XCircle, ArrowRight } from "lucide-react";
import { Appointment, Service, QueueService } from "@/api/entities";
import { useToast } from "@/components/ui/use-toast";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";

export default function AppointmentList({ appointments, onUpdate }) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [cancelReason, setCancelReason] = useState("");
  const [localAppointments, setLocalAppointments] = useState(appointments);
  const [services, setServices] = useState([]);
  const [formData, setFormData] = useState({
    service_id: "",
    date: "",
    time: "",
    notes: "",
    status: ""
  });

  useEffect(() => {
    setLocalAppointments(appointments);
  }, [appointments]);

  useEffect(() => {
    loadServices();
  }, []);

  const loadServices = async () => {
    try {
      const tenantId = localStorage.getItem('current_tenant');
      const servicesData = await Service.filter({ tenant_id: tenantId });
      setServices(servicesData);
    } catch (error) {
      console.error("Erro ao carregar serviços:", error);
    }
  };

  const handleCancel = async () => {
    try {
      await Appointment.update(selectedAppointment.id, {
        ...selectedAppointment,
        status: "cancelled",
        cancellation_reason: cancelReason
      });

      setLocalAppointments(prev => 
        prev.map(app => 
          app.id === selectedAppointment.id 
            ? { ...app, status: "cancelled", cancellation_reason: cancelReason }
            : app
        )
      );

      toast({
        title: "Sucesso",
        description: "Agendamento cancelado com sucesso!",
        duration: 3000,
        variant: "default"
      });

      setCancelDialogOpen(false);
      setCancelReason("");
      onUpdate();
    } catch (error) {
      toast({
        title: "Erro",
        description: "Não foi possível cancelar o agendamento.",
        variant: "destructive",
        duration: 3000
      });
    }
  };

  const handleEdit = (appointment) => {
    setSelectedAppointment(appointment);
    setFormData({
      service_id: appointment.service_id,
      date: format(new Date(appointment.date), "yyyy-MM-dd"),
      time: format(new Date(appointment.date), "HH:mm"),
      notes: appointment.notes || "",
      status: appointment.status
    });
    setEditDialogOpen(true);
  };

  const handleSaveEdit = async () => {
    try {
      const [hours, minutes] = formData.time.split(":");
      const appointmentDate = new Date(formData.date);
      appointmentDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);

      await Appointment.update(selectedAppointment.id, {
        ...selectedAppointment,
        service_id: formData.service_id,
        date: appointmentDate.toISOString(),
        notes: formData.notes,
        status: formData.status
      });

      toast({
        title: "Sucesso",
        description: "Agendamento atualizado com sucesso!",
        duration: 3000,
        variant: "default"
      });

      setEditDialogOpen(false);
      onUpdate();
    } catch (error) {
      toast({
        title: "Erro",
        description: "Não foi possível atualizar o agendamento.",
        variant: "destructive",
        duration: 3000
      });
    }
  };

  const handleAddToQueue = async (appointment) => {
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
        description: "Serviço adicionado à fila com sucesso!",
        duration: 3000,
        variant: "default"
      });
      onUpdate();
    } catch (error) {
      toast({
        title: "Erro",
        description: "Não foi possível adicionar o serviço à fila.",
        variant: "destructive",
        duration: 3000
      });
    }
  };

  if (!localAppointments || localAppointments.length === 0) {
    return (
      <div className="flex items-center justify-center p-8 text-gray-500">
        Nenhum agendamento cadastrado
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {localAppointments.map((appointment) => (
        <div
          key={appointment.id}
          className="flex items-center justify-between p-4 bg-white rounded-lg shadow"
        >
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="outline">
                {format(new Date(appointment.date), "HH:mm")}
              </Badge>
              {getStatusBadge(appointment.status)}
            </div>
            <h3 className="font-medium">{appointment.pet?.name || "Pet não encontrado"}</h3>
            <p className="text-sm text-gray-500">
              {appointment.customer?.full_name || "Cliente não encontrado"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleAddToQueue(appointment)}
            >
              Adicionar à Fila
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-8 w-8 p-0">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleEdit(appointment)}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Editar
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    setSelectedAppointment(appointment);
                    setCancelDialogOpen(true);
                  }}
                  className="text-red-600"
                >
                  <XCircle className="mr-2 h-4 w-4" />
                  Cancelar Agendamento
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      ))}

      {/* Modal de Cancelamento */}
      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancelar Agendamento</DialogTitle>
            <DialogDescription>
              Digite o motivo do cancelamento (opcional):
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            placeholder="Motivo do cancelamento..."
            className="mt-4"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelDialogOpen(false)}>
              Voltar
            </Button>
            <Button variant="destructive" onClick={handleCancel}>
              Confirmar Cancelamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Edição */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Agendamento</DialogTitle>
            <DialogDescription>
              Edite os detalhes do agendamento
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Cliente</Label>
              <div className="text-sm text-gray-500">
                {selectedAppointment?.customer?.full_name}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Pet</Label>
              <div className="text-sm text-gray-500">
                {selectedAppointment?.pet?.name}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Serviço</Label>
              <Select
                value={formData.service_id}
                onValueChange={(value) => setFormData(prev => ({ ...prev, service_id: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um serviço" />
                </SelectTrigger>
                <SelectContent>
                  {services.map(service => (
                    <SelectItem key={service.id} value={service.id}>
                      {service.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Data</Label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                  className="w-full p-2 border rounded-md"
                />
              </div>

              <div className="space-y-2">
                <Label>Horário</Label>
                <input
                  type="time"
                  value={formData.time}
                  onChange={(e) => setFormData(prev => ({ ...prev, time: e.target.value }))}
                  className="w-full p-2 border rounded-md"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={formData.status}
                onValueChange={(value) => setFormData(prev => ({ ...prev, status: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="scheduled">Agendado</SelectItem>
                  <SelectItem value="confirmed">Confirmado</SelectItem>
                  <SelectItem value="in_progress">Em Andamento</SelectItem>
                  <SelectItem value="completed">Concluído</SelectItem>
                  <SelectItem value="cancelled">Cancelado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Adicione observações..."
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveEdit}>
              Salvar Alterações
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function getStatusBadge(status) {
  const statusConfig = {
    scheduled: { label: "Agendado", variant: "outline" },
    confirmed: { label: "Confirmado", variant: "default" },
    in_progress: { label: "Em Andamento", variant: "secondary" },
    completed: { label: "Concluído", variant: "success" },
    cancelled: { label: "Cancelado", variant: "destructive" }
  };

  const config = statusConfig[status] || statusConfig.scheduled;
  return (
    <Badge variant={config.variant}>
      {config.label}
    </Badge>
  );
} 