import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom'; // Importando useNavigate
// import { useNavigate } from 'react-router-dom'; // Para navegação futura
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Stethoscope, Loader2, AlertCircle, Play, Clock, Info, RefreshCcw } from 'lucide-react';
import { Appointment, Service, Pet, Customer } from '@/api/entities';
import { toast } from '@/components/ui/use-toast';
import { isToday, parseISO, differenceInSeconds, format } from 'date-fns';
import { createPageUrl } from '@/utils'; // Precisamos desta função
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"; // Importar Tooltip
import { queueService } from '@/api/firebase/queueService';

export default function LiveVetDashboard() {
  const navigate = useNavigate(); // Inicializando useNavigate
  // const navigate = useNavigate(); // Para navegação ao iniciar consulta
  const [allClinicAppointmentsToday, setAllClinicAppointmentsToday] = useState([]);
  const [isLoadingQueue, setIsLoadingQueue] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState("waiting");
  const [followUpItems, setFollowUpItems] = useState([]);

  useEffect(() => {
    loadAppointmentsAndFollowUps();
  }, []);

  const loadAppointmentsAndFollowUps = async () => {
    setIsLoadingQueue(true);
    setError(null);
    try {
      const tenantId = localStorage.getItem('current_tenant') || 'default';
      console.log('[LiveVetDash] Tenant ID para filtro:', tenantId);

      // 1. Buscar todos os serviços para saber quais são de clínica
      const allServices = await Service.list({ tenant_id: tenantId });
      const clinicServiceIds = allServices
        .filter(s => s.module === 'clinica')
        .map(s => s.id);
      console.log('[LiveVetDash] IDs dos Serviços de Clínica:', clinicServiceIds);

      if (clinicServiceIds.length === 0) {
        console.log('[LiveVetDash] Nenhum serviço de clínica encontrado.');
        setAllClinicAppointmentsToday([]);
        setIsLoadingQueue(false);
        return;
      }

      // 2. Buscar todos os agendamentos do tenant
      const allAppointments = await Appointment.filter({ tenant_id: tenantId });
      console.log('[LiveVetDash] Total de Agendamentos Carregados:', allAppointments.length, allAppointments);

      // 3. Filtrar agendamentos:
      const todayClinicAppointments = allAppointments.filter((appt, index) => {
        const isClinic = clinicServiceIds.includes(appt.service_id);
        let appointmentDate = null;
        let isScheduledToday = false;
        try {
          appointmentDate = parseISO(appt.date); // Assume que appt.date está em formato ISO
          isScheduledToday = isToday(appointmentDate);
        } catch (e) {
           console.error(`[LiveVetDash] Erro ao parsear data para agendamento ${appt.id}:`, appt.date, e);
        }

        const shouldInclude = isClinic && isScheduledToday;

        // Log detalhado para os primeiros 5 agendamentos e para os que deveriam passar
        if (index < 5 || shouldInclude) {
            console.log(`[LiveVetDash] Verificando Appt ID: ${appt.id}`, {
                date: appt.date,
                service_id: appt.service_id,
                isClinic,
                appointmentDate,
                isScheduledToday,
                shouldInclude
            });
        }

        return shouldInclude;
      });
      console.log('[LiveVetDash] Agendamentos Filtrados para Hoje (Clínica):', todayClinicAppointments.length, todayClinicAppointments);

      // 4. Buscar dados adicionais (Pet, Cliente, Serviço) para exibição
      const populatedAppointments = await Promise.all(
        todayClinicAppointments.map(async (appt) => {
          // Log para verificar o objeto appt
          console.log('[LiveVetDash] Populando dados para Appt:', JSON.stringify(appt, null, 2));
          try {
            const [pet, customer, service] = await Promise.all([
              Pet.get(appt.pet_id).catch(() => ({ name: 'Pet não encontrado' })),
              Customer.get(appt.customer_id).catch(() => ({ full_name: 'Cliente não encontrado' })),
              Service.get(appt.service_id).catch(() => ({ name: 'Serviço não encontrado' }))
            ]);
            return {
              ...appt,
              petName: pet.name,
              customerName: customer.full_name,
              serviceName: service.name,
            };
          } catch (err) {
            console.error(`Erro ao popular dados para agendamento ${appt.id}:`, err);
            return { // Retorna com dados parciais em caso de erro
              ...appt,
              petName: 'Erro',
              customerName: 'Erro',
              serviceName: allServices.find(s => s.id === appt.service_id)?.name || 'Erro',
            };
          }
        })
      );
      
      // Ordenar por horário
      populatedAppointments.sort((a, b) => {
        const timeA = a.time || '00:00'; // Handle missing time
        const timeB = b.time || '00:00';
        return timeA.localeCompare(timeB);
      });

      console.log('[LiveVetDash] Total de agendamentos de clínica HOJE (todos status):', populatedAppointments);
      setAllClinicAppointmentsToday(populatedAppointments);

      // 5. Buscar itens da fila de retorno (medication_followup)
      console.log('[LiveVetDash] Buscando itens da fila de retorno (medication_followup)');
      const followUpQueueEntries = await queueService.list({
        tenant_id: tenantId,
        queue_type: 'medication_followup',
        status: ['waiting', 'in_progress'] // Buscar apenas os que estão aguardando ou em progresso?
      });
      console.log(`[LiveVetDash] Encontrados ${followUpQueueEntries.length} itens na fila de retorno.`);

      // Popular dados dos itens da fila (Pet, Cliente, Serviço Original se necessário)
      const populatedFollowUps = await Promise.all(
         followUpQueueEntries.map(async (entry) => {
           try {
             // O appointment_id na fila é o ID do agendamento ORIGINAL
             const originalAppointment = allClinicAppointmentsToday.find(appt => appt.id === entry.appointment_id);
             const [pet, customer] = await Promise.all([
               Pet.get(entry.pet_id).catch(() => ({ name: 'Pet não encontrado' })),
               Customer.get(entry.customer_id).catch(() => ({ full_name: 'Cliente não encontrado' }))
             ]);
             return {
               ...entry, // Dados da fila (id da fila, status da fila, etc)
               original_appointment_id: entry.appointment_id, // Renomear para clareza
               original_service_name: originalAppointment?.serviceName || 'Serviço original não encontrado',
               petName: pet.name,
               customerName: customer.full_name,
               follow_up_time: entry.created_at // Usar created_at da fila como referência
             };
           } catch (err) {
             console.error(`Erro ao popular dados para item de fila ${entry.id}:`, err);
             return { ...entry, petName: 'Erro', customerName: 'Erro', original_service_name: 'Erro' };
           }
         })
      );
      
      // Ordenar retornos por horário de criação na fila (comparando milissegundos do Timestamp)
      populatedFollowUps.sort((a, b) => {
        const timeA = a.follow_up_time?.toMillis ? a.follow_up_time.toMillis() : 0;
        const timeB = b.follow_up_time?.toMillis ? b.follow_up_time.toMillis() : 0;
        return timeA - timeB;
      });
      
      setFollowUpItems(populatedFollowUps);
      console.log('[LiveVetDash] Itens de retorno populados:', populatedFollowUps);

    } catch (err) {
      console.error("Erro ao carregar dados do dashboard:", err);
      setError("Não foi possível carregar os dados do dashboard.");
      toast({
        title: "Erro ao carregar dados",
        description: err.message || "Ocorreu um erro inesperado.",
        variant: "destructive",
      });
    } finally {
      setIsLoadingQueue(false);
    }
  };

  const waitingItems = allClinicAppointmentsToday.filter(item => 
    ['scheduled', 'confirmed', 'waiting', 'in_progress'].includes(item.status)
  );
  const completedItems = allClinicAppointmentsToday.filter(item => item.status === 'completed');
  const cancelledItems = allClinicAppointmentsToday.filter(item => item.status === 'cancelled');

  const handleStartConsultation = (appointmentId) => {
    // Navegar para a página de consulta usando o mapeamento e parâmetros
    const url = createPageUrl('LiveVetConsulta', { appointmentId: appointmentId });
    console.log('[LiveVetDash] Navegando para URL:', url);
    navigate(url); 
    // console.log(`Iniciar consulta para o agendamento: ${appointmentId}`);
    // toast({ title: "Funcionalidade em desenvolvimento", description: "Iniciar consulta ainda não implementado." });
  };

  const handleStartFollowUp = async (queueItemId, originalAppointmentId) => {
    try {
      console.log(`[LiveVetDash] Iniciando Reavaliação - Fila ID: ${queueItemId}, Appt Original ID: ${originalAppointmentId}`);
      // 1. Marcar item da fila como 'em andamento'
      await queueService.update(queueItemId, {
        status: 'in_progress',
        start_time: new Date().toISOString()
      });
      console.log(`[LiveVetDash] Item da fila ${queueItemId} marcado como 'in_progress'.`);

      // 2. Navegar para a página de consulta, passando ambos os IDs
      const url = createPageUrl('LiveVetConsulta', { appointmentId: originalAppointmentId, followUpQueueId: queueItemId });
      console.log('[LiveVetDash] Navegando para reavaliação:', url);
      navigate(url);

      // Recarregar dados em segundo plano para refletir a mudança de status
      loadAppointmentsAndFollowUps();

    } catch (error) {
      console.error('[LiveVetDash] Erro ao iniciar reavaliação:', error);
      toast({
        title: "Erro",
        description: "Não foi possível iniciar a reavaliação.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-6">Live Vet - Fila de Atendimento</h1>

      {/* Card Resumo */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Aguardando Atendimento (Hoje)</CardTitle>
            <Stethoscope className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{isLoadingQueue ? '-' : waitingItems.length}</div> 
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-6">
        <TabsList className="mb-4">
          <TabsTrigger value="waiting">Aguardando ({waitingItems.length})</TabsTrigger>
          <TabsTrigger value="followup"> 
            {/* Aplica estilo laranja/negrito ao span se houver itens de retorno */}
            <span className={followUpItems.length > 0 ? 'text-orange-600 font-bold' : ''}>
              Retorno ({followUpItems.length})
            </span>
          </TabsTrigger>
          <TabsTrigger value="completed">Concluídos ({completedItems.length})</TabsTrigger>
          <TabsTrigger value="cancelled">Cancelados ({cancelledItems.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="waiting">
          <Card>
            <CardHeader>
              <CardTitle>Fila Clínica - Aguardando Atendimento</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoadingQueue && (
                <div className="flex justify-center items-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              )}
              {!isLoadingQueue && error && (
                <div className="flex flex-col items-center justify-center py-8 text-destructive">
                  <AlertCircle className="h-8 w-8 mb-2" />
                  <p>{error}</p>
                  <Button variant="outline" size="sm" onClick={loadAppointmentsAndFollowUps} className="mt-4">
                    Tentar Novamente
                  </Button>
                </div>
              )}
              {!isLoadingQueue && !error && waitingItems.length === 0 && (
                <div className="text-center text-muted-foreground py-8">
                  Nenhum atendimento aguardando na fila para hoje.
                </div>
              )}
              {!isLoadingQueue && !error && waitingItems.length > 0 && (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Horário</TableHead>
                      <TableHead>Pet</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Serviço</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {waitingItems.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>{item.date ? format(parseISO(item.date), 'HH:mm') : '--:--'}</TableCell>
                        <TableCell className="font-medium">
                          {item.petName}
                        </TableCell>
                        <TableCell>{item.customerName}</TableCell>
                        <TableCell>{item.serviceName}</TableCell>
                        <TableCell>
                           <span className={`px-2 py-0.5 rounded-full text-xs capitalize font-medium ${
                             item.status === 'scheduled' ? 'bg-blue-100 text-blue-800' :
                             item.status === 'confirmed' ? 'bg-green-100 text-green-800' :
                             item.status === 'waiting' ? 'bg-yellow-100 text-yellow-800' :
                             'bg-gray-100 text-gray-800'
                           }`}>
                             {item.status === 'scheduled' ? 'Agendado' :
                              item.status === 'confirmed' ? 'Confirmado' :
                              item.status === 'waiting' ? 'Aguardando' : item.status}
                           </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button 
                            size="sm" 
                            onClick={() => handleStartConsultation(item.id)}
                          >
                            <Play className="h-4 w-4 mr-2" />
                            Iniciar Atendimento
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="followup">
           <Card>
             <CardHeader>
               <CardTitle className="text-orange-700">Fila de Retorno Pós-Medicação</CardTitle>
             </CardHeader>
             <CardContent>
               {isLoadingQueue && (
                 <div className="flex justify-center items-center py-8">
                   <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
                 </div>
               )}
               {!isLoadingQueue && error && (
                 <div className="flex flex-col items-center justify-center py-8 text-destructive">
                   <AlertCircle className="h-8 w-8 mb-2" />
                   <p>{error}</p>
                   <Button variant="outline" size="sm" onClick={loadAppointmentsAndFollowUps} className="mt-4">
                     Tentar Novamente
                   </Button>
                 </div>
               )}
               {!isLoadingQueue && !error && followUpItems.length === 0 && (
                 <div className="text-center text-muted-foreground py-8">
                   Nenhum retorno pendente na fila.
                 </div>
               )}
               {!isLoadingQueue && !error && followUpItems.length > 0 && (
                 <Table>
                   <TableHeader>
                     <TableRow>
                       <TableHead>Entrada na Fila</TableHead>
                       <TableHead>Pet</TableHead>
                       <TableHead>Cliente</TableHead>
                       <TableHead>Serviço Original</TableHead>
                       <TableHead>Status Fila</TableHead>
                       <TableHead className="text-right">Ações</TableHead>
                     </TableRow>
                   </TableHeader>
                   <TableBody>
                     {followUpItems.map((item) => (
                       <TableRow key={item.id}>
                         <TableCell>{item.follow_up_time?.toDate ? format(item.follow_up_time.toDate(), 'HH:mm') : '--:--'}</TableCell>
                         <TableCell className="font-medium text-orange-600 font-bold">{item.petName}</TableCell>
                         <TableCell>{item.customerName}</TableCell>
                         <TableCell className="text-orange-600 font-bold">{item.original_service_name}</TableCell>
                         <TableCell>
                            <span className={`px-2 py-0.5 rounded-full text-xs capitalize font-medium bg-orange-100 text-orange-800`}>
                              {item.status === 'waiting' ? 'Aguardando Retorno' : item.status}
                            </span>
                         </TableCell>
                         <TableCell className="text-right">
                           <Button 
                             size="sm" 
                             variant="outline"
                             className="border-orange-500 text-orange-600 hover:bg-orange-50"
                             onClick={() => handleStartFollowUp(item.id, item.original_appointment_id)}
                           >
                             <RefreshCcw className="h-4 w-4 mr-2" />
                             Iniciar Reavaliação
                           </Button>
                         </TableCell>
                       </TableRow>
                     ))}
                   </TableBody>
                 </Table>
               )}
             </CardContent>
           </Card>
        </TabsContent>

        <TabsContent value="completed">
          <Card>
            <CardHeader><CardTitle>Concluídos Hoje</CardTitle></CardHeader>
            <CardContent>
              {isLoadingQueue && ( <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin" /></div> )}
              {!isLoadingQueue && error && ( <div className="text-center text-destructive py-8">{error}</div> )}
              {!isLoadingQueue && !error && completedItems.length === 0 && (
                <div className="text-center text-muted-foreground py-8">Nenhum atendimento concluído hoje.</div>
              )}
              {!isLoadingQueue && !error && completedItems.length > 0 && (
                 <Table>
                   <TableHeader>
                     <TableRow>
                       <TableHead>Horário Fim</TableHead>
                       <TableHead>Pet</TableHead>
                       <TableHead>Cliente</TableHead>
                       <TableHead>Serviço</TableHead>
                       <TableHead>Duração</TableHead>
                     </TableRow>
                   </TableHeader>
                   <TableBody>
                     {completedItems.map((item) => {
                        let durationDisplay = '-'; // Default
                        const savedMinutes = item.duration_minutes;

                        if (savedMinutes > 0) {
                          if (savedMinutes < 60) durationDisplay = `${savedMinutes} min`;
                          else {
                            const hours = Math.floor(savedMinutes / 60);
                            const remainingMinutes = savedMinutes % 60;
                            durationDisplay = `${hours}h ${remainingMinutes > 0 ? `${remainingMinutes}min` : ''}`.trim();
                          }
                        } else if (savedMinutes === 0 && item.start_time && item.end_time) {
                          // Se minutos for 0, checa segundos
                          try {
                            const seconds = differenceInSeconds(parseISO(item.end_time), parseISO(item.start_time || item.date));
                            if (seconds > 0) {
                              durationDisplay = '< 1 min';
                            }
                          } catch /* (e) - remover variável não usada */ { 
                             // ignora erro, mantém '-'
                          }
                        }
                        
                        return (
                           <TableRow key={item.id}>
                             <TableCell>{item.end_time ? format(parseISO(item.end_time), 'HH:mm') : '--:--'}</TableCell>
                             <TableCell className="font-medium">
                                {item.petName}
                             </TableCell>
                             <TableCell>{item.customerName}</TableCell>
                             <TableCell>
                                {item.serviceName}
                                {item.follow_up_completed && (
                                  <span className="ml-2 inline-flex items-center text-xs text-orange-600 font-medium">
                                    <RefreshCcw className="h-3 w-3 mr-1" /> (Retorno)
                                  </span>
                                )}
                             </TableCell>
                             <TableCell>
                                {durationDisplay !== '-' ? ( 
                                   <span className="flex items-center text-sm text-muted-foreground">
                                     <Clock className="h-4 w-4 mr-1" /> {durationDisplay}
                                   </span>
                                ) : '-'}
                             </TableCell>
                           </TableRow>
                        );
                     })}
                   </TableBody>
                 </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cancelled">
          <Card>
             <CardHeader><CardTitle>Cancelados Hoje</CardTitle></CardHeader>
            <CardContent>
               {isLoadingQueue && ( <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin" /></div> )}
               {!isLoadingQueue && error && ( <div className="text-center text-destructive py-8">{error}</div> )}
              {!isLoadingQueue && !error && cancelledItems.length === 0 && (
                <div className="text-center text-muted-foreground py-8">Nenhum atendimento cancelado hoje.</div>
              )}
              {!isLoadingQueue && !error && cancelledItems.length > 0 && (
                 <Table>
                   <TableHeader>
                     <TableRow>
                       <TableHead>Horário</TableHead>
                       <TableHead>Pet</TableHead>
                       <TableHead>Cliente</TableHead>
                       <TableHead>Serviço</TableHead>
                       <TableHead>Motivo</TableHead>
                     </TableRow>
                   </TableHeader>
                   <TableBody>
                     {cancelledItems.map((item) => (
                       <TableRow key={item.id} className="opacity-60">
                         <TableCell>{item.date ? format(parseISO(item.date), 'HH:mm') : '--:--'}</TableCell>
                         <TableCell className="font-medium">
                            {item.petName}
                         </TableCell>
                         <TableCell>{item.customerName}</TableCell>
                         <TableCell>{item.serviceName}</TableCell>
                         <TableCell>
                            {item.removal_reason ? (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger className="flex items-center text-sm text-red-600 cursor-default">
                                    <Info className="h-4 w-4 mr-1" /> Ver motivo
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>{item.removal_reason}</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            ) : <span className="text-muted-foreground text-sm">N/A</span>}
                         </TableCell>
                       </TableRow>
                     ))}
                   </TableBody>
                 </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

      </Tabs>
    </div>
  );
} 