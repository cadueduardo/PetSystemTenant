// import React, { useState /*, useEffect */ } from 'react'; // React não é necessário importar explicitamente
import { useState, useEffect, useMemo, useCallback } from 'react'; // Apenas useState é usado, useEffect agora será usado, useMemo adicionado, useCallback adicionado
import FullCalendar from '@fullcalendar/react';
// import resourceTimeGridPlugin from '@fullcalendar/resource-timegrid'; // REMOVER PLUGIN PREMIUM
import interactionPlugin from '@fullcalendar/interaction'; // para seleção e drag/drop
import dayGridPlugin from '@fullcalendar/daygrid'; // para visão mensal opcional
import timeGridPlugin from '@fullcalendar/timegrid'; // ADICIONAR PLUGIN timeGrid
import ptBrLocale from '@fullcalendar/core/locales/pt-br'; // Importar locale PT-BR
import { getFirestore, collection, query, where, getDocs, Timestamp, doc, getDoc, updateDoc, onSnapshot, deleteDoc, addDoc } from 'firebase/firestore'; // Importar funções do Firestore e Timestamp - REMOVIDO addDoc
import { httpsCallable } from 'firebase/functions'; // Importar funções do Firebase Functions - REMOVIDO getFunctions
import { functions } from '@/lib/firebaseConfig'; // <-- IMPORT PRE-CONFIGURED FUNCTIONS INSTANCE
// import { useTenant } from '@/components/tenant/TenantContext'; // Desativado para mock de recursos
import { useToast } from "@/components/ui/use-toast"; // <-- RE-ADICIONAR IMPORT useToast
import AppointmentForm from '@/components/appointment/AppointmentForm'; // <-- IMPORTAR FORMULÁRIO
import ProfessionalMultiSelectFilter from '@/components/agenda/ProfessionalMultiSelectFilter'; // <-- IMPORT NEW FILTER
import { Button } from "@/components/ui/button"; // <-- IMPORT BUTTON COMPONENT
import { useTenant as useRealTenant } from '@/components/tenant/TenantContext'; // Renomeado para evitar conflito, se houver
import useProfessionalStore from '@/stores/professionalStore'; // <-- IMPORT THE ZUSTAND STORE
import { CheckCircle, Clock, UserCheck, PlayCircle, Ban, AlertTriangle, Trophy, Eye, HelpCircle } from 'lucide-react'; // <-- Import icons - REMOVIDO ListFilter
import { cn } from "@/lib/utils"; // <-- Importar cn
import { addMinutes, isFuture, startOfDay } from 'date-fns'; // <<< ADICIONAR isFuture, startOfDay
import { AppointmentContextMenu } from '@/components/agenda/AppointmentContextMenu'; // <-- IMPORTAR MENU
import { Pet, QueueService, Service } from '@/api/entities'; // <<< ADICIONAR IMPORT Service >>>
import { petService } from '@/api/firebase/petService'; // <<< ADICIONAR IMPORT petService
// import { customerService } from '@/api/firebase/customerService'; // <<< ADICIONAR IMPORT customerService
// TODO: Importar o Modal e o Formulário de Agendamento quando prontos
// import { AppointmentModal } from '@/components/agenda/AppointmentModal'; 

// <<< REMOVER IMPORTS CSS DAQUI >>>
// import '@fullcalendar/common/main.css'; 
// import '@fullcalendar/daygrid/dist/main.css'; 
// import '@fullcalendar/timegrid/dist/main.css'; 
// <<< FIM REMOÇÃO >>>

// <<< INÍCIO DADOS MOCK PARA TESTE >>>
/*
const mockResources = [
  { id: 'vet_mock_1', title: 'Dr. Arthur Mock' },
  { id: 'vet_mock_2', title: 'Dra. Beatriz Teste' },
  { id: 'tosa_mock_1', title: 'Tosador Carlos Simula' },
  { id: 'banho_mock_1', title: 'Banhista Diana Demo' },
];
*/
// <<< FIM DADOS MOCK >>>

// <<< Definition of Status Styles >>>
const statusStyles = {
  scheduled: { label: 'Agendado', color: 'bg-blue-100 text-blue-800 border border-blue-300', Icon: Clock },
  pending_confirmation: { label: 'Aguard. Conf.', color: 'bg-cyan-100 text-cyan-700 border-cyan-400', Icon: HelpCircle },
  confirmed: { label: 'Confirmado', color: 'bg-green-100 text-green-800 border border-green-300', Icon: CheckCircle },
  arrived: { label: 'Chegou', color: 'bg-yellow-100 text-yellow-800 border border-yellow-300', Icon: UserCheck },
  in_progress: { label: 'Em Atendimento', color: 'bg-purple-100 text-purple-800 border border-purple-300', Icon: PlayCircle },
  completed: { label: 'Concluído', color: 'bg-gray-200 text-gray-700 border border-gray-400', Icon: Trophy },
  canceled: { label: 'Cancelado', color: 'bg-red-100 text-red-800 border border-red-300', Icon: Ban },
  no_show: { label: 'Faltou', color: 'bg-orange-100 text-orange-800 border border-orange-300', Icon: AlertTriangle },
  default: { label: 'Desconhecido', color: 'bg-gray-100 text-gray-600 border border-gray-300', Icon: AlertTriangle }
};
// <<< End Status Styles Definition >>>

export default function AgendaPage() {
  // --- Get Professionals, state, and actions from Zustand Store --- 
  const {
    professionals,
    isLoading: loadingResources,
    error: professionalError,
    setupProfessionalListener, // Get the listener setup action
    clearProfessionalListener  // Get the listener clear action
  } = useProfessionalStore();
  // --- End Zustand --- 
  
  // --- Local State for Events and UI --- 
  const [events, setEvents] = useState([]);
  const [loadingEvents, setLoadingEvents] = useState(true); 
  const [eventError, setEventError] = useState(null); 
  const [selectedResourceIds, setSelectedResourceIds] = useState([]); 
  const [isAppointmentModalOpen, setIsAppointmentModalOpen] = useState(false); 
  const [modalInitialData, setModalInitialData] = useState(null); 
  const { toast } = useToast(); 
  const tenantContext = useRealTenant();
  const tenantId = tenantContext.currentTenant?.id;
  const [highlightedStatus, setHighlightedStatus] = useState('all'); // Estado para o filtro/destaque

  // --- Estado para o Menu de Contexto ---
  const [contextMenu, setContextMenu] = useState({
    visible: false,
    x: 0,
    y: 0,
    eventId: null,
    eventStatus: null,
  });

  // --- Effect to SETUP and CLEANUP the professional listener --- 
  useEffect(() => {
    if (tenantId) {
        console.log('[AgendaPage] Tenant ID available, calling setupProfessionalListener:', tenantId);
        setupProfessionalListener(tenantId); // Setup the listener
    } else {
        console.log('[AgendaPage] Tenant ID not available, clearing listener.');
        clearProfessionalListener(); // Clear if tenantId becomes null
    }

    // Cleanup function: Clear listener when component unmounts or tenantId changes
    return () => {
        console.log('[AgendaPage] Unmounting or tenantId changed, clearing listener.');
        clearProfessionalListener();
    };
  }, [tenantId, setupProfessionalListener, clearProfessionalListener]); // Depend on tenantId and store actions

  // --- Efeito para buscar Eventos (usando onSnapshot para real-time) --- 
   useEffect(() => {
        if (!tenantId) {
      console.warn("[AgendaPage] Tenant ID not found. Cannot fetch events.");
            setLoadingEvents(false);
            setEvents([]);
      setEventError("ID da loja não encontrado para buscar eventos.");
      return () => {}; // Retorna função vazia para cleanup
        }

    console.log(`[AgendaPage] Setting up real-time listener for tenant: ${tenantId}`);
         setLoadingEvents(true);
    setEvents([]); // Limpa eventos antigos ao iniciar listener
    setEventError(null);

             const db = getFirestore();
             const appointmentsCollection = collection(db, 'appointments');
             const q = query(
               appointmentsCollection,
               where("tenant_id", "==", tenantId),
      // Não filtra mais por status aqui, pega todos e deixa o renderEventContent estilizar
      // where("status", "in", ['scheduled', 'confirmed', 'checked_in', 'in_progress', 'arrived', 'completed'])
             );

    // <<< USA onSnapshot EM VEZ DE getDocs >>>
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      console.log("[AgendaPage] Real-time listener received update.");
              const fetchedEvents = querySnapshot.docs.map(doc => {
                  const data = doc.data();
          // console.log(`[AgendaPage RT] Processing event ${doc.id} data:`, data);
                  let startDateTime, endDateTime;

          // Lógica de data/hora (sem mudanças)
                  if (data.start_time instanceof Timestamp) {
            startDateTime = data.start_time.toDate();
            if (data.end_time instanceof Timestamp) {
                 endDateTime = data.end_time.toDate();
                      } else if (data.duration_minutes && !isNaN(data.duration_minutes)) {
                          endDateTime = new Date(startDateTime.getTime() + data.duration_minutes * 60000);
                      } 
                      if (!endDateTime || isNaN(endDateTime.getTime())) {
                          endDateTime = new Date(startDateTime.getTime() + 60 * 60000); 
                      }
                  } else {
             console.warn(`[AgendaPage RT] Event ${doc.id} has invalid/missing start_time.`);
             return null;
         }

         // Lógica de título (sem mudanças)
         let title = `Agend. ${doc.id.substring(0, 4)}`;
                  if (data.customer_name) {
             title = data.customer_name.split(' ')[0];
             if (data.pet_name) { title += ` / ${data.pet_name.split(' ')[0]}`; }
         } else if (data.service_name) { title = data.service_name; }

         // Lógica de resourceId e editable (sem mudanças)
                  const resourceId = data.professionalId || data.employeeId;
         const isCompleted = data.status === 'completed'; 
         const isCancelled = data.status === 'canceled'; // Considerar cancelado como não editável também

                  return {
                    id: doc.id,
                    title: title,
                    start: startDateTime.toISOString(),
           end: endDateTime.toISOString(), // Usar endDateTime calculado
           extendedProps: { ...data, professionalId: resourceId, status: data.status || 'scheduled' },
           startEditable: !isCompleted && !isCancelled,
           durationEditable: !isCompleted && !isCancelled,
           editable: !isCompleted && !isCancelled
                  };
              }).filter(event => event !== null);

      console.log("[AgendaPage RT] Events processed from snapshot:", fetchedEvents);
      setEvents(fetchedEvents.slice()); // Atualiza o estado com os novos eventos
      setLoadingEvents(false); // Marca como carregado após o primeiro snapshot

    }, (error) => { // Tratamento de erro do listener
      console.error("[AgendaPage] Real-time listener error:", error);
      setEventError("Falha ao carregar agendamentos em tempo real.");
      setEvents([]);
             setLoadingEvents(false);
    });

    // Função de cleanup para remover o listener quando o componente desmontar ou tenantId mudar
    return () => {
        console.log("[AgendaPage] Cleaning up real-time listener.");
        unsubscribe();
    };

  // A dependência agora é apenas tenantId (loadingResources não é mais relevante aqui)
  }, [tenantId]); 

  // --- useCallback for fetchEventsCallback (REMOVER OU ADAPTAR) ---
  // Esta função pode não ser mais necessária ou precisar ser simplificada,
  // já que o onSnapshot atualiza automaticamente.
  // Se for mantida (ex: para forçar refresh após erro), precisa ser ajustada.
  const fetchEventsCallback = useCallback(async () => {
    // Poderia ser simplificado para apenas logar ou talvez tratar erros específicos.
    // Por ora, manteremos a lógica original, mas cientes da redundância.
    if (!tenantId) {
        // ... (código existente) ...
    }
    console.log(`[AgendaPage] Manual Re-fetch triggered (may be redundant with listener)...`);
    // ... (resto do código de getDocs - *manter getDocs aqui se for para refresh manual*) ...
    try {
        const db = getFirestore();
        const appointmentsCollection = collection(db, 'appointments');
        const q = query(
            appointmentsCollection,
            where("tenant_id", "==", tenantId),
            // where("status", "in", ['scheduled', 'confirmed', 'checked_in', 'in_progress', 'arrived', 'completed']) // Mantém o filtro aqui?
        );
        const querySnapshot = await getDocs(q);
        const fetchedEvents = querySnapshot.docs.map(doc => {
             // ... (lógica de mapeamento idêntica à do onSnapshot) ...
            const data = doc.data();
            let startDateTime, endDateTime;
            if (data.start_time instanceof Timestamp) {
                  startDateTime = data.start_time.toDate();
                  if (data.end_time instanceof Timestamp) {
                      endDateTime = data.end_time.toDate();
                } else if (data.duration_minutes && !isNaN(data.duration_minutes)) {
                    endDateTime = new Date(startDateTime.getTime() + data.duration_minutes * 60000);
                } 
                if (!endDateTime || isNaN(endDateTime.getTime())) {
                    endDateTime = new Date(startDateTime.getTime() + 60 * 60000); 
                }
              } else { return null; }
 
              let title = `Agend. ${doc.id.substring(0, 4)}`;
            if (data.customer_name) {
                title = data.customer_name.split(' ')[0];
                if (data.pet_name) { title += ` / ${data.pet_name.split(' ')[0]}`; }
              } else if (data.service_name) { title = data.service_name; }

            const resourceId = data.professionalId || data.employeeId;
              const isCompleted = data.status === 'completed'; 
              const isCancelled = data.status === 'canceled';
            return {
              id: doc.id,
              title: title,
              start: startDateTime.toISOString(),
               end: endDateTime.toISOString(),
               extendedProps: { ...data, professionalId: resourceId, status: data.status || 'scheduled' },
               startEditable: !isCompleted && !isCancelled,
               durationEditable: !isCompleted && !isCancelled,
               editable: !isCompleted && !isCancelled
            };
        }).filter(event => event !== null);
         console.log("[AgendaPage Manual CB] Events re-fetched:", fetchedEvents);
         setEvents(fetchedEvents.slice());
    } catch (err) {
         console.error("[AgendaPage Manual CB] Error re-fetching events:", err);
       setEventError("Falha ao atualizar lista de agendamentos.");
    } finally {
        setLoadingEvents(false);
    }
   }, [tenantId]);

  // --- Filtered Events (useMemo logic remains the same) ---
   const filteredEvents = useMemo(() => {
     if (selectedResourceIds.length === 0) return events;
     return events.filter(event => {
         const eventProfId = event.extendedProps?.professionalId;
         return eventProfId && selectedResourceIds.includes(eventProfId);
     });
   }, [events, selectedResourceIds]);

  // --- Handlers (handleProfessionalFilterChange, handleNewAppointmentClick, handleDateSelect, handleEventClick, handleEventDrop, handleCloseModal - remain the same) ---
  // Note: handleEventClick still uses getDoc - Ensure it's imported
   const handleProfessionalFilterChange = (newSelectedIds) => {
      setSelectedResourceIds(newSelectedIds);
  }; 

  const handleNewAppointmentClick = () => {
    const prefilledProfessionalId = selectedResourceIds.length === 1 ? selectedResourceIds[0] : null;
    console.log(`Opening modal via button. Prefilled Professional: ${prefilledProfessionalId}`);
    setModalInitialData({ start: null, end: null, professionalId: prefilledProfessionalId });
    setIsAppointmentModalOpen(true);
  };

  const handleDateSelect = (selectInfo) => {
    const calendarApi = selectInfo.view.calendar;
    calendarApi.unselect();
    const prefilledProfessionalId = selectedResourceIds.length === 1 ? selectedResourceIds[0] : null;
    console.log(`Opening modal to schedule. Prefilled Professional: ${prefilledProfessionalId}`);
    setModalInitialData({ start: selectInfo.start, end: selectInfo.end, professionalId: prefilledProfessionalId });
      setIsAppointmentModalOpen(true);
  };

  const handleEventClick = async (clickInfo) => {
    console.log("[AgendaPage] Event clicked:", clickInfo.event.id);
    try {
      const db = getFirestore();
      const appointmentRef = doc(db, "appointments", clickInfo.event.id);
      const docSnap = await getDoc(appointmentRef);
      if (docSnap.exists()) {
        const appointmentData = { id: docSnap.id, ...docSnap.data() };
        console.log("[AgendaPage] Full appointment data fetched for editing:", appointmentData);
        const initialModalData = {
            appointmentId: appointmentData.id,
            pet_id: appointmentData.pet_id,
            customer_id: appointmentData.customer_id,
            service_id: appointmentData.service_id,
            professionalId: appointmentData.professionalId, 
             start: appointmentData.start_time instanceof Timestamp ? appointmentData.start_time.toDate() : new Date(),
             end: appointmentData.end_time instanceof Timestamp ? appointmentData.end_time.toDate() : null,
            notes: appointmentData.notes,
            status: appointmentData.status,
            service_type: appointmentData.service_type || appointmentData.type,
             specialty_id: appointmentData.specialty_id,
             requester_type: appointmentData.requester_type,
             referring_clinic_name: appointmentData.referring_clinic_name,
             price_table_id: appointmentData.price_table_id,
             price: appointmentData.price,
             transport_required: appointmentData.transport_required,
             secondary_procedures_notes: appointmentData.secondary_procedures_notes,
         };
        console.log("[AgendaPage] Opening edit modal with initial data:", initialModalData);
        setModalInitialData(initialModalData); 
        setIsAppointmentModalOpen(true);
      } else {
        console.error("[AgendaPage] Appointment document not found for ID:", clickInfo.event.id);
        toast({ title: "Erro", description: "Agendamento não encontrado.", variant: "destructive" });
      }
    } catch (error) {
        console.error("[AgendaPage] Error fetching appointment details:", error);
        toast({ title: "Erro", description: "Falha ao carregar detalhes do agendamento.", variant: "destructive" });
    }
  };

  const handleEventDrop = async (dropInfo) => { 
    const { event } = dropInfo;
    const eventId = event.id;
    const newStart = dropInfo.event.start; 
    const newEnd = dropInfo.event.end; // FullCalendar might provide null end if duration is implicit
    const currentStatus = event.extendedProps.status;

    console.log(`[AgendaPage] Event dropped: ID=${eventId}, NewStart=${newStart}, NewEnd=${newEnd}, Status=${currentStatus}`);

    // 1. Verify Status - Allow move only for scheduled or confirmed
    if (currentStatus !== 'scheduled' && currentStatus !== 'confirmed') {
      toast({
        title: "Ação não permitida",
        description: `Não é possível mover um agendamento com status "${statusStyles[currentStatus]?.label || currentStatus}".`,
        variant: "warning",
      });
      // Revert the change visually in the calendar
      dropInfo.revert(); 
      console.log("[AgendaPage] Event drop reverted due to invalid status.");
      return;
    }

    // 2. Prepare data for Firestore update
    if (!eventId || !newStart) {
        console.error("[AgendaPage] Event drop data incomplete.", dropInfo);
        toast({ title: "Erro", description: "Dados incompletos para atualizar o agendamento.", variant: "destructive" });
        dropInfo.revert();
        return;
    }

    // Calculate end time if FullCalendar didn't provide it explicitly
    // (e.g., if event duration is used)
    let finalEndTime = newEnd;
    if (!finalEndTime && event.extendedProps.duration_minutes) {
      finalEndTime = addMinutes(newStart, event.extendedProps.duration_minutes);
      console.log("[AgendaPage] Calculated finalEndTime based on duration:", finalEndTime);
    } else if (!finalEndTime) {
      // Fallback if no end and no duration (e.g., add 1 hour)
      finalEndTime = addMinutes(newStart, 60);
      console.warn("[AgendaPage] No end time or duration, falling back to 1 hour duration for end time calculation.");
    }

    const updateData = {
      start_time: Timestamp.fromDate(new Date(newStart)),
      end_time: Timestamp.fromDate(new Date(finalEndTime)),
      updated_at: Timestamp.now()
    };

    // 3. Update Firestore
    try {
        const db = getFirestore();
        const appointmentRef = doc(db, "appointments", eventId);
        console.log(`[AgendaPage] Updating appointment ${eventId} with new times:`, updateData);
        await updateDoc(appointmentRef, updateData);
        toast({ title: "Sucesso", description: "Agendamento reagendado com sucesso!" });

        // 4. Refresh calendar view
        console.log("[AgendaPage] Re-fetching events after drop...");
        await fetchEventsCallback();
        console.log("[AgendaPage] Events re-fetched after drop.");

    } catch (error) {
        console.error("[AgendaPage] Error updating appointment after drop:", error);
        toast({ title: "Erro ao Reagendar", description: `Não foi possível salvar as alterações. ${error.message}`, variant: "destructive" });
        // Revert visual change on error
        dropInfo.revert(); 
    }
  };
  
  const handleCloseModal = () => {
    setIsAppointmentModalOpen(false);
    setModalInitialData(null);
  };

  // --- handleSaveAppointment - Now a callback passed to AppointmentForm --- 
  const handleSaveAppointment = useCallback(async () => { 
    console.log("[AgendaPage] handleSaveAppointment triggered after AppointmentForm success.");
    setIsAppointmentModalOpen(false); // Close modal first
    try {
      console.log("[AgendaPage] Re-fetching events after save...");
      await fetchEventsCallback(); // Re-fetch only events
      console.log("[AgendaPage] Events re-fetched.");
    } catch (error) {
      console.error("[AgendaPage] Error during post-save event refetch:", error);
      toast({
        title: "Erro Pós-Salvamento",
        description: "Ocorreu um erro ao atualizar a agenda.", 
        variant: "destructive",
      });
    }
  }, [fetchEventsCallback, toast]); // Depend on fetchEventsCallback and toast

  // --- Custom Event Rendering Function --- 
  const renderEventContent = (eventInfo) => {
    const eventStatus = eventInfo.event.extendedProps.status || 'default';
    const style = statusStyles[eventStatus] || statusStyles.default;
    const isFaded = highlightedStatus !== 'all' && highlightedStatus !== eventStatus;

    return (
      <div 
        className={cn(
          `p-1 text-xs rounded-sm overflow-hidden h-full flex items-center fc-event-inner-content`,
          style.color, // Aplicar classes de cor normais
          isFaded && 'opacity-40 grayscale' // Aplicar opacidade E escala de cinza
        )}
        data-event-id={eventInfo.event.id}
        data-event-status={eventStatus}
      >
        {style.Icon && <style.Icon className="w-3 h-3 mr-1 flex-shrink-0 pointer-events-none" />} 
        <span className="font-medium truncate pointer-events-none">{eventInfo.event.title}</span>
      </div>
    );
  };
  // --- End Custom Event Rendering --- 

  // Função handler para o menu de contexto no container do calendário
  function handleCalendarContextMenu(e) {
    console.log('[ContextMenu Delegated] handleCalendarContextMenu triggered.'); // Log inicial
    console.log('[ContextMenu Delegated] Raw target:', e.target); // Log do elemento clicado

    // Encontrar o elemento container do evento FC (.fc-event)
    const eventContainer = e.target.closest('.fc-event'); 
    console.log('[ContextMenu Delegated] Found eventContainer (.fc-event):', eventContainer);

    if (eventContainer) {
      // Agora, procurar nosso elemento interno com os data attributes
      const customEventElement = eventContainer.querySelector('[data-event-id]');
      console.log('[ContextMenu Delegated] Found customEventElement ([data-event-id]):', customEventElement);

      if (customEventElement) {
        e.preventDefault(); // Prevenir menu padrão SÓ SE clicou em nosso conteúdo
        const eventId = customEventElement.getAttribute('data-event-id');
        const eventStatus = customEventElement.getAttribute('data-event-status');
        console.log(`[ContextMenu Delegated] Right-clicked on event: ${eventId}`);
        setContextMenu({
          visible: true,
          x: e.pageX,
          y: e.pageY,
          eventId: eventId,
          eventStatus: eventStatus,
        });
      }
       // Se clicou dentro do container .fc-event, mas fora do nosso [data-event-id],
       // talvez ainda queira prevenir o menu padrão? Ou permitir? Por ora, não fazemos nada.
       
    } else {
       // Se clicou fora de um evento, permite o menu padrão (ou fecha o nosso se estiver aberto)
       if (contextMenu.visible) {
         setContextMenu({ ...contextMenu, visible: false });
       }
    }
  }

  // --- Funções para Ações do Menu de Contexto ---
  const handleUpdateStatusFromMenu = async (eventId, newStatus) => {
    if (!eventId || !newStatus) return;
    console.log(`[ContextMenu Action] Attempting to update ${eventId} to ${newStatus}`);
    setContextMenu({ ...contextMenu, visible: false }); // Fecha o menu

    const db = getFirestore();
    const appointmentRef = doc(db, "appointments", eventId);

    try {
      // <<< INÍCIO: BUSCAR AGENDAMENTO E VERIFICAR DATA ANTES DE ATUALIZAR >>>
      const appointmentSnap = await getDoc(appointmentRef);
      if (!appointmentSnap.exists()) {
          console.error(`[handleUpdateStatusFromMenu] Appointment ${eventId} not found.`);
          toast({ title: "Erro", description: "Agendamento não encontrado.", variant: "destructive" });
          return;
      }
      const appointmentData = appointmentSnap.data();

      // <<< VERIFICAR SE ESTÁ TENTANDO MARCAR 'ARRIVED' PARA DATA FUTURA >>>
      if (newStatus === 'arrived') {
        const startTime = appointmentData.start_time;
        if (startTime && typeof startTime.toDate === 'function') {
          const startTimeDate = startTime.toDate();
          if (isFuture(startOfDay(startTimeDate))) {
            console.warn(`[handleUpdateStatusFromMenu] Attempted to set 'arrived' for future appointment ${eventId}.`);
            toast({
              title: "Ação não permitida",
              description: "Não é possível marcar 'Chegou' para um agendamento futuro. Por favor, reagende para a data/hora atual se necessário.",
              variant: "warning",
            });
            return; // IMPEDE a atualização e a criação do episódio
          }
        } else {
            console.warn(`[handleUpdateStatusFromMenu] Could not verify start_time for appointment ${eventId} before setting arrived.`);
            toast({ title: "Aviso", description: "Não foi possível verificar a data do agendamento.", variant: "warning" });
            return;
        }
      }
      // <<< FIM: VERIFICAÇÃO DE DATA FUTURA >>>

      // Se passou na verificação (ou não era 'arrived'), prosseguir com a atualização:
      console.log(`[handleUpdateStatusFromMenu] Proceeding to update status for ${eventId} to ${newStatus}`);
      let osNumberToSave = null;
      if (newStatus === 'arrived') {
          const randomChars = Math.random().toString(36).substring(2, 8).toUpperCase();
          osNumberToSave = `OS-${randomChars}`;
          console.log(`[handleUpdateStatusFromMenu] Generated osNumber: ${osNumberToSave} for appointment ${eventId}`);
      }
      await updateDoc(appointmentRef, {
        status: newStatus,
        updated_at: Timestamp.now(),
        ...(osNumberToSave && { osNumber: osNumberToSave }),
        ...(newStatus === 'confirmed' && { confirmed_via: 'manual' }),
        ...(newStatus === 'canceled' && { cancelled_via: 'manual' }),
      });
      toast({ title: "Status atualizado!", description: `Agendamento ${eventId.substring(0,6)}... marcado como ${statusStyles[newStatus]?.label || newStatus}.`, variant: "success" });

      // <<< INÍCIO: CRIAR EPISÓDIO SE STATUS FOR 'ARRIVED' (MENU CONTEXTO) >>>
      if (newStatus === 'arrived') {
          console.log(`[handleUpdateStatusFromMenu] Status IS 'arrived'. Attempting check/create EPISODE for appointment ${eventId}...`);
          try {
              // Reusa appointmentData que já buscamos
              const tenantId = appointmentData.tenant_id;
              const petId = appointmentData.pet_id;
              const customerId = appointmentData.customer_id;

              if (!tenantId || !petId) {
                  console.error(`[handleUpdateStatusFromMenu] Missing tenantId or petId in appointment data for ${eventId}. Cannot create episode.`);
                  return; 
              }
              
              // <<< INÍCIO: BUSCAR PET E GARANTIR recordNumber >>>
              let prontuarioId = null;
              try {
                  let petData = await Pet.get(petId);
                  if (!petData) {
                      console.error(`[handleUpdateStatusFromMenu] Pet data not found for Pet ID ${petId}. Cannot create episode.`);
                      return;
                  }
                  
                  if (!petData.recordNumber) {
                      console.warn(`[handleUpdateStatusFromMenu] Pet ${petId} has no recordNumber. Generating one...`);
                      const nextRecordNumber = `PT-${Math.floor(Math.random() * 90000000) + 10000000}`;
                      // Tenta atualizar o pet com o novo recordNumber
                      await petService.update(petId, { recordNumber: nextRecordNumber }); // Assume petService está importado ou importe
                      console.log(`[handleUpdateStatusFromMenu] Pet ${petId} updated with recordNumber: ${nextRecordNumber}`);
                      prontuarioId = nextRecordNumber;
                  } else {
                      prontuarioId = petData.recordNumber; 
                  }
              } catch (petError) {
                   console.error(`[handleUpdateStatusFromMenu] Error fetching or updating Pet ${petId}:`, petError);
                   toast({ title: "Erro", description: "Falha ao obter ou atualizar dados do prontuário do pet.", variant: "destructive" });
                   return; // Não continuar se não conseguir o prontuário
              }
              // <<< FIM: BUSCAR PET E GARANTIR recordNumber >>>

              // AGORA temos certeza (ou deveríamos ter) que prontuarioId existe
              if (!prontuarioId) {
                  console.error(`[handleUpdateStatusFromMenu] Failed to obtain prontuarioId for pet ${petId}. Aborting episode creation.`);
                  return;
              }

              const episodesPath = `tenants/${tenantId}/prontuarios/${prontuarioId}/episodes`;
              console.log(`[handleUpdateStatusFromMenu] Path for new episode: ${episodesPath}`);

              // Simplificado: Assume que não existe e tenta criar.
              console.log(`[handleUpdateStatusFromMenu] Proceeding to create episode in subcollection...`);
              const episodeData = {
                  appointmentId: eventId,
                  petId: petId, 
                  customerId: customerId, 
                  tenantId: tenantId, 
                  prontuarioId: prontuarioId, 
                  status: 'pending', 
                  createdAt: Timestamp.now(), 
                  updatedAt: Timestamp.now(), 
                  serviceName: appointmentData.service_name,
                  professionalName: appointmentData.professionalName,
              };
              console.log("[handleUpdateStatusFromMenu] Data for new episode:", episodeData);
              const episodesCollectionRef = collection(db, episodesPath);
              const newEpisodeRef = await addDoc(episodesCollectionRef, episodeData);
              console.log(`[handleUpdateStatusFromMenu] Episode created successfully with ID ${newEpisodeRef.id} in path ${episodesPath}.`);
              
              // <<< INÍCIO: ADICIONAR ITEM À FILA DE ATENDIMENTO (CONDICIONAL) >>>
              try {
                  // 1. Buscar detalhes do Serviço para checar o módulo
                  console.log(`[handleUpdateStatusFromMenu] Checking service module for appointment ${eventId} (Service ID: ${appointmentData.service_id})...`);
                  const serviceData = await Service.get(appointmentData.service_id);

                  // 2. Criar entrada na fila SOMENTE se for do módulo 'petshop'
                  if (serviceData && serviceData.module === 'petshop') {
                      console.log(`[handleUpdateStatusFromMenu] Service module is 'petshop'. Adding appointment ${eventId} to the service queue...`);
                      const queueEntryData = {
                          appointment_id: eventId, // Link para o agendamento original
                          tenant_id: appointmentData.tenant_id,
                          customer_id: appointmentData.customer_id,
                          pet_id: appointmentData.pet_id,
                          service_id: appointmentData.service_id,
                          queue_type: 'petshop', // <<< Adicionar o tipo da fila
                          appointment_date: appointmentData.start_time, // Usar o start_time original como data/hora da fila
                          status: 'waiting', // Status inicial na fila
                          created_at: Timestamp.now(), // Timestamp de quando entrou na fila
                          // Copiar outros campos relevantes se necessário (ex: notes, professionalId)
                          notes: appointmentData.notes || '', // Garante que não seja undefined
                          professionalId: appointmentData.professionalId || null, // Garante que não seja undefined
                      };
                      
                      // Você precisa ter o QueueService importado e com um método 'create' ou 'add'
                      const newQueueEntry = await QueueService.create(queueEntryData); 
                      console.log(`[handleUpdateStatusFromMenu] Successfully added PETSHOP appointment ${eventId} to queue with ID ${newQueueEntry.id}`);
                      toast({ title: "Adicionado à Fila (Petshop)", description: "O atendimento entrou na fila de espera do petshop.", variant: "info" });
                  } else {
                      console.log(`[handleUpdateStatusFromMenu] Appointment ${eventId} is NOT for Petshop module (module: ${serviceData?.module || 'unknown'}). Skipping queue entry creation.`);
                      // Opcional: informar o usuário se for clínica, mas pode ser redundante se ele já usa o LiveVet
                      // if (serviceData?.module === 'clinica') {
                      //     toast({ title: "Chegada Registrada (Clínica)", description: "O atendimento clínico está pronto para iniciar no LiveVet.", variant: "info" });
                      // }
                  }

              } catch (queueError) {
                  console.error(`[handleUpdateStatusFromMenu] Failed to check service or add appointment ${eventId} to queue:`, queueError);
                  // Informa o usuário, mas não reverte a criação do episódio ou a atualização do status do appointment
                  toast({ title: "Erro na Fila", description: "Não foi possível adicionar o atendimento à fila.", variant: "destructive" });
              }
              // <<< FIM: ADICIONAR ITEM À FILA DE ATENDIMENTO (CONDICIONAL) >>>
              
          } catch (episodeError) {
              console.error(`[handleUpdateStatusFromMenu] Failed to create EPISODE for appointment ${eventId}:`, episodeError);
              toast({ title: "Erro", description: "Falha ao criar o episódio clínico associado.", variant: "destructive" });
          }
      }
      // <<< FIM: CRIAR EPISÓDIO (MENU CONTEXTO) >>>

    } catch (error) {
      console.error("[handleUpdateStatusFromMenu] Error updating status or creating episode:", error);
      toast({ title: "Erro ao atualizar", description: error.message, variant: "destructive" });
    }
  };

  const handleSendWahaConfirmation = async (eventId) => {
    if (!eventId) return;
    console.log(`[ContextMenu Action] Sending WAHA confirmation for ${eventId}`);
    setContextMenu({ ...contextMenu, visible: false }); // Fecha o menu
    try {
      const sendWaha = httpsCallable(functions, 'sendWahaConfirmation'); // <-- USE IMPORTED functions INSTANCE
      await sendWaha({ appointmentId: eventId });
      toast({ title: "Confirmação Enviada", description: "Mensagem de confirmação via WhatsApp enviada.", variant: "success" });
      // Status será atualizado pela cloud function e refletido pelo listener
    } catch (error) { 
      console.error("Error calling sendWahaConfirmation cloud function:", error);
      toast({ title: "Erro ao Enviar", description: error.message, variant: "destructive" });
    }
  };

  const handleDeleteAppointment = async (eventId) => {
    if (!eventId) return;
    console.log(`[ContextMenu Action] Deleting appointment ${eventId}`);
    setContextMenu({ ...contextMenu, visible: false }); // Fecha o menu

    if (!window.confirm(`Tem certeza que deseja remover permanentemente o agendamento ${eventId.substring(0,6)}...? Esta ação não pode ser desfeita.`)) {
        console.log("[ContextMenu Action] Deletion cancelled by user.");
        return;
    }

    try {
        const db = getFirestore();
        const appointmentRef = doc(db, "appointments", eventId);
        await deleteDoc(appointmentRef);
        toast({ title: "Agendamento Removido", description: `Agendamento ${eventId.substring(0,6)}... foi removido.`, variant: "success" });
        // Listener onSnapshot deve cuidar da atualização da UI.
    } catch (error) {
        console.error("Error deleting appointment:", error);
        toast({ title: "Erro ao Remover", description: error.message, variant: "destructive" });
    }
  };
  // --- Fim Funções do Menu de Contexto ---

  // --- Renderização ---
  // Combined loading state
  const isLoading = tenantContext.isLoading || loadingResources || loadingEvents; // loadingResources now comes from store
  // Combined errors 
  const displayError = professionalError || eventError || tenantContext.error;

  if (isLoading) {
      return <div className="p-8 flex justify-center items-center h-full">Carregando agenda...</div>;
  }

  // Display error if any occurred
  if (displayError) {
      return <div className="p-8 text-red-500 bg-red-100 border border-red-400 rounded-md">Erro ao carregar agenda: {displayError}</div>;
  }

  // --- JSX --- 
  return (
    <div className="p-4 md:p-6 lg:p-8 flex flex-col h-full">
      {/* Title */} 
      <div className="mb-4">
        <h1 className="text-2xl font-semibold">Agenda</h1>
      </div>
      {/* Filter and New Appointment Button */} 
      <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
          <ProfessionalMultiSelectFilter
              professionals={professionals} // <-- From Zustand store
              selectedIds={selectedResourceIds}
              onChange={handleProfessionalFilterChange}
          />
          <Button onClick={handleNewAppointmentClick}> 
             Novo Agendamento
          </Button>
              </div>

      {/* --- Status Legend / Filter --- */}
      <div className="mb-4 p-3 border rounded-md bg-gray-50 shadow-sm">
        <h3 className="text-sm font-semibold mb-2">Filtrar/Destacar por Status:</h3>
        <div className="flex flex-wrap gap-2">
           {/* Botão Ver Todos */}
           <Button 
                key="all"
                variant={highlightedStatus === 'all' ? 'default' : 'outline'}
                size="xs" // Tamanho menor para legenda
                className={cn(
                  "h-auto px-2.5 py-1 text-xs font-medium border transition-all",
                  highlightedStatus === 'all' && 'ring-2 ring-offset-1 ring-indigo-500 bg-indigo-600 text-white border-indigo-600'
                )}
                onClick={() => setHighlightedStatus('all')}
              >
                 <Eye className="w-3.5 h-3.5 mr-1.5 flex-shrink-0" /> 
                 Ver Todos
              </Button>

          {Object.entries(statusStyles).map(([key, { label, color, Icon }]) => {
            if (key === 'default') return null; 
            const isActive = highlightedStatus === key;
            return (
              <Button 
                key={key}
                variant={isActive ? 'default' : 'outline'}
                size="xs" // Tamanho menor para legenda
                className={cn(
                  "h-auto px-2.5 py-1 text-xs font-medium border transition-all",
                  color, // Aplica a cor base do status
                  isActive && "ring-2 ring-offset-1 ring-indigo-500", // Destaque se ativo
                  !isActive && "hover:opacity-80" // Leve hover se não ativo
                )}
                onClick={() => setHighlightedStatus(key)}
              >
                 {Icon && <Icon className="w-3.5 h-3.5 mr-1.5 flex-shrink-0" />} 
                 {label}
              </Button>
            );
          })}
        </div>
      </div>
      {/* --- End Status Legend / Filter --- */}

      {/* Calendar Container with Context Menu Handling */} 
      <div 
        className="flex-1 overflow-hidden" 
        onContextMenu={handleCalendarContextMenu} // <-- Handler aqui
      >
        <FullCalendar
          plugins={[timeGridPlugin, interactionPlugin, dayGridPlugin]} 
          headerToolbar={{
            left: 'prev,next today',
            center: 'title',
            right: 'timeGridWeek,timeGridDay,dayGridMonth'
          }}
          initialView="timeGridWeek"
          locale={ptBrLocale}
          editable={true}
          selectable={true}
          selectMirror={true}
          dayMaxEvents={true}
          nowIndicator={true}
          allDaySlot={false}
          businessHours={{
            daysOfWeek: [1, 2, 3, 4, 5],
            startTime: '08:00', 
            endTime: '18:00',
          }}
          slotMinTime="07:00:00"
          slotMaxTime="20:00:00"
          events={filteredEvents} 
          select={handleDateSelect}
          eventClick={handleEventClick}
          eventDrop={handleEventDrop}
          eventContent={renderEventContent} // <-- Use custom render function
          // height="100%" // Removed
        />
      </div>

      {/* Appointment Form Modal */} 
      {isAppointmentModalOpen && (
        <AppointmentForm 
          isOpen={isAppointmentModalOpen}
          onClose={handleCloseModal}
          onSave={handleSaveAppointment}
          initialData={modalInitialData}
          professionals={professionals} // <-- From Zustand store
          tenant={tenantContext.currentTenant} // <<< PASS TENANT AS PROP >>>
        />
      )}

      {/* --- Menu de Contexto --- */}
      {contextMenu.visible && (
        <AppointmentContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          eventId={contextMenu.eventId}
          eventStatus={contextMenu.eventStatus}
          onClose={() => setContextMenu({ ...contextMenu, visible: false })} // Passa a função para fechar (p/ botão X)
          // Passa as funções de ação que definimos
          onUpdateStatus={handleUpdateStatusFromMenu}
          onSendWahaConfirmation={handleSendWahaConfirmation}
          onDelete={handleDeleteAppointment}
          // Passa o estado de visibilidade e o handler para mudança
          open={contextMenu.visible}
          onOpenChange={(isOpen) => setContextMenu({ ...contextMenu, visible: isOpen })}
        />
      )}
      {/* --- Fim Menu de Contexto --- */}
    </div>
  );
}