import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";
import { ChevronLeft, Loader2, Pencil, Filter, Eye, Sparkles, ShoppingCart, Stethoscope } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { createPageUrl } from "@/utils";
import { Pet, Customer, QueueService, Service, PurchaseHistory } from "@/api/entities";
import { useState, useEffect, useCallback } from "react";
import PetForm from "@/components/pets/PetForm";
import PetBasicInfo from "@/components/pets/PetBasicInfo";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { parseISO, differenceInMinutes, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { collection, query, orderBy, getDocs, doc, getDoc, limit, startAfter, getCountFromServer, where } from 'firebase/firestore';
import { db } from '@/lib/firebaseConfig';
import { Separator } from "@/components/ui/separator";
import React from "react";
import { useTenant } from "@/components/tenant/TenantContext";
import PaginationControls from "@/components/ui/PaginationControls";

export default function DetalhesPet() {
  const navigate = useNavigate();
  const { id: petId } = useParams();
  const { currentTenant, isLoading: isLoadingTenant, error: errorTenant } = useTenant();

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
  const [historyDetailsPrescriptionItems, setHistoryDetailsPrescriptionItems] = useState([]);
  const [isLoadingHistoryDetailsItems, setIsLoadingHistoryDetailsItems] = useState(false);
  const [historyDetailsItemsError, setHistoryDetailsItemsError] = useState(null);
  
  // Estados para paginação dos episódios clínicos (historicoLiveVet)
  const [episodesPageSize, setEpisodesPageSize] = useState(5); // Ex: 5 itens por página
  const [episodesCurrentPage, setEpisodesCurrentPage] = useState(1);
  const [episodesLastVisibleDoc, setEpisodesLastVisibleDoc] = useState(null);
  const [episodesFirstVisibleDoc, setEpisodesFirstVisibleDoc] = useState(null);
  const [totalEpisodes, setTotalEpisodes] = useState(0);
  const [isLoadingEpisodes, setIsLoadingEpisodes] = useState(false);

  const loadEpisodes = useCallback(async (direction = 'current', newPageSize = episodesPageSize) => {
    console.log(`[PetDetails loadEpisodes] Executing. Direction: ${direction}, Size: ${newPageSize}`); 
    if (!currentTenant?.id || !pet?.prontuarioId) { 
      console.warn("[PetDetails loadEpisodes] Prontuário (prontuarioId) ou Tenant ID não encontrados para buscar episódios.");
      setHistoricoLiveVet([]);
      setTotalEpisodes(0);
      setEpisodesCurrentPage(1);
      setEpisodesFirstVisibleDoc(null);
      setEpisodesLastVisibleDoc(null);
      setIsLoadingEpisodes(false); 
      return;
    }
    
    setIsLoadingEpisodes(true);
    const tenantId = currentTenant.id;
    const prontuarioId = pet.prontuarioId;
    const episodesPath = `tenants/${tenantId}/prontuarios/${prontuarioId}/episodes`;

    try {
      const episodesCollectionRef = collection(db, episodesPath);
      
      if (direction === 'current' || newPageSize !== episodesPageSize) {
        const countQuery = query(episodesCollectionRef);
        const snapshot = await getCountFromServer(countQuery);
        setTotalEpisodes(snapshot.data().count);
        if (direction === 'current') {
            setEpisodesCurrentPage(1);
            setEpisodesFirstVisibleDoc(null);
            setEpisodesLastVisibleDoc(null);
        }
      }

      let q = query(episodesCollectionRef, orderBy('createdAt', 'desc'));

      if (direction === 'next' && episodesLastVisibleDoc) {
        q = query(q, startAfter(episodesLastVisibleDoc), limit(newPageSize));
      } else if (direction === 'prev' && episodesFirstVisibleDoc) {
         q = query(q, limit(newPageSize));
         setEpisodesCurrentPage(1);
         setEpisodesFirstVisibleDoc(null);
         setEpisodesLastVisibleDoc(null);
      } else {
        q = query(q, limit(newPageSize));
      }
      
      const documentSnapshots = await getDocs(q);
      const episodesData = documentSnapshots.docs.map(doc => ({
        id: doc.id,
        createdAt: doc.data().createdAt,
        data: doc.data().createdAt?.toDate ? format(doc.data().createdAt.toDate(), 'dd/MM/yyyy HH:mm', { locale: ptBR }) : 'Data inválida',
        motivo: doc.data().serviceName || doc.data().reason || 'Consulta Clínica',
        episodeNumber: doc.data().episodeNumber,
        diagnosticoResumo: doc.data().diagnosis || doc.data().fullInteraction?.vetNotes?.diagnosis || 'Não registrado',
        appointmentId: doc.data().appointmentId
      }));

      setHistoricoLiveVet(episodesData);
      
      const newLastVisible = documentSnapshots.docs[documentSnapshots.docs.length - 1];
      const newFirstVisible = documentSnapshots.docs[0];
      setEpisodesLastVisibleDoc(newLastVisible || null);
      setEpisodesFirstVisibleDoc(newFirstVisible || null);

      if (direction === 'next') setEpisodesCurrentPage(prev => prev + 1);
      else if (direction === 'current') setEpisodesCurrentPage(1);

      if (newPageSize !== episodesPageSize) setEpisodesPageSize(newPageSize);

    } catch (error) {
      console.error("[PetDetails] Erro ao carregar episódios clínicos paginados:", error);
      toast({ title: "Erro", description: "Não foi possível carregar o histórico clínico.", variant: "destructive" });
      setHistoricoLiveVet([]);
    } finally {
      setIsLoadingEpisodes(false);
    }
  }, [currentTenant, pet, episodesPageSize, episodesFirstVisibleDoc, episodesLastVisibleDoc]);
  
  useEffect(() => {
    console.log(`[PetDetails useEffect for Episodes] Checking conditions. Pet: ${!!pet}, Pet Prontuario ID: ${pet?.prontuarioId}, Tenant: ${!!currentTenant}, Tenant ID: ${currentTenant?.id}`);
    if (pet && pet.prontuarioId && currentTenant && currentTenant.id) {
      console.log(`[PetDetails useEffect for Episodes] Conditions MET. Calling loadEpisodes.`);
      loadEpisodes('current', episodesPageSize);
    } else {
       console.log(`[PetDetails useEffect for Episodes] Conditions NOT MET.`);
       if(pet && !pet.prontuarioId) {
           console.log("[PetDetails useEffect for Episodes] Pet object exists but missing prontuarioId:", pet);
       }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps 
  }, [pet, currentTenant, episodesPageSize]);

  const handleEpisodesPageChange = (direction) => {
    loadEpisodes(direction, episodesPageSize);
  };

  const handleEpisodesPageSizeChange = (newPageSize) => {
    loadEpisodes('current', newPageSize); 
  };

  const carregarDados = async () => {
    if (!currentTenant || !currentTenant.id) {
      console.log("[PetDetails] Aguardando currentTenant do contexto (em carregarDados).");
      if (!isLoadingTenant && !errorTenant && !currentTenant) {
        toast({ title: "Erro", description: "Loja não identificada. Verifique seu acesso.", variant: "destructive" });
        navigate('/tenant/dashboard');
      }
      if (!carregando) setCarregando(true);
      return;
    }
    
    const tenantId = currentTenant.id;

      if (!petId) {
      navigate(createPageUrl(`Customers?store=${tenantId}`));
        return;
      }
      
    setCarregando(true);
      try {
      // Carrega Pet
      const dadosPet = await Pet.get(petId);
      if (!dadosPet) {
          throw new Error("Pet não encontrado");
        }
      setPet(dadosPet);
        
      // Carrega Dono
      if (dadosPet.owner_id) {
          try {
          const dadosDono = await Customer.get(dadosPet.owner_id);
          setDono(dadosDono);
          } catch (error) {
            console.error("Erro ao carregar dados do dono:", error);
          toast({ title: "Aviso", description: "Não foi possível carregar dados do dono.", variant: "warning" });
          }
        }
        
      // Carrega Histórico Petshop
      try {
        const petshopQueueItems = await QueueService.list({ pet_id: petId, status: 'completed', tenant_id: tenantId });
        const petshopHistory = await Promise.all(petshopQueueItems.map(async (item) => {
          let serviceName = 'Serviço Desconhecido';
          let servicePrice = null;
          if (item.service_id) {
            try {
              const service = await Service.get(item.service_id, tenantId); 
              serviceName = service?.name || serviceName;
              servicePrice = service?.price;
            } catch (serviceError) {
              console.warn(`[PetDetails] Erro ao buscar serviço ${item.service_id}:`, serviceError);
            }
          }
          let duration = 'N/A';
          if (item.start_time && item.end_time) {
            duration = differenceInMinutes(parseISO(item.end_time), parseISO(item.start_time));
          }
          return { ...item, serviceName, durationMinutes: duration, servicePrice }; 
        }));
        setHistoricoPetshop(petshopHistory);
        } catch (error) {
        console.error("Erro ao carregar histórico de Petshop:", error);
        setHistoricoPetshop([]);
      }
      
      // Carrega Histórico Compras
      try {
        const purchaseHistoryData = await PurchaseHistory.filter({ pet_id: petId, tenant_id: tenantId });
        setHistoricoCompras(purchaseHistoryData);
      } catch (purchaseError) {
        console.warn("[PetDetails] Módulo de Histórico de Compras não encontrado ou erro:", purchaseError);
        setHistoricoCompras([]);
        }
        
      } catch (error) {
      console.error("Erro ao carregar dados do pet:", error);
      toast({ title: "Erro", description: `Não foi possível carregar os dados do pet: ${error.message}`, variant: "destructive" });
      // Garante que estados sejam limpos em caso de erro ao carregar pet
      setPet(null);
      setDono(null);
      setHistoricoPetshop([]);
      setHistoricoCompras([]);
      } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    if (isLoadingTenant) {
      console.log("[PetDetails useEffect] Aguardando TenantContext carregar...");
      if (!carregando) setCarregando(true);
      return;
    }

    if (errorTenant) {
      console.error("[PetDetails useEffect] Erro no TenantContext:", errorTenant);
      toast({ title: "Erro de Acesso", description: `Não foi possível carregar informações da loja: ${errorTenant}`, variant: "destructive" });
      setCarregando(false);
      return;
    }

    if (!currentTenant) {
        console.warn("[PetDetails useEffect] Tenant não disponível após carregamento do contexto.");
        if (carregando) setCarregando(false);
    }
    
    if (currentTenant && currentTenant.id && petId) {
    carregarDados();
    } else if (!petId) {
        navigate('/tenant/dashboard');
        setCarregando(false);
    }
  }, [petId, navigate, currentTenant, isLoadingTenant, errorTenant]);

  const voltar = () => {
    if (dono?.id && currentTenant?.id) {
      navigate(`/tenant/cliente/${dono.id}`);
    } else {
      console.warn("[PetDetails] Dono ou Tenant não encontrado, voltando para a lista de clientes.");
      if (currentTenant?.id) {
        navigate(createPageUrl(`Customers?store=${currentTenant.id}`));
      } else {
        navigate('/tenant/dashboard');
      }
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
    if (!episodeSummary || !episodeSummary.id) {
      toast({ title: "Erro", description: "Dados inválidos para abrir detalhes.", variant: "destructive" });
      return;
    }

    setSelectedHistoryEpisode(episodeSummary);
    setIsHistoryModalOpen(true);
    setIsLoadingEpisodeDetails(true);
    setIsLoadingHistoryDetailsItems(true);
    setHistoryDetailsPrescriptionItems([]);
    setHistoryDetailsItemsError(null);

    let fullEpisodeData = null;
    const tenantId = currentTenant?.id;

    try {
      if (!tenantId || !pet?.prontuarioId) throw new Error("Tenant ID ou Prontuário ID não encontrados para buscar detalhes do episódio.");

      const episodeRef = doc(db, `tenants/${tenantId}/prontuarios/${pet.prontuarioId}/episodes`, episodeSummary.id);
      const episodeSnap = await getDoc(episodeRef);

      if (episodeSnap.exists()) {
        fullEpisodeData = { id: episodeSnap.id, ...episodeSnap.data() };
        setSelectedHistoryEpisode(fullEpisodeData);
      } else {
        throw new Error(`Episódio ${episodeSummary.id} não encontrado para detalhes.`);
      }
    } catch (error) {
      console.error("[PetDetails] Erro ao buscar detalhes do episódio:", error);
      toast({ title: "Erro", description: "Não foi possível carregar os detalhes completos deste episódio.", variant: "destructive" });
      setIsLoadingEpisodeDetails(false);
      setIsLoadingHistoryDetailsItems(false);
      setHistoryDetailsItemsError("Falha ao carregar dados do episódio.");
      return;
    } finally {
      setIsLoadingEpisodeDetails(false);
    }

    if (fullEpisodeData && fullEpisodeData.id) {
      try {
        const episodeAppointmentId = fullEpisodeData.appointmentId;

        if (!tenantId || !episodeAppointmentId) {
          console.error("[PetDetails] Tenant ID ou Episode's appointmentId ausentes. Episode ID:", episodeSummary.id, "Episode Appointment ID:", episodeAppointmentId);
          setHistoryDetailsItemsError("Dados incompletos (ID do agendamento do episódio) para buscar itens da prescrição.");
          setIsLoadingHistoryDetailsItems(false);
          return;
        }

        // Passo 1: Query para encontrar o documento de consulta pelo appointmentId do episódio
        const consultationsRef = collection(db, "consultations");
        // ASSUMINDO que o documento em 'consultations' tem um campo 'appointmentId' no nível raiz E um 'tenant_id'
        const q = query(consultationsRef, 
                        where("appointmentId", "==", episodeAppointmentId),
                        where("tenant_id", "==", tenantId), // Crucial para segurança e para a regra funcionar
                        limit(1));
        
        console.log(`[PetDetails] Querying 'consultations' for appointmentId: ${episodeAppointmentId} and tenantId: ${tenantId}`);
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
          console.warn(`[PetDetails] Nenhum documento encontrado em 'consultations' para appointmentId: ${episodeAppointmentId} e tenantId: ${tenantId}`);
          setHistoryDetailsItemsError("Documento da consulta não encontrado para este episódio.");
          setHistoryDetailsPrescriptionItems([]);
          setIsLoadingHistoryDetailsItems(false);
          return;
        }

        // Assumimos que há apenas um resultado devido ao episodeAppointmentId + tenantId ser teoricamente único
        const consultationDoc = querySnapshot.docs[0];
        const actualConsultationDocId = consultationDoc.id;
        console.log(`[PetDetails] Encontrado documento de consulta: ${actualConsultationDocId} com dados:`, consultationDoc.data());
        
        // Passo 2: Usar o ID do documento de consulta encontrado para buscar os itens da prescrição
        const itemsPath = `consultations/${actualConsultationDocId}/consultation_prescription_items`;
        console.log("[PetDetails] Path final para itens da prescrição:", itemsPath);
        const itemsCollectionRef = collection(db, itemsPath);
        
        const itemsQuery = query(itemsCollectionRef, orderBy("order", "asc"));
        const itemsSnapshot = await getDocs(itemsQuery);
        const fetchedItems = itemsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setHistoryDetailsPrescriptionItems(fetchedItems);

      } catch (itemsError) {
        console.error(`[PetDetails] Erro ao buscar itens da prescrição do histórico (${fullEpisodeData.id}):`, itemsError);
        setHistoryDetailsItemsError("Falha ao carregar itens da prescrição.");
      } finally {
        setIsLoadingHistoryDetailsItems(false);
      }
    } else {
      setIsLoadingHistoryDetailsItems(false);
      setHistoryDetailsItemsError("ID do episódio não encontrado para buscar itens.");
    }
  };

  const handleCloseHistoryModal = () => {
    setIsHistoryModalOpen(false);
    setSelectedHistoryEpisode(null);
    setIsLoadingEpisodeDetails(false);
    setHistoryDetailsPrescriptionItems([]);
    setIsLoadingHistoryDetailsItems(false);
    setHistoryDetailsItemsError(null);
  };

  const renderConteudoFiltrado = () => {
    switch (filtroAtivo) {
      case 'consultas': {
        return (
          <div>
            <h3 className="text-lg font-semibold mb-3 flex items-center"><Stethoscope className="h-5 w-5 mr-2" /> Histórico Clínico (Episódios)</h3>
            {isLoadingEpisodes && historicoLiveVet.length === 0 ? (
              <div className="flex justify-center items-center py-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
            ) : totalEpisodes > 0 ? (
              <>
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
                  <p className="text-muted-foreground py-4 text-center">Nenhum episódio encontrado para esta página.</p>
                )}
                <PaginationControls
                  currentPage={episodesCurrentPage}
                  pageSize={episodesPageSize}
                  hasNextPage={episodesLastVisibleDoc !== null && historicoLiveVet.length === episodesPageSize && (episodesCurrentPage * episodesPageSize < totalEpisodes)}
                  hasPreviousPage={episodesCurrentPage > 1}
                  itemCountOnPage={historicoLiveVet.length}
                  totalItems={totalEpisodes}
                  onPageChange={handleEpisodesPageChange}
                  onPageSizeChange={handleEpisodesPageSizeChange}
                  isLoading={isLoadingEpisodes}
                />
              </>
            ) : (
              <p className="text-muted-foreground py-4 text-center">Nenhum histórico clínico (episódio) encontrado para este pet.</p>
            )}
          </div>
        );
      }

      case 'petshop': {
        const historicoPetshopOrdenado = [...historicoPetshop].sort((a, b) => {
            const dateA = a.end_time ? new Date(a.end_time) : new Date(0);
            const dateB = b.end_time ? new Date(b.end_time) : new Date(0);
            return dateB - dateA;
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
                     <p><strong>Duração:</strong> {item.durationMinutes !== 'N/A' ? `${item.durationMinutes} min` : 'N/A'}</p>
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

  if (isLoadingTenant || (carregando && !errorTenant && !currentTenant)) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        <p className="ml-2">Carregando dados da loja e do pet...</p>
      </div>
    );
  }
  
  if (errorTenant) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen text-center">
        <h2 className="text-2xl font-bold mb-2 text-destructive">Erro ao Carregar Loja</h2>
        <p className="mb-4">{errorTenant}</p>
        <Button onClick={() => navigate('/')}>Voltar para Início</Button>
      </div>
    );
  }

  if (!currentTenant) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen text-center">
        <h2 className="text-2xl font-bold mb-2">Loja não Identificada</h2>
        <p className="mb-4">Não foi possível identificar a loja. Por favor, tente acessar novamente ou contate o suporte.</p>
        <Button onClick={() => navigate('/')}>Voltar para Início</Button>
      </div>
    );
  }

  if (carregando) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
         <p className="ml-2">Carregando dados do pet...</p>
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
          disabled={pet?.is_inactive || carregando || isLoadingTenant}
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
            <DialogTitle>Detalhes do Histórico {selectedHistoryEpisode?.episodeNumber ? `(${selectedHistoryEpisode.episodeNumber})` : selectedHistoryEpisode?.id ? `(ID: ${selectedHistoryEpisode.id})` : ''}</DialogTitle>
            <DialogDescription>
              {isLoadingEpisodeDetails
                ? "Carregando detalhes..."
                : selectedHistoryEpisode?.createdAt?.toDate
                  ? `Realizado em ${format(selectedHistoryEpisode.createdAt.toDate(), 'dd/MM/yyyy HH:mm', { locale: ptBR })}`
                  : 'Data inválida'
              }
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4 px-1 max-h-[calc(90vh-180px)] overflow-y-auto">
            {isLoadingEpisodeDetails ? (
              <div className="flex items-center justify-center h-32">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : selectedHistoryEpisode && !historyDetailsItemsError?.includes("Falha ao carregar dados do episódio") ? ( 
              <>
                {selectedHistoryEpisode.type === 'petshop' ? (
                    <p><strong>Tipo:</strong> Atendimento Petshop</p>
                ) : (
                    <p><strong>Tipo:</strong> Atendimento Clínico</p>
                )}

                <p><strong>Serviço/Motivo Principal:</strong> {selectedHistoryEpisode.serviceName || selectedHistoryEpisode.reason || 'N/A'}</p>

                {selectedHistoryEpisode.type === 'petshop' && (
                    <>
                      <p><strong>Profissional:</strong> {selectedHistoryEpisode.professionalName || 'N/A'}</p>
                      <p><strong>Duração:</strong> {selectedHistoryEpisode.durationMinutes !== 'N/A' ? `${selectedHistoryEpisode.durationMinutes} min` : 'N/A'}</p>
                      <p><strong>Preço do Serviço:</strong> {selectedHistoryEpisode.servicePrice !== null ? `R$ ${selectedHistoryEpisode.servicePrice.toFixed(2)}` : 'N/A'}</p>
                      {selectedHistoryEpisode.observations && <p><strong>Observações:</strong> {selectedHistoryEpisode.observations}</p>}
                    </>
                )}

                {selectedHistoryEpisode.type !== 'petshop' && (
                  <>
                    <Separator />
                    <h4 className="font-semibold text-base pt-2">Resumo Clínico</h4>
                    <div className="space-y-2 pl-2">
                      <p><strong>Anamnese / Queixa Principal:</strong> {selectedHistoryEpisode.fullInteraction?.vetNotes?.anamnesis || selectedHistoryEpisode.anamnesis?.notes || 'N/A'}</p>
                      <p><strong>Exame Clínico:</strong> {selectedHistoryEpisode.fullInteraction?.vetNotes?.clinicalExam || selectedHistoryEpisode.clinicalExam || 'N/A'}</p>
                      <p><strong>Suspeita / Diagnóstico(s):</strong> {selectedHistoryEpisode.fullInteraction?.vetNotes?.diagnosis || selectedHistoryEpisode.diagnosis || 'N/A'}</p>
                      <p><strong>Tratamento / Conduta:</strong> {selectedHistoryEpisode.fullInteraction?.vetNotes?.treatment || selectedHistoryEpisode.treatment || 'N/A'}</p>
                      <p><strong>Diagnóstico Final Confirmado:</strong> {selectedHistoryEpisode.fullInteraction?.confirmedDiagnosis || 'Não confirmado'}</p>
                    </div>

                    <Separator />
                    <h4 className="font-semibold text-base pt-2">Prescrição</h4>
                    {isLoadingHistoryDetailsItems ? (
                      <div className="flex items-center justify-center p-4">
                        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                        <p className="ml-2 text-sm text-muted-foreground">Carregando itens da prescrição...</p>
                      </div>
                    ) : historyDetailsItemsError && !historyDetailsItemsError.includes("Falha ao carregar dados do episódio") ? ( 
                      <p className="text-sm text-destructive pl-2">{historyDetailsItemsError}</p>
                    ) : historyDetailsPrescriptionItems.length > 0 ? (
                      <>
                        <ul className="list-disc space-y-1 pl-6 text-sm">
                          {historyDetailsPrescriptionItems.map((item) => (
                            <li key={item.id}>
                              {item.itemName} ({item.details}) - Uso: {item.usage || 'N/A'}
                              {item.notes && <span className="block text-xs text-muted-foreground">Obs: {item.notes}</span>}
                            </li>
                          ))}
                        </ul>
                        {selectedHistoryEpisode.prescriptionObservations && (
                          <p className="text-sm mt-2 pl-2"><strong>Observações Gerais Prescrição:</strong> {selectedHistoryEpisode.prescriptionObservations}</p>
                        )}
                      </>
                    ) : (
                      <p className="text-sm text-muted-foreground pl-2">Nenhum item de prescrição encontrado para este episódio.</p>
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
                )}

              </>
            ) : (
              <p className="text-destructive text-center p-4">
                {historyDetailsItemsError || "Não foi possível carregar os detalhes deste registro."}
              </p>
            )}
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Fechar</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}