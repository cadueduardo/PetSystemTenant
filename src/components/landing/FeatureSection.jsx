import React from "react";
import { Check, Stethoscope, ShoppingBag, DollarSign, Truck } from "lucide-react";

export default function FeatureSection() {
  return (
    <section className="py-20 px-4 md:px-8 bg-gray-50">
      <div className="max-w-7xl mx-auto">
        <h2 className="text-3xl md:text-4xl font-bold text-center mb-4">
          Módulos Completos para Seu Negócio
        </h2>
        <p className="text-gray-600 text-center mb-16 max-w-2xl mx-auto">
          Tenha acesso a todas as ferramentas necessárias para gerir seu negócio com eficiência
        </p>
        
        <div className="grid md:grid-cols-2 gap-12 lg:gap-16">
          <div className="space-y-12">
            <div className="flex">
              <div className="flex-shrink-0 flex items-center justify-center w-12 h-12 rounded-md bg-blue-100 text-blue-600">
                <Stethoscope className="h-6 w-6" />
              </div>
              <div className="ml-4">
                <h3 className="text-xl font-medium text-gray-900">Gestão Clínica Veterinária</h3>
                <p className="mt-2 text-gray-500">
                  Gerenciamento completo para clínicas veterinárias, com prontuário eletrônico, histórico médico e muito mais.
                </p>
                <ul className="mt-4 space-y-2">
                  <li className="flex items-start">
                    <Check className="h-5 w-5 text-green-500 mr-2 flex-shrink-0" />
                    <span>Prontuário digital completo</span>
                  </li>
                  <li className="flex items-start">
                    <Check className="h-5 w-5 text-green-500 mr-2 flex-shrink-0" />
                    <span>Histórico médico e vacinas</span>
                  </li>
                  <li className="flex items-start">
                    <Check className="h-5 w-5 text-green-500 mr-2 flex-shrink-0" />
                    <span>Agendamento de consultas</span>
                  </li>
                </ul>
              </div>
            </div>
            
            <div className="flex">
              <div className="flex-shrink-0 flex items-center justify-center w-12 h-12 rounded-md bg-green-100 text-green-600">
                <ShoppingBag className="h-6 w-6" />
              </div>
              <div className="ml-4">
                <h3 className="text-xl font-medium text-gray-900">Petshop</h3>
                <p className="mt-2 text-gray-500">
                  Controle de estoque, vendas, serviços de banho e tosa, tudo integrado em uma única plataforma.
                </p>
                <ul className="mt-4 space-y-2">
                  <li className="flex items-start">
                    <Check className="h-5 w-5 text-green-500 mr-2 flex-shrink-0" />
                    <span>Controle de estoque e produtos</span>
                  </li>
                  <li className="flex items-start">
                    <Check className="h-5 w-5 text-green-500 mr-2 flex-shrink-0" />
                    <span>Gestão de vendas</span>
                  </li>
                  <li className="flex items-start">
                    <Check className="h-5 w-5 text-green-500 mr-2 flex-shrink-0" />
                    <span>Agendamento de banho e tosa</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
          
          <div className="space-y-12">
            <div className="flex">
              <div className="flex-shrink-0 flex items-center justify-center w-12 h-12 rounded-md bg-purple-100 text-purple-600">
                <DollarSign className="h-6 w-6" />
              </div>
              <div className="ml-4">
                <h3 className="text-xl font-medium text-gray-900">Financeiro</h3>
                <p className="mt-2 text-gray-500">
                  Gestão financeira completa com controle de contas a pagar, receber e fluxo de caixa.
                </p>
                <ul className="mt-4 space-y-2">
                  <li className="flex items-start">
                    <Check className="h-5 w-5 text-green-500 mr-2 flex-shrink-0" />
                    <span>Contas a pagar e receber</span>
                  </li>
                  <li className="flex items-start">
                    <Check className="h-5 w-5 text-green-500 mr-2 flex-shrink-0" />
                    <span>Fluxo de caixa e relatórios</span>
                  </li>
                  <li className="flex items-start">
                    <Check className="h-5 w-5 text-green-500 mr-2 flex-shrink-0" />
                    <span>Controle de custos</span>
                  </li>
                </ul>
              </div>
            </div>
            
            <div className="flex">
              <div className="flex-shrink-0 flex items-center justify-center w-12 h-12 rounded-md bg-amber-100 text-amber-600">
                <Truck className="h-6 w-6" />
              </div>
              <div className="ml-4">
                <h3 className="text-xl font-medium text-gray-900">Leva e Traz</h3>
                <p className="mt-2 text-gray-500">
                  Serviço de transporte de pets integrado, com gestão de rotas, motoristas e agendamentos.
                </p>
                <ul className="mt-4 space-y-2">
                  <li className="flex items-start">
                    <Check className="h-5 w-5 text-green-500 mr-2 flex-shrink-0" />
                    <span>Otimização de rotas</span>
                  </li>
                  <li className="flex items-start">
                    <Check className="h-5 w-5 text-green-500 mr-2 flex-shrink-0" />
                    <span>Agendamento integrado</span>
                  </li>
                  <li className="flex items-start">
                    <Check className="h-5 w-5 text-green-500 mr-2 flex-shrink-0" />
                    <span>Gestão de motoristas e veículos</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}