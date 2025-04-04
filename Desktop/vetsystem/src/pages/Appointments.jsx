import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Appointment } from "@/api/entities";
import { Customer } from "@/api/entities";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/components/ui/use-toast";
import { format } from "date-fns";
import { Plus, Pencil, Trash, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function AppointmentsPage() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [appointments, setAppointments] = useState([]);
  const [customer, setCustomer] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const customerId = urlParams.get('customer');

      if (customerId) {
        const customerData = await Customer.get(customerId);
        setCustomer(customerData);

        const appointmentsData = await Appointment.filter({
          customer_id: customerId,
          tenant_id: localStorage.getItem('current_tenant')
        });
        setAppointments(appointmentsData);
      } else {
        navigate(createPageUrl("Calendar"));
      }
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
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">Agendamentos</h1>
          {customer && (
            <p className="text-gray-500">Cliente: {customer.full_name}</p>
          )}
        </div>
        <Button onClick={() => navigate(createPageUrl("AppointmentForm"))}>
          <Plus className="w-4 h-4 mr-2" />
          Novo Agendamento
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Histórico de Agendamentos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {appointments.length > 0 ? (
              appointments.map((appointment) => (
                <div
                  key={appointment.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <Badge variant={getStatusBadgeVariant(appointment.status)}>
                        {getStatusDisplay(appointment.status)}
                      </Badge>
                      <span className="font-medium">
                        {format(new Date(appointment.date), "dd/MM/yyyy HH:mm")}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">
                      Tipo: {appointment.type}
                    </p>
                    {appointment.notes && (
                      <p className="text-sm text-gray-600">
                        Observações: {appointment.notes}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate(createPageUrl(`AppointmentForm?id=${appointment.id}`))}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-center text-gray-500 py-8">
                Nenhum agendamento encontrado para este cliente.
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}