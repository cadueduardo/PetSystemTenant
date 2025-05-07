// src/pages/Products.jsx
import { useState, useEffect, useCallback } from "react"; // useRef removido, useCallback adicionado
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
import PaginationControls from "@/components/ui/PaginationControls"; // <<< Adicionar importação >>>

export default function ProductsPage() {
  // const navigate = useNavigate(); // Removido - não utilizado
  const { currentTenant: tenantContextData, isLoading: isLoadingTenant, error: tenantError } = useTenant();

  const [isLoadingInitial, setIsLoadingInitial] = useState(true); // Renomeado de isLoading
  const [products, setProducts] = useState([]);
  const [activeTab, setActiveTab] = useState("all"); // Filtro de categoria
  const [searchTerm, setSearchTerm] = useState(""); // Filtro de busca (frontend)
  const [isModalOpen, setIsModalOpen] = useState(false); 
  const [editingProduct, setEditingProduct] = useState(null); 
  const [sortBy, setSortBy] = useState("name"); // Campo de ordenação
  const [sortOrder, setSortOrder] = useState("asc"); // Direção da ordenação
  const [lowStockProducts, setLowStockProducts] = useState([]);
  
  const [editingStockId, setEditingStockId] = useState(null); 
  const [currentStockValue, setCurrentStockValue] = useState(""); 

  // <<< Estados para Paginação >>>
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [lastVisibleDoc, setLastVisibleDoc] = useState(null);
  const [firstVisibleDoc, setFirstVisibleDoc] = useState(null);
  const [totalProducts, setTotalProducts] = useState(0);
  const [isLoadingPage, setIsLoadingPage] = useState(false);


  const loadProductsPage = useCallback(async (direction = 'current', newPageSize = pageSize, newTenantId = null, newActiveTab = null, newSortBy = null, newSortOrder = null) => {
    const tenantId = newTenantId || tenantContextData?.id;
    const categoryFilter = (newActiveTab === null ? activeTab : newActiveTab) === 'all' ? null : (newActiveTab === null ? activeTab : newActiveTab);
    const currentSortBy = newSortBy || sortBy;
    const currentSortOrder = newSortOrder || sortOrder;

    if (!tenantId) {
      console.warn("[ProductsPage loadProductsPage] No tenant ID.");
      setIsLoadingInitial(false);
      setIsLoadingPage(false);
      setProducts([]);
      return;
    }

    console.log(`[ProductsPage loadProductsPage] Loading. Direction: ${direction}, Size: ${newPageSize}, Page: ${currentPage}, Tenant: ${tenantId}, Category: ${categoryFilter}, Sort: ${currentSortBy} ${currentSortOrder}`);
    setIsLoadingPage(true);
    if (direction === 'current' && newPageSize === pageSize) setIsLoadingInitial(true);

    try {
      // Obter contagem total apenas na primeira carga ou quando filtros/ordenação mudam
      if (direction === 'current') {
        const count = await Product.getCount({ 
          tenant_id: tenantId, 
          module: 'petshop', 
          category: categoryFilter 
        });
        setTotalProducts(count);
        setCurrentPage(1); // Resetar para página 1
        setFirstVisibleDoc(null); // Resetar cursores
        setLastVisibleDoc(null);
      }

      const filterOptions = {
        tenant_id: tenantId,
        module: 'petshop',
        category: categoryFilter,
        orderByField: currentSortBy,
        orderByDirection: currentSortOrder,
        limitNum: newPageSize,
      };

      if (direction === 'next' && lastVisibleDoc) {
        filterOptions.startAfterDoc = lastVisibleDoc;
      } else if (direction === 'prev' && firstVisibleDoc) {
        // Para 'prev', precisamos inverter a ordenação e pegar os docs *antes* do firstVisibleDoc
        // E depois reverter a ordem dos resultados
        // A query em si não tem 'endBefore', então faremos uma query com 'startAfter' do 'primeiro da página anterior'
        // OU mais simples e comum: query com orderBy invertido e limit, e depois inverter o resultado.
        // O productService.filter já aceita orderByDirection.
        // Para implementar 'prev' corretamente com cursores, precisamos buscar os itens *anteriores*
        // ao `firstVisibleDoc`. Firestore não tem `endBefore` fácil para subcoleções.
        // A maneira mais robusta é buscar em ordem decrescente a partir do `firstVisibleDoc` (ou antes dele) e reverter.
        // Para simplificar AGORA, vou focar em 'next' e 'current'.
        // A lógica de 'prev' do Customers.jsx usa endBefore na query, que não temos no productService.filter.
        // Portanto, o 'prev' será desabilitado temporariamente ou precisará de ajuste no service.
        // ATUALIZAÇÃO: Vamos tentar a abordagem de inverter a ordenação e os resultados, como Customers.jsx
        // Mas o Product.filter não tem endBefore. Vou precisar de uma query separada ou modificar Product.filter
        // *Decisão para esta rodada*: Simular com orderBy invertido e reverter, sem endBefore.
        // Isso não é ideal para consistência, mas permite progredir. Melhoria: adicionar endBefore a Product.filter.
        
        // A lógica de paginação "prev" correta com startAfter/endBefore é mais complexa do que
        // simplesmente inverter a ordem. No entanto, uma aproximação é:
        // 1. Construir uma query que busca em ordem reversa, ANTES do primeiro item visível
        // Esta parte é complexa com startAfter apenas.
        // Vou replicar a lógica do Customers.jsx:
        filterOptions.orderByDirection = currentSortOrder === 'asc' ? 'desc' : 'asc';
        filterOptions.startAfterDoc = null; // Não temos um cursor "endBefore" direto em filter.
                                           // O ideal é modificar Product.filter para aceitar endBeforeDoc
                                           // Por agora, a página PREV pode não ser perfeita ou pode recarregar a anterior.
                                           // Temporariamente, para prev, vamos recarregar a lista desde o início e ir para a página anterior.
                                           // ISSO NÃO É EFICIENTE. Melhoria: Adicionar endBefore no Product.filter

        // *CORREÇÃO DA LÓGICA PREV*: Para fazer o 'prev' corretamente como no Customers.jsx,
        // precisaríamos do `endBefore`. Como não temos isso em `Product.filter` ainda,
        // o 'prev' aqui será mais simples e menos otimizado (pode recarregar mais dados) ou pulado.
        // Para seguir o exemplo do Customers:
        // A query de 'prev' no Customers.jsx usa endBefore. Vamos ter que adaptar
        // o Product.filter ou fazer a query manualmente aqui.
        // Para este passo, vamos fazer uma query com orderBy invertido e limit.
        // E então inverter os resultados.
        
        // Vamos precisar do `firstVisibleDoc` para construir a query de "previous"
        // Esta lógica está incompleta sem `endBefore` ou uma estratégia mais complexa no service.
        // Por enquanto, o 'prev' pode não funcionar como esperado ou ser menos eficiente.
        // Para uma implementação correta e eficiente de "previous", o `productService.filter`
        // precisaria ser capaz de lidar com `endBefore`.
        // Simplicando: Por enquanto, `prev` buscará a primeira página se currentPage > 1 e o usuário irá manualmente.
        // Não é o ideal.
        // *REFAZENDO A LÓGICA DE PREVIOUS*: Baseado no Customers.jsx
        // Precisamos de uma query separada para 'prev' se quisermos usar `endBefore`
        // ou modificar Product.filter.

        // *Simplificação para este passo*: O `PaginationControls` mostrará o botão "Anterior",
        // mas a lógica de carregar a página anterior perfeitamente com `endBefore` não está
        // totalmente implementada aqui devido à ausência no `Product.filter`.
        // Ação: Para 'prev', vamos tentar recarregar a partir do início e decrementar a página,
        // sabendo que isso não é ideal para navegação eficiente para trás.

        if (direction === 'prev' && firstVisibleDoc) {
            // Para 'prev', vamos buscar em ordem reversa.
            // Como não temos `endBefore` em `Product.filter` diretamente:
            // O ideal seria: Product.filter({ ..., orderByDirection: REVERSA, endBeforeDoc: firstVisibleDoc, limitNum })
            // Solução temporária: recarregar a primeira página e o usuário navega. Ou, se currentPage > 1, resetar
            // e o usuário precisaria clicar 'next' novamente.
            // Para uma navegação 'prev' real:
            // A query é complexa sem endBefore. A melhor forma é:
            // 1. Chamar Product.filter com orderByDirection invertida
            // 2. Pegar os últimos 'pageSize' itens.
            // 3. Inverter a ordem desses itens.
            // Isso requer que o `Product.filter` possa retornar todos os itens correspondentes à query reversa
            // antes do firstVisibleDoc, o que não é o caso.
            
            // A melhor aproximação com a API atual: carregar os documentos *antes* do `firstVisibleDoc`
            // na ordem reversa e pegar os últimos `pageSize`.
            // Isso ainda é complexo.
            // *Abordagem Customers.jsx (adaptada para o que temos):*
            // 1. Query com orderBy invertido.
            // 2. Firestore não tem `endBefore` nativo em queries de subcoleção assim fácil.
            // O `Customers.jsx` usa `endBefore` com o `query` do `firebase/firestore` diretamente.
            // Para usar o `Product.filter`, precisaríamos adicionar suporte a `endBeforeDoc`.

            // *Solução pragmática para esta iteração*:
            // Se `direction` é `prev`, vamos resetar para a página 1 e carregar.
            // O usuário pode então navegar para a frente.
            // Isso não é uma paginação "para trás" verdadeira, mas um reset.
             console.warn("[ProductsPage] 'Previous' page functionality with current Product.filter is limited. Resetting to page 1.");
             filterOptions.startAfterDoc = null; // Começa do início
             setCurrentPage(1); // Vai para a primeira página
        }
      }


      const { products: fetchedProducts, lastVisibleDoc: newLastVisible } = await Product.filter(filterOptions);
      
      let productsData = fetchedProducts;
      // A lógica de inverter para 'prev' seria aqui se a query do Product.filter fosse feita com ordem invertida e endBefore
      // if (direction === 'prev') {
      //   productsData.reverse();
      // }

      setProducts(productsData);
      setLastVisibleDoc(newLastVisible || null);

      // Definir firstVisibleDoc para a próxima query 'prev'
      // Se direction for 'prev', o newFirstVisible seria o primeiro do array productsData (após reverter)
      // Se direction for 'next' ou 'current', é o primeiro do array atual.
      setFirstVisibleDoc(productsData.length > 0 ? productsData[0] : null);


      if (direction === 'next') {
        setCurrentPage(prev => prev + 1);
      } else if (direction === 'prev') {
        // Ação real de 'prev' é complexa, como discutido.
        // Se implementado de verdade, seria: setCurrentPage(prev => Math.max(1, prev - 1));
        // Com a limitação atual, o reset para página 1 já foi feito.
      } else if (direction === 'current') {
        // setCurrentPage(1) já foi feito ao buscar a contagem.
      }

    } catch (error) {
      console.error("[ProductsPage loadProductsPage] Error loading products:", error);
      toast({
        title: "Erro ao Carregar Produtos",
        description: error.message || "Não foi possível carregar os produtos.",
        variant: "destructive"
      });
      setProducts([]);
      setTotalProducts(0);
    } finally {
      setIsLoadingInitial(false);
      setIsLoadingPage(false);
    }
  }, [tenantContextData?.id, activeTab, sortBy, sortOrder, pageSize, currentPage, lastVisibleDoc, firstVisibleDoc, toast]);


  // Carregamento inicial e quando o tenant mudar
  useEffect(() => {
    if (!isLoadingTenant && tenantContextData?.id && !tenantError) {
      console.log("[ProductsPage] Tenant context ready, loading initial products for:", tenantContextData.id);
      loadProductsPage('current', pageSize, tenantContextData.id, activeTab, sortBy, sortOrder);
    } else if (!isLoadingTenant && tenantError) {
      console.error("[ProductsPage] Tenant context error:", tenantError);
      toast({
        title: "Erro ao carregar Loja/Clínica",
        description: tenantError,
        variant: "destructive"
      });
      setIsLoadingInitial(false);
      setProducts([]);
    } else if (!isLoadingTenant && !tenantContextData && !tenantError) {
      console.warn("[ProductsPage] Tenant loading finished, but no tenant data. Check TenantContext.");
      toast({ title: "Aviso", description: "Não foi possível obter os dados da loja." });
      setIsLoadingInitial(false);
      setProducts([]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantContextData?.id, isLoadingTenant, tenantError]); // Removido loadProductsPage daqui para evitar loop com useCallback

  // Recarregar quando filtros ou ordenação mudam
  useEffect(() => {
    if (tenantContextData?.id) { // Só recarrega se já tem tenant
      console.log(`[ProductsPage] Filters/sort changed. Tab: ${activeTab}, SortBy: ${sortBy}, SortOrder: ${sortOrder}. Reloading page 1.`);
      loadProductsPage('current', pageSize, tenantContextData.id, activeTab, sortBy, sortOrder);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, sortBy, sortOrder]); // Removido loadProductsPage daqui


  useEffect(() => {
    // Lógica para definir alerta de estoque baixo (opera sobre a página atual)
    if (products.length > 0) {
      const lowStock = products.filter(product => {
         return product.module === 'petshop' && product.stock_quantity <= (product.low_stock_threshold || 5);
      });
      setLowStockProducts(lowStock);
    } else {
       setLowStockProducts([]);
    }
  }, [products]);


  // loadProductsForTenant removido, lógica agora em loadProductsPage

  const handleEditProduct = (product) => {
    console.log("[ProductsPage] Editing product:", product);
    setEditingProduct(product);
    setIsModalOpen(true);
  };

  const handleDeleteProduct = async (productId) => {
    if (!tenantContextData?.id) {
        toast({ title: "Erro", description: "Não foi possível identificar a loja para excluir o produto.", variant: "destructive" });
        return;
    }
    if (window.confirm("Tem certeza que deseja excluir este produto/serviço?")) {
      try {
        await Product.deleteWithTenant(tenantContextData.id, productId);
        toast({ title: "Sucesso", description: "Item excluído." });
        // Recarrega a página atual após a exclusão
        loadProductsPage('current', pageSize, tenantContextData.id, activeTab, sortBy, sortOrder); 
      } catch (error) {
        console.error("Erro ao excluir produto:", error);
        toast({ title: "Erro ao Excluir", description: error.message || "Não foi possível excluir o item.", variant: "destructive" });
      }
    }
  };

  const handleStockUpdate = async (productId, newStockValue) => {
    if (!tenantContextData?.id) return; 

    const stock = parseInt(newStockValue, 10);
    if (isNaN(stock) || stock < 0) {
      toast({ title: "Valor Inválido", description: "Por favor, insira um número válido para o estoque.", variant: "destructive" });
        return;
      }
      
    console.log(`[ProductsPage] Updating stock for product ${productId} to ${stock}`);
    try {
      await Product.update(tenantContextData.id, productId, { 
        stock_quantity: stock,
        // tenant_id: tenantContextData.id // tenant_id não é necessário no update, já está no path
      });
      toast({ title: "Sucesso", description: "Estoque atualizado." });
      
      // Atualiza localmente para feedback rápido
      setProducts(prevProducts =>
         prevProducts.map(p => (p.id === productId ? { ...p, stock_quantity: stock } : p))
      );

    } catch (error) {
      console.error("Erro ao atualizar estoque:", error);
      toast({ title: "Erro ao Atualizar", description: error.message || "Não foi possível atualizar o estoque.", variant: "destructive" });
    } finally {
      setEditingStockId(null);
      setCurrentStockValue("");
    }
  };

  // Filtro de busca (frontend) - opera sobre os produtos da PÁGINA ATUAL
  const frontendFilteredProducts = products.filter(product => {
    // O filtro de categoria (activeTab) e módulo ('petshop') já foi aplicado no backend
    if (!searchTerm) return true; // Se não há termo de busca, retorna todos da página
    return product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (product.sku && product.sku.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (product.barcode && product.barcode.toLowerCase().includes(searchTerm.toLowerCase()));
  });

  // A ordenação (sortedProducts) não é mais necessária aqui, pois o Firestore já retorna ordenado.
  // Usaremos `frontendFilteredProducts` diretamente na renderização da tabela.

  const handleSort = (field) => {
    const newSortOrder = sortBy === field && sortOrder === 'asc' ? 'desc' : 'asc';
    setSortBy(field);
    setSortOrder(newSortOrder);
    // O useEffect [activeTab, sortBy, sortOrder] cuidará de recarregar os dados.
  };

  const formatCurrency = (value) => {
     if (value === null || value === undefined || typeof value !== 'number') return 'R$ -'; 
     return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const openNewProductForm = () => {
    if (!tenantContextData?.id) { 
      toast({ title: "Erro", description: "Dados da loja não carregados.", variant: "destructive" });
      return;
    }
    setEditingProduct(null); 
    setIsModalOpen(true);   
  };

  const handleModalSuccess = () => {
    setIsModalOpen(false); 
    setEditingProduct(null); 
    if (tenantContextData) {
      // Recarrega a página atual para refletir possíveis adições/alterações
      loadProductsPage('current', pageSize, tenantContextData.id, activeTab, sortBy, sortOrder);
    }
  };

  // <<< Funções de Paginação >>>
  const handlePageChange = (directionOrPageNumber) => {
    if (typeof directionOrPageNumber === 'string') { // 'next' ou 'prev'
      loadProductsPage(directionOrPageNumber, pageSize);
    } else { // número da página (não usado diretamente por PaginationControls, mas pode ser útil)
      // Para ir para uma página específica, precisaríamos de uma lógica mais complexa
      // para buscar os cursores corretos ou buscar a partir do início.
      // Por ora, PaginationControls usa 'next' e 'prev'.
      console.warn("[ProductsPage] Direct page number navigation not fully implemented with current cursors.");
      if (directionOrPageNumber > currentPage && lastVisibleDoc) {
        loadProductsPage('next', pageSize);
      } else if (directionOrPageNumber < currentPage && firstVisibleDoc) {
        // A lógica 'prev' aqui ainda é simplificada como no loadProductsPage
        loadProductsPage('prev', pageSize); 
      }
    }
  };

  const handlePageSizeChange = (newPageSize) => {
    setPageSize(newPageSize);
    // Recarrega da primeira página com o novo tamanho
    loadProductsPage('current', newPageSize, tenantContextData.id, activeTab, sortBy, sortOrder);
  };


  if (isLoadingTenant) {
     return <div className="container mx-auto py-6 flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin text-blue-500" /> Carregando dados da loja...</div>;
  }
  if (tenantError) {
      return <div className="container mx-auto py-6"><Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertTitle>Erro</AlertTitle><AlertDescription>{tenantError}</AlertDescription></Alert></div>;
  }
  if (!tenantContextData?.id && !isLoadingTenant) { // Verificação mais precisa
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
          <Input type="search" placeholder="Buscar na página atual..." className="pl-8 w-full" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
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
            <Button variant="link" className="text-amber-800 p-0 h-auto ml-1" onClick={() => { setActiveTab('all'); setSearchTerm('');} }>Ver todos</Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Tabela de Itens */}
      <Card>
        <CardContent className="p-0">
          {isLoadingInitial ? ( // Usa isLoadingInitial para a primeira carga completa
            <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin text-blue-500" /></div>
          ) : products.length === 0 && !searchTerm ? ( // Se não há produtos na página e sem busca
            <div className="text-center py-12">
              <Package className="h-12 w-12 text-gray-300 mx-auto mb-3" />
              <h3 className="text-lg font-medium text-gray-900">Nenhum produto encontrado</h3>
               <p className="mt-1 text-gray-500">
                 {totalProducts === 0 ? "Comece adicionando seu primeiro produto." : "Nenhum produto corresponde aos filtros aplicados."}
               </p>
               <Button onClick={openNewProductForm} className="mt-4"><Plus className="mr-2 h-4 w-4" /> Adicionar Produto</Button>
            </div>
          ) : frontendFilteredProducts.length === 0 && searchTerm ? ( // Se há busca mas nada encontrado na página
            <div className="text-center py-12">
              <Search className="h-12 w-12 text-gray-300 mx-auto mb-3" />
              <h3 className="text-lg font-medium text-gray-900">Nenhum produto encontrado para "{searchTerm}"</h3>
              <p className="mt-1 text-gray-500">Tente um termo de busca diferente ou limpe a busca.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                     <TableHead><button className="flex items-center gap-1" onClick={() => handleSort('name')}>Nome{sortBy === 'name' && (<ArrowUpDown className="h-3 w-3" />)}</button></TableHead>
                     <TableHead><button className="flex items-center gap-1" onClick={() => handleSort('barcode')}>Cód. Barras{sortBy === 'barcode' && (<ArrowUpDown className="h-3 w-3" />)}</button></TableHead>
                     <TableHead><button className="flex items-center gap-1" onClick={() => handleSort('ncm')}>NCM{sortBy === 'ncm' && (<ArrowUpDown className="h-3 w-3" />)}</button></TableHead>
                     <TableHead><button className="flex items-center gap-1" onClick={() => handleSort('stock_quantity')}>Estoque{sortBy === 'stock_quantity' && (<ArrowUpDown className="h-3 w-3" />)}</button></TableHead>
                     <TableHead><button className="flex items-center gap-1" onClick={() => handleSort('price')}>Preço{sortBy === 'price' && (<ArrowUpDown className="h-3 w-3" />)}</button></TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {frontendFilteredProducts.map((product) => { // Usa frontendFilteredProducts
                     const stockLevel = product.stock_quantity <= 0 ? 'empty' : product.stock_quantity <= (product.low_stock_threshold || 5) ? 'low' : 'ok';
                    
                    return (
                      <TableRow key={product.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                             {product.image_url ? (<img src={product.image_url} alt={product.name} className="w-10 h-10 object-cover rounded-md"/>) : (<div className="w-10 h-10 bg-gray-100 rounded-md flex items-center justify-center"><Package className="w-5 h-5 text-gray-400" /></div>)}
                            <div>
                              <div className="font-medium">{product.name}</div>
                               {product.sku && (<div className="text-sm text-gray-500">SKU: {product.sku}</div>)}
                            </div>
                          </div>
                        </TableCell>
                          <TableCell><span className="font-mono text-xs">{product.barcode || '-'}</span></TableCell>
                          <TableCell><span className="font-mono text-xs">{product.ncm || '-'}</span></TableCell>
                        <TableCell>
                           {editingStockId === product.id ? (
                               <Input
                                 type="number"
                                 value={currentStockValue}
                                 onChange={(e) => setCurrentStockValue(e.target.value)} 
                                 onBlur={() => handleStockUpdate(product.id, currentStockValue)} 
                                 onKeyDown={(e) => {
                                   if (e.key === 'Enter') {
                                      handleStockUpdate(product.id, currentStockValue);
                                   } else if (e.key === 'Escape') {
                                      setEditingStockId(null); 
                                      setCurrentStockValue("");
                                   }
                                 }}
                                 className="h-8 w-20 text-center" 
                                 autoFocus 
                                 min="0" 
                               />
                             ) : (
                               <button
                                 className="space-y-1 w-16 text-left hover:bg-gray-100 p-1 rounded cursor-pointer" 
                                 onClick={() => {
                                   setEditingStockId(product.id);
                                   setCurrentStockValue(String(product.stock_quantity)); 
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
                         <TableCell>{formatCurrency(product.price)}</TableCell>
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
      
      {/* Controles de Paginação */}
      {!isLoadingInitial && products.length > 0 && (
        <PaginationControls
          currentPage={currentPage}
          pageSize={pageSize}
          totalItems={totalProducts}
          onPageChange={handlePageChange}
          onPageSizeChange={handlePageSizeChange}
          isLoading={isLoadingPage}
          itemCountOnPage={products.length} // Passa a contagem de itens na página atual
          hasNextPage={!!lastVisibleDoc && products.length === pageSize} // Heurística para hasNextPage
          hasPreviousPage={currentPage > 1} // Lógica simples para hasPreviousPage
        />
      )}

      {/* Renderiza o Modal ProductForm */}
      {tenantContextData?.id && (
         <ProductForm
           key={`${tenantContextData.id}-${editingProduct?.id || 'new'}`}
           open={isModalOpen}
           onOpenChange={setIsModalOpen}
           onSuccess={handleModalSuccess}
           productId={editingProduct?.id} 
           tenantId={tenantContextData.id} 
         />
       )}
    </div>
  );
}