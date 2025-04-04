import React, { useState } from "react";
import { Product } from "@/api/entities";
import { getMockData } from "@/api/mockData";
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
import { Loader2, Package, Barcode, Upload } from "lucide-react";
import { useForm } from "react-hook-form";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

export default function ProductForm({ open, onOpenChange, onSuccess, productId }) {
  const [isLoading, setIsLoading] = useState(false);
  const [isSearchingBarcode, setIsSearchingBarcode] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    category: "",
    price: "",
    cost_price: "",
    sku: "",
    barcode: "",
    stock_quantity: 0,
    description: "",
    image_url: "",
    tenant_id: localStorage.getItem('current_tenant') || "",
    module: "petshop"
  });

  const form = useForm({
    defaultValues: {
      name: "",
      description: "",
      image_url: "",
      category: "",
      price: 0,
      cost_price: 0,
      sku: "",
      stock_quantity: 0,
      tenant_id: localStorage.getItem('current_tenant') || "",
      module: "petshop"
    }
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const searchProductByBarcode = async (barcode) => {
    setIsSearchingBarcode(true);
    try {
      // Buscar produto no mock data
      const data = getMockData();
      const product = (data.products || []).find(p => p.barcode === barcode);
      
      if (product) {
        setFormData(prev => ({
          ...prev,
          name: product.name || prev.name,
          description: product.description || prev.description,
          image_url: product.image_url || prev.image_url,
          category: product.category || prev.category,
          price: String(product.price || prev.price),
          cost_price: String(product.cost_price || prev.cost_price),
          sku: product.sku || prev.sku,
          stock_quantity: String(product.stock_quantity || prev.stock_quantity)
        }));
      } else {
        toast({
          title: "Produto não encontrado",
          description: "Não foi possível encontrar o produto com este código de barras.",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error("Erro ao buscar produto:", error);
      toast({
        title: "Erro",
        description: "Não foi possível buscar o produto.",
        variant: "destructive"
      });
    } finally {
      setIsSearchingBarcode(false);
    }
  };

  const handleBarcodeBlur = (e) => {
    const barcode = e.target.value;
    if (barcode.length >= 8) {
      searchProductByBarcode(barcode);
    }
  };

  const onSubmit = async (data) => {
    setIsLoading(true);
    try {
      const productData = {
        ...data,
        tenant_id: localStorage.getItem('current_tenant')
      };

      if (productId) {
        await Product.update(productId, productData);
        toast({
          title: "Sucesso",
          description: "Produto atualizado com sucesso!"
        });
      } else {
        await Product.create(productData);
        toast({
          title: "Sucesso",
          description: "Produto cadastrado com sucesso!"
        });
      }

      onSuccess();
    } catch (error) {
      console.error("Erro ao salvar produto:", error);
      toast({
        title: "Erro",
        description: "Não foi possível salvar o produto.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]" aria-describedby="product-form-description">
        <DialogHeader>
          <DialogTitle>Novo Produto</DialogTitle>
        </DialogHeader>
        <div id="product-form-description" className="sr-only">
          Formulário para cadastro de novo produto
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="barcode">Código de Barras</Label>
              <div className="relative">
                <Barcode className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                <Input
                  id="barcode"
                  name="barcode"
                  className="pl-10"
                  value={formData.barcode}
                  onChange={handleChange}
                  onBlur={handleBarcodeBlur}
                  placeholder="Digite ou escaneie o código de barras"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome do Produto*</Label>
                <Input
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="space-y-2">
                <FormField
                  control={form.control}
                  name="module"
                  rules={{ required: "Selecione o módulo" }}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Módulo</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione o módulo" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="clinica">Clínica</SelectItem>
                          <SelectItem value="petshop">Petshop</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="space-y-2">
                <FormField
                  control={form.control}
                  name="category"
                  rules={{ required: "Selecione uma categoria" }}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Categoria</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione uma categoria" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {form.watch("module") === "clinica" ? (
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
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="price">Preço de Venda*</Label>
                <Input
                  id="price"
                  name="price"
                  type="number"
                  step="0.01"
                  value={formData.price}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="cost_price">Preço de Custo</Label>
                <Input
                  id="cost_price"
                  name="cost_price"
                  type="number"
                  step="0.01"
                  value={formData.cost_price}
                  onChange={handleChange}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="sku">SKU</Label>
                <Input
                  id="sku"
                  name="sku"
                  value={formData.sku}
                  onChange={handleChange}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="stock_quantity">Quantidade em Estoque*</Label>
                <Input
                  id="stock_quantity"
                  name="stock_quantity"
                  type="number"
                  value={formData.stock_quantity}
                  onChange={handleChange}
                  required
                />
              </div>
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

            {formData.image_url && (
              <div className="mt-4">
                <img
                  src={formData.image_url}
                  alt="Imagem do produto"
                  className="w-32 h-32 object-cover rounded-lg"
                />
              </div>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <Package className="mr-2 h-4 w-4" />
                    Salvar Produto
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}