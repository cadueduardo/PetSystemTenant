import React from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Clipboard,
  Calendar,
  Clock,
  User,
  Search,
  CheckCircle,
  AlertCircle,
  XCircle,
  ArrowRight
} from "lucide-react";

export default function HospitalizationList({ hospitalizations, onViewHospitalization }) {
  // Ordenar internações por data (mais recentes primeiro)
  const sortedHospitalizations = [...hospitalizations].sort((a, b) => 
    new Date(b.admission_date) - new Date(a.admission_date)
  );

  const getStatusBadge = (status) => {
    const statusMap = {
      active: <Badge className="bg-blue-100 text-blue-800">Em andamento</Badge>,
      discharged: <Badge className="bg-green-100 text-green-800">Alta concedida</Badge>,
      deceased: <Badge className="bg-red-100 text-red-800">Óbito</Badge>,
      transferred: <Badge className="bg-yellow-100 text-yellow-800">Transferido</Badge>
    };
    return statusMap[status] || <Badge>{status}</Badge>;
  };

  // Calcular duração da internação
  const calculateDuration = (admissionDate, dischargeDate) => {
    if (!dischargeDate) return "Em andamento";
    
    const start = new Date(admissionDate);
    const end = new Date(dischargeDate);
    const diffTime = Math.abs(end - start);
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor((diffTime % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    
    if (diffDays === 0) {
      return `${diffHours} hora${diffHours !== 1 ? 's' : ''}`;
    }
    return `${diffDays} dia${diffDays !== 1 ? 's' : ''} e ${diffHours} hora${diffHours !== 1 ? 's' : ''}`;
  };

  return (
    <div className="space-y-4">
      {sortedHospitalizations.length === 0 ? (
        <p className="text-center text-gray-500 py-4">Nenhuma internação encontrada</p>
      ) : (
        sortedHospitalizations.map(hospitalization => (
          <div 
            key={hospitalization.id} 
            className="border rounded-lg p-4 hover:shadow-md transition-all"
          >
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className={`p-3 rounded-lg ${
                  hospitalization.status === 'deceased' 
                    ? 'bg-red-50 text-red-600' 
                    : 'bg-blue-100 text-blue-700'
                }`}>
                  <Clipboard className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium">
                      Internação
                    </h3>
                    {getStatusBadge(hospitalization.status)}
                  </div>
                  <div className="mt-1 space-y-1">
                    <p className="text-sm flex items-center gap-1">
                      <Calendar className="w-4 h-4 text-gray-400" />
                      {format(new Date(hospitalization.admission_date), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                      {hospitalization.discharge_date && (
                        <>
                          <ArrowRight className="w-4 h-4 mx-1" />
                          {format(new Date(hospitalization.discharge_date), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                        </>
                      )}
                    </p>
                    <p className="text-sm">
                      <span className="font-medium">Duração: </span>
                      {calculateDuration(hospitalization.admission_date, hospitalization.discharge_date)}
                    </p>
                    {hospitalization.responsible_doctor && (
                      <p className="text-sm flex items-center gap-1">
                        <User className="w-4 h-4 text-gray-400" />
                        <span className="font-medium">Responsável: </span>
                        {hospitalization.responsible_doctor}
                      </p>
                    )}
                  </div>
                  {hospitalization.reason && (
                    <p className="text-sm mt-2">
                      <span className="font-medium">Motivo: </span>
                      {hospitalization.reason}
                    </p>
                  )}
                  {hospitalization.diagnosis && (
                    <p className="text-sm mt-1">
                      <span className="font-medium">Diagnóstico: </span>
                      {hospitalization.diagnosis}
                    </p>
                  )}
                </div>
              </div>
              <div>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => onViewHospitalization(hospitalization.id)}
                >
                  <Search className="mr-2 h-4 w-4" />
                  Ver Detalhes
                </Button>
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );
}