
import React from "react";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { CheckCircle } from "lucide-react";

export default function ModuleCard({ title, description, icon: Icon, features }) {
  const getModuleColor = () => {
    if (title.includes("Clínica")) return "blue";
    if (title.includes("Petshop")) return "green";
    if (title.includes("Financeiro")) return "purple";
    if (title.includes("Leva")) return "amber";
    return "indigo";
  };
  
  const color = getModuleColor();
  
  const colorClasses = {
    blue: {
      bg: "bg-blue-50",
      border: "border-blue-100",
      icon: "bg-blue-100 text-blue-600",
      title: "text-blue-800"
    },
    green: {
      bg: "bg-green-50",
      border: "border-green-100",
      icon: "bg-green-100 text-green-600", 
      title: "text-green-800"
    },
    purple: {
      bg: "bg-purple-50",
      border: "border-purple-100",
      icon: "bg-purple-100 text-purple-600",
      title: "text-purple-800"
    },
    amber: {
      bg: "bg-amber-50",
      border: "border-amber-100",
      icon: "bg-amber-100 text-amber-600",
      title: "text-amber-800"
    },
    indigo: {
      bg: "bg-indigo-50",
      border: "border-indigo-100",
      icon: "bg-indigo-100 text-indigo-600",
      title: "text-indigo-800"
    }
  };

  return (
    <Card className={`transition-all duration-300 hover:shadow-lg ${colorClasses[color].bg} border ${colorClasses[color].border}`}>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className={`p-2 ${colorClasses[color].icon} rounded-lg`}>
            <Icon className={`w-6 h-6 ${colorClasses[color].icon}`} />
          </div>
          <h3 className={`text-xl font-semibold ${colorClasses[color].title}`}>{title}</h3>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-gray-600 mb-6">{description}</p>
        <ul className="space-y-3">
          {features.map((feature, index) => (
            <li key={index} className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-500" />
              <span>{feature}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
