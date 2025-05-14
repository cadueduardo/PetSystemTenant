import mongoose from 'mongoose';

// Schema principal do Produto
const productSchema = new mongoose.Schema({
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
  sku: {
    type: String,
    index: true,
    default: null,
    sparse: true
  },
  barcode: {
    type: String,
    index: true,
    default: null,
    sparse: true
  },
  category: {
    type: String,
    index: true,
    default: null
  },
  type: {
    type: String,
    required: true,
    enum: ['petshop', 'clinical', 'other'],
    default: 'petshop',
    index: true
  },
  image_url: {
    type: String,
    default: null
  },
  ncm: {
    type: String,
    default: null,
    index: true
  },
  stockQuantity: {
    type: Number,
    required: true,
    default: 0,
    min: 0
  },
  minStockLevel: {
    type: Number,
    default: 0
  },
  cost_price: {
    type: Number,
    default: null
  },
  sellingPrice: {
    type: Number,
    required: true,
    min: 0
  },
  administrationPrice: {
    type: Number,
    default: null
  },
  allowInternalUse: {
    type: Boolean,
    default: false
  },
  requiresPrescription: {
    type: Boolean,
    default: false
  },
  isVaccine: {
    type: Boolean,
    default: false
  },
  vaccineDetails: {
    batchNumber: { type: String, default: null },
    expirationDate: { type: Date, default: null }
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true
  }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  collection: 'products'
});

// Hooks
productSchema.pre('save', function(next) {
  if (!this.isVaccine) {
    this.vaccineDetails = undefined;
  }
  next();
});

// Índices
productSchema.index({ tenant_id: 1, name: 1 });
productSchema.index({ tenant_id: 1, sku: 1 }, { unique: true, sparse: true });
productSchema.index({ tenant_id: 1, barcode: 1 }, { unique: true, sparse: true });
productSchema.index({ tenant_id: 1, isActive: 1 });
productSchema.index({ tenant_id: 1, type: 1 });
productSchema.index({ tenant_id: 1, category: 1 });
productSchema.index({ tenant_id: 1, ncm: 1 });

const Product = mongoose.model('Product', productSchema);

export default Product; 