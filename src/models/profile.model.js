import mongoose from 'mongoose';

const profileSchema = new mongoose.Schema({
  tenantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenant',
    required: true,
    index: true
  },
  name: {
    type: String,
    required: true
    // TODO: Adicionar índice composto com tenantId para garantir nome único por tenant?
    // index: true (considerar após validação)
  },
  description: {
    type: String,
    default: null
  },
  // Permissões (Opção 1: Lista de strings)
  // A validação e o significado dessas strings ocorrerão na lógica da aplicação.
  permissions: {
    type: [String],
    default: []
  },
  isDefaultAdmin: {
    type: Boolean,
    default: false
  },
  isDefaultCollaborator: {
    type: Boolean,
    default: false
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true
  }
}, {
  timestamps: true // Adiciona created_at e updated_at automaticamente
});

// Garantir nome único por tenant
profileSchema.index({ tenantId: 1, name: 1 }, { unique: true });

const Profile = mongoose.model('Profile', profileSchema);

export default Profile; 