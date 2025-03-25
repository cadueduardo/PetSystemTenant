import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/components/ui/use-toast";
import { VehicleHygiene } from "@/api/entities";
import { TransportConfig } from "@/api/entities";
import { Tenant } from "@/api/entities";
import { Save, Loader2, Sprout } from "lucide-react";

export default function SecuritySettings() {
  const [config, setConfig] = useState({
    security_checklist_required: false,
    hygiene_photo_required: false,
    hygiene_frequency: "daily"
  });
  const [hygieneRecords, setHygieneRecords] = useState([]);
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
          const hygieneData = await VehicleHygiene.filter({ tenant_id: tenants[0].id });
          setHygieneRecords(hygieneData);
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
          const hygieneData = await VehicleHygiene.filter({ tenant_id: activeTenant.id });
          setHygieneRecords(hygieneData);
        }
      }
    } catch (error) {
      console.error("Erro ao carregar configurações:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar as configurações de segurança.",
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
        description: "Configurações de segurança salvas com sucesso."
      });
      loadData();
    } catch (error) {
      console.error("Erro ao salvar configurações:", error);
      toast({
        title: "Erro",
        description: "Não foi possível salvar as configurações de segurança.",
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
          <CardTitle>Segurança e Higienização</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>Checklist de Segurança</Label>
                <p className="text-sm text-gray-500">
                  Exigir checklist antes de cada viagem
                </p>
              </div>
              <Switch
                checked={config?.security_checklist_required || false}
                onCheckedChange={(checked) =>
                  setConfig({ ...config, security_checklist_required: checked })
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label>Foto da Higienização</Label>
                <p className="text-sm text-gray-500">
                  Exigir foto após higienização
                </p>
              </div>
              <Switch
                checked={config?.hygiene_photo_required || false}
                onCheckedChange={(checked) =>
                  setConfig({ ...config, hygiene_photo_required: checked })
                }
              />
            </div>

            <div className="space-y-2">
              <Label>Frequência de Higienização</Label>
              <Select
                value={config?.hygiene_frequency || "daily"}
                onValueChange={(value) =>
                  setConfig({ ...config, hygiene_frequency: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a frequência" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Diária</SelectItem>
                  <SelectItem value="after_each_trip">Após cada viagem</SelectItem>
                  <SelectItem value="twice_daily">Duas vezes ao dia</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="pt-4">
              <Button onClick={handleSave} className="w-full">
                <Save className="w-4 h-4 mr-2" />
                Salvar Configurações
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Histórico de Higienização</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {hygieneRecords.length === 0 ? (
              <p className="text-center text-gray-500 py-4">Nenhum registro de higienização encontrado</p>
            ) : (
              hygieneRecords.map((record) => (
                <Card key={record.id}>
                  <CardContent className="flex items-center justify-between p-4">
                    <div className="flex items-center gap-4">
                      <div className="p-2 bg-green-100 rounded-full">
                        <Sprout className="w-5 h-5 text-green-600" />
                      </div>
                      <div>
                        <p className="font-medium">
                          {new Date(record.date).toLocaleDateString()}
                        </p>
                        <p className="text-sm text-gray-500">
                          Realizada por: {record.performed_by}
                        </p>
                      </div>
                    </div>
                    <Button variant="outline" size="sm">
                      Ver Detalhes
                    </Button>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}