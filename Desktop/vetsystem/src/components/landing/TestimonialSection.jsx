import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Star } from "lucide-react";

export default function TestimonialSection() {
  const testimonials = [
    {
      name: "Ana Silva",
      role: "Veterinária",
      company: "Clínica PetVida",
      image: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80",
      content: "O sistema revolucionou o atendimento da nossa clínica. Agora temos total controle sobre consultas e histórico dos pacientes."
    },
    {
      name: "Carlos Santos",
      role: "Proprietário",
      company: "Petshop Amigo Fiel",
      image: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80",
      content: "Excelente plataforma! Ajudou-nos a organizar o estoque e aumentar as vendas do petshop."
    },
    {
      name: "Mariana Costa",
      role: "Administradora",
      company: "Centro Veterinário Animal Care",
      image: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80",
      content: "A gestão financeira ficou muito mais simples e eficiente com o sistema. Recomendo!"
    }
  ];

  return (
    <section className="py-20 px-4 bg-white">
      <div className="max-w-7xl mx-auto">
        <h2 className="text-3xl md:text-4xl font-bold text-center mb-4">
          O que nossos clientes dizem
        </h2>
        <p className="text-gray-600 text-center mb-12 max-w-2xl mx-auto">
          Histórias de sucesso de clientes que transformaram seus negócios
        </p>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {testimonials.map((testimonial, index) => (
            <Card key={index} className="border-none shadow-md">
              <CardContent className="pt-6">
                <div className="flex justify-center mb-4">
                  <img
                    className="h-20 w-20 rounded-full"
                    src={testimonial.image}
                    alt={testimonial.name}
                  />
                </div>
                <div className="flex justify-center mb-4">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="w-5 h-5 text-yellow-400 fill-current" />
                  ))}
                </div>
                <p className="text-gray-600 text-center mb-4">
                  "{testimonial.content}"
                </p>
                <div className="text-center">
                  <p className="font-semibold">{testimonial.name}</p>
                  <p className="text-sm text-gray-500">
                    {testimonial.role} - {testimonial.company}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}