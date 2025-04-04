import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DatePicker } from "@/components/ui/date-picker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const MedicationForm = ({ onSubmit, onCancel, pet }) => {
  const [formData, setFormData] = useState({
    name: "",
    dosage: "",
    frequency: "",
    startDate: new Date(),
    endDate: null,
    prescribedBy: "",
    reason: "",
    instructions: "",
    sideEffects: "",
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    await onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-4">
        <div>
          <Label htmlFor="name">Nome do Medicamento *</Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
          />
        </div>

        <div>
          <Label htmlFor="dosage">Dosagem *</Label>
          <Input
            id="dosage"
            value={formData.dosage}
            onChange={(e) => setFormData({ ...formData, dosage: e.target.value })}
            placeholder="Ex: 1 comprimido, 5ml, etc."
            required
          />
        </div>

        <div>
          <Label htmlFor="frequency">Frequência *</Label>
          <Input
            id="frequency"
            value={formData.frequency}
            onChange={(e) => setFormData({ ...formData, frequency: e.target.value })}
            placeholder="Ex: 2x ao dia, a cada 8 horas, etc."
            required
          />
        </div>

        <div>
          <Label>Data de Início *</Label>
          <DatePicker
            date={formData.startDate}
            setDate={(date) => setFormData({ ...formData, startDate: date })}
          />
        </div>

        <div>
          <Label>Data de Término</Label>
          <DatePicker
            date={formData.endDate}
            setDate={(date) => setFormData({ ...formData, endDate: date })}
          />
        </div>

        <div>
          <Label htmlFor="prescribedBy">Prescrito por *</Label>
          <Input
            id="prescribedBy"
            value={formData.prescribedBy}
            onChange={(e) => setFormData({ ...formData, prescribedBy: e.target.value })}
            required
          />
        </div>

        <div>
          <Label htmlFor="reason">Motivo</Label>
          <Textarea
            id="reason"
            value={formData.reason}
            onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
            placeholder="Motivo da prescrição..."
          />
        </div>

        <div>
          <Label htmlFor="instructions">Instruções de Administração</Label>
          <Textarea
            id="instructions"
            value={formData.instructions}
            onChange={(e) => setFormData({ ...formData, instructions: e.target.value })}
            placeholder="Instruções específicas de como administrar..."
          />
        </div>

        <div>
          <Label htmlFor="sideEffects">Efeitos Colaterais Observados</Label>
          <Textarea
            id="sideEffects"
            value={formData.sideEffects}
            onChange={(e) => setFormData({ ...formData, sideEffects: e.target.value })}
            placeholder="Registre quaisquer efeitos colaterais..."
          />
        </div>
      </div>

      <div className="flex justify-end gap-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit">
          Salvar
        </Button>
      </div>
    </form>
  );
};

export default MedicationForm; 