import mongoose from 'mongoose';

// Subschema para itens da OS
const orderItemSchema = new mongoose.Schema({
  itemId: {
    type: mongoose.Schema.Types.ObjectId, // Referencia Service ou Product
    required: true
  },
  itemType: {
    type: String,
    required: true,
    enum: ['service', 'product']
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
  }
}, { _id: true }); // Permitir _id em subdocumentos para facilitar remoção/atualização individual se necessário

// Schema principal da Ordem de Serviço
const orderServiceSchema = new mongoose.Schema({
  tenantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenant',
    required: true,
    index: true
  },
  osNumber: {
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
  petId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Pet',
    index: true,
    default: null
  },
  appointmentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Appointment',
    index: true,
    default: null
  },
  status: {
    type: String,
    required: true,
    enum: ['Aguardando', 'Em Atendimento', 'Concluído', 'Cancelado', 'Pendente Pagamento'],
    default: 'Aguardando',
    index: true
  },
  serviceQueueStatusUpdatedAt: {
    type: Date,
    default: Date.now,
    index: true // Para ordenação eficiente da fila
  },
  items: {
    type: [orderItemSchema],
    default: []
  },
  totalAmount: {
    type: Number,
    required: true,
    default: 0,
    min: 0
  },
  notes: {
    type: String,
    default: null
  },
  isCashierOs: {
    type: Boolean,
    default: false
  },
  chargeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Charge',
    index: true,
    default: null
  }
}, {
  timestamps: true // Adiciona created_at e updated_at automaticamente
});

// Garantir que osNumber seja único por tenant
orderServiceSchema.index({ tenantId: 1, osNumber: 1 }, { unique: true });
// Índice para a fila de serviço
orderServiceSchema.index({ tenantId: 1, status: 1, serviceQueueStatusUpdatedAt: 1 });

// Middleware para recalcular totalAmount sempre que items mudar
orderServiceSchema.pre('save', function(next) {
  this.totalAmount = this.items.reduce((sum, item) => sum + item.totalPrice, 0);
  next();
});

const OrderService = mongoose.model('OrderService', orderServiceSchema);

export default OrderService; 