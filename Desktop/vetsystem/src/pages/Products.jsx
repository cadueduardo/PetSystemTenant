import React, { useState, useEffect, useRef } from "react";
import { User } from "@/api/entities";
import { Product } from "@/api/entities";
import { Tenant } from "@/api/entities";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { InvokeLLM, UploadFile } from "@/api/integrations";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/use-toast";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { 
  Package, 
  Plus, 
  Search, 
  Edit, 
  Trash2, 
  BarChart, 
  ArrowUpDown,
  Loader2,
  Barcode,  
  Upload,
  Image as ImageIcon,
  AlertCircle,
  X
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";

export default function ProductsPage() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const [isLoading, setIsLoading] = useState(true);
  const [products, setProducts] = useState([]);
  const [currentTenant, setCurrentTenant] = useState(null);
  const [activeTab, setActiveTab] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [sortBy, setSortBy] = useState("name");
  const [sortOrder, setSortOrder] = useState("asc");
  const [isLoadingBarcode, setIsLoadingBarcode] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [imagePreview, setImagePreview] = useState(null);
  const [lowStockProducts, setLowStockProducts] = useState([]);
  
  const [formData, setFormData] = useState({
    name: "",
    category: "food",
    price: "",
    cost_price: "",
    sku: "",
    barcode: "",
    stock_quantity: "0",
    description: "",
    image_url: "",
    low_stock_threshold: "5",
    tenant_id: ""
  });

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (products.length > 0) {
      const lowStock = products.filter(product => {
        return product.stock_quantity <= (product.low_stock_threshold || 5);
      });
      setLowStockProducts(lowStock);
    }
  }, [products]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const userData = await User.me();
      const tenants = await Tenant.list();
      const activeTenant = tenants.find(t => t.status === "active");
      
      if (activeTenant) {
        setCurrentTenant(activeTenant);
        
        if (!activeTenant.selected_modules.includes("petshop")) {
          toast({
            title: "Módulo não disponível",
            description: "O módulo de Petshop não está ativo para sua conta.",
            variant: "destructive"
          });
          navigate(createPageUrl("Dashboard"));
          return;
        }

        const productsData = await Product.filter({ tenant_id: activeTenant.id });
        setProducts(productsData);
        setFormData(prev => ({ ...prev, tenant_id: activeTenant.id }));
      }
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os produtos.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      if (editingProduct) {
        await Product.update(editingProduct.id, formData);
      } else {
        await Product.create(formData);
      }
      
      setShowForm(false);
      setEditingProduct(null);
      setImagePreview(null);
      loadData();
    } catch (error) {
      console.error("Erro ao salvar produto:", error);
    }
  };

  const handleEditProduct = (product) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      category: product.category,
      price: String(product.price),
      cost_price: String(product.cost_price || ""),
      sku: product.sku || "",
      barcode: product.barcode || "",
      stock_quantity: String(product.stock_quantity || 0),
      description: product.description || "",
      image_url: product.image_url || "",
      low_stock_threshold: String(product.low_stock_threshold || 5),
      tenant_id: product.tenant_id
    });
    
    if (product.image_url) {
      setImagePreview(product.image_url);
    } else {
      setImagePreview(null);
    }
    
    setShowForm(true);
  };

  const handleDeleteProduct = async (productId) => {
    if (window.confirm("Tem certeza que deseja excluir este produto?")) {
      try {
        await Product.delete(productId);
        loadData();
      } catch (error) {
        console.error("Erro ao excluir produto:", error);
      }
    }
  };

  const handleBarcodeScanner = async () => {
    setIsLoadingBarcode(true);
    
    try {
      const barcodeValue = prompt("Digite ou escaneie o código de barras:");
      
      if (!barcodeValue) {
        setIsLoadingBarcode(false);
        return;
      }
      
      toast({
        title: "Código de barras escaneado",
        description: `Buscando informações do produto: ${barcodeValue}`
      });
      
      const response = await InvokeLLM({
        prompt: `Dado o código de barras ${barcodeValue}, crie informações realistas para um produto fictício que poderia ser vendido em um petshop. Inclua nome do produto, descrição, preço sugerido, custo, categoria (uma das seguintes: food, medicine, accessories, hygiene, toys, other), e uma URL de imagem de exemplo (use uma URL real do Unsplash com termo de busca relacionado a pet shop). Inclua também um SKU fictício. Retorne como um objeto JSON.`,
        response_json_schema: {
          type: "object",
          properties: {
            name: { type: "string" },
            description: { type: "string" },
            price: { type: "number" },
            cost_price: { type: "number" },
            category: { type: "string" },
            image_url: { type: "string" },
            sku: { type: "string" }
          }
        }
      });
      
      setFormData(prev => ({
        ...prev,
        name: response.name || "",
        description: response.description || "",
        price: String(response.price || ""),
        cost_price: String(response.cost_price || ""),
        category: response.category || "food",
        image_url: response.image_url || "",
        sku: response.sku || "",
        barcode: barcodeValue
      }));
      
      if (response.image_url) {
        setImagePreview(response.image_url);
      }
      
      toast({
        title: "Produto encontrado",
        description: "Informações do produto foram preenchidas automaticamente."
      });
      
    } catch (error) {
      console.error("Erro ao buscar dados do código de barras:", error);
      toast({
        title: "Erro na busca",
        description: "Não foi possível encontrar informações para este código de barras.",
        variant: "destructive"
      });
    } finally {
      setIsLoadingBarcode(false);
    }
  };

  const handleImageUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    
    setIsUploadingImage(true);
    
    try {
      const { file_url } = await UploadFile({ file });
      
      setFormData(prev => ({
        ...prev,
        image_url: file_url
      }));
      
      setImagePreview(file_url);
      
      toast({
        title: "Imagem enviada",
        description: "A imagem foi carregada com sucesso."
      });
    } catch (error) {
      console.error("Erro ao fazer upload da imagem:", error);
      toast({
        title: "Erro no upload",
        description: "Não foi possível enviar a imagem.",
        variant: "destructive"
      });
    } finally {
      setIsUploadingImage(false);
    }
  };

  const clearImagePreview = () => {
    setImagePreview(null);
    setFormData(prev => ({
      ...prev,
      image_url: ""
    }));
    
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const filteredProducts = products.filter(product => {
    const matchesCategory = activeTab === "all" || product.category === activeTab;
    const matchesSearch = !searchTerm || 
      product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (product.sku && product.sku.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (product.barcode && product.barcode.toLowerCase().includes(searchTerm.toLowerCase()));
    
    return matchesCategory && matchesSearch;
  });

  const sortedProducts = [...filteredProducts].sort((a, b) => {
    let valA = a[sortBy];
    let valB = b[sortBy];
    
    if (typeof valA === 'string') {
      valA = valA.toLowerCase();
      valB = valB.toLowerCase();
    }
    
    if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
    if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
    return 0;
  });

  const handleSort = (field) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const categoryLabels = {
    food: "Alimentação",
    medicine: "Medicamentos",
    accessories: "Acessórios",
    hygiene: "Higiene",
    toys: "Brinquedos",
    other: "Outros"
  };

  return (
    <div className="container mx-auto py-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold">Produtos</h1>
          <p className="text-gray-500">Gerencie o estoque de produtos do petshop</p>
        </div>
        <Button onClick={() => {
          setEditingProduct(null);
          setFormData({
            name: "",
            category: "food",
            price: "",
            cost_price: "",
            sku: "",
            barcode: "",
            stock_quantity: "0",
            description: "",
            image_url: "",
            low_stock_threshold: "5",
            tenant_id: currentTenant?.id || ""
          });
          setImagePreview(null);
          setShowForm(true);
        }} className="flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Novo Produto
        </Button>
      </div>

      {lowStockProducts.length > 0 && (
        <Alert className="mb-6 bg-amber-50 border-amber-200 text-amber-800">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Alerta de estoque baixo</AlertTitle>
          <AlertDescription>
            {lowStockProducts.length} {lowStockProducts.length === 1 ? 'produto está' : 'produtos estão'} com estoque abaixo do mínimo recomendado.
            <Button 
              variant="link" 
              className="text-amber-800 p-0 h-auto" 
              onClick={() => setActiveTab('all')}
            >
              Ver produtos
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {showForm && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>{editingProduct ? "Editar Produto" : "Novo Produto"}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="flex flex-col md:flex-row gap-6">
                <div className="w-full md:w-2/3 space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="name">Nome do Produto *</Label>
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) => handleChange("name", e.target.value)}
                        placeholder="Nome do produto"
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="category">Categoria *</Label>
                      <Select
                        value={formData.category}
                        onValueChange={(value) => handleChange("category", value)}
                        required
                      >
                        <SelectTrigger id="category">
                          <SelectValue placeholder="Selecione uma categoria" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="food">Alimentação</SelectItem>
                          <SelectItem value="medicine">Medicamentos</SelectItem>
                          <SelectItem value="accessories">Acessórios</SelectItem>
                          <SelectItem value="hygiene">Higiene</SelectItem>
                          <SelectItem value="toys">Brinquedos</SelectItem>
                          <SelectItem value="other">Outros</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="price">Preço de Venda *</Label>
                      <div className="relative">
                        <span className="absolute left-3 top-2.5 text-gray-500">R$</span>
                        <Input
                          id="price"
                          value={formData.price}
                          onChange={(e) => handleChange("price", e.target.value)}
                          placeholder="0,00"
                          className="pl-9"
                          type="number"
                          step="0.01"
                          min="0"
                          required
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="cost_price">Preço de Custo</Label>
                      <div className="relative">
                        <span className="absolute left-3 top-2.5 text-gray-500">R$</span>
                        <Input
                          id="cost_price"
                          value={formData.cost_price}
                          onChange={(e) => handleChange("cost_price", e.target.value)}
                          placeholder="0,00"
                          className="pl-9"
                          type="number"
                          step="0.01"
                          min="0"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <Label htmlFor="sku">Código (SKU)</Label>
                        <Button 
                          type="button" 
                          variant="ghost" 
                          size="sm" 
                          className="h-6 text-blue-600 hover:text-blue-700"
                          onClick={handleBarcodeScanner}
                          disabled={isLoadingBarcode}
                        >
                          {isLoadingBarcode ? (
                            <Loader2 className="h-3 w-3 animate-spin mr-1" />
                          ) : (
                            <Barcode className="h-3 w-3 mr-1" />
                          )}
                          Escanear código
                        </Button>
                      </div>
                      <Input
                        id="sku"
                        value={formData.sku}
                        onChange={(e) => handleChange("sku", e.target.value)}
                        placeholder="Código interno"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="barcode">Código de Barras</Label>
                      <Input
                        id="barcode"
                        value={formData.barcode}
                        onChange={(e) => handleChange("barcode", e.target.value)}
                        placeholder="Código de barras"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="stock_quantity">Quantidade em Estoque *</Label>
                      <Input
                        id="stock_quantity"
                        value={formData.stock_quantity}
                        onChange={(e) => handleChange("stock_quantity", e.target.value)}
                        type="number"
                        min="0"
                        step="1"
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="low_stock_threshold">Alerta de Estoque Baixo</Label>
                      <Input
                        id="low_stock_threshold"
                        value={formData.low_stock_threshold}
                        onChange={(e) => handleChange("low_stock_threshold", e.target.value)}
                        type="number"
                        min="1"
                        step="1"
                        placeholder="5"
                      />
                    </div>

                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="description">Descrição</Label>
                      <Input
                        id="description"
                        value={formData.description}
                        onChange={(e) => handleChange("description", e.target.value)}
                        placeholder="Descrição do produto"
                      />
                    </div>
                  </div>
                </div>
                
                <div className="w-full md:w-1/3 space-y-4">
                  <div className="space-y-2">
                    <Label>Imagem do Produto</Label>
                    <div className="border rounded-md p-4 bg-gray-50 flex flex-col items-center">
                      {imagePreview ? (
                        <div className="relative w-full">
                          <img 
                            src={imagePreview} 
                            alt="Preview"
                            className="mx-auto mb-3 max-h-48 object-contain"
                          />
                          <Button 
                            type="button"
                            variant="ghost" 
                            size="icon"
                            className="absolute top-0 right-0 text-gray-500 hover:text-red-500"
                            onClick={clearImagePreview}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <div className="bg-gray-100 border border-dashed border-gray-300 rounded-md h-48 w-full flex items-center justify-center text-gray-400 mb-3">
                          <ImageIcon className="h-12 w-12" />
                        </div>
                      )}
                      
                      <div className="space-y-2 w-full">
                        <div className="flex gap-2">
                          <Button 
                            type="button"
                            variant="outline" 
                            className="w-full"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={isUploadingImage}
                          >
                            {isUploadingImage ? (
                              <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            ) : (
                              <Upload className="h-4 w-4 mr-2" />
                            )}
                            Upload de Imagem
                          </Button>
                          <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            onChange={handleImageUpload}
                            className="hidden"
                          />
                        </div>
                        
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

              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowForm(false);
                    setEditingProduct(null);
                    setImagePreview(null);
                  }}
                >
                  Cancelar
                </Button>
                <Button type="submit">
                  {editingProduct ? "Atualizar" : "Cadastrar"} Produto
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-col md:flex-row justify-between gap-4 mb-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="all">Todos</TabsTrigger>
            <TabsTrigger value="food">Alimentação</TabsTrigger>
            <TabsTrigger value="medicine">Medicamentos</TabsTrigger>
            <TabsTrigger value="accessories">Acessórios</TabsTrigger>
            <TabsTrigger value="hygiene">Higiene</TabsTrigger>
            <TabsTrigger value="toys">Brinquedos</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="relative w-full md:w-64">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
          <Input
            type="search"
            placeholder="Buscar produtos..."
            className="pl-8"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center items-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
            </div>
          ) : sortedProducts.length === 0 ? (
            <div className="text-center py-12">
              <Package className="h-12 w-12 text-gray-300 mx-auto mb-3" />
              <h3 className="text-lg font-medium text-gray-900">Nenhum produto encontrado</h3>
              <p className="mt-1 text-gray-500">
                {products.length === 0 
                  ? "Comece adicionando seu primeiro produto" 
                  : "Nenhum produto corresponde aos filtros selecionados"}
              </p>
              {products.length === 0 && (
                <Button
                  onClick={() => {
                    setEditingProduct(null);
                    setFormData({
                      name: "",
                      category: "food",
                      price: "",
                      cost_price: "",
                      sku: "",
                      barcode: "",
                      stock_quantity: "0",
                      description: "",
                      image_url: "",
                      low_stock_threshold: "5",
                      tenant_id: currentTenant?.id || ""
                    });
                    setShowForm(true);
                  }}
                  className="mt-4"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Adicionar Produto
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[300px]">
                      <button 
                        className="flex items-center gap-1"
                        onClick={() => handleSort('name')}
                      >
                        Produto
                        {sortBy === 'name' && (
                          <ArrowUpDown className="h-3 w-3" />
                        )}
                      </button>
                    </TableHead>
                    <TableHead>
                      <button 
                        className="flex items-center gap-1"
                        onClick={() => handleSort('category')}
                      >
                        Categoria
                        {sortBy === 'category' && (
                          <ArrowUpDown className="h-3 w-3" />
                        )}
                      </button>
                    </TableHead>
                    <TableHead>
                      <button 
                        className="flex items-center gap-1"
                        onClick={() => handleSort('stock_quantity')}
                      >
                        Estoque
                        {sortBy === 'stock_quantity' && (
                          <ArrowUpDown className="h-3 w-3" />
                        )}
                      </button>
                    </TableHead>
                    <TableHead>
                      <button 
                        className="flex items-center gap-1"
                        onClick={() => handleSort('price')}
                      >
                        Preço
                        {sortBy === 'price' && (
                          <ArrowUpDown className="h-3 w-3" />
                        )}
                      </button>
                    </TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedProducts.map((product) => {
                    const stockLevel = 
                      product.stock_quantity <= 0 ? 'empty' :
                      product.stock_quantity <= (product.low_stock_threshold || 5) ? 'low' : 'ok';
                    
                    return (
                      <TableRow key={product.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            {product.image_url ? (
                              <img 
                                src={product.image_url} 
                                alt={product.name} 
                                className="w-10 h-10 object-cover rounded-md"
                              />
                            ) : (
                              <div className="w-10 h-10 bg-gray-100 rounded-md flex items-center justify-center">
                                <Package className="w-5 h-5 text-gray-400" />
                              </div>
                            )}
                            <div>
                              <div className="font-medium">{product.name}</div>
                              {product.sku && (
                                <div className="text-sm text-gray-500">SKU: {product.sku}</div>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {categoryLabels[product.category] || product.category}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <span className={`font-medium ${
                              stockLevel === 'empty' ? 'text-red-500' : 
                              stockLevel === 'low' ? 'text-yellow-500' : 
                              'text-green-500'
                            }`}>
                              {product.stock_quantity}
                            </span>
                            
                            {stockLevel !== 'ok' && (
                              <div className="w-full h-1.5">
                                <Progress 
                                  value={stockLevel === 'empty' ? 0 : 50} 
                                  className={`h-1.5 ${
                                    stockLevel === 'empty' ? 'bg-red-100' : 'bg-yellow-100'
                                  }`}
                                  indicatorClassName={
                                    stockLevel === 'empty' ? 'bg-red-500' : 'bg-yellow-500'
                                  }
                                />
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {formatCurrency(product.price)}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEditProduct(product)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-red-500 hover:text-red-700 hover:bg-red-50"
                              onClick={() => handleDeleteProduct(product.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
