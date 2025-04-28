import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Product, Service, Customer, Pet } from "@/api/entities";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/components/ui/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Loader2,
  Search,
  Barcode,
  Plus,
  Clock,
  DollarSign,
  X,
  User,
} from "lucide-react";
import CustomerDialog from "../components/sales/CustomerDialog"; 
import ProductForm from "../components/products/ProductForm"; 
import PaymentDialog from "../components/sales/PaymentDialog"; 
// import { getPendingItems, clearPendingItems } from "@/api/mock/chargeableItemService"; // <<< REMOVIDO IMPORT MOCK
// import { addRemovalReason } from '@/api/mockData'; // <<< REMOVER IMPORT MOCK

// TODO: Importar funções e tipos do Firestore quando implementar a busca real de 'charges'
// import { collection, query, where, onSnapshot, Timestamp, doc, getDoc } from 'firebase/firestore'; // <<< DESCOMENTAR IMPORTS FIRESTORE
import { collection, query, where, onSnapshot } from 'firebase/firestore'; // <<< MANTER APENAS OS USADOS AQUI
import { db } from '@/lib/firebaseConfig'; // <<< DESCOMENTAR IMPORT DB
import { useTenant } from '@/components/tenant/TenantContext'; // <<< DESCOMENTAR IMPORT
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export default function CashierPage() { 
  const navigate = useNavigate();
  const { currentTenant, isLoading: isLoadingTenant, error: tenantError } = useTenant();
  const [activeTab, setActiveTab] = useState("pending"); 
  const [isLoadingProducts, setIsLoadingProducts] = useState(true); // Loading de produtos/serviços
  const [cart, setCart] = useState([]);
  const [barcodeInput, setBarcodeInput] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [products, setProducts] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [services, setServices] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [serviceSearchTerm, setServiceSearchTerm] = useState("");
  const [showCustomerDialog, setShowCustomerDialog] = useState(false);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [showProductForm, setShowProductForm] = useState(false);

  // Estado para 'charges' pendentes (será populado pelo listener)
  const [pendingCharges, setPendingCharges] = useState([]); // <<< NOVO ESTADO (inicialmente vazio)
  const [isLoadingPendingCharges, setIsLoadingPendingCharges] = useState(true); // <<< NOVO ESTADO

  // Estado para saber qual 'charge' está carregada no carrinho
  const [currentLoadedChargeId, setCurrentLoadedChargeId] = useState(null);

  useEffect(() => {
    // <<< Só carregar produtos/serviços se o tenant estiver carregado e existir >>>
    if (!isLoadingTenant && currentTenant?.id) {
       loadProductsAndServices(); 
    } else if (!isLoadingTenant && !currentTenant) {
        // Se terminou de carregar e não tem tenant, limpa e para loading de produtos
        console.warn("[CashierPage] Tenant não carregado ou inexistente após carregamento do contexto. Não é possível carregar produtos/serviços.");
        setProducts([]);
        setServices([]);
        setIsLoadingProducts(false); // <<< Parar loading de produtos aqui >>>
    }
  }, [isLoadingTenant, currentTenant]); // <<< Depender de isLoadingTenant também >>>

  useEffect(() => {
    let unsubscribeCharges = () => {};

    // <<< Só configurar listener se o tenant estiver carregado e existir >>>
    if (!isLoadingTenant && currentTenant?.id) {
      console.log(`[CashierPage] Tenant carregado. Configurando listener para charges pendentes do tenant: ${currentTenant.id}`);
      setIsLoadingPendingCharges(true);
      
      const tenantIdForQuery = currentTenant.id;
      console.log(`[CashierPage] ID do Tenant a ser usado na query de charges: ->${tenantIdForQuery}<-`);
      
      const q = query(
        collection(db, 'tenants', tenantIdForQuery, 'charges'), 
        where('status', 'in', ['pending', 'partially_paid'])
      );

      unsubscribeCharges = onSnapshot(q, async (snapshot) => {
        console.log("[CashierPage] Snapshot recebido para charges pendentes.");
        console.log(`[CashierPage] Snapshot size: ${snapshot.size}, empty: ${snapshot.empty}`); 

        if (snapshot.empty) {
            console.log("[CashierPage] Nenhuma charge pendente encontrada (verificação snapshot.empty).");
            setPendingCharges([]);
            setIsLoadingPendingCharges(false);
            return;
        }
        
        // Mapeia os documentos e busca dados do cliente
        const chargesDataPromises = snapshot.docs.map(async (docSnapshot) => {
          const charge = { id: docSnapshot.id, ...docSnapshot.data() };
          let customer = null;
          let pet = null; // Adicionar busca de pet se necessário depois
          try {
            if (charge.tutorId) {
               console.log(`[CashierPage] Buscando cliente ${charge.tutorId} para charge ${charge.id}`);
               customer = await Customer.get(charge.tutorId);
            } else {
               console.warn(`[CashierPage] Charge ${charge.id} sem tutorId.`);
            }
            if (charge.petId) {
               console.log(`[CashierPage] Buscando pet ${charge.petId} para charge ${charge.id}`);
               pet = await Pet.get(charge.petId); // Assume que existe Pet.get(petId)
            } else {
                console.log(`[CashierPage] Charge ${charge.id} sem petId.`);
            }
          } catch (err) {
            console.error(`Erro ao buscar detalhes (cliente/pet) para charge ${charge.id}`, err);
          }
          // Retorna a charge original com os dados agregados
          return { ...charge, customer, pet }; // <<< 'pet' será null se não encontrado ou sem ID >>>
        });

        // Aguarda todas as buscas de clientes finalizarem
        const chargesData = await Promise.all(chargesDataPromises);
        console.log("[CashierPage] Charges pendentes processadas com dados agregados:", chargesData);
        setPendingCharges(chargesData);
        setIsLoadingPendingCharges(false);
        
      }, (error) => {
        // Tratamento de erro do listener
        console.error("[CashierPage] Erro no listener de charges:", error);
        toast({ title: "Erro", description: "Falha ao buscar cobranças pendentes em tempo real.", variant: "destructive" });
        setPendingCharges([]);
        setIsLoadingPendingCharges(false);
      });

    } else if (!isLoadingTenant && !currentTenant) {
       // <<< Mensagem de aviso se terminou de carregar e NÃO HÁ tenant >>>
       console.warn("[CashierPage] Tenant não carregado ou inexistente após carregamento do contexto. Não é possível buscar charges.");
       setIsLoadingPendingCharges(false); 
       setPendingCharges([]); 
    } else if (isLoadingTenant) {
        // <<< Se AINDA está carregando o tenant, limpa e indica loading >>>
        console.log("[CashierPage] Aguardando TenantContext carregar...");
        setIsLoadingPendingCharges(true);
        setPendingCharges([]);
    }
    
    return () => {
        console.log("[CashierPage] Limpando listener de charges (se existir). Unsubscribe chamado.");
        unsubscribeCharges();
    };

  }, [isLoadingTenant, currentTenant]); // <<< Depender de isLoadingTenant também >>>

  useEffect(() => {
    setFilteredProducts(
      products.filter((product) =>
        product.name.toLowerCase().includes(searchTerm.toLowerCase())
      )
    );
  }, [products, searchTerm]);

  const loadProductsAndServices = async () => {
    // <<< Usar isLoadingProducts aqui >>>
    setIsLoadingProducts(true); 
    try {
      // <<< A verificação do tenant já acontece antes de chamar esta função agora >>>
      // if (!currentTenant?.id) { ... } // REMOVIDO
      console.log(`[CashierPage] Carregando produtos e serviços para o tenant: ${currentTenant.id}`);
      const [productsData, servicesData] = await Promise.all([
        Product.getAllByTenant(currentTenant.id),
        Service.list(),
      ]);
      console.log("[CashierPage] Produtos carregados:", productsData);
      console.log("[CashierPage] Serviços carregados:", servicesData);
      setProducts(productsData || []);
      setServices(servicesData || []);
    } catch (error) {
      console.error("Erro ao carregar produtos/serviços:", error);
      toast({ title: "Erro", description: "Não foi possível carregar produtos/serviços.", variant: "destructive"});
      setProducts([]); // Limpa em caso de erro
      setServices([]); // Limpa em caso de erro
    } finally {
      // <<< Usar setIsLoadingProducts aqui >>>
      setIsLoadingProducts(false); 
    }
  };

  const handleBarcodeSubmit = (e) => {
    e.preventDefault();
     if (currentLoadedChargeId) {
       toast({ title: "Aviso", description: "Não é possível adicionar itens enquanto uma cobrança pendente está carregada.", variant: "warning"});
       return;
     }
     if (!selectedCustomer) {
       toast({ title: "Aviso", description: "Selecione um cliente primeiro.", variant: "warning"});
       return;
     }
    const product = products.find(p => p.barcode === barcodeInput);
    if (product) {
      addToCart(product, 'product');
      setBarcodeInput("");
    } else {
      toast({ title: "Produto não encontrado", description: "Código de barras não encontrado.", variant: "destructive" });
    }
  };

  const addToCart = (item, type = 'product') => {
    if (currentLoadedChargeId) {
       toast({ title: "Aviso", description: "Não é possível adicionar itens enquanto uma cobrança pendente está carregada.", variant: "warning"});
       return;
     }
     if (!selectedCustomer) {
       toast({ title: "Aviso", description: "Selecione um cliente primeiro.", variant: "warning"});
       return;
     }
    setCart(prevCart => {
        const existingItem = prevCart.find(i => i.id === item.id && i.type === type);
        let newCart;
        if (existingItem) {
          newCart = prevCart.map(i => 
            i.id === item.id && i.type === type 
              ? { ...i, quantity: i.quantity + 1, totalPrice: (i.unitPrice || i.price) * (i.quantity + 1) } 
              : i
          );
        } else {
          const unitPrice = item.price;
          newCart = [...prevCart, { ...item, quantity: 1, type, unitPrice, totalPrice: unitPrice }]; 
        }
        console.log(`[CashierPage addToCart] Novo carrinho:`, newCart);
        return newCart;
    });
  };

  const removeFromCart = (itemId, type) => {
    if (currentLoadedChargeId) {
       toast({ title: "Aviso", description: "Não é possível remover itens enquanto uma cobrança pendente está carregada.", variant: "warning"});
       return;
     }
     console.log(`[CashierPage] Removendo ${type} ${itemId} do carrinho.`);
     setCart(prevCart => prevCart.filter(i => !(i.id === itemId && i.type === type)));
  };

  const updateQuantity = (itemId, type, quantity) => {
     if (currentLoadedChargeId) {
       toast({ title: "Aviso", description: "Não é possível alterar quantidade enquanto uma cobrança pendente está carregada.", variant: "warning"});
       return;
     }
    if (quantity < 1) return;
    setCart(prevCart => {
        const newCart = prevCart.map(i => 
          i.id === itemId && i.type === type 
            ? { ...i, quantity, totalPrice: (i.unitPrice || i.price) * quantity } 
            : i
        );
        console.log(`[CashierPage updateQuantity] Novo carrinho:`, newCart);
        return newCart;
    });
  };

  const getCartTotal = () => {
    if (currentLoadedChargeId) {
        const loadedCharge = pendingCharges.find(c => c.id === currentLoadedChargeId);
        return loadedCharge?.totalAmount || 0; 
    }
    return cart.reduce((total, item) => total + (item.totalPrice || item.price * item.quantity), 0);
  };

  const handleLoadChargeToCart = async (charge) => {
    if (!charge || !charge.id) return;
    console.log(`[CashierPage] Carregando charge ${charge.id} para o carrinho...`);

    setCart([]); 
    setSelectedCustomer(null);
    setCurrentLoadedChargeId(null);

    try {
        // Idealmente, o listener traria o customer
        const customer = charge.customer || (charge.tutorId ? await Customer.get(charge.tutorId) : null);
        
        const cartItems = charge.items.map(item => ({
            id: item.itemId || item.sourceId || `item-${Math.random()}`,
            name: item.description,
            price: item.unitPrice,
            unitPrice: item.unitPrice,
            quantity: item.quantity || 1,
            totalPrice: item.totalPrice,
            type: item.itemType === 'clinic' ? 'service' : (item.itemType === 'petshop' ? 'service' : 'product'),
        }));

        setCart(cartItems);
        setSelectedCustomer(customer);
        setCurrentLoadedChargeId(charge.id);

        toast({ title: "Cobrança Carregada", description: `Itens de ${customer?.full_name || 'Cliente'} carregados.`});

    } catch(error) {
      console.error(`[CashierPage] Erro ao carregar charge ${charge.id} para o carrinho:`, error);
      toast({ title: "Erro", description: "Não foi possível carregar os detalhes desta cobrança.", variant: "destructive" });
      handleDeselectCustomerOrCharge();
    }
  };

  const handleDeselectCustomerOrCharge = () => {
      console.log("[CashierPage] Limpando carrinho e seleção.");
      setCart([]);
      setSelectedCustomer(null);
      setCurrentLoadedChargeId(null);
  };

  const handlePaymentSuccess = (/* paymentDetails */) => {
      const completedChargeId = currentLoadedChargeId;
      console.log(`[CashierPage] Pagamento concluído. Charge ID (se houver): ${completedChargeId}`);
      
      // Limpa o estado local. O listener atualizará a lista de pendentes.
      setShowPaymentDialog(false);
      setCart([]);
      setSelectedCustomer(null);
      setCurrentLoadedChargeId(null);
      
      toast({ title: "Pagamento Registrado", description: "Venda finalizada com sucesso!"});
  };

  if (isLoadingTenant) {
    return (
      <div className="flex justify-center items-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500 mr-3" />
        <span>Carregando informações da loja...</span>
      </div>
    );
  }

  if (tenantError) {
     return (
       <div className="flex flex-col justify-center items-center h-full text-center p-4">
         <h2 className="text-xl font-semibold text-red-600 mb-2">Erro ao Carregar Loja</h2>
         <p className="text-red-500 mb-4">{tenantError}</p>
         <p className="text-sm text-gray-500">Verifique a URL ou se o usuário está corretamente associado a uma loja ativa.</p>
       </div>
     );
  }

  if (!currentTenant) {
    return (
      <div className="flex flex-col justify-center items-center h-full text-center p-4">
        <h2 className="text-xl font-semibold text-orange-600 mb-2">Nenhuma Loja Selecionada</h2>
        <p className="text-gray-600 mb-4">Não foi possível identificar a loja. Verifique a URL ou faça login.</p>
      </div>
    );
  }

  if (isLoadingProducts) { 
    return (
      <div className="flex justify-center items-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500 mr-3" />
        <span>Carregando produtos e serviços...</span>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Caixa</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate('/tenant/caixa/historico')}>
            <Clock className="h-4 w-4 mr-2" />
            Histórico de Vendas
          </Button>
          <Button 
            variant="outline"
            onClick={() => {
              if (!currentTenant?.id) {
                  toast({title: "Aguarde", description: "Carregando informações da loja...", variant: "default"});
                  return; 
              }
              setShowProductForm(true);
            }}
          >
            <Plus className="h-4 w-4 mr-2" />
            Novo Produto
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="pending">
                <span className={`${pendingCharges.length > 0 ? 'text-red-600 font-semibold' : ''}`}>
                  Cobranças Pendentes
                </span>
                {pendingCharges.length > 0 && (
                   <span className="ml-2 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-red-100 bg-red-600 rounded-full">
                     {pendingCharges.length}
                   </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="products">Produtos</TabsTrigger>
              <TabsTrigger value="services">Serviços</TabsTrigger>
            </TabsList>

            <div className="mt-4">
              <TabsContent value="products">
                {console.log('[CashierPage Render] Rendering Products Tab. Filtered Products:', filteredProducts)}
                <Card>
                   <CardHeader className="flex flex-col space-y-4">
                    <div className="flex items-center gap-4">
                      <form onSubmit={handleBarcodeSubmit} className="flex-1 flex gap-2">
                        <div className="relative flex-1">
                          <Barcode className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                          <Input
                            className="pl-10"
                            placeholder="Código de barras..."
                            value={barcodeInput}
                            onChange={(e) => setBarcodeInput(e.target.value)}
                            disabled={!!currentLoadedChargeId || !selectedCustomer}
                          />
                        </div>
                        <Button type="submit" disabled={!!currentLoadedChargeId || !selectedCustomer}>
                          <Search className="h-4 w-4" />
                        </Button>
                      </form>
                    </div>
                    <Input
                      placeholder="Buscar produtos..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                     disabled={!!currentLoadedChargeId || !selectedCustomer}
                    />
                  </CardHeader>
                   <CardContent>
                    <ScrollArea className="h-[500px]">
                      <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 ${!selectedCustomer && !currentLoadedChargeId ? 'opacity-50' : ''}`}>
                        {filteredProducts.map(product => (
                          <Card
                            key={`product-${product.id}`}
                            className={`cursor-pointer hover:bg-gray-50 ${(!selectedCustomer || currentLoadedChargeId) ? 'opacity-50 cursor-not-allowed' : ''}`}
                            onClick={() => !currentLoadedChargeId && selectedCustomer && addToCart(product, 'product')}
                          >
                            <CardContent className="p-4">
                              {product.image_url && (
                                <div className="aspect-square w-full mb-4 rounded-lg overflow-hidden">
                                  <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
                                </div>
                              )}
                              <div className="font-medium">{product.name}</div>
                              <div className="text-sm text-gray-500">{product.description}</div>
                              <div className="mt-2 font-semibold text-blue-600">
                                {product.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                        {filteredProducts.length === 0 && <p className="col-span-full text-center text-gray-500 py-4">Nenhum produto encontrado ou filtro aplicado.</p>}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="services">
                {console.log('[CashierPage Render] Rendering Services Tab. Services:', services, 'Search Term:', serviceSearchTerm)}
                 <Card>
                    <CardHeader>
                    <Input
                      placeholder="Buscar serviços..."
                      value={serviceSearchTerm}
                      onChange={(e) => setServiceSearchTerm(e.target.value)}
                       disabled={!!currentLoadedChargeId || !selectedCustomer}
                    />
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-[500px]">
                      <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 ${!selectedCustomer && !currentLoadedChargeId ? 'opacity-50' : ''}`}>
                        {services
                          .filter(service => service.name.toLowerCase().includes(serviceSearchTerm.toLowerCase()))
                          .map(service => (
                            <Card
                              key={`service-${service.id}`}
                               className={`cursor-pointer hover:bg-gray-50 ${(!selectedCustomer || currentLoadedChargeId) ? 'opacity-50 cursor-not-allowed' : ''}`}
                               onClick={() => !currentLoadedChargeId && selectedCustomer && addToCart(service, 'service')}
                            >
                              <CardContent className="p-4">
                                {service.image_url && (
                                  <div className="aspect-square w-full mb-4 rounded-lg overflow-hidden">
                                    <img src={service.image_url} alt={service.name} className="w-full h-full object-cover" />
                                  </div>
                                )}
                                <div className="font-medium">{service.name}</div>
                                <div className="text-sm text-gray-500">{service.description}</div>
                                <div className="mt-2 font-semibold text-blue-600">
                                  {service.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        {services.filter(service => service.name.toLowerCase().includes(serviceSearchTerm.toLowerCase())).length === 0 && <p className="col-span-full text-center text-gray-500 py-4">Nenhum serviço encontrado ou filtro aplicado.</p>}
                      </div>
                    </ScrollArea>
                  </CardContent>
                 </Card>
              </TabsContent>

               <TabsContent value="pending">
                {console.log('[CashierPage Render] Rendering Pending Tab. Pending Charges:', pendingCharges, 'Loading:', isLoadingPendingCharges)}
                <Card>
                  <CardHeader>
                    <CardTitle>Cobranças Pendentes</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {isLoadingPendingCharges ? (
                      <div className="text-center p-8"><Loader2 className="h-6 w-6 animate-spin inline-block mr-2"/> Buscando cobranças...</div>
                    ) : pendingCharges.length === 0 ? (
                      <div className="text-center text-gray-500 p-8">Nenhuma cobrança pendente encontrada.</div>
                    ) : (
                      <ScrollArea className="h-[500px]">
                        <div className="space-y-4">
                          {pendingCharges.map((charge) => (
                            <Card key={charge.id} className={`p-4 flex items-center justify-between ${currentLoadedChargeId === charge.id ? 'border-blue-500 border-2' : ''}`}>
                              <div className="text-sm space-y-1">
                                <p><strong>Pet:</strong> {charge.petName || charge.pet?.name || 'N/A'}</p>
                                <p><strong>Cliente:</strong> {charge.customer?.full_name || 'N/A'}</p>
                                {charge.episodeId && (
                                  <p className="text-xs text-gray-600">
                                    {charge.prontuarioId ? `Prontuário: ${charge.prontuarioId} / ` : ''}
                                    Episódio: {charge.episodeId}
                                  </p>
                                )}
                                {charge.osNumber && (
                                  <p className="text-xs text-gray-600">OS: {charge.osNumber}</p>
                                )}
                                <p className="font-semibold">Total: {charge.totalAmount?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL'}) || 'N/A'}</p>
                              </div>
                              <Button 
                                size="sm" 
                                onClick={() => handleLoadChargeToCart(charge)} 
                                variant={currentLoadedChargeId === charge.id ? "secondary" : "outline"}
                              >
                                {currentLoadedChargeId === charge.id ? 'Carregado' : 'Carregar para Cobrança'}
                              </Button>
                            </Card>
                          ))}
                        </div>
                      </ScrollArea>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </div>
          </Tabs>
        </div>

        <div className="lg:col-span-4">
          <Card className="sticky top-4">
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>Caixa</CardTitle>
                {selectedCustomer ? (
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-gray-400" />
                    <span className="text-sm">{selectedCustomer.full_name}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={handleDeselectCustomerOrCharge}
                      disabled={!!currentLoadedChargeId} 
                      title={currentLoadedChargeId ? "Finalize ou cancele o pagamento pendente primeiro" : "Limpar cliente e carrinho"}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <Button onClick={() => setShowCustomerDialog(true)}>
                    <User className="h-4 w-4 mr-2" />
                    Selecionar Cliente
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {console.log('[CashierPage Render] Rendering Cart Section. Cart:', cart, 'Selected Customer:', selectedCustomer, 'Loaded Charge:', currentLoadedChargeId)}
              <ScrollArea className="h-[400px] mb-4">
                 {cart.length === 0 ? (
                  <div className="text-center text-gray-500 py-8">
                   {currentLoadedChargeId ? 'Itens da cobrança carregados abaixo.' : (selectedCustomer ? 'Adicione produtos/serviços.' : 'Selecione um cliente ou carregue uma cobrança pendente.')} 
                  </div>
                ) : (
                  <div className="space-y-4">
                    {cart.map((item, index) => (
                      <div
                        key={`${item.type}-${item.id}-${index}`}
                        className="flex items-center justify-between gap-4 p-2 border rounded-lg"
                      >
                        <div className="flex-1">
                          <p className="font-medium">{item.name}</p>
                          <p className="text-sm text-gray-500">
                            {item.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                             {item.quantity > 1 && ` x ${item.quantity} = ${(item.totalPrice || item.price * item.quantity).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL'})}`}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => updateQuantity(item.id, item.type, item.quantity - 1)}
                            disabled={!!currentLoadedChargeId}
                          >
                            -
                          </Button>
                          <span className="w-8 text-center">{item.quantity}</span>
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => updateQuantity(item.id, item.type, item.quantity + 1)}
                            disabled={!!currentLoadedChargeId}
                          >
                            +
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-red-500"
                            onClick={() => removeFromCart(item.id, item.type)}
                            disabled={!!currentLoadedChargeId}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
              
              <div className="border-t pt-4">
                <div className="flex justify-between items-center mb-4">
                  <span className="text-lg font-bold">Total:</span>
                  <span className="text-lg font-bold">
                    {getCartTotal().toLocaleString('pt-BR', {
                      style: 'currency',
                      currency: 'BRL'
                    })}
                  </span>
                </div>
                <Button
                  className="w-full"
                  size="lg"
                  disabled={cart.length === 0 || (!selectedCustomer && !currentLoadedChargeId)} 
                  onClick={() => setShowPaymentDialog(true)}
                >
                  <DollarSign className="h-4 w-4 mr-2" />
                  Finalizar Pagamento
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <CustomerDialog 
        open={showCustomerDialog} 
        onOpenChange={setShowCustomerDialog}
        onSelect={(customer) => {
          console.log("[CashierPage] Cliente selecionado via Dialog:", customer);
          handleDeselectCustomerOrCharge(); 
          setSelectedCustomer(customer);
          setShowCustomerDialog(false);
          setActiveTab('products'); 
        }}
      />

      <Dialog open={showProductForm} onOpenChange={setShowProductForm}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Novo Produto</DialogTitle>
          </DialogHeader>
          {currentTenant?.id ? (
            <ProductForm 
              onSuccess={() => {
                setShowProductForm(false);
                loadProductsAndServices(); 
              }}
              tenantId={currentTenant.id} 
              onOpenChange={setShowProductForm}
            />
          ) : (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="h-6 w-6 animate-spin mr-2" />
              <span>Carregando informações da loja...</span>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <PaymentDialog
        open={showPaymentDialog}
        onOpenChange={setShowPaymentDialog}
        cart={cart} 
        totalAmount={getCartTotal()} 
        customer={selectedCustomer}
        chargeId={currentLoadedChargeId} 
        onSuccess={handlePaymentSuccess} 
      />

      {/* Modal de remoção comentado por enquanto */}
      {/* {isRemoveServiceModalOpen && serviceToRemoveFromCart && (
        <RemoveFromQueueModal ... />
      )} */}
    </div>
  );
} 