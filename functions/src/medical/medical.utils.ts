import * as logger from "firebase-functions/logger";
import { adminFirestore, db, admin } from "../config/firebase";
import { generateFormattedId } from "../utils/generators.utils";

// Helper for Prontuário ID generation
export async function getOrCreateProntuario(
  tenantId: string,
  petId: string,
  tutorId: string
): Promise<admin.firestore.DocumentReference> {
  logger.info(`[getOrCreateProntuario / MedicalUtils] Buscando prontuário para Tenant: ${tenantId}, Pet: ${petId}`);
  const prontuariosRef = db.collection(`tenants/${tenantId}/prontuarios`);
  const snapshot = await prontuariosRef.where("petId", "==", petId).limit(1).get();

  if (!snapshot.empty) {
    const prontuarioDoc = snapshot.docs[0];
    logger.info(`[getOrCreateProntuario / MedicalUtils] Prontuário encontrado: ${prontuarioDoc.id} para Pet ${petId}.`);
    try {
        const petCollectionPath = `tenants/${tenantId}/pets`;
        const petRef = db.collection(petCollectionPath).doc(petId);
        const petSnap = await petRef.get();
        if (petSnap.exists && petSnap.data()?.prontuarioId !== prontuarioDoc.id) {
            logger.warn(`[getOrCreateProntuario / MedicalUtils] Pet ${petId} tem prontuarioId ${petSnap.data()?.prontuarioId}, mas prontuário encontrado é ${prontuarioDoc.id}. Atualizando pet.`);
            await petRef.update({ prontuarioId: prontuarioDoc.id });
        }
    } catch (petAccessError) {
         logger.error(`[getOrCreateProntuario / MedicalUtils] Erro ao verificar/atualizar pet ${petId} com prontuário ${prontuarioDoc.id}:`, petAccessError);
    }
    return prontuarioDoc.ref;
  } else {
    logger.info(`[getOrCreateProntuario / MedicalUtils] Prontuário NÃO encontrado para Pet ${petId}. Criando novo...`);
    const prontuarioId = generateFormattedId('PT');
    const prontuarioRef = prontuariosRef.doc(prontuarioId);

    await prontuarioRef.set({
      id: prontuarioId,
      tenantId,
      petId,
      tutorId,
      createdAt: adminFirestore.FieldValue.serverTimestamp(),
    });
    logger.info(`[getOrCreateProntuario / MedicalUtils] Novo prontuário criado com ID: ${prontuarioId}`);

    try {
        const petCollectionPath = `tenants/${tenantId}/pets`;
        const petRef = db.collection(petCollectionPath).doc(petId);
        logger.info(`[getOrCreateProntuario / MedicalUtils] Updating pet ${petId} in collection ${petCollectionPath} with new prontuarioId ${prontuarioId}.`);
        await petRef.set({ prontuarioId: prontuarioId }, { merge: true });
    } catch (petUpdateError) {
        logger.error(`[getOrCreateProntuario / MedicalUtils] Error updating pet ${petId} with new prontuarioId ${prontuarioId}:`, petUpdateError);
    }
    return prontuarioRef;
  }
}

// Helper for Episode ID generation
export async function createEpisode(
  prontuarioId: string,
  appointmentId: string,
  data: { tenantId: string; petId: string; tutorId: string; serviceId: string; serviceName: string; module: string; professionalId: string; professionalName: string; specialtyId: string | null }
): Promise<string> {
  logger.info(`[createEpisode / MedicalUtils] Creating episode for prontuario ${prontuarioId}, appointment ${appointmentId}`);
  const episodesRef = db.collection(
    `tenants/${data.tenantId}/prontuarios/${prontuarioId}/episodes`
  );
  const episodeId = generateFormattedId('EP');

  await episodesRef.doc(episodeId).set({
    id: episodeId,
    appointmentId,
    prontuarioId: prontuarioId,
    episodeNumber: episodeId,
    tenantId: data.tenantId,
    petId: data.petId,
    tutorId: data.tutorId,
    serviceId: data.serviceId,
    serviceName: data.serviceName,
    module: data.module,
    professionalId: data.professionalId,
    professionalName: data.professionalName,
    specialtyId: data.specialtyId,
    checkinTime: adminFirestore.FieldValue.serverTimestamp(),
    createdAt: adminFirestore.FieldValue.serverTimestamp(),
    updatedAt: adminFirestore.FieldValue.serverTimestamp(),
    status: 'in_progress',
  });
  logger.info(`[createEpisode / MedicalUtils] Created episode ${episodeId} for prontuario ${prontuarioId}`);
  return episodeId;
} 