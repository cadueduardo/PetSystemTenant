import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DatePicker } from "@/components/ui/date-picker";
import { TransportReport } from "@/api/entities";
import { Tenant } from "@/api/entities";
import { Download, BarChart, PieChart, LineChart, Loader2 } from "lucide-react";

export default function ReportsView() {
  const [isLoading, setIsLoading] = useState(true);
  const [reports, setReports] = useState([]);
  const [selectedReport, setSelectedReport] = useState(null);

  useEffect(() => {
    loadReports();
  }, []);

  const loadReports = async () => {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const storeParam = urlParams.get('store');

      if (storeParam) {
        const tenants = await Tenant.filter({ access_url: storeParam });
        if (tenants.length > 0) {
          const reportsData = await TransportReport.filter({ tenant_id: tenants[0].id });
          setReports(reportsData);
        }
      } else {
        const tenants = await Tenant.list();
        const activeTenant = tenants.find(t => t.status === "active");
        if (activeTenant) {
          const reportsData = await TransportReport.filter({ tenant_id: activeTenant.id });
          setReports(reportsData);
        }
      }
    } catch (error) {
      console.error("Erro ao carregar relatórios:", error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Relatórios de Desempenho</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Select
                  value={selectedReport?.report_type}
                  onValueChange={(value) => setSelectedReport({ ...selectedReport, report_type: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o tipo de relatório" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="volume">Volume de Entregas</SelectItem>
                    <SelectItem value="zone_analysis">Análise por Zona</SelectItem>
                    <SelectItem value="timing">Tempo de Entrega</SelectItem>
                    <SelectItem value="revenue">Receita</SelectItem>
                    <SelectItem value="efficiency">Eficiência da Frota</SelectItem>
                    <SelectItem value="customer_satisfaction">Satisfação do Cliente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Select
                  value={selectedReport?.period_type}
                  onValueChange={(value) => setSelectedReport({ ...selectedReport, period_type: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o período" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Diário</SelectItem>
                    <SelectItem value="weekly">Semanal</SelectItem>
                    <SelectItem value="monthly">Mensal</SelectItem>
                    <SelectItem value="quarterly">Trimestral</SelectItem>
                    <SelectItem value="yearly">Anual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button className="w-full">
              <Download className="mr-2 h-4 w-4" />
              Gerar Relatório
            </Button>
          </div>

          <div className="mt-8">
            <p className="text-sm text-gray-500 mb-4">Relatórios Recentes</p>
            <div className="space-y-4">
              {reports.map((report) => (
                <Card key={report.id}>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        {report.report_type === 'volume' && <BarChart className="h-5 w-5 text-blue-500" />}
                        {report.report_type === 'zone_analysis' && <PieChart className="h-5 w-5 text-green-500" />}
                        {report.report_type === 'timing' && <LineChart className="h-5 w-5 text-purple-500" />}
                        <div>
                          <p className="font-medium">
                            {report.report_type === 'volume' && 'Volume de Entregas'}
                            {report.report_type === 'zone_analysis' && 'Análise por Zona'}
                            {report.report_type === 'timing' && 'Tempo de Entrega'}
                          </p>
                          <p className="text-sm text-gray-500">
                            Gerado em: {new Date(report.generated_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <Button variant="outline" size="sm">
                        <Download className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}