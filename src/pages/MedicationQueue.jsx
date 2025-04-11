import { useState, useEffect, useCallback } from 'react';
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, CheckCircle, Clock, X } from 'lucide-react';
import MedicationAdministrationModal from '@/components/medication/MedicationAdministrationModal';

// Adicionar importações dos serviços Firestore
import { medicationTaskService } from '@/api/firebase/medicationTaskService';
import { petService } from '@/api/firebase/petService';
import { customerService } from '@/api/firebase/customerService';
import { medicalRecordService } from '@/api/firebase/medicalRecordService';

export default function MedicationQueue() {
  const [groupedTasks, setGroupedTasks] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("pending");
  const { toast } = useToast();
  
  // Estados para controlar o modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedPetGroup, setSelectedPetGroup] = useState(null);

  const fetchTasks = useCallback(async () => {
    console.log("[MedicationQueue] Iniciando fetchTasks...");
    setIsLoading(true);
    try {
      const tenantId = localStorage.getItem('current_tenant');
      if (!tenantId) {
         console.error("[MedicationQueue] Tenant ID não encontrado no localStorage.");
         toast({ title: "Erro", description: "Identificação da clínica não encontrada.", variant: "destructive" });
         setIsLoading(false);
         return;
      }
      console.log(`[MedicationQueue] Buscando tarefas para tenant: ${tenantId}`);
      const allTasks = await medicationTaskService.filter({ tenant_id: tenantId });
      console.log("[MedicationQueue] Tarefas recebidas:", allTasks);
      
      if (!allTasks || allTasks.length === 0) {
        console.log("[MedicationQueue] Nenhuma tarefa encontrada.");
        setGroupedTasks({});
      } else {
          console.log("[MedicationQueue] Enriquecendo tarefas...");
          const enrichedTasks = await Promise.all(
            allTasks.map(async (task) => {
              let pet = null;
              let owner = null;
              let petName = 'Dados Inválidos';
              let ownerName = 'Dados Inválidos';
              let ownerId = null;
              let medicationName = task.medication_name || 'Medicação S/ Nome';
              let details = task.details || '-';

              try {
                const currentPetId = task.pet_id || task.petId;
                if (!task || !currentPetId) {
                  console.warn("[MedicationQueue] Tarefa inválida ou sem pet_id/petId:", task);
                  petName = 'Pet ID Faltando';
                  ownerName = 'Tutor Desconhecido';
                } else {
                    console.log(`[MedicationQueue] Buscando Pet ID: ${currentPetId}`);
                    pet = await petService.get(currentPetId);
                    console.log(`[MedicationQueue] Pet encontrado:`, pet);
                    petName = pet?.name || 'Pet Desconhecido';

                    if (pet && pet.owner_id) {
                      console.log(`[MedicationQueue] Buscando Tutor ID: ${pet.owner_id}`);
                      owner = await customerService.get(pet.owner_id);
                      console.log(`[MedicationQueue] Tutor encontrado:`, owner);
                      ownerName = owner?.full_name || 'Tutor Desconhecido';
                      ownerId = owner?.id;
                    } else if (pet) {
                      console.warn(`[MedicationQueue] Pet ${currentPetId} encontrado, mas sem owner_id.`);
                      ownerName = 'Tutor S/ ID';
                    } else {
                      console.warn(`[MedicationQueue] Pet com ID ${currentPetId} não encontrado para tarefa ${task.id}`);
                      petName = 'Pet Não Encontrado';
                      ownerName = 'Tutor Desconhecido';
                    }
                }
              } catch (fetchError) {
                console.error(`[MedicationQueue] Erro ao buscar dados associados para tarefa ${task.id}:`, fetchError);
                if (petName === 'Dados Inválidos') petName = 'Erro (Pet)';
                if (ownerName === 'Dados Inválidos') ownerName = 'Erro (Tutor)';
              }
              
              return {
                  ...task,
                  petName,
                  ownerName,
                  ownerId,
                  medicationName,
                  details,
                  petPhotoUrl: pet?.photo_url
                };
            })
          );
          console.log("[MedicationQueue] Tarefas enriquecidas:", enrichedTasks);
          
          // Agrupar tarefas por petId
          const grouped = enrichedTasks.reduce((acc, task) => {
            const petId = task.pet_id || task.petId || 'unknown';
            if (!acc[petId]) {
              acc[petId] = {
                petName: task.petName,
                ownerName: task.ownerName,
                ownerId: task.ownerId,
                petId: petId,
                petPhotoUrl: task.petPhotoUrl,
                tasks: []
              };
            }
            acc[petId].tasks.push(task);
            return acc;
          }, {});
          console.log("[MedicationQueue] Tarefas agrupadas por pet:", grouped);
          setGroupedTasks(grouped); // Atualizar estado com dados agrupados
      }
    } catch (err) {
      console.error("[MedicationQueue] Erro GERAL no fetchTasks:", err);
      toast({
        title: "Erro",
        description: "Falha ao carregar as tarefas de medicação.",
        variant: "destructive",
      });
    } finally {
      console.log("[MedicationQueue] Finalizando fetchTasks.");
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchTasks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFinishAdministration = async (taskId) => {
    console.log(`[MedicationQueue] Tentando finalizar tarefa ${taskId}`);
    try {
      const taskToComplete = groupedTasks[taskId]?.tasks.find(t => t.id === taskId) || await medicationTaskService.get(taskId);
      if (!taskToComplete) {
          throw new Error("Tarefa não encontrada para registrar no histórico.");
      }
      console.log("[MedicationQueue] Detalhes da tarefa para histórico:", taskToComplete);

      await medicationTaskService.update(taskId, { 
          status: 'administrada',
          end_time: new Date().toISOString()
      });
      toast({
        title: "Sucesso",
        description: "Medicação marcada como administrada.",
        action: <CheckCircle className="text-green-500" />,
      });
      
      try {
         await medicalRecordService.create({
             tenant_id: taskToComplete.tenant_id,
             pet_id: taskToComplete.pet_id,
             record_date: new Date().toISOString(),
             type: 'medication_administration',
             description: `Medicação administrada: ${taskToComplete.medicationName}. Detalhes: ${taskToComplete.details || '-'}`, 
             related_appointment_id: taskToComplete.appointmentId
         });
         console.log(`[MedicationQueue] Registro adicionado ao histórico do pet ${taskToComplete.pet_id}`);
         toast({ title: "Histórico Atualizado", description: "Administração registrada no prontuário.", });
      } catch (recordError) {
         console.error("[MedicationQueue] Erro ao criar registro no histórico:", recordError);
         toast({ title: "Aviso", description: "Não foi possível registrar a administração no histórico.", variant: "destructive" });
      }
      
      fetchTasks(); 
    } catch (err) {
      console.error("[MedicationQueue] Erro ao finalizar medicação:", err);
      toast({
        title: "Erro",
        description: `Não foi possível finalizar a medicação: ${err.message}`,
        variant: "destructive",
      });
    }
  };

  const handleCancelTask = async (taskId) => {
    console.log(`[MedicationQueue] Tentando cancelar tarefa ${taskId}`);
    try {
      await medicationTaskService.update(taskId, { status: 'cancelada' });
      toast({
        title: "Sucesso",
        description: "Medicação cancelada com sucesso.",
      });
      fetchTasks();
    } catch (err) {
      console.error("[MedicationQueue] Erro ao cancelar medicação:", err);
      toast({
        title: "Erro",
        description: "Não foi possível cancelar a medicação.",
        variant: "destructive",
      });
    }
  };

  const handleStartAdministration = async (taskId) => {
    console.log(`[MedicationQueue] Tentando iniciar tarefa ${taskId}`);
    try {
      await medicationTaskService.update(taskId, { 
          status: 'em_andamento',
          start_time: new Date().toISOString()
      });
      toast({
        title: "Iniciada",
        description: "Administração da medicação iniciada.",
      });
      fetchTasks(); // Atualiza a lista para refletir a mudança de status
    } catch (err) {
      console.error("[MedicationQueue] Erro ao iniciar medicação:", err);
      toast({
        title: "Erro",
        description: `Não foi possível iniciar a medicação: ${err.message}`,
        variant: "destructive",
      });
    }
  };

  // Função para abrir o modal com os dados do pet selecionado
  const handleStartPetAdministration = (petGroup) => {
    console.log("[MedicationQueue] Abrindo modal para:", petGroup);
    setSelectedPetGroup(petGroup);
    setIsModalOpen(true);
  };

  // Função para ser chamada pelo modal após a conclusão da administração
  const handleAdministrationComplete = () => {
    console.log("[MedicationQueue] Administração concluída, atualizando lista...");
    fetchTasks(); // Recarrega os dados
  };

  const getFilteredTasks = (status) => {
      // Esta função agora precisa operar sobre os dados agrupados
      console.log(`[MedicationQueue] getFilteredTasks chamada com status: ${status}`);
      const lowerCaseStatus = status.toLowerCase();
      
      const filteredGroups = Object.entries(groupedTasks)
        .map(([petId, group]) => {
          let tasksInGroup = [];
          if (lowerCaseStatus === 'pending') {
              tasksInGroup = group.tasks.filter(task => 
                  task.status?.toLowerCase() === 'pendente' || 
                  task.status?.toLowerCase() === 'em_andamento'
              );
          } else if (lowerCaseStatus === 'administered') {
              tasksInGroup = group.tasks.filter(task => task.status?.toLowerCase() === 'administrada');
          } else if (lowerCaseStatus === 'cancelled') {
              tasksInGroup = group.tasks.filter(task => task.status?.toLowerCase() === 'cancelada');
          }
          
          // Retorna o grupo apenas se ele tiver tarefas que correspondem ao status
          return tasksInGroup.length > 0 ? { ...group, tasks: tasksInGroup } : null;
        })
        .filter(group => group !== null); // Remove grupos vazios

      console.log(`[MedicationQueue] Grupos filtrados para status '${status}':`, filteredGroups);
      return filteredGroups;
  };

  const renderTaskTable = (groups) => {
    if (groups.length === 0) {
      return (
        <div className="text-center text-muted-foreground py-8">
          Nenhum pet com medicações {activeTab === "pending" ? "pendentes" : activeTab === "administered" ? "administradas" : "canceladas"} no momento.
        </div>
      );
    }

    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Pet</TableHead>
            <TableHead>Tutor</TableHead>
            <TableHead>Medicações Pendentes</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {groups.map((group) => (
            <TableRow key={group.petId}>
              <TableCell className="font-medium">{group.petName}</TableCell>
              <TableCell>{group.ownerName}</TableCell>
              <TableCell>{group.tasks.length}</TableCell> 
              <TableCell className="text-right">
                {/* Renderiza o botão apenas na aba 'pending' */}
                {activeTab === 'pending' && (
                  <Button
                    size="sm"
                    onClick={() => handleStartPetAdministration(group)}
                    variant="secondary"
                  >
                    <Clock className="h-4 w-4 mr-2" />
                    Iniciar Administração
                  </Button>
                )}
                {/* Se houver outras ações para outras abas, elas viriam aqui */}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  };

  return (
    <div className="container mx-auto p-4 md:p-6">
      <Card>
        <CardHeader>
          <CardTitle>Fila de Medicação</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading && (
            <div className="flex justify-center items-center py-10">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="ml-2">Carregando tarefas...</p>
            </div>
          )}
          {!isLoading && (
            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
              <TabsList>
                <TabsTrigger value="pending" className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Pendentes ({getFilteredTasks('pending').length})
                </TabsTrigger>
                <TabsTrigger value="administered" className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4" />
                  Administrados ({getFilteredTasks('administered').length})
                </TabsTrigger>
                <TabsTrigger value="cancelled" className="flex items-center gap-2">
                  <X className="h-4 w-4" />
                  Cancelados ({getFilteredTasks('cancelled').length})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="pending">
                {renderTaskTable(getFilteredTasks('pending'))}
              </TabsContent>

              <TabsContent value="administered">
                {renderTaskTable(getFilteredTasks('administered'))}
              </TabsContent>

              <TabsContent value="cancelled">
                {renderTaskTable(getFilteredTasks('cancelled'))}
              </TabsContent>
            </Tabs>
          )}
        </CardContent>
      </Card>
      
      {/* Renderizar o Modal */}
      <MedicationAdministrationModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)} 
        petGroup={selectedPetGroup}
        // TODO: Passar uma função de callback para quando a administração for concluída
        // onAdministrationComplete={handleAdministrationComplete}
        onAdministrationComplete={handleAdministrationComplete} // Passar a função de callback
      />
    </div>
  );
}
