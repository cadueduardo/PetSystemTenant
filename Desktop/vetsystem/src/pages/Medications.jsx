
import React, { useState, useEffect } from "react";
import { Medication } from "@/api/entities";
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
import { toast } from "@/components/ui/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Edit, Trash2, Loader2 } from "lucide-react";

export default function MedicationsPage() {
  const [medications, setMedications] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingMedication, setEditingMedication] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    active_ingredient: "",
    manufacturer: "",
    concentration: "",
    presentation: "",
    prescription_required: true,
    description: "",
    tenant_id: localStorage.getItem('current_tenant')
  });

  useEffect(() => {
    loadMedications();
  }, []);

  const loadMedications = async () => {
    setIsLoading(true);
    try {
      const data = await Medication.list();
      setMedications(data);
    } catch (error) {
      console.error("Erro ao carregar medicamentos:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar a lista de medicamentos.",
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
      if (editingMedication) {
        await Medication.update(editingMedication.id, formData);
      } else {
        await Medication.create(formData);
      }

      toast({
        title: "Sucesso",
        description: `Medicamento ${editingMedication ? 'atualizado' : 'cadastrado'} com sucesso!`
      });

      setShowForm(false);
      setEditingMedication(null);
      loadMedications();
    } catch (error) {
      console.error("Erro ao salvar medicamento:", error);
      toast({
        title: "Erro",
        description: "Não foi possível salvar o medicamento.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("Tem certeza que deseja excluir este medicamento?")) return;

    setIsLoading(true);
    try {
      await Medication.delete(id);
      toast({
        title: "Sucesso",
        description: "Medicamento excluído com sucesso!"
      });
      loadMedications();
    } catch (error) {
      console.error("Erro ao excluir medicamento:", error);
      toast({
        title: "Erro",
        description: "Não foi possível excluir o medicamento.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const presentationOptions = [
    { value: "tablet", label: "Comprimido" },
    { value: "capsule", label: "Cápsula" },
    { value: "liquid", label: "Líquido" },
    { value: "injection", label: "Injeção" },
    { value: "cream", label: "Creme" },
    { value: "ointment", label: "Pomada" },
    { value: "other", label: "Outro" }
  ];

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Medicamentos</h1>
        <Button onClick={() => {
          setEditingMedication(null);
          setFormData({
            name: "",
            active_ingredient: "",
            manufacturer: "",
            concentration: "",
            presentation: "",
            prescription_required: true,
            description: "",
            tenant_id: localStorage.getItem('current_tenant')
          });
          setShowForm(true);
        }}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Medicamento
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Princípio Ativo</TableHead>
                <TableHead>Apresentação</TableHead>
                <TableHead>Prescrição</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {medications.map((medication) => (
                <TableRow key={medication.id}>
                  <TableCell>{medication.name}</TableCell>
                  <TableCell>{medication.active_ingredient}</TableCell>
                  <TableCell>
                    {presentationOptions.find(opt => opt.value === medication.presentation)?.label}
                  </TableCell>
                  <TableCell>
                    {medication.prescription_required ? "Sim" : "Não"}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setEditingMedication(medication);
                        setFormData(medication);
                        setShowForm(true);
                      }}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(medication.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-h-[90vh] overflow-y-auto max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              {editingMedication ? "Editar Medicamento" : "Novo Medicamento"}
            </DialogTitle>
            <DialogDescription>
              Preencha os dados do medicamento
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome do Medicamento</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="active_ingredient">Princípio Ativo</Label>
                <Input
                  id="active_ingredient"
                  value={formData.active_ingredient}
                  onChange={(e) => setFormData({ ...formData, active_ingredient: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="manufacturer">Fabricante</Label>
                <Input
                  id="manufacturer"
                  value={formData.manufacturer}
                  onChange={(e) => setFormData({ ...formData, manufacturer: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="concentration">Concentração</Label>
                <Input
                  id="concentration"
                  value={formData.concentration}
                  onChange={(e) => setFormData({ ...formData, concentration: e.target.value })}
                  placeholder="Ex: 500mg/mL"
                />
              </div>

              <div className="space-y-2">
                <Label>Apresentação</Label>
                <Select
                  value={formData.presentation}
                  onValueChange={(value) => setFormData({ ...formData, presentation: value })}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {presentationOptions.map(option => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Requer Prescrição</Label>
                <Select
                  value={formData.prescription_required ? "true" : "false"}
                  onValueChange={(value) => setFormData({ ...formData, prescription_required: value === "true" })}
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
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Descrição e Indicações</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="min-h-[100px]"
              />
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
