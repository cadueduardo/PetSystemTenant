/**
 * Import function triggers from their respective submodules:
 *
 * import {onCall} from "firebase-functions/v2/https";
 * import {onDocumentWritten} from "firebase-functions/v2/firestore";
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

// import {onRequest} from "firebase-functions/v2/https";
// import * as logger from "firebase-functions/logger";
import * as functions from "firebase-functions"; // <-- Adicionar importação
import * as admin from "firebase-admin";
// import { CallableContext } from "firebase-functions/v1/https"; // <<< Remover v1
import { randomBytes } from "crypto"; // For temporary password
// import cors = require("cors"); // Tentar importação estilo require
import * as functionsV1 from "firebase-functions"; // Alias para v1 (Triggers)

// Start writing functions
// https://firebase.google.com/docs/functions/typescript

// export const helloWorld = onRequest((request, response) => {
//   logger.info("Hello logs!", {structuredData: true});
//   response.send("Hello from Firebase!");
// });

// Initialize Firebase Admin SDK (only once)
try {
  admin.initializeApp();
} catch (e) {
  console.log("Admin SDK already initialized or initialization failed:", e);
}

const db = admin.firestore();
const auth = admin.auth();

// <<< REMOVER Opções Globais (Região) >>>
// setGlobalOptions({ region: 'southamerica-east1' });

// Define the shape of the data expected from the client
interface CreateTenantData {
  company_name: string; // From TenantForm
  adminEmail: string;   // From TenantForm
  plan: string;         // Example field, adjust based on TenantForm
  modules: string[];    // Example field, adjust based on TenantForm
  // Add other relevant fields from TenantForm's finalFormData
  responsible_name?: string;
  legal_name?: string;
  document_type?: string;
  document?: string;
  email?: string; // Company email
  phone?: string;
  address?: object; // Or define more specific interface
  business_type?: string;
  access_url?: string;
  subscription_tier?: string;
}

// <<< Usar sintaxe v2 com onCall >>>
export const createTenantAndAdmin = functions
  .region('us-central1')
  .https
  .onCall(
    { 
      cors: true // Manter ou ajustar CORS se necessário
    },
    async (request) => {
      if (!request.auth) { 
        throw new functions.https.HttpsError("unauthenticated", "User must be logged in.");
      }
      if (!request.auth || ('tenant_id' in request.auth.token && request.auth.token.tenant_id != null)) {
        throw new functions.https.HttpsError("permission-denied", "Apenas Super Administradores podem criar tenants.");
      }
      console.log(`Super Admin check passed for caller UID: ${request.auth.uid}`);

      // <<< Acessar dados via request.data >>>
      const data: CreateTenantData = request.data;

      console.log("Received tenant creation request for:", data.company_name);

      // --- 1. Validate Input Data ---
      if (!data.company_name || !data.adminEmail /*|| !data.plan || !data.modules*/) { // Adjust required fields as needed
        throw new functions.https.HttpsError("invalid-argument", "Nome da Empresa e Email do Admin são obrigatórios.");
      }
      // Basic email format check (can be more robust)
      if (!/\S+@\S+\.\S+/.test(data.adminEmail)) {
         throw new functions.https.HttpsError("invalid-argument", "Formato do email do administrador inválido.");
      }

      const { company_name, adminEmail, plan, modules, ...otherTenantData } = data;

      let tenantRef: admin.firestore.DocumentReference | null = null;
      let newUser: admin.auth.UserRecord | null = null;
      let tenantId = '';
      let uid = '';

      try {
        // --- 2. Create Tenant Document in Firestore ---
        console.log(`Creating tenant document for ${company_name}...`);
        // Ensure required fields for the tenant document itself are present
        const tenantDocData = {
          name: company_name,
          status: "active", // Default status
          plan: plan || "default_plan", // Provide default if applicable
          modules: modules || [], // Provide default if applicable
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          ownerAdminUid: null, // Will be updated later
          adminEmail: adminEmail, // Store admin email for reference
          ...otherTenantData, // Include other data like address, phone, etc.
        };
        tenantRef = await db.collection("tenants").add(tenantDocData);
        tenantId = tenantRef.id;
        console.log(`Tenant document created with ID: ${tenantId}`);

        // --- 3. Create User in Firebase Auth ---
        // Generate a strong temporary password (not sent to user)
        const tempPassword = randomBytes(16).toString("base64") + "A1b$"; // Add complexity requirements
        console.log(`Creating user in Auth for email: ${adminEmail}`);
        try {
          newUser = await auth.createUser({
            email: adminEmail,
            emailVerified: false, // User verifies via password reset flow
            password: tempPassword,
            displayName: otherTenantData.responsible_name || company_name, // Use responsible name or company name
            disabled: false, // Account is enabled
          });
          uid = newUser.uid;
          console.log(`User created in Auth with UID: ${uid}`);
        } catch (authError: any) {
            console.error("Error creating user in Auth:", authError);
            // Specific handling for existing email
            if (authError.code === 'auth/email-already-exists' || authError.code === 'auth/email-already-in-use') {
                 throw new functions.https.HttpsError('already-exists', `O email ${adminEmail} já está em uso por outro administrador.`);
            }
            throw new functions.https.HttpsError('internal', "Falha ao criar o usuário administrador.", authError.message);
        }

        // --- 4. Set Custom Claim (tenant_id) ---
        console.log(`Setting custom claim { tenant_id: ${tenantId} } for UID: ${uid}`);
        await auth.setCustomUserClaims(uid, { tenant_id: tenantId });
        console.log("Custom claim set successfully.");

        // --- 5. Update Tenant Document with ownerAdminUid ---
        console.log(`Updating tenant document ${tenantId} with ownerAdminUid: ${uid}`);
        await tenantRef.update({ ownerAdminUid: uid });
        console.log("Tenant document updated with ownerAdminUid.");

        // --- 6. Generate Password Reset Link ---
        console.log(`Generating password reset link for: ${adminEmail}`);
        const resetLink = await auth.generatePasswordResetLink(adminEmail);
        console.log("Password reset link generated.");

        // --- 7. Preparar e Enviar Email via Trigger Email ---
        console.log(`Preparando email de boas-vindas para ${adminEmail}...`);

        // Adapte o assunto e corpo do email conforme necessário
        const emailSubject = `Bem-vindo(a) à PetFácil - ${company_name}`;
        // Certifique-se que newUser não é null antes de acessar displayName
        const displayName = newUser?.displayName || 'Administrador';
        const emailHtmlBody = `
          <h1>Olá ${displayName},</h1>
          <p>Sua loja "${company_name}" foi criada com sucesso na plataforma PetFácil!</p>
          <p>Para ativar seu acesso e começar a usar o sistema, por favor, defina sua senha clicando no link abaixo:</p>
          <p><a href="${resetLink}" style="padding: 10px 15px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px;">Definir Minha Senha</a></p>
          <p>Após definir a senha, você poderá acessar a plataforma em <a href="https://petfacil.app/login">https://petfacil.app/login</a> usando seu email (${adminEmail}) e a nova senha.</p>
          <p>Se você não reconhece esta solicitação, por favor ignore este email.</p>
          <br>
          <p>Atenciosamente,</p>
          <p>Equipe PetFácil</p>
        `;

        // Documento para a coleção 'mail' (ou o nome que você configurou na extensão)
        const mailDoc = {
            to: [adminEmail], // O destinatário deve ser um array
            message: {
                subject: emailSubject,
                html: emailHtmlBody,
                // text: `Olá ${displayName}, ... (versão texto puro)` // Opcional
            },
        };

        try {
            // Escreve na coleção que a extensão Trigger Email monitora
            await db.collection('mail').add(mailDoc);
            console.log(`Email para ${adminEmail} adicionado com sucesso à fila de envio (coleção 'mail').`);
        } catch (mailError) {
            console.error(`Falha ao adicionar email à coleção 'mail' para ${adminEmail}:`, mailError);
            // Apenas logamos o erro, mas não impedimos o sucesso da função principal
        }

        // --- 8. Return Success Response ---
        console.log("Tenant and admin creation successful.");
        return {
            status: "success",
            message: "Loja e administrador criados com sucesso. Email de configuração de senha será enviado.",
            tenantData: { id: tenantId, ...tenantDocData, ownerAdminUid: uid } // Retorna os dados criados
        };

      } catch (error: any) {
        console.error("Error during tenant/admin creation process:", error);

        // Clean up Firestore document if user creation failed or claims failed
        if (tenantId && tenantRef) {
          console.log(`Attempting to delete partially created tenant document: ${tenantId}`);
          await tenantRef.delete().catch(delErr => console.error(`Failed to delete tenant ${tenantId}:`, delErr));
        }
        // Clean up Auth user if claims/update failed
        // Note: If createUser failed, it throws before UID is set, so this won't run for that specific case.
        if (uid && error.code !== 'auth/email-already-exists' && error.code !== 'auth/email-already-in-use') { 
          console.log(`Attempting to delete partially created user: ${uid} due to subsequent error.`);
          await auth.deleteUser(uid).catch(delErr => console.error(`Failed to delete user ${uid}:`, delErr));
        }

        // Re-throw specific known errors or a generic one
        if (error instanceof functions.https.HttpsError) {
            throw error; // Re-throw HttpsError directly
        }

        throw new functions.https.HttpsError("internal", "Ocorreu um erro inesperado ao criar a loja.", error.message);
      }
    });

// Define a interface para os dados esperados do frontend
interface CreateSuperAdminData {
  newAdminEmail: string;
  newAdminName?: string; // Opcional, mas útil para displayName
}

export const createSuperAdmin = functions
  .region('us-central1')
  .https
  .onCall(
    { 
      cors: ["http://localhost:5173"] // Manter CORS 
    },
    async (request) => {
    console.log("Received super admin creation request...");

    // --- 1. Verificar Autorização do Chamador ---
    // Garante que apenas um Super Admin existente pode criar outro
    if (!request.auth || ('tenant_id' in request.auth.token && request.auth.token.tenant_id != null)) {
        // Se o chamador não for autenticado OU tiver um tenant_id, negue.
        // Adicionalmente, podemos checar pelo 'role' se já o usamos em Super Admins existentes
        // if (!request.auth || request.auth.token.role !== 'superAdmin') { ... } // Use esta linha se já tiver Super Admins com 'role'
        throw new functions.https.HttpsError("permission-denied", "Apenas Super Administradores podem criar outros Super Administradores.");
    }
    console.log(`Super Admin check passed for caller UID: ${request.auth.uid}`);

    // --- 2. Validar Dados de Entrada ---
    const data: CreateSuperAdminData = request.data;
    if (!data.newAdminEmail || !/\S+@\S+\.\S+/.test(data.newAdminEmail)) {
        throw new functions.https.HttpsError("invalid-argument", "Email do novo administrador inválido ou ausente.");
    }
    const { newAdminEmail, newAdminName } = data;
    console.log(`Attempting to create new Super Admin with email: ${newAdminEmail}`);

    let newSuperAdminUser: admin.auth.UserRecord | null = null;
    let newUid = '';

    try {
      // --- 3. Criar Usuário no Firebase Auth ---
      const tempPassword = randomBytes(16).toString("base64") + "A1b$"; // Senha temporária forte
      console.log(`Creating user in Auth for Super Admin: ${newAdminEmail}`);

      try {
        newSuperAdminUser = await auth.createUser({
          email: newAdminEmail,
          emailVerified: false, // Será verificado via reset de senha
          password: tempPassword,
          displayName: newAdminName || newAdminEmail.split('@')[0], // Usa nome fornecido ou parte do email
          disabled: false,
        });
        newUid = newSuperAdminUser.uid;
        console.log(`Super Admin user created in Auth with UID: ${newUid}`);
      } catch (authError: any) {
          console.error("Error creating Super Admin user in Auth:", authError);
          if (authError.code === 'auth/email-already-exists' || authError.code === 'auth/email-already-in-use') {
               throw new functions.https.HttpsError('already-exists', `O email ${newAdminEmail} já está em uso.`);
          }
          throw new functions.https.HttpsError('internal', "Falha ao criar o usuário Super Administrador no Auth.", authError.message);
      }

      // --- 4. Definir Custom Claim 'role: superAdmin' ---
      // Importante: NÃO definimos tenant_id aqui!
      console.log(`Setting custom claim { role: 'superAdmin' } for UID: ${newUid}`);
      await auth.setCustomUserClaims(newUid, { role: 'superAdmin' });
      console.log("Super Admin custom claim set successfully.");

      // --- 5. Gerar Link de Reset de Senha ---
      console.log(`Generating password reset link for new Super Admin: ${newAdminEmail}`);
      const resetLink = await auth.generatePasswordResetLink(newAdminEmail);
      console.log("Password reset link generated for Super Admin.");

      // --- 6. Enviar Email de Boas-Vindas/Setup ---
      console.log(`Preparing welcome email for new Super Admin: ${newAdminEmail}...`);
      const emailSubject = "Bem-vindo(a) à Administração PetFácil";
      const emailHtmlBody = `
        <h1>Olá ${newSuperAdminUser.displayName || 'Administrador'},</h1>
        <p>Você foi adicionado(a) como Super Administrador(a) da plataforma PetFácil.</p>
        <p>Para ativar seu acesso e definir sua senha, por favor, clique no link abaixo:</p>
        <p><a href="${resetLink}" style="padding: 10px 15px; background-color: #dc3545; color: white; text-decoration: none; border-radius: 5px;">Definir Minha Senha de Super Admin</a></p>
        <p>Após definir a senha, você poderá acessar o painel administrativo em <a href="https://petfacil.app/admin">https://petfacil.app/admin</a> usando seu email (${newAdminEmail}) e a nova senha.</p>
        <p>Atenciosamente,</p>
        <p>Equipe PetFácil</p>
      `;

      const mailDoc = {
          to: [newAdminEmail],
          message: {
              subject: emailSubject,
              html: emailHtmlBody,
          },
      };

      try {
          await db.collection('mail').add(mailDoc);
          console.log(`Super Admin welcome email for ${newAdminEmail} added to mail queue.`);
      } catch (mailError) {
          console.error(`Failed to add Super Admin welcome email to 'mail' collection for ${newAdminEmail}:`, mailError);
          // Logamos mas não necessariamente falhamos a criação do usuário por causa disso
      }

      // --- 7. Retornar Sucesso ---
      console.log("Super Admin creation successful.");
      return {
          status: "success",
          message: `Super Administrador ${newAdminEmail} criado com sucesso. Email de configuração de senha será enviado.`,
          userData: { uid: newUid, email: newAdminEmail, displayName: newSuperAdminUser.displayName }
      };

    } catch (error: any) {
      console.error("Error during Super Admin creation process:", error);

      // Tenta limpar o usuário Auth se ele foi criado mas algo falhou depois
      if (newUid && error.code !== 'auth/email-already-exists' && error.code !== 'auth/email-already-in-use') {
        console.log(`Attempting to delete partially created Super Admin user: ${newUid}`);
        await auth.deleteUser(newUid).catch(delErr => console.error(`Failed to delete Super Admin user ${newUid}:`, delErr));
      }

      // Re-lança o erro para o cliente
      if (error instanceof functions.https.HttpsError) {
          throw error;
      }
      throw new functions.https.HttpsError("internal", "Ocorreu um erro inesperado ao criar o Super Administrador.", error.message);
    }
  });
// Adicione esta função NOVA ao final de functions/src/index.ts

export const listSuperAdmins = functions
  .region('us-central1')
  .https
  .onCall(
    { 
      cors: ["http://localhost:5173"] // Manter CORS
    },
    async (request) => {
      console.log("Received listSuperAdmins request...");

      // --- 1. Verificar Autorização do Chamador ---
      // Garante que apenas um Super Admin possa listar outros
      if (!request.auth || ('tenant_id' in request.auth.token && request.auth.token.tenant_id != null)) {
          // OU if (!request.auth || request.auth.token.role !== 'superAdmin') { ... }
          throw new functions.https.HttpsError("permission-denied", "Apenas Super Administradores podem listar usuários.");
      }
      console.log(`Super Admin check passed for caller UID: ${request.auth.uid} for listSuperAdmins`);

      const superAdmins: { uid: string; email?: string; displayName?: string; creationTime?: string; lastSignInTime?: string; }[] = [];
      let nextPageToken: string | undefined = undefined;

      try {
        console.log("Starting to list users to find Super Admins...");
        // --- 2. Listar Usuários com Paginação ---
        do {
          const listUsersResult = await auth.listUsers(1000, nextPageToken); // Pega até 1000 por vez
          console.log(`Fetched ${listUsersResult.users.length} users page...`);

          listUsersResult.users.forEach((userRecord) => {
            // --- 3. Filtrar Super Admins ---
            // Verificamos se o claim 'role' é 'superAdmin'
            // OU podemos verificar a ausência de 'tenant_id'
            const isSuper = userRecord.customClaims?.role === 'superAdmin';
            // const isSuper = userRecord.customClaims?.tenant_id === undefined || userRecord.customClaims?.tenant_id === null; // Alternativa

            if (isSuper) {
              console.log(`Found Super Admin: ${userRecord.email} (UID: ${userRecord.uid})`);
              superAdmins.push({
                uid: userRecord.uid,
                email: userRecord.email,
                displayName: userRecord.displayName,
                creationTime: userRecord.metadata.creationTime,
                lastSignInTime: userRecord.metadata.lastSignInTime,
              });
            }
          });
          nextPageToken = listUsersResult.pageToken;
        } while (nextPageToken);

        console.log(`Finished listing. Found ${superAdmins.length} Super Admins.`);
        // --- 4. Retornar a Lista ---
        return { status: "success", admins: superAdmins };

      } catch (error: any) {
        console.error("Error listing Super Admins:", error);
        throw new functions.https.HttpsError("internal", "Falha ao listar os Super Administradores.", error.message);
      }
  });

// Adicione esta função NOVA ao final de functions/src/index.ts

// Interface para os dados esperados: UID do admin a deletar
interface DeleteSuperAdminData {
  uidToDelete: string;
}

export const deleteSuperAdmin = functions
  .region('us-central1')
  .https
  .onCall(
    { 
      cors: ["http://localhost:5173"] // Manter CORS
    },
    async (request) => {
      console.log("Received deleteSuperAdmin request...");

      // --- 1. Verificar Autorização do Chamador ---
      if (!request.auth || ('tenant_id' in request.auth.token && request.auth.token.tenant_id != null)) {
          // OU if (!request.auth || request.auth.token.role !== 'superAdmin') { ... }
          throw new functions.https.HttpsError("permission-denied", "Apenas Super Administradores podem excluir usuários.");
      }
      const callerUid = request.auth.uid; // UID de quem está chamando
      console.log(`Super Admin check passed for caller UID: ${callerUid} for deleteSuperAdmin`);

      // --- 2. Validar Dados de Entrada ---
      const data: DeleteSuperAdminData = request.data;
      const uidToDelete = data?.uidToDelete;

      if (!uidToDelete || typeof uidToDelete !== 'string') {
          throw new functions.https.HttpsError("invalid-argument", "UID do administrador a ser excluído é inválido ou ausente.");
      }

      // --- 3. Prevenir Auto-Exclusão ---
      if (callerUid === uidToDelete) {
          console.warn(`Attempt blocked: Super Admin ${callerUid} tried to delete themselves.`);
          throw new functions.https.HttpsError("permission-denied", "Você não pode excluir sua própria conta de Super Administrador.");
      }

      try {
        // --- 4. Verificar se o Alvo é o Admin Principal Protegido ---      
        console.log(`Fetching user data for UID to delete: ${uidToDelete}`);
        const userToDeleteRecord = await auth.getUser(uidToDelete);
        const targetEmail = userToDeleteRecord.email;

        // PROTEÇÃO ESSENCIAL: Não permitir excluir o email principal
        if (targetEmail === 'cadu.eduardo@gmail.com') {
            console.warn(`Attempt blocked: Tried to delete protected Super Admin: ${targetEmail}`);
            throw new functions.https.HttpsError("permission-denied", `O administrador principal (${targetEmail}) não pode ser excluído.`);
        }

        // --- 5. Excluir o Usuário do Auth ---
        console.log(`Attempting to delete user ${targetEmail} (UID: ${uidToDelete})...`);
        await auth.deleteUser(uidToDelete);
        console.log(`Successfully deleted user ${targetEmail} (UID: ${uidToDelete})`);

        // --- 6. Retornar Sucesso ---
        return { status: "success", message: `Super Administrador ${targetEmail || uidToDelete} excluído com sucesso.` };

      } catch (error: any) {
          console.error(`Error deleting Super Admin user ${uidToDelete}:`, error);
          if (error instanceof functions.https.HttpsError) {
              throw error; // Re-lança erros HttpsError (como permission-denied)
          }
          // Trata erro comum de usuário não encontrado
          if (error.code === 'auth/user-not-found') {
              throw new functions.https.HttpsError("not-found", `Usuário com UID ${uidToDelete} não encontrado.`);
          }
          throw new functions.https.HttpsError("internal", "Falha ao excluir o Super Administrador.", error.message);
      }
  });

// --- Função para Gerenciar Acesso ao Suporte --- //

interface ManageSupportAccessData {
  action: 'grant' | 'revoke'; 
}

// Opções de CORS diretamente no objeto de configuração da função
export const manageSupportAccess = functions
  .region('us-central1')
  .https
  .onCall(
    {
      cors: true, // Manter CORS
    },
    async (request: functions.https.CallableRequest<ManageSupportAccessData>) => {
      // 1. Verificação de Segurança: Usuário Autenticado e é Tenant Admin?
      if (!request.auth) {
        throw new functions.https.HttpsError(
          "unauthenticated",
          "Usuário não autenticado."
        );
      }
      if (!request.auth.token.tenant_id) {
        console.error("Permission Denied: Caller does not have a tenant_id claim.", { uid: request.auth.uid, token: request.auth.token });
        throw new functions.https.HttpsError(
          "permission-denied",
          "Ação permitida apenas para administradores de tenant."
        );
      }

      const callingTenantId: string = request.auth.token.tenant_id;
      const data = request.data; 
      const action = data.action;

      console.log(`Received manageSupportAccess request: action=${action}, tenantId=${callingTenantId}, callerUid=${request.auth.uid}`);

      // 2. Validar Ação
      if (action !== 'grant' && action !== 'revoke') {
        console.error("Validation failed: Invalid action provided.", { action });
        throw new functions.https.HttpsError(
          "invalid-argument",
          'A ação deve ser "grant" ou "revoke".'
        );
      }

      const tenantRef = db.collection("tenants").doc(callingTenantId);

      try {
        let updateData: Record<string, any> = {};
        let successMessage = "";

        if (action === 'grant') {
          // 3. Lógica para Conceder Acesso
          const expirationDate = new Date();
          expirationDate.setDate(expirationDate.getDate() + 1); // Expira em 24 horas

          updateData = {
            supportAccessGranted: true,
            supportAccessExpiresAt: admin.firestore.Timestamp.fromDate(expirationDate),
            supportAccessLastUpdated: admin.firestore.FieldValue.serverTimestamp(),
          };
          successMessage = "Acesso ao suporte concedido por 24 horas.";

        } else { // action === 'revoke'
          // 4. Lógica para Revogar Acesso
          updateData = {
            supportAccessGranted: false,
            supportAccessExpiresAt: null, // Ou FieldValue.delete() se preferir
            supportAccessLastUpdated: admin.firestore.FieldValue.serverTimestamp(),
          };
          successMessage = "Acesso ao suporte revogado.";
        }

        // 5. Atualizar Firestore (Admin SDK ignora regras de segurança)
        console.log(`Attempting to update tenant ${callingTenantId} with data:`, updateData);
        await tenantRef.update(updateData);

        console.log(`Support access ${action} successful for tenant ${callingTenantId}`);
        return { success: true, message: successMessage };

      } catch (error: any) {
        console.error(`Error during manageSupportAccess for tenant ${callingTenantId}:`, error);
        // Log mais detalhado do erro interno
        let errorMessage = "Erro interno ao atualizar o acesso ao suporte.";
        if (error.message) {
          errorMessage += ` Details: ${error.message}`;
        }
        console.error(errorMessage);
        throw new functions.https.HttpsError(
          "internal",
          "Erro ao atualizar o acesso ao suporte.", // Mensagem genérica para o cliente
          { internalDetails: errorMessage } // Detalhes internos não expostos ao cliente diretamente
        );
      }
    }
  );

// Inicializar CORS Handler (REMOVER - não necessário para onCall)
// const corsHandler = cors({ origin: true }); 

// --- Função para Gerar Token de Acesso como Suporte (VERSÃO onCall RESTAURADA) --- //

// Define a interface para os dados esperados do frontend
interface GenerateSupportTokenData {
  targetTenantId: string; // ID do tenant que o Super Admin quer acessar
}

export const generateSupportToken = functions
  .region('us-central1')
  .https
  .onCall(
    { 
      cors: ["http://localhost:5173", "https://petfacil.app"], 
    },
    async (request: functions.https.CallableRequest<GenerateSupportTokenData>) => {
      
      // <<< LOG PARA VERIFICAR CONTA DE SERVIÇO >>>
      try {
        // A chamada admin.initializeApp() sem argumentos usa ADC por padrão.
        // Vamos apenas logar a tentativa de pegar um token, o que implica o uso das credenciais padrão.
         await admin.credential.applicationDefault().getAccessToken(); 
         console.log("[generateSupportToken] Successfully obtained access token using Application Default Credentials.");
         // Inferimos que a conta de serviço é a padrão do App Engine para esta função.
         // O erro 'iam.serviceAccounts.signBlob' denied confirma isso indiretamente.
      } catch(credError: any) {
          console.error("[generateSupportToken] ERROR checking/getting Application Default Credentials:", credError.message || credError);
          // Se este bloco for executado, há um problema fundamental com as credenciais da função.
          throw new functions.https.HttpsError("internal", "Falha ao verificar as credenciais da função.", credError.message);
      }
      // <<< FIM DO LOG >>>

      // 1. Verificar se o chamador é Super Admin (usando request.auth)
      if (!request.auth || request.auth.token.tenant_id) {
        console.error("Permission Denied: Caller is not a Super Admin for generateSupportToken.", { uid: request.auth?.uid, token: request.auth?.token });
        throw new functions.https.HttpsError(
          "permission-denied",
          "Apenas Super Administradores podem gerar tokens de suporte."
        );
      }
      const superAdminUid = request.auth.uid;
      
      // 2. Obter e Validar targetTenantId (usando request.data)
      const targetTenantId = request.data.targetTenantId;
      console.log(`Super Admin ${superAdminUid} requesting support token for tenant ${targetTenantId}`);

      if (!targetTenantId || typeof targetTenantId !== 'string') {
        console.error("Validation failed: Missing or invalid targetTenantId.", { targetTenantId });
        throw new functions.https.HttpsError(
          "invalid-argument",
          "ID do tenant alvo é inválido ou ausente."
        );
      }

      // 3. (Opcional) Verificar se o tenant alvo existe
      try {
        const tenantDoc = await db.collection('tenants').doc(targetTenantId).get();
        if (!tenantDoc.exists) {
          console.error(`Tenant not found: ${targetTenantId}`);
          throw new functions.https.HttpsError("not-found", `Tenant com ID ${targetTenantId} não encontrado.`);
        }
        console.log(`Target tenant ${targetTenantId} exists.`);
      } catch (error: any) {
        console.error(`Error checking target tenant ${targetTenantId}:`, error);
        if (error instanceof functions.https.HttpsError) throw error;
        throw new functions.https.HttpsError("internal", "Erro ao verificar o tenant alvo.", error.message);
      }

      // 4. Gerar o Token Customizado
      try {
        console.log(`Generating custom token for Super Admin ${superAdminUid} with claims { tenant_id: ${targetTenantId}, support_mode: true }`);
        const additionalClaims = { tenant_id: targetTenantId, support_mode: true };
        const customToken = await admin.auth().createCustomToken(superAdminUid, additionalClaims);
        console.log(`Custom token generated successfully for tenant ${targetTenantId}.`);
        return { success: true, customToken: customToken };

      } catch (error: any) {
        console.error(`Error generating custom token for Super Admin ${superAdminUid} and tenant ${targetTenantId}:`, error);
        throw new functions.https.HttpsError(
          "internal",
          "Erro ao gerar o token de acesso de suporte.",
          error.message
        );
      }
    } // Fim async (request)
  ); // Fim onCall

// Certifique-se de que este é o final do arquivo

// Constantes para claims (boa prática)
const CLAIMS_TENANT_ID = 'tenant_id'; // Usando o mesmo que nas regras
const CLAIMS_PERFIL_ID = 'perfilId';
const CLAIMS_IS_COLLABORATOR = 'isCollaborator';
const CLAIMS_IS_ADMIN = 'isAdmin'; // Claim do Tenant Admin


// --- Função de Trigger Firestore (v1 - usando functionsV1) ---

// ... (constantes CLAIMS) ...

export const onCreateColaborador = functionsV1 // <--- Usa alias v1
    .region('us-central1') // <--- Define região para esta função v1
    .firestore
    .document('colaboradores/{colaboradorId}')
    .onCreate(async (snap: functionsV1.firestore.QueryDocumentSnapshot, context: functionsV1.EventContext) => { // <--- Usa tipos v1
        const newColaboradorData = snap.data();
        const colaboradorId = context.params.colaboradorId;

        if (!newColaboradorData || !newColaboradorData.email || !newColaboradorData.tenantId || !newColaboradorData.perfilId) {
            console.error(`[onCreateColaborador:${colaboradorId}] Faltando dados essenciais.`);
            return null;
        }
        const email = newColaboradorData.email;
        const tenantId = newColaboradorData.tenantId;
        const perfilId = newColaboradorData.perfilId;
        const nomeColaborador = newColaboradorData.nome || 'Novo Colaborador'; // Usa nome ou fallback

        console.log(`[onCreateColaborador:${colaboradorId}] Iniciando para ${email}`);

        let authUid: string | null = null; // Para armazenar o UID criado

        try {
            // 1. Criar usuário no Firebase Authentication
            const userRecord = await auth.createUser({
                email: email,
                emailVerified: false,
                displayName: nomeColaborador, // Adicionado displayName
                disabled: false
            });
            authUid = userRecord.uid;
            console.log(`[onCreateColaborador:${colaboradorId}] Usuário Auth ${authUid} criado para ${email}`);

            // 2. Definir Custom Claims
            const customClaims = {
                [CLAIMS_TENANT_ID_V1]: tenantId,
                [CLAIMS_PERFIL_ID_V1]: perfilId,
                [CLAIMS_IS_COLLABORATOR_V1]: true,
                [CLAIMS_IS_ADMIN_V1]: false
            };
            await auth.setCustomUserClaims(authUid, customClaims);
            console.log(`[onCreateColaborador:${colaboradorId}] Claims definidas para ${authUid}`);

            // 3. Atualizar documento no Firestore com o authUid e status 'pendente'
            await snap.ref.update({
                authUid: authUid,
                status: 'pendente' // Aguardando definição de senha
            });
            console.log(`[onCreateColaborador:${colaboradorId}] Documento Firestore atualizado com authUid.`);

            // --- PASSO 4: Disparar Extensão Trigger Email ---
            try {
                // 4.1 Gerar link de definição de senha
                // A URL de continuação é configurada no Console do Firebase
                const passwordSetupLink = await auth.generatePasswordResetLink(email); 
                console.log(`[onCreateColaborador:${colaboradorId}] Link de definição de senha gerado para ${email}.`);

                // 4.2 Criar documento na coleção 'mail' para a extensão
                const mailDoc = {
                    to: [email], // Destinatário
                    template: {
                        name: 'welcomeCollaborator', // Nome EXATO do template criado no Firestore
                        data: { // Dados para popular o template
                            name: nomeColaborador,
                            passwordSetupLink: passwordSetupLink, // O link gerado
                        },
                    },
                };

                await db.collection('mail').add(mailDoc); // Assume que a coleção é 'mail'
                console.log(`[onCreateColaborador:${colaboradorId}] Documento criado na coleção 'mail' para disparar email para ${email}.`);

            } catch (emailError: any) {
                console.error(`[onCreateColaborador:${colaboradorId}] Erro ao gerar link ou criar doc 'mail' para ${email}:`, emailError);
                await snap.ref.update({ status: 'erro_envio_email' }).catch(err => console.error("Update status error:", err));
            }
            // --- FIM PASSO 4 ---

            return null; // Sucesso geral da função

        } catch (error: any) {
            console.error(`[onCreateColaborador:${colaboradorId}] Erro geral ao processar ${email}:`, error);

            // Limpeza/Tratamento de erro principal
            if (error.code === 'auth/email-already-exists') {
                console.warn(`[onCreateColaborador:${colaboradorId}] Email ${email} já existe no Firebase Auth.`);
                await snap.ref.update({ status: 'erro_email_existente', authUid: error.uid || authUid || null }).catch(err => console.error("Update status error:", err));
            } else {
                await snap.ref.update({ status: 'erro_criacao_auth' }).catch(err => console.error("Update status error:", err));
                if (authUid) {
                     console.log(`[onCreateColaborador:${colaboradorId}] Tentando deletar usuário Auth ${authUid} devido a erro subsequente.`);
                     await auth.deleteUser(authUid).catch(delErr => console.error(`Falha ao deletar usuário Auth ${authUid} na limpeza:`, delErr));
                }
            }
            return null; // Indica que a função terminou (com erro tratado)
        }
    }); // Fim onCreateColaborador

// Certifique-se de que este é o final do arquivo