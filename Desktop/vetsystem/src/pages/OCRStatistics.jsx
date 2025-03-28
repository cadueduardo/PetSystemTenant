import React, { useState, useEffect } from "react";
import { User } from "@/api/entities";
import { OCRStatistic } from "@/api/entities";
import { Tenant } from "@/api/entities";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  FileText,
  Loader2,
  CheckCircle,
  XCircle,
  Clock,
  FileBarChart,
  CalendarClock,
  Zap
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import OCRPerformanceChart from "../components/ocr/OCRPerformanceChart";
import OCRSuccessRateChart from "../components/ocr/OCRSuccessRateChart";

export default function OCRStatisticsPage() {
  const [statistics, setStatistics] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentTenant, setCurrentTenant] = useState(null);
  const [summaryData, setSummaryData] = useState({
    totalProcessed: 0,
    successCount: 0,
    failureCount: 0,
    averageTime: 0,
    successRate: 0
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const user = await User.me();
      const tenants = await Tenant.list();
      const activeTenant = tenants.find(t => t.status === "active");
      
      if (activeTenant) {
        setCurrentTenant(activeTenant);
        
        // Carregar estatísticas de OCR
        const ocrStats = await OCRStatistic.filter({ tenant_id: activeTenant.id });
        setStatistics(ocrStats);
        
        // Calcular dados de resumo
        if (ocrStats.length > 0) {
          const successCount = ocrStats.filter(stat => stat.success).length;
          const totalTime = ocrStats.reduce((total, stat) => total + (stat.processing_time_ms || 0), 0);
          
          setSummaryData({
            totalProcessed: ocrStats.length,
            successCount: successCount,
            failureCount: ocrStats.length - successCount,
            averageTime: totalTime / ocrStats.length,
            successRate: (successCount / ocrStats.length) * 100
          });
        }
      }
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto py-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold">Estatísticas de OCR</h1>
          <p className="text-gray-500">Análise de desempenho do processamento de documentos</p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-500">Total Processado</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-blue-500" />
                  <span className="text-2xl font-bold">{summaryData.totalProcessed}</span>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Documentos analisados via OCR
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-500">Taxa de Sucesso</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  <span className="text-2xl font-bold">{summaryData.successRate.toFixed(0)}%</span>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {summaryData.successCount} extrações bem-sucedidas
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-500">Falhas</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <XCircle className="h-5 w-5 text-red-500" />
                  <span className="text-2xl font-bold">{summaryData.failureCount}</span>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Extrações que exigiram correção manual
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-500">Tempo Médio</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-purple-500" />
                  <span className="text-2xl font-bold">{(summaryData.averageTime / 1000).toFixed(1)}s</span>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Tempo médio de processamento
                </p>
              </CardContent>
            </Card>
          </div>

          <Tabs defaultValue="charts">
            <TabsList className="mb-6">
              <TabsTrigger value="charts">Gráficos</TabsTrigger>
              <TabsTrigger value="log">Log de Processamento</TabsTrigger>
            </TabsList>
            
            <TabsContent value="charts">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <FileBarChart className="h-5 w-5 text-blue-500" />
                      Taxa de Sucesso por Tipo de Arquivo
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="h-80">
                    <OCRSuccessRateChart statistics={statistics} />
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Zap className="h-5 w-5 text-blue-500" />
                      Desempenho de Processamento
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="h-80">
                    <OCRPerformanceChart statistics={statistics} />
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
            
            <TabsContent value="log">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CalendarClock className="h-5 w-5 text-blue-500" />
                    Histórico de OCR
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Data</TableHead>
                          <TableHead>Tipo</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Tempo</TableHead>
                          <TableHead>Confiança</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {statistics.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={5} className="text-center py-6 text-gray-500">
                              Nenhum processamento OCR registrado ainda
                            </TableCell>
                          </TableRow>
                        ) : (
                          statistics.map((stat) => (
                            <TableRow key={stat.id}>
                              <TableCell>
                                {format(new Date(stat.processed_at), "dd/MM/yyyy HH:mm")}
                              </TableCell>
                              <TableCell>
                                {stat.file_type ? (
                                  <Badge variant="outline">
                                    {stat.file_type.split('/')[1]?.toUpperCase() || stat.file_type}
                                  </Badge>
                                ) : (
                                  <Badge variant="outline">Desconhecido</Badge>
                                )}
                              </TableCell>
                              <TableCell>
                                {stat.success ? (
                                  <div className="flex items-center gap-1">
                                    <CheckCircle className="h-4 w-4 text-green-500" />
                                    <span className="text-green-600">Sucesso</span>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-1">
                                    <XCircle className="h-4 w-4 text-red-500" />
                                    <span className="text-red-600">Falha</span>
                                  </div>
                                )}
                              </TableCell>
                              <TableCell>
                                {stat.processing_time_ms ? (
                                  `${(stat.processing_time_ms / 1000).toFixed(2)}s`
                                ) : (
                                  "N/A"
                                )}
                              </TableCell>
                              <TableCell>
                                {stat.confidence_score ? (
                                  `${stat.confidence_score.toFixed(0)}%`
                                ) : (
                                  "N/A"
                                )}
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}