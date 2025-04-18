import { https } from "firebase-functions/v2"; // Garantir que https esteja importado
// import { onDocumentCreated } from "firebase-functions/v2/firestore"; // << COMENTADO (unused)
import * as admin from "firebase-admin";
// import { randomBytes } from "crypto"; // << COMENTADO (unused)
import { v4 as uuidv4 } from 'uuid'; // Descomentado
import axios from 'axios'; // <<< ADICIONAR IMPORT DO AXIOS >>>
// REMOVER imports específicos do Firestore que causaram erro
// import { getFirestore, query, where, limit, getDocs, serverTimestamp } from "firebase-admin/firestore"; // Importar funções do Firestore necessárias

// Initialize Firebase Admin SDK
try {
  admin.initializeApp();
} catch (e) {
  console.log("Admin SDK already initialized or initialization failed:", e);
}

// << MANTER db (usado na lógica restaurada) >>
const db = admin.firestore();
// << DESCOMENTAR auth >>
const auth = admin.auth();

// --- IDENTIFICADOR DE VERSÃO ---
const CODE_VERSION = new Date().toISOString();
console.log(`[Function Init] Running code version: ${CODE_VERSION}`);
// ---------------------------------

// --- DESCOMENTAR CONSTANTES USADAS --- 
// const APP_LOGIN_URL = "https://petfacil.app/login"; // Ainda não usada?
const CLAIMS_TENANT_ID = 'tenant_id'; // Usada em completeInvitation
const CLAIMS_PERFIL_ID = 'profile_id'; // Usada em completeInvitation
const CLAIMS_IS_COLLABORATOR = 'isCollaborator'; // Usada em completeInvitation
const CLAIMS_IS_ADMIN = 'isAdmin'; // Usada em completeInvitation
// const CLAIMS_ROLE = 'role'; // Não usada em completeInvitation?

// --- Interfaces ---
// ... (outras interfaces) ...
interface InviteCollaboratorData {
  email: string;
  collaboratorName: string;
  profileId: string;
}

// Interface para os dados esperados do TenantForm
interface CreateTenantData {
  company_name: string;
  legal_name?: string;
  document_type: string;
  document: string;
  responsible_name: string; // Nome do Admin
  adminEmail: string;       // Email do Admin
  email: string;            // Email de contato geral
  phone: string;
  address: {
    cep: string;
    street: string;
    number: string;
    complement?: string;
    neighborhood: string;
    city: string;
    state: string;
  };
  business_type: string;
  selected_modules: string[];
  access_url: string;
  status: string;
  subscription_tier: string;
  payment_plan: string;
  payment_method: string;
  // card_info não é usada diretamente na criação inicial do tenant/admin
}

// ... (outras funções como createTenantAndAdmin, etc.) ...

export const sendCustomInvite = https
  .onCall(
    {
      cors: ["http://localhost:5173", "https://petfacil.app"]
    },
    async (request: https.CallableRequest<InviteCollaboratorData>) => {
      const executionStartTime = Date.now(); // Usado abaixo
      console.log(`>>>>>>>>>> sendCustomInvite (Restored Flow / v: ${CODE_VERSION}) STARTED <<<<<<<<<<`);

      // ****** RESTAURAR CÓDIGO INTERNO ******

      // 1. Autenticação e Autorização
      if (!request.auth) {
        throw new https.HttpsError("unauthenticated", "Usuário não autenticado.");
      }
      const tenantId = request.auth.token.tenant_id;
      if (!tenantId) {
        throw new https.HttpsError("permission-denied", "Ação permitida apenas para administradores de tenant.");
      }
      const callerUid = request.auth.uid;

      // 2. Validação de Dados
      const { email, collaboratorName, profileId } = request.data;
      if (!email || !collaboratorName || !profileId || !/\S+@\S+\.\S+/.test(email)) {
        throw new https.HttpsError("invalid-argument", "Dados inválidos: Email, Nome e Perfil são obrigatórios.");
      }
      console.log(`[sendCustomInvite / v: ${CODE_VERSION}] Request validated for admin ${callerUid}...`);

      // --- Variáveis para o novo fluxo ---
      let collaboratorDocRef: admin.firestore.DocumentReference | null = null;
      const invitationToken = uuidv4();
      const invitationExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

      try {
        // 3. Verificar se já existe colaborador
        const collaboratorsRef = db.collection("colaboradores");
        const existingSnapshot = await collaboratorsRef
            .where("email", "==", email)
            .where("tenantId", "==", tenantId)
            .limit(1)
            .get();
        if (!existingSnapshot.empty) {
             // << MODIFICAR WARN para não usar existingDoc >>
             console.warn(`[sendCustomInvite] Collaborator document already exists for email ${email} with status ${existingSnapshot.docs[0].data().status}. Aborting.`);
             throw new https.HttpsError("already-exists", `Já existe um colaborador...`);
        }
        console.log(`[sendCustomInvite / v: ${CODE_VERSION}] No existing collaborator found...`);

        // 4, 5, 6 - REMOVIDOS (Auth, Claims, Reset Link)

        // 7. Criar Documento do Colaborador
        collaboratorDocRef = db.collection("colaboradores").doc(); // << USA db
        await collaboratorDocRef.set({
            tenantId: tenantId,
            perfilId: profileId,
            nome: collaboratorName,
            email: email,
            status: 'convite_pendente',
            convidadoPor: callerUid,
            criadoEm: admin.firestore.FieldValue.serverTimestamp(), // << USA admin
            atualizadoEm: admin.firestore.FieldValue.serverTimestamp(), // << USA admin
            invitationToken: invitationToken,
            invitationExpiresAt: admin.firestore.Timestamp.fromDate(invitationExpiresAt) // << USA admin
        });
        const collaboratorDocId = collaboratorDocRef.id;
        console.log(`[sendCustomInvite / v: ${CODE_VERSION}] Collaborator document ${collaboratorDocId} created...`);

        // 8. Criar Documento na Coleção 'mail'
        const acceptInvitationLink = `http://localhost:5173/accept-invitation?token=${invitationToken}`;
        const mailSubject = "Você foi convidado para o PetFácil!";
        const mailHtml = `
          <p>Olá ${collaboratorName},</p>
          <p>Você foi convidado por ${request.auth.token.name || 'seu administrador'} ...</p>
          <p>... <a href="${acceptInvitationLink}">Aceitar Convite e Criar Senha</a> ...</p>
          <p>...</p>
        `; // Resumido
        const mailText = `Olá ${collaboratorName}, ... ${acceptInvitationLink} ...`; // Resumido

        const mailDoc = {
          to: [email],
          message: {
            subject: mailSubject,
            html: mailHtml,
            text: mailText,
          },
          customData: {
            createdBy: callerUid,
            tenantId: tenantId,
            action: 'collaborator_custom_invitation',
            codeVersion: CODE_VERSION
          }
        };
        await db.collection('mail').add(mailDoc); // << USA db
        console.log(`[sendCustomInvite / v: ${CODE_VERSION}] Mail document created...`);

        // 10. Retornar Sucesso
        const executionEndTime = Date.now(); // Usado abaixo
        // << GARANTIR USO de executionEndTime >>
        console.log(`>>>>>>>>>> sendCustomInvite (Restored Flow / v: ${CODE_VERSION}) FINISHED SUCCESSFULLY (Duration: ${executionEndTime - executionStartTime}ms) <<<<<<<<<<`);
        return { success: true, message: `Convite enviado com sucesso para ${email}.` };

      } catch (error: any) {
        const executionEndTime = Date.now(); // Usado abaixo
        // << GARANTIR USO de executionEndTime >>
        console.error(`!!!!!!!!!! sendCustomInvite (Restored Flow / v: ${CODE_VERSION}) FAILED (Duration: ${executionEndTime - executionStartTime}ms) !!!!!!!!!!`, { error });
        if (error instanceof https.HttpsError) { throw error; }
        throw new https.HttpsError("internal", `Falha ao enviar convite...`, error);
      }
      // ****** FIM DO CÓDIGO RESTAURADO ******
    }
  );

// <<< NOVA FUNÇÃO para Completar o Convite >>>
interface CompleteInvitationData {
  token: string;
  password: string;
}

export const completeInvitation = https
  .onCall(
    { cors: ["http://localhost:5173", "https://petfacil.app"] }, // Ajustar CORS se necessário
    async (request: https.CallableRequest<CompleteInvitationData>) => {
      const { token, password } = request.data;

      console.log(`[completeInvitation] Attempting to complete invitation with token: ${token}`);

      // 1. Validação básica de entrada
      if (!token || !password) {
        throw new https.HttpsError("invalid-argument", "Token e senha são obrigatórios.");
      }
      // Adicionar validação de força da senha no backend também?
      if (password.length < 6) {
           throw new https.HttpsError("invalid-argument", "A senha deve ter pelo menos 6 caracteres.");
      }

      // << DESCOMENTAR se necessário >>
      // const db = admin.firestore();
      // const auth = admin.auth();

      try {
        // 2. Buscar documento do colaborador pelo token
        const collaboratorsRef = db.collection("colaboradores");
        const q = collaboratorsRef.where("invitationToken", "==", token).limit(1);
        const snapshot = await q.get();

        if (snapshot.empty) {
          console.error(`[completeInvitation] Invitation token not found: ${token}`);
          throw new https.HttpsError("not-found", "Convite inválido ou expirado (token não encontrado).");
        }

        const collaboratorDoc = snapshot.docs[0];
        const collaboratorData = collaboratorDoc.data();
        const collaboratorId = collaboratorDoc.id;

        console.log(`[completeInvitation] Found collaborator doc: ${collaboratorId} for token: ${token}`);

        // 3. Validar Status e Expiração
        if (collaboratorData.status !== 'convite_pendente') {
           console.error(`[completeInvitation] Collaborator ${collaboratorId} status is not 'convite_pendente': ${collaboratorData.status}`);
           throw new https.HttpsError("failed-precondition", "Este convite já foi utilizado ou está inválido.");
        }

        const expiresAt = collaboratorData.invitationExpiresAt?.toDate(); // Converter Timestamp para Date
        if (!expiresAt || expiresAt < new Date()) {
            console.error(`[completeInvitation] Invitation token expired for ${collaboratorId}. Expires At: ${expiresAt}`);
            // Atualizar status para expirado?
            await collaboratorDoc.ref.update({ status: 'convite_expirado' }).catch(err => console.error("Error updating status to expired:", err));
            throw new https.HttpsError("deadline-exceeded", "Este convite expirou.");
        }

        console.log(`[completeInvitation] Token validated for collaborator: ${collaboratorData.email}`);

        // --- Se chegou aqui, o token é válido --- 
        let newUserUid: string | null = null;
        try {
            // 4. Criar usuário no Firebase Auth
            console.log(`[completeInvitation] Creating Auth user for: ${collaboratorData.email}`);
            const newUserRecord = await auth.createUser({
                email: collaboratorData.email,
                password: password, // Usa a senha fornecida
                emailVerified: true, // Pode marcar como verificado, pois o acesso ao link confirma o email
                displayName: collaboratorData.nome,
                disabled: false
            });
            newUserUid = newUserRecord.uid;
            console.log(`[completeInvitation] Auth user ${newUserUid} created successfully.`);

            // 5. Definir Claims
            // << DESCOMENTAR CONSTANTES CLAIMS se foram comentadas antes >>
            // const CLAIMS_TENANT_ID = 'tenant_id';
            // const CLAIMS_PERFIL_ID = 'profile_id';
            // const CLAIMS_IS_COLLABORATOR = 'isCollaborator';
            // const CLAIMS_IS_ADMIN = 'isAdmin';
            const customClaims = {
                [CLAIMS_TENANT_ID]: collaboratorData.tenantId,
                [CLAIMS_PERFIL_ID]: collaboratorData.perfilId,
                [CLAIMS_IS_COLLABORATOR]: true,
                [CLAIMS_IS_ADMIN]: false // Colaboradores não são admins por padrão
            };
            await auth.setCustomUserClaims(newUserUid, customClaims);
            console.log(`[completeInvitation] Claims set for ${newUserUid}.`);

            // 6. Atualizar Documento do Colaborador
            console.log(`[completeInvitation] Updating collaborator document ${collaboratorId}...`);
            await collaboratorDoc.ref.update({
                authUid: newUserUid, // Adiciona o UID do Auth
                status: 'ativo', // Muda status para ativo
                invitationToken: null, // Remove/invalida o token
                invitationExpiresAt: null, // Remove expiração
                atualizadoEm: admin.firestore.FieldValue.serverTimestamp() // << USA admin
            });
            console.log(`[completeInvitation] Collaborator document ${collaboratorId} updated.`);

            // 7. Retornar Sucesso
            console.log(`[completeInvitation] Invitation completed successfully for ${collaboratorData.email}`);
            return { success: true, message: "Conta ativada e senha definida com sucesso!" };

        } catch (authError: any) {
            console.error(`[completeInvitation] Error during Auth user creation or Firestore update for token ${token}:`, authError);
            // Se o usuário Auth foi criado mas deu erro depois (claim, update), deleta o usuário criado
            if (newUserUid) {
                console.error(`[completeInvitation] Rolling back Auth user ${newUserUid} due to subsequent error.`);
                await auth.deleteUser(newUserUid).catch(delErr => console.error(`Error deleting partially created user ${newUserUid}:`, delErr));
            }
            // Verificar se o erro é de email já existente (apesar da verificação inicial no envio)
             if (authError.code === 'auth/email-already-exists' || authError.code === 'auth/email-already-in-use') {
                 // Atualizar status para erro? Lançar erro específico?
                 await collaboratorDoc.ref.update({ status: 'erro_email_ja_existente' }).catch(err => console.error("Error updating status:", err));
                 throw new https.HttpsError("already-exists", "Este email já está registrado no sistema de autenticação.");
             }
            throw new https.HttpsError("internal", "Falha ao criar usuário ou atualizar dados.", authError.message);
        }

      } catch (error: any) {
        console.error(`[completeInvitation] General error processing token ${token}:`, error);
        // Relançar o erro
        if (error instanceof https.HttpsError) {
          throw error;
        } else {
          throw new https.HttpsError("internal", "Erro inesperado ao processar o convite.", error.message);
        }
      }
    }
  );

// --- FUNÇÃO PARA CRIAR TENANT E ADMIN ---
export const createTenantAndAdmin = https.onCall(
  {
    // Validar CORS se necessário (assumindo mesmas permissões do AdminDashboard)
    cors: ["http://localhost:5173", "https://petfacil.app"],
    // Garantir que apenas o Super Admin (sem tenant_id) pode chamar
    enforceAppCheck: false, // Ajuste conforme necessário
  },
  async (request: https.CallableRequest<CreateTenantData>) => {
    console.log(`[createTenantAndAdmin / v: ${CODE_VERSION}] Function called.`);

    // 1. Autorização: Verificar se é Super Admin
    if (request.auth?.token?.tenant_id) {
      console.error(`[createTenantAndAdmin] Permission Denied: Caller ${request.auth.uid} has tenant_id claim.`);
      throw new https.HttpsError("permission-denied", "Apenas o Super Administrador pode criar novos tenants.");
    }
    if (!request.auth) {
       console.error(`[createTenantAndAdmin] Permission Denied: Unauthenticated caller.`);
       throw new https.HttpsError("unauthenticated", "Usuário não autenticado.");
    }
    const superAdminUid = request.auth.uid;
    console.log(`[createTenantAndAdmin] Caller ${superAdminUid} verified as Super Admin.`);

    // 2. Validação dos Dados de Entrada
    const data = request.data;
    if (!data.company_name || !data.adminEmail || !data.responsible_name || !data.access_url) {
      console.error("[createTenantAndAdmin] Invalid input data (missing required fields):", data);
      throw new https.HttpsError("invalid-argument", "Dados incompletos para criação do tenant e administrador.");
    }
    // Adicione mais validações se necessário (formato de email, URL, etc.)

    const adminEmail = data.adminEmail;

    let adminUserUid: string | null = null; // Para rollback
    // GERAR REFERÊNCIA DO TENANT ANTES PARA OBTER O ID
    const tenantDocRef = db.collection("tenants").doc(); // Gera um novo ID automaticamente
    const tenantId = tenantDocRef.id; // USA O ID GERADO
    console.log(`[createTenantAndAdmin] Generated Tenant ID: ${tenantId}`);

    try {
      // 3. Verificar se o Admin Email já existe no Auth
      try {
        await auth.getUserByEmail(adminEmail);
        // Se chegou aqui, o email já existe
        console.error(`[createTenantAndAdmin] Admin email ${adminEmail} already exists in Auth.`);
        throw new https.HttpsError("already-exists", `O email ${adminEmail} já está cadastrado no sistema de autenticação.`);
      } catch (error: any) {
        if (error.code === 'auth/user-not-found') {
          // Email não encontrado, o que é bom, podemos continuar.
          console.log(`[createTenantAndAdmin] Admin email ${adminEmail} does not exist yet. Proceeding...`);
        } else {
          // Outro erro ao buscar usuário
          console.error(`[createTenantAndAdmin] Error checking admin email ${adminEmail}:`, error);
          throw new https.HttpsError("internal", "Erro ao verificar email do administrador.");
        }
      }

      // 4. Verificar se o Tenant ID já existe no Firestore (REMOVER - já garantido pela geração)
      /* const tenantDocSnap = await tenantDocRef.get();
      if (tenantDocSnap.exists) {
          console.error(`[createTenantAndAdmin] Tenant ID ${tenantId} already exists.`);
          throw new https.HttpsError("already-exists", `A ID da loja ${tenantId} já existe.`);
      }
      console.log(`[createTenantAndAdmin] Tenant ID ${tenantId} is available.`); */


      // 5. Criar o Usuário Administrador no Firebase Auth (SEM SENHA INICIAL)
      console.log(`[createTenantAndAdmin] Creating Auth user for admin: ${adminEmail}`);
      const adminUserRecord = await auth.createUser({
        email: adminEmail,
        emailVerified: false, // Será verificado via link de senha
        displayName: data.responsible_name,
        disabled: false,
      });
      adminUserUid = adminUserRecord.uid;
      console.log(`[createTenantAndAdmin] Auth user ${adminUserUid} created for admin ${adminEmail}.`);

      // 6. Definir as Custom Claims para o Admin
      console.log(`[createTenantAndAdmin] Setting claims for admin ${adminUserUid}...`);
      const customClaims = {
        [CLAIMS_TENANT_ID]: tenantId, // USA O ID GERADO
        [CLAIMS_IS_ADMIN]: true,       // <<< PONTO CRÍTICO: Definir como Admin!
        [CLAIMS_IS_COLLABORATOR]: false // Admins de tenant não são colaboradores comuns
        // Adicionar profile_id se houver um perfil padrão para admin?
      };
      await auth.setCustomUserClaims(adminUserUid, customClaims);
      console.log(`[createTenantAndAdmin] Claims set for admin ${adminUserUid}:`, customClaims);

      // 7. Criar o Documento do Tenant no Firestore (usando a ref e ID já gerados)
      console.log(`[createTenantAndAdmin] Creating tenant document ${tenantId} in Firestore...`);
      const tenantData = {
        ...data, // Inclui todos os dados do formulário
        id: tenantId, // Garante que o ID seja o mesmo usado na claim
        adminAuthUid: adminUserUid, // Link para o usuário admin no Auth
        createdBy: superAdminUid,
        created_at: admin.firestore.FieldValue.serverTimestamp(),
        updated_at: admin.firestore.FieldValue.serverTimestamp(),
      };
      // Remover card_info explicitamente antes de salvar (MANTER)
      delete (tenantData as any).card_info;

      // USA A REFERÊNCIA JÁ CRIADA (tenantDocRef)
      await tenantDocRef.set(tenantData);
      console.log(`[createTenantAndAdmin] Tenant document ${tenantId} created successfully.`);

      // 8. Gerar link de configuração de senha e enviar email
      console.log(`[createTenantAndAdmin] Generating password reset link for ${adminEmail}...`);
      // Nota: Usar o link de "Verificação de Email" pode ser uma alternativa
      // se você quiser que ele defina a senha ao verificar o email.
      // Usaremos o link de reset de senha aqui.
      const passwordResetLink = await auth.generatePasswordResetLink(adminEmail);

       const mailSubject = "Configure sua senha de administrador - PetFácil";
       const mailHtml = `
          <p>Olá ${data.responsible_name},</p>
          <p>Sua conta de administrador para a loja ${data.company_name} foi criada no PetFácil!</p>
          <p>Para começar, configure sua senha clicando no link abaixo:</p>
          <p><a href="${passwordResetLink}">Configurar Minha Senha</a></p>
          <p>Se você não solicitou esta conta, por favor ignore este email.</p>
       `;
       const mailText = `Olá ${data.responsible_name}, configure sua senha para ${data.company_name} no PetFácil: ${passwordResetLink}`;

       const mailDoc = {
         to: [adminEmail],
         message: { subject: mailSubject, html: mailHtml, text: mailText },
         customData: { action: 'admin_password_setup', tenantId: tenantId }
       };
       await db.collection('mail').add(mailDoc);
       console.log(`[createTenantAndAdmin] Password setup email sent to ${adminEmail}.`);


      // 9. Retornar Sucesso com os dados do Tenant
      console.log(`[createTenantAndAdmin] Process completed successfully for tenant ${tenantId}.`);
      return { success: true, tenantData: { ...tenantData, id: tenantId } }; // Retorna os dados salvos

    } catch (error: any) {
      console.error(`[createTenantAndAdmin] CRITICAL ERROR creating tenant or admin:`, error);

      // Rollback: Se o usuário admin foi criado no Auth, deleta ele
      if (adminUserUid) {
        console.error(`[createTenantAndAdmin] Rolling back Auth user ${adminUserUid} due to error.`);
        await auth.deleteUser(adminUserUid).catch(delErr => console.error(`[createTenantAndAdmin] Error deleting partially created admin user ${adminUserUid}:`, delErr));
      }
      // Rollback: Se o documento do tenant foi criado, deleta ele (verificar se realmente precisa)
      // É mais complexo garantir que isso só ocorra se a falha foi DEPOIS da criação do doc.
      // Por segurança, pode ser melhor deixar o doc e tratar manualmente ou ajustar a lógica.

      // Relançar o erro para o frontend
      if (error instanceof https.HttpsError) {
        throw error;
      } else {
        throw new https.HttpsError("internal", "Erro interno ao criar loja e administrador.", error.message);
      }
    }
  }
);

// --- FUNÇÃO PARA ENVIAR CONFIRMAÇÃO WAHA ---
interface SendWahaConfirmationData {
  appointmentId: string;
}

// Função auxiliar para formatar a data/hora (Exemplo)
function formatDateTime(timestamp: admin.firestore.Timestamp | undefined): string {
  if (!timestamp) return 'Data/Hora Indisponível';
  // Exemplo: "18 de Abril às 14:30"
  const date = timestamp.toDate();
  return date.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' }) +
         ' às ' +
         date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

// --- Constantes WAHA (Mover para cá se necessário) ---
const WAHA_API_URL = "https://2853-2804-7f0-9382-7afb-c516-ed83-419-c37d.ngrok-free.app/api/sendText"; // <<< CONFIRME A URL
const WAHA_SESSION_NAME = "default"; // <<< CONFIRME A SESSÃO
// const WAHA_API_KEY = "SEU_TOKEN_SE_TIVER"; // <<< DESCOMENTE E AJUSTE SE USAR TOKEN >>>

export const sendWahaConfirmation = https.onCall(
  {
    region: 'us-central1', // <<< CONFIRME SUA REGIÃO >>>
    timeoutSeconds: 60,
    memory: '256MiB', // <<< CORRIGIDO DE MB PARA MiB >>>
    cors: ["http://localhost:5173", "https://petfacil.app"] // <<< CONFIRME SUAS ORIGENS >>>
  },
  async (request: https.CallableRequest<SendWahaConfirmationData>) => {
    console.log(`[sendWahaConfirmation / v: ${CODE_VERSION}] Function called.`);

    // 1. Autenticação e Autorização (garante que o chamador pertence a um tenant)
    if (!request.auth) {
      throw new https.HttpsError("unauthenticated", "Usuário não autenticado.");
    }
    const tenantId = request.auth.token.tenant_id;
    const callerUid = request.auth.uid;
    if (!tenantId) {
      // Poderia permitir Super Admin? Por enquanto, não.
      throw new https.HttpsError("permission-denied", "Ação permitida apenas para usuários logados com tenant.");
    }
    console.log(`[sendWahaConfirmation] Caller: ${callerUid}, Tenant: ${tenantId}`);

    // 2. Validação de Dados
    const { appointmentId } = request.data;
    if (!appointmentId) {
      throw new https.HttpsError("invalid-argument", "ID do agendamento é obrigatório.");
    }
    console.log(`[sendWahaConfirmation] Received appointmentId: ${appointmentId}`);

    try {
      // 3. Buscar dados do Agendamento
      const appointmentRef = db.collection("appointments").doc(appointmentId);
      const appointmentSnap = await appointmentRef.get();

      if (!appointmentSnap.exists) {
        throw new https.HttpsError("not-found", `Agendamento ${appointmentId} não encontrado.`);
      }
      const appointmentData = appointmentSnap.data();
      if (!appointmentData) {
         throw new https.HttpsError("internal", `Dados do agendamento ${appointmentId} estão vazios.`);
      }

      // Segurança: Verificar se o agendamento pertence ao mesmo tenant do chamador
      if (appointmentData.tenant_id !== tenantId) {
         throw new https.HttpsError("permission-denied", `Agendamento ${appointmentId} não pertence ao seu tenant.`);
      }

      console.log(`[sendWahaConfirmation] Fetched appointment data for ID: ${appointmentId}`);

      // 4. Buscar dados do Cliente associado
      const customerId = appointmentData.customer_id;
      if (!customerId) {
          throw new https.HttpsError("failed-precondition", `Agendamento ${appointmentId} não possui ID de cliente associado.`);
      }
      const customerRef = db.collection("customers").doc(customerId);
      const customerSnap = await customerRef.get();

      if (!customerSnap.exists) {
           throw new https.HttpsError("not-found", `Cliente ${customerId} associado ao agendamento ${appointmentId} não encontrado.`);
      }
      const customerData = customerSnap.data();
       if (!customerData) {
           throw new https.HttpsError("internal", `Dados do cliente ${customerId} estão vazios.`);
       }

      console.log(`[sendWahaConfirmation] Fetched customer data for ID: ${customerId}`);

      // 5. Extrair Telefone do Cliente (CONFIRMAR NOME DO CAMPO)
      const customerPhone = customerData.phone; // <<< VERIFICAR NOME DO CAMPO: é 'phone'? 'telefone'? 'whatsapp'?
      if (!customerPhone) {
          throw new https.HttpsError("failed-precondition", `Cliente ${customerId} não possui um número de telefone cadastrado.`);
      }
      // Limpeza básica: remover caracteres não numéricos e adicionar código do país se necessário
      const formattedPhone = `55${customerPhone.replace(/\D/g, '')}`; // Exemplo: Assume Brasil (55)

      console.log(`[sendWahaConfirmation] Customer phone (Original): ${customerPhone} -> Formatted (For Chat ID): ${formattedPhone}`);

      // 6. Montar a Mensagem de Confirmação
      // Obter nome do tenant (opcional, mas bom para personalizar)
      let tenantName = "sua clínica";
      try {
          const tenantDoc = await db.collection('tenants').doc(tenantId).get();
          if (tenantDoc.exists && tenantDoc.data()?.company_name) {
              tenantName = tenantDoc.data()?.company_name;
          }
      } catch (tenantError) {
          console.warn(`[sendWahaConfirmation] Could not fetch tenant name for ${tenantId}:`, tenantError);
      }

      const message = `Olá ${appointmentData.customer_name || 'Cliente'}, tudo bem? Confirmando seu agendamento em ${tenantName} para ${appointmentData.pet_name || 'seu pet'} no dia ${formatDateTime(appointmentData.start_time)}. Responda SIM para confirmar ou NÃO para cancelar. Obrigado!`;

      console.log(`[sendWahaConfirmation] Message prepared: "${message}"`);

      // 7. Chamar a API WAHA
      // Substitua com sua URL real da instância WAHA e token (se usar)
      // const WAHA_API_URL = "https://2853-2804-7f0-9382-7afb-c516-ed83-419-c37d.ngrok-free.app/api/sendText"; // <<< URL ATUALIZADA >>>
      // const WAHA_SESSION_NAME = "default"; // <<< AJUSTE SEU NOME DE SESSÃO WAHA >>>
      // const WAHA_API_KEY = "SEU_TOKEN_SE_TIVER"; // <<< DESCOMENTE E AJUSTE SE USAR TOKEN >>>

      const payload = {
          session: WAHA_SESSION_NAME, // <<< MOVIDO PARA O PAYLOAD >>>
          chatId: `${formattedPhone}@c.us`, // Formato esperado pelo WAHA
          text: message,
      };

      console.log('[sendWahaConfirmation] Payload to be sent:', JSON.stringify(payload)); // LOG ADICIONADO

      const headers = {
           'Content-Type': 'application/json',
          // Descomente se usar API Key:
          // 'X-Api-Key': WAHA_API_KEY
      };

      console.log(`[sendWahaConfirmation] Sending request to WAHA: ${WAHA_API_URL} for session ${WAHA_SESSION_NAME}`);
      // <<< REMOVIDO session DA QUERY STRING >>>
      const response = await axios.post(WAHA_API_URL, payload, { headers });

      console.log("[sendWahaConfirmation] WAHA API Response Status:", response.status);
      console.log("[sendWahaConfirmation] WAHA API Response Data:", response.data);

      // 8. Verificar resposta da WAHA e retornar sucesso/erro
      // (Reintroduzindo o IF que verifica o status HTTP)
      if (response.status >= 200 && response.status < 300) { 
          console.log(`[sendWahaConfirmation] WAHA response OK. Proceeding to update Firestore status for ${appointmentId}.`);
          // 7. Atualizar status do agendamento para PENDING_CONFIRMATION
          console.log(`[sendWahaConfirmation] Attempting to update status for ${appointmentId} to pending_confirmation...`);
          try { // <<< TRY/CATCH específico para o update
             await appointmentRef.update({
               status: "pending_confirmation", 
               last_confirmation_sent_at: admin.firestore.FieldValue.serverTimestamp(),
             });
            console.log(`[sendWahaConfirmation] Successfully updated status for ${appointmentId} to pending_confirmation.`);
          } catch (updateError: any) {
              console.error(`[sendWahaConfirmation] !!! FAILED TO UPDATE FIRESTORE STATUS for ${appointmentId} !!!`, updateError);
              // Lançar erro para notificar o front-end
              throw new https.HttpsError("internal", `Mensagem WAHA enviada, mas falha ao atualizar status no banco: ${updateError.message}`, updateError);
          }

           // 8. Retornar sucesso (APÓS o update bem-sucedido)
           return { success: true, message: "Mensagem de confirmação enviada com sucesso! Status atualizado para pendente." };
      } else {
           // Se a WAHA não retornar sucesso, lançar um erro
           console.error(`[sendWahaConfirmation] WAHA API responded with non-success status: ${response.status}`);
           throw new Error(`WAHA API respondeu com status ${response.status}`);
      }

    } catch (error: any) {
      console.error(`[sendWahaConfirmation] CRITICAL ERROR processing appointment ${appointmentId}:`, error);
      // Log aprimorado no catch
      console.error(`[sendWahaConfirmation] Error during WAHA send or Firestore update for appointment ${appointmentId}:`, error);
      let errorMessage = "Falha ao enviar mensagem de confirmação ou atualizar status.";
      // Tratar erros específicos do Axios se necessário
      if (axios.isAxiosError(error)) {
         console.error("[sendWahaConfirmation] Axios Error Details:", {
             message: error.message,
             code: error.code,
             status: error.response?.status,
             data: error.response?.data
         });
         errorMessage += ` Falha na comunicação com a API de WhatsApp: ${error.message}`;
      }
      // Relançar outros erros
      if (error instanceof https.HttpsError) {
        throw error;
      } else {
        throw new https.HttpsError("internal", errorMessage, error.message);
      }
    }
  }
);
// --- Fim da Função WAHA ---

// --- FUNÇÃO WEBHOOK PARA RESPOSTAS WAHA --- 
export const handleWahaWebhook = https.onRequest(
    {
        region: 'us-central1', // <<< AJUSTADO PARA us-central1 >>>
        // Não precisa de CORS aqui, pois será chamada por um servidor (WAHA)
        // Mas pode precisar de validação de token/segredo
    },
    async (req, res) => { 
        console.log(`[handleWahaWebhook / v: ${CODE_VERSION}] Webhook received.`);

        // 1. Segurança (Exemplo Básico - Verificar um segredo no header se a WAHA suportar)
        // const expectedToken = "SEU_SEGREDO_COMPARTILHADO_COM_WAHA"; 
        // const receivedToken = req.headers['x-waha-secret']; // Exemplo de header
        // if (receivedToken !== expectedToken) {
        //     console.error("[handleWahaWebhook] Invalid or missing secret token.");
        //     res.status(401).send("Unauthorized");
        //     return;
        // }

        // 2. Verificar Método (esperamos POST)
        if (req.method !== 'POST') {
            console.warn(`[handleWahaWebhook] Received non-POST request: ${req.method}`);
            res.status(405).send('Method Not Allowed');
            return;
        }

        // 3. Extrair Dados do Corpo da Requisição (Ajustar conforme payload real da WAHA)
        const webhookData = req.body;
        console.log("[handleWahaWebhook] Received payload:", JSON.stringify(webhookData, null, 2));

        try {
             // Verificar se é um evento de mensagem e se tem payload
             if (webhookData.event === 'message' && webhookData.payload) {
                 const messagePayload = webhookData.payload;
                 const chatId = messagePayload.from; // Ex: "55119... @c.us" ou "...@g.us"
                 const messageBody = messagePayload.body?.toLowerCase().trim(); // Ex: "sim"
 
                 console.log(`[handleWahaWebhook] Processing message from: ${chatId}, body: \"${messageBody}\"`);
 
                 // <<< PASSO 1: Verificar se é mensagem direta e se a resposta é positiva >>>
                 if (chatId && chatId.endsWith('@c.us') && messageBody === 'sim') {
                     console.log(`[handleWahaWebhook] Positive confirmation received from ${chatId}. Attempting to find appointment...`);
 
                     // --- Lógica Principal para Confirmação ---
                     try {
                         // <<< PASSO 2: Encontrar o Cliente pelo chatId >>>
                         //    (ASSUMINDO que existe um campo 'phone_waha_id' no customer com formato "55...@c.us")
                         const customerQuery = db.collection('customers').where('phone_waha_id', '==', chatId).limit(1);
                         const customerSnap = await customerQuery.get();
 
                         if (customerSnap.empty) {
                             console.log(`[handleWahaWebhook] Could not find customer for chat ID: ${chatId}`);
                             // Mesmo não achando, respondemos 200 para a WAHA não ficar tentando reenviar
                             res.status(200).send('Webhook processed (customer not found)');
                             return; // Sai da função
                         }
 
                         const customerDoc = customerSnap.docs[0];
                         const customerId = customerDoc.id;
                         const tenantId = customerDoc.data()?.tenant_id; // Pegar tenant_id do cliente
 
                         if (!tenantId) {
                             console.error(`[handleWahaWebhook] Customer ${customerId} found but missing tenant_id.`);
                             res.status(200).send('Webhook processed (customer missing tenant_id)');
                             return;
                         }
                         console.log(`[handleWahaWebhook] Found customer ${customerId} (Tenant: ${tenantId}) for chat ${chatId}`);
 
                         // <<< PASSO 3: Encontrar o Agendamento mais próximo >>>
                         const appointmentQuery = db.collection('appointments')
                             .where('tenant_id', '==', tenantId) // Filtra pelo tenant do cliente
                             .where('customer_id', '==', customerId)
                             .where('status', '==', 'pending_confirmation') // <<< BUSCAR AGENDAMENTOS PENDENTES >>>
                             .orderBy('last_confirmation_sent_at', 'desc') // <<< Ordena pelo envio MAIS RECENTE
                             .limit(1); // Pega o mais recente
                             
                         const appointmentSnap = await appointmentQuery.get();
 
                         if (appointmentSnap.empty) {
                             // Log mais preciso
                             console.log(`[handleWahaWebhook] No appointment found for customer ${customerId} with status 'pending_confirmation'.`);
                              res.status(200).send('Webhook processed (pending appointment not found)');
                              return; // Sai da função
                         }
 
                         // <<< PASSO 4: Atualizar o Status para CONFIRMADO >>>
                         const appointmentDoc = appointmentSnap.docs[0];
                         console.log(`[handleWahaWebhook] Found appointment ${appointmentDoc.id} to CONFIRM.`);
 
                         await appointmentDoc.ref.update({ 
                             status: 'confirmed', // <<< MUDA PARA CONFIRMADO >>>
                             updated_at: admin.firestore.FieldValue.serverTimestamp(),
                             confirmed_via: 'whatsapp' // Opcional: adicionar como foi confirmado
                         });
                         console.log(`[handleWahaWebhook] Appointment ${appointmentDoc.id} status updated to confirmed.`);
 
                         // <<< ENVIAR RESPOSTA DE AGRADECIMENTO (SIM) >>>
                         try {
                             const replyMessage = "Obrigado por confirmar seu agendamento!";
                             const payload = { session: WAHA_SESSION_NAME, chatId: chatId, text: replyMessage };
                             const headers = { 'Content-Type': 'application/json' /* , 'X-Api-Key': WAHA_API_KEY */ };
                             console.log(`[handleWahaWebhook] Sending confirmation reply to ${chatId}: "${replyMessage}"`);
                             await axios.post(WAHA_API_URL, payload, { headers });
                             console.log(`[handleWahaWebhook] Confirmation reply sent successfully to ${chatId}.`);
                         } catch (replyError: any) {
                             // Apenas logar erro, não impedir o fluxo principal
                             console.error(`[handleWahaWebhook] FAILED to send confirmation reply to ${chatId}:`, replyError.message);
                             if (axios.isAxiosError(replyError)) { console.error("Axios Reply Error Details:", replyError.response?.data); }
                         }
                         // <<< FIM ENVIO RESPOSTA (SIM) >>>

                     } catch (dbError) {
                         console.error("[handleWahaWebhook] Database error during CONFIRMATION process:", dbError);
                         // Não enviar 500 aqui, pois a WAHA pode tentar reenviar. Apenas logar.
                     }
                     // --- Fim da Lógica de Confirmação ---
                     
                     // LOG ADICIONAL PARA DEBUGAR O 'NÃO'
                     console.log(`[handleWahaWebhook] Checking for 'não'. Received body: "${messageBody}" (Length: ${messageBody?.length})`);
 
                 } else if (chatId && chatId.endsWith('@c.us') && messageBody === 'não') { // <<< TRATAR 'não'
                     console.log(`[handleWahaWebhook] Negative confirmation (NÃO) received from ${chatId}. Attempting to find appointment...`);

                     // --- Lógica para Cancelamento --- 
                     try {
                         // Repete a busca por cliente e agendamento pendente mais recente
                         const customerQuery = db.collection('customers').where('phone_waha_id', '==', chatId).limit(1);
                         const customerSnap = await customerQuery.get();

                         if (customerSnap.empty) {
                            console.log(`[handleWahaWebhook] Could not find customer for chat ID: ${chatId} (during cancellation attempt)`);
                            // Responde 200 para WAHA não reenviar
                             res.status(200).send('Webhook processed (customer not found for cancellation)');
                             return;
                         }

                         const customerDoc = customerSnap.docs[0];
                         const customerId = customerDoc.id;
                         const tenantId = customerDoc.data()?.tenant_id;

                         if (!tenantId) {
                             console.error(`[handleWahaWebhook] Customer ${customerId} found but missing tenant_id (during cancellation).`);
                             res.status(200).send('Webhook processed (customer missing tenant_id for cancellation)');
                             return;
                         }
                         console.log(`[handleWahaWebhook] Found customer ${customerId} (Tenant: ${tenantId}) for chat ${chatId} (for cancellation).`);

                         const appointmentQuery = db.collection('appointments')
                             .where('tenant_id', '==', tenantId)
                             .where('customer_id', '==', customerId)
                             .where('status', '==', 'pending_confirmation')
                             .orderBy('last_confirmation_sent_at', 'desc')
                             .limit(1);

                         const appointmentSnap = await appointmentQuery.get();

                         if (appointmentSnap.empty) {
                             console.log(`[handleWahaWebhook] No pending appointment found for customer ${customerId} to cancel.`);
                             res.status(200).send('Webhook processed (pending appointment not found for cancellation)');
                             return;
                         }

                          // <<< PASSO 4: Atualizar o Status >>>
                          const appointmentDoc = appointmentSnap.docs[0];
                          console.log(`[handleWahaWebhook] Found appointment ${appointmentDoc.id} to CANCEL.`);
  
                          await appointmentDoc.ref.update({ 
                              status: 'canceled', // <<< USA "canceled" (1 L) para consistência
                              updated_at: admin.firestore.FieldValue.serverTimestamp(),
                              cancelled_via: 'whatsapp' // Nome do campo pode manter 2 Ls se preferir, mas status deve ser consistente
                          });
                          console.log(`[handleWahaWebhook] Appointment ${appointmentDoc.id} status updated to canceled.`);
  
                          // <<< ENVIAR RESPOSTA DE AGRADECIMENTO (NÃO) >>>
                          try {
                              const replyMessage = "Ok, seu agendamento foi cancelado. Obrigado por nos avisar!";
                              const payload = { session: WAHA_SESSION_NAME, chatId: chatId, text: replyMessage };
                              const headers = { 'Content-Type': 'application/json' /* , 'X-Api-Key': WAHA_API_KEY */ };
                              console.log(`[handleWahaWebhook] Sending cancellation reply to ${chatId}: "${replyMessage}"`);
                              await axios.post(WAHA_API_URL, payload, { headers });
                              console.log(`[handleWahaWebhook] Cancellation reply sent successfully to ${chatId}.`);
                          } catch (replyError: any) {
                              // Apenas logar erro, não impedir o fluxo principal
                              console.error(`[handleWahaWebhook] FAILED to send cancellation reply to ${chatId}:`, replyError.message);
                              if (axios.isAxiosError(replyError)) { console.error("Axios Reply Error Details:", replyError.response?.data); }
                          }
                          // <<< FIM ENVIO RESPOSTA (NÃO) >>>

                     } catch (dbError) {
                         console.error("[handleWahaWebhook] Database error during CANCELLATION process:", dbError);
                         // Não enviar 500 aqui, pois a WAHA pode tentar reenviar. Apenas logar.
                     }
                      
                  } else if (chatId && !chatId.endsWith('@c.us')){
                      console.log(`[handleWahaWebhook] Ignoring message from group or non-user chat: ${chatId}`);
                  } else {
                       // Ignora mensagens que não são "sim" ou que não têm chatId válido
                       console.log(`[handleWahaWebhook] Ignoring non-confirmation message or invalid chat ID: ${chatId}, body: \"${messageBody}\"`);
                  }
             } else {
                  console.log(`[handleWahaWebhook] Ignoring event that is not a message or has no payload. Event: ${webhookData.event}`);
             }
 
             // 4. Responder à WAHA que recebemos (importante!)
             // Se chegou aqui sem retornar antes (por erro ou por não ser confirmação), envia um OK genérico
             res.status(200).send('Webhook received successfully');
 
         } catch (error) {
             console.error("[handleWahaWebhook] Error processing webhook:", error);
             // Enviar resposta de erro genérico para a WAHA, mas ainda 200 para evitar retentativas
             res.status(200).send('Webhook processed (internal error)');
         }
     }
 );
// --- Fim da Função Webhook WAHA ---

// --- Função handleMailTrigger (v2 - SEM ALTERAÇÕES NECESSÁRIAS AQUI) ---
// ... (código existente) ...

// --- Fim do Arquivo ---
