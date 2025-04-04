import React, { useState, useEffect } from "react";
import { Vaccine } from "@/api/entities";
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
import { toast } from "@/components/ui/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Edit, Trash2, Loader2 } from "lucide-react";

export default function VaccinesPage() {
  const [vaccines, setVaccines] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingVaccine, setEditingVaccine] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    manufacturer: "",
    species: [],
    validity_months: "",
    tenant_id: localStorage.getItem('current_tenant')
  });

  useEffect(() => {
    loadVaccines();
  }, []);

  const loadVaccines = async () => {
    setIsLoading(true);
    try {
      const data = await Vaccine.list();
      const vaccinesWithSpecies = data.map(vaccine => ({
        ...vaccine,
        species: Array.isArray(vaccine.species) ? vaccine.species : []
      }));
      setVaccines(vaccinesWithSpecies);
    } catch (error) {
      console.error("Erro ao carregar vacinas:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar a lista de vacinas.",
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
      if (editingVaccine) {
        await Vaccine.update(editingVaccine.id, formData);
      } else {
        await Vaccine.create(formData);
      }

      toast({
        title: "Sucesso",
        description: `Vacina ${editingVaccine ? 'atualizada' : 'cadastrada'} com sucesso!`
      });

      setShowForm(false);
      setEditingVaccine(null);
      loadVaccines();
    } catch (error) {
      console.error("Erro ao salvar vacina:", error);
      toast({
        title: "Erro",
        description: "Não foi possível salvar a vacina.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleEdit = (vaccine) => {
    setEditingVaccine(vaccine);
    setFormData(vaccine);
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!confirm("Tem certeza que deseja excluir esta vacina?")) return;

    try {
      await Vaccine.delete(id);
      toast({
        title: "Sucesso",
        description: "Vacina excluída com sucesso!"
      });
      loadVaccines();
    } catch (error) {
      console.error("Erro ao excluir vacina:", error);
      toast({
        title: "Erro",
        description: "Não foi possível excluir a vacina.",
        variant: "destructive"
      });
    }
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Vacinas</h1>
        <Button onClick={() => {
          setEditingVaccine(null);
          setFormData({
            name: "",
            description: "",
            manufacturer: "",
            species: [],
            validity_months: "",
            tenant_id: localStorage.getItem('current_tenant')
          });
          setShowForm(true);
        }}>
          <Plus className="h-4 w-4 mr-2" />
          Nova Vacina
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
                <TableHead>Fabricante</TableHead>
                <TableHead>Espécies</TableHead>
                <TableHead>Validade (meses)</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {vaccines.map((vaccine) => (
                <TableRow key={`${vaccine.id}-${vaccine.tenant_id}`}>
                  <TableCell>{vaccine.name}</TableCell>
                  <TableCell>{vaccine.manufacturer}</TableCell>
                  <TableCell>
                    {vaccine.species.map(s => s === 'dog' ? 'Cão' : 'Gato').join(', ')}
                  </TableCell>
                  <TableCell>{vaccine.validity_months}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEdit(vaccine)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(vaccine.id)}
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
            <DialogTitle>{editingVaccine ? 'Editar' : 'Nova'} Vacina</DialogTitle>
            <DialogDescription>
              Preencha os dados da vacina
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome da Vacina *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
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
              <Label>Espécies *</Label>
              <Select
                value={formData.species[0] || ""}
                onValueChange={(value) => setFormData({ ...formData, species: [value] })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a espécie" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="dog">Cão</SelectItem>
                  <SelectItem value="cat">Gato</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="validity_months">Validade (meses)</Label>
              <Input
                id="validity_months"
                type="number"
                value={formData.validity_months}
                onChange={(e) => setFormData({ ...formData, validity_months: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Descrição</Label>
              <textarea
                id="description"
                className="min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>

            <div className="flex justify-end gap-4">
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Salvar'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}