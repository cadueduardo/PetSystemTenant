import Tenant from '../models/tenant.model.js';
import User from '../models/user.model.js';
import mongoose from 'mongoose';
import { sendEmail } from '../utils/emailConfig.js'; // Importar a função de envio de email
import process from 'node:process'; // Adicionado para resolver erro do linter
// import { sendPasswordSetupEmail } from '../services/email.service.js'; // Descomentar quando email service estiver pronto
// import { connectDB } from '../config/database.js'; // A conexão deve ser gerenciada na inicialização do app

export const createTenant = async (req, res) => {
  // await connectDB(); // Garante conexão - idealmente gerenciada globalmente
  console.log("Received request to create tenant:", req.body);

  // ----- Autenticação/Autorização -----
  if (!req.user || req.user.role !== 'superAdmin') {
    console.log("Authorization Error: User is not a Super Admin or not authenticated.");
    return res.status(403).json({ message: 'Acesso não autorizado. Somente Super Admins podem criar tenants.' });
  }
  const superAdminId = req.user._id; // ID do Super Admin logado.

  const {
    company_name,
    responsible_name,
    adminEmail, // Email do admin a ser criado
    access_url,
    // ... outros campos do Tenant
  } = req.body;

  if (!company_name || !responsible_name || !adminEmail || !access_url) {
    console.error("Validation Error: Missing required fields for tenant creation.");
    return res.status(400).json({ message: 'Dados incompletos para criação (company_name, responsible_name, adminEmail, access_url são obrigatórios).' });
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // 1. Verificar se o email do admin já existe
    const existingUser = await User.findOne({ email: adminEmail }).session(session);
    if (existingUser) {
      console.error(`Admin email ${adminEmail} already exists.`);
      await session.abortTransaction();
      session.endSession();
      return res.status(409).json({ message: `Email ${adminEmail} já cadastrado para um usuário.` });
    }

    // 2. Criar o Usuário Admin
    const newAuthUid = new mongoose.Types.ObjectId().toString(); // Gerar um authUid único
    // Para gerar token mais robusto, considere crypto.randomBytes(32).toString('hex');
    const setupToken = new mongoose.Types.ObjectId().toString() + new mongoose.Types.ObjectId().toString().slice(-12); // Token simples para exemplo
    const setupTokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // Expira em 24 horas

    console.log(`Generated passwordSetupToken for ${adminEmail}: ${setupToken}`);

    const createdAdminUser = new User({
      email: adminEmail,
      authUid: newAuthUid, // authUid gerado
      displayName: responsible_name,
      role: 'admin',
      status: 'pending_password_setup', // Status inicial para setup de senha
      passwordSetupToken: setupToken,
      passwordSetupExpires: setupTokenExpires,
      password: null, // Explicitamente setando para null, embora não devesse ser necessário
      // tenant_id será preenchido após a criação do Tenant
    });
    await createdAdminUser.save({ session });
    console.log(`Admin user created with ID: ${createdAdminUser._id}, AuthUID: ${createdAdminUser.authUid}, Status: pending_password_setup`);

    // 3. Criar o Tenant
    const newTenant = new Tenant({
      ...req.body, // Passa todos os campos recebidos do corpo da requisição
      adminEmail: createdAdminUser.email, // Email do admin
      admin_user_id: createdAdminUser._id, // ID do usuário admin recém-criado
      createdBy: superAdminId, // ID do Super Admin que está criando
      // Garante que os campos de referência são os corretos
      company_name,
      responsible_name,
      access_url,
    });
    await newTenant.save({ session });
    console.log(`Tenant created with ID: ${newTenant._id}`);

    // 4. Atualizar o tenant_id no User admin criado e mudar status para active
    createdAdminUser.tenant_id = newTenant._id;
    // O status SÓ mudará para 'active' quando o admin configurar a senha.
    // Não mudamos o status aqui para 'active' diretamente.
    await createdAdminUser.save({ session }); // Salva o tenant_id
    console.log(`Admin user ${createdAdminUser._id} updated with tenant_id ${newTenant._id}. Status remains ${createdAdminUser.status}.`);

    // 5. Enviar email de configuração de senha
    try {
      const frontendSetupUrl = process.env.FRONTEND_URL || 'http://localhost:5173'; // Obter do .env ou usar default
      const setupLink = `${frontendSetupUrl}/auth/setup-password?token=${setupToken}`;
      
      const emailHtml = `
        <p>Olá ${responsible_name},</p>
        <p>Sua conta de administrador para a loja/clínica <strong>${company_name}</strong> foi criada no PetFácil!</p>
        <p>Para começar, configure sua senha clicando no link abaixo (válido por 24 horas):</p>
        <p><a href="${setupLink}" target="_blank" rel="noopener noreferrer">Configurar Minha Senha</a></p>
        <p>Se você não solicitou esta conta, por favor ignore este email.</p>
        <p>Atenciosamente,<br>Equipe PetFácil</p>
      `;
      const emailText = `Olá ${responsible_name}, configure sua senha para ${company_name} no PetFácil. Copie e cole o seguinte link no seu navegador (válido por 24 horas): ${setupLink}`;

      await sendEmail(
        createdAdminUser.email,
        `Bem-vindo ao PetFácil! Configure sua senha para ${company_name}`,
        emailHtml,
        emailText
      );
      console.log(`Password setup email initiated for ${createdAdminUser.email}.`);

    } catch (emailError) {
      console.error(`Falha ao enviar email de setup de senha para ${createdAdminUser.email}:`, emailError);
      // Mesmo que o email falhe, a criação do tenant e do usuário admin NÃO deve ser revertida aqui,
      // pois a transação principal (criação no DB) já foi comitada.
      // O Super Admin ainda pode definir a senha manualmente via /set-password se necessário.
      // Poderíamos adicionar um log mais persistente ou um sistema de retry para emails aqui.
      // Não retornamos erro para o cliente por falha de email, pois o tenant foi criado.
    }

    await session.commitTransaction();
    console.log("Tenant and Admin created successfully.");

    const tenantResponse = newTenant.toObject();
    delete tenantResponse.__v;
    // Opcional: popular o admin_user_id ou createdBy se necessário na resposta
    // const populatedTenant = await Tenant.findById(newTenant._id).populate('admin_user_id', 'displayName email authUid').populate('createdBy', 'displayName email');

    return res.status(201).json({ success: true, tenant: tenantResponse });

  } catch (error) {
    console.error("Error creating tenant and admin:", error);
    await session.abortTransaction();

    // A lógica de rollback manual de createdAdminUser não é estritamente necessária com transações,
    // pois a transação inteira seria abortada. Mas não prejudica.
    // if (createdAdminUser && createdAdminUser._id) { ... }

    if (error.code === 11000) {
      return res.status(409).json({
        message: 'Erro de duplicidade. Verifique a URL de acesso ou outros campos únicos.',
        error: error.keyValue
      });
    }
    if (error.name === 'ValidationError') {
        return res.status(400).json({ message: 'Erro de validação ao criar tenant ou usuário.', errors: error.errors });
    }
    return res.status(500).json({ message: 'Erro interno ao criar loja e administrador.', error: error.message });
  } finally {
    session.endSession();
  }
};

// --- GET /api/tenants --- (Listar todos os Tenants)
export const getTenants = async (req, res) => {
  console.log("Received request to list all tenants");
  // ----- Autenticação/Autorização -----
  if (!req.user || req.user.role !== 'superAdmin') {
    console.log("Authorization Error: User is not a Super Admin or not authenticated for getTenants.");
    return res.status(403).json({ message: 'Acesso não autorizado.' });
  }

  try {
    // Opcional: Popular admin_user_id e createdBy
    // const tenants = await Tenant.find({})
    //   .populate('admin_user_id', 'displayName email') 
    //   .populate('createdBy', 'displayName email') 
    //   .select('-__v');
    const tenants = await Tenant.find({}).select('-__v');

    console.log(`Found ${tenants.length} tenants.`);
    return res.status(200).json({ success: true, count: tenants.length, tenants: tenants });

  } catch (error) {
    console.error("Error listing tenants:", error);
    return res.status(500).json({ message: 'Erro interno ao buscar tenants.', error: error.message });
  }
};

// --- GET /api/tenants/:id --- (Buscar um Tenant pelo ID)
export const getTenantById = async (req, res) => {
  const { id } = req.params;
  console.log(`Received request to get tenant by ID: ${id}`);
  // ----- Autenticação/Autorização -----
  // Permitir SuperAdmin ou Admin do próprio tenant (se req.user.tenant_id === id)
  // Por enquanto, apenas SuperAdmin para simplificar a revisão inicial.
  if (!req.user || req.user.role !== 'superAdmin') {
    // Add more sophisticated role/ownership check here if needed later
    // Ex: if (!(req.user.role === 'admin' && req.user.tenant_id && req.user.tenant_id.toString() === id)) {
    console.log("Authorization Error: User is not a Super Admin for getTenantById.");
    return res.status(403).json({ message: 'Acesso não autorizado.' });
    // }
  }

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ message: 'ID de Tenant inválido.' });
  }

  try {
    // Opcional: Popular admin_user_id e createdBy
    // const tenant = await Tenant.findById(id)
    //   .populate('admin_user_id', 'displayName email authUid')
    //   .populate('createdBy', 'displayName email')
    //   .select('-__v');
    const tenant = await Tenant.findById(id).select('-__v');

    if (!tenant) {
      return res.status(404).json({ message: 'Tenant não encontrado.' });
    }

    console.log(`Tenant ${id} found.`);
    return res.status(200).json({ success: true, tenant: tenant });

  } catch (error) {
    console.error(`Error fetching tenant ${id}:`, error);
    return res.status(500).json({ message: 'Erro interno ao buscar tenant.', error: error.message });
  }
};

// --- DELETE /api/tenants/:id --- (Soft Delete: Inativar um Tenant pelo ID)
export const deleteTenant = async (req, res) => {
  const { id } = req.params;
  console.log(`Received request to delete (inactivate) tenant ${id}`);
  // ----- Autenticação/Autorização -----
  if (!req.user || req.user.role !== 'superAdmin') {
    console.log("Authorization Error: User is not a Super Admin for deleteTenant.");
    return res.status(403).json({ message: 'Acesso não autorizado.' });
  }

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ message: 'ID de Tenant inválido.' });
  }

  try {
    const inactiveTenant = await Tenant.findByIdAndUpdate(
      id, 
      { status: 'inactive' }, 
      { new: true } 
    ).select('-__v');

    if (!inactiveTenant) {
      return res.status(404).json({ message: 'Tenant não encontrado para deletar.' });
    }

    // TODO: Considerar inativar usuários associados (admin, colaboradores) ?
    // await User.updateMany({ tenant_id: id }, { status: 'inactive' });

    console.log(`Tenant ${id} marked as inactive.`);
    return res.status(200).json({ success: true, message: 'Tenant inativado com sucesso.', tenant: inactiveTenant });

  } catch (error) {
    console.error(`Error inactivating tenant ${id}:`, error);
    return res.status(500).json({ message: 'Erro interno ao inativar tenant.', error: error.message });
  }
};

// --- PUT /api/tenants/:id --- (Atualizar um Tenant pelo ID)
export const updateTenant = async (req, res) => {
  const { id } = req.params;
  const updateData = req.body;
  console.log(`Received request to update tenant ${id} with data:`, updateData);
  // ----- Autenticação/Autorização -----
  // Permitir SuperAdmin ou Admin do próprio tenant (se req.user.tenant_id.toString() === id)
  // Por enquanto, apenas SuperAdmin para simplificar a revisão inicial.
  if (!req.user || req.user.role !== 'superAdmin') {
    // Add more sophisticated role/ownership check here if needed later
    // Ex: if (!(req.user.role === 'admin' && req.user.tenant_id && req.user.tenant_id.toString() === id)) {
    console.log("Authorization Error: User is not a Super Admin for updateTenant.");
    return res.status(403).json({ message: 'Acesso não autorizado.' });
    // }
  }

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ message: 'ID de Tenant inválido.' });
  }

  delete updateData._id;
  // delete updateData.adminEmail; // Email do admin não deve ser alterado aqui diretamente.
  // delete updateData.admin_user_id; // ID do admin não deve ser alterado aqui.
  delete updateData.createdBy; // Criador não pode ser alterado.
  delete updateData.created_at;
  // updated_at é atualizado pelo hook pre-save no model Tenant

  // Se adminEmail estiver no updateData, é melhor removê-lo explicitamente
  // ou ter uma rota específica para alterar o admin de um tenant.
  if (updateData.adminEmail) delete updateData.adminEmail;
  if (updateData.admin_user_id) delete updateData.admin_user_id;

  try {
    const updatedTenant = await Tenant.findByIdAndUpdate(
      id,
      updateData, 
      { new: true, runValidators: true }
    ).select('-__v'); // Excluir __v da resposta

    if (!updatedTenant) {
      return res.status(404).json({ message: 'Tenant não encontrado para atualização.' });
    }

    console.log(`Tenant ${id} updated successfully.`);
    return res.status(200).json({ success: true, tenant: updatedTenant });

  } catch (error) {
    console.error(`Error updating tenant ${id}:`, error);
    // Tratar erro de duplicidade de access_url, se ocorrer
    if (error.code === 11000 && error.keyValue && error.keyValue.access_url) {
        return res.status(409).json({ message: `A URL de acesso '${error.keyValue.access_url}' já está em uso.` });
    }
    // Tratar erros de validação
    if (error.name === 'ValidationError') {
        return res.status(400).json({ message: 'Erro de validação ao atualizar tenant.', errors: error.errors });
    }
    return res.status(500).json({ message: 'Erro interno ao atualizar tenant.', error: error.message });
  }
};

// TODO: Implementar deleteTenant 