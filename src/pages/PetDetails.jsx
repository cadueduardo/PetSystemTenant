import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";
import { ChevronLeft, Loader2, Pencil, Filter, Eye, FileText, Sparkles, ShoppingCart, Stethoscope } from "lucide-react";
import { createPageUrl } from "@/utils";
import { Pet, Customer, QueueService, Appointment, Consultation, Service, PurchaseHistory } from "@/api/entities";
import { useState, useEffect } from "react";
import PetForm from "@/components/pets/PetForm";
import PetBasicInfo from "@/components/pets/PetBasicInfo";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { parseISO, differenceInMinutes, format } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function DetalhesPet() {
  const navigate = useNavigate();
  const { id: petId } = useParams();
  const [pet, setPet] = useState(null);
  const [dono, setDono] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [mostrarFormularioEdicao, setMostrarFormularioEdicao] = useState(false);
  const [historicoPrescricoes, setHistoricoPrescricoes] = useState([]);
  const [historicoLiveVet, setHistoricoLiveVet] = useState([]);
  const [historicoPetshop, setHistoricoPetshop] = useState([]);
  const [historicoCompras, setHistoricoCompras] = useState([]);
  const [filtroAtivo, setFiltroAtivo] = useState("consultas");
  
  // Obter parâmetros da URL
  const urlParams = new URLSearchParams(window.location.search);
  const storeParam = urlParams.get('store') || localStorage.getItem('current_tenant');
  
  // Carregar dados do pet e do dono
  useEffect(() => {
    const carregarDados = async () => {
      if (!petId) {
        navigate(createPageUrl(`Customers?store=${storeParam}`));
        return;
      }
      
      setCarregando(true);
      try {
        // Carregar dados do pet
        const dadosPet = await Pet.get(petId);
        if (!dadosPet) {
          throw new Error("Pet não encontrado");
        }
        setPet(dadosPet);
        
        // Carregar dados do dono
        if (dadosPet.owner_id) {
          try {
            const dadosDono = await Customer.get(dadosPet.owner_id);
            setDono(dadosDono);
          } catch (error) {
            console.error("Erro ao carregar dados do dono:", error);
            toast({
              title: "Aviso",
              description: "Não foi possível carregar dados do dono.",
              variant: "warning"
            });
          }
        }
        
        // --- Buscar Histórico de Petshop (QueueService Concluídos) --- 
        try {
          const petshopQueueItems = await QueueService.filter({ pet_id: petId, status: 'completed' });
          const petshopHistory = await Promise.all(petshopQueueItems.map(async (item) => {
            let serviceName = 'Serviço Desconhecido';
            let servicePrice = null; // <<< Variavel para preço
            if (item.service_id) {
              try {
                const service = await Service.get(item.service_id);
                serviceName = service?.name || serviceName;
                servicePrice = service?.price; // <<< Pega o preço
              } catch (serviceError) {
                console.warn(`[PetDetails] Erro ao buscar serviço ${item.service_id} para item da fila ${item.id}:`, serviceError);
              }
            }
            let duration = 'N/A';
            if (item.start_time && item.end_time) {
              duration = differenceInMinutes(parseISO(item.end_time), parseISO(item.start_time));
            }
            // Inclui servicePrice no retorno
            return { ...item, serviceName, durationMinutes: duration, servicePrice }; 
          }));
          setHistoricoPetshop(petshopHistory);
        } catch (error) {
          console.error("Erro ao carregar histórico de Petshop:", error);
          setHistoricoPetshop([]);
        }
        // ---------------------------------------------------------------
        
        // Carregar histórico de prescrições (mock data por enquanto)
        try {
          // Aqui você implementaria a chamada real para buscar prescrições
          const prescricoes = [
            { id: 1, data: "2023-05-15", medicamento: "Antiparasitário", dose: "1 comprimido", frequencia: "Mensal", status: "Ativa" },
            { id: 2, data: "2023-07-22", medicamento: "Anti-inflamatório", dose: "1/2 comprimido", frequencia: "Diária", status: "Concluída" }
          ];
          setHistoricoPrescricoes(prescricoes);
        } catch (error) {
          console.error("Erro ao carregar histórico de prescrições:", error);
          setHistoricoPrescricoes([]);
        }
        
        // Carregar histórico de Live Vet (atendimentos concluídos)
        try {
          // Buscar todos os agendamentos do pet
          const agendamentos = await Appointment.filter({
            pet_id: petId,
            tenant_id: storeParam
          });
          
          // Filtrar apenas os agendamentos concluídos
          const agendamentosConcluidos = agendamentos.filter(appt => appt.status === 'completed');
          
          // Buscar dados adicionais para cada agendamento
          const atendimentosCompletos = await Promise.all(
            agendamentosConcluidos.map(async (appt) => {
              try {
                // Buscar dados do serviço
                const service = await Service.get(appt.service_id).catch(() => ({ name: 'Serviço não encontrado' }));
                
                // Buscar dados da consulta (se existir)
                const consultas = await Consultation.filter({ appointmentId: appt.id });
                const consulta = consultas.length > 0 ? consultas[0] : null;
                
                // Calcular duração
                let duracao = 'N/A';
                if (appt.start_time && appt.end_time) {
                  try {
                    const startDate = parseISO(appt.start_time);
                    const endDate = parseISO(appt.end_time);
                    const minutes = differenceInMinutes(endDate, startDate);
                    
                    if (!isNaN(minutes) && minutes >= 0) {
                      if (minutes < 60) {
                        duracao = `${minutes} min`;
                      } else {
                        const hours = Math.floor(minutes / 60);
                        const remainingMinutes = minutes % 60;
                        duracao = `${hours}h ${remainingMinutes > 0 ? `${remainingMinutes}min` : ''}`.trim();
                      }
                    }
                  } catch (e) {
                    console.error("Erro ao calcular duração:", e);
                  }
                }
                
                return {
                  id: appt.id,
                  data: appt.date,
                  veterinario: appt.vet_name || 'Veterinário não especificado',
                  motivo: appt.reason || service.name || 'Motivo não especificado',
                  duracao: duracao,
                  status: 'Concluída',
                  consulta: consulta
                };
              } catch (err) {
                console.error(`Erro ao processar agendamento ${appt.id}:`, err);
                return {
                  id: appt.id,
                  data: appt.date,
                  veterinario: 'Erro ao carregar',
                  motivo: 'Erro ao carregar',
                  duracao: 'N/A',
                  status: 'Concluída',
                  consulta: null
                };
              }
            })
          );
          
          // Ordenar por data (mais recente primeiro)
          atendimentosCompletos.sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());
          
          setHistoricoLiveVet(atendimentosCompletos);
        } catch (error) {
          console.error("Erro ao carregar histórico de Live Vet:", error);
          setHistoricoLiveVet([]);
        }
        
        // Buscar Histórico de Compras (Exemplo, ajuste conforme sua entidade)
        try {
          const purchaseHistoryData = await PurchaseHistory.filter({ pet_id: petId }); // Ajuste o filtro se necessário
          setHistoricoCompras(purchaseHistoryData);
        } catch (purchaseError) {
          console.warn("[PetDetails] Módulo de Histórico de Compras não encontrado ou erro ao buscar:", purchaseError);
          // Lidar com o erro ou definir como vazio se o módulo não existir
          setHistoricoCompras([]);
        }
        
      } catch (error) {
        console.error("Erro ao carregar dados:", error);
        toast({
          title: "Erro",
          description: "Não foi possível carregar os dados do pet.",
          variant: "destructive"
        });
      } finally {
        setCarregando(false);
      }
    };

    carregarDados();
  }, [petId, storeParam, navigate]);

  const voltar = () => {
    navigate(createPageUrl(`Customers?store=${storeParam}`));
  };

  const editar = () => {
    setMostrarFormularioEdicao(true);
  };

  const edicaoConcluida = (petAtualizado) => {
    setPet(petAtualizado);
    setMostrarFormularioEdicao(false);
    toast({
      title: "Sucesso",
      description: "Dados do pet atualizados com sucesso!"
    });
  };

  const mudarFiltro = (valor) => {
    setFiltroAtivo(valor);
  };

  // Função para ver o resumo da consulta
  const verResumoConsulta = (atendimento) => {
    if (!atendimento.consulta) {
      toast({
        title: "Info",
        description: "Não há resumo disponível para esta consulta.",
        variant: "info"
      });
      return;
    }
    
    // Navegar para a página de relatório
    navigate(`/tenant/live-vet/consulta/${atendimento.id}/relatorio`);
  };

  // Função para renderizar conteúdo baseado no filtro
  const renderConteudoFiltrado = () => {
    switch (filtroAtivo) {
      case 'consultas': {
        return (
          <div>
            <h3 className="text-lg font-semibold mb-3 flex items-center"><Stethoscope className="h-5 w-5 mr-2" /> Histórico de Consultas (Live Vet)</h3>
            {historicoLiveVet.length > 0 ? (
              <ul className="space-y-3">
                {historicoLiveVet.map(app => (
                  <li key={app.id} className="border p-3 rounded-md bg-muted/20">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h3 className="font-medium">Consulta com {app.veterinario}</h3>
                        <p className="text-sm text-gray-500">
                          Data: {new Date(app.data).toLocaleDateString("pt-BR")}
                        </p>
                        <p className="text-sm text-gray-500">
                          Motivo: {app.motivo}
                        </p>
                        <p className="text-sm text-gray-500">
                          Duração: {app.duracao}
                        </p>
                      </div>
                      <div className="text-right flex flex-col items-end">
                        <span className={`px-2 py-1 rounded-full text-xs mb-2 ${
                          app.status === "Concluída" ? "bg-green-100 text-green-800" :
                          app.status === "Cancelada" ? "bg-red-100 text-red-800" :
                          "bg-yellow-100 text-yellow-800"
                        }`}>
                          {app.status}
                        </span>
                        <div className="flex gap-2">
                          <Button 
                            variant="outline"
                            size="sm"
                            onClick={() => verResumoConsulta(app)}
                          >
                            <Eye className="mr-1 h-3 w-3" /> Ver Resumo
                          </Button>
                          {app.consulta?.fullInteraction && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => navigate(`/tenant/live-vet/consulta/${app.id}/relatorio`)}
                            >
                              <FileText className="mr-1 h-3 w-3" /> Relatório Completo
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground">Nenhum histórico de consulta Live Vet encontrado.</p>
            )}
          </div>
        );
      }

      case 'petshop': {
        // Ordena por data de fim, mais recentes primeiro (trata nulls)
        const historicoPetshopOrdenado = [...historicoPetshop].sort((a, b) => {
            const dateA = a.end_time ? new Date(a.end_time) : new Date(0);
            const dateB = b.end_time ? new Date(b.end_time) : new Date(0);
            return dateB - dateA; // Descendente
        });

        return (
           <div>
             <h3 className="text-lg font-semibold mb-3 flex items-center"><Sparkles className="h-5 w-5 mr-2" /> Histórico de Atendimentos Petshop</h3>
             {historicoPetshopOrdenado.length > 0 ? (
               <ul className="space-y-3">
                 {historicoPetshopOrdenado.map(item => (
                   <li key={item.id} className="border p-3 rounded-md bg-muted/20">
                     <p><strong>Data Conclusão:</strong> {item.end_time ? format(parseISO(item.end_time), 'dd/MM/yyyy HH:mm', { locale: ptBR }) : 'N/A'}</p>
                     <p><strong>Serviço:</strong> {item.serviceName}</p>
                     {/* Exibe Duração */}
                     <p><strong>Duração:</strong> {item.durationMinutes !== 'N/A' ? `${item.durationMinutes} min` : 'N/A'}</p>
                     {/* Exibe Preço */}
                     <p><strong>Valor:</strong> {item.servicePrice !== null ? `R$ ${item.servicePrice.toFixed(2)}` : 'N/A'}</p>
                     {item.notes && <p><strong>Observações:</strong> {item.notes}</p>}
                   </li>
                 ))}
               </ul>
             ) : (
               <p className="text-muted-foreground">Nenhum histórico de atendimento petshop encontrado.</p>
             )}
           </div>
        );
      }

      case 'compras': {
        return (
          <div>
            <h3 className="text-lg font-semibold mb-3 flex items-center"><ShoppingCart className="h-5 w-5 mr-2" /> Histórico de Compras</h3>
            {historicoCompras.length > 0 ? (
              <ul className="space-y-3">
                {historicoCompras.map(compra => (
                  <li key={compra.id} className="border p-3 rounded-md bg-muted/20">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-medium">Compra realizada em {new Date(compra.purchase_date).toLocaleDateString("pt-BR")}</h3>
                        <p className="text-sm text-gray-500">
                          Total: R$ {compra.total_amount?.toFixed(2) || "0.00"}
                        </p>
                      </div>
                      <div className="text-right">
                        {compra.items && compra.items.length > 0 && (
                          <div className="mt-2 pt-2 border-t text-sm">
                            <strong>Itens:</strong>
                            <ul>
                              {compra.items.map((item, index) => (
                                <li key={index}>- {item.quantity}x {item.product_name} (R$ {item.price?.toFixed(2)})</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground">Nenhum histórico de compras encontrado.</p>
            )}
          </div>
        );
      }

      default:
        return <p className="text-muted-foreground">Selecione um filtro para ver o histórico.</p>;
    }
  };

  if (carregando) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (!pet) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <h2 className="text-2xl font-bold mb-4">Pet não encontrado</h2>
        <Button onClick={voltar}>
          <ChevronLeft className="mr-2 h-4 w-4" />
          Voltar
        </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={voltar}>
          <ChevronLeft className="mr-2 h-4 w-4" />
          Voltar
        </Button>
        <Button onClick={editar}>
          <Pencil className="mr-2 h-4 w-4" />
          Editar
        </Button>
      </div>

      {mostrarFormularioEdicao ? (
        <PetForm
          pet={pet}
          onSuccess={edicaoConcluida}
          onCancel={() => setMostrarFormularioEdicao(false)}
        />
      ) : (
        <>
          <PetBasicInfo pet={pet} owner={dono} />
          
          <div className="flex items-center space-x-2 mb-4">
            <Filter className="h-4 w-4 text-gray-500" />
            <span className="text-sm font-medium">Filtrar por:</span>
            <Select value={filtroAtivo} onValueChange={mudarFiltro}>
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder="Filtrar histórico..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="consultas">
                  <span className="flex items-center"><Stethoscope className="h-4 w-4 mr-2" /> Consultas Live Vet</span>
                </SelectItem>
                <SelectItem value="petshop">
                   <span className="flex items-center"><Sparkles className="h-4 w-4 mr-2" /> Atendimentos Petshop</span>
                </SelectItem>
                <SelectItem value="compras">
                  <span className="flex items-center"><ShoppingCart className="h-4 w-4 mr-2" /> Histórico de Compras</span>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          {renderConteudoFiltrado()}
        </>
      )}
    </div>
  );
}