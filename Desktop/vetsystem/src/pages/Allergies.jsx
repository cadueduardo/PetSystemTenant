import React, { useState, useEffect } from "react";
import { Allergy } from "@/api/entities";
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

export default function AllergiesPage() {
  const [allergies, setAllergies] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingAllergy, setEditingAllergy] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    type: "",
    description: "",
    symptoms: [],
    recommendations: "",
    tenant_id: localStorage.getItem('current_tenant')
  });

  useEffect(() => {
    loadAllergies();
  }, []);

  const loadAllergies = async () => {
    setIsLoading(true);
    try {
      const data = await Allergy.list();
      setAllergies(data);
    } catch (error) {
      console.error("Erro ao carregar alergias:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar a lista de alergias.",
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
      if (editingAllergy) {
        await Allergy.update(editingAllergy.id, formData);
      } else {
        await Allergy.create(formData);
      }

      toast({
        title: "Sucesso",
        description: `Alergia ${editingAllergy ? 'atualizada' : 'cadastrada'} com sucesso!`
      });

      setShowForm(false);
      setEditingAllergy(null);
      loadAllergies();
    } catch (error) {
      console.error("Erro ao salvar alergia:", error);
      toast({
        title: "Erro",
        description: "Não foi possível salvar a alergia.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("Tem certeza que deseja excluir esta alergia?")) return;

    setIsLoading(true);
    try {
      await Allergy.delete(id);
      toast({
        title: "Sucesso",
        description: "Alergia excluída com sucesso!"
      });
      loadAllergies();
    } catch (error) {
      console.error("Erro ao excluir alergia:", error);
      toast({
        title: "Erro",
        description: "Não foi possível excluir a alergia.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const allergyTypes = [
    { value: "food", label: "Alimentar" },
    { value: "medication", label: "Medicamento" },
    { value: "environmental", label: "Ambiental" },
    { value: "other", label: "Outra" }
  ];

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Alergias</h1>
        <Button onClick={() => {
          setEditingAllergy(null);
          setFormData({
            name: "",
            type: "",
            description: "",
            symptoms: [],
            recommendations: "",
            tenant_id: localStorage.getItem('current_tenant')
          });
          setShowForm(true);
        }}>
          <Plus className="h-4 w-4 mr-2" />
          Nova Alergia
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
                <TableHead>Tipo</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {allergies.map((allergy) => (
                <TableRow key={allergy.id}>
                  <TableCell>{allergy.name}</TableCell>
                  <TableCell>
                    {allergyTypes.find(type => type.value === allergy.type)?.label}
                  </TableCell>
                  <TableCell>{allergy.description}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setEditingAllergy(allergy);
                        setFormData(allergy);
                        setShowForm(true);
                      }}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(allergy.id)}
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingAllergy ? 'Editar Alergia' : 'Nova Alergia'}
            </DialogTitle>
            <DialogDescription>
              Preencha os dados da alergia
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="type">Tipo</Label>
              <Select
                value={formData.type}
                onValueChange={(value) => setFormData({ ...formData, type: value })}
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o tipo" />
                </SelectTrigger>
                <SelectContent>
                  {allergyTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Descrição</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="symptoms">Sintomas (separados por vírgula)</Label>
              <Input
                id="symptoms"
                value={formData.symptoms.join(", ")}
                onChange={(e) => setFormData({ ...formData, symptoms: e.target.value.split(",").map(s => s.trim()) })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="recommendations">Recomendações</Label>
              <Textarea
                id="recommendations"
                value={formData.recommendations}
                onChange={(e) => setFormData({ ...formData, recommendations: e.target.value })}
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
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