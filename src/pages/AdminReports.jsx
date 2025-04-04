import React, { useState, useEffect } from "react";
import { User } from "@/api/entities";
import { Tenant } from "@/api/entities";
import { TenantUser } from "@/api/entities";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/use-toast";
import { format, subDays, differenceInDays } from "date-fns";
import {
  BarChart,
  PieChart,
  LineChart,
  Calendar,
  Users,
  Store,
  Activity,
  Clock,
  Loader2,
  Download,
  RefreshCw,
  ArrowUpRight,
  ArrowDownRight,
  Building
} from "lucide-react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar, Pie, Line } from 'react-chartjs-2';

// Registrar componentes do Chart.js
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
);

export default function AdminReports() {
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");
  const [tenants, setTenants] = useState([]);
  const [tenantUsers, setTenantUsers] = useState([]);
  const [dateRange, setDateRange] = useState({
    start: subDays(new Date(), 30),
    end: new Date()
  });
  const [metrics, setMetrics] = useState({
    totalTenants: 0,
    activeTenants: 0,
    pendingTenants: 0,
    avgSetupTime: 0,
    avgUsersPerTenant: 0,
    recentSignups: 0,
    completionRate: 0
  });
  const [charts, setCharts] = useState({
    tenantStatus: null,
    setupTimeDistribution: null,
    signupsTimeline: null,
    modulesDistribution: null
  });

  useEffect(() => {
    verifyAdminAccess();
    loadData();
  }, []);

  const verifyAdminAccess = async () => {
    try {
      const userData = await User.me();
      if (userData.role !== 'admin') {
        window.location.href = "/Dashboard";
      }
    } catch (error) {
      console.error("Erro ao verificar permissões:", error);
      window.location.href = "/Landing";
    }
  };

  const loadData = async () => {
    setIsLoading(true);
    try {
      // Carregar todos os tenants
      const tenantsData = await Tenant.list();
      setTenants(tenantsData);
      
      // Carregar usuários de todos os tenants
      const usersData = await TenantUser.list();
      setTenantUsers(usersData);
      
      // Calcular métricas
      calculateMetrics(tenantsData, usersData);
      
      // Preparar dados para gráficos
      prepareChartData(tenantsData, usersData);
      
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os dados dos relatórios.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const calculateMetrics = (tenantsData, usersData) => {
    // Filtrar por período selecionado
    const filteredTenants = tenantsData.filter(tenant => {
      const createdDate = new Date(tenant.created_date);
      return createdDate >= dateRange.start && createdDate <= dateRange.end;
    });
    
    // Total de tenants
    const totalTenants = filteredTenants.length;
    
    // Tenants ativos e pendentes
    const activeTenants = filteredTenants.filter(tenant => 
      tenant.setup_status === "completed" && tenant.status === "active"
    ).length;
    
    const pendingTenants = filteredTenants.filter(tenant => 
      tenant.setup_status === "pending" || tenant.setup_status === "in_progress"
    ).length;
    
    // Tempo médio de setup
    let totalSetupTime = 0;
    let setupTenantsCount = 0;
    
    filteredTenants.forEach(tenant => {
      if (tenant.setup_status === "completed" && tenant.created_date) {
        const createdDate = new Date(tenant.created_date);
        const updatedDate = new Date(tenant.updated_date);
        const setupTime = differenceInDays(updatedDate, createdDate);
        
        if (setupTime >= 0) {
          totalSetupTime += setupTime;
          setupTenantsCount++;
        }
      }
    });
    
    const avgSetupTime = setupTenantsCount > 0 ? (totalSetupTime / setupTenantsCount).toFixed(1) : 0;
    
    // Média de usuários por tenant
    const tenantUserCounts = {};
    usersData.forEach(user => {
      if (user.tenant_id) {
        tenantUserCounts[user.tenant_id] = (tenantUserCounts[user.tenant_id] || 0) + 1;
      }
    });
    
    const userCountsArray = Object.values(tenantUserCounts);
    const avgUsersPerTenant = userCountsArray.length > 0 
      ? (userCountsArray.reduce((a, b) => a + b, 0) / userCountsArray.length).toFixed(1) 
      : 0;
    
    // Tenants criados nos últimos 7 dias
    const lastWeekDate = subDays(new Date(), 7);
    const recentSignups = filteredTenants.filter(tenant => 
      new Date(tenant.created_date) >= lastWeekDate
    ).length;
    
    // Taxa de conclusão do onboarding
    const startedOnboarding = filteredTenants.filter(tenant => 
      tenant.setup_status === "pending" || tenant.setup_status === "in_progress" || tenant.setup_status === "completed"
    ).length;
    
    const completedOnboarding = filteredTenants.filter(tenant => tenant.setup_status === "completed").length;
    
    const completionRate = startedOnboarding > 0 
      ? Math.round((completedOnboarding / startedOnboarding) * 100) 
      : 0;
    
    setMetrics({
      totalTenants,
      activeTenants,
      pendingTenants,
      avgSetupTime,
      avgUsersPerTenant,
      recentSignups,
      completionRate
    });
  };

  const prepareChartData = (tenantsData, usersData) => {
    // 1. Distribuição de status dos tenants
    const statusCounts = {
      active: 0,
      pending: 0,
      inProgress: 0,
      expired: 0
    };
    
    tenantsData.forEach(tenant => {
      if (tenant.status === "active" && tenant.setup_status === "completed") {
        statusCounts.active++;
      } else if (tenant.setup_status === "pending") {
        statusCounts.pending++;
      } else if (tenant.setup_status === "in_progress") {
        statusCounts.inProgress++;
      } else if (tenant.status === "expired" || tenant.status === "suspended") {
        statusCounts.expired++;
      }
    });
    
    const tenantStatusData = {
      labels: ['Ativo', 'Pendente', 'Em Progresso', 'Expirado'],
      datasets: [
        {
          data: [statusCounts.active, statusCounts.pending, statusCounts.inProgress, statusCounts.expired],
          backgroundColor: ['#10b981', '#f59e0b', '#3b82f6', '#ef4444'],
          borderWidth: 1
        },
      ],
    };
    
    // 2. Distribuição de tempo de setup
    const setupTimes = [];
    tenantsData.forEach(tenant => {
      if (tenant.setup_status === "completed" && tenant.created_date) {
        const createdDate = new Date(tenant.created_date);
        const updatedDate = new Date(tenant.updated_date);
        const setupTime = differenceInDays(updatedDate, createdDate);
        
        if (setupTime >= 0) {
          setupTimes.push(setupTime);
        }
      }
    });
    
    // Agrupar tempos em categorias
    const setupTimeBuckets = {
      "Mesmo dia": 0,
      "1-2 dias": 0,
      "3-7 dias": 0,
      ">7 dias": 0
    };
    
    setupTimes.forEach(time => {
      if (time < 1) {
        setupTimeBuckets["Mesmo dia"]++;
      } else if (time <= 2) {
        setupTimeBuckets["1-2 dias"]++;
      } else if (time <= 7) {
        setupTimeBuckets["3-7 dias"]++;
      } else {
        setupTimeBuckets[">7 dias"]++;
      }
    });
    
    const setupTimeDistributionData = {
      labels: Object.keys(setupTimeBuckets),
      datasets: [
        {
          label: 'Número de Lojas',
          data: Object.values(setupTimeBuckets),
          backgroundColor: '#3b82f6',
          borderColor: '#2563eb',
          borderWidth: 1
        }
      ]
    };
    
    // 3. Timeline de cadastros por mês
    const last6Months = Array.from({length: 6}, (_, i) => {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      return format(date, 'MMM/yyyy');
    }).reverse();
    
    const signupsByMonth = {};
    last6Months.forEach(month => {
      signupsByMonth[month] = 0;
    });
    
    tenantsData.forEach(tenant => {
      const createdDate = new Date(tenant.created_date);
      const monthYear = format(createdDate, 'MMM/yyyy');
      
      if (signupsByMonth.hasOwnProperty(monthYear)) {
        signupsByMonth[monthYear]++;
      }
    });
    
    const signupsTimelineData = {
      labels: last6Months,
      datasets: [
        {
          label: 'Novas Lojas',
          data: last6Months.map(month => signupsByMonth[month]),
          fill: false,
          borderColor: 'rgb(75, 192, 192)',
          tension: 0.1
        }
      ]
    };
    
    // 4. Distribuição de módulos selecionados
    const modulesCounts = {
      clinic_management: 0,
      petshop: 0,
      financial: 0
    };
    
    tenantsData.forEach(tenant => {
      if (tenant.selected_modules) {
        tenant.selected_modules.forEach(module => {
          if (modulesCounts.hasOwnProperty(module)) {
            modulesCounts[module]++;
          }
        });
      }
    });
    
    const modulesNames = {
      clinic_management: "Gestão Clínica",
      petshop: "Petshop",
      financial: "Financeiro"
    };
    
    const modulesDistributionData = {
      labels: Object.keys(modulesCounts).map(key => modulesNames[key]),
      datasets: [
        {
          label: 'Módulos Selecionados',
          data: Object.values(modulesCounts),
          backgroundColor: ['#f472b6', '#a78bfa', '#60a5fa'],
          borderWidth: 1
        }
      ]
    };
    
    setCharts({
      tenantStatus: tenantStatusData,
      setupTimeDistribution: setupTimeDistributionData,
      signupsTimeline: signupsTimelineData,
      modulesDistribution: modulesDistributionData
    });
  };

  const handleExportData = () => {
    try {
      const reportData = {
        generatedAt: new Date().toISOString(),
        dateRange: {
          start: dateRange.start.toISOString(),
          end: dateRange.end.toISOString(),
        },
        metrics,
        tenants: tenants.map(tenant => ({
          id: tenant.id,
          company_name: tenant.company_name,
          created_date: tenant.created_date,
          status: tenant.status,
          setup_status: tenant.setup_status,
          selected_modules: tenant.selected_modules
        }))
      };
      
      const dataStr = JSON.stringify(reportData, null, 2);
      const dataUri = `data:application/json;charset=utf-8,${encodeURIComponent(dataStr)}`;
      
      const exportFileDefaultName = `admin-report-${format(new Date(), 'yyyy-MM-dd')}.json`;
      
      const linkElement = document.createElement('a');
      linkElement.setAttribute('href', dataUri);
      linkElement.setAttribute('download', exportFileDefaultName);
      linkElement.click();
      
      toast({
        title: "Relatório exportado",
        description: "Os dados foram exportados com sucesso."
      });
    } catch (error) {
      console.error("Erro ao exportar dados:", error);
      toast({
        title: "Erro",
        description: "Não foi possível exportar os dados.",
        variant: "destructive"
      });
    }
  };

  const handleRefresh = () => {
    loadData();
  };

  const handleDateRangeChange = (newRange) => {
    setDateRange(newRange);
    // Recalcular métricas e gráficos com o novo intervalo
    calculateMetrics(tenants, tenantUsers);
    prepareChartData(tenants, tenantUsers);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-12 w-12 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold">Relatórios Administrativos</h1>
          <p className="text-gray-500">Análise de desempenho das lojas e métricas do sistema</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleRefresh}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Atualizar
          </Button>
          <Button onClick={handleExportData}>
            <Download className="h-4 w-4 mr-2" />
            Exportar Dados
          </Button>
        </div>
      </div>

      {/* Filtros */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4 items-end">
            <div className="space-y-2 flex-1">
              <Label>Período do Relatório</Label>
              <div className="flex gap-4">
                <div className="w-full">
                  <Label htmlFor="startDate" className="text-xs">Data Inicial</Label>
                  <DatePicker
                    id="startDate"
                    date={dateRange.start}
                    setDate={(date) => handleDateRangeChange({...dateRange, start: date})}
                    className="w-full"
                  />
                </div>
                <div className="w-full">
                  <Label htmlFor="endDate" className="text-xs">Data Final</Label>
                  <DatePicker
                    id="endDate"
                    date={dateRange.end}
                    setDate={(date) => handleDateRangeChange({...dateRange, end: date})}
                    className="w-full"
                  />
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Cards com métricas resumidas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Total de Lojas</p>
                <h3 className="text-2xl font-bold mt-1">{metrics.totalTenants}</h3>
                <div className="flex items-center mt-1">
                  <span className="text-xs text-green-600 flex items-center">
                    <ArrowUpRight className="h-3 w-3 mr-1" />
                    {metrics.recentSignups} novos nos últimos 7 dias
                  </span>
                </div>
              </div>
              <div className="bg-blue-100 p-3 rounded-full">
                <Store className="h-5 w-5 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Onboarding Pendente</p>
                <h3 className="text-2xl font-bold mt-1">{metrics.pendingTenants}</h3>
                <div className="flex items-center mt-1">
                  <span className="text-xs text-gray-600">
                    {metrics.completionRate}% taxa de conclusão
                  </span>
                </div>
              </div>
              <div className="bg-amber-100 p-3 rounded-full">
                <Clock className="h-5 w-5 text-amber-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Tempo Médio de Setup</p>
                <h3 className="text-2xl font-bold mt-1">{metrics.avgSetupTime} dias</h3>
                <div className="flex items-center mt-1">
                  <span className="text-xs text-gray-600">
                    Para lojas com onboarding completo
                  </span>
                </div>
              </div>
              <div className="bg-green-100 p-3 rounded-full">
                <Activity className="h-5 w-5 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Usuários por Loja</p>
                <h3 className="text-2xl font-bold mt-1">{metrics.avgUsersPerTenant}</h3>
                <div className="flex items-center mt-1">
                  <span className="text-xs text-gray-600">
                    Média de funcionários cadastrados
                  </span>
                </div>
              </div>
              <div className="bg-purple-100 p-3 rounded-full">
                <Users className="h-5 w-5 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="overview" value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="overview">
            <BarChart className="h-4 w-4 mr-2" />
            Visão Geral
          </TabsTrigger>
          <TabsTrigger value="tenants">
            <Building className="h-4 w-4 mr-2" />
            Lojas
          </TabsTrigger>
          <TabsTrigger value="onboarding">
            <Activity className="h-4 w-4 mr-2" />
            Onboarding
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Gráfico de Status de Lojas */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Status das Lojas</CardTitle>
                <CardDescription>
                  Distribuição de lojas por status atual
                </CardDescription>
              </CardHeader>
              <CardContent>
                {charts.tenantStatus && (
                  <div className="w-full h-[300px] flex items-center justify-center">
                    <Pie 
                      data={charts.tenantStatus} 
                      options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                          legend: {
                            position: 'bottom',
                          }
                        }
                      }}
                    />
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Gráfico de Módulos Selecionados */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Módulos Selecionados</CardTitle>
                <CardDescription>
                  Quais módulos são mais populares
                </CardDescription>
              </CardHeader>
              <CardContent>
                {charts.modulesDistribution && (
                  <div className="w-full h-[300px] flex items-center justify-center">
                    <Bar 
                      data={charts.modulesDistribution}
                      options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                          legend: {
                            display: false
                          }
                        }
                      }}
                    />
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Gráfico de Linha do Tempo */}
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle className="text-lg">Criação de Lojas ao Longo do Tempo</CardTitle>
                <CardDescription>
                  Novas lojas por mês nos últimos 6 meses
                </CardDescription>
              </CardHeader>
              <CardContent>
                {charts.signupsTimeline && (
                  <div className="w-full h-[300px] flex items-center justify-center">
                    <Line 
                      data={charts.signupsTimeline}
                      options={{
                        responsive: true,
                        maintainAspectRatio: false,
                      }}
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="tenants">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Lista de Lojas</CardTitle>
              <CardDescription>
                Todas as lojas cadastradas no sistema ({tenants.length})
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Nome da Loja
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Data de Criação
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Onboarding
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Usuários
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {tenants.slice(0, 10).map((tenant) => {
                      const userCount = tenantUsers.filter(user => user.tenant_id === tenant.id).length;
                      
                      return (
                        <tr key={tenant.id}>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">{tenant.company_name}</div>
                            <div className="text-sm text-gray-500">{tenant.legal_name}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">
                              {format(new Date(tenant.created_date), 'dd/MM/yyyy')}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                              ${tenant.status === 'active' ? 'bg-green-100 text-green-800' : 
                                tenant.status === 'trial' ? 'bg-blue-100 text-blue-800' : 
                                'bg-red-100 text-red-800'}`}>
                              {tenant.status === 'active' ? 'Ativo' : 
                               tenant.status === 'trial' ? 'Trial' : 
                               tenant.status === 'suspended' ? 'Suspenso' : 'Expirado'}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                              ${tenant.setup_status === 'completed' ? 'bg-green-100 text-green-800' : 
                                tenant.setup_status === 'in_progress' ? 'bg-yellow-100 text-yellow-800' : 
                                'bg-gray-100 text-gray-800'}`}>
                              {tenant.setup_status === 'completed' ? 'Concluído' : 
                               tenant.setup_status === 'in_progress' ? 'Em Progresso' : 'Pendente'}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {userCount} usuários
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {tenants.length > 10 && (
                  <div className="px-6 py-3 bg-gray-50 text-right text-sm">
                    <span className="text-gray-500">Exibindo 10 de {tenants.length} lojas</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="onboarding">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Tempo de Configuração</CardTitle>
                <CardDescription>
                  Quanto tempo leva para completar o onboarding
                </CardDescription>
              </CardHeader>
              <CardContent>
                {charts.setupTimeDistribution && (
                  <div className="w-full h-[300px] flex items-center justify-center">
                    <Bar 
                      data={charts.setupTimeDistribution}
                      options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                          legend: {
                            display: false
                          }
                        }
                      }}
                    />
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Estatísticas de Onboarding</CardTitle>
                <CardDescription>
                  Análise detalhada do processo de configuração
                </CardDescription>
              </CardHeader>
              <CardContent>
                <dl className="space-y-4">
                  <div className="flex justify-between">
                    <dt className="text-sm font-medium text-gray-500">Taxa de conclusão</dt>
                    <dd className="text-sm font-semibold">{metrics.completionRate}%</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-sm font-medium text-gray-500">Tempo médio para conclusão</dt>
                    <dd className="text-sm font-semibold">{metrics.avgSetupTime} dias</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-sm font-medium text-gray-500">Lojas com onboarding pendente</dt>
                    <dd className="text-sm font-semibold">{metrics.pendingTenants}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-sm font-medium text-gray-500">Lojas com onboarding concluído</dt>
                    <dd className="text-sm font-semibold">{metrics.activeTenants}</dd>
                  </div>
                </dl>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}