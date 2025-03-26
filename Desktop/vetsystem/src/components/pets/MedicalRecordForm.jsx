import React, { useState } from "react";
import { MedicalRecord } from "@/api/entities";
import { toast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { format } from "date-fns";
import { Loader2 } from "lucide-react";

export default function MedicalRecordForm({ pet, onSuccess, onCancel, existingRecord = null }) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [record, setRecord] = useState(existingRecord || {
    pet_id: pet.id,
    record_type: "consultation",
    date: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
    title: "",
    subjective: "",
    objective: "",
    assessment: "",
    plan: "",
    diagnosis: "",
    prescription: "",
    notes: "",
    tenant_id: localStorage.getItem('current_tenant')
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setRecord(prev => ({ ...prev, [name]: value }));
  };

  const handleSelectChange = (name) => (value) => {
    setRecord(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // Validar campos obrigatórios
      if (!record.title || !record.date || !record.record_type) {
        throw new Error("Preencha todos os campos obrigatórios");
      }

      let result;
      if (existingRecord?.id) {
        // Atualizar registro existente
        result = await MedicalRecord.update(existingRecord.id, record);
        toast({
          title: "Sucesso",
          description: "Prontuário atualizado com sucesso!",
        });
      } else {
        // Criar novo registro
        result = await MedicalRecord.create(record);
        toast({
          title: "Sucesso",
          description: "Prontuário criado com sucesso!",
        });
      }

      if (onSuccess) {
        onSuccess(result);
      }
    } catch (error) {
      console.error("Erro ao salvar prontuário:", error);
      toast({
        title: "Erro",
        description: error.message || "Não foi possível salvar o prontuário.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div>
            <Label htmlFor="title">Título/Assunto *</Label>
            <Input
              id="title"
              name="title"
              value={record.title}
              onChange={handleChange}
              required
            />
          </div>

          <div>
            <Label htmlFor="record_type">Tipo de Registro *</Label>
            <Select
              value={record.record_type}
              onValueChange={handleSelectChange("record_type")}
              required
            >
              <SelectTrigger id="record_type">
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

          <div>
            <Label htmlFor="date">Data e Hora *</Label>
            <Input
              id="date"
              name="date"
              type="datetime-local"
              value={record.date}
              onChange={handleChange}
              required
            />
          </div>

          <div>
            <Label htmlFor="diagnosis">Diagnóstico</Label>
            <Input
              id="diagnosis"
              name="diagnosis"
              value={record.diagnosis}
              onChange={handleChange}
            />
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <Label htmlFor="subjective">Subjetivo (Relato do Tutor)</Label>
            <Textarea
              id="subjective"
              name="subjective"
              value={record.subjective}
              onChange={handleChange}
              rows={3}
            />
          </div>

          <div>
            <Label htmlFor="objective">Objetivo (Achados do Exame)</Label>
            <Textarea
              id="objective"
              name="objective"
              value={record.objective}
              onChange={handleChange}
              rows={3}
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <Label htmlFor="assessment">Avaliação</Label>
          <Textarea
            id="assessment"
            name="assessment"
            value={record.assessment}
            onChange={handleChange}
            rows={3}
          />
        </div>

        <div>
          <Label htmlFor="plan">Plano de Tratamento</Label>
          <Textarea
            id="plan"
            name="plan"
            value={record.plan}
            onChange={handleChange}
            rows={3}
          />
        </div>
      </div>

      <div>
        <Label htmlFor="prescription">Prescrição</Label>
        <Textarea
          id="prescription"
          name="prescription"
          value={record.prescription}
          onChange={handleChange}
          rows={3}
        />
      </div>

      <div>
        <Label htmlFor="notes">Observações Adicionais</Label>
        <Textarea
          id="notes"
          name="notes"
          value={record.notes}
          onChange={handleChange}
          rows={3}
        />
      </div>

      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Salvando...
            </>
          ) : (
            existingRecord ? "Atualizar Prontuário" : "Criar Prontuário"
          )}
        </Button>
      </div>
    </form>
  );
}