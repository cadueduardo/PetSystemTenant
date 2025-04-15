import { https } from "firebase-functions/v2"; // Garantir que https esteja importado
// import { onDocumentCreated } from "firebase-functions/v2/firestore"; // << COMENTADO (unused)
import * as admin from "firebase-admin";
// import { randomBytes } from "crypto"; // << COMENTADO (unused)
import { v4 as uuidv4 } from 'uuid'; // Descomentado
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

// --- Função handleMailTrigger (v2 - SEM ALTERAÇÕES NECESSÁRIAS AQUI) ---
// ... (código existente) ...

// --- Fim do Arquivo ---
