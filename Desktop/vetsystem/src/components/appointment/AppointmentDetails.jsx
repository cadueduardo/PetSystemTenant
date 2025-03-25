import React, { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Appointment } from "@/api/entities";
import { TransportRoute } from "@/api/entities";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Clock, Check, X, Edit } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function AppointmentDetails({ appointment, pet, customer, onClose, onEdit, onDelete, onUpdate }) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [expandNotes, setExpandNotes] = useState(false);
  const [status, setStatus] = useState(appointment.status);
  const [loading, setLoading] = useState(false);

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      // Se há rota de transporte associada, também excluir a rota
      if (appointment.transport_route_id) {
        try {
          await TransportRoute.delete(appointment.transport_route_id);
          console.log("Rota de transporte excluída com sucesso");
        } catch (error) {
          console.error("Erro ao excluir rota de transporte:", error);
        }
      }
      
      await Appointment.delete(appointment.id);
      onDelete();
      
      toast({
        title: "Agendamento excluído",
        description: "O agendamento foi excluído com sucesso"
      });
    } catch (error) {
      console.error("Erro ao excluir agendamento:", error);
      toast({
        title: "Erro",
        description: "Não foi possível excluir o agendamento",
        variant: "destructive"
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleUpdateStatus = async (newStatus) => {
    setLoading(true);
    try {
      await Appointment.update(appointment.id, { status: newStatus });
      setStatus(newStatus);
      onUpdate();
      
      toast({
        title: "Status atualizado",
        description: "O status do agendamento foi atualizado com sucesso"
      });
    } catch (error) {
      console.error("Erro ao atualizar status:", error);
      toast({
        title: "Erro",
        description: "Não foi possível atualizar o status",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const getTypeLabel = (type) => {
    const types = {
      consultation: "Consulta",
      exam: "Exame",
      vaccination: "Vacinação",
      surgery: "Cirurgia",
      return: "Retorno",
      telemedicine: "Telemedicina"
    };
    return types[type] || type;
  };

  const getStatusLabel = (status) => {
    const statuses = {
      scheduled: "Agendado",
      confirmed: "Confirmado",
      completed: "Concluído",
      canceled: "Cancelado",
      no_show: "Não compareceu"
    };
    return statuses[status] || status;
  };

  const getStatusColor = (status) => {
    const colors = {
      scheduled: "bg-blue-100 text-blue-800",
      confirmed: "bg-green-100 text-green-800",
      completed: "bg-purple-100 text-purple-800",
      canceled: "bg-red-100 text-red-800",
      no_show: "bg-yellow-100 text-yellow-800"
    };
    return colors[status] || "bg-gray-100 text-gray-800";
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold">{pet?.name || "Pet"}</h2>
          <p className="text-gray-500">{customer?.full_name || "Cliente"}</p>
        </div>
        <Badge className={getStatusColor(status)}>
          {getStatusLabel(status)}
        </Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-medium text-gray-500">Tipo</h3>
            <p>{getTypeLabel(appointment.type)}</p>
          </div>
          
          <div>
            <h3 className="text-sm font-medium text-gray-500">Data e Hora</h3>
            <div className="flex items-center">
              <Clock className="h-4 w-4 mr-2 text-gray-400" />
              <p>
                {format(new Date(appointment.date), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                {appointment.end_date && (
                  <> - {format(new Date(appointment.end_date), "HH:mm", { locale: ptBR })}</>
                )}
              </p>
            </div>
          </div>
          
          {appointment.doctor && (
            <div>
              <h3 className="text-sm font-medium text-gray-500">Veterinário</h3>
              <p>{appointment.doctor}</p>
            </div>
          )}
        </div>
        
        <div className="space-y-4">
          {appointment.reason && (
            <div>
              <h3 className="text-sm font-medium text-gray-500">Motivo</h3>
              <p>{appointment.reason}</p>
            </div>
          )}
          
          {appointment.notes && (
            <div>
              <h3 className="text-sm font-medium text-gray-500">Observações</h3>
              <p className={!expandNotes && appointment.notes.length > 100 ? "truncate" : ""}>
                {expandNotes || appointment.notes.length <= 100 
                  ? appointment.notes 
                  : `${appointment.notes.substring(0, 100)}...`}
              </p>
              {appointment.notes.length > 100 && (
                <button 
                  className="text-blue-600 text-sm"
                  onClick={() => setExpandNotes(!expandNotes)}
                >
                  {expandNotes ? "Ver menos" : "Ver mais"}
                </button>
              )}
            </div>
          )}

          {appointment.transport_route_id && (
            <div>
              <h3 className="text-sm font-medium text-gray-500">Transporte</h3>
              <Badge variant="outline" className="bg-green-50 border-green-200 text-green-700">
                Serviço de Leva e Traz incluído
              </Badge>
            </div>
          )}
        </div>
      </div>

      <div className="space-y-3 pt-2">
        <h3 className="text-sm font-medium text-gray-500">Alterar Status</h3>
        <Select value={status} onValueChange={handleUpdateStatus} disabled={loading}>
          <SelectTrigger>
            <SelectValue placeholder="Selecione o status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="scheduled">Agendado</SelectItem>
            <SelectItem value="confirmed">Confirmado</SelectItem>
            <SelectItem value="completed">Concluído</SelectItem>
            <SelectItem value="canceled">Cancelado</SelectItem>
            <SelectItem value="no_show">Não compareceu</SelectItem>
          </SelectContent>
        </Select>
      </div>
      
      <div className="flex space-x-2 justify-end mt-6">
        <Button
          variant="destructive"
          onClick={handleDelete}
          disabled={isDeleting}
        >
          {isDeleting ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <X className="mr-2 h-4 w-4" />
          )}
          Excluir
        </Button>
        <Button variant="outline" onClick={onClose}>
          Fechar
        </Button>
        <Button onClick={() => onEdit(appointment)}>
          <Edit className="mr-2 h-4 w-4" />
          Editar
        </Button>
      </div>
    </div>
  );
}