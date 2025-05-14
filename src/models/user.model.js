import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema({
  tenant_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenant',
    index: true,
    default: null // Explicitamente nulo para Super Admins
  },
  authUid: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    select: false
  },
  displayName: {
    type: String,
    trim: true
  },
  phone: {
    type: String,
    trim: true,
    default: null
  },
  role: {
    type: String,
    required: true,
    enum: ['superAdmin', 'admin', 'collaborator', 'tutor'],
  },
  profileId: {
    type: String, // Pode ser alterado para ObjectId se os perfis forem migrados para uma coleção
    default: null
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'pending_invitation', 'pending_password_setup'],
    default: 'active'
  },
  invitationToken: {
    type: String,
    default: null
  },
  invitationExpires: {
    type: Date,
    default: null
  },
  passwordResetToken: { type: String, select: false },
  passwordResetExpires: { type: Date, select: false },
  // Campos para o fluxo de setup de senha inicial pelo admin do tenant
  passwordSetupToken: { type: String, select: false },
  passwordSetupExpires: { type: Date, select: false },
  // --- Campos específicos para role: 'tutor' (espelhando a coleção 'customers' do Firebase) ---
  full_name: {
    type: String,
    trim: true,
    required: function() { return this.role === 'tutor'; },
  },
  cpf: {
    type: String,
    trim: true,
    index: true
  },
  address: { type: String, trim: true },          // Rua, Avenida, etc. (Firebase: address)
  address_number: { type: String, trim: true },     // (Firebase: address_number)
  address_complement: { type: String, trim: true }, // (Firebase: address_complement)
  neighborhood: { type: String, trim: true },     // Bairro (Firebase: neighborhood)
  city: { type: String, trim: true },               // (Firebase: city)
  state: { type: String, trim: true },              // UF (Firebase: state)
  cep: { type: String, trim: true },                // CEP / Código Postal (Firebase: cep)
  ibge_code: { type: String, trim: true },          // Código IBGE da cidade (Firebase: ibge_code)
  phone_waha_id: {
    type: String,
    trim: true,
    index: true
  },
  created_at: {
    type: Date,
    default: Date.now
  },
  updated_at: {
    type: Date,
    default: Date.now
  }
}, {
  collection: 'users', // Explicitly set the collection name
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

// Hook pre-save para fazer hash da senha E atualizar updated_at
userSchema.pre('save', async function (next) {
  // Atualizar updated_at se o documento foi modificado
  if (this.isModified()) {
    this.updated_at = Date.now();
  }

  // Só faz o hash se a senha foi modificada (ou é nova) E EXISTE
  if (!this.isModified('password') || !this.password) return next();

  try {
    // Gerar salt e fazer hash
    const salt = await bcrypt.genSalt(10); // Salt rounds = 10
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error); // Passa o erro para o próximo middleware/handler
  }
});

// Método para comparar senha (adicionado ao schema para uso fácil)
userSchema.methods.matchPassword = async function (enteredPassword) {
  if (!this.password) return false; // Adicionado verificação caso senha não exista (select: false)
  const isMatch = await bcrypt.compare(enteredPassword, this.password);
  return isMatch;
};

// Índices compostos ou outros índices podem ser adicionados aqui se necessário
// Ex: userSchema.index({ tenant_id: 1, status: 1 });

const User = mongoose.model('User', userSchema);

export default User;
export { userSchema }; 