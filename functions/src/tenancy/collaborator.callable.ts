import { https } from "firebase-functions/v2";
import { HttpsError, CallableRequest } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import { v4 as uuidv4 } from 'uuid';
import { admin, db, auth, adminFirestore } from "../config/firebase";
import {
    CODE_VERSION,
    REGION,
    CLAIMS_TENANT_ID,
    CLAIMS_PERFIL_ID,
    CLAIMS_IS_COLLABORATOR,
    CLAIMS_IS_ADMIN
} from "../config/constants";
import { InviteCollaboratorData, CompleteInvitationData } from "../types";

export const sendCustomInvite = https.onCall(
    {
      region: REGION,
      cors: ["http://localhost:5173", "https://petfacil.app"]
    },
    async (request: CallableRequest<InviteCollaboratorData>) => {
      const executionStartTime = Date.now();
      logger.info(`>>>>>>>>>> sendCustomInvite (v: ${CODE_VERSION}) STARTED <<<<<<<<<<`);

      if (!request.auth?.token?.tenant_id) {
        throw new HttpsError("permission-denied", "Ação permitida apenas para usuários logados com tenant.");
      }
      const tenantId = request.auth.token.tenant_id;
      const callerUid = request.auth.uid;
      logger.info(`[sendCustomInvite / v: ${CODE_VERSION}] Caller: ${callerUid}, Tenant: ${tenantId}`);

      const { email, collaboratorName, profileId } = request.data;
      if (!email || !collaboratorName || !profileId || !/\S+@\S+\.\S+/.test(email)) {
        throw new HttpsError("invalid-argument", "Dados inválidos: Email, Nome e Perfil são obrigatórios.");
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
             throw new HttpsError("already-exists", `Já existe um colaborador ou convite pendente para ${email} nesta loja.`);
        }
        logger.info(`[sendCustomInvite / v: ${CODE_VERSION}] No existing active/pending collaborator found for ${email} in tenant ${tenantId}. Proceeding...`);

        let tenantCompanyName = 'sua loja';
        let tenantAdminName = request.auth.token.name || 'o administrador';
        try {
          const tenantDocRef = db.collection('tenants').doc(tenantId);
          const tenantDoc = await tenantDocRef.get();
          if (tenantDoc.exists) {
            const tenantData = tenantDoc.data();
            tenantCompanyName = tenantData?.company_name || tenantCompanyName;
            logger.info(`[sendCustomInvite] Tenant company name fetched: ${tenantCompanyName}`);
          } else {
            logger.warn(`[sendCustomInvite] Tenant document ${tenantId} not found.`);
          }
        } catch (tenantFetchError) {
          logger.error(`[sendCustomInvite] Error fetching tenant document ${tenantId}:`, tenantFetchError);
        }

        collaboratorDocRef = db.collection("colaboradores").doc();
        const collaboratorDocId = collaboratorDocRef.id;
        const collaboratorData = {
            tenantId: tenantId,
            perfilId: profileId,
            nome: collaboratorName,
            email: email,
            status: 'convite_pendente',
            convidadoPor: callerUid,
            criadoEm: adminFirestore.FieldValue.serverTimestamp(),
            atualizadoEm: adminFirestore.FieldValue.serverTimestamp(),
            invitationToken: invitationToken,
            invitationExpiresAt: adminFirestore.Timestamp.fromDate(invitationExpiresAt)
        };
        await collaboratorDocRef.set(collaboratorData);
        logger.info(`[sendCustomInvite / v: ${CODE_VERSION}] Collaborator document ${collaboratorDocId} created with status 'convite_pendente'.`);

        const acceptInvitationLink = `https://petfacil.app/accept-invitation?token=${invitationToken}`;
        const mailSubject = `Convite para colaborar na ${tenantCompanyName} no PetFácil!`;
        const mailHtml = `
          <p>Olá ${collaboratorName},</p>
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
            await collaboratorDocRef.update({ status: 'erro_no_convite', atualizadoEm: adminFirestore.FieldValue.serverTimestamp() }).catch(err => logger.error("Error updating collaborator status on failure:", err));
        }
        if (error instanceof HttpsError) { throw error; }
        throw new HttpsError("internal", `Falha ao enviar convite: ${error.message}`, error);
      }
    }
  );

export const completeInvitation = https.onCall(
    {
        region: REGION,
        cors: ["http://localhost:5173", "https://petfacil.app"]
    },
    async (request: CallableRequest<CompleteInvitationData>) => {
      const { token, password } = request.data;
      // auth importado de config/firebase

      logger.info(`[completeInvitation / v: ${CODE_VERSION}] Attempting to complete invitation with token: ${token ? 'present' : 'missing'}`);

      if (!token || !password) {
        throw new HttpsError("invalid-argument", "Token e senha são obrigatórios.");
      }
      if (password.length < 6) {
           throw new HttpsError("invalid-argument", "A senha deve ter pelo menos 6 caracteres.");
      }

      try {
        const collaboratorsRef = db.collection("colaboradores");
        const q = collaboratorsRef.where("invitationToken", "==", token).limit(1);
        const snapshot = await q.get();

        if (snapshot.empty) {
          logger.error(`[completeInvitation] Invitation token not found: ${token}`);
          throw new HttpsError("not-found", "Convite inválido ou expirado (token não encontrado).");
        }

        const collaboratorDoc = snapshot.docs[0];
        const collaboratorData = collaboratorDoc.data();
        const collaboratorId = collaboratorDoc.id;

        logger.info(`[completeInvitation] Found collaborator doc: ${collaboratorId} for token: ${token}`);

        if (collaboratorData.status !== 'convite_pendente') {
           logger.error(`[completeInvitation] Collaborator ${collaboratorId} status is not 'convite_pendente': ${collaboratorData.status}`);
           throw new HttpsError("failed-precondition", "Este convite já foi utilizado ou está inválido.");
        }

        const expiresAt = collaboratorData.invitationExpiresAt?.toDate();
        if (!expiresAt || expiresAt < new Date()) {
            logger.error(`[completeInvitation] Invitation token expired for ${collaboratorId}. Expires At: ${expiresAt}`);
            await collaboratorDoc.ref.update({ status: 'convite_expirado', atualizadoEm: adminFirestore.FieldValue.serverTimestamp() }).catch(err => logger.error("Error updating status to expired:", err));
            throw new HttpsError("deadline-exceeded", "Este convite expirou.");
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
                atualizadoEm: adminFirestore.FieldValue.serverTimestamp()
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
                 await collaboratorDoc.ref.update({ status: 'erro_email_ja_existente', atualizadoEm: adminFirestore.FieldValue.serverTimestamp() }).catch(err => logger.error("Error updating status:", err));
                 throw new HttpsError("already-exists", "Este email já está registrado no sistema de autenticação.");
             }
            throw new HttpsError("internal", `Falha ao criar usuário ou atualizar dados: ${authError.message}`, authError);
        }

      } catch (error: any) {
        logger.error(`[completeInvitation / v: ${CODE_VERSION}] General error processing token ${token}:`, error);
        if (error instanceof HttpsError) { throw error; }
        throw new HttpsError("internal", `Erro inesperado ao processar o convite: ${error.message}`, error);
      }
    }
  ); 