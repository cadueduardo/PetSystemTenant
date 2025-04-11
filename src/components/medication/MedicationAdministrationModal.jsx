import { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { medicationTaskService } from '@/api/firebase/medicationTaskService';
import { queueService } from '@/api/firebase/queueService';
import { appointmentService } from '@/api/firebase/appointmentService';
import { useToast } from "@/components/ui/use-toast";
import { X as XIcon } from 'lucide-react';
import { CalendarClock } from 'lucide-react';

export default function MedicationAdministrationModal({ isOpen, onClose, petGroup, onAdministrationComplete }) {
    const [checkedTasks, setCheckedTasks] = useState({});
    const { toast } = useToast();
    const [visibleTasks, setVisibleTasks] = useState([]);

    useEffect(() => {
        if (isOpen && petGroup && petGroup.tasks) {
            const initialChecks = {};
            petGroup.tasks.forEach(task => {
                if (task.status?.toLowerCase() !== 'cancelada') {
                    initialChecks[task.id] = false;
                }
            });
            setCheckedTasks(initialChecks);
            setVisibleTasks(petGroup.tasks.filter(task => task.status?.toLowerCase() !== 'cancelada'));
        } else {
            setCheckedTasks({});
            setVisibleTasks([]);
        }
    }, [isOpen, petGroup]);

    const handleCheckboxChange = (taskId) => {
        setCheckedTasks(prev => ({
            ...prev,
            [taskId]: !prev[taskId]
        }));
    };

    const handleCancelSingleTask = async (taskIdToCancel) => {
        console.log(`[Modal] Cancelando tarefa: ${taskIdToCancel}`);
        try {
            await medicationTaskService.update(taskIdToCancel, { status: 'cancelada' });
            toast({ title: "Medicação Cancelada", description: "A medicação foi marcada como cancelada.", });

            setVisibleTasks(prev => prev.filter(task => task.id !== taskIdToCancel));
            
            setCheckedTasks(prev => {
                const newChecks = { ...prev };
                delete newChecks[taskIdToCancel];
                return newChecks;
            });
            
            if (onAdministrationComplete) {
                 onAdministrationComplete(petGroup?.petId, [taskIdToCancel]);
            }

        } catch (error) {
            console.error("[Modal] Erro ao cancelar tarefa:", error);
            toast({ title: "Erro", description: "Não foi possível cancelar a medicação.", variant: "destructive" });
        }
    };

    const handleFinalizeAdministration = async () => {
        if (!petGroup || !petGroup.tasks) return;
        
        console.log("[Modal] Finalizando administração para:", petGroup.petName);
        const tasksToUpdate = Object.entries(checkedTasks)
            .filter(([/* taskId */, isChecked]) => isChecked)
            .map(([taskId]) => taskId);
            
        if (tasksToUpdate.length === 0) {
             toast({ title: "Atenção", description: "Nenhuma medicação foi marcada como administrada.", variant: "default" });
             return;
        }

        console.log("[Modal] Tarefas marcadas para finalizar:", tasksToUpdate);
        
        // TODO: Adicionar indicador de loading
        try {
            await Promise.all(tasksToUpdate.map(taskId => 
                medicationTaskService.update(taskId, { 
                    status: 'administrada',
                    end_time: new Date().toISOString()
                })
            ));
            
            toast({ title: "Sucesso", description: `Administração finalizada para ${petGroup.petName}.` });
            
            // Verificar se alguma tarefa finalizada requer retorno
            const completedTasksData = petGroup.tasks.filter(task => tasksToUpdate.includes(task.id));
            const requiresFollowUp = completedTasksData.some(task => task.requires_follow_up === true);

            if (requiresFollowUp) {
                console.log(`[Modal] Retorno necessário para Pet ID: ${petGroup?.petId} devido a uma tarefa administrada.`);
                toast({ title: "Retorno Necessário", description: `Lembre-se que ${petGroup?.petName} precisa de retorno devido à medicação.`, duration: 7000 });

                // Adicionar à fila de serviço para reavaliação
                try {
                    const taskForQueue = completedTasksData.find(t => t.requires_follow_up); // Pega a primeira tarefa que marcou retorno
                    const tenantId = taskForQueue?.tenant_id || localStorage.getItem('current_tenant');
                    const appointmentId = taskForQueue?.appointment_id;

                    if (!tenantId || !petGroup?.petId || !petGroup?.ownerId || !appointmentId) {
                        console.error("[Modal] Dados basicos insuficientes para criar entrada na fila de retorno:", { tenantId, petId: petGroup?.petId, ownerId: petGroup?.ownerId, appointmentId });
                        throw new Error("Dados básicos faltando para fila de retorno (tenant, pet, owner, appt ID).");
                    }
                    
                    // Fetch the original appointment to get the service_id
                    console.log(`[Modal] Fetching original appointment ${appointmentId} to get service_id...`);
                    const originalAppointment = await appointmentService.get(appointmentId);
                    const serviceId = originalAppointment?.service_id;

                    if (!serviceId) {
                         console.error("[Modal] Service ID não encontrado no agendamento original:", originalAppointment);
                        throw new Error("Service ID não encontrado no agendamento original para fila de retorno.");
                    }
                    console.log(`[Modal] Service ID encontrado: ${serviceId}`);

                    await queueService.create({
                        tenant_id: tenantId,
                        pet_id: petGroup.petId,
                        customer_id: petGroup.ownerId,
                        appointment_id: appointmentId,
                        service_id: serviceId,
                        queue_type: 'medication_followup',
                        status: 'waiting',
                        notes: `Retorno pendente após administração de medicação (${taskForQueue.medicationName}). Prescrição original: ${appointmentId}`
                    });
                    console.log(`[Modal] Entrada adicionada à queueService para retorno (medication_followup) do Appointment ${appointmentId}`);
                    toast({ title: "Fila Atualizada", description: `${petGroup?.petName} adicionado à fila de retorno para reavaliação.` });

                } catch (queueError) {
                    console.error("[Modal] Erro ao adicionar na fila de retorno:", queueError);
                    toast({ title: "Erro na Fila", description: `Não foi possível adicionar o pet à fila de retorno automaticamente. Erro: ${queueError.message}`, variant: "destructive" });
                }
            }
            
            // TODO: Adicionar lógica para registrar no histórico médico (MedicalRecord.create)
            // Poderia ser feito aqui ou passado de volta para MedicationQueue
            
            if (onAdministrationComplete) {
                 onAdministrationComplete(petGroup.petId, tasksToUpdate);
            }
            onClose(); // Fechar o modal
        } catch (error) {
             console.error("[Modal] Erro ao finalizar administração:", error);
             toast({ title: "Erro", description: "Falha ao atualizar o status das medicações.", variant: "destructive" });
        }
    };

    const allTasksChecked = visibleTasks.length > 0 && visibleTasks.every(task => checkedTasks[task.id]);

    if (!petGroup) return null; // Não renderizar se não houver dados

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-2xl">
                <DialogHeader className="flex flex-row items-center space-x-4 pb-4 border-b mb-4">
                    <Avatar className="h-16 w-16">
                        <AvatarImage src={petGroup.petPhotoUrl} alt={petGroup.petName} />
                        <AvatarFallback>{petGroup.petName?.substring(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col">
                        <DialogTitle>Administrar Medicação - {petGroup.petName}</DialogTitle>
                        <DialogDescription>
                            Tutor: {petGroup.ownerName}. Marque as medicações administradas.
                        </DialogDescription>
                    </div>
                </DialogHeader>

                {visibleTasks.length > 0 && (
                    <div className="mb-4 space-y-3">
                        {visibleTasks[0].observations && (
                            <div className="text-sm p-3 rounded-md border bg-blue-50 border-blue-200 text-blue-800">
                                <p><strong>Observações da Prescrição:</strong></p>
                                <p>{visibleTasks[0].observations}</p>
                            </div>
                        )}
                        {visibleTasks[0].requires_follow_up && (
                            <div className="flex items-center text-sm p-2 rounded-md border bg-orange-100 border-orange-200 text-orange-800 font-medium">
                                <CalendarClock className="h-5 w-5 mr-2 shrink-0" />
                                <span>Retorno necessário para esta prescrição.</span>
                            </div>
                        )}
                    </div>
                )}
                
                <ScrollArea className="h-[350px] w-full rounded-md border p-4">
                    <div className="space-y-5">
                        {visibleTasks.map((task) => (
                            <div key={task.id} className="flex items-center space-x-4 p-3 rounded hover:bg-muted/50">
                                <Checkbox 
                                    id={`task-${task.id}`} 
                                    checked={checkedTasks[task.id] || false}
                                    onCheckedChange={() => handleCheckboxChange(task.id)}
                                />
                                <Label htmlFor={`task-${task.id}`} className="flex flex-col flex-grow cursor-pointer">
                                    <span className="font-medium text-base">{task.medicationName}</span>
                                    <span className="text-sm text-muted-foreground">{task.details}</span>
                                </Label>
                                <Button 
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 text-destructive hover:bg-destructive/10 shrink-0"
                                    onClick={() => handleCancelSingleTask(task.id)}
                                    title="Cancelar esta medicação"
                                >
                                    <XIcon className="h-4 w-4" />
                                </Button>
                            </div>
                        ))}
                         {visibleTasks.length === 0 && (
                            <p className="text-center text-muted-foreground">Nenhuma medicação pendente para este pet.</p>
                        )}
                    </div>
                </ScrollArea>

                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>Cancelar</Button>
                    <Button 
                        onClick={handleFinalizeAdministration} 
                        disabled={!allTasksChecked}
                    >
                        Finalizar Administração
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

MedicationAdministrationModal.propTypes = {
    isOpen: PropTypes.bool.isRequired,
    onClose: PropTypes.func.isRequired,
    petGroup: PropTypes.shape({
        petId: PropTypes.string,
        petName: PropTypes.string,
        ownerName: PropTypes.string,
        ownerId: PropTypes.string,
        tasks: PropTypes.arrayOf(PropTypes.shape({
            id: PropTypes.string.isRequired,
            medicationName: PropTypes.string,
            details: PropTypes.string,
            observations: PropTypes.string,
            requires_follow_up: PropTypes.bool,
            tenant_id: PropTypes.string,
            appointment_id: PropTypes.string,
            service_id: PropTypes.string,
        })),
        petPhotoUrl: PropTypes.string
    }),
    onAdministrationComplete: PropTypes.func
}; 