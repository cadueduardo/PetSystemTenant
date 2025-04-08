import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { format, isBefore, startOfMinute } from "date-fns";
import { createPageUrl } from "@/utils";
import { Appointment } from "@/api/entities";
import { QueueService } from "@/api/entities";
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
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/components/ui/use-toast";
import { CalendarIcon, Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { getMockData } from "@/api/mockData";

export default function AppointmentForm() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [pets, setPets] = useState([]);
  const [services, setServices] = useState([]);
  const [addToQueue, setAddToQueue] = useState(true);
  const [appointmentDuration, setAppointmentDuration] = useState(60);
  const [isEditing, setIsEditing] = useState(false);
  const [appointmentId, setAppointmentId] = useState(null);

  // Obter parâmetros da URL
  const urlParams = new URLSearchParams(window.location.search);
  const petIdParam = urlParams.get('pet_id');
  const customerIdParam = urlParams.get('customer_id');
  const storeParam = urlParams.get('store') || localStorage.getItem('current_tenant');

  // Usando as stores Zustand
  const { customers, fetchCustomers } = useCustomerStore();

  const form = useForm({
    defaultValues: {
      pet_id: petIdParam || "",
      customer_id: customerIdParam || "",
      service_id: "",
      date: new Date(),
      time: "09:00",
      notes: "",
      status: "scheduled",
      service_type: "clinica"
    }
  });

  useEffect(() => {
    console.log('Valor inicial do service_type:', form.getValues("service_type"));
    
    loadData();
    loadServices();

    // Se temos customer_id na URL, carregar os pets desse cliente
    if (customerIdParam) {
      handleCustomerChange(customerIdParam);
    }

    // Adicionar listener para mudanças no localStorage
    const handleStorageChange = () => {
      loadData();
    };

    window.addEventListener('storage', handleStorageChange);

    // Verificar se estamos editando um agendamento existente
    const id = urlParams.get('id');
    if (id) {
      setIsEditing(true);
      setAppointmentId(id);
      loadAppointment(id);
    }

    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const tenantId = localStorage.getItem('current_tenant');
      console.log('Tenant ID:', tenantId);
      
      if (!tenantId) {
        console.error('Tenant ID não encontrado');
        toast({
          title: "Erro",
          description: "Não foi possível identificar a loja.",
          variant: "destructive"
        });
        return;
      }
      
      // Carregando dados usando as stores
      await fetchCustomers({ tenant_id: tenantId });
      
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os dados necessários.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCustomerChange = async (customerId) => {
    try {
      const petsData = await Pet.filter({ owner_id: customerId });
      setPets(petsData);
      form.setValue("customer_id", customerId);
      form.setValue("pet_id", ""); // Limpa o pet selecionado
    } catch (error) {
      console.error("Erro ao carregar pets:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os pets do cliente.",
        variant: "destructive"
      });
    }
  };

  const handleServiceTypeChange = (type) => {
    console.log('Mudando tipo de serviço para:', type);
    form.setValue("service_type", type);
    form.setValue("service_id", ""); // Limpa o serviço selecionado
    loadServices(); // Carrega os serviços após atualizar o estado
  };

  const loadAppointment = async (id) => {
    try {
      const appointment = await Appointment.get(id);
      console.log('Dados do agendamento:', appointment);
      
      // Carregar dados do cliente e pet
      await fetchCustomers({ tenant_id: localStorage.getItem('current_tenant') });
      const pet = await Pet.get(appointment.pet_id);
      
      // Carregar serviços do tipo correto
      const mockData = getMockData();
      const servicesData = mockData.services.filter(service => 
        service.tenant_id === localStorage.getItem('current_tenant') && 
        service.module === appointment.type
      );
      console.log('Serviços carregados:', servicesData);
      setServices(servicesData);
      
      // Atualizar pets
      setPets([pet]);
      
      // Preencher o formulário
      form.reset({
        customer_id: appointment.customer_id,
        pet_id: appointment.pet_id,
        service_id: appointment.service_id,
        date: new Date(appointment.date),
        time: format(new Date(appointment.date), "HH:mm"),
        notes: appointment.notes || "",
        status: appointment.status,
        service_type: appointment.type
      });

      // Definir a duração do serviço
      const selectedService = servicesData.find(s => s.id === appointment.service_id);
      if (selectedService) {
        setAppointmentDuration(selectedService.duration || 60);
      }
      
    } catch (error) {
      console.error("Erro ao carregar agendamento:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os dados do agendamento.",
        variant: "destructive"
      });
    }
  };

  const loadServices = async () => {
    try {
      const tenantId = localStorage.getItem('current_tenant');
      const serviceType = form.getValues("service_type");
      console.log('Carregando serviços para:', { tenantId, serviceType });
      
      const mockData = getMockData();
      const filteredServices = mockData.services.filter(service => 
        service.tenant_id === tenantId && service.module === serviceType
      );
      
      // Filtrar IDs duplicados
      const uniqueServices = filteredServices.reduce((acc, current) => {
        const x = acc.find(item => item.id === current.id);
        if (!x) {
          return acc.concat([current]);
        } else {
          console.warn('Serviço duplicado encontrado e removido:', current);
          return acc;
        }
      }, []);
      
      console.log('Serviços carregados (únicos):', uniqueServices);
      setServices(uniqueServices);
      
    } catch (error) {
      console.error("Erro ao carregar serviços:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os serviços.",
        variant: "destructive"
      });
    }
  };

  const onSubmit = async (data) => {
    const [hours, minutes] = data.time.split(":");
    const appointmentDateTime = new Date(data.date);
    appointmentDateTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);

    const now = startOfMinute(new Date());

    if (isBefore(appointmentDateTime, now)) {
      toast({
        title: "Data/Hora Inválida",
        description: "Não é possível agendar em um horário passado.",
        variant: "destructive"
      });
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const serviceType = form.getValues("service_type");
      console.log('[onSubmit] Criando/Atualizando agendamento com tipo:', serviceType);

      const appointmentData = {
        pet_id: data.pet_id,
        customer_id: data.customer_id,
        service_id: data.service_id,
        date: appointmentDateTime.toISOString(),
        end_date: new Date(appointmentDateTime.getTime() + appointmentDuration * 60000).toISOString(),
        type: serviceType,
        notes: data.notes,
        status: data.status || (isEditing ? undefined : "scheduled"),
        tenant_id: localStorage.getItem('current_tenant'),
      };

      if (isEditing) {
        await Appointment.update(appointmentId, appointmentData);
        toast({
          title: "Sucesso",
          description: "Agendamento atualizado com sucesso!"
        });
        console.log('[onSubmit] Agendamento editado. Redirecionando para Calendar/PetDetails.');
        if (petIdParam) {
          navigate(createPageUrl('PetDetails', { id: petIdParam }));
        } else {
          navigate(createPageUrl('Calendar'));
        }
      } else {
        console.log('[onSubmit] Criando novo agendamento com tipo:', data.service_type);
        const appointment = await Appointment.create(appointmentData);
        let addedToQueue = false;
        
        console.log('[onSubmit] Verificando se adiciona à fila:', { addToQueue, service_type: data.service_type });
        if (addToQueue && data.service_type === 'petshop') { 
          console.log('[onSubmit] Adicionando à QueueService...');
          const queueData = {
            pet_id: data.pet_id,
            customer_id: data.customer_id,
            service_id: data.service_id,
            appointment_id: appointment.id,
            appointment_date: appointmentDateTime.toISOString(),
            status: "scheduled",
            tenant_id: localStorage.getItem('current_tenant')
          };
          try {
            await QueueService.create(queueData);
            addedToQueue = true;
            console.log('[onSubmit] Adicionado à QueueService com sucesso.');
          } catch(queueError) {
             console.error('[onSubmit] Erro ao adicionar à QueueService:', queueError);
             toast({
                title: "Erro na Fila",
                description: "Agendamento criado, mas houve um erro ao adicionar à fila.",
                variant: "destructive"
             });
          }
        }
        
        toast({
          title: "Sucesso",
          description: "Agendamento criado com sucesso!"
        });

        // Lógica de redirecionamento após criar - SEMPRE para Calendar/PetDetails
        console.log('[onSubmit] Decidindo redirecionamento (sempre Calendar/PetDetails):', { service_type: data.service_type, addedToQueue });
        if (petIdParam) {
          console.log('[onSubmit] Redirecionando para PetDetails (após criar).');
          navigate(createPageUrl('PetDetails', { id: petIdParam }));
        } else {
          console.log('[onSubmit] Redirecionando para Calendar (após criar).');
          navigate(createPageUrl('Calendar'));
        }
      }

    } catch (error) {
      console.error("Erro ao salvar agendamento:", error);
      toast({
        title: "Erro",
        description: `Não foi possível salvar o agendamento: ${error.message || 'Verifique os campos obrigatórios'}`,
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-6">
      <Card>
        <CardHeader>
          <CardTitle>{isEditing ? "Editar Agendamento" : "Novo Agendamento"}</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="customer_id"
                  rules={{ required: "Selecione um cliente" }}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cliente</FormLabel>
                      <Select
                        onValueChange={handleCustomerChange}
                        value={field.value}
                        disabled={isEditing}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione um cliente" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {customers.map((customer, index) => (
                            <SelectItem key={index} value={customer.id}>
                              {customer.full_name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="pet_id"
                  rules={{ required: "Selecione um pet" }}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Pet</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                        disabled={isEditing}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione um pet" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {pets.map((pet, index) => (
                            <SelectItem key={index} value={pet.id}>
                              {pet.name} ({pet.species} - {pet.breed})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="service_type"
                  rules={{ required: "Selecione um tipo de serviço" }}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tipo de Agendamento</FormLabel>
                      <Select
                        onValueChange={handleServiceTypeChange}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione um tipo" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="clinica">Clínica</SelectItem>
                          <SelectItem value="petshop">Petshop</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="service_id"
                  rules={{ required: "Selecione um serviço" }}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Serviço</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione um serviço" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {services.map((service) => (
                            <SelectItem 
                              key={service.id}
                              value={service.id}
                            >
                              {service.name} - {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(service.price)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="date"
                    rules={{ required: "Selecione uma data" }}
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel>Data</FormLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant="outline"
                                className={`w-full pl-3 text-left font-normal ${
                                  !field.value && "text-muted-foreground"
                                }`}
                              >
                                {field.value ? (
                                  format(field.value, "dd/MM/yyyy")
                                ) : (
                                  <span>Selecione uma data</span>
                                )}
                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={field.value}
                              onSelect={field.onChange}
                              disabled={(date) =>
                                date < new Date(new Date().setHours(0, 0, 0, 0))
                              }
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
                    name="time"
                    rules={{ required: "Selecione um horário" }}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Horário</FormLabel>
                        <FormControl>
                          <Input
                            type="time"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Observações</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Adicione observações sobre o agendamento..."
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="add-to-queue"
                  checked={addToQueue}
                  onCheckedChange={setAddToQueue}
                />
                <label
                  htmlFor="add-to-queue"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Adicionar automaticamente à fila de atendimento
                </label>
              </div>

              <div className="flex justify-end gap-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    if (petIdParam) {
                      navigate(createPageUrl(`PetDetails?id=${petIdParam}&store=${storeParam}`));
                    } else {
                      navigate(createPageUrl(`Calendar?store=${storeParam}`));
                    }
                  }}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    "Salvar Agendamento"
                  )}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}