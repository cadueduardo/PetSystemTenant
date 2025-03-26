import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/components/ui/use-toast";
import { TransportConfig } from "@/api/entities";
import { Tenant } from "@/api/entities";
import { Save, Loader2 } from "lucide-react";

export default function AdvancedSettings() {
  const [config, setConfig] = useState({
    max_pets_per_vehicle: 5,
    min_time_between_pickups: 15,
    cancellation_policy: "24h",
    allow_recurring_bookings: false,
    auto_confirm_bookings: false
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
        description: "Não foi possível carregar as configurações avançadas.",
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

      if (configId) {
        await TransportConfig.update(configId, configData);
      } else {
        await TransportConfig.create(configData);
      }

      toast({
        title: "Sucesso",
        description: "Configurações avançadas salvas com sucesso."
      });
      loadData();
    } catch (error) {
      console.error("Erro ao salvar configurações:", error);
      toast({
        title: "Erro",
        description: "Não foi possível salvar as configurações avançadas.",
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
          <CardTitle>Configurações Avançadas do Serviço</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Limite de Pets por Veículo</Label>
              <Input
                type="number"
                value={config?.max_pets_per_vehicle || 5}
                onChange={(e) =>
                  setConfig({ ...config, max_pets_per_vehicle: parseInt(e.target.value) })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Tempo Mínimo entre Coletas (minutos)</Label>
              <Input
                type="number"
                value={config?.min_time_between_pickups || 15}
                onChange={(e) =>
                  setConfig({ ...config, min_time_between_pickups: parseInt(e.target.value) })
                }
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Política de Cancelamento</Label>
            <Select
              value={config?.cancellation_policy || "24h"}
              onValueChange={(value) =>
                setConfig({ ...config, cancellation_policy: value })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione a política" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="12h">12 horas antes</SelectItem>
                <SelectItem value="24h">24 horas antes</SelectItem>
                <SelectItem value="48h">48 horas antes</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>Permitir Agendamento Recorrente</Label>
                <p className="text-sm text-gray-500">
                  Habilitar agendamentos semanais/mensais
                </p>
              </div>
              <Switch
                checked={config?.allow_recurring_bookings || false}
                onCheckedChange={(checked) =>
                  setConfig({ ...config, allow_recurring_bookings: checked })
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label>Confirmação Automática</Label>
                <p className="text-sm text-gray-500">
                  Confirmar agendamentos automaticamente
                </p>
              </div>
              <Switch
                checked={config?.auto_confirm_bookings || false}
                onCheckedChange={(checked) =>
                  setConfig({ ...config, auto_confirm_bookings: checked })
                }
              />
            </div>
          </div>

          <Button onClick={handleSave} className="w-full">
            <Save className="w-4 h-4 mr-2" />
            Salvar Configurações
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}