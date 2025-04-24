import { useState, useEffect, useCallback } from "react";
import { format, addMinutes, isFuture, startOfDay, isBefore } from "date-fns";
import { ptBR } from 'date-fns/locale';
import { Pet, Service } from "@/api/entities";
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
import { CalendarIcon, Loader2, X, Clock, CheckCircle, UserCheck, PlayCircle, Ban, AlertTriangle, MessageSquareText, HelpCircle, Briefcase, HeartPulse } from "lucide-react";
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
import { consultationService } from '@/api/firebase/consultationService';

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

const getInitialFormValues = (initialData, tenant) => {
  const startDate = initialData?.start ? new Date(initialData.start) : new Date();
  const defaultEndTime = format(addMinutes(startDate, 60), "HH:mm"); 

  // Determinar módulo inicial padrão
  let defaultServiceModule = 'clinica'; // Padrão se ambos existirem ou nenhum (?)
  if (tenant) {
      if (tenant.hasClinicalModule && !tenant.hasPetshopModule) {
          defaultServiceModule = 'clinica';
      } else if (!tenant.hasClinicalModule && tenant.hasPetshopModule) {
          defaultServiceModule = 'petshop';
      }
      // Se ambos existirem, o usuário escolherá, pode manter 'clinica' como default inicial
  }

  return {
      serviceModule: initialData?.service_type || initialData?.module || defaultServiceModule, 
      pet_id: initialData?.pet_id || "",
      customer_id: initialData?.customer_id || "",
      service_id: initialData?.service_id || "",
      professionalId: initialData?.professionalId || "",
      date: startDate,
      startTime: format(startDate, "HH:mm"),
      endTime: initialData?.end ? format(new Date(initialData.end), "HH:mm") : defaultEndTime,
      notes: initialData?.notes || "",
      status: initialData?.status || "scheduled",
      specialty_id: initialData?.specialty_id || "",
      requester_type: initialData?.requester_type || "Proprietário",
      referring_clinic_name: initialData?.referring_clinic_name || "",
      price_table_id: initialData?.price_table_id || "",
      price: initialData?.price || 0,
      transport_required: initialData?.transport_required || false,
      secondary_procedures_notes: initialData?.secondary_procedures_notes || ""
  };
};

const AppointmentForm = ({ isOpen = false, onClose = () => {}, onSave = async () => {}, initialData = null, professionals = [], tenant }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [pets, setPets] = useState([]);
  const [services, setServices] = useState([]);
  const [isEditing, setIsEditing] = useState(false);
  const [appointmentDuration, setAppointmentDuration] = useState(60);
  const [currentSpecialties, setCurrentSpecialties] = useState([]);
  const [isCustomerPopoverOpen, setIsCustomerPopoverOpen] = useState(false);
  const [isSendingWaha, setIsSendingWaha] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const { customers, fetchCustomers, isLoading: loadingCustomers } = useCustomerStore();

  console.log("--- AppointmentForm RENDER --- Tenant Prop:", tenant, "isLoading:", isLoading);
  console.log("[AppointmentForm Render] Tenant Data from Prop:", tenant);

  // <<< AJUSTAR LÓGICA para usar tenant.selected_modules >>>
  const hasClinic = tenant?.selected_modules?.includes('clinic_management');
  const hasPetshop = tenant?.selected_modules?.includes('petshop');
  const showServiceTypeSelector = !!(hasClinic && hasPetshop);
  // <<< ATUALIZAR LOG >>>
  console.log(`[AppointmentForm Render] Modules: ${JSON.stringify(tenant?.selected_modules)}. HasClinic: ${hasClinic}, HasPetshop: ${hasPetshop}. ShowSelector: ${showServiceTypeSelector}`);

  const form = useForm({
      defaultValues: getInitialFormValues(initialData, tenant)
  });

  const currentStatus = form.watch('status'); 
  const currentProfessionalId = form.watch('professionalId');
  const selectedServiceModule = form.watch('serviceModule');

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

  const loadServices = useCallback(async (moduleToLoad) => {
    if (!moduleToLoad) {
        console.warn("[loadServices] Módulo não fornecido. Limpando serviços.");
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
    console.log(`[loadServices] Loading services for module '${moduleToLoad}' for tenant '${tenantId}'`);
    setServices([]);

    try {
      const servicesCollection = collection(db, 'services');
      const q = query(
        servicesCollection,
        where("tenant_id", "==", tenantId),
        where("module", "==", moduleToLoad),
        where("is_active", "==", true)
      );
      const querySnapshot = await getDocs(q);
      const servicesData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      console.log(`[loadServices] Services loaded for ${moduleToLoad}:`, servicesData);
      setServices(servicesData || []);
    } catch (error) {
      console.error(`Erro detalhado ao carregar serviços para o módulo ${moduleToLoad}:`, error);
      toast({ title: "Erro", description: "Não foi possível carregar os serviços.", variant: "destructive" });
      setServices([]);
    } 
  }, []);

  const handleCustomerChange = useCallback(async (customerId) => {
      console.log(`[handleCustomerChange] Customer changed to: ${customerId}`);
      form.setValue("pet_id", "");
    setIsLoading(true);
    try {
      await loadPets(customerId);
    } catch (error) {
      console.error("[handleCustomerChange] Error during loadPets:", error);
    } finally {
      setIsLoading(false);
    }
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

  useEffect(() => {
    if (!isOpen) {
      console.log("[AppointmentForm Close Effect] Resetting state and form.");
      form.reset(getInitialFormValues(null, null));
      setIsEditing(false);
      setPets([]);
      setServices([]);
      setCurrentSpecialties([]);
      setAppointmentDuration(60);
      setIsLoading(true);
    }
  }, [isOpen, form]);

  useEffect(() => {
    console.log("[DEBUG Service Field] Main useEffect RUNNING. isOpen:", isOpen, "Tenant ID:", tenant?.id, "InitialData Service ID:", initialData?.service_id, "InitialData Service Module:", initialData?.service_type || initialData?.module);

    if (!isOpen) return;
    if (!tenant) {
      console.log("[DEBUG Service Field] Waiting for tenant prop...");
      setIsLoading(true);
      return;
    }

    console.log("[DEBUG Service Field] Tenant prop available. Proceeding...");
    setIsLoading(true);
    const editing = !!initialData?.appointmentId;
    setIsEditing(editing);

    const initialValues = getInitialFormValues(initialData || null, tenant);
    console.log("[DEBUG Service Field] Values used for form.reset:", initialValues);
    form.reset(initialValues);
    console.log("[DEBUG Service Field] Value of service_id AFTER form.reset:", form.getValues('service_id'));

    const loadCoreData = async () => {
        console.log("[DEBUG Service Field] loadCoreData START. Editing:", editing);
        try {
            const tenantId = tenant.id;
            const customerPromise = fetchCustomers({ tenant_id: tenantId });

            let initialModuleToLoad = form.getValues('serviceModule'); 
            console.log(`[DEBUG Service Field] Initial module from form after reset: ${initialModuleToLoad}`);
            const shouldShowSelector = !!(tenant?.selected_modules?.includes('clinic_management') && tenant?.selected_modules?.includes('petshop'));
            if (!shouldShowSelector) { 
               initialModuleToLoad = tenant?.selected_modules?.includes('clinic_management') ? 'clinica' : 'petshop';
               console.log(`[DEBUG Service Field] Overriding module based on single tenant module: ${initialModuleToLoad}`);
               if(form.getValues('serviceModule') !== initialModuleToLoad) {
                   form.setValue('serviceModule', initialModuleToLoad);
                   console.log(`[DEBUG Service Field] form.setValue for serviceModule called.`);
               }
            }
            console.log(`[DEBUG Service Field] Final module to load services for: ${initialModuleToLoad}`);
            const servicesPromise = loadServices(initialModuleToLoad);

            const petsPromise = editing && initialValues.customer_id 
                ? loadPets(initialValues.customer_id)
                : Promise.resolve();

            await Promise.all([
                    customerPromise,
                    servicesPromise, 
                    petsPromise
                ]);
             // <<< LOG APÓS PROMISES RESOLVEREM >>>
            console.log("[DEBUG Service Field] loadCoreData Promises resolved. Current services state:", services);
            console.log("[DEBUG Service Field] Value of service_id AFTER promises:", form.getValues('service_id'));

        } catch (error) {
             console.error("[DEBUG Service Field] loadCoreData Error:", error);
             toast({ title: "Erro", description: "Falha ao carregar dados necessários.", variant: "destructive" });
        } finally {
             console.log("[DEBUG Service Field] loadCoreData FINALLY. Current isLoading state:", isLoading);
             setIsLoading(false);
             console.log("[DEBUG Service Field] loadCoreData FINALLY - setIsLoading(false) called.");
        }
    };

    loadCoreData();

  }, [isOpen, tenant?.id, initialData]);

  useEffect(() => {
      if (!tenant || isLoading || !showServiceTypeSelector || !isOpen) return;

      console.log(`[Service Module Watcher] Module changed to: ${selectedServiceModule}. Reloading services...`);
      loadServices(selectedServiceModule)
          .finally(() => setIsLoading(false));

      // <<< ADICIONAR RESET do service_id AQUI >>>
      // Quando o módulo muda, o serviço anterior não é mais válido.
      console.log("[Service Module Watcher] Resetting service_id field.");
      form.setValue('service_id', ''); 

  }, [tenant, selectedServiceModule, showServiceTypeSelector, isOpen, loadServices]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        console.log("[ESC Handler] ESC key pressed. Checking form dirtiness...");
        if (form.formState.isDirty) {
            console.log("[ESC Handler] Form is dirty. Asking for confirmation.");
          if (window.confirm("Você tem alterações não salvas. Deseja fechar mesmo assim?")) {
            console.log("[ESC Handler] User confirmed closing with dirty form.");
            onClose();
          } else {
            console.log("[ESC Handler] User cancelled closing with dirty form.");
          }
        } else {
          console.log("[ESC Handler] Form is not dirty. Closing directly.");
          onClose();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    console.log("[ESC Handler] Event listener added.");

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      console.log("[ESC Handler] Event listener removed.");
    };
  }, [isOpen, onClose, form.formState.isDirty]);

  const onSubmit = async (formData) => {
    console.log("[onSubmit START] formData received by handleSubmit:", formData);
    console.log("[onSubmit] Form data received:", formData);
    setIsLoading(true);

    const statusAtual = form.getValues('status'); 
    console.log(`[onSubmit] Current status obtained via getValues: ${statusAtual}`);

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
    
    const tenantId = tenant?.id;
    if (!tenantId) {
        toast({ title: "Erro", description: "ID da loja não encontrado para salvar.", variant: "destructive" });
      setIsLoading(false);
      return;
    }

    const serviceModuleType = selectedService?.module || formData.serviceModule || (tenant?.hasClinicalModule ? 'clinica' : 'petshop');

    const appointmentData = { 
        tenant_id: tenantId,
        customer_id: customer_id,
        customer_name: selectedCustomer.full_name || 'Cliente Desconhecido',
        pet_id: pet_id,
        pet_name: selectedPet.name || 'Pet Desconhecido',
        service_id: service_id,
        service_name: selectedService.name || 'Serviço Desconhecido',
        service_type: serviceModuleType,
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
        status: statusAtual,
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

          if (appointmentData.status === 'arrived') {
            try {
              console.log(`[onSubmit] Fetching service details for ID: ${appointmentData.service_id}`);
              const serviceDetails = await Service.get(appointmentData.service_id);
              
              if (serviceDetails?.module === 'clinica') {
                console.log(`[onSubmit] Service is Clinica. Checking/creating consultation for appointment ${savedAppointmentId}...`);
                let existingConsultations = [];
                try {
                  existingConsultations = await consultationService.filter({ appointmentId: savedAppointmentId });
                  console.log(`[onSubmit - Clinica] Found ${existingConsultations.length} existing consultations.`);
                } catch (filterError) {
                  console.error(`[onSubmit - Clinica] Error filtering existing consultations:`, filterError);
                }

                if (existingConsultations.length === 0) {
                  console.log(`[onSubmit - Clinica] No existing consultation found. Proceeding to create...`);
                  try {
                    const consultationData = {
                      appointmentId: savedAppointmentId,
                      petId: appointmentData.pet_id,
                      customerId: appointmentData.customer_id,
                      tenantId: appointmentData.tenant_id,
                      status: 'pending', 
                    };
                    console.log("[onSubmit - Clinica] Data for consultationService.create:", consultationData);
                    const createdConsult = await consultationService.create(consultationData);
                    console.log(`[onSubmit - Clinica] consultationService.create called. Result:`, createdConsult);
                  } catch (consultError) {
                    console.error(`[onSubmit - Clinica] consultationService.create FAILED:`, consultError);
                  }
                } else {
                  console.log(`[onSubmit - Clinica] Consultation/Episode already exists. Skipping creation.`);
                }
              } else if (serviceDetails?.module === 'petshop') {
                console.log(`[onSubmit] Service is Petshop. OS creation logic to be added here for appointment ${savedAppointmentId}.`);
              } else {
                console.warn(`[onSubmit] Unknown service module '${serviceDetails?.module}' or service details not found for ID ${appointmentData.service_id}. No Consultation or OS created.`);
              }
            } catch (serviceError) {
              console.error(`[onSubmit] Failed to fetch service details for ID ${appointmentData.service_id}:`, serviceError);
              toast({ title: "Erro Interno", description: "Não foi possível verificar o tipo de serviço para criar o registro associado.", variant: "warning" });
            }
          } else {
            console.log(`[onSubmit] Status is NOT 'arrived' (${appointmentData.status}). No consultation or OS created.`);
          }

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
        onClose();
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
                            if (statusKey === 'arrived') {
                              const appointmentDate = form.getValues('date');
                              if (appointmentDate && isFuture(startOfDay(new Date(appointmentDate)))) {
                                toast({
                                  title: "Ação não permitida",
                                  description: "Não é possível marcar 'Chegou' para um agendamento futuro. Por favor, reagende para a data/hora atual se necessário.",
                                  variant: "warning",
                                });
                                return;
                              }
                            }
                            form.setValue('status', statusKey, { shouldDirty: true, shouldValidate: true });
                          }}
                          aria-pressed={isCurrent}
                          disabled={isLoading}
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

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                {showServiceTypeSelector && (
                   <FormField
                     control={form.control}
                     name="serviceModule"
                     render={({ field }) => (
                       <FormItem className="lg:col-span-1">
                         <FormLabel>Módulo *</FormLabel>
                         <Select
                           onValueChange={(value) => {
                             field.onChange(value);
                           }}
                           value={field.value}
                           disabled={!tenant || isLoading}
                         >
                           <FormControl>
                             <SelectTrigger>
                               <SelectValue placeholder="Selecione o módulo" />
                             </SelectTrigger>
                           </FormControl>
                           <SelectContent>
                             <SelectItem value="clinica">
                               <span className="flex items-center"><HeartPulse className="mr-2 h-4 w-4 text-red-500"/> Clínica</span>
                             </SelectItem>
                             <SelectItem value="petshop">
                               <span className="flex items-center"><Briefcase className="mr-2 h-4 w-4 text-blue-500"/> Petshop</span>
                             </SelectItem>
                           </SelectContent>
                         </Select>
                         <FormMessage />
                       </FormItem>
                     )}
                   />
                )}

                <FormField
                  control={form.control}
                  name="customer_id"
                  render={({ field }) => (
                    <FormItem className={`lg:col-span-1 ${!showServiceTypeSelector ? 'lg:col-start-1' : ''}`}>
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
                              disabled={!tenant || isLoading || loadingCustomers}
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
                          <Command shouldFilter={false}>
                            <CommandInput 
                              placeholder="Buscar cliente..."
                              onValueChange={(search) => {
                                console.log("Customer search:", search); 
                              }}
                            />
                            
                            {loadingCustomers && (
                              <div className="p-2 text-center text-sm text-muted-foreground">Carregando...</div>
                            )}
                            <CommandList>
                             <CommandEmpty>Nenhum cliente encontrado.</CommandEmpty>
                              <CommandGroup>
                                {customers
                                  .map((customer) => (
                                    <CommandItem
                                      value={customer.id}
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
                            disabled={!tenant || !form.getValues("customer_id") || isLoading}
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
                               disabled={!tenant || isLoading || services.length === 0}
                      >
                        <FormControl>
                          <SelectTrigger>
                               <SelectValue placeholder={services.length === 0 ? "Nenhum serviço disponível" : "Selecione o serviço"} />
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
                             disabled={!tenant || isLoading}
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
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
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
                               disabled={!tenant || isLoading || currentSpecialties.length === 0}
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
                              disabled={!tenant || isLoading}
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
                            disabled={(date) => !tenant || isLoading || date < new Date().setHours(0,0,0,0)}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
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
                              disabled={!tenant || isLoading} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

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
                            disabled={!tenant || isLoading} 
                            className="bg-gray-100" 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pt-6">
                <FormField
                  control={form.control}
                  name="requester_type"
                    render={({ field }) => (
                      <FormItem>
                      <FormLabel>Tipo Solicitante</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value} disabled={!tenant || isLoading}>
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
                        <Input placeholder="Nome da clínica (se aplicável)" {...field} disabled={!tenant || isLoading} />
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
                        <Input placeholder="Nome/ID da tabela" {...field} disabled={!tenant || isLoading} />
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
                            disabled={!tenant || isLoading} 
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
                             disabled={!tenant || isLoading}
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
                        disabled={!tenant || isLoading}
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
                        disabled={!tenant || isLoading}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

             {isEditing && (currentStatus === 'scheduled' || currentStatus === 'confirmed') && (
                <div className="mt-6 pt-6 border-t">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleSendWahaClick}
                    disabled={isSendingWaha || isLoading}
                    className="text-green-700 border-green-500 hover:bg-green-50"
                  >
                    {isSendingWaha ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <MessageSquareText className="mr-2 h-4 w-4" />} 
                    {isSendingWaha ? "Enviando..." : "Confirmar por WhatsApp"}
                  </Button>
                  <p className="text-xs text-muted-foreground mt-1">Envia uma mensagem de confirmação para o cliente via WAHA.</p>
                </div>
             )}

              <div className="flex justify-end space-x-4 pt-4 border-t mt-6">
                <Button type="button" variant="outline" onClick={handleDelete} disabled={isLoading || isDeleting || isSendingWaha} className="w-full sm:w-auto">
                  {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Remover
                </Button>
                <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={isLoading}>
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
  tenant: PropTypes.object
};

export default AppointmentForm;