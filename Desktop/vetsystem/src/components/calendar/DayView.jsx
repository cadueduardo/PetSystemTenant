import React from "react";
import { format, isSameDay, addMinutes, isWithinInterval, parseISO } from "date-fns";
import { pt } from "date-fns/locale";
import { Card } from "@/components/ui/card";

export default function DayView({ date, appointments, onAppointmentClick, onTimeSlotClick, pets, customers }) {
  // Verificar se uma data é válida
  const isValidDate = (dateValue) => {
    return dateValue instanceof Date && !isNaN(dateValue);
  };
  
  // Criar slots de 30 minutos das 8h às 18h
  const timeSlots = [];
  const currentDate = date || new Date();
  
  for (let hour = 8; hour <= 18; hour++) {
    for (let minutes = 0; minutes < 60; minutes += 30) {
      const slotDate = new Date(currentDate);
      slotDate.setHours(hour, minutes, 0, 0);
      timeSlots.push(slotDate);
    }
  }
  
  // Verificar se um agendamento está dentro de um slot de tempo
  const isAppointmentInTimeSlot = (appointment, slotStart) => {
    try {
      if (!appointment || !appointment.date) return false;
      
      const appointmentStart = new Date(appointment.date);
      const appointmentEnd = appointment.end_date 
        ? new Date(appointment.end_date)
        : addMinutes(appointmentStart, 30);
      
      if (!isValidDate(appointmentStart) || !isValidDate(appointmentEnd)) {
        console.warn("Data inválida no agendamento:", appointment);
        return false;
      }
      
      const slotEnd = addMinutes(slotStart, 30);
      
      return (
        isWithinInterval(appointmentStart, { start: slotStart, end: slotEnd }) ||
        isWithinInterval(appointmentEnd, { start: slotStart, end: slotEnd }) ||
        (appointmentStart <= slotStart && appointmentEnd >= slotEnd)
      );
    } catch (error) {
      console.error("Erro ao verificar agendamento no slot:", error);
      return false;
    }
  };
  
  // Obter agendamentos para um slot de tempo específico
  const getAppointmentsForTimeSlot = (slotTime) => {
    if (!appointments || !Array.isArray(appointments)) return [];
    
    return appointments.filter(appointment => 
      isAppointmentInTimeSlot(appointment, slotTime)
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
  
  const getAppointmentType = (type) => {
    const types = {
      consultation: "Consulta",
      exam: "Exame",
      vaccination: "Vacinação",
      surgery: "Cirurgia",
      return: "Retorno",
      telemedicine: "Telemedicina"
    };
    
    return types[type] || type;
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
    <div className="p-4">
      <div className="text-center mb-6">
        <h2 className="text-xl font-semibold">
          {format(currentDate, "EEEE, d 'de' MMMM", { locale: pt })}
        </h2>
      </div>
      
      <div className="space-y-2">
        {timeSlots.map((timeSlot, index) => {
          const slotAppointments = getAppointmentsForTimeSlot(timeSlot);
          const now = new Date();
          const isCurrentTime = 
            now.getHours() === timeSlot.getHours() && 
            Math.abs(now.getMinutes() - timeSlot.getMinutes()) < 30;
          
          return (
            <div key={index} className="flex">
              <div className={`w-20 py-2 px-3 text-right text-sm ${isCurrentTime ? "bg-blue-50 font-bold" : ""}`}>
                {format(timeSlot, "HH:mm")}
              </div>
              
              <div 
                className="flex-1 min-h-[5rem] border-l border-b pl-2 relative"
                onClick={() => {
                  if (onTimeSlotClick) {
                    onTimeSlotClick(new Date(timeSlot));
                  }
                }}
              >
                {isCurrentTime && (
                  <div className="absolute left-0 right-0 border-t-2 border-red-500"></div>
                )}
                
                {slotAppointments.length > 0 ? (
                  <div className="py-2 space-y-2">
                    {slotAppointments.map(appointment => {
                      if (!appointment || !appointment.date) return null;
                      
                      try {
                        const appointmentDate = new Date(appointment.date);
                        if (!isValidDate(appointmentDate)) {
                          console.warn("Data inválida ao renderizar agendamento:", appointment.date);
                          return null;
                        }
                        
                        return (
                          <Card
                            key={appointment.id}
                            className={`p-3 cursor-pointer ${getStatusColor(appointment.status)}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (onAppointmentClick) onAppointmentClick(appointment);
                            }}
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-xl">{getTypeIcon(appointment.type)}</span>
                              <div>
                                <div className="font-medium">
                                  {format(appointmentDate, "HH:mm")} - {getPetName(appointment.pet_id)}
                                </div>
                                <div className="text-sm">
                                  {getAppointmentType(appointment.type)} • {getOwnerName(appointment.pet_id)}
                                </div>
                                {appointment.doctor && (
                                  <div className="text-xs opacity-70">Dr(a). {appointment.doctor}</div>
                                )}
                              </div>
                            </div>
                          </Card>
                        );
                      } catch (error) {
                        console.error("Erro ao renderizar card de agendamento:", error);
                        return null;
                      }
                    })}
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}