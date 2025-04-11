import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Appointment, Pet, Customer, Service, Consultation /*, MedicalRecord */ } from "@/api/entities";
import { petService } from "@/api/firebase/petService";
import { DiagnosticAgent } from '@/lib/DiagnosticAgent';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from "@/components/ui/use-toast";
import { ArrowLeft, Loader2, ClipboardList, Save, Bot, FileText, Mic, Square, ThumbsUp, ThumbsDown, Pill as PillIcon, Printer, RefreshCcw } from 'lucide-react';
import { PrescriptionModal } from '@/modules/live-vet/components/PrescriptionModal';
import PrintablePrescriptionContent from '@/components/medical/PrintablePrescription';
import { useTenant } from '@/components/tenant/TenantContext';
import PetAvatar from '@/components/pets/PetAvatar';
import { format, parseISO, differenceInMinutes } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { medicationTaskService } from '@/api/firebase/medicationTaskService';
import { queueService } from '@/api/firebase/queueService';

// URLs do NOVO serviço de áudio mock
const AUDIO_SERVICE_BASE_URL = 'http://localhost:8001';
const START_RECORDING_URL = `${AUDIO_SERVICE_BASE_URL}/start_recording`;
const END_RECORDING_URL = `${AUDIO_SERVICE_BASE_URL}/end_recording`;
const WEBSOCKET_URL_BASE = 'ws://localhost:8001/audio_stream'; // WebSocket URL

export default function LiveVetConsulta() {
  const { appointmentId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [appointment, setAppointment] = useState(null);
  const [pet, setPet] = useState(null);
  const [customer, setCustomer] = useState(null);
  const [service, setService] = useState(null);
  const [consultationHistory, setConsultationHistory] = useState([]);
  const [followUpQueueId, setFollowUpQueueId] = useState(null);
  const [followUpTaskDetails, setFollowUpTaskDetails] = useState([]);
  const diagnosticAgentRef = useRef(new DiagnosticAgent());

  // Estados para os campos da consulta atual
  const [anamnesisNotes, setAnamnesisNotes] = useState('');
  const [clinicalExamNotes, setClinicalExamNotes] = useState('');
  const [diagnosisNotes, setDiagnosisNotes] = useState('');
  const [treatmentNotes, setTreatmentNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Novos estados para streaming
  const [sessionId, setSessionId] = useState(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingTranscript, setStreamingTranscript] = useState('');
  const [backendReport, setBackendReport] = useState(null);
  const [streamingError, setStreamingError] = useState(null);
  const webSocketRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recognitionRef = useRef(null);
  const isStoppingRef = useRef(false);
  const currentSessionIdRef = useRef(null);
  const finalTranscriptRef = useRef('');

  // --- Estados para Sugestões e Diagnósticos (Revisados para Collapse) ---
  const [initialSuggestions, setInitialSuggestions] = useState([]);
  const [diagnosisSuggestions, setDiagnosisSuggestions] = useState([]);
  const [activeSuggestionPath, setActiveSuggestionPath] = useState(null);
  const [selectedSuggestionsHistory, setSelectedSuggestionsHistory] = useState([]);

  // --- Estados para Feedback e Correção (Inalterados) ---
  const [suggestionFeedback, setSuggestionFeedback] = useState({});
  const [diagnosisFeedback, setDiagnosisFeedback] = useState({});
  const [confirmedDiagnosis, setConfirmedDiagnosis] = useState('');

  // <<< Adicionar Estados para Prescrição >>>
  const [isPrescriptionModalOpen, setIsPrescriptionModalOpen] = useState(false);
  const [currentPrescriptionItems, setCurrentPrescriptionItems] = useState([]);
  const [currentPrescriptionObservations, setCurrentPrescriptionObservations] = useState('');
  const [currentRequiresFollowUp, setCurrentRequiresFollowUp] = useState(false);
  const { tenant } = useTenant();
  const [isPrinting, setIsPrinting] = useState(false);

  // <<< Ref para o componente de impressão >>>
  const printableComponentRef = useRef();

  useEffect(() => {
    console.log('[useEffect Main] Rodando com appointmentId:', appointmentId);
    const searchParams = new URLSearchParams(location.search);
    const queueIdFromUrl = searchParams.get('followUpQueueId');
    setFollowUpQueueId(queueIdFromUrl);
    console.log('[useEffect Main] Follow-up Queue ID da URL:', queueIdFromUrl);

    diagnosticAgentRef.current.clearContext();
    setSelectedSuggestionsHistory([]);
    setInitialSuggestions([]);
    setDiagnosisSuggestions([]);
    setActiveSuggestionPath(null);
    setBackendReport(null);
    setStreamingTranscript('');
    finalTranscriptRef.current = '';
    setFollowUpTaskDetails([]);

    const loadConsultationData = async () => {
      if (!appointmentId) {
        console.error('[useEffect Main] ID do agendamento NULO ao carregar.');
        setError("ID do agendamento não fornecido.");
        setIsLoading(false);
        return;
      }
      console.log('[useEffect Main] Iniciando busca de dados...');
      setIsLoading(true);
      setError(null);
      setStreamingError(null);
      try {
        const apptData = await Appointment.get(appointmentId);
        console.log('[useEffect Main] Agendamento carregado inicialmente:', apptData);

        let currentApptData = apptData; // Variável para manter dados atualizados

        // <<< MARCAR COMO EM ANDAMENTO E DEFINIR START_TIME >>>
        if ( (apptData.status === 'scheduled' || apptData.status === 'confirmed') && !apptData.start_time ) {
           console.log('[useEffect Main] Agendamento precisa ser iniciado. Atualizando status e start_time...');
           try {
              const startTimeUpdate = new Date().toISOString();
              // Chama update mas não usa o valor de retorno (que é undefined)
              await Appointment.update(appointmentId, {
                 status: 'in_progress',
                 start_time: startTimeUpdate
              });
              console.log('[useEffect Main] Agendamento marcado como in_progress (sem retorno verificado).');
              // Atualiza a variável local com os novos dados
              currentApptData = {
                ...apptData, // Começa com os dados originais
                status: 'in_progress', // Define o novo status
                start_time: startTimeUpdate // Define o novo start_time
              };
           } catch (startError) {
              console.error("[useEffect Main] Erro ao atualizar agendamento para in_progress:", startError);
              toast({ title: "Erro", description: "Não foi possível marcar o início do atendimento.", variant: "destructive" });
              // Em caso de erro ao atualizar, continua com os dados originais (apptData)
              // currentApptData já é apptData neste ponto, então não precisa fazer nada
           }
        }
        // <<< FIM DA LÓGICA DE INÍCIO >>>
        
        // Define o estado com os dados corretos (originais ou atualizados localmente)
        setAppointment(currentApptData);

        // <<< CARREGAR DADOS DA CONSULTA ANTERIOR (SE EXISTIR) >>>
        try {
          const existingConsultations = await Consultation.filter({ appointmentId: appointmentId });
          if (existingConsultations && existingConsultations.length > 0) {
              // Assumir que a primeira é a mais relevante/recente para este ID de agendamento
              const latestConsultation = existingConsultations[0]; 
              console.log('[useEffect Main] Consulta anterior encontrada, carregando dados:', latestConsultation);
              setAnamnesisNotes(latestConsultation.anamnesis?.notes || '');
              setClinicalExamNotes(latestConsultation.clinicalExam || '');
              setDiagnosisNotes(latestConsultation.diagnosis || '');
              setTreatmentNotes(latestConsultation.treatment || '');
              // Carregar também dados da prescrição, se houver
              setCurrentPrescriptionItems(latestConsultation.prescriptionItems || []);
              setCurrentPrescriptionObservations(latestConsultation.prescriptionObservations || '');
              setCurrentRequiresFollowUp(latestConsultation.requiresFollowUp || false);
          } else {
              console.log('[useEffect Main] Nenhuma consulta anterior encontrada para este agendamento.');
              // Garantir que os campos estejam vazios se não houver consulta prévia
              setAnamnesisNotes('');
              setClinicalExamNotes('');
              setDiagnosisNotes('');
              setTreatmentNotes('');
              setCurrentPrescriptionItems([]);
              setCurrentPrescriptionObservations('');
              setCurrentRequiresFollowUp(false);
          }
        } catch (consultationError) {
            console.error("[useEffect Main] Erro ao buscar consulta anterior:", consultationError);
            // Não definir erro principal, mas talvez mostrar um aviso?
            toast({ variant: "warning", title: "Aviso", description: "Não foi possível carregar as notas da consulta anterior." });
        }
        // <<< FIM DO CARREGAMENTO DA CONSULTA ANTERIOR >>>

        // <<< GARANTIR APENAS UMA DECLARAÇÃO AQUI >>>
        const [petDataResult, customerDataResult, serviceDataResult, historyDataResult] = await Promise.all([
          Pet.get(currentApptData.pet_id).catch(err => { console.error("Erro Pet:", err); return null; }),
          Customer.get(currentApptData.customer_id).catch(err => { console.error("Erro Cliente:", err); return null; }),
          Service.get(currentApptData.service_id).catch(err => { console.error("Erro Serviço:", err); return null; }),
          Consultation.filter({ petId: currentApptData.pet_id, tenant_id: currentApptData.tenant_id }).catch(err => { console.error("Erro Hist:", err); return []; })
        ]);
        console.log('[useEffect Main] Dados associados carregados:', {petDataResult, customerDataResult, serviceDataResult, historyDataResult});

        if (!petDataResult || !customerDataResult || !serviceDataResult) {
           console.error('[useEffect Main] Falha ao carregar dados essenciais!');
          throw new Error("Não foi possível carregar todos os dados necessários (pet, cliente ou serviço).");
        }

        setPet(petDataResult);
        setCustomer(customerDataResult);
        setService(serviceDataResult);
        setConsultationHistory(historyDataResult);
        console.log('[useEffect Main] Estados atualizados com sucesso.');

        console.log('[useEffect Main] Agendamento carregado:', apptData);
        setAppointment(apptData);

        // <<< LÓGICA ATUALIZADA PARA BUSCAR DETALHES DAS TAREFAS DE RETORNO >>>
        if (queueIdFromUrl) {
          try {
            console.log(`[useEffect Main] É um retorno (Fila ID: ${queueIdFromUrl}). Buscando detalhes das tarefas administradas para Appt ID: ${appointmentId}...`);
            const administeredTasks = await medicationTaskService.filter({
              appointment_id: appointmentId, 
              status: 'administrada',
              // Adicionar filtro requires_follow_up diretamente se o serviço permitir
              // requires_follow_up: true // Se a API suportar, senão filtramos no frontend
            });
            
            // Filtrar no frontend caso a API não suporte o filtro direto
            const followUpRequiredTasks = administeredTasks.filter(task => task.requires_follow_up === true);

            if (followUpRequiredTasks.length > 0) {
              const taskDetails = followUpRequiredTasks.map(task => ({
                id: task.id,
                medicationName: task.medication_name || 'Nome não encontrado',
                details: task.details || 'Sem detalhes',
                observations: task.observations || '' // Observação copiada da prescrição
              }));
              console.log('[useEffect Main] Detalhes das tarefas de retorno encontradas:', taskDetails);
              setFollowUpTaskDetails(taskDetails); // <<< Atualiza estado com array de detalhes
            } else {
              console.warn('[useEffect Main] Retorno detectado, mas nenhuma tarefa de medicação administrada COM requires_follow_up encontrada.');
              setFollowUpTaskDetails([]); // Garante que esteja vazio
            }
          } catch (medError) {
            console.error('[useEffect Main] Erro ao buscar tarefas de medicação para retorno:', medError);
            // Poderia setar um estado de erro específico para isso
            setFollowUpTaskDetails([]); 
          }
        }
        // <<< FIM DA LÓGICA DE RETORNO >>>

      } catch (err) {
        console.error("[useEffect Main] ERRO DETALHADO no catch:", err);
        setError(`Erro ao carregar dados: ${err.message}`);
        toast({ title: "Erro", description: "Não foi possível carregar os dados da consulta.", variant: "destructive" });
      } finally {
         console.log('[useEffect Main] Definindo isLoading = false (original).');
         setIsLoading(false);
      }
    };

    loadConsultationData();

    return () => {
      console.log('[useEffect Main] Limpeza ao desmontar ou antes de re-rodar.');
    };
  }, [appointmentId, location.search]);

  const handleStartStreamingRecording = useCallback(async () => {
    if (isStreaming) return;

    setInitialSuggestions([]);
    setDiagnosisSuggestions([]);
    setActiveSuggestionPath(null);
    setBackendReport(null);
    setStreamingTranscript('');
    finalTranscriptRef.current = '';

    console.log("Iniciando gravação e conexão WebSocket...");
    setIsStreaming(true);
    setStreamingError(null);
    diagnosticAgentRef.current.clearContext();
    setSelectedSuggestionsHistory([]);
    audioChunksRef.current = [];

    try {
      const startResponse = await fetch(START_RECORDING_URL, { method: 'POST' });
      if (!startResponse.ok) {
        throw new Error(`Erro ao iniciar sessão: ${startResponse.statusText}`);
      }
      const startData = await startResponse.json();
      const currentSessionId = startData.sessionId;
      setSessionId(currentSessionId);
      console.log("Sessão iniciada com ID:", currentSessionId);

      const wsUrl = `${WEBSOCKET_URL_BASE}/${currentSessionId}`;
      const ws = new WebSocket(wsUrl);
      webSocketRef.current = ws;

      ws.onopen = () => {
        console.log("WebSocket conectado:", wsUrl);
        setIsStreaming(true);
        toast({ title: "Streaming iniciado", description: "Conectado e gravando..." });
      };
      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          if (message.transcript_chunk) {
            const chunk = message.transcript_chunk;
            setStreamingTranscript(prev => prev + chunk);
            const analysisResult = diagnosticAgentRef.current.analyzeText(chunk);
            setInitialSuggestions(analysisResult.initialQuestions);
            setDiagnosisSuggestions(analysisResult.potentialDiagnoses);
          }
        } catch (e) {
          console.error("Erro ao processar mensagem WS:", e);
        }
      };
      ws.onerror = (error) => {
        console.error("Erro no WebSocket:", error);
        setStreamingError("Erro na conexão com o serviço de áudio.");
        toast({ title: "Erro de Conexão", description: "Não foi possível manter a conexão.", variant: "destructive" });
        setIsStreaming(false);
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') mediaRecorderRef.current.stop();
        webSocketRef.current = null;
        setSessionId(null);
      };
      ws.onclose = (event) => {
        console.log("WebSocket fechado:", event.code, event.reason);
        if (webSocketRef.current === ws) webSocketRef.current = null;
        if (sessionId === currentSessionId && isStreaming) {
            console.warn("WebSocket fechado inesperadamente durante streaming.");
            setIsStreaming(false);
             if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') mediaRecorderRef.current.stop();
        }
      };

      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SpeechRecognition) {
        throw new Error("Web Speech API não suportada neste navegador.");
      }

      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'pt-BR';
      recognitionRef.current = recognition;

      let finalTranscriptSegment = '';

      recognition.onresult = (event) => {
        let interimTranscript = '';
        finalTranscriptSegment = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscriptSegment += event.results[i][0].transcript;
          } else {
            interimTranscript += event.results[i][0].transcript;
          }
        }
        let nextTranscript = streamingTranscript;
        setStreamingTranscript(prev => {
            if (finalTranscriptSegment && !prev.endsWith(finalTranscriptSegment.trim() + ' ')) {
                 nextTranscript = prev + finalTranscriptSegment.trim() + ' ';
                 return nextTranscript;
            } else {
                 nextTranscript = prev;
                return prev;
            }
        });
        finalTranscriptRef.current = nextTranscript;
        console.log('Interim:', interimTranscript, '| Final segment:', finalTranscriptSegment);
      };

      recognition.onerror = (event) => {
        console.error('>>> DETALHE Erro do SpeechRecognition:', event);
        setStreamingError(`Erro no reconhecimento de fala: ${event.error} - ${event.message || 'Sem msg adicional.'}`);
        if (isStreaming) {
            handleStopStreamingRecording();
        }
      };

      recognition.onend = () => {
        console.log('SpeechRecognition parado.');
        if (isStoppingRef.current) {
            console.log('Parada intencional detectada, enviando dados...');
            const finalTranscriptToSend = finalTranscriptRef.current;
            const sessionIdToSend = currentSessionIdRef.current;
            sendDataToServer(finalTranscriptToSend, sessionIdToSend);

            isStoppingRef.current = false;
            setSessionId(null);
            mediaRecorderRef.current = null;
            audioChunksRef.current = [];
        } else {
             console.log('Reco parou (ex: silêncio), mas não foi parada intencional.');
        }
      };

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error("getUserMedia não é suportado neste navegador.");
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const options = { mimeType: 'audio/webm;codecs=opus' };
      const recorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
              audioChunksRef.current.push(event.data);
              if (webSocketRef.current && webSocketRef.current.readyState === WebSocket.OPEN) {
                  webSocketRef.current.send(event.data);
              }
          }
      };

      recorder.onstop = () => {
          console.log("MediaRecorder parado.");
          stream.getTracks().forEach(track => track.stop());
      };

      recorder.onerror = (event) => {
          console.error("Erro no MediaRecorder:", event.error);
          setStreamingError(`Erro na gravação local: ${event.error.message}`);
          toast({ title: "Erro de Gravação", description: event.error.message, variant: "destructive" });
          if (isStreaming && sessionId) {
              handleStopStreamingRecording();
          } else {
               setIsStreaming(false);
               if (webSocketRef.current) webSocketRef.current.close();
          }
      };

      recorder.start(1000);
      console.log("MediaRecorder iniciado.");

      if (recognitionRef.current) {
         recognitionRef.current.start();
         console.log("SpeechRecognition iniciado.");
      }

    } catch (err) {
      console.error("Erro ao iniciar gravação/streaming:", err);
      setStreamingError(`Falha ao iniciar: ${err.message}`);
      toast({ title: "Erro ao Iniciar", description: err.message, variant: "destructive" });
      setIsStreaming(false);
      setSessionId(null);
      if (webSocketRef.current) {
         webSocketRef.current.close();
         webSocketRef.current = null;
      }
       if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
          mediaRecorderRef.current.stop();
      }
    }
  }, [isStreaming]);

  const handleStopStreamingRecording = useCallback(async () => {
    if (recognitionRef.current) {
      console.log("Chamando recognition.stop()...");
      isStoppingRef.current = true;
      recognitionRef.current.stop();
    }
    if (!mediaRecorderRef.current) return;
    const currentSessionId = currentSessionIdRef.current;
    if (!currentSessionId) return;

    console.log("Parando MediaRecorder e finalizando sessão (localmente):", currentSessionId);
    setIsStreaming(false);

    if (mediaRecorderRef.current.state === "recording") {
        mediaRecorderRef.current.stop();
    }

    if (webSocketRef.current && webSocketRef.current.readyState === WebSocket.OPEN) {
      console.log('Fechando WebSocket explicitamente...');
      webSocketRef.current.close(1000, "Client ending session");
    }
    webSocketRef.current = null;

  }, []);

  const sendDataToServer = useCallback(async (finalTranscript, currentSessionId) => {
    console.log(`Enviando para o servidor (Sessão: ${currentSessionId}): `, finalTranscript);
    if (!currentSessionId) {
        console.error("Tentativa de enviar dados sem ID de sessão válido.");
        setStreamingError("Erro interno: ID da sessão perdido ao enviar.");
        return;
    }

    try {
        const response = await fetch(END_RECORDING_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
               sessionId: currentSessionId,
               finalTranscript: finalTranscript
           }),
        });

        if (!response.ok) {
          const errorBody = await response.text();
           let detail = errorBody;
          try {
            const errorJson = JSON.parse(errorBody);
            detail = errorJson.detail || errorBody;
          } catch (parseError) {
             console.warn("Não foi possível analisar o corpo do erro de end_recording como JSON:", parseError);
          }
          throw new Error(`Erro ao finalizar sessão no backend: ${response.statusText} - ${detail}`);
        }

        const report = await response.json();
        console.log("Relatório final recebido (com análise Gemini?):", report);
        setBackendReport(report);
        toast({ title: "Gravação Finalizada", description: "Análise IA recebida." });

        if (report?.gemini_analysis?.error) {
            console.error("Erro da API Gemini reportado pelo backend:", report.gemini_analysis.error);
            setStreamingError(`Erro na análise IA: ${report.gemini_analysis.error}`);
            setInitialSuggestions([]);
            setDiagnosisSuggestions([]);
        } else if (report?.gemini_analysis) {
            const geminiQuestions = report.gemini_analysis.follow_up_questions || [];
            const geminiDiagnoses = report.gemini_analysis.possible_diagnoses || [];

            setInitialSuggestions(geminiQuestions);
            setDiagnosisSuggestions(geminiDiagnoses);
            setStreamingError(null);
            setActiveSuggestionPath(null);
        } else {
            setStreamingError("Resposta do backend incompleta (sem análise Gemini).");
        }

      } catch (err) {
        console.error("Erro ao enviar dados para o backend:", err);
        setStreamingError(`Falha ao comunicar com backend: ${err.message}`);
        toast({ title: "Erro de Comunicação", description: err.message, variant: "destructive" });
        setBackendReport(null);
      }
  }, []);

  const handleSuggestionSelect = (suggestionText, type, index, path = null) => {
    console.log(`Sugestão/Pergunta selecionada: ${suggestionText}`)

    setSelectedSuggestionsHistory(prev => [...prev, { text: suggestionText, type, path }]);

    setActiveSuggestionPath(path);

  };

  const handleSuggestionFeedback = (suggestion, isUseful) => {
      const feedback = isUseful ? 'useful' : 'not_useful';
      setSuggestionFeedback(prev => ({ ...prev, [suggestion]: feedback }));
      console.log(`[Feedback] Sugestão: "${suggestion}" marcada como ${feedback}`);
      toast({ title: "Feedback Registrado", description: `Sugestão "${suggestion.substring(0,30)}..." marcada.` });
  };

   const handleDiagnosisFeedback = (diagnosis, isUseful) => {
      const feedback = isUseful ? 'useful' : 'not_useful';
      setDiagnosisFeedback(prev => ({ ...prev, [diagnosis]: feedback }));
       console.log(`[Feedback] Diagnóstico: "${diagnosis}" marcado como ${feedback}`);
      toast({ title: "Feedback Registrado", description: `Diagnóstico "${diagnosis}" marcado.` });
  };

  // <<< FUNÇÃO RENOMEADA: Salva progresso da consulta e atualiza histórico >>>
  const saveProgressAndUpdateHistory = async () => {
      console.log('[saveProgressAndUpdateHistory] Iniciando...');
      if (!appointment || !pet || !customer) {
          toast({ title: "Erro", description: "Dados essenciais faltando para salvar.", variant: "destructive" });
          return;
      }
      setIsSaving(true);
      try {
          const existingConsultations = await Consultation.filter({ appointmentId: appointment.id });
          const interactionDataForRAG = generateInteractionDataForRAG(); // Gera dados atuais

          const consultationDataPayload = { // Usa payload para clareza
              appointmentId: appointment.id,
              petId: pet.id,
              ownerId: customer.id,
              vetId: 'vet-default',
              date: new Date().toISOString(),
              reason: service?.name || appointment.notes || 'Consulta Clínica',
              // Usa os estados atuais dos campos
              anamnesis: { notes: anamnesisNotes },
              clinicalExam: clinicalExamNotes,
              diagnosis: diagnosisNotes,
              treatment: treatmentNotes,
              // <<< Adicionar dados da prescrição >>>
              prescriptionItems: currentPrescriptionItems, 
              prescriptionObservations: currentPrescriptionObservations, 
              requiresFollowUp: currentRequiresFollowUp, 
              // Status NÃO é alterado aqui
              tenant_id: appointment.tenant_id,
              fullInteraction: interactionDataForRAG
          };

          let savedConsultation;
          if (existingConsultations.length > 0) {
              console.log('[saveProgressAndUpdateHistory] Atualizando consulta existente:', existingConsultations[0].id);
              savedConsultation = await Consultation.update(existingConsultations[0].id, consultationDataPayload);
          } else {
              console.log('[saveProgressAndUpdateHistory] Criando nova consulta...');
              savedConsultation = await Consultation.create(consultationDataPayload);
          }
          console.log("[saveProgressAndUpdateHistory] Consulta salva/atualizada:", savedConsultation);
          toast({ title: "Progresso Salvo", description: "Suas anotações foram salvas com sucesso." });

          // Atualiza histórico do pet (lógica movida para cá)
          try {
            const petId = interactionDataForRAG.petInfo?.id;
            if (petId) {
              console.log(`[saveProgressAndUpdateHistory] Atualizando histórico para o pet ID: ${petId}`);
              const currentPetData = await Pet.get(petId);
              if (currentPetData) {
                 const historySummary = {
                   consultationId: savedConsultation?.id || 'unknown-' + Date.now(), // ID mais robusto
                   appointmentId: interactionDataForRAG.appointmentId,
                   date: interactionDataForRAG.reportGeneratedAt,
                   serviceName: interactionDataForRAG.serviceInfo?.name || 'Serviço Desconhecido',
                   diagnosis: interactionDataForRAG.vetNotes?.diagnosis || interactionDataForRAG.confirmedDiagnosis || 'Não registrado',
                   chiefComplaint: interactionDataForRAG.fullTranscript?.substring(0, 50) + (interactionDataForRAG.fullTranscript?.length > 50 ? '...' : '') || 'N/A'
                 };
                 const updatedHistory = [...(currentPetData.consultationHistory || []), historySummary];
                 const uniqueHistory = updatedHistory.filter((item, index, self) => index === self.findIndex((t) => (t.consultationId === item.consultationId)));
                 await petService.update(petId, { consultationHistory: uniqueHistory });
                 console.log(`[saveProgressAndUpdateHistory] Histórico do pet ${petId} atualizado.`);
              } else { console.warn(`[saveProgressAndUpdateHistory] Pet ${petId} não encontrado.`); }
            } else { console.warn('[saveProgressAndUpdateHistory] ID do Pet não encontrado nos dados.'); }
          } catch (historyError) {
             console.error("[saveProgressAndUpdateHistory] Erro ao atualizar histórico:", historyError);
             toast({ title: "Aviso", description: "Não foi possível atualizar o histórico no prontuário.", variant: "warning" });
          }

      } catch (err) {
          console.error("[saveProgressAndUpdateHistory] Erro:", err);
          toast({ title: "Erro ao Salvar", description: `Não foi possível salvar o progresso: ${err.message}`, variant: "destructive"});
      } finally {
          setIsSaving(false);
      }
  };

  // <<< NOVA FUNÇÃO: Apenas completa o AGENDAMENTO >>>
  const handleCompleteAppointment = async (appointmentIdToComplete, consultationNotes) => {
    console.log("[handleCompleteAppointment] Iniciando conclusão para appointment:", appointmentIdToComplete);
    try {
      const appointmentToUpdate = await Appointment.get(appointmentIdToComplete);
      if (!appointmentToUpdate) {
         throw new Error("Agendamento original não encontrado para concluir.");
      }
      
      // <<< USA start_time que DEVE ter sido definido no useEffect >>>
      const startTime = appointmentToUpdate.start_time || appointmentToUpdate.date; 
      const endTime = new Date();
      let duration = 0; // Default para 0
      try {
          const startDate = parseISO(startTime);
          const endDate = endTime; // Já é objeto Date
          const minutes = differenceInMinutes(endDate, startDate);
          if (!isNaN(minutes) && minutes >= 0) { // <<< Garante que seja >= 0 >>>
              duration = minutes;
          } else {
              console.warn(`[handleCompleteAppointment] Duração calculada inválida ou negativa (${minutes}). Salvando como 0.`);
          }
      } catch (e) { 
          console.error("Erro calculando duração para Appointment:", e); 
      }
            
      const updateData = {
        status: 'completed',
        end_time: endTime.toISOString(), // Salva como ISO string
        duration_minutes: duration, // Salva a duração calculada (ou 0)
        consultation_notes: consultationNotes
      };
      console.log("[handleCompleteAppointment] Atualizando agendamento com:", updateData);
      await Appointment.update(appointmentIdToComplete, updateData);
      console.log("[handleCompleteAppointment] Agendamento concluído com sucesso.");
    } catch (error) {
      console.error("[handleCompleteAppointment] Erro ao concluir agendamento:", error);
      // Relança o erro para ser tratado por quem chamou (saveConsultationDataAndComplete)
      throw new Error(`Não foi possível marcar o agendamento como concluído: ${error.message}`);
    }
  };

  // <<< NOVA FUNÇÃO: Salva consulta, completa agendamento e navega >>>
  const saveConsultationDataAndComplete = async () => {
    console.log("[saveConsultationDataAndComplete] Iniciando...");
    setIsSaving(true);
    try {
      // 1. Salva o progresso da consulta e atualiza histórico
      await saveProgressAndUpdateHistory();

      // 2. Prepara notas resumidas (opcional)
      const summaryNotes = `Anamnese: ${anamnesisNotes?.substring(0,50)}... | Exame: ${clinicalExamNotes?.substring(0,50)}... | Diag: ${diagnosisNotes?.substring(0,50)}... | Trat: ${treatmentNotes?.substring(0,50)}...`;

      // 3. Marca o agendamento como concluído
      if (appointment?.id) {
        await handleCompleteAppointment(appointment.id, summaryNotes);
      } else {
         throw new Error("ID do agendamento não disponível para conclusão.");
      }
      
      // <<< 4. (NOVO) Se for um retorno, marca o item da fila como concluído >>>
      if (followUpQueueId) {
        console.log(`[saveConsultationDataAndComplete] Marcando item da fila de retorno ${followUpQueueId} como concluído.`);
        try {
          await queueService.update(followUpQueueId, {
            status: 'completed',
            end_time: new Date().toISOString()
          });
          console.log(`[saveConsultationDataAndComplete] Item da fila ${followUpQueueId} concluído com sucesso.`);

          // <<< Adicionar atualização do Agendamento original >>>
          try {
            console.log(`[saveConsultationDataAndComplete] Marcando Agendamento ${appointment.id} com follow_up_completed.`);
            await Appointment.update(appointment.id, { follow_up_completed: true });
            console.log(`[saveConsultationDataAndComplete] Agendamento ${appointment.id} marcado com sucesso.`);
          } catch (apptUpdateError) {
            console.error(`[saveConsultationDataAndComplete] Erro ao marcar follow_up_completed no Agendamento ${appointment.id}:`, apptUpdateError);
            toast({ variant: "warning", title: "Aviso", description: "Não foi possível marcar o agendamento original como tendo retorno concluído." });
          }
          // <<< Fim da atualização do Agendamento >>>

        } catch (queueError) {
          console.error(`[saveConsultationDataAndComplete] Erro ao concluir item da fila ${followUpQueueId}:`, queueError);
          // Não lançar erro aqui, apenas logar. A conclusão principal já ocorreu.
          toast({ variant: "warning", title: "Aviso", description: "Atendimento concluído, mas houve um erro ao finalizar o item na fila de retorno." });
        }
      }
      // <<< Fim do passo 4 >>>

      // 5. Exibe toast e Navega para a fila (COM o prefixo /tenant)
      toast({ title: "Sucesso", description: "Atendimento salvo e concluído!" });
      console.log("[saveConsultationDataAndComplete] Navegando para /tenant/live-vet...");
      navigate('/tenant/live-vet');

    } catch (error) {
      console.error("[saveConsultationDataAndComplete] Erro geral:", error);
      toast({ variant: "destructive", title: "Erro", description: `Falha ao salvar/concluir: ${error.message}` });
    } finally {
      setIsSaving(false);
    }
  };

  const generateInteractionDataForRAG = () => {
      const finalTranscript = backendReport?.final_transcript || streamingTranscript || "";
      const interactionData = {
            reportGeneratedAt: new Date().toISOString(),
            sessionId: backendReport?.sessionId || sessionId || "N/A",
            appointmentId: appointment?.id,
            petInfo: { id: pet?.id, name: pet?.name, species: pet?.species, breed: pet?.breed },
            customerInfo: { id: customer?.id, name: customer?.full_name },
            serviceInfo: { id: service?.id, name: service?.name },
            fullTranscript: finalTranscript,
            backendAudioReport: backendReport,
            suggestionFlow: selectedSuggestionsHistory.map(s => ({ question: s.text, feedback: suggestionFeedback[s.text] || 'none' })),
            suggestionFeedbackLog: suggestionFeedback,
            diagnosisFeedbackLog: diagnosisFeedback,
            vetNotes: {
                anamnesis: anamnesisNotes,
                clinicalExam: clinicalExamNotes,
                diagnosis: diagnosisNotes,
                treatment: treatmentNotes,
            },
            confirmedDiagnosis: confirmedDiagnosis || "Não confirmado",
            metadata: {
                transcriptWordCount: finalTranscript ? finalTranscript.trim().split(/\s+/).length : 0,
            }
        };
        console.log("--- Dados da Interação para RAG/Log (Simulado) ---", JSON.stringify(interactionData, null, 2));
        return interactionData;
  };

  const generateConsultationReport = async () => {
      console.log("Salvando consulta antes de gerar relatório...");
      try {
        // Salva o progresso e aguarda a conclusão
        await saveProgressAndUpdateHistory();
        
        // Gera os dados do relatório
        const report = generateInteractionDataForRAG();
        
        // Cria ou atualiza a consulta com os dados do relatório
        const consultationPayload = {
          appointmentId: appointmentId,
          pet_id: pet?.id,
          tenant_id: localStorage.getItem('current_tenant'),
          fullInteraction: report
        };
        
        try {
          console.log(`[generateConsultationReport] Tentando atualizar consulta ${appointmentId}`);
          await Consultation.update(appointmentId, consultationPayload);
        } catch (updateError) {
          if (updateError.message.includes('Consulta não encontrada')) {
            console.log(`[generateConsultationReport] Criando nova consulta para ${appointmentId}`);
            await Consultation.create(consultationPayload);
          } else {
            throw updateError;
          }
        }

        // Navega para a página de relatório
        if (appointmentId) {
          console.log("Navegando para a página de relatório...");
          navigate(`/tenant/live-vet/consulta/${appointmentId}/relatorio`);
        } else {
          throw new Error("ID do agendamento não encontrado");
        }
      } catch (error) {
        console.error("[generateConsultationReport] Erro:", error);
        toast({ 
          title: "Erro ao gerar relatório", 
          description: error.message, 
          variant: "destructive" 
        });
      }
  };

  useEffect(() => {
    currentSessionIdRef.current = sessionId;
  }, [sessionId]);

  useEffect(() => {
    finalTranscriptRef.current = streamingTranscript;
  }, [streamingTranscript]);

  console.log('[Render] Verificando estados:', { isLoading, error, appointment, pet, customer, service });

  const handleOpenPrescriptionModal = () => {
    setIsPrescriptionModalOpen(true);
  };

  const handleClosePrescriptionModal = () => {
    setIsPrescriptionModalOpen(false);
  };

  const handleSavePrescription = async (prescriptionData) => {
    console.log("[handleSavePrescription] Salvando prescrição:", prescriptionData);
    setIsSaving(true);
    try {
      // 1. Salva localmente (opcional)
      setCurrentPrescriptionItems(prescriptionData.items);

      // 2. Criar MedicationTasks para itens de uso interno
      // console.log("[handleSavePrescription] Verificando items ANTES do filtro:", JSON.stringify(prescriptionData.items, null, 2)); // Remover log
      
      const internalMedicationItems = prescriptionData.items.filter(item => {
        // console.log(`[handleSavePrescription] Filtrando item.usage: '${item.usage}', Comparando com: 'interno', Resultado: ${item.usage === 'interno'}`); // Remover log
        return item.usage === 'interno'; // <<< CORRIGIDO para comparar com 'interno' (Português)
      });
      // console.log("[handleSavePrescription] Itens internos para criar tasks (APÓS filtro):", internalMedicationItems); // Remover log

      if (internalMedicationItems.length > 0) {
        const tenantId = localStorage.getItem('current_tenant');
        const tasksPromises = internalMedicationItems.map(item =>
          medicationTaskService.create({
            tenant_id: tenantId,
            pet_id: pet?.id,
            appointment_id: appointmentId,
            medication_name: item.itemName, // Corrigido para usar itemName
            details: item.details,          // Corrigido para usar details diretamente
            scheduled_time: new Date().toISOString(), 
            status: 'Pendente',
            // <<< Adicionar campos da prescrição >>>
            observations: prescriptionData.observations,
            requires_follow_up: prescriptionData.requiresFollowUp 
            // <<< Fim da adição >>>
          })
        );
        await Promise.all(tasksPromises);
        console.log(`[handleSavePrescription] ${internalMedicationItems.length} MedicationTasks criadas.`);
        
        // <<< Atualiza os estados com dados da prescrição salva >>>
        setCurrentPrescriptionObservations(prescriptionData.observations);
        setCurrentRequiresFollowUp(prescriptionData.requiresFollowUp);

        // <<< MARCAR O AGENDAMENTO SE NECESSITAR RETORNO >>>
        if (prescriptionData.requiresFollowUp) {
          try {
            console.log(`[handleSavePrescription] Marcando agendamento ${appointmentId} como necessitando retorno de medicação.`);
            await Appointment.update(appointmentId, { requires_medication_follow_up: true });
          } catch (apptUpdateError) {
            console.error(`[handleSavePrescription] Erro ao marcar retorno no agendamento ${appointmentId}:`, apptUpdateError);
            toast({ title: "Aviso", description: "Não foi possível marcar o agendamento como necessitando retorno.", variant: "warning" });
          }
        }

        toast({ title: "Tarefas de Medicação Criadas", description: "Itens de uso interno foram adicionados à fila.", });
      }

      toast({ title: "Prescrição Salva", description: "A prescrição foi registrada com sucesso.", });
      setIsPrescriptionModalOpen(false);

    } catch (error) {
      console.error("[handleSavePrescription] Erro GERAL ao salvar prescrição:", error);
      toast({ title: "Erro ao Salvar", description: `Falha ao registrar prescrição: ${error.message}`, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  // <<< ADICIONAR useEffect para IMPRIMIR >>>
  useEffect(() => {
    if (isPrinting && printableComponentRef.current) {
      // A mágica acontece aqui: o CSS @media print vai cuidar de mostrar/esconder
      window.print();
      // Reseta o estado após disparar a impressão
      setIsPrinting(false);
    }
  }, [isPrinting]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-16 w-16 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-screen text-destructive">
        <ClipboardList className="h-16 w-16 mb-4" />
        <h2 className="text-xl font-semibold mb-2">Erro ao Carregar Consulta</h2>
        <p className="mb-4">{error}</p>
        <Button variant="outline" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar
        </Button>
      </div>
    );
  }

  if (!appointment || !pet || !customer || !service) {
     return (
      <div className="flex flex-col items-center justify-center h-screen text-muted-foreground">
        <ClipboardList className="h-16 w-16 mb-4" />
        <h2 className="text-xl font-semibold mb-2">Dados Incompletos</h2>
        <p className="mb-4">Não foi possível carregar todas as informações necessárias.</p>
        <Button variant="outline" onClick={() => navigate(-1)}>
           <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar
        </Button>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
             <Button variant="outline" size="sm" onClick={() => navigate('/tenant/live-vet')}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Voltar para Dashboard Live Vet
             </Button>
             <h1 className="text-2xl font-bold text-center flex-1 mx-4">Consulta Clínica - {pet?.name}</h1>
             <div className="flex items-center gap-2">
                <Button variant="secondary" onClick={generateConsultationReport} disabled={isStreaming}>
                   <FileText className="h-4 w-4 mr-2" />
                   Gerar Relatório
                </Button>
                 <Button onClick={saveProgressAndUpdateHistory} disabled={isSaving || isStreaming}>
                    {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin"/> : <Save className="h-4 w-4 mr-2" />}
                    {isSaving ? 'Salvando...' : 'Salvar Progresso'}
                </Button>
                <Button onClick={handleOpenPrescriptionModal} variant="outline">
                  <PillIcon className="mr-2 h-4 w-4" /> Prescrever
                </Button>
                {currentPrescriptionItems && currentPrescriptionItems.length > 0 && (
                   <Button onClick={() => setIsPrinting(true)} variant="outline">
                      <Printer className="mr-2 h-4 w-4" /> Imprimir Prescrição
                   </Button>
                 )}
            </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1 space-y-6">
                <Card>
                    <CardHeader>
                        <CardTitle>Informações do Paciente</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center justify-between space-x-4">
                            <div className="space-y-1 text-sm">
                                <p><strong>Nome:</strong> {pet?.name || 'Carregando...'}</p>
                                <p><strong>Espécie:</strong> {pet?.species || 'N/A'}</p>
                                <p><strong>Raça:</strong> {pet?.breed || 'N/A'}</p>
                            </div>
                            <div>
                                {pet && <PetAvatar pet={pet} className="w-16 h-16" />}
                            </div>
                        </div>
                    </CardContent>
                </Card>
                 <Card>
                    <CardHeader>
                        <CardTitle>Informações do Cliente</CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm space-y-2">
                        <p><strong>Nome:</strong> {customer.full_name}</p>
                        <p><strong>Telefone:</strong> {customer.phone}</p>
                        <p><strong>Email:</strong> {customer.email}</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle>Histórico de Consultas</CardTitle>
                        {followUpQueueId && followUpTaskDetails.length > 0 && (
                          <p className="text-sm font-semibold text-orange-600 pt-1">
                            <RefreshCcw className="h-4 w-4 mr-1 inline-block" /> 
                            Retorno para acompanhamento de: {followUpTaskDetails.map(task => task.medicationName).join(', ')}
                          </p>
                        )}
                        <CardDescription>{consultationHistory.length} consulta(s) anterior(es)</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {followUpQueueId && followUpTaskDetails.length > 0 && (
                            <div className="mb-4 pb-4 border-b border-dashed border-orange-300">
                                <h4 className="text-sm font-semibold mb-2 text-orange-700">Itens que Motivaram o Retorno:</h4>
                                <ul className="space-y-2 pl-2">
                                    {followUpTaskDetails.map(task => (
                                        <li key={task.id} className="text-sm">
                                            <p>
                                                <span className="font-medium">Item:</span> {task.medicationName} ({task.details})
                                            </p>
                                            {task.observations && (
                                                <p className="text-xs text-muted-foreground pl-3">
                                                    <span className="font-medium">Obs. Prescrição:</span> {task.observations}
                                                 </p>
                                            )}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {consultationHistory.length === 0 && (!followUpQueueId || followUpTaskDetails.length === 0) ? (
                            <p className="text-sm text-muted-foreground">
                                {followUpQueueId ? 'Nenhum histórico adicional encontrado.' : 'Nenhum histórico de consulta anterior para este pet.'}
                            </p>
                        ) : consultationHistory.length > 0 ? (
                             <div>
                                 {(followUpQueueId || consultationHistory.length > 0) && (
                                     <h4 className="text-sm font-semibold mb-2 mt-2">Consultas Anteriores:</h4>
                                 )}
                                <ul className="space-y-3">
                                    {consultationHistory.slice(0, 5).map((hist) => (
                                        <li key={hist.id} className="text-sm">
                                            <span className="font-medium">
                                                {hist.date ? format(parseISO(hist.date), 'dd/MM/yyyy', { locale: ptBR }) : 'Data Indisponível'}
                                            </span>
                                            : {hist.diagnosis || hist.clinical_exam_notes?.substring(0, 50) || 'Consulta Rápida'}
                                        </li>
                                    ))}
                                </ul>
                             </div>
                        ) : null}
                    </CardContent>
                </Card>
            </div>

            <div className="lg:col-span-2 space-y-6">
                 <Card>
                    <CardHeader>
                        <CardTitle>Atendimento Atual</CardTitle>
                        <CardDescription>
                            {service.name} - {format(parseISO(appointment.date), 'dd/MM/yyyy')} às {appointment.time}
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                         <div>
                            <Label className="text-base font-semibold mb-2 block">Assistente de Consulta (IA - Streaming)</Label>
                            <div className="flex gap-2 mb-3">
                                 <Button onClick={handleStartStreamingRecording} disabled={isStreaming} variant="outline" size="sm">
                                     <Mic className={`h-4 w-4 mr-2 ${isStreaming ? 'text-red-500 animate-pulse' : ''}`}/> {isStreaming ? 'Gravando...' : 'Iniciar Gravação'}
                                 </Button>
                                  <Button onClick={handleStopStreamingRecording} disabled={!isStreaming} variant="destructive" size="sm">
                                     <Square className="h-4 w-4 mr-2"/> Parar Gravação
                                 </Button>
                             </div>

                            <div className="mt-2 p-3 border rounded-md bg-muted/50 min-h-[100px]">
                              <div className="flex items-center gap-2 mb-2">
                                <Bot className="h-4 w-4 text-primary" />
                                <p className="text-sm font-medium text-primary">Transcrição em Tempo Real:</p>
                                {isStreaming && <Loader2 className="h-4 w-4 animate-spin ml-2" />}
                              </div>
                              {streamingError && (
                                 <p className="text-sm text-destructive mb-2">Erro: {streamingError}</p>
                              )}
                               {isStreaming && streamingTranscript && (
                                   <p className="text-sm mb-2">{streamingTranscript}</p>
                               )}
                               {!isStreaming && backendReport?.final_transcript && (
                                   <p className="text-sm mb-2"><strong>Final:</strong> {backendReport.final_transcript}</p>
                               )}
                               {!isStreaming && !backendReport && !streamingError && (
                                   <p className="text-sm text-muted-foreground">Aguardando início da gravação...</p>
                               )}

                             {backendReport && (
                               <div className="mt-3 pt-3 border-t">
                                    <p className="text-xs font-medium mb-1 text-muted-foreground">Relatório Backend (Debug):</p>
                                    <pre className="text-xs bg-background p-2 rounded overflow-x-auto max-h-40">
                                        {JSON.stringify(backendReport, null, 2)}
                                    </pre>
                               </div>
                             )}
                           </div>

                           <div className="mt-4 space-y-3">
                               {initialSuggestions.length > 0 && (
                                   <div className="space-y-2">
                                      <h4 className="text-sm font-medium text-gray-700 mb-2">Perguntas Iniciais Sugeridas:</h4>
                                      {initialSuggestions.map((sug, i) => (
                                          <div key={`init-${i}`} className="border rounded border-blue-200 bg-blue-50/80 p-2">
                                               <div className="flex items-center gap-1">
                                                   <Button variant="ghost" size="sm" onClick={() => handleSuggestionSelect(sug, 'initial', i)} className="text-xs h-auto py-1 px-2 text-left grow hover:bg-blue-100 font-medium">
                                                       {sug}
                                                   </Button>
                                                   <div className="flex flex-col gap-0.5">
                                                       <Button variant={suggestionFeedback[sug] === 'useful' ? 'default' : 'outline'} size="icon_xs" onClick={() => handleSuggestionFeedback(sug, true)} className={`h-5 w-5 ${suggestionFeedback[sug] === 'useful' ? 'bg-green-500 hover:bg-green-600' : 'hover:bg-green-100'}`}><ThumbsUp className="h-3 w-3" /></Button>
                                                       <Button variant={suggestionFeedback[sug] === 'not_useful' ? 'destructive' : 'outline'} size="icon_xs" onClick={() => handleSuggestionFeedback(sug, false)} className={`h-5 w-5 ${suggestionFeedback[sug] === 'not_useful' ? '' : 'hover:bg-red-100'}`}><ThumbsDown className="h-3 w-3" /></Button>
                                                   </div>
                                               </div>
                                               {activeSuggestionPath?.path === `initial-${i}` && activeSuggestionPath.followUps.length > 0 && (
                                                   <div className="mt-2 pt-2 pl-4 border-t border-blue-200 space-y-1">
                                                       <p className="text-xs font-medium mb-1 text-purple-600">{`Aprofundamento para '${sug}':`}</p>
                                                        <div className="flex flex-wrap gap-2 items-start">
                                                            {activeSuggestionPath.followUps.map((followUpSug, j) => (
                                                                <div key={`follow-${i}-${j}`} className="flex items-center gap-1 p-1 border rounded bg-purple-50 border-purple-200 text-xs">
                                                                    <Button variant="ghost" size="sm" onClick={() => handleSuggestionSelect(followUpSug, 'follow-up', j, `initial-${i}-${j}`)} className="h-auto py-1 px-2 text-left grow hover:bg-purple-100">
                                                                        {followUpSug}
                                                                    </Button>
                                                                    <div className="flex flex-col gap-0.5">
                                                                        <Button variant={suggestionFeedback[followUpSug] === 'useful' ? 'default' : 'outline'} size="icon_xs" onClick={() => handleSuggestionFeedback(followUpSug, true)} className={`h-5 w-5 ${suggestionFeedback[followUpSug] === 'useful' ? 'bg-green-500 hover:bg-green-600' : 'hover:bg-green-100'}`}><ThumbsUp className="h-3 w-3" /></Button>
                                                                        <Button variant={suggestionFeedback[followUpSug] === 'not_useful' ? 'destructive' : 'outline'} size="icon_xs" onClick={() => handleSuggestionFeedback(followUpSug, false)} className={`h-5 w-5 ${suggestionFeedback[followUpSug] === 'not_useful' ? '' : 'hover:bg-red-100'}`}><ThumbsDown className="h-3 w-3" /></Button>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                   </div>
                                               )}
                                               {activeSuggestionPath?.path === `initial-${i}` && activeSuggestionPath.followUps.length === 0 && (
                                                   <p className="mt-2 pt-2 pl-4 border-t border-blue-200 text-xs text-muted-foreground">Nenhum aprofundamento adicional sugerido para esta linha.</p>
                                               )}
                                          </div>
                                      ))}
                                  </div>
                               )}

                                {diagnosisSuggestions.length > 0 && (
                                    <div>
                                       <h4 className="text-sm font-medium text-gray-700 mb-2 mt-4">Hipóteses Diagnósticas Sugeridas:</h4>
                                       <div className="mt-4 space-y-3">
                                           {diagnosisSuggestions.map((diag, i) => (
                                               <div key={`diag-${i}`} className="flex items-center gap-1 p-1 border rounded bg-green-50 border-green-200">
                                                   <span className="text-xs font-medium px-2 grow">
                                                       {diag}
                                                   </span>
                                                   <div className="flex flex-col gap-0.5">
                                                        <Button variant={diagnosisFeedback[diag] === 'useful' ? 'default' : 'outline'} size="icon_xs" onClick={() => handleDiagnosisFeedback(diag, true)} className={`h-5 w-5 ${diagnosisFeedback[diag] === 'useful' ? 'bg-green-500 hover:bg-green-600' : 'hover:bg-green-100'}`}><ThumbsUp className="h-3 w-3" /></Button>
                                                        <Button variant={diagnosisFeedback[diag] === 'not_useful' ? 'destructive' : 'outline'} size="icon_xs" onClick={() => handleDiagnosisFeedback(diag, false)} className={`h-5 w-5 ${diagnosisFeedback[diag] === 'not_useful' ? '' : 'hover:bg-red-100'}`}><ThumbsDown className="h-3 w-3" /></Button>
                                                   </div>
                                               </div>
                                           ))}
                                       </div>
                                   </div>
                                )}
                           </div>
                        </div>

                        <Separator />

                        <div className="space-y-4">
                         <div>
                              <Label htmlFor="anamnesis">Anamnese / Queixa Principal</Label>
                              <Textarea id="anamnesis" value={anamnesisNotes} onChange={(e) => setAnamnesisNotes(e.target.value)} rows={4} placeholder="Descreva a queixa principal, histórico..."/>
                          </div>
                           <div>
                              <Label htmlFor="clinicalExam">Exame Clínico</Label>
                              <Textarea id="clinicalExam" value={clinicalExamNotes} onChange={(e) => setClinicalExamNotes(e.target.value)} rows={4} placeholder="Detalhes do exame físico..." />
                          </div>
                           <div>
                              <Label htmlFor="diagnosis">Suspeita / Diagnóstico(s)</Label>
                              <Textarea id="diagnosis" value={diagnosisNotes} onChange={(e) => setDiagnosisNotes(e.target.value)} rows={3} placeholder="Diagnósticos provisórios ou definitivos..." />
                          </div>
                           <div>
                              <Label htmlFor="treatment">Tratamento / Conduta</Label>
                              <Textarea id="treatment" value={treatmentNotes} onChange={(e) => setTreatmentNotes(e.target.value)} rows={4} placeholder="Medicações prescritas, recomendações, próximos passos..." />
                          </div>
                        </div>

                        <Separator />
                        <div>
                             <Label htmlFor="confirmedDiagnosis" className="text-base font-semibold">Diagnóstico Final Confirmado</Label>
                             <Textarea
                                  id="confirmedDiagnosis"
                                  value={confirmedDiagnosis}
                                  onChange={(e) => setConfirmedDiagnosis(e.target.value)}
                                  placeholder="Insira o(s) diagnóstico(s) confirmado(s) pelo veterinário... (Ex: Gastrite Aguda, Otite Externa Bilateral)"
                                  rows={2}
                                  className="mt-2"
                             />
                             <p className="text-xs text-muted-foreground mt-1">Esta informação é importante para treinar o assistente.</p>
                        </div>

                    </CardContent>
                 </Card>
                 {/* <<< BOTÃO MOVIDO PARA O FINAL DESTA COLUNA >>> */}
                 <div className="flex justify-end">
                     <Button 
                        variant="primary"
                        onClick={saveConsultationDataAndComplete} 
                        disabled={isSaving}
                        size="lg" // Botão maior para destaque
                     >
                        {isSaving ? <Loader2 className="h-5 w-5 mr-2 animate-spin"/> : <ClipboardList className="h-5 w-5 mr-2" />}
                        Salvar e Concluir Atendimento
                     </Button>
                  </div>
            </div>
        </div>

        <PrescriptionModal 
          isOpen={isPrescriptionModalOpen} 
          onClose={handleClosePrescriptionModal} 
          onSaveSuccess={handleSavePrescription} 
          initialItems={currentPrescriptionItems.length > 0 ? currentPrescriptionItems : undefined} 
          appointmentId={appointmentId} 
          petId={pet?.id} 
        />

        {/* Componente de Impressão (escondido VISUALMENTE, mas presente para @media print) */}
        <div className="print-container" style={{ display: 'none' }}> 
          {tenant && pet && customer && currentPrescriptionItems.length > 0 && (
            <PrintablePrescriptionContent 
              ref={printableComponentRef} 
              tenant={tenant} 
              pet={pet} 
              customer={customer} 
              items={currentPrescriptionItems} 
            />
          )}
        </div>

    </div>
  );
} 