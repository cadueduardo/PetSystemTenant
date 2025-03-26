import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format, subDays, subMonths, eachDayOfInterval } from "date-fns";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from "recharts";
import {
  Building,
  FileText,
  Calendar,
  Users,
  Clock,
  CheckCircle,
  XCircle,
  Package,
  DollarSign,
  Loader2
} from "lucide-react";

const COLORS = ['#4f46e5', '#10b981', '#ef4444', '#f59e0b', '#6366f1'];

export default function UsageStatistics() {
  const [activePeriod, setActivePeriod] = useState("month");
  const [isLoading, setIsLoading] = useState(false);
  
  // Dados simulados para tenants
  const mockTenants = [
    { 
      id: "1", 
      status: "active", 
      selected_modules: ["clinic_management", "petshop"], 
      business_type: "clinic",
      users_count: 5
    },
    { 
      id: "2", 
      status: "trial", 
      selected_modules: ["clinic_management", "financial"], 
      business_type: "clinic",
      users_count: 3
    },
    { 
      id: "3", 
      status: "active", 
      selected_modules: ["clinic_management", "petshop", "financial"], 
      business_type: "petshop",
      users_count: 8
    },
    { 
      id: "4", 
      status: "expired", 
      selected_modules: ["clinic_management"], 
      business_type: "clinic",
      users_count: 2
    },
    { 
      id: "5", 
      status: "trial", 
      selected_modules: ["clinic_management", "petshop"], 
      business_type: "petshop",
      users_count: 4
    }
  ];
  
  const activeTenantsCount = mockTenants.filter(t => t.status === "active").length;
  const trialTenantsCount = mockTenants.filter(t => t.status === "trial").length;
  const expiredTenantsCount = mockTenants.filter(t => t.status === "expired").length;
  
  const clinicModuleCount = mockTenants.filter(t => t.selected_modules.includes("clinic_management")).length;
  const petshopModuleCount = mockTenants.filter(t => t.selected_modules.includes("petshop")).length;
  const financialModuleCount = mockTenants.filter(t => t.selected_modules.includes("financial")).length;
  
  const businessTypeData = [
    { name: 'Clínicas', value: mockTenants.filter(t => t.business_type === "clinic").length },
    { name: 'Petshops', value: mockTenants.filter(t => t.business_type === "petshop").length },
  ];

  const statusData = [
    { name: 'Ativos', value: activeTenantsCount },
    { name: 'Trial', value: trialTenantsCount },
    { name: 'Expirados', value: expiredTenantsCount },
    { name: 'Suspensos', value: mockTenants.filter(t => t.status === "suspended").length }
  ].filter(item => item.value > 0);

  const moduleData = [
    { name: 'Gestão Clínica', value: clinicModuleCount },
    { name: 'Petshop', value: petshopModuleCount },
    { name: 'Financeiro', value: financialModuleCount }
  ];

  const generateGrowthData = () => {
    const today = new Date();
    let interval;
    let formatStr;
    let data = [];
    
    if (activePeriod === "week") {
      interval = { start: subDays(today, 7), end: today };
      formatStr = "EEE";
      
      data = eachDayOfInterval(interval).map((date, index) => ({
        name: format(date, formatStr),
        "Novos Tenants": index + Math.floor(Math.random() * 3),
      }));
    } else if (activePeriod === "month") {
      interval = { start: subDays(today, 30), end: today };
      formatStr = "dd/MM";
      
      const days = eachDayOfInterval(interval);
      for (let i = 0; i < days.length; i += 3) {
        const date = days[i];
        data.push({
          name: format(date, formatStr),
          "Novos Tenants": 1 + Math.floor(Math.random() * 5),
        });
      }
    } else {
      interval = { start: subMonths(today, 12), end: today };
      formatStr = "MMM";
      
      for (let i = 0; i < 12; i++) {
        const date = subMonths(today, 11 - i);
        data.push({
          name: format(date, formatStr),
          "Novos Tenants": 3 + Math.floor(Math.random() * 8),
        });
      }
    }
    
    return data;
  };

  const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, index, name, value }) => {
    const RADIAN = Math.PI / 180;
    const radius = outerRadius * 1.1;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    if (percent < 0.05) return null;

    return (
      <text x={x} y={y} fill="#333" textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central">
        {`${name} (${value})`}
      </text>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Building className="h-5 w-5 text-blue-500" />
              Empresas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{mockTenants.length}</div>
            <div className="grid grid-cols-2 gap-2 mt-4">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span className="text-sm">{activeTenantsCount} ativos</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-blue-500" />
                <span className="text-sm">{trialTenantsCount} em trial</span>
              </div>
              <div className="flex items-center gap-2">
                <XCircle className="h-4 w-4 text-red-500" />
                <span className="text-sm">{expiredTenantsCount} expirados</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Package className="h-5 w-5 text-blue-500" />
              Módulos Contratados
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-green-500" />
                  <span className="text-sm">Gestão Clínica</span>
                </div>
                <span>{clinicModuleCount}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-blue-500" />
                  <span className="text-sm">Petshop</span>
                </div>
                <span>{petshopModuleCount}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-purple-500" />
                  <span className="text-sm">Financeiro</span>
                </div>
                <span>{financialModuleCount}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="h-5 w-5 text-blue-500" />
              Usuários Totais
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {mockTenants.reduce((total, tenant) => total + (tenant.users_count || 0), 0)}
            </div>
            <div className="text-sm text-gray-500 mt-2">
              Média de {(mockTenants.reduce((total, tenant) => total + (tenant.users_count || 0), 0) / (mockTenants.length || 1)).toFixed(1)} usuários por tenant
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Crescimento de Empresas</CardTitle>
          <CardDescription>Novos tenants ao longo do tempo</CardDescription>
          <Tabs 
            value={activePeriod} 
            onValueChange={setActivePeriod}
            className="mt-2"
          >
            <TabsList>
              <TabsTrigger value="week">Semana</TabsTrigger>
              <TabsTrigger value="month">Mês</TabsTrigger>
              <TabsTrigger value="year">Ano</TabsTrigger>
            </TabsList>
          </Tabs>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={generateGrowthData()}
                margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="Novos Tenants" fill="#4f46e5" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Tipos de Negócio</CardTitle>
            <CardDescription>Distribuição por segmento</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={businessTypeData}
                    cx="50%"
                    cy="50%"
                    labelLine={true}
                    label={renderCustomizedLabel}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {businessTypeData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Status de Assinatura</CardTitle>
            <CardDescription>Distribuição por status</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusData}
                    cx="50%"
                    cy="50%"
                    labelLine={true}
                    label={renderCustomizedLabel}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {statusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Módulos Contratados</CardTitle>
            <CardDescription>Distribuição por módulo</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={moduleData}
                    cx="50%"
                    cy="50%"
                    labelLine={true}
                    label={renderCustomizedLabel}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {moduleData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}