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

const SurgeryForm = ({ onSubmit, onCancel, pet }) => {
  const [formData, setFormData] = useState({
    procedureName: "",
    date: new Date(),
    veterinarian: "",
    hospital: "",
    preOpNotes: "",
    postOpNotes: "",
    complications: "",
    medications: "",
    recoveryPlan: "",
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    await onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-4">
        <div>
          <Label htmlFor="procedureName">Nome do Procedimento *</Label>
          <Input
            id="procedureName"
            value={formData.procedureName}
            onChange={(e) => setFormData({ ...formData, procedureName: e.target.value })}
            required
          />
        </div>

        <div>
          <Label>Data da Cirurgia *</Label>
          <DatePicker
            date={formData.date}
            setDate={(date) => setFormData({ ...formData, date: date })}
          />
        </div>

        <div>
          <Label htmlFor="veterinarian">Veterinário Responsável *</Label>
          <Input
            id="veterinarian"
            value={formData.veterinarian}
            onChange={(e) => setFormData({ ...formData, veterinarian: e.target.value })}
            required
          />
        </div>

        <div>
          <Label htmlFor="hospital">Hospital/Clínica *</Label>
          <Input
            id="hospital"
            value={formData.hospital}
            onChange={(e) => setFormData({ ...formData, hospital: e.target.value })}
            required
          />
        </div>

        <div>
          <Label htmlFor="preOpNotes">Notas Pré-Operatórias</Label>
          <Textarea
            id="preOpNotes"
            value={formData.preOpNotes}
            onChange={(e) => setFormData({ ...formData, preOpNotes: e.target.value })}
            placeholder="Observações pré-operatórias..."
          />
        </div>

        <div>
          <Label htmlFor="postOpNotes">Notas Pós-Operatórias</Label>
          <Textarea
            id="postOpNotes"
            value={formData.postOpNotes}
            onChange={(e) => setFormData({ ...formData, postOpNotes: e.target.value })}
            placeholder="Observações pós-operatórias..."
          />
        </div>

        <div>
          <Label htmlFor="complications">Complicações</Label>
          <Textarea
            id="complications"
            value={formData.complications}
            onChange={(e) => setFormData({ ...formData, complications: e.target.value })}
            placeholder="Descreva quaisquer complicações..."
          />
        </div>

        <div>
          <Label htmlFor="medications">Medicamentos</Label>
          <Textarea
            id="medications"
            value={formData.medications}
            onChange={(e) => setFormData({ ...formData, medications: e.target.value })}
            placeholder="Liste os medicamentos prescritos..."
          />
        </div>

        <div>
          <Label htmlFor="recoveryPlan">Plano de Recuperação</Label>
          <Textarea
            id="recoveryPlan"
            value={formData.recoveryPlan}
            onChange={(e) => setFormData({ ...formData, recoveryPlan: e.target.value })}
            placeholder="Detalhes do plano de recuperação..."
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

export default SurgeryForm; 