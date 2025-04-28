import { useState, useEffect } from "react";
import PropTypes from "prop-types";
import { Service } from "@/api/entities";
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
import { Loader2 } from "lucide-react";
import { UploadFile } from "@/api/integrations";
import { collection, query, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebaseConfig";

const NO_SPECIALTY_VALUE = "__NONE__";

const ServiceForm = ({ service, open, onOpenChange, onSuccess }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    category: "grooming",
    price: "",
    duration: "",
    points: "",
    image_url: "",
    tenant_id: localStorage.getItem('current_tenant'),
    module: "petshop",
    is_active: true,
    required_specialty: NO_SPECIALTY_VALUE,
  });

  const [availableSpecialties, setAvailableSpecialties] = useState([]);
  const [loadingSpecialties, setLoadingSpecialties] = useState(false);

  useEffect(() => {
    console.log("[ServiceForm Edit Effect] Running. Service:", service, "Open:", open);

    if (service && open) {
      const initialEditData = {
        name: service.name || "",
        description: service.description || "",
        module: service.module || "petshop",
        category: service.category || (service.module === 'clinica' ? 'consultation' : 'grooming'),
        price: service.price?.toString() || "",
        duration: service.duration?.toString() || "",
        points: service.points?.toString() || "",
        image_url: service.image_url || "",
        tenant_id: service.tenant_id || localStorage.getItem('current_tenant'),
        is_active: service.is_active !== undefined ? service.is_active : true,
        required_specialty: service.required_specialty || NO_SPECIALTY_VALUE,
      };
      console.log("[ServiceForm Edit Effect] Setting form data for EDIT:", initialEditData);
      setFormData(initialEditData);
    } else if (!service && open) {
      const initialCreateData = {
        name: "",
        description: "",
        module: "petshop",
        category: "grooming",
        price: "",
        duration: "",
        points: "",
        image_url: "",
        tenant_id: localStorage.getItem('current_tenant'),
        is_active: true,
        required_specialty: NO_SPECIALTY_VALUE,
      };
      console.log("[ServiceForm Edit Effect] Setting form data for CREATE:", initialCreateData);
      setFormData(initialCreateData);
    } else {
      console.log("[ServiceForm Edit Effect] Not open or no service defined when expected. Skipping setFormData.");
    }

  }, [service, open]);

  useEffect(() => {
    if (!open) {
      setAvailableSpecialties([]);
      return;
    }

    setLoadingSpecialties(true);
    const specialtiesCollection = collection(db, 'sharedVetSpecialties');
    const q = query(specialtiesCollection);

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const specialtiesData = querySnapshot.docs.map(doc => doc.data().name);
      setAvailableSpecialties(specialtiesData.sort());
      setLoadingSpecialties(false);
    }, (err) => {
      console.error("Erro ao buscar especialidades no ServiceForm: ", err);
      toast({ variant: "destructive", title: "Erro", description: "Falha ao carregar especialidades." });
      setLoadingSpecialties(false);
    });

    return () => unsubscribe();

  }, [open, db]);

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
    console.log(`[ServiceForm handleModuleChange] Module changed by user to: ${value}`);
    
    setFormData(prev => {
      const newState = {
      ...prev,
      module: value,
        category: value === "clinica" ? "consultation" : "grooming",
        required_specialty: value === "clinica" ? prev.required_specialty : NO_SPECIALTY_VALUE,
      };
      console.log("[ServiceForm handleModuleChange] New state calculated:", newState);
      return newState;
    });
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
        tenant_id: tenantId,
        required_specialty: formData.module === 'clinica' && formData.required_specialty !== NO_SPECIALTY_VALUE 
                          ? formData.required_specialty 
                          : null,
      };

      if (serviceData.required_specialty === null) {
        delete serviceData.required_specialty;
      }

      if (service?.id) {
        await Service.update(service.id, serviceData);
        toast({
          title: "Sucesso",
          description: "Serviço atualizado com sucesso!"
        });
      } else {
        await Service.create(serviceData);
        toast({
          title: "Sucesso",
          description: "Serviço criado com sucesso!"
        });
      }
      
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
                required
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

          {formData.module === 'clinica' && (
            <div className="space-y-2">
              <Label htmlFor="required_specialty">Especialidade Requerida*</Label>
              
              {loadingSpecialties ? (
                <div className="h-10 px-3 py-2 border border-input bg-background rounded-md text-sm text-muted-foreground flex items-center">
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Carregando especialidades...
                </div>
              ) : (
                <Select
                  name="required_specialty"
                  value={formData.required_specialty}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, required_specialty: value }))}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder={"Selecione a especialidade..."} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_SPECIALTY_VALUE}>Nenhuma (Atendimento Clínico Geral)</SelectItem>
                    {availableSpecialties.map((spec) => (
                      <SelectItem key={spec} value={spec}>
                        {spec}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}

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
};

ServiceForm.propTypes = {
  service: PropTypes.object,
  open: PropTypes.bool.isRequired,
  onOpenChange: PropTypes.func.isRequired,
  onSuccess: PropTypes.func.isRequired,
};

export default ServiceForm;