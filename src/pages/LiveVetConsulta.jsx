import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Appointment, Pet, Customer, Consultation } from '@/api/entities';
import { toast } from '@/components/ui/use-toast';
import { differenceInMinutes } from 'date-fns';
import { createPageUrl } from "@/utils";
import { Button } from '@/components/ui/button';
import { FileText, Save, ClipboardList, Loader2, Printer, PillIcon, ArrowLeft } from 'lucide-react';

// --- Placeholder Functions ---
// Substitua por implementações reais ou remova se não forem necessárias
const generateConsultationReport = () => console.log("Placeholder: generateConsultationReport");
const handleOpenPrescriptionModal = () => console.log("Placeholder: handleOpenPrescriptionModal");

// <<<< FUNÇÃO handleSaveConsultation (Salvar Progresso) IMPLEMENTADA >>>>
const handleSaveConsultation = async (currentConsultationData, setIsSaving) => { 
  console.log("[handleSaveConsultation] Iniciando salvamento de progresso...");
  setIsSaving(true);
  try {
    // Apenas salva/atualiza os dados da consulta atual
    const savedData = await Consultation.upsert({
      ...currentConsultationData, // Usa os dados atuais do estado
      appointmentId: currentConsultationData.appointmentId, // Garante que o ID do agendamento está presente
      date: new Date().toISOString(), // Atualiza a data do salvamento da consulta
    });
    console.log("[handleSaveConsultation] Progresso salvo:", savedData);
    toast({ title: "Progresso Salvo", description: "Suas anotações foram salvas com sucesso." });
  } catch (error) {
    console.error("[handleSaveConsultation] Erro ao salvar progresso:", error);
    toast({ variant: "destructive", title: "Erro", description: `Não foi possível salvar o progresso: ${error.message}` });
  } finally {
    setIsSaving(false);
  }
};

export default function LiveVetConsulta() {
  const navigate = useNavigate();
  const { appointmentId } = useParams();

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [appointment, setAppointment] = useState(null);
  const [pet, setPet] = useState(null);
  const [customer, setCustomer] = useState(null);
  const [consultationData, setConsultationData] = useState(null);
  const [currentPrescriptionItems, setCurrentPrescriptionItems] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadData = async () => {
      if (!appointmentId) {
        setError("ID do agendamento não encontrado na URL.");
        setIsLoading(false);
        return;
      }
      console.log(`[useEffect Main] Iniciando busca de dados para appointmentId: ${appointmentId}...`);
      setIsLoading(true);
      setError('');
      try {
        const apptData = await Appointment.get(appointmentId);
        if (!apptData) throw new Error("Agendamento não encontrado.");
        console.log('[useEffect Main] Agendamento carregado:', apptData);
        setAppointment(apptData);
        
        const petData = apptData.pet_id ? await Pet.get(apptData.pet_id) : null;
        setPet(petData);
        
        const customerData = apptData.customer_id ? await Customer.get(apptData.customer_id) : null;
        setCustomer(customerData);
        
        await loadConsultationData(appointmentId);

      } catch (err) {
        console.error("[useEffect Main] Erro ao carregar dados iniciais:", err);
        setError(`Erro ao carregar dados: ${err.message}`);
        toast({ variant: "destructive", title: "Erro", description: "Não foi possível carregar os dados do atendimento." });
      } finally {
        setIsLoading(false);
        console.log('[useEffect Main] Busca de dados finalizada.');
      }
    };

    loadData();
  }, [appointmentId]);
  
  const loadConsultationData = async (apptId) => {
      console.log('[loadConsultationData] Carregando/criando dados da consulta...');
      try {
          let existingConsultation = await Consultation.filter({ appointmentId: apptId });
          if (existingConsultation && existingConsultation.length > 0) {
              console.log('[loadConsultationData] Consulta existente encontrada:', existingConsultation[0]);
              setConsultationData(existingConsultation[0]);
          } else {
              console.log('[loadConsultationData] Criando nova consulta mock...');
              const newConsultation = await Consultation.create({ 
                  appointmentId: apptId, 
                  pet_id: appointment?.pet_id,
                  tenant_id: appointment?.tenant_id,
                  history: "",
                  physical_exam: "",
                  diagnosis: "",
                  treatment: "",
                  recommendations: ""
              });
              console.log('[loadConsultationData] Nova consulta criada:', newConsultation);
              setConsultationData(newConsultation);
          }
      } catch (err) {
          console.error("[loadConsultationData] Erro:", err);
          setError(`Erro ao carregar/criar dados da consulta: ${err.message}`);
          setConsultationData(null); 
      }
  };

  // <<< FUNÇÃO handleCompleteConsultation ALTERADA PARA NAVEGAR PARA /live-vet >>>
  const handleCompleteConsultation = async (appointmentIdToComplete, consultationNotes) => {
    console.log("[handleCompleteConsultation] Iniciando conclusão para appointment:", appointmentIdToComplete);
    try {
      const appointmentToUpdate = await Appointment.get(appointmentIdToComplete);
      if (!appointmentToUpdate) {
        throw new Error("Agendamento original não encontrado para concluir.");
      }

      const startTime = appointmentToUpdate.start_time || appointmentToUpdate.date; // Usa start_time se existir, senão a data do agendamento
      const endTime = new Date();
      const duration = differenceInMinutes(endTime, new Date(startTime));

      const updateData = {
        status: 'completed',
        end_time: endTime.toISOString(),
        duration_minutes: duration,
        consultation_notes: consultationNotes // Adiciona notas se houver
      };

      console.log("[handleCompleteConsultation] Atualizando agendamento com:", updateData);
      await Appointment.update(appointmentIdToComplete, updateData);

      console.log("[handleCompleteConsultation] Agendamento concluído com sucesso.");
      
      // Navega para a fila de atendimento
      console.log("[handleCompleteConsultation] Navegando para LiveVetDashboard...");
      navigate(createPageUrl('/live-vet')); 

    } catch (error) {
      console.error("[handleCompleteConsultation] Erro ao concluir agendamento:", error);
      toast({ variant: "destructive", title: "Erro ao Concluir", description: `Não foi possível marcar o agendamento como concluído: ${error.message}` });
      // Não reseta isLoading aqui, pois saveConsultationDataAndComplete tem seu próprio finally
    }
  };
  
  // <<< FUNÇÃO saveConsultationDataAndComplete CHAMA handleCompleteConsultation >>>
  const saveConsultationDataAndComplete = async () => {
    console.log("[saveConsultationDataAndComplete] Iniciando...");
    setIsSaving(true);
    setError(''); // Limpa erros anteriores
    try {
       // 1. Salva/Atualiza os dados da consulta (anamnese, exame, etc.)
      console.log("[saveConsultationDataAndComplete] Salvando dados da consulta:", consultationData);
      const savedConsultation = await Consultation.upsert({
        ...consultationData,
        appointmentId: appointment.id, // Garante ID do agendamento
        date: new Date().toISOString(),
      });
      console.log("[saveConsultationDataAndComplete] Dados da consulta salvos:", savedConsultation);

      // Prepara um resumo das notas para salvar no agendamento (opcional)
      const summaryNotes = `Anamnese: ${consultationData.history?.substring(0,50)}... | Exame: ${consultationData.physical_exam?.substring(0,50)}... | Diag: ${consultationData.diagnosis?.substring(0,50)}... | Trat: ${consultationData.treatment?.substring(0,50)}...`;

      // 2. Chama a função para marcar o agendamento como concluído e navegar
      await handleCompleteConsultation(appointment.id, summaryNotes);

      // Toast de sucesso geral (opcional, pois handleCompleteConsultation pode já ter navegado)
      // toast({ title: "Sucesso", description: "Atendimento salvo e concluído!" });

    } catch (error) {
      console.error("[saveConsultationDataAndComplete] Erro geral:", error);
      toast({ variant: "destructive", title: "Erro", description: `Falha ao salvar/concluir: ${error.message}` });
    } finally {
      setIsSaving(false); // Garante que isSaving seja false no final
    }
  };

  const handleConsultationDataChange = (field, value) => {
      setConsultationData(prevData => {
          if (!prevData) return null;
          return { ...prevData, [field]: value };
      });
  };

  if (isLoading && !appointment) return <div>Carregando atendimento...</div>;
  if (error) return <div>Erro: {error}</div>;
  if (!appointment || !pet || !customer || !consultationData) return <div>Dados do atendimento incompletos.</div>;

  return (
    <div className="container mx-auto p-4">
      <div className="mb-4 border rounded p-4 bg-card text-card-foreground">
        <h1 className="text-xl font-semibold">Consulta de {pet.name}</h1>
        <p>Tutor: {customer.name}</p>
      </div>

      <div className="space-y-4">
        <div>
          <label htmlFor="history">Histórico/Anamnese</label>
          <textarea 
            id="history"
            value={consultationData.history || ''}
            onChange={(e) => handleConsultationDataChange('history', e.target.value)}
            className="w-full border rounded p-2" 
            rows={4}
            disabled={isLoading}
          />
        </div>
        <div>
          <label htmlFor="physical_exam">Exame Físico</label>
          <textarea 
            id="physical_exam"
            value={consultationData.physical_exam || ''}
            onChange={(e) => handleConsultationDataChange('physical_exam', e.target.value)}
            className="w-full border rounded p-2" 
            rows={4}
            disabled={isLoading}
          />
        </div>
      </div>

      <div className="mt-6 flex justify-end">
                     <div className="flex items-center gap-2">
                {/* Botão Gerar Relatório */}
                <Button variant="secondary" onClick={generateConsultationReport} disabled={isStreaming}>
                   <FileText className="h-4 w-4 mr-2" />
                   Gerar Relatório
                </Button>
                
                {/* Botão Salvar Progresso (Chama handleSaveConsultation) */}
                 <Button onClick={() => handleSaveConsultation(consultationData, setIsSaving)} disabled={isSaving || isStreaming}>
                    {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin"/> : <Save className="h-4 w-4 mr-2" />}
                    {isSaving ? 'Salvando...' : 'Salvar Progresso'}
                </Button>

                {/* Botão Prescrever */}
                <Button onClick={handleOpenPrescriptionModal} variant="outline">
                  <PillIcon className="mr-2 h-4 w-4" /> Prescrever
                </Button>

                {/* Botão Imprimir Prescrição */}
                {currentPrescriptionItems && currentPrescriptionItems.length > 0 && (
                   <Button onClick={() => setIsPrinting(true)} variant="outline">
                      <Printer className="h-4 w-4 mr-2" /> Imprimir Prescrição
                   </Button>
                 )}
            </div>
      </div>

      {/* <<< NOVO BOTÃO 'SALVAR E CONCLUIR' NO FINAL >>> */} 
      <div className="mt-8 flex justify-end">
         <Button 
            variant="primary" // Use a variante principal/destacada
            onClick={saveConsultationDataAndComplete} 
            disabled={isSaving} // Desabilita enquanto salva
          >
            {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin"/> : <ClipboardList className="h-4 w-4 mr-2" />}
            Salvar e Concluir Atendimento
         </Button>
      </div>
    </div>
  );
} 