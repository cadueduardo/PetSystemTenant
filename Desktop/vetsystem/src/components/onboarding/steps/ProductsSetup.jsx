import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, ArrowRight, Loader2, Package } from "lucide-react";

export default function ProductsSetup({ trial, onNext, onBack }) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      // Simular processamento (ajustar quando for implementar funcionalidade real)
      setTimeout(() => {
        onNext();
      }, 1000);
    } catch (error) {
      console.error("Erro ao configurar produtos:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold">Estoque e Produtos</h2>
        <p className="text-gray-500">
          Configure como deseja gerenciar seu estoque e produtos
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-blue-50 rounded-lg p-4 mb-6">
          <div className="flex items-start gap-2">
            <Package className="h-5 w-5 text-blue-500 mt-0.5" />
            <div>
              <p className="text-sm text-blue-700 font-medium mb-1">
                Módulo de Gestão de Produtos e Estoque
              </p>
              <p className="text-sm text-blue-600">
                Este módulo permite controlar seu estoque, precificar produtos e serviços,
                e gerenciar vendas diretamente no sistema.
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="border rounded-lg p-4">
            <h3 className="font-medium mb-3">Preferências de estoque</h3>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="notify-low-stock" className="font-medium">
                    Alerta de estoque baixo
                  </Label>
                  <p className="text-sm text-gray-500">
                    Receba notificações quando o estoque estiver baixo
                  </p>
                </div>
                <Switch id="notify-low-stock" defaultChecked />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="product-code">Tipo de código de produto</Label>
                <Select defaultValue="sku">
                  <SelectTrigger id="product-code">
                    <SelectValue placeholder="Selecione o tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sku">Código interno (SKU)</SelectItem>
                    <SelectItem value="barcode">Código de barras</SelectItem>
                    <SelectItem value="both">Ambos</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="default-markup">Markup padrão (%)</Label>
                <Input 
                  id="default-markup" 
                  type="number"
                  defaultValue={30}
                />
                <p className="text-xs text-gray-500">
                  Percentual padrão de lucro aplicado sobre o preço de custo
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-between pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={onBack}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar
          </Button>
          
          <Button
            type="submit"
            disabled={isSubmitting}
            className="flex items-center gap-2"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Processando...
              </>
            ) : (
              <>
                Continuar
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}