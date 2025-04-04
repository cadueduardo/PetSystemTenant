import React, { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Clock,
  Calendar,
  User,
  CheckCircle2,
  PlayCircle,
  PauseCircle,
  Scissors,
  Clipboard,
  History,
  Phone
} from "lucide-react";
import ServiceTimer from "./ServiceTimer";

export default function ServiceDetailsPanel({ open, onOpenChange, service, onStatusChange, onRefresh }) {
  const [notes, setNotes] = useState(service?.notes || "");

  const getStatusBadge = (status) => {
    const statusConfig = {
      scheduled: {
        label: "Agendado",
        className: "bg-blue-100 text-blue-800"
      },
      in_progress: {
        label: "Em Atendimento",
        className: "bg-yellow-100 text-yellow-800"
      },
      paused: {
        label: "Pausado",
        className: "bg-amber-100 text-amber-800"
      },
      completed: {
        label: "Concluído",
        className: "bg-green-100 text-green-800"
      },
      cancelled: {
        label: "Cancelado",
        className: "bg-red-100 text-red-800"
      }
    };

    const config = statusConfig[status];
    return <Badge className={config.className}>{config.label}</Badge>;
  };

  const saveNotes = async () => {
    await onStatusChange(service.id, service.status, { notes });
    onRefresh();
  };

  if (!service) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-md w-full overflow-y-auto">
        <SheetHeader className="pb-4">
          <SheetTitle>Detalhes do Atendimento</SheetTitle>
          <SheetDescription>
            {service?.service?.name} - {format(new Date(service.appointment_date), "dd/MM/yyyy HH:mm")}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-5 py-4">
          {/* Status atual e timer */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500">Status atual:</span>
              {getStatusBadge(service.status)}
            </div>
            <ServiceTimer 
              service={service} 
              onUpdateStatus={(newStatus, additionalData) => 
                onStatusChange(service.id, newStatus, additionalData)
              } 
            />
          </div>
          
          <Separator />
          
          {/* Informações do Pet */}
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-lg flex items-center">
                <PauseCircle className="h-5 w-5 mr-2 text-amber-500" />
                Informações do Pet
              </CardTitle>
            </CardHeader>
            <CardContent className="py-2">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Nome:</span>
                  <span className="font-medium">{service.pet?.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Espécie:</span>
                  <span>{service.pet?.species === "dog" ? "Cachorro" : service.pet?.species === "cat" ? "Gato" : service.pet?.species}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Raça:</span>
                  <span>{service.pet?.breed}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Sexo:</span>
                  <span>{service.pet?.gender === "male" ? "Macho" : "Fêmea"}</span>
                </div>
              </div>
            </CardContent>
          </Card>
          
          {/* Informações do Cliente */}
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-lg flex items-center">
                <User className="h-5 w-5 mr-2 text-blue-500" />
                Informações do Cliente
              </CardTitle>
            </CardHeader>
            <CardContent className="py-2">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Nome:</span>
                  <span className="font-medium">{service.customer?.full_name}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">Telefone:</span>
                  <div className="flex items-center">
                    <span>{service.customer?.phone}</span>
                    <Button variant="ghost" size="icon" className="h-8 w-8 ml-1">
                      <Phone className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Email:</span>
                  <span className="text-sm">{service.customer?.email}</span>
                </div>
              </div>
            </CardContent>
          </Card>
          
          {/* Serviço */}
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-lg flex items-center">
                <Scissors className="h-5 w-5 mr-2 text-purple-500" />
                Detalhes do Serviço
              </CardTitle>
            </CardHeader>
            <CardContent className="py-2">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Serviço:</span>
                  <span className="font-medium">{service.service?.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Categoria:</span>
                  <span>
                    {service.service?.category === "banho" ? "Banho" : 
                    service.service?.category === "tosa" ? "Tosa" : 
                    service.service?.category === "spa" ? "Spa" : 
                    service.service?.category === "hidratacao" ? "Hidratação" : 
                    service.service?.category}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Duração estimada:</span>
                  <span>{service.service?.duration} minutos</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Preço:</span>
                  <span className="font-medium">
                    {service.service?.price.toLocaleString('pt-BR', {
                      style: 'currency',
                      currency: 'BRL'
                    })}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
          
          {/* Histórico de Pausas */}
          {service.pauses && service.pauses.length > 0 && (
            <Accordion type="single" collapsible>
              <AccordionItem value="pauses">
                <AccordionTrigger className="text-sm">
                  <div className="flex items-center">
                    <History className="h-4 w-4 mr-2" />
                    Histórico de Pausas ({service.pauses.length})
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-3">
                    {service.pauses.map((pause, index) => (
                      <div key={index} className="border rounded-md p-3 text-sm">
                        <div className="flex justify-between mb-1">
                          <span className="text-gray-500">Início:</span>
                          <span>{format(new Date(pause.start), "dd/MM HH:mm")}</span>
                        </div>
                        {pause.end && (
                          <div className="flex justify-between mb-1">
                            <span className="text-gray-500">Fim:</span>
                            <span>{format(new Date(pause.end), "dd/MM HH:mm")}</span>
                          </div>
                        )}
                        <div className="mt-2">
                          <span className="text-gray-500">Motivo:</span>
                          <p className="mt-1">{pause.reason}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          )}
          
          {/* Observações */}
          <div className="space-y-2">
            <div className="flex items-center">
              <Clipboard className="h-5 w-5 mr-2 text-gray-500" />
              <h3 className="text-base font-medium">Observações</h3>
            </div>
            <Textarea
              placeholder="Adicione observações sobre o atendimento..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
            />
            <Button 
              onClick={saveNotes} 
              className="w-full"
              variant="outline"
            >
              Salvar Observações
            </Button>
          </div>
        </div>
        
        <SheetFooter className="mt-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
            {service.status === "scheduled" && (
              <Button
                className="w-full"
                onClick={() => onStatusChange(service.id, "in_progress")}
              >
                <PlayCircle className="h-4 w-4 mr-2" />
                Iniciar Serviço
              </Button>
            )}
            
            {service.status === "in_progress" && (
              <>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => onStatusChange(service.id, "paused", { pauseReason: "Pausa solicitada" })}
                >
                  <PauseCircle className="h-4 w-4 mr-2" />
                  Pausar
                </Button>
                <Button
                  className="w-full"
                  onClick={() => onStatusChange(service.id, "completed")}
                >
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Concluir
                </Button>
              </>
            )}
            
            {service.status === "paused" && (
              <Button
                className="w-full"
                onClick={() => onStatusChange(service.id, "in_progress")}
              >
                <PlayCircle className="h-4 w-4 mr-2" />
                Retomar
              </Button>
            )}
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}