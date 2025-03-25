import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { MedicalRecord } from "@/api/entities";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Loader2, Plus, FileText, Eye, FileEdit } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";

export default function MedicalRecordTab({ customer, pets, tenantId }) {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [records, setRecords] = useState([]);
  const [storeParam, setStoreParam] = useState("");

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    setStoreParam(urlParams.get('store') || "");
    
    loadRecords();
  }, [customer, pets]);

  const loadRecords = async () => {
    setIsLoading(true);
    
    try {
      if (!pets || pets.length === 0) {
        setRecords([]);
        return;
      }
      
      // Para ambiente demo, carregar dados fictícios
      if (storeParam === 'demo') {
        const today = new Date();
        const lastMonth = new Date();
        lastMonth.setMonth(today.getMonth() - 1);
        
        const demoRecords = [
          {
            id: "demo-record-1",
            pet_id: pets[0].id,
            record_type: "consultation",
            date: today.toISOString(),
            title: "Consulta de rotina",
            doctor: "Dr. Ricardo Soares",
            diagnosis: "Animal saudável",
            prescription: "Sem prescrição necessária",
            tenant_id: "demo-tenant"
          },
          {
            id: "demo-record-2",
            pet_id: pets[0].id,
            record_type: "vaccination",
            date: lastMonth.toISOString(),
            title: "Vacinação anual",
            doctor: "Dra. Amanda Lima",
            diagnosis: "Animal em boas condições",
            prescription: "Retorno em 1 ano para reforço",
            tenant_id: "demo-tenant"
          }
        ];
        
        if (pets.length > 1) {
          // Adicionar registros para o segundo pet
          const twoMonthsAgo = new Date();
          twoMonthsAgo.setMonth(today.getMonth() - 2);
          
          demoRecords.push({
            id: "demo-record-3",
            pet_id: pets[1].id,
            record_type: "exam",
            date: twoMonthsAgo.toISOString(),
            title: "Exame de sangue",
            doctor: "Dr. Carlos Mendes",
            diagnosis: "Valores dentro da normalidade",
            prescription: "Manter alimentação balanceada",
            tenant_id: "demo-tenant"
          });
        }
        
        setRecords(demoRecords);
        setIsLoading(false);
        return;
      }
      
      // Para ambiente real
      if (!tenantId) {
        console.error("ID do tenant não fornecido");
        setRecords([]);
        return;
      }
      
      // Obter todos os IDs dos pets
      const petIds = pets.map(pet => pet.id);
      
      // Buscar registros médicos para todos os pets do cliente
      let allRecords = [];
      try {
        for (const petId of petIds) {
          const petRecords = await MedicalRecord.filter({ 
            pet_id: petId,
            tenant_id: tenantId
          });
          allRecords = [...allRecords, ...petRecords];
        }
        
        // Ordenar por data (mais recentes primeiro)
        allRecords.sort((a, b) => new Date(b.date) - new Date(a.date));
        
        setRecords(allRecords);
      } catch (error) {
        console.error("Erro ao carregar registros médicos:", error);
        toast({
          title: "Erro ao carregar registros",
          description: "Não foi possível carregar os registros médicos.",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error("Erro ao buscar registros médicos:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const getPetName = (petId) => {
    const pet = pets.find(p => p.id === petId);
    return pet ? pet.name : "Pet não encontrado";
  };

  const getRecordTypeLabel = (type) => {
    const types = {
      consultation: "Consulta",
      exam: "Exame",
      treatment: "Tratamento",
      vaccination: "Vacinação",
      surgery: "Cirurgia",
      hospitalization: "Internação",
      telemedicine: "Telemedicina"
    };
    return types[type] || type;
  };

  const getRecordTypeColor = (type) => {
    const colors = {
      consultation: "bg-blue-100 text-blue-800",
      exam: "bg-purple-100 text-purple-800",
      treatment: "bg-amber-100 text-amber-800",
      vaccination: "bg-green-100 text-green-800",
      surgery: "bg-red-100 text-red-800",
      hospitalization: "bg-indigo-100 text-indigo-800",
      telemedicine: "bg-teal-100 text-teal-800"
    };
    return colors[type] || "bg-gray-100 text-gray-800";
  };

  const handleAddRecord = () => {
    const queryParams = new URLSearchParams({
      customerId: customer.id,
      ...(tenantId && { tenantId }),
      ...(storeParam && { store: storeParam })
    }).toString();
    
    navigate(createPageUrl(`MedicalRecordForm?${queryParams}`));
  };

  const handleViewRecord = (record) => {
    // Implementar visualização do registro
    console.log("Ver registro:", record);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Prontuários Médicos</h2>
        <Button onClick={handleAddRecord}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Prontuário
        </Button>
      </div>

      {records.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-10">
            <FileText className="h-16 w-16 text-gray-300 mb-4" />
            <h3 className="text-lg font-medium">Nenhum prontuário encontrado</h3>
            <p className="text-gray-500 mb-4">Ainda não há registros médicos para os pets deste cliente</p>
            <Button onClick={handleAddRecord}>
              <Plus className="h-4 w-4 mr-2" />
              Criar Primeiro Prontuário
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="bg-white rounded-md shadow">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Pet</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Título/Assunto</TableHead>
                <TableHead>Médico</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {records.map((record) => (
                <TableRow key={record.id}>
                  <TableCell>
                    {format(new Date(record.date), "dd/MM/yyyy", { locale: ptBR })}
                  </TableCell>
                  <TableCell>{getPetName(record.pet_id)}</TableCell>
                  <TableCell>
                    <Badge className={getRecordTypeColor(record.record_type)}>
                      {getRecordTypeLabel(record.record_type)}
                    </Badge>
                  </TableCell>
                  <TableCell>{record.title}</TableCell>
                  <TableCell>{record.doctor || "—"}</TableCell>
                  <TableCell>
                    <div className="flex space-x-2">
                      <Button variant="ghost" size="icon" onClick={() => handleViewRecord(record)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon">
                        <FileEdit className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}