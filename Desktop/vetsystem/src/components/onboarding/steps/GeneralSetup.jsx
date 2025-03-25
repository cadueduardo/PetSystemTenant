import React, { useState, useEffect, useRef } from "react";
import { Customization } from "@/api/entities";
import { Tenant } from "@/api/entities";
import { 
  Button,
  Input,
  Label,
  Textarea,
  Card,
  CardContent
} from "@/components/ui/";
import { toast } from "@/components/ui/use-toast";
import { 
  Loader2, 
  ArrowRight, 
  Upload, 
  Image as ImageIcon,
  Building,
  Check
} from "lucide-react";
import { UploadFile } from "@/api/integrations";

export default function GeneralSetup({ tenant, customizationId, onNext }) {
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    company_name: tenant?.company_name || "",
    company_logo_url: "",
    primary_color: "#3B82F6",
    secondary_color: "#1E40AF"
  });
  const [imagePreview, setImagePreview] = useState("");
  const fileInputRef = useRef(null);
  const [isFormValid, setIsFormValid] = useState(false);

  // Validar o formulário
  useEffect(() => {
    if (formData.company_name && formData.company_name.length >= 3) {
      setIsFormValid(true);
    } else {
      setIsFormValid(false);
    }
  }, [formData]);

  // Carregar dados existentes
  useEffect(() => {
    loadExistingData();
  }, []);

  const loadExistingData = async () => {
    setIsLoading(true);
    try {
      const customizations = await Customization.filter({ tenant_id: tenant.id });
      
      if (customizations.length > 0) {
        const customization = customizations[0];
        setFormData(prev => ({
          ...prev,
          company_name: tenant.company_name,
          company_logo_url: customization.company_logo_url || "",
          primary_color: customization.primary_color || "#3B82F6",
          secondary_color: customization.secondary_color || "#1E40AF"
        }));
        
        if (customization.company_logo_url) {
          setImagePreview(customization.company_logo_url);
        }
      }
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    // Verificar tipo de arquivo
    const validTypes = ['image/jpeg', 'image/png', 'image/svg+xml'];
    if (!validTypes.includes(file.type)) {
      toast({
        title: "Formato inválido",
        description: "Por favor, selecione uma imagem JPG, PNG ou SVG.",
        variant: "destructive"
      });
      return;
    }
    
    // Mostrar preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setImagePreview(e.target.result);
    };
    reader.readAsDataURL(file);
    
    // Enviar arquivo
    setIsSaving(true);
    try {
      const { file_url } = await UploadFile({ file });
      setFormData(prev => ({ ...prev, company_logo_url: file_url }));
      
      toast({
        title: "Logo enviado",
        description: "Seu logo foi enviado com sucesso."
      });
    } catch (error) {
      console.error("Erro ao enviar logo:", error);
      toast({
        title: "Erro ao enviar",
        description: "Não foi possível enviar o logo. Tente novamente.",
        variant: "destructive"
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSubmit = async () => {
    if (!isFormValid) return;
    
    setIsSaving(true);
    try {
      // Atualizar nome da empresa no Tenant
      await Tenant.update(tenant.id, {
        company_name: formData.company_name
      });
      
      // Atualizar customização
      await Customization.update(customizationId, {
        company_logo_url: formData.company_logo_url,
        primary_color: formData.primary_color,
        secondary_color: formData.secondary_color
      });
      
      toast({
        title: "Configurações salvas",
        description: "As configurações visuais foram salvas com sucesso!"
      });
      
      onNext();
    } catch (error) {
      console.error("Erro ao salvar configurações:", error);
      toast({
        title: "Erro ao salvar",
        description: "Não foi possível salvar as configurações. Tente novamente.",
        variant: "destructive"
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Estilo dinâmico com as cores selecionadas
  const previewStyle = {
    "--primary-color": formData.primary_color,
    "--secondary-color": formData.secondary_color,
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-8" style={previewStyle}>
      <div>
        <h2 className="text-xl font-semibold mb-2">Personalização Visual</h2>
        <p className="text-gray-600">
          Configure a aparência visual da sua loja para refletir a identidade da sua marca.
        </p>
      </div>

      <div className="space-y-6">
        <div className="space-y-3">
          <Label htmlFor="company_name">Nome da Loja <span className="text-red-500">*</span></Label>
          <Input
            id="company_name"
            value={formData.company_name}
            onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
            placeholder="Nome da sua loja"
            className={!isFormValid && formData.company_name ? "border-red-300" : ""}
          />
          {!isFormValid && formData.company_name && (
            <p className="text-red-500 text-sm">O nome deve ter pelo menos 3 caracteres</p>
          )}
        </div>

        <div className="space-y-3">
          <Label>Logo da Loja</Label>
          <div className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-lg p-6 cursor-pointer hover:border-gray-400 transition-all bg-gray-50"
               onClick={() => fileInputRef.current?.click()}>
            {imagePreview ? (
              <div className="flex flex-col items-center">
                <div className="w-48 h-48 flex items-center justify-center mb-4 bg-white rounded-lg p-2">
                  <img src={imagePreview} alt="Logo preview" className="max-w-full max-h-full object-contain" />
                </div>
                <Button variant="outline" type="button" className="flex items-center gap-2">
                  <Upload className="h-4 w-4" />
                  Alterar Logo
                </Button>
              </div>
            ) : (
              <>
                <ImageIcon className="w-12 h-12 text-gray-400 mb-3" />
                <p className="text-center text-gray-500 mb-2">
                  Clique para fazer upload do seu logo
                </p>
                <p className="text-center text-gray-400 text-sm">
                  Suporta JPG, PNG, SVG
                </p>
                <Button variant="outline" type="button" className="mt-4 flex items-center gap-2">
                  <Upload className="h-4 w-4" />
                  Escolher Arquivo
                </Button>
              </>
            )}
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              accept=".jpg,.jpeg,.png,.svg" 
              onChange={handleFileChange}
            />
          </div>
        </div>

        <div className="space-y-4">
          <Label>Cores da Sua Marca</Label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="primary_color" className="text-sm flex items-center gap-2">
                <div className="w-4 h-4 rounded-full" style={{ backgroundColor: formData.primary_color }}></div>
                Cor Primária
              </Label>
              <div className="flex">
                <Input
                  id="primary_color"
                  type="color"
                  value={formData.primary_color}
                  onChange={(e) => setFormData({ ...formData, primary_color: e.target.value })}
                  className="w-12 h-10 p-1 mr-2"
                />
                <Input
                  value={formData.primary_color.toUpperCase()}
                  onChange={(e) => setFormData({ ...formData, primary_color: e.target.value })}
                  className="font-mono"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="secondary_color" className="text-sm flex items-center gap-2">
                <div className="w-4 h-4 rounded-full" style={{ backgroundColor: formData.secondary_color }}></div>
                Cor Secundária
              </Label>
              <div className="flex">
                <Input
                  id="secondary_color"
                  type="color"
                  value={formData.secondary_color}
                  onChange={(e) => setFormData({ ...formData, secondary_color: e.target.value })}
                  className="w-12 h-10 p-1 mr-2"
                />
                <Input
                  value={formData.secondary_color.toUpperCase()}
                  onChange={(e) => setFormData({ ...formData, secondary_color: e.target.value })}
                  className="font-mono"
                />
              </div>
            </div>
          </div>
        </div>

        <Card className="mt-8">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <Building className="h-6 w-6 text-blue-600" />
              <div>
                <h3 className="font-medium">Preview</h3>
                <p className="text-sm text-gray-500">
                  Veja como as cores serão aplicadas na sua loja
                </p>
              </div>
            </div>

            <div className="mt-6 space-y-4">
              <div className="h-12 rounded-lg" style={{ backgroundColor: formData.primary_color }}></div>
              <div className="h-12 rounded-lg" style={{ backgroundColor: formData.secondary_color }}></div>
            </div>
          </CardContent>
        </Card>

        <Button 
          onClick={handleSubmit} 
          disabled={!isFormValid || isSaving}
          className="w-full"
        >
          {isSaving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Salvando...
            </>
          ) : (
            <>
              <Check className="mr-2 h-4 w-4" />
              Salvar e Continuar
            </>
          )}
        </Button>
      </div>
    </div>
  );
}