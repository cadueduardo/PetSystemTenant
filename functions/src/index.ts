import { https } from "firebase-functions/v2";
import * as admin from "firebase-admin";
// import { getAuth } from "firebase-admin/auth"; // <<< REMOVIDO (não usado)
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';
import * as logger from "firebase-functions/logger";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { defineString, defineSecret } from "firebase-functions/params";
// import * as crypto from 'crypto'; // Comentar import não usado

// Inicializar Firebase Admin SDK (MODULAR)
initializeApp();
const db = getFirestore();

// --- IDENTIFICADOR DE VERSÃO ---
const CODE_VERSION = new Date().toISOString();
logger.info(`[Function Init] Running code version: ${CODE_VERSION}`);
// ---------------------------------

// --- CONSTANTES ---
const CLAIMS_TENANT_ID = 'tenant_id';
const CLAIMS_PERFIL_ID = 'profile_id';
const CLAIMS_IS_COLLABORATOR = 'isCollaborator';
const CLAIMS_IS_ADMIN = 'isAdmin';
const FIRESTORE_WAHA_DOC = 'wahaIntegration';

// --- CONFIGURAÇÃO WAHA ---
const wahaApiUrl = defineString("WAHA_API_URL");
const wahaApiKey = defineString("WAHA_API_KEY");
const wahaWebhookHmacKey = defineSecret("WAHA_WEBHOOK_HMAC_KEY");

// --- Interfaces ---
interface InviteCollaboratorData {
  email: string;
  collaboratorName: string;
  profileId: string;
}

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
}

interface CompleteInvitationData {
  token: string;
  password: string;
}

interface SendWahaConfirmationData {
  appointmentId: string;
}

interface WahaWebhookPayload {
  event: string;
  session: string;
  payload?: any;
  me?: { id: string; pushName: string };
  timestamp?: number;
}

// --- Funções Auxiliares ---

function formatDateTime(timestamp: admin.firestore.Timestamp | undefined): string {
  if (!timestamp) return 'Data/Hora Indisponível';
  const date = timestamp.toDate();
  return date.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' }) +
         ' às ' +
         date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function getWahaApiHeaders(apiKey: string): Record<string, string> {
    return { 'X-Api-Key': apiKey };
}

function logWahaAxiosError(functionName: string, sessionName: string | null, tenantId: string | null, error: any) {
    if (axios.isAxiosError(error)) {
        logger.error(
            `${functionName} / v: ${CODE_VERSION}: Axios error details${sessionName ? ` for session ${sessionName}` : ''}:`,
            {
                tenantId,
                axiosErrorCode: error.code,
                wahaResponseStatus: error.response?.status,
                wahaResponseData: Buffer.isBuffer(error.response?.data)
                    ? Buffer.from(error.response.data).toString('utf8')
                    : error.response?.data,
                requestUrl: error.config?.url,
                requestMethod: error.config?.method,
                originalErrorMessage: error.message
            }
        );
    } else {
        logger.error(`${functionName} / v: ${CODE_VERSION}: Non-Axios error${sessionName ? ` for session ${sessionName}` : ''}:`, { tenantId, error: error?.message || 'Unknown error', errorObject: error });
    }
}

function handleWahaApiError(error: any, sessionName?: string): HttpsError {
     if (axios.isAxiosError(error)) {
         const status = error.response?.status;
         const responseData = error.response?.data;
         const responseDataString = Buffer.isBuffer(responseData)
             ? Buffer.from(responseData).toString('utf8')
             : JSON.stringify(responseData);

         if (status === 401) {
              return new HttpsError("unauthenticated", `Autenticação com a API WhatsApp falhou (401). Verifique a API Key configurada.`);
          }
          if (status === 404) {
               const message = sessionName
                  ? `Sessão ${sessionName} não encontrada (404).`
                  : `Recurso não encontrado na API WhatsApp (404).`;
               return new HttpsError("not-found", message);
          }
          if (status === 400) {
              const wahaMsg = responseDataString || '';
              if (wahaMsg.includes('Session already exists')) {
                   return new HttpsError("already-exists", `A sessão ${sessionName || 'desconhecida'} já existe ou está ativa.`);
              }
              return new HttpsError("invalid-argument", `Erro da API WhatsApp (400 - Bad Request): ${wahaMsg || 'Verifique os dados enviados.'}`);
          }
          if (status === 422) {
               const wahaMsg = responseDataString || '';
               if (wahaMsg.includes("WAHA Core support only 'default' session")) {
                    return new HttpsError("failed-precondition", `A versão atual do WAHA não suporta múltiplas sessões. Use a sessão 'default' ou considere o WAHA Plus.`);
               }
               return new HttpsError("invalid-argument", `Erro da API WhatsApp (422 - Unprocessable Entity): ${wahaMsg || 'Verifique os dados enviados.'}`);
          }
          if (status === 500 ) {
              if(responseDataString?.includes('Session not started')) {
                  return new HttpsError("failed-precondition", `A sessão ${sessionName || 'desconhecida'} não foi iniciada.`);
              }
              return new HttpsError("internal", `Erro interno da API WhatsApp (500).`, { wahaData: responseDataString });
          }
          if(error.response) {
             return new HttpsError("internal", `Erro na API WhatsApp (${status}).`, { wahaData: responseDataString });
          }
          return new HttpsError("unavailable", `Não foi possível conectar à API WhatsApp (${error.code || error.message || 'erro desconhecido'}). Verifique a URL e a rede.`);
     }
     return new HttpsError("internal", "Erro interno inesperado.", { error: error?.message || 'Unknown internal error' });
}

/* // Comentando a função inteira por enquanto
function verifyWahaWebhookSignature(secret: string, signatureHeader: string | string[] | undefined, rawBody: Buffer): boolean {
    if (!signatureHeader || typeof signatureHeader !== 'string') {
        logger.warn("Webhook signature header missing or invalid.");
        return false;
    }

    const signature = signatureHeader.startsWith('sha256=') ? signatureHeader.substring(7) : signatureHeader;
    const expectedSignature = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');

    const signaturesMatch = crypto.timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expectedSignature, 'hex'));

    if (!signaturesMatch) {
        logger.warn("Webhook signature mismatch.", { received: signature, expected: expectedSignature });
    }
    return signaturesMatch;
}
*/

// --- Funções Principais (Tenant/Invite) ---

export const createTenantAndAdmin = https.onCall(
  {
    cors: ["http://localhost:5173", "https://petfacil.app"],
    enforceAppCheck: false,
  },
  async (request: https.CallableRequest<CreateTenantData>) => {
    logger.info(`[createTenantAndAdmin / v: ${CODE_VERSION}] Function called.`);

    if (request.auth?.token?.tenant_id) {
      logger.error(`[createTenantAndAdmin] Permission Denied: Caller ${request.auth.uid} has tenant_id claim.`);
      throw new https.HttpsError("permission-denied", "Apenas o Super Administrador pode criar novos tenants.");
    }
    if (!request.auth) {
       logger.error(`[createTenantAndAdmin] Permission Denied: Unauthenticated caller.`);
       throw new https.HttpsError("unauthenticated", "Usuário não autenticado.");
    }
    const superAdminUid = request.auth.uid;
    logger.info(`[createTenantAndAdmin] Caller ${superAdminUid} verified as Super Admin.`);

    const data = request.data;
    if (!data.company_name || !data.adminEmail || !data.responsible_name || !data.access_url) {
      logger.error("[createTenantAndAdmin] Invalid input data (missing required fields):", data);
      throw new https.HttpsError("invalid-argument", "Dados incompletos para criação do tenant e administrador.");
    }

    const adminEmail = data.adminEmail;
    const auth = admin.auth();

    let adminUserUid: string | null = null;
    const tenantDocRef = db.collection("tenants").doc();
    const tenantId = tenantDocRef.id;
    logger.info(`[createTenantAndAdmin] Generated Tenant ID: ${tenantId}`);

    try {
      try {
        await auth.getUserByEmail(adminEmail);
        logger.error(`[createTenantAndAdmin] Admin email ${adminEmail} already exists in Auth.`);
        throw new https.HttpsError("already-exists", `O email ${adminEmail} já está cadastrado no sistema de autenticação.`);
      } catch (error: any) {
        if (error.code === 'auth/user-not-found') {
          logger.info(`[createTenantAndAdmin] Admin email ${adminEmail} does not exist yet. Proceeding...`);
        } else {
          logger.error(`[createTenantAndAdmin] Error checking admin email ${adminEmail}:`, error);
          throw new https.HttpsError("internal", "Erro ao verificar email do administrador.");
        }
      }

      logger.info(`[createTenantAndAdmin] Creating Auth user for admin: ${adminEmail}`);
      const adminUserRecord = await auth.createUser({
        email: adminEmail,
        emailVerified: false,
        displayName: data.responsible_name,
        disabled: false,
      });
      adminUserUid = adminUserRecord.uid;
      logger.info(`[createTenantAndAdmin] Auth user ${adminUserUid} created for admin ${adminEmail}.`);

      logger.info(`[createTenantAndAdmin] Setting claims for admin ${adminUserUid}...`);
      const customClaims = {
        [CLAIMS_TENANT_ID]: tenantId,
        [CLAIMS_IS_ADMIN]: true,
        [CLAIMS_IS_COLLABORATOR]: false
      };
      await auth.setCustomUserClaims(adminUserUid, customClaims);
      logger.info(`[createTenantAndAdmin] Claims set for admin ${adminUserUid}:`, customClaims);

      logger.info(`[createTenantAndAdmin] Creating tenant document ${tenantId} in Firestore...`);
      const tenantData = {
        ...data,
        id: tenantId,
        adminAuthUid: adminUserUid,
        createdBy: superAdminUid,
        created_at: admin.firestore.FieldValue.serverTimestamp(),
        updated_at: admin.firestore.FieldValue.serverTimestamp(),
      };
      delete (tenantData as any).card_info;

      await tenantDocRef.set(tenantData);
      logger.info(`[createTenantAndAdmin] Tenant document ${tenantId} created successfully.`);

      logger.info(`[createTenantAndAdmin] Generating password reset link for ${adminEmail}...`);
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
         customData: { action: 'admin_password_setup', tenantId: tenantId, codeVersion: CODE_VERSION }
       };
       await db.collection('mail').add(mailDoc);
       logger.info(`[createTenantAndAdmin] Password setup email sent to ${adminEmail}.`);

      logger.info(`[createTenantAndAdmin] Process completed successfully for tenant ${tenantId}.`);
      return { success: true, tenantData: { ...tenantData, id: tenantId } };

    } catch (error: any) {
      logger.error(`[createTenantAndAdmin] CRITICAL ERROR creating tenant or admin:`, error);
      if (adminUserUid) {
        logger.error(`[createTenantAndAdmin] Rolling back Auth user ${adminUserUid} due to error.`);
        await admin.auth().deleteUser(adminUserUid).catch(delErr => logger.error(`[createTenantAndAdmin] Error deleting partially created admin user ${adminUserUid}:`, delErr));
      }

      if (error instanceof https.HttpsError) { throw error; }
      throw new https.HttpsError("internal", "Erro interno ao criar loja e administrador.", error.message);
    }
  }
);

export const sendCustomInvite = https.onCall(
    {
      cors: ["http://localhost:5173", "https://petfacil.app"]
    },
    async (request: https.CallableRequest<InviteCollaboratorData>) => {
      const executionStartTime = Date.now();
      logger.info(`>>>>>>>>>> sendCustomInvite (v: ${CODE_VERSION}) STARTED <<<<<<<<<<`);

      if (!request.auth?.token?.tenant_id) {
        throw new https.HttpsError("permission-denied", "Ação permitida apenas para usuários logados com tenant.");
      }
      const tenantId = request.auth.token.tenant_id;
      const callerUid = request.auth.uid;
      logger.info(`[sendCustomInvite / v: ${CODE_VERSION}] Caller: ${callerUid}, Tenant: ${tenantId}`);

      const { email, collaboratorName, profileId } = request.data;
      if (!email || !collaboratorName || !profileId || !/\S+@\S+\.\S+/.test(email)) {
        throw new https.HttpsError("invalid-argument", "Dados inválidos: Email, Nome e Perfil são obrigatórios.");
      }
      logger.info(`[sendCustomInvite / v: ${CODE_VERSION}] Request validated for admin ${callerUid}. Data:`, { email, collaboratorName, profileId });

      let collaboratorDocRef: admin.firestore.DocumentReference | null = null;
      const invitationToken = uuidv4();
      const invitationExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 horas

      try {
        const collaboratorsRef = db.collection("colaboradores");
        const existingSnapshot = await collaboratorsRef
            .where("email", "==", email)
            .where("tenantId", "==", tenantId)
            .limit(1)
            .get();

        if (!existingSnapshot.empty) {
             const existingData = existingSnapshot.docs[0].data();
             logger.warn(`[sendCustomInvite] Collaborator document already exists for email ${email} in tenant ${tenantId} with status ${existingData.status}. Aborting.`);
             throw new https.HttpsError("already-exists", `Já existe um colaborador ou convite pendente para ${email} nesta loja.`);
        }
        logger.info(`[sendCustomInvite / v: ${CODE_VERSION}] No existing active/pending collaborator found for ${email} in tenant ${tenantId}. Proceeding...`);

        collaboratorDocRef = db.collection("colaboradores").doc();
        const collaboratorDocId = collaboratorDocRef.id;
        const collaboratorData = {
            tenantId: tenantId,
            perfilId: profileId,
            nome: collaboratorName,
            email: email,
            status: 'convite_pendente',
            convidadoPor: callerUid,
            criadoEm: admin.firestore.FieldValue.serverTimestamp(),
            atualizadoEm: admin.firestore.FieldValue.serverTimestamp(),
            invitationToken: invitationToken,
            invitationExpiresAt: admin.firestore.Timestamp.fromDate(invitationExpiresAt)
        };
        await collaboratorDocRef.set(collaboratorData);
        logger.info(`[sendCustomInvite / v: ${CODE_VERSION}] Collaborator document ${collaboratorDocId} created with status 'convite_pendente'.`);

        const acceptInvitationLink = `https://petfacil.app/accept-invitation?token=${invitationToken}`;
        const mailSubject = `Convite para colaborar na ${request.auth.token.name || 'sua loja'} no PetFácil!`;
        const mailHtml = `
          <p>Olá ${collaboratorName},</p>
          <p>Você foi convidado por ${request.auth.token.name || 'o administrador'} para colaborar na gestão da loja no PetFácil.</p>
          <p>Para aceitar o convite e criar sua senha de acesso, clique no link abaixo:</p>
          <p><a href="${acceptInvitationLink}">Aceitar Convite e Criar Senha</a></p>
          <p>Este link é válido por 24 horas.</p>
          <p>Se você não reconhece este convite, por favor ignore este email.</p>
          <p>Atenciosamente,<br>Equipe PetFácil</p>
        `;
        const mailText = `Olá ${collaboratorName},\n\nVocê foi convidado para colaborar no PetFácil. Para aceitar e criar sua senha, acesse:\n${acceptInvitationLink}\n\nEste link expira em 24 horas.\n\nEquipe PetFácil`;

        const mailDoc = {
          to: [email],
          message: { subject: mailSubject, html: mailHtml, text: mailText },
          customData: { createdBy: callerUid, tenantId: tenantId, action: 'collaborator_custom_invitation', collaboratorDocId: collaboratorDocId, codeVersion: CODE_VERSION }
        };
        await db.collection('mail').add(mailDoc);
        logger.info(`[sendCustomInvite / v: ${CODE_VERSION}] Mail document created for collaborator ${collaboratorDocId} invitation.`);

        const executionEndTime = Date.now();
        logger.info(`>>>>>>>>>> sendCustomInvite (v: ${CODE_VERSION}) FINISHED SUCCESSFULLY (Duration: ${executionEndTime - executionStartTime}ms) <<<<<<<<<<`);
        return { success: true, message: `Convite enviado com sucesso para ${email}.` };

      } catch (error: any) {
        const executionEndTime = Date.now();
        logger.error(`!!!!!!!!!! sendCustomInvite (v: ${CODE_VERSION}) FAILED (Duration: ${executionEndTime - executionStartTime}ms) !!!!!!!!!!`, { error });
        if (collaboratorDocRef) {
            logger.warn(`[sendCustomInvite / v: ${CODE_VERSION}] Attempting to mark collaborator ${collaboratorDocRef.id} as error due to failure.`);
            await collaboratorDocRef.update({ status: 'erro_no_convite', atualizadoEm: admin.firestore.FieldValue.serverTimestamp() }).catch(err => logger.error("Error updating collaborator status on failure:", err));
        }
        if (error instanceof https.HttpsError) { throw error; }
        throw new https.HttpsError("internal", `Falha ao enviar convite: ${error.message}`, error);
      }
    }
  );

export const completeInvitation = https.onCall(
    { cors: ["http://localhost:5173", "https://petfacil.app"] },
    async (request: https.CallableRequest<CompleteInvitationData>) => {
      const { token, password } = request.data;
      const auth = admin.auth();

      logger.info(`[completeInvitation / v: ${CODE_VERSION}] Attempting to complete invitation with token: ${token ? 'present' : 'missing'}`);

      if (!token || !password) {
        throw new https.HttpsError("invalid-argument", "Token e senha são obrigatórios.");
      }
      if (password.length < 6) {
           throw new https.HttpsError("invalid-argument", "A senha deve ter pelo menos 6 caracteres.");
      }

      try {
        const collaboratorsRef = db.collection("colaboradores");
        const q = collaboratorsRef.where("invitationToken", "==", token).limit(1);
        const snapshot = await q.get();

        if (snapshot.empty) {
          logger.error(`[completeInvitation] Invitation token not found: ${token}`);
          throw new https.HttpsError("not-found", "Convite inválido ou expirado (token não encontrado).");
        }

        const collaboratorDoc = snapshot.docs[0];
        const collaboratorData = collaboratorDoc.data();
        const collaboratorId = collaboratorDoc.id;

        logger.info(`[completeInvitation] Found collaborator doc: ${collaboratorId} for token: ${token}`);

        if (collaboratorData.status !== 'convite_pendente') {
           logger.error(`[completeInvitation] Collaborator ${collaboratorId} status is not 'convite_pendente': ${collaboratorData.status}`);
           throw new https.HttpsError("failed-precondition", "Este convite já foi utilizado ou está inválido.");
        }

        const expiresAt = collaboratorData.invitationExpiresAt?.toDate();
        if (!expiresAt || expiresAt < new Date()) {
            logger.error(`[completeInvitation] Invitation token expired for ${collaboratorId}. Expires At: ${expiresAt}`);
            await collaboratorDoc.ref.update({ status: 'convite_expirado', atualizadoEm: admin.firestore.FieldValue.serverTimestamp() }).catch(err => logger.error("Error updating status to expired:", err));
            throw new https.HttpsError("deadline-exceeded", "Este convite expirou.");
        }

        logger.info(`[completeInvitation] Token validated for collaborator: ${collaboratorData.email}`);

        let newUserUid: string | null = null;
        try {
            logger.info(`[completeInvitation] Creating Auth user for: ${collaboratorData.email}`);
            const newUserRecord = await auth.createUser({
                email: collaboratorData.email,
                password: password,
                emailVerified: true,
                displayName: collaboratorData.nome,
                disabled: false
            });
            newUserUid = newUserRecord.uid;
            logger.info(`[completeInvitation] Auth user ${newUserUid} created successfully.`);

            const customClaims = {
                [CLAIMS_TENANT_ID]: collaboratorData.tenantId,
                [CLAIMS_PERFIL_ID]: collaboratorData.perfilId,
                [CLAIMS_IS_COLLABORATOR]: true,
                [CLAIMS_IS_ADMIN]: false
            };
            await auth.setCustomUserClaims(newUserUid, customClaims);
            logger.info(`[completeInvitation] Claims set for ${newUserUid}.`);

            logger.info(`[completeInvitation] Updating collaborator document ${collaboratorId}...`);
            await collaboratorDoc.ref.update({
                authUid: newUserUid,
                status: 'ativo',
                invitationToken: null,
                invitationExpiresAt: null,
                atualizadoEm: admin.firestore.FieldValue.serverTimestamp()
            });
            logger.info(`[completeInvitation] Collaborator document ${collaboratorId} updated.`);

            logger.info(`[completeInvitation / v: ${CODE_VERSION}] Invitation completed successfully for ${collaboratorData.email}`);
            return { success: true, message: "Conta ativada e senha definida com sucesso!" };

        } catch (authError: any) {
            logger.error(`[completeInvitation] Error during Auth user creation or Firestore update for token ${token}:`, authError);
            if (newUserUid) {
                logger.error(`[completeInvitation] Rolling back Auth user ${newUserUid} due to subsequent error.`);
                await auth.deleteUser(newUserUid).catch(delErr => logger.error(`Error deleting partially created user ${newUserUid}:`, delErr));
            }
             if (authError.code === 'auth/email-already-exists' || authError.code === 'auth/email-already-in-use') {
                 await collaboratorDoc.ref.update({ status: 'erro_email_ja_existente', atualizadoEm: admin.firestore.FieldValue.serverTimestamp() }).catch(err => logger.error("Error updating status:", err));
                 throw new https.HttpsError("already-exists", "Este email já está registrado no sistema de autenticação.");
             }
            throw new https.HttpsError("internal", `Falha ao criar usuário ou atualizar dados: ${authError.message}`, authError);
        }

      } catch (error: any) {
        logger.error(`[completeInvitation / v: ${CODE_VERSION}] General error processing token ${token}:`, error);
        if (error instanceof https.HttpsError) { throw error; }
        throw new https.HttpsError("internal", `Erro inesperado ao processar o convite: ${error.message}`, error);
      }
    }
  );

// --- Funções WAHA ---

export const sendWahaConfirmation = https.onCall(
  {
    region: 'us-central1',
    timeoutSeconds: 60,
    memory: '256MiB',
    cors: ["http://localhost:5173", "https://petfacil.app"]
  },
  async (request: https.CallableRequest<SendWahaConfirmationData>) => {
    logger.info(`sendWahaConfirmation / v: ${CODE_VERSION}: Function called.`);

    if (!request.auth?.token?.tenant_id) {
      throw new HttpsError("permission-denied", "Ação permitida apenas para usuários logados com tenant.");
    }
    const tenantId = request.auth.token.tenant_id;
    const callerUid = request.auth.uid;
    logger.info(`sendWahaConfirmation / v: ${CODE_VERSION}: Caller: ${callerUid}, Tenant: ${tenantId}`);

    const { appointmentId } = request.data;
    if (!appointmentId) {
      throw new HttpsError("invalid-argument", "ID do agendamento é obrigatório.");
    }
    logger.info(`sendWahaConfirmation / v: ${CODE_VERSION}: Received appointmentId: ${appointmentId}`);

    const apiUrl = wahaApiUrl.value();
    const apiKey = wahaApiKey.value();
    if (!apiUrl || !apiKey) {
      logger.error("sendWahaConfirmation: WAHA API URL or API Key is not configured.", { tenantId });
      throw new HttpsError("internal", "Configuração interna do servidor WAHA está incompleta (URL ou API Key).");
    }

    const sessionName = `session_${tenantId}`;

    try {
      const appointmentRef = db.collection("appointments").doc(appointmentId);
      const appointmentSnap = await appointmentRef.get();
      if (!appointmentSnap.exists || !appointmentSnap.data()) throw new HttpsError("not-found", `Agendamento ${appointmentId} não encontrado.`);
      const appointmentData = appointmentSnap.data()!;
      if (appointmentData.tenant_id !== tenantId) throw new HttpsError("permission-denied", `Agendamento ${appointmentId} não pertence ao seu tenant.`);
      logger.info(`sendWahaConfirmation / v: ${CODE_VERSION}: Fetched appointment data for ID: ${appointmentId}`);

      const customerId = appointmentData.customer_id;
      if (!customerId) throw new HttpsError("failed-precondition", `Agendamento ${appointmentId} sem ID de cliente.`);
      const customerRef = db.collection("customers").doc(customerId);
      const customerSnap = await customerRef.get();
      if (!customerSnap.exists || !customerSnap.data()) throw new HttpsError("not-found", `Cliente ${customerId} não encontrado.`);
      const customerData = customerSnap.data()!;
      logger.info(`sendWahaConfirmation / v: ${CODE_VERSION}: Fetched customer data for ID: ${customerId}`);

      const customerPhone = customerData.phone;
      if (!customerPhone) throw new HttpsError("failed-precondition", `Cliente ${customerId} sem telefone.`);
      const formattedPhone = `55${customerPhone.replace(/\D/g, '')}`;
      const chatIdForWaha = `${formattedPhone}@c.us`;
      logger.info(`sendWahaConfirmation / v: ${CODE_VERSION}: Customer phone (Original): ${customerPhone} -> Formatted: ${chatIdForWaha}`);

      if (customerData.phone_waha_id !== chatIdForWaha) {
         try {
            await customerRef.update({ phone_waha_id: chatIdForWaha });
            logger.info(`sendWahaConfirmation / v: ${CODE_VERSION}: Updated customer ${customerId} with phone_waha_id: ${chatIdForWaha}`);
         } catch (updateError) {
             logger.warn(`sendWahaConfirmation / v: ${CODE_VERSION}: Failed to update phone_waha_id for customer ${customerId}:`, updateError);
         }
      }

      let tenantName = "sua clínica";
      try {
          const tenantDoc = await db.collection('tenants').doc(tenantId).get();
          if (tenantDoc.exists) tenantName = tenantDoc.data()?.company_name || tenantName;
      } catch (e) { logger.warn(`Could not fetch tenant name for ${tenantId}:`, e); }

      const message = `Olá ${appointmentData.customer_name || 'Cliente'}, tudo bem? Confirmando seu agendamento em ${tenantName} para ${appointmentData.pet_name || 'seu pet'} no dia ${formatDateTime(appointmentData.start_time)}. Responda SIM para confirmar ou NÃO para cancelar. Obrigado!`;
      logger.info(`sendWahaConfirmation / v: ${CODE_VERSION}: Message prepared: \"${message}\"`);

      const sendUrl = `${apiUrl.replace(/\/$/, '')}/api/sendText`;
      const payload = { session: sessionName, chatId: chatIdForWaha, text: message };
      const headers = getWahaApiHeaders(apiKey);
      headers['Content-Type'] = 'application/json';

      logger.info(`sendWahaConfirmation / v: ${CODE_VERSION}: Sending request to WAHA: ${sendUrl} for session ${sessionName}`);
      const response = await axios.post(sendUrl, payload, { headers });

      logger.info(`sendWahaConfirmation / v: ${CODE_VERSION}: WAHA API Response Status: ${response.status}`);

      if (response.status >= 200 && response.status < 300) {
        logger.info(`sendWahaConfirmation / v: ${CODE_VERSION}: WAHA response OK. Updating Firestore status for ${appointmentId}.`);
        try {
           await appointmentRef.update({
             status: "pending_confirmation",
             last_confirmation_sent_at: admin.firestore.FieldValue.serverTimestamp(),
             updated_at: admin.firestore.FieldValue.serverTimestamp()
           });
           logger.info(`sendWahaConfirmation / v: ${CODE_VERSION}: Successfully updated status for ${appointmentId}.`);
           return { success: true, message: "Mensagem de confirmação enviada com sucesso!" };
        } catch (updateError: any) {
            logger.error(`sendWahaConfirmation / v: ${CODE_VERSION}: !!! FAILED TO UPDATE FIRESTORE STATUS for ${appointmentId} !!!`, updateError);
            throw new HttpsError("internal", `Mensagem WAHA enviada, mas falha ao atualizar status no banco: ${updateError.message}`);
        }
      } else {
        logger.error(`sendWahaConfirmation / v: ${CODE_VERSION}: WAHA API responded with non-success status: ${response.status}`);
        throw handleWahaApiError({ response }, sessionName);
      }

    } catch (error: any) {
      logWahaAxiosError('sendWahaConfirmation', sessionName, tenantId, error);
      if (error instanceof HttpsError) {
        throw error;
      } else {
        throw handleWahaApiError(error, sessionName);
      }
    }
  }
);

export const handleWahaWebhook = https.onRequest(
    { 
        region: 'us-central1', 
        secrets: [wahaWebhookHmacKey],
    },
    async (req, res) => {
        const functionStartTime = Date.now();
        logger.info(`handleWahaWebhook / v: ${CODE_VERSION}: Webhook received.`);

        if (req.method !== 'POST') {
            logger.warn(`handleWahaWebhook / v: ${CODE_VERSION}: Received non-POST request: ${req.method}`);
            res.setHeader('Allow', 'POST');
            res.status(405).send('Method Not Allowed');
            return;
        }

        // --- Verificação HMAC --- 
        // const secret = wahaWebhookHmacKey.value(); // Comentar variável não usada
        // const signature = req.headers['x-hub-signature-256']; // Comentando a variável também
        
        // Nota: A verificação do rawBody pode ser complexa com Cloud Functions V2 e body-parser.
        // O Firebase Functions faz o parse automático do JSON.

        const webhookData = req.body as WahaWebhookPayload;
        const eventSession = webhookData.session;
        const eventType = webhookData.event;
        
        logger.info(`handleWahaWebhook / v: ${CODE_VERSION}: Event '${eventType}' for session '${eventSession}' received.`, { payload: webhookData.payload });

        if (!eventSession || !eventSession.startsWith('session_') || !eventType) {
          logger.warn(`[handleWahaWebhook / v: ${CODE_VERSION}] Invalid webhook data: Missing session or event type.`, { session: eventSession, event: eventType });
          res.status(400).send('Bad Request: Missing session or event type.');
          return;
        }

        const tenantId = eventSession.substring('session_'.length);
        logger.info(`handleWahaWebhook / v: ${CODE_VERSION}: Extracted tenantId: ${tenantId}`);

        const wahaDocRef = db.collection('tenants').doc(tenantId).collection('integrations').doc(FIRESTORE_WAHA_DOC);
        let dataToUpdate: Partial<{ status: string; qrCodeDataUri: string | null; lastEventTimestamp: admin.firestore.FieldValue, lastEventType: string }> = {
             lastEventTimestamp: admin.firestore.FieldValue.serverTimestamp(),
             lastEventType: eventType
        };
        let shouldUpdate = false;

        try {
             if (eventType === 'session.status' && webhookData.payload?.status) {
                 const wahaStatus = webhookData.payload.status;
                 logger.info(`handleWahaWebhook / v: ${CODE_VERSION}: Processing session.status: ${wahaStatus} for tenant ${tenantId}`);
                 
                 let frontendStatus = "Desconhecido";
                 if (wahaStatus === 'authenticated' || wahaStatus === 'online' || wahaStatus === 'connected') frontendStatus = "Conectado";
                 else if (wahaStatus === 'scanQrCode' || wahaStatus === 'gotQrCode' || wahaStatus === 'SCAN_QR_CODE') frontendStatus = "QRCode";
                 else if (wahaStatus === 'disconnected' || wahaStatus === 'offline') frontendStatus = "Desconectado";
                 else if (wahaStatus === 'connecting' || wahaStatus === 'init' || wahaStatus === 'STARTING') frontendStatus = "Iniciando";
                 else if (wahaStatus === 'WORKING') frontendStatus = "Conectado";
                 else logger.warn(`handleWahaWebhook / v: ${CODE_VERSION}: Unknown WAHA status '${wahaStatus}' received via webhook.`, { tenantId });
                 
                 dataToUpdate.status = frontendStatus;
                 shouldUpdate = true;

                 if (frontendStatus !== 'QRCode') {
                    dataToUpdate.qrCodeDataUri = null; 
                    logger.info(`handleWahaWebhook / v: ${CODE_VERSION}: Status changed to ${frontendStatus}. Clearing QR code. Will update Firestore.`, { tenantId });
                 } else {
                     // --- Se o status é QRCode, TENTA buscar a imagem --- 
                     logger.info(`handleWahaWebhook / v: ${CODE_VERSION}: Status is QRCode. Attempting to fetch QR image for ${eventSession}...`, { tenantId });
                     const apiUrl = wahaApiUrl.value();
                     const apiKey = wahaApiKey.value();
                     if (apiUrl && apiKey) {
                         const qrCodeUrl = `${apiUrl}/api/${eventSession}/auth/qr?format=image`;
                         const headers = getWahaApiHeaders(apiKey);
                         try {
                             const qrResponse = await axios.get(qrCodeUrl, { headers, responseType: 'arraybuffer' });
                             const contentType = qrResponse.headers['content-type'];
                             if (contentType?.startsWith('image/')) {
                                 const base64 = Buffer.from(qrResponse.data, 'binary').toString('base64');
                                 dataToUpdate.qrCodeDataUri = `data:${contentType};base64,${base64}`;
                                 logger.info(`handleWahaWebhook / v: ${CODE_VERSION}: Successfully fetched QR Code image for ${eventSession}. Will update Firestore.`, { tenantId });
                             } else {
                                 logger.warn(`handleWahaWebhook / v: ${CODE_VERSION}: Received non-image content type from WAHA QR endpoint during webhook: ${contentType}`, { tenantId });
                                 dataToUpdate.qrCodeDataUri = null; // Garante que limpa se a resposta não for imagem
                             }
                         } catch (qrError: any) {
                             // Loga o erro, mas não impede a atualização do status para QRCode
                             logWahaAxiosError('handleWahaWebhook (QR Fetch)', eventSession, tenantId, qrError);
                             logger.warn(`handleWahaWebhook / v: ${CODE_VERSION}: Failed to fetch QR image for ${eventSession} after status change (may not be ready yet). Will update status to QRCode without image.`, { tenantId });
                             dataToUpdate.qrCodeDataUri = null; // Garante que limpa se der erro
                         }
                     } else {
                         logger.error(`handleWahaWebhook / v: ${CODE_VERSION}: Cannot fetch QR code because WAHA API URL or API Key is missing in config.`, { tenantId });
                         dataToUpdate.qrCodeDataUri = null;
                     }
                     // --------------------------------------------------
                 }
             } 
             
             // <<< ADICIONAR BLOCO PARA PROCESSAR MENSAGENS RECEBIDAS >>>
             else if ((eventType === 'message' || eventType === 'message.any') && webhookData.payload) {
                const messagePayload = webhookData.payload;
                const chatId = messagePayload.from; // Ex: "55119...@c.us"
                const messageBody = messagePayload.body?.toLowerCase().trim();

                logger.info(`handleWahaWebhook / v: ${CODE_VERSION}: Processing message from: ${chatId}, body: \"${messageBody}\"`, { tenantId });

                // Verificar se é mensagem direta de usuário e se é "sim" ou "não"
                if (chatId && chatId.endsWith('@c.us') && (messageBody === 'sim' || messageBody === 'não')) {
                    const isConfirmation = messageBody === 'sim';
                    logger.info(`handleWahaWebhook / v: ${CODE_VERSION}: ${isConfirmation ? 'Positive' : 'Negative'} confirmation received from ${chatId}. Attempting to find appointment...`, { tenantId });

                    try {
                        // Encontrar o Cliente pelo chatId (usando phone_waha_id)
                        const customerQuery = db.collection('customers').where('phone_waha_id', '==', chatId).where('tenant_id', '==', tenantId).limit(1);
                        const customerSnap = await customerQuery.get();

                        if (customerSnap.empty) {
                            logger.warn(`handleWahaWebhook / v: ${CODE_VERSION}: Could not find customer for chat ID: ${chatId} in tenant ${tenantId}.`, { tenantId });
                            // Não fazer nada se o cliente não for encontrado
                        } else {
                            const customerDoc = customerSnap.docs[0];
                            const customerId = customerDoc.id;
                            logger.info(`handleWahaWebhook / v: ${CODE_VERSION}: Found customer ${customerId} for chat ${chatId}`, { tenantId });

                            // Encontrar o Agendamento pendente mais recente para este cliente
                            const appointmentQuery = db.collection('appointments')
                                .where('tenant_id', '==', tenantId)
                                .where('customer_id', '==', customerId)
                                .where('status', '==', 'pending_confirmation')
                                .orderBy('last_confirmation_sent_at', 'desc')
                                .limit(1);
                            const appointmentSnap = await appointmentQuery.get();

                            if (appointmentSnap.empty) {
                                logger.warn(`handleWahaWebhook / v: ${CODE_VERSION}: No appointment found for customer ${customerId} with status 'pending_confirmation'.`, { tenantId });
                            } else {
                                const appointmentDoc = appointmentSnap.docs[0];
                                const appointmentId = appointmentDoc.id;
                                const newStatus = isConfirmation ? 'confirmed' : 'canceled'; // Usar 'canceled' (1 L)
                                const logAction = isConfirmation ? 'CONFIRM' : 'CANCEL';

                                logger.info(`handleWahaWebhook / v: ${CODE_VERSION}: Found appointment ${appointmentId} to ${logAction}. Updating status to ${newStatus}.`, { tenantId });

                                await appointmentDoc.ref.update({
                                    status: newStatus,
                                    updated_at: admin.firestore.FieldValue.serverTimestamp(),
                                    ...(isConfirmation ? { confirmed_via: 'whatsapp' } : { cancelled_via: 'whatsapp' }) // Adiciona info extra
                                });
                                logger.info(`handleWahaWebhook / v: ${CODE_VERSION}: Appointment ${appointmentId} status updated to ${newStatus}.`, { tenantId });

                                // Enviar resposta de agradecimento/confirmação
                                const apiUrl = wahaApiUrl.value();
                                const apiKey = wahaApiKey.value();
                                const sessionName = `session_${tenantId}`;
                                if (apiUrl && apiKey) {
                                     const replyMessage = isConfirmation
                                         ? "Obrigado por confirmar seu agendamento!"
                                         : "Ok, seu agendamento foi cancelado. Obrigado por nos avisar!";
                                     const sendUrl = `${apiUrl.replace(/\/$/, '')}/api/sendText`;
                                     const payload = { session: sessionName, chatId: chatId, text: replyMessage };
                                     const headers = getWahaApiHeaders(apiKey);
                                     headers['Content-Type'] = 'application/json';

                                     try {
                                         logger.info(`handleWahaWebhook / v: ${CODE_VERSION}: Sending reply to ${chatId}: \"${replyMessage}\"`, { tenantId });
                                         await axios.post(sendUrl, payload, { headers });
                                         logger.info(`handleWahaWebhook / v: ${CODE_VERSION}: Reply sent successfully to ${chatId}.`, { tenantId });
                                     } catch (replyError: any) {
                                         logWahaAxiosError('handleWahaWebhook (Reply Send)', sessionName, tenantId, replyError);
                                         logger.error(`handleWahaWebhook / v: ${CODE_VERSION}: FAILED to send reply to ${chatId}.`, { tenantId });
                                     }
                                }
                            }
                        }
                    } catch (dbError) {
                        logger.error("[handleWahaWebhook / v: ${CODE_VERSION}] Database error during confirmation/cancellation process:", { tenantId, error: dbError });
                    }
                } else {
                    logger.info(`[handleWahaWebhook / v: ${CODE_VERSION}] Ignoring message (not SIM/NÃO or not from user chat). ChatID: ${chatId}`, { tenantId });
                }
             }
             // <<< FIM DO BLOCO PARA PROCESSAR MENSAGENS >>>
             
             else {
                 logger.info(`handleWahaWebhook / v: ${CODE_VERSION}: Ignoring event type '${eventType}' for now.`, { tenantId });
             }

             if (shouldUpdate) {
                 logger.info(`handleWahaWebhook / v: ${CODE_VERSION}: Updating Firestore doc: ${wahaDocRef.path} with data:`, { dataToUpdate });
                 await wahaDocRef.set(dataToUpdate, { merge: true });
                 logger.info(`handleWahaWebhook / v: ${CODE_VERSION}: Firestore updated successfully for tenant ${tenantId}.`);
             }

             const functionEndTime = Date.now();
             logger.info(`handleWahaWebhook / v: ${CODE_VERSION}: Processed event '${eventType}' for session '${eventSession}'. Duration: ${functionEndTime - functionStartTime}ms.`);
             res.status(200).send('Webhook received successfully');

         } catch (error) {
             const functionEndTime = Date.now();
             logger.error(`handleWahaWebhook / v: ${CODE_VERSION}: FAILED to process webhook for session ${eventSession}. Duration: ${functionEndTime - functionStartTime}ms. Error:`, error);
             res.status(500).send('Webhook processing failed due to internal server error.');
         }
    }
);

export const getWahaSessionStatus = onCall(
    {
        region: 'us-central1',
        cors: ["http://localhost:5173", "https://petfacil.app"],
        timeoutSeconds: 180,
    },
    async (request) => {
        logger.info(`getWahaSessionStatus / v: ${CODE_VERSION}: Function called`, { structuredData: true });

        const uid = request.auth?.uid;
        const tenantId = request.auth?.token.tenant_id;
        if (!uid || !tenantId) throw new HttpsError("unauthenticated", "Usuário não autenticado ou sem tenant ID.");
        logger.info(`getWahaSessionStatus / v: ${CODE_VERSION}: User ${uid}, Tenant ${tenantId}`, { uid, tenantId });

        const apiUrl = wahaApiUrl.value();
        const apiKey = wahaApiKey.value();

        logger.info(`getWahaSessionStatus / v: ${CODE_VERSION}: Config read - apiUrl: [${apiUrl}], apiKey: [${apiKey ? 'present' : 'missing'}]`, { tenantId });

        if (!apiUrl || !apiKey) {
            logger.error(`getWahaSessionStatus / v: ${CODE_VERSION}: WAHA API URL or API Key is not configured.`, { tenantId });
            throw new HttpsError("internal", "Configuração interna do servidor WAHA está incompleta (URL ou API Key).");
        }

        const sessionName = `session_${tenantId}`;
        const statusUrl = `${apiUrl}/api/sessions/${sessionName}/status`;
        logger.info(`getWahaSessionStatus / v: ${CODE_VERSION}: Checking status for ${sessionName} at ${statusUrl}`, { tenantId });

        const headers = getWahaApiHeaders(apiKey);

        try {
            const response = await axios.get(statusUrl, { headers });
            logger.info(`getWahaSessionStatus / v: ${CODE_VERSION}: WAHA API response for ${sessionName}:`, { status: response.status, data: response.data });

            const wahaStatus = response.data?.status;
            let frontendStatus = "Desconhecido";
            if (wahaStatus === 'authenticated' || wahaStatus === 'online' || wahaStatus === 'connected') frontendStatus = "Conectado";
            else if (wahaStatus === 'scanQrCode' || wahaStatus === 'gotQrCode') frontendStatus = "QRCode";
            else if (wahaStatus === 'disconnected' || wahaStatus === 'offline') frontendStatus = "Desconectado";
            else if (wahaStatus === 'connecting' || wahaStatus === 'init') frontendStatus = "Iniciando";
            else logger.warn(`getWahaSessionStatus / v: ${CODE_VERSION}: Unknown WAHA status '${wahaStatus}' for ${sessionName}.`, { tenantId });

            logger.info(`getWahaSessionStatus / v: ${CODE_VERSION}: Mapped status for ${sessionName}: ${frontendStatus}`, { tenantId });
            return { status: frontendStatus };

        } catch (error: any) {
            if (axios.isAxiosError(error) && error.response?.status === 404) {
                logger.info(`getWahaSessionStatus / v: ${CODE_VERSION}: Session ${sessionName} not found (404). Assuming disconnected.`, { tenantId });
                return { status: "Desconectado" };
            }
            logWahaAxiosError('getWahaSessionStatus', sessionName, tenantId, error);
            throw handleWahaApiError(error, sessionName);
        }
    }
);

export const getWahaQrCode = onCall(
    {
        region: 'us-central1',
        cors: ["http://localhost:5173", "https://petfacil.app"],
    },
    async (request) => {
        logger.info(`getWahaQrCode / v: ${CODE_VERSION}: Function called`, { structuredData: true });

        const uid = request.auth?.uid;
        const tenantId = request.auth?.token.tenant_id;
        if (!uid || !tenantId) throw new HttpsError("unauthenticated", "Usuário não autenticado ou sem tenant ID.");
        logger.info(`getWahaQrCode / v: ${CODE_VERSION}: User ${uid}, Tenant ${tenantId}`, { uid, tenantId });

        const apiUrl = wahaApiUrl.value();
        const apiKey = wahaApiKey.value();

        logger.info(`getWahaQrCode / v: ${CODE_VERSION}: Config read - apiUrl: [${apiUrl}], apiKey: [${apiKey ? 'present' : 'missing'}]`, { tenantId });

        if (!apiUrl || !apiKey) {
            logger.error(`getWahaQrCode / v: ${CODE_VERSION}: WAHA API URL or API Key is not configured.`, { tenantId });
            throw new HttpsError("internal", "Configuração interna do servidor WAHA está incompleta (URL ou API Key).");
        }

        const sessionName = `session_${tenantId}`;
        const qrCodeUrl = `${apiUrl}/api/${sessionName}/auth/qr?format=image`;
        logger.info(`getWahaQrCode / v: ${CODE_VERSION}: Fetching QR Code for ${sessionName} at ${qrCodeUrl}`, { tenantId });

        const headers = getWahaApiHeaders(apiKey);

        try {
            const response = await axios.get(qrCodeUrl, { headers, responseType: 'arraybuffer' });
            logger.info(`getWahaQrCode / v: ${CODE_VERSION}: WAHA API response status for ${sessionName} QR Code: ${response.status}`);

            const contentType = response.headers['content-type'];
            if (!contentType || !contentType.startsWith('image/')) {
                 logger.error(`getWahaQrCode / v: ${CODE_VERSION}: Received non-image content type from WAHA QR endpoint: ${contentType}`, { tenantId });
                 let errorText = 'Resposta inesperada (não imagem).';
                 try { errorText = Buffer.from(response.data).toString('utf8'); } catch(_) {}
                 throw new HttpsError("internal", "A API não retornou uma imagem de QR Code.", { response: errorText });
            }

            const base64 = Buffer.from(response.data, 'binary').toString('base64');
            const qrCodeDataUri = `data:${contentType};base64,${base64}`;
            logger.info(`getWahaQrCode / v: ${CODE_VERSION}: Successfully generated QR Code Data URI for ${sessionName}. Size: ${qrCodeDataUri.length} chars.`, { tenantId });
            return { qrCodeDataUri };

        } catch (error: any) {
             logWahaAxiosError('getWahaQrCode', sessionName, tenantId, error);
             if (axios.isAxiosError(error) && error.response?.status === 404) {
                 logger.warn(`getWahaQrCode / v: ${CODE_VERSION}: Received 404 for QR Code for session ${sessionName}.`, { tenantId });
                 throw new HttpsError("not-found", "QR Code não disponível no momento. Verifique o status da conexão.");
             }
            throw handleWahaApiError(error, sessionName);
        }
    }
);

export const startWahaSession = onCall(
  {
      region: 'us-central1',
      cors: ["http://localhost:5173", "https://petfacil.app"],
      timeoutSeconds: 60,
  },
  async (request) => {
      logger.info(`startWahaSession / v: ${CODE_VERSION}: Function called`, { structuredData: true });

      const uid = request.auth?.uid;
      const tenantId = request.auth?.token.tenant_id;
      if (!uid || !tenantId) throw new HttpsError("unauthenticated", "Usuário não autenticado ou sem tenant ID.");
      logger.info(`startWahaSession / v: ${CODE_VERSION}: User ${uid}, Tenant ${tenantId}`, { uid, tenantId });

      const apiUrl = wahaApiUrl.value();
      const apiKey = wahaApiKey.value();

      logger.info(`startWahaSession / v: ${CODE_VERSION}: Config read - apiUrl: [${apiUrl}], apiKey: [${apiKey ? 'present' : 'missing'}]`, { tenantId });

      if (!apiUrl || !apiKey) {
          logger.error(`startWahaSession / v: ${CODE_VERSION}: WAHA API URL or API Key is not configured.`, { tenantId });
          throw new HttpsError("internal", "Configuração interna do servidor WAHA está incompleta (URL ou API Key).");
      }

      const sessionName = `session_${tenantId}`;
      const startSessionUrl = `${apiUrl}/api/sessions/start`;
      logger.info(`startWahaSession / v: ${CODE_VERSION}: Attempting to start session ${sessionName} at ${startSessionUrl}`, { tenantId });

      const headers = getWahaApiHeaders(apiKey);
      headers['Content-Type'] = 'application/json';
      const requestBody = { name: sessionName };

      try {
          logger.info(`startWahaSession / v: ${CODE_VERSION}: Sending POST request to ${startSessionUrl} with body:`, { body: requestBody });
          const response = await axios.post(startSessionUrl, requestBody, { headers });
          logger.info(`startWahaSession / v: ${CODE_VERSION}: WAHA API response for starting ${sessionName}:`, { status: response.status, data: response.data });

          if (response.status >= 200 && response.status < 300) {
              logger.info(`startWahaSession / v: ${CODE_VERSION}: Session start request successful for ${sessionName}.`, { tenantId });
              return { success: true, message: "Solicitação para iniciar sessão enviada.", data: response.data };
          } else {
              logger.warn(`startWahaSession / v: ${CODE_VERSION}: Unexpected WAHA API status for starting ${sessionName}: ${response.status}`, { tenantId });
              throw handleWahaApiError({ response }, sessionName);
          }

      } catch (error: any) {
           logWahaAxiosError('startWahaSession', sessionName, tenantId, error);

           if (axios.isAxiosError(error) && error.response?.status === 422) {
               const responseDataString = Buffer.isBuffer(error.response?.data)
                  ? Buffer.from(error.response.data).toString('utf8')
                  : JSON.stringify(error.response?.data);
               if (responseDataString?.includes("is already started")) {
                  logger.info(`startWahaSession / v: ${CODE_VERSION}: Received 422 'already started' for session ${sessionName}. Considering it a success.`, { tenantId });
                  return { success: true, message: "Sessão já iniciada.", code: 'already-started', data: error.response?.data };
               }
           }

           if (axios.isAxiosError(error) && error.response?.status === 409 && startSessionUrl.endsWith('/api/sessions')) {
               logger.info(`startWahaSession / v: ${CODE_VERSION}: Received 409 Conflict for session ${sessionName} on POST /sessions. Assuming already exists/starting.`, { tenantId });
               return { success: true, message: "Sessão já existe ou está iniciando.", code: 'already-exists', data: error.response?.data };
           }
          throw handleWahaApiError(error, sessionName);
      }
  }
);

// ... (restante do código, stopWahaSession, Fim do Arquivo) ...

// TODO: Adicionar função stopWahaSession (DELETE /api/sessions/logout/{sessionName} ou /api/sessions/stop/{sessionName} ?)

// --- Fim do Arquivo ---