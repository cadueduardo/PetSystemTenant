import React, { useState, useEffect } from "react";
import { Hospitalization } from "@/api/entities";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { toast } from "@/components/ui/use-toast";
import { format } from "date-fns";
import { pt } from "date-fns/locale";
import { 
  Popover, 
  PopoverContent, 
  PopoverTrigger 
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { Calendar as CalendarIcon, Clock, Loader2 } from "lucide-react";

export default function HospitalizationForm({ pet, hospitalization, onSuccess, onCancel }) {
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    pet_id: pet?.id || "",
    admission_date: new Date().toISOString(),
    discharge_date: "",
    status: "active",
    reason: "",
    diagnosis: "",
    room: "",
    responsible_doctor: "",
    treatment_plan: "",
    nutrition_plan: "",
    discharge_summary: "",
    discharge_instructions: "",
    health_plan_coverage: false,
    health_plan_authorization: "",
    trial_id: pet?.trial_id || ""
  });
  
  const [admissionDate, setAdmissionDate] = useState(new Date());
  const [dischargeDate, setDischargeDate] = useState(null);

  useEffect(() => {
    if (hospitalization) {
      setFormData({
        ...hospitalization,
        pet_id: pet?.id || hospitalization.pet_id,
        health_plan_coverage: hospitalization.health_plan_coverage || false
      });
      
      if (hospitalization.admission_date) {
        setAdmissionDate(new Date(hospitalization.admission_date));
      }
      
      if (hospitalization.discharge_date) {
        setDischargeDate(new Date(hospitalization.discharge_date));
      }
    }
  }, [hospitalization, pet]);

  const handleChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleAdmissionDateChange = (date) => {
    setAdmissionDate(date);
    if (date) {
      const dateTime = new Date(date);
      dateTime.setHours(new Date().getHours());
      dateTime.setMinutes(new Date().getMinutes());
      handleChange("admission_date", dateTime.toISOString());
    }
  };

  const handleDischargeDateChange = (date) => {
    setDischargeDate(date);
    if (date) {
      const dateTime = new Date(date);
      dateTime.setHours(new Date().getHours());
      dateTime.setMinutes(new Date().getMinutes());
      handleChange("discharge_date", dateTime.toISOString());
    } else {
      handleChange("discharge_date", "");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      if (hospitalization) {
        await Hospitalization.update(hospitalization.id, formData);
        toast({
          title: "Internação atualizada!",
          description: "Os dados da internação foram atualizados com sucesso."
        });
      } else {
        await Hospitalization.create(formData);
        toast({
          title: "Internação registrada!",
          description: "A nova internação foi registrada com sucesso."
        });
      }
      
      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      console.error("Erro ao salvar internação:", error);
      toast({
        title: "Erro ao salvar",
        description: "Não foi possível salvar os dados da internação. Tente novamente.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <Label htmlFor="admission_date">Data de Admissão *</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant={"outline"}
                className={cn(
                  "w-full justify-start text-left font-normal",
                  !admissionDate && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {admissionDate ? (
                  format(admissionDate, "dd/MM/yyyy", { locale: pt })
                ) : (
                  <span>Selecione uma data</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={admissionDate}
                onSelect={handleAdmissionDateChange}
                initialFocus
                locale={pt}
              />
            </PopoverContent>
          </Popover>
        </div>

        <div className="space-y-2">
          <Label htmlFor="status">Status *</Label>
          <Select 
            value={formData.status} 
            onValueChange={(value) => handleChange("status", value)}
            required
          >
            <SelectTrigger id="status">
              <SelectValue placeholder="Selecione o status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Em andamento</SelectItem>
              <SelectItem value="discharged">Alta concedida</SelectItem>
              <SelectItem value="deceased">Óbito</SelectItem>
              <SelectItem value="transferred">Transferido</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="responsible_doctor">Médico Responsável *</Label>
          <Input 
            id="responsible_doctor" 
            value={formData.responsible_doctor} 
            onChange={(e) => handleChange("responsible_doctor", e.target.value)}
            placeholder="Nome do veterinário responsável"
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="room">Quarto/Leito</Label>
          <Input 
            id="room" 
            value={formData.room} 
            onChange={(e) => handleChange("room", e.target.value)}
            placeholder="Ex: Leito 3, Quarto de Isolamento, etc."
          />
        </div>

        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="reason">Motivo da Internação *</Label>
          <Textarea 
            id="reason" 
            value={formData.reason} 
            onChange={(e) => handleChange("reason", e.target.value)}
            placeholder="Descreva o motivo da internação"
            required
          />
        </div>

        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="diagnosis">Diagnóstico</Label>
          <Textarea 
            id="diagnosis" 
            value={formData.diagnosis} 
            onChange={(e) => handleChange("diagnosis", e.target.value)}
            placeholder="Diagnóstico inicial"
          />
        </div>

        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="treatment_plan">Plano de Tratamento</Label>
          <Textarea 
            id="treatment_plan" 
            value={formData.treatment_plan} 
            onChange={(e) => handleChange("treatment_plan", e.target.value)}
            placeholder="Descreva o plano de tratamento"
          />
        </div>

        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="nutrition_plan">Plano Nutricional</Label>
          <Textarea 
            id="nutrition_plan" 
            value={formData.nutrition_plan} 
            onChange={(e) => handleChange("nutrition_plan", e.target.value)}
            placeholder="Descreva o plano nutricional durante a internação"
          />
        </div>

        {(formData.status === "discharged" || formData.status === "transferred") && (
          <>
            <div className="space-y-2">
              <Label htmlFor="discharge_date">Data de Alta</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant={"outline"}
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !dischargeDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dischargeDate ? (
                      format(dischargeDate, "dd/MM/yyyy", { locale: pt })
                    ) : (
                      <span>Selecione uma data</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={dischargeDate}
                    onSelect={handleDischargeDateChange}
                    initialFocus
                    locale={pt}
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <div className="h-10 flex items-end">
                {!dischargeDate && (
                  <p className="text-sm text-yellow-600">
                    Por favor, selecione uma data de alta
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="discharge_summary">Resumo de Alta</Label>
              <Textarea 
                id="discharge_summary" 
                value={formData.discharge_summary} 
                onChange={(e) => handleChange("discharge_summary", e.target.value)}
                placeholder="Resumo do período de internação e condição na alta"
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="discharge_instructions">Instruções pós-alta</Label>
              <Textarea 
                id="discharge_instructions" 
                value={formData.discharge_instructions} 
                onChange={(e) => handleChange("discharge_instructions", e.target.value)}
                placeholder="Instruções para o tutor após a alta"
              />
            </div>
          </>
        )}
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Salvando...
            </>
          ) : (
            <>{hospitalization ? "Atualizar" : "Registrar"} Internação</>
          )}
        </Button>
      </div>
    </form>
  );
}