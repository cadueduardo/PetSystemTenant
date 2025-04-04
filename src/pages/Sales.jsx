
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Product } from "@/api/entities";
import { Customer } from "@/api/entities";
import { Service } from "@/api/entities";
import { PurchaseHistory } from "@/api/entities";
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

export default function SalesPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("products");
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
  const [showServiceForm, setShowServiceForm] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [paymentMethod, setPaymentMethod] = useState("money");

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    setFilteredProducts(
      products.filter((product) =>
        selectedCategory === "all" || product.category === selectedCategory
      ).filter((product) =>
        product.name.toLowerCase().includes(searchTerm.toLowerCase())
      )
    );
  }, [products, selectedCategory, searchTerm]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [productsData, servicesData, customersData] = await Promise.all([
        Product.list(),
        Service.list(),
        Customer.list(),
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
    const existingItem = cart.find(i => i.id === item.id && i.type === type);
    if (existingItem) {
      setCart(cart.map(i => 
        i.id === item.id && i.type === type 
          ? { ...i, quantity: i.quantity + 1 } 
          : i
      ));
    } else {
      setCart([...cart, { ...item, quantity: 1, type }]);
    }
  };

  const removeFromCart = (itemId, type) => {
    setCart(cart.filter(i => !(i.id === itemId && i.type === type)));
  };

  const updateQuantity = (itemId, type, quantity) => {
    if (quantity < 1) return;
    setCart(cart.map(i => 
      i.id === itemId && i.type === type 
        ? { ...i, quantity } 
        : i
    ));
  };

  const getCartTotal = () => {
    return cart.reduce((total, item) => total + (item.price * item.quantity), 0);
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
          <Button variant="outline" onClick={() => navigate(createPageUrl("SalesHistory"))}>
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
                          />
                        </div>
                        <Button type="submit">
                          <Search className="h-4 w-4" />
                        </Button>
                      </form>
                    </div>
                    <Input
                      placeholder="Buscar produtos..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-[500px]">
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {filteredProducts.map(product => (
                          <Card
                            key={product.id}
                            className="cursor-pointer hover:bg-gray-50"
                            onClick={() => addToCart(product, 'product')}
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
                              key={service.id}
                              className="cursor-pointer hover:bg-gray-50"
                              onClick={() => addToCart(service, 'service')}
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
                      onClick={() => setSelectedCustomer(null)}
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
                    Carrinho vazio
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
          setSelectedCustomer(customer);
          setShowCustomerDialog(false);
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
          setShowPaymentDialog(false);
          setCart([]);
          setSelectedCustomer(null);
          loadData();
        }}
      />
    </div>
  );
}
