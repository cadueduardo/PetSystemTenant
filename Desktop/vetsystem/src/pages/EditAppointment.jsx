import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Tenant } from "@/api/entities";
import { User } from "@/api/entities";
import { Appointment } from "@/api/entities";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2 } from "lucide-react";
import AppointmentForm from "../components/appointment/AppointmentForm";

export default function EditAppointmentPage() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [currentTenant, setCurrentTenant] = useState(null);
  const [appointmentId, setAppointmentId] = useState(null);
  const [appointment, setAppointment] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    checkAuth();
    
    // Obter ID do agendamento da URL
    const urlParams = new URLSearchParams(window.location.search);
    const id = urlParams.get("id");
    if (id) {
      setAppointmentId(id);
      loadAppointment(id);
    } else {
      setError("ID do agendamento não fornecido");
      setIsLoading(false);
    }
  }, []);

  const checkAuth = async () => {
    try {
      const userData = await User.me();
      const tenants = await Tenant.list();
      const activeTenant = tenants.find(t => t.status === "active");
      
      if (activeTenant) {
        setCurrentTenant(activeTenant);
      } else {
        toast({
          title: "Erro",
          description: "Nenhuma clínica ativa encontrada.",
          variant: "destructive"
        });
        navigate(createPageUrl("Dashboard"));
      }
    } catch (error) {
      console.error("Erro ao verificar autenticação:", error);
      navigate(createPageUrl("Landing"));
    }
  };

  const loadAppointment = async (id) => {
    try {
      const appointmentData = await Appointment.get(id);
      if (!appointmentData || appointmentData.tenant_id !== currentTenant?.id) {
        setError("Agendamento não encontrado");
        return;
      }
      setAppointment(appointmentData);
    } catch (error) {
      console.error("Erro ao carregar agendamento:", error);
      setError("Não foi possível carregar os dados do agendamento");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSuccess = () => {
    navigate(createPageUrl("Calendar"));
  };

  const handleCancel = () => {
    navigate(createPageUrl("Calendar"));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-12 w-12 animate-spin text-blue-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto py-6">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-red-500 mb-4">{error}</p>
              <Button onClick={() => navigate(createPageUrl("Calendar"))}>
                Voltar para Agenda
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6">
      <div className="flex items-center mb-6">
        <Button
          variant="outline"
          size="icon"
          onClick={() => navigate(createPageUrl("Calendar"))}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="ml-4">
          <h1 className="text-2xl font-bold">Editar Agendamento</h1>
          <p className="text-gray-500">Atualize as informações do agendamento</p>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          <AppointmentForm
            appointment={appointment}
            onSuccess={handleSuccess}
            onCancel={handleCancel}
            tenantId={currentTenant?.id}
          />
        </CardContent>
      </Card>
    </div>
  );
}