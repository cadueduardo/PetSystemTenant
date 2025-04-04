import React, { useState } from "react";
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
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Loader2 } from "lucide-react";

export default function AppointmentForm({ onSubmit, onCancel, pet, initialData }) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState(initialData || {
    date: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
    end_date: "",
    type: "",
    status: "scheduled",
    doctor: "",
    reason: "",
    notes: "",
    is_telemedicine: false,
    health_plan_coverage: false,
    health_plan_authorization: ""
  });

  const handleChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));

    // Se a data inicial for alterada, atualiza a data final para 30 minutos depois
    if (field === "date") {
      const startDate = new Date(value);
      const endDate = new Date(startDate.getTime() + 30 * 60000); // +30 minutos
      setFormData(prev => ({
        ...prev,
        date: value,
        end_date: format(endDate, "yyyy-MM-dd'T'HH:mm")
      }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await onSubmit(formData);
    } catch (error) {
      console.error("Erro ao salvar agendamento:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <Label htmlFor="type">Tipo de Atendimento *</Label>
          <Select
            value={formData.type}
            onValueChange={(value) => handleChange("type", value)}
            required
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione o tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="consultation">Consulta</SelectItem>
              <SelectItem value="exam">Exame</SelectItem>
              <SelectItem value="vaccination">Vacinação</SelectItem>
              <SelectItem value="surgery">Cirurgia</SelectItem>
              <SelectItem value="return">Retorno</SelectItem>
              <SelectItem value="grooming">Banho e Tosa</SelectItem>
              <SelectItem value="telemedicine">Telemedicina</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="doctor">Veterinário/Profissional</Label>
          <Input
            id="doctor"
            value={formData.doctor}
            onChange={(e) => handleChange("doctor", e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <Label htmlFor="date">Data e Hora Inicial *</Label>
          <Input
            id="date"
            type="datetime-local"
            value={formData.date}
            onChange={(e) => handleChange("date", e.target.value)}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="end_date">Data e Hora Final *</Label>
          <Input
            id="end_date"
            type="datetime-local"
            value={formData.end_date}
            onChange={(e) => handleChange("end_date", e.target.value)}
            required
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="reason">Motivo *</Label>
        <Textarea
          id="reason"
          value={formData.reason}
          onChange={(e) => handleChange("reason", e.target.value)}
          placeholder="Descreva o motivo do agendamento..."
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">Observações</Label>
        <Textarea
          id="notes"
          value={formData.notes}
          onChange={(e) => handleChange("notes", e.target.value)}
          placeholder="Observações adicionais..."
        />
      </div>

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="health_plan_coverage"
          checked={formData.health_plan_coverage}
          onChange={(e) => handleChange("health_plan_coverage", e.target.checked)}
        />
        <Label htmlFor="health_plan_coverage">
          Atendimento coberto por plano de saúde
        </Label>
      </div>

      {formData.health_plan_coverage && (
        <div className="space-y-2">
          <Label htmlFor="health_plan_authorization">Número da Autorização</Label>
          <Input
            id="health_plan_authorization"
            value={formData.health_plan_authorization}
            onChange={(e) => handleChange("health_plan_authorization", e.target.value)}
          />
        </div>
      )}

      <div className="flex justify-end gap-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Salvando...
            </>
          ) : (
            'Salvar Agendamento'
          )}
        </Button>
      </div>
    </form>
  );
}