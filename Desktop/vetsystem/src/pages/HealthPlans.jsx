import React, { useState, useEffect } from "react";
import { HealthPlan } from "@/api/entities";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/components/ui/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Edit, Trash2, Loader2, CheckCircle2 } from "lucide-react";

export default function HealthPlansPage() {
  const [plans, setPlans] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingPlan, setEditingPlan] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    provider: "",
    description: "",
    coverage: [],
    consultation_limit: 12,
    exam_limit: 6,
    surgery_coverage_percentage: 0,
    hospitalization_coverage_percentage: 0,
    emergency_coverage_percentage: 0,
    dental_coverage_percentage: 0,
    has_grace_period: false,
    grace_period_days: 30,
    is_active: true,
    provider_contact: "",
    authorization_required: false,
    monthly_fee: 0,
    annual_fee: 0,
    tenant_id: localStorage.getItem('current_tenant')
  });

  useEffect(() => {
    loadPlans();
  }, []);

  const loadPlans = async () => {
    setIsLoading(true);
    try {
      const data = await HealthPlan.list();
      setPlans(data);
    } catch (error) {
      console.error("Erro ao carregar planos:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar a lista de planos.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleEdit = (plan) => {
    setEditingPlan(plan);
    setFormData({
      name: plan.name || "",
      provider: plan.provider || "",
      description: plan.description || "",
      coverage: plan.coverage || [],
      consultation_limit: plan.consultation_limit || 0,
      exam_limit: plan.exam_limit || 0,
      surgery_coverage_percentage: plan.surgery_coverage_percentage || 0,
      hospitalization_coverage_percentage: plan.hospitalization_coverage_percentage || 0,
      emergency_coverage_percentage: plan.emergency_coverage_percentage || 0,
      dental_coverage_percentage: plan.dental_coverage_percentage || 0,
      has_grace_period: plan.has_grace_period || false,
      grace_period_days: plan.grace_period_days || 30,
      is_active: plan.is_active !== false,
      provider_contact: plan.provider_contact || "",
      authorization_required: plan.authorization_required || false,
      monthly_fee: plan.monthly_fee || 0,
      annual_fee: plan.annual_fee || 0,
      tenant_id: plan.tenant_id || localStorage.getItem('current_tenant')
    });
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!confirm("Tem certeza que deseja excluir este plano?")) return;

    setIsLoading(true);
    try {
      await HealthPlan.delete(id);
      toast({
        title: "Sucesso",
        description: "Plano de saúde excluído com sucesso!",
      });
      loadPlans();
    } catch (error) {
      console.error("Erro ao excluir plano:", error);
      toast({
        title: "Erro",
        description: "Não foi possível excluir o plano.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (editingPlan) {
        await HealthPlan.update(editingPlan.id, formData);
        toast({
          title: "Sucesso",
          description: "Plano de saúde atualizado com sucesso!"
        });
      } else {
        await HealthPlan.create(formData);
        toast({
          title: "Sucesso",
          description: "Plano de saúde cadastrado com sucesso!"
        });
      }

      setShowForm(false);
      setEditingPlan(null);
      loadPlans();
    } catch (error) {
      console.error("Erro ao salvar plano:", error);
      toast({
        title: "Erro",
        description: "Não foi possível salvar o plano de saúde.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const coverageOptions = [
    { value: "consultation", label: "Consultas" },
    { value: "vaccine", label: "Vacinas" },
    { value: "exam", label: "Exames" },
    { value: "surgery", label: "Cirurgias" },
    { value: "hospitalization", label: "Internações" },
    { value: "emergency", label: "Emergências" },
    { value: "telemedicine", label: "Telemedicina" },
    { value: "dental", label: "Odontologia" }
  ];

  const getCoverageLabel = (key) => {
    const option = coverageOptions.find(opt => opt.value === key);
    return option ? option.label : key;
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Planos de Saúde</h1>
        <Button onClick={() => {
          setEditingPlan(null);
          setFormData({
            name: "",
            provider: "",
            description: "",
            coverage: [],
            consultation_limit: 12,
            exam_limit: 6, 
            surgery_coverage_percentage: 0,
            hospitalization_coverage_percentage: 0,
            emergency_coverage_percentage: 0,
            dental_coverage_percentage: 0,
            has_grace_period: false,
            grace_period_days: 30,
            is_active: true,
            provider_contact: "",
            authorization_required: false,
            monthly_fee: 0,
            annual_fee: 0,
            tenant_id: localStorage.getItem('current_tenant')
          });
          setShowForm(true);
        }}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Plano
        </Button>
      </div>

      {isLoading && plans.length === 0 ? (
        <div className="flex justify-center items-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Fornecedor</TableHead>
                <TableHead>Coberturas</TableHead>
                <TableHead>Mensalidade</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {plans.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-6 text-gray-500">
                    Nenhum plano de saúde cadastrado. Clique em "Novo Plano" para adicionar.
                  </TableCell>
                </TableRow>
              ) : (
                plans.map((plan) => (
                  <TableRow key={plan.id}>
                    <TableCell className="font-medium">{plan.name}</TableCell>
                    <TableCell>{plan.provider}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {plan.coverage?.slice(0, 3).map((item) => (
                          <Badge key={item} variant="outline">
                            {getCoverageLabel(item)}
                          </Badge>
                        ))}
                        {plan.coverage?.length > 3 && (
                          <Badge variant="outline">
                            +{plan.coverage.length - 3}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {plan.monthly_fee ? `R$ ${plan.monthly_fee.toFixed(2)}` : "-"}
                    </TableCell>
                    <TableCell>
                      {plan.is_active !== false ? (
                        <Badge className="bg-green-100 text-green-800">Ativo</Badge>
                      ) : (
                        <Badge variant="outline" className="text-gray-500">Inativo</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => handleEdit(plan)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          className="text-red-600 hover:text-red-700"
                          onClick={() => handleDelete(plan.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-h-[90vh] overflow-y-auto max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              {editingPlan ? "Editar Plano" : "Novo Plano"}
            </DialogTitle>
            <DialogDescription>
              Preencha os dados do plano de saúde
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome do Plano</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="provider">Fornecedor</Label>
                <Input
                  id="provider"
                  value={formData.provider}
                  onChange={(e) => setFormData({ ...formData, provider: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="consultation_limit">Limite de Consultas (por ano)</Label>
                <Input
                  id="consultation_limit"
                  type="number"
                  value={formData.consultation_limit}
                  onChange={(e) => setFormData({ ...formData, consultation_limit: parseInt(e.target.value) })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="exam_limit">Limite de Exames (por ano)</Label>
                <Input
                  id="exam_limit"
                  type="number"
                  value={formData.exam_limit}
                  onChange={(e) => setFormData({ ...formData, exam_limit: parseInt(e.target.value) })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="surgery_coverage">Cobertura Cirurgias (%)</Label>
                <Input
                  id="surgery_coverage"
                  type="number"
                  value={formData.surgery_coverage_percentage}
                  onChange={(e) => setFormData({ ...formData, surgery_coverage_percentage: parseInt(e.target.value) })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="hospitalization_coverage">Cobertura Internações (%)</Label>
                <Input
                  id="hospitalization_coverage"
                  type="number"
                  value={formData.hospitalization_coverage_percentage}
                  onChange={(e) => setFormData({ ...formData, hospitalization_coverage_percentage: parseInt(e.target.value) })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="emergency_coverage">Cobertura Emergências (%)</Label>
                <Input
                  id="emergency_coverage"
                  type="number"
                  value={formData.emergency_coverage_percentage}
                  onChange={(e) => setFormData({ ...formData, emergency_coverage_percentage: parseInt(e.target.value) })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="dental_coverage">Cobertura Odontológica (%)</Label>
                <Input
                  id="dental_coverage"
                  type="number"
                  value={formData.dental_coverage_percentage}
                  onChange={(e) => setFormData({ ...formData, dental_coverage_percentage: parseInt(e.target.value) })}
                />
              </div>

              <div className="space-y-2">
                <Label>Requer Autorização Prévia</Label>
                <Select
                  value={formData.authorization_required ? "true" : "false"}
                  onValueChange={(value) => setFormData({ ...formData, authorization_required: value === "true" })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="true">Sim</SelectItem>
                    <SelectItem value="false">Não</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Possui Carência</Label>
                <Select
                  value={formData.has_grace_period ? "true" : "false"}
                  onValueChange={(value) => setFormData({ ...formData, has_grace_period: value === "true" })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="true">Sim</SelectItem>
                    <SelectItem value="false">Não</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {formData.has_grace_period && (
                <div className="space-y-2">
                  <Label htmlFor="grace_period_days">Período de Carência (dias)</Label>
                  <Input
                    id="grace_period_days"
                    type="number"
                    value={formData.grace_period_days}
                    onChange={(e) => setFormData({ ...formData, grace_period_days: parseInt(e.target.value) })}
                  />
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label>Serviços Cobertos</Label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {coverageOptions.map(option => (
                  <div key={option.value} className="flex items-center space-x-2">
                    <Checkbox
                      id={option.value}
                      checked={formData.coverage?.includes(option.value)}
                      onCheckedChange={(checked) => {
                        const newCoverage = checked
                          ? [...(formData.coverage || []), option.value]
                          : (formData.coverage || []).filter(c => c !== option.value);
                        setFormData({ ...formData, coverage: newCoverage });
                      }}
                    />
                    <Label htmlFor={option.value}>{option.label}</Label>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Descrição do Plano</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="min-h-[100px]"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="provider_contact">Contato do Plano</Label>
              <Input
                id="provider_contact"
                value={formData.provider_contact}
                onChange={(e) => setFormData({ ...formData, provider_contact: e.target.value })}
                placeholder="Telefone ou email para contato"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="monthly_fee">Mensalidade (R$)</Label>
                <Input
                  id="monthly_fee"
                  type="number"
                  step="0.01"
                  value={formData.monthly_fee}
                  onChange={(e) => setFormData({ ...formData, monthly_fee: parseFloat(e.target.value) })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="annual_fee">Anuidade (R$)</Label>
                <Input
                  id="annual_fee"
                  type="number"
                  step="0.01"
                  value={formData.annual_fee}
                  onChange={(e) => setFormData({ ...formData, annual_fee: parseFloat(e.target.value) })}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  'Salvar'
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}