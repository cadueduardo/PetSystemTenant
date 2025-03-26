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

const AllergyForm = ({ onSubmit, onCancel, pet }) => {
  const [formData, setFormData] = useState({
    name: "",
    type: "",
    symptoms: "",
    severity: "moderate",
    notes: ""
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    await onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-4">
        <div>
          <Label htmlFor="name">Nome da Alergia *</Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
          />
        </div>

        <div>
          <Label htmlFor="type">Tipo de Alergia *</Label>
          <Select
            value={formData.type}
            onValueChange={(value) => setFormData({ ...formData, type: value })}
            required
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione o tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="food">Alimentar</SelectItem>
              <SelectItem value="medication">Medicamento</SelectItem>
              <SelectItem value="environmental">Ambiental</SelectItem>
              <SelectItem value="other">Outros</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="symptoms">Sintomas</Label>
          <Textarea
            id="symptoms"
            value={formData.symptoms}
            onChange={(e) => setFormData({ ...formData, symptoms: e.target.value })}
            placeholder="Descreva os sintomas observados..."
          />
        </div>

        <div>
          <Label htmlFor="severity">Gravidade</Label>
          <Select
            value={formData.severity}
            onValueChange={(value) => setFormData({ ...formData, severity: value })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione a gravidade" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="mild">Leve</SelectItem>
              <SelectItem value="moderate">Moderada</SelectItem>
              <SelectItem value="severe">Grave</SelectItem>
            </SelectContent>
          </Select>
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

export default AllergyForm; 