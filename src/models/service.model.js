import mongoose from 'mongoose';

const serviceSchema = new mongoose.Schema({
  tenant_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenant',
    required: true,
    index: true
  },
  name: {
    type: String,
    required: true,
    index: true
  },
  description: {
    type: String,
    default: null
  },
  type: {
    type: String,
    required: true,
    enum: ['clinical', 'petshop', 'other'],
    index: true
  },
  category: {
    type: String,
    default: null,
    index: true
  },
  durationMinutes: {
    type: Number,
    default: 0
  },
  price: {
    type: Number,
    required: true
  },
  points: {
    type: Number,
    default: 0
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  requiresAppointment: {
    type: Boolean,
    default: true
  },
  applicableSpecies: {
    type: [String],
    default: []
  },
  required_specialty: {
    type: String,
    default: null,
    index: true
  }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  collection: 'services'
});

// Índice composto para busca por nome dentro do tenant
serviceSchema.index({ tenant_id: 1, name: 1 });

const Service = mongoose.model('Service', serviceSchema);

export default Service; 