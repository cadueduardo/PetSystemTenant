import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/use-toast";
import { TransportZonePricing } from "@/api/entities";
import { Tenant } from "@/api/entities";
import { Plus, Loader2, MapPin, Trash2 } from "lucide-react";

export default function ZonesSettings() {
  const [zones, setZones] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newZone, setNewZone] = useState({
    cep_start: "",
    cep_end: "",
    price: "",
    estimated_time: "30"
  });
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
          const zonesData = await TransportZonePricing.filter({ tenant_id: tenants[0].id });
          setZones(zonesData);
        }
      } else {
        const tenants = await Tenant.list();
        const activeTenant = tenants.find(t => t.status === "active");
        if (activeTenant) {
          setCurrentTenantId(activeTenant.id);
          const zonesData = await TransportZonePricing.filter({ tenant_id: activeTenant.id });
          setZones(zonesData);
        }
      }
    } catch (error) {
      console.error("Erro ao carregar zonas:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar as zonas de entrega.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddZone = async () => {
    try {
      if (!currentTenantId) {
        toast({
          title: "Erro",
          description: "Nenhuma clínica ativa encontrada.",
          variant: "destructive"
        });
        return;
      }

      const zoneData = {
        ...newZone,
        tenant_id: currentTenantId
      };

      await TransportZonePricing.create(zoneData);
      toast({
        title: "Sucesso",
        description: "Zona de entrega adicionada com sucesso."
      });
      setNewZone({
        cep_start: "",
        cep_end: "",
        price: "",
        estimated_time: "30"
      });
      loadData();
    } catch (error) {
      console.error("Erro ao adicionar zona:", error);
      toast({
        title: "Erro",
        description: "Não foi possível adicionar a zona de entrega.",
        variant: "destructive"
      });
    }
  };

  const handleDeleteZone = async (zoneId) => {
    try {
      await TransportZonePricing.delete(zoneId);
      toast({
        title: "Sucesso",
        description: "Zona de entrega removida com sucesso."
      });
      loadData();
    } catch (error) {
      console.error("Erro ao remover zona:", error);
      toast({
        title: "Erro",
        description: "Não foi possível remover a zona de entrega.",
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
          <CardTitle>Configuração de Zonas de Atendimento</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-4 mb-4">
            <div>
              <Label>CEP Inicial</Label>
              <Input
                value={newZone.cep_start}
                onChange={(e) => setNewZone({ ...newZone, cep_start: e.target.value })}
                placeholder="00000-000"
              />
            </div>
            <div>
              <Label>CEP Final</Label>
              <Input
                value={newZone.cep_end}
                onChange={(e) => setNewZone({ ...newZone, cep_end: e.target.value })}
                placeholder="00000-000"
              />
            </div>
            <div>
              <Label>Preço (R$)</Label>
              <Input
                type="number"
                value={newZone.price}
                onChange={(e) => setNewZone({ ...newZone, price: e.target.value })}
                placeholder="0.00"
              />
            </div>
            <div>
              <Label>Tempo Estimado (min)</Label>
              <Input
                type="number"
                value={newZone.estimated_time}
                onChange={(e) => setNewZone({ ...newZone, estimated_time: e.target.value })}
                placeholder="30"
              />
            </div>
          </div>
          <Button onClick={handleAddZone}>
            <Plus className="w-4 h-4 mr-2" />
            Adicionar Zona
          </Button>

          <div className="mt-6 space-y-4">
            {zones.map((zone) => (
              <Card key={zone.id}>
                <CardContent className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-4">
                    <div className="p-2 bg-blue-100 rounded-full">
                      <MapPin className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="font-medium">
                        CEP: {zone.cep_start} até {zone.cep_end}
                      </p>
                      <p className="text-sm text-gray-500">
                        R$ {zone.price.toFixed(2)} - {zone.estimated_time} min
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDeleteZone(zone.id)}
                  >
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}