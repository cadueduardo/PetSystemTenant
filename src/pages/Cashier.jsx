import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Product, /* Service, */ Customer, Pet } from "@/api/entities";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/components/ui/use-toast";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Loader2,
  // Barcode, // <<< Remover import não usado
  Plus,
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
// <<< Remover imports de Dialog se não usados diretamente aqui (estão nos componentes filhos?) >>>
// import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import QuickSaleModal from "../components/sales/QuickSaleModal";

export default function CashierPage() { 
  const navigate = useNavigate();
  const { currentTenant, isLoading: isLoadingTenant, error: tenantError } = useTenant();
  const [isLoadingProducts, setIsLoadingProducts] = useState(true); // Loading de produtos/serviços
  const [cart, setCart] = useState([]);
  // const [barcodeInput, setBarcodeInput] = useState(""); // <<< Remover estado não usado
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [products, setProducts] = useState([]);
  // const [filteredProducts, setFilteredProducts] = useState([]); // <<< Remover estado não usado
  // const [searchTerm, setSearchTerm] = useState(""); // <<< Remover estado não usado
  const [showCustomerDialog, setShowCustomerDialog] = useState(false);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [showProductForm, setShowProductForm] = useState(false);

  // Estado para 'charges' pendentes (será populado pelo listener)
  const [pendingCharges, setPendingCharges] = useState([]); // <<< NOVO ESTADO (inicialmente vazio)
  const [isLoadingPendingCharges, setIsLoadingPendingCharges] = useState(true); // <<< NOVO ESTADO

  // Estado para saber qual 'charge' está carregada no carrinho (singular, manter para compatibilidade ou remover depois)
  const [currentLoadedChargeId, setCurrentLoadedChargeId] = useState(null);
  // <<< NOVO ESTADO PARA IDs MÚLTIPLOS >>>
  const [currentLoadedChargeIds, setCurrentLoadedChargeIds] = useState([]); 

  // <<< NOVO ESTADO para Venda Anônima >>>
  const [isAnonymousSaleActive, setIsAnonymousSaleActive] = useState(false);

  // <<< NOVO ESTADO para controlar o modal de venda rápida >>>
  const [showQuickSaleModal, setShowQuickSaleModal] = useState(false);

  useEffect(() => {
    // <<< Só carregar produtos/serviços se o tenant estiver carregado e existir >>>
    if (!isLoadingTenant && currentTenant?.id) {
       loadProductsAndServices(); 
    } else if (!isLoadingTenant && !currentTenant) {
        // Se terminou de carregar e não tem tenant, limpa e para loading de produtos
        console.warn("[CashierPage] Tenant não carregado ou inexistente após carregamento do contexto. Não é possível carregar produtos/serviços.");
        setProducts([]);
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
        
        // <<< ORDENAR chargesData por createdAt (mais antigo primeiro) >>>
        chargesData.sort((a, b) => {
            const timeA = a.createdAt?.seconds ?? 0; // Usa 0 se createdAt ou seconds for nulo/undefined
            const timeB = b.createdAt?.seconds ?? 0;
            return timeA - timeB;
        });
        // <<< FIM DA ORDENAÇÃO >>>
        
        console.log("[CashierPage] Charges pendentes PROCESSADAS E ORDENADAS:", chargesData);
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

  // <<< DEBUG: Adicionar useEffect para monitorar isAnonymousSaleActive >>>
  useEffect(() => {
    console.log(`[CashierPage DEBUG] isAnonymousSaleActive state changed to: ${isAnonymousSaleActive}`);
  }, [isAnonymousSaleActive]);
  // <<< FIM DEBUG >>>

  // <<< Remover useEffect que filtrava produtos (não necessário mais aqui) >>>
  /* 
  useEffect(() => {
    setFilteredProducts(
      products.filter((product) =>
        product.name.toLowerCase().includes(searchTerm.toLowerCase())
      )
    );
  }, [products, searchTerm]);
  */

  const loadProductsAndServices = async () => {
    // <<< Usar isLoadingProducts aqui >>>
    setIsLoadingProducts(true); 
    try {
      // <<< A verificação do tenant já acontece antes de chamar esta função agora >>>
      // if (!currentTenant?.id) { ... } // REMOVIDO
      console.log(`[CashierPage] Carregando produtos para o tenant: ${currentTenant.id}`);
      const productsData = await Product.getAllByTenant(currentTenant.id);
      console.log("[CashierPage] Produtos carregados:", productsData);
      setProducts(productsData || []);
    } catch (error) {
      console.error("Erro ao carregar produtos:", error);
      toast({ title: "Erro", description: "Não foi possível carregar produtos.", variant: "destructive"});
      setProducts([]); // Limpa em caso de erro
    } finally {
      // <<< Usar setIsLoadingProducts aqui >>>
      setIsLoadingProducts(false); 
    }
  };

  // <<< Remover handleBarcodeSubmit (lógica agora no modal) >>>
  /*
  const handleBarcodeSubmit = (e) => {
    // ... 
  };
  */

  // <<< COMENTAR função não utilizada (causando linter error) >>>
  /* 
  const addToCart = (item, type = 'product') => {
    if (currentLoadedChargeId) {
       toast({ title: "Aviso", description: "Não é possível adicionar itens enquanto uma cobrança pendente está carregada.", variant: "warning"});
       return;
     }
     // <<< PERMITIR se for venda anônima >>>
     if (!selectedCustomer && !isAnonymousSaleActive) { 
       toast({ title: "Aviso", description: "Selecione um cliente ou inicie um Novo Pedido primeiro.", variant: "warning"});
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
  */

  const removeFromCart = (itemId, type) => {
    // MODIFICADO: Usa currentLoadedChargeIds
    if (currentLoadedChargeIds.length > 0) {
       toast({ title: "Aviso", description: "Não é possível remover itens enquanto cobranças pendentes estão carregadas.", variant: "warning"});
       return;
     }
     console.log(`[CashierPage] Removendo ${type} ${itemId} do carrinho.`);
     setCart(prevCart => prevCart.filter(i => !(i.id === itemId && i.type === type)));
  };

  const updateQuantity = (itemId, type, quantity) => {
     // MODIFICADO: Usa currentLoadedChargeIds
     if (currentLoadedChargeIds.length > 0) {
       toast({ title: "Aviso", description: "Não é possível alterar quantidade enquanto cobranças pendentes estão carregadas.", variant: "warning"});
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
    // REMOVIDO: Verificação de currentLoadedChargeId
    // Simplesmente calcula o total do estado 'cart' atual
    return cart.reduce((total, item) => total + (item.totalPrice || (item.unitPrice * item.quantity) || 0), 0);
  };

  /* // <<< COMENTADO: Função não é mais usada diretamente pela nova lógica de grupo >>>
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
        setIsAnonymousSaleActive(false); // <<< DESATIVA modo anônimo ao carregar charge >>>

        toast({ title: "Cobrança Carregada", description: `Itens de ${customer?.full_name || 'Cliente'} carregados.`});

    } catch(error) {
      console.error(`[CashierPage] Erro ao carregar charge ${charge.id} para o carrinho:`, error);
      toast({ title: "Erro", description: "Não foi possível carregar os detalhes desta cobrança.", variant: "destructive" });
      handleDeselectCustomerOrCharge();
      setIsAnonymousSaleActive(false); // <<< Garante desativação em caso de erro também >>>
    }
  };
  */

  const handleDeselectCustomerOrCharge = () => {
      console.log("[CashierPage] Limpando cliente selecionado, carrinho, IDs carregados e modo anônimo.");
      setSelectedCustomer(null);
      setCart([]);
      setCurrentLoadedChargeId(null); // Limpa singular
      setCurrentLoadedChargeIds([]); // Limpa plural
      setIsAnonymousSaleActive(false); // <<< DESATIVA modo anônimo >>>
  };

  const handlePaymentSuccess = (/* paymentDetails */) => {
    console.log("[CashierPage] Pagamento realizado com sucesso (callback). Limpando estado.");
      setCart([]);
      setSelectedCustomer(null);
      setCurrentLoadedChargeId(null);
    setCurrentLoadedChargeIds([]);
    setIsAnonymousSaleActive(false); // <<< DESATIVA modo anônimo após pagamento >>>
    setShowPaymentDialog(false);
    toast({ title: "Sucesso", description: "Pagamento registrado." });
  };

  // <<< Ajustar handleNewAnonymousOrder para ABRIR O MODAL >>>
  const handleNewAnonymousOrder = () => {
    console.log("[CashierPage] Iniciando Novo Pedido (Venda Anônima) -> Abrindo Modal.");
    handleDeselectCustomerOrCharge(); // Limpa tudo primeiro
    // Não ativa isAnonymousSaleActive ainda, só quando confirmar o modal
    setShowQuickSaleModal(true); // <<< ABRE O MODAL >>>
    // toast removido daqui, talvez mostrar no modal?
  };

  // <<< NOVA FUNÇÃO chamada pelo QuickSaleModal ao confirmar >>>
  const handleConfirmQuickSale = (itemsFromModal) => {
    console.log("[CashierPage] Confirmando itens do QuickSaleModal:", itemsFromModal);
    if (itemsFromModal && itemsFromModal.length > 0) {
      // Transforma os itens do carrinho local do modal para o formato do carrinho principal
      // (Neste caso, o formato parece ser o mesmo, mas é bom ter a transformação se precisar)
      const mainCartItems = itemsFromModal.map(item => ({
         ...item, // Mantém id, name, quantity, unitPrice, totalPrice
         type: 'product' // Assumindo que QuickSale só adiciona produtos por enquanto
      }));
      setCart(mainCartItems);
      setIsAnonymousSaleActive(true); // <<< ATIVA modo anônimo AGORA >>>
      // <<< DEBUG: Log após setar state >>>
      console.log("[CashierPage DEBUG] setIsAnonymousSaleActive(true) called inside handleConfirmQuickSale"); 
      setSelectedCustomer(null); // Garante que não há cliente selecionado
      setCurrentLoadedChargeId(null); // Garante que nenhuma charge está carregada
      setShowQuickSaleModal(false); // Fecha o modal
      toast({ title: "Itens Adicionados", description: "Itens da venda rápida carregados no caixa." });
    } else {
      console.warn("[CashierPage] QuickSaleModal confirmado sem itens.");
      setShowQuickSaleModal(false); // Fecha o modal mesmo assim
    }
  };

  // <<< NOVA FUNÇÃO PARA CARREGAR MÚLTIPLAS CHARGES >>>
  const handleLoadCustomerChargesToCart = (chargesToLoad) => {
    if (!chargesToLoad || chargesToLoad.length === 0) {
      console.warn("[CashierPage] Tentativa de carregar charges vazias.");
      return;
    }
    console.log(`[CashierPage] Carregando ${chargesToLoad.length} charges para o carrinho...`, chargesToLoad.map(c => c.id));

    // 1. Limpar estado anterior
    setCart([]);
    setSelectedCustomer(null);
    setCurrentLoadedChargeId(null); // Limpa o ID único antigo
    setCurrentLoadedChargeIds([]); // Limpa o array de IDs novo
    setIsAnonymousSaleActive(false);

    try {
      // 2. Obter cliente (da primeira charge)
      const firstCharge = chargesToLoad[0];
      const customer = firstCharge?.customer; // Assume que o listener já populou

      if (!customer && firstCharge?.tutorId) {
          console.warn(`[CashierPage] Cliente não pré-carregado para ${firstCharge.tutorId}.`);
          // Poderia tentar um Customer.get aqui, mas idealmente o listener resolve
      }

      // 3. Mapear e achatar todos os itens de todas as charges
      const allCartItems = chargesToLoad.flatMap(charge => 
        (charge.items || []).map(item => ({
          id: item.itemId || item.sourceId || `item-${Math.random()}`, // Garante um ID
          name: item.description || 'Item sem descrição',
          price: item.unitPrice, // Usado para cálculo se necessário
          unitPrice: item.unitPrice,
          quantity: item.quantity || 1,
          totalPrice: item.totalPrice, // Usa o total já calculado
          type: item.itemType === 'clinic' ? 'service' : (item.itemType === 'petshop' ? 'service' : 'product'), // Mapeia tipo
          originalChargeId: charge.id, // Guarda a charge original
          // <<< ADICIONAR IDs RELEVANTES >>>
          episodeId: charge.episodeId, 
          osNumber: charge.osNumber,
          prontuarioId: charge.prontuarioId
        }))
      );
      
      console.log("[CashierPage] Itens consolidados para o carrinho:", allCartItems);

      // 4. Atualizar estados
      setCart(allCartItems);
      setSelectedCustomer(customer);
      setCurrentLoadedChargeIds(chargesToLoad.map(c => c.id)); // Guarda TODOS os IDs

      toast({ title: "Cobranças Carregadas", description: `Itens de ${customer?.full_name || 'Cliente'} carregados para pagamento.` });

    } catch (error) {
      console.error(`[CashierPage] Erro ao carregar múltiplas charges para o carrinho:`, error);
      toast({ title: "Erro", description: "Não foi possível carregar todas as cobranças.", variant: "destructive" });
      handleDeselectCustomerOrCharge(); // Limpa tudo em caso de erro
    }
  };
  // <<< FIM NOVA FUNÇÃO >>>

  // <<< FUNÇÃO PARA RENDERIZAR A COLUNA ESQUERDA (PENDENTES) >>>
  const renderPendingChargesColumn = () => {
    if (isLoadingPendingCharges || isLoadingTenant) {
    return (
        <div className="flex justify-center items-center h-full p-4">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <span className="ml-2 text-muted-foreground">Carregando cobranças...</span>
      </div>
    );
  }

    if (!currentTenant && !isLoadingTenant) {
       return <p className="text-center text-muted-foreground p-4">Tenant não carregado. Não é possível exibir cobranças.</p>;
  }

    if (pendingCharges.length === 0) {
      return <p className="text-center text-muted-foreground p-4">Nenhuma cobrança pendente.</p>;
    }

    const groupedCharges = groupChargesByCustomer(pendingCharges);

    return (
      <div className="p-4 flex flex-col h-full">
        <h2 className="text-xl font-semibold mb-4 flex-shrink-0">Cobranças Pendentes</h2>
        <ScrollArea className="flex-grow"> 
          <div className="space-y-4"> 
            {Object.entries(groupedCharges).map(([tutorId, charges]) => {
              // Pega dados do primeiro charge para info do cliente/pet (supõe consistência)
              const firstCharge = charges[0]; 
              const customer = firstCharge?.customer;
              const pet = firstCharge?.pet;
              const customerName = customer?.name || customer?.full_name || 'Cliente Desconhecido';
              const petName = pet?.name || 'Pet não informado';
              // <<< OBTER Prontuário ID da primeira charge (se existir) >>>
              const prontuarioId = firstCharge?.prontuarioId || null; 

              // Verifica se ALGUMA charge deste grupo está carregada no caixa (usa currentLoadedChargeIds)
              const isGroupLoadedInCart = charges.some(charge => currentLoadedChargeIds.includes(charge.id));

              // Calcula o total do grupo
              const groupTotal = charges.reduce((sum, charge) => sum + (charge.totalAmount || 0), 0);

              // <<< CARD UNIFICADO POR CLIENTE >>>
  return (
                <Card key={tutorId} className={`overflow-hidden ${isGroupLoadedInCart ? 'border-blue-500 border-2' : ''}`}>
                  {/* Cabeçalho com Pet e Cliente e Prontuário */}
                  <CardHeader className="bg-muted/50 p-3 border-b">
                     <p className="text-sm font-semibold">
                        <span className="font-bold">Pet:</span> {petName}
                        {/* <<< Exibir Prontuário se existir no formato correto >>> */}
                        {prontuarioId ? ` - Prontuário: ${prontuarioId}` : ''} 
                         - <span className="font-bold">Cliente:</span> {customerName}
                     </p>
                  </CardHeader>

                  {/* Conteúdo listando CADA charge (EP/OS) */}
                  <CardContent className="p-3 text-sm space-y-2"> {/* Diminuir espaço entre itens */}
                     {/* Itera sobre CADA charge no grupo para mostrar seus detalhes */}
                     {charges.map((charge) => (
                       <div key={charge.id} className="flex justify-between items-center border-b pb-1 last:border-b-0 last:pb-0"> 
                         <div>
                           {charge.episodeId && (
                               <p><span className="font-medium">Episódio:</span> {charge.episodeId}</p>
                           )}
                           {charge.osNumber && (
                                <p><span className="font-medium">OS:</span> {charge.osNumber}</p>
                           )}
                           {!charge.episodeId && !charge.osNumber && (
                               <p>Origem Desconhecida</p>
                           )}
                              </div>
                         <div>
                            <p className="text-right font-medium">R$ {charge.totalAmount?.toFixed(2) ?? 'N/A'}</p>
                                  </div>
                                </div>
                     ))}

                      {/* Total Agrupado e Botões */}
                      <div className="pt-2 mt-1"> 
                          <div className="flex justify-between items-center mb-3">
                              <span className="font-semibold">Total Cliente:</span>
                              <span className="font-semibold text-lg">R$ {groupTotal.toFixed(2)}</span>
                              </div>
                          <div className="flex justify-end space-x-2"> 
                               {/* Botão Continuar Comprando (só aparece se o grupo estiver carregado) */} 
                               {isGroupLoadedInCart && (
                                   <Button 
                                       variant="outline"
                                       size="sm"
                                       onClick={() => { 
                                           console.log("TODO: Implementar 'Continuar Comprando' para o cliente:", tutorId);
                                           toast({ title: "Aviso", description: "Funcionalidade 'Continuar Comprando' ainda não implementada.", variant: "warning" });
                                       }} 
                                   >
                                       Continuar Comprando
                                   </Button>
                               )}
                               {/* Botão Finalizar Compra (para o grupo todo) */}
                              <Button 
                                size="sm" 
                                  // MODIFICADO: Chama a nova função passando o array 'charges'
                                  onClick={() => handleLoadCustomerChargesToCart(charges)}
                                  // Desabilita se OUTRO grupo/charge estiver carregado (usa currentLoadedChargeIds agora)
                                  disabled={currentLoadedChargeIds.length > 0 && !isGroupLoadedInCart}
                                  // Muda aparência se ESTE grupo estiver carregado
                                  variant={isGroupLoadedInCart ? "secondary" : "default"}
                              >
                                  {isGroupLoadedInCart ? 'Carregado' : 'Finalizar Compra'}
                              </Button>
                          </div>
                        </div>
                  </CardContent>
                </Card>
              );
            })}
            </div>
        </ScrollArea>
        </div>
    );
  };

  // <<< FUNÇÃO PARA RENDERIZAR A COLUNA DIREITA (CAIXA) >>>
  const renderCashierColumn = () => {
    return (
      <div className="flex flex-col h-full p-4"> 
        {/* --- SELEÇÃO DE CLIENTE E NOVO PEDIDO (flex-shrink-0) --- */}
        <div className="mb-4 flex justify-between items-center flex-shrink-0"> 
           {/* <<< REMOVER Título "Caixa" duplicado daqui >>> */}
           {/* <h2 className="text-xl font-semibold">Caixa</h2> */}
           <div className="flex items-center space-x-2 ml-auto"> {/* Use ml-auto para empurrar para a direita */} 
               {/* Mostra info do cliente OU botão de selecionar OU Venda Rápida */} 
               {selectedCustomer && !isAnonymousSaleActive ? ( 
                 <div className="flex items-center space-x-2">
                    <User className="h-5 w-5 text-muted-foreground" />
                    <span className="font-medium">{selectedCustomer.name || selectedCustomer.full_name}</span>
                    <Button
                      variant="ghost"
                      size="sm" 
                      onClick={handleDeselectCustomerOrCharge}
                      title="Limpar cliente e carrinho"
                    >
                        <X className="h-4"/>
                    </Button>
                  </div>
               ) : !isAnonymousSaleActive && !currentLoadedChargeId ? ( // Só mostra Selecionar/Novo se NÃO for anônimo e NENHUMA charge carregada
                 <> 
                  <Button onClick={() => setShowCustomerDialog(true)}>
                     <User className="mr-2 h-4 w-4" /> Selecionar Cliente
                   </Button>
                   {/* <<< BOTÃO NOVO PEDIDO >>> */} 
                   <Button variant="outline" onClick={handleNewAnonymousOrder}> 
                      <Plus className="mr-2 h-4 w-4" /> Novo Pedido
                   </Button>
                 </>
               ) : isAnonymousSaleActive ? ( 
                   <div className="flex items-center space-x-2">
                        <span className="text-sm font-medium text-blue-600">Venda Rápida</span>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={handleDeselectCustomerOrCharge} // Sair do modo anônimo
                          title="Cancelar Venda Rápida"
                         >
                            <X className="h-4 w-4 text-muted-foreground"/>
                  </Button>
                    </div>
               ) : null /* Caso de charge carregada, não mostra botões aqui */ }
           </div>
              </div>

        {/* --- CARRINHO (flex-grow e overflow) --- */}
        {/* Card usa flex-grow para ocupar espaço, overflow-hidden para conter ScrollArea */}
        <Card className="mb-4 overflow-y-auto flex flex-col max-h-[calc(100vh-250px)]"> 
           <CardHeader className="flex-shrink-0 sticky top-0 bg-background z-10"> {/* Cabeçalho fixo */}
             <CardTitle>Carrinho</CardTitle>
            </CardHeader>
           {/* CardContent usa flex-1 para ocupar espaço restante, overflow-hidden para conter ScrollArea */}
           <CardContent className="p-0 flex flex-col"> 
              {/* ScrollArea não precisa mais de flex-grow */}
             <ScrollArea className="p-4"> 
                 {cart.length === 0 ? (
                   <p className="text-center text-muted-foreground py-4">
                     {/* <<< Mensagem ajustada para modo anônimo >>> */} 
                     {!selectedCustomer && !isAnonymousSaleActive && !currentLoadedChargeId ? "Selecione um cliente, inicie um Novo Pedido ou carregue uma cobrança pendente." : 
                      isAnonymousSaleActive ? "Adicione itens para a Venda Rápida." : 
                      currentLoadedChargeId ? "Cobrança carregada. Finalize o pagamento ou use 'Continuar Comprando'." : 
                      "Adicione produtos ou serviços."}
                   </p>
                ) : (
                   <div className="space-y-2">
                     {cart.map((item, index) => {
                       const itemId = item.id || item.itemId; // Garante que temos um ID
                       return (
                         <div key={`${itemId}-${item.type}-${index}`} className="flex items-center justify-between text-sm border-b pb-1">
                           <div>
                             <p className="font-medium">{item.name || item.description}</p> 
                             {/* <<< EXIBIR IDs ABAIXO DO NOME >>> */}
                             {(item.episodeId || item.osNumber) && (
                                 <p className="text-xs text-muted-foreground">
                                   {item.episodeId && `Ep: ${item.episodeId}`}
                                   {item.episodeId && item.prontuarioId && ` (Pront: ${item.prontuarioId})`}
                                   {item.osNumber && `OS: ${item.osNumber}`}
                                 </p>
                             )}
                             {/* <<< FIM EXIBIÇÃO IDs >>> */} 
                             <p className="text-xs text-muted-foreground capitalize">{item.type === 'product' ? 'Produto' : 'Serviço'}</p>
                        </div>
                           <div className="flex items-center space-x-2">
                             <Input
                               type="number"
                               min="1"
                               value={item.quantity}
                               onChange={(e) => updateQuantity(itemId, item.type, parseInt(e.target.value))}
                               className="w-16 h-8"
                               // MODIFICADO: Usa currentLoadedChargeIds
                               disabled={currentLoadedChargeIds.length > 0}
                             />
                             <span>R$ {(item.totalPrice || (item.unitPrice * item.quantity)).toFixed(2)}</span>
                          <Button
                            variant="ghost"
                            size="icon"
                               onClick={() => removeFromCart(itemId, item.type)}
                               className="h-8 w-8"
                               // MODIFICADO: Usa currentLoadedChargeIds
                               disabled={currentLoadedChargeIds.length > 0}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                       );
                      })}
                  </div>
                )}
              </ScrollArea>
           </CardContent>
        </Card>

        {/* --- TOTAL E PAGAMENTO (flex-shrink-0) --- */}
        <div className="border-t pt-4 space-y-2 flex-shrink-0"> 
           <div className="flex justify-between text-lg font-semibold">
             <span>Total:</span>
             <span>R$ {getCartTotal().toFixed(2)}</span>
                </div>
            {/* <<< BOTÃO Cadastrar Cliente >>> */} 
           {isAnonymousSaleActive && cart.length > 0 && (
                <Button
                    variant="link" 
                    className="text-sm h-auto p-0 justify-start" 
                    onClick={() => setShowCustomerDialog(true)} // Abre o diálogo para selecionar/criar
                >
                    Cadastrar Cliente e Vincular Compra?
                </Button>
            )}
           {/* <<< DEBUG: Log final antes do botão >>> */}
           {console.log(`[CashierPage DEBUG BTN] Render Button: cart.length=${cart.length}, showPaymentDialog=${showPaymentDialog}, calculated_disabled=${cart.length === 0 || showPaymentDialog}`)}
           <Button 
             onClick={() => setShowPaymentDialog(true)} 
             className="w-full" 
             disabled={cart.length === 0 || (!selectedCustomer && !isAnonymousSaleActive) || showPaymentDialog} 
           >
             <DollarSign className="mr-2 h-4 w-4" /> Finalizar Pagamento
           </Button>
         </div>

      </div>
    );
  };

  // <<< RESTAURAR DEFINIÇÃO groupChargesByCustomer >>>
  const groupChargesByCustomer = (charges) => {
    return charges.reduce((acc, charge) => {
      const tutorId = charge.tutorId || 'unknown'; // Agrupa charges sem tutorId separadamente
      if (!acc[tutorId]) {
        acc[tutorId] = [];
      }
      acc[tutorId].push(charge);
      return acc;
    }, {});
  };
  // <<< FIM RESTAURAÇÃO >>>

  // <<< Estados de Loading e Erro ANTES do return principal >>>
  if (isLoadingTenant) {
    return (
      <div className="absolute inset-0 bg-background/80 flex items-center justify-center z-50">
          <Loader2 className="h-8 w-8 animate-spin" /> 
          <span className="ml-2">Carregando dados do tenant...</span>
      </div>
    );
  }
  if (tenantError) {
      return (
           <div className="absolute inset-0 bg-destructive/90 flex items-center justify-center z-50">
              <p className="text-destructive-foreground text-center">Erro ao carregar dados do tenant: {tenantError.message}</p>
              </div>
       );
  }
  // TODO: Adicionar verificação !currentTenant e isLoadingProducts aqui também?
  // Ou garantir que eles não causem erro se currentTenant for null brevemente?

  // <<< RENDER PRINCIPAL com colunas ajustadas >>>
  return (
    <div className="flex h-screen overflow-hidden bg-background">
        {/* Coluna Esquerda - Adicionar overflow-hidden */}
        <div className="w-full md:w-7/12 lg:w-7/12 border-r flex flex-col overflow-hidden"> 
           {renderPendingChargesColumn()} 
        </div>

        {/* Coluna Direita - Adicionar overflow-hidden */}
        <div className="w-full md:w-5/12 lg:w-5/12 flex flex-col overflow-hidden"> 
           {/* <<< Adicionar Cabeçalho da Página com Botão Histórico >>> */}
           <div className="p-4 border-b flex justify-between items-center flex-shrink-0">
               <h1 className="text-2xl font-bold">Caixa</h1>
               <Button variant="outline" onClick={() => navigate('/tenant/caixa/historico')}> 
                   {/* <Clock className="h-4 w-4 mr-2" /> Re-adicionar Clock se necessário */}
                   Histórico de Vendas
               </Button>
           </div>
           {/* <<< Chamar renderCashierColumn DENTRO de uma div que cresce >>> */}
           <div className="flex-grow overflow-hidden">
                {renderCashierColumn()} 
        </div>
      </div>

       {/* DIALOGS */}
       {showCustomerDialog && (
      <CustomerDialog 
           isOpen={showCustomerDialog}
           onClose={() => setShowCustomerDialog(false)}
           onSelectCustomer={(customer) => {
             console.log("[CashierPage] Cliente selecionado/criado via Dialog:", customer);
             // Se estava em modo anônimo, mantém o carrinho!
             // Se NÃO estava anônimo E cliente mudou, limpa tudo.
             if (!isAnonymousSaleActive && selectedCustomer && selectedCustomer.id !== customer.id) {
          handleDeselectCustomerOrCharge(); 
             }
             
             setSelectedCustomer(customer); // Define o cliente
             setIsAnonymousSaleActive(false); // Sai do modo anônimo
             setShowCustomerDialog(false); // Fecha o diálogo
             // Não limpa o carrinho aqui!
           }}
         />
       )}

       {showPaymentDialog && (selectedCustomer || isAnonymousSaleActive) && (
      <PaymentDialog
        open={showPaymentDialog}
        onOpenChange={setShowPaymentDialog}
           onClose={() => setShowPaymentDialog(false)}
           customer={isAnonymousSaleActive ? null : selectedCustomer}
        cart={cart} 
        totalAmount={getCartTotal()} 
        onSuccess={handlePaymentSuccess} 
           // MODIFICADO: Passa o array de IDs
           chargeIds={currentLoadedChargeIds}
           isAnonymousSale={isAnonymousSaleActive}
         />
       )}
        
       {showProductForm && <ProductForm onClose={() => setShowProductForm(false)} />} 

       {/* <<< RENDERIZAR O NOVO MODAL >>> */}
       <QuickSaleModal 
          isOpen={showQuickSaleModal}
          onClose={() => setShowQuickSaleModal(false)}
          onConfirm={handleConfirmQuickSale}
          products={products}
          isLoadingProducts={isLoadingProducts}
       />

       {/* Loading de Produtos (pode ser sobreposto ou dentro da coluna direita) */}
       {isLoadingProducts && (
          <div className="absolute inset-0 bg-background/60 flex items-center justify-center z-40">
              <Loader2 className="h-6 w-6 animate-spin" /> 
              <span className="ml-2">Carregando produtos...</span>
          </div>
       )}
    </div>
  );
} 