import { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Barcode, X } from "lucide-react";

export default function QuickSaleModal({ isOpen, onClose, onConfirm, products = [], isLoadingProducts = false }) {
  const [localCart, setLocalCart] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [barcodeInput, setBarcodeInput] = useState("");
  const [filteredProducts, setFilteredProducts] = useState([]);

  // Reset local state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setLocalCart([]);
      setSearchTerm("");
      setBarcodeInput("");
    } 
  }, [isOpen]);

  // Filter products based on search term
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
      // TODO: Add toast notification for product not found
      console.warn('Product not found by barcode:', barcodeInput);
    }
  };

  const handleAddToCart = (product) => {
    setLocalCart(prevCart => {
      const existingItem = prevCart.find(i => i.id === product.id);
      if (existingItem) {
        return prevCart.map(i =>
          i.id === product.id ? { ...i, quantity: i.quantity + 1, totalPrice: product.price * (i.quantity + 1) } : i
        );
      } else {
        return [...prevCart, { ...product, quantity: 1, unitPrice: product.price, totalPrice: product.price }];
      }
    });
  };

  const handleRemoveFromCart = (productId) => {
    setLocalCart(prevCart => prevCart.filter(i => i.id !== productId));
  };

  const handleUpdateQuantity = (productId, quantity) => {
    if (quantity < 1) return;
    setLocalCart(prevCart =>
      prevCart.map(i =>
        i.id === productId ? { ...i, quantity, totalPrice: i.unitPrice * quantity } : i
      )
    );
  };

  const getLocalCartTotal = () => {
    return localCart.reduce((total, item) => total + item.totalPrice, 0);
  };

  const handleConfirmClick = () => {
    if (localCart.length > 0) {
      onConfirm(localCart); // Pass the selected items back
    } else {
      // Optional: Add toast if trying to confirm empty cart?
      onClose(); // Close anyway or show a message?
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}> 
      <DialogContent className="w-[95vw] max-w-[95vw] h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Novo Pedido Rápido</DialogTitle>
        </DialogHeader>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-grow overflow-hidden">
          {/* Coluna Esquerda: Busca e Lista de Produtos */}
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

          {/* Coluna Direita: Carrinho Local do Modal */}
          <div className="flex flex-col border rounded-md overflow-hidden">
             <h3 className="text-lg font-semibold p-3 border-b bg-muted/50 flex-shrink-0">Itens Selecionados</h3>
            <ScrollArea className="flex-grow">
              <div className="p-3 space-y-2">
                {localCart.length === 0 ? (
                  <p className="text-sm text-center text-muted-foreground py-4">
                    Adicione produtos da lista ao lado.
                  </p>
                ) : (
                  localCart.map(item => (
                    <div key={item.id} className="flex items-center justify-between text-sm border-b pb-1">
                      <div>
                        <p className="font-medium">{item.name}</p>
                        <p className="text-xs text-muted-foreground">R$ {item.unitPrice?.toFixed(2)}</p>
                      </div>
                      <div className="flex items-center space-x-1">
                        <Input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) => handleUpdateQuantity(item.id, parseInt(e.target.value))}
                          className="w-14 h-7 text-xs"
                        />
                        <span> R$ {item.totalPrice?.toFixed(2)}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => handleRemoveFromCart(item.id)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
            {/* Total Local */}
            {localCart.length > 0 && (
                <div className="p-3 border-t flex justify-end font-semibold text-md flex-shrink-0">
                    Total: R$ {getLocalCartTotal().toFixed(2)}
                </div>
            )}
          </div>
        </div>

        <DialogFooter className="mt-4 flex-shrink-0">
          <DialogClose asChild>
             <Button type="button" variant="outline">
               Cancelar
             </Button>
          </DialogClose>
          <Button type="button" onClick={handleConfirmClick} disabled={localCart.length === 0}>
            Adicionar ao Caixa
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
}; 