import User from '../models/user.model.js';
import mongoose from 'mongoose';
// import crypto from 'crypto'; // Para gerar tokens (convite, reset senha)
// import { sendInvitationEmail, sendPasswordResetEmail } from '../services/email.service.js'; // Para emails

// --- POST /api/users --- (Create User)
export const createUser = async (req, res) => {
  console.log("Received request to create user:", req.body);
  const {
    email,
    password, // Senha é opcional para tutores na criação
    displayName, // Usado por admin/collaborator
    full_name,   // Usado por tutor
    role,
    tenant_id,   // Pode vir do SuperAdmin
    profileId,   // Para collaborator
    // Campos específicos do Tutor (customer do Firebase)
    cpf,
    address,
    address_number,
    address_complement,
    neighborhood,
    city,
    state,
    cep,
    ibge_code,
    phone, // `phone` já existia, será usado para todos os roles incluindo tutor
    phone_waha_id
  } = req.body;
  const requestingUser = req.user; // Usuário autenticado

  // --- Authorization Logic --- (Esta parte parece boa, mas vamos refinar a atribuição de tenant_id abaixo)
  let finalTenantIdForNewUser = null;

  if (requestingUser.role === 'admin') {
    if (!['collaborator', 'tutor'].includes(role)) {
      return res.status(403).json({ message: 'Admins só podem criar colaboradores ou tutores.' });
    }
    // Admin define o tenant_id do novo usuário como o seu próprio.
    finalTenantIdForNewUser = requestingUser.tenant_id;
    // Se tenant_id foi enviado no body por um admin, ele é ignorado.
  } else if (requestingUser.role === 'superAdmin') {
    if (!['superAdmin', 'admin'].includes(role)) {
      return res.status(403).json({ message: 'Super Admins só podem criar outros Super Admins ou Admins de tenant.' });
    }
    if (role === 'admin') {
      if (!tenant_id) {
        return res.status(400).json({ message: 'Tenant ID é obrigatório ao criar um Admin de tenant.' });
      }
      finalTenantIdForNewUser = tenant_id; // SuperAdmin especifica o tenant_id para o novo Admin.
    }
    // Para role === 'superAdmin', finalTenantIdForNewUser permanece null (correto).
  } else {
    return res.status(403).json({ message: 'Permissão negada para criar usuários.' });
  }
  // --------------------------

  // --- Basic Input Validation ---
  if (!email || !role) { // Email e Role são sempre obrigatórios
    return res.status(400).json({ message: 'Email e Role são obrigatórios.' });
  }

  let requiredFieldsMissing = false;
  let missingFieldsMessage = 'Campos obrigatórios ausentes: ';

  if (role === 'tutor') {
    if (!full_name) {
      requiredFieldsMissing = true;
      missingFieldsMessage += 'full_name (para tutor); ';
    }
    // Outros campos de tutor como cpf, address poderiam ser validados como obrigatórios aqui se necessário.
  } else if (role === 'admin' || role === 'superAdmin' || role === 'collaborator') {
    // Para admin, superAdmin, collaborator, password e displayName são geralmente esperados na criação inicial.
    if (!password) {
        // Para admin/superAdmin, senha é crucial. Para collaborator, pode ser via convite.
        // Vamos considerar a senha obrigatória por esta rota direta para admin/superAdmin.
        if (role === 'admin' || role === 'superAdmin'){
            requiredFieldsMissing = true;
            missingFieldsMessage += 'password; ';
        }
    }
    if (!displayName) {
      requiredFieldsMissing = true;
      missingFieldsMessage += 'displayName; ';
    }
    if (password && password.length < 8 && (role !== 'tutor')) { // Validação de senha apenas se fornecida e não for tutor
        return res.status(400).json({ message: 'A senha deve ter pelo menos 8 caracteres.' });
    }
  }

  if (role === 'collaborator' && !profileId) {
    requiredFieldsMissing = true;
    missingFieldsMessage += 'profileId (para collaborator); ';
  }

  if (requiredFieldsMissing) {
    return res.status(400).json({ message: missingFieldsMessage.slice(0, -2) + '.' });
  }
  // --------------------------

  try {
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      console.warn(`Email ${email} already exists.`);
      return res.status(409).json({ message: `Email ${email} já cadastrado.` });
    }

    const newAuthUid = new mongoose.Types.ObjectId().toString();

    const newUserPayload = {
      email: email.toLowerCase(),
      authUid: newAuthUid,
      role,
      tenant_id: finalTenantIdForNewUser,
      status: 'active', // Default para criação direta. Fluxo de convite usaria 'pending_invitation'.
      phone, // `phone` é comum
    };

    if (role === 'tutor') {
      newUserPayload.full_name = full_name;
      newUserPayload.cpf = cpf;
      newUserPayload.address = address;
      newUserPayload.address_number = address_number;
      newUserPayload.address_complement = address_complement;
      newUserPayload.neighborhood = neighborhood;
      newUserPayload.city = city;
      newUserPayload.state = state;
      newUserPayload.cep = cep;
      newUserPayload.ibge_code = ibge_code;
      newUserPayload.phone_waha_id = phone_waha_id;
      // Para tutores, `password` não é definido aqui. Se precisarem de acesso, será outro fluxo.
    } else {
      // Para superAdmin, admin, collaborator
      newUserPayload.displayName = displayName;
      if (password) {
        newUserPayload.password = password; // O hook pre-save fará o hash
      }
      if (role === 'collaborator') {
        newUserPayload.profileId = profileId;
        // Se for fluxo de convite para colaborador, status poderia ser 'pending_invitation' e email seria enviado.
      }
    }

    const newUser = new User(newUserPayload);
    const savedUser = await newUser.save();

    console.log(`User created successfully with ID: ${savedUser._id} and Role: ${savedUser.role}`);

    const userResponse = savedUser.toObject();
    delete userResponse.password;
    delete userResponse.__v;

    return res.status(201).json({ success: true, user: userResponse });

  } catch (error) {
    console.error("Error creating user:", error);
    if (error.name === 'ValidationError') {
      // Extrai mensagens de erro de validação de forma mais amigável
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({ message: 'Erro de validação.', errors });
    }
    return res.status(500).json({ message: 'Erro interno ao criar usuário.', error: error.message });
  }
};

// --- GET /api/users --- (Get Users with Filters)
export const getUsers = async (req, res) => {
  console.log("Received request to list users with query:", req.query);
  const requestingUser = req.user;
  
  try {
    const filters = {};
    let { tenant_id, role, status } = req.query; // Desestruturar como let para possível modificação

    // --- Authorization Logic ---
    if (requestingUser.role === 'admin') {
      // Forçar o tenant_id para o do admin logado
      if (tenant_id && tenant_id !== requestingUser.tenant_id?.toString()) {
        console.warn(`Admin ${requestingUser._id} attempted to list users for tenant ${tenant_id} but is restricted to their own tenant ${requestingUser.tenant_id}.`);
        // Poderia retornar um erro ou apenas ignorar o tenant_id fornecido e usar o do admin
      }
      filters.tenant_id = requestingUser.tenant_id;

      // Admin não pode listar superAdmins
      if (role === 'superAdmin') {
        return res.status(403).json({ success: false, message: 'Admins não podem listar Super Admins.' });
      }
      // Se um admin especificar um role, ele só pode ser collaborator ou tutor (ou admin, se for listar colegas)
      if (role && !['admin', 'collaborator', 'tutor'].includes(role)) {
        return res.status(403).json({ success: false, message: 'Admins só podem filtrar por roles admin, collaborator ou tutor em seu tenant.' });
      }

    } else if (requestingUser.role === 'superAdmin') {
      // SuperAdmin pode filtrar por qualquer tenant_id fornecido
      if (tenant_id) {
        if (!mongoose.Types.ObjectId.isValid(tenant_id)) {
            return res.status(400).json({ success: false, message: 'Formato de tenant_id inválido.'});
        }
        filters.tenant_id = tenant_id;
      }
    } else {
      // Isso não deveria acontecer se authorizeRoles está funcionando na rota, mas como defesa:
      return res.status(403).json({ success: false, message: 'Permissão negada para listar usuários.'});
    }
    // --------------------------

    if (role) {
      filters.role = role;
    }
    if (status) {
      filters.status = status;
    }

    // Adicionar paginação seria ideal aqui (limit, skip)
    // const page = parseInt(req.query.page) || 1;
    // const limit = parseInt(req.query.limit) || 10;
    // const skip = (page - 1) * limit;

    // Buscar usuários com base nos filtros, excluindo a senha
    const users = await User.find(filters)
      .select('-password -__v') // Excluir senha e __v
      // .limit(limit)
      // .skip(skip)
      .sort({ createdAt: -1 }); // Ordenar por mais recente por padrão

    // Opcional: Obter contagem total para paginação
    // const totalUsers = await User.countDocuments(filters);

    console.log(`Found ${users.length} users matching filters:`, filters);
    return res.status(200).json({
      success: true,
      count: users.length,
      // total: totalUsers, 
      // page: page, 
      // pages: Math.ceil(totalUsers / limit),
      users: users
    });

  } catch (error) {
    console.error("Error listing users:", error);
    return res.status(500).json({ message: 'Erro interno ao listar usuários.', error: error.message });
  }
};

// --- GET /api/users/:id --- (Get User by ID)
export const getUserById = async (req, res) => {
  const { id } = req.params;
  const requestingUser = req.user;
  console.log(`User ${requestingUser._id} (role: ${requestingUser.role}) attempting to get user by ID: ${id}`);

  if (!mongoose.Types.ObjectId.isValid(id)) {
    console.error(`Invalid User ID format: ${id}`);
    return res.status(400).json({ message: 'ID de Usuário inválido.' });
  }

  try {
    const userToView = await User.findById(id).select('-password -__v');

    if (!userToView) {
      console.warn(`User not found with ID: ${id}`);
      return res.status(404).json({ message: 'Usuário não encontrado.' });
    }

    // --- Authorization Logic ---
    const isSelf = requestingUser._id.toString() === userToView._id.toString();
    const requesterIsSuperAdmin = requestingUser.role === 'superAdmin';
    const requesterIsAdmin = requestingUser.role === 'admin';
    
    if (isSelf || requesterIsSuperAdmin) {
      // User can view self OR SuperAdmin can view anyone
      console.log(`User ${id} found and authorized (self or SuperAdmin).`);
      return res.status(200).json({ success: true, user: userToView });
    }

    if (requesterIsAdmin) {
      // Admin can view users within their own tenant (excluding SuperAdmins)
      if (userToView.role !== 'superAdmin' && userToView.tenant_id && requestingUser.tenant_id && userToView.tenant_id.toString() === requestingUser.tenant_id.toString()) {
        console.log(`User ${id} found and authorized (Admin viewing user in same tenant).`);
        return res.status(200).json({ success: true, user: userToView });
      }
    }
    // --- End Authorization Logic ---

    console.warn(`Authorization Denied: User ${requestingUser._id} cannot view user ${id}.`);
    return res.status(403).json({ message: 'Acesso não autorizado para visualizar este usuário.' });

  } catch (error) {
    console.error(`Error fetching user ${id}:`, error);
    return res.status(500).json({ message: 'Erro interno ao buscar usuário.', error: error.message });
  }
};

// --- PUT /api/users/:id --- (Update User by ID)
export const updateUser = async (req, res) => {
  const { id } = req.params; // ID do usuário a ser atualizado
  const updateData = req.body;
  const requestingUser = req.user; // Usuário que está fazendo a requisição

  console.log(`User ${requestingUser._id} (role: ${requestingUser.role}) attempting to update user ${id} with data:`, updateData);

  if (!mongoose.Types.ObjectId.isValid(id)) {
    console.error(`Invalid User ID format for update: ${id}`);
    return res.status(400).json({ message: 'ID de Usuário inválido.' });
  }

  // Campos que NUNCA devem ser atualizados por esta rota genérica
  delete updateData._id;
  delete updateData.email;      
  delete updateData.password;   
  delete updateData.role;       
  delete updateData.tenant_id;   
  delete updateData.authUid; // authUid não deve ser alterável
  delete updateData.created_at;  
  delete updateData.updated_at;  
  delete updateData.invitationToken;
  delete updateData.invitationExpires;
  delete updateData.passwordResetToken;
  delete updateData.passwordResetExpires;

  try {
    const userToUpdate = await User.findById(id);

    if (!userToUpdate) {
      console.warn(`User not found with ID: ${id} for update.`);
      return res.status(404).json({ message: 'Usuário não encontrado para atualização.' });
    }

    // --- Authorization Logic ---
    const isSelf = requestingUser._id.toString() === userToUpdate._id.toString();
    const requesterIsSuperAdmin = requestingUser.role === 'superAdmin';
    const requesterIsAdmin = requestingUser.role === 'admin';

    let isAuthorized = false;
    const allowedFieldsForSelf = ['displayName', 'phone'];
    const allowedFieldsForAdminTenant = ['displayName', 'phone', 'status', 'profileId'];
    // SuperAdmin pode teoricamente atualizar mais, mas vamos manter os campos restritos por segurança geral.
    // Se SuperAdmin precisar mudar role/tenant_id, idealmente seriam rotas específicas ou ferramentas admin.

    if (isSelf) {
      isAuthorized = true;
      // Filtra updateData para permitir apenas campos que o usuário pode mudar em si mesmo
      Object.keys(updateData).forEach(key => {
        if (!allowedFieldsForSelf.includes(key)) {
          delete updateData[key];
        }
      });
    } else if (requesterIsSuperAdmin) {
      // SuperAdmin pode atualizar outros usuários (exceto outros SuperAdmins, como uma política)
      if (userToUpdate.role !== 'superAdmin') {
        isAuthorized = true;
        // SuperAdmin pode alterar mais campos, mas já removemos os críticos. 
        // Poderíamos ter uma lista allowedFieldsForSuperAdmin se quisermos ser mais granulares.
      } else if (userToUpdate._id.toString() === requestingUser._id.toString()){
        isAuthorized = true; // SuperAdmin atualizando a si mesmo (aplica allowedFieldsForSelf)
        Object.keys(updateData).forEach(key => {
          if (!allowedFieldsForSelf.includes(key)) {
            delete updateData[key];
          }
        });
      }
    } else if (requesterIsAdmin) {
      // Admin pode atualizar usuários do seu tenant (que não sejam SuperAdmin ou outro Admin de tenant diferente)
      if (userToUpdate.role !== 'superAdmin' && 
          userToUpdate.tenant_id && requestingUser.tenant_id && 
          userToUpdate.tenant_id.toString() === requestingUser.tenant_id.toString()) {
        isAuthorized = true;
        // Filtra updateData para permitir apenas campos que Admin pode mudar em usuários do seu tenant
        Object.keys(updateData).forEach(key => {
          if (!allowedFieldsForAdminTenant.includes(key)) {
            delete updateData[key];
          }
        });
      }
    }

    if (!isAuthorized) {
      console.warn(`Authorization Denied: User ${requestingUser._id} cannot update user ${id}.`);
      return res.status(403).json({ message: 'Acesso não autorizado para atualizar este usuário.' });
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ message: 'Nenhum campo válido fornecido para atualização ou campos não permitidos.' });
    }

    // Aplicar as atualizações permitidas
    Object.assign(userToUpdate, updateData);
    // O hook pre-save no model User vai atualizar 'updated_at'
    const updatedUserResponse = await userToUpdate.save();
    
    // Clonar e remover password antes de enviar a resposta
    const userObject = updatedUserResponse.toObject();
    delete userObject.password; 
    delete userObject.__v;

    console.log(`User ${id} updated successfully by ${requestingUser._id}.`);
    return res.status(200).json({ success: true, user: userObject });

  } catch (error) {
    console.error(`Error updating user ${id}:`, error);
    if (error.name === 'ValidationError') {
        return res.status(400).json({ message: 'Erro de validação ao atualizar usuário.', errors: error.errors });
    }
    return res.status(500).json({ message: 'Erro interno ao atualizar usuário.', error: error.message });
  }
};

// --- DELETE /api/users/:id --- (Soft Delete User by ID)
export const deleteUser = async (req, res) => {
  const { id } = req.params; // ID do usuário a ser inativado
  const requestingUser = req.user; // Usuário que está fazendo a requisição

  console.log(`User ${requestingUser._id} (role: ${requestingUser.role}) attempting to delete (inactivate) user ${id}`);

  if (!mongoose.Types.ObjectId.isValid(id)) {
    console.error(`Invalid User ID format for delete: ${id}`);
    return res.status(400).json({ message: 'ID de Usuário inválido.' });
  }

  // Um usuário não pode deletar a si mesmo por esta rota
  if (requestingUser._id.toString() === id) {
    return res.status(403).json({ message: 'Você não pode inativar a si mesmo por esta rota.' });
  }

  try {
    const userToInactivate = await User.findById(id);

    if (!userToInactivate) {
      console.warn(`User not found with ID: ${id} for delete attempt.`);
      return res.status(404).json({ message: 'Usuário não encontrado para deletar.' });
    }

    // --- Authorization Logic ---
    let isAuthorized = false;

    if (requestingUser.role === 'superAdmin') {
      // SuperAdmin pode inativar qualquer um, exceto outros SuperAdmins (política de segurança)
      if (userToInactivate.role !== 'superAdmin') {
        isAuthorized = true;
      }
    } else if (requestingUser.role === 'admin') {
      // Admin pode inativar usuários do seu tenant (que não sejam SuperAdmin)
      if (userToInactivate.role !== 'superAdmin' &&
          userToInactivate.tenant_id && requestingUser.tenant_id &&
          userToInactivate.tenant_id.toString() === requestingUser.tenant_id.toString()) {
        isAuthorized = true;
      }
    }
    // --- End Authorization Logic ---

    if (!isAuthorized) {
      console.warn(`Authorization Denied: User ${requestingUser._id} cannot delete (inactivate) user ${id}.`);
      return res.status(403).json({ message: 'Acesso não autorizado para inativar este usuário.' });
    }

    // Encontrar e atualizar o status para 'inactive'
    const inactiveUser = await User.findByIdAndUpdate(
      id,
      { status: 'inactive' }, // Define o status como inativo
      { new: true }
    ).select('-password -__v'); // Excluir senha e __v

    // A verificação de !inactiveUser aqui é redundante se findById acima já confirmou a existência,
    // mas mantida por segurança caso a lógica mude.
    if (!inactiveUser) {
      // Isso não deve acontecer se userToInactivate foi encontrado
      console.warn(`User not found with ID: ${id} during a second check in delete attempt.`);
      return res.status(404).json({ message: 'Usuário não encontrado para deletar (verificação secundária).' });
    }

    console.log(`User ${id} marked as inactive by ${requestingUser._id}.`);
    return res.status(200).json({ success: true, message: 'Usuário inativado com sucesso.', user: inactiveUser });

  } catch (error) {
    console.error(`Error deleting user ${id}:`, error);
    return res.status(500).json({ message: 'Erro interno ao inativar usuário.', error: error.message });
  }
};

// --- PUT /api/users/:userId/set-password --- (Super Admin define/reseta senha de usuário)
export const setUserPassword = async (req, res) => {
  const { userId } = req.params;
  const { newPassword } = req.body;
  console.log(`Super Admin ${req.user.id} attempting to set password for user ${userId}`);

  // 1. Validação de Entrada
  if (!newPassword) {
    return res.status(400).json({ message: 'Nova senha é obrigatória.' });
  }
  // Validação de força da senha (exemplo simples)
  if (newPassword.length < 8) { 
    return res.status(400).json({ message: 'A senha deve ter pelo menos 8 caracteres.' });
  }
  // TODO: Adicionar validações mais robustas: maiúsculas, minúsculas, números, símbolos.
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    return res.status(400).json({ message: 'ID de usuário inválido.' });
  }

  // 2. Verificar se o requisitante é Super Admin (já feito pelo middleware authorizeRoles)

  try {
    // 3. Encontrar o usuário alvo
    const userToUpdate = await User.findById(userId);

    if (!userToUpdate) {
      return res.status(404).json({ message: 'Usuário alvo não encontrado.' });
    }

    // Opcional: Adicionar restrição para Super Admin não mudar senha de outros Super Admins?
    // if (userToUpdate.role === 'superAdmin') {
    //   return res.status(403).json({ message: 'Super Admins não podem alterar senhas de outros Super Admins por esta rota.' });
    // }

    // 4. Atualizar a senha
    userToUpdate.password = newPassword;
    await userToUpdate.save(); // O hook pre-save vai hashear a nova senha

    console.log(`Password for user ${userId} updated successfully by Super Admin ${req.user.id}`);
    return res.status(200).json({ success: true, message: 'Senha do usuário atualizada com sucesso.' });

  } catch (error) {
    console.error(`Error setting password for user ${userId}:`, error);
    // Verificar erros específicos (ex: validação do Mongoose no save)
    if (error.name === 'ValidationError') {
        return res.status(400).json({ message: 'Erro de validação ao salvar nova senha.', errors: error.errors });
    }
    return res.status(500).json({ message: 'Erro interno ao definir senha do usuário.', error: error.message });
  }
};

// --- TODO: Implement Invitation and Password Reset Functions ---
// export const inviteUser = async (req, res) => { ... };
// export const completeInvitation = async (req, res) => { ... };
// export const forgotPassword = async (req, res) => { ... };
// export const resetPassword = async (req, res) => { ... }; 