import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom'; // Importando useNavigate
// import { useNavigate } from 'react-router-dom'; // Para navegação futura
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, AlertCircle, Play, Clock, RefreshCcw } from 'lucide-react';
import { Appointment, Service, Pet, Customer } from '@/api/entities';
import { toast } from '@/components/ui/use-toast';
import { isToday, parseISO, differenceInSeconds, format } from 'date-fns';
import { createPageUrl } from '@/utils'; // Precisamos desta função
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"; // Importar Tooltip
import { queueService } from '@/api/firebase/queueService';
import { medicationTaskService } from '@/api/firebase/medicationTaskService';

export default function LiveVetDashboard() {
  const navigate = useNavigate(); // Inicializando useNavigate
  // const navigate = useNavigate(); // Para navegação ao iniciar consulta
  const [allClinicAppointmentsToday, setAllClinicAppointmentsToday] = useState([]);
  const [isLoadingQueue, setIsLoadingQueue] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState("waiting");
  const [followUpItems, setFollowUpItems] = useState([]);

  useEffect(() => {
    // Não carrega inicialmente
  }, []);

  // Efeito para carregar dados quando a aba ativa muda ou ao montar pela primeira vez
  useEffect(() => {
    // Carrega se for a aba inicial ou qualquer aba (exceto se já carregou)
    // Ou podemos ser mais específicos: if (activeTab === 'waiting') {
    // Por agora, vamos carregar sempre que a tab muda para garantir dados frescos
    console.log(`[LiveVetDash] Aba ativa mudou para: ${activeTab}. Recarregando...`);
    loadAppointmentsAndFollowUps();
    // Adicionaremos uma flag para evitar recargas desnecessárias se necessário
  }, [activeTab]); // Depende de activeTab

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
        let isScheduledToday = false;
        let appointmentDate = null;

        // --- ADJUSTED DATE CHECKING LOGIC ---
        if (appt.start_time) { // Check if start_time exists
          try {
            if (typeof appt.start_time.toDate === 'function') {
              // It's a Firestore Timestamp
              appointmentDate = appt.start_time.toDate();
              console.log(`[LiveVetDash] Appt ID: ${appt.id} - Converted Timestamp to Date:`, appointmentDate);
            } else if (typeof appt.start_time === 'string') {
              // It's likely an ISO string
              appointmentDate = parseISO(appt.start_time); // Use date-fns parseISO
               if (isNaN(appointmentDate.getTime())) { // Check if parseISO failed
                 console.warn(`[LiveVetDash] Appt ID: ${appt.id} - Failed to parse ISO string:`, appt.start_time);
                 appointmentDate = null; // Ensure it's null if parsing failed
               } else {
                 console.log(`[LiveVetDash] Appt ID: ${appt.id} - Parsed ISO string to Date:`, appointmentDate);
               }
            } else {
               console.warn(`[LiveVetDash] Appt ID: ${appt.id} - start_time has unexpected type:`, typeof appt.start_time, appt.start_time);
            }
            
            if (appointmentDate && !isNaN(appointmentDate.getTime())) { // Check if conversion/parsing resulted in a valid Date
                 isScheduledToday = isToday(appointmentDate);
            } else {
                 console.warn(`[LiveVetDash] Appt ID: ${appt.id} - Could not get a valid Date object from start_time.`);
            }
          } catch (e) {
            console.error(`[LiveVetDash] Erro ao processar start_time para agendamento ${appt.id}:`, appt.start_time, e);
          }
        } else {
          console.warn(`[LiveVetDash] Agendamento ${appt.id} sem start_time.`);
        }
        // --- END ADJUSTED DATE CHECKING LOGIC ---

        const shouldInclude = isClinic && isScheduledToday;

        // Log detalhado para os primeiros 5 agendamentos e para os que deveriam passar
        if (index < 5 || shouldInclude) {
            console.log(`[LiveVetDash] Verificando Appt ID: ${appt.id}`, {
                start_time_raw: appt.start_time, // Log raw value
                service_id: appt.service_id,
                isClinic,
                derivedAppointmentDate: appointmentDate, // Log derived date object
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
        status: ['waiting', 'in_progress']
      });
      console.log(`[LiveVetDash] Encontrados ${followUpQueueEntries.length} itens na fila de retorno.`);

      // Popular dados dos itens da fila (Pet, Cliente, Serviço Original E MEDICAÇÃO)
      const populatedFollowUps = await Promise.all(
         followUpQueueEntries.map(async (entry) => {
           try {
             // O appointment_id na fila é o ID do agendamento ORIGINAL
             const originalAppointment = allClinicAppointmentsToday.find(appt => appt.id === entry.appointment_id);
             
             // Buscar tarefas de medicação administradas para o agendamento original
             const administeredTasks = await medicationTaskService.filter({
               tenant_id: tenantId, // Garantir filtro por tenant
               appointment_id: entry.appointment_id,
               status: 'administrada'
             });
             
             // Pega o nome das medicações (pode haver mais de uma)
             const medicationNames = administeredTasks.map(task => task.medication_name).join(', ') || 'N/A';
             
             const [pet, customer] = await Promise.all([
               Pet.get(entry.pet_id).catch(() => ({ name: 'Pet não encontrado' })),
               Customer.get(entry.customer_id).catch(() => ({ full_name: 'Cliente não encontrado' }))
             ]);
             
             return {
               ...entry, // Dados da fila (id da fila, status da fila, etc)
               original_appointment_id: entry.appointment_id, 
               original_service_name: originalAppointment?.serviceName || 'Serviço original não encontrado',
               petName: pet.name,
               customerName: customer.full_name,
               follow_up_time: entry.created_at,
               administeredMedication: medicationNames // Adiciona nome da medicação
             };
           } catch (err) {
             console.error(`Erro ao popular dados para item de fila ${entry.id}:`, err);
             return { 
                 ...entry, 
                 petName: 'Erro', 
                 customerName: 'Erro', 
                 original_service_name: 'Erro',
                 administeredMedication: 'Erro ao buscar' // Indica erro na medicação
             };
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

  // Filter appointments based on status for different tabs
  // Rename waitingItems to filaDeEsperaItems and filter only for 'arrived'
  const filaDeEsperaItems = allClinicAppointmentsToday.filter(item => 
    item.status === 'arrived' // <-- Only show items with status 'arrived'
  );
  const emAtendimentoItems = allClinicAppointmentsToday.filter(item => item.status === 'in_progress');
  const aguardandoConfirmacaoItems = allClinicAppointmentsToday.filter(item => ['scheduled', 'confirmed'].includes(item.status));
  const completedItems = allClinicAppointmentsToday.filter(item => item.status === 'completed');
  const cancelledItems = allClinicAppointmentsToday.filter(item => ['canceled', 'no_show'].includes(item.status)); // Include no_show here?

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

      {isLoadingQueue && <div className="flex items-center justify-center p-4"><Loader2 className="h-6 w-6 animate-spin mr-2" /> Carregando fila...</div>}
      {error && <div className="text-red-600 bg-red-100 border border-red-400 p-4 rounded-md mb-4 flex items-center"><AlertCircle className="h-5 w-5 mr-2" />{error}</div>}
      
      {!isLoadingQueue && !error && (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-5 mb-4">
            {/* Update Trigger value and text */}
            <TabsTrigger value="waiting">Fila de Espera ({filaDeEsperaItems.length})</TabsTrigger>
            <TabsTrigger value="in_progress">Em Atendimento ({emAtendimentoItems.length})</TabsTrigger>
            <TabsTrigger value="follow_up">Retornos ({followUpItems.length})</TabsTrigger>
            <TabsTrigger value="pending_confirmation">Aguardando ({aguardandoConfirmacaoItems.length})</TabsTrigger>
            {/* Maybe separate completed/canceled later */}
            <TabsTrigger value="history">Histórico ({completedItems.length + cancelledItems.length})</TabsTrigger>
          </TabsList>

          {/* Update TabsContent value and map over filaDeEsperaItems */}
          <TabsContent value="waiting">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Pacientes na Fila de Espera</span>
                  <Button variant="outline" size="sm" onClick={loadAppointmentsAndFollowUps} disabled={isLoadingQueue}>
                     <RefreshCcw className={`h-4 w-4 ${isLoadingQueue ? 'animate-spin' : ''}`} />
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Chegada</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Pet</TableHead>
                      <TableHead>Serviço</TableHead>
                      <TableHead>Observações</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filaDeEsperaItems.length > 0 ? (
                      filaDeEsperaItems.map(item => (
                        <TableRow key={item.id}>
                          <TableCell>{item.check_in_time ? format(item.check_in_time.toDate(), 'HH:mm') : 'N/A'}</TableCell> {/* Assuming check_in_time field exists */}
                          <TableCell>{item.customerName}</TableCell>
                          <TableCell>{item.petName}</TableCell>
                          <TableCell>{item.serviceName}</TableCell>
                          <TableCell>{item.notes || '-'}</TableCell>
                          <TableCell className="text-right">
                            <TooltipProvider delayDuration={100}>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button variant="ghost" size="icon" onClick={() => handleStartConsultation(item.id)}>
                                    <Play className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Iniciar Consulta</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground py-4">Nenhum paciente na fila de espera.</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="in_progress">
            <Card>
              <CardHeader>
                <CardTitle>Fila Clínica - Em Atendimento</CardTitle>
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
                {!isLoadingQueue && !error && emAtendimentoItems.length === 0 && (
                  <div className="text-center text-muted-foreground py-8">
                    Nenhum atendimento em atendimento na fila para hoje.
                  </div>
                )}
                {!isLoadingQueue && !error && emAtendimentoItems.length > 0 && (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Horário</TableHead>
                        <TableHead>Pet</TableHead>
                        <TableHead>Cliente</TableHead>
                        <TableHead>Serviço</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {emAtendimentoItems.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell>{item.start_time?.toDate ? format(item.start_time.toDate(), 'HH:mm') : '--:--'}</TableCell>
                          <TableCell className="font-medium">
                            {item.petName}
                          </TableCell>
                          <TableCell>{item.customerName}</TableCell>
                          <TableCell>{item.serviceName}</TableCell>
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

          <TabsContent value="follow_up">
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
                         <TableHead>Medicação</TableHead>
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
                           <TableCell className="text-orange-600 font-bold">{item.administeredMedication}</TableCell>
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

          <TabsContent value="pending_confirmation">
            <Card>
              <CardHeader><CardTitle>Aguardando Confirmacao ({aguardandoConfirmacaoItems.length})</CardTitle></CardHeader>
              <CardContent>
                 {isLoadingQueue && ( <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin" /></div> )}
                 {!isLoadingQueue && error && ( <div className="text-center text-destructive py-8">{error}</div> )}
                {!isLoadingQueue && !error && aguardandoConfirmacaoItems.length === 0 && (
                  <div className="text-center text-muted-foreground py-8">Nenhum atendimento aguardando confirmação hoje.</div>
                )}
                {!isLoadingQueue && !error && aguardandoConfirmacaoItems.length > 0 && (
                   <Table>
                     <TableHeader>
                       <TableRow>
                         <TableHead>Horário</TableHead>
                         <TableHead>Pet</TableHead>
                         <TableHead>Cliente</TableHead>
                         <TableHead>Serviço</TableHead>
                         <TableHead>Status</TableHead>
                       </TableRow>
                     </TableHeader>
                     <TableBody>
                       {aguardandoConfirmacaoItems.map((item) => (
                         <TableRow key={item.id} className="opacity-60">
                           <TableCell>{item.start_time?.toDate ? format(item.start_time.toDate(), 'HH:mm') : '--:--'}</TableCell>
                           <TableCell className="font-medium">
                              {item.petName}
                           </TableCell>
                           <TableCell>{item.customerName}</TableCell>
                           <TableCell>{item.serviceName}</TableCell>
                           <TableCell>
                              <span className={`px-2 py-0.5 rounded-full text-xs capitalize font-medium ${ 
                                 item.status === 'scheduled' ? 'bg-blue-100 text-blue-800' :
                                 item.status === 'confirmed' ? 'bg-green-100 text-green-800' :
                                 'bg-gray-100 text-gray-800'
                               }`}> 
                                 {item.status === 'scheduled' ? 'Agendado' :
                                  item.status === 'confirmed' ? 'Confirmado' :
                                  item.status}
                               </span>
                           </TableCell>
                         </TableRow>
                       ))}
                     </TableBody>
                   </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="history">
            <Card>
              <CardHeader><CardTitle>Histórico</CardTitle></CardHeader>
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

        </Tabs>
      )}
    </div>
  );
} 