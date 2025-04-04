import React, { useState, useEffect } from "react";
import { MedicalRecord } from "@/api/entities";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  FileText,
  Calendar,
  Clipboard,
  User,
  Plus,
  Loader2
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import MedicalRecordForm from "../medical/MedicalRecordForm";

export default function MedicalRecordList({ pet, onRecordCreated }) {
  const [records, setRecords] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showNewRecordModal, setShowNewRecordModal] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [showRecordDetails, setShowRecordDetails] = useState(false);

  useEffect(() => {
    if (pet?.id) {
      loadRecords();
    }
  }, [pet]);

  const loadRecords = async () => {
    try {
      setIsLoading(true);
      const tenantId = localStorage.getItem('current_tenant');
      const medicalRecords = await MedicalRecord.filter({ pet_id: pet.id, tenant_id: tenantId });
      setRecords(medicalRecords);
    } catch (error) {
      console.error("Erro ao carregar prontuários:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os prontuários médicos.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleNewRecord = async (recordData) => {
    try {
      const newRecord = await MedicalRecord.create({
        ...recordData,
        pet_id: pet.id,
        tenant_id: localStorage.getItem('current_tenant')
      });
      
      setRecords([newRecord, ...records]);
      setShowNewRecordModal(false);
      
      toast({
        title: "Sucesso",
        description: "Prontuário criado com sucesso!"
      });
      
      if (onRecordCreated) {
        onRecordCreated(newRecord);
      }
    } catch (error) {
      console.error("Erro ao criar prontuário:", error);
      toast({
        title: "Erro",
        description: "Não foi possível criar o prontuário.",
        variant: "destructive"
      });
    }
  };

  const getRecordTypeBadge = (type) => {
    switch (type) {
      case "consultation":
        return <Badge className="bg-blue-100 text-blue-800">Consulta</Badge>;
      case "exam":
        return <Badge className="bg-purple-100 text-purple-800">Exame</Badge>;
      case "treatment":
        return <Badge className="bg-green-100 text-green-800">Tratamento</Badge>;
      case "vaccination":
        return <Badge className="bg-amber-100 text-amber-800">Vacinação</Badge>;
      case "surgery":
        return <Badge className="bg-red-100 text-red-800">Cirurgia</Badge>;
      case "hospitalization":
        return <Badge className="bg-indigo-100 text-indigo-800">Internação</Badge>;
      case "telemedicine":
        return <Badge className="bg-cyan-100 text-cyan-800">Telemedicina</Badge>;
      default:
        return <Badge variant="outline">{type}</Badge>;
    }
  };

  const formatRecordType = (type) => {
    switch (type) {
      case "consultation": return "Consulta";
      case "exam": return "Exame";
      case "treatment": return "Tratamento";
      case "vaccination": return "Vacinação";
      case "surgery": return "Cirurgia";
      case "hospitalization": return "Internação";
      case "telemedicine": return "Telemedicina";
      default: return type;
    }
  };

  const handleRecordClick = (record) => {
    setSelectedRecord(record);
    setShowRecordDetails(true);
  };

  return (
    <div>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-xl font-bold">Prontuários Médicos</CardTitle>
          <Button onClick={() => setShowNewRecordModal(true)} className="h-8 px-2">
            <Plus className="mr-1 h-4 w-4" />
            Novo Prontuário
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center items-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
            </div>
          ) : records.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>Nenhum prontuário médico encontrado.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {records.map((record) => (
                <div 
                  key={record.id}
                  className="p-4 border rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                  onClick={() => handleRecordClick(record)}
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between mb-2">
                    <div className="flex items-center gap-2 mb-2 md:mb-0">
                      {getRecordTypeBadge(record.record_type)}
                    </div>
                    <div className="flex items-center gap-1 text-sm text-gray-600">
                      <Calendar className="h-4 w-4" />
                      {format(new Date(record.date), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                    </div>
                  </div>
                  
                  <p className="font-medium">{record.title}</p>
                  {record.doctor && (
                    <p className="text-sm text-gray-600">Veterinário: {record.doctor}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal de novo prontuário */}
      <Dialog 
        open={showNewRecordModal} 
        onOpenChange={setShowNewRecordModal}
      >
        <DialogContent className="w-[90vw] max-w-[90vw] h-[90vh] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Novo Registro Médico</DialogTitle>
            <DialogDescription>
              Adicione um novo registro médico para o pet
            </DialogDescription>
          </DialogHeader>
          <MedicalRecordForm 
            onSubmit={handleNewRecord}
            onCancel={() => setShowNewRecordModal(false)}
            pet={pet}
          />
        </DialogContent>
      </Dialog>

      {/* Modal de detalhes do prontuário */}
      <Dialog 
        open={showRecordDetails} 
        onOpenChange={setShowRecordDetails}
      >
        <DialogContent className="w-[90vw] max-w-[90vw] h-[90vh] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalhes do Registro Médico</DialogTitle>
            <DialogDescription>
              Visualize os detalhes do registro médico selecionado
            </DialogDescription>
          </DialogHeader>
          {selectedRecord && (
            <div className="space-y-6 p-4">
              <div className="space-y-2">
                <h2 className="text-2xl font-bold">{selectedRecord.title}</h2>
                <div className="flex flex-wrap gap-2">
                  {getRecordTypeBadge(selectedRecord.record_type)}
                  <Badge variant="outline">
                    {format(new Date(selectedRecord.date), "dd/MM/yyyy", { locale: ptBR })}
                  </Badge>
                </div>
              </div>
              
              <Tabs defaultValue="soap">
                <TabsList className="mb-4">
                  <TabsTrigger value="soap">SOAP</TabsTrigger>
                  <TabsTrigger value="vitals">Sinais Vitais</TabsTrigger>
                  <TabsTrigger value="details">Detalhes</TabsTrigger>
                </TabsList>
                
                <TabsContent value="soap" className="space-y-4">
                  <div>
                    <h3 className="text-lg font-semibold mb-2">Subjetivo (Relato)</h3>
                    <div className="border p-3 rounded-md bg-gray-50">
                      {selectedRecord.subjective || "Não informado"}
                    </div>
                  </div>
                  
                  <div>
                    <h3 className="text-lg font-semibold mb-2">Objetivo (Exame Físico)</h3>
                    <div className="border p-3 rounded-md bg-gray-50">
                      {selectedRecord.objective || "Não informado"}
                    </div>
                  </div>
                  
                  <div>
                    <h3 className="text-lg font-semibold mb-2">Avaliação</h3>
                    <div className="border p-3 rounded-md bg-gray-50">
                      {selectedRecord.assessment || "Não informado"}
                    </div>
                  </div>
                  
                  <div>
                    <h3 className="text-lg font-semibold mb-2">Plano</h3>
                    <div className="border p-3 rounded-md bg-gray-50">
                      {selectedRecord.plan || "Não informado"}
                    </div>
                  </div>
                </TabsContent>
                
                <TabsContent value="vitals" className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="border p-4 rounded-md">
                      <p className="text-sm text-gray-500">Peso</p>
                      <p className="text-lg font-semibold">
                        {selectedRecord.weight ? `${selectedRecord.weight} kg` : "Não informado"}
                      </p>
                    </div>
                    
                    <div className="border p-4 rounded-md">
                      <p className="text-sm text-gray-500">Temperatura</p>
                      <p className="text-lg font-semibold">
                        {selectedRecord.temperature ? `${selectedRecord.temperature} °C` : "Não informado"}
                      </p>
                    </div>
                    
                    <div className="border p-4 rounded-md">
                      <p className="text-sm text-gray-500">Freq. Cardíaca</p>
                      <p className="text-lg font-semibold">
                        {selectedRecord.heart_rate ? `${selectedRecord.heart_rate} bpm` : "Não informado"}
                      </p>
                    </div>
                    
                    <div className="border p-4 rounded-md">
                      <p className="text-sm text-gray-500">Freq. Respiratória</p>
                      <p className="text-lg font-semibold">
                        {selectedRecord.respiratory_rate ? `${selectedRecord.respiratory_rate} rpm` : "Não informado"}
                      </p>
                    </div>
                  </div>
                </TabsContent>
                
                <TabsContent value="details" className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <h3 className="text-lg font-semibold mb-2">Diagnóstico</h3>
                      <div className="border p-3 rounded-md bg-gray-50">
                        {selectedRecord.diagnosis || "Não informado"}
                      </div>
                    </div>
                    
                    <div>
                      <h3 className="text-lg font-semibold mb-2">Prescrição</h3>
                      <div className="border p-3 rounded-md bg-gray-50">
                        {selectedRecord.prescription || "Não informado"}
                      </div>
                    </div>
                    
                    <div>
                      <h3 className="text-lg font-semibold mb-2">Resultados de Exames</h3>
                      <div className="border p-3 rounded-md bg-gray-50">
                        {selectedRecord.lab_results || "Não informado"}
                      </div>
                    </div>
                    
                    <div>
                      <h3 className="text-lg font-semibold mb-2">Observações</h3>
                      <div className="border p-3 rounded-md bg-gray-50">
                        {selectedRecord.notes || "Não informado"}
                      </div>
                    </div>
                  </div>
                  
                  {selectedRecord.follow_up_date && (
                    <div>
                      <h3 className="text-lg font-semibold mb-2">Retorno</h3>
                      <div className="border p-3 rounded-md bg-gray-50">
                        {format(new Date(selectedRecord.follow_up_date), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                      </div>
                    </div>
                  )}
                  
                  {selectedRecord.doctor && (
                    <div>
                      <h3 className="text-lg font-semibold mb-2">Veterinário Responsável</h3>
                      <div className="border p-3 rounded-md bg-gray-50">
                        {selectedRecord.doctor}
                      </div>
                    </div>
                  )}
                  
                  {selectedRecord.health_plan_coverage && (
                    <div>
                      <h3 className="text-lg font-semibold mb-2">Plano de Saúde</h3>
                      <div className="border p-3 rounded-md bg-gray-50">
                        Atendimento coberto pelo plano
                        {selectedRecord.health_plan_authorization && (
                          <p className="mt-1">Autorização: {selectedRecord.health_plan_authorization}</p>
                        )}
                      </div>
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}