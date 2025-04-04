
import React, { useState, useEffect } from "react";
import { Customization } from "@/api/entities";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";

// Importando os componentes de passos do onboarding
// Corrigido o caminho de importação para usar caminho completo
import GeneralSetup from "@/components/onboarding/steps/GeneralSetup";
import CustomersPetsSetup from "@/components/onboarding/steps/CustomersPetsSetup";
import ProductsSetup from "@/components/onboarding/steps/ProductsSetup";
import FinancialSetup from "@/components/onboarding/steps/FinancialSetup";
import CompletionStep from "@/components/onboarding/steps/CompletionStep";

export default function OnboardingWizard({ 
  trial, 
  initialStep = 1, 
  customizationId,
  onComplete 
}) {
  const [currentStep, setCurrentStep] = useState(initialStep);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const getTotalSteps = () => {
    let totalSteps = 2; // General Setup + Completion
    if (trial.selected_modules.includes("clinic_management")) totalSteps++;
    if (trial.selected_modules.includes("petshop")) totalSteps++;
    if (trial.selected_modules.includes("financial")) totalSteps++;
    return totalSteps;
  };

  const totalSteps = getTotalSteps();
  const progress = (currentStep / totalSteps) * 100;

  const getStepComponent = () => {
    // Primeiro passo é sempre a configuração geral
    if (currentStep === 1) {
      return (
        <GeneralSetup 
          trial={trial} 
          customizationId={customizationId} 
          onNext={handleNext} 
        />
      );
    }

    // Calcular os passos dinamicamente com base nos módulos selecionados
    let stepOffset = 1; // Começamos após o primeiro passo

    // Se tem módulo de clínica e estamos no passo correspondente
    if (trial.selected_modules.includes("clinic_management")) {
      stepOffset++;
      if (currentStep === stepOffset) {
        return (
          <CustomersPetsSetup 
            trial={trial} 
            onNext={handleNext} 
            onBack={handleBack} 
          />
        );
      }
    }

    // Se tem módulo de petshop e estamos no passo correspondente
    if (trial.selected_modules.includes("petshop")) {
      stepOffset++;
      if (currentStep === stepOffset) {
        return (
          <ProductsSetup 
            trial={trial} 
            onNext={handleNext} 
            onBack={handleBack} 
          />
        );
      }
    }

    // Se tem módulo financeiro e estamos no passo correspondente
    if (trial.selected_modules.includes("financial")) {
      stepOffset++;
      if (currentStep === stepOffset) {
        return (
          <FinancialSetup 
            trial={trial} 
            onNext={handleNext} 
            onBack={handleBack} 
          />
        );
      }
    }

    // Último passo - Conclusão
    if (currentStep === totalSteps) {
      return (
        <CompletionStep 
          trial={trial} 
          onComplete={handleComplete} 
          onBack={handleBack} 
        />
      );
    }

    // Fallback - retornar para o passo anterior em caso de erro
    setCurrentStep(prev => prev - 1);
    return null;
  };

  const handleNext = async () => {
    setIsSubmitting(true);
    
    try {
      // Salvar o progresso atual
      await Customization.update(customizationId, {
        current_setup_step: currentStep + 1
      });
      
      // Avançar para o próximo passo
      setCurrentStep(prev => prev + 1);
    } catch (error) {
      console.error("Erro ao salvar progresso:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBack = () => {
    setCurrentStep(prev => prev - 1);
  };

  const handleComplete = async () => {
    setIsSubmitting(true);
    
    try {
      // Marcar onboarding como concluído
      await Customization.update(customizationId, {
        is_setup_complete: true,
        current_setup_step: totalSteps
      });
      
      onComplete();
    } catch (error) {
      console.error("Erro ao finalizar onboarding:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6 lg:p-8">
      <Card className="max-w-4xl mx-auto">
        <CardHeader className="border-b">
          <CardTitle className="text-2xl">Configuração Inicial</CardTitle>
          <div className="mt-2">
            <Progress value={progress} className="h-2" />
            <div className="mt-2 text-sm text-gray-500">
              Passo {currentStep} de {totalSteps}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          {getStepComponent()}
        </CardContent>
      </Card>
    </div>
  );
}
