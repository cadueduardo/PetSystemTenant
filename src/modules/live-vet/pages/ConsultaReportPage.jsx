import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Consultation } from '@/modules/live-vet/entities'; // Ajuste o path se necessário
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Loader2, ArrowLeft, Download, ThumbsUp, ThumbsDown } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import jsPDF from 'jspdf';

export default function ConsultaReportPage() {
  const { appointmentId } = useParams();
  const navigate = useNavigate();
  const [reportData, setReportData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchReportData = async () => {
      if (!appointmentId) {
        setError("ID do agendamento não encontrado na URL.");
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      setError(null);
      try {
        // Assumindo que Consultation.filter retorna um array
        const consultations = await Consultation.filter({ appointmentId: appointmentId });
        if (!consultations || consultations.length === 0) {
          throw new Error("Nenhuma consulta encontrada com este ID ou consulta ainda não salva.");
        }
        const consultation = consultations[0]; // Pega a primeira (deve ser única por appointmentId)
        if (!consultation.fullInteraction) {
            throw new Error("Dados da interação IA (fullInteraction) não encontrados nesta consulta.");
        }
        setReportData(consultation.fullInteraction);
      } catch (err) {
        console.error("Erro ao buscar dados do relatório:", err);
        setError(`Erro ao carregar relatório: ${err.message}`);
      } finally {
        setIsLoading(false);
      }
    };

    fetchReportData();
  }, [appointmentId]);

  const handleExportPDF = () => {
    if (!reportData) return;

    const doc = new jsPDF();
    let y = 15; // Posição vertical inicial
    const pageHeight = doc.internal.pageSize.height;
    const margin = 15;
    const lineHeight = 7;
    const lineMaxWidth = doc.internal.pageSize.width - margin * 2;

    const addText = (text, options = {}) => {
        const { size = 10, style = 'normal', isTitle = false } = options;
        doc.setFontSize(size);
        doc.setFont('helvetica', style);
        const splitText = doc.splitTextToSize(text, lineMaxWidth);
        splitText.forEach(line => {
            if (y + lineHeight > pageHeight - margin) { // Verifica se cabe na página
                doc.addPage();
                y = margin;
            }
            doc.text(line, margin, y);
            y += lineHeight;
        });
        if (isTitle) y += lineHeight * 0.5; // Espaço extra após título
    };

    // --- Conteúdo do PDF ---
    addText('Relatório de Consulta Veterinária', { size: 18, style: 'bold', isTitle: true });
    addText(`Data Geração: ${reportData.reportGeneratedAt ? format(parseISO(reportData.reportGeneratedAt), 'dd/MM/yyyy HH:mm') : 'N/A'}`);
    addText(`ID Agendamento: ${reportData.appointmentId || 'N/A'}`);
    addText(`ID Sessão Áudio: ${reportData.sessionId || 'N/A'}`);
    y += lineHeight; // Espaço

    addText('Informações do Paciente', { size: 14, style: 'bold', isTitle: true });
    addText(`Nome: ${reportData.petInfo?.name || 'N/A'}`);
    addText(`Espécie: ${reportData.petInfo?.species || 'N/A'}`);
    addText(`Raça: ${reportData.petInfo?.breed || 'N/A'}`);
    y += lineHeight;

    addText('Informações do Cliente', { size: 14, style: 'bold', isTitle: true });
    addText(`Nome: ${reportData.customerInfo?.name || 'N/A'}`);
    y += lineHeight;

    addText('Detalhes do Atendimento', { size: 14, style: 'bold', isTitle: true });
    addText(`Serviço: ${reportData.serviceInfo?.name || 'N/A'}`);
    y += lineHeight;

    addText('Transcrição Completa', { size: 14, style: 'bold', isTitle: true });
    addText(reportData.fullTranscript || 'Nenhuma transcrição disponível.');
    y += lineHeight;

    addText('Anotações do Veterinário', { size: 14, style: 'bold', isTitle: true });
    addText(`Anamnese: ${reportData.vetNotes?.anamnesis || ''}`);
    addText(`Exame Clínico: ${reportData.vetNotes?.clinicalExam || ''}`);
    addText(`Diagnóstico(s): ${reportData.vetNotes?.diagnosis || ''}`);
    addText(`Tratamento: ${reportData.vetNotes?.treatment || ''}`);
    y += lineHeight;

    addText('Interação com Assistente IA', { size: 14, style: 'bold', isTitle: true });
    addText('Perguntas Selecionadas e Feedback:');
    if (reportData.suggestionFlow && reportData.suggestionFlow.length > 0) {
        reportData.suggestionFlow.forEach(item => {
            addText(`- ${item.question} (Feedback: ${item.feedback})`);
        });
    } else {
        addText('(Nenhuma pergunta selecionada)');
    }
    y += lineHeight * 0.5;

    addText('Feedback nas Hipóteses Diagnósticas:');
    const diagFeedbackEntries = Object.entries(reportData.diagnosisFeedbackLog || {});
    if (diagFeedbackEntries.length > 0) {
         diagFeedbackEntries.forEach(([diag, feedback]) => {
             addText(`- ${diag}: ${feedback}`);
         });
    } else {
         addText('(Nenhum feedback registrado)');
    }
    y += lineHeight;

    addText('Diagnóstico Final Confirmado', { size: 14, style: 'bold', isTitle: true });
    addText(reportData.confirmedDiagnosis || 'Não confirmado pelo veterinário.');
    y += lineHeight;

    addText('Metadados', { size: 12, style: 'bold', isTitle: true });
    addText(`Contagem Palavras Transcrição: ${reportData.metadata?.transcriptWordCount ?? 'N/A'}`);
    addText(`Duração Áudio (s): ${reportData.backendAudioReport?.duration_seconds ?? 'N/A'}`);
    addText(`Confiança Transcrição (Backend): ${reportData.backendAudioReport?.confidence_score ? reportData.backendAudioReport.confidence_score.toFixed(2) : 'N/A'}`);

    // --- Salvar PDF ---
    doc.save(`relatorio-consulta-${reportData.petInfo?.name || 'pet'}-${reportData.appointmentId || 'id'}.pdf`);
  };

  if (isLoading) {
    return <div className="flex items-center justify-center h-screen"><Loader2 className="h-16 w-16 animate-spin text-primary" /></div>;
  }

  if (error) {
    return (
      <div className="p-8 text-center">
        <h2 className="text-xl font-semibold text-destructive mb-4">Erro ao Carregar Relatório</h2>
        <p className="mb-4 text-destructive-foreground">{error}</p>
        <Button variant="outline" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Voltar
        </Button>
      </div>
    );
  }

  if (!reportData) {
     return (
        <div className="p-8 text-center">
            <h2 className="text-xl font-semibold text-muted-foreground mb-4">Relatório não encontrado</h2>
            <p className="mb-4">Os dados do relatório podem não estar disponíveis ou a consulta não foi salva corretamente.</p>
            <Button variant="outline" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Voltar
            </Button>
      </div>
     );
  }

  // Função auxiliar para renderizar feedback
  const renderFeedback = (log, itemKey) => {
      if (log && log[itemKey]) {
          return log[itemKey] === 'useful'
            ? <ThumbsUp className="h-4 w-4 text-green-600 ml-2" />
            : <ThumbsDown className="h-4 w-4 text-red-600 ml-2" />;
      }
      return null;
  };

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-4xl mx-auto bg-background">
      <div className="flex items-center justify-between mb-6">
        <Button variant="outline" size="sm" onClick={() => navigate(`/LiveVetConsulta/${appointmentId}`)}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar para Consulta
        </Button>
        <h1 className="text-2xl font-bold text-center flex-1 mx-4">Relatório da Consulta</h1>
        <Button onClick={handleExportPDF} size="sm">
          <Download className="h-4 w-4 mr-2" />
          Exportar PDF
        </Button>
      </div>

      <Card className="shadow-lg">
        <CardHeader className="bg-muted/30">
          <CardTitle>Consulta de {reportData.petInfo?.name || 'Paciente Desconhecido'}</CardTitle>
          <CardDescription>
            Agendamento: {reportData.appointmentId || 'N/A'} | Gerado em: {reportData.reportGeneratedAt ? format(parseISO(reportData.reportGeneratedAt), 'dd/MM/yyyy HH:mm') : 'N/A'}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6 space-y-6">

           {/* Informações Básicas */}
          <section>
            <h3 className="text-lg font-semibold mb-3 border-b pb-1">Informações Gerais</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 text-sm">
              <div><strong>Paciente:</strong> {reportData.petInfo?.name || '-'}</div>
              <div><strong>Cliente:</strong> {reportData.customerInfo?.name || '-'}</div>
              <div><strong>Espécie/Raça:</strong> {`${reportData.petInfo?.species || '-'} / ${reportData.petInfo?.breed || '-'}`}</div>
              <div><strong>Serviço:</strong> {reportData.serviceInfo?.name || '-'}</div>
              <div><strong>Sessão Áudio ID:</strong> {reportData.sessionId || '-'}</div>
            </div>
          </section>

          <Separator />

          {/* Transcrição */}
           <section>
              <h3 className="text-lg font-semibold mb-2">Transcrição Completa</h3>
              <p className="text-sm bg-gray-50 p-3 rounded border max-h-60 overflow-y-auto">{reportData.fullTranscript || '-'}</p>
           </section>

            <Separator />

           {/* Anotações Vet */}
          <section>
            <h3 className="text-lg font-semibold mb-3">Anotações do Veterinário</h3>
            <div className="space-y-2 text-sm">
              <div><strong className="block text-muted-foreground">Anamnese:</strong> <span className="pl-2 whitespace-pre-wrap">{reportData.vetNotes?.anamnesis || '-'}</span></div>
              <div><strong className="block text-muted-foreground">Exame Clínico:</strong> <span className="pl-2 whitespace-pre-wrap">{reportData.vetNotes?.clinicalExam || '-'}</span></div>
              <div><strong className="block text-muted-foreground">Diagnóstico(s) (Vet):</strong> <span className="pl-2 whitespace-pre-wrap">{reportData.vetNotes?.diagnosis || '-'}</span></div>
              <div><strong className="block text-muted-foreground">Tratamento:</strong> <span className="pl-2 whitespace-pre-wrap">{reportData.vetNotes?.treatment || '-'}</span></div>
            </div>
          </section>

           <Separator />

          {/* Interação IA */}
           <section>
            <h3 className="text-lg font-semibold mb-3">Interação com Assistente IA</h3>
            <div className="space-y-3 text-sm">
                <div>
                    <strong className="block text-muted-foreground mb-1">Perguntas Selecionadas pelo Vet:</strong>
                    {reportData.suggestionFlow && reportData.suggestionFlow.length > 0 ? (
                        <ul className="list-disc pl-5 space-y-1">
                        {reportData.suggestionFlow.map((item, index) => (
                            <li key={`flow-${index}`} className="flex items-center">
                                {item.question}
                                {renderFeedback(reportData.suggestionFeedbackLog, item.question)}
                           </li>
                        ))}
                        </ul>
                    ) : (
                        <p className="text-xs italic text-muted-foreground pl-2">Nenhuma pergunta do assistente foi selecionada.</p>
                    )}
                </div>
                 <div>
                    <strong className="block text-muted-foreground mb-1">Feedback nas Hipóteses Diagnósticas da IA:</strong>
                    {reportData.diagnosisFeedbackLog && Object.keys(reportData.diagnosisFeedbackLog).length > 0 ? (
                         <ul className="list-disc pl-5 space-y-1">
                            {Object.entries(reportData.diagnosisFeedbackLog).map(([diag, feedback]) => (
                                <li key={`diag-fb-${diag}`} className="flex items-center">
                                    {diag}: <span className="font-medium ml-1">{feedback === 'useful' ? 'Útil' : 'Não útil'}</span>
                                    {renderFeedback(reportData.diagnosisFeedbackLog, diag)}
                               </li>
                            ))}
                        </ul>
                    ) : (
                         <p className="text-xs italic text-muted-foreground pl-2">Nenhum feedback registrado.</p>
                    )}
                </div>
            </div>
          </section>

           <Separator />

          {/* Diagnóstico Final */}
          <section>
            <h3 className="text-lg font-semibold mb-2">Diagnóstico Final Confirmado</h3>
            <p className={`text-sm font-medium p-3 rounded border ${reportData.confirmedDiagnosis === 'Não confirmado' ? 'bg-yellow-50 border-yellow-200 text-yellow-800' : 'bg-green-50 border-green-200 text-green-800'}`}> {reportData.confirmedDiagnosis || 'Não confirmado pelo veterinário.'}</p>
          </section>

          {/* Metadados (Opcional) */}
            <Separator />
             <section>
                <details>
                    <summary className="text-sm font-medium text-muted-foreground cursor-pointer hover:text-primary">Metadados e Detalhes Técnicos</summary>
                    <div className="mt-2 text-xs bg-gray-50 p-3 rounded border space-y-1">
                        <p><strong>Contagem Palavras Transcrição:</strong> {reportData.metadata?.transcriptWordCount ?? '-'}</p>
                        <p><strong>Duração Áudio (s):</strong> {reportData.backendAudioReport?.duration_seconds ?? '-'}</p>
                        <p><strong>Confiança Transcrição (Backend):</strong> {reportData.backendAudioReport?.confidence_score ? reportData.backendAudioReport.confidence_score.toFixed(3) : '-'}</p>
                        {/* Adicionar mais metadados se necessário */}
                         <p><strong>Raw Backend Report:</strong></p>
                         <pre className="whitespace-pre-wrap break-all">{JSON.stringify(reportData.backendAudioReport, null, 2)}</pre>
                    </div>
                </details>
            </section>

        </CardContent>
      </Card>
    </div>
  );
} 