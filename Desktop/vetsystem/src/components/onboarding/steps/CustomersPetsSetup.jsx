import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, ArrowRight, Users, Loader2 } from "lucide-react";

export default function CustomersPetsSetup({ trial, onNext, onBack }) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      // No setup do trial, podemos apenas passar para o próximo passo
      // Mais tarde o usuário poderá adicionar clientes e pets
      setTimeout(() => {
        onNext();
      }, 1000);
    } catch (error) {
      console.error("Erro ao configurar clientes/pets:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold">Clientes e Pets</h2>
        <p className="text-gray-500">
          Configure como deseja gerenciar seus clientes e seus pets
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-blue-50 rounded-lg p-4 mb-6">
          <div className="flex items-start gap-2">
            <Users className="h-5 w-5 text-blue-500 mt-0.5" />
            <div>
              <p className="text-sm text-blue-700 font-medium mb-1">
                Módulo de Gestão de Clientes e Pets
              </p>
              <p className="text-sm text-blue-600">
                Este módulo permite cadastrar todos os tutores e seus pets, incluindo histórico médico,
                vacinas, e todos os dados necessários para um atendimento completo.
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="border rounded-lg p-4">
            <h3 className="font-medium mb-3">Preferências de cadastro</h3>
            
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="customer-identification">Identificação do cliente</Label>
                <Input 
                  id="customer-identification" 
                  placeholder="CPF" 
                  defaultValue="CPF" 
                />
                <p className="text-xs text-gray-500">
                  Campo principal usado para identificar seus clientes
                </p>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="required-fields">Campos obrigatórios</Label>
                <Input 
                  id="required-fields" 
                  placeholder="Nome, Telefone" 
                  defaultValue="Nome, Telefone"
                />
                <p className="text-xs text-gray-500">
                  Quais campos são obrigatórios no cadastro de clientes
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