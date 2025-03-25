import React, { useState, useEffect } from "react";
import { Appointment } from "@/api/entities";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/use-toast";
import { Plus, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";

export default function AppointmentTab({ pet }) {
  const navigate = useNavigate();
  const [appointments, setAppointments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (pet?.id) {
      loadAppointments();
    }
  }, [pet?.id]);

  const loadAppointments = async () => {
    if (!pet?.id) return;
    
    try {
      const tenantId = localStorage.getItem('current_tenant');
      const data = await Appointment.filter({
        pet_id: pet.id,
        tenant_id: tenantId
      });
      setAppointments(data);
    } catch (error) {
      console.error("Erro ao carregar agendamentos:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os agendamentos.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleNewAppointment = () => {
    const storeParam = localStorage.getItem('current_tenant');
    navigate(createPageUrl(`AppointmentForm?pet_id=${pet.id}&store=${storeParam}`));
  };

  const getStatusBadgeVariant = (status) => {
    switch (status) {
      case "scheduled": return "outline";
      case "confirmed": return "secondary";
      case "completed": return "success";
      case "canceled": return "destructive";
      default: return "outline";
    }
  };

  const getStatusDisplay = (status) => {
    switch (status) {
      case "scheduled": return "Agendado";
      case "confirmed": return "Confirmado";
      case "completed": return "Concluído";
      case "canceled": return "Cancelado";
      default: return status;
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Agendamentos</CardTitle>
        <Button onClick={handleNewAppointment}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Agendamento
        </Button>
      </CardHeader>
      <CardContent>
        {appointments.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            Nenhum agendamento encontrado.
          </div>
        ) : (
          <div className="space-y-4">
            {appointments.map((appointment) => (
              <div
                key={appointment.id}
                className="flex items-center justify-between p-4 border rounded-lg"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <Badge variant={getStatusBadgeVariant(appointment.status)}>
                      {getStatusDisplay(appointment.status)}
                    </Badge>
                    <span className="font-medium">
                      {format(new Date(appointment.date), "dd/MM/yyyy HH:mm")}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500 mt-1">
                    Tipo: {appointment.type}
                  </p>
                  {appointment.notes && (
                    <p className="text-sm text-gray-500">
                      Observações: {appointment.notes}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}