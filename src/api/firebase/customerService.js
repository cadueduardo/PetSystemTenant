import { db } from '@/lib/firebaseConfig'; // Importa a instância do Firestore
import { doc, getDoc, collection, query, where, getDocs, addDoc, updateDoc } from "firebase/firestore";

/**
 * Busca um cliente específico no Firestore pelo ID.
 * @param {string} id - O ID do cliente a ser buscado.
 * @returns {Promise<object|null>} - Os dados do cliente ou null se não encontrado.
 */
async function get(id) {
  console.log(`[Firestore] Buscando Customer ID: ${id}`);
  try {
    const docRef = doc(db, "customers", id); // Referência ao documento do cliente
    const docSnap = await getDoc(docRef); // Busca o documento

    if (docSnap.exists()) {
      console.log("[Firestore] Customer encontrado:", { id: docSnap.id, ...docSnap.data() });
      // Retorna os dados do documento incluindo o ID
      return { id: docSnap.id, ...docSnap.data() }; 
    } else {
      console.warn(`[Firestore] Customer com ID ${id} não encontrado.`);
      // Lança um erro ou retorna null? Por ora, retornando null para diferenciar de erro na busca.
      // Poderíamos lançar: throw new Error('Cliente não encontrado');
      return null; 
    }
  } catch (error) {
    console.error("[Firestore] Erro ao buscar Customer:", error);
    // Propaga o erro para que a UI possa lidar com ele (ex: mostrar toast)
    throw new Error('Erro ao buscar cliente no banco de dados.'); 
  }
}

/**
 * Busca clientes no Firestore, opcionalmente filtrando.
 * @param {object} filters - Objeto com os filtros (ex: { tenant_id: '...' }).
 * @returns {Promise<Array<object>>} - Array com os clientes encontrados.
 */
async function filter(filters = {}) {
  console.log('[Firestore] Filtrando Customers com:', filters);
  try {
    const customersCollectionRef = collection(db, "customers");
    let q = query(customersCollectionRef); // Query inicial (todos os clientes)

    // Aplica filtros (exemplo com tenant_id)
    if (filters.tenant_id) {
      console.log(`[Firestore] Aplicando filtro tenant_id == ${filters.tenant_id}`);
      // Adiciona a condição 'where' à query
      // IMPORTANTE: O Firestore pode exigir a criação de um índice para esta query
      // Veja o erro no console do navegador se ocorrer.
      q = query(customersCollectionRef, where("tenant_id", "==", filters.tenant_id));
    }
    
    // Adicionar outros filtros aqui se necessário (ex: where("name", "==", filters.name))
    // Cuidado com queries complexas que exigem índices compostos.

    const querySnapshot = await getDocs(q);
    const customers = [];
    querySnapshot.forEach((doc) => {
      customers.push({ id: doc.id, ...doc.data() });
    });
    
    console.log(`[Firestore] Customers encontrados (${customers.length}):`, customers);
    return customers;

  } catch (error) {
    console.error("[Firestore] Erro ao filtrar Customers:", error);
    // Verifica se é erro de índice ausente (exemplo, pode variar)
    if (error.code === 'failed-precondition') {
       console.error("*************************************************************************");
       console.error("ERRO FIREBASE: Provavelmente falta um índice composto no Firestore!");
       console.error("Verifique o console do navegador ou a documentação do Firebase.");
       console.error("Para criar o índice, acesse o link que pode aparecer no erro ou vá ao console do Firebase -> Firestore Database -> Índices.");
       console.error("Filtros aplicados:", filters);
       console.error("*************************************************************************");
       throw new Error('Erro de configuração do Firestore (índice ausente?). Verifique o console.');
    }
    throw new Error('Erro ao buscar clientes no banco de dados.');
  }
}

/**
 * Cria um novo cliente no Firestore.
 * @param {object} customerData - Os dados do cliente a serem salvos.
 * @returns {Promise<object>} - O objeto do cliente recém-criado (incluindo o ID gerado).
 */
async function create(customerData) {
  console.log('[Firestore] Criando Customer com:', customerData);
  try {
    // Garante que tenant_id está presente (essencial para regras futuras)
    if (!customerData.tenant_id) {
      console.error("[Firestore] Erro: Tentativa de criar Customer sem tenant_id", customerData);
      throw new Error('O tenant_id é obrigatório para criar um cliente.');
    }

    const customersCollectionRef = collection(db, "customers");
    const docRef = await addDoc(customersCollectionRef, customerData); // Adiciona o documento
    
    console.log("[Firestore] Customer criado com ID:", docRef.id);
    // Retorna os dados originais junto com o ID gerado
    return { id: docRef.id, ...customerData };

  } catch (error) {
    console.error("[Firestore] Erro ao criar Customer:", error);
    throw new Error('Erro ao salvar cliente no banco de dados.');
  }
}

/**
 * Atualiza um cliente existente no Firestore.
 * @param {string} id - O ID do cliente a ser atualizado.
 * @param {object} customerData - Os dados a serem atualizados.
 * @returns {Promise<void>} - Retorna nada em caso de sucesso.
 */
async function update(id, customerData) {
  console.log(`[Firestore] Atualizando Customer ID: ${id} com:`, customerData);
  try {
    // Não permite atualizar o tenant_id ou owner_id se eles existirem, por segurança
    // (Descomente/ajuste se precisar permitir)
    /*
    if (customerData.tenant_id || customerData.owner_id) {
      console.warn("[Firestore] Tentativa de atualizar tenant_id/owner_id via update. Removendo esses campos.");
      delete customerData.tenant_id;
      delete customerData.owner_id;
    }
    */
   
    const docRef = doc(db, "customers", id);
    await updateDoc(docRef, customerData); // Atualiza apenas os campos fornecidos
    
    console.log(`[Firestore] Customer ID: ${id} atualizado com sucesso.`);

  } catch (error) {
    console.error(`[Firestore] Erro ao atualizar Customer ID: ${id}:`, error);
    if (error.code === 'permission-denied') {
        console.error("ERRO FIREBASE: Permissão negada ao atualizar Customer no Firestore! Verifique as regras de segurança.");
        throw new Error('Permissão negada ao atualizar cliente. Verifique as regras.');
    }
    // Tratar erro 'not-found' se necessário (updateDoc falha se doc não existe)
    if (error.code === 'not-found') {
         console.error(`ERRO FIREBASE: Cliente com ID ${id} não encontrado para atualização.`);
         throw new Error('Cliente não encontrado para atualização.');
    }
    throw new Error('Erro ao atualizar cliente no banco de dados.');
  }
}

// Exporta a função (ou um objeto com todas as funções CRUD)
export const customerService = {
  get,
  filter,
  create,
  update,
  // Adicionaremos delete aqui depois
}; 