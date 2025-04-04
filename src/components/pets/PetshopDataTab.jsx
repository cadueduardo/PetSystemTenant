import React, { useState, useEffect } from "react";
import { PetshopData } from "@/api/entities";
import { PurchaseHistory } from "@/api/entities";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/use-toast";
import {
  ShoppingBag,
  Scissors,
  DollarSign,
  Heart,
  Calendar,
  Loader2,
  Bath,
  Clock,
  Sparkles
} from "lucide-react";
import { format } from "date-fns";

export default function PetshopDataTab({ pet }) {
  const [isLoading, setIsLoading] = useState(true);
  const [petshopData, setPetshopData] = useState(null);
  const [purchaseHistory, setPurchaseHistory] = useState([]);
  const [error, setError] = useState(null);

  // Carregar dados do petshop e histórico de compras
  useEffect(() => {
    if (pet?.id) {
      loadData();
    }
  }, [pet?.id]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const tenantId = localStorage.getItem('current_tenant');
      
      // Carregar dados de preferências do petshop
      const petshopDataResults = await PetshopData.filter({
        pet_id: pet.id,
        tenant_id: tenantId
      });

      // Se não existir, criar um registro inicial
      if (!petshopDataResults || petshopDataResults.length === 0) {
        const newPetshopData = {
          pet_id: pet.id,
          tenant_id: tenantId,
          product_preferences: {
            preferred_food: "",
            favorite_toys: [],
            preferred_brands: [],
            additional_notes: ""
          },
          grooming_preferences: {
            preferred_shampoo: "",
            fur_style: "",
            grooming_behavior: "",
            calm_treatments: []
          },
          grooming_history: []
        };
        
        const created = await PetshopData.create(newPetshopData);
        setPetshopData(created);
      } else {
        setPetshopData(petshopDataResults[0]);
      }
      
      // Carregar histórico de compras
      try {
        const purchaseHistoryData = await PurchaseHistory.filter({
          tenant_id: tenantId
        });
        
        // Filtrar apenas as compras que envolvem este pet
        const filteredPurchases = purchaseHistoryData.filter(purchase => {
          return purchase.items && purchase.items.some(item => item.pet_id === pet.id);
        });
        
        // Ordenar por data (mais recente primeiro)
        const sortedPurchases = filteredPurchases.sort((a, b) => 
          new Date(b.purchase_date) - new Date(a.purchase_date)
        );
        
        setPurchaseHistory(sortedPurchases);
      } catch (purchaseError) {
        console.error("Erro ao carregar histórico de compras:", purchaseError);
        // Não interromper o carregamento completamente se falhar apenas o histórico de compras
        setPurchaseHistory([]);
      }

    } catch (error) {
      console.error("Erro ao carregar dados do petshop:", error);
      setError(error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os dados de petshop do pet.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8 text-red-500">
        Erro ao carregar dados de petshop. Por favor, tente novamente.
        <Button variant="outline" onClick={loadData} className="mt-4">
          Tentar Novamente
        </Button>
      </div>
    );
  }

  return (
    <Tabs defaultValue="purchases" className="space-y-4">
      <TabsList>
        <TabsTrigger value="purchases">Compras</TabsTrigger>
        <TabsTrigger value="grooming">Banho e Tosa</TabsTrigger>
        <TabsTrigger value="preferences">Preferências</TabsTrigger>
      </TabsList>

      <TabsContent value="purchases">
        <Card>
          <CardHeader>
            <CardTitle>Histórico de Compras</CardTitle>
          </CardHeader>
          <CardContent>
            {purchaseHistory.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <ShoppingBag className="h-12 w-12 mx-auto text-gray-300 mb-3" />
                Nenhuma compra registrada para este pet.
              </div>
            ) : (
              <div className="space-y-4">
                {purchaseHistory.map((purchase) => {
                  // Filtrar apenas os itens relacionados a este pet
                  const petItems = purchase.items.filter(item => item.pet_id === pet.id);
                  
                  return (
                    <div key={purchase.id} className="border rounded-lg p-4">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <p className="font-medium">
                            Compra em {format(new Date(purchase.purchase_date), 'dd/MM/yyyy HH:mm')}
                          </p>
                          <p className="text-sm text-gray-500">
                            {purchase.payment_method === "credit_card" ? "Cartão de Crédito" :
                             purchase.payment_method === "debit_card" ? "Cartão de Débito" :
                             purchase.payment_method === "cash" ? "Dinheiro" :
                             purchase.payment_method === "pix" ? "PIX" :
                             purchase.payment_method === "bank_transfer" ? "Transferência Bancária" :
                             purchase.payment_method}
                          </p>
                        </div>
                        <Badge className={
                          purchase.payment_status === "paid" ? "bg-green-100 text-green-800" :
                          purchase.payment_status === "pending" ? "bg-amber-100 text-amber-800" :
                          purchase.payment_status === "cancelled" ? "bg-red-100 text-red-800" :
                          "bg-gray-100 text-gray-800"
                        }>
                          {purchase.payment_status === "paid" ? "Pago" :
                           purchase.payment_status === "pending" ? "Pendente" :
                           purchase.payment_status === "cancelled" ? "Cancelado" :
                           purchase.payment_status}
                        </Badge>
                      </div>
                      
                      <div className="space-y-2 mt-4">
                        {petItems.map((item, index) => (
                          <div key={index} className="flex justify-between items-center py-2 border-t">
                            <div className="flex items-center">
                              <div className="ml-2">
                                <p>{item.product_name}</p>
                                <p className="text-sm text-gray-500">
                                  {item.quantity} × {formatCurrency(item.unit_price)}
                                </p>
                              </div>
                            </div>
                            <div className="font-medium">
                              {formatCurrency(item.total_price)}
                            </div>
                          </div>
                        ))}
                      </div>
                      
                      <div className="flex justify-between items-center mt-4 pt-3 border-t">
                        <span className="font-bold">Total da Compra:</span>
                        <span className="font-bold">{formatCurrency(purchase.total_amount)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="grooming">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Histórico de Banho e Tosa</CardTitle>
          </CardHeader>
          <CardContent>
            {(!petshopData?.grooming_history || petshopData.grooming_history.length === 0) ? (
              <div className="text-center py-8 text-gray-500">
                <Bath className="h-12 w-12 mx-auto text-gray-300 mb-3" />
                Nenhum serviço de banho e tosa registrado.
              </div>
            ) : (
              <div className="space-y-4">
                {petshopData.grooming_history.map((service, index) => (
                  <div
                    key={index}
                    className="border rounded-lg p-4 hover:bg-gray-50"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="flex items-center gap-2">
                          {service.service_type === "banho" ? (
                            <Bath className="h-5 w-5 text-blue-500" />
                          ) : service.service_type === "tosa" ? (
                            <Scissors className="h-5 w-5 text-purple-500" />
                          ) : service.service_type === "banho_e_tosa" ? (
                            <div className="flex">
                              <Bath className="h-5 w-5 text-blue-500" />
                              <Scissors className="h-5 w-5 text-purple-500 -ml-1" />
                            </div>
                          ) : service.service_type === "hidratacao" ? (
                            <Sparkles className="h-5 w-5 text-teal-500" />
                          ) : service.service_type === "spa" ? (
                            <Heart className="h-5 w-5 text-pink-500" />
                          ) : (
                            <Scissors className="h-5 w-5 text-gray-500" />
                          )}
                          <p className="font-medium">
                            {service.service_type === "banho" ? "Banho" :
                             service.service_type === "tosa" ? "Tosa" :
                             service.service_type === "banho_e_tosa" ? "Banho e Tosa" :
                             service.service_type === "hidratacao" ? "Hidratação" :
                             service.service_type === "spa" ? "Spa" :
                             service.service_type}
                          </p>
                        </div>
                        <p className="text-sm text-gray-500 mt-1">
                          Data: {format(new Date(service.service_date), 'dd/MM/yyyy')}
                        </p>
                        {service.professional && (
                          <p className="text-sm text-gray-500">
                            Profissional: {service.professional}
                          </p>
                        )}
                      </div>
                    </div>
                    
                    {(service.notes || service.behavior_notes) && (
                      <div className="mt-3 pt-3 border-t text-sm">
                        {service.notes && (
                          <div className="mb-2">
                            <span className="font-medium text-gray-700">Observações:</span>
                            <p className="text-gray-600">{service.notes}</p>
                          </div>
                        )}
                        {service.behavior_notes && (
                          <div>
                            <span className="font-medium text-gray-700">Comportamento:</span>
                            <p className="text-gray-600">{service.behavior_notes}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="preferences">
        <Card>
          <CardHeader>
            <CardTitle>Preferências do Pet</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <h3 className="font-medium text-lg flex items-center gap-2">
                  <ShoppingBag className="h-5 w-5 text-blue-500" />
                  Preferências de Produtos
                </h3>
                
                <div>
                  <p className="text-sm font-medium text-gray-500 mb-1">Ração Preferida</p>
                  <p>{petshopData?.product_preferences?.preferred_food || "Não informado"}</p>
                </div>
                
                <div>
                  <p className="text-sm font-medium text-gray-500 mb-1">Brinquedos Favoritos</p>
                  {petshopData?.product_preferences?.favorite_toys?.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {petshopData.product_preferences.favorite_toys.map((toy, index) => (
                        <Badge key={index} variant="outline">{toy}</Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-600">Não informado</p>
                  )}
                </div>
                
                <div>
                  <p className="text-sm font-medium text-gray-500 mb-1">Marcas Preferidas</p>
                  {petshopData?.product_preferences?.preferred_brands?.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {petshopData.product_preferences.preferred_brands.map((brand, index) => (
                        <Badge key={index} variant="outline">{brand}</Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-600">Não informado</p>
                  )}
                </div>
                
                {petshopData?.product_preferences?.additional_notes && (
                  <div>
                    <p className="text-sm font-medium text-gray-500 mb-1">Observações Adicionais</p>
                    <p className="text-gray-600">{petshopData.product_preferences.additional_notes}</p>
                  </div>
                )}
              </div>
              
              <div className="space-y-4">
                <h3 className="font-medium text-lg flex items-center gap-2">
                  <Scissors className="h-5 w-5 text-purple-500" />
                  Preferências de Banho e Tosa
                </h3>
                
                <div>
                  <p className="text-sm font-medium text-gray-500 mb-1">Shampoo Preferido</p>
                  <p>{petshopData?.grooming_preferences?.preferred_shampoo || "Não informado"}</p>
                </div>
                
                <div>
                  <p className="text-sm font-medium text-gray-500 mb-1">Estilo de Tosa</p>
                  <p>{petshopData?.grooming_preferences?.fur_style || "Não informado"}</p>
                </div>
                
                <div>
                  <p className="text-sm font-medium text-gray-500 mb-1">Comportamento</p>
                  <p>{petshopData?.grooming_preferences?.grooming_behavior || "Não informado"}</p>
                </div>
                
                <div>
                  <p className="text-sm font-medium text-gray-500 mb-1">Tratamentos Calmantes</p>
                  {petshopData?.grooming_preferences?.calm_treatments?.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {petshopData.grooming_preferences.calm_treatments.map((treatment, index) => (
                        <Badge key={index} variant="outline">{treatment}</Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-600">Não informado</p>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}