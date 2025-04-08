import { useState, useEffect, useCallback } from 'react';
import { MedicationTask, Pet, Customer, MedicalRecord } from '@/api/entities';
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function MedicationQueue() {
  const [tasks, setTasks] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
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
      console.log(`[MedicationQueue] Buscando tarefas pendentes para tenant: ${tenantId}`);
      const pendingTasks = await MedicationTask.filter({ status: 'Pendente', tenant_id: tenantId });
      console.log("[MedicationQueue] Tarefas pendentes recebidas:", pendingTasks);
      
      if (!pendingTasks || pendingTasks.length === 0) {
        console.log("[MedicationQueue] Nenhuma tarefa pendente encontrada.");
        setTasks([]);
        // Não definimos erro aqui, apenas lista vazia
      } else {
          console.log("[MedicationQueue] Enriquecendo tarefas...");
          const enrichedTasks = await Promise.all(
            pendingTasks.map(async (task) => {
              try {
                // Validação básica da task
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
        description: "Não foi possível buscar as tarefas pendentes.",
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

  return (
    <div className="container mx-auto p-4 md:p-6">
      <Card>
        <CardHeader>
          <CardTitle>Fila de Medicação Interna Pendente</CardTitle>
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
          {!isLoading && !error && tasks.length === 0 && (
            <p className="text-center text-muted-foreground py-10">
              Nenhuma medicação interna pendente no momento.
            </p>
          )}
          {!isLoading && !error && tasks.length > 0 && (
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
                      <Button
                        size="sm"
                        onClick={() => handleMarkAsAdministered(task.id)}
                        variant="outline"
                      >
                        Marcar como Administrado
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
