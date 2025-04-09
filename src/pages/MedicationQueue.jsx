import { useState, useEffect, useCallback } from 'react';
import { MedicationTask, Pet, Customer, MedicalRecord, Medication } from '@/api/entities';
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, CheckCircle, Clock, X } from 'lucide-react';

export default function MedicationQueue() {
  const [tasks, setTasks] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("pending");
  const { toast } = useToast();

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
      const allTasks = await MedicationTask.filter({ tenant_id: tenantId });
      console.log("[MedicationQueue] Tarefas recebidas:", allTasks);
      
      if (!allTasks || allTasks.length === 0) {
        console.log("[MedicationQueue] Nenhuma tarefa encontrada.");
        setTasks([]);
      } else {
          console.log("[MedicationQueue] Enriquecendo tarefas...");
          const enrichedTasks = await Promise.all(
            allTasks.map(async (task) => {
              let pet = null;
              let owner = null;
              let medication = null;
              let petName = 'Dados Inválidos';
              let ownerName = 'Dados Inválidos';
              let medicationName = 'Nome Indisponível';
              let details = task.dosage && task.frequency ? `${task.dosage} (${task.frequency})` : task.details || '-';

              try {
                if (!task || !task.pet_id) {
                  console.warn("[MedicationQueue] Tarefa inválida ou sem pet_id:", task);
                } else {
                    console.log(`[MedicationQueue] Buscando Pet ID: ${task.pet_id}`);
                    pet = await Pet.get(task.pet_id);
                    console.log(`[MedicationQueue] Pet encontrado:`, pet);
                    petName = pet?.name || 'Pet Desconhecido';

                    if (pet && pet.owner_id) {
                      console.log(`[MedicationQueue] Buscando Tutor ID: ${pet.owner_id}`);
                      owner = await Customer.get(pet.owner_id);
                      console.log(`[MedicationQueue] Tutor encontrado:`, owner);
                      ownerName = owner?.full_name || 'Tutor Desconhecido';
                    } else {
                      console.warn(`[MedicationQueue] Pet ou owner_id não encontrado para tarefa ${task.id}`);
                    }

                    if (task.medication_id) {
                        try {
                            console.log(`[MedicationQueue] Buscando Medication ID: ${task.medication_id}`);
                            medication = await Medication.get(task.medication_id);
                            console.log(`[MedicationQueue] Medicação encontrada:`, medication);
                            medicationName = medication?.name || medicationName;
                            if (medication?.description && details === '-') {
                                details = medication.description;
                            }
                        } catch (medError) {
                            console.error(`[MedicationQueue] Erro ao buscar medicação ${task.medication_id} para tarefa ${task.id}:`, medError);
                        }
                    } else {
                         console.warn(`[MedicationQueue] medication_id não encontrado para tarefa ${task.id}`);
                    }
                }
              } catch (fetchError) {
                console.error(`[MedicationQueue] Erro ao buscar dados associados para tarefa ${task.id}:`, fetchError);
                petName = 'Erro (Pet)';
                ownerName = 'Erro (Tutor)';
              }
              
              return {
                  ...task,
                  petName,
                  ownerName,
                  medicationName,
                  details
                };
            })
          );
          console.log("[MedicationQueue] Tarefas enriquecidas:", enrichedTasks);
          setTasks(enrichedTasks);
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
      const taskToComplete = tasks.find(t => t.id === taskId) || await MedicationTask.get(taskId);
      if (!taskToComplete) {
          throw new Error("Tarefa não encontrada para registrar no histórico.");
      }
      console.log("[MedicationQueue] Detalhes da tarefa para histórico:", taskToComplete);

      await MedicationTask.update(taskId, { 
          status: 'administered', 
          end_time: new Date().toISOString()
      });
      toast({
        title: "Sucesso",
        description: "Medicação marcada como administrada.",
        action: <CheckCircle className="text-green-500" />,
      });
      
      try {
         await MedicalRecord.create({
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
      await MedicationTask.update(taskId, { status: 'cancelled' }); 
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
      await MedicationTask.update(taskId, { 
          status: 'in_progress',
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

  const getFilteredTasks = (status) => {
      if (status === 'pending') {
          return tasks.filter(task => task.status === 'pending' || task.status === 'in_progress');
      }
      return tasks.filter(task => task.status === status);
  };

  const renderTaskTable = (tasks) => {
    if (tasks.length === 0) {
      return (
        <div className="text-center text-muted-foreground py-8">
          Nenhuma medicação {activeTab === "pending" ? "pendente" : activeTab === "administered" ? "administrada" : "cancelada"} no momento.
        </div>
      );
    }

    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Pet</TableHead>
            <TableHead>Tutor</TableHead>
            <TableHead>Medicação</TableHead>
            <TableHead>Detalhes</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {tasks.map((task) => (
            <TableRow key={task.id}>
              <TableCell className="font-medium">{task.petName}</TableCell>
              <TableCell>{task.ownerName}</TableCell>
              <TableCell>{task.medicationName}</TableCell>
              <TableCell className="text-sm text-muted-foreground">{task.details}</TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-2">
                  {task.status === 'pending' && (
                      <Button
                          size="sm"
                          onClick={() => handleStartAdministration(task.id)}
                          variant="secondary"
                      >
                          <Clock className="h-4 w-4 mr-2" />
                          Iniciar
                      </Button>
                  )}
                  {task.status === 'in_progress' && (
                      <Button
                          size="sm"
                          onClick={() => handleFinishAdministration(task.id)}
                          variant="outline"
                          className="text-green-600 border-green-600 hover:bg-green-50"
                      >
                          <CheckCircle className="h-4 w-4 mr-2" />
                          Finalizar
                      </Button>
                  )}
                  {(task.status === 'pending' || task.status === 'in_progress') && (
                      <Button
                          size="sm"
                          onClick={() => handleCancelTask(task.id)}
                          variant="outline"
                          className="text-destructive hover:bg-red-50"
                      >
                          <X className="h-4 w-4 mr-2" />
                          Cancelar
                      </Button>
                  )}
                </div>
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
    </div>
  );
}
