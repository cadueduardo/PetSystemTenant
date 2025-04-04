import React, { useState, useEffect } from "react";
import { Appointment } from "@/api/entities";
import { Pet } from "@/api/entities";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  Calendar as CalendarIcon,
  Clock,
  Clipboard,
  Plus,
  Loader2
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import AppointmentForm from "../appointment/AppointmentForm";

export default function AppointmentList({ pet, onAppointmentCreated }) {
  const [appointments, setAppointments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showNewAppointmentModal, setShowNewAppointmentModal] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [showAppointmentDetails, setShowAppointmentDetails] = useState(false);

  useEffect(() => {
    if (pet?.id) {
      loadAppointments();
    }
  }, [pet]);

  const loadAppointments = async () => {
    try {
      setIsLoading(true);
      const tenantId = localStorage.getItem('current_tenant');
      const petAppointments = await Appointment.filter({ pet_id: pet.id, tenant_id: tenantId });
      setAppointments(petAppointments);
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

  const handleNewAppointment = async (appointmentData) => {
    try {
      const newAppointment = await Appointment.create({
        ...appointmentData,
        pet_id: pet.id,
        tenant_id: localStorage.getItem('current_tenant')
      });
      
      setAppointments([newAppointment, ...appointments]);
      setShowNewAppointmentModal(false);
      
      toast({
        title: "Sucesso",
        description: "Agendamento criado com sucesso!"
      });
      
      if (onAppointmentCreated) {
        onAppointmentCreated(newAppointment);
      }
    } catch (error) {
      console.error("Erro ao criar agendamento:", error);
      toast({
        title: "Erro",
        description: "Não foi possível criar o agendamento.",
        variant: "destructive"
      });
    }
  };

  const getAppointmentStatusBadge = (status) => {
    switch (status) {
      case "scheduled":
        return <Badge className="bg-blue-100 text-blue-800">Agendado</Badge>;
      case "confirmed":
        return <Badge className="bg-green-100 text-green-800">Confirmado</Badge>;
      case "completed":
        return <Badge className="bg-purple-100 text-purple-800">Concluído</Badge>;
      case "canceled":
        return <Badge className="bg-red-100 text-red-800">Cancelado</Badge>;
      case "no_show":
        return <Badge className="bg-amber-100 text-amber-800">Não Compareceu</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getAppointmentTypeBadge = (type) => {
    switch (type) {
      case "consultation":
        return <Badge variant="outline" className="bg-indigo-50 text-indigo-700">Consulta</Badge>;
      case "exam":
        return <Badge variant="outline" className="bg-cyan-50 text-cyan-700">Exame</Badge>;
      case "vaccination":
        return <Badge variant="outline" className="bg-green-50 text-green-700">Vacinação</Badge>;
      case "surgery":
        return <Badge variant="outline" className="bg-red-50 text-red-700">Cirurgia</Badge>;
      case "return":
        return <Badge variant="outline" className="bg-amber-50 text-amber-700">Retorno</Badge>;
      case "grooming":
        return <Badge variant="outline" className="bg-purple-50 text-purple-700">Banho e Tosa</Badge>;
      default:
        return <Badge variant="outline">{type}</Badge>;
    }
  };

  const formatAppointmentType = (type) => {
    switch (type) {
      case "consultation": return "Consulta";
      case "exam": return "Exame";
      case "vaccination": return "Vacinação";
      case "surgery": return "Cirurgia";
      case "return": return "Retorno";
      case "grooming": return "Banho e Tosa";
      case "telemedicine": return "Telemedicina";
      default: return type;
    }
  };

  const handleAppointmentClick = (appointment) => {
    setSelectedAppointment(appointment);
    setShowAppointmentDetails(true);
  };

  return (
    <div>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-xl font-bold">Agendamentos</CardTitle>
          <Button onClick={() => setShowNewAppointmentModal(true)} className="h-8 px-2">
            <Plus className="mr-1 h-4 w-4" />
            Novo Agendamento
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center items-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
            </div>
          ) : appointments.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>Nenhum agendamento encontrado.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {appointments.map((appointment) => (
                <div 
                  key={appointment.id}
                  className="p-4 border rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                  onClick={() => handleAppointmentClick(appointment)}
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between mb-2">
                    <div className="flex items-center gap-2 mb-2 md:mb-0">
                      {getAppointmentTypeBadge(appointment.type)}
                      {getAppointmentStatusBadge(appointment.status)}
                    </div>
                    <div className="flex items-center gap-1 text-sm text-gray-600">
                      <CalendarIcon className="h-4 w-4" />
                      {format(new Date(appointment.date), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                      <Clock className="h-4 w-4 ml-2" />
                      {format(new Date(appointment.date), "HH:mm", { locale: ptBR })}
                    </div>
                  </div>
                  
                  <p className="font-medium">{appointment.reason || formatAppointmentType(appointment.type)}</p>
                  {appointment.doctor && (
                    <p className="text-sm text-gray-600">Veterinário: {appointment.doctor}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal de novo agendamento */}
      <Dialog 
        open={showNewAppointmentModal} 
        onOpenChange={setShowNewAppointmentModal}
      >
        <DialogContent className="w-[90vw] max-w-[90vw] h-[90vh] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Novo Agendamento</DialogTitle>
            <DialogDescription>
              Preencha os dados do novo agendamento
            </DialogDescription>
          </DialogHeader>
          <AppointmentForm 
            onSubmit={handleNewAppointment}
            onCancel={() => setShowNewAppointmentModal(false)}
            pet={pet}
          />
        </DialogContent>
      </Dialog>

      {/* Modal de detalhes do agendamento */}
      <Dialog 
        open={showAppointmentDetails} 
        onOpenChange={setShowAppointmentDetails}
      >
        <DialogContent className="w-[90vw] max-w-[90vw] h-[90vh] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalhes do Agendamento</DialogTitle>
            <DialogDescription>
              Visualize os detalhes do agendamento selecionado
            </DialogDescription>
          </DialogHeader>
          {selectedAppointment && (
            <div className="space-y-6 p-4">
              <div className="space-y-2">
                <h2 className="text-2xl font-bold">Detalhes do Agendamento</h2>
                <div className="flex flex-wrap gap-2">
                  {getAppointmentTypeBadge(selectedAppointment.type)}
                  {getAppointmentStatusBadge(selectedAppointment.status)}
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <h3 className="text-sm font-medium text-gray-500">Tipo</h3>
                    <p className="text-lg">{formatAppointmentType(selectedAppointment.type)}</p>
                  </div>
                  
                  <div>
                    <h3 className="text-sm font-medium text-gray-500">Motivo</h3>
                    <p className="text-lg">{selectedAppointment.reason || "Não informado"}</p>
                  </div>
                  
                  <div>
                    <h3 className="text-sm font-medium text-gray-500">Data e Hora</h3>
                    <p className="text-lg">
                      {format(new Date(selectedAppointment.date), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR })}
                    </p>
                  </div>
                  
                  <div>
                    <h3 className="text-sm font-medium text-gray-500">Veterinário Responsável</h3>
                    <p className="text-lg">{selectedAppointment.doctor || "Não informado"}</p>
                  </div>
                </div>
                
                <div className="space-y-4">
                  {selectedAppointment.health_plan_coverage && (
                    <div>
                      <h3 className="text-sm font-medium text-gray-500">Plano de Saúde</h3>
                      <p className="text-lg">Atendimento coberto pelo plano</p>
                      {selectedAppointment.health_plan_authorization && (
                        <p className="text-sm text-gray-600">
                          Autorização: {selectedAppointment.health_plan_authorization}
                        </p>
                      )}
                    </div>
                  )}
                  
                  {selectedAppointment.is_telemedicine && (
                    <div>
                      <h3 className="text-sm font-medium text-gray-500">Telemedicina</h3>
                      <p className="text-lg">Consulta por telemedicina</p>
                      {selectedAppointment.telemedicine_link && (
                        <p className="text-sm text-blue-600 underline">
                          <a href={selectedAppointment.telemedicine_link} target="_blank" rel="noopener noreferrer">
                            Link para a consulta
                          </a>
                        </p>
                      )}
                    </div>
                  )}
                  
                  <div>
                    <h3 className="text-sm font-medium text-gray-500">Observações</h3>
                    <p className="text-lg">{selectedAppointment.notes || "Sem observações"}</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}