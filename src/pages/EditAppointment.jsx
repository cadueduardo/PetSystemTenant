import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Tenant } from "@/api/entities";
import { Appointment } from "@/api/entities";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2 } from "lucide-react";
import AppointmentForm from "@/components/appointment/AppointmentForm";
import { toast } from "@/components/ui/use-toast";

export default function EditAppointmentPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [isLoading, setIsLoading] = useState(true);
  const [appointment, setAppointment] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Get appointment ID from route params (obtained via useParams hook above)
    if (!id) {
      setError("ID do agendamento não fornecido na rota.");
      setIsLoading(false);
      return; // Stop if no ID
    }
    
    // Chain the async operations: check auth/tenant first, then load appointment
    const initialize = async () => {
      try {
        const tenant = await checkAuthAndGetTenant(); // Check auth and get tenant
        if (tenant) {
          await loadAppointment(id, tenant); // Load appointment using the tenant
        }
      } catch (err) {
        // Errors from checkAuthAndGetTenant or loadAppointment will be caught here
        // setError is already set within those functions if needed
        console.error("Initialization error:", err);
      } finally {
         setIsLoading(false); // Ensure loading stops even if there's an error early on
      }
    };

    initialize();

  }, [id, navigate]); // Add id as dependency

  // Modified function to return the tenant or handle errors/redirects
  const checkAuthAndGetTenant = async () => {
    try {
      // You might need User.me() depending on your auth setup, but let's assume it's handled
      // const userData = await User.me(); 
      const tenants = await Tenant.list(); // Still uses Mock
      const activeTenant = tenants.find(t => t.status === "active"); 
      
      if (activeTenant) {
        return activeTenant; // Return the tenant object
      } else {
        setError("Nenhuma clínica ativa encontrada.");
        // Optionally display a toast message as well
        toast({ title: "Erro", description: "Nenhuma clínica ativa encontrada.", variant: "destructive" });
        // navigate(createPageUrl("Dashboard")); 
        return null; // Indicate tenant not found
      }
    } catch (error) {
      console.error("Erro ao verificar autenticação/tenant:", error);
      setError("Erro ao verificar autenticação/tenant.");
      // Optionally display a toast message as well
      toast({ title: "Erro", description: "Erro ao verificar autenticação/tenant.", variant: "destructive" });
      // navigate(createPageUrl("Landing")); // Optionally navigate away
      return null; // Indicate error
    }
  };

  // Modified function to accept tenant object
  const loadAppointment = async (id, tenant) => {
    if (!tenant) { 
        //setError("Tenant inválido para carregar agendamento."); // Already handled by checkAuth
        return; 
    }
    try {
      console.log(`[EditAppointmentPage] Loading appointment ${id} for tenant ${tenant.id}`);
      const appointmentData = await Appointment.get(id); // Uses appointmentService.get
      
      // Verify if appointment exists and belongs to the correct tenant
      if (!appointmentData) {
        console.error(`[EditAppointmentPage] Appointment ${id} not found via Appointment.get`);
        setError("Agendamento não encontrado.");
        toast({ title: "Erro", description: "Agendamento não encontrado.", variant: "destructive" });
        return;
      }
       if (appointmentData.tenant_id !== tenant.id) {
        console.error(`[EditAppointmentPage] Appointment ${id} tenant (${appointmentData.tenant_id}) does not match current tenant (${tenant.id})`);
        setError("Este agendamento não pertence à clínica ativa.");
        toast({ title: "Erro", description: "Este agendamento não pertence à clínica ativa.", variant: "destructive" });
        return;
      }
      
      console.log("[EditAppointmentPage] Appointment data loaded successfully:", appointmentData);
      setAppointment(appointmentData);
    } catch (error) {
      console.error(`[EditAppointmentPage] Erro ao carregar agendamento ${id}:`, error);
      setError("Não foi possível carregar os dados do agendamento.");
      toast({ title: "Erro", description: "Não foi possível carregar os dados do agendamento.", variant: "destructive" });
    } 
    // setIsLoading(false) is now handled in the initialize function's finally block
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
          />
        </CardContent>
      </Card>
    </div>
  );
}