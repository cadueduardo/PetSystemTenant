import React, { useEffect, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { PurchaseHistory } from "@/api/entities";
import { Product } from "@/api/entities";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Loader2, ShoppingBag, RefreshCw } from "lucide-react";

export default function PetPurchaseHistory({ petId, ownerId, purchaseHistory, setPurchaseHistory }) {
  const [isLoading, setIsLoading] = useState(false);
  const [products, setProducts] = useState({});

  // Carregar informações de produtos
  useEffect(() => {
    const loadProducts = async () => {
      try {
        const productsData = await Product.list();
        const productsMap = {};
        productsData.forEach(product => {
          productsMap[product.id] = product;
        });
        setProducts(productsMap);
      } catch (error) {
        console.error("Erro ao carregar produtos:", error);
      }
    };

    loadProducts();
  }, []);

  const refreshPurchaseHistory = async () => {
    if (!ownerId || !petId) return;
    
    setIsLoading(true);
    try {
      const purchases = await PurchaseHistory.filter({
        customer_id: ownerId,
        "items": {
          "$elemMatch": {
            "pet_id": petId
          }
        }
      });
      
      setPurchaseHistory(purchases);
      toast({
        title: "Histórico atualizado",
        description: "O histórico de compras foi atualizado com sucesso."
      });
    } catch (error) {
      console.error("Erro ao atualizar histórico de compras:", error);
      toast({
        title: "Erro",
        description: "Não foi possível atualizar o histórico de compras.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Filtrar apenas os itens relacionados ao pet específico
  const filterPetItems = (purchase) => {
    if (!purchase || !purchase.items) return [];
    return purchase.items.filter(item => item.pet_id === petId);
  };

  const getPaymentMethodLabel = (method) => {
    const methods = {
      credit_card: "Cartão de Crédito",
      debit_card: "Cartão de Débito",
      cash: "Dinheiro",
      pix: "PIX",
      bank_transfer: "Transferência Bancária"
    };
    return methods[method] || method;
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-xl">Histórico de Compras</CardTitle>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={refreshPurchaseHistory}
          disabled={isLoading}
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <RefreshCw className="h-4 w-4 mr-2" />
          )}
          Atualizar
        </Button>
      </CardHeader>
      <CardContent>
        {!purchaseHistory || purchaseHistory.length === 0 ? (
          <div className="text-center py-8">
            <ShoppingBag className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-700 mb-2">Nenhuma compra encontrada</h3>
            <p className="text-gray-500">
              Este pet ainda não tem compras registradas.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {purchaseHistory.map((purchase) => {
              const petItems = filterPetItems(purchase);
              if (petItems.length === 0) return null;
              
              return (
                <div key={purchase.id} className="border rounded-lg p-4">
                  <div className="flex flex-wrap items-center justify-between mb-4">
                    <div>
                      <h3 className="font-medium">
                        Compra em {format(new Date(purchase.purchase_date), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </h3>
                      <p className="text-sm text-gray-500">
                        Total: R$ {purchase.total_amount.toFixed(2)}
                      </p>
                    </div>
                    <Badge className="mt-2 sm:mt-0">
                      {getPaymentMethodLabel(purchase.payment_method)}
                    </Badge>
                  </div>
                  
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Produto</TableHead>
                        <TableHead>Quantidade</TableHead>
                        <TableHead className="text-right">Valor</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {petItems.map((item, index) => (
                        <TableRow key={index}>
                          <TableCell className="font-medium">
                            {item.product_name || products[item.product_id]?.name || "Produto não encontrado"}
                          </TableCell>
                          <TableCell>{item.quantity}x</TableCell>
                          <TableCell className="text-right">
                            R$ {item.total_price?.toFixed(2) || (item.unit_price * item.quantity).toFixed(2)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}