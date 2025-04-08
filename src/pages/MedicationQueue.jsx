import { useState, useEffect, useCallback } from 'react';
import { MedicationTask, Pet, Customer, MedicalRecord } from '@/api/entities';
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, CheckCircle, AlertCircle, Clock, X } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function MedicationQueue() {
  const [tasks, setTasks] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState("pending");
  const { toast } = useToast();

  const fetchTasks = useCallback(async () => {
    console.log("[MedicationQueue] Iniciando fetchTasks...");
    setIsLoading(true);
    setError(null);
    try {
      const tenantId = localStorage.getItem('current_tenant');
      if (!tenantId) {
         console.error("[MedicationQueue] Tenant ID não encontrado no localStorage.");
         setError("Identificação da clínica não encontrada. Recarregue a página ou faça login novamente.");
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
              try {
                if (!task || !task.petId) {
                  console.warn("[MedicationQueue] Tarefa inválida ou sem petId:", task);
                  return { ...task, petName: 'Dados Inválidos', ownerName: 'Dados Inválidos' };
                }

                console.log(`[MedicationQueue] Buscando Pet ID: ${task.petId}`);
                const pet = await Pet.get(task.petId);
                console.log(`[MedicationQueue] Pet encontrado:`, pet);
                
                let owner = null;
                if (pet && pet.owner_id) {
                  console.log(`[MedicationQueue] Buscando Tutor ID: ${pet.owner_id}`);
                  owner = await Customer.get(pet.owner_id);
                  console.log(`[MedicationQueue] Tutor encontrado:`, owner);
                } else {
                  console.warn(`[MedicationQueue] Pet ou owner_id não encontrado para tarefa ${task.id}`);
                }

                return {
                  ...task,
                  petName: pet?.name || 'Pet Desconhecido',
                  ownerName: owner?.full_name || 'Tutor Desconhecido',
                };
              } catch (fetchError) {
                console.error(`[MedicationQueue] Erro ao buscar dados para tarefa ${task.id}:`, fetchError);
                return {
                  ...task,
                  petName: 'Erro (Pet)',
                  ownerName: 'Erro (Tutor)',
                };
              }
            })
          );
          console.log("[MedicationQueue] Tarefas enriquecidas:", enrichedTasks);
          setTasks(enrichedTasks);
      }
    } catch (err) {
      console.error("[MedicationQueue] Erro GERAL no fetchTasks:", err);
      setError("Falha ao carregar as tarefas de medicação.");
      toast({
        title: "Erro",
        description: "Não foi possível buscar as tarefas.",
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

  const handleMarkAsAdministered = async (taskId) => {
    console.log(`[MedicationQueue] Tentando marcar tarefa ${taskId} como administrada`);
    try {
      const taskToComplete = await MedicationTask.get(taskId);
      if (!taskToComplete) {
          throw new Error("Tarefa não encontrada para registrar no histórico.");
      }
      console.log("[MedicationQueue] Detalhes da tarefa para histórico:", taskToComplete);

      await MedicationTask.update(taskId, { status: 'Administrado' });
      toast({
        title: "Sucesso",
        description: "Medicação marcada como administrada.",
        action: <CheckCircle className="text-green-500" />,
      });
      
      try {
         await MedicalRecord.create({
             tenant_id: taskToComplete.tenant_id,
             pet_id: taskToComplete.petId,
             record_date: new Date().toISOString(),
             type: 'medication_administration',
             description: `Medicação administrada: ${taskToComplete.medicationName || 'Nome Indisponível'}. Detalhes: ${taskToComplete.details || '-'}`,
             related_appointment_id: taskToComplete.appointmentId
         });
         console.log(`[MedicationQueue] Registro adicionado ao histórico do pet ${taskToComplete.petId}`);
         toast({ title: "Histórico Atualizado", description: "Administração registrada no prontuário.", });
      } catch (recordError) {
         console.error("[MedicationQueue] Erro ao criar registro no histórico:", recordError);
         toast({ title: "Aviso", description: "Não foi possível registrar a administração no histórico.", variant: "destructive" });
      }
      
      fetchTasks(); 
    } catch (err) {
      console.error("[MedicationQueue] Erro ao marcar medicação como administrada:", err);
      toast({
        title: "Erro",
        description: `Não foi possível atualizar o status da medicação: ${err.message}`,
        variant: "destructive",
      });
    }
  };

  const handleCancelTask = async (taskId) => {
    try {
      await MedicationTask.update(taskId, { status: 'Cancelado' });
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

  const getFilteredTasks = (status) => {
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
            <TableHead>Agendado Para</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {tasks.map((task) => (
            <TableRow key={task.id}>
              <TableCell className="font-medium">{task.petName}</TableCell>
              <TableCell>{task.ownerName}</TableCell>
              <TableCell>{task.medicationName || 'Nome Indisponível'}</TableCell>
              <TableCell className="text-sm text-muted-foreground">{task.details || '-'}</TableCell>
              <TableCell>
                {task.scheduledTime 
                  ? format(new Date(task.scheduledTime), "dd/MM/yyyy HH:mm", { locale: ptBR })
                  : 'Data Indisponível'}
              </TableCell>
              <TableCell className="text-right">
                {activeTab === "pending" && (
                  <div className="flex justify-end gap-2">
                    <Button
                      size="sm"
                      onClick={() => handleMarkAsAdministered(task.id)}
                      variant="outline"
                    >
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Administrado
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handleCancelTask(task.id)}
                      variant="outline"
                      className="text-destructive"
                    >
                      <X className="h-4 w-4 mr-2" />
                      Cancelar
                    </Button>
                  </div>
                )}
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
          {!isLoading && error && (
             <div className="flex flex-col items-center justify-center py-10 text-destructive">
               <AlertCircle className="h-8 w-8 mb-2" />
               <p className="text-center font-medium">{error}</p>
               <Button onClick={fetchTasks} className="mt-4">Tentar Novamente</Button>
             </div>
           )}
          {!isLoading && !error && (
            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
              <TabsList>
                <TabsTrigger value="pending" className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Pendentes ({getFilteredTasks('Pendente').length})
                </TabsTrigger>
                <TabsTrigger value="administered" className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4" />
                  Administrados ({getFilteredTasks('Administrado').length})
                </TabsTrigger>
                <TabsTrigger value="cancelled" className="flex items-center gap-2">
                  <X className="h-4 w-4" />
                  Cancelados ({getFilteredTasks('Cancelado').length})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="pending">
                {renderTaskTable(getFilteredTasks('Pendente'))}
              </TabsContent>

              <TabsContent value="administered">
                {renderTaskTable(getFilteredTasks('Administrado'))}
              </TabsContent>

              <TabsContent value="cancelled">
                {renderTaskTable(getFilteredTasks('Cancelado'))}
              </TabsContent>
            </Tabs>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
