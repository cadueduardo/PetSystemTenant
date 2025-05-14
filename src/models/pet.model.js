import mongoose from 'mongoose';

const petSchema = new mongoose.Schema({
  tenant_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenant',
    required: true,
    index: true
  },
  owner_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  prontuarioId: {
    type: String,
    unique: true,
    sparse: true, // Permite múltiplos pets sem prontuarioId (null), mas garante unicidade quando presente
    index: true
  },
  name: {
    type: String,
    required: [true, 'Nome do pet é obrigatório'],
    trim: true
  },
  species: {
    type: String,
    required: [true, 'Espécie do pet é obrigatória'],
    trim: true
  },
  breed: {
    type: String,
    trim: true
  },
  gender: {
    type: String,
    enum: ['male', 'female'],
    required: [true, 'Sexo do pet é obrigatório']
  },
  birth_date: {
    type: Date
  },
  photo_url: {
    type: String,
    trim: true
  },
  allergies: {
    type: [String],
    default: []
  },
  observations: {
    type: String,
    trim: true
  },
  is_inactive: {
    type: Boolean,
    default: false,
    index: true
  },
  date_of_death: {
    type: Date,
    default: null
  },
  inactivation_reason: {
    type: String,
    default: null
  },
  health_plan_id: {
    type: String,
    index: true,
    sparse: true,
    default: null
  },
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

// Índice composto para buscas comuns (ex: pets de um tutor específico)
// petSchema.index({ tenant_id: 1, owner_id: 1 });

// Virtual para calcular idade (exemplo, pode ser feito no frontend também)
petSchema.virtual('age').get(function() {
  if (!this.birth_date) {
    return null;
  }
  const today = new Date();
  const birth_date = new Date(this.birth_date);
  let age = today.getFullYear() - birth_date.getFullYear();
  const m = today.getMonth() - birth_date.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth_date.getDate())) {
    age--;
  }
  // Poderia retornar uma string mais descritiva "X anos, Y meses"
  return age >= 0 ? age : null;
});

// Garantir que a opção virtuals seja incluída ao converter para JSON/Object
petSchema.set('toJSON', { virtuals: true });
petSchema.set('toObject', { virtuals: true });

// Hook Pre-save para atualizar 'updated_at'
petSchema.pre('save', function(next) {
  this.updated_at = new Date();
  next();
});

// Hook Pre-findOneAndUpdate para atualizar 'updated_at'
// Precisamos garantir que updated_at seja atualizado em operações de update
petSchema.pre('findOneAndUpdate', function(next) {
  this.set({ updated_at: new Date() });
  next();
});

const Pet = mongoose.model('Pet', petSchema);

export default Pet; 