import React, { useState, useEffect } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { toast } from "@/components/ui/use-toast";
import { CalendarIcon, Plus, X } from "lucide-react";
import { Vaccine } from "@/api/entities";
import { Medication } from "@/api/entities";
import { Allergy } from "@/api/entities";

export default function ClinicalDataForm({ pet, onClose, onSubmit, formType, defaultValues }) {
  const [formData, setFormData] = useState({});
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [vaccines, setVaccines] = useState([]);
  const [medications, setMedications] = useState([]);
  const [allergies, setAllergies] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (formType === "vaccine") {
      loadVaccines();
    } else if (formType === "medication") {
      loadMedications();
    } else if (formType === "allergy") {
      loadAllergies();
    }
    
    // Inicializar formData com base no defaultValues
    initializeFormData();
  }, [formType, defaultValues]);

  const initializeFormData = () => {
    switch (formType) {
      case "history":
        setFormData({
          clinical_history: defaultValues?.clinical_history || ""
        });
        break;
      case "vaccine":
        setFormData({
          vaccine_id: "",
          vaccine_name: "",
          application_date: new Date(),
          next_dose_date: null,
          batch_number: "",
          veterinarian: ""
        });
        break;
      case "medication":
        setFormData({
          medication_id: "",
          medication_name: "",
          dosage: "",
          frequency: "",
          start_date: new Date(),
          end_date: null,
          notes: ""
        });
        break;
      case "allergy":
        setFormData({
          allergy_id: "",
          allergy_name: ""
        });
        break;
      default:
        setFormData({});
    }
  };

  const loadVaccines = async () => {
    try {
      const data = await Vaccine.list();
      setVaccines(data || []);
    } catch (error) {
      console.error("Erro ao carregar vacinas:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar a lista de vacinas.",
        variant: "destructive"
      });
    }
  };

  const loadMedications = async () => {
    try {
      const data = await Medication.list();
      setMedications(data || []);
    } catch (error) {
      console.error("Erro ao carregar medicamentos:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar a lista de medicamentos.",
        variant: "destructive"
      });
    }
  };

  const loadAllergies = async () => {
    try {
      const data = await Allergy.list();
      setAllergies(data || []);
    } catch (error) {
      console.error("Erro ao carregar alergias:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar a lista de alergias.",
        variant: "destructive"
      });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      let finalData = { ...formData };
      
      // Processa dados específicos de cada formulário
      if (formType === "vaccine") {
        if (isAddingNew && formData.new_vaccine_name) {
          finalData.vaccine_name = formData.new_vaccine_name;
        } else if (formData.vaccine_id) {
          const selectedVaccine = vaccines.find(v => v.id === formData.vaccine_id);
          finalData.vaccine_name = selectedVaccine?.name || "";
        }
      } else if (formType === "medication") {
        if (isAddingNew && formData.new_medication_name) {
          finalData.medication_name = formData.new_medication_name;
        } else if (formData.medication_id) {
          const selectedMedication = medications.find(m => m.id === formData.medication_id);
          finalData.medication_name = selectedMedication?.name || "";
        }
      } else if (formType === "allergy") {
        if (isAddingNew && formData.new_allergy_name) {
          finalData.allergy_name = formData.new_allergy_name;
        } else if (formData.allergy_id) {
          const selectedAllergy = allergies.find(a => a.id === formData.allergy_id);
          finalData.allergy_name = selectedAllergy?.name || "";
        }
      }
      
      await onSubmit(finalData);
      onClose();
    } catch (error) {
      console.error("Erro ao salvar:", error);
      toast({
        title: "Erro",
        description: "Não foi possível salvar os dados.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Form específico para Histórico Clínico
  const HistoryForm = () => (
    <div className="space-y-4">
      <div>
        <Label htmlFor="clinical_history">Histórico Clínico</Label>
        <Textarea
          id="clinical_history"
          value={formData.clinical_history || ""}
          onChange={(e) => setFormData({ ...formData, clinical_history: e.target.value })}
          placeholder="Descreva o histórico clínico do animal..."
          className="h-48"
        />
      </div>
    </div>
  );

  // Form específico para Vacinas
  const VaccineForm = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Vacina</Label>
          <Select
            value={formData.vaccine_id}
            onValueChange={(value) => {
              if (value === "other") {
                setIsAddingNew(true);
              } else {
                setFormData({ ...formData, vaccine_id: value });
                setIsAddingNew(false);
              }
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione uma vacina" />
            </SelectTrigger>
            <SelectContent>
              {vaccines.map((vaccine) => (
                <SelectItem key={vaccine.id} value={vaccine.id}>
                  {vaccine.name}
                </SelectItem>
              ))}
              <SelectItem value="other">Outra Vacina</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isAddingNew && (
          <div>
            <Label>Nova Vacina</Label>
            <Input
              value={formData.new_vaccine_name || ""}
              onChange={(e) => setFormData({ ...formData, new_vaccine_name: e.target.value })}
              placeholder="Nome da nova vacina"
            />
          </div>
        )}

        <div>
          <Label>Data de Aplicação</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full justify-start text-left font-normal">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {formData.application_date ? 
                  format(new Date(formData.application_date), "P", { locale: ptBR }) : 
                  "Selecione uma data"
                }
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={formData.application_date ? new Date(formData.application_date) : undefined}
                onSelect={(date) => setFormData({ ...formData, application_date: date })}
                locale={ptBR}
              />
            </PopoverContent>
          </Popover>
        </div>

        <div>
          <Label>Próxima Dose</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full justify-start text-left font-normal">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {formData.next_dose_date ? 
                  format(new Date(formData.next_dose_date), "P", { locale: ptBR }) : 
                  "Selecione uma data"
                }
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={formData.next_dose_date ? new Date(formData.next_dose_date) : undefined}
                onSelect={(date) => setFormData({ ...formData, next_dose_date: date })}
                locale={ptBR}
              />
            </PopoverContent>
          </Popover>
        </div>

        <div>
          <Label>Número do Lote</Label>
          <Input
            value={formData.batch_number || ""}
            onChange={(e) => setFormData({ ...formData, batch_number: e.target.value })}
            placeholder="Número do lote da vacina"
          />
        </div>

        <div>
          <Label>Veterinário</Label>
          <Input
            value={formData.veterinarian || ""}
            onChange={(e) => setFormData({ ...formData, veterinarian: e.target.value })}
            placeholder="Nome do veterinário"
          />
        </div>
      </div>
    </div>
  );

  // Form específico para Medicamentos
  const MedicationForm = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Nome do Medicamento</Label>
          <Select
            value={formData.medication_id}
            onValueChange={(value) => {
              if (value === "other") {
                setIsAddingNew(true);
              } else {
                setFormData({ ...formData, medication_id: value });
                setIsAddingNew(false);
              }
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione um medicamento" />
            </SelectTrigger>
            <SelectContent>
              {medications.map((med) => (
                <SelectItem key={med.id} value={med.id}>
                  {med.name}
                </SelectItem>
              ))}
              <SelectItem value="other">Outro Medicamento</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isAddingNew && (
          <div>
            <Label>Novo Medicamento</Label>
            <Input
              value={formData.new_medication_name || ""}
              onChange={(e) => setFormData({ ...formData, new_medication_name: e.target.value })}
              placeholder="Nome do novo medicamento"
            />
          </div>
        )}

        <div>
          <Label>Dosagem</Label>
          <Input
            value={formData.dosage || ""}
            onChange={(e) => setFormData({ ...formData, dosage: e.target.value })}
            placeholder="Ex: 1 comprimido"
          />
        </div>

        <div>
          <Label>Frequência</Label>
          <Input
            value={formData.frequency || ""}
            onChange={(e) => setFormData({ ...formData, frequency: e.target.value })}
            placeholder="Ex: 8 em 8 horas"
          />
        </div>

        <div>
          <Label>Data de Início</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full justify-start text-left font-normal">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {formData.start_date ? 
                  format(new Date(formData.start_date), "P", { locale: ptBR }) : 
                  "Selecione uma data"
                }
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={formData.start_date ? new Date(formData.start_date) : undefined}
                onSelect={(date) => setFormData({ ...formData, start_date: date })}
                locale={ptBR}
              />
            </PopoverContent>
          </Popover>
        </div>

        <div>
          <Label>Data de Término</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full justify-start text-left font-normal">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {formData.end_date ? 
                  format(new Date(formData.end_date), "P", { locale: ptBR }) : 
                  "Selecione uma data"
                }
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={formData.end_date ? new Date(formData.end_date) : undefined}
                onSelect={(date) => setFormData({ ...formData, end_date: date })}
                locale={ptBR}
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>

      <div>
        <Label>Observações</Label>
        <Textarea
          value={formData.notes || ""}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          placeholder="Observações sobre o medicamento"
        />
      </div>
    </div>
  );

  // Form específico para Alergias
  const AllergyForm = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Nome da Alergia</Label>
          <Select
            value={formData.allergy_id}
            onValueChange={(value) => {
              if (value === "other") {
                setIsAddingNew(true);
              } else {
                setFormData({ ...formData, allergy_id: value });
                setIsAddingNew(false);
              }
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione uma alergia" />
            </SelectTrigger>
            <SelectContent>
              {allergies.map((allergy) => (
                <SelectItem key={allergy.id} value={allergy.id}>
                  {allergy.name}
                </SelectItem>
              ))}
              <SelectItem value="other">Outra Alergia</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isAddingNew && (
          <div>
            <Label>Nova Alergia</Label>
            <Input
              value={formData.new_allergy_name || ""}
              onChange={(e) => setFormData({ ...formData, new_allergy_name: e.target.value })}
              placeholder="Nome da nova alergia"
            />
          </div>
        )}
      </div>
    </div>
  );

  // Seleciona o formulário apropriado com base no tipo
  const renderForm = () => {
    switch (formType) {
      case "history":
        return <HistoryForm />;
      case "vaccine":
        return <VaccineForm />;
      case "medication":
        return <MedicationForm />;
      case "allergy":
        return <AllergyForm />;
      default:
        return <div>Tipo de formulário não reconhecido</div>;
    }
  };

  // Texto do título com base no tipo
  const getTitle = () => {
    switch (formType) {
      case "history":
        return "Editar Histórico Clínico";
      case "vaccine":
        return "Adicionar Vacina";
      case "medication":
        return "Adicionar Medicamento";
      case "allergy":
        return "Adicionar Alergia";
      default:
        return "Formulário";
    }
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-h-[90vh] overflow-y-auto max-w-2xl">
        <DialogHeader>
          <DialogTitle>{getTitle()}</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit}>
          {renderForm()}
          
          <div className="mt-6 flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}