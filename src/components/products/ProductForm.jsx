// src/components/products/ProductForm.jsx
import { useState, useEffect, useRef } from "react";
import PropTypes from 'prop-types'; // Import para PropTypes
import { Product } from "@/api/entities";
import { Button } from "@/components/ui/button";
// --- Imports CORRIGIDOS do Shadcn UI ---
import { Input } from "@/components/ui/input"; // <<< Adicionado
import { Label } from "@/components/ui/label"; // <<< Adicionado
import { Checkbox } from "@/components/ui/checkbox"; // <<< Adicionado
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog"; // <<< Garantido
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"; // <<< Adicionado
import { toast } from "@/components/ui/use-toast"; // <<< Adicionado
import { Textarea } from "@/components/ui/textarea"; // <<< Caminho Corrigido
// --- Fim Imports Shadcn UI ---
import {
  Loader2,
  Package,
  Barcode,
  Upload,
  Image as ImageIcon,
  X,
} from "lucide-react";

export default function ProductForm({ open, onOpenChange, onSuccess, productId, tenantId }) {
  const INITIAL_FORM_DATA = {
    name: "",
    category: "",
    price: "",
    cost_price: "",
    sku: "",
    barcode: "",
    stock_quantity: "0",
    description: "",
    image_url: "",
    low_stock_threshold: "5",
    module: "petshop",
    ncm: "",
    allowInternalUse: false,
    administrationPrice: "",
    tenant_id: tenantId
  };

  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [isLoadingBarcode, setIsLoadingBarcode] = useState(false);
  const [imagePreview, setImagePreview] = useState(null);
  const [formData, setFormData] = useState(INITIAL_FORM_DATA);
  const fileInputRef = useRef(null);

  useEffect(() => {
    const fetchProductData = async () => {
      if (productId && tenantId && open) {
        console.log(`[ProductForm] Editing product ${productId} for tenant ${tenantId}. Fetching data...`);
        setIsLoadingData(true);
        setImagePreview(null);
        try {
          const product = await Product.getById(tenantId, productId);
          if (product) {
            console.log("[ProductForm] Product data fetched:", product);
            setFormData({
              name: product.name || "",
              category: product.category || "",
              price: String(product.price ?? ""),
              cost_price: String(product.cost_price ?? ""),
              sku: product.sku || "",
              barcode: product.barcode || "",
              stock_quantity: String(product.stock_quantity ?? "0"),
              description: product.description || "",
              image_url: product.image_url || "",
              low_stock_threshold: String(product.low_stock_threshold ?? "5"),
              module: "petshop",
              ncm: product.ncm || "",
              allowInternalUse: !!product.allowInternalUse,
              administrationPrice: String(product.administrationPrice ?? ""),
              tenant_id: product.tenant_id
            });
            if (product.image_url) {
              setImagePreview(product.image_url);
            }
          } else {
            toast({ title: "Erro", description: "Produto não encontrado para edição.", variant: "destructive" });
            closeModal(false);
          }
        } catch (error) {
          console.error("Erro ao buscar dados do produto para edição:", error);
          toast({ title: "Erro ao Carregar", description: error.message || "Não foi possível carregar os dados do produto.", variant: "destructive" });
          closeModal(false);
        } finally {
          setIsLoadingData(false);
        }
      } else if (!productId && open) {
        console.log("[ProductForm] Opening for new product for tenant:", tenantId);
        setFormData({...INITIAL_FORM_DATA, tenant_id: tenantId, module: "petshop" });
        setImagePreview(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    };

    fetchProductData();

  }, [productId, tenantId, open]);

  const closeModal = (success = false) => {
    onOpenChange(false); 
    if (success && onSuccess) {
        onSuccess(); 
    }
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleCheckboxChange = (field, checked) => {
     setFormData(prev => ({
       ...prev,
       [field]: checked
     }));
  };

  const handleBarcodeSearch = async (barcode) => {
    if (!barcode || barcode.length < 8) {
       console.log("[ProductForm] Barcode too short or empty, skipping search.");
       return;
    }
    console.log(`[ProductForm] Calling Cloud Function lookupBarcode for: ${barcode}`);
    setIsLoadingBarcode(true);

    try {
      const functionUrl = `https://lookupbarcode-bddl47psgq-rj.a.run.app/lookupBarcode?upc=${encodeURIComponent(barcode)}`;
      const response = await fetch(functionUrl);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error("[ProductForm] Cloud Function call failed:", response.status, response.statusText, errorData);
        throw new Error(`Cloud Function error! Status: ${response.status} ${response.statusText}. ${errorData?.message || ''}`);
      }
      
      const data = await response.json();
      console.log("[ProductForm] Cloud Function Response:", data);

      if (data.code === "OK" && data.item) {
        const item = data.item;
        console.log("[ProductForm] Cosmos data received:", item);

        const updates = {
          name: item.title || formData.name,
          description: item.description || formData.description,
          category: formData.category,
          image_url: item.image_url || formData.image_url,
          barcode: item.barcode || formData.barcode,
          ncm: item.ncm || formData.ncm || "",
        };

        console.log("[ProductForm] Applying updates from Cosmos:", updates);

        setFormData(prev => ({
          ...prev,
          ...updates
        }));

        if (updates.image_url && updates.image_url !== formData.image_url) {
          setImagePreview(updates.image_url);
        }
        
        toast({ title: "Produto Encontrado (Cosmos)", description: "Dados básicos e NCM preenchidos." });

      } else if (data.code === "NOT_FOUND") {
        console.log("[ProductForm] Product not found via Cloud Function (API reported NOT_FOUND).");
        toast({ title: "Não Encontrado", description: data.message || "Código de barras não localizado.", variant: "default" });
      } else {
        console.error("[ProductForm] Unexpected response structure from Cloud Function:", data);
        throw new Error(data.error || data.message || "Unknown error structure from Cloud Function");
      }
    } catch (error) {
      console.error("[ProductForm] Erro ao chamar Cloud Function ou processar resposta:", error);
      toast({
         title: "Erro na Busca", 
         description: error.message || "Não foi possível buscar informações do produto.", 
        variant: "destructive"
      });
    } finally {
      setIsLoadingBarcode(false);
    }
  };

  const handleImageUpload = async (/*event*/) => {
    // Implementation of handleImageUpload
  };

  const clearImagePreview = () => {
    // Implementation of clearImagePreview
  };

  const handleSubmit = async (e) => {
    e.preventDefault(); // Previne recarregamento da página
    setIsLoading(true);
    console.log(`[ProductForm] Submitting form data for tenant ${tenantId}:`, formData);

    // Validação simplificada sem módulo:
    if (!formData.name || !formData.price || !formData.category) {
      toast({ title: "Erro de Validação", description: "Nome, Categoria e Preço são obrigatórios.", variant: "destructive" });
      setIsLoading(false);
      return;
    }
    // NCM sempre obrigatório agora
    if (!formData.ncm || formData.ncm.length !== 8) {
       toast({ title: "Erro de Validação", description: "NCM é obrigatório (8 dígitos) para produtos.", variant: "destructive" });
       setIsLoading(false);
       return;
    }
    // Quantidade sempre obrigatória agora
    if (formData.stock_quantity === null || formData.stock_quantity === undefined || formData.stock_quantity === '') {
       toast({ title: "Erro de Validação", description: "Quantidade em Estoque é obrigatória.", variant: "destructive" });
       setIsLoading(false);
       return;
    }
    // --- Fim Validação --- 

    try {
      // --- Preparação dos Dados --- 
      const dataToSave = {
        ...formData,
        price: parseFloat(String(formData.price).replace(',', '.')) || 0,
        cost_price: formData.cost_price ? parseFloat(String(formData.cost_price).replace(',', '.')) : null,
        stock_quantity: parseInt(formData.stock_quantity, 10) || 0,
        low_stock_threshold: formData.low_stock_threshold ? parseInt(formData.low_stock_threshold, 10) : 5,
        administrationPrice: formData.allowInternalUse && formData.administrationPrice ? parseFloat(String(formData.administrationPrice).replace(',', '.')) : null,
        ncm: formData.ncm,
        module: "petshop",
        tenant_id: tenantId
      };

      // Remove campos que não devem ser salvos diretamente se vierem da API externa (ex: title)
      delete dataToSave.title; // Se a API retornar 'title', removemos antes de salvar

      console.log('[ProductForm] Data prepared for saving:', dataToSave);
      // --- Fim Preparação --- 

      if (productId) {
        // --- Atualização --- 
        console.log(`[ProductForm] Updating product ${productId}...`);

        // Cria uma cópia de dataToSave para não modificar o original
        const dataForUpdate = { ...dataToSave };
        // Remove tenant_id do objeto de dados a ser enviado para update
        // A função update já recebe tenantId como argumento separado
        delete dataForUpdate.tenant_id;

        console.log('[ProductForm] Data prepared for updating (tenant_id removed from object):', dataForUpdate);

        await Product.update(tenantId, productId, dataForUpdate); // Passa o objeto sem tenant_id

        toast({ title: "Sucesso!", description: "Produto/Serviço atualizado." });
      } else {
        // --- Criação --- 
        console.log('[ProductForm] Creating new product...');
        await Product.create(dataToSave);
        toast({ title: "Sucesso!", description: "Novo Produto/Serviço cadastrado." });
      }

      // --- Sucesso --- 
      closeModal(true); // <<< Chama closeModal com true para acionar onSuccess >>>

    } catch (error) {
      console.error("[ProductForm] Erro ao salvar produto:", error);
      toast({ title: "Erro ao Salvar", description: error.message || "Não foi possível salvar os dados.", variant: "destructive" });
    } finally {
      setIsLoading(false); // Garante que o loading termina mesmo com erro
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className="max-w-[98vw] w-full" 
        aria-labelledby="product-form-modal-title"
        aria-describedby="product-form-modal-description"
      >
        <DialogHeader>
           <DialogTitle id="product-form-modal-title">{productId ? "Editar Produto" : "Novo Produto"}</DialogTitle>
           <DialogDescription id="product-form-modal-description">
             Preencha os detalhes do produto. Campos marcados com * são obrigatórios.
           </DialogDescription>
        </DialogHeader>

        {isLoadingData ? (
           <div className="flex justify-center items-center h-64">
             <Loader2 className="h-8 w-8 animate-spin text-blue-500" /> Carregando dados...
        </div>
        ) : (
          <div className="max-h-[80vh] overflow-y-auto p-1">
             <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2 relative">
                  <Label htmlFor="form-barcode">Código de Barras (Busca Automática)</Label>
              <div className="relative">
                      <Barcode className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500 pointer-events-none z-10" />
                <Input
                        id="form-barcode"
                  value={formData.barcode}
                        onChange={(e) => handleChange("barcode", e.target.value)}
                        onBlur={(e) => {
                           const currentValue = e.target.value;
                           if (currentValue && currentValue.length >= 8) {
                             handleBarcodeSearch(currentValue);
                           }
                        }}
                        placeholder="Digite ou use um leitor..."
                        className="pl-10 pr-10"
                      />
                      {isLoadingBarcode && (
                        <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-blue-500" />
                      )}
              </div>
                   <p className="text-xs text-muted-foreground">Sair deste campo tentará buscar dados (Nome, NCM) automaticamente via API Cosmos.</p>
            </div>

                <div className="flex flex-col md:flex-row gap-6">
                  <div className="w-full md:w-2/3 space-y-6">
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                         <Label htmlFor="form-name">Nome do Produto *</Label>
                         <Input id="form-name" value={formData.name} onChange={(e) => handleChange("name", e.target.value)} required />
              </div>
              <div className="space-y-2">
                          <Label htmlFor="form-category">Categoria *</Label>
                          <Select value={formData.category} onValueChange={(value) => handleChange("category", value)} required>
                            <SelectTrigger id="form-category"><SelectValue placeholder="Selecione uma categoria..." /></SelectTrigger>
                        <SelectContent>
                              <SelectItem value="food">Alimentação</SelectItem>
                              <SelectItem value="medicine">Medicamentos</SelectItem>
                              <SelectItem value="accessories">Acessórios</SelectItem>
                              <SelectItem value="hygiene">Higiene</SelectItem>
                              <SelectItem value="toys">Brinquedos</SelectItem>
                              <SelectItem value="grooming">Banho e Tosa</SelectItem>
                              <SelectItem value="other">Outros</SelectItem>
                        </SelectContent>
                      </Select>
                       </div>
                       <div className="space-y-2">
                          <Label htmlFor="form-price">Preço de Venda *</Label>
                          <div className="relative">
                            <span className="absolute left-3 top-2.5 text-gray-500 text-sm">R$</span>
                            <Input id="form-price" value={formData.price} onChange={(e) => handleChange("price", e.target.value)} placeholder="0,00" className="pl-10" type="number" step="0.01" min="0" required/>
                          </div>
                        </div>
                         <div className="space-y-2">
                           <Label htmlFor="form-cost_price">Preço de Custo</Label>
                           <div className="relative">
                             <span className="absolute left-3 top-2.5 text-gray-500 text-sm">R$</span>
                             <Input id="form-cost_price" value={formData.cost_price} onChange={(e) => handleChange("cost_price", e.target.value)} placeholder="0,00" className="pl-10" type="number" step="0.01" min="0"/>
                           </div>
                         </div>
                         <div className="space-y-2">
                            <Label htmlFor="form-sku">Código Interno (SKU)</Label> 
                            <Input id="form-sku" value={formData.sku} onChange={(e) => handleChange("sku", e.target.value)} placeholder="Opcional" />
              </div>
              <div className="space-y-2">
                            <Label htmlFor="form-ncm">NCM *</Label>
                <Input
                               id="form-ncm"
                               value={formData.ncm}
                               onChange={(e) => handleChange("ncm", e.target.value.replace(/\D/g, ''))}
                               placeholder="Código NCM (8 dígitos)"
                               maxLength={8}
                  required
                />
                            <p className="text-xs text-muted-foreground">Obrigatório para emissão de NF-e.</p>
                         </div>
                         <div className="space-y-2">
                            <Label htmlFor="form-stock_quantity">Qtd. em Estoque *</Label> 
                            <Input id="form-stock_quantity" value={formData.stock_quantity} onChange={(e) => handleChange("stock_quantity", e.target.value)} type="number" min="0" step="1" required />
              </div>
              <div className="space-y-2">
                           <Label htmlFor="form-low_stock_threshold">Alerta Estoque Baixo</Label>
                           <Input id="form-low_stock_threshold" value={formData.low_stock_threshold} onChange={(e) => handleChange("low_stock_threshold", e.target.value)} type="number" min="1" step="1" placeholder="5" />
              </div>

                         <div className="md:col-span-2 border-t pt-4 mt-4 space-y-4">
                            <div className="flex items-center space-x-2">
                             <Checkbox id="form-allowInternalUse" checked={formData.allowInternalUse} onCheckedChange={(checked) => handleCheckboxChange('allowInternalUse', checked)} />
                             <Label htmlFor="form-allowInternalUse" className="cursor-pointer text-sm font-medium">Permitir Uso Interno / Administração na Clínica?</Label>
                           </div>
                           {formData.allowInternalUse && (
                             <div className="space-y-2 pl-6">
                               <Label htmlFor="form-administrationPrice">Valor Cobrado na Administração Interna</Label>
                               <div className="relative">
                                  <span className="absolute left-3 top-2.5 text-gray-500 text-sm">R$</span>
                                  <Input id="form-administrationPrice" value={formData.administrationPrice} onChange={(e) => handleChange("administrationPrice", e.target.value)} placeholder="Opcional (usa Preço Venda se vazio)" className="pl-10" type="number" step="0.01" min="0" />
                               </div>
                               <p className="text-xs text-muted-foreground">Defina o valor a ser cobrado quando este item é usado em um procedimento/consulta. Se vazio, usará o Preço de Venda.</p>
                             </div>
                           )}
                         </div>
                          <div className="space-y-2 md:col-span-2">
                            <Label htmlFor="form-description">Descrição</Label>
                            <Textarea id="form-description" value={formData.description} onChange={(e) => handleChange("description", e.target.value)} placeholder="Descrição detalhada do produto ou serviço" rows={3} />
                          </div>
                     </div>
              </div>

                  <div className="w-full md:w-1/3 space-y-4">
              <div className="space-y-2">
                       <Label>Imagem do Produto</Label>
                       <div className="border rounded-md p-4 bg-gray-50 flex flex-col items-center">
                         {imagePreview ? (
                           <div className="relative w-full">
                             <img src={imagePreview} alt="Preview" className="mx-auto mb-3 max-h-48 object-contain rounded"/>
                             <Button type="button" variant="ghost" size="icon" className="absolute top-0 right-0 text-gray-500 hover:text-red-500 h-6 w-6" onClick={clearImagePreview}> <X className="h-4 w-4" /> </Button>
                           </div>
                         ) : (
                           <div className="bg-gray-100 border border-dashed border-gray-300 rounded-md h-48 w-full flex items-center justify-center text-gray-400 mb-3">
                             <ImageIcon className="h-12 w-12" />
                           </div>
                         )}
                         <div className="space-y-2 w-full"> 
                           <Button type="button" variant="outline" className="w-full" onClick={() => fileInputRef.current?.click()}> 
                             <Upload className="h-4 w-4 mr-2" /> Upload de Imagem
                           </Button>
                           <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                           <div className="text-center text-xs text-gray-500">ou</div>
                <Input
                              placeholder="URL da imagem" 
                              value={formData.image_url} 
                              onChange={(e) => { 
                                 handleChange("image_url", e.target.value); 
                                 if (e.target.value) { 
                                    setImagePreview(e.target.value); 
                                 } else { 
                                    setImagePreview(null); 
                                 }
                              }}
                />
              </div>
            </div>
                     </div>
                  </div>
            </div>

               <DialogFooter className="pt-4 border-t sticky bottom-0 bg-background py-4">
                  <Button type="button" variant="outline" onClick={() => closeModal(false)}>
                Cancelar
              </Button>
                 <Button type="submit" disabled={isLoading || isLoadingData}>
                   {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Package className="mr-2 h-4 w-4" />}
                   {productId ? "Atualizar Item" : "Cadastrar Item"}
              </Button>
            </DialogFooter>
          </form>
          </div>
         )}
      </DialogContent>
    </Dialog>
  );
}

ProductForm.propTypes = {
  open: PropTypes.bool,
  onOpenChange: PropTypes.func,
  onSuccess: PropTypes.func.isRequired,
  productId: PropTypes.string,
  tenantId: PropTypes.string.isRequired,
};