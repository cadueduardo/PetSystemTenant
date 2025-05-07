import { useState, useEffect, useCallback, useMemo } from "react";
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
  Badge,
  RefreshCcw
} from "lucide-react";
import CustomerDialog from "../components/sales/CustomerDialog"; 
import ProductForm from "../components/products/ProductForm"; 
import PaymentDialog from "../components/sales/PaymentDialog"; 
// import { getPendingItems, clearPendingItems } from "@/api/mock/chargeableItemService"; // <<< REMOVIDO IMPORT MOCK
// import { addRemovalReason } from '@/api/mockData'; // <<< REMOVER IMPORT MOCK

// TODO: Importar funções e tipos do Firestore quando implementar a busca real de 'charges'
import { collection, query, where, /* onSnapshot, */ /* Timestamp, */ doc, getDoc, getDocs, orderBy, deleteDoc } from 'firebase/firestore'; // <<< REMOVER onSnapshot e Timestamp >>>
import { db } from '@/lib/firebaseConfig'; // <<< DESCOMENTAR IMPORT DB
import { useTenant } from '@/components/tenant/TenantContext'; // <<< DESCOMENTAR IMPORT
// <<< Remover imports de Dialog se não usados diretamente aqui (estão nos componentes filhos?) >>>
import QuickSaleModal from "../components/sales/QuickSaleModal";
// <<< IMPORTAR MODAL DE CANCELAMENTO >>>
import CancellationReasonModal from '@/components/modal/CancellationReasonModal'; 
// Importar httpsCallable e functions
import { httpsCallable } from "firebase/functions";
import { functions } from "@/lib/firebaseConfig"; 
import { v4 as uuidv4 } from 'uuid'; 

// <<< ADICIONAR Função Debounce >>>
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

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

  // <<< NOVO ESTADO PARA IDs de OS carregadas >>>
  const [currentLoadedOsIds, setCurrentLoadedOsIds] = useState([]);

  // <<< Definir constante Debounce >>>
  const DEBOUNCE_DELAY = 1500; // 1.5 segundos

  useEffect(() => {
    if (!isLoadingTenant && currentTenant?.id) {
       loadProductsAndServices();
    } else if (!isLoadingTenant && !currentTenant) {
        console.warn("[CashierPage] Tenant não carregado ou inexistente após carregamento do contexto. Não é possível carregar produtos/serviços.");
        setProducts([]);
        setIsLoadingProducts(false);
    }
  }, [isLoadingTenant, currentTenant]);

  // <<< REMOVIDO: useEffect com onSnapshot >>>
  /*
  useEffect(() => {
    let unsubscribeCharges = () => {};
    let unsubscribeOrderServices = () => {};

    if (!isLoadingTenant && currentTenant?.id) {
       // ... lógica onSnapshot ...
    }
    
    return () => {
        console.log("[CashierPage] Limpando listeners de charges e OS.");
        unsubscribeCharges();
        unsubscribeOrderServices();
    };

  }, [isLoadingTenant, currentTenant]);
  */
  
  // <<< NOVA FUNÇÃO fetchPendingItems >>>
  const fetchPendingItems = useCallback(async () => {
      if (!currentTenant?.id) {
          console.log("[fetchPendingItems] Abortado: Tenant ID não disponível.");
          setIsLoadingPendingItems(false); // Garantir que o loading pare se não houver tenant
          setPendingItems([]); // Limpar itens
          return []; // <<< RETORNAR ARRAY VAZIO EM CASO DE ERRO >>>
      }
      
      const tenantId = currentTenant.id;
      console.log(`[fetchPendingItems] Iniciando busca para tenant ${tenantId}...`);
      setIsLoadingPendingItems(true);
      setPendingItems([]); // Limpar antes de buscar
      
      try {
          // --- Query 1: Charges Pendentes ---
          const chargesQuery = query(
              collection(db, 'tenants', tenantId, 'charges'),
              where('status', 'in', ['pending', 'partially_paid']),
              orderBy('createdAt', 'asc')
          );
          const chargesSnapshot = await getDocs(chargesQuery);
          console.log(`[fetchPendingItems] Charges encontradas: ${chargesSnapshot.size}`);
          const chargesData = await Promise.all(chargesSnapshot.docs.map(async (docSnapshot) => {
              const charge = { id: docSnapshot.id, ...docSnapshot.data() };
              let customer = null, pet = null;
              // <<< INÍCIO: Buscar Itens da Subcoleção >>>
              let chargeItemsData = [];
              try {
                  const itemsCollectionRef = collection(db, 'tenants', tenantId, 'charges', charge.id, 'charge_items');
                  const itemsSnapshot = await getDocs(itemsCollectionRef);
                  chargeItemsData = itemsSnapshot.docs.map(itemDoc => ({
                      // Incluir o ID do DOCUMENTO do item, crucial para cancelamento
                      chargeItemDocId: itemDoc.id, 
                      ...itemDoc.data() 
                  }));
                  console.log(`[fetchPendingItems] Charge ${charge.id}: Found ${chargeItemsData.length} items in subcollection.`);
              } catch (itemsError) {
                  console.error(`Erro ao buscar itens para charge ${charge.id}`, itemsError);
                  // Continuar mesmo se itens falharem? Ou tratar o erro? Decidi continuar.
              }
              // <<< FIM: Buscar Itens da Subcoleção >>>

              try {
                  if (charge.tutorId) customer = await Customer.get(charge.tutorId);
                  if (charge.petId) pet = await Pet.get(charge.petId);
              } catch (err) { console.error(`Erro ao buscar cliente/pet para charge ${charge.id}`, err); }
              return { 
                  ...charge, 
                  // <<< SUBSTITUIR items antigos pelos da subcoleção >>>
                  items: chargeItemsData, // Armazenar os itens buscados aqui
                  customer, 
                  pet,
                  itemType: 'charge',
                  customerId: charge.tutorId, // Padronizar
                  // <<< O totalAmount agora é lido direto da charge pai (atualizado pelo backend) >>>
                  totalAmount: charge.totalAmount || 0, 
              };
          }));
          
          // --- Query 2: Order Services Pendentes no Caixa ---
          const osQuery = query(
              collection(db, 'tenants', tenantId, 'order_services'),
              where('status', '==', 'pending_cashier'),
              orderBy('createdAt', 'asc')
          );
          const osSnapshot = await getDocs(osQuery);
          console.log(`[fetchPendingItems] OS Pendentes no Caixa encontradas: ${osSnapshot.size}`);
          const osData = await Promise.all(osSnapshot.docs.map(async (docSnapshot) => {
              const os = { id: docSnapshot.id, ...docSnapshot.data() };
              let customer = null;

              // <<< INÍCIO: Buscar itens da subcoleção os_items >>>
              let osItemsData = [];
              try {
                  const itemsCollectionRef = collection(db, 'tenants', tenantId, 'order_services', os.id, 'os_items');
                  const itemsSnapshot = await getDocs(itemsCollectionRef);
                  osItemsData = itemsSnapshot.docs.map(itemDoc => ({ 
                      osItemId: itemDoc.id, // Guardar ID do documento do item
                      ...itemDoc.data() 
                  }));
                  console.log(`[fetchPendingItems] OS ${os.id} - Itens da subcoleção (${osItemsData.length}):`, osItemsData);
              } catch (err) {
                  console.error(`[fetchPendingItems] Erro ao buscar itens da subcoleção para OS ${os.id}:`, err);
                  // Continuar mesmo se falhar em buscar itens?
              }
              // <<< FIM: Buscar itens da subcoleção os_items >>>

              if (os.customerId) {
                try {
                  const customerDocRef = doc(db, 'tenants', tenantId, 'customers', os.customerId);
                  const customerDoc = await getDoc(customerDocRef);
                  if (customerDoc.exists()) {
                    customer = { id: customerDoc.id, ...customerDoc.data() };
                  }
                } catch (err) {
                  console.error(`[fetchPendingItems] Erro ao buscar cliente ${os.customerId} para OS ${os.id}:`, err);
                }
              }
              // <<< INÍCIO: Calcular Total da OS a partir dos itens >>>
              const calculatedOsTotal = osItemsData.reduce((sum, item) => sum + (item.totalPrice || 0), 0);
              // <<< FIM: Calcular Total da OS >>>
              
              // <<< Incluir itens da subcoleção e TOTAL CALCULADO no objeto retornado >>>
              return { 
                  ...os, 
                  customer, 
                  items: osItemsData, 
                  itemType: 'order_service', 
                  // <<< USAR TOTAL CALCULADO >>>
                  totalAmount: calculatedOsTotal 
              }; 
          }));

          // Combinar e ordenar
          const combinedItems = [...chargesData, ...osData];
          combinedItems.sort((a, b) => {
              const timeA = a.createdAt?.seconds ?? 0;
              const timeB = b.createdAt?.seconds ?? 0;
              return timeA - timeB; // Mais antigo primeiro
          });

          console.log("[fetchPendingItems] Itens pendentes COMBINADOS e ORDENADOS:", combinedItems);
          setPendingItems(combinedItems);
          return combinedItems; // <<< RETORNAR A LISTA COMBINADA >>>

      } catch (error) {
          console.error("[fetchPendingItems] Erro ao buscar itens pendentes:", error);
          toast({ title: "Erro", description: "Falha ao buscar itens pendentes.", variant: "destructive" });
          setPendingItems([]); // Limpar em caso de erro
          setIsLoadingPendingItems(false);
          return []; // <<< RETORNAR ARRAY VAZIO EM CASO DE ERRO >>>
      } finally {
          setIsLoadingPendingItems(false); // <<< MOVIDO PARA FINALLY >>>
      }
  }, [currentTenant]); // <<< REMOVIDO setPendingItems, setIsLoadingPendingItems da lista de dependências (se estiverem lá) >>>

  // <<< NOVO useEffect para chamar fetchPendingItems na montagem >>>
  useEffect(() => {
    if (!isLoadingTenant && currentTenant?.id) {
        console.log("[CashierPage Mount] Tenant carregado, chamando fetchPendingItems pela primeira vez.");
        fetchPendingItems();
    } else {
        console.log("[CashierPage Mount] Aguardando tenant carregar ou tenant não encontrado.");
        // Garante que o estado inicial de loading esteja correto se não houver tenant
        if (!isLoadingTenant && !currentTenant) {
            setIsLoadingPendingItems(false);
            setPendingItems([]);
        }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoadingTenant, currentTenant]); // <<< Depender SÓ de isLoadingTenant e currentTenant para rodar quando o tenant mudar/carregar >>>
  // Não incluir fetchPendingItems aqui para evitar loop se ele se recriar

  const loadProductsAndServices = async () => {
    // <<< Usar isLoadingProducts aqui >>>
    setIsLoadingProducts(true); 
    try {
      // <<< A verificação do tenant já acontece antes de chamar esta função agora >>>
      // if (!currentTenant?.id) { ... } // REMOVIDO
      console.log(`[CashierPage] Carregando produtos para o tenant: ${currentTenant.id}`);
      const productsResponse = await Product.getAllByTenant(currentTenant.id); // RENAMED to productsResponse
      // console.log("[CashierPage] Produtos carregados:", productsData); // Log anterior
      console.log("[CashierPage] Resposta de Produtos:", productsResponse); // Log da resposta completa
      setProducts(productsResponse.products || []); // CORRECTED: Extract products array
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
    // <<< ADICIONADO: Chamar fetch para atualizar a lista de pendentes >>>
    fetchPendingItems(); 
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
  const handleLoadCustomerItemsToCart = async (itemsToLoadFromState) => {
    // <<< TODO: Adicionar consulta final getDocs aqui >>>
    const firstItemFromState = itemsToLoadFromState?.[0];
    const customerId = firstItemFromState?.customerId || firstItemFromState?.tutorId;

    if (!customerId) {
       console.error("[handleLoadCustomerItemsToCart] ID do cliente não encontrado nos itens do estado!");
       toast({ title: "Erro", description: "Não foi possível identificar o cliente para buscar os dados mais recentes.", variant: "destructive"});
       return;
     }
     
     console.log(`[handleLoadCustomerItemsToCart] Iniciando. Buscando dados frescos para cliente ${customerId}...`);
     setIsLoadingPendingItems(true); // <<< Mostrar loading durante a busca final >>>

     let freshItems = [];
     try {
       // --- Consulta Final Charges ---
       const freshChargesQuery = query(
          collection(db, 'tenants', currentTenant.id, 'charges'),
          where('tutorId', '==', customerId), // <<< FILTRO PELO CLIENTE >>>
          where('status', 'in', ['pending', 'partially_paid'])
       );
       const freshChargesSnap = await getDocs(freshChargesQuery);
       const freshChargesData = freshChargesSnap.docs.map(d => ({ id: d.id, ...d.data(), itemType: 'charge' }));
       
       // --- Consulta Final OS ---
       const freshOsQuery = query(
          collection(db, 'tenants', currentTenant.id, 'order_services'),
          where('customerId', '==', customerId), // <<< FILTRO PELO CLIENTE >>>
          where('status', '==', 'pending_cashier')
       );
       const freshOsSnap = await getDocs(freshOsQuery);
       const freshOsData = freshOsSnap.docs.map(d => ({ id: d.id, ...d.data(), itemType: 'order_service' }));
       
       freshItems = [...freshChargesData, ...freshOsData];
       console.log(`[handleLoadCustomerItemsToCart] Dados frescos encontrados para ${customerId}:`, freshItems);

       if (freshItems.length === 0) {
          console.warn(`[handleLoadCustomerItemsToCart] Nenhum item pendente encontrado para ${customerId} na busca final. O estado pode estar inconsistente ou o pagamento já ocorreu.`);
          toast({ title: "Aviso", description: "Nenhum item pendente encontrado para este cliente.", variant: "warning"});
          handleDeselectCustomerOrCharge(); // Limpar seleção atual
          setIsLoadingPendingItems(false); // Parar loading
          // Possivelmente chamar fetchPendingItems() para atualizar a lista geral?
          await fetchPendingItems(); // <<< Tentar atualizar a lista geral >>>
          return; // Abortar o carregamento no carrinho
        }

     } catch (finalQueryError) {
        console.error(`[handleLoadCustomerItemsToCart] Erro ao buscar dados frescos para ${customerId}:`, finalQueryError);
        toast({ title: "Erro", description: "Não foi possível verificar os itens pendentes mais recentes.", variant: "destructive"});
        setIsLoadingPendingItems(false); // Parar loading
        return; // Abortar
     }

    // <<< USAR freshItems (os dados frescos) em vez de itemsToLoadFromState daqui em diante >>>
    console.log(`[handleLoadCustomerItemsToCart] Carregando ${freshItems.length} itens FRESCOS para o carrinho...`);

    // 1. Limpar estado anterior (mantido)
    setCart([]);
    setSelectedCustomer(null);
    setCurrentLoadedChargeId(null);
    setCurrentLoadedChargeIds([]);
    setCurrentLoadedOsIds([]); // <<< Limpar OS IDs também >>>
    setActiveContinuedOsId(null);
    setIsAnonymousSaleActive(false);

    try {
      // 2. Obter cliente (tentar popular novamente com base nos dados frescos, se necessário)
      let customer;
      // Tentar pegar dos dados já populados na lista PENDENTE (pode estar desatualizado mas evita re-fetch)
      const existingCustomerData = itemsToLoadFromState.find(i => i.customerId === customerId || i.tutorId === customerId)?.customer;
      if (existingCustomerData) {
        customer = existingCustomerData;
      } else if (customerId) {
          console.log(`[handleLoadCustomerItemsToCart] Populando cliente ${customerId} (não encontrado nos dados do estado)`);
          customer = await Customer.get(customerId).catch(e => { console.error("Erro ao buscar cliente", e); return null;});
      }

      if (!customer) {
        console.warn(`[handleLoadCustomerItemsToCart] Cliente ${customerId} não pôde ser carregado.`);
      }
      
      // <<< USAR freshItems para mapear >>>
      const allCartItemsPromises = freshItems.flatMap(async (doc) => {
        const docType = doc.itemType;
        const docId = doc.id;
        
        let itemsArray = [];
        if (docType === 'charge') {
            try {
                console.log(`[handleLoadCustomerItemsToCart / map] Buscando itens da subcoleção charge_items para charge: ${docId}`);
                const itemsCollectionRef = collection(db, 'tenants', currentTenant.id, 'charges', docId, 'charge_items');
                const itemsSnapshot = await getDocs(itemsCollectionRef);
                itemsArray = itemsSnapshot.docs.map(itemDoc => ({ 
                    chargeItemDocId: itemDoc.id, 
                    ...itemDoc.data()
                }));
                console.log(`[handleLoadCustomerItemsToCart / map] Charge ${docId} - Itens da subcoleção (${itemsArray.length}):`, itemsArray);
            } catch (err) {
                console.error(`[handleLoadCustomerItemsToCart / map] Erro ao buscar charge_items para charge ${docId}:`, err);
            }
        } else if (docType === 'order_service') {
             // <<< INÍCIO: Buscar itens da subcoleção os_items >>>
             try {
                console.log(`[handleLoadCustomerItemsToCart / map] Buscando itens da subcoleção os_items para OS: ${docId}`);
                const itemsCollectionRef = collection(db, 'tenants', currentTenant.id, 'order_services', docId, 'os_items');
                const itemsSnapshot = await getDocs(itemsCollectionRef);
                itemsArray = itemsSnapshot.docs.map(itemDoc => ({ 
                    osItemId: itemDoc.id, // Guardar ID do documento do item OS
                    ...itemDoc.data()
                }));
                console.log(`[handleLoadCustomerItemsToCart / map] OS ${docId} - Itens da subcoleção (${itemsArray.length}):`, itemsArray);
            } catch (err) {
                console.error(`[handleLoadCustomerItemsToCart / map] Erro ao buscar os_items para OS ${docId}:`, err);
            }
            // <<< FIM: Buscar itens da subcoleção os_items >>>
        } else {
             console.warn(`[handleLoadCustomerItemsToCart / map] Tipo de documento desconhecido encontrado: ${docType} (ID: ${docId})`);
        }

        if (!itemsArray || itemsArray.length === 0) {
            console.log(`[handleLoadCustomerItemsToCart / map] Documento ${docId} (${docType}) não possui itens ou falha ao buscar. Pulando.`);
            return []; // Retorna array vazio se não houver itens
        }

        // Mapear itens INTERNOS
        return itemsArray.map(item => ({
          cartItemId: uuidv4(), 
          id: item.itemId || item.sourceId || item.osItemId || item.chargeItemDocId || `item-${Math.random()}`,
          name: item.description || 'Item sem descrição',
          price: item.unitPrice,
          unitPrice: item.unitPrice,
          quantity: item.quantity || 1,
          totalPrice: item.totalPrice,
          type: item.itemType === 'clinic' ? 'service' : (item.itemType === 'petshop' ? 'service' : 'product'), // Ajustar se necessário
          isCancellable: docType === 'charge', // <<< ADD THIS LINE TO SET CANCELLABLE FLAG
          // <<< AJUSTE AQUI: Usar ID do item da subcoleção (osItemId ou chargeItemDocId) >>>
          originalDocumentId: docType === 'charge' ? item.chargeItemDocId : item.osItemId,
          originalDocumentType: docType,
          parentChargeId: docType === 'charge' ? docId : null,
          // <<< ADICIONAR parentOsId se necessário para identificação >>>
          parentOsId: docType === 'order_service' ? docId : null,
          episodeId: docType === 'charge' ? doc.episodeId : null,
          osNumber: docType === 'charge' ? doc.osNumber : null, // Vem da charge ou OS
          prontuarioId: docType === 'charge' ? doc.prontuarioId : null,
          customerId: doc.customerId,
        }));
      });
      
      // Achatar o array de arrays resultante das Promises
      const allCartItemsNested = await Promise.all(allCartItemsPromises);
      const allCartItems = allCartItemsNested.flat();

      console.log("[handleLoadCustomerItemsToCart] Itens (frescos) consolidados para o carrinho:", allCartItems);

      // 4. Identificar IDs (usar freshItems)
      const documentIdsToPay = freshItems.map(doc => doc.id);
      console.log(`[handleLoadCustomerItemsToCart] IDs dos documentos (frescos) a serem pagos:`, documentIdsToPay);
      
      // Separação por tipo (mantida)
      const chargeIdsToPay = freshItems.filter(i => i.itemType === 'charge').map(i => i.id);
      const osIdsToPay = freshItems.filter(i => i.itemType === 'order_service').map(i => i.id);
      console.log(`[handleLoadCustomerItemsToCart] Charge IDs (frescos):`, chargeIdsToPay, "OS IDs (frescos):", osIdsToPay);

      // 5. Atualizar estados
      setCart(allCartItems);
      setSelectedCustomer(customer);
      setCurrentLoadedChargeIds(documentIdsToPay);
      setCurrentLoadedOsIds(osIdsToPay);

      toast({ title: "Itens Carregados", description: `Itens de ${customer?.full_name || 'Cliente'} carregados para pagamento.` });

    } catch (error) {
      console.error(`[handleLoadCustomerItemsToCart] Erro ao carregar itens FRESCOS para o carrinho:`, error);
      toast({ title: "Erro", description: "Não foi possível carregar todos os itens pendentes.", variant: "destructive" });
      handleDeselectCustomerOrCharge(); // Limpa tudo em caso de erro
    } finally {
       setIsLoadingPendingItems(false); // <<< Parar loading >>>
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
          // <<< TRATAMENTO DE ERRO MAIS ROBUSTO >>>
          let errorMessage = "Não foi possível criar a OS."; // Mensagem padrão
          if (error instanceof Error) { // Verifica se é um objeto Error padrão
              errorMessage = error.message; 
          } else if (typeof error === 'string') { // Se for apenas uma string
              errorMessage = error;
          } else if (error && typeof error === 'object') { // Se for um objeto
              // Tentar pegar a mensagem de erro da função, senão usar uma genérica
              errorMessage = error.details?.message || error.message || JSON.stringify(error);
          }
          // <<< FIM TRATAMENTO DE ERRO >>>
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
        <div className="flex justify-between items-center mb-4 flex-shrink-0"> {/* Container para título e botão */}
             <h2 className="text-xl font-semibold">Itens Pendentes</h2>
             {/* <<< ADICIONAR BOTÃO REFRESH AQUI >>> */}
             <div className="flex items-center gap-2">
                 <span className="text-sm text-muted-foreground hidden md:inline">
                     Não encontrou? Atualize.
                 </span>
                 {/* <<< Usar debouncedFetchPendingItems aqui >>> */}
                 <Button 
                     variant="outline" 
                     size="icon" 
                     onClick={() => {
                         console.log("[CashierPage] Refresh Pendentes clicado.");
                         // <<< Chamar a função debounced >>>
                         debouncedFetchPendingItems(); 
                     }} 
                     disabled={isLoadingPendingItems}
                     title="Atualizar lista de itens pendentes"
                 >
                     <RefreshCcw className={`h-4 w-4 ${isLoadingPendingItems ? 'animate-spin' : ''}`} />
                 </Button>
             </div>
         </div>
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

  // <<< ADICIONAR useMemo para debounce >>>
   const debouncedFetchPendingItems = useMemo(
      () => debounce(fetchPendingItems, DEBOUNCE_DELAY),
      [fetchPendingItems] // Recria se a função base (fetchPendingItems) mudar
   );

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
                 // <<< CORREÇÃO: Envolver botões adjacentes em Fragment >>>
                 <> 
                   <Button onClick={() => setShowCustomerDialog(true)}>
                     <User className="mr-2 h-4 w-4" /> Selecionar Cliente
                   </Button>
                   {/* <<< BOTÃO NOVO PEDIDO >>> */ } 
                   <Button variant="outline" onClick={handleNewAnonymousOrder}> 
                      <Plus className="mr-2 h-4 w-4" /> Novo Pedido
                   </Button>
                 </>
                 // <<< FIM CORREÇÃO >>>
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
                        </Button> { /* <<< CORREÇÃO: Fechar Button corretamente >>> */ }
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
                     {/* <<< CORREÇÃO: Simplificar ternário ou garantir que esteja em {} >>> */ } 
                     {(() => {
                       if (!selectedCustomer && !isAnonymousSaleActive && !currentLoadedChargeId) return "Selecione um cliente, inicie um Novo Pedido ou carregue uma cobrança pendente.";
                       if (isAnonymousSaleActive) return "Adicione itens para a Venda Rápida.";
                       if (currentLoadedChargeId) return "Cobrança carregada. Finalize o pagamento ou use 'Continuar Comprando'.";
                       return "Adicione produtos ou serviços.";
                     })()}
                   </p>
                ) : (
                   <div className="space-y-2">
                     {cart.map((item) => {
                       return (
                         <div key={item.cartItemId} className="flex items-center justify-between text-sm border-b pb-1">
                           <div>
                             <p className="font-medium">{item.name || item.description}</p> 
                             {/* <<< EXIBIR IDs ABAIXO DO NOME >>> */ } 
                             {(item.episodeId || item.osNumber) && (
                                 <p className="text-xs text-muted-foreground">
                                   {item.episodeId && `Ep: ${item.episodeId}`}
                                   {item.episodeId && item.prontuarioId && ` (Pront: ${item.prontuarioId})`}
                                   {item.osNumber && `OS: ${item.osNumber}`}
                                 </p>
                             )}
                             {/* <<< FIM EXIBIÇÃO IDs >>> */ } 
                             <p className="text-xs text-muted-foreground capitalize">{item.type === 'product' ? 'Produto' : 'Serviço'}</p>
                           </div> { /* <<< CORREÇÃO: Fechar DIV corretamente >>> */ } 
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
                                   if (item.isCancellable) {
                                       handleOpenCancellationModal(item); // Abre modal para itens de charge
                                   } else {
                                       removeFromCart(item.cartItemId); // Remove direto para itens de OS/venda
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
            {/* <<< BOTÃO Cadastrar Cliente >>> */ }
            {/* <<< CORREÇÃO: Garantir que a lógica condicional inteira esteja em chaves {} >>> */ }
            {
              isAnonymousSaleActive && cart.length > 0 && (
                  <Button
                      variant="link" 
                      className="text-sm h-auto p-0 justify-start" 
                      onClick={() => setShowCustomerDialog(true)} // Abre o diálogo para selecionar/criar
                  >
                      Cadastrar Cliente e Vincular Compra?
                  </Button>
              )
            }
           {/* <<< DEBUG: Log final antes do botão >>> */}
           {/* {console.log(`[CashierPage DEBUG BTN] Render Button: cart.length=${cart.length}, showPaymentDialog=${showPaymentDialog}, calculated_disabled=${cart.length === 0 || showPaymentDialog}`)} */}
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
  const checkAndDeleteEmptyOs = useCallback(async (osId) => {
    if (!osId || !currentTenant?.id) return;
    console.log(`[CashierPage] Verificando OS ${osId} para exclusão por estar vazia...`);

    try {
      const osRef = doc(db, 'tenants', currentTenant.id, 'order_services', osId);
      
      // <<< INÍCIO: Verificar contagem na subcoleção os_items >>>
      const itemsCollectionRef = collection(osRef, 'os_items');
      // Usar getCountFromServer para eficiência (disponível no SDK v9+)
      // Alternativa: getDocs e verificar .size
      const itemsSnapshot = await getDocs(itemsCollectionRef);
      const itemCount = itemsSnapshot.size;
      console.log(`[CashierPage] OS ${osId} possui ${itemCount} item(s) na subcoleção os_items.`);
      // <<< FIM: Verificar contagem na subcoleção os_items >>>

      // Deletar se não houver itens
      if (itemCount === 0) {
        console.log(`[CashierPage] OS ${osId} está vazia. Deletando documento...`);
        await deleteDoc(osRef);
        toast({ title: "OS Removida", description: `A Ordem de Serviço (${osId.substring(0,6)}...) foi removida por estar vazia.` });
        // Refrescar lista de pendentes após exclusão
        fetchPendingItems(); 
      } else {
         console.log(`[CashierPage] OS ${osId} não está vazia. Nenhuma ação necessária.`);
      }
    } catch (error) {
      console.error(`[CashierPage] Erro ao verificar/deletar OS vazia ${osId}:`, error);
      toast({ title: "Erro", description: "Falha ao verificar ou remover OS vazia.", variant: "destructive" });
    }
  }, [currentTenant?.id, fetchPendingItems]);

  // Função wrapper para onClose do Modal 
  const handleCloseQuickSaleModal = async () => { // <<< TORNAR ASYNC >>>
    setShowQuickSaleModal(false);
    console.log("[CashierPage] Fechando QuickSaleModal.");
    const osIdToCheck = activeContinuedOsId; // Armazenar ID antes de limpar estado
    setActiveContinuedOsId(null); // Limpar imediatamente

    if (osIdToCheck) {
      console.log(`[CashierPage] Verificando OS ${osIdToCheck} para exclusão por estar vazia...`);
      await checkAndDeleteEmptyOs(osIdToCheck); // Esperar verificação/deleção

      // <<< RECARREGAR ITENS PENDENTES E ATUALIZAR CARRINHO APÓS FECHAR MODAL >>>
      console.log("[CashierPage] Refetching pending items and reloading cart after QuickSaleModal close...");
      const updatedPendingItemsList = await fetchPendingItems(); // Esperar o fetch

      // Verificar se um cliente e OSs/Charges ainda estão carregados
      if (selectedCustomer && (currentLoadedChargeIds.length > 0 || currentLoadedOsIds.length > 0)) {
          console.log("[CashierPage] Cliente e IDs carregados. Recarregando carrinho com dados atualizados...");
           // Filtrar os itens atualizados que correspondem aos IDs carregados
           const itemsToReload = updatedPendingItemsList.filter(item =>
              (item.itemType === 'charge' && currentLoadedChargeIds.includes(item.id)) ||
              (item.itemType === 'order_service' && currentLoadedOsIds.includes(item.id)) ||
              (item.itemType === 'order_service' && item.id === osIdToCheck && currentLoadedOsIds.includes(osIdToCheck)) // Garante que a OS recém editada seja incluída se estava carregada
           );
           
           // Garante que a OS recem fechada (osIdToCheck) seja incluida nos IDs a recarregar se ela ainda existe
           const finalOsIdsToLoad = [...currentLoadedOsIds];
           if(osIdToCheck && updatedPendingItemsList.some(item => item.id === osIdToCheck && item.itemType === 'order_service') && !finalOsIdsToLoad.includes(osIdToCheck)){
               finalOsIdsToLoad.push(osIdToCheck);
               setCurrentLoadedOsIds(finalOsIdsToLoad); // Atualiza o estado se necessário
               // Adiciona a OS aos items a recarregar se não estiver lá
                if(!itemsToReload.some(item => item.id === osIdToCheck)) {
                     const osToAdd = updatedPendingItemsList.find(item => item.id === osIdToCheck);
                     if(osToAdd) itemsToReload.push(osToAdd);
                 }
           }


          // Chama a função para recarregar o carrinho com os itens filtrados
          await reloadCartWithItems(itemsToReload);
      } else {
           console.log("[CashierPage] Nenhum cliente/IDs carregados, não recarregando o carrinho.");
      }
       // <<< FIM RECARREGAMENTO >>>
    } else {
       console.log("[CashierPage] QuickSaleModal fechado sem um targetOsId ativo (venda local). Nenhuma ação de recarregamento necessária.");
    }
  };

  // <<< NOVA FUNÇÃO PARA RECARREGAR O CARRINHO BASEADO NOS IDs ATUAIS >>>
  const reloadCartWithItems = async (itemsToLoad) => {
       if (!currentTenant?.id) {
           console.error("[reloadCartWithItems] Tenant ID não disponível.");
           return;
       }
      const tenantId = currentTenant.id;

      if (!itemsToLoad || itemsToLoad.length === 0) {
          setCart([]);
          console.log("[reloadCartWithItems] Nenhum item para carregar, limpando carrinho.");
          return;
      }

      console.log(`[reloadCartWithItems] Recarregando ${itemsToLoad.length} documentos (charges/OS) para o carrinho...`, itemsToLoad);
      setIsLoadingPendingItems(true); // Reutilizar loading state? Ou adicionar um específico para o carrinho?
      let consolidatedCartItems = [];
      const chargeIds = [];
      const osIds = [];

      try {
          for (const itemOrGroup of itemsToLoad) {
              if (itemOrGroup.itemType === 'charge' && currentLoadedChargeIds.includes(itemOrGroup.id)) {
                  chargeIds.push(itemOrGroup.id);
                  console.log(`[reloadCartWithItems] Buscando itens para Charge ID: ${itemOrGroup.id}`);
                  const itemsCollectionRef = collection(db, 'tenants', tenantId, 'charges', itemOrGroup.id, 'charge_items');
                  const itemsSnapshot = await getDocs(itemsCollectionRef);
                  itemsSnapshot.docs.forEach(itemDoc => {
                      const itemData = itemDoc.data();
                      if (!itemData.cancelled) {
                          consolidatedCartItems.push({
                              cartItemId: uuidv4(),
                              id: itemData.itemId,
                              name: itemData.description,
                              price: itemData.totalPrice,
                              unitPrice: itemData.unitPrice,
                              quantity: itemData.quantity,
                              type: itemData.itemType === 'clinic' || itemData.itemType === 'petshop' ? 'service' : 'product',
                              cancellable: true,
                              originalDocumentId: itemOrGroup.id,
                              originalItemId: itemDoc.id
                          });
                      }
                  });
              } else if (itemOrGroup.itemType === 'order_service' && currentLoadedOsIds.includes(itemOrGroup.id)) {
                  osIds.push(itemOrGroup.id);
                  console.log(`[reloadCartWithItems] Buscando itens para OS ID: ${itemOrGroup.id}`);
                  const itemsCollectionRef = collection(db, 'tenants', tenantId, 'order_services', itemOrGroup.id, 'os_items');
                  const itemsSnapshot = await getDocs(itemsCollectionRef);
                  itemsSnapshot.docs.forEach(itemDoc => {
                      const itemData = itemDoc.data();
                      // <<< ALINHAR MAPEAMENTO com handleLoadCustomerItemsToCart >>>
                      consolidatedCartItems.push({
                          cartItemId: uuidv4(),
                          id: itemData.itemId || itemDoc.id, // Usa ID do produto ou fallback para ID do doc os_item
                          name: itemData.description || 'Item sem descrição',
                          price: itemData.unitPrice, // <<< USAR unitPrice para 'price' >>>
                          unitPrice: itemData.unitPrice,
                          quantity: itemData.quantity,
                          totalPrice: itemData.totalPrice, // Mantém totalPrice lido
                          type: 'product', // TODO: Verificar se OS pode ter 'service'
                          isCancellable: false, // Item de OS não é cancelável diretamente aqui
                          originalDocumentId: itemOrGroup.id, // ID da OS pai
                          originalItemId: itemDoc.id, // ID do documento na subcoleção os_items
                          // Adicionar outros campos relevantes se necessário (customerId, etc.)
                          parentOsId: itemOrGroup.id, // Redundante com originalDocumentId?
                          customerId: itemOrGroup.customerId // ID do cliente da OS pai
                      });
                      // <<< FIM ALINHAMENTO >>>
                  });
              }
          }

          console.log(`[reloadCartWithItems] Itens consolidados para o carrinho:`, consolidatedCartItems);

          setCart(consolidatedCartItems);
          // Não precisa atualizar os currentLoaded IDs aqui, eles já estão corretos

      } catch (error) {
          console.error("[reloadCartWithItems] Erro ao recarregar itens para o carrinho:", error);
          toast({ title: "Erro", description: "Falha ao atualizar itens no carrinho.", variant: "destructive" });
          setCart([]); // Limpar carrinho em caso de erro
      } finally {
          setIsLoadingPendingItems(false); // Para loading
      }
  };

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
               chargeIds={currentLoadedChargeIds} // <--- Já existente
               continuedOsIds={currentLoadedOsIds} // <--- ADICIONE ESTA LINHA
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
           // <<< CORRIGIDO: Passar ID do DOCUMENTO do item (originalDocumentId) e ID da CHARGE PAI (parentChargeId) >>>
           onConfirm={(cancelReason) => {
                // A função onConfirm do modal agora passa apenas a razão.
                // Os IDs vêm do estado itemToCancel.
                if (!itemToCancel || !itemToCancel.originalDocumentId || !itemToCancel.parentChargeId) {
                    console.error("[CashierPage] Erro: Não foi possível obter IDs do item a ser cancelado.", itemToCancel);
                    toast({title: "Erro Interno", description:"Não foi possível identificar o item para cancelamento.", variant:"destructive"});
                    // Não chamar handleConfirmCancellation se os IDs estiverem faltando
                    // Re-throw para o modal saber que falhou?
                    throw new Error("IDs do item de cancelamento ausentes");
                }
                // Chama handleConfirmCancellation com:
                // 1. ID do documento do item na subcoleção (vem de itemToCancel.originalDocumentId)
                // 2. ID da charge pai (vem de itemToCancel.parentChargeId)
                // 3. Razão do modal
                return handleConfirmCancellation(itemToCancel.originalDocumentId, itemToCancel.parentChargeId, cancelReason);
            }}
           item={itemToCancel}
       />
    </div>
  );
} 