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
import { DialogHeader, DialogTitle } from "@/components/ui/dialog";

export default function MedicalRecordForm({ onSubmit, onCancel, pet }) {
  const [formData, setFormData] = useState({
    record_type: "",
    date: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
    title: "",
    subjective: "",
    objective: "",
    assessment: "",
    plan: "",
    diagnosis: "",
    prescription: "",
    lab_results: "",
    weight: "",
    temperature: "",
    heart_rate: "",
    respiratory_rate: "",
    doctor: "",
    notes: "",
    follow_up_date: "",
    is_private: false,
    health_plan_coverage: false,
    health_plan_authorization: ""
  });

  const handleChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <div className="p-4">
      <DialogHeader>
        <DialogTitle>Novo Prontuário - {pet?.name}</DialogTitle>
      </DialogHeader>

      <form onSubmit={handleSubmit} className="space-y-6 mt-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label htmlFor="record_type">Tipo de Registro *</Label>
            <Select
              value={formData.record_type}
              onValueChange={(value) => handleChange("record_type", value)}
              required
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

          <div className="space-y-2">
            <Label htmlFor="date">Data e Hora *</Label>
            <Input
              id="date"
              type="datetime-local"
              value={formData.date}
              onChange={(e) => handleChange("date", e.target.value)}
              required
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="title">Título/Motivo *</Label>
          <Input
            id="title"
            value={formData.title}
            onChange={(e) => handleChange("title", e.target.value)}
            placeholder="Ex: Consulta de rotina, Exame de sangue..."
            required
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label htmlFor="doctor">Veterinário Responsável</Label>
            <Input
              id="doctor"
              value={formData.doctor}
              onChange={(e) => handleChange("doctor", e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="follow_up_date">Data de Retorno</Label>
            <Input
              id="follow_up_date"
              type="date"
              value={formData.follow_up_date}
              onChange={(e) => handleChange("follow_up_date", e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="font-semibold text-lg">SOAP</h3>
          
          <div className="space-y-2">
            <Label htmlFor="subjective">S - Subjetivo (Relato do tutor)</Label>
            <Textarea
              id="subjective"
              value={formData.subjective}
              onChange={(e) => handleChange("subjective", e.target.value)}
              placeholder="Relato do tutor sobre os sintomas e histórico..."
              className="min-h-[100px]"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="objective">O - Objetivo (Exame físico)</Label>
            <Textarea
              id="objective"
              value={formData.objective}
              onChange={(e) => handleChange("objective", e.target.value)}
              placeholder="Achados do exame físico..."
              className="min-h-[100px]"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="assessment">A - Avaliação</Label>
            <Textarea
              id="assessment"
              value={formData.assessment}
              onChange={(e) => handleChange("assessment", e.target.value)}
              placeholder="Avaliação clínica e diagnósticos..."
              className="min-h-[100px]"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="plan">P - Plano</Label>
            <Textarea
              id="plan"
              value={formData.plan}
              onChange={(e) => handleChange("plan", e.target.value)}
              placeholder="Plano de tratamento..."
              className="min-h-[100px]"
            />
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="font-semibold text-lg">Sinais Vitais</h3>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label htmlFor="weight">Peso (kg)</Label>
              <Input
                id="weight"
                type="number"
                step="0.01"
                value={formData.weight}
                onChange={(e) => handleChange("weight", e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="temperature">Temperatura (°C)</Label>
              <Input
                id="temperature"
                type="number"
                step="0.1"
                value={formData.temperature}
                onChange={(e) => handleChange("temperature", e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="heart_rate">Freq. Cardíaca (bpm)</Label>
              <Input
                id="heart_rate"
                type="number"
                value={formData.heart_rate}
                onChange={(e) => handleChange("heart_rate", e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="respiratory_rate">Freq. Respiratória (rpm)</Label>
              <Input
                id="respiratory_rate"
                type="number"
                value={formData.respiratory_rate}
                onChange={(e) => handleChange("respiratory_rate", e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="font-semibold text-lg">Informações Adicionais</h3>
          
          <div className="space-y-2">
            <Label htmlFor="diagnosis">Diagnóstico</Label>
            <Textarea
              id="diagnosis"
              value={formData.diagnosis}
              onChange={(e) => handleChange("diagnosis", e.target.value)}
              placeholder="Diagnóstico final..."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="prescription">Prescrição</Label>
            <Textarea
              id="prescription"
              value={formData.prescription}
              onChange={(e) => handleChange("prescription", e.target.value)}
              placeholder="Medicamentos prescritos e posologia..."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="lab_results">Resultados de Exames</Label>
            <Textarea
              id="lab_results"
              value={formData.lab_results}
              onChange={(e) => handleChange("lab_results", e.target.value)}
              placeholder="Resultados de exames laboratoriais..."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Observações Adicionais</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => handleChange("notes", e.target.value)}
              placeholder="Observações gerais..."
            />
          </div>
        </div>

        <div className="flex justify-end gap-4">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
          <Button type="submit">
            Salvar Prontuário
          </Button>
        </div>
      </form>
    </div>
  );
}