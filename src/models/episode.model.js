import mongoose from 'mongoose';

const administrationDetailSchema = new mongoose.Schema({
  timestamp: { type: Date, default: Date.now },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // User que administrou
  notes: { type: String }
}, { _id: false });

// Subschema para itens de medicação interna
const internalMedicationSchema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', default: null },
  productName: { type: String, default: null }, // Denormalized for convenience, can be populated
  dosage: { type: String, default: null },
  frequency: { type: String, default: null },
  duration: { type: String, default: null },
  administered: { type: Boolean, default: false },
  administrationDetails: [administrationDetailSchema] // Log de quando e quem administrou
}, { _id: false });

// Subschema para itens de receita externa
const externalPrescriptionSchema = new mongoose.Schema({
  medication: { type: String, default: null },
  dosage: { type: String, default: null },
  frequency: { type: String, default: null },
  duration: { type: String, default: null },
  quantity: { type: String, default: null } // Quantidade a ser comprada
}, { _id: false });

const prescriptionSchema = new mongoose.Schema({
  internalMedication: [internalMedicationSchema],
  externalPrescription: [externalPrescriptionSchema],
  recommendations: { type: String, default: null }
}, { _id: false });

// Subschema para exames
const examSchema = new mongoose.Schema({
  examType: { type: String, default: null }, // Nome/Tipo do exame
  requestDate: { type: Date, default: null }, // Data da solicitação
  results: { type: String, default: null }, // Resultados (texto ou link para arquivo)
  resultDate: { type: Date, default: null } // Data do resultado
}, { _id: false });

const episodeSchema = new mongoose.Schema({
  tenant_id: { // Renomeado de tenantId
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Tenant', 
    required: true, 
    index: true 
  },
  patient_id: { // Renomeado de petId
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Pet', 
    required: true, 
    index: true 
  },
   owner_id: { // Adicionado (Firebase: owner_id)
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', // Role 'tutor'
    required: true, // Precisa garantir que seja preenchido!
    index: true 
  },
  appointmentId: { // Renomeado de appointmentId
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Appointment', 
    index: true, 
    default: null 
  }, 
  collaboratorId: { // Anteriormente vet_id. Mapeia para professionalId do agendamento
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    index: true, 
    default: null 
  }, 
  serviceId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Service', 
    default: null, 
    index: true 
  },
  service_name: { 
    type: String, 
    default: null 
  },
  specialty_id: { 
    type: String, 
    default: null, 
    index: true 
  },
  prontuarioId: { 
    type: String, 
    index: true, 
    required: true 
  },
  created_by: {
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User' // Não é mais required, pode ser uma ação de sistema
  },
  episodeNumber: {
    type: String, 
    index: true, 
    // unique: true, // Unicidade por tenant seria melhor no controller/serviço
    // sparse: true, 
    default: null 
  }, 
  status: { // Mantido
    type: String, 
    enum: ['Em Atendimento', 'Aguardando Exames', 'Concluído', 'Cancelado', 'Aguardando Atendimento'], // Adicionado "Aguardando Atendimento"
    default: 'Aguardando Atendimento', // Alterado default, "in_progress" (FB) -> "Em Atendimento" quando iniciar
    index: true
  },
  startTime: { // Renomeado de startTime
    type: Date, 
    default: null 
  }, 
  endTime: { // Renomeado de endTime
    type: Date, 
    default: null 
  }, 
  clinicalSigns: { // Renomeado de clinicalSigns
    type: String, 
    default: null 
  }, 
  anamnesis: { // Mantido
    type: String, 
    default: null 
  }, 
  physicalExam: { // Renomeado de physicalExam
    type: String, 
    default: null 
  }, 
  suspectedDiagnosis: { // Renomeado de suspectedDiagnosis
    type: [String], 
    default: [] 
  }, 
  diagnosis: { // Mantido
    type: [String], 
    default: [] 
  }, 
  treatment: { // Mantido
    type: String, 
    default: null 
  }, 
  observations: { // Renomeado de observations (Firebase: internal_notes)
    type: String, 
    default: null 
  }, 
  // Prescrição (estrutura embutida mantida)
  prescription: prescriptionSchema,
  // Exames (estrutura embutida mantida)
  exams: { type: [examSchema], default: [] },
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }, // Ajustado para snake_case
  collection: 'episodes' 
});

// Hook Pre-save para atualizar 'updated_at'
episodeSchema.pre('save', function(next) {
  this.updated_at = new Date();
  next();
});

// Hook Pre-findOneAndUpdate para atualizar 'updated_at'
episodeSchema.pre('findOneAndUpdate', function(next) {
  this.set({ updated_at: new Date() });
  next();
});


// Índices adicionais (nomes atualizados)
episodeSchema.index({ tenant_id: 1, patient_id: 1, startTime: -1 }); // Para buscar histórico do pet
episodeSchema.index({ tenant_id: 1, episodeNumber: 1 }, { unique: true, sparse: true }); // Adicionado para unicidade do episodeNumber por tenant

const Episode = mongoose.model('Episode', episodeSchema);

export default Episode; 