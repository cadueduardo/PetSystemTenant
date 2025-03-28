import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { ArrowLeft, ArrowRight, Loader2, DollarSign, CreditCard, Wallet } from "lucide-react";

export default function FinancialSetup({ trial, onNext, onBack }) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedPaymentMethods, setSelectedPaymentMethods] = useState([
    "cash", "credit_card", "debit_card", "pix"
  ]);

  const paymentMethods = [
    { id: "cash", label: "Dinheiro", icon: DollarSign },
    { id: "credit_card", label: "Cartão de Crédito", icon: CreditCard },
    { id: "debit_card", label: "Cartão de Débito", icon: CreditCard },
    { id: "pix", label: "PIX", icon: Wallet },
    { id: "bank_transfer", label: "Transferência Bancária", icon: Wallet },
    { id: "check", label: "Cheque", icon: DollarSign },
  ];

  const handlePaymentMethodChange = (methodId) => {
    setSelectedPaymentMethods(current => 
      current.includes(methodId)
        ? current.filter(id => id !== methodId)
        : [...current, methodId]
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      // Simular processamento (ajustar quando for implementar funcionalidade real)
      setTimeout(() => {
        onNext();
      }, 1000);
    } catch (error) {
      console.error("Erro ao configurar financeiro:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold">Configuração Financeira</h2>
        <p className="text-gray-500">
          Configure como deseja gerenciar a parte financeira do seu negócio
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-blue-50 rounded-lg p-4 mb-6">
          <div className="flex items-start gap-2">
            <DollarSign className="h-5 w-5 text-blue-500 mt-0.5" />
            <div>
              <p className="text-sm text-blue-700 font-medium mb-1">
                Módulo Financeiro
              </p>
              <p className="text-sm text-blue-600">
                Este módulo permite controlar contas a pagar e receber, fluxo de caixa,
                e gerar relatórios financeiros completos.
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="border rounded-lg p-4">
            <h3 className="font-medium mb-3">Métodos de pagamento aceitos</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {paymentMethods.map((method) => (
                <div key={method.id} className="flex items-center space-x-2">
                  <Checkbox 
                    id={`payment-${method.id}`}
                    checked={selectedPaymentMethods.includes(method.id)}
                    onCheckedChange={() => handlePaymentMethodChange(method.id)}
                  />
                  <Label 
                    htmlFor={`payment-${method.id}`}
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <method.icon className="h-4 w-4 text-gray-500" />
                    {method.label}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          <div className="border rounded-lg p-4">
            <h3 className="font-medium mb-3">Configurações de Pagamento</h3>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="payment-term">Prazo de pagamento padrão (dias)</Label>
                <Input 
                  id="payment-term" 
                  type="number"
                  defaultValue={30}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="tax-rate">Taxa de imposto padrão (%)</Label>
                <Input 
                  id="tax-rate" 
                  type="number"
                  step="0.01"
                  defaultValue={0}
                />
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