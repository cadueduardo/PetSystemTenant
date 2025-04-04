import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/components/ui/use-toast";
import { TransportConfig } from "@/api/entities";
import { Tenant } from "@/api/entities";
import { Save, Loader2 } from "lucide-react";

export default function OperationsManagement() {
  const [config, setConfig] = useState({
    route_optimization_method: "balance",
    hybrid_settings: {
      own_fleet_max_capacity: 10
    }
  });
  const [isLoading, setIsLoading] = useState(true);
  const [configId, setConfigId] = useState(null);
  const [currentTenantId, setCurrentTenantId] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const storeParam = urlParams.get('store');

      if (storeParam) {
        const tenants = await Tenant.filter({ access_url: storeParam });
        if (tenants.length > 0) {
          setCurrentTenantId(tenants[0].id);
          const configs = await TransportConfig.filter({ tenant_id: tenants[0].id });
          if (configs.length > 0) {
            setConfig(configs[0]);
            setConfigId(configs[0].id);
          }
        }
      } else {
        const tenants = await Tenant.list();
        const activeTenant = tenants.find(t => t.status === "active");
        if (activeTenant) {
          setCurrentTenantId(activeTenant.id);
          const configs = await TransportConfig.filter({ tenant_id: activeTenant.id });
          if (configs.length > 0) {
            setConfig(configs[0]);
            setConfigId(configs[0].id);
          }
        }
      }
    } catch (error) {
      console.error("Erro ao carregar configurações:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar as configurações operacionais.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      if (!currentTenantId) {
        toast({
          title: "Erro",
          description: "Nenhuma clínica ativa encontrada.",
          variant: "destructive"
        });
        return;
      }

      const configData = {
        ...config,
        tenant_id: currentTenantId
      };

      if (!configData.fleet_type) {
        configData.fleet_type = "own";
      }

      if (configId) {
        await TransportConfig.update(configId, configData);
      } else {
        const newConfig = await TransportConfig.create(configData);
        setConfigId(newConfig.id);
      }

      toast({
        title: "Sucesso",
        description: "Configurações operacionais salvas com sucesso."
      });
      loadData();
    } catch (error) {
      console.error("Erro ao salvar configurações:", error);
      toast({
        title: "Erro",
        description: "Não foi possível salvar as configurações operacionais.",
        variant: "destructive"
      });
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
          <CardTitle>Configurações de Rota</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label>Método de Otimização de Rotas</Label>
            <Select
              value={config?.route_optimization_method || "balance"}
              onValueChange={(value) =>
                setConfig({ ...config, route_optimization_method: value })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione o método" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="distance">Menor Distância</SelectItem>
                <SelectItem value="time">Menor Tempo</SelectItem>
                <SelectItem value="balance">Balanceado</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {config?.fleet_type === "hybrid" && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Capacidade Máxima da Frota Própria</Label>
                <Input
                  type="number"
                  value={config?.hybrid_settings?.own_fleet_max_capacity || 10}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      hybrid_settings: {
                        ...config.hybrid_settings,
                        own_fleet_max_capacity: parseInt(e.target.value)
                      }
                    })
                  }
                />
              </div>
            </div>
          )}

          <Button onClick={handleSave} className="w-full" disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Salvando...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Salvar Configurações
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}