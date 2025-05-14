import mongoose from 'mongoose';

const confirmationStatusSchema = new mongoose.Schema({
  sent: { type: Boolean, default: false },
  sentAt: { type: Date, default: null },
  response: { type: String, enum: ['Sim', 'Não', null], default: null },
  responseAt: { type: Date, default: null }
}, { _id: false });

const appointmentSchema = new mongoose.Schema({
  tenant_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenant',
    required: true,
    index: true
  },
  patient_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Pet',
    required: true,
    index: true
  },
  owner_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  associated_vet_id: {
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
  appointment_date: {
    type: Date,
    required: true,
    index: true
  },
  duration: {
    type: Number,
    default: null
  },
  end_time: {
    type: Date,
    default: null
  },
  price: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    required: true,
    enum: ['Agendado', 'Confirmado', 'Cancelado', 'Chegou', 'Em Atendimento', 'Concluído', 'Não Compareceu', 'Pendente Confirmação'],
    default: 'Agendado',
    index: true
  },
  confirmationStatus: confirmationStatusSchema,
  check_in_timestamp: {
    type: Date,
    default: null
  },
  checkout_timestamp: {
    type: Date,
    default: null
  },
  additional_info: {
    type: String,
    default: null
  },
  cancellationReason: {
    type: String,
    default: null
  },
  specialty_id: {
    type: String,
    default: null,
    index: true
  },
  requester_type: {
    type: String,
    default: 'Proprietário'
  },
  referring_clinic_name: {
    type: String,
    default: null
  },
  price_table_id: {
    type: String,
    default: null,
    index: true
  },
  transport_required: {
    type: Boolean,
    default: false
  },
  secondary_procedures_notes: {
    type: String,
    default: null
  },
  created_by_type: {
    type: String,
    enum: ['user', 'system', 'unknown'],
    default: 'unknown'
  },
  created_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  collection: 'appointments'
});

appointmentSchema.index({ tenant_id: 1, appointment_date: 1 });
appointmentSchema.index({ tenant_id: 1, status: 1 });
appointmentSchema.index({ tenant_id: 1, patient_id: 1, appointment_date: -1 });

const Appointment = mongoose.model('Appointment', appointmentSchema);

export default Appointment; 