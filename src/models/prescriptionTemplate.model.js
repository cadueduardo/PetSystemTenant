import mongoose from 'mongoose';

const prescriptionTemplateSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  name: { type: String, required: true, index: true }, // Nome do modelo
  description: { type: String, default: null },

  // Conteúdo do Template (espelhando a estrutura de 'prescription' em Episode)
  internalMedication: [{ // Itens de medicação interna padrão
    productId: { type: String, default: null }, // Ou ObjectId ref:'Product'
    productName: { type: String, default: null },
    dosage: { type: String, default: null },
    frequency: { type: String, default: null },
    duration: { type: String, default: null }
  }],
  externalPrescription: [{ // Itens de receita externa padrão
    medication: { type: String, default: null },
    dosage: { type: String, default: null },
    frequency: { type: String, default: null },
    duration: { type: String, default: null },
    quantity: { type: String, default: null }
  }],
  recommendations: { type: String, default: null }, // Recomendações padrão

  isActive: { type: Boolean, default: true, index: true }, // Template ativo?
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now }
});

// Adiciona um hook pre-save para atualizar 'updated_at'
prescriptionTemplateSchema.pre('save', function (next) {
  this.updated_at = new Date();
  next();
});

const PrescriptionTemplate = mongoose.model('PrescriptionTemplate', prescriptionTemplateSchema);

export default PrescriptionTemplate; 