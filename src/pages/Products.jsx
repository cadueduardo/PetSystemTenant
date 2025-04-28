// src/pages/Products.jsx
import { useState, useEffect } from "react"; // useRef removido
import { Product } from "@/api/entities";
// import { useNavigate } from "react-router-dom"; // Removido - não utilizado
// import { createPageUrl } from "@/utils"; // Removido - não utilizado
// Imports de Integração removidos (vão para ProductForm)
import { useTenant } from "@/components/tenant/TenantContext";

import { Card, CardContent } from "@/components/ui/card"; // CardHeader, CardTitle removidos (não usados mais diretamente aqui)
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
// Label removido (não usado diretamente aqui mais)
import { toast } from "@/components/ui/use-toast";
// Selects removidos
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
// import { Badge } from "@/components/ui/badge"; // Removido - não utilizado diretamente aqui (usado apenas dentro do map)
import { Progress } from "@/components/ui/progress";
import { 
  Package, 
  Plus, 
  Search, 
  Edit, 
  Trash2, 
  ArrowUpDown,
  Loader2,
  // Barcode removido
  // Upload removido
  // ImageIcon removido
  AlertCircle,
  // X removido
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
// Checkbox removido
import ProductForm from "@/components/products/ProductForm"; // <<< IMPORTAR ProductForm >>>

export default function ProductsPage() {
  // const navigate = useNavigate(); // Removido - não utilizado
  const { currentTenant: tenantContextData, isLoading: isLoadingTenant, error: tenantError } = useTenant();

  const [isLoading, setIsLoading] = useState(true);
  const [products, setProducts] = useState([]);
  const [activeTab, setActiveTab] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false); // <<< Estado para modal >>>
  const [editingProduct, setEditingProduct] = useState(null); // <<< Estado para produto em edição >>>
  const [sortBy, setSortBy] = useState("name");
  const [sortOrder, setSortOrder] = useState("asc");
  const [lowStockProducts, setLowStockProducts] = useState([]);
  // <<< ADICIONAR ESTADOS PARA EDIÇÃO INLINE >>>
  const [editingStockId, setEditingStockId] = useState(null); // ID do produto cujo estoque está sendo editado
  const [currentStockValue, setCurrentStockValue] = useState(""); // Valor atual no input de edição

  // formData e estados relacionados ao form removidos

  useEffect(() => {
    // Lógica de carregamento do tenant e produtos inicial
    if (!isLoadingTenant && tenantContextData && !tenantError) {
      console.log("[ProductsPage] Tenant context ready, loading products for:", tenantContextData.id);
      loadProductsForTenant(tenantContextData);
    } else if (!isLoadingTenant && tenantError) {
      console.error("[ProductsPage] Tenant context error:", tenantError);
      toast({
        title: "Erro ao carregar Loja/Clínica",
        description: tenantError,
        variant: "destructive"
      });
      setIsLoading(false);
      setProducts([]);
    } else if (!isLoadingTenant && !tenantContextData && !tenantError) { // Adicionado !tenantError aqui
         console.warn("[ProductsPage] Tenant loading finished, but no tenant data received. Check TenantContext.");
         toast({ title: "Aviso", description:"Não foi possível obter os dados da loja."}); // Adiciona feedback
         setIsLoading(false);
         setProducts([]);
    }
  }, [tenantContextData, isLoadingTenant, tenantError]);

  useEffect(() => {
    // Lógica para definir alerta de estoque baixo
    if (products.length > 0) {
      const lowStock = products.filter(product => {
         // Considera apenas produtos de petshop para estoque baixo
         return product.module === 'petshop' && product.stock_quantity <= (product.low_stock_threshold || 5);
      });
      setLowStockProducts(lowStock);
    } else {
       setLowStockProducts([]);
    }
  }, [products]);

  const loadProductsForTenant = async (activeTenant) => {
    if (!activeTenant?.id) {
      console.error("[ProductsPage] loadProductsForTenant called without a valid activeTenant.");
      setIsLoading(false); // Para o loading se não há tenant
      setProducts([]); // Limpa produtos
      toast({ title: "Erro", description: "ID da loja inválido para carregar produtos.", variant: "destructive"});
      return;
    }
    setIsLoading(true);

    // <<< ADICIONADO ESTE BLOCO PARA DEBUG >>>
    try {
      // Usamos import dinâmico para não poluir os imports globais
      const { getAuth } = await import("firebase/auth"); 
      const auth = getAuth();
      console.log("[ProductsPage] Checking auth state right before Firestore query:", auth.currentUser);
    } catch (authError) {
       console.error("[ProductsPage] Error getting auth instance for debug:", authError);
    }
    // <<< FIM DO BLOCO DE DEBUG >>>

    try {
       // <<< REMOVER VALIDAÇÃO DE MÓDULO CLÍNICA >>>
       // const requiredModules = ["petshop", "clinica"];
       // const hasAccess = requiredModules.some(mod => activeTenant.selected_modules?.includes(mod));
       // if (!hasAccess) { ... }

       console.log(`[ProductsPage] Fetching products for tenant ${activeTenant.id}`);
       // <<< Filtrar apenas por módulo petshop direto na query? Ou filtrar no frontend? >>>
       // Vamos filtrar no frontend por enquanto para simplicidade, assumindo que só cadastrarão petshop
        const productsData = await Product.filter({ tenant_id: activeTenant.id });
       // Filtra APENAS produtos do petshop no frontend
       const petshopProducts = productsData.filter(p => p.module === 'petshop');
       console.log(`[ProductsPage] Petshop products fetched:`, petshopProducts);
       setProducts(petshopProducts); // <<< Usa os produtos filtrados
    } catch (error) {
       console.error("Erro ao carregar produtos:", error); // <<< ERRO DE PERMISSÃO ACONTECE AQUI >>>
      toast({
         title: "Erro ao Carregar Produtos",
         description: error.message || "Não foi possível carregar os produtos/serviços.",
        variant: "destructive"
      });
       setProducts([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Handlers do formulário inline removidos

  const handleEditProduct = (product) => {
    console.log("[ProductsPage] Editing product:", product);
    setEditingProduct(product); // Define qual produto editar
    setIsModalOpen(true);       // Abre o modal
  };

  const handleDeleteProduct = async (productId) => {
    if (!tenantContextData?.id) {
        toast({ title: "Erro", description: "Não foi possível identificar a loja para excluir o produto.", variant: "destructive" });
        return;
    }
    if (window.confirm("Tem certeza que deseja excluir este produto/serviço?")) {
      try {
        // Chama deleteWithTenant do productService (exportado como Product)
        await Product.deleteWithTenant(tenantContextData.id, productId);
        toast({ title: "Sucesso", description: "Item excluído." });
        // Recarrega a lista após a exclusão
        loadProductsForTenant(tenantContextData);
      } catch (error) {
        console.error("Erro ao excluir produto:", error);
        toast({ title: "Erro ao Excluir", description: error.message || "Não foi possível excluir o item.", variant: "destructive" });
      }
    }
  };

  // <<< NOVA FUNÇÃO PARA ATUALIZAR ESTOQUE >>>
  const handleStockUpdate = async (productId, newStockValue) => {
    if (!tenantContextData?.id) return; // Precisa do tenantId

    const stock = parseInt(newStockValue, 10);
    if (isNaN(stock) || stock < 0) {
      toast({ title: "Valor Inválido", description: "Por favor, insira um número válido para o estoque.", variant: "destructive" });
      // Não reseta o modo de edição aqui, permite corrigir
        return;
      }
      
    console.log(`[ProductsPage] Updating stock for product ${productId} to ${stock}`);
    try {
      // Chama Product.update passando apenas o campo a ser atualizado
      await Product.update(tenantContextData.id, productId, { 
        stock_quantity: stock,
        tenant_id: tenantContextData.id
      });
      toast({ title: "Sucesso", description: "Estoque atualizado." });

      // ATUALIZA LOCALMENTE para feedback rápido (OPCIONAL, mas bom para UX)
      // Se loadProductsForTenant usar onSnapshot, isso pode ser desnecessário ou causar dupla atualização
      setProducts(prevProducts =>
         prevProducts.map(p => (p.id === productId ? { ...p, stock_quantity: stock } : p))
      );

    } catch (error) {
      console.error("Erro ao atualizar estoque:", error);
      toast({ title: "Erro ao Atualizar", description: error.message || "Não foi possível atualizar o estoque.", variant: "destructive" });
    } finally {
      // Sai do modo de edição independentemente de sucesso ou falha
      setEditingStockId(null);
      setCurrentStockValue("");
    }
  };

  // Lógica de ordenação e filtro (mantida)
  const filteredProducts = products.filter(product => {
    // <<< Simplificar filtro - remover módulo >>>
    const categoryMatch = activeTab === "all" || product.category === activeTab;
    const searchMatch = !searchTerm ||
      product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (product.sku && product.sku.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (product.barcode && product.barcode.toLowerCase().includes(searchTerm.toLowerCase()));
    
    return categoryMatch && searchMatch;
  });

  const sortedProducts = [...filteredProducts].sort((a, b) => {
    let valA = a[sortBy];
    let valB = b[sortBy];
    
    // <<< Remover tratamento especial para módulo >>>
    // if (sortBy === 'module') { ... }
    if (typeof valA === 'string') {
      valA = valA.toLowerCase();
      valB = valB.toLowerCase();
    } else if (typeof valA === 'number' || typeof valA === 'boolean') {
      // Ordenação numérica/booleana padrão
    } else { // Fallback para nulos ou indefinidos
       valA = '';
       valB = '';
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
     if (value === null || value === undefined || typeof value !== 'number') return 'R$ -'; // Trata valores não numéricos, nulos ou indefinidos
     return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  // Abre o modal para um NOVO produto
  const openNewProductForm = () => {
    if (!tenantContextData?.id) { // Verifica se tem tenantId
      toast({ title: "Erro", description: "Dados da loja não carregados.", variant: "destructive" });
      return;
    }
    setEditingProduct(null); // Garante que não está em modo de edição
    setIsModalOpen(true);   // Abre o modal
  };

  // Callback chamada pelo ProductForm após salvar com sucesso
  const handleModalSuccess = () => {
    setIsModalOpen(false); // Fecha o modal
    setEditingProduct(null); // Limpa o produto em edição
    if (tenantContextData) {
      loadProductsForTenant(tenantContextData); // Recarrega a lista
    }
  };

  // Renderização condicional de Loading/Erro do Tenant
  if (isLoadingTenant) {
     return <div className="container mx-auto py-6 flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin text-blue-500" /> Carregando dados da loja...</div>;
  }
  if (tenantError) {
      return <div className="container mx-auto py-6"><Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertTitle>Erro</AlertTitle><AlertDescription>{tenantError}</AlertDescription></Alert></div>;
  }
  if (!tenantContextData?.id) { // Verifica se tenantId existe após loading
       return <div className="container mx-auto py-6"><Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertTitle>Erro</AlertTitle><AlertDescription>Não foi possível carregar os dados da loja (ID não encontrado). Tente recarregar a página ou contate o suporte.</AlertDescription></Alert></div>;
  }

  // --- JSX PRINCIPAL ---
  return (
    <div className="container mx-auto py-6">
      {/* --- CABEÇALHO REORGANIZADO --- */}
      {/* Linha 1: Título e Busca */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-4">
        {/* Bloco do Título */}
        <div>
          <h1 className="text-2xl font-bold">Produtos</h1>
          <p className="text-gray-500">Gerencie os itens de petshop {tenantContextData?.name ? `da ${tenantContextData.name}` : ''}</p>
        </div>
        {/* Campo de Busca */}
        <div className="relative w-full md:w-auto md:min-w-[250px]">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
          <Input type="search" placeholder="Buscar produtos..." className="pl-8 w-full" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
        </div>
      </div>

      {/* Linha 2: Botão Novo Produto */}
      <div className="flex justify-end mb-4">
        <Button onClick={openNewProductForm} className="flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Novo Produto
        </Button>
      </div>

      {/* Linha 3: Abas de Categoria */}
      <div className="mb-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
           <TabsList className="flex-wrap h-auto">
            <TabsTrigger value="all">Todos</TabsTrigger>
            <TabsTrigger value="food">Alimentação</TabsTrigger>
            <TabsTrigger value="medicine">Medicamentos</TabsTrigger>
            <TabsTrigger value="accessories">Acessórios</TabsTrigger>
            <TabsTrigger value="hygiene">Higiene</TabsTrigger>
            <TabsTrigger value="toys">Brinquedos</TabsTrigger>
            <TabsTrigger value="grooming">Banho e Tosa</TabsTrigger>
            <TabsTrigger value="other">Outros</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      {/* --- FIM CABEÇALHO REORGANIZADO --- */}

      {/* Alerta de Estoque Baixo */}
      {lowStockProducts.length > 0 && (
        <Alert className="mb-6 bg-amber-50 border-amber-200 text-amber-800">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Alerta de estoque baixo</AlertTitle>
          <AlertDescription>
            {lowStockProducts.length} {lowStockProducts.length === 1 ? 'produto está' : 'produtos estão'} com estoque abaixo do mínimo recomendado.
            <Button variant="link" className="text-amber-800 p-0 h-auto ml-1" onClick={() => setActiveTab('all')}>Ver itens</Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Tabela de Itens */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin text-blue-500" /></div>
          ) : sortedProducts.length === 0 ? (
            <div className="text-center py-12">
              <Package className="h-12 w-12 text-gray-300 mx-auto mb-3" />
              <h3 className="text-lg font-medium text-gray-900">Nenhum produto encontrado</h3>
               <p className="mt-1 text-gray-500">{products.length === 0 ? "Comece adicionando seu primeiro produto" : "Nenhum produto corresponde aos filtros"}</p>
               <Button onClick={openNewProductForm} className="mt-4"><Plus className="mr-2 h-4 w-4" /> Adicionar Produto</Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                     {/* Cabeçalhos da Tabela - Removida largura fixa do Nome */}
                     <TableHead><button className="flex items-center gap-1" onClick={() => handleSort('name')}>Nome{sortBy === 'name' && (<ArrowUpDown className="h-3 w-3" />)}</button></TableHead>
                     {/* <<< Adicionar Cabeçalho Barcode >>> */}
                     <TableHead><button className="flex items-center gap-1" onClick={() => handleSort('barcode')}>Cód. Barras{sortBy === 'barcode' && (<ArrowUpDown className="h-3 w-3" />)}</button></TableHead>
                     {/* <<< Adicionar Cabeçalho NCM >>> */}
                     <TableHead><button className="flex items-center gap-1" onClick={() => handleSort('ncm')}>NCM{sortBy === 'ncm' && (<ArrowUpDown className="h-3 w-3" />)}</button></TableHead>
                     <TableHead><button className="flex items-center gap-1" onClick={() => handleSort('stock_quantity')}>Estoque{sortBy === 'stock_quantity' && (<ArrowUpDown className="h-3 w-3" />)}</button></TableHead>
                     <TableHead><button className="flex items-center gap-1" onClick={() => handleSort('price')}>Preço{sortBy === 'price' && (<ArrowUpDown className="h-3 w-3" />)}</button></TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                   {/* Corpo da Tabela */}
                  {sortedProducts.map((product) => {
                     const stockLevel = product.stock_quantity <= 0 ? 'empty' : product.stock_quantity <= (product.low_stock_threshold || 5) ? 'low' : 'ok';
                    
                    return (
                      <TableRow key={product.id}>
                         {/* Nome */}
                        <TableCell>
                          <div className="flex items-center gap-3">
                             {product.image_url ? (<img src={product.image_url} alt={product.name} className="w-10 h-10 object-cover rounded-md"/>) : (<div className="w-10 h-10 bg-gray-100 rounded-md flex items-center justify-center"><Package className="w-5 h-5 text-gray-400" /></div>)}
                            <div>
                              <div className="font-medium">{product.name}</div>
                               {product.sku && (<div className="text-sm text-gray-500">SKU: {product.sku}</div>)}
                            </div>
                          </div>
                        </TableCell>
                          {/* <<< Adicionar Célula Barcode >>> */}
                          <TableCell><span className="font-mono text-xs">{product.barcode || '-'}</span></TableCell>
                          {/* <<< Adicionar Célula NCM >>> */}
                          <TableCell><span className="font-mono text-xs">{product.ncm || '-'}</span></TableCell>
                         {/* Estoque - Modificado para Edição Inline */}
                        <TableCell>
                           {editingStockId === product.id ? (
                               <Input
                                 type="number"
                                 value={currentStockValue}
                                 onChange={(e) => setCurrentStockValue(e.target.value)} // Atualiza valor temporário
                                 onBlur={() => handleStockUpdate(product.id, currentStockValue)} // Salva ao sair do campo
                                 onKeyDown={(e) => {
                                   if (e.key === 'Enter') {
                                      handleStockUpdate(product.id, currentStockValue);
                                   } else if (e.key === 'Escape') {
                                      setEditingStockId(null); // Cancela com Esc
                                      setCurrentStockValue("");
                                   }
                                 }}
                                 className="h-8 w-20 text-center" // Estilo menor para caber na célula
                                 autoFocus // Foca automaticamente no input
                                 min="0" // Não permitir estoque negativo
                               />
                             ) : (
                               <button
                                 className="space-y-1 w-16 text-left hover:bg-gray-100 p-1 rounded cursor-pointer" // Botão para clicar e editar
                                 onClick={() => {
                                   setEditingStockId(product.id);
                                   setCurrentStockValue(String(product.stock_quantity)); // Define valor inicial para edição
                                 }}
                               >
                                 <span className={`font-medium ${stockLevel === 'empty' ? 'text-red-500' : stockLevel === 'low' ? 'text-yellow-500' : 'text-green-500'}`}>
                              {product.stock_quantity}
                            </span>
                                 {stockLevel !== 'ok' && stockLevel !== 'n/a' && (
                              <div className="w-full h-1.5">
                                     <Progress value={stockLevel === 'empty' ? 0 : 50} className={`h-1.5 ${stockLevel === 'empty' ? 'bg-red-100' : 'bg-yellow-100'}`} indicatorClassName={stockLevel === 'empty' ? 'bg-red-500' : 'bg-yellow-500'}/>
                              </div>
                            )}
                               </button>
                             )}
                        </TableCell>
                         {/* Preço */}
                         <TableCell>{formatCurrency(product.price)}</TableCell>
                         {/* Ações */}
                        <TableCell className="text-right">
                           <div className="flex justify-end gap-1">
                             <Button variant="ghost" size="icon" onClick={() => handleEditProduct(product)} className="h-8 w-8"><Edit className="h-4 w-4" /></Button>
                             <Button variant="ghost" size="icon" className="text-red-500 hover:text-red-700 hover:bg-red-50 h-8 w-8" onClick={() => handleDeleteProduct(product.id)}><Trash2 className="h-4 w-4" /></Button>
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

      {/* Renderiza o Modal ProductForm */}
      {/* Garante que tenantId existe antes de renderizar */}
      {tenantContextData?.id && (
         <ProductForm
           // Usa tenantId e productId para a key, força remontagem completa
           key={`${tenantContextData.id}-${editingProduct?.id || 'new'}`}
           open={isModalOpen}
           onOpenChange={setIsModalOpen}
           onSuccess={handleModalSuccess}
           productId={editingProduct?.id} // Passa o ID do produto ou undefined/null
           tenantId={tenantContextData.id} // Passa o ID do tenant
         />
       )}
    </div>
  );
}