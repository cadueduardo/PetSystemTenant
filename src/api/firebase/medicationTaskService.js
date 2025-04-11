import { db } from '@/lib/firebaseConfig';
import { collection, addDoc, doc, updateDoc, query, where, getDocs, serverTimestamp, getDoc } from "firebase/firestore";

/**
 * Cria uma nova tarefa de medicação no Firestore.
 * @param {object} taskData - Os dados da tarefa a serem salvos.
 * @returns {Promise<object>} - O objeto da tarefa recém-criada (incluindo o ID gerado).
 */
async function create(taskData) {
  console.log('[Firestore] Criando MedicationTask com:', taskData);
  try {
    // Validações básicas (adapte conforme necessário)
    if (!taskData.tenant_id || !taskData.pet_id || !taskData.medication_name) {
      console.error("[Firestore] Erro: Tentativa de criar MedicationTask sem tenant_id, pet_id ou medication_name", taskData);
      throw new Error('Dados insuficientes para criar a tarefa de medicação.');
    }

    const tasksCollectionRef = collection(db, "medicationTasks");
    const dataToSave = {
      ...taskData,
      created_at: serverTimestamp(), // Adiciona timestamp de criação
      updated_at: serverTimestamp()  // Adiciona timestamp de atualização inicial
    };

    const docRef = await addDoc(tasksCollectionRef, dataToSave);

    console.log("[Firestore] MedicationTask criada com ID:", docRef.id);
    // Retorna o ID junto com os dados originais (sem timestamps do servidor ainda)
    // Se precisar dos timestamps, teria que fazer um getDoc(docRef) depois
    return { id: docRef.id, ...taskData };

  } catch (error) {
    console.error("[Firestore] Erro ao criar MedicationTask:", error);
    if (error.code === 'permission-denied') {
        console.error("*************************************************************************");
        console.error("ERRO FIREBASE: Permissão negada ao criar MedicationTask no Firestore!");
        console.error("Verifique as Regras de Segurança do Firestore para /medicationTasks/{taskId}.");
        console.error("*************************************************************************");
        throw new Error('Permissão negada ao salvar tarefa de medicação. Verifique as regras.');
    }
    throw new Error('Erro ao salvar tarefa de medicação no banco de dados.');
  }
}

/**
 * Atualiza uma tarefa de medicação existente no Firestore.
 * @param {string} id - O ID da tarefa a ser atualizada.
 * @param {object} dataToUpdate - Objeto com os campos a serem atualizados.
 * @returns {Promise<void>}
 */
async function update(id, dataToUpdate) {
  console.log(`[Firestore] Atualizando MedicationTask ID: ${id} com dados:`, dataToUpdate);
  try {
    const taskDocRef = doc(db, "medicationTasks", id);

    if (!id) {
      console.error("[Firestore] Erro: Tentativa de atualizar MedicationTask sem ID.");
      throw new Error("ID da tarefa é obrigatório para atualização.");
    }

    // eslint-disable-next-line no-unused-vars
    const { id: _, ...updateData } = dataToUpdate;
    updateData.updated_at = serverTimestamp(); // Atualiza o timestamp de modificação

    await updateDoc(taskDocRef, updateData);
    console.log(`[Firestore] MedicationTask ID: ${id} atualizada com sucesso.`);

  } catch (error) {
    console.error(`[Firestore] Erro ao atualizar MedicationTask ID: ${id}:`, error);
    if (error.code === 'permission-denied') {
        console.error("*************************************************************************");
        console.error("ERRO FIREBASE: Permissão negada ao atualizar MedicationTask no Firestore!");
        console.error("Verifique as Regras de Segurança do Firestore para /medicationTasks/{taskId}.");
        console.error("*************************************************************************");
        throw new Error('Permissão negada ao atualizar tarefa de medicação. Verifique as regras.');
    } else if (error.code === 'not-found') {
         console.warn(`[Firestore] Tentativa de atualizar MedicationTask ID: ${id} que não foi encontrada.`);
         throw new Error('Tarefa de medicação não encontrada para atualização.');
    }
    throw new Error('Erro ao atualizar tarefa de medicação no banco de dados.');
  }
}

/**
 * Busca tarefas de medicação no Firestore com base em filtros.
 * @param {object} filters - Objeto com os filtros (ex: { tenant_id: '...', pet_id: '...', status: '...' }).
 * @returns {Promise<Array<object>>} - Array com as tarefas encontradas.
 */
async function filter(filters = {}) {
  console.log('[Firestore] Filtrando MedicationTasks com:', filters);
  try {
    const tasksCollectionRef = collection(db, "medicationTasks");
    const constraints = [];

    if (filters.tenant_id) {
      constraints.push(where("tenant_id", "==", filters.tenant_id));
    } else {
      console.warn('[Firestore] Buscando MedicationTasks sem especificar tenant_id.');
       // Pode ser necessário lançar um erro se tenant_id for obrigatório
    }
    if (filters.pet_id) {
      constraints.push(where("pet_id", "==", filters.pet_id));
    }
    if (filters.status) {
      // Se o status for um array, usa 'in'
      if (Array.isArray(filters.status) && filters.status.length > 0) {
          // Consultas 'in' com mais de 10 elementos podem ter problemas de performance ou limites
          if (filters.status.length <= 10) {
              constraints.push(where("status", "in", filters.status));
          } else {
              console.warn("[Firestore] Filtro 'in' para status com mais de 10 valores. Isso pode não funcionar ou ser ineficiente.");
              // Alternativa: Múltiplas queries ou buscar tudo e filtrar no cliente (menos ideal)
          }
      } else if (typeof filters.status === 'string') {
          constraints.push(where("status", "==", filters.status));
      }
    }
     if (filters.appointment_id) {
      constraints.push(where("appointment_id", "==", filters.appointment_id));
    }

    const q = query(tasksCollectionRef, ...constraints);
    // Lembre-se dos índices compostos se usar múltiplos 'where' diferentes!

    const querySnapshot = await getDocs(q);
    const tasks = [];
    querySnapshot.forEach((doc) => {
      tasks.push({ id: doc.id, ...doc.data() });
    });

    console.log(`[Firestore] MedicationTasks encontradas (${tasks.length}).`);
    return tasks;

  } catch (error) {
    console.error("[Firestore] Erro ao filtrar MedicationTasks:", error);
     if (error.code === 'failed-precondition') {
       console.error("*************************************************************************");
       console.error("ERRO FIREBASE: Provavelmente falta um ÍNDICE COMPOSTO no Firestore!");
       console.error("Verifique a necessidade de índices para a coleção 'medicationTasks' com os filtros usados.");
        console.error("Filtros aplicados:", filters);
       console.error("*************************************************************************");
       throw new Error('Erro de configuração do Firestore (índice composto ausente?). Verifique o console.');
    }
    throw new Error('Erro ao buscar tarefas de medicação.');
  }
}

/**
 * Busca uma tarefa de medicação específica no Firestore pelo ID.
 * @param {string} id - O ID da tarefa a ser buscada.
 * @returns {Promise<object|null>} - Os dados da tarefa ou null se não encontrada.
 */
async function get(id) {
  console.log(`[Firestore] Buscando MedicationTask ID: ${id}`);
  try {
    const taskDocRef = doc(db, "medicationTasks", id);
    const docSnap = await getDoc(taskDocRef);

    if (docSnap.exists()) {
      const taskData = { id: docSnap.id, ...docSnap.data() };
      console.log("[Firestore] MedicationTask encontrada:", taskData);
      return taskData;
    } else {
      console.warn(`[Firestore] MedicationTask com ID ${id} não encontrada.`);
      return null;
    }
  } catch (error) {
    console.error(`[Firestore] Erro ao buscar MedicationTask ID: ${id}:`, error);
    throw new Error('Erro ao buscar tarefa de medicação no banco de dados.');
  }
}

// Exporta as funções como um objeto de serviço
export const medicationTaskService = {
  create,
  update,
  filter,
  get,
  // delete pode ser adicionado depois se necessário
}; 