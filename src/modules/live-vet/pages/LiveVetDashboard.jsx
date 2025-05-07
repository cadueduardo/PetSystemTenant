import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom'; // Importando useNavigate
// import { useNavigate } from 'react-router-dom'; // Para navegação futura
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, AlertCircle, Play, Clock, RefreshCcw } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Appointment, Service, Pet, Customer } from '@/api/entities';
import { toast } from '@/components/ui/use-toast';
import { isToday, parseISO, differenceInSeconds, format } from 'date-fns';
import { createPageUrl } from '@/utils'; // Precisamos desta função
import { queueService } from '@/api/firebase/queueService';
import { medicationTaskService } from '@/api/firebase/medicationTaskService';
import ServiceTimer from '@/components/queue/ServiceTimer';
import { Badge } from "@/components/ui/badge"; // <-- Adicionar import do Badge
import { query, where, getDocs, limit, orderBy, doc, updateDoc, serverTimestamp, collectionGroup } from 'firebase/firestore';
import { db } from '@/lib/firebaseConfig'; // <<< Assumindo que db é exportado daqui

// Função auxiliar para debounce
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Função auxiliar para exibir o status como Badge
const getStatusBadge = (status) => {
  const statusConfig = {
    // Clínica
    arrived: { label: "Aguardando", className: "bg-orange-100 text-orange-800" }, // Mesma cor do 'waiting' do petshop
    in_progress: { label: "Em Atendimento", className: "bg-purple-100 text-purple-800 border border-purple-300" }, // Mesma cor do petshop
    completed: { label: "Concluído", className: "bg-green-100 text-green-800" }, // Mesma cor do petshop
    canceled: { label: "Cancelado", className: "bg-red-100 text-red-800" }, // Mesma cor do petshop
    no_show: { label: "Não Compareceu", className: "bg-gray-400 text-white" }, // Exemplo
    // Fila de Retorno (pode ter status próprios se vierem da fila)
    waiting: { label: "Aguardando Retorno", className: "bg-orange-100 text-orange-800" }, // Status da fila de retorno
  };
  
  const config = statusConfig[status] || { 
    label: status ? String(status).replace(/_/g, ' ') : "Desconhecido", 
    className: "bg-gray-100 text-gray-800" 
  }; 
  
  return <Badge className={`capitalize ${config.className}`}>{config.label}</Badge>;
};

export default function LiveVetDashboard() {
  const navigate = useNavigate(); // Inicializando useNavigate
  // const navigate = useNavigate(); // Para navegação ao iniciar consulta
  const [allClinicAppointmentsToday, setAllClinicAppointmentsToday] = useState([]);
  const [isLoadingQueue, setIsLoadingQueue] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState("waiting");
  const [followUpItems, setFollowUpItems] = useState([]);

  const DEBOUNCE_DELAY = 1500; // 1.5 segundos para debounce

  // Memoizar a função loadAppointmentsAndFollowUps com useCallback
  const loadAppointmentsAndFollowUpsCallback = useCallback(async () => {
    setIsLoadingQueue(true);
    setError(null);

    try {
      const tenantId = localStorage.getItem('current_tenant') || 'default';
      console.log('[LiveVetDash] Tenant ID para filtro:', tenantId);

      // 1. Buscar todos os serviços para saber quais são de clínica
      const serviceResponse = await Service.list({ tenant_id: tenantId }); // Assuming Service.list can return all if not paginated
      const allServices = serviceResponse.services || []; // Get services array, default to empty if not present
      
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

      // <<< REVERTIDO: Buscar dados diretamente dentro do map >>>
      const populatedAppointments = await Promise.all(
        todayClinicAppointments.map(async (appt) => {
          console.log('[LiveVetDash] Populando dados para Appt:', appt.id);
          try {
            // <<< REVERTIDO: Buscar Pet, Customer, Service diretamente >>>
            const [pet, customer, service] = await Promise.all([
              Pet.get(appt.pet_id).catch(() => ({ name: 'Pet não encontrado', prontuarioId: null })), // Adiciona prontuarioId null no fallback
              Customer.get(appt.customer_id).catch(() => ({ full_name: 'Cliente não encontrado' })),
              Service.get(appt.service_id).catch(() => ({ name: 'Serviço não encontrado' }))
            ]);

            if (!pet) { // Checa se o pet foi encontrado
                console.warn(`[LiveVetDash] Pet ${appt.pet_id} não encontrado para Appt ${appt.id}. Usando defaults.`);
                return { /* ... dados default ... */ }; // Retorna default se pet não encontrado
            }

            // <<< INÍCIO: LÓGICA REVISADA PARA BUSCAR PRONTUÁRIO E EPISÓDIO >>>
            let recordNumber = '-';
            let episodeNumber = '-';
            const tenantId = localStorage.getItem('current_tenant') || 'default';

            console.log(`[LiveVetDash Populating ${appt.id}] Iniciando busca de episódio via collectionGroup...`);
            try {
                const episodesQuery = query(
                    collectionGroup(db, 'episodes'), // Busca em todos os 'episodes'
                    where('tenantId', '==', tenantId),       // Filtra pelo tenant
                    where('appointmentId', '==', appt.id),  // Filtra pelo ID do agendamento
                    orderBy('createdAt', 'desc'),         // Pega o mais recente (caso haja duplicidade?)
                    limit(1)                              // Só precisamos de um
                );
                const episodeSnapshot = await getDocs(episodesQuery);

                if (!episodeSnapshot.empty) {
                    const episodeDoc = episodeSnapshot.docs[0];
                    const episodeData = episodeDoc.data();
                    console.log(`[LiveVetDash Populating ${appt.id}] Episódio encontrado via collectionGroup: ID=${episodeDoc.id}, Data:`, episodeData);
                    
                    // Extrai os dados do episódio encontrado
                    recordNumber = episodeData.prontuarioId || '-'; // Pega o ID do prontuário do episódio
                    episodeNumber = episodeData.episodeNumber || '-'; // Pega o número do episódio
                    
                    console.log(`[LiveVetDash Populating ${appt.id}] Valores extraídos: recordNumber=${recordNumber}, episodeNumber=${episodeNumber}`);
                } else {
                    // Se não encontrou via collectionGroup, tenta pegar do Pet (fallback, pode não funcionar pelo timing)
                    console.warn(`[LiveVetDash Populating ${appt.id}] Episódio não encontrado via collectionGroup para Appt ID. Tentando fallback via Pet.get.`);
                     if (pet && pet.prontuarioId) {
                         recordNumber = pet.prontuarioId;
                         console.log(`[LiveVetDash Populating ${appt.id}] Usando recordNumber do fallback Pet.get: ${recordNumber}`);
                         // A busca pelo episodeNumber aqui ainda falharia se dependesse do recordNumber
                     } else {
                        console.warn(`[LiveVetDash Populating ${appt.id}] Nenhum episódio encontrado E pet sem prontuarioId (provável timing).`);
                     }
                }
            } catch (episodeQueryError) {
                console.error(`[LiveVetDash Populating ${appt.id}] Erro ao buscar episódio via collectionGroup:`, episodeQueryError);
            }
            // <<< FIM: LÓGICA REVISADA >>>

            console.log(`[LiveVetDash Populating ${appt.id}] Returning populated data: recordNumber=${recordNumber}, episodeNumber=${episodeNumber}`);

            return {
              ...appt,
              petName: pet.name || 'Nome não encontrado',
              recordNumber, // <<< Usa o valor encontrado pela nova lógica
              episodeNumber, // <<< Usa o valor encontrado pela nova lógica
              petId: pet.id,
              episodesCount: Array.isArray(pet.consultationHistory) ? pet.consultationHistory.length : 0,
              customerName: customer.full_name,
              serviceName: service.name,
            };
          } catch (err) {
            console.error(`[LiveVetDash] Erro GERAL ao popular dados para agendamento ${appt.id}:`, err);
            return { /* ... dados de erro ... */ };
          }
        })
      );

      // <<< NOVO: Filtrar para remover itens "arrived" incompletos >>>
      const completeAppointments = populatedAppointments.filter(item => {
        if (item.status !== 'arrived') {
          return true; // Mantém todos que não estão no estado "chegou"
        }
        // Para os que chegaram, verifica se episódio E hora de chegada estão presentes
        const hasEpisode = item.episodeNumber && item.episodeNumber !== '-';
        const hasCheckInTime = !!item.check_in_time; // Verifica se check_in_time existe e não é null/undefined
        if (!hasEpisode || !hasCheckInTime) {
             console.log(`[LiveVetDash Filter] Removendo Appt ${item.id} (status: arrived) por dados incompletos: hasEpisode=${hasEpisode}, hasCheckInTime=${hasCheckInTime}`);
        }
        return hasEpisode && hasCheckInTime;
      });

      // Ordenar por horário (lógica mantida)
      completeAppointments.sort((a, b) => { // <<< Ordena a lista filtrada
        const timeA = a.time || '00:00'; // Handle missing time
        const timeB = b.time || '00:00';
        return timeA.localeCompare(timeB);
      });

      console.log('[LiveVetDash] Total de agendamentos COMPLETOS de clínica HOJE (todos status):', completeAppointments);
      setAllClinicAppointmentsToday(completeAppointments); // <<< Define o estado com a lista filtrada

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
  }, [toast]); // <<< Mantém apenas toast como dependência

  // Criar a versão debounced da função de carregamento
  const debouncedLoadData = useMemo(
    () => debounce(loadAppointmentsAndFollowUpsCallback, DEBOUNCE_DELAY),
    [loadAppointmentsAndFollowUpsCallback] // Recriar se a função base mudar
  );

  useEffect(() => {
    // Carrega os dados na montagem inicial do componente
    console.log('[LiveVetDash] Componente montado. Disparando carga inicial.');
    loadAppointmentsAndFollowUpsCallback();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Roda SÓ na montagem (loadAppointmentsAndFollowUpsCallback está memoizada)

  // Filter appointments based on status for different tabs
  // Rename waitingItems to filaDeEsperaItems and filter only for 'arrived'
  const filaDeEsperaItemsFiltered = allClinicAppointmentsToday.filter(item => 
    item.status === 'arrived' // <-- Only show items with status 'arrived'
  );

  const filaDeEsperaItems = filaDeEsperaItemsFiltered.sort((a, b) => { // <<< Ordena a lista filtrada
    // <<< CORRIGIDO: Converte a string ISO para milissegundos >>>
    let timeA = 0;
    let timeB = 0;

    try {
      if (a.check_in_time && typeof a.check_in_time === 'string') {
        timeA = new Date(a.check_in_time).getTime();
        if (isNaN(timeA)) timeA = 0; // Trata parse inválido
      }
    } catch { /* timeA continua 0 */ }

    try {
      if (b.check_in_time && typeof b.check_in_time === 'string') {
        timeB = new Date(b.check_in_time).getTime();
        if (isNaN(timeB)) timeB = 0; // Trata parse inválido
      }
    } catch { /* timeB continua 0 */ }

    // Coloca itens sem horário de chegada válido no final
    if (timeA === 0 && timeB === 0) return 0; // Ambos sem hora, mantém ordem relativa
    if (timeA === 0) return 1;  // 'a' não tem hora, vai pro fim
    if (timeB === 0) return -1; // 'b' não tem hora, vai pro fim

    return timeA - timeB; // Ordena do menor (mais antigo) para o maior (mais recente)
  });
  const emAtendimentoItems = allClinicAppointmentsToday.filter(item => item.status === 'in_progress');
  const completedItems = allClinicAppointmentsToday.filter(item => item.status === 'completed');
  const cancelledItems = allClinicAppointmentsToday.filter(item => ['canceled', 'no_show'].includes(item.status)); // Include no_show here?

  const handleStartConsultation = async (appointmentId) => { 
    console.log(`[LiveVetDash] handleStartConsultation called for ID: ${appointmentId}`);
    try {
      // 1. Atualizar o status e start_time no Firestore
      const appointmentRef = doc(db, "appointments", appointmentId);
      console.log(`[LiveVetDash] Updating appointment ${appointmentId} status to in_progress and setting start_time...`);
      await updateDoc(appointmentRef, {
        status: 'in_progress',
        start_time: serverTimestamp(), // Define o horário de início
        updatedAt: serverTimestamp() // Atualiza também o updatedAt
      });
      console.log(`[LiveVetDash] Appointment ${appointmentId} updated successfully.`);

      // 2. Navegar para a página de consulta
      const url = createPageUrl('LiveVetConsulta', { appointmentId: appointmentId });
      console.log('[LiveVetDash] Navigating to URL:', url);
      navigate(url); 

       // 3. Recarregar os dados em segundo plano para refletir a mudança imediatamente no dashboard
       // (Opcional, mas melhora a UX se o usuário voltar rapidamente)
       loadAppointmentsAndFollowUpsCallback();

    } catch (error) {
      console.error(`[LiveVetDash] Error starting consultation for ${appointmentId}:`, error);
      toast({
        title: "Erro ao Iniciar",
        description: "Não foi possível iniciar a consulta. Verifique o console para detalhes.",
        variant: "destructive",
      });
    }
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
      loadAppointmentsAndFollowUpsCallback();

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
          <TabsList className="grid w-full grid-cols-4 mb-4">
            {/* Update Trigger value and text */}
            <TabsTrigger value="waiting">Fila de Espera ({filaDeEsperaItems.length})</TabsTrigger>
            <TabsTrigger value="in_progress">Em Atendimento ({emAtendimentoItems.length})</TabsTrigger>
            <TabsTrigger value="follow_up">Retornos ({followUpItems.length})</TabsTrigger>
            <TabsTrigger value="history">Concluídos ({completedItems.length + cancelledItems.length})</TabsTrigger>
          </TabsList>

          {/* Update TabsContent value and map over filaDeEsperaItems */}
          <TabsContent value="waiting">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Pacientes na Fila de Espera</span>
                  {/* Container para o botão e a dica */}
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground hidden md:inline">
                      Não encontrou? Atualize a lista.
                    </span>
                    <Button variant="outline" size="sm" onClick={debouncedLoadData} disabled={isLoadingQueue}>
                       <RefreshCcw className={`h-4 w-4 ${isLoadingQueue ? 'animate-spin' : ''}`} />
                       <span className="sr-only md:hidden">Atualizar</span> {/* Texto para leitores de tela e mobile */}                  
                    </Button>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Hs Chegada</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Pet</TableHead>
                      <TableHead>Prontuário</TableHead>
                      <TableHead>Episódio</TableHead>
                      <TableHead>Serviço</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Tempo de Espera</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filaDeEsperaItems.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center py-8 text-gray-500">
                          Nenhum paciente aguardando atendimento.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filaDeEsperaItems.map((item) => {
                        return (
                          <TableRow key={item.id}>
                            <TableCell>
                              {/* Tentativa de formatar check_in_time (primeiro Timestamp, depois string) */}
                              {item.check_in_time?.toDate 
                                ? format(item.check_in_time.toDate(), 'HH:mm') 
                                : typeof item.check_in_time === 'string' 
                                  ? format(parseISO(item.check_in_time), 'HH:mm') 
                                  : '--:--'}
                            </TableCell>
                            <TableCell>{item.customerName}</TableCell>
                            <TableCell>
                              <div className="font-medium">{item.petName}</div>
                            </TableCell>
                            <TableCell>{item.recordNumber || '-'}</TableCell>
                            <TableCell>{item.episodeNumber || '-'}</TableCell>
                            <TableCell>{item.serviceName}</TableCell>
                            <TableCell>{getStatusBadge(item.status)}</TableCell>
                            <TableCell>
                              <ServiceTimer 
                                service={item} 
                                compact={true}
                              />
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                 <Button 
                                  variant="default"
                                  size="sm"
                                  onClick={() => handleStartConsultation(item.id)}
                                >
                                  <Play className="h-4 w-4 mr-2" /> 
                                  Iniciar Consulta
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })
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
                    <Button variant="outline" size="sm" onClick={loadAppointmentsAndFollowUpsCallback} className="mt-4">
                      Tentar Novamente
                    </Button>
                  </div>
                )}
                {!isLoadingQueue && !error && emAtendimentoItems.length === 0 && (
                  <div className="text-center text-muted-foreground py-8">
                    Nenhum atendimento em andamento.
                  </div>
                )}
                {!isLoadingQueue && !error && emAtendimentoItems.length > 0 && (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Hs Início</TableHead>
                        <TableHead>Cliente</TableHead>
                        <TableHead>Pet</TableHead>
                        <TableHead>Prontuário</TableHead>
                        <TableHead>Episódio</TableHead>
                        <TableHead>Serviço</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Tempo da Consulta</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {emAtendimentoItems.map((item) => {
                        return (
                          <TableRow key={item.id}>
                            <TableCell>
                              {/* Tentativa de formatar start_time (primeiro Timestamp, depois string) */}
                              {item.start_time?.toDate 
                                ? format(item.start_time.toDate(), 'HH:mm') 
                                : typeof item.start_time === 'string' 
                                  ? format(parseISO(item.start_time), 'HH:mm') 
                                  : '--:--'}
                            </TableCell>
                            <TableCell>{item.customerName}</TableCell>
                            <TableCell>
                              <div className="font-medium">{item.petName}</div>
                            </TableCell>
                            <TableCell>{item.recordNumber || '-'}</TableCell>
                            <TableCell>{item.episodeNumber || '-'}</TableCell>
                            <TableCell>{item.serviceName}</TableCell>
                            <TableCell>{getStatusBadge(item.status)}</TableCell>
                            <TableCell>
                              <ServiceTimer 
                                service={item} 
                                compact={true}
                              />
                            </TableCell>
                            <TableCell className="text-right">
                               <div className="flex justify-end items-center gap-1"> 
                                 {/* TODO: Reativar botões Pausar/Concluir se necessário */}
                                 {/* Botão Continuar Atendimento (Play) */}
                                 <TooltipProvider>
                                   <Tooltip>
                                     <TooltipTrigger asChild>
                                       <Button 
                                         variant="ghost"
                                         size="icon" 
                                         onClick={() => handleStartConsultation(item.id)} // Deve ser continuar/abrir consulta
                                         className="text-blue-600 hover:text-blue-700" 
                                       >
                                         <Play className="h-4 w-4" />
                                       </Button>
                                     </TooltipTrigger>
                                     <TooltipContent><p>Abrir/Continuar Consulta</p></TooltipContent>
                                   </Tooltip>
                                 </TooltipProvider>
                               </div>
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
                     <Button variant="outline" size="sm" onClick={loadAppointmentsAndFollowUpsCallback} className="mt-4">
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
                           <TableCell className="font-medium text-orange-600 font-bold">
                             <div className="font-medium">{item.petName}</div>
                           </TableCell>
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

          <TabsContent value="history">
            <Card>
              <CardHeader><CardTitle>Histórico de Atendimentos do Dia</CardTitle></CardHeader>
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
                         <TableHead>Cliente</TableHead>
                         <TableHead>Pet</TableHead>
                         <TableHead>Prontuário</TableHead>
                         <TableHead>Episódio</TableHead>
                         <TableHead>Serviço</TableHead>
                         <TableHead>Status</TableHead>
                         <TableHead>Hs Início</TableHead>
                         <TableHead>Hs Fim</TableHead>
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
                               <TableCell>{item.customerName}</TableCell>
                               <TableCell className="font-medium">{item.petName}</TableCell>
                               <TableCell>{item.recordNumber || '-'}</TableCell>
                               <TableCell>{item.episodeNumber || '-'}</TableCell>
                               <TableCell>{item.serviceName}</TableCell>
                               <TableCell>{getStatusBadge(item.status)}</TableCell>
                               <TableCell>
                                 {/* Formatar Horário Início */}
                                 {item.start_time?.toDate 
                                   ? format(item.start_time.toDate(), 'HH:mm') 
                                   : typeof item.start_time === 'string' 
                                     ? format(parseISO(item.start_time), 'HH:mm') 
                                     : '--:--'}
                               </TableCell>
                               <TableCell>
                                 {/* Formatar Horário Fim */}
                                 {item.end_time?.toDate 
                                   ? format(item.end_time.toDate(), 'HH:mm') 
                                   : typeof item.end_time === 'string' 
                                     ? format(parseISO(item.end_time), 'HH:mm') 
                                     : '--:--'}
                               </TableCell>
                               <TableCell>
                                  {/* Duração (lógica existente) */}
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