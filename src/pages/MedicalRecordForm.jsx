import React, { useState, useEffect } from "react";
import { MedicalRecord } from "@/api/entities";
import { Pet } from "@/api/entities";
import { Customer } from "@/api/entities";
import { Tenant } from "@/api/entities";
import { User } from "@/api/entities";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { format, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "@/components/ui/use-toast";
import {
  ArrowLeft,
  Calendar as CalendarIcon,
  Loader2,
  Save,
  Upload,
  FileText,
  Stethoscope,
  Microscope,
  Pill,
  Clipboard,
  X
} from "lucide-react";
import { UploadFile } from "@/api/integrations";

export default function MedicalRecordForm() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [currentTenant, setCurrentTenant] = useState(null);
  const [pets, setPets] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [activeTab, setActiveTab] = useState("basic");
  const [user, setUser] = useState(null);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  
  const [medicalRecord, setMedicalRecord] = useState({
    pet_id: "",
    record_type: "consultation",
    date: new Date(),
    title: "",
    subjective: "",
    objective: "",
    assessment: "",
    plan: "",
    diagnosis: "",
    prescription: "",
    lab_results: "",
    lab_results_urls: [],
    images_urls: [],
    weight: "",
    temperature: "",
    heart_rate: "",
    respiratory_rate: "",
    doctor: "",
    notes: "",
    follow_up_date: null,
    is_private: false,
    health_plan_coverage: false,
    health_plan_authorization: "",
    tenant_id: ""
  });

  const urlParams = new URLSearchParams(window.location.search);
  const recordId = urlParams.get("id");
  const preselectedPetId = urlParams.get("pet_id");
  const preselectedPetName = urlParams.get("pet_name");
  const preselectedCustomerName = urlParams.get("customer_name");

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    setIsLoading(true);
    try {
      const userData = await User.me();
      setUser(userData);

      const tenants = await Tenant.list();
      const activeTenant = tenants.find(t => t.status === "active");
      
      if (!activeTenant) {
        toast({
          title: "Erro",
          description: "Nenhuma clínica ativa encontrada.",
          variant: "destructive"
        });
        navigate(createPageUrl("Dashboard"));
        return;
      }

      setCurrentTenant(activeTenant);
      setMedicalRecord(prev => ({ ...prev, tenant_id: activeTenant.id }));

      if (!activeTenant.selected_modules.includes("clinic_management")) {
        toast({
          title: "Módulo não disponível",
          description: "O módulo de Gestão Clínica não está ativo para sua conta.",
          variant: "destructive"
        });
        navigate(createPageUrl("Dashboard"));
        return;
      }

      const customersData = await Customer.filter({ tenant_id: activeTenant.id });
      setCustomers(customersData);

      const petsData = await Pet.filter({ tenant_id: activeTenant.id });
      setPets(petsData);

      if (recordId) {
        const recordData = await MedicalRecord.get(recordId);
        if (recordData) {
          setMedicalRecord(recordData);
          setSelectedCustomer(recordData.customer_id);
          setIsEditing(true);
        }
      } else if (preselectedPetId) {
        const pet = petsData.find(p => p.id === preselectedPetId);
        if (pet) {
          setSelectedCustomer(pet.customer_id);
          setMedicalRecord(prev => ({ ...prev, pet_id: preselectedPetId }));
        }
      }
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

  const handleChange = (field, value) => {
    setMedicalRecord(prev => ({ ...prev, [field]: value }));
  };

  const handleCustomerChange = (customerId) => {
    const customer = customers.find(c => c.id === customerId);
    setSelectedCustomer(customer);
    setMedicalRecord(prev => ({ ...prev, pet_id: "" }));
  };

  const handlePetChange = (petId) => {
    const pet = pets.find(p => p.id === petId);
    if (pet) {
      const currentTitle = medicalRecord.title || "";
      if (currentTitle === "" || currentTitle === "Nova Consulta" || /^Consulta - /.test(currentTitle)) {
        handleChange("title", `Consulta - ${pet.name}`);
      }
    }
    handleChange("pet_id", petId);
  };

  const getCustomerPets = () => {
    if (!selectedCustomer) return [];
    return pets.filter(pet => pet.customer_id === selectedCustomer.id);
  };

  const handleFileUpload = async (e, field) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploadingFiles(true);
    const urls = [...medicalRecord[field]];

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const { file_url } = await UploadFile({ file });
        urls.push(file_url);
      }

      handleChange(field, urls);
      toast({
        title: "Arquivos enviados",
        description: "Os arquivos foram enviados com sucesso."
      });
    } catch (error) {
      console.error("Erro ao enviar arquivos:", error);
      toast({
        title: "Erro no upload",
        description: "Não foi possível enviar os arquivos. Tente novamente.",
        variant: "destructive"
      });
    } finally {
      setUploadingFiles(false);
      e.target.value = "";
    }
  };

  const validateForm = () => {
    if (!medicalRecord.pet_id) {
      toast({
        title: "Campo obrigatório",
        description: "Selecione um pet para o prontuário.",
        variant: "destructive"
      });
      return false;
    }

    if (!medicalRecord.title) {
      toast({
        title: "Campo obrigatório",
        description: "Insira um título para o prontuário.",
        variant: "destructive"
      });
      return false;
    }

    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    
    setIsSaving(true);
    try {
      if (isEditing) {
        await MedicalRecord.update(recordId, medicalRecord);
        toast({
          title: "Prontuário atualizado",
          description: "O prontuário foi atualizado com sucesso."
        });
      } else {
        await MedicalRecord.create(medicalRecord);
        toast({
          title: "Prontuário criado",
          description: "O prontuário foi criado com sucesso."
        });
      }
      
      if (selectedCustomer) {
        navigate(createPageUrl(`CustomerDetails?id=${selectedCustomer.id}&tab=records`));
      } else {
        const pet = pets.find(p => p.id === medicalRecord.pet_id);
        if (pet?.customer_id) {
          navigate(createPageUrl(`CustomerDetails?id=${pet.customer_id}&tab=records`));
        } else {
          navigate(createPageUrl("Customers"));
        }
      }
    } catch (error) {
      console.error("Erro ao salvar prontuário:", error);
      toast({
        title: "Erro ao salvar",
        description: "Não foi possível salvar o prontuário. Tente novamente.",
        variant: "destructive"
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    if (selectedCustomer) {
      navigate(createPageUrl(`CustomerDetails?id=${selectedCustomer.id}&tab=records`));
    } else {
      navigate(createPageUrl("Customers"));
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto py-6 flex justify-center items-center min-h-[300px]">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6">
      <div className="flex items-center mb-6 gap-4">
        <Button
          variant="outline"
          size="icon"
          onClick={handleCancel}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">{isEditing ? "Editar Prontuário" : "Novo Prontuário"}</h1>
          <p className="text-gray-500">
            {isEditing ? "Atualize as informações do prontuário" : "Preencha os dados para criar um novo prontuário"}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Informações Básicas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!preselectedPetId && (
              <div className="space-y-2">
                <Label htmlFor="customer">Cliente</Label>
                <Select
                  value={selectedCustomer?.id || ""}
                  onValueChange={handleCustomerChange}
                >
                  <SelectTrigger id="customer">
                    <SelectValue placeholder="Selecione um cliente" />
                  </SelectTrigger>
                  <SelectContent>
                    {customers.map(customer => (
                      <SelectItem key={customer.id} value={customer.id}>
                        {customer.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="pet">Pet</Label>
              <Select
                value={medicalRecord.pet_id}
                onValueChange={handlePetChange}
                disabled={!selectedCustomer && !preselectedPetId}
              >
                <SelectTrigger id="pet">
                  <SelectValue placeholder={selectedCustomer ? "Selecione um pet" : "Selecione um cliente primeiro"} />
                </SelectTrigger>
                <SelectContent>
                  {getCustomerPets().map(pet => (
                    <SelectItem key={pet.id} value={pet.id}>
                      {pet.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Data do Atendimento</Label>
                <div className="flex gap-2">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full justify-start text-left font-normal"
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {medicalRecord.date
                          ? format(medicalRecord.date, "dd/MM/yyyy", { locale: ptBR })
                          : "Selecione uma data"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={medicalRecord.date}
                        onSelect={(date) => {
                          if (date) {
                            const currentTime = medicalRecord.date || new Date();
                            date.setHours(currentTime.getHours());
                            date.setMinutes(currentTime.getMinutes());
                            handleChange("date", date);
                          }
                        }}
                        locale={ptBR}
                      />
                    </PopoverContent>
                  </Popover>

                  <Input
                    type="time"
                    value={medicalRecord.date ? format(medicalRecord.date, "HH:mm") : ""}
                    onChange={(e) => {
                      const [hours, minutes] = e.target.value.split(':').map(Number);
                      if (!isNaN(hours) && !isNaN(minutes)) {
                        const newDate = new Date(medicalRecord.date || new Date());
                        newDate.setHours(hours, minutes, 0, 0);
                        handleChange("date", newDate);
                      }
                    }}
                    className="w-24"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Tipo de Registro</Label>
                <Select
                  value={medicalRecord.record_type}
                  onValueChange={(value) => handleChange("record_type", value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="consultation">Consulta</SelectItem>
                    <SelectItem value="exam">Exame</SelectItem>
                    <SelectItem value="treatment">Tratamento</SelectItem>
                    <SelectItem value="vaccination">Vacinação</SelectItem>
                    <SelectItem value="surgery">Cirurgia</SelectItem>
                    <SelectItem value="hospitalization">Internação</SelectItem>
                    <SelectItem value="telemedicine">Telemedicina</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="title">Título</Label>
              <Input
                id="title"
                value={medicalRecord.title}
                onChange={(e) => handleChange("title", e.target.value)}
                placeholder="Título do prontuário"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="doctor">Veterinário Responsável</Label>
              <Input
                id="doctor"
                value={medicalRecord.doctor}
                onChange={(e) => handleChange("doctor", e.target.value)}
                placeholder="Nome do veterinário"
              />
            </div>
          </CardContent>
        </Card>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2 md:grid-cols-4">
            <TabsTrigger value="basic" className="flex items-center gap-2">
              <Stethoscope className="h-4 w-4" />
              Principais
            </TabsTrigger>
            <TabsTrigger value="details" className="flex items-center gap-2">
              <Microscope className="h-4 w-4" />
              Detalhes
            </TabsTrigger>
            <TabsTrigger value="treatment" className="flex items-center gap-2">
              <Pill className="h-4 w-4" />
              Tratamento
            </TabsTrigger>
            <TabsTrigger value="files" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Anexos
            </TabsTrigger>
          </TabsList>

          <TabsContent value="basic">
            <Card>
              <CardContent className="pt-6 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="subjective">Anamnese / Queixa Principal</Label>
                  <Textarea
                    id="subjective"
                    value={medicalRecord.subjective}
                    onChange={(e) => handleChange("subjective", e.target.value)}
                    placeholder="Relato do tutor e histórico"
                    rows={4}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="objective">Exame Físico</Label>
                  <Textarea
                    id="objective"
                    value={medicalRecord.objective}
                    onChange={(e) => handleChange("objective", e.target.value)}
                    placeholder="Achados do exame físico"
                    rows={4}
                  />
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="weight">Peso (kg)</Label>
                    <Input
                      id="weight"
                      type="number"
                      step="0.01"
                      value={medicalRecord.weight}
                      onChange={(e) => handleChange("weight", e.target.value)}
                      placeholder="0.00"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="temperature">Temperatura (°C)</Label>
                    <Input
                      id="temperature"
                      type="number"
                      step="0.1"
                      value={medicalRecord.temperature}
                      onChange={(e) => handleChange("temperature", e.target.value)}
                      placeholder="0.0"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="heart_rate">FC (bpm)</Label>
                    <Input
                      id="heart_rate"
                      type="number"
                      value={medicalRecord.heart_rate}
                      onChange={(e) => handleChange("heart_rate", e.target.value)}
                      placeholder="0"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="respiratory_rate">FR (rpm)</Label>
                    <Input
                      id="respiratory_rate"
                      type="number"
                      value={medicalRecord.respiratory_rate}
                      onChange={(e) => handleChange("respiratory_rate", e.target.value)}
                      placeholder="0"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="details">
            <Card>
              <CardContent className="pt-6 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="assessment">Avaliação</Label>
                  <Textarea
                    id="assessment"
                    value={medicalRecord.assessment}
                    onChange={(e) => handleChange("assessment", e.target.value)}
                    placeholder="Avaliação clínica"
                    rows={4}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="diagnosis">Diagnóstico</Label>
                  <Textarea
                    id="diagnosis"
                    value={medicalRecord.diagnosis}
                    onChange={(e) => handleChange("diagnosis", e.target.value)}
                    placeholder="Diagnóstico final"
                    rows={2}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="lab_results">Resultados de Exames</Label>
                  <Textarea
                    id="lab_results"
                    value={medicalRecord.lab_results}
                    onChange={(e) => handleChange("lab_results", e.target.value)}
                    placeholder="Resultados de exames laboratoriais"
                    rows={4}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes">Observações</Label>
                  <Textarea
                    id="notes"
                    value={medicalRecord.notes}
                    onChange={(e) => handleChange("notes", e.target.value)}
                    placeholder="Observações adicionais"
                    rows={2}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="treatment">
            <Card>
              <CardContent className="pt-6 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="plan">Plano de Tratamento</Label>
                  <Textarea
                    id="plan"
                    value={medicalRecord.plan}
                    onChange={(e) => handleChange("plan", e.target.value)}
                    placeholder="Plano de tratamento detalhado"
                    rows={4}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="prescription">Prescrição</Label>
                  <Textarea
                    id="prescription"
                    value={medicalRecord.prescription}
                    onChange={(e) => handleChange("prescription", e.target.value)}
                    placeholder="Medicamentos prescritos e posologia"
                    rows={4}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Retorno</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full justify-start text-left font-normal"
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {medicalRecord.follow_up_date
                          ? format(medicalRecord.follow_up_date, "dd/MM/yyyy", { locale: ptBR })
                          : "Data do retorno"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={medicalRecord.follow_up_date}
                        onSelect={(date) => handleChange("follow_up_date", date)}
                        locale={ptBR}
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    id="health_plan_coverage"
                    checked={medicalRecord.health_plan_coverage}
                    onCheckedChange={(checked) => handleChange("health_plan_coverage", checked)}
                  />
                  <Label htmlFor="health_plan_coverage">Coberto por Plano de Saúde</Label>
                </div>

                {medicalRecord.health_plan_coverage && (
                  <div className="space-y-2">
                    <Label htmlFor="health_plan_authorization">Número de Autorização</Label>
                    <Input
                      id="health_plan_authorization"
                      value={medicalRecord.health_plan_authorization}
                      onChange={(e) => handleChange("health_plan_authorization", e.target.value)}
                      placeholder="Código de autorização do plano de saúde"
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="files">
            <Card>
              <CardContent className="pt-6 space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label>Resultados de Exames</Label>
                    <div className="relative">
                      <input
                        type="file"
                        multiple
                        className="hidden"
                        id="lab_results_upload"
                        onChange={(e) => handleFileUpload(e, "lab_results_urls")}
                        accept=".pdf,.jpg,.jpeg,.png"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => document.getElementById("lab_results_upload").click()}
                        disabled={uploadingFiles}
                      >
                        {uploadingFiles ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Upload className="mr-2 h-4 w-4" />
                        )}
                        Anexar Arquivos
                      </Button>
                    </div>
                  </div>
                  {medicalRecord.lab_results_urls.length > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {medicalRecord.lab_results_urls.map((url, index) => (
                        <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                          <a
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline text-sm truncate"
                          >
                            Arquivo {index + 1}
                          </a>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              const newUrls = [...medicalRecord.lab_results_urls];
                              newUrls.splice(index, 1);
                              handleChange("lab_results_urls", newUrls);
                            }}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label>Imagens Médicas</Label>
                    <div className="relative">
                      <input
                        type="file"
                        multiple
                        className="hidden"
                        id="images_upload"
                        onChange={(e) => handleFileUpload(e, "images_urls")}
                        accept=".jpg,.jpeg,.png"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => document.getElementById("images_upload").click()}
                        disabled={uploadingFiles}
                      >
                        {uploadingFiles ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Upload className="mr-2 h-4 w-4" />
                        )}
                        Anexar Imagens
                      </Button>
                    </div>
                  </div>
                  {medicalRecord.images_urls.length > 0 && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {medicalRecord.images_urls.map((url, index) => (
                        <div key={index} className="relative group">
                          <img
                            src={url}
                            alt={`Imagem ${index + 1}`}
                            className="w-full h-32 object-cover rounded"
                          />
                          <Button
                            type="button"
                            variant="destructive"
                            size="icon"
                            className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => {
                              const newUrls = [...medicalRecord.images_urls];
                              newUrls.splice(index, 1);
                              handleChange("images_urls", newUrls);
                            }}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    id="is_private"
                    checked={medicalRecord.is_private}
                    onCheckedChange={(checked) => handleChange("is_private", checked)}
                  />
                  <Label htmlFor="is_private">Registro Privado (visível apenas para médicos)</Label>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={handleCancel}
          >
            Cancelar
          </Button>
          <Button 
            type="submit"
            className="bg-blue-600 hover:bg-blue-700"
            disabled={isSaving}
          >
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Salvando...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                {isEditing ? "Atualizar" : "Salvar"} Prontuário
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
