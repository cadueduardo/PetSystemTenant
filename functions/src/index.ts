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
// import * as functions from "firebase-functions"; // <<< Remover import v1
import * as admin from "firebase-admin";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { setGlobalOptions } from "firebase-functions/v2"; // Para definir a região global
// import { CallableContext } from "firebase-functions/v1/https"; // <<< Remover v1
import { randomBytes } from "crypto"; // For temporary password

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

// <<< Definir Opções Globais (Região) >>>
setGlobalOptions({ region: 'southamerica-east1' });

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
export const createTenantAndAdmin = onCall(async (request) => {
  // Optional: Check if the caller is authenticated
  if (!request.auth) { // <<< Usar request.auth
    throw new HttpsError("unauthenticated", "User must be logged in.");
  }
  // Optional: Check if the caller has super admin privileges
  // if (request.auth.token.role !== 'superAdmin') { // <<< Usar request.auth
  //    throw new HttpsError("permission-denied", "User does not have permission.");
  // }

  // <<< Acessar dados via request.data >>>
  const data: CreateTenantData = request.data;

  console.log("Received tenant creation request for:", data.company_name);

  // --- 1. Validate Input Data ---
  if (!data.company_name || !data.adminEmail /*|| !data.plan || !data.modules*/) { // Adjust required fields as needed
    console.error("Validation failed: Missing required fields.", data);
    throw new HttpsError("invalid-argument", "Nome da Empresa e Email do Admin são obrigatórios.");
  }
  // Basic email format check (can be more robust)
  if (!/\S+@\S+\.\S+/.test(data.adminEmail)) {
     console.error("Validation failed: Invalid admin email format.");
     throw new HttpsError("invalid-argument", "Formato do email do administrador inválido.");
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
             throw new HttpsError('already-exists', `O email ${adminEmail} já está em uso por outro administrador.`);
        }
        throw new HttpsError('internal', "Falha ao criar o usuário administrador.", authError.message);
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

    // --- 7. Send Welcome Email with Reset Link ---
    console.log("=============================================================");
    console.log("TODO: IMPLEMENTAR ENVIO DE EMAIL AQUI");
    console.log("=============================================================");
    console.log(`   Destinatário: ${adminEmail}`);
    console.log(`   Assunto: Configure sua senha de acesso ao PetGestor`);
    console.log(`   Link (para teste): ${resetLink}`);
    console.log("=============================================================");
    // Você precisará usar uma extensão como Trigger Email ou um serviço externo.
    // Exemplo (Trigger Email): 
    // await db.collection('mail').add({
    //   to: adminEmail,
    //   template: {
    //     name: 'welcomeTenantAdmin', // Nome do template no Firestore/Handlebars
    //     data: {
    //       displayName: newUser.displayName || 'Administrador',
    //       companyName: company_name,
    //       resetLink: resetLink,
    //     },
    //   },
    // });

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
    if (error instanceof HttpsError) {
        throw error; // Re-throw HttpsError directly
    }

    throw new HttpsError("internal", "Ocorreu um erro inesperado ao criar a loja.", error.message);
  }
});
