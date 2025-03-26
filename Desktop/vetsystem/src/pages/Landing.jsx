import React from "react";
import { Button } from "@/components/ui/button";
import { createPageUrl } from "@/utils";
import { ArrowRight, CheckCircle, Package, Stethoscope, DollarSign, Truck } from "lucide-react";
import { useNavigate } from "react-router-dom";
import ModuleCard from "../components/landing/ModuleCard";
import FeatureSection from "../components/landing/FeatureSection";
import HeroSection from "../components/landing/HeroSection";
import TestimonialSection from "../components/landing/TestimonialSection";

export default function Landing() {
  const navigate = useNavigate();

  const modules = [
    {
      title: "Gestão Clínica Veterinária",
      description: "Gerencie consultas, prontuários e histórico médico dos pets",
      icon: Stethoscope,
      features: [
        "Agendamento online",
        "Prontuário digital",
        "Histórico médico completo",
        "Controle de vacinas"
      ]
    },
    {
      title: "Petshop",
      description: "Controle estoque, vendas e serviços do seu petshop",
      icon: Package,
      features: [
        "Controle de estoque",
        "PDV integrado",
        "Agendamento de banho e tosa",
        "Gestão de clientes"
      ]
    },
    {
      title: "Financeiro",
      description: "Gestão financeira completa do seu negócio",
      icon: DollarSign,
      features: [
        "Contas a pagar e receber",
        "Fluxo de caixa",
        "Relatórios financeiros",
        "Integração bancária"
      ]
    },
    {
      title: "Leva e Traz",
      description: "Serviço de transporte de pets com gestão de rotas",
      icon: Truck,
      features: [
        "Agendamento de transporte",
        "Otimização de rotas",
        "Controle de motoristas",
        "Integração com serviços"
      ]
    }
  ];

  const handleContract = () => {
    navigate(createPageUrl("Contratar"));
  };

  const handleAdminLogin = () => {
    // Garantir que vamos para a página de login administrativo
    navigate(createPageUrl("AdminLogin"));
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100">
      <div className="w-full bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <span className="font-bold text-xl">PetClinic</span>
            <div className="flex items-center gap-2">
              <span className="text-gray-600">Área Administrativa</span>
              <Button
                variant="ghost"
                className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                onClick={handleAdminLogin}
              >
                Faça seu login
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-24">
        <div className="text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
            PetClinic: Sistema Completo para
            <br />
            Clínicas Veterinárias e Petshops
          </h1>
          <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
            Gerencie sua clínica veterinária ou petshop de forma eficiente com nossa plataforma
            completa. Desde agendamentos até controle financeiro.
          </p>
          <div className="mt-5 sm:mt-8 sm:flex sm:justify-center gap-4">
            <Button 
              size="lg" 
              className="bg-blue-600 hover:bg-blue-700"
              onClick={handleContract}
            >
              Contratar Agora
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </div>
          <div className="flex items-center justify-center gap-8 mt-8">
            <div className="flex items-center gap-2 text-gray-600">
              <CheckCircle className="w-5 h-5 text-green-500" />
              <span>Acesso imediato</span>
            </div>
            <div className="flex items-center gap-2 text-gray-600">
              <CheckCircle className="w-5 h-5 text-green-500" />
              <span>Suporte especializado</span>
            </div>
            <div className="flex items-center gap-2 text-gray-600">
              <CheckCircle className="w-5 h-5 text-green-500" />
              <span>Todas as funcionalidades</span>
            </div>
          </div>
        </div>
      </div>

      <section className="py-20 px-4 md:px-8 bg-white">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-4">
            Soluções Completas para seu Negócio
          </h2>
          <p className="text-gray-600 text-center mb-12 max-w-2xl mx-auto">
            Escolha os módulos que melhor atendem às necessidades do seu negócio
          </p>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {modules.map((module, idx) => (
              <ModuleCard key={idx} {...module} />
            ))}
          </div>
        </div>
      </section>

      <FeatureSection />
      <TestimonialSection />
    </div>
  );
}