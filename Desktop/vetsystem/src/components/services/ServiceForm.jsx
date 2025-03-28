import React, { useState, useEffect } from "react";
import { Service } from "@/api/entities";
import { STORAGE_KEY, getMockData } from "@/api/mockData";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/components/ui/use-toast";
import { Loader2, Upload } from "lucide-react";
import { UploadFile } from "@/api/integrations";

export default function ServiceForm({ open, onOpenChange, onSuccess, service }) {
  const [isLoading, setIsLoading] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    category: "banho",
    price: "",
    duration: "",
    points: "",
    image_url: "",
    tenant_id: localStorage.getItem('current_tenant'),
    module: "petshop"
  });

  useEffect(() => {
    if (service) {
      setFormData({
        ...service,
        price: service.price?.toString() || "",
        duration: service.duration?.toString() || "",
        points: service.points?.toString() || "",
      });
    } else {
      setFormData({
        name: "",
        description: "",
        category: "banho",
        price: "",
        duration: "",
        points: "",
        image_url: "",
        tenant_id: localStorage.getItem('current_tenant'),
        module: "petshop"
      });
    }
  }, [service, open]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleImageChange = async (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedImage(file);
      try {
        const { file_url } = await UploadFile({ file });
        setFormData(prev => ({
          ...prev,
          image_url: file_url
        }));
        toast({
          title: "Imagem carregada",
          description: "A imagem foi carregada com sucesso!"
        });
      } catch (error) {
        console.error("Erro ao fazer upload da imagem:", error);
        toast({
          title: "Erro",
          description: "Não foi possível fazer upload da imagem.",
          variant: "destructive"
        });
      }
    }
  };

  const handleModuleChange = (value) => {
    setFormData(prev => ({
      ...prev,
      module: value,
      category: value === "clinica" ? "consultation" : "grooming"
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const tenantId = localStorage.getItem('current_tenant');
      const serviceData = {
        ...formData,
        price: parseFloat(formData.price),
        duration: parseInt(formData.duration),
        points: parseInt(formData.points),
        tenant_id: tenantId
      };

      if (service?.id) {
        await Service.update(service.id, serviceData);
        toast({
          title: "Sucesso",
          description: "Serviço atualizado com sucesso!"
        });
      } else {
        // Gera um ID único baseado no timestamp e um número aleatório
        const uniqueId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        serviceData.id = uniqueId;
        await Service.create(serviceData);
        toast({
          title: "Sucesso",
          description: "Serviço criado com sucesso!"
        });
      }
      
      // Atualiza os dados mockados
      const mockData = getMockData();
      if (service?.id) {
        const index = mockData.services.findIndex(s => s.id === service.id);
        if (index !== -1) {
          mockData.services[index] = serviceData;
        }
      } else {
        mockData.services.push(serviceData);
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(mockData));
      
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error("Erro ao salvar serviço:", error);
      toast({
        title: "Erro",
        description: "Não foi possível salvar o serviço.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>
            {service ? "Editar Serviço" : "Novo Serviço"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nome do Serviço*</Label>
            <Input
              id="name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descrição</Label>
            <Textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="module">Módulo*</Label>
              <Select
                value={formData.module}
                onValueChange={handleModuleChange}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o módulo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="clinica">Clínica</SelectItem>
                  <SelectItem value="petshop">Petshop</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">Categoria*</Label>
              <Select
                value={formData.category}
                onValueChange={(value) => setFormData(prev => ({ ...prev, category: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma categoria" />
                </SelectTrigger>
                <SelectContent>
                  {formData.module === "clinica" ? (
                    <>
                      <SelectItem value="consultation">Consulta</SelectItem>
                      <SelectItem value="exam">Exame</SelectItem>
                      <SelectItem value="vaccination">Vacinação</SelectItem>
                      <SelectItem value="surgery">Cirurgia</SelectItem>
                      <SelectItem value="return">Retorno</SelectItem>
                      <SelectItem value="telemedicine">Telemedicina</SelectItem>
                    </>
                  ) : (
                    <>
                      <SelectItem value="grooming">Banho e Tosa</SelectItem>
                      <SelectItem value="products">Produtos</SelectItem>
                      <SelectItem value="food">Alimentação</SelectItem>
                      <SelectItem value="accessories">Acessórios</SelectItem>
                      <SelectItem value="medicines">Medicamentos</SelectItem>
                    </>
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="price">Preço (R$)*</Label>
              <Input
                id="price"
                name="price"
                type="number"
                step="0.01"
                min="0"
                value={formData.price}
                onChange={handleChange}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="duration">Duração (minutos)*</Label>
              <Input
                id="duration"
                name="duration"
                type="number"
                min="1"
                value={formData.duration}
                onChange={handleChange}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="points">Pontos de Fidelidade</Label>
            <Input
              id="points"
              name="points"
              type="number"
              min="0"
              value={formData.points}
              onChange={handleChange}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="image">Imagem do Serviço</Label>
            <div className="flex items-center gap-4">
              {formData.image_url && (
                <img
                  src={formData.image_url}
                  alt="Preview"
                  className="w-20 h-20 object-cover rounded"
                />
              )}
              <div className="flex-1">
                <Input
                  id="image"
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="cursor-pointer"
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  Salvar Serviço
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}