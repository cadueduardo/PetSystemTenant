import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";
import { ChevronLeft, Loader2, Pencil, Filter, Eye, Sparkles, ShoppingCart, Stethoscope } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { createPageUrl } from "@/utils";
import { Pet, Customer, QueueService, Service, PurchaseHistory } from "@/api/entities";
import { useState, useEffect } from "react";
import PetForm from "@/components/pets/PetForm";
import PetBasicInfo from "@/components/pets/PetBasicInfo";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { parseISO, differenceInMinutes, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { collection, query, orderBy, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebaseConfig';
import { Separator } from "@/components/ui/separator";
import React from "react";

export default function DetalhesPet() {
  const navigate = useNavigate();
  const { id: petId } = useParams();
  const [pet, setPet] = useState(null);
  const [dono, setDono] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [isEditPetDialogOpen, setIsEditPetDialogOpen] = useState(false);
  const [historicoLiveVet, setHistoricoLiveVet] = useState([]);
  const [historicoPetshop, setHistoricoPetshop] = useState([]);
  const [historicoCompras, setHistoricoCompras] = useState([]);
  const [filtroAtivo, setFiltroAtivo] = useState("consultas");
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [selectedHistoryEpisode, setSelectedHistoryEpisode] = useState(null);
  const [isLoadingEpisodeDetails, setIsLoadingEpisodeDetails] = useState(false);
  
  // Obter parâmetros da URL
  const urlParams = new URLSearchParams(window.location.search);
  const storeParam = urlParams.get('store') || localStorage.getItem('current_tenant');
  
  // Carregar dados do pet e do dono
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
        const petshopQueueItems = await QueueService.list({ pet_id: petId, status: 'completed' });
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
      
      // <<< INÍCIO: Buscar Histórico Clínico (Episódios) >>>
      try {
        if (dadosPet.recordNumber && storeParam) { // Precisa do prontuário ID e tenant ID
          const prontuarioId = dadosPet.recordNumber;
          const tenantId = storeParam;
          const episodesPath = `tenants/${tenantId}/prontuarios/${prontuarioId}/episodes`;
          console.log(`[PetDetails] Buscando episódios em: ${episodesPath}`);
          
          const episodesQuery = query(
            collection(db, episodesPath),
            orderBy('createdAt', 'desc') // Ordenar por data de criação, mais recentes primeiro
          );
          
          const querySnapshot = await getDocs(episodesQuery);
          const episodesData = querySnapshot.docs.map(doc => ({
            id: doc.id,
            createdAt: doc.data().createdAt,
            data: doc.data().createdAt?.toDate ? format(doc.data().createdAt.toDate(), 'dd/MM/yyyy HH:mm', { locale: ptBR }) : 'Data inválida',
            motivo: doc.data().serviceName || doc.data().reason || 'Consulta Clínica',
            episodeNumber: doc.data().episodeNumber,
            diagnosticoResumo: doc.data().diagnosis || doc.data().fullInteraction?.vetNotes?.diagnosis || 'Não registrado',
            appointmentId: doc.data().appointmentId
          }));
          
          console.log("[PetDetails] Episódios clínicos encontrados:", episodesData);
          setHistoricoLiveVet(episodesData); // Salva no mesmo estado por enquanto
        } else {
          console.warn("[PetDetails] Prontuário (recordNumber) ou Tenant ID não encontrado. Não foi possível buscar histórico de episódios.");
          setHistoricoLiveVet([]);
        }
        } catch (error) {
        console.error("Erro ao carregar histórico de episódios clínicos:", error);
        setHistoricoLiveVet([]);
      }
      // <<< FIM: Buscar Histórico Clínico (Episódios) >>>
      
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

  useEffect(() => {
    carregarDados();
  }, [petId, storeParam, navigate]);

  const voltar = () => {
    if (dono?.id) {
      navigate(`/tenant/cliente/${dono.id}`);
    } else {
      console.warn("[PetDetails] Dono não encontrado, voltando para a lista de clientes.");
      navigate(createPageUrl(`Customers?store=${storeParam}`));
    }
  };

  const editar = () => {
    setIsEditPetDialogOpen(true);
  };

  const handlePetUpdateSuccess = () => {
    setIsEditPetDialogOpen(false);
      toast({
        title: "Sucesso",
        description: "Dados do pet atualizados com sucesso!"
      });
    carregarDados();
  };

  const mudarFiltro = (valor) => {
    setFiltroAtivo(valor);
  };

  const handleOpenHistoryModal = async (episodeSummary) => {
    console.log("[PetDetails] Abrindo detalhes para:", episodeSummary);
    setSelectedHistoryEpisode(episodeSummary);
    setIsHistoryModalOpen(true);
    setIsLoadingEpisodeDetails(true);

    try {
      const tenantId = storeParam;
      const prontuarioId = pet?.recordNumber;
      if (!tenantId || !prontuarioId) throw new Error("Tenant ID ou Prontuário ID não encontrados.");

      const episodeRef = doc(db, `tenants/${tenantId}/prontuarios/${prontuarioId}/episodes`, episodeSummary.id);
      const episodeSnap = await getDoc(episodeRef);

      if (episodeSnap.exists()) {
        const fullEpisodeData = { id: episodeSnap.id, ...episodeSnap.data() };
        console.log("[PetDetails] Detalhes completos do episódio carregados:", fullEpisodeData);
        setSelectedHistoryEpisode(fullEpisodeData);
      } else {
        throw new Error(`Episódio ${episodeSummary.id} não encontrado para detalhes.`);
      }
    } catch (error) {
      console.error("[PetDetails] Erro ao buscar detalhes do episódio:", error);
      toast({ title: "Erro", description: "Não foi possível carregar os detalhes completos deste episódio.", variant: "destructive" });
    } finally {
      setIsLoadingEpisodeDetails(false);
    }
  };

  const handleCloseHistoryModal = () => {
    setIsHistoryModalOpen(false);
    setSelectedHistoryEpisode(null);
    setIsLoadingEpisodeDetails(false);
  };

  // Função para renderizar conteúdo baseado no filtro
  const renderConteudoFiltrado = () => {
    switch (filtroAtivo) {
      case 'consultas': {
        return (
          <div>
            <h3 className="text-lg font-semibold mb-3 flex items-center"><Stethoscope className="h-5 w-5 mr-2" /> Histórico Clínico (Episódios)</h3>
            {historicoLiveVet.length > 0 ? (
              <ul className="space-y-3">
                {historicoLiveVet.map((ep, index) => (
                  <React.Fragment key={ep.id}>
                    <li className="border p-3 rounded-md bg-muted/20">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                          <p className="font-medium">
                            <span className="text-primary font-semibold">{ep.episodeNumber || `ID: ${ep.id}`}</span> - 
                            {ep.data}
                        </p>
                        <p className="text-sm text-gray-500">
                            Motivo: {ep.motivo}
                        </p>
                        <p className="text-sm text-gray-500">
                            Diagnóstico (Resumo): {ep.diagnosticoResumo}
                        </p>
                      </div>
                      <div className="text-right flex flex-col items-end">
                          <div className="flex gap-2 mt-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleOpenHistoryModal(ep)}
                            >
                              <Eye className="mr-1 h-3 w-3" /> Ver Detalhes
                            </Button>
                          </div>
                        </div>
                      </div>
                      {index < historicoLiveVet.length - 1 && <Separator className="my-3" />}
                  </li>
                  </React.Fragment>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground">Nenhum histórico clínico (episódio) encontrado.</p>
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
            </div>

      <div className="relative">
        <PetBasicInfo pet={pet} owner={dono} />
              <Button 
                variant="outline" 
          size="sm" 
          onClick={editar} 
          className="absolute top-4 right-4"
          disabled={pet?.is_inactive || carregando}
        >
          <Pencil className="mr-2 h-4 w-4" />
                Editar Pet
              </Button>
          </div>
          
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

      <Dialog open={isEditPetDialogOpen} onOpenChange={setIsEditPetDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Pet</DialogTitle>
            <DialogDescription>
              Atualize as informações de {pet?.name || 'este pet'}.
            </DialogDescription>
          </DialogHeader>
          <div className="overflow-y-auto pr-2">
            <PetForm
              pet={pet}
              onSuccess={handlePetUpdateSuccess}
              customerId={dono?.id}
            />
                      </div>
          <DialogFooter className="mt-4">
            <DialogClose asChild>
              <Button type="button" variant="outline">Cancelar</Button>
            </DialogClose>
            <Button type="submit" form="pet-form">Salvar Alterações</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isHistoryModalOpen} onOpenChange={handleCloseHistoryModal}>
        <DialogContent className="max-w-4xl w-[95%] max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Detalhes do Episódio {selectedHistoryEpisode?.episodeNumber ? `(${selectedHistoryEpisode.episodeNumber})` : `(ID: ${selectedHistoryEpisode?.id})`}</DialogTitle>
            <DialogDescription>
               Atendimento realizado em {selectedHistoryEpisode?.createdAt?.toDate ? format(selectedHistoryEpisode.createdAt.toDate(), 'dd/MM/yyyy HH:mm', { locale: ptBR }) : 'Data inválida'}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4 px-1 max-h-[calc(90vh-180px)] overflow-y-auto">
            {isLoadingEpisodeDetails ? (
               <div className="flex justify-center items-center py-10">
                 <Loader2 className="h-8 w-8 animate-spin text-primary" /> 
                 <p className="ml-3 text-muted-foreground">Carregando detalhes completos...</p>
              </div>
            ) : selectedHistoryEpisode ? (
                <>
                  <p><strong>Serviço/Motivo Principal:</strong> {selectedHistoryEpisode.serviceName || selectedHistoryEpisode.reason || 'N/A'}</p>
                  
                  <Separator />
                  <h4 className="font-semibold text-base pt-2">Resumo Clínico</h4>
                  <div className="space-y-2 pl-2">
                    <p><strong>Anamnese / Queixa Principal:</strong> {selectedHistoryEpisode.fullInteraction?.vetNotes?.anamnesis || selectedHistoryEpisode.anamnesis?.notes || 'N/A'}</p>
                    <p><strong>Exame Clínico:</strong> {selectedHistoryEpisode.fullInteraction?.vetNotes?.clinicalExam || selectedHistoryEpisode.clinicalExam || 'N/A'}</p>
                    <p><strong>Suspeita / Diagnóstico(s):</strong> {selectedHistoryEpisode.fullInteraction?.vetNotes?.diagnosis || selectedHistoryEpisode.diagnosis || 'N/A'}</p>
                    <p><strong>Tratamento / Conduta:</strong> {selectedHistoryEpisode.fullInteraction?.vetNotes?.treatment || selectedHistoryEpisode.treatment || 'N/A'}</p>
                    <p><strong>Diagnóstico Final Confirmado:</strong> {selectedHistoryEpisode.fullInteraction?.confirmedDiagnosis || 'Não confirmado'}</p>
                  </div>
                  
                  {(selectedHistoryEpisode.prescriptionItems && selectedHistoryEpisode.prescriptionItems.length > 0) && (
                    <>
                      <Separator />
                      <h4 className="font-semibold text-base pt-2">Prescrição</h4>
                      <ul className="list-disc space-y-1 pl-6 text-sm">
                        {selectedHistoryEpisode.prescriptionItems.map((item, index) => (
                          <li key={index}>
                            {item.itemName} ({item.details}) - Uso: {item.usage || 'N/A'}
                            {item.observations && <span className="block text-xs text-muted-foreground">Obs: {item.observations}</span>}
                          </li>
                        ))}
                      </ul>
                       {selectedHistoryEpisode.prescriptionObservations && (
                         <p className="text-sm mt-2 pl-2"><strong>Observações Gerais Prescrição:</strong> {selectedHistoryEpisode.prescriptionObservations}</p>
                       )}
                    </>
                  )}
                  
                  {(selectedHistoryEpisode.consumedItems && selectedHistoryEpisode.consumedItems.length > 0) && (
                    <>
                      <Separator />
                      <h4 className="font-semibold text-base pt-2">Itens Consumidos</h4>
                      <ul className="list-disc space-y-1 pl-6 text-sm">
                        {selectedHistoryEpisode.consumedItems.map((item, index) => (
                          <li key={index || item.id}> 
                            {item.quantity}x {item.name}
                          </li>
                        ))}
                      </ul>
                    </>
                  )}

                </>
              ) : (
                <p className="text-muted-foreground">Nenhum detalhe de episódio selecionado.</p>
              )}
          </div>
          <DialogFooter className="mt-4">
            <Button type="button" variant="outline" onClick={handleCloseHistoryModal}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}