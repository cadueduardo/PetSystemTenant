import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line
} from "recharts";
import {
  Calendar,
  TrendingUp,
  TrendingDown,
  DollarSign,
  ArrowRightLeft,
  ChevronLeft,
  ChevronRight,
  PieChart
} from "lucide-react";
import { format, subMonths, addMonths } from "date-fns";
import { ptBR } from "date-fns/locale";

// Dados simulados para demonstração
const generateMockData = (month, year) => {
  const days = new Date(year, month + 1, 0).getDate(); // Último dia do mês
  
  // Dados diários
  const dailyData = [];
  let balance = 5000; // Saldo inicial
  
  for (let i = 1; i <= days; i++) {
    const incoming = Math.round(Math.random() * 1000) + 200;
    const outgoing = Math.round(Math.random() * 800) + 100;
    
    balance = balance + incoming - outgoing;
    
    dailyData.push({
      date: `${i}/${month + 1}`,
      incoming,
      outgoing,
      balance
    });
  }
  
  return dailyData;
};

// Dados para gráfico mensal
const monthlyData = [
  { month: "Jan", incoming: 15200, outgoing: 12800, balance: 2400 },
  { month: "Fev", incoming: 13800, outgoing: 11500, balance: 2300 },
  { month: "Mar", incoming: 14500, outgoing: 13200, balance: 1300 },
  { month: "Abr", incoming: 16200, outgoing: 14100, balance: 2100 },
  { month: "Mai", incoming: 15800, outgoing: 13900, balance: 1900 },
  { month: "Jun", incoming: 17200, outgoing: 15300, balance: 1900 },
  { month: "Jul", incoming: 16500, outgoing: 14800, balance: 1700 },
  { month: "Ago", incoming: 18200, outgoing: 15900, balance: 2300 },
  { month: "Set", incoming: 17800, outgoing: 16100, balance: 1700 },
  { month: "Out", incoming: 19200, outgoing: 17200, balance: 2000 },
  { month: "Nov", incoming: 18900, outgoing: 16700, balance: 2200 },
  { month: "Dez", incoming: 21200, outgoing: 18500, balance: 2700 },
];

// Dados para gráfico por categoria
const categoryData = [
  { name: "Consultas", value: 42 },
  { name: "Banho e Tosa", value: 28 },
  { name: "Cirurgias", value: 10 },
  { name: "Vacinas", value: 15 },
  { name: "Produtos", value: 5 },
];

export default function CashFlow() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [activeTab, setActiveTab] = useState("daily");
  const [dailyData, setDailyData] = useState(
    generateMockData(currentDate.getMonth(), currentDate.getFullYear())
  );
  
  const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };
  
  const handlePreviousMonth = () => {
    const prevMonth = subMonths(currentDate, 1);
    setCurrentDate(prevMonth);
    setDailyData(generateMockData(prevMonth.getMonth(), prevMonth.getFullYear()));
  };
  
  const handleNextMonth = () => {
    const nextMonth = addMonths(currentDate, 1);
    setCurrentDate(nextMonth);
    setDailyData(generateMockData(nextMonth.getMonth(), nextMonth.getFullYear()));
  };
  
  // Calcular totais do mês atual
  const totalIncoming = dailyData.reduce((sum, day) => sum + day.incoming, 0);
  const totalOutgoing = dailyData.reduce((sum, day) => sum + day.outgoing, 0);
  const balance = totalIncoming - totalOutgoing;
  
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-4 border rounded shadow-lg">
          <p className="font-medium">{label}</p>
          <p className="text-green-600">
            Entradas: {formatCurrency(payload[0].value)}
          </p>
          <p className="text-red-600">
            Saídas: {formatCurrency(payload[1].value)}
          </p>
          <p className="font-medium text-blue-600">
            Saldo: {formatCurrency(payload[2].value)}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <CardTitle>Fluxo de Caixa</CardTitle>
          <div className="flex gap-2 items-center">
            <Button 
              variant="outline" 
              size="icon"
              onClick={handlePreviousMonth}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="font-medium">
              {format(currentDate, "MMMM yyyy", { locale: ptBR })}
            </div>
            <Button 
              variant="outline" 
              size="icon"
              onClick={handleNextMonth}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card>
            <CardContent className="p-4 flex justify-between items-center">
              <div>
                <p className="text-sm font-medium text-gray-500">Entradas</p>
                <p className="text-2xl font-bold text-green-600">
                  {formatCurrency(totalIncoming)}
                </p>
              </div>
              <div className="p-3 bg-green-50 rounded-full">
                <TrendingUp className="h-6 w-6 text-green-600" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex justify-between items-center">
              <div>
                <p className="text-sm font-medium text-gray-500">Saídas</p>
                <p className="text-2xl font-bold text-red-600">
                  {formatCurrency(totalOutgoing)}
                </p>
              </div>
              <div className="p-3 bg-red-50 rounded-full">
                <TrendingDown className="h-6 w-6 text-red-600" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex justify-between items-center">
              <div>
                <p className="text-sm font-medium text-gray-500">Saldo</p>
                <p className={`text-2xl font-bold ${balance >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                  {formatCurrency(balance)}
                </p>
              </div>
              <div className={`p-3 ${balance >= 0 ? 'bg-blue-50' : 'bg-red-50'} rounded-full`}>
                <ArrowRightLeft className={`h-6 w-6 ${balance >= 0 ? 'text-blue-600' : 'text-red-600'}`} />
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="daily" value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-4">
            <TabsTrigger value="daily" className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Diário
            </TabsTrigger>
            <TabsTrigger value="monthly" className="flex items-center gap-2">
              <DollarSign className="w-4 h-4" />
              Mensal
            </TabsTrigger>
            <TabsTrigger value="categories" className="flex items-center gap-2">
              <PieChart className="w-4 h-4" />
              Categorias
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="daily" className="mt-0">
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={dailyData}
                  margin={{
                    top: 20,
                    right: 30,
                    left: 20,
                    bottom: 5,
                  }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Bar dataKey="incoming" name="Entradas" fill="#10b981" />
                  <Bar dataKey="outgoing" name="Saídas" fill="#ef4444" />
                  <Bar dataKey="balance" name="Saldo" fill="#3b82f6" />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="border-t pt-4 mt-4">
              <h3 className="font-medium mb-2">Resumo do Mês</h3>
              <p className="text-sm text-gray-600 mb-4">
                {format(currentDate, "MMMM 'de' yyyy", { locale: ptBR })} teve 
                um total de {formatCurrency(totalIncoming)} em entradas e {formatCurrency(totalOutgoing)} em 
                saídas, resultando em um saldo de {formatCurrency(balance)}.
              </p>
              <div className="flex gap-2">
                <Badge variant="outline" className="bg-green-50 text-green-800">
                  Entradas: +{formatCurrency(totalIncoming)}
                </Badge>
                <Badge variant="outline" className="bg-red-50 text-red-800">
                  Saídas: -{formatCurrency(totalOutgoing)}
                </Badge>
                <Badge variant="outline" className={`${balance >= 0 ? 'bg-blue-50 text-blue-800' : 'bg-red-50 text-red-800'}`}>
                  Saldo: {formatCurrency(balance)}
                </Badge>
              </div>
            </div>
          </TabsContent>
          
          <TabsContent value="monthly" className="mt-0">
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={monthlyData}
                  margin={{
                    top: 20,
                    right: 30,
                    left: 20,
                    bottom: 5,
                  }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="incoming" 
                    name="Entradas"
                    stroke="#10b981" 
                    activeDot={{ r: 8 }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="outgoing" 
                    name="Saídas"
                    stroke="#ef4444" 
                  />
                  <Line 
                    type="monotone" 
                    dataKey="balance" 
                    name="Saldo"
                    stroke="#3b82f6" 
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="border-t pt-4 mt-4">
              <h3 className="font-medium mb-2">Análise Anual</h3>
              <p className="text-sm text-gray-600">
                Ao longo do ano, o negócio apresenta tendência de crescimento nas receitas 
                com sazonalidade nos meses de dezembro e janeiro. O saldo mensal médio é de 
                aproximadamente R$ 2.000,00.
              </p>
            </div>
          </TabsContent>

          <TabsContent value="categories" className="mt-0">
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={categoryData}
                  margin={{
                    top: 20,
                    right: 30,
                    left: 20,
                    bottom: 5,
                  }}
                  layout="vertical"
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis dataKey="name" type="category" />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="value" name="Porcentagem (%)" fill="#8884d8" />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="border-t pt-4 mt-4">
              <h3 className="font-medium mb-2">Distribuição por Categoria</h3>
              <p className="text-sm text-gray-600">
                As consultas clínicas representam a maior fonte de receita (42%), 
                seguidas pelos serviços de banho e tosa (28%). Cirurgias e vacinas 
                são responsáveis por 25% do faturamento.
              </p>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}