import React, { useEffect, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { QueueService } from "@/api/entities";
import { Service } from "@/api/entities";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Loader2, Scissors, RefreshCw } from "lucide-react";

export default function PetGroomingHistory({ petId, groomingHistory, setGroomingHistory }) {
  const [isLoading, setIsLoading] = useState(false);
  const [services, setServices] = useState({});

  // Carregar informações de serviços
  useEffect(() => {
    const loadServices = async () => {
      try {
        const servicesData = await Service.list();
        const servicesMap = {};
        servicesData.forEach(service => {
          servicesMap[service.id] = service;
        });
        setServices(servicesMap);
      } catch (error) {
        console.error("Erro ao carregar serviços:", error);
      }
    };

    loadServices();
  }, []);

  const refreshGroomingHistory = async () => {
    if (!petId) return;
    
    setIsLoading(true);
    try {
      const grooming = await QueueService.filter({
        pet_id: petId,
        status: "completed"
      });
      
      // Enriquecer com dados do serviço
      const enrichedGrooming = await Promise.all(
        grooming.map(async (item) => {
          try {
            if (item.service_id) {
              const service = await Service.get(item.service_id);
              return { ...item, service };
            }
            return item;
          } catch (error) {
            console.error("Erro ao carregar serviço:", error);
            return item;
          }
        })
      );
      
      setGroomingHistory(enrichedGrooming);
      toast({
        title: "Histórico atualizado",
        description: "O histórico de banho e tosa foi atualizado com sucesso."
      });
    } catch (error) {
      console.error("Erro ao atualizar histórico de banho e tosa:", error);
      toast({
        title: "Erro",
        description: "Não foi possível atualizar o histórico de banho e tosa.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const calculateDuration = (service) => {
    if (!service.start_time || !service.end_time) return "N/A";
    
    const start = new Date(service.start_time);
    const end = new Date(service.end_time);
    const durationMs = end - start;
    
    // Converter para minutos
    const minutes = Math.floor(durationMs / 60000);
    
    if (minutes < 60) {
      return `${minutes} min`;
    } else {
      const hours = Math.floor(minutes / 60);
      const remainingMinutes = minutes % 60;
      return `${hours}h ${remainingMinutes}min`;
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-xl">Histórico de Banho e Tosa</CardTitle>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={refreshGroomingHistory}
          disabled={isLoading}
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <RefreshCw className="h-4 w-4 mr-2" />
          )}
          Atualizar
        </Button>
      </CardHeader>
      <CardContent>
        {!groomingHistory || groomingHistory.length === 0 ? (
          <div className="text-center py-8">
            <Scissors className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-700 mb-2">Nenhum serviço encontrado</h3>
            <p className="text-gray-500">
              Este pet ainda não tem serviços de banho e tosa concluídos.
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Serviço</TableHead>
                <TableHead>Duração</TableHead>
                <TableHead>Observações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {groomingHistory.map((service) => (
                <TableRow key={service.id}>
                  <TableCell>
                    {format(new Date(service.appointment_date), "dd/MM/yyyy", { locale: ptBR })}
                  </TableCell>
                  <TableCell>
                    {service.service?.name || 
                     services[service.service_id]?.name || 
                     "Serviço não encontrado"}
                  </TableCell>
                  <TableCell>{calculateDuration(service)}</TableCell>
                  <TableCell className="max-w-xs truncate">
                    {service.notes || "-"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}