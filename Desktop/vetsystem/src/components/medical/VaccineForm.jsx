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

const VaccineForm = ({ onSubmit, onCancel, pet }) => {
  const [formData, setFormData] = useState({
    vaccineName: "",
    manufacturer: "",
    batchNumber: "",
    applicationDate: new Date(),
    nextDueDate: null,
    veterinarian: "",
    notes: "",
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    await onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-4">
        <div>
          <Label htmlFor="vaccineName">Nome da Vacina *</Label>
          <Input
            id="vaccineName"
            value={formData.vaccineName}
            onChange={(e) => setFormData({ ...formData, vaccineName: e.target.value })}
            required
          />
        </div>

        <div>
          <Label htmlFor="manufacturer">Fabricante</Label>
          <Input
            id="manufacturer"
            value={formData.manufacturer}
            onChange={(e) => setFormData({ ...formData, manufacturer: e.target.value })}
          />
        </div>

        <div>
          <Label htmlFor="batchNumber">Número do Lote</Label>
          <Input
            id="batchNumber"
            value={formData.batchNumber}
            onChange={(e) => setFormData({ ...formData, batchNumber: e.target.value })}
          />
        </div>

        <div>
          <Label>Data de Aplicação *</Label>
          <DatePicker
            date={formData.applicationDate}
            setDate={(date) => setFormData({ ...formData, applicationDate: date })}
          />
        </div>

        <div>
          <Label>Próxima Dose</Label>
          <DatePicker
            date={formData.nextDueDate}
            setDate={(date) => setFormData({ ...formData, nextDueDate: date })}
          />
        </div>

        <div>
          <Label htmlFor="veterinarian">Veterinário Responsável</Label>
          <Input
            id="veterinarian"
            value={formData.veterinarian}
            onChange={(e) => setFormData({ ...formData, veterinarian: e.target.value })}
          />
        </div>

        <div>
          <Label htmlFor="notes">Observações</Label>
          <Textarea
            id="notes"
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            placeholder="Observações adicionais..."
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

export default VaccineForm; 