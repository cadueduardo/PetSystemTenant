import mongoose from 'mongoose';

const tenantSchema = new mongoose.Schema({
  company_name: { type: String, required: true },
  legal_name: { type: String },
  document_type: { type: String },
  document: { type: String },
  responsible_name: { type: String, required: true },
  email: { type: String },
  phone: { type: String },
  address: {
    cep: { type: String },
    street: { type: String },
    number: { type: String },
    complement: { type: String },
    neighborhood: { type: String },
    city: { type: String },
    state: { type: String },
    ibge_code: { type: String }
  },
  business_type: { type: String },
  selected_modules: { type: [String], default: [] },
  access_url: { type: String, required: true, unique: true },
  status: { type: String, default: 'active' },
  subscription_tier: { type: String },
  payment_plan: { type: String },
  payment_method: { type: String },
  adminEmail: { type: String, required: true },
  admin_user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
    index: true
  },
  cnae_principal: { type: String },
  inscricao_estadual: { type: String },
  inscricao_municipal: { type: String },
  regime_tributario: { type: String },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now }
}, {
  collection: 'tenants'
});

tenantSchema.index({ access_url: 1 });
tenantSchema.index({ admin_user_id: 1 });

tenantSchema.pre('save', function(next) {
  if (this.isModified()) {
    this.updated_at = new Date();
  }
  next();
});

const Tenant = mongoose.model('Tenant', tenantSchema);

export default Tenant; 