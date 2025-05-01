import { https } from "firebase-functions/v2";
import * as admin from "firebase-admin";
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';
import * as logger from "firebase-functions/logger";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { HttpsError, onCall, CallableRequest } from "firebase-functions/v2/https";
import { defineString, defineSecret } from "firebase-functions/params";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { ScheduledEvent } from "firebase-functions/v2/scheduler";
import { onDocumentUpdated, Change, FirestoreEvent, QueryDocumentSnapshot } from "firebase-functions/v2/firestore";
import cors from 'cors';

// Inicializar Firebase Admin SDK (MODULAR)
initializeApp();
const db = getFirestore();

// --- Configuração CORS ---
// Configura o CORS para permitir as origens do seu frontend (local e produção)
const corsHandler = cors({ origin: ["http://localhost:5173", "https://petfacil.app"] });

// --- IDENTIFICADOR DE VERSÃO ---
const CODE_VERSION = "1.6.0"; // <<< ATUALIZAR SEMPRE QUE HOUVER MUDANÇAS SIGNIFICATIVAS
const REGION = "southamerica-east1"; // <<< ADICIONAR CONSTANTE AQUI >>>
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

// ==============================================
// INTERFACES (se necessário)
// ==============================================

// <<< Adicionar interfaces aqui >>>
interface ChargeItem {
  itemId?: string;
  sourceId?: string;
  description?: string;
  unitPrice?: number;
  quantity?: number;
  totalPrice?: number;
  itemType?: string;
  cancelled?: boolean;
  cancellationReason?: string;
  // cancellationTimestamp?: admin.firestore.Timestamp; // Usar admin.firestore.Timestamp se precisar
}

interface CancelChargeItemData {
  chargeId: string;
  itemId: string;
  reason: string;
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
    region: REGION, // <<< Adicionar Região >>>
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
      region: REGION, // <<< Adicionar Região >>>
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

        // <<< INÍCIO: Buscar dados do Tenant >>>
        let tenantCompanyName = 'sua loja'; // Valor padrão
        let tenantAdminName = 'o administrador'; // Valor padrão
        try {
          const tenantDocRef = db.collection('tenants').doc(tenantId);
          const tenantDoc = await tenantDocRef.get();
          if (tenantDoc.exists) {
            const tenantData = tenantDoc.data();
            tenantCompanyName = tenantData?.company_name || tenantCompanyName;
            // Se quiser manter o nome do admin que convidou, pode pegar daqui também, ou manter o do token
            // tenantAdminName = tenantData?.responsible_name || tenantAdminName; 
            tenantAdminName = request.auth.token.name || tenantAdminName; // Mantendo o nome do admin do token por enquanto
            logger.info(`[sendCustomInvite] Tenant data fetched: Company Name - ${tenantCompanyName}, Admin Name - ${tenantAdminName}`);
          } else {
            logger.warn(`[sendCustomInvite] Tenant document ${tenantId} not found.`);
          }
        } catch (tenantFetchError) {
          logger.error(`[sendCustomInvite] Error fetching tenant document ${tenantId}:`, tenantFetchError);
          // Continuar com os nomes padrão em caso de erro
        }
        // <<< FIM: Buscar dados do Tenant >>>

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
        // Usar tenantCompanyName obtido do Firestore
        const mailSubject = `Convite para colaborar na ${tenantCompanyName} no PetFácil!`;
        const mailHtml = `
          <p>Olá ${collaboratorName},</p>
          // Usar tenantAdminName (nome do admin que convidou) e tenantCompanyName (nome da loja)
          <p>Você foi convidado por ${tenantAdminName} para colaborar na gestão da loja ${tenantCompanyName} no PetFácil.</p>
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
        region: REGION, // <<< Adicionar Região >>>
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
                status: true,    // Definir como true para indicar ativo
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
    region: REGION, // <<< Mudar Região >>>
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
        region: REGION, // <<< Mudar Região >>>
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
        region: REGION, // <<< Mudar Região >>>
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
        region: REGION, // <<< Mudar Região >>>
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
      region: REGION, // <<< Mudar Região >>>
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

// <<< NOVA FUNÇÃO stopWahaSession >>>
export const stopWahaSession = onCall(
  {
      region: REGION, // <<< Mudar Região >>>
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
        region: REGION // <<< Adicionar Região >>>
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

// --- NOVA FUNÇÃO: Gatilho Firestore para Enviar Respostas WAHA ---
export const sendWahaReplyOnStatusChange = onDocumentUpdated(
    { // <<< Opções v2 >>>
        region: REGION,
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
    { schedule: "every 15 minutes", region: REGION }, // Rodar a cada 15 min na mesma região
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

// --- Helpers for Prontuário and Episódio ID generation ---
// REMOVIDA: Função pad8 não é mais necessária com UUIDs
/*
function pad8(num: number): string {
  return String(num).padStart(8, '0');
}
*/

// REMOVIDA: Função nextSeq não é mais necessária com UUIDs
/*
async function nextSeq(
  tenantId: string,
  field: 'prontuarioSeq' | 'episodeSeq'
): Promise<number> {
  const ref = db.doc(`tenants/${tenantId}/sequences/main`);
  const { seq } = await db.runTransaction(async (t) => {
    const doc = await t.get(ref);
    const currentSeq = doc.data()?.[field] ?? 0;
    const next = currentSeq + 1;
    t.update(ref, { [field]: next });
    return { seq: next };
  });
  return seq;
}
*/

// REINTRODUZIDO: Função para padronizar números com 8 dígitos
function pad8(num: number): string {
  return String(num).padStart(8, '0');
}

/**
 * Busca ou cria um prontuário para um pet.
 * @param tenantId ID do tenant.
 * @param petId ID do pet.
 * @param tutorId ID do tutor.
 * @returns A referência ao documento do prontuário (existente ou novo).
 */
async function getOrCreateProntuario(
  tenantId: string,
  petId: string,
  tutorId: string
): Promise<admin.firestore.DocumentReference> { // <-- Alterado tipo de retorno para DocumentReference
  logger.info(`[getOrCreateProntuario] Buscando prontuário para Tenant: ${tenantId}, Pet: ${petId}`);
  const prontuariosRef = db.collection(`tenants/${tenantId}/prontuarios`);
  // CORRIGIDO: Usar a sintaxe de query do Admin SDK
  const querySnapshot = await prontuariosRef.where('petId', '==', petId).limit(1).get();

  if (!querySnapshot.empty) {
    const prontuarioDoc = querySnapshot.docs[0];
    logger.info(`[getOrCreateProntuario] Prontuário encontrado: ${prontuarioDoc.id}`);
    // <<< GARANTIR QUE O PET TEM O ID SALVO (mesmo que prontuário já exista) >>>
    try {
        const petRef = db.collection('pets').doc(petId);
        await petRef.set({ prontuarioId: prontuarioDoc.id }, { merge: true });
        logger.info(`[getOrCreateProntuario] Verified/Updated prontuarioId on pet ${petId}`);
    } catch (petUpdateError) {
         logger.error(`[getOrCreateProntuario] Error updating pet ${petId} with existing prontuarioId ${prontuarioDoc.id}:`, petUpdateError);
    }
    // <<< FIM GARANTIA >>>
    return prontuarioDoc.ref; // Retorna a referência ao documento existente
  } else {
    logger.info(`[getOrCreateProntuario] Prontuário NÃO encontrado para Pet ${petId}. Criando novo...`);
    // ALTERADO: Gerar número aleatório de 8 dígitos
    const randomNumber = Math.floor(Math.random() * 90000000) + 10000000; 
    const prontuarioId = `PT-${pad8(randomNumber)}`; // <<< Usa número aleatório formatado
    const prontuarioRef = prontuariosRef.doc(prontuarioId); 

    await prontuarioRef.set({
      id: prontuarioId, // Salva o ID gerado no campo 'id' também
      tenantId,
    petId,
    tutorId,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
    logger.info(`[getOrCreateProntuario] Novo prontuário criado com ID: ${prontuarioId}`);
    
    // <<< ATUALIZAR DOCUMENTO DO PET com o novo prontuarioId >>>
    try {
        const petRef = db.collection('pets').doc(petId);
        await petRef.set({ prontuarioId: prontuarioId }, { merge: true });
        logger.info(`[getOrCreateProntuario] Updated pet ${petId} with new prontuarioId ${prontuarioId}`);
    } catch (petUpdateError) {
        logger.error(`[getOrCreateProntuario] Error updating pet ${petId} with new prontuarioId ${prontuarioId}:`, petUpdateError);
        // Considerar se deve lançar erro ou continuar
    }
    // <<< FIM ATUALIZAÇÃO PET >>>
    
    return prontuarioRef; // Retorna a referência ao novo documento
  }
}

async function createEpisode(
  prontuarioId: string,
  appointmentId: string,
  data: { tenantId: string; petId: string; tutorId: string; serviceId: string; serviceName: string; module: string; professionalId: string; professionalName: string; specialtyId: string | null }
): Promise<string> {
  const episodesRef = db.collection(
    `tenants/${data.tenantId}/prontuarios/${prontuarioId}/episodes`
  );
  // REMOVIDO: const episodeId = `EP-${uuidv4()}`; 
  // ALTERADO: Gerar número aleatório de 8 dígitos
  const randomNumber = Math.floor(Math.random() * 90000000) + 10000000;
  const episodeId = `EP-${pad8(randomNumber)}`; // <<< Usa número aleatório formatado

  await episodesRef.doc(episodeId).set({
    id: episodeId,
    appointmentId,
    prontuarioId: prontuarioId, 
    episodeNumber: episodeId, // <<< Salva o ID formatado (EP-XXXXXXXX) como episodeNumber
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

    // MODIFIED: Removed the requirement for professionalId to be non-null
    if (!tenantId || !petId || !tutorId || !serviceId /* || !professionalId */) {
      // MODIFIED: Updated error message to reflect the change
      logger.error(`[onAppointmentArrived - ${appointmentId}] Missing required data: tenantId, petId, tutorId, or serviceId.`, { after });
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
        const episodeId = await createEpisode(prontuarioId, appointmentId, { // <<< Captura o episodeId retornado >>>
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
        logger.info(`[onAppointmentArrived - ${appointmentId}] Clinical Episode ${episodeId} created.`);

        // <<< DEBUG LOGGING >>>
        logger.info(`[onAppointmentArrived - ${appointmentId}] DEBUG: Value of episodeId before update: ->${episodeId}<-`, { type: typeof episodeId });
        // <<< END DEBUG LOGGING >>>

        // <<< ETAPA ADICIONADA: Atualizar o Agendamento com os IDs >>>
        logger.info(`[onAppointmentArrived - ${appointmentId}] Updating appointment with prontuarioId, currentEpisodeId, and check_in_time...`); // Log atualizado
        const appointmentRef = db.collection('appointments').doc(appointmentId);
        await appointmentRef.update({
            prontuarioId: prontuarioId,
            currentEpisodeId: episodeId, // <<< Salva o ID do episódio gerado
            check_in_time: admin.firestore.FieldValue.serverTimestamp(), // <<< ADICIONADO >>>
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        logger.info(`[onAppointmentArrived - ${appointmentId}] Appointment updated successfully.`);
        // <<< FIM DA ETAPA ADICIONADA >>>

      } else if (serviceModule === 'petshop') {
        logger.info(`[onAppointmentArrived - ${appointmentId}] Service is petshop (${serviceName}). Creating Queue Entry...`);
        
        // <<< ADICIONAR LÓGICA PARA CRIAR ENTRADA NA FILA >>>
        try {
          const queueCollectionRef = db.collection('queueEntries');
          const osNumberFromAppointment = after.osNumber || null; // Pega o osNumber já salvo no appointment

          const queueEntryData = {
            tenant_id: tenantId,
            appointment_id: appointmentId,
            pet_id: petId,
            customer_id: tutorId, // tutorId aqui é o customer_id do appointment
            service_id: serviceId,
            professional_id: professionalId || null, // Salva professionalId se existir
            status: 'waiting', // Status inicial na fila
            entry_time: admin.firestore.FieldValue.serverTimestamp(), // Hora de entrada na fila
            osNumber: osNumberFromAppointment, // Salva o OS Number gerado anteriormente
            // Adicionar outros campos relevantes do agendamento se necessário
            pet_name: after.pet_name || null,
            customer_name: after.customer_name || null,
            service_name: serviceName, // Usar serviceName já buscado
            appointment_date: after.start_time // Copia a data/hora original do agendamento
          };

          logger.info(`[onAppointmentArrived - ${appointmentId}] Creating queue entry for petshop service:`, queueEntryData);
          await queueCollectionRef.add(queueEntryData); // Adiciona o novo documento
          logger.info(`[onAppointmentArrived - ${appointmentId}] Queue entry created successfully for petshop service.`);

        } catch (queueError) {
          logger.error(`[onAppointmentArrived - ${appointmentId}] FAILED to create queue entry for petshop service:`, queueError);
          // Considerar se deve relançar o erro ou apenas logar
        }
        // <<< FIM DA LÓGICA PARA CRIAR ENTRADA NA FILA >>>

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

// --- SUPER ADMIN FUNCTIONS ---
// import cors = require("cors"); // Não precisamos mais do middleware explícito com onCall
// import { Request, Response } from "express"; // Não precisamos mais com onCall

// << MUDANÇA: Reverter para onCall >>
export const listSuperAdmins = https.onCall(
  {
    region: REGION, // Manter região
    cors: ["http://localhost:5173", "https://petfacil.app"], // <<< Adicionar CORS aqui para onCall >>>
    // enforceAppCheck: false, // Adicionar se usar App Check
  },
  // << MUDANÇA: Usar CallableRequest e checar request.auth >>
  async (request: https.CallableRequest) => {
    logger.info(`[listSuperAdmins / v: ${CODE_VERSION}] Function called.`);

    // --- Autenticação e Autorização para onCall --- 
    // onCall já verifica se o usuário está autenticado.
    // Agora podemos verificar se ele é Super Admin (sem tenant_id).
    if (!request.auth || request.auth.token.tenant_id) {
      logger.error(`[listSuperAdmins] Permission denied. Caller ${request.auth?.uid} is not a Super Admin or is unauthenticated.`);
      throw new https.HttpsError("permission-denied", "Apenas Super Administradores podem listar usuários.");
    }
    logger.info(`[listSuperAdmins] Caller ${request.auth.uid} verified as Super Admin.`);
    // ----

    try {
      const listUsersResult = await admin.auth().listUsers(1000); // Adjust limit if needed

      const superAdmins = listUsersResult.users
        .filter(user => !user.customClaims?.tenant_id)
        .map(user => ({
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          creationTime: user.metadata.creationTime,
          lastSignInTime: user.metadata.lastSignInTime,
        }));

      logger.info(`[listSuperAdmins] Found ${superAdmins.length} super admins.`);
      // << MUDANÇA: Retornar o objeto diretamente (sem status). A SDK envolve em { data: ... } >>
      return {
        admins: superAdmins,
      };

    } catch (error: any) {
      logger.error("[listSuperAdmins] Error listing super admins:", error);
      // << MUDANÇA: Lançar HttpsError para onCall >>
      if (error instanceof https.HttpsError) {
        throw error;
      }
      throw new https.HttpsError("internal", "Erro interno ao listar super administradores.", error.message);
    }
  });

// --- PLACEHOLDERS: Atualizar para onCall também --- 

export const createSuperAdmin = https.onCall(
  {
    region: REGION,
    cors: ["http://localhost:5173", "https://petfacil.app"]
  },
  async (request: https.CallableRequest) => {
    logger.info(`[createSuperAdmin / v: ${CODE_VERSION}] Function called.`);
    if (!request.auth || request.auth.token.tenant_id) {
      throw new https.HttpsError("permission-denied", "Apenas Super Administradores podem criar usuários.");
    }
    // TODO: Implement logic
    throw new https.HttpsError("unimplemented", "Função não implementada.");
});

export const deleteSuperAdmin = https.onCall(
  {
    region: REGION,
    cors: ["http://localhost:5173", "https://petfacil.app"]
  },
  async (request: https.CallableRequest) => {
     logger.info(`[deleteSuperAdmin / v: ${CODE_VERSION}] Function called.`);
     if (!request.auth || request.auth.token.tenant_id) {
       throw new https.HttpsError("permission-denied", "Apenas Super Administradores podem deletar usuários.");
     }
     // TODO: Implement logic
    throw new https.HttpsError("unimplemented", "Função não implementada.");
});


// --- NOVA FUNÇÃO: UPC/GTIN Lookup Proxy (Usando Cosmos) ---
export const lookupBarcode = https.onRequest(
  {
    region: REGION,
    timeoutSeconds: 30,
    memory: '128MiB'
  },
  (request, response) => {
    corsHandler(request, response, async () => {
        const functionStartTime = Date.now();
        logger.info(`[lookupBarcode (Cosmos) / v: ${CODE_VERSION}] Function called.`);

        if (request.method !== 'GET') {
            logger.warn(`[lookupBarcode (Cosmos)] Received non-GET request: ${request.method}`);
            response.setHeader('Allow', 'GET');
            response.status(405).send({ error: 'Method Not Allowed' });
            return;
        }

        const barcode = request.query.upc as string;

        if (!barcode) {
            logger.error("[lookupBarcode (Cosmos)] Barcode (upc query parameter) is missing.");
            response.status(400).send({ error: "Missing 'upc' query parameter" });
            return;
        }

        // Limpa o barcode para garantir que são apenas números
        const cleanBarcode = barcode.replace(/\D/g, '');
        logger.info(`[lookupBarcode (Cosmos)] Received request for barcode: ${barcode} (Cleaned: ${cleanBarcode})`);

        // --- Configuração da API Cosmos ---
        const cosmosApiUrl = `https://api.cosmos.bluesoft.com.br/gtins/${cleanBarcode}`;
        const cosmosToken = "c8HjHKo6nEbchtVkMJy9qg"; // <<< SEU TOKEN AQUI >>>
        const headers = {
            'X-Cosmos-Token': cosmosToken,
            'Accept': 'application/json' // Garante que queremos JSON
        };
        // --- Fim Configuração Cosmos ---

        try {
            logger.info(`[lookupBarcode (Cosmos)] Sending request to Cosmos API: ${cosmosApiUrl}`);
            const apiResponse = await axios.get(cosmosApiUrl, {
                 headers: headers,
                 timeout: 15000 // Timeout de 15 segundos
            });

            logger.info(`[lookupBarcode (Cosmos)] Cosmos API response status: ${apiResponse.status}`);

            // Verifica se a resposta foi bem sucedida e contém dados
            if (apiResponse.status === 200 && apiResponse.data) {
                const cosmosData = apiResponse.data;
                logger.info(`[lookupBarcode (Cosmos)] Product found for barcode ${cleanBarcode}. Data:`, cosmosData);

                // Mapeia os dados do Cosmos para a estrutura esperada pelo frontend
                const itemData = {
                    // Usar a descrição do Cosmos como nome principal
                    title: cosmosData.description || null,
                    description: cosmosData.description || null, // Pode usar a mesma ou outra fonte
                    brand: cosmosData.brand?.name || null,
                    ncm: cosmosData.ncm?.code || null, // <<< NCM !!! >>>
                    // category: null, // Cosmos não fornece categoria no nosso formato, manter a do form?
                    image_url: cosmosData.thumbnail || cosmosData.gtin?.image || null, // Tenta thumbnail, senão imagem do gtin
                    barcode: cleanBarcode, // Retorna o código limpo que foi consultado
                    // Outros campos potenciais do Cosmos que podem ser úteis:
                    // avg_price: cosmosData.avg_price,
                    // cest_code: cosmosData.cest?.code,
                    // unit_type: cosmosData.packaging?.unit_type,
                    // quantity_in_package: cosmosData.packaging?.quantity
                };

                response.status(200).send({ code: "OK", item: itemData });

            } else {
                // Caso a API retorne 200 mas sem dados, ou outro status inesperado
                logger.warn(`[lookupBarcode (Cosmos)] Barcode ${cleanBarcode} potentially not found or unexpected status ${apiResponse.status}. Data:`, apiResponse.data);
                response.status(200).send({ code: "NOT_FOUND", message: `Product not found or unexpected status ${apiResponse.status}` });
            }

        } catch (error: any) {
            const duration = Date.now() - functionStartTime;
            if (axios.isAxiosError(error)) {
                 const status = error.response?.status;
                 const responseData = error.response?.data;
                 logger.error(
                    `[lookupBarcode (Cosmos) / v: ${CODE_VERSION}] Axios error fetching GTIN ${cleanBarcode} (Duration: ${duration}ms):`,
                    {
                        axiosErrorCode: error.code,
                        cosmosApiStatus: status,
                        cosmosApiResponse: responseData,
                        requestUrl: error.config?.url,
                        originalErrorMessage: error.message
                    }
                 );

                 if (status === 404) {
                      logger.info(`[lookupBarcode (Cosmos)] Barcode ${cleanBarcode} not found in Cosmos (404).`);
                      response.status(200).send({ code: "NOT_FOUND", message: "Produto não encontrado na base Cosmos (404)." });
                 } else if (status === 401 || status === 403) {
                      logger.error(`[lookupBarcode (Cosmos)] Authentication/Authorization error with Cosmos API (${status}). Check token.`);
                      response.status(500).send({ error: "Configuration Error", message: "Falha na autenticação com a API de produtos. Verifique o token configurado." });
                 } else if (status === 429) {
                      logger.warn(`[lookupBarcode (Cosmos)] Rate limit exceeded for Cosmos API (429).`);
                      response.status(429).send({ error: "Rate Limit Exceeded", message: "Limite de consultas à API de produtos foi atingido. Tente novamente mais tarde." });
                 } else {
                      // Outros erros da API externa ou de rede
                      response.status(502).send({ error: "Bad Gateway", message: `Falha ao consultar a API de produtos. Status: ${status || error.code || 'Unknown'}` });
                 }
            } else {
                 logger.error(`[lookupBarcode (Cosmos) / v: ${CODE_VERSION}] Non-Axios error processing barcode ${cleanBarcode} (Duration: ${duration}ms):`, { error: error?.message || 'Unknown error', errorObject: error });
                 response.status(500).send({ error: "Internal Server Error", message: "Erro interno inesperado ao processar a busca de código de barras." });
            }
        }
    });
  }
);
// --- FIM UPC/GTIN Lookup Proxy (Cosmos) ---

// --- Função de Processamento de Pagamento ---

interface PaymentData {
  chargeIds?: string[];    
  // <<< ADICIONAR continuedOsIds >>>
  continuedOsIds?: string[]; 
  cartItems?: Array<{     
    itemId: string;
    description: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    itemType: 'product' | 'service';
  }>;
  paymentMethod: 'pix' | 'credit_card' | 'debit_card' | 'cash' | 'other';
  amountPaid: number;       
  customerId: string | null; // <<< PERMITIR NULL para venda anônima >>>
  cardInfo?: {             
    number: string;
    holder: string;
    expiry: string;
    cvv: string;
  } | null;
}

export const processPayment = onCall<
  PaymentData,
  Promise<{ success: boolean; message: string; chargeId?: string; transactionId?: string }>
>(
  {
    region: REGION,
    cors: ["http://localhost:5173", "https://petfacil.app"],
    enforceAppCheck: false, 
  },
  async (request) => {
    logger.info(`[processPayment / v: ${CODE_VERSION}] Function called.`, { uid: request.auth?.uid });

    // 1. Autenticação e Autorização
    if (!request.auth?.uid) {
      logger.error("[processPayment] Unauthenticated user.");
      throw new HttpsError("unauthenticated", "Usuário não autenticado.");
    }
    const tenantId = request.auth.token.tenant_id;
    if (!tenantId) {
      logger.error(`[processPayment] User ${request.auth.uid} is missing tenant_id claim.`);
      throw new HttpsError("failed-precondition", "Usuário não pertence a um tenant.");
    }
    const cashierId = request.auth.uid;

    // 2. Validação dos Dados de Entrada
    const data = request.data;
    logger.info(`[processPayment] Received data for tenant ${tenantId}:`, data);

    // Validar campos básicos de pagamento
    if (!data.paymentMethod || data.amountPaid == null || data.amountPaid <= 0) {
        logger.error("[processPayment] Invalid input data (missing/invalid paymentMethod or amountPaid).", data);
        throw new HttpsError("invalid-argument", "Método de pagamento e valor pago (positivo) são obrigatórios.");
    }
    
    // <<< AJUSTAR VALIDAÇÃO customerId >>>
    // Customer ID é obrigatório SE houver chargeIds OU continuedOsIds
    const hasExistingItems = (data.chargeIds && data.chargeIds.length > 0) || (data.continuedOsIds && data.continuedOsIds.length > 0);
    if (hasExistingItems && !data.customerId) {
        logger.error("[processPayment] Invalid input data (missing customerId for existing charge/OS).", data);
        throw new HttpsError("invalid-argument", "ID do Cliente é necessário ao pagar cobranças ou OS existentes.");
    }

    // <<< AJUSTAR VALIDAÇÃO DE ITENS >>>
    // Deve haver OU (chargeIds/osIds) OU cartItems
    const hasCartItems = data.cartItems && data.cartItems.length > 0;
    if (!hasExistingItems && !hasCartItems) {
        logger.error("[processPayment] Invalid input data (no items provided).", data);
        throw new HttpsError("invalid-argument", "É necessário fornecer IDs de cobrança/OS ou itens no carrinho.");
    }
    // Não pode haver cartItems E itens existentes juntos (essa validação pode ser mantida)
    if (hasExistingItems && hasCartItems) {
        logger.error("[processPayment] Invalid input data (both existing items and cartItems provided).", data);
        throw new HttpsError("invalid-argument", "Não é possível processar cobranças/OS existentes e itens de carrinho simultaneamente.");
    }

    // Validação específica do cartão (igual antes)
    if ((data.paymentMethod === 'credit_card' || data.paymentMethod === 'debit_card') && 
        (!data.cardInfo || !data.cardInfo.number || !data.cardInfo.holder || !data.cardInfo.expiry || !data.cardInfo.cvv)) {
        logger.error("[processPayment] Invalid card data.", data.cardInfo);
        throw new HttpsError("invalid-argument", "Dados do cartão incompletos.");
    }

    try {
      // <<< Remover definição de finalChargeId daqui >>>
      // let finalChargeId: string | undefined = (data.chargeIds && data.chargeIds.length > 0) ? data.chargeIds[0] : undefined;
      let transactionId: string | undefined;

      // Usar uma transação Firestore para garantir atomicidade
      await db.runTransaction(async (transaction) => {
        logger.info(`[processPayment / Tx ${tenantId}] Starting Firestore transaction.`);
        const customerIdForTransaction = data.customerId; // Já validado que existe se hasExistingItems
        
        // --- CASO 1: Pagamento Combinado (Charges + OS) --- 
        if (data.chargeIds && data.chargeIds.length > 0 && data.continuedOsIds && data.continuedOsIds.length > 0) {
            logger.info(`[processPayment / Tx ${tenantId}] Processing COMBINED payment: Charges [${data.chargeIds.join(', ')}] + OS [${data.continuedOsIds.join(', ')}]`);
            if (!customerIdForTransaction) throw new HttpsError("internal", "Erro interno: Customer ID ausente no caso combinado."); // Verificação extra

            // --- Fase de Leitura Combinada ---
            const chargeRefs: admin.firestore.DocumentReference[] = [];
            const osRefs: admin.firestore.DocumentReference[] = [];
            const validDocsData: { [id: string]: { ref: admin.firestore.DocumentReference, data: FirebaseFirestore.DocumentData, type: 'charge' | 'order_service' } } = {};
            let totalAmountFromDocs = 0;

            // Ler Charges
            logger.info(`[processPayment / Tx Read ${tenantId}] Reading ${data.chargeIds.length} charge(s)...`);
            for (const chargeId of data.chargeIds) {
                const chargeRef = db.collection('tenants').doc(tenantId).collection('charges').doc(chargeId);
                chargeRefs.push(chargeRef);
                const chargeDoc = await transaction.get(chargeRef);
                if (!chargeDoc.exists || !chargeDoc.data()) {
                    logger.error(`[processPayment / Tx Read ${tenantId}] Charge ${chargeId} not found or data missing.`);
                    // Considerar lançar erro ou apenas logar e pular?
                } else {
                    const docData = chargeDoc.data()!;
                    if (docData.status === 'paid') {
                        logger.warn(`[processPayment / Tx Read ${tenantId}] Charge ${chargeId} already paid. Skipping.`);
                    } else {
                        validDocsData[chargeId] = { ref: chargeRef, data: docData, type: 'charge' };
                        totalAmountFromDocs += docData.totalAmount || 0;
                    }
                }
            }

            // Ler Order Services
            logger.info(`[processPayment / Tx Read ${tenantId}] Reading ${data.continuedOsIds.length} order service(s)...`);
            for (const osId of data.continuedOsIds) {
                const osRef = db.collection('tenants').doc(tenantId).collection('order_services').doc(osId);
                osRefs.push(osRef);
                const osDoc = await transaction.get(osRef);
                if (!osDoc.exists || !osDoc.data()) {
                    logger.error(`[processPayment / Tx Read ${tenantId}] Order Service ${osId} not found or data missing.`);
                    // Considerar lançar erro ou apenas logar e pular?
                } else {
                    const docData = osDoc.data()!;
                    if (docData.status !== 'pending_cashier') { // Validar status esperado
                        logger.warn(`[processPayment / Tx Read ${tenantId}] Order Service ${osId} status is not 'pending_cashier' (${docData.status}). Skipping.`);
                    } else {
                        validDocsData[osId] = { ref: osRef, data: docData, type: 'order_service' };
                        totalAmountFromDocs += docData.totalValue || 0;
                    }
                }
            }
            logger.info(`[processPayment / Tx Read ${tenantId}] Finished reading. Total amount from valid docs: ${totalAmountFromDocs}`);
            
            // Opcional: Validar total vs valor pago
            // if (Math.abs(data.amountPaid - totalAmountFromDocs) > 0.01) { ... }

            // --- Fase de Escrita Combinada ---
            logger.info(`[processPayment / Tx Write ${tenantId}] Writing transaction and doc updates...`);
            const newTransactionRef = db.collection('tenants').doc(tenantId).collection('transactions').doc();
            transactionId = newTransactionRef.id;

            // Criar Transaction referenciando AMBOS os tipos
            logger.info(`[processPayment / Tx Write ${tenantId}] Creating transaction ${transactionId} for amount ${data.amountPaid}`);
            transaction.set(newTransactionRef, {
                chargeIds: data.chargeIds, // Guardar os IDs das charges
                orderServiceIds: data.continuedOsIds, // Guardar os IDs das OS
                tenantId: tenantId,
                tutorId: customerIdForTransaction,
                method: data.paymentMethod,
                amount: data.amountPaid,
                status: 'completed',
                transactionTimestamp: admin.firestore.FieldValue.serverTimestamp(),
                cashierId: cashierId,
                notes: `Pagamento referente a Charges: [${data.chargeIds.join(', ')}] e OS: [${data.continuedOsIds.join(', ')}]`,
            });

            // Atualizar CADA documento válido (charge ou OS)
            for (const docId in validDocsData) {
                const { ref, data: docData, type } = validDocsData[docId];
                const updateTimestamp = admin.firestore.FieldValue.serverTimestamp();
                const paidAtTimestamp = updateTimestamp; // Assumindo pagamento total

                if (type === 'charge') {
                    logger.info(`[processPayment / Tx Write ${tenantId}] Updating charge ${docId} status to paid.`);
                    transaction.update(ref, {
                        status: 'paid',
                        amountPaid: docData.totalAmount, // Pagar valor total da charge
                        paymentMethod: data.paymentMethod,
                        updatedAt: updateTimestamp,
                        paidAt: paidAtTimestamp,
                        cashierId: cashierId,
                    });
                } else { // type === 'order_service'
                    logger.info(`[processPayment / Tx Write ${tenantId}] Updating order_service ${docId} status to paid.`);
                    transaction.update(ref, {
                        status: 'paid', // Ou 'completed'? Definir padrão
                        paymentStatus: 'paid',
                        paymentMethod: data.paymentMethod,
                        // amountPaid: docData.totalValue, // OS não tem amountPaid?
                        paidAt: paidAtTimestamp,
                        updatedAt: updateTimestamp,
                        cashierId: cashierId,
                        // Atualizar totalValue se necessário (provavelmente não muda no pagamento)
                    });
                }
            }
            logger.info(`[processPayment / Tx Write ${tenantId}] Finished writing combined updates.`);
            
        // --- CASO 2: Pagamento apenas de Charges Existentes --- 
        } else if (data.chargeIds && data.chargeIds.length > 0) {
          // Lógica existente (Reads first) para múltiplas charges
          // (Copiar/Adaptar a lógica anterior que já funcionava)
          logger.info(`[processPayment / Tx ${tenantId}] Processing payment for existing charges ONLY: ${data.chargeIds.join(', ')}`);
          if (!customerIdForTransaction) throw new HttpsError("internal", "Erro interno: Customer ID ausente no caso de charges.");

          // --- FASE DE LEITURA (Charges Only) ---
          const chargeRefs: admin.firestore.DocumentReference[] = [];
          const chargeDocsData: { [id: string]: FirebaseFirestore.DocumentData | null } = {}; 
          let totalAmountFromCharges = 0; 

          logger.info(`[processPayment / Tx Read ${tenantId}] Reading ${data.chargeIds.length} charge document(s)...`);
          for (const chargeId of data.chargeIds) {
            const chargeRef = db.collection('tenants').doc(tenantId).collection('charges').doc(chargeId);
            chargeRefs.push(chargeRef); 
            const chargeDoc = await transaction.get(chargeRef);
            if (!chargeDoc.exists || !chargeDoc.data()) {
                logger.error(`[processPayment / Tx Read ${tenantId}] Charge ${chargeId} not found or data missing.`);
                chargeDocsData[chargeId] = null; 
            } else {
                const docData = chargeDoc.data()!;
                if (docData.status === 'paid') {
                   logger.warn(`[processPayment / Tx Read ${tenantId}] Charge ${chargeId} already paid. Skipping.`);
                   chargeDocsData[chargeId] = null;
                } else {
                   chargeDocsData[chargeId] = docData;
                   totalAmountFromCharges += docData.totalAmount || 0;
                }
            }
          }
          logger.info(`[processPayment / Tx Read ${tenantId}] Finished reading charges. Total amount: ${totalAmountFromCharges}`);
          // if (Math.abs(data.amountPaid - totalAmountFromCharges) > 0.01) { ... }

          // --- FASE DE ESCRITA (Charges Only) ---
          logger.info(`[processPayment / Tx Write ${tenantId}] Writing transaction and charge updates...`);
          const newTransactionRef = db.collection('tenants').doc(tenantId).collection('transactions').doc();
          transactionId = newTransactionRef.id;

          logger.info(`[processPayment / Tx Write ${tenantId}] Creating single transaction ${transactionId} for amount ${data.amountPaid}`);
          transaction.set(newTransactionRef, {
            chargeIds: data.chargeIds, // <<< Apenas chargeIds aqui >>>
            tenantId: tenantId,
            tutorId: customerIdForTransaction, 
            method: data.paymentMethod,
            amount: data.amountPaid,
            status: 'completed',
            transactionTimestamp: admin.firestore.FieldValue.serverTimestamp(),
            cashierId: cashierId,
            notes: `Pagamento referente às cobranças: ${data.chargeIds.join(', ')}`,
          });

          for (const chargeRef of chargeRefs) {
              const chargeId = chargeRef.id;
              const chargeData = chargeDocsData[chargeId];
              if (!chargeData) { 
                  logger.info(`[processPayment / Tx Write ${tenantId}] Skipping update for charge ${chargeId}.`);
                  continue; 
              }
              logger.info(`[processPayment / Tx Write ${tenantId}] Updating charge ${chargeId} status to paid.`);
              transaction.update(chargeRef, {
                status: 'paid', 
                amountPaid: chargeData.totalAmount, 
                paymentMethod: data.paymentMethod,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                paidAt: admin.firestore.FieldValue.serverTimestamp(),
                cashierId: cashierId,
              });
          }
          logger.info(`[processPayment / Tx Write ${tenantId}] Finished writing charge updates.`);

        // --- CASO 3: Pagamento de Venda Direta (cartItems) --- 
        } else if (data.cartItems && data.cartItems.length > 0) {
          logger.info(`[processPayment / Tx ${tenantId}] Processing payment for direct sale (cart items).`);
          // A lógica existente para venda direta já funciona aqui
          const newChargeRef = db.collection('tenants').doc(tenantId).collection('charges').doc();
          const finalChargeId = newChargeRef.id; // Definir ID da nova charge
          
          const totalAmount = data.cartItems.reduce((sum, item) => sum + item.totalPrice, 0);
          if (Math.abs(totalAmount - data.amountPaid) > 0.01) { 
              logger.error(`[processPayment / Tx ${tenantId}] Direct sale amount mismatch. Cart: ${totalAmount}, Paid: ${data.amountPaid}`);
              throw new HttpsError("invalid-argument", `Valor pago (${data.amountPaid.toFixed(2)}) não corresponde ao total do carrinho (${totalAmount.toFixed(2)}).`);
          }

          logger.info(`[processPayment / Tx ${tenantId}] Creating new charge ${finalChargeId} for direct sale.`);
          transaction.set(newChargeRef, {
            tenantId: tenantId,
            tutorId: data.customerId || null, // Pode ser nulo aqui
            petId: null, 
            items: data.cartItems.map(item => ({ /* ... mapeamento ... */ })),
            totalAmount: totalAmount,
            amountPaid: data.amountPaid,
            status: 'paid', 
            paymentMethod: data.paymentMethod, 
            sourceType: 'cashier_direct',
            cashierId: cashierId,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            paidAt: admin.firestore.FieldValue.serverTimestamp(),
            nfseUrl: null,
            nfceUrl: null,
          });

          const newTransactionRef = db.collection('tenants').doc(tenantId).collection('transactions').doc();
          transactionId = newTransactionRef.id; 
          logger.info(`[processPayment / Tx ${tenantId}] Creating transaction ${transactionId} for new charge ${finalChargeId}`);
          transaction.set(newTransactionRef, {
            chargeId: finalChargeId, // <<< Apenas chargeId aqui >>>
            tenantId: tenantId,
            tutorId: data.customerId || null,
            method: data.paymentMethod,
            amount: data.amountPaid,
            status: 'completed',
            transactionTimestamp: admin.firestore.FieldValue.serverTimestamp(),
            cashierId: cashierId,
            notes: `Pagamento para venda direta no caixa.`,
          });
          logger.info(`[processPayment / Tx ${tenantId}] Finished writing direct sale charge and transaction.`);

        } else {
          // Caso de erro inesperado (nenhum item válido)
          logger.error("[processPayment / Tx ${tenantId}] Transaction error: No valid items found to process.");
          throw new HttpsError("internal", "Erro inesperado: Nenhum item válido para processar pagamento.");
        }
        logger.info(`[processPayment / Tx ${tenantId}] Firestore transaction function completed successfully.`);
      }); // <<< Fim do db.runTransaction

      logger.info(`[processPayment / ${tenantId}] Payment processed successfully. Returning success.`, { transactionId });
      return { success: true, message: "Pagamento processado com sucesso!", transactionId: transactionId }; // <<< Retorna transactionId >>>

    } catch (error: any) {
      logger.error(`[processPayment / ${tenantId}] Error processing payment:`, error);
      if (error instanceof HttpsError) {
        throw error; 
      } else {
        throw new HttpsError("internal", "Ocorreu um erro interno ao processar o pagamento.", { originalError: error.message });
      }
    }
  } 
); 

// --- Gatilhos Firestore ---

// Função Auxiliar para adicionar itens à charge pendente
async function addItemsToPendingCharge(
    tenantId: string, 
    tutorId: string, 
    petId: string | null, 
    items: any[], // Array de itens a adicionar
    petName?: string | null,
    osNumber?: string | null,
    episodeId?: string | null,
    prontuarioId?: string | null
) {
  // MODIFICADO: Log para indicar criação
  logger.info(`[Charge Helper / ${tenantId}] Attempting to CREATE A NEW charge for tutor ${tutorId}. Items count: ${items.length}`, { petId, petName, osNumber, episodeId, prontuarioId });
  if (!items || items.length === 0) {
    logger.warn(`[Charge Helper / ${tenantId}] No items provided for tutor ${tutorId}. Aborting.`);
    return { success: false, message: "Nenhum item fornecido." };
  }

  const chargesRef = db.collection('tenants').doc(tenantId).collection('charges');

  // REMOVIDO: Query para buscar charge existente
  /*
  const q = chargesRef
    .where("tutorId", "==", tutorId)
    .where("status", "==", "pending")
    .orderBy("createdAt", "desc")
    .limit(1);
  */

  try {
    // REMOVIDO: Execução da query e lógica para obter existingChargeId
    /*
    const querySnapshot = await q.get();
    let existingChargeId: string | null = null;
    let existingChargeData: any = {};
    if (!querySnapshot.empty) {
      existingChargeId = querySnapshot.docs[0].id;
      existingChargeData = querySnapshot.docs[0].data();
      logger.info(`[Charge Helper / ${tenantId}] Found existing pending charge ${existingChargeId} for tutor ${tutorId}.`);
    } else {
      logger.info(`[Charge Helper / ${tenantId}] No existing pending charge found for tutor ${tutorId}. Will create a new one.`);
    }
    */

    // MODIFICADO: Transação agora SEMPRE cria uma nova charge
    const transactionResult = await db.runTransaction(async (transaction) => {
      // REMOVIDO: O bloco 'if (existingChargeId)' inteiro que atualizava
      /*
      if (existingChargeId) {
         // ... código de atualização removido ...
      }
      */

      // --- ALWAYS Create New Charge ---
        const newChargeRef = chargesRef.doc(); // Gera novo ID
      const targetChargeId = newChargeRef.id; // Define o ID alvo
        logger.info(`[Charge Helper / ${tenantId} / Tx] Creating new charge ${targetChargeId}.`);
      const newItemsTotal = items.reduce((sum, item) => sum + (item.totalPrice || 0), 0);

        transaction.set(newChargeRef, {
          tenantId: tenantId,
          tutorId: tutorId,
          petId: petId || null,
          petName: petName || null,
          osNumber: osNumber || null,
          episodeId: episodeId || null,
          prontuarioId: prontuarioId || null,
          items: items, // Contém os itens da OS/Episódio atual
          totalAmount: newItemsTotal,
          amountPaid: 0,
          status: 'pending',
          sourceType: 'service_completion', 
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      
      // REMOVIDO: Verificação desnecessária de targetChargeId
      /*
      if (!targetChargeId) {
           // ... throw new Error ...
      }
      */
      
      // Retorna o ID da charge criada
      return { chargeId: targetChargeId };
    });

    // MODIFICADO: Log para refletir criação
    logger.info(`[Charge Helper / ${tenantId}] Transaction successful. NEW Charge ID created: ${transactionResult.chargeId}`);
    return { success: true, chargeId: transactionResult.chargeId };

  } catch (error: any) {
    // MODIFICADO: Log de erro para refletir criação
    logger.error(`[Charge Helper / ${tenantId}] Error CREATING charge for tutor ${tutorId}:`, { error: error.message, stack: error.stack, details: error.details });
    return { success: false, message: `Erro ao criar cobrança: ${error.message}`, errorDetails: error };
  }
}

// Gatilho para quando um Agendamento (CLÍNICO OU PETSHOP) é atualizado para concluído
export const onAppointmentCompletedCreateCharge = onDocumentUpdated(
  {
    region: REGION,
    document: "appointments/{appointmentId}", 
    memory: "256MiB",
    timeoutSeconds: 60,
  },
  async (event: FirestoreEvent<Change<QueryDocumentSnapshot> | undefined, { appointmentId: string }>) => {
    const functionStartTime = Date.now();
    const appointmentId = event.params.appointmentId; // Get appointmentId from event parameters

    if (!event.data) {
      logger.warn(`[onAppointmentCompletedCreateCharge / ${appointmentId}] Event data missing. Exiting.`);
      return;
    }

    const beforeData = event.data.before.data();
    const afterData = event.data.after.data(); // Still useful for checking status change and basic tenantId

    // Get tenantId from afterData initially. If missing, try beforeData as fallback.
    // The full fetch later will ultimately confirm the tenantId.
    const tenantId = afterData?.tenant_id || beforeData?.tenant_id;

    if (!tenantId) {
       logger.error(`[onAppointmentCompletedCreateCharge / ${appointmentId}] Tenant ID missing in both before and after data. Cannot process.`);
       return;
    }
    
    logger.info(`[onAppointmentCompletedCreateCharge / ${tenantId}] Triggered for appointment ${appointmentId}.`);

    const statusBefore = beforeData?.status;
    const statusAfter = afterData?.status;

    // --- CHECK: Only proceed if status changed TO 'completed' ---
    if (statusAfter === 'completed' && statusBefore !== 'completed') {
      logger.info(`[onAppointmentCompletedCreateCharge / ${tenantId}] Appointment ${appointmentId} status changed to 'completed'. Processing charge creation.`);
      
      try {
        // --- Fetch the full appointment document ---
        logger.info(`[onAppointmentCompletedCreateCharge / ${tenantId}] Fetching full appointment document: ${appointmentId}`);
        const appointmentRef = db.collection('appointments').doc(appointmentId);
        const appointmentSnap = await appointmentRef.get();

        if (!appointmentSnap.exists) {
            logger.error(`[onAppointmentCompletedCreateCharge / ${tenantId}] CRITICAL: Appointment document ${appointmentId} not found after status change trigger! Aborting.`);
        return;
      }
        const appointmentData = appointmentSnap.data();
        if (!appointmentData) {
             logger.error(`[onAppointmentCompletedCreateCharge / ${tenantId}] CRITICAL: Appointment document ${appointmentId} data is empty! Aborting.`);
        return;
      }
        // --- End Fetch ---

        // --- Use data from the fetched document ---
        const fetchedTenantId = appointmentData.tenant_id; // Confirm tenantId from fetched doc
        const serviceType = appointmentData.service_type; // clinica ou petshop
        const tutorId = appointmentData.tutorId || appointmentData.customer_id; // Use tutorId first, fallback to customer_id
        const serviceId = appointmentData.service_id;
        const serviceName = appointmentData.service_name;
        const servicePrice = appointmentData.price;
        const petId = appointmentData.petId || appointmentData.pet_id || null; // Use petId first, fallback to pet_id
        const osNumber = appointmentData.osNumber || null; // <<< Get OS Number >>>
        const prontuarioId = appointmentData.prontuarioId || null; // <<< Get Prontuario ID >>>
        const currentEpisodeId = appointmentData.currentEpisodeId || null; // <<< Get Episode ID >>>
        
        // <<< Fetch Pet Name if petId exists >>>
        let petName: string | null = null;
        if (petId) {
            try {
                logger.info(`[onAppointmentCompletedCreateCharge / ${tenantId}] Fetching pet name for petId: ${petId}`);
                const petRef = db.collection('pets').doc(petId);
                const petSnap = await petRef.get();
                if (petSnap.exists) {
                    petName = petSnap.data()?.name || null;
                    logger.info(`[onAppointmentCompletedCreateCharge / ${tenantId}] Fetched pet name: ${petName}`);
    } else {
                    logger.warn(`[onAppointmentCompletedCreateCharge / ${tenantId}] Pet document ${petId} not found.`);
                }
            } catch (petError) {
                logger.error(`[onAppointmentCompletedCreateCharge / ${tenantId}] Error fetching pet ${petId}:`, petError);
            }
        }
        // <<< End Fetch Pet Name >>>


        logger.info(`[onAppointmentCompletedCreateCharge / ${tenantId}] Fetched appointment data:`, { fetchedTenantId, serviceType, tutorId, serviceId, serviceName, servicePrice, petId, petName, osNumber, prontuarioId, currentEpisodeId }); // Added fields to log

        // --- Validation using fetched data ---
        if (fetchedTenantId !== tenantId) {
             logger.error(`[onAppointmentCompletedCreateCharge / ${tenantId}] Mismatch between tenantId in event data (${tenantId}) and fetched document (${fetchedTenantId}). Aborting.`);
             return; // Safety check against processing wrong tenant's data
        }
        if (!tutorId || !serviceId || !serviceName || typeof servicePrice !== 'number') {
           logger.error(`[onAppointmentCompletedCreateCharge / ${tenantId}] Missing required data (tutorId, serviceId, serviceName, price) in FETCHED appointment ${appointmentId}. Cannot create charge item.`, { tutorId, serviceId, serviceName, servicePrice });
       return;
    }
        // Allow zero price for now, but log a warning. Negative price is skipped.
        if (servicePrice < 0) { 
           logger.warn(`[onAppointmentCompletedCreateCharge / ${tenantId}] Fetched appointment ${appointmentId} has negative price (${servicePrice}). Skipping charge item creation.`);
           return; 
        } else if (servicePrice === 0) {
           logger.warn(`[onAppointmentCompletedCreateCharge / ${tenantId}] Fetched appointment ${appointmentId} has zero price. Proceeding, but charge item will have zero value.`);
        }
        // --- End Validation ---

        let chargeItems: any[] = [];
        let consultationId: string | null = null;

        // Item principal (serviço do agendamento)
        const mainServiceItem = {
          itemId: serviceId, // Use fetched serviceId
          sourceType: 'appointment', 
          sourceId: appointmentId,
          description: serviceName, // Use fetched serviceName
          quantity: 1,
          unitPrice: servicePrice, // Use fetched price
          totalPrice: servicePrice, // Use fetched price
          itemType: serviceType === 'clinica' ? 'clinic' : 'petshop', 
        };
        chargeItems.push(mainServiceItem);

        // Se for CLÍNICO, busca itens consumidos na consulta
        if (serviceType === 'clinica') {
          try {
            logger.info(`[onAppointmentCompletedCreateCharge / ${tenantId}] Clinical service. Searching for Consultation linked to appointment ${appointmentId}...`);
            // Query the 'consultations' collection (assuming root level)
            const consultationQuery = db.collection('consultations') 
                                      .where('appointmentId', '==', appointmentId)
                                      .where('tenant_id', '==', tenantId) // <<< CORRIGIDO de 'tenantId' para 'tenant_id' >>>
                                      .limit(1);
            const consultationSnapshot = await consultationQuery.get();

            if (!consultationSnapshot.empty) {
              const consultationDoc = consultationSnapshot.docs[0];
              consultationId = consultationDoc.id;
              const consultationData = consultationDoc.data();
              logger.info(`[onAppointmentCompletedCreateCharge / ${tenantId}] Found consultation ${consultationId}. Processing consumedItems...`);

              if (consultationData && Array.isArray(consultationData.consumedItems) && consultationData.consumedItems.length > 0) {
                logger.info(`[onAppointmentCompletedCreateCharge / ${tenantId}] Found ${consultationData.consumedItems.length} consumed items.`);
                
                // Filter out any potentially invalid items before mapping
                const validConsumedItems = consultationData.consumedItems.filter((item: any) => 
                    item && (item.productId || item.id || item.itemId) && item.name // Basic validation
                );

                if (validConsumedItems.length !== consultationData.consumedItems.length) {
                   logger.warn(`[onAppointmentCompletedCreateCharge / ${tenantId}] Some consumed items were filtered out due to missing required fields (productId/id/itemId or name). Original count: ${consultationData.consumedItems.length}, Valid count: ${validConsumedItems.length}`);
                }
                
                // Map valid consumed items to charge item format
                const consumedChargeItems = validConsumedItems.map((item: any) => ({
                    itemId: item.productId || item.id || item.itemId, // Prefer productId, fallback to id/itemId
                    sourceType: 'consultation', // Source is the consultation doc
                    sourceId: consultationId,
                    description: item.name || 'Item Consumido',
                    quantity: item.quantity || 1,
                    unitPrice: item.price || item.unit_price || 0, // Allow zero price
                    totalPrice: item.total_price || (item.price || item.unit_price || 0) * (item.quantity || 1),
                    itemType: 'product', // Assume consumed items are products unless specified otherwise
                }));
                chargeItems = chargeItems.concat(consumedChargeItems);
                logger.info(`[onAppointmentCompletedCreateCharge / ${tenantId}] Added ${consumedChargeItems.length} consumed items to the charge list.`);
              } else {
                 logger.info(`[onAppointmentCompletedCreateCharge / ${tenantId}] Consultation ${consultationId} found, but no consumedItems array or it's empty.`);
              }
            } else {
              logger.warn(`[onAppointmentCompletedCreateCharge / ${tenantId}] No consultation document found linked to completed clinical appointment ${appointmentId}. Charge will only contain the main service.`);
            }
          } catch (error) {
            logger.error(`[onAppointmentCompletedCreateCharge / ${tenantId}] Error querying consultation for appointment ${appointmentId}:`, error);
            // Continue without consumed items, only the main service
          }
        } // End if (serviceType === 'clinica')

        // --- Final Check and Call to Add Items ---\\
        if (chargeItems.length === 0) {
            logger.warn(`[onAppointmentCompletedCreateCharge / ${tenantId}] No valid items found for charge creation for appointment ${appointmentId}. Skipping.`);
         return; 
      }

        logger.info(`[onAppointmentCompletedCreateCharge / ${tenantId}] Preparing to add ${chargeItems.length} items to charge for tutor ${tutorId}.`);
        
        // Call the helper function to add items to a pending charge
        const chargeResult = await addItemsToPendingCharge(
          tenantId,
            tutorId,
            petId, 
            chargeItems,
            petName,
            // <<< Passar IDs condicionalmente baseado no serviceType >>>
            serviceType === 'petshop' ? osNumber : null,         // Passa osNumber APENAS se for petshop
            serviceType === 'clinica' ? currentEpisodeId : null, // Passa episodeId APENAS se for clinica
            serviceType === 'clinica' ? prontuarioId : null     // Passa prontuarioId APENAS se for clinica
        );
        
        if (chargeResult.success) {
            logger.info(`[onAppointmentCompletedCreateCharge / ${tenantId}] Successfully processed charge (ID: ${chargeResult.chargeId}) for appointment ${appointmentId}.`);
        } else {
             logger.error(`[onAppointmentCompletedCreateCharge / ${tenantId}] Failed to process charge for appointment ${appointmentId}. Error: ${chargeResult.message}`, chargeResult.errorDetails);
        }
        
      } catch (error) {
        logger.error(`[onAppointmentCompletedCreateCharge / ${tenantId}] Unhandled error processing appointment ${appointmentId}:`, error);
        // Optionally, rethrow or handle specific error types if needed
        // Consider adding retry logic here if appropriate
      }
    } else {
      // Log if the trigger fired but status wasn't 'completed' or didn't change to it.
      if (statusAfter !== 'completed') {
        logger.log(`[onAppointmentCompletedCreateCharge / ${tenantId}] Triggered for appointment ${appointmentId}, but status is now '${statusAfter}' (not 'completed'). No action taken.`);
      } else { // statusAfter === 'completed' but statusBefore was also 'completed'
         logger.log(`[onAppointmentCompletedCreateCharge / ${tenantId}] Triggered for appointment ${appointmentId}, but status was already 'completed'. No action taken.`);
      }
    }

    const functionEndTime = Date.now();
    logger.info(`[onAppointmentCompletedCreateCharge / ${tenantId}] Function execution finished for appointment ${appointmentId}. Duration: ${functionEndTime - functionStartTime}ms`);

  }
);

// --- Funções de Pagamento (Caixa) --- // <<< Adicionado para separar seções >>>

// TODO: Mover a função processPayment para esta seção se desejar organizar melhor

// ... (processPayment e outras funções existentes) ...


// --- NOVA FUNÇÃO: Gerar Número da OS --- 
export const generateOsNumber = https.onCall(
  {
    region: REGION, // Mantenha sua região
    cors: ["http://localhost:5173", "https://petfacil.app"], // <-- ADICIONADO CORS AQUI
  },
  async (request) => {
    logger.info(`[generateOsNumber / v: ${CODE_VERSION}] Function called.`); // Use CODE_VERSION se definido

    if (!request.auth?.token?.tenant_id) {
      logger.error("[generateOsNumber] Permission denied: User is not authenticated or missing tenant_id.");
      throw new HttpsError("permission-denied", "Ação permitida apenas para usuários logados com tenant.");
    }
    const tenantId = request.auth.token.tenant_id;
    logger.info(`[generateOsNumber] Generating OS number for tenant: ${tenantId}`);

    try {
      // Lógica para gerar o número da OS (usando número aleatório de 8 dígitos)
      const randomNumber = Math.floor(Math.random() * 90000000) + 10000000;
      const osNumber = `OS-${pad8(randomNumber)}`;
      
      // Apenas retorna o número gerado
      logger.info(`[generateOsNumber] Generated OS Number: ${osNumber} for tenant ${tenantId}`);
      return { success: true, osNumber: osNumber };

    } catch (error: any) {
      logger.error(`[generateOsNumber] Error generating OS number for tenant ${tenantId}:`, error);
      throw new HttpsError("internal", "Erro interno ao gerar número da OS.", error.message);
    }
  }
);
// --- FIM NOVA FUNÇÃO --- 

// --- NOVA FUNÇÃO: Criar OS para "Continuar Comprando" ---

interface CreateContinuedOsData {
  customerId: string;
  // Adicionar petId se for relevante vincular a OS a um pet específico desde o início
  // petId?: string;
}

export const createContinuedOrderService = onCall<
  CreateContinuedOsData,
  Promise<{ success: boolean; message?: string; osId?: string; osNumber?: string }>
>(
  {
    region: REGION,
    cors: ["http://localhost:5173", "https://petfacil.app"],
    memory: "128MiB", // Pode ser menor
  },
  async (request) => {
    logger.info(`[createContinuedOrderService / v: ${CODE_VERSION}] Function called.`);

    // 1. Autenticação e Autorização
    if (!request.auth?.uid) {
      logger.error("[createContinuedOrderService] Unauthenticated user.");
      throw new HttpsError("unauthenticated", "Usuário não autenticado.");
    }
    const tenantId = request.auth.token.tenant_id;
    if (!tenantId) {
      logger.error(`[createContinuedOrderService] User ${request.auth.uid} is missing tenant_id claim.`);
      throw new HttpsError("failed-precondition", "Usuário não pertence a um tenant.");
    }
    const cashierId = request.auth.uid; // Colaborador que está criando

    // 2. Validação dos Dados
    const { customerId } = request.data;
    if (!customerId) {
      logger.error("[createContinuedOrderService] Missing required data: customerId.", { tenantId });
      throw new HttpsError("invalid-argument", "ID do Cliente é obrigatório.");
    }

    logger.info(`[createContinuedOrderService] Request validated for tenant ${tenantId}, customer ${customerId}, cashier ${cashierId}.`);

    try {
      // 3. Gerar Número da OS
      const randomNumber = Math.floor(Math.random() * 90000000) + 10000000;
      // Alterado: Remover prefixo CSH para seguir o padrão OS-XXXXXXXX
      const osNumber = `OS-${pad8(randomNumber)}`; 
      logger.info(`[createContinuedOrderService] Generated OS Number: ${osNumber} for tenant ${tenantId}`);

      // 4. Criar Documento OS em Firestore
      const osCollectionPath = `tenants/${tenantId}/order_services`;
      const osCollection = db.collection(osCollectionPath);
      const newOsDocRef = osCollection.doc(); // Gera um ID automático

      const newOsData = {
        osNumber: osNumber,
        customerId: customerId, // <<< CORREÇÃO: Usar customerId extraído de request.data
        // petId: data.petId, // Adicionar se passado e necessário
        status: "pending_cashier", // Novo status indicando criado pelo caixa
        items: [], // Inicia sem itens
        totalValue: 0, // Valor inicial
        paymentStatus: "pending", // Status do pagamento
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        createdBy: request.auth?.token.user_id || "unknown", // ID do colaborador que criou
        createdFrom: "cashier_continue_shopping", // Origem da OS
        tenantId: tenantId,
      };

      await newOsDocRef.set(newOsData);
      logger.info(`[createContinuedOrderService] Created new Order Service document ${newOsDocRef.id} in ${osCollectionPath}`);

      // 5. Retornar Sucesso
      return { success: true, osId: newOsDocRef.id, osNumber: osNumber };
    } catch (error: any) { // <<< CORREÇÃO: Tipar erro como any
      logger.error(`[createContinuedOrderService] Error creating continued OS for tenant ${tenantId}, customer ${customerId}:`, error);
      if (error instanceof HttpsError) {
        throw error;
      }
      throw new HttpsError("internal", "Erro interno ao criar ordem de serviço para continuar comprando.", error);
    }
  }
);
// --- FIM NOVA FUNÇÃO ---

// --- NOVA FUNÇÃO: Deletar OS de Caixa Vazia ---

interface DeleteOsData {
  osId: string;
}

export const deleteEmptyCashierOs = onCall<
  DeleteOsData,
  Promise<{ success: boolean; deleted: boolean; message?: string }>
>(
  {
    region: REGION,
    cors: ["http://localhost:5173", "https://petfacil.app"],
    memory: "128MiB",
  },
  async (request) => {
    logger.info(`[deleteEmptyCashierOs / v: ${CODE_VERSION}] Function called.`);

    // 1. Autenticação e Autorização
    if (!request.auth?.uid) {
      logger.error("[deleteEmptyCashierOs] Unauthenticated user.");
      throw new HttpsError("unauthenticated", "Usuário não autenticado.");
    }
    const tenantId = request.auth.token.tenant_id;
    if (!tenantId) {
      logger.error(`[deleteEmptyCashierOs] User ${request.auth.uid} is missing tenant_id claim.`);
      throw new HttpsError("failed-precondition", "Usuário não pertence a um tenant.");
    }
    const callerUid = request.auth.uid;

    // 2. Validação dos Dados
    const { osId } = request.data;
    if (!osId) {
      logger.error("[deleteEmptyCashierOs] Missing required data: osId.", { tenantId });
      throw new HttpsError("invalid-argument", "ID da Ordem de Serviço é obrigatório.");
    }

    logger.info(`[deleteEmptyCashierOs] Request validated for tenant ${tenantId}, osId ${osId}, caller ${callerUid}.`);

    try {
      // 3. Referência do Documento
      const osDocRef = db.collection('tenants').doc(tenantId).collection('order_services').doc(osId);
      
      // 4. Ler o documento
      const osDocSnap = await osDocRef.get();

      if (!osDocSnap.exists) {
        logger.warn(`[deleteEmptyCashierOs] OS document ${osId} not found for tenant ${tenantId}. Cannot delete.`);
        return { success: true, deleted: false, message: "OS não encontrada." }; 
      }

      const osData = osDocSnap.data();
      if (!osData) {
         logger.error(`[deleteEmptyCashierOs] OS document ${osId} data is undefined. Cannot process.`);
         throw new HttpsError("internal", "Erro ao ler dados da OS.");
      }

      // 5. Verificar se está vazia e deletar
      // Considerar também checar o status? Ex: só deletar se for 'pending_cashier'?
      if (osData.items && osData.items.length === 0) {
        logger.info(`[deleteEmptyCashierOs] OS ${osId} is empty. Deleting...`);
        await osDocRef.delete();
        logger.info(`[deleteEmptyCashierOs] OS ${osId} deleted successfully.`);
        return { success: true, deleted: true, message: "OS vazia deletada com sucesso." };
      } else {
        logger.info(`[deleteEmptyCashierOs] OS ${osId} is not empty (items count: ${osData.items?.length ?? 'undefined'}). Not deleting.`);
        return { success: true, deleted: false, message: "OS não está vazia, não foi deletada." };
      }

    } catch (error: any) {
      logger.error(`[deleteEmptyCashierOs] Error processing OS ${osId} for tenant ${tenantId}:`, error);
      if (error instanceof HttpsError) {
        throw error;
      }
      throw new HttpsError("internal", "Erro interno ao tentar deletar OS vazia.", { originalError: error.message });
    }
  }
);
// --- FIM NOVA FUNÇÃO ---

// <<< NOVA FUNÇÃO: Cancelar um item específico de uma charge >>>
export const cancelChargeItem = onCall<CancelChargeItemData>(
  { // <<< Adicionar opções v2 aqui se necessário (region, cors, etc.) >>>
    region: REGION, // Exemplo
    cors: ["http://localhost:5173", "https://petfacil.app"],
  },
  async (request: CallableRequest<CancelChargeItemData>) => {
    // <<< ADICIONAR LOG DETALHADO DO TOKEN >>>
    logger.info(`[cancelChargeItem v2 ENTRY] Called by UID: ${request.auth?.uid}. Auth Token:`, request.auth?.token);

    // 1. Validar Autenticação e Tenant (usando request.auth)
    if (!request.auth) {
      // <<< ADICIONAR LOG ANTES DE LANÇAR ERRO >>>
      logger.error("[cancelChargeItem v2] Authentication check failed: request.auth is missing.");
      throw new HttpsError(
        "unauthenticated",
        "Usuário não autenticado."
      );
    }
    const tenantId = request.auth.token.tenant_id;
    if (!tenantId) {
      // <<< ADICIONAR LOG ANTES DE LANÇAR ERRO >>>
      logger.error(`[cancelChargeItem v2] Tenant ID check failed: tenant_id is missing from token for UID ${request.auth.uid}. Token data:`, request.auth.token);
      throw new HttpsError(
        "failed-precondition",
        "Tenant ID não encontrado no token de autenticação."
      );
    }

    // 2. Validar Input (usando request.data)
    const { chargeId, itemId, reason } = request.data;
    if (!chargeId || !itemId || !reason) {
      throw new HttpsError(
        "invalid-argument",
        "Parâmetros chargeId, itemId e reason são obrigatórios."
      );
    }
    if (typeof reason !== "string" || reason.trim().length === 0) {
      throw new HttpsError(
        "invalid-argument",
        "O motivo (reason) não pode estar vazio."
      );
    }

    console.log(`[cancelChargeItem v2] Tenant: ${tenantId}, Charge: ${chargeId}, Item: ${itemId}, Reason: ${reason}`);

    // 3. Referência ao Documento da Charge (sem alteração)
    const chargeRef = db
      .collection("tenants")
      .doc(tenantId)
      .collection("charges")
      .doc(chargeId);

    try {
      // 4. Executar Atualização dentro de uma Transação (sem alteração na lógica interna)
      await db.runTransaction(async (transaction) => {
        const chargeDoc = await transaction.get(chargeRef);

        if (!chargeDoc.exists) {
          throw new HttpsError("not-found", `Charge ${chargeId} não encontrada.`);
        }

        const chargeData = chargeDoc.data();
        if (!chargeData) {
          throw new HttpsError("internal", `Falha ao ler dados da charge ${chargeId}.`);
        }

        if (chargeData.status === "paid" || chargeData.status === "canceled") {
            throw new HttpsError("failed-precondition", `Não é possível cancelar item de uma charge que já está ${chargeData.status}.`);
        }

        const items = chargeData.items || [];
        let itemFound = false;

        // <<< Reaplicar tipo ChargeItem (definida anteriormente) >>>
        const updatedItems = items.map((item: ChargeItem) => { 
          if (item.itemId === itemId || item.sourceId === itemId) {
            itemFound = true;
            return {
              ...item,
              cancelled: true,
              cancellationReason: reason,
              // cancellationTimestamp: Timestamp.now() // Descomentar se importar Timestamp
            };
          }
          return item;
        });

        if (!itemFound) {
          throw new HttpsError("not-found", `Item com ID ${itemId} não encontrado na charge ${chargeId}.`);
        }

        transaction.update(chargeRef, { items: updatedItems });
        console.log(`[cancelChargeItem v2] Item ${itemId} marcado como cancelado na charge ${chargeId}.`);
      });

      // 5. Retornar Sucesso (sem alteração)
      return { success: true, message: "Item marcado como cancelado com sucesso." };

    } catch (error: any) {
      console.error(`[cancelChargeItem v2] Erro ao cancelar item ${itemId} na charge ${chargeId}:`, error);
      // <<< Usar HttpsError v2 importado diretamente >>>
      if (error instanceof HttpsError) { 
        throw error;
      }
      const errorMessage = error instanceof Error ? error.message : "Erro interno desconhecido.";
      throw new HttpsError(
        "internal",
        "Erro interno ao processar o cancelamento do item.",
        errorMessage
      );
    }
});

// ==============================================
// FUNÇÕES DE BACKGROUND / TRIGGERS (Exemplo)
// ==============================================

// <<< REMOVER INTERFACE UTILITÁRIA >>>
/*
// <<< Interface para a função utilitária >>>
interface SetClaimsData {
  targetUid: string;  // UID do usuário alvo
  claimsToSet: { [key: string]: any }; // Objeto com as claims a serem definidas
}
*/

// ... (outras funções) ...


// ==============================================
// UTILITY FUNCTIONS (Use with caution!)
// ==============================================

// <<< REMOVER FUNÇÃO UTILITÁRIA >>>
/*
export const setCustomUserClaimsUtil = onCall<SetClaimsData>(
  {
    region: "southamerica-east1",
    cors: ["http://localhost:5173", "https://petfacil.app"], // Ajuste CORS se necessário
  },
  async (request: CallableRequest<SetClaimsData>) => {
    logger.info(`[setCustomUserClaimsUtil ENTRY] Function called.`);

    // --- AUTHORIZATION: Only allow specific Admin UIDs --- 
    // <<< SUBSTITUIR PLACEHOLDER PELO UID DO SUPERADMIN >>>
    const allowedCallerUids = ["fGV0D5dhIKY5rlbMZfJ2raNFOx33"]; 
    const callerUid = request.auth?.uid;

    if (!callerUid || !allowedCallerUids.includes(callerUid)) {
      logger.error(`[setCustomUserClaimsUtil] Unauthorized attempt by UID: ${callerUid}. Allowed: ${allowedCallerUids.join(", ")}.`);
      throw new HttpsError("permission-denied", "Você não tem permissão para executar esta operação.");
    }
    logger.info(`[setCustomUserClaimsUtil] Caller ${callerUid} authorized.`);
    // --- END AUTHORIZATION --- 

    // --- Validate Input Data --- 
    const { targetUid, claimsToSet } = request.data;
    if (!targetUid || !claimsToSet || typeof claimsToSet !== 'object' || Object.keys(claimsToSet).length === 0) {
      logger.error(`[setCustomUserClaimsUtil] Invalid input data received for target UID ${targetUid}:`, request.data);
      throw new HttpsError("invalid-argument", "UID alvo e um objeto de claims não vazio são obrigatórios.");
    }
    logger.info(`[setCustomUserClaimsUtil] Input validated. Target UID: ${targetUid}, Claims:`, claimsToSet);
    // --- End Validation --- 

    try {
      // --- Set Custom Claims --- 
      logger.info(`[setCustomUserClaimsUtil] Attempting to set claims for UID: ${targetUid}...`);
      await admin.auth().setCustomUserClaims(targetUid, claimsToSet);
      logger.info(`[setCustomUserClaimsUtil] Successfully set custom claims for UID: ${targetUid}. Claims set:`, claimsToSet);
      // --- End Set Custom Claims --- 

      // Forçar atualização do token no lado do cliente (opcional, mas recomendado se a UI depender disso imediatamente)
      // O cliente precisará lidar com isso após a chamada da função.

      return { success: true, message: `Claims atualizadas com sucesso para o usuário ${targetUid}.` };

    } catch (error: any) {
      logger.error(`[setCustomUserClaimsUtil] Error setting custom claims for UID ${targetUid}:`, error);
      // Check for specific auth errors
      if (error.code === 'auth/user-not-found') {
        throw new HttpsError("not-found", `Usuário com UID ${targetUid} não encontrado.`);
      }
      // Generic internal error
      throw new HttpsError("internal", "Erro interno ao definir custom claims.", { originalError: error.message });
    }
});
*/

// ==============================================
// MAIN FUNCTIONS (continue from here...)
// ==============================================

// <<< NOVA FUNÇÃO: Adicionar Motivo de Cancelamento >>>
interface AddCancellationReasonData {
  reasonText: string;
}

export const addCancellationReason = onCall<AddCancellationReasonData>(
  { region: REGION, enforceAppCheck: false }, // TODO: Considerar enforceAppCheck em produção
  async (request) => {
    logger.info(`[addCancellationReason v: ${CODE_VERSION}] Iniciando...`, { auth: request.auth?.token.email });

    if (!request.auth) {
      logger.warn("[addCancellationReason] Usuário não autenticado.");
      throw new HttpsError("unauthenticated", "Usuário não autenticado.");
    }
    if (!request.auth.token.tenant_id) {
      logger.error("[addCancellationReason] Claim tenant_id ausente no token.", { uid: request.auth.uid });
      throw new HttpsError("failed-precondition", "Tenant ID não encontrado no token.");
    }
    if (!request.data.reasonText || typeof request.data.reasonText !== 'string' || request.data.reasonText.trim().length === 0) {
      logger.warn("[addCancellationReason] reasonText inválido ou ausente.", { data: request.data });
      throw new HttpsError("invalid-argument", "O motivo do cancelamento (reasonText) é obrigatório.");
    }

    const tenantId = request.auth.token.tenant_id;
    const userId = request.auth.uid;
    const newReasonText = request.data.reasonText.trim();
    const reasonsCollectionRef = db.collection('tenants').doc(tenantId).collection('cancellation_reasons');

    logger.info(`[addCancellationReason] Parâmetros: tenantId=${tenantId}, userId=${userId}, reasonText="${newReasonText}"`);

    try {
      // 1. Verificar se um motivo com o mesmo texto (case-insensitive) já existe
      // Infelizmente, Firestore não suporta queries case-insensitive diretamente.
      // Vamos buscar todos e comparar no backend. Para poucos motivos, isso é aceitável.
      // Para muitos motivos, uma solução mais complexa (ex: salvar versão lower-case) seria necessária.
      const existingReasonsSnapshot = await reasonsCollectionRef.get();
      const alreadyExists = existingReasonsSnapshot.docs.some(doc => 
        doc.data().reasonText?.toLowerCase() === newReasonText.toLowerCase()
      );

      if (alreadyExists) {
        logger.warn(`[addCancellationReason] Motivo "${newReasonText}" já existe para o tenant ${tenantId}.`);
        // Retornar sucesso mesmo se já existe, para não bloquear o fluxo do modal
        return { success: true, message: "Motivo já existente." }; 
      }

      // 2. Adicionar o novo motivo
      logger.info(`[addCancellationReason] Adicionando novo motivo "${newReasonText}" para o tenant ${tenantId}.`);
      await reasonsCollectionRef.add({
        reasonText: newReasonText,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        createdBy: userId,
        isActive: true // Opcional: campo para desativar motivos
      });

      logger.info(`[addCancellationReason] Motivo "${newReasonText}" adicionado com sucesso.`);
      return { success: true };

    } catch (error) {
      logger.error("[addCancellationReason] Erro ao adicionar motivo:", error);
      throw new HttpsError("internal", "Erro interno ao salvar o motivo do cancelamento.", error);
    }
  }
);
// <<< FIM NOVA FUNÇÃO >>>