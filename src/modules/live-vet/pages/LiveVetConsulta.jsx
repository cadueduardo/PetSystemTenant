import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Appointment, Pet, Customer, Service } from '@/api/entities'; // Entidades do mock principal
import { Consultation } from '@/modules/live-vet/entities'; // Entidade do mock LiveVet
import { DiagnosticAgent } from '@/lib/DiagnosticAgent'; // <<< IMPORTAR O AGENTE
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { toast } from '@/components/ui/use-toast';
import { ArrowLeft, Loader2, ClipboardList, Save, Bot, FileText, Mic, Square, ThumbsUp, ThumbsDown } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// URLs do NOVO serviço de áudio mock
const AUDIO_SERVICE_BASE_URL = 'http://localhost:8001';
const START_RECORDING_URL = `${AUDIO_SERVICE_BASE_URL}/start_recording`;
const END_RECORDING_URL = `${AUDIO_SERVICE_BASE_URL}/end_recording`;
const WEBSOCKET_URL_BASE = 'ws://localhost:8001/audio_stream'; // WebSocket URL

export default function LiveVetConsulta() {
  const { appointmentId } = useParams();
  const navigate = useNavigate();
  const [appointment, setAppointment] = useState(null);
  const [pet, setPet] = useState(null);
  const [customer, setCustomer] = useState(null);
  const [service, setService] = useState(null);
  const [consultationHistory, setConsultationHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const diagnosticAgentRef = useRef(new DiagnosticAgent()); // <<< INSTANCIAR O AGENTE

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

  // --- Estados para Sugestões e Diagnósticos (Revisados para Collapse) ---
  const [initialSuggestions, setInitialSuggestions] = useState([]);
  const [diagnosisSuggestions, setDiagnosisSuggestions] = useState([]);
  const [activeSuggestionPath, setActiveSuggestionPath] = useState(null);
  const [selectedSuggestionsHistory, setSelectedSuggestionsHistory] = useState([]);

  // --- Estados para Feedback e Correção (Inalterados) ---
  const [suggestionFeedback, setSuggestionFeedback] = useState({});
  const [diagnosisFeedback, setDiagnosisFeedback] = useState({});
  const [confirmedDiagnosis, setConfirmedDiagnosis] = useState('');
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);

  useEffect(() => {
    diagnosticAgentRef.current.clearContext();
    setSelectedSuggestionsHistory([]);
    setInitialSuggestions([]);
    setDiagnosisSuggestions([]);
    setActiveSuggestionPath(null);
    setSuggestionFeedback({});
    setDiagnosisFeedback({});
    setConfirmedDiagnosis('');
    const loadConsultationData = async () => {
      if (!appointmentId) {
        setError("ID do agendamento não fornecido.");
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      setError(null);
      setStreamingError(null);
      try {
        const apptData = await Appointment.get(appointmentId);
        setAppointment(apptData);

        const [petData, customerData, serviceData, historyData] = await Promise.all([
          Pet.get(apptData.pet_id).catch(err => { console.error("Erro ao buscar pet:", err); return null; }),
          Customer.get(apptData.customer_id).catch(err => { console.error("Erro ao buscar cliente:", err); return null; }),
          Service.get(apptData.service_id).catch(err => { console.error("Erro ao buscar serviço:", err); return null; }),
          Consultation.filter({ petId: apptData.pet_id, tenant_id: apptData.tenant_id }).catch(err => { console.error("Erro ao buscar histórico:", err); return []; })
        ]);

        if (!petData || !customerData || !serviceData) {
          throw new Error("Não foi possível carregar todos os dados necessários (pet, cliente ou serviço).");
        }

        setPet(petData);
        setCustomer(customerData);
        setService(serviceData);
        setConsultationHistory(historyData);

      } catch (err) {
        console.error("Erro detalhado ao carregar dados da consulta:", err);
        setError(`Erro ao carregar dados: ${err.message}`);
        toast({ title: "Erro", description: "Não foi possível carregar os dados da consulta.", variant: "destructive" });
      } finally {
        setIsLoading(false);
      }
    };

    loadConsultationData();

    return () => {
      if (webSocketRef.current) {
        console.log("Fechando WebSocket ao desmontar componente.");
        webSocketRef.current.close();
        webSocketRef.current = null;
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
          mediaRecorderRef.current.stop();
      }
      mediaRecorderRef.current = null;
    };
  }, [appointmentId]);

  const handleStartStreamingRecording = useCallback(async () => {
    if (isStreaming) return;

    console.log("Iniciando gravação e conexão WebSocket...");
    setStreamingError(null);
    setStreamingTranscript('');
    setInitialSuggestions([]);
    setDiagnosisSuggestions([]);
    setActiveSuggestionPath(null);
    setBackendReport(null);
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
  }, [isStreaming, sessionId]);

  const handleStopStreamingRecording = useCallback(async () => {
    if (!mediaRecorderRef.current || mediaRecorderRef.current.state !== 'recording') {
        console.log("Tentativa de parar, mas MediaRecorder não está gravando.");
        if (webSocketRef.current) {
            webSocketRef.current.close(1000, "Client stopping non-recording session");
            webSocketRef.current = null;
        }
        setIsStreaming(false);
        setSessionId(null);
        return;
    }

     console.log("Parando MediaRecorder e finalizando sessão:", sessionId);
     mediaRecorderRef.current.stop();

    setIsStreaming(false);

    if (webSocketRef.current) {
      webSocketRef.current.close(1000, "Client ending session");
      webSocketRef.current = null;
    } else {
        console.warn("Tentando parar sessão, mas WebSocket já estava fechado.");
    }

    if (!sessionId) {
        console.error("Não é possível finalizar a sessão: ID da sessão não encontrado.");
        setStreamingError("Erro interno: ID da sessão perdido.");
        return;
    }

    try {
      const response = await fetch(END_RECORDING_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: sessionId }),
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
        throw new Error(`Erro ao finalizar sessão: ${response.statusText} - ${detail}`);
      }

      const report = await response.json();
      console.log("Relatório final recebido:", report);
      setBackendReport(report);
      toast({ title: "Gravação Finalizada", description: "Relatório recebido do backend." });

      if (report?.final_transcript) {
          const finalTranscript = report.final_transcript;
          diagnosticAgentRef.current.clearContext();
          const finalAnalysis = diagnosticAgentRef.current.analyzeText(finalTranscript);
          setInitialSuggestions(finalAnalysis.initialQuestions);
          setDiagnosisSuggestions(finalAnalysis.potentialDiagnoses);
          setActiveSuggestionPath(null);
          setStreamingTranscript(finalTranscript);
      }

    } catch (err) {
      console.error("Erro ao finalizar gravação:", err);
      setStreamingError(`Falha ao finalizar: ${err.message}`);
      toast({ title: "Erro ao Finalizar", description: err.message, variant: "destructive" });
      setBackendReport(null);
    } finally {
       setSessionId(null);
       mediaRecorderRef.current = null;
       audioChunksRef.current = [];
    }
  }, [sessionId]);

  // --- Handler para Clique em Sugestão (Lógica de Collapse/Expand) ---
  const handleSuggestionSelect = async (suggestion) => {
    console.log("Sugestão/Pergunta selecionada:", suggestion);

    // Adiciona ao histórico de cliques (para log/RAG)
    if (!selectedSuggestionsHistory.includes(suggestion)) {
        setSelectedSuggestionsHistory(prev => [...prev, suggestion]);
    }

    // Verifica se está clicando na pergunta já ativa (para fechar/collapse)
    if (activeSuggestionPath?.originQuestion === suggestion) {
        setActiveSuggestionPath(null);
        return; // Sai da função
    }

    // Se clicou em uma nova pergunta, busca follow-ups
    toast({ title: "Processando...", description: `Buscando detalhes para: "${suggestion}"` });
    setIsLoadingSuggestions(true);
    setActiveSuggestionPath(null); // Fecha o anterior enquanto carrega o novo

    try {
        await new Promise(resolve => setTimeout(resolve, 400)); // Simula delay
        const followUps = await diagnosticAgentRef.current.getFollowUpQuestions(suggestion);

        // Define o novo path ativo
        setActiveSuggestionPath({ originQuestion: suggestion, followUps: followUps });

        // Busca diagnósticos baseados no contexto atualizado (incluindo a pergunta feita)
        await new Promise(resolve => setTimeout(resolve, 300)); // Simula delay
        const currentDiagnoses = await diagnosticAgentRef.current.suggestDiagnosesBasedOnContext();
        setDiagnosisSuggestions(currentDiagnoses);

    } catch (err) {
        console.error("Erro ao buscar follow-up/diagnóstico:", err);
        toast({ title: "Erro do Agente", description: "Não foi possível obter sugestões adicionais.", variant: "destructive" });
        setActiveSuggestionPath(null); // Limpa em caso de erro
    } finally {
        setIsLoadingSuggestions(false);
    }
  };

  // --- NOVOS HANDLERS PARA FEEDBACK ---
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

  const handleSaveConsultation = async () => {
      if (!appointment || !pet || !customer) {
          toast({ title: "Erro", description: "Dados essenciais faltando para salvar.", variant: "destructive" });
          return;
      }
      setIsSaving(true);
      try {
          const existingConsultations = await Consultation.filter({ appointmentId: appointment.id });
          const interactionDataForRAG = generateInteractionDataForRAG();

          const consultationData = {
              appointmentId: appointment.id,
              petId: pet.id,
              ownerId: customer.id,
              vetId: 'vet-default',
              date: new Date().toISOString(),
              reason: service?.name || appointment.notes || 'Consulta Clínica',
              anamnesis: { notes: anamnesisNotes },
              clinicalExam: clinicalExamNotes,
              diagnosis: diagnosisNotes,
              treatment: treatmentNotes,
              status: 'completed',
              tenant_id: appointment.tenant_id,
              fullInteraction: interactionDataForRAG
          };

          let savedConsultation;
          if (existingConsultations.length > 0) {
              savedConsultation = await Consultation.update(existingConsultations[0].id, consultationData);
              toast({ title: "Sucesso", description: "Consulta atualizada e finalizada." });
          } else {
              savedConsultation = await Consultation.create(consultationData);
              toast({ title: "Sucesso", description: "Consulta salva e finalizada." });
          }
          console.log("Consulta salva/atualizada com dados de interação:", savedConsultation);

      } catch (err) {
          console.error("Erro ao salvar consulta:", err);
          toast({ title: "Erro ao Salvar", description: `Não foi possível salvar a consulta: ${err.message}`, variant: "destructive"});
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
            suggestionFlow: selectedSuggestionsHistory.map(s => ({ question: s, feedback: suggestionFeedback[s] || 'none' })),
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
      await handleSaveConsultation();

      const report = generateInteractionDataForRAG();

      if (appointmentId) {
          console.log("Navegando para a página de relatório...");
          navigate(`/consulta/${appointmentId}/relatorio`);
      } else {
          console.error("Não é possível navegar: appointmentId não encontrado.");
          toast({ title: "Erro de Navegação", description: "ID do agendamento não encontrado.", variant: "destructive" });
      }
      return report;
  };

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
             <Button variant="outline" size="sm" onClick={() => navigate(-1)}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Voltar para Fila
             </Button>
             <h1 className="text-2xl font-bold text-center flex-1 mx-4">Consulta Clínica - {pet?.name}</h1>
             <div className="flex items-center gap-2">
                <Button variant="secondary" onClick={generateConsultationReport} disabled={isStreaming}>
                   <FileText className="h-4 w-4 mr-2" />
                   Gerar Relatório
                </Button>
                 <Button onClick={handleSaveConsultation} disabled={isSaving || isStreaming}>
                    {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin"/> : <Save className="h-4 w-4 mr-2" />}
                    {isSaving ? 'Salvando...' : 'Salvar Progresso'}
                </Button>
            </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1 space-y-6">
                <Card>
                    <CardHeader>
                        <CardTitle>Informações do Paciente</CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm space-y-2">
                        <p><strong>Nome:</strong> {pet.name}</p>
                        <p><strong>Espécie:</strong> {pet.species}</p>
                        <p><strong>Raça:</strong> {pet.breed}</p>
                        <p><strong>Sexo:</strong> {pet.gender || 'N/I'}</p>
                        <p><strong>Nascimento:</strong> {pet.birth_date ? format(parseISO(pet.birth_date), 'dd/MM/yyyy') : 'N/I'}</p>
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
                        <CardDescription>{consultationHistory.length} consulta(s) anterior(es)</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {consultationHistory.length === 0 ? (
                            <p className="text-sm text-muted-foreground">Nenhuma consulta anterior registrada.</p>
                        ) : (
                            <ul className="space-y-3 max-h-60 overflow-y-auto text-sm">
                                {consultationHistory.map(hist => (
                                    <li key={hist.id} className="border-b pb-2 last:border-b-0">
                                        <p><strong>Data:</strong> {format(parseISO(hist.date), 'dd/MM/yyyy HH:mm', { locale: ptBR })}</p>
                                        <p><strong>Motivo:</strong> {hist.reason}</p>
                                        {hist.diagnosis && <p><strong>Diagnóstico:</strong> {hist.diagnosis}</p>}
                                    </li>
                                ))}
                            </ul>
                        )}
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
                               {isLoadingSuggestions && (
                                   <div className="flex items-center text-sm text-muted-foreground"><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Carregando detalhes...</div>
                               )}

                               {!isLoadingSuggestions && initialSuggestions.length > 0 && (
                                   <div className="space-y-2">
                                      <p className="text-sm font-medium text-blue-600">Perguntas Iniciais Sugeridas:</p>
                                      {initialSuggestions.map((sug, i) => (
                                          <div key={`init-${i}`} className="border rounded border-blue-200 bg-blue-50/80 p-2">
                                               <div className="flex items-center gap-1">
                                                   <Button variant="ghost" size="sm" onClick={() => handleSuggestionSelect(sug)} className="text-xs h-auto py-1 px-2 text-left grow hover:bg-blue-100 font-medium">
                                                       {sug}
                                                   </Button>
                                                   <div className="flex flex-col gap-0.5">
                                                       <Button variant={suggestionFeedback[sug] === 'useful' ? 'default' : 'outline'} size="icon_xs" onClick={() => handleSuggestionFeedback(sug, true)} className={`h-5 w-5 ${suggestionFeedback[sug] === 'useful' ? 'bg-green-500 hover:bg-green-600' : 'hover:bg-green-100'}`}><ThumbsUp className="h-3 w-3" /></Button>
                                                       <Button variant={suggestionFeedback[sug] === 'not_useful' ? 'destructive' : 'outline'} size="icon_xs" onClick={() => handleSuggestionFeedback(sug, false)} className={`h-5 w-5 ${suggestionFeedback[sug] === 'not_useful' ? '' : 'hover:bg-red-100'}`}><ThumbsDown className="h-3 w-3" /></Button>
                                                   </div>
                                               </div>
                                               {/* Área de Follow-up (Colapsada) */}
                                               {activeSuggestionPath?.originQuestion === sug && activeSuggestionPath.followUps.length > 0 && (
                                                   <div className="mt-2 pt-2 pl-4 border-t border-blue-200 space-y-1">
                                                       <p className="text-xs font-medium mb-1 text-purple-600">{`Aprofundamento para '${sug}':`}</p>
                                                        <div className="flex flex-wrap gap-2 items-start">
                                                            {activeSuggestionPath.followUps.map((followUpSug, j) => (
                                                                <div key={`follow-${i}-${j}`} className="flex items-center gap-1 p-1 border rounded bg-purple-50 border-purple-200 text-xs">
                                                                    <Button variant="ghost" size="sm" onClick={() => handleSuggestionSelect(followUpSug)} className="h-auto py-1 px-2 text-left grow hover:bg-purple-100">
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
                                               {activeSuggestionPath?.originQuestion === sug && activeSuggestionPath.followUps.length === 0 && (
                                                   <p className="mt-2 pt-2 pl-4 border-t border-blue-200 text-xs text-muted-foreground">Nenhum aprofundamento adicional sugerido para esta linha.</p>
                                               )}
                                          </div>
                                      ))}
                                  </div>
                               )}

                                {!isLoadingSuggestions && diagnosisSuggestions.length > 0 && (
                                    <div>
                                       <p className="text-sm font-medium mb-2 text-green-600">Hipóteses Diagnósticas Sugeridas:</p>
                                       <div className="flex flex-wrap gap-2 items-start">
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

            </div>
        </div>
    </div>
  );
} 