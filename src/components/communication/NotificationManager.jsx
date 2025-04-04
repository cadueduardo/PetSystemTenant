import React, { useState, useEffect } from "react";
import { User } from "@/api/entities";
import { Appointment } from "@/api/entities";
import { Pet } from "@/api/entities";
import { Customer } from "@/api/entities";
import { Tenant } from "@/api/entities";
import { SendEmail, SendSMS } from "@/api/integrations";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { 
  Tabs, 
  TabsContent, 
  TabsList, 
  TabsTrigger 
} from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { 
  Mail, 
  MessageSquare, 
  Send, 
  Calendar, 
  CheckCircle, 
  Bell, 
  Settings, 
  Loader2, 
  RefreshCw 
} from "lucide-react";
import { toast } from "@/components/ui/use-toast";

export default function NotificationManager() {
  const [activeTab, setActiveTab] = useState("upcoming");
  const [appointments, setAppointments] = useState([]);
  const [customers, setCustomers] = useState({});
  const [pets, setPets] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [selectedAppointments, setSelectedAppointments] = useState([]);
  const [sendingNotifications, setSendingNotifications] = useState(false);
  const [notificationTemplate, setNotificationTemplate] = useState("confirmation");

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const user = await User.me();
      const tenants = await Tenant.filter({ email: user.email, status: "active" });
      
      if (tenants.length > 0) {
        const tenantId = tenants[0].id;
        let appointmentsData = [];
        
        if (activeTab === "upcoming") {
          appointmentsData = await Appointment.filter({ 
            tenant_id: tenantId,
            status: "scheduled",
            confirmation_sent: false
          });
          
          appointmentsData = appointmentsData.filter(appointment => {
            const appointmentDate = new Date(appointment.date);
            const today = new Date();
            const nextWeek = new Date();
            nextWeek.setDate(today.getDate() + 7);
            return appointmentDate >= today && appointmentDate <= nextWeek;
          });
        } else if (activeTab === "tomorrow") {
          appointmentsData = await Appointment.filter({ 
            tenant_id: tenantId,
            status: "confirmed",
            reminder_sent: false
          });
          
          const tomorrow = new Date();
          tomorrow.setDate(tomorrow.getDate() + 1);
          appointmentsData = appointmentsData.filter(appointment => {
            const appointmentDate = new Date(appointment.date);
            return appointmentDate.getDate() === tomorrow.getDate() &&
                   appointmentDate.getMonth() === tomorrow.getMonth() &&
                   appointmentDate.getFullYear() === tomorrow.getFullYear();
          });
        }
        
        setAppointments(appointmentsData);
        
        setSelectedAppointments([]);
        
        if (appointmentsData.length > 0) {
          const petIds = [...new Set(appointmentsData.map(a => a.pet_id))];
          
          const petsData = await Promise.all(
            petIds.map(id => Pet.get(id))
          );
          
          const petsObj = {};
          petsData.forEach(pet => {
            petsObj[pet.id] = pet;
          });
          setPets(petsObj);
          
          const ownerIds = [...new Set(petsData.map(p => p.owner_id))];
          
          const customersData = await Promise.all(
            ownerIds.map(id => Customer.get(id))
          );
          
          const customersObj = {};
          customersData.forEach(customer => {
            customersObj[customer.id] = customer;
          });
          setCustomers(customersObj);
        }
      }
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
      toast({
        title: "Erro ao carregar dados",
        description: "Não foi possível carregar os dados de agendamentos.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedAppointments(appointments.map(a => a.id));
    } else {
      setSelectedAppointments([]);
    }
  };

  const handleSelectAppointment = (id) => {
    setSelectedAppointments(prev => {
      if (prev.includes(id)) {
        return prev.filter(item => item !== id);
      } else {
        return [...prev, id];
      }
    });
  };

  const getNotificationTemplate = (appointment, type = "confirmation") => {
    const pet = pets[appointment.pet_id];
    const customer = pet ? customers[pet.owner_id] : null;
    
    if (!pet || !customer) return "";
    
    const appointmentDate = new Date(appointment.date);
    const formattedDate = format(appointmentDate, "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
    const formattedTime = format(appointmentDate, "HH:mm", { locale: ptBR });
    
    if (type === "confirmation") {
      return `Olá ${customer.full_name}! Estamos confirmando a consulta para ${pet.name} no dia ${formattedDate} às ${formattedTime}. Por favor, responda SIM para confirmar ou NÃO para cancelar. Obrigado!`;
    } else if (type === "reminder") {
      return `Olá ${customer.full_name}! Lembramos que ${pet.name} tem uma consulta amanhã, dia ${formattedDate} às ${formattedTime}. Aguardamos seu comparecimento. Obrigado!`;
    }
    
    return "";
  };

  const sendNotifications = async () => {
    if (selectedAppointments.length === 0) {
      toast({
        title: "Nenhum agendamento selecionado",
        description: "Por favor, selecione pelo menos um agendamento para enviar notificações.",
        variant: "warning"
      });
      return;
    }
    
    setSendingNotifications(true);
    
    try {
      for (const appointmentId of selectedAppointments) {
        const appointment = appointments.find(a => a.id === appointmentId);
        const pet = pets[appointment.pet_id];
        const customer = pet ? customers[pet.owner_id] : null;
        
        if (!pet || !customer) continue;
        
        const notificationType = activeTab === "upcoming" ? "confirmation" : "reminder";
        const message = getNotificationTemplate(appointment, notificationType);
        
        const contactMethod = customer.preferred_contact_method || "email";
        
        if (contactMethod === "email" || !customer.phone) {
          await SendEmail({
            to: customer.email,
            subject: notificationType === "confirmation" 
              ? "Confirmação de Consulta" 
              : "Lembrete de Consulta",
            body: message
          });
        } else if (contactMethod === "sms" || contactMethod === "whatsapp") {
          await SendSMS({
            to: customer.phone,
            body: message
          });
        }
        
        if (notificationType === "confirmation") {
          await Appointment.update(appointmentId, { confirmation_sent: true });
        } else {
          await Appointment.update(appointmentId, { reminder_sent: true });
        }
      }
      
      toast({
        title: "Notificações enviadas com sucesso",
        description: `${selectedAppointments.length} notificações foram enviadas.`,
        variant: "success"
      });
      
      loadData();
    } catch (error) {
      console.error("Erro ao enviar notificações:", error);
      toast({
        title: "Erro ao enviar notificações",
        description: "Ocorreu um erro ao enviar as notificações. Por favor, tente novamente.",
        variant: "destructive"
      });
    } finally {
      setSendingNotifications(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Gerenciador de Notificações</CardTitle>
        <CardDescription>
          Envie confirmações e lembretes de consultas para seus clientes.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="upcoming">
              <Calendar className="h-4 w-4 mr-2" />
              Próximas Consultas
            </TabsTrigger>
            <TabsTrigger value="tomorrow">
              <Bell className="h-4 w-4 mr-2" />
              Consultas de Amanhã
            </TabsTrigger>
          </TabsList>

          <TabsContent value="upcoming">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-blue-600" />
                  <span className="font-medium">Confirmações Pendentes</span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={loadData}
                  disabled={isLoading}
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                  Atualizar
                </Button>
              </div>

              {isLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                </div>
              ) : appointments.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  Nenhuma confirmação pendente para os próximos 7 dias.
                </div>
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">
                          <Checkbox
                            checked={selectedAppointments.length === appointments.length}
                            onCheckedChange={handleSelectAll}
                          />
                        </TableHead>
                        <TableHead>Data</TableHead>
                        <TableHead>Horário</TableHead>
                        <TableHead>Pet</TableHead>
                        <TableHead>Tutor</TableHead>
                        <TableHead>Contato</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {appointments.map((appointment) => {
                        const pet = pets[appointment.pet_id];
                        const customer = pet ? customers[pet.owner_id] : null;
                        if (!pet || !customer) return null;

                        const appointmentDate = new Date(appointment.date);
                        return (
                          <TableRow key={appointment.id}>
                            <TableCell>
                              <Checkbox
                                checked={selectedAppointments.includes(appointment.id)}
                                onCheckedChange={() => handleSelectAppointment(appointment.id)}
                              />
                            </TableCell>
                            <TableCell>
                              {format(appointmentDate, "dd/MM/yyyy")}
                            </TableCell>
                            <TableCell>
                              {format(appointmentDate, "HH:mm")}
                            </TableCell>
                            <TableCell>{pet.name}</TableCell>
                            <TableCell>{customer.full_name}</TableCell>
                            <TableCell>
                              <Badge variant={customer.preferred_contact_method === "email" ? "default" : "secondary"}>
                                {customer.preferred_contact_method === "email" ? (
                                  <Mail className="h-3 w-3 mr-1" />
                                ) : (
                                  <MessageSquare className="h-3 w-3 mr-1" />
                                )}
                                {customer.preferred_contact_method === "email" ? customer.email : customer.phone}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>

                  <div className="flex justify-end mt-4">
                    <Button
                      onClick={sendNotifications}
                      disabled={selectedAppointments.length === 0 || sendingNotifications}
                    >
                      {sendingNotifications ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Enviando...
                        </>
                      ) : (
                        <>
                          <Send className="h-4 w-4 mr-2" />
                          Enviar Confirmações
                        </>
                      )}
                    </Button>
                  </div>
                </>
              )}
            </div>
          </TabsContent>

          <TabsContent value="tomorrow">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Bell className="h-4 w-4 text-blue-600" />
                  <span className="font-medium">Lembretes para Amanhã</span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={loadData}
                  disabled={isLoading}
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                  Atualizar
                </Button>
              </div>

              {isLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                </div>
              ) : appointments.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  Nenhuma consulta agendada para amanhã.
                </div>
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">
                          <Checkbox
                            checked={selectedAppointments.length === appointments.length}
                            onCheckedChange={handleSelectAll}
                          />
                        </TableHead>
                        <TableHead>Horário</TableHead>
                        <TableHead>Pet</TableHead>
                        <TableHead>Tutor</TableHead>
                        <TableHead>Contato</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {appointments.map((appointment) => {
                        const pet = pets[appointment.pet_id];
                        const customer = pet ? customers[pet.owner_id] : null;
                        if (!pet || !customer) return null;

                        const appointmentDate = new Date(appointment.date);
                        return (
                          <TableRow key={appointment.id}>
                            <TableCell>
                              <Checkbox
                                checked={selectedAppointments.includes(appointment.id)}
                                onCheckedChange={() => handleSelectAppointment(appointment.id)}
                              />
                            </TableCell>
                            <TableCell>
                              {format(appointmentDate, "HH:mm")}
                            </TableCell>
                            <TableCell>{pet.name}</TableCell>
                            <TableCell>{customer.full_name}</TableCell>
                            <TableCell>
                              <Badge variant={customer.preferred_contact_method === "email" ? "default" : "secondary"}>
                                {customer.preferred_contact_method === "email" ? (
                                  <Mail className="h-3 w-3 mr-1" />
                                ) : (
                                  <MessageSquare className="h-3 w-3 mr-1" />
                                )}
                                {customer.preferred_contact_method === "email" ? customer.email : customer.phone}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant="success">
                                <CheckCircle className="h-3 w-3 mr-1" />
                                Confirmado
                              </Badge>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>

                  <div className="flex justify-end mt-4">
                    <Button
                      onClick={sendNotifications}
                      disabled={selectedAppointments.length === 0 || sendingNotifications}
                    >
                      {sendingNotifications ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Enviando...
                        </>
                      ) : (
                        <>
                          <Send className="h-4 w-4 mr-2" />
                          Enviar Lembretes
                        </>
                      )}
                    </Button>
                  </div>
                </>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
