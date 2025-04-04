import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/components/ui/use-toast";
import { TransportService } from "@/api/entities";
import { TransportConfig } from "@/api/entities";
import { Tenant } from "@/api/entities";
import { Save, Loader2 } from "lucide-react";

export default function GeneralSettings() {
  const [isLoading, setIsLoading] = useState(true);
  const [service, setService] = useState({
    name: "Leva e Traz",
    description: "Serviço de transporte de pets",
    status: "active",
    hours_start: "08:00",
    hours_end: "18:00",
    max_capacity_per_day: 10
  });
  const [config, setConfig] = useState({
    fleet_type: "own",
    auto_assign_routes: true
  });
  const [currentTenantId, setCurrentTenantId] = useState(null);
  const [serviceId, setServiceId] = useState(null);
  const [configId, setConfigId] = useState(null);

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
          const services = await TransportService.filter({ tenant_id: tenants[0].id });
          if (services.length > 0) {
            setService(services[0]);
            setServiceId(services[0].id);
          }
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
          const services = await TransportService.filter({ tenant_id: activeTenant.id });
          if (services.length > 0) {
            setService(services[0]);
            setServiceId(services[0].id);
          }
          const configs = await TransportConfig.filter({ tenant_id: activeTenant.id });
          if (configs.length > 0) {
            setConfig(configs[0]);
            setConfigId(configs[0].id);
          }
        }
      }
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar as configurações.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      if (!currentTenantId) {
        toast({
          title: "Erro",
          description: "Nenhuma clínica ativa encontrada.",
          variant: "destructive"
        });
        return;
      }

      if (serviceId) {
        await TransportService.update(serviceId, {
          ...service,
          tenant_id: currentTenantId
        });
      } else {
        const newService = await TransportService.create({
          ...service,
          tenant_id: currentTenantId
        });
        setServiceId(newService.id);
      }

      if (configId) {
        await TransportConfig.update(configId, {
          ...config,
          tenant_id: currentTenantId
        });
      } else {
        const newConfig = await TransportConfig.create({
          ...config,
          tenant_id: currentTenantId
        });
        setConfigId(newConfig.id);
      }

      toast({
        title: "Sucesso",
        description: "Configurações salvas com sucesso."
      });
      loadData();
    } catch (error) {
      console.error("Erro ao salvar configurações:", error);
      toast({
        title: "Erro",
        description: "Não foi possível salvar as configurações.",
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
    <form onSubmit={handleSubmit}>
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Configurações Gerais do Serviço</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="serviceName">Nome do Serviço</Label>
                <Input
                  id="serviceName"
                  value={service?.name || ''}
                  onChange={(e) => setService({ ...service, name: e.target.value })}
                  placeholder="Ex: Leva e Traz"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="serviceStatus">Status</Label>
                <Select
                  value={service?.status || 'active'}
                  onValueChange={(value) => setService({ ...service, status: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Ativo</SelectItem>
                    <SelectItem value="inactive">Inativo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Descrição</Label>
              <Input
                id="description"
                value={service?.description || ''}
                onChange={(e) => setService({ ...service, description: e.target.value })}
                placeholder="Descrição do serviço"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="hoursStart">Horário de Início</Label>
                <Input
                  id="hoursStart"
                  type="time"
                  value={service?.hours_start || '08:00'}
                  onChange={(e) => setService({ ...service, hours_start: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="hoursEnd">Horário de Término</Label>
                <Input
                  id="hoursEnd"
                  type="time"
                  value={service?.hours_end || '18:00'}
                  onChange={(e) => setService({ ...service, hours_end: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="maxCapacity">Capacidade Máxima Diária</Label>
              <Input
                id="maxCapacity"
                type="number"
                value={service?.max_capacity_per_day || '10'}
                onChange={(e) => setService({ ...service, max_capacity_per_day: parseInt(e.target.value) })}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Configurações de Operação</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fleetType">Tipo de Frota</Label>
              <Select
                value={config?.fleet_type || 'own'}
                onValueChange={(value) => setConfig({ ...config, fleet_type: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o tipo de frota" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="own">Própria</SelectItem>
                  <SelectItem value="third_party">Terceirizada</SelectItem>
                  <SelectItem value="hybrid">Híbrida</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Atribuição Automática de Rotas</Label>
                <p className="text-sm text-gray-500">
                  Permitir que o sistema atribua rotas automaticamente
                </p>
              </div>
              <Switch
                checked={config?.auto_assign_routes || false}
                onCheckedChange={(checked) => setConfig({ ...config, auto_assign_routes: checked })}
              />
            </div>

            <Button type="submit" className="w-full" disabled={isLoading}>
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
    </form>
  );
}