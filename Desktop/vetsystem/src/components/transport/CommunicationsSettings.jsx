import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";
import { TransportConfig } from "@/api/entities";
import { Tenant } from "@/api/entities";
import { Save, Loader2 } from "lucide-react";

export default function CommunicationsSettings() {
  const [config, setConfig] = useState({
    notification_settings: {
      send_customer_notifications: false,
      driver_arrival_alert_minutes: 15,
      driver_notification_method: "whatsapp"
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
            // Garantir que notification_settings existe
            if (!configs[0].notification_settings) {
              configs[0].notification_settings = {
                send_customer_notifications: false,
                driver_arrival_alert_minutes: 15,
                driver_notification_method: "whatsapp"
              };
            }
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
            // Garantir que notification_settings existe
            if (!configs[0].notification_settings) {
              configs[0].notification_settings = {
                send_customer_notifications: false,
                driver_arrival_alert_minutes: 15,
                driver_notification_method: "whatsapp"
              };
            }
            setConfig(configs[0]);
            setConfigId(configs[0].id);
          }
        }
      }
    } catch (error) {
      console.error("Erro ao carregar configurações:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar as configurações de comunicação.",
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

      // Garantir que notification_settings existe antes de salvar
      if (!config.notification_settings) {
        config.notification_settings = {
          send_customer_notifications: false,
          driver_arrival_alert_minutes: 15,
          driver_notification_method: "whatsapp"
        };
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
        description: "Configurações de comunicação salvas com sucesso."
      });
      loadData();
    } catch (error) {
      console.error("Erro ao salvar configurações:", error);
      toast({
        title: "Erro",
        description: "Não foi possível salvar as configurações de comunicação.",
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

  // Handle notification_settings changes safely
  const updateNotificationSettings = (key, value) => {
    setConfig({
      ...config,
      notification_settings: {
        ...(config.notification_settings || {}),
        [key]: value
      }
    });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Notificações ao Cliente</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Ativar Notificações</Label>
              <p className="text-sm text-gray-500">
                Enviar notificações automáticas aos clientes
              </p>
            </div>
            <Switch
              checked={(config.notification_settings?.send_customer_notifications) || false}
              onCheckedChange={(checked) => updateNotificationSettings('send_customer_notifications', checked)}
            />
          </div>

          <div className="space-y-2">
            <Label>Aviso de Chegada (minutos antes)</Label>
            <Input
              type="number"
              value={(config.notification_settings?.driver_arrival_alert_minutes) || 15}
              onChange={(e) => updateNotificationSettings('driver_arrival_alert_minutes', parseInt(e.target.value))}
            />
          </div>

          <div className="space-y-2">
            <Label>Método de Notificação</Label>
            <Select
              value={(config.notification_settings?.driver_notification_method) || "whatsapp"}
              onValueChange={(value) => updateNotificationSettings('driver_notification_method', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione o método" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="whatsapp">WhatsApp</SelectItem>
                <SelectItem value="sms">SMS</SelectItem>
                <SelectItem value="email">Email</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={isLoading}>
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
      </div>
    </div>
  );
}