import { db } from '@/lib/firebaseConfig';
import { collection, addDoc, serverTimestamp } from "firebase/firestore";

/**
 * Cria um novo registro no prontuário (medical record) no Firestore.
 * @param {object} recordData - Os dados do registro a serem salvos.
 *                             (Ex: { tenant_id, pet_id, record_date, type, description, related_appointment_id })
 * @returns {Promise<object>} - O objeto do registro recém-criado (incluindo o ID gerado).
 */
async function create(recordData) {
  console.log('[Firestore] Criando MedicalRecord com:', recordData);
  try {
    // Validações básicas
    if (!recordData.tenant_id || !recordData.pet_id || !recordData.type || !recordData.description) {
      console.error("[Firestore] Erro: Tentativa de criar MedicalRecord sem campos essenciais", recordData);
      throw new Error('Dados insuficientes para criar o registro no prontuário.');
    }

    const recordsCollectionRef = collection(db, "medicalRecords"); // Define o nome da coleção
    const dataToSave = {
      ...recordData,
      // Garante que record_date seja um timestamp, usando o atual se não fornecido
      record_date: recordData.record_date ? recordData.record_date : serverTimestamp(), 
      created_at: serverTimestamp() // Timestamp de criação do documento
    };

    const docRef = await addDoc(recordsCollectionRef, dataToSave);

    console.log("[Firestore] MedicalRecord criado com ID:", docRef.id);
    return { id: docRef.id, ...recordData }; // Retorna ID e dados originais

  } catch (error) {
    console.error("[Firestore] Erro ao criar MedicalRecord:", error);
    if (error.code === 'permission-denied') {
        console.error("*************************************************************************");
        console.error("ERRO FIREBASE: Permissão negada ao criar MedicalRecord no Firestore!");
        console.error("Verifique as Regras de Segurança do Firestore para /medicalRecords/{recordId}.");
        console.error("*************************************************************************");
        throw new Error('Permissão negada ao salvar registro no prontuário. Verifique as regras.');
    }
    throw new Error('Erro ao salvar registro no prontuário.');
  }
}

// Exporta as funções como um objeto de serviço
export const medicalRecordService = {
  create,
  // filter, get, update, delete podem ser adicionados depois se necessário
}; 