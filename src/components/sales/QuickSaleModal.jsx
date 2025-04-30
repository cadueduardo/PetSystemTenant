import { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Barcode, X } from "lucide-react";
import { doc, updateDoc, arrayUnion, arrayRemove, getDoc } from 'firebase/firestore';
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
        console.log(`[QuickSaleModal] Modo OS Ativo. Lendo itens da OS: ${targetOsId} para Tenant: ${tenantId}`);
        setIsLoadingOsItems(true);
        setItemsFromOs([]);
        setLocalCart([]);
        try {
          const osDocRef = doc(db, "tenants", tenantId, "order_services", targetOsId);
          const osDocSnap = await getDoc(osDocRef);
          if (osDocSnap.exists()) {
            const osData = osDocSnap.data();
            console.log("[QuickSaleModal] OS data encontrada:", osData);
            setItemsFromOs(osData.items || []);
          } else {
            console.error(`[QuickSaleModal] Documento OS ${targetOsId} não encontrado no tenant ${tenantId}!`);
            toast({ title: "Erro", description: "Não foi possível carregar a Ordem de Serviço.", variant: "destructive"});
            onClose();
          }
        } catch (error) {
          console.error(`[QuickSaleModal] Erro ao ler itens da OS ${targetOsId} no tenant ${tenantId}:`, error);
          toast({ title: "Erro", description: "Falha ao carregar itens da OS.", variant: "destructive"});
          onClose();
        } finally {
          setIsLoadingOsItems(false);
        }
      } else if (isOpen && !targetOsId) {
        console.log("[QuickSaleModal] Modo Local Ativo (Novo Pedido).");
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

  const currentCartItems = targetOsId ? itemsFromOs : localCart;

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
            console.error("[QuickSaleModal] Tenant ID não encontrado no localStorage!");
            toast({ title: "Erro Crítico", description: "Identificador do Tenant não encontrado. Não é possível salvar na OS.", variant: "destructive"});
            return;
        }
    }

    const newItem = {
        itemId: product.id,
        description: product.name,
        quantity: 1,
        unitPrice: product.price,
        totalPrice: product.price,
        itemType: 'product',
    };

    if (targetOsId && tenantId) {
        console.log(`[QuickSaleModal] Adicionando item à OS ${targetOsId} (Tenant: ${tenantId}):`, newItem);
        try {
            const osDocRef = doc(db, "tenants", tenantId, "order_services", targetOsId);
            const osDocSnap = await getDoc(osDocRef);
            if (!osDocSnap.exists()) throw new Error(`OS Document ${targetOsId} not found in tenant ${tenantId}`);
            const existingItems = osDocSnap.data()?.items || [];
            const existingItemIndex = existingItems.findIndex(i => i.itemId === newItem.itemId);

            if (existingItemIndex > -1) {
                const updatedItems = [...existingItems];
                const currentItem = updatedItems[existingItemIndex];
                currentItem.quantity += 1;
                currentItem.totalPrice = currentItem.unitPrice * currentItem.quantity;
                await updateDoc(osDocRef, { items: updatedItems, updatedAt: new Date() });
                console.log(`[QuickSaleModal] Quantidade incrementada na OS ${targetOsId} para item ${newItem.itemId}`);
                setItemsFromOs(updatedItems);
            } else {
                await updateDoc(osDocRef, {
                    items: arrayUnion(newItem),
                    totalValue: (osDocSnap.data()?.totalValue || 0) + newItem.totalPrice,
                    updatedAt: new Date()
                });
                console.log(`[QuickSaleModal] Item adicionado à OS ${targetOsId}`);
                setItemsFromOs([...existingItems, newItem]);
            }
            toast({ title: "Item Adicionado", description: `${product.name} adicionado à OS.` });
        } catch (error) {
            console.error(`[QuickSaleModal] Erro ao adicionar item à OS ${targetOsId} (Tenant: ${tenantId}):`, error);
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
            return [...prevCart, {
                itemId: product.id,
                name: product.name,
                description: product.name,
                quantity: 1,
                unitPrice: product.price,
                totalPrice: product.price,
                itemType: 'product',
            }];
          }
        });
    }
  };

  const handleRemoveFromCart = async (itemIdToRemove) => {
    let tenantId = null;
    if (targetOsId) {
        tenantId = localStorage.getItem('current_tenant');
        if (!tenantId) {
            console.error("[QuickSaleModal] Tenant ID não encontrado no localStorage!");
            toast({ title: "Erro Crítico", description: "Identificador do Tenant não encontrado. Não é possível remover da OS.", variant: "destructive"});
            return;
        }
    }

    if (targetOsId && tenantId) {
      console.log(`[QuickSaleModal] Tentando remover item ${itemIdToRemove} da OS ${targetOsId} (Tenant: ${tenantId})`);
      try {
        const osDocRef = doc(db, "tenants", tenantId, "order_services", targetOsId);
        
        const osDocSnap = await getDoc(osDocRef); 
        if (!osDocSnap.exists()) {
            console.error(`[QuickSaleModal] OS Document ${targetOsId} não encontrada ao tentar remover item.`);
            throw new Error(`OS Document ${targetOsId} not found in tenant ${tenantId}`);
        }
        
        const currentItems = osDocSnap.data()?.items || [];
        console.log(`[QuickSaleModal] Itens atuais na OS (${osDocSnap.id}) antes da remoção:`, currentItems);
        
        const itemToRemove = currentItems.find(i => i.itemId === itemIdToRemove);
        console.log(`[QuickSaleModal] Item encontrado para remoção:`, itemToRemove);

        if (itemToRemove) {
          console.log(`[QuickSaleModal] Chamando updateDoc com arrayRemove para o item encontrado.`);
          await updateDoc(osDocRef, {
            items: arrayRemove(itemToRemove),
            totalValue: (osDocSnap.data()?.totalValue || 0) - (itemToRemove.totalPrice || 0), 
            updatedAt: new Date()
          });
          console.log(`[QuickSaleModal] updateDoc (arrayRemove) concluído para item ${itemIdToRemove}.`);
          setItemsFromOs(currentItems.filter(i => i.itemId !== itemIdToRemove)); 
          toast({ title: "Item Removido" });
        } else {
           console.warn(`[QuickSaleModal] Item ${itemIdToRemove} não encontrado nos itens atuais da OS ${targetOsId} (Tenant: ${tenantId}) para remoção.`);
        }
      } catch (error) {
        console.error(`[QuickSaleModal] Erro DENTRO DO TRY ao remover item da OS ${targetOsId} (Tenant: ${tenantId}):`, error);
        toast({ title: "Erro", description: "Falha ao remover item da OS.", variant: "destructive" });
      }
    } else if (!targetOsId) {
      setLocalCart(prevCart => prevCart.filter(i => i.itemId !== itemIdToRemove));
    }
  };

  const handleUpdateQuantity = async (itemIdToUpdate, quantity) => {
    if (quantity < 1) return;

    let tenantId = null;
    if (targetOsId) {
        tenantId = localStorage.getItem('current_tenant');
        if (!tenantId) {
            console.error("[QuickSaleModal] Tenant ID não encontrado no localStorage!");
            toast({ title: "Erro Crítico", description: "Identificador do Tenant não encontrado. Não é possível atualizar OS.", variant: "destructive"});
            return;
        }
    }

    if (targetOsId && tenantId) {
       console.log(`[QuickSaleModal] Atualizando quantidade para ${quantity} do item ${itemIdToUpdate} na OS ${targetOsId} (Tenant: ${tenantId})`);
      try {
        const osDocRef = doc(db, "tenants", tenantId, "order_services", targetOsId);
        const osDocSnap = await getDoc(osDocRef);
        if (!osDocSnap.exists()) throw new Error(`OS Document ${targetOsId} not found in tenant ${tenantId}`);
        const currentItems = osDocSnap.data()?.items || [];
        let oldTotalValue = 0;
        let newTotalValue = 0;

        const updatedItems = currentItems.map(item => {
           if (item.itemId === itemIdToUpdate) {
               oldTotalValue += item.totalPrice || 0;
               const newPrice = item.unitPrice * quantity;
               newTotalValue += newPrice;
               return { ...item, quantity: quantity, totalPrice: newPrice };
           }
           oldTotalValue += item.totalPrice || 0;
           newTotalValue += item.totalPrice || 0;
           return item;
       });

        await updateDoc(osDocRef, {
            items: updatedItems,
            totalValue: newTotalValue,
            updatedAt: new Date()
        });
        console.log(`[QuickSaleModal] Quantidade atualizada na OS ${targetOsId}`);
        setItemsFromOs(updatedItems);
      } catch (error) {
         console.error(`[QuickSaleModal] Erro ao atualizar quantidade na OS ${targetOsId} (Tenant: ${tenantId}):`, error);
         toast({ title: "Erro", description: "Falha ao atualizar quantidade na OS.", variant: "destructive" });
      }
    } else if (!targetOsId) {
      setLocalCart(prevCart =>
        prevCart.map(i =>
          i.itemId === itemIdToUpdate ? { ...i, quantity, totalPrice: i.unitPrice * quantity } : i
        )
      );
    }
  };

  const getCartTotal = () => {
    const itemsToSum = targetOsId ? itemsFromOs : localCart;
    return itemsToSum.reduce((total, item) => total + (item.totalPrice || (item.unitPrice * item.quantity) || 0), 0);
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
                                  onChange={(e) => handleUpdateQuantity(item.itemId || item.id, parseInt(e.target.value))}
                                  className="w-14 h-7 text-xs"
                                />
                                <span> R$ {(item.totalPrice || (item.unitPrice * item.quantity))?.toFixed(2)}</span>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={() => handleRemoveFromCart(item.itemId || item.id)}
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