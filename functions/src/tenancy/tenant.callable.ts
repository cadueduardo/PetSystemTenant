import { https } from "firebase-functions/v2";
import { HttpsError, CallableRequest } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import { db, auth, adminFirestore } from "../config/firebase";
import {
    CODE_VERSION,
    REGION,
    CLAIMS_TENANT_ID,
    CLAIMS_IS_ADMIN,
    CLAIMS_IS_COLLABORATOR
} from "../config/constants";
import { CreateTenantData } from "../types";

export const createTenantAndAdmin = https.onCall(
  {
    region: REGION,
    cors: ["http://localhost:5173", "https://petfacil.app"],
    enforceAppCheck: false,
  },
  async (request: CallableRequest<CreateTenantData>) => {
    logger.info(`[createTenantAndAdmin / v: ${CODE_VERSION}] Function called.`);

    if (request.auth?.token?.tenant_id) {
      logger.error(`[createTenantAndAdmin] Permission Denied: Caller ${request.auth.uid} has tenant_id claim.`);
      throw new HttpsError("permission-denied", "Apenas o Super Administrador pode criar novos tenants.");
    }
    if (!request.auth) {
       logger.error(`[createTenantAndAdmin] Permission Denied: Unauthenticated caller.`);
       throw new HttpsError("unauthenticated", "Usuário não autenticado.");
    }
    const superAdminUid = request.auth.uid;
    logger.info(`[createTenantAndAdmin] Caller ${superAdminUid} verified as Super Admin.`);

    const data = request.data;
    if (!data.company_name || !data.adminEmail || !data.responsible_name || !data.access_url) {
      logger.error("[createTenantAndAdmin] Invalid input data (missing required fields):", data);
      throw new HttpsError("invalid-argument", "Dados incompletos para criação do tenant e administrador.");
    }

    const adminEmail = data.adminEmail;
    // Usar 'auth' importado de config

    let adminUserUid: string | null = null;
    const tenantDocRef = db.collection("tenants").doc();
    const tenantId = tenantDocRef.id;
    logger.info(`[createTenantAndAdmin] Generated Tenant ID: ${tenantId}`);

    try {
      try {
        await auth.getUserByEmail(adminEmail);
        logger.error(`[createTenantAndAdmin] Admin email ${adminEmail} already exists in Auth.`);
        throw new HttpsError("already-exists", `O email ${adminEmail} já está cadastrado no sistema de autenticação.`);
      } catch (error: any) {
        if (error.code === 'auth/user-not-found') {
          logger.info(`[createTenantAndAdmin] Admin email ${adminEmail} does not exist yet. Proceeding...`);
        } else {
          logger.error(`[createTenantAndAdmin] Error checking admin email ${adminEmail}:`, error);
          throw new HttpsError("internal", "Erro ao verificar email do administrador.");
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
        created_at: adminFirestore.FieldValue.serverTimestamp(), // adminFirestore importado
        updated_at: adminFirestore.FieldValue.serverTimestamp(), // adminFirestore importado
      };
      delete (tenantData as any).card_info; // Remove card_info if present
      // Deixar as remoções de adminEmail e responsible_name caso a CreateTenantData ainda os tenha
      // delete (tenantData as any).adminEmail;
      // delete (tenantData as any).responsible_name;

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
        await auth.deleteUser(adminUserUid).catch(delErr => logger.error(`[createTenantAndAdmin] Error deleting partially created admin user ${adminUserUid}:`, delErr));
      }

      if (error instanceof HttpsError) { throw error; }
      throw new HttpsError("internal", "Erro interno ao criar loja e administrador.", error.message);
    }
  }
); 