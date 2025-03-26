import React, { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";

// Importar os componentes do serviço de transporte
import GeneralSettings from "../components/transport/GeneralSettings";
import ZonesSettings from "../components/transport/ZonesSettings";
import FleetManagement from "../components/transport/FleetManagement";
import OperationsManagement from "../components/transport/OperationsManagement";
import CommunicationsSettings from "../components/transport/CommunicationsSettings";
import SecuritySettings from "../components/transport/SecuritySettings";
import AdvancedSettings from "../components/transport/AdvancedSettings";

export default function TransportSettings() {
  const [activeTab, setActiveTab] = useState("general");

  return (
    <div className="container mx-auto py-6 px-4 sm:px-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-6">
        <Link to={createPageUrl("TransportServices")}>
          <Button variant="ghost" size="sm">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Configurações do Leva e Traz</h1>
          <p className="text-gray-500">Gerencie as configurações do serviço de transporte</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        {/* Versão para desktop - tabs horizontais */}
        <div className="hidden md:block">
          <TabsList className="grid grid-cols-7 mb-4">
            <TabsTrigger value="general">Geral</TabsTrigger>
            <TabsTrigger value="zones">Zonas</TabsTrigger>
            <TabsTrigger value="advanced">Avançado</TabsTrigger>
            <TabsTrigger value="fleet">Frota</TabsTrigger>
            <TabsTrigger value="operations">Operações</TabsTrigger>
            <TabsTrigger value="security">Segurança</TabsTrigger>
            <TabsTrigger value="communications">Comunicações</TabsTrigger>
          </TabsList>
        </div>
        
        {/* Versão para mobile - tabs verticais */}
        <div className="block md:hidden mb-4">
          <Card className="p-2">
            <TabsList className="flex flex-col space-y-1 w-full">
              <TabsTrigger value="general">Configurações Gerais</TabsTrigger>
              <TabsTrigger value="zones">Zonas de Atendimento</TabsTrigger>
              <TabsTrigger value="advanced">Conf. Avançadas</TabsTrigger>
              <TabsTrigger value="fleet">Gestão da Frota</TabsTrigger>
              <TabsTrigger value="operations">Operações</TabsTrigger>
              <TabsTrigger value="security">Segurança</TabsTrigger>
              <TabsTrigger value="communications">Comunicações</TabsTrigger>
            </TabsList>
          </Card>
        </div>

        <TabsContent value="general">
          <GeneralSettings />
        </TabsContent>

        <TabsContent value="zones">
          <ZonesSettings />
        </TabsContent>

        <TabsContent value="advanced">
          <AdvancedSettings />
        </TabsContent>

        <TabsContent value="fleet">
          <FleetManagement />
        </TabsContent>

        <TabsContent value="operations">
          <OperationsManagement />
        </TabsContent>

        <TabsContent value="security">
          <SecuritySettings />
        </TabsContent>

        <TabsContent value="communications">
          <CommunicationsSettings />
        </TabsContent>
      </Tabs>
    </div>
  );
}