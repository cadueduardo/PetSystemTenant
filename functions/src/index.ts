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
import { onSchedule } from "firebase-functions/v2/scheduler"; // Ensure this import is present or add it at the top
import { ScheduledEvent } from "firebase-functions/v2/scheduler";
import { onDocumentUpdated, Change, FirestoreEvent, QueryDocumentSnapshot } from "firebase-functions/v2/firestore"; // <<< Imports v2 para Firestore Trigger >>>// Inicializar Firebase Admin SDK (MODULAR)
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
    region: "southamerica-east1", // <<< Adicionar Região >>>
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
      region: "southamerica-east1", // <<< Adicionar Região >>>
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
    {
        region: "southamerica-east1", // <<< Adicionar Região >>>
        cors: ["http://localhost:5173", "https://petfacil.app"]
    },
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
    region: 'southamerica-east1', // <<< Mudar Região >>>
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

      // --- INÍCIO: Buscar configurações e preparar template ---
      let messagingSettings = null;
      let finalMessageText = "ERRO: Template de confirmação não pôde ser carregado."; // Fallback inicial
      try {
          const customQuery = await db.collection('customizations')
                                        .where('tenant_id', '==', tenantId)
                                        .limit(1)
                                        .get();
          if (!customQuery.empty) {
              messagingSettings = customQuery.docs[0].data()?.messaging_settings;
              logger.info(`[sendWahaConfirmation] Found messaging settings for tenant ${tenantId}.`);
              if (messagingSettings && typeof messagingSettings.template_confirmation === 'string' && messagingSettings.template_confirmation.trim() !== '') {
                  finalMessageText = messagingSettings.template_confirmation;
                  logger.info(`[sendWahaConfirmation] Using specific template: \"${finalMessageText.substring(0, 50)}...\"`);
              } else {
                  logger.warn(`[sendWahaConfirmation] Specific template not found or empty for tenant ${tenantId}. Using default error message.`);
                  // Mantém finalMessageText como a mensagem de erro
              }
          } else {
              logger.warn(`[sendWahaConfirmation] No customization document found for tenant ${tenantId}. Cannot load template.`);
              // Mantém finalMessageText como a mensagem de erro
          }
      } catch (configError) {
          logger.error(`[sendWahaConfirmation] Failed to load messaging settings for tenant ${tenantId}`, { error: configError });
          // Mantém finalMessageText como a mensagem de erro
      }

      // Aplica as substituições no template carregado (ou no fallback de erro)
      finalMessageText = finalMessageText.replace('{cliente}', appointmentData.customer_name || 'Cliente');
      finalMessageText = finalMessageText.replace('{clinica}', tenantName);
      finalMessageText = finalMessageText.replace('{pet}', appointmentData.pet_name || 'seu pet');
      finalMessageText = finalMessageText.replace('{data_hora}', formatDateTime(appointmentData.start_time));
      // --- FIM: Buscar configurações e preparar template ---

      // Verifica se a mensagem final ainda é a de erro (opcional: pode querer enviar erro ou falhar)
      if (finalMessageText.startsWith("ERRO:")) {
          logger.error(`[sendWahaConfirmation] Cannot send confirmation for ${appointmentId} due to missing template configuration.`);
          // Decide o que fazer: lançar erro ou retornar falha?
          // Lançar erro pode ser melhor para o usuário ver feedback no frontend
          throw new HttpsError("failed-precondition", "Não foi possível carregar o modelo de mensagem configurado.");
          // Alternativa: return { success: false, message: "Falha ao carregar modelo de mensagem." };
      }

      logger.info(`sendWahaConfirmation / v: ${CODE_VERSION}: Final message prepared: \"${finalMessageText}\"`);

      const sendUrl = `${apiUrl.replace(/\/$/, '')}/api/sendText`;
      // Usa finalMessageText no payload
      const payload = { session: sessionName, chatId: chatIdForWaha, text: finalMessageText };
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
        region: 'southamerica-east1', // <<< Mudar Região >>>
        secrets: [wahaWebhookHmacKey],
        timeoutSeconds: 300, // <<< AUMENTADO TIMEOUT PARA 300s >>>
        memory: '512MiB',  // <<< AUMENTADA MEMÓRIA PARA 512MiB >>>
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
 
                 // <<< Otimização: Remover busca síncrona de QR Code daqui >>>
                 // A função de webhook apenas define o status e limpa o QR antigo.
                 // O frontend será responsável por buscar o novo QR quando o status for 'QRCode'.
                 dataToUpdate.qrCodeDataUri = null;
                 logger.info(`[handleWahaWebhook / v: ${CODE_VERSION}] Status changing to ${frontendStatus}. Setting status and clearing QR code in Firestore.`, { tenantId });
             } 
             
             // <<< ADICIONAR BLOCO PARA PROCESSAR MENSAGENS RECEBIDAS >>>
             else if ((eventType === 'message' || eventType === 'message.any') && webhookData.payload) {
                 // <<< ADD DETAILED LOGGING HERE >>>
                 logger.info(`[handleWahaWebhook / v: ${CODE_VERSION}] RAW MESSAGE EVENT RECEIVED. Type: ${eventType}`, { tenantId, fullPayload: webhookData });
                 // <<< END DETAILED LOGGING >>>

                 const messagePayload = webhookData.payload;
                 const chatId = messagePayload.from; // Ex: "55119...@c.us"
                 const messageBody = messagePayload.body?.toLowerCase().trim();

                 // <<< ADICIONAR VERIFICAÇÃO fromMe >>>
                 if (messagePayload.fromMe) {
                     logger.info(`[handleWahaWebhook / v: ${CODE_VERSION}] Ignoring outgoing message echo for chat: ${chatId}.`, { tenantId });
                     // Retorna status 200 OK para o webhook, mas não processa a mensagem
                     // Importante: Não chamar res.send duas vezes, então apenas retornamos aqui
                     // A resposta final será enviada no final do try/catch principal do webhook
                     return; // Interrompe o processamento da mensagem específica
                 }
                 // <<< FIM DA VERIFICAÇÃO fromMe >>>

                 logger.info(`handleWahaWebhook / v: ${CODE_VERSION}: Processing INCOMING message from: ${chatId}, body: \"${messageBody}\"`, { tenantId });

                 // --- INÍCIO: Lógica de Processamento de Resposta Flexível ---
                 const sessionName = `session_${tenantId}`; // <<< Definir sessionName aqui >>>
 
                 if (chatId && chatId.endsWith('@c.us') && messageBody) { // Garante que messageBody existe

                     // <<< INÍCIO: Buscar Cliente e Agendamento Pendente PRIMEIRO >>>
                     let pendingAppointmentDoc: admin.firestore.DocumentSnapshot | null = null;
                     let customerIdForLookup: string | null = null;
                     try {
                         const customerQuery = db.collection('customers').where('phone_waha_id', '==', chatId).where('tenant_id', '==', tenantId).limit(1);
                         const customerSnap = await customerQuery.get();
                         if (!customerSnap.empty) {
                             const customerDoc = customerSnap.docs[0];
                             customerIdForLookup = customerDoc.id;
                             logger.debug(`[handleWahaWebhook Lookup] Found customer ${customerIdForLookup} for chat ${chatId}. Looking for pending appointment...`, { tenantId });

                             const appointmentQuery = db.collection('appointments')
                                 .where('tenant_id', '==', tenantId)
                                 .where('customer_id', '==', customerIdForLookup)
                                 .where('status', '==', 'pending_confirmation')
                                 .orderBy('last_confirmation_sent_at', 'desc')
                                 .limit(1);
                             const appointmentSnap = await appointmentQuery.get();
                             if (!appointmentSnap.empty) {
                                 pendingAppointmentDoc = appointmentSnap.docs[0];
                                 logger.info(`[handleWahaWebhook Lookup] Found pending appointment ${pendingAppointmentDoc.id} for customer ${customerIdForLookup}.`, { tenantId });
                             } else {
                                 logger.info(`[handleWahaWebhook Lookup] No pending appointment found for customer ${customerIdForLookup}.`, { tenantId });
                             }
                         } else {
                             logger.info(`[handleWahaWebhook Lookup] Customer not found for chat ID ${chatId}.`, { tenantId });
                         }
                     } catch(lookupError) {
                          logger.error(`[handleWahaWebhook Lookup] Error looking up customer/appointment for ${chatId}:`, { tenantId, error: lookupError });
                          // Continua mesmo com erro de lookup, mas não encontrará agendamento pendente
                     }
                     // <<< FIM: Buscar Cliente e Agendamento Pendente PRIMEIRO >>>

                     // Agora, processa a resposta SÓ SE houver um agendamento pendente
                     if (pendingAppointmentDoc && customerIdForLookup) {

                      const containsSim = /\b(sim|s)\b/i.test(messageBody); // Regex: \b = word boundary, i = case-insensitive
                      const containsNao = /\b(não|nao|n)\b/i.test(messageBody);
                      logger.debug(`[WH Debug] Regex results - containsSim: ${containsSim}, containsNao: ${containsNao}`, { tenantId, chatId });

                      // --- Lógica para SIM --- 
                      if (containsSim && !containsNao) {
                           logger.info(`handleWahaWebhook / v: ${CODE_VERSION}: Positive confirmation detected from ${chatId}. Processing...`, { tenantId });
                           try {
                               // Busca cliente
                               const customerQuery = db.collection('customers').where('phone_waha_id', '==', chatId).where('tenant_id', '==', tenantId).limit(1);
                               const customerSnap = await customerQuery.get();
                               if (!customerSnap.empty) {
                                   const customerId = customerSnap.docs[0].id;
                                   logger.debug(`[WH Sim] Customer found: ${customerId}. Looking for pending appointment...`, { tenantId });

                                   // Busca agendamento pendente
                                   const appointmentQuery = db.collection('appointments')
                                       .where('tenant_id', '==', tenantId)
                                       .where('customer_id', '==', customerId)
                                       .where('status', '==', 'pending_confirmation')
                                       .orderBy('last_confirmation_sent_at', 'desc')
                                       .limit(1);
                                   const appointmentSnap = await appointmentQuery.get();

                                   if (!appointmentSnap.empty) {
                                       // Encontrou agendamento pendente -> Confirma
                                       const appointmentDoc = appointmentSnap.docs[0];
                                       const appointmentId = appointmentDoc.id;
                                       logger.info(`[handleWahaWebhook Conf] Found appointment ${appointmentId} for customer ${customerId}. Preparing update...`, { tenantId });
                                       await appointmentDoc.ref.update({
                                           status: 'confirmed',
                                           updated_at: admin.firestore.FieldValue.serverTimestamp()
                                       });
                                       logger.info(`[WH Sim] Appointment ${appointmentId} status updated to confirmed in Firestore. Reply sending responsibility moved to Firestore trigger.`, { tenantId });
                                   } else {
                                        logger.warn(`[WH Sim] Customer ${customerId} found, but no PENDING appointment. Ignoring confirmation.`, { tenantId });
                                   }
                               } else {
                                   logger.warn(`[WH Sim] Customer not found for chat ID ${chatId}. Ignoring confirmation.`, { tenantId });
                               }
                           } catch (dbError) { logger.error("[WH Sim] DB error processing confirmation:", { tenantId, error: dbError }); }

                       } else if (containsNao) { // Contém "não" (ou variação)
                           logger.info(`handleWahaWebhook / v: ${CODE_VERSION}: Negative confirmation detected from ${chatId}.`, { tenantId });
                             try {
                                 // Busca cliente
                                 const customerQuery = db.collection('customers').where('phone_waha_id', '==', chatId).where('tenant_id', '==', tenantId).limit(1);
                                 const customerSnap = await customerQuery.get();
                                 if (!customerSnap.empty) {
                                     const customerId = customerSnap.docs[0].id;
                                     logger.debug(`[WH Nao] Customer found: ${customerId}. Looking for pending appointment...`, { tenantId });

                                    // Busca agendamento pendente
                                     const appointmentQuery = db.collection('appointments')
                                         .where('tenant_id', '==', tenantId)
                                         .where('customer_id', '==', customerId)
                                         .where('status', '==', 'pending_confirmation')
                                         .orderBy('last_confirmation_sent_at', 'desc')
                                         .limit(1);
                                     const appointmentSnap = await appointmentQuery.get();

                                    if (!appointmentSnap.empty) {
                                         // Encontrou agendamento pendente -> Cancela
                                         const appointmentDoc = appointmentSnap.docs[0];
                                         const appointmentId = appointmentDoc.id;
                                         logger.info(`[handleWahaWebhook Canc] Found appointment ${appointmentId} for customer ${customerId}. Preparing update...`, { tenantId });
                                         await appointmentDoc.ref.update({
                                             status: 'canceled',
                                             updated_at: admin.firestore.FieldValue.serverTimestamp()
                                         });
                                         logger.info(`[WH Nao] Appointment ${appointmentId} status updated to canceled in Firestore. Reply sending responsibility moved to Firestore trigger.`, { tenantId });
                                     } else {
                                          logger.warn(`[WH Nao] Customer ${customerId} found, but no PENDING appointment. Ignoring cancellation.`, { tenantId });
                                     }
                                 } else {
                                     logger.warn(`[WH Nao] Customer not found for chat ID ${chatId}. Ignoring cancellation.`, { tenantId });
                                 }
                             } catch (dbError) { logger.error("[WH Nao] DB error processing cancellation:", { tenantId, error: dbError }); }

                         // --- Lógica para OUTRAS MENSAGENS --- 
                         } else {
                              // Verifica se HÁ um agendamento pendente antes de responder "Não entendi"
                              try {
                                  // Busca cliente
                                  const customerQuery = db.collection('customers').where('phone_waha_id', '==', chatId).where('tenant_id', '==', tenantId).limit(1);
                                  const customerSnap = await customerQuery.get();
                                  if (!customerSnap.empty) {
                                      const customerId = customerSnap.docs[0].id;
                                      logger.debug(`[WH Other] Customer found: ${customerId}. Looking for pending appointment...`, { tenantId });

                                      // Busca agendamento pendente
                                      const appointmentQuery = db.collection('appointments')
                                           .where('tenant_id', '==', tenantId)
                                           .where('customer_id', '==', customerId)
                                           .where('status', '==', 'pending_confirmation')
                                           .limit(1); // Não precisa ordenar aqui, só saber se existe
                                      const appointmentSnap = await appointmentQuery.get();

                                      if (!appointmentSnap.empty) {
                                          // EXISTE agendamento pendente -> Responde "Não entendi"
                                          logger.info(`[WH Other] Unrecognized response from ${chatId} for pending appointment ${appointmentSnap.docs[0].id}. Sending 'did not understand' reply. Body: "${messageBody}"`, { tenantId });
                                          // Enviar mensagem "Não entendi"
                                          const apiUrl = wahaApiUrl.value();
                                          const apiKey = wahaApiKey.value();
                                          const sendUrl = `${apiUrl.replace(/\/$/, '')}/api/sendText`;
                                          const payload = { session: sessionName, chatId: chatId, text: "Desculpe, não entendi sua resposta. Por favor, responda apenas com SIM ou NÃO para confirmar ou cancelar seu agendamento." };
                                          const headers = getWahaApiHeaders(apiKey);
                                          headers['Content-Type'] = 'application/json';
                                          try {
                                              const response = await axios.post(sendUrl, payload, { headers });
                                              logger.info(`[WH Other] WAHA API response for 'did not understand' reply:`, { status: response.status, data: response.data });
                                          } catch (replyError: any) {
                                              logWahaAxiosError('handleWahaWebhook (Did not understand Reply Send)', sessionName, tenantId, replyError);
                                          }
                                      } else {
                                           // NÃO existe agendamento pendente -> Ignora silenciosamente
                                           logger.info(`[WH Other] Received message from customer ${customerId} but no PENDING appointment found. Ignoring. Body: "${messageBody}"`, { tenantId });
                                      }
                                  } else {
                                       // Cliente não encontrado -> Ignora silenciosamente
                                       logger.info(`[WH Other] Received message from ${chatId} but customer not found. Ignoring. Body: "${messageBody}"`, { tenantId });
                                  }
                              } catch(lookupError) {
                                  logger.error(`[WH Other] DB error checking for pending appointment for ${chatId}:`, { tenantId, error: lookupError });
                              }
                          }
                      }
                  } else {
                       logger.info(`[handleWahaWebhook / v: ${CODE_VERSION}] Ignoring message (not from user chat '@c.us' or empty body). ChatID: ${chatId}`, { tenantId });
                  }
                 // --- FIM: Lógica de Processamento de Resposta Flexível ---
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
        region: 'southamerica-east1', // <<< Mudar Região >>>
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
        region: 'southamerica-east1', // <<< Mudar Região >>>
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
      region: 'southamerica-east1', // <<< Mudar Região >>>
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

// TODO: Adicionar função stopWahaSession (DELETE /api/sessions/logout/{sessionName} ou /api/sessions/stop/{sessionName} ?)

// <<< NOVA FUNÇÃO stopWahaSession >>>
export const stopWahaSession = onCall(
  {
      region: 'southamerica-east1', // <<< Mudar Região >>>
      cors: ["http://localhost:5173", "https://petfacil.app"],
      timeoutSeconds: 60,
  },
  async (request) => {
      logger.info(`stopWahaSession / v: ${CODE_VERSION}: Function called`, { structuredData: true });

      const uid = request.auth?.uid;
      const tenantId = request.auth?.token.tenant_id;
      if (!uid || !tenantId) throw new HttpsError("unauthenticated", "Usuário não autenticado ou sem tenant ID.");
      logger.info(`stopWahaSession / v: ${CODE_VERSION}: User ${uid}, Tenant ${tenantId}`, { uid, tenantId });

      const apiUrl = wahaApiUrl.value();
      const apiKey = wahaApiKey.value();

      logger.info(`stopWahaSession / v: ${CODE_VERSION}: Config read - apiUrl: [${apiUrl}], apiKey: [${apiKey ? 'present' : 'missing'}]`, { tenantId });

      if (!apiUrl || !apiKey) {
          logger.error(`stopWahaSession / v: ${CODE_VERSION}: WAHA API URL or API Key is not configured.`, { tenantId });
          throw new HttpsError("internal", "Configuração interna do servidor WAHA está incompleta (URL ou API Key).");
      }

      const sessionName = `session_${tenantId}`;
      // Endpoint confirmado como POST pelo usuário -> MUDANDO PARA DELETE /sessions/{name}
      // const stopUrl = `${apiUrl.replace(/\/$/, '')}/api/sessions/${sessionName}/stop`; 
      const deleteUrl = `${apiUrl.replace(/\/$/, '')}/api/sessions/${sessionName}`; // <<< URL PARA DELETAR SESSÃO
      logger.info(`stopWahaSession / v: ${CODE_VERSION}: Attempting to DELETE session ${sessionName} at ${deleteUrl}`, { tenantId }); // Log DELETE

      const headers = getWahaApiHeaders(apiKey);
      // Nenhum corpo de requisição é geralmente necessário para logout

      try {
          // <<< MUDAR PARA CHAMAR axios.delete >>>
          logger.info(`stopWahaSession / v: ${CODE_VERSION}: Sending DELETE request to ${deleteUrl}`);
          const response = await axios.delete(deleteUrl, { headers }); // <<< USA axios.delete >>>
          logger.info(`stopWahaSession / v: ${CODE_VERSION}: WAHA API response for deleting ${sessionName}:`, { status: response.status, data: response.data });

          if (response.status >= 200 && response.status < 300) {
              logger.info(`stopWahaSession / v: ${CODE_VERSION}: Session delete request successful for ${sessionName}. WAHA webhook might send disconnected status.`, { tenantId });
              // Nota: O status no Firestore será atualizado pelo webhook se WAHA enviar 'disconnected'.
              return { success: true, message: "Solicitação para deletar sessão enviada." };
          } else {
              // Se o status da resposta não for 2xx, apenas loga e lança erro
              logger.warn(`stopWahaSession / v: ${CODE_VERSION}: Unexpected WAHA API status for deleting ${sessionName}: ${response.status}`, { tenantId });
              throw handleWahaApiError({ response }, sessionName); // Lança erro baseado na resposta não-2xx
          }
 
       } catch (error: any) { 
           logWahaAxiosError('stopWahaSession', sessionName, tenantId, error);
           // Verifica se o erro é 404 (sessão já deletada/não encontrada), considera como sucesso idempotente
           if (axios.isAxiosError(error) && error.response?.status === 404) {
               logger.info(`stopWahaSession / v: ${CODE_VERSION}: Received 404 for delete for session ${sessionName}. Assuming already deleted.`, { tenantId });
                return { success: true, message: "Sessão já deletada ou não encontrada.", code: 'not-found' };
           }
           // Para outros erros, relança usando o handler padrão
           throw handleWahaApiError(error, sessionName);
       }
  }
);
// --- FIM NOVA FUNÇÃO ---

// --- Função Auxiliar Refatorada para Processar Agendamento ---
async function processAndSendConfirmation(
    appointmentDoc: admin.firestore.QueryDocumentSnapshot,
    tenantId: string,
    companyName: string, // <<< NOTE: companyName is now passed in
    messagingSettings: any
) {
    const appointmentId = appointmentDoc.id;
    const appointmentData = appointmentDoc.data();
    logger.info(`[Scheduler Process] Processing appointment ${appointmentId} for tenant ${tenantId}.`);

    // Verifica se já foi enviado (dupla checagem, caso a query não filtre)
    if (appointmentData.last_confirmation_sent_at) {
        logger.info(`[Scheduler Process] Appointment ${appointmentId} already has last_confirmation_sent_at. Skipping.`);
        return; // Sai da função auxiliar se já foi enviado
    }

    const customerId = appointmentData.customer_id;
    const petName = appointmentData.pet_name || 'seu pet';
    const appointmentStartTime = appointmentData.start_time;

    if (!customerId) {
        logger.warn(`[Scheduler Process] Appointment ${appointmentId} for tenant ${tenantId} has no customer_id. Skipping.`);
        return;
    }

    try {
        const customerDoc = await db.collection('customers').doc(customerId).get();
        if (!customerDoc.exists) {
            logger.warn(`[Scheduler Process] Customer ${customerId} not found for appointment ${appointmentId}. Skipping.`);
            return;
        }
        const customerData = customerDoc.data();
        const customerPhone = customerData?.phone_waha_id || customerData?.phone;
        const customerName = customerData?.full_name || 'Cliente';

        if (!customerPhone) {
            logger.warn(`[Scheduler Process] Customer ${customerId} has no phone number. Skipping appointment ${appointmentId}.`);
            return;
        }
        const chatIdForWaha = customerPhone.includes('@') ? customerPhone : `55${customerPhone.replace(/\D/g, '')}@c.us`;

        // --- Lógica do Template (igual à da função anterior) ---
        const defaultTemplate = "ERRO: Template de confirmação padrão não encontrado ou configurado.";
        let messageText = defaultTemplate;

        if (messagingSettings && typeof messagingSettings.template_confirmation === 'string' && messagingSettings.template_confirmation.trim() !== '') {
            messageText = messagingSettings.template_confirmation;
            logger.info(`[Scheduler Process] Using specific confirmation template for tenant ${tenantId}: \"${messageText.substring(0, 50)}...\"`);
        } else {
            logger.warn(`[Scheduler Process] Specific confirmation template not found or empty for tenant ${tenantId}. Falling back to default/error message.`);
        }

        messageText = messageText.replace('{cliente}', customerName);
        messageText = messageText.replace('{clinica}', companyName); // <<< Uses the passed companyName
        messageText = messageText.replace('{pet}', petName);
        messageText = messageText.replace('{data_hora}', formatDateTime(appointmentStartTime));

        if (messageText === defaultTemplate) {
            logger.error(`[Scheduler Process] Skipping send for appointment ${appointmentId} due to missing template configuration.`);
           return; // Não envia se o template falhou
        }
        // --- Fim da Lógica do Template ---

        logger.info(`[Scheduler Process] Tenant ${tenantId}: Preparing to send confirmation for appointment ${appointmentId} to ${chatIdForWaha}. Message: \"${messageText}\"`);

        const apiUrl = wahaApiUrl.value();
        const apiKey = wahaApiKey.value();
        const sessionName = `session_${tenantId}`;

        if (!apiUrl || !apiKey) {
            logger.error(`[Scheduler Process] Cannot send message for tenant ${tenantId}: WAHA API URL or Key missing.`);
            return;
        }

        const sendUrl = `${apiUrl.replace(/\/$/, '')}/api/sendText`;
        const payload = { session: sessionName, chatId: chatIdForWaha, text: messageText };
        const headers = getWahaApiHeaders(apiKey);
        headers['Content-Type'] = 'application/json';

        try {
            const response = await axios.post(sendUrl, payload, { headers });
            if (response.status >= 200 && response.status < 300) {
                logger.info(`[Scheduler Process] WAHA confirmation sent successfully for appointment ${appointmentId}. Updating status.`);
                await appointmentDoc.ref.update({
                    status: 'pending_confirmation',
                    last_confirmation_sent_at: admin.firestore.FieldValue.serverTimestamp(),
                    updated_at: admin.firestore.FieldValue.serverTimestamp()
                });
            } else {
                logger.error(`[Scheduler Process] WAHA API responded with ${response.status} for appointment ${appointmentId}.`);
            }
        } catch (sendError: any) {
            logWahaAxiosError(`scheduledWahaConfirmationSender (Send - Helper)`, sessionName, tenantId, sendError);
            logger.error(`[Scheduler Process] Failed to send WAHA message for appointment ${appointmentId}.`);
        }

    } catch (innerError) {
        logger.error(`[Scheduler Process] Error processing appointment ${appointmentId} for tenant ${tenantId}:`, { error: innerError });
    }
}
// --- Fim Função Auxiliar ---

// --- Função Agendada Modificada ---
export const scheduledWahaConfirmationSender = onSchedule(
    {
        schedule: "every 15 minutes",
        region: "southamerica-east1" // <<< Adicionar Região >>>
    },
    async (event: ScheduledEvent): Promise<void> => {
        const functionStartTime = Date.now();
        logger.info(`>>>>>>>>>> scheduledWahaConfirmationSender (v: ${CODE_VERSION}) STARTED <<<<<<<<<<`);

        try {
            const tenantsSnapshot = await db.collection('tenants').where('status', '==', 'active').get();
            logger.info(`[Scheduler] Found ${tenantsSnapshot.size} active tenants.`);

            if (tenantsSnapshot.empty) {
                logger.info("[Scheduler] No active tenants found. Exiting function.");
                return;
            }

            const processingPromises = tenantsSnapshot.docs.map(async (tenantDoc) => {
                const tenantId = tenantDoc.id;
                const tenantData = tenantDoc.data();
                // <<< CHANGE HERE: Use 'name' instead of 'company_name' >>>
                const companyName = tenantData.name || `Tenant ${tenantId}`; // Changed field to 'name'
                logger.info(`[Scheduler] Processing tenant: ${companyName} (${tenantId})`);

                let messagingSettings = null;
                try {
                    const customQuery = await db.collection('customizations')
                                                .where('tenant_id', '==', tenantId)
                                                .limit(1)
                                                .get();
                    if (!customQuery.empty) {
                        messagingSettings = customQuery.docs[0].data()?.messaging_settings;
                        logger.info(`[Scheduler] Found messaging settings for tenant ${tenantId}.`);
                    } else {
                        logger.warn(`[Scheduler] No customization document found for tenant ${tenantId}. Skipping tenant.`);
                        return;
                    }
                } catch (configError) {
                    logger.error(`[Scheduler] Failed to load messaging settings for tenant ${tenantId}`, { error: configError });
                    return;
                }

                if (!messagingSettings?.auto_send_confirmation) {
                    logger.info(`[Scheduler] Auto-confirmation disabled for tenant ${tenantId}. Skipping.`);
                    return;
                }
                logger.info(`[Scheduler] Auto-confirmation ENABLED for tenant ${tenantId}.`);

                const sendBeforeHours = messagingSettings.send_before_hours || 24;
                const now = new Date();
                const nowTimestamp = admin.firestore.Timestamp.fromDate(now);
                const windowStart = new Date(now.getTime() + sendBeforeHours * 60 * 60 * 1000);
                const windowStartTimestamp = admin.firestore.Timestamp.fromDate(windowStart);
                const windowEnd = new Date(windowStart.getTime() + 15 * 60 * 1000);
                const windowEndTimestamp = admin.firestore.Timestamp.fromDate(windowEnd);

                // --- Query 1: Janela Padrão (Ex: 24h a 24h15min no futuro) ---
                logger.info(`[Scheduler Query 1] Tenant ${tenantId}: Checking standard window ${windowStart.toISOString()} to ${windowEnd.toISOString()}`);
                const standardAppointmentsQuery = db.collection('appointments')
                    .where('tenant_id', '==', tenantId)
                    .where('status', '==', 'scheduled')
                    .where('start_time', '>=', windowStartTimestamp)
                    .where('start_time', '<', windowEndTimestamp);

                // --- Query 2: Curto Prazo (Agora até < 24h no futuro, sem envio prévio) ---
                logger.info(`[Scheduler Query 2] Tenant ${tenantId}: Checking near-term window ${now.toISOString()} to ${windowStart.toISOString()}`);
                const nearTermAppointmentsQuery = db.collection('appointments')
                    .where('tenant_id', '==', tenantId)
                    .where('status', '==', 'scheduled')
                    .where('start_time', '>=', nowTimestamp) // A partir de agora
                    .where('start_time', '<', windowStartTimestamp); // Até o início da janela padrão
                    // Note: Filtraremos por last_confirmation_sent_at no código

                try {
                    // Executa ambas as queries
                    const [standardSnapshot, nearTermSnapshot] = await Promise.all([
                        standardAppointmentsQuery.get(),
                        nearTermAppointmentsQuery.get()
                    ]);

                    logger.info(`[Scheduler Results] Tenant ${tenantId}: Found ${standardSnapshot.size} in standard window, ${nearTermSnapshot.size} in near-term window.`);

                    // Processa agendamentos da janela padrão
                    for (const appointmentDoc of standardSnapshot.docs) {
                         // Passa companyName para a função auxiliar
                        await processAndSendConfirmation(appointmentDoc, tenantId, companyName, messagingSettings);
                    }

                    // Processa agendamentos de curto prazo (que ainda não foram enviados)
                    for (const appointmentDoc of nearTermSnapshot.docs) {
                        // A verificação do last_confirmation_sent_at é feita DENTRO da função auxiliar
                        await processAndSendConfirmation(appointmentDoc, tenantId, companyName, messagingSettings);
                    }

                } catch (queryError: any) {
                     logger.error(`[Scheduler] Tenant ${tenantId}: !!! FAILED TO EXECUTE APPOINTMENT QUERIES !!!`, {
                         error_message: queryError.message,
                         error_code: queryError.code,
                         error_details: queryError.details,
                     });
                     // Não continuar para este tenant se as queries falharam
                     return;
                }
            });

            await Promise.all(processingPromises);

        } catch (error) {
            logger.error(`!!!!!!!!!! scheduledWahaConfirmationSender (v: ${CODE_VERSION}) FAILED !!!!!!!!!!`, { error: error });
        } finally {
            const functionEndTime = Date.now();
            logger.info(`>>>>>>>>>> scheduledWahaConfirmationSender (v: ${CODE_VERSION}) FINISHED (Duration: ${functionEndTime - functionStartTime}ms) <<<<<<<<<<`);
        }
    }
);
// --- Fim Função Agendada Modificada ---

// --- Fim do Arquivo ---

// --- NOVA FUNÇÃO: Gatilho Firestore para Enviar Respostas WAHA ---
export const sendWahaReplyOnStatusChange = onDocumentUpdated(
    { // <<< Opções v2 >>>
        region: "southamerica-east1",
        document: "appointments/{appointmentId}"
    },
    async (event: FirestoreEvent<Change<QueryDocumentSnapshot> | undefined, { appointmentId: string }>) => { // <<< Tipos v2 corrigidos >>>
        logger.info(`[Firestore Trigger - ENTRY] Function invoked for appointment ID: ${event.params.appointmentId}`); // <<< Log de entrada >>>
        const functionStartTime = Date.now();
        const appointmentId = event.params.appointmentId; // <<< Definir appointmentId AQUI >>>
        logger.info(`[Firestore Trigger - ${appointmentId}] sendWahaReplyOnStatusChange STARTED (v: ${CODE_VERSION}).`);
 
        // Acessar dados antes e depois via event.data
        const change = event.data;
        if (!change) {
             logger.warn(`[Firestore Trigger - ${appointmentId}] Event data is missing. Exiting.`);
             return null;
        }
        const beforeData = change.before.data();
        const afterData = change.after.data();
 
        // Verifica se houve mudança de status relevante (de pending para confirmed/canceled)
        const statusBefore = beforeData?.status;
        const statusAfter = afterData?.status;

        if (!statusAfter || statusAfter === statusBefore) {
            logger.info(`[Firestore Trigger - ${appointmentId}] No status change detected or new status missing. Exiting.`, { statusBefore, statusAfter });
            return null;
        }

        // Só envia resposta se a mudança foi originada pelo WhatsApp (via handleWahaWebhook que atualiza o status)
        // E se o novo status é 'confirmed' ou 'canceled'
        // TODO: Poderíamos adicionar um campo tipo `last_update_origin: 'webhook'` na handleWahaWebhook?
        // Por ora, vamos assumir que a mudança de pending_confirmation para confirmed/canceled é a que queremos tratar.
        if (statusBefore !== 'pending_confirmation' || (statusAfter !== 'confirmed' && statusAfter !== 'canceled')) {
             logger.info(`[Firestore Trigger - ${appointmentId}] Status change (${statusBefore} -> ${statusAfter}) is not relevant for sending WAHA reply. Exiting.`);
             return null;
        }

        const tenantId = afterData.tenant_id;
        const customerId = afterData.customer_id;
        if (!tenantId || !customerId) {
             logger.error(`[Firestore Trigger - ${appointmentId}] Missing tenantId or customerId in appointment data. Cannot send reply.`, { tenantId, customerId });
             return null;
        }

        const sessionName = `session_${tenantId}`;
        logger.info(`[Firestore Trigger - ${appointmentId}] Relevant status change detected for tenant ${tenantId}. Processing reply for customer ${customerId}.`);

        try {
            // 1. Buscar configurações de mensagem do tenant
            let messagingSettings = null;
            let templateKey = statusAfter === 'confirmed' ? 'template_confirmed_reply' : 'template_canceled_reply';
            let defaultReply = statusAfter === 'confirmed'
                ? "Obrigado por confirmar seu agendamento!"
                : "Ok, seu agendamento foi cancelado. Obrigado por nos avisar!";
            let finalReplyMessage = defaultReply;

            try {
                const customQuery = await db.collection('customizations').where('tenant_id', '==', tenantId).limit(1).get();
                if (!customQuery.empty) {
                    messagingSettings = customQuery.docs[0].data()?.messaging_settings;
                    const specificTemplate = messagingSettings?.[templateKey];
                    if (specificTemplate && typeof specificTemplate === 'string' && specificTemplate.trim() !== '') {
                        finalReplyMessage = specificTemplate;
                        logger.info(`[Firestore Trigger - ${appointmentId}] Using specific reply template (${templateKey}).`);
                    } else { logger.warn(`[Firestore Trigger - ${appointmentId}] Specific reply template (${templateKey}) not found/empty. Using default.`); }
                } else { logger.warn(`[Firestore Trigger - ${appointmentId}] No customization doc found for tenant ${tenantId}. Using default reply.`); }
            } catch (configError) {
                logger.error(`[Firestore Trigger - ${appointmentId}] Failed to load customization settings for tenant ${tenantId}. Using default reply.`, { error: configError });
            }

            // 2. Buscar telefone do cliente
            const customerDoc = await db.collection('customers').doc(customerId).get();
            if (!customerDoc.exists) {
                logger.error(`[Firestore Trigger - ${appointmentId}] Customer ${customerId} not found. Cannot send reply.`);
                return null;
            }
            const customerData = customerDoc.data();
            const customerPhone = customerData?.phone_waha_id || customerData?.phone;
            if (!customerPhone) {
                logger.error(`[Firestore Trigger - ${appointmentId}] Customer ${customerId} has no phone number. Cannot send reply.`);
                return null;
            }
            const chatId = customerPhone.includes('@') ? customerPhone : `55${customerPhone.replace(/\D/g, '')}@c.us`;

            // 3. Enviar mensagem via WAHA
            const apiUrl = wahaApiUrl.value();
            const apiKey = wahaApiKey.value();
            if (!apiUrl || !apiKey) {
                logger.error(`[Firestore Trigger - ${appointmentId}] Cannot send reply for tenant ${tenantId}: WAHA API URL or Key missing.`);
                return null;
            }

            const sendUrl = `${apiUrl.replace(/\/$/, '')}/api/sendText`;
            const payload = { session: sessionName, chatId: chatId, text: finalReplyMessage };
            const headers = getWahaApiHeaders(apiKey);
            headers['Content-Type'] = 'application/json';

            logger.info(`[Firestore Trigger - ${appointmentId}] Sending reply to ${chatId}: "${finalReplyMessage.substring(0, 50)}..."`);
            const response = await axios.post(sendUrl, payload, { headers });
            logger.info(`[Firestore Trigger - ${appointmentId}] WAHA API response for reply:`, { status: response.status });

            const functionEndTime = Date.now();
            logger.info(`[Firestore Trigger - ${appointmentId}] sendWahaReplyOnStatusChange FINISHED SUCCESSFULLY (Duration: ${functionEndTime - functionStartTime}ms).`);
            return null;

        } catch (error) {
            logWahaAxiosError(`sendWahaReplyOnStatusChange (Trigger - ${appointmentId})`, sessionName, tenantId, error);
            logger.error(`[Firestore Trigger - ${appointmentId}] FAILED to process or send reply.`, { error });
            // Não relançar o erro para evitar retentativas infinitas do trigger em caso de falha permanente
            return null;
        }
    });
 // --- Fim do Arquivo ---

// --- NOVA FUNÇÃO: Cancelamento Automático Agendado ---
export const scheduledAutoCancellation = onSchedule(
    { schedule: "every 15 minutes", region: "southamerica-east1" }, // Rodar a cada 15 min na mesma região
    async (event: ScheduledEvent): Promise<void> => {
        const functionStartTime = Date.now();
        logger.info(`>>>>>>>>>> scheduledAutoCancellation (v: ${CODE_VERSION}) STARTED <<<<<<<<<<`);

        try {
            const tenantsSnapshot = await db.collection('tenants').where('status', '==', 'active').get();
            logger.info(`[AutoCancel] Found ${tenantsSnapshot.size} active tenants.`);

            if (tenantsSnapshot.empty) {
                logger.info("[AutoCancel] No active tenants found. Exiting.");
                return;
            }

            const processingPromises = tenantsSnapshot.docs.map(async (tenantDoc) => {
                const tenantId = tenantDoc.id;
                const tenantData = tenantDoc.data();
                const companyName = tenantData.name || `Tenant ${tenantId}`; // Assume 'name' field exists
                logger.info(`[AutoCancel] Processing tenant: ${companyName} (${tenantId})`);

                // 1. Buscar configurações de mensagem do tenant
                let messagingSettings = null;
                try {
                    const customQuery = await db.collection('customizations')
                                                .where('tenant_id', '==', tenantId)
                                                .limit(1)
                                                .get();
                    if (!customQuery.empty) {
                        messagingSettings = customQuery.docs[0].data()?.messaging_settings;
                        logger.info(`[AutoCancel] Found messaging settings for tenant ${tenantId}.`);
                    } else {
                        logger.warn(`[AutoCancel] No customization document found for tenant ${tenantId}. Skipping tenant.`);
                        return; // Pula para o próximo tenant
                    }
                } catch (configError) {
                    logger.error(`[AutoCancel] Failed to load messaging settings for tenant ${tenantId}. Skipping tenant.`, { error: configError });
                    return; // Pula para o próximo tenant
                }

                // 2. Verificar se o cancelamento automático está habilitado
                if (!messagingSettings?.enable_auto_cancel) {
                    logger.info(`[AutoCancel] Auto-cancellation disabled for tenant ${tenantId}. Skipping.`);
                    return; // Pula para o próximo tenant
                }
                logger.info(`[AutoCancel] Auto-cancellation ENABLED for tenant ${tenantId}.`);

                const cancelBeforeHours = messagingSettings.cancel_if_unconfirmed_hours_before || 3;
                const now = new Date();
                const cancelDeadline = new Date(now.getTime() + cancelBeforeHours * 60 * 60 * 1000);
                const cancelDeadlineTimestamp = admin.firestore.Timestamp.fromDate(cancelDeadline);
                const nowTimestamp = admin.firestore.Timestamp.fromDate(now);

                // 3. Buscar agendamentos pendentes que passaram do prazo
                logger.info(`[AutoCancel Query] Tenant ${tenantId}: Checking for pending appointments before ${cancelDeadline.toISOString()}`);
                const appointmentsToCancelQuery = db.collection('appointments')
                    .where('tenant_id', '==', tenantId)
                    .where('status', '==', 'pending_confirmation')
                    .where('start_time', '<=', cancelDeadlineTimestamp) // Hora de início é ANTES ou IGUAL ao prazo final
                    .where('start_time', '>', nowTimestamp);       // Hora de início é DEPOIS de agora (evitar cancelar passados)

                try {
                    const cancelSnapshot = await appointmentsToCancelQuery.get();
                    logger.info(`[AutoCancel Results] Tenant ${tenantId}: Found ${cancelSnapshot.size} appointments to auto-cancel.`);

                    if (cancelSnapshot.empty) {
                        return; // Nenhum agendamento para cancelar neste tenant
                    }

                    // 4. Processar cada agendamento para cancelamento
                    for (const appointmentDoc of cancelSnapshot.docs) {
                        const appointmentId = appointmentDoc.id;
                        const appointmentData = appointmentDoc.data();
                        const customerId = appointmentData.customer_id;

                        logger.info(`[AutoCancel Proc] Processing cancellation for appointment ${appointmentId}...`);

                        if (!customerId) {
                            logger.warn(`[AutoCancel Proc - ${appointmentId}] Missing customerId. Cannot send notification.`);
                            // Ainda assim, cancelar o agendamento?
                             await appointmentDoc.ref.update({
                                 status: 'canceled',
                                 cancelled_via: 'auto_system',
                                 cancellation_reason: 'Falta de confirmação (automático)',
                                 updated_at: admin.firestore.FieldValue.serverTimestamp()
                             });
                             logger.info(`[AutoCancel Proc - ${appointmentId}] Appointment status updated to canceled (no notification sent).`);
                             continue; // Pula para o próximo agendamento
                        }

                        // 5. Atualizar status no Firestore
                        await appointmentDoc.ref.update({
                            status: 'canceled',
                            cancelled_via: 'auto_system',
                            cancellation_reason: 'Falta de confirmação (automático)',
                            updated_at: admin.firestore.FieldValue.serverTimestamp()
                        });
                        logger.info(`[AutoCancel Proc - ${appointmentId}] Appointment status updated to canceled.`);

                        // 6. Enviar notificação de cancelamento (se configurado)
                        const notificationTemplate = messagingSettings.template_auto_cancel_notification;
                        if (!notificationTemplate || typeof notificationTemplate !== 'string' || notificationTemplate.trim() === '') {
                            logger.warn(`[AutoCancel Proc - ${appointmentId}] Auto-cancel notification template empty or missing for tenant ${tenantId}. No notification sent.`);
                            continue; // Pula para o próximo agendamento
                        }

                        try {
                            // Buscar dados do cliente para o template
                            const customerDoc = await db.collection('customers').doc(customerId).get();
                            if (!customerDoc.exists) {
                                logger.error(`[AutoCancel Notify - ${appointmentId}] Customer ${customerId} not found. Cannot send notification.`);
                                continue;
                            }
                            const customerData = customerDoc.data();
                            const customerPhone = customerData?.phone_waha_id || customerData?.phone;
                            const customerName = customerData?.full_name || 'Cliente';

                            if (!customerPhone) {
                                logger.error(`[AutoCancel Notify - ${appointmentId}] Customer ${customerId} has no phone number. Cannot send notification.`);
                                continue;
                            }
                            const chatId = customerPhone.includes('@') ? customerPhone : `55${customerPhone.replace(/\D/g, '')}@c.us`;

                            // Substituir placeholders
                            let messageText = notificationTemplate;
                            messageText = messageText.replace('{cliente}', customerName);
                            messageText = messageText.replace('{clinica}', companyName);
                            messageText = messageText.replace('{pet}', appointmentData.pet_name || 'seu pet');
                            messageText = messageText.replace('{data_hora}', formatDateTime(appointmentData.start_time));

                            // Enviar via WAHA
                            const apiUrl = wahaApiUrl.value();
                            const apiKey = wahaApiKey.value();
                            const sessionName = `session_${tenantId}`;

                            if (!apiUrl || !apiKey) {
                                logger.error(`[AutoCancel Notify - ${appointmentId}] Cannot send notification for tenant ${tenantId}: WAHA API URL or Key missing.`);
                                continue;
                            }

                            const sendUrl = `${apiUrl.replace(/\/$/, '')}/api/sendText`;
                            const payload = { session: sessionName, chatId: chatId, text: messageText };
                            const headers = getWahaApiHeaders(apiKey);
                            headers['Content-Type'] = 'application/json';

                            logger.info(`[AutoCancel Notify - ${appointmentId}] Sending notification to ${chatId}: "${messageText.substring(0, 50)}..."`);
                            const response = await axios.post(sendUrl, payload, { headers });
                            logger.info(`[AutoCancel Notify - ${appointmentId}] WAHA API response for notification:`, { status: response.status });

                        } catch (notifyError) {
                            logWahaAxiosError(`scheduledAutoCancellation (Notify - ${appointmentId})`, `session_${tenantId}`, tenantId, notifyError);
                            logger.error(`[AutoCancel Notify - ${appointmentId}] FAILED to send notification.`, { error: notifyError });
                            // Continua para o próximo agendamento mesmo se a notificação falhar
                        }
                    }

                } catch (queryError: any) {
                     logger.error(`[AutoCancel Query] Tenant ${tenantId}: !!! FAILED TO EXECUTE APPOINTMENT QUERY !!!`, {
                         error_message: queryError.message,
                         error_code: queryError.code,
                         error_details: queryError.details,
                     });
                     // Não continuar para este tenant se a query falhou
                     return;
                }
            });

            await Promise.all(processingPromises);

        } catch (error) {
            logger.error(`!!!!!!!!!! scheduledAutoCancellation (v: ${CODE_VERSION}) FAILED !!!!!!!!!!`, { error: error });
        } finally {
            const functionEndTime = Date.now();
            logger.info(`>>>>>>>>>> scheduledAutoCancellation (v: ${CODE_VERSION}) FINISHED (Duration: ${functionEndTime - functionStartTime}ms) <<<<<<<<<<`);
        }
    }
);

// --- Fim do Arquivo ---

// --- Helpers for Prontuário and Episódio ID generation ---
function pad8(num: number): string {
  return num.toString().padStart(8, '0');
}

async function nextSeq(
  tenantId: string,
  field: 'prontuarioSeq' | 'episodeSeq'
): Promise<number> {
  const counterRef = db.collection('counters').doc(tenantId);
  await counterRef.set({ [field]: admin.firestore.FieldValue.increment(1) }, { merge: true });
  const snap = await counterRef.get();
  return snap.data()?.[field] || 0;
}

async function getOrCreateProntuario(
  tenantId: string,
  petId: string,
  tutorId: string
): Promise<{ id: string }> {
  const prontRef = db.collection(`tenants/${tenantId}/prontuarios`);
  const querySnap = await prontRef.where('petId', '==', petId).limit(1).get();
  if (!querySnap.empty) {
    return { id: querySnap.docs[0].id };
  }
  const seq = await nextSeq(tenantId, 'prontuarioSeq');
  const id = `PT-${pad8(seq)}`;
  await prontRef.doc(id).set({
    id,
    petId,
    tutorId,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  return { id };
}

async function createEpisode(
  prontuarioId: string,
  appointmentId: string,
  data: { tenantId: string; petId: string; tutorId: string; serviceId: string; serviceName: string; module: string; professionalId: string; professionalName: string; specialtyId: string | null }
): Promise<string> {
  const episodesRef = db.collection(
    `tenants/${data.tenantId}/prontuarios/${prontuarioId}/episodes`
  );
  const seq = await nextSeq(data.tenantId, 'episodeSeq');
  const episodeId = `EP-${pad8(seq)}`;
  await episodesRef.doc(episodeId).set({
    id: episodeId,
    appointmentId,
    prontuarioId: prontuarioId, // Add prontuarioId for potential direct queries
    tenantId: data.tenantId,
    petId: data.petId,
    tutorId: data.tutorId,
    serviceId: data.serviceId,
    serviceName: data.serviceName,
    module: data.module, // Store module for clarity
    professionalId: data.professionalId,
    professionalName: data.professionalName,
    specialtyId: data.specialtyId,
    checkinTime: admin.firestore.FieldValue.serverTimestamp(), // Consistent naming
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    status: 'in_progress', // Episode starts in progress
    // Add other relevant fields from appointment if needed (e.g., price_table_id)
  });
  logger.info(`[createEpisode] Created episode ${episodeId} for prontuario ${prontuarioId}`);
  return episodeId;
}

// --- Trigger: on appointment status change to 'arrived' ---
export const onAppointmentArrived = onDocumentUpdated(
  'appointments/{appointmentId}',
  async (event: FirestoreEvent<Change<QueryDocumentSnapshot> | undefined, { appointmentId: string }>) => {
    const functionStartTime = Date.now();
    const appointmentId = event.params.appointmentId;
    logger.info(`[onAppointmentArrived - ENTRY - ${appointmentId}] Function invoked.`);

    if (!event.data) {
      logger.warn(`[onAppointmentArrived - ${appointmentId}] Event data is missing. Exiting.`);
      return null;
    }
    const before = event.data.before.data();
    const after = event.data.after.data();

    // Check if status changed TO 'arrived'
    if (after?.status !== 'arrived' || before?.status === 'arrived') {
      logger.info(`[onAppointmentArrived - ${appointmentId}] Status not changed to 'arrived' or already was 'arrived'. Exiting. Before: ${before?.status}, After: ${after?.status}`);
      return null;
    }

    const tenantId = after.tenant_id;
    const petId = after.pet_id;
    const tutorId = after.customer_id;
    const serviceId = after.service_id;
    const professionalId = after.professionalId;
    const professionalName = after.professionalName;
    const specialtyId = after.specialty_id || null;

    if (!tenantId || !petId || !tutorId || !serviceId || !professionalId) {
      logger.error(`[onAppointmentArrived - ${appointmentId}] Missing required data: tenantId, petId, tutorId, serviceId, or professionalId.`, { after });
      return null;
    }

    logger.info(`[onAppointmentArrived - ${appointmentId}] Processing 'arrived' status change.`);

    try {
      // 1. Fetch Service details FIRST to check the module
      logger.info(`[onAppointmentArrived - ${appointmentId}] Fetching service details for serviceId: ${serviceId}`);
      const serviceRef = db.collection('services').doc(serviceId);
      const serviceSnap = await serviceRef.get();

      if (!serviceSnap.exists) {
        logger.error(`[onAppointmentArrived - ${appointmentId}] Service with ID ${serviceId} not found! Cannot proceed.`);
        return null;
      }

      const serviceData = serviceSnap.data()!;
      const serviceModule = serviceData.module;
      const serviceName = serviceData.name;
      logger.info(`[onAppointmentArrived - ${appointmentId}] Service module: ${serviceModule}, Service name: ${serviceName}`);

      // 2. Process based on Service Module
      if (serviceModule === 'clinica') {
        logger.info(`[onAppointmentArrived - ${appointmentId}] Service is clinical. Processing Prontuario and Episode...`);

        // 2a. Get or Create Prontuário (only for clinical services)
        logger.info(`[onAppointmentArrived - ${appointmentId}] Getting/Creating Prontuario...`);
        const prontuario = await getOrCreateProntuario(tenantId, petId, tutorId);
        const prontuarioId = prontuario.id;
        logger.info(`[onAppointmentArrived - ${appointmentId}] Prontuario ID: ${prontuarioId}`);

        // 2b. Create Clinical Episode
        logger.info(`[onAppointmentArrived - ${appointmentId}] Creating Clinical Episode...`);
        await createEpisode(prontuarioId, appointmentId, {
          tenantId,
          petId,
          tutorId,
          serviceId,
          serviceName,
          module: serviceModule,
          professionalId,
          professionalName,
          specialtyId
        });
        logger.info(`[onAppointmentArrived - ${appointmentId}] Clinical Episode creation initiated.`);

      } else if (serviceModule === 'petshop') {
        logger.info(`[onAppointmentArrived - ${appointmentId}] Service is petshop (${serviceName}). Skipping Prontuario/Episode creation.`);
        // TODO: Add logic here to create OS (Ordem de Serviço) for 'petshop' module.
        // Example Placeholder:
        // await createOrdemDeServico(appointmentId, { tenantId, petId, tutorId, serviceId, serviceName, professionalId, professionalName });

      } else {
        logger.warn(`[onAppointmentArrived - ${appointmentId}] Unknown service module: ${serviceModule}. Skipping Prontuario/Episode/OS creation.`);
      }

      const functionEndTime = Date.now();
      logger.info(`[onAppointmentArrived - ${appointmentId}] Successfully processed 'arrived' status. Duration: ${functionEndTime - functionStartTime}ms.`);
      return null;

    } catch (error: any) {
      logger.error(`[onAppointmentArrived - ${appointmentId}] CRITICAL ERROR processing 'arrived' status:`, { error: error.message, stack: error.stack });
      return null;
    }
  }
);
// --- End of new trigger ---