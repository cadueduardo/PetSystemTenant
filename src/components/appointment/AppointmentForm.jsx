import { useState, useEffect, useCallback } from "react";
import { format, isBefore, addMinutes } from "date-fns";
import { ptBR } from 'date-fns/locale';
import { Pet } from "@/api/entities";
import useCustomerStore from "@/stores/customerStore";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/use-toast";
import { CalendarIcon, Loader2, X, Clock, CheckCircle, UserCheck, PlayCircle, Ban, AlertTriangle, MessageSquareText, HelpCircle } from "lucide-react";
import { useForm } from "react-hook-form";
import PropTypes from 'prop-types';
import { Timestamp, collection, query, where, getDocs, doc, updateDoc, addDoc, deleteDoc } from 'firebase/firestore';
import { Check, ChevronsUpDown } from "lucide-react";
import { httpsCallable } from "firebase/functions";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { db, functions } from '@/lib/firebaseConfig';

// Funções callable (Mantenha as que você precisa)
// const getPetByIdCallable = httpsCallable(functions, 'getPetById');

// Define Status Styles Locally for easy access
const statusStyles = {
  scheduled: { label: 'Agendado', color: 'bg-blue-100 text-blue-800 border-blue-300', Icon: Clock },
  pending_confirmation: { label: 'Aguard. Conf.', color: 'bg-cyan-100 text-cyan-700 border-cyan-400', Icon: HelpCircle },
  confirmed: { label: 'Confirmado', color: 'bg-green-100 text-green-800 border-green-300', Icon: CheckCircle },
  arrived: { label: 'Chegou', color: 'bg-yellow-100 text-yellow-800 border-yellow-300', Icon: UserCheck },
  in_progress: { label: 'Em Atend.', color: 'bg-purple-100 text-purple-800 border-purple-300', Icon: PlayCircle }, // Shortened label
  // completed: { label: 'Concluído', color: 'bg-gray-200 text-gray-700 border-gray-400', Icon: CheckCircle }, // Maybe add later
  canceled: { label: 'Cancelado', color: 'bg-red-100 text-red-800 border-red-300 opacity-70', Icon: Ban }, // Removed line-through
  no_show: { label: 'Faltou', color: 'bg-orange-100 text-orange-800 border-orange-300', Icon: AlertTriangle },
  // Default/fallback style
  default: { label: 'Desconhecido', color: 'bg-gray-100 text-gray-600 border-gray-300', Icon: AlertTriangle }
};

// Define which statuses are actionable via buttons
const actionableStatuses = ['scheduled', 'pending_confirmation', 'confirmed', 'arrived', 'in_progress', 'canceled', 'no_show'];

const getInitialFormValues = (initialData) => {
  const startDate = initialData?.start ? new Date(initialData.start) : new Date();
  const defaultEndTime = format(addMinutes(startDate, 60), "HH:mm"); 

  return {
      pet_id: initialData?.pet_id || "",
      customer_id: initialData?.customer_id || "",
      service_id: initialData?.service_id || "",
      professionalId: initialData?.professionalId || "",
      date: startDate,
      startTime: format(startDate, "HH:mm"),
      endTime: initialData?.end ? format(new Date(initialData.end), "HH:mm") : defaultEndTime,
      notes: initialData?.notes || "",
      status: initialData?.status || "scheduled",
      service_type: initialData?.type || initialData?.service_type || "clinica",
      specialty_id: initialData?.specialty_id || "",
      requester_type: initialData?.requester_type || "Proprietário",
      referring_clinic_name: initialData?.referring_clinic_name || "",
      price_table_id: initialData?.price_table_id || "",
      price: initialData?.price || 0,
      transport_required: initialData?.transport_required || false,
      secondary_procedures_notes: initialData?.secondary_procedures_notes || ""
  };
};

const AppointmentForm = ({ isOpen = false, onClose = () => {}, onSave = async () => {}, initialData = null, professionals = [] }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [pets, setPets] = useState([]);
  const [services, setServices] = useState([]);
  const [isEditing, setIsEditing] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [appointmentDuration, setAppointmentDuration] = useState(60);
  const [currentSpecialties, setCurrentSpecialties] = useState([]);
  const [isCustomerPopoverOpen, setIsCustomerPopoverOpen] = useState(false);
  const [isSendingWaha, setIsSendingWaha] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const { customers, fetchCustomers, isLoading: loadingCustomers } = useCustomerStore();

  const form = useForm({
      defaultValues: getInitialFormValues(null) // Define valores iniciais
  });

  // Watch the current status field for highlighting buttons
  const currentStatus = form.watch('status'); 
  const currentProfessionalId = form.watch('professionalId'); // Watch professionalId

  useEffect(() => {
    if (!currentProfessionalId) {
      setCurrentSpecialties([]);
      return;
    }
    const selectedProf = professionals.find(p => p.id === currentProfessionalId);
    if (selectedProf && selectedProf.tipo === 'veterinario' && selectedProf.specialties && selectedProf.specialties.length > 0) {
      console.log(`[Specialty Effect Simplified] Setting specialties for ${selectedProf.title}:`, selectedProf.specialties);
      setCurrentSpecialties(selectedProf.specialties);
    } else {
      console.log(`[Specialty Effect Simplified] Clearing specialties for ${selectedProf?.title}`);
      setCurrentSpecialties([]);
    }
  }, [currentProfessionalId, professionals]);

  const loadPets = useCallback(async (customerId) => {
    if (!customerId) {
        setPets([]);
        return;
    }
    console.log(`[loadPets] Loading pets for customer ${customerId}`);
    try {
      const petsData = await Pet.filter(customerId);
      console.log("[loadPets] Pets loaded:", petsData);
      setPets(petsData || []);
    } catch (error) {
      console.error("Erro ao carregar pets:", error);
      toast({ title: "Erro", description: "Não foi possível carregar os pets.", variant: "destructive" });
      setPets([]);
    }
  }, []);

  const loadServices = useCallback(async (serviceType) => {
    if (!serviceType) {
        setServices([]);
        return;
    }
    const tenantId = localStorage.getItem('current_tenant');
    if (!tenantId) {
        console.error("[loadServices] Tenant ID não encontrado.");
        toast({ title: "Erro", description: "ID da loja não encontrado.", variant: "destructive"});
        setServices([]);
        return;
    }
    console.log(`[loadServices] Loading services type '${serviceType}' for tenant '${tenantId}'`);
    try {
      const servicesCollection = collection(db, 'services');
      const q = query(
        servicesCollection,
        where("tenant_id", "==", tenantId),
        where("module", "==", serviceType),
        where("is_active", "==", true)
      );
      const querySnapshot = await getDocs(q);
      const servicesData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      console.log(`[loadServices] Services loaded for ${serviceType}:`, servicesData);
      setServices(servicesData || []);
    } catch (error) {
      console.error("Erro detalhado ao carregar serviços:", error);
      toast({ title: "Erro", description: "Não foi possível carregar os serviços.", variant: "destructive" });
      setServices([]);
    } 
  }, []);

  const handleCustomerChange = useCallback(async (customerId) => {
      console.log(`[handleCustomerChange] Customer changed to: ${customerId}`);
      form.setValue("pet_id", "");
    setIsLoading(true);
    await loadPets(customerId);
    setIsLoading(false);
  }, [form, loadPets]); 

  const recalculateEndTime = useCallback((startTimeString, durationMinutes, selectedDate) => {
    if (!startTimeString || !selectedDate || !durationMinutes || durationMinutes <= 0) {
        console.warn("[recalculateEndTime] Invalid input:", { startTimeString, durationMinutes, selectedDate });
        return null;
    }
    try {
        // Ensure date is a Date object
        const dateObj = selectedDate instanceof Date ? selectedDate : new Date(selectedDate);
        if (isNaN(dateObj.getTime())) {
            console.error("[recalculateEndTime] Invalid date object:", selectedDate);
            return null;
        }

        const [startH, startM] = startTimeString.split(':').map(Number);
        if (isNaN(startH) || isNaN(startM)) {
            console.error("[recalculateEndTime] Invalid startTimeString format:", startTimeString);
            return null;
        }

        const startDateTime = new Date(dateObj);
        startDateTime.setHours(startH, startM, 0, 0);
        
        const newEndDateTime = addMinutes(startDateTime, durationMinutes);
        return format(newEndDateTime, "HH:mm");
    } catch (err) {
        console.error("[recalculateEndTime] Error:", err);
        return null;
    }
  }, []);

  // --- useEffect para resetar e carregar dados ao abrir/fechar --- 
  useEffect(() => {
    if (!isOpen) {
      console.log("[AppointmentForm Close Effect] Resetting state.");
      form.reset(getInitialFormValues(null));
      setIsEditing(false);
      setPets([]);
      setServices([]);
      setCurrentSpecialties([]);
      setAppointmentDuration(60);
      setIsInitializing(true);
      return;
    }

    console.log("[AppointmentForm Open Effect] Initializing...");
            setIsLoading(true);
            setIsInitializing(true);
    const editing = !!initialData?.appointmentId;
    setIsEditing(editing);

            const tenantId = localStorage.getItem('current_tenant');
            if (!tenantId) {
                toast({ title: "Erro", description: "ID da loja não encontrado.", variant: "destructive"});
                setIsLoading(false);
                setIsInitializing(false);
                return;
            }

    const loadCoreData = async () => {
        console.log("[AppointmentForm Open Effect] Loading core data...");
            try {
                const customerPromise = fetchCustomers({ tenant_id: tenantId });
                const serviceTypeToLoad = initialData?.service_type || initialData?.type || 'clinica';
                const servicesPromise = loadServices(serviceTypeToLoad);
            const petsPromise = editing && initialData?.customer_id
                ? loadPets(initialData.customer_id)
                : Promise.resolve();

            await Promise.all([
                    customerPromise,
                    servicesPromise,
                    petsPromise
                ]);
            console.log("[AppointmentForm Open Effect] Core data loading promises resolved."); 

        } catch (error) {
             console.error("[AppointmentForm Open Effect] Error during data loading:", error);
             toast({ title: "Erro", description: "Falha ao carregar dados necessários.", variant: "destructive" });
             setIsLoading(false); 
             setIsInitializing(false); 
        } finally {
            console.log("[AppointmentForm Open Effect] Finished.");
            setIsLoading(false);
            setTimeout(() => {
                setIsInitializing(false);
                console.log("[AppointmentForm Open Effect FINALLY] isInitializing set to false.");
            }, 50); 
        }
    };

    loadCoreData();

    return () => {
        setPets([]);
        setServices([]);
    }

  }, [isOpen, initialData, fetchCustomers, loadServices, loadPets, form, toast]);

  // --- Effect 2: Reset Form When Core Data (excluding specialties) is Ready ---
  useEffect(() => {
    // Exit if modal is not open or still loading base data
    if (!isOpen || isLoading) {
      return;
    }

    // Determine if base data required for reset is ready (Customers, Services, Pets if needed)
    const customersReady = customers.length > 0 || !isEditing; // Customers always needed or if creating new
    const servicesReady = services.length > 0 || !isEditing; // Services always needed or if creating new
    const petsReady = (isEditing && initialData?.customer_id) ? pets.length > 0 : true; // Pets ready if not needed or loaded

    console.log(`[Form Reset Effect - Part 1] Checking base readiness: isOpen=${isOpen}, isLoading=${isLoading}, customersReady=${customersReady}, servicesReady=${servicesReady}, petsReady=${petsReady}, isEditing=${isEditing}`);

    // Proceed only if BASE data (without specialties) is ready
    if (customersReady && servicesReady && petsReady) {
      console.log("[Form Reset Effect - Part 1] Base data ready. Performing form.reset...");

      let calculatedEndTime = null;
      const baseValues = getInitialFormValues(initialData || null);

      if (baseValues.service_id && services.length > 0) {
        const selectedService = services.find(s => s.id === baseValues.service_id);
        const duration = selectedService?.duration || 60;
        setAppointmentDuration(duration);
        calculatedEndTime = recalculateEndTime(baseValues.startTime, duration, baseValues.date);
                    } else {
        setAppointmentDuration(60);
        calculatedEndTime = recalculateEndTime(baseValues.startTime, 60, baseValues.date);
      }

      const finalEndTime = initialData?.end
        ? format(new Date(initialData.end), "HH:mm")
        : (calculatedEndTime || baseValues.endTime);

      const finalResetValues = {
        ...baseValues,
        endTime: finalEndTime,
      };

      // Reset the form HERE, without waiting for specialties
      form.reset(finalResetValues);
      console.log("[Form Reset Effect - Part 1] form.reset performed with:", finalResetValues);

                        } else {
      console.log("[Form Reset Effect - Part 1] Waiting for base data...");
      // Keep initializing true if base data isn't ready, might need reset if reopening?
      // if (!isInitializing) setIsInitializing(true); // Let the next effect handle initializing flag
    }

  // Dependencies: React ONLY to modal opening and initialData changes.
  // The necessary lists (customers, services) should be available from Effect 1 by the time this runs.
  }, [isOpen, initialData, form, isEditing, services, customers, recalculateEndTime, setAppointmentDuration]);

  // --- Effect 3: Set Initializing Flag when ALL Data (including specialties if required) is Ready ---
  useEffect(() => {
      // If modal closed, ensure initializing is true
      if (!isOpen) {
          if (!isInitializing) setIsInitializing(true);
          return;
      }

      // If still loading core data, keep initializing true
      if (isLoading) {
          if (!isInitializing) setIsInitializing(true);
          return;
      }

      // Check readiness of all required data streams
      const customersReady = customers.length > 0 || !isEditing;
      const servicesReady = services.length > 0 || !isEditing;
      const petsReady = (isEditing && initialData?.customer_id) ? pets.length > 0 : true;
      const professionalRequiresSpecialties = isEditing && initialData?.professionalId && professionals.find(p => p.id === initialData.professionalId)?.specialties?.length > 0;
      const specialtiesReady = professionalRequiresSpecialties ? currentSpecialties.length > 0 : true;

      console.log(`[Form Init Effect - Part 2] Checking FINAL readiness: customersReady=${customersReady}, servicesReady=${servicesReady}, petsReady=${petsReady}, professionalRequiresSpecialties=${professionalRequiresSpecialties}, specialtiesReady=${specialtiesReady}`);

      // Set initializing to false ONLY when everything is confirmed ready
      if (customersReady && servicesReady && petsReady && specialtiesReady) {
          console.log("[Form Init Effect - Part 2] All data confirmed ready. Setting isInitializing=false.");
          setIsInitializing(false);
      } else {
          console.log("[Form Init Effect - Part 2] Waiting for full data readiness...");
          // Ensure initializing stays true if anything is still pending
          if (!isInitializing) setIsInitializing(true);
      }

  // This effect depends on all data streams and loading/editing states
  }, [isOpen, isLoading, isEditing, initialData, customers, services, pets, professionals, currentSpecialties, isInitializing]);

  // --- Effect for ESC Key Handling ---
  useEffect(() => {
    if (!isOpen) return; // Only run when modal is open

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        console.log("[ESC Handler] ESC key pressed. Checking form dirtiness...");
        if (form.formState.isDirty) {
            console.log("[ESC Handler] Form is dirty. Asking for confirmation.");
          if (window.confirm("Você tem alterações não salvas. Deseja fechar mesmo assim?")) {
            console.log("[ESC Handler] User confirmed closing with dirty form.");
            onClose(); // Close if user confirms
          } else {
            console.log("[ESC Handler] User cancelled closing with dirty form.");
            // Do nothing if user cancels
          }
        } else {
          console.log("[ESC Handler] Form is not dirty. Closing directly.");
          onClose(); // Close directly if form is not dirty
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    console.log("[ESC Handler] Event listener added.");

    // Cleanup function
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      console.log("[ESC Handler] Event listener removed.");
    };
  // Depend on isOpen, onClose, and formState (specifically isDirty)
  }, [isOpen, onClose, form.formState.isDirty]); // Re-run if isDirty changes while modal is open

  const onSubmit = async (formData) => {
    console.log("[onSubmit] Form data received:", formData);
    setIsLoading(true);

    const { 
      date, 
      startTime, 
      endTime, 
      customer_id, 
      pet_id, 
      service_id, 
      professionalId, 
      notes, 
      specialty_id,
      requester_type,
      referring_clinic_name,
      price_table_id,
      price,
      transport_required,
      secondary_procedures_notes,
      status: currentStatus 
    } = formData;

    if (!customer_id || !pet_id || !service_id || !professionalId || !date || !startTime || !endTime) {
        toast({ title: "Campos Obrigatórios", description: "Preencha Cliente, Pet, Serviço, Profissional, Data e Horários.", variant: "destructive" });
        setIsLoading(false);
        return;
    }

    const selectedCustomer = customers.find(c => c.id === customer_id);
    const selectedPet = pets.find(p => p.id === pet_id);
    const selectedService = services.find(s => s.id === service_id);
    const selectedProfessional = professionals.find(prof => prof.id === professionalId);

    if (!selectedCustomer || !selectedPet || !selectedService || !selectedProfessional) {
        toast({ title: "Erro de Seleção", description: "Não foi possível encontrar os dados selecionados (Cliente, Pet, Serviço ou Profissional). Tente recarregar.", variant: "destructive" });
        setIsLoading(false);
        return;
    }

    let startDateTime, endDateTime;
    try {
        const [startH, startM] = startTime.split(':').map(Number);
        startDateTime = new Date(date);
    startDateTime.setHours(startH, startM, 0, 0);

        const [endH, endM] = endTime.split(':').map(Number);
        endDateTime = new Date(date);
    endDateTime.setHours(endH, endM, 0, 0);

    if (isBefore(endDateTime, startDateTime)) {
            toast({ title: "Horário Inválido", description: "A hora final deve ser depois da hora inicial.", variant: "destructive" });
            setIsLoading(false);
            return;
        }
    } catch (err) {
        console.error("Error parsing date/time:", err);
        toast({ title: "Erro de Horário", description: "Formato de hora inválido.", variant: "destructive" });
        setIsLoading(false);
        return;
    }
    
    const tenantId = localStorage.getItem('current_tenant');
    if (!tenantId) {
        toast({ title: "Erro", description: "ID da loja não encontrado para salvar.", variant: "destructive" });
      setIsLoading(false);
      return;
    }

    const appointmentData = { 
        tenant_id: tenantId,
        customer_id: customer_id,
        customer_name: selectedCustomer.full_name || 'Cliente Desconhecido',
        pet_id: pet_id,
        pet_name: selectedPet.name || 'Pet Desconhecido',
        service_id: service_id,
        service_name: selectedService.name || 'Serviço Desconhecido',
        service_type: selectedService.module || 'clinica',
        professionalId: professionalId,
        professionalName: selectedProfessional.title || 'Profissional Desconhecido',
        specialty_id: specialty_id || null,
      start_time: Timestamp.fromDate(startDateTime),
      end_time: Timestamp.fromDate(endDateTime),
        notes: notes || "",
        requester_type: requester_type,
        referring_clinic_name: referring_clinic_name || "",
        price_table_id: price_table_id || "",
        price: Number(price) || 0,
        transport_required: transport_required || false,
        secondary_procedures_notes: secondary_procedures_notes || "",
        status: isEditing ? currentStatus : "scheduled", 
        updated_at: Timestamp.now()
     };

     if (!isEditing) { appointmentData.created_at = Timestamp.now(); }

     console.log("[onSubmit] Final data being sent to Firestore:", JSON.stringify(appointmentData, null, 2));

    try {
      const appointmentsCollection = collection(db, 'appointments');
      let savedAppointmentId = null; 
      
      if (isEditing && initialData?.appointmentId) {
          console.log("[AppointmentForm] Updating appointment:", initialData.appointmentId);
          const appointmentRef = doc(db, "appointments", initialData.appointmentId);
          await updateDoc(appointmentRef, appointmentData);
          savedAppointmentId = initialData.appointmentId;
          toast({ title: "Sucesso", description: "Agendamento atualizado." });
      } else {
          console.log("[AppointmentForm] Creating new appointment...");
          const docRef = await addDoc(appointmentsCollection, appointmentData);
          savedAppointmentId = docRef.id;
          console.log("[AppointmentForm] New appointment created with ID:", savedAppointmentId);
          toast({ title: "Sucesso", description: "Agendamento criado." });
      }
      await onSave(appointmentData, isEditing, savedAppointmentId);
      onClose();
    } catch (error) {
      console.error("Erro ao salvar agendamento:", error);
      toast({ title: "Erro ao Salvar", description: `Não foi possível salvar o agendamento. Detalhes: ${error.message}`, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendWahaClick = async () => {
    if (!isEditing || !initialData?.appointmentId) {
        toast({ title: "Erro", description: "ID do agendamento não encontrado.", variant: "destructive"});
        return;
    }
    if (initialData.status !== 'scheduled' && initialData.status !== 'confirmed') {
         toast({ title: "Ação não permitida", description: "Só é possível enviar confirmação para agendamentos Programados ou Confirmados.", variant: "warning"});
        return;
    }

    setIsSendingWaha(true);
    console.log(`[AppointmentForm] Chamando sendWahaConfirmation para ID: ${initialData.appointmentId}`);
    try {
        const sendWahaConfirmation = httpsCallable(functions, 'sendWahaConfirmation');
        const result = await sendWahaConfirmation({ appointmentId: initialData.appointmentId });

        console.log("[AppointmentForm] Resultado da Cloud Function:", result.data);

        if (result.data.success) {
             toast({ title: "Sucesso", description: result.data.message || "Mensagem de confirmação enviada!" });
             form.setValue('status', 'pending_confirmation', { shouldDirty: true, shouldValidate: true });
    } else {
             throw new Error(result.data.message || "Falha ao enviar mensagem via Cloud Function.");
        }
    } catch (error) {
        console.error("[AppointmentForm] Erro ao chamar sendWahaConfirmation:", error);
        const errorMessage = error.message || "Ocorreu um erro desconhecido ao enviar a confirmação.";
        toast({ title: "Erro ao Enviar", description: errorMessage, variant: "destructive"});
    } finally {
        setIsSendingWaha(false);
    }
  };

  const handleDelete = async () => {
    if (!isEditing || !initialData?.appointmentId) {
      toast({ title: "Erro", description: "ID do agendamento não encontrado para remoção.", variant: "destructive"});
      return;
    }

    const appointmentIdToDelete = initialData.appointmentId;

    if (window.confirm("Tem certeza que deseja remover este agendamento permanentemente? Esta ação não pode ser desfeita.")) {
      console.log(`[handleDelete] Attempting to delete appointment: ${appointmentIdToDelete}`);
      setIsDeleting(true);
      try {
        const appointmentRef = doc(db, "appointments", appointmentIdToDelete);
        await deleteDoc(appointmentRef);
        console.log(`[handleDelete] Appointment ${appointmentIdToDelete} deleted successfully.`);
        toast({ title: "Sucesso", description: "Agendamento removido permanentemente." });
        onClose(); // Fecha o modal após a exclusão
        // A AgendaPage deve atualizar automaticamente via onSnapshot
    } catch (error) {
        console.error(`[handleDelete] Error deleting appointment ${appointmentIdToDelete}:`, error);
        toast({ title: "Erro ao Remover", description: `Não foi possível remover o agendamento: ${error.message}`, variant: "destructive" });
    } finally {
        setIsDeleting(false);
      }
    } else {
        console.log("[handleDelete] Deletion cancelled by user.");
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 md:p-6 lg:p-8">
      <Card className="w-full max-w-[95vw] h-full max-h-[95vh] overflow-y-auto relative flex flex-col">
        <Button 
            variant="ghost" 
            size="icon" 
            onClick={onClose} 
            className="absolute top-2 right-2 md:top-4 md:right-4 text-gray-500 hover:text-gray-800 z-10"
            aria-label="Fechar modal"
        >
            <X className="h-5 w-5" />
          </Button>
        <CardHeader className="flex-shrink-0">
          <CardTitle>{isEditing ? "Editar Agendamento" : "Novo Agendamento"}</CardTitle>
        </CardHeader>
        <CardContent className="flex-grow overflow-y-auto pr-6 pl-6 pb-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">

             {/* --- Status Buttons (Only when Editing) --- */}
             {isEditing && (
                <div className="space-y-2">
                  <FormLabel>Status</FormLabel>
                  <div className="flex flex-wrap gap-2">
                    {actionableStatuses.map((statusKey) => {
                      const style = statusStyles[statusKey] || statusStyles.default;
                      const IconComponent = style.Icon;
                      const isCurrent = currentStatus === statusKey;
                      return (
                        <Button
                          key={statusKey}
                          type="button"
                          variant={isCurrent ? 'default' : 'outline'}
                          size="xs"
                          className={cn(
                            "h-auto px-2 py-1 text-xs border transition-all",
                            style.color,
                            isCurrent ? "ring-2 ring-offset-1 ring-indigo-500" : "opacity-70 hover:opacity-90"
                          )}
                          onClick={() => {
                            form.setValue('status', statusKey, { shouldDirty: true, shouldValidate: true });
                          }}
                          aria-pressed={isCurrent}
                        >
                          {IconComponent && <IconComponent className="w-3 h-3 mr-1 flex-shrink-0" />} 
                          {style.label}
                        </Button>
                      );
                    })}
                  </div>
                <FormField
                  control={form.control}
                    name="status" 
                    render={({ field }) => <Input type="hidden" {...field} />}
                  />
                </div>
             )}
             {/* --- End Status Buttons --- */}

              {/* --- Main Fields Grid (adjust cols and spans) --- */}
              {/* Row 1: Customer(Combobox), Pet, Service, Professional */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Customer (Combobox lg:col-span-1) */}
                <FormField
                  control={form.control}
                  name="customer_id"
                  render={({ field }) => (
                    <FormItem className="lg:col-span-1">
                      <FormLabel>Cliente *</FormLabel>
                      <Popover open={isCustomerPopoverOpen} onOpenChange={setIsCustomerPopoverOpen}>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              role="combobox"
                              aria-expanded={isCustomerPopoverOpen}
                              className={cn(
                                "w-full justify-between",
                                !field.value && "text-muted-foreground"
                              )}
                              disabled={isInitializing || loadingCustomers}
                            >
                              {field.value
                                ? customers.find(
                                    (customer) => customer.id === field.value
                                  )?.full_name
                                : "Selecione ou digite..."}
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-[--radix-popover-trigger-width] max-h-[--radix-popover-content-available-height] p-0">
                          <Command shouldFilter={false}> {/* Disable default filtering, we'll filter manually */}
                            <CommandInput 
                              placeholder="Buscar cliente..."
                              onValueChange={(search) => {
                                // Optional: Implement dynamic fetching/filtering here if needed
                                // For now, filtering is handled visually by mapping below
                                console.log("Customer search:", search); 
                              }}
                            />
                             {/* Display Loading state */}
                            {loadingCustomers && (
                              <div className="p-2 text-center text-sm text-muted-foreground">Carregando...</div>
                            )}
                            <CommandList>
                             <CommandEmpty>Nenhum cliente encontrado.</CommandEmpty>
                              <CommandGroup>
                                {customers
                                  // Simple client-side filter (adjust if fetching dynamically)
                                  // .filter(customer => customer.full_name.toLowerCase().includes(commandInputRef?.current?.value?.toLowerCase() || ''))
                                  .map((customer) => (
                                    <CommandItem
                                      value={customer.id} // Use ID for value
                                      key={customer.id}
                                      onSelect={(currentValue) => {
                                        field.onChange(currentValue === field.value ? "" : currentValue);
                                        handleCustomerChange(currentValue === field.value ? "" : currentValue);
                                        setIsCustomerPopoverOpen(false);
                                      }}
                                    >
                                      <Check
                                        className={cn(
                                          "mr-2 h-4 w-4",
                                          field.value === customer.id ? "opacity-100" : "opacity-0"
                                        )}
                                      />
                                      {customer.full_name}
                                    </CommandItem>
                                ))}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Pet (lg:col-span-1) */}
                <FormField
                  control={form.control}
                  name="pet_id"
                  render={({ field }) => {
                    return (
                      <FormItem className="lg:col-span-1">
                        <FormLabel>Pet *</FormLabel>
                        <Select 
                            onValueChange={field.onChange} 
                        value={field.value}
                            disabled={!form.getValues("customer_id") || isLoading || isInitializing}
                      >
                        <FormControl>
                          <SelectTrigger>
                              <SelectValue placeholder={!form.getValues("customer_id") ? "Selecione um cliente primeiro" : "Selecione o pet"} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                            {pets.map((pet) => (
                              <SelectItem key={pet.id} value={pet.id}>
                                {pet.name} ({pet.breed})
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                    );
                  }}
                />

                {/* Service (lg:col-span-1) */}
                <FormField
                  control={form.control}
                  name="service_id"
                  render={({ field }) => {
                     return (
                       <FormItem className="lg:col-span-1">
                         <FormLabel>Serviço *</FormLabel>
                      <Select
                        onValueChange={(value) => {
                            field.onChange(value);
                            const selectedService = services.find(s => s.id === value);
                                   const duration = selectedService?.duration || 60;
                                   console.log(`[Service Change Handler] Service changed to ${value}. Found duration: ${duration}`);
                                   setAppointmentDuration(duration);

                                   const currentStartTime = form.getValues('startTime');
                                   const currentDate = form.getValues('date');
                                   const newEndTime = recalculateEndTime(currentStartTime, duration, currentDate);
                            if (newEndTime) {
                                 console.log(`[Service Change Handler] Set endTime to: ${newEndTime}`);
                                       form.setValue('endTime', newEndTime);
                            }
                        }}
                        value={field.value}
                               disabled={isInitializing}
                      >
                        <FormControl>
                          <SelectTrigger>
                               <SelectValue placeholder="Selecione o serviço" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                             {services.map((service) => (
                               <SelectItem key={service.id} value={service.id}>
                                 {service.name} ({service.duration} min)
                               </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                     );
                  }}
                />
                {/* Professional (lg:col-span-1) - MOVED HERE */}
                <FormField
                    control={form.control}
                  name="professionalId"
                  render={({ field }) => {
                     return (
                       <FormItem className="lg:col-span-1">
                         <FormLabel>Profissional *</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                             disabled={isInitializing}
                      >
                        <FormControl>
                          <SelectTrigger>
                               <SelectValue placeholder="Selecione o profissional" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                             {professionals.map((prof) => (
                               <SelectItem key={prof.id} value={prof.id}>
                                 {prof.title} {prof.tipo ? `(${prof.tipo})` : ''}
                               </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                     );
                  }}
                />
              </div>
              
              {/* --- Specialty, Date, Time Grid --- */}
              {/* Row 2: Specialty(1), Date(1), Start Time(1), End Time(1) */}
              {/* Added items-end for vertical alignment */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
                {/* Specialty (lg:col-span-1) */}
              <FormField
                control={form.control}
                  name="specialty_id"
                  render={({ field }) => {
                     return (
                       <FormItem className="lg:col-span-1">
                          <FormLabel>Especialidade</FormLabel>
                    <Select
                        onValueChange={field.onChange}
                        value={field.value}
                               disabled={isInitializing || currentSpecialties.length === 0}
                    >
                      <FormControl>
                        <SelectTrigger>
                                 <SelectValue placeholder={currentSpecialties.length === 0 ? "Nenhuma especialidade disponível" : "Selecione a especialidade (opcional)"} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                                {currentSpecialties.map((spec) => (
                                  <SelectItem key={spec} value={spec}>
                                    {spec}
                                  </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                       );
                  }}
              />
                 {/* Date (lg:col-span-1) - MOVED HERE */}
                  <FormField
                    control={form.control}
                    name="date"
                    render={({ field }) => (
                      <FormItem className="flex flex-col lg:col-span-1">
                        <FormLabel>Data *</FormLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant={"outline"}
                              className={`w-full pl-3 text-left font-normal ${
                                !field.value && "text-muted-foreground"
                              }`}
                              disabled={isInitializing}
                            >
                              {field.value ? (
                                format(field.value, "PPP", { locale: ptBR }) 
                              ) : (
                                <span>Escolha uma data</span>
                              )}
                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={field.value}
                              onSelect={(date) => {
                                  field.onChange(date);
                                const currentStartTime = form.getValues('startTime');
                                const currentDate = form.getValues('date'); 
                                const newEndTime = recalculateEndTime(currentStartTime, appointmentDuration, currentDate);
                                if (newEndTime) {
                                    console.log(`[Date Change Handler] Date changed, set endTime to: ${newEndTime}`);
                                    form.setValue('endTime', newEndTime);
                                }
                            }}
                            disabled={(date) => date < new Date().setHours(0,0,0,0) || isInitializing}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                 {/* Start Time (lg:col-span-1) - MOVED HERE */}
                  <FormField
                    control={form.control}
                    name="startTime"
                    render={({ field }) => (
                      <FormItem className="lg:col-span-1">
                        <FormLabel>Hora Início *</FormLabel>
                        <FormControl>
                          <Input 
                              type="time" 
                              {...field} 
                              onChange={(e) => {
                                  field.onChange(e.target.value);
                                  const currentDate = form.getValues('date');
                                  const newEndTime = recalculateEndTime(e.target.value, appointmentDuration, currentDate);
                               if (newEndTime) {
                                      console.log(`[StartTime Change Handler] Start time changed, set endTime to: ${newEndTime}`);
                                   form.setValue('endTime', newEndTime);
                               }
                              }}
                              disabled={isInitializing} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                {/* End Time (lg:col-span-1) - MOVED HERE */}
                  <FormField
                    control={form.control}
                    name="endTime"
                  render={({ field }) => (
                    <FormItem className="lg:col-span-1">
                      <FormLabel>Hora Fim *</FormLabel>
                      <FormControl>
                         <Input 
                            type="time" 
                            {...field} 
                            readOnly 
                            disabled={isInitializing} 
                            className="bg-gray-100" 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              {/* Additional Details Grid 1 (adjust cols - already lg:grid-cols-4) */}
              {/* Add some top margin to visually separate from the row above now that h3 is gone */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pt-6">
                <FormField
                  control={form.control}
                  name="requester_type"
                    render={({ field }) => (
                      <FormItem>
                      <FormLabel>Tipo Solicitante</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value} disabled={isInitializing}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione o tipo" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="Proprietário">Proprietário</SelectItem>
                          <SelectItem value="Clínica">Clínica Indicadora</SelectItem>
                          <SelectItem value="Outro">Outro</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="referring_clinic_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome Clínica Indicadora</FormLabel>
                      <FormControl>
                        <Input placeholder="Nome da clínica (se aplicável)" {...field} disabled={isInitializing} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="price_table_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tabela de Preço</FormLabel>
                      <FormControl>
                        <Input placeholder="Nome/ID da tabela" {...field} disabled={isInitializing} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
              </div>

               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
                  <FormField
                    control={form.control}
                    name="price"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Valor (R$)</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            step="0.01" 
                            placeholder="0.00" 
                            {...field} 
                            onChange={e => field.onChange(parseFloat(e.target.value) || 0)}
                            disabled={isInitializing} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="transport_required"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center space-x-2 pb-2 lg:col-span-1">
                         <FormControl>
                           <Checkbox
                             checked={field.value}
                             onCheckedChange={field.onChange}
                             disabled={isInitializing}
                           />
                         </FormControl>
                         <FormLabel className="!mt-0">Necessita Transporte?</FormLabel>
                      </FormItem>
                    )}
                  />
              </div>

              <FormField
                control={form.control}
                name="secondary_procedures_notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Procedimentos Secundários / Obs. Adicionais</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Descreva serviços adicionais ou observações relevantes..."
                        className="resize-y"
                        {...field}
                        disabled={isInitializing}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Observações Internas</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Observações internas sobre o agendamento..."
                        className="resize-y"
                        {...field}
                        disabled={isInitializing}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

             {/* --- Botão de Confirmação WhatsApp --- */}
             {isEditing && (currentStatus === 'scheduled' || currentStatus === 'confirmed') && (
                <div className="mt-6 pt-6 border-t"> {/* Linha divisória e espaçamento */} 
                  <Button
                    type="button" // Importante: não submeter o form
                    variant="outline"
                    onClick={handleSendWahaClick} // Função que definimos antes
                    disabled={isSendingWaha || isInitializing} // Estados que definimos antes
                    className="text-green-700 border-green-500 hover:bg-green-50" // Estilo sugerido
                  >
                    {isSendingWaha ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <MessageSquareText className="mr-2 h-4 w-4" />} 
                    {isSendingWaha ? "Enviando..." : "Confirmar por WhatsApp"}
                  </Button>
                  <p className="text-xs text-muted-foreground mt-1">Envia uma mensagem de confirmação para o cliente via WAHA.</p>
                </div>
             )}
             {/* --- Fim Botão WhatsApp --- */} 

              {/* Botões de Ação Finais */}
              <div className="flex justify-end space-x-4 pt-4 border-t mt-6">
                <Button type="button" variant="outline" onClick={handleDelete} disabled={isLoading || isInitializing || isDeleting || isSendingWaha} className="w-full sm:w-auto">
                  {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Remover
                </Button>
                <Button type="button" variant="outline" onClick={onClose} disabled={isLoading || isInitializing}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={isLoading || isInitializing}>
                  {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  {isEditing ? "Salvar Alterações" : "Criar Agendamento"}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}

AppointmentForm.propTypes = {
  isOpen: PropTypes.bool,
  onClose: PropTypes.func,
  onSave: PropTypes.func,
  initialData: PropTypes.shape({
    appointmentId: PropTypes.string,
    pet_id: PropTypes.string,
    customer_id: PropTypes.string,
    service_id: PropTypes.string,
    professionalId: PropTypes.string,
    start: PropTypes.oneOfType([PropTypes.instanceOf(Date), PropTypes.string]),
    end: PropTypes.oneOfType([PropTypes.instanceOf(Date), PropTypes.string]),
    notes: PropTypes.string,
    status: PropTypes.string,
    type: PropTypes.string,
    service_type: PropTypes.string,
    specialty_id: PropTypes.string,
    requester_type: PropTypes.string,
    referring_clinic_name: PropTypes.string,
    price_table_id: PropTypes.string,
    price: PropTypes.number,
    transport_required: PropTypes.bool,
    secondary_procedures_notes: PropTypes.string,
  }),
  professionals: PropTypes.array,
};

export default AppointmentForm;