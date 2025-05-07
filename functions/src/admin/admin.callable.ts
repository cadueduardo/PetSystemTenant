import { https } from "firebase-functions/v2";
import * as logger from "firebase-functions/logger";
import { admin } from "../config/firebase";
import { CODE_VERSION, REGION } from "../config/constants";

export const listSuperAdmins = https.onCall(
  {
    region: REGION,
    cors: ["http://localhost:5173", "https://petfacil.app"],
  },
  async (request: https.CallableRequest) => {
    logger.info(`[listSuperAdmins / AdminCallable / v: ${CODE_VERSION}] Function called.`);

    if (!request.auth || request.auth.token.tenant_id) {
      logger.error(`[listSuperAdmins / AdminCallable] Permission denied. Caller ${request.auth?.uid} is not a Super Admin or is unauthenticated.`);
      throw new https.HttpsError("permission-denied", "Apenas Super Administradores podem listar usuários.");
    }
    logger.info(`[listSuperAdmins / AdminCallable] Caller ${request.auth.uid} verified as Super Admin.`);

    try {
      const listUsersResult = await admin.auth().listUsers(1000);

      const superAdmins = listUsersResult.users
        .filter(user => !user.customClaims?.tenant_id)
        .map(user => ({
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          creationTime: user.metadata.creationTime,
          lastSignInTime: user.metadata.lastSignInTime,
        }));

      logger.info(`[listSuperAdmins / AdminCallable] Found ${superAdmins.length} super admins.`);
      return {
        admins: superAdmins,
      };

    } catch (error: any) {
      logger.error("[listSuperAdmins / AdminCallable] Error listing super admins:", error);
      if (error instanceof https.HttpsError) {
        throw error;
      }
      throw new https.HttpsError("internal", "Erro interno ao listar super administradores.", error.message);
    }
  });

export const createSuperAdmin = https.onCall(
  {
    region: REGION,
    cors: ["http://localhost:5173", "https://petfacil.app"]
  },
  async (request: https.CallableRequest) => {
    logger.info(`[createSuperAdmin / AdminCallable / v: ${CODE_VERSION}] Function called.`);
    if (!request.auth || request.auth.token.tenant_id) {
      throw new https.HttpsError("permission-denied", "Apenas Super Administradores podem criar usuários.");
    }
    // TODO: Implement logic
    logger.warn("[createSuperAdmin / AdminCallable] Function not implemented.");
    throw new https.HttpsError("unimplemented", "Função não implementada.");
});

export const deleteSuperAdmin = https.onCall(
  {
    region: REGION,
    cors: ["http://localhost:5173", "https://petfacil.app"]
  },
  async (request: https.CallableRequest) => {
     logger.info(`[deleteSuperAdmin / AdminCallable / v: ${CODE_VERSION}] Function called.`);
     if (!request.auth || request.auth.token.tenant_id) {
       throw new https.HttpsError("permission-denied", "Apenas Super Administradores podem deletar usuários.");
     }
     // TODO: Implement logic
     logger.warn("[deleteSuperAdmin / AdminCallable] Function not implemented.");
    throw new https.HttpsError("unimplemented", "Função não implementada.");
}); 