import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/components/ui/use-toast";
import { Badge } from "@/components/ui/badge";
import { TransportDriver } from "@/api/entities";
import { TransportVehicle } from "@/api/entities";
import { Tenant } from "@/api/entities";
import { Plus, Loader2, PhoneCall, Car, BookOpenText } from "lucide-react";

export default function FleetManagement() {
  const [drivers, setDrivers] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
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
          const driversData = await TransportDriver.filter({ tenant_id: tenants[0].id });
          setDrivers(driversData);
          const vehiclesData = await TransportVehicle.filter({ tenant_id: tenants[0].id });
          setVehicles(vehiclesData);
        }
      } else {
        const tenants = await Tenant.list();
        const activeTenant = tenants.find(t => t.status === "active");
        if (activeTenant) {
          setCurrentTenantId(activeTenant.id);
          const driversData = await TransportDriver.filter({ tenant_id: activeTenant.id });
          setDrivers(driversData);
          const vehiclesData = await TransportVehicle.filter({ tenant_id: activeTenant.id });
          setVehicles(vehiclesData);
        }
      }
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os dados da frota.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddDriver = async (event) => {
    event.preventDefault();
    const formData = new FormData(event.target);
    const driverData = {
      full_name: formData.get('driverName'),
      license_number: formData.get('licenseNumber'),
      phone: formData.get('phone'),
      type: formData.get('driverType'),
      status: 'active',
      tenant_id: currentTenantId
    };

    try {
      const newDriver = await TransportDriver.create(driverData);
      setDrivers([...drivers, newDriver]);
      event.target.reset();
      toast({
        title: "Sucesso",
        description: "Motorista adicionado com sucesso."
      });
    } catch (error) {
      console.error("Erro ao adicionar motorista:", error);
      toast({
        title: "Erro",
        description: "Não foi possível adicionar o motorista.",
        variant: "destructive"
      });
    }
  };

  const handleAddVehicle = async (event) => {
    event.preventDefault();
    const formData = new FormData(event.target);
    const vehicleData = {
      type: formData.get('vehicleType'),
      license_plate: formData.get('licensePlate'),
      model: formData.get('model'),
      max_capacity: parseInt(formData.get('maxCapacity')),
      status: 'active',
      tenant_id: currentTenantId
    };

    try {
      const newVehicle = await TransportVehicle.create(vehicleData);
      setVehicles([...vehicles, newVehicle]);
      event.target.reset();
      toast({
        title: "Sucesso",
        description: "Veículo adicionado com sucesso."
      });
    } catch (error) {
      console.error("Erro ao adicionar veículo:", error);
      toast({
        title: "Erro",
        description: "Não foi possível adicionar o veículo.",
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
          <CardTitle>Motoristas</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAddDriver} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="driverName">Nome do Motorista</Label>
                <Input
                  id="driverName"
                  name="driverName"
                  placeholder="Nome completo"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="licenseNumber">Número da CNH</Label>
                <Input
                  id="licenseNumber"
                  name="licenseNumber"
                  placeholder="Número da CNH"
                  required
                />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="phone">Telefone</Label>
                <Input
                  id="phone"
                  name="phone"
                  placeholder="(00) 00000-0000"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="driverType">Tipo</Label>
                <Select name="driverType" defaultValue="own">
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="own">Próprio</SelectItem>
                    <SelectItem value="third_party">Terceirizado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button type="submit">
              <Plus className="mr-2 h-4 w-4" />
              Adicionar Motorista
            </Button>
          </form>

          <div className="mt-6 space-y-4">
            {drivers.map((driver) => (
              <Card key={driver.id}>
                <CardContent className="pt-6">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div className="flex items-center space-x-4">
                      <div className="p-2 bg-blue-100 rounded-full">
                        <BookOpenText className="h-5 w-5 text-blue-600" />
                      </div>
                      <div>
                        <p className="font-medium">{driver.full_name}</p>
                        <p className="text-sm text-gray-500">CNH: {driver.license_number}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button variant="outline" size="sm">
                        <PhoneCall className="h-4 w-4 mr-2" />
                        {driver.phone}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Veículos</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAddVehicle} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="licensePlate">Placa</Label>
                <Input
                  id="licensePlate"
                  name="licensePlate"
                  placeholder="ABC-1234"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="model">Modelo</Label>
                <Input
                  id="model"
                  name="model"
                  placeholder="Modelo do veículo"
                  required
                />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="vehicleType">Tipo</Label>
                <Select name="vehicleType" defaultValue="own">
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="own">Próprio</SelectItem>
                    <SelectItem value="third_party">Terceirizado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="maxCapacity">Capacidade Máxima</Label>
                <Input
                  id="maxCapacity"
                  name="maxCapacity"
                  type="number"
                  placeholder="Capacidade máxima"
                  required
                />
              </div>
            </div>
            <Button type="submit">
              <Plus className="mr-2 h-4 w-4" />
              Adicionar Veículo
            </Button>
          </form>

          <div className="mt-6 space-y-4">
            {vehicles.map((vehicle) => (
              <Card key={vehicle.id}>
                <CardContent className="pt-6">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div className="flex items-center space-x-4">
                      <div className="p-2 bg-blue-100 rounded-full">
                        <Car className="h-5 w-5 text-blue-600" />
                      </div>
                      <div>
                        <p className="font-medium">{vehicle.model}</p>
                        <p className="text-sm text-gray-500">Placa: {vehicle.license_plate}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge variant="outline">
                        Capacidade: {vehicle.max_capacity}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}