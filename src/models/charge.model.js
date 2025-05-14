import mongoose from 'mongoose';

// Subschema para itens da Cobrança
const chargeItemSchema = new mongoose.Schema({
  itemId: {
    type: mongoose.Schema.Types.ObjectId, // Referencia Service, Product, etc.
    required: true
  },
  itemType: {
    type: String,
    required: true,
    enum: ['service', 'product', 'clinical_fee', 'other']
  },
  description: {
    type: String,
    required: true
  },
  quantity: {
    type: Number,
    required: true,
    min: 1
  },
  unitPrice: {
    type: Number,
    required: true,
    min: 0
  },
  totalPrice: {
    type: Number,
    required: true,
    min: 0
  },
  cancellationReason: {
    type: String,
    default: null
  }
}, {
  _id: true // Permitir _id para manipulação individual
});

// Subschema para detalhes de pagamento
const paymentDetailSchema = new mongoose.Schema({
  paymentDate: {
    type: Date,
    default: Date.now
  },
  method: {
    type: String,
    enum: ['pix', 'credit_card', 'debit_card', 'cash', 'other'],
    required: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  transactionId: {
    type: String,
    default: null
  },
  processedByUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  }
}, { _id: false });

// Schema principal da Cobrança
const chargeSchema = new mongoose.Schema({
  tenantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenant',
    required: true,
    index: true
  },
  chargeNumber: {
    type: String,
    required: true,
    index: true // Idealmente único por tenant
  },
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  // Referências de Origem
  appointmentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Appointment',
    index: true,
    default: null
  },
  orderServiceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'OrderService',
    index: true,
    default: null
  },
  episodeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Episode',
    index: true,
    default: null
  },
  status: {
    type: String,
    required: true,
    enum: ['Pending', 'Paid', 'Partially Paid', 'Cancelled', 'Refunded'],
    default: 'Pending',
    index: true
  },
  items: {
    type: [chargeItemSchema],
    default: []
  },
  totalAmount: {
    type: Number,
    required: true,
    default: 0,
    min: 0
  },
  discountAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  amountPaid: {
    type: Number,
    default: 0,
    min: 0
  },
  amountDue: {
    type: Number,
    default: 0
    // Valor devido pode ser calculado via hook ou getter virtual
  },
  paymentDetails: {
    type: [paymentDetailSchema],
    default: []
  },
  cancellationReason: {
    type: String,
    default: null
  },
  notes: {
    type: String,
    default: null
  }
}, {
  timestamps: true // Adiciona created_at e updated_at automaticamente
});

// Garantir que chargeNumber seja único por tenant
chargeSchema.index({ tenantId: 1, chargeNumber: 1 }, { unique: true });
// Índice para buscar cobranças pendentes por cliente
chargeSchema.index({ tenantId: 1, customerId: 1, status: 1 });

// Middleware para calcular totalAmount e amountDue antes de salvar
chargeSchema.pre('save', function(next) {
  this.totalAmount = this.items
    .filter(item => !item.cancellationReason) // Somar apenas itens não cancelados
    .reduce((sum, item) => sum + item.totalPrice, 0);

  this.amountDue = this.totalAmount - this.discountAmount - this.amountPaid;
  if (this.amountDue < 0) {
    this.amountDue = 0; // Evitar valor devido negativo
  }
  next();
});

const Charge = mongoose.model('Charge', chargeSchema);

export default Charge; 