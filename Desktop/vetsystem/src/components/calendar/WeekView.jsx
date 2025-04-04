import React from "react";
import { format, isSameDay, addDays, startOfWeek, isWithinInterval, parseISO } from "date-fns";
import { pt } from "date-fns/locale";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function WeekView({ date, appointments, onAppointmentClick, onTimeSlotClick, onDateSelect, pets, customers }) {
  // Gerar dias da semana
  const startDay = startOfWeek(date || new Date(), { weekStartsOn: 0 });
  const weekDays = Array.from({ length: 7 }).map((_, i) => addDays(startDay, i));
  
  // Horários de funcionamento
  const hours = Array.from({ length: 11 }).map((_, i) => i + 8); // 8h às 18h
  
  // Verificar se uma data é válida
  const isValidDate = (dateValue) => {
    return dateValue instanceof Date && !isNaN(dateValue);
  };
  
  // Verificar se o appointment está no horário atual
  const isAppointmentInHour = (appointment, day, hour) => {
    try {
      if (!appointment || !appointment.date) return false;
      
      // Garantir que as datas estão no formato correto
      const appointmentStart = new Date(appointment.date);
      const appointmentEnd = appointment.end_date ? new Date(appointment.end_date) : addDays(appointmentStart, 1);
      
      if (!isValidDate(appointmentStart) || !isValidDate(appointmentEnd)) {
        console.warn("Data inválida no agendamento:", appointment);
        return false;
      }
      
      // Criar intervalo para o horário atual (hora:00 até hora:59)
      const hourStart = new Date(day);
      hourStart.setHours(hour, 0, 0, 0);
      
      const hourEnd = new Date(day);
      hourEnd.setHours(hour, 59, 59, 999);
      
      if (!isValidDate(hourStart) || !isValidDate(hourEnd)) {
        console.warn("Problema ao criar intervalo de hora:", { day, hour });
        return false;
      }
      
      // Verificar se o appointment está no intervalo
      return (
        isWithinInterval(appointmentStart, { start: hourStart, end: hourEnd }) ||
        isWithinInterval(appointmentEnd, { start: hourStart, end: hourEnd }) ||
        (appointmentStart <= hourStart && appointmentEnd >= hourEnd)
      );
    } catch (error) {
      console.error("Erro ao verificar appointment no horário:", error);
      return false;
    }
  };
  
  // Obter appointments visualizados no horário
  const getVisibleAppointmentsForHour = (day, hour) => {
    if (!appointments || !Array.isArray(appointments)) return [];
    
    return appointments.filter(appointment => 
      isAppointmentInHour(appointment, day, hour)
    );
  };
  
  const getPetName = (petId) => {
    if (!pets || !Array.isArray(pets)) return "Pet não encontrado";
    const pet = pets.find(p => p.id === petId);
    return pet ? pet.name : "Pet não encontrado";
  };
  
  const getOwnerName = (petId) => {
    if (!pets || !Array.isArray(pets)) return "Proprietário não encontrado";
    const pet = pets.find(p => p.id === petId);
    if (!pet) return "Proprietário não encontrado";
    
    if (!customers || !Array.isArray(customers)) return "Proprietário não encontrado";
    const owner = customers.find(c => c.id === pet.owner_id);
    return owner ? owner.full_name : "Proprietário não encontrado";
  };
  
  const getStatusColor = (status) => {
    const colors = {
      scheduled: "bg-blue-100 border-blue-200 text-blue-800",
      confirmed: "bg-purple-100 border-purple-200 text-purple-800",
      completed: "bg-green-100 border-green-200 text-green-800",
      canceled: "bg-red-100 border-red-200 text-red-800",
      no_show: "bg-amber-100 border-amber-200 text-amber-800"
    };
    
    return colors[status] || "bg-gray-100 border-gray-200 text-gray-800";
  };
  
  const getTypeIcon = (type) => {
    switch (type) {
      case "consultation":
        return "🩺";
      case "exam":
        return "🔬";
      case "vaccination":
        return "💉";
      case "surgery":
        return "🔪";
      case "return":
        return "🔄";
      case "telemedicine":
        return "📱";
      default:
        return "📅";
    }
  };

  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="grid grid-cols-8 border-b">
        <div className="p-2 border-r bg-gray-50 text-center font-medium">
          Hora
        </div>
        {weekDays.map((day, index) => (
          <div 
            key={index}
            className={`p-2 border-r last:border-r-0 text-center font-medium ${
              isSameDay(day, new Date()) ? "bg-blue-50" : "bg-gray-50"
            }`}
          >
            <div>{format(day, "ccc", { locale: pt })}</div>
            <div>{format(day, "dd/MM")}</div>
          </div>
        ))}
      </div>
      
      <div className="overflow-y-auto max-h-[800px]">
        {hours.map(hour => (
          <div key={hour} className="grid grid-cols-8 border-b last:border-b-0">
            <div className="p-2 border-r bg-gray-50 text-center">
              {`${hour}:00`}
            </div>
            
            {weekDays.map((day, dayIndex) => {
              const visibleAppointments = getVisibleAppointmentsForHour(day, hour);
              
              return (
                <div 
                  key={dayIndex}
                  className={`p-1 border-r last:border-r-0 min-h-[6rem] ${
                    isSameDay(day, new Date()) ? "bg-blue-50/30" : ""
                  }`}
                  onClick={() => {
                    if (onTimeSlotClick) {
                      const slotDate = new Date(day);
                      slotDate.setHours(hour, 0, 0, 0);
                      onTimeSlotClick(slotDate);
                    }
                  }}
                >
                  {visibleAppointments.length > 0 ? (
                    <div className="space-y-1">
                      {visibleAppointments.map(appointment => {
                        if (!appointment || !appointment.date) return null;
                        
                        try {
                          const appointmentDate = new Date(appointment.date);
                          if (!isValidDate(appointmentDate)) {
                            console.warn("Data inválida ao formatar horário:", appointment.date);
                            return null;
                          }
                          
                          const appointmentTime = format(appointmentDate, "HH:mm");
                          
                          return (
                            <div
                              key={appointment.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (onAppointmentClick) onAppointmentClick(appointment);
                              }}
                              className={`p-1 rounded border cursor-pointer text-xs ${getStatusColor(appointment.status)}`}
                            >
                              <div className="font-medium flex items-center">
                                <span className="mr-1">{getTypeIcon(appointment.type)}</span>
                                <span>{appointmentTime} {getPetName(appointment.pet_id)}</span>
                              </div>
                              <div className="truncate">{getOwnerName(appointment.pet_id)}</div>
                            </div>
                          );
                        } catch (error) {
                          console.error("Erro ao renderizar agendamento:", error);
                          return null;
                        }
                      })}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}