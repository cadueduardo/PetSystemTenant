import React, { useState } from "react";
import { HealthPlan } from "@/api/entities";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/components/ui/use-toast";
import { Loader2 } from "lucide-react";

export default function HealthPlanForm({ onSuccess, plan = null }) {
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: plan?.name || "",
    provider: plan?.provider || "",
    description: plan?.description || "",
    coverage: plan?.coverage || [],
    consultation_limit: plan?.consultation_limit || 0,
    exam_limit: plan?.exam_limit || 0,
    surgery_coverage_percentage: plan?.surgery_coverage_percentage || 0,
    hospitalization_coverage_percentage: plan?.hospitalization_coverage_percentage || 0,
    emergency_coverage_percentage: plan?.emergency_coverage_percentage || 0,
    dental_coverage_percentage: plan?.dental_coverage_percentage || 0,
    has_grace_period: plan?.has_grace_period || false,
    grace_period_days: plan?.grace_period_days || 0,
    is_active: plan?.is_active ?? true,
    provider_contact: plan?.provider_contact || "",
    authorization_required: plan?.authorization_required || false,
    monthly_fee: plan?.monthly_fee || 0,
    annual_fee: plan?.annual_fee || 0,
    tenant_id: localStorage.getItem('current_tenant')
  });

  const coverageOptions = [
    { id: "consultation", label: "Consultas" },
    { id: "vaccine", label: "Vacinas" },
    { id: "exam", label: "Exames" },
    { id: "surgery", label: "Cirurgias" },
    { id: "hospitalization", label: "Internações" },
    { id: "emergency", label: "Emergências" },
    { id: "telemedicine", label: "Telemedicina" },
    { id: "dental", label: "Odontológico" }
  ];

  const handleChange = (e) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'number' ? Number(value) : value
    }));
  };

  const handleCoverageChange = (coverage) => {
    setFormData(prev => ({
      ...prev,
      coverage: prev.coverage.includes(coverage)
        ? prev.coverage.filter(c => c !== coverage)
        : [...prev.coverage, coverage]
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (plan?.id) {
        await HealthPlan.update(plan.id, formData);
        toast({
          title: "Sucesso",
          description: "Plano atualizado com sucesso!"
        });
      } else {
        await HealthPlan.create(formData);
        toast({
          title: "Sucesso",
          description: "Plano criado com sucesso!"
        });
      }

      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      console.error("Erro ao salvar plano:", error);
      toast({
        title: "Erro",
        description: "Não foi possível salvar o plano. Tente novamente.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="name">Nome do Plano *</Label>
          <Input
            id="name"
            name="name"
            value={formData.name}
            onChange={handleChange}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="provider">Fornecedor *</Label>
          <Input
            id="provider"
            name="provider"
            value={formData.provider}
            onChange={handleChange}
            required
          />
        </div>

        <div className="space-y-2 col-span-2">
          <Label htmlFor="description">Descrição</Label>
          <Textarea
            id="description"
            name="description"
            value={formData.description}
            onChange={handleChange}
            rows={3}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="monthly_fee">Mensalidade (R$)</Label>
          <Input
            id="monthly_fee"
            name="monthly_fee"
            type="number"
            step="0.01"
            value={formData.monthly_fee}
            onChange={handleChange}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="annual_fee">Anuidade (R$)</Label>
          <Input
            id="annual_fee"
            name="annual_fee"
            type="number"
            step="0.01"
            value={formData.annual_fee}
            onChange={handleChange}
          />
        </div>
      </div>

      <div className="space-y-4">
        <Label>Coberturas</Label>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {coverageOptions.map((option) => (
            <div key={option.id} className="flex items-center space-x-2">
              <Checkbox
                id={option.id}
                checked={formData.coverage.includes(option.id)}
                onCheckedChange={() => handleCoverageChange(option.id)}
              />
              <Label htmlFor={option.id}>{option.label}</Label>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="consultation_limit">Limite de Consultas/Ano</Label>
          <Input
            id="consultation_limit"
            name="consultation_limit"
            type="number"
            value={formData.consultation_limit}
            onChange={handleChange}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="exam_limit">Limite de Exames/Ano</Label>
          <Input
            id="exam_limit"
            name="exam_limit"
            type="number"
            value={formData.exam_limit}
            onChange={handleChange}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="surgery_coverage_percentage">Cobertura Cirurgias (%)</Label>
          <Input
            id="surgery_coverage_percentage"
            name="surgery_coverage_percentage"
            type="number"
            value={formData.surgery_coverage_percentage}
            onChange={handleChange}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="hospitalization_coverage_percentage">Cobertura Internações (%)</Label>
          <Input
            id="hospitalization_coverage_percentage"
            name="hospitalization_coverage_percentage"
            type="number"
            value={formData.hospitalization_coverage_percentage}
            onChange={handleChange}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="emergency_coverage_percentage">Cobertura Emergências (%)</Label>
          <Input
            id="emergency_coverage_percentage"
            name="emergency_coverage_percentage"
            type="number"
            value={formData.emergency_coverage_percentage}
            onChange={handleChange}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="dental_coverage_percentage">Cobertura Odontológica (%)</Label>
          <Input
            id="dental_coverage_percentage"
            name="dental_coverage_percentage"
            type="number"
            value={formData.dental_coverage_percentage}
            onChange={handleChange}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="has_grace_period">Possui Carência</Label>
            <Switch
              id="has_grace_period"
              checked={formData.has_grace_period}
              onCheckedChange={(checked) => setFormData(prev => ({ ...prev, has_grace_period: checked }))}
            />
          </div>
        </div>

        {formData.has_grace_period && (
          <div className="space-y-2">
            <Label htmlFor="grace_period_days">Dias de Carência</Label>
            <Input
              id="grace_period_days"
              name="grace_period_days"
              type="number"
              value={formData.grace_period_days}
              onChange={handleChange}
            />
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="provider_contact">Contato do Fornecedor</Label>
          <Input
            id="provider_contact"
            name="provider_contact"
            value={formData.provider_contact}
            onChange={handleChange}
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="authorization_required">Requer Autorização</Label>
            <Switch
              id="authorization_required"
              checked={formData.authorization_required}
              onCheckedChange={(checked) => setFormData(prev => ({ ...prev, authorization_required: checked }))}
            />
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="is_active">Plano Ativo</Label>
            <Switch
              id="is_active"
              checked={formData.is_active}
              onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_active: checked }))}
            />
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-3">
        <Button type="submit" disabled={isLoading}>
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Salvando...
            </>
          ) : (
            plan ? "Atualizar Plano" : "Criar Plano"
          )}
        </Button>
      </div>
    </form>
  );
}