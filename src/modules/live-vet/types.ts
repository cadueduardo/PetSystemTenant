// src/modules/live-vet/types.ts

export interface Consultation {
  id: string; // ID único da consulta
  appointmentId: string; // ID do agendamento que originou a consulta
  petId: string;
  ownerId: string;
  vetId?: string; // ID do veterinário responsável (opcional inicialmente)
  date: string; // ISO Date string de quando a consulta ocorreu
  reason: string; // Motivo da consulta (pode vir do agendamento)
  anamnesis: Record<string, any>; // Respostas do questionário/anamnese
  clinicalExam: string; // Descrição do exame clínico
  diagnosis?: string; // Diagnóstico(s)
  treatment?: string; // Tratamento prescrito
  prescriptions?: Prescription[]; // Receitas
  exams?: ExamRequest[]; // Solicitações de exame
  status: 'pending' | 'in_progress' | 'completed' | 'canceled';
  createdAt: string;
  updatedAt: string;
  tenant_id: string;
}

export interface Questionnaire {
  id: string; // ID único do template
  name: string; // Nome do questionário (ex: "Anamnese Padrão Cães")
  questions: Question[]; // Lista de perguntas
  applicableSpecies?: string[]; // Espécies aplicáveis (opcional)
  createdAt: string;
  updatedAt: string;
  tenant_id: string;
}

export interface Question {
  id: string;
  text: string; // O texto da pergunta
  type: 'text' | 'textarea' | 'select' | 'checkbox' | 'radio' | 'number' | 'date';
  options?: string[]; // Opções para select, checkbox, radio
  required?: boolean;
}

export interface Prescription {
  id: string;
  medicationName: string;
  dosage: string; // Ex: "1 comprimido a cada 12 horas"
  duration: string; // Ex: "7 dias"
  notes?: string;
}

export interface ExamRequest {
  id: string;
  examName: string; // Ex: "Hemograma Completo"
  notes?: string;
}

// Esquema geral para dados específicos do Live Vet no localStorage
// (Podemos ajustar isso conforme necessário)
export interface LiveVetLocalStorageSchema {
  consultations: Record<string, Consultation>; // Consultas indexadas por ID
  templates: Questionnaire[]; // Lista de templates de questionário
  // Podemos adicionar mais conforme necessário, ex: config específica do módulo
} 