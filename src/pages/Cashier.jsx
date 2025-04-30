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
  ShoppingBag, // Adicionar ícone para continuar comprando
  Badge
} from "lucide-react";
import CustomerDialog from "../components/sales/CustomerDialog"; 
import ProductForm from "../components/products/ProductForm"; 
import PaymentDialog from "../components/sales/PaymentDialog"; 
// import { getPendingItems, clearPendingItems } from "@/api/mock/chargeableItemService"; // <<< REMOVIDO IMPORT MOCK
// import { addRemovalReason } from '@/api/mockData'; // <<< REMOVER IMPORT MOCK

// TODO: Importar funções e tipos do Firestore quando implementar a busca real de 'charges'
// import { collection, query, where, onSnapshot, Timestamp, doc, getDoc } from 'firebase/firestore'; // <<< DESCOMENTAR IMPORTS FIRESTORE
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore'; // <<< MANTER APENAS OS USADOS AQUI
import { db } from '@/lib/firebaseConfig'; // <<< DESCOMENTAR IMPORT DB
import { useTenant } from '@/components/tenant/TenantContext'; // <<< DESCOMENTAR IMPORT
// <<< Remover imports de Dialog se não usados diretamente aqui (estão nos componentes filhos?) >>>
// import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import QuickSaleModal from "../components/sales/QuickSaleModal";
// <<< IMPORTAR MODAL DE CANCELAMENTO >>>
import CancellationReasonModal from '@/components/modal/CancellationReasonModal'; 
// Importar httpsCallable e functions
import { httpsCallable } from "firebase/functions";
import { functions } from "@/lib/firebaseConfig"; 
// <<< IMPORTAR doc, getDoc do Firestore SDK >>>
import { doc, getDoc } from 'firebase/firestore'; 
// <<< IMPORTAR UUID >>>
import { v4 as uuidv4 } from 'uuid'; 

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

  // <<< RENOMEADO: Estado para itens pendentes (charges + OS) >>>
  const [pendingItems, setPendingItems] = useState([]); 
  const [isLoadingPendingItems, setIsLoadingPendingItems] = useState(true); 

  // Estado para saber qual 'charge' está carregada no carrinho (singular, manter para compatibilidade ou remover depois)
  const [currentLoadedChargeId, setCurrentLoadedChargeId] = useState(null);
  // <<< NOVO ESTADO PARA IDs MÚLTIPLOS >>>
  const [currentLoadedChargeIds, setCurrentLoadedChargeIds] = useState([]); 

  // <<< NOVO ESTADO para Venda Anônima >>>
  const [isAnonymousSaleActive, setIsAnonymousSaleActive] = useState(false);

  // <<< NOVO ESTADO para controlar o modal de venda rápida >>>
  const [showQuickSaleModal, setShowQuickSaleModal] = useState(false);

  // <<< NOVOS ESTADOS para "Continuar Comprando" >>>
  const [activeContinuedOsId, setActiveContinuedOsId] = useState(null);
  const [isCreatingOs, setIsCreatingOs] = useState(false); 
  // <<< FIM NOVOS ESTADOS >>>

  // <<< ESTADOS PARA MODAL DE CANCELAMENTO >>>
  const [cancellationModalOpen, setCancellationModalOpen] = useState(false);
  const [itemToCancel, setItemToCancel] = useState(null);
  // <<< FIM ESTADOS MODAL >>>

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
    let unsubscribeOrderServices = () => {}; // <<< Novo unsub para OS >>>

    if (!isLoadingTenant && currentTenant?.id) {
      const tenantId = currentTenant.id;
      console.log(`[CashierPage] Tenant ${tenantId} carregado. Configurando listeners para itens pendentes...`);
      setIsLoadingPendingItems(true);
      
      // --- Listener 1: Charges Pendentes --- 
      const chargesQuery = query(
        collection(db, 'tenants', tenantId, 'charges'), 
        where('status', 'in', ['pending', 'partially_paid']),
        orderBy('createdAt', 'asc') // <<< ORDENAR POR CRIAÇÃO >>>
      );

      // --- Listener 2: Order Services Pendentes no Caixa --- 
      const osQuery = query(
        collection(db, 'tenants', tenantId, 'order_services'),
        where('status', '==', 'pending_cashier'), // <<< FILTRAR PELO STATUS CORRETO >>>
        orderBy('createdAt', 'asc')
      );

      let chargesData = [];
      let osData = [];
      let combinedError = null;

      const processCombinedData = () => {
        if (combinedError) {
            console.error("[CashierPage] Erro em um dos listeners:", combinedError);
            toast({ title: "Erro", description: "Falha ao buscar alguns itens pendentes.", variant: "destructive" });
            setPendingItems([]);
            setIsLoadingPendingItems(false);
            return;
        }
        
        // Mapear charges para formato comum
        const formattedCharges = chargesData.map(charge => ({
            ...charge,
            itemType: 'charge', 
            customerId: charge.tutorId, // Padronizar para customerId
            totalAmount: charge.totalAmount || 0, // Garantir valor
        }));
        
        // Mapear OS para formato comum
        const formattedOs = osData.map(os => ({
            ...os, 
            itemType: 'order_service',
            tutorId: os.customerId, // Mapear customerId para tutorId se necessário no agrupamento?
            totalAmount: os.totalValue || 0, // Padronizar para totalAmount
            // Adicionar outros campos se necessário (pet, etc)
        }));
        
        // Combinar e ordenar (já ordenado pelas queries, mas pode re-ordenar se necessário)
        const combinedItems = [...formattedCharges, ...formattedOs];
        combinedItems.sort((a, b) => {
            const timeA = a.createdAt?.seconds ?? 0;
            const timeB = b.createdAt?.seconds ?? 0;
            return timeA - timeB; // Mais antigo primeiro
        });
        
        console.log("[CashierPage] Itens pendentes COMBINADOS e ORDENADOS:", combinedItems);
        setPendingItems(combinedItems);
        setIsLoadingPendingItems(false);
      };

      // Iniciar listener de Charges
      unsubscribeCharges = onSnapshot(chargesQuery, async (snapshot) => {
        console.log(`[CashierPage / Charges Listener] Snapshot recebido (size: ${snapshot.size}).`);
        const fetchedCharges = await Promise.all(snapshot.docs.map(async (docSnapshot) => {
          const charge = { id: docSnapshot.id, ...docSnapshot.data() };
          let customer = null, pet = null;
          try {
            if (charge.tutorId) customer = await Customer.get(charge.tutorId);
            if (charge.petId) pet = await Pet.get(charge.petId);
          } catch (err) { console.error(`Erro ao buscar cliente/pet para charge ${charge.id}`, err); }
          return { ...charge, customer, pet };
        }));
        chargesData = fetchedCharges; // Atualiza dados das charges
        processCombinedData(); // Processa e atualiza estado combinado
      }, (error) => {
        console.error("[CashierPage / Charges Listener] Erro:", error);
        combinedError = error; // Guarda o erro
        processCombinedData(); // Processa mesmo com erro para mostrar o que conseguiu
      });

      // Iniciar listener de Order Services
      unsubscribeOrderServices = onSnapshot(osQuery, async (snapshot) => {
        console.log(`[CashierPage / OS Listener] Snapshot recebido (size: ${snapshot.size}).`);
        const fetchedOs = await Promise.all(snapshot.docs.map(async (docSnapshot) => {
          const os = { id: docSnapshot.id, ...docSnapshot.data() };
          let customer = null, pet = null;
          try {
            if (os.customerId) customer = await Customer.get(os.customerId);
            if (os.petId) pet = await Pet.get(os.petId);
          } catch (err) { console.error(`Erro ao buscar cliente/pet para OS ${os.id}`, err); }
          return { ...os, customer, pet };
        }));
        osData = fetchedOs; // Atualiza dados das OS
        processCombinedData(); // Processa e atualiza estado combinado
      }, (error) => {
        console.error("[CashierPage / OS Listener] Erro:", error);
        combinedError = error; // Guarda o erro
        processCombinedData(); // Processa mesmo com erro para mostrar o que conseguiu
      });

    } else if (!isLoadingTenant && !currentTenant) {
       console.warn("[CashierPage] Tenant não carregado. Não é possível buscar itens pendentes.");
       setIsLoadingPendingItems(false); 
       setPendingItems([]); 
    } else if (isLoadingTenant) {
        console.log("[CashierPage] Aguardando TenantContext carregar...");
        setIsLoadingPendingItems(true);
        setPendingItems([]);
    }
    
    // Função de limpeza: desinscrever ambos os listeners
    return () => {
        console.log("[CashierPage] Limpando listeners de charges e OS.");
        unsubscribeCharges();
        unsubscribeOrderServices();
    };

  }, [isLoadingTenant, currentTenant]);

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

  const removeFromCart = (cartItemIdToRemove) => {
     console.log(`[removeFromCart] Tentando remover item com cartItemId: ${cartItemIdToRemove}`);
     setCart(prevCart => {
        console.log("[removeFromCart] Carrinho ANTES do filtro:", JSON.stringify(prevCart));
        // <<< FILTRAR POR cartItemId >>>
        const filteredCart = prevCart.filter(i => i.cartItemId !== cartItemIdToRemove);
        console.log("[removeFromCart] Carrinho DEPOIS do filtro:", JSON.stringify(filteredCart));
        return filteredCart;
     });
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
      console.log("[CashierPage] Limpando cliente selecionado, carrinho, IDs carregados e modo anônimo/continuação.");
      setSelectedCustomer(null);
      setCart([]);
      setCurrentLoadedChargeId(null); // Limpa singular
      setCurrentLoadedChargeIds([]); // Limpa plural
      setIsAnonymousSaleActive(false); // <<< DESATIVA modo anônimo >>>
      setActiveContinuedOsId(null); // <<< Limpar OS ativa >>>
  };

  const handlePaymentSuccess = (/* paymentDetails */) => {
    console.log("[CashierPage] Pagamento realizado com sucesso (callback). Limpando estado.");
      setCart([]);
      setSelectedCustomer(null);
      setCurrentLoadedChargeId(null);
    setCurrentLoadedChargeIds([]);
    setIsAnonymousSaleActive(false); // <<< DESATIVA modo anônimo após pagamento >>>
    setActiveContinuedOsId(null); // <<< Limpar OS ativa >>>
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
      const mainCartItems = itemsFromModal.map(item => ({
         ...item, 
         cartItemId: uuidv4(), // <<< GERAR UUID ÚNICO >>>
         type: 'product' 
      }));
      setCart(mainCartItems);
      setIsAnonymousSaleActive(true); // <<< ATIVA modo anônimo AGORA >>>
      // <<< DEBUG: Log após setar state >>>
      console.log("[CashierPage DEBUG] setIsAnonymousSaleActive(true) called inside handleConfirmQuickSale"); 
      setSelectedCustomer(null); // Garante que não há cliente selecionado
      setCurrentLoadedChargeId(null); // Garante que nenhuma charge está carregada
      setShowQuickSaleModal(false); // Fecha o modal
      setActiveContinuedOsId(null); // <<< Limpar OS ativa >>>
      toast({ title: "Itens Adicionados", description: "Itens da venda rápida carregados no caixa." });
    } else {
      console.warn("[CashierPage] QuickSaleModal confirmado sem itens.");
      setShowQuickSaleModal(false); // Fecha o modal mesmo assim
    }
  };

  // <<< RENOMEADO E ADAPTADO: Função para carregar itens PENDENTES (charges e OS) no carrinho >>>
  const handleLoadCustomerItemsToCart = (itemsToLoad) => {
    if (!itemsToLoad || itemsToLoad.length === 0) {
      console.warn("[CashierPage] Tentativa de carregar itens vazios.");
      return;
    }
    console.log(`[CashierPage] Carregando ${itemsToLoad.length} itens pendentes para o carrinho...`, itemsToLoad.map(i => `${i.itemType}:${i.id}`));

    // 1. Limpar estado anterior (igual antes)
    setCart([]);
    setSelectedCustomer(null);
    setCurrentLoadedChargeId(null); // Ainda limpar o singular?
    setCurrentLoadedChargeIds([]); // Limpar o array de IDs
    setIsAnonymousSaleActive(false);
    setActiveContinuedOsId(null); // Garantir que nenhuma OS de caixa está ativa

    try {
      // 2. Obter cliente (da primeira charge, igual antes)
      const firstItem = itemsToLoad[0];
      const customer = firstItem?.customer;

      if (!customer && (firstItem?.customerId || firstItem?.tutorId)) {
          console.warn(`[CashierPage] Cliente não pré-carregado para ${firstItem?.customerId || firstItem?.tutorId}.`);
      }

      // 3. Mapear e achatar TODOS os itens de TODOS os documentos (charges e OS)
      const allCartItems = itemsToLoad.flatMap(doc => {
        const docType = doc.itemType; // 'charge' or 'order_service'
        const docId = doc.id;
        const itemsArray = doc.items || []; // Pegar array de itens do documento
        
        // Mapear cada item DENTRO do documento para o formato do carrinho
        return itemsArray.map(item => ({
          cartItemId: uuidv4(), // <<< GERAR UUID ÚNICO PARA CADA ITEM NO CARRINHO >>>
          id: item.itemId || item.sourceId || `item-${Math.random()}`, 
          name: item.description || 'Item sem descrição',
          price: item.unitPrice, 
          unitPrice: item.unitPrice,
          quantity: item.quantity || 1,
          totalPrice: item.totalPrice,
          type: item.itemType === 'clinic' ? 'service' : (item.itemType === 'petshop' ? 'service' : 'product'),
          originalDocumentId: docId,
          originalDocumentType: docType, 
          episodeId: docType === 'charge' ? doc.episodeId : null, 
          osNumber: doc.osNumber,
          prontuarioId: docType === 'charge' ? doc.prontuarioId : null 
        }));
      });
      
      console.log("[CashierPage] Itens consolidados para o carrinho:", allCartItems);

      // 4. Identificar os IDs dos DOCUMENTOS (charges E OS) a serem pagos
      const documentIdsToPay = itemsToLoad.map(doc => doc.id);
      console.log("[CashierPage] IDs dos documentos a serem pagos:", documentIdsToPay);
      
      // <<< SEPARAR IDs por tipo para passar ao PaymentDialog (se necessário) >>>
      const chargeIdsToPay = itemsToLoad.filter(i => i.itemType === 'charge').map(i => i.id);
      const osIdsToPay = itemsToLoad.filter(i => i.itemType === 'order_service').map(i => i.id);
      console.log("[CashierPage] Charge IDs:", chargeIdsToPay, "OS IDs:", osIdsToPay);
      // <<< FIM SEPARAÇÃO >>>

      // 5. Atualizar estados
      setCart(allCartItems); 
      setSelectedCustomer(customer);
      // <<< ATUALIZAR currentLoadedChargeIds com TODOS os IDs de documentos >>>
      setCurrentLoadedChargeIds(documentIdsToPay);
      // O PaymentDialog precisará ser ajustado para receber os osIds também

      toast({ title: "Itens Carregados", description: `Itens de ${customer?.full_name || 'Cliente'} carregados para pagamento.` });

    } catch (error) {
      console.error(`[CashierPage] Erro ao carregar itens pendentes para o carrinho:`, error);
      toast({ title: "Erro", description: "Não foi possível carregar todos os itens pendentes.", variant: "destructive" });
      handleDeselectCustomerOrCharge(); // Limpa tudo em caso de erro
    }
  };
  // <<< FIM FUNÇÃO RENOMEADA E ADAPTADA >>>

  // <<< AJUSTADO: Função para lidar com 'Continuar Comprando' >>>
  const handleContinueShopping = async (customerId, customerPendingItems) => { // <<< Recebe itens pendentes do cliente >>>
    if (!customerId) {
      toast({ title: "Erro", description: "ID do cliente não encontrado para iniciar a OS.", variant: "destructive" });
      return;
    }
    if (isCreatingOs) return; // Prevenir cliques múltiplos

    console.log(`[CashierPage] Iniciando fluxo 'Continuar Comprando' para cliente ${customerId}`);
    
    // <<< VERIFICAR SE JÁ EXISTE OS PENDENTE >>>
    const existingPendingOs = customerPendingItems?.find(item => 
        item.itemType === 'order_service' && item.status === 'pending_cashier'
    );

    if (existingPendingOs) {
        console.log(`[CashierPage] Encontrada OS de caixa pendente existente: ${existingPendingOs.id}. Reabrindo modal.`);
        setActiveContinuedOsId(existingPendingOs.id); // Usa o ID existente
        setShowQuickSaleModal(true); // Abre o modal
        // Não chama o backend para criar nova OS
    } else {
        console.log(`[CashierPage] Nenhuma OS de caixa pendente encontrada para ${customerId}. Criando nova...`);
        setIsCreatingOs(true);
        try {
          const createOsFunction = httpsCallable(functions, 'createContinuedOrderService');
          const result = await createOsFunction({ customerId: customerId });
          
          console.log("[CashierPage] Resultado da função 'createContinuedOrderService':", result.data);
    
          if (result.data && result.data.success === true && result.data.osId) { 
              setActiveContinuedOsId(result.data.osId); // Guarda o ID da OS criada
              toast({ title: "OS Criada", description: `OS ${result.data.osNumber} criada. Adicione itens.` });
              setShowQuickSaleModal(true); // Abre o modal de seleção de produtos/serviços
          } else {
              throw new Error(result.data?.message || "Falha ao criar OS no backend.");
          }
    
        } catch (error) {
          console.error("[CashierPage] Erro ao chamar função createContinuedOrderService:", error);
          const errorMessage = error.details?.originalError || error.message || "Não foi possível criar a OS.";
          toast({
            title: "Erro ao Continuar",
            description: errorMessage,
            variant: "destructive"
          });
          setActiveContinuedOsId(null); // Limpa em caso de erro
        } finally {
          setIsCreatingOs(false);
        }
    }
  };
  // <<< FIM FUNÇÃO AJUSTADA >>>

  // <<< RENOMEADO: FUNÇÃO PARA RENDERIZAR A COLUNA ESQUERDA (PENDENTES) >>>
  const renderPendingItemsColumn = () => {
    // <<< RENOMEADO: Usar isLoadingPendingItems >>>
    if (isLoadingPendingItems || isLoadingTenant) {
    return (
        <div className="flex justify-center items-center h-full p-4">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          {/* <<< Mensagem ajustada >>> */}
          <span className="ml-2 text-muted-foreground">Carregando itens pendentes...</span>
      </div>
    );
  }

    if (!currentTenant && !isLoadingTenant) {
       return <p className="text-center text-muted-foreground p-4">Tenant não carregado. Não é possível exibir itens pendentes.</p>;
  }

    // <<< RENOMEADO: Usar pendingItems >>>
    if (pendingItems.length === 0) {
      return <p className="text-center text-muted-foreground p-4">Nenhum item pendente.</p>;
    }

    // <<< RENOMEADO: Usar groupPendingItemsByCustomer >>>
    const groupedItems = groupPendingItemsByCustomer(pendingItems);

    return (
      <div className="p-4 flex flex-col h-full">
        <h2 className="text-xl font-semibold mb-4 flex-shrink-0">Itens Pendentes</h2>
        <ScrollArea className="flex-grow">
          <div className="space-y-4">
            {/* A lógica interna de renderização do card precisará ser ajustada depois */}
            {Object.entries(groupedItems).map(([customerId, items]) => {
              const firstItem = items[0];
              const customer = firstItem?.customer;
              const pet = firstItem?.pet;
              const customerName = customer?.name || customer?.full_name || 'Cliente Desconhecido';
              const petName = pet?.name || 'Pet não informado';
              const prontuarioId = firstItem?.prontuarioId || null;
              // Ajustar lógica de isGroupLoadedInCart e groupTotal depois
              const isGroupLoadedInCart = items.some(item => currentLoadedChargeIds.includes(item.id));
              const groupTotal = items.reduce((sum, item) => sum + (item.totalAmount || 0), 0);

              return (
                <Card key={customerId} className={`overflow-hidden ${isGroupLoadedInCart ? 'border-blue-500 border-2' : ''}`}>
                  <CardHeader className="bg-muted/50 p-3 border-b">
                     <p className="text-sm font-semibold">
                        <span className="font-bold">Pet:</span> {petName}
                        {prontuarioId ? ` - Prontuário: ${prontuarioId}` : ''}
                         - <span className="font-bold">Cliente:</span> {customerName}
                     </p>
                  </CardHeader>
                  <CardContent className="p-3 text-sm space-y-2">
                     {items.map((item) => (
                       <div key={item.id} className="flex justify-between items-center border-b pb-1 last:border-b-0 last:pb-0">
                         <div className="flex items-center space-x-2"> {/* Adicionado flex container */} 
                           {/* Lógica de Exibição Refinada */}
                           {item.itemType === 'charge' && item.episodeId && (
                               <>
                                 {/* TODO: Adicionar ícone para Clínica? */}
                                 <p><span className="font-medium">Episódio:</span> {item.episodeId}</p>
                               </>
                           )}
                           {item.itemType === 'charge' && item.osNumber && (
                               <>
                                 {/* TODO: Adicionar ícone para Petshop? */}
                                 <p><span className="font-medium">OS (Serviço):</span> {item.osNumber}</p>
                               </>
                           )}
                           {item.itemType === 'order_service' && (
                               <>
                                 {/* TODO: Adicionar ícone para Caixa? */}
                                 <p><span className="font-medium">OS (Caixa):</span> {item.osNumber}</p>
                                 {/* <<< DESTAQUE SE FOR A OS ATIVA >>> */}
                                 {item.id === activeContinuedOsId && (
                                     <Badge variant="outline" className="ml-1 px-1.5 py-0.5 text-xs h-auto">Editando</Badge>
                                 )}
                               </>
                           )}
                           {item.itemType === 'charge' && !item.episodeId && !item.osNumber && (
                               <p>Cobrança Direta</p> // Manter por segurança, mas talvez inalcançável
                           )}
                         </div>
                         <div>
                            <p className="text-right font-medium">R$ {item.totalAmount?.toFixed(2) ?? 'N/A'}</p>
                         </div>
                       </div>
                     ))}
                      <div className="pt-2 mt-1">
                          <div className="flex justify-between items-center mb-3">
                              <span className="font-semibold">Total Cliente:</span>
                              <span className="font-semibold text-lg">R$ {groupTotal.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-end space-x-2">
                               {/* Botão Continuar Comprando (Lógica OK) */}
                               {isGroupLoadedInCart && (
                                   <Button
                                       variant="outline"
                                       size="sm"
                                       // <<< Passar customerId e items para o handler >>>
                                       onClick={() => handleContinueShopping(customerId, items)} 
                                       disabled={isCreatingOs} 
                                   >
                                       {isCreatingOs ? (
                                           <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                                       ) : (
                                           <ShoppingBag className="h-4 w-4 mr-1" />
                                       )}
                                       Continuar Comprando
                                   </Button>
                               )}
                               {/* Botão Finalizar Compra */}
                              <Button
                                size="sm"
                                  // <<< CHAMAR FUNÇÃO RENOMEADA >>>
                                  onClick={() => handleLoadCustomerItemsToCart(items)} 
                                  disabled={currentLoadedChargeIds.length > 0 && !isGroupLoadedInCart}
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
                     {cart.map((item) => {
                       return (
                         <div key={item.cartItemId} className="flex items-center justify-between text-sm border-b pb-1">
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
                               onChange={(e) => updateQuantity(item.cartItemId, item.type, parseInt(e.target.value))}
                               className="w-16 h-8"
                               disabled={currentLoadedChargeIds.length > 0}
                             />
                             <span>R$ {(item.totalPrice || (item.unitPrice * item.quantity)).toFixed(2)}</span>
                             <Button
                               variant="ghost"
                               size="icon"
                               onClick={() => {
                                   if (item.originalDocumentType === 'charge') {
                                       handleOpenCancellationModal(item);
                                   } else {
                                       removeFromCart(item.cartItemId);
                                   }
                               }}
                               className="h-8 w-8"
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

  // <<< RENOMEADO: groupChargesByCustomer >>>
  const groupPendingItemsByCustomer = (items) => {
    return items.reduce((acc, item) => {
      // Usar customerId como chave padronizada
      const customerIdKey = item.customerId || item.tutorId || 'unknown'; 
      if (!acc[customerIdKey]) {
        acc[customerIdKey] = [];
      }
      acc[customerIdKey].push(item);
      return acc;
    }, {});
  };
  
  // Função para verificar/deletar OS vazia
  const checkAndDeleteEmptyOs = async (osId) => {
    if (!osId) return;
    console.log(`[CashierPage] Verificando OS ${osId} para possível exclusão.`);

    const tenantId = localStorage.getItem('current_tenant');
    if (!tenantId) {
        console.error("[CashierPage] Tenant ID não encontrado no localStorage ao verificar OS vazia!");
        return;
    }

    try {
      const osDocRef = doc(db, 'tenants', tenantId, 'order_services', osId);
      const osDocSnap = await getDoc(osDocRef);

      if (osDocSnap.exists()) {
        const osData = osDocSnap.data();
        if (osData.items && osData.items.length === 0) {
          console.log(`[CashierPage] OS ${osId} está vazia. Preparando para chamar função de exclusão.`);
          
          // <<< DESCOMENTAR CHAMADA DA FUNÇÃO BACKEND >>>
          const deleteEmptyOs = httpsCallable(functions, 'deleteEmptyCashierOs');
          try {
            const result = await deleteEmptyOs({ osId: osId }); // <<< Passar osId no payload >>>
            console.log(`[CashierPage] Função deleteEmptyCashierOs chamada. Resultado:`, result.data);
            if (result.data?.deleted) {
                 toast({ title: "OS Removida", description: "A ordem de serviço iniciada e não utilizada foi removida." });
            } else {
                // Log opcional se não deletou (ex: não estava vazia no backend)
                 console.log(`[CashierPage] Backend reportou que OS ${osId} não foi deletada (motivo: ${result.data?.message})`);
            }
          } catch (error) {
            console.error(`[CashierPage] Erro ao chamar deleteEmptyCashierOs para OS ${osId}:`, error);
            toast({ title: "Erro", description: "Falha ao tentar remover OS vazia.", variant: "destructive" });
          }
          // <<< FIM DESCOMENTAR >>>

        } else {
          console.log(`[CashierPage] OS ${osId} contém itens ou não existe mais. Nenhuma ação de exclusão necessária.`);
        }
      } else {
        console.warn(`[CashierPage] OS ${osId} não encontrada ao verificar para exclusão.`);
      }
    } catch (error) {
      console.error(`[CashierPage] Erro ao verificar OS ${osId} para exclusão:`, error);
    }
  };

  // Função wrapper para onClose do Modal 
  const handleCloseQuickSaleModal = () => {
    console.log("[CashierPage] Fechando QuickSaleModal.");
    setShowQuickSaleModal(false);
    // Se estávamos no modo "Continuar Comprando", verificar se a OS ficou vazia
    if (activeContinuedOsId) {
        checkAndDeleteEmptyOs(activeContinuedOsId);
        setActiveContinuedOsId(null); // Limpar o ID ativo após fechar
    }
  };
  // <<< FIM FUNÇÃO WRAPPER >>>

  // <<< FUNÇÃO PLACEHOLDER para abrir modal de cancelamento >>>
  const handleOpenCancellationModal = (item) => {
      console.log("[CashierPage] Abrir modal de cancelamento para o item:", item);
      setItemToCancel(item); // Guarda o item que será cancelado
      setCancellationModalOpen(true); // Abre o modal
      // <<< REMOVER TOAST PLACEHOLDER >>>
      // toast({ title: "Ação Necessária", description: `É preciso um motivo para cancelar o item '${item.name}'. (Modal ainda não implementado)`, variant: "warning", duration: 5000 });
  };
  // <<< FIM FUNÇÃO PLACEHOLDER >>>

  // <<< NOVA FUNÇÃO para confirmar o cancelamento (chamada pelo modal) >>>
  // <<< AJUSTADO: Recebe itemIdentifier (id original) em vez de cartItemId >>>
  const handleConfirmCancellation = async (itemIdentifier, originalDocumentId, reason) => {
    console.log(`[CashierPage] Confirmando cancelamento do item ${itemIdentifier} (Charge: ${originalDocumentId}) com motivo: ${reason}`);

    // <<< TODO: IMPLEMENTAR CHAMADA PARA CLOUD FUNCTION 'cancelChargeItem' >>>
    try {
      console.log(`[CashierPage] Chamando função 'cancelChargeItem'...`);
      const cancelFunction = httpsCallable(functions, 'cancelChargeItem');
      const result = await cancelFunction({ 
          chargeId: originalDocumentId, 
          itemId: itemIdentifier, 
          reason: reason 
      });
      console.log(`[CashierPage] Resultado da função 'cancelChargeItem':`, result.data);

      // <<< AJUSTADO: Remover o item VISUALMENTE do carrinho usando o cartItemId do estado >>>
      if (itemToCancel && itemToCancel.cartItemId) {
          removeFromCart(itemToCancel.cartItemId);
      } else {
          console.warn("[CashierPage] Não foi possível remover o item do carrinho visualmente após cancelamento (cartItemId não encontrado).", itemToCancel);
      }

      toast({ title: "Item Removido", description: `O item "${itemToCancel?.name}" foi removido do carrinho. O cancelamento será processado.` });
      
      // Não precisa fechar o modal aqui, o próprio modal faz isso em caso de sucesso
      // setCancellationModalOpen(false); // O modal se fecha via onClose
      // setItemToCancel(null); // handleCloseCancellationModal faz isso

    } catch (error) {
      // <<< CÓDIGO DE ERRO RESTAURADO >>>
      console.error(`[CashierPage] Erro ao tentar cancelar item ${itemIdentifier} via backend:`, error);
      // Exibir o erro para o usuário
      toast({ 
        title: "Erro no Cancelamento", 
        description: error.message || "Não foi possível processar o cancelamento no momento.", 
        variant: "destructive" 
      });
      // NÃO remover do carrinho visualmente se o backend falhar
      // Re-lançar o erro para que o modal não feche automaticamente
      throw error;
      // <<< FIM CÓDIGO DE ERRO RESTAURADO >>>
    }
    // <<< FIM TODO >>>
  };
  // <<< FIM NOVA FUNÇÃO >>>

  // <<< NOVA FUNÇÃO para fechar o modal de cancelamento >>>
  const handleCloseCancellationModal = () => {
    setCancellationModalOpen(false);
    setItemToCancel(null);
  };
  // <<< FIM NOVA FUNÇÃO >>>

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
           {renderPendingItemsColumn()} 
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

       {/* <<< RENDERIZAR MODAL com props ajustadas >>> */}
       <QuickSaleModal 
          isOpen={showQuickSaleModal}
          // MODIFICADO: Usa o novo handler para onClose
          onClose={handleCloseQuickSaleModal} 
          // MANTIDO: onConfirm ainda é usado para o modo "Novo Pedido"
          onConfirm={handleConfirmQuickSale} 
          products={products}
          isLoadingProducts={isLoadingProducts}
          // NOVO: Passa o ID da OS ativa (será null no modo "Novo Pedido")
          targetOsId={activeContinuedOsId} 
       />

       {/* Loading de Produtos (pode ser sobreposto ou dentro da coluna direita) */}
       {isLoadingProducts && (
          <div className="absolute inset-0 bg-background/60 flex items-center justify-center z-40">
              <Loader2 className="h-6 w-6 animate-spin" /> 
              <span className="ml-2">Carregando produtos...</span>
          </div>
       )}

       {/* <<< RENDERIZAR MODAL DE CANCELAMENTO >>> */} 
       <CancellationReasonModal
           isOpen={cancellationModalOpen}
           onClose={handleCloseCancellationModal}
           // <<< AJUSTADO: Passar o id original do item (item.id) na chamada onConfirm >>>
           onConfirm={(originalItemIdFromModal, originalDocId, cancelReason) => {
                // A função onConfirm do modal agora passa o ID original do item diretamente.
                // A função handleConfirmCancellation espera este ID.
                // Não precisamos mais pegar de itemToCancel.id aqui.
                return handleConfirmCancellation(originalItemIdFromModal, originalDocId, cancelReason);
            }}
           item={itemToCancel}
       />
    </div>
  );
} 