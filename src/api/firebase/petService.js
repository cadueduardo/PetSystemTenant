import { db } from '@/lib/firebaseConfig';
import { collection, query, where, getDocs, addDoc, doc, getDoc } from "firebase/firestore";

/**
 * Busca pets no Firestore, filtrando por tenant_id e/ou owner_id.
 * @param {object} filters - Objeto com os filtros (ex: { tenant_id: '...', owner_id: '...' }).
 * @returns {Promise<Array<object>>} - Array com os pets encontrados.
 */
async function filter(filters = {}) {
  console.log('[Firestore] Filtrando Pets com:', filters);
  try {
    const petsCollectionRef = collection(db, "pets");
    
    // Array para armazenar as condições 'where'
    const constraints = [];

    // Adiciona filtro por tenant_id se presente
    if (filters.tenant_id) {
      console.log(`[Firestore] Aplicando filtro tenant_id == ${filters.tenant_id}`);
      constraints.push(where("tenant_id", "==", filters.tenant_id));
    } else {
      // Considerar lançar erro ou logar se tenant_id for sempre obrigatório
      console.warn('[Firestore] Buscando pets sem especificar tenant_id. Isso pode não ser o ideal.');
    }

    // Adiciona filtro por owner_id se presente
    if (filters.owner_id) {
      console.log(`[Firestore] Aplicando filtro owner_id == ${filters.owner_id}`);
      constraints.push(where("owner_id", "==", filters.owner_id));
    }

    // Monta a query final com todas as constraints
    // IMPORTANTE: Uma query com múltiplos 'where' em campos diferentes EXIGE um índice composto.
    const q = query(petsCollectionRef, ...constraints);

    const querySnapshot = await getDocs(q);
    const pets = [];
    querySnapshot.forEach((doc) => {
      pets.push({ id: doc.id, ...doc.data() });
    });

    console.log(`[Firestore] Pets encontrados (${pets.length}):`, pets);
    return pets;

  } catch (error) {
    console.error("[Firestore] Erro ao filtrar Pets:", error);
    if (error.code === 'failed-precondition') {
       console.error("*************************************************************************");
       console.error("ERRO FIREBASE: Provavelmente falta um ÍNDICE COMPOSTO no Firestore!");
       console.error("A consulta em 'pets' com filtros em 'tenant_id' e 'owner_id' (ou outros) exige um índice.");
       console.error("Verifique o console do navegador pelo link para criar o índice ou vá ao console do Firebase -> Firestore Database -> Índices.");
       console.error("Filtros aplicados:", filters);
       console.error("*************************************************************************");
       throw new Error('Erro de configuração do Firestore (índice composto ausente?). Verifique o console.');
    }
    throw new Error('Erro ao buscar pets no banco de dados.');
  }
}

/**
 * Cria um novo pet no Firestore.
 * @param {object} petData - Os dados do pet a serem salvos.
 * @returns {Promise<object>} - O objeto do pet recém-criado (incluindo o ID gerado).
 */
async function create(petData) {
  console.log('[Firestore] Criando Pet com:', petData);
  try {
    // Garante que campos essenciais estão presentes
    if (!petData.tenant_id || !petData.owner_id || !petData.name) {
      console.error("[Firestore] Erro: Tentativa de criar Pet sem tenant_id, owner_id ou name", petData);
      throw new Error('Dados insuficientes para criar o pet (tenant_id, owner_id, name são obrigatórios).');
    }
    // Opcional: Validar outros campos importantes (species, etc.)

    const petsCollectionRef = collection(db, "pets");
    const docRef = await addDoc(petsCollectionRef, petData); 
    
    console.log("[Firestore] Pet criado com ID:", docRef.id);
    return { id: docRef.id, ...petData };

  } catch (error) {
    console.error("[Firestore] Erro ao criar Pet:", error);
    // Lembre-se das regras de segurança do Firestore para escrita!
    if (error.code === 'permission-denied') {
        console.error("*************************************************************************");
        console.error("ERRO FIREBASE: Permissão negada ao criar Pet no Firestore!");
        console.error("Verifique as Regras de Segurança do Firestore. A regra atual para /pets/{petId} permite escrita? (Ex: allow write: if true; ou if request.auth != null;)");
        console.error("*************************************************************************");
        throw new Error('Permissão negada ao salvar pet no banco de dados. Verifique as regras.');
    }
    throw new Error('Erro ao salvar pet no banco de dados.');
  }
}

/**
 * Busca um pet específico no Firestore pelo ID.
 * @param {string} id - O ID do pet a ser buscado.
 * @returns {Promise<object|null>} - Os dados do pet ou null se não encontrado.
 */
async function get(id) {
  console.log(`[Firestore] Buscando Pet ID: ${id}`);
  try {
    const docRef = doc(db, "pets", id); 
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      console.log("[Firestore] Pet encontrado:", { id: docSnap.id, ...docSnap.data() });
      return { id: docSnap.id, ...docSnap.data() }; 
    } else {
      console.warn(`[Firestore] Pet com ID ${id} não encontrado.`);
      return null; 
    }
  } catch (error) {
    console.error("[Firestore] Erro ao buscar Pet:", error);
    throw new Error('Erro ao buscar pet no banco de dados.'); 
  }
}

// Exporta as funções
export const petService = {
  get,
  filter,
  create,
  // Adicionaremos update, delete aqui depois
}; 