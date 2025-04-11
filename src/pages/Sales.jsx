import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Product, Service, Appointment, Pet, Customer } from "@/api/entities";
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
import { getPendingItems, clearPendingItems } from "@/api/mock/chargeableItemService";
import RemoveFromQueueModal from '@/components/queue/RemoveFromQueueModal';
import { addRemovalReason } from '@/api/mockData';

export default function SalesPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("pending");
  const [isLoading, setIsLoading] = useState(true);
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

  const [pendingAppointments, setPendingAppointments] = useState([]);
  const [isLoadingPendingList, setIsLoadingPendingList] = useState(false);

  const [isRemoveServiceModalOpen, setIsRemoveServiceModalOpen] = useState(false);
  const [serviceToRemoveFromCart, setServiceToRemoveFromCart] = useState(null);

  const [currentLoadedAppointmentId, setCurrentLoadedAppointmentId] = useState(null);
  const [pendingCarts, setPendingCarts] = useState({});

  useEffect(() => {
    loadData();
    loadPendingAppointmentsList();
  }, []);

  useEffect(() => {
    setFilteredProducts(
      products.filter((product) =>
        product.name.toLowerCase().includes(searchTerm.toLowerCase())
      )
    );
  }, [products, searchTerm]);

  useEffect(() => {
    if (currentLoadedAppointmentId && cart) {
        console.log(`[SalesPage Effect] Salvando carrinho atual para appointment ${currentLoadedAppointmentId} em pendingCarts.`, cart);
        setPendingCarts(prev => ({ ...prev, [currentLoadedAppointmentId]: cart }));
    }
  }, [cart, currentLoadedAppointmentId]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [productsData, servicesData] = await Promise.all([
        Product.list(),
        Service.list(),
      ]);

      setProducts(productsData);
      setServices(servicesData);
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os dados.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleBarcodeSubmit = (e) => {
    e.preventDefault();
    const product = products.find(p => p.barcode === barcodeInput);
    if (product) {
      addToCart(product);
      setBarcodeInput("");
    } else {
      toast({
        title: "Produto não encontrado",
        description: "Código de barras não encontrado.",
        variant: "destructive"
      });
    }
  };

  const addToCart = (item, type = 'product') => {
    setCart(prevCart => {
        const existingItem = prevCart.find(i => i.id === item.id && i.type === type);
        let newCart;
        if (existingItem) {
          newCart = prevCart.map(i => 
            i.id === item.id && i.type === type 
              ? { ...i, quantity: i.quantity + 1 } 
              : i
          );
        } else {
          newCart = [...prevCart, { ...item, quantity: 1, type }];
        }
        console.log(`[SalesPage addToCart] Novo carrinho (antes de salvar em pendingCarts):`, newCart);
        return newCart;
    });
  };

  const removeFromCart = (itemId, type) => {
    if (type === 'service') {
      const serviceItem = cart.find(i => i.id === itemId && i.type === 'service');
      if (serviceItem) {
        console.log("[SalesPage] Solicitando motivo para remover serviço do carrinho:", serviceItem);
        setServiceToRemoveFromCart(serviceItem);
        setIsRemoveServiceModalOpen(true);
      }
    } else {
      console.log(`[SalesPage] Removendo produto ${itemId} do carrinho.`);
      setCart(prevCart => {
            const newCart = prevCart.filter(i => !(i.id === itemId && i.type === type));
            console.log(`[SalesPage removeFromCart - Product] Novo carrinho (antes de salvar em pendingCarts):`, newCart);
            return newCart;
       });
    }
  };

  const handleConfirmRemoveServiceFromCart = (reason, newReason = null) => {
    if (!serviceToRemoveFromCart) return;

    let finalReason = reason;
    if (reason === '__other__' && newReason) {
      finalReason = newReason.trim();
      try {
        addRemovalReason(finalReason);
      } catch (error) {
        console.error("Erro ao salvar novo motivo de remoção do carrinho:", error);
      }
    } else if (reason === '__other__' && !newReason) {
       toast({ title: "Erro", description: "Motivo 'Outros' selecionado, mas nenhum texto foi fornecido.", variant: "destructive" });
       return;
    }

    console.log(`[SalesPage] Removendo serviço ${serviceToRemoveFromCart.id} do carrinho com motivo: ${finalReason}`);
    
    setCart(prevCart => {
        const newCart = prevCart.filter(i => !(i.id === serviceToRemoveFromCart.id && i.type === 'service'));
        console.log(`[SalesPage handleConfirmRemoveServiceFromCart] Novo carrinho (antes de salvar em pendingCarts):`, newCart);
        return newCart;
    });

    toast({ title: "Serviço Removido", description: `Serviço "${serviceToRemoveFromCart.name}" removido do carrinho. Motivo: ${finalReason}`});

    setIsRemoveServiceModalOpen(false);
    setServiceToRemoveFromCart(null);
  };

  const updateQuantity = (itemId, type, quantity) => {
    if (quantity < 1) return;
    setCart(prevCart => {
        const newCart = prevCart.map(i => 
          i.id === itemId && i.type === type 
            ? { ...i, quantity } 
            : i
        );
        console.log(`[SalesPage updateQuantity] Novo carrinho (antes de salvar em pendingCarts):`, newCart);
        return newCart;
    });
  };

  const getCartTotal = () => {
    return cart.reduce((total, item) => total + (item.price * item.quantity), 0);
  };

  const loadPendingAppointmentsList = async () => {
    console.log("[SalesPage] Carregando lista de atendimentos pendentes...");
    setIsLoadingPendingList(true);
    setPendingAppointments([]);
    try {
      const allCharges = JSON.parse(localStorage.getItem('pendingCharges') || '{}');
      const pendingIds = Object.keys(allCharges);
      console.log("[SalesPage] IDs pendentes encontrados:", pendingIds);

      if (pendingIds.length === 0) {
        setIsLoadingPendingList(false);
        return;
      }

      const appointmentDetailsPromises = pendingIds.map(async (id) => {
        try {
          const appt = await Appointment.get(id);
          if (!appt) return null;
          const [pet, customer] = await Promise.all([
            Pet.get(appt.pet_id).catch(() => null),
            Customer.get(appt.customer_id).catch(() => null)
          ]);
          return { id, appointment: appt, pet, customer };
        } catch (error) {
          console.error(`Erro ao buscar detalhes para o ID ${id}:`, error);
          try {
            await clearPendingItems(id);
            console.warn(`[SalesPage] Removido ID pendente ${id} devido a erro no carregamento.`);
          } catch (clearError) {
             console.error(`[SalesPage] Falha ao tentar limpar ID pendente ${id} após erro:`, clearError);
          }
          return null; 
        }
      });

      const results = await Promise.all(appointmentDetailsPromises);
      const validAppointments = results.filter(res => res !== null);
      
      console.log("[SalesPage] Detalhes dos atendimentos carregados:", validAppointments);
      setPendingAppointments(validAppointments);

    } catch (error) {
      console.error("[SalesPage] Erro ao carregar lista de atendimentos pendentes:", error);
      toast({ title: "Erro", description: "Não foi possível carregar os atendimentos pendentes para cobrança.", variant: "destructive" });
    } finally {
      setIsLoadingPendingList(false);
    }
  };

  const handleLoadAppointmentToCart = async (pendingAppointmentData) => {
    if (!pendingAppointmentData || !pendingAppointmentData.id) return;

    const { id: appointmentId, customer } = pendingAppointmentData;
    console.log(`[SalesPage] Carregando atendimento ${appointmentId} para o carrinho...`);

    try {
      let cartToLoad;

      if (pendingCarts[appointmentId]) {
        console.log(`[SalesPage] Encontrado carrinho salvo em pendingCarts para ${appointmentId}. Carregando...`);
        cartToLoad = pendingCarts[appointmentId];
      } else {
        console.log(`[SalesPage] Nenhum carrinho salvo em pendingCarts para ${appointmentId}. Buscando itens originais...`);
        const itemsToLoad = await getPendingItems(appointmentId);

        if (!itemsToLoad || itemsToLoad.length === 0) {
          toast({ title: "Aviso", description: "Nenhum item encontrado para este atendimento no registro de pendências.", variant: "warning" });
          cartToLoad = []; 
        } else {
           cartToLoad = itemsToLoad.map(item => {
             const itemType = item.type || (services.some(s => s.id === item.id) ? 'service' : 'product');
             return { ...item, type: itemType, quantity: item.quantity || 1 };
           });
        }
        
        console.log(`[SalesPage] Salvando carrinho inicial para ${appointmentId} em pendingCarts.`);
        setPendingCarts(prev => ({ ...prev, [appointmentId]: cartToLoad }));
      }

      console.log("[SalesPage] Definindo carrinho principal com:", cartToLoad);
      setCart(cartToLoad);
      
      if (customer) {
        setSelectedCustomer(customer);
      } else {
         console.warn(`[SalesPage] Cliente não encontrado para o atendimento ${appointmentId} nos dados pré-carregados.`);
         setSelectedCustomer(null);
      }
      
      setCurrentLoadedAppointmentId(appointmentId);
      console.log(`[SalesPage] Marcado como carregado: appointmentId ${appointmentId}`);

      toast({ title: "Atendimento Carregado", description: `Itens do atendimento de ${customer?.full_name || 'Cliente'} carregados/restaurados no carrinho.`});

      setActiveTab('products');

      loadPendingAppointmentsList();

    } catch(error) {
      console.error(`[SalesPage] Erro ao carregar itens do atendimento ${appointmentId} para o carrinho:`, error);
      toast({ title: "Erro", description: "Não foi possível carregar os itens deste atendimento para o carrinho.", variant: "destructive" });
    }
  };

  const handleDeselectCustomer = () => {
      console.log("[SalesPage] Cliente deselecionado manualmente.");
      setCart([]);
      setSelectedCustomer(null);
      setCurrentLoadedAppointmentId(null);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Vendas</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate('/tenant/vendas/historico')}>
            <Clock className="h-4 w-4 mr-2" />
            Histórico de Vendas
          </Button>
          <Button onClick={() => setShowProductForm(true)}>
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
                <span className={`${pendingAppointments.length > 0 ? 'text-red-600 font-semibold' : ''}`}>
                  Atendimentos Pendentes
                </span>
                {pendingAppointments.length > 0 && (
                   <span className="ml-2 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-red-100 bg-red-600 rounded-full">
                     {pendingAppointments.length}
                   </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="products">Produtos</TabsTrigger>
              <TabsTrigger value="services">Serviços</TabsTrigger>
            </TabsList>

            <div className="mt-4">
              <TabsContent value="products">
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
                            disabled={!selectedCustomer}
                          />
                        </div>
                        <Button type="submit" disabled={!selectedCustomer}>
                          <Search className="h-4 w-4" />
                        </Button>
                      </form>
                    </div>
                    <Input
                      placeholder="Buscar produtos..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                     disabled={!selectedCustomer}
                    />
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-[500px]">
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {filteredProducts.map(product => (
                          <Card
                            key={`product-${product.id}`}
                            className={`cursor-pointer hover:bg-gray-50 ${!selectedCustomer ? 'opacity-50 cursor-not-allowed' : ''}`}
                            onClick={() => selectedCustomer && addToCart(product, 'product')}
                          >
                            <CardContent className="p-4">
                              {product.image_url && (
                                <div className="aspect-square w-full mb-4 rounded-lg overflow-hidden">
                                  <img
                                    src={product.image_url}
                                    alt={product.name}
                                    className="w-full h-full object-cover"
                                  />
                                </div>
                              )}
                              <div className="font-medium">{product.name}</div>
                              <div className="text-sm text-gray-500">{product.description}</div>
                              <div className="mt-2 font-semibold text-blue-600">
                                {product.price.toLocaleString('pt-BR', {
                                  style: 'currency',
                                  currency: 'BRL'
                                })}
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="services">
                 <Card>
                  <CardHeader>
                    <Input
                      placeholder="Buscar serviços..."
                      value={serviceSearchTerm}
                      onChange={(e) => setServiceSearchTerm(e.target.value)}
                       disabled={!selectedCustomer}
                    />
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-[500px]">
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {services
                          .filter(service =>
                            service.name.toLowerCase().includes(serviceSearchTerm.toLowerCase())
                          )
                          .map(service => (
                            <Card
                              key={`service-${service.id}`}
                               className={`cursor-pointer hover:bg-gray-50 ${!selectedCustomer ? 'opacity-50 cursor-not-allowed' : ''}`}
                               onClick={() => selectedCustomer && addToCart(service, 'service')}
                            >
                              <CardContent className="p-4">
                                {service.image_url && (
                                  <div className="aspect-square w-full mb-4 rounded-lg overflow-hidden">
                                    <img
                                      src={service.image_url}
                                      alt={service.name}
                                      className="w-full h-full object-cover"
                                    />
                                  </div>
                                )}
                                <div className="font-medium">{service.name}</div>
                                <div className="text-sm text-gray-500">{service.description}</div>
                                <div className="mt-2 font-semibold text-blue-600">
                                  {service.price.toLocaleString('pt-BR', {
                                    style: 'currency',
                                    currency: 'BRL'
                                  })}
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              </TabsContent>

               <TabsContent value="pending">
                <Card>
                  <CardHeader>
                    <CardTitle>Atendimentos Pendentes de Cobrança</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {isLoadingPendingList ? (
                      <div className="text-center p-8"><Loader2 className="h-6 w-6 animate-spin inline-block mr-2"/> Buscando atendimentos...</div>
                    ) : pendingAppointments.length === 0 ? (
                      <div className="text-center text-gray-500 p-8">Nenhum atendimento pendente de cobrança.</div>
                    ) : (
                      <ScrollArea className="h-[500px]">
                        <div className="space-y-4">
                          {pendingAppointments.map((pa) => (
                            <Card key={pa.id} className={`p-4 flex items-center justify-between ${currentLoadedAppointmentId === pa.id ? 'border-blue-500 border-2' : ''}`}>
                              <div className="text-sm">
                                <p><strong>Pet:</strong> {pa.pet?.name || 'N/A'} ({pa.pet?.breed || 'SRD'})</p>
                                <p><strong>Cliente:</strong> {pa.customer?.full_name || 'N/A'}</p>
                                <p className="text-xs text-gray-500">ID: {pa.id}</p>
                              </div>
                              <Button 
                                size="sm" 
                                onClick={() => handleLoadAppointmentToCart(pa)}
                                variant={currentLoadedAppointmentId === pa.id ? "secondary" : "outline"}
                              >
                                {currentLoadedAppointmentId === pa.id ? 'Carregado' : 'Cobrar Atendimento'}
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
                <CardTitle>Carrinho</CardTitle>
                {selectedCustomer ? (
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-gray-400" />
                    <span className="text-sm">{selectedCustomer.full_name}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={handleDeselectCustomer}
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
              <ScrollArea className="h-[400px] mb-4">
                {cart.length === 0 ? (
                  <div className="text-center text-gray-500 py-8">
                   {selectedCustomer ? 'Carrinho vazio para este cliente.' : 'Selecione um cliente ou carregue um atendimento.'} 
                  </div>
                ) : (
                  <div className="space-y-4">
                    {cart.map((item) => (
                      <div
                        key={`${item.type}-${item.id}`}
                        className="flex items-center justify-between gap-4 p-2 border rounded-lg"
                      >
                        <div className="flex-1">
                          <p className="font-medium">{item.name}</p>
                          <p className="text-sm text-gray-500">
                            {item.price.toLocaleString('pt-BR', {
                              style: 'currency',
                              currency: 'BRL'
                            })}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => updateQuantity(item.id, item.type, item.quantity - 1)}
                          >
                            -
                          </Button>
                          <span className="w-8 text-center">{item.quantity}</span>
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => updateQuantity(item.id, item.type, item.quantity + 1)}
                          >
                            +
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-red-500"
                            onClick={() => removeFromCart(item.id, item.type)}
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
                  disabled={cart.length === 0 || !selectedCustomer}
                  onClick={() => setShowPaymentDialog(true)}
                >
                  <DollarSign className="h-4 w-4 mr-2" />
                  Finalizar Venda
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
          console.log("[SalesPage] Cliente selecionado via Dialog:", customer);
          setCart([]); 
          setSelectedCustomer(customer);
          setCurrentLoadedAppointmentId(null);
          setPendingCarts(prev => ({...prev}));
          setShowCustomerDialog(false);
          setActiveTab('products');
        }}
      />

      <ProductForm
        open={showProductForm}
        onOpenChange={setShowProductForm}
        onSuccess={() => {
          setShowProductForm(false);
          loadData();
        }}
      />

      <PaymentDialog
        open={showPaymentDialog}
        onOpenChange={setShowPaymentDialog}
        cart={cart}
        customer={selectedCustomer}
        onSuccess={() => {
          const completedAppointmentId = currentLoadedAppointmentId;
          setShowPaymentDialog(false);

          if (completedAppointmentId) {
            console.log(`[SalesPage - PaymentDialog Success] Limpando pendência e carrinho salvo para ${completedAppointmentId}`);
            clearPendingItems(completedAppointmentId)
              .then(() => {
                 console.log(`[SalesPage - PaymentDialog Success] Pendência ${completedAppointmentId} limpa com sucesso.`);
                 setPendingCarts(prev => {
                    const newState = { ...prev };
                    delete newState[completedAppointmentId];
                    console.log("[SalesPage - PaymentDialog Success] Estado pendingCarts atualizado:", newState);
                    return newState;
                 });
                 loadPendingAppointmentsList();
              })
              .catch(err => {
                 console.error(`[SalesPage - PaymentDialog Success] Erro ao limpar pendência ${completedAppointmentId}:`, err);
                 toast({ title: "Erro Pós-Venda", description: "Venda concluída, mas houve erro ao remover o atendimento da lista de pendências.", variant: "destructive"});
              });
          } else {
             console.log("[SalesPage - PaymentDialog Success] Venda finalizada sem ID de atendimento pendente associado.");
          }

          setCart([]);
          setSelectedCustomer(null);
          setCurrentLoadedAppointmentId(null);
          loadData();
        }}
      />

      {isRemoveServiceModalOpen && serviceToRemoveFromCart && (
        <RemoveFromQueueModal
          isOpen={isRemoveServiceModalOpen}
          onClose={() => {
            setIsRemoveServiceModalOpen(false);
            setServiceToRemoveFromCart(null);
          }}
          onConfirm={handleConfirmRemoveServiceFromCart}
          item={serviceToRemoveFromCart}
          isRemovingFromCart={true}
        />
      )}
    </div>
  );
}
