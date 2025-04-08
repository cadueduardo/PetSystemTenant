import { useState, useEffect } from "react";
import { Pet } from "@/api/entities";
import { Customer } from "@/api/entities";
import { PurchaseHistory } from "@/api/entities";
import { QueueService } from "@/api/entities";
import { useNavigate, useParams } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { toast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, ChevronLeft, Pencil, Calendar } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

// Componentes
import PetBasicInfo from "../components/pets/PetBasicInfo";
import ClinicalDataTab from "../components/pets/ClinicalDataTab";
import PetshopDataTab from "../components/pets/PetshopDataTab";
import MedicalRecordList from "../components/pets/MedicalRecordList";
import AppointmentList from "../components/pets/AppointmentList";
import PetForm from "../components/pets/PetForm";
import PetPurchaseHistory from "../components/pets/PetPurchaseHistory";
import PetGroomingHistory from "../components/pets/PetGroomingHistory";

export default function PetDetails() {
  const navigate = useNavigate();
  const { id: petId } = useParams();
  const [pet, setPet] = useState(null);
  const [owner, setOwner] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showEditForm, setShowEditForm] = useState(false);
  const [selectedModules, setSelectedModules] = useState([]);
  const [purchaseHistory, setPurchaseHistory] = useState([]);
  const [groomingHistory, setGroomingHistory] = useState([]);
  
  // Obter parâmetros da URL
  const urlParams = new URLSearchParams(window.location.search);
  const storeParam = urlParams.get('store') || localStorage.getItem('current_tenant');
  
  // Carregar dados do pet e do dono
  useEffect(() => {
    const loadData = async () => {
      if (!petId) {
        navigate(createPageUrl("Customers", { store: storeParam }));
        return;
      }
      
      setIsLoading(true);
      try {
        // Carregar dados do pet
        const petData = await Pet.get(petId);
        if (!petData) {
          throw new Error("Pet não encontrado");
        }
        
        console.log('[PetDetails] Pet carregado:', {
          id: petData.id,
          name: petData.name,
          hasPhoto: !!petData.photo_url,
          photo_url_preview: petData.photo_url ? petData.photo_url.substring(0, 50) + '...' : null,
          photo_url_type: typeof petData.photo_url,
          is_base64: petData.photo_url?.startsWith('data:'),
          photo_url_mime: petData.photo_url?.split(';')[0]
        });
        
        setPet(petData);
        
        // Carregar dados do dono
        if (petData.owner_id) {
          try {
            const ownerData = await Customer.get(petData.owner_id);
            setOwner(ownerData);
          } catch (error) {
            console.error("Erro ao carregar dados do dono:", error);
            toast({
              title: "Aviso",
              description: "Não foi possível carregar dados do dono.",
              variant: "warning"
            });
          }
        }
        
        // Carregar módulos do tenant
        try {
          const modules = JSON.parse(localStorage.getItem('tenant_modules') || '[]');
          setSelectedModules(modules);
        } catch (error) {
          console.error("Erro ao carregar módulos:", error);
          setSelectedModules([]);
        }
        
        // Carregar histórico de compras do pet
        try {
          const purchases = await PurchaseHistory.filter({
            customer_id: petData.owner_id,
            "items": {
              "$elemMatch": {
                "pet_id": petId
              }
            }
          });
          setPurchaseHistory(purchases);
        } catch (error) {
          console.error("Erro ao carregar histórico de compras:", error);
          setPurchaseHistory([]);
        }
        
        // Carregar histórico de banho e tosa
        try {
          const grooming = await QueueService.filter({
            pet_id: petId,
            status: "completed"
          });
          setGroomingHistory(grooming);
        } catch (error) {
          console.error("Erro ao carregar histórico de banho e tosa:", error);
          setGroomingHistory([]);
        }
        
      } catch (error) {
        console.error("Erro ao carregar dados:", error);
        toast({
          title: "Erro",
          description: "Não foi possível carregar os dados do pet.",
          variant: "destructive"
        });
        navigate(createPageUrl("Customers", { store: storeParam }));
      } finally {
        setIsLoading(false);
      }
    };
    
    loadData();
  }, [petId, navigate, storeParam]);
  
  // Verificar se o tenant possui o módulo Petshop
  const hasPetshopModule = selectedModules.includes('petshop');
  
  // Atualizar dados do pet
  const handleUpdatePet = async (updatedPet) => {
    try {
      const updated = await Pet.update(petId, updatedPet);
      setPet(updated);
      setShowEditForm(false);
      toast({
        title: "Sucesso",
        description: "Dados do pet atualizados com sucesso!"
      });
    } catch (error) {
      console.error("Erro ao atualizar pet:", error);
      toast({
        title: "Erro",
        description: "Não foi possível atualizar os dados do pet.",
        variant: "destructive"
      });
    }
  };
  
  // Voltar para a página de detalhes do cliente
  const handleBack = () => {
    navigate(createPageUrl("Customers", { store: storeParam }));
  };
  
  // Navegar para o formulário de agendamento
  const handleNewAppointment = () => {
    navigate(createPageUrl("AppointmentForm", { 
      pet_id: petId, 
      customer_id: owner?.id || '', 
      store: storeParam 
    }));
  };
  
  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-full p-8">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }
  
  if (!pet) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="py-10 text-center">
            <p className="text-lg text-gray-500 mb-4">Pet não encontrado</p>
            <Button onClick={() => navigate(createPageUrl("Customers", { store: storeParam }))}>
              Voltar para Clientes
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  return (
    <div className="p-6">
      {showEditForm ? (
        <Card>
          <CardContent className="pt-6">
            <div className="flex justify-between items-center mb-6">
              <h1 className="text-2xl font-bold">Editar Pet</h1>
              <Button variant="outline" onClick={() => setShowEditForm(false)}>
                Cancelar
              </Button>
            </div>
            <PetForm 
              pet={pet} 
              onSubmit={handleUpdatePet} 
              onCancel={() => setShowEditForm(false)}
            />
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                size="icon" 
                onClick={handleBack}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <h1 className="text-2xl font-bold">{pet.name}</h1>
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={handleNewAppointment}>
                <Calendar className="h-4 w-4 mr-2" />
                Novo Agendamento
              </Button>
              <Button onClick={() => setShowEditForm(true)}>
                <Pencil className="h-4 w-4 mr-2" />
                Editar Pet
              </Button>
            </div>
          </div>
          
          <div className="mb-6">
            <PetBasicInfo pet={pet} owner={owner} />
          </div>
          
          <Tabs defaultValue="medical">
            <TabsList className="mb-4">
              <TabsTrigger value="medical">Dados Clínicos</TabsTrigger>
              <TabsTrigger value="records">Prontuários</TabsTrigger>
              <TabsTrigger value="appointments">Agendamentos</TabsTrigger>
              {hasPetshopModule && (
                <>
                  <TabsTrigger value="petshop">Petshop</TabsTrigger>
                  <TabsTrigger value="grooming">Banho e Tosa</TabsTrigger>
                  <TabsTrigger value="purchases">Compras</TabsTrigger>
                </>
              )}
            </TabsList>
            
            <TabsContent value="medical">
              <ClinicalDataTab pet={pet} />
            </TabsContent>
            
            <TabsContent value="records">
              <MedicalRecordList pet={pet} />
            </TabsContent>
            
            <TabsContent value="appointments">
              <AppointmentList pet={pet} />
            </TabsContent>
            
            {hasPetshopModule && (
              <>
                <TabsContent value="petshop">
                  <PetshopDataTab pet={pet} />
                </TabsContent>
                
                <TabsContent value="grooming">
                  <PetGroomingHistory 
                    petId={pet.id} 
                    groomingHistory={groomingHistory} 
                    setGroomingHistory={setGroomingHistory}
                  />
                </TabsContent>
                
                <TabsContent value="purchases">
                  <PetPurchaseHistory 
                    petId={pet.id} 
                    ownerId={pet.owner_id}
                    purchaseHistory={purchaseHistory}
                    setPurchaseHistory={setPurchaseHistory}
                  />
                </TabsContent>
              </>
            )}
          </Tabs>

          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Histórico de Consultas (Prontuário)</CardTitle>
              <CardDescription>Resumo das consultas anteriores.</CardDescription>
            </CardHeader>
            <CardContent>
              {pet?.consultationHistory && pet.consultationHistory.length > 0 ? (
                <ul className="space-y-4">
                  {pet.consultationHistory
                     .sort((a, b) => new Date(b.date) - new Date(a.date)) // Ordena pela mais recente
                     .map((entry, index) => (
                    <li key={entry.consultationId || index} className="border p-3 rounded-md bg-muted/50">
                      <div className="flex justify-between items-start mb-1">
                        <span className="font-medium text-sm">{entry.serviceName || 'Consulta'}</span>
                        <span className="text-xs text-muted-foreground">
                          {entry.date ? format(parseISO(entry.date), 'dd/MM/yyyy', { locale: ptBR }) : 'Data N/A'}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mb-1"><strong>Queixa/Resumo:</strong> {entry.chiefComplaint || '-'}</p>
                      <p className="text-xs text-muted-foreground"><strong>Diagnóstico(s):</strong> {entry.diagnosis || '-'}</p>
                      {entry.appointmentId && (
                        <Button
                            variant="link"
                            size="sm"
                            className="h-auto p-0 text-xs mt-1"
                            // Ajuste a rota se necessário
                            onClick={() => navigate(`/consulta/${entry.appointmentId}/relatorio`)}
                        >
                            Ver Relatório Completo
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">Nenhum histórico de consulta encontrado para este pet.</p>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}