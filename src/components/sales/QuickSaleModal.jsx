import { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Barcode, X } from "lucide-react";
import { doc, updateDoc, collection, getDocs, addDoc, query, where, deleteDoc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebaseConfig';
import { toast } from "@/components/ui/use-toast";

export default function QuickSaleModal({ isOpen, onClose, onConfirm, products = [], isLoadingProducts = false, targetOsId = null }) {
  const [localCart, setLocalCart] = useState([]);
  const [itemsFromOs, setItemsFromOs] = useState([]);
  const [isLoadingOsItems, setIsLoadingOsItems] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [barcodeInput, setBarcodeInput] = useState("");
  const [filteredProducts, setFilteredProducts] = useState([]);

  useEffect(() => {
    const loadOsItems = async () => {
      if (isOpen && targetOsId) {
        const tenantId = localStorage.getItem('current_tenant');
        if (!tenantId) {
            console.error("[QuickSaleModal] Tenant ID não encontrado no localStorage!");
            toast({ title: "Erro Crítico", description: "Identificador do Tenant não encontrado. Não é possível carregar OS.", variant: "destructive"});
            onClose();
            return;
        }
        console.log(`[QuickSaleModal v2] Modo OS Ativo. Lendo itens da SUBCOLEÇÃO os_items: ${targetOsId} para Tenant: ${tenantId}`);
        setIsLoadingOsItems(true);
        setItemsFromOs([]);
        setLocalCart([]);
        try {
            const itemsCollectionRef = collection(db, "tenants", tenantId, "order_services", targetOsId, "os_items");
            const itemsSnapshot = await getDocs(itemsCollectionRef);
            const fetchedItems = itemsSnapshot.docs.map(doc => ({ 
                osItemId: doc.id,
                ...doc.data() 
            }));
            console.log(`[QuickSaleModal v2] Itens da subcoleção carregados (${fetchedItems.length}):`, fetchedItems);
            setItemsFromOs(fetchedItems);
        } catch (error) {
          console.error(`[QuickSaleModal v2] Erro ao ler itens da subcoleção os_items (OS: ${targetOsId}, Tenant: ${tenantId}):`, error);
          toast({ title: "Erro", description: "Falha ao carregar itens da OS.", variant: "destructive"});
          onClose();
        } finally {
          setIsLoadingOsItems(false);
        }
      } else if (isOpen && !targetOsId) {
        console.log("[QuickSaleModal v2] Modo Local Ativo (Novo Pedido).");
        setLocalCart([]);
        setItemsFromOs([]);
        setIsLoadingOsItems(false);
      }
      setSearchTerm("");
      setBarcodeInput("");
    }
    loadOsItems();
  }, [isOpen, targetOsId, onClose]);

  useEffect(() => {
    setFilteredProducts(
      products.filter(product =>
        product.name.toLowerCase().includes(searchTerm.toLowerCase())
      )
    );
  }, [products, searchTerm]);

  const handleBarcodeSubmit = (e) => {
    e.preventDefault();
    const product = products.find(p => p.barcode === barcodeInput);
    if (product) {
      handleAddToCart(product);
      setBarcodeInput("");
    } else {
      toast({ title: "Não Encontrado", description: "Produto não encontrado pelo código de barras.", variant: "warning" });
      console.warn('Product not found by barcode:', barcodeInput);
    }
  };

  const handleAddToCart = async (product) => {
    let tenantId = null;
    if (targetOsId) {
        tenantId = localStorage.getItem('current_tenant');
        if (!tenantId) {
            console.error("[QuickSaleModal v2] Tenant ID não encontrado no localStorage!");
            toast({ title: "Erro Crítico", description: "Identificador do Tenant não encontrado. Não é possível salvar na OS.", variant: "destructive"});
            return;
        }
    }

    const newItemData = {
        itemId: product.id,
        description: product.name,
        quantity: 1,
        unitPrice: product.price,
        totalPrice: product.price,
        itemType: 'product',
        createdAt: new Date(),
    };

    if (targetOsId && tenantId) {
        console.log(`[QuickSaleModal v2] Adicionando item à subcoleção os_items da OS ${targetOsId} (Tenant: ${tenantId}):`, newItemData);
        try {
            const itemsCollectionRef = collection(db, "tenants", tenantId, "order_services", targetOsId, "os_items");

            const q = query(itemsCollectionRef, where("itemId", "==", newItemData.itemId));
            const querySnapshot = await getDocs(q);

            if (!querySnapshot.empty) {
                const existingDoc = querySnapshot.docs[0];
                const existingData = existingDoc.data();
                const newQuantity = (existingData.quantity || 0) + 1;
                const newTotalPrice = (existingData.unitPrice || 0) * newQuantity;
                
                console.log(`[QuickSaleModal v2] Item ${newItemData.itemId} já existe (Doc ID: ${existingDoc.id}). Atualizando quantidade para ${newQuantity}`);
                await updateDoc(existingDoc.ref, {
                    quantity: newQuantity,
                    totalPrice: newTotalPrice,
                    updatedAt: new Date()
                });

                const updatedItemsState = itemsFromOs.map(item => 
                    item.osItemId === existingDoc.id 
                    ? { ...item, quantity: newQuantity, totalPrice: newTotalPrice }
                    : item
                );
                setItemsFromOs(updatedItemsState);
                
                const newTotalValue = updatedItemsState.reduce((sum, item) => sum + (item.totalPrice || 0), 0);
                try {
                    const osDocRef = doc(db, "tenants", tenantId, "order_services", targetOsId);
                    await updateDoc(osDocRef, { totalValue: newTotalValue, updatedAt: new Date() });
                    console.log(`[QuickSaleModal v2 Add/Update] OS Pai ${targetOsId} totalValue atualizado para: ${newTotalValue}`);
                } catch (osUpdateError) {
                    console.error(`[QuickSaleModal v2 Add/Update] Erro ao atualizar totalValue da OS Pai ${targetOsId}:`, osUpdateError);
                }
                
                toast({ title: "Quantidade Atualizada", description: `${product.name} teve a quantidade aumentada na OS.` });
            } else {
                console.log(`[QuickSaleModal v2] Item ${newItemData.itemId} não existe. Adicionando novo documento.`);
                const newDocRef = await addDoc(itemsCollectionRef, newItemData);
                console.log(`[QuickSaleModal v2] Novo item adicionado à OS ${targetOsId} com Doc ID: ${newDocRef.id}`);
                
                const updatedItemsState = [...itemsFromOs, { osItemId: newDocRef.id, ...newItemData }];
                setItemsFromOs(updatedItemsState);

                const newTotalValue = updatedItemsState.reduce((sum, item) => sum + (item.totalPrice || 0), 0);
                try {
                    const osDocRef = doc(db, "tenants", tenantId, "order_services", targetOsId);
                    await updateDoc(osDocRef, { totalValue: newTotalValue, updatedAt: new Date() });
                    console.log(`[QuickSaleModal v2 Add/New] OS Pai ${targetOsId} totalValue atualizado para: ${newTotalValue}`);
                } catch (osUpdateError) {
                    console.error(`[QuickSaleModal v2 Add/New] Erro ao atualizar totalValue da OS Pai ${targetOsId}:`, osUpdateError);
                }

                toast({ title: "Item Adicionado", description: `${product.name} adicionado à OS.` });
            }
        } catch (error) {
            console.error(`[QuickSaleModal v2] Erro ao adicionar/atualizar item na subcoleção os_items (OS: ${targetOsId}, Tenant: ${tenantId}):`, error);
            toast({ title: "Erro", description: "Falha ao adicionar item na OS.", variant: "destructive" });
        }
    } else if (!targetOsId) {
        setLocalCart(prevCart => {
          const existingItem = prevCart.find(i => i.itemId === product.id);
          if (existingItem) {
            return prevCart.map(i =>
              i.itemId === product.id ? { ...i, quantity: i.quantity + 1, totalPrice: product.price * (i.quantity + 1) } : i
            );
          } else {
            return [...prevCart, newItemData];
          }
        });
    }
  };

  const handleRemoveFromCart = async (osItemIdToRemove) => {
    let tenantId = null;
    if (targetOsId) {
        tenantId = localStorage.getItem('current_tenant');
        if (!tenantId) {
            console.error("[QuickSaleModal v2] Tenant ID não encontrado no localStorage!");
            toast({ title: "Erro Crítico", description: "Identificador do Tenant não encontrado. Não é possível remover da OS.", variant: "destructive"});
            return;
        }
    }

    console.log(`[QuickSaleModal v2 Remove] Parâmetro recebido osItemIdToRemove: ${osItemIdToRemove}`);

    if (targetOsId && tenantId) {
      console.log(`[QuickSaleModal v2 Remove] Tentando remover item DOC ID ${osItemIdToRemove} da subcoleção os_items (OS: ${targetOsId}, Tenant: ${tenantId})`);
      
      let itemDocRef = null;
      try {
          itemDocRef = doc(db, 'tenants', tenantId, 'order_services', targetOsId, 'os_items', osItemIdToRemove);
          console.log(`[QuickSaleModal v2 Remove] Construída referência do documento: ${itemDocRef.path}`);
      } catch (refError) {
          console.error("[QuickSaleModal v2 Remove] ERRO ao construir referência do documento:", refError);
          toast({ title: "Erro Interno", description: "Falha ao criar referência para exclusão.", variant: "destructive" });
          return;
      }

      try {
            setIsLoadingOsItems(true); // Indica carregamento durante a exclusão
            await deleteDoc(itemDocRef);
            console.log(`[QuickSaleModal v2 Remove] Chamada deleteDoc CONCLUÍDA para ${itemDocRef.path}.`);
            
            const updatedItemsState = itemsFromOs.filter(i => i.osItemId !== osItemIdToRemove);
            setItemsFromOs(updatedItemsState);
            console.log(`[QuickSaleModal v2 Remove] Estado local 'itemsFromOs' atualizado APÓS deleteDoc.`);

            const newTotalValue = updatedItemsState.reduce((sum, item) => sum + (item.totalPrice || 0), 0);
            const osDocRef = doc(db, 'tenants', tenantId, 'order_services', targetOsId);
            await updateDoc(osDocRef, { totalValue: newTotalValue, updatedAt: new Date() });
            console.log(`[QuickSaleModal v2 Remove] OS Pai ${targetOsId} totalValue atualizado para: ${newTotalValue}`);
            
            toast({ title: "Item Removido", description: "O item foi removido da ordem de serviço." });
      
      } catch (deleteError) {
             console.error(`[QuickSaleModal v2 Remove] ERRO durante deleteDoc para ${itemDocRef?.path}:`, deleteError);
             toast({ title: "Erro ao Remover Item", description: `Não foi possível remover o item do banco de dados: ${deleteError.message}`, variant: "destructive" });
      } finally {
            setIsLoadingOsItems(false); // Finaliza carregamento
      }
    } else if (!targetOsId) {
      setLocalCart(prevCart => prevCart.filter(i => i.itemId !== osItemIdToRemove));
    }
  };

  const handleUpdateQuantity = async (osItemIdToUpdate, quantity) => {
    if (quantity < 1) return;

    let tenantId = null;
    if (targetOsId) {
        tenantId = localStorage.getItem('current_tenant');
        if (!tenantId) {
            console.error("[QuickSaleModal v2] Tenant ID não encontrado no localStorage!");
            toast({ title: "Erro Crítico", description: "Identificador do Tenant não encontrado. Não é possível atualizar OS.", variant: "destructive"});
            return;
        }
    }

    if (targetOsId && tenantId) {
       console.log(`[QuickSaleModal v2] Atualizando quantidade para ${quantity} do item DOC ID ${osItemIdToUpdate} na subcoleção os_items (OS: ${targetOsId}, Tenant: ${tenantId})`);
      try {
        const itemDocRef = doc(db, "tenants", tenantId, "order_services", targetOsId, "os_items", osItemIdToUpdate);

        const itemSnap = await getDoc(itemDocRef);
        if (!itemSnap.exists()) {
          console.error(`[QuickSaleModal v2] Documento do item ${osItemIdToUpdate} não encontrado no Firestore.`);
          throw new Error("Documento do item não encontrado.");
        }
        
        const itemData = itemSnap.data();
        const unitPrice = itemData.unitPrice;

        if (typeof unitPrice === 'undefined' || unitPrice === null) {
          console.error(`[QuickSaleModal v2] Preço unitário (unitPrice) não encontrado nos dados do item ${osItemIdToUpdate} do Firestore.`);
          throw new Error("Preço unitário do item não encontrado.");
        }
        
        const newTotalPrice = unitPrice * quantity;

        await updateDoc(itemDocRef, {
          quantity: quantity,
          totalPrice: newTotalPrice,
          updatedAt: new Date()
        });
        
        const updatedItemsState = itemsFromOs.map(item => 
            item.osItemId === osItemIdToUpdate 
            ? { ...item, quantity: quantity, totalPrice: newTotalPrice } 
            : item
        );
        setItemsFromOs(updatedItemsState);

        const newTotalValue = updatedItemsState.reduce((sum, item) => sum + (item.totalPrice || 0), 0);
        const osDocRef = doc(db, "tenants", tenantId, "order_services", targetOsId);
        await updateDoc(osDocRef, { totalValue: newTotalValue, updatedAt: new Date() });
        console.log(`[QuickSaleModal v2 Update] OS Pai ${targetOsId} totalValue atualizado para: ${newTotalValue}`);

        toast({ title: "Quantidade Atualizada", description: "A quantidade do item foi atualizada na OS." });

      } catch (error) {
        console.error(`[QuickSaleModal v2] Erro ao atualizar quantidade do item ${osItemIdToUpdate} na subcoleção os_items (OS: ${targetOsId}, Tenant: ${tenantId}):`, error);
        toast({ title: "Erro", description: `Falha ao atualizar quantidade do item na OS. ${error.message}`, variant: "destructive" });
      }
    } else if (!targetOsId) {
      const itemIdToUpdateLocal = osItemIdToUpdate;
      setLocalCart(prevCart => {
        const itemIndex = prevCart.findIndex(item => item.itemId === itemIdToUpdateLocal);
        if (itemIndex === -1) return prevCart;
        
        const itemToUpdate = prevCart[itemIndex];
        const newTotalPrice = (itemToUpdate.unitPrice || 0) * quantity;

        const updatedCart = [...prevCart];
        updatedCart[itemIndex] = {
          ...itemToUpdate,
          quantity: quantity,
          totalPrice: newTotalPrice
        };
        return updatedCart;
      });
    }
  };

  const getCartTotal = () => {
    const items = targetOsId ? itemsFromOs : localCart;
    return items.reduce((total, item) => total + (item.totalPrice || 0), 0);
  };

  const handleConfirmClick = () => {
    if (targetOsId) {
      console.log(`[QuickSaleModal] Confirmando itens para OS ${targetOsId}. Fechando modal.`);
      onClose(); 
    } else {
      if (localCart.length > 0) {
        console.log("[QuickSaleModal] Confirmando itens locais:", localCart);
        onConfirm(localCart); 
      } else {
        console.log("[QuickSaleModal] Tentando confirmar carrinho local vazio. Apenas fechando.");
        onClose(); 
      }
    }
  };

  const displayCartItems = targetOsId ? itemsFromOs : localCart;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}> 
      <DialogContent className="w-[95vw] max-w-[95vw] h-[90vh] flex flex-col">
        <DialogHeader>
           <DialogTitle>{targetOsId ? 'Adicionar Itens à OS' : 'Novo Pedido Rápido'}</DialogTitle>
        </DialogHeader>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-grow overflow-hidden">
          <div className="flex flex-col space-y-3 overflow-hidden">
            <form onSubmit={handleBarcodeSubmit} className="flex space-x-2 flex-shrink-0">
              <Input
                placeholder="Código de Barras"
                value={barcodeInput}
                onChange={(e) => setBarcodeInput(e.target.value)}
              />
              <Button type="submit" size="icon">
                <Barcode className="h-4 w-4" />
              </Button>
            </form>
            <Input
              placeholder="Buscar Produto por nome..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-shrink-0"
            />
            <ScrollArea className="flex-grow border rounded-md">
              <div className="p-2 space-y-1">
                {isLoadingProducts ? (
                  <div className="flex justify-center py-4">
                    <Loader2 className="h-5 w-5 animate-spin" />
                  </div>
                ) : (
                  filteredProducts.map(product => (
                    <div
                      key={product.id}
                      className="flex justify-between items-center text-sm p-1 hover:bg-muted rounded cursor-pointer"
                      onClick={() => handleAddToCart(product)}
                    >
                      <span>{product.name}</span>
                      <span>R$ {product.price?.toFixed(2)}</span>
                    </div>
                  ))
                )}
                {filteredProducts.length === 0 && !isLoadingProducts && (
                  <p className="text-xs text-center text-muted-foreground py-2">
                    Nenhum produto encontrado.
                  </p>
                )}
              </div>
            </ScrollArea>
          </div>

          <div className="flex flex-col border rounded-md overflow-hidden">
             <h3 className="text-lg font-semibold p-3 border-b bg-muted/50 flex-shrink-0">Itens Selecionados</h3>
            {isLoadingOsItems ? (
                <div className="flex justify-center items-center h-full">
                    <Loader2 className="h-6 w-6 animate-spin" />
                </div>
            ) : (
                <>
                    <ScrollArea className="flex-grow">
                      <div className="p-3 space-y-2">
                        {displayCartItems.length === 0 ? (
                          <p className="text-sm text-center text-muted-foreground py-4">
                            Adicione produtos da lista ao lado.
                          </p>
                        ) : (
                          displayCartItems.map(item => (
                            <div key={item.itemId || item.id} className="flex items-center justify-between text-sm border-b pb-1">
                              <div>
                                <p className="font-medium">{item.description || item.name}</p> 
                                <p className="text-xs text-muted-foreground">R$ {item.unitPrice?.toFixed(2)}</p>
                              </div>
                              <div className="flex items-center space-x-1">
                                <Input
                                  type="number"
                                  min="1"
                                  value={item.quantity}
                                  onChange={(e) => {
                                      const idToUpdate = targetOsId ? item.osItemId : (item.itemId || item.id);
                                      if (!idToUpdate) {
                                          console.error("[QuickSaleModal UI] ID do item para atualização não encontrado!", item);
                                          toast({title:"Erro Interno", description:"Não foi possível identificar o item para atualizar.", variant:"destructive"});
                                          return;
                                      }
                                      handleUpdateQuantity(idToUpdate, parseInt(e.target.value));
                                  }}
                                  className="w-14 h-7 text-xs"
                                />
                                <span> R$ {(item.totalPrice || (item.unitPrice * item.quantity))?.toFixed(2)}</span>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={() => {
                                      const idToRemove = item.osItemId || item.itemId || item.id;
                                      console.log(`[QuickSaleModal UI Click] Botão X clicado para remover ID: ${idToRemove}`, item);
                                      handleRemoveFromCart(idToRemove);
                                  }}
                                >
                                  <X className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </ScrollArea>
                    {displayCartItems.length > 0 && (
                        <div className="p-3 border-t flex justify-end font-semibold text-md flex-shrink-0">
                            Total: R$ {getCartTotal().toFixed(2)}
                        </div>
                    )}
                </>
            )}
          </div>
        </div>

        <DialogFooter className="mt-4 flex-shrink-0">
          <DialogClose asChild>
             <Button type="button" variant="outline">
               Cancelar
             </Button>
          </DialogClose>
          <Button 
             type="button" 
             onClick={handleConfirmClick} 
             disabled={isLoadingOsItems || (targetOsId ? false : displayCartItems.length === 0)}
             > 
            {targetOsId ? 'Confirmar Itens na OS' : 'Adicionar ao Caixa'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

QuickSaleModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onConfirm: PropTypes.func.isRequired,
  products: PropTypes.array,
  isLoadingProducts: PropTypes.bool,
  targetOsId: PropTypes.string,
}; 