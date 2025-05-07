import { db } from '@/lib/firebaseConfig';
import { collection, query, where, getDocs, addDoc, doc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore";

/**
 * Busca pets no Firestore para o tenant atual, opcionalmente filtrando por owner_id.
 * @param {string} [ownerId] - O ID do cliente (opcional) para filtrar pets.
 * @returns {Promise<Array<object>>} - Array com os pets encontrados.
 */
async function filter(ownerId) {
  const tenantId = localStorage.getItem('current_tenant');
  if (!tenantId) {
    console.error("[Firestore] Erro: Tenant ID não encontrado no localStorage para filtrar Pets.");
    throw new Error('Tenant não identificado. Faça login novamente.');
  }
  console.log(`[Firestore] Filtrando Pets para Tenant ID: ${tenantId}` + (ownerId ? ` e Owner ID: ${ownerId}` : ''));

  try {
    const petsCollectionRef = collection(db, "tenants", tenantId, "pets");

    const constraints = [];

    if (ownerId) {
      console.log(`[Firestore] Aplicando filtro owner_id == ${ownerId}`);
      constraints.push(where("owner_id", "==", ownerId));
    } else {
       console.log("[Firestore] Listando todos os pets do tenant (sem filtro de owner).");
    }

    const q = constraints.length > 0 ? query(petsCollectionRef, ...constraints) : petsCollectionRef;

    const querySnapshot = await getDocs(q);
    const pets = [];
    querySnapshot.forEach((doc) => {
      pets.push({ id: doc.id, ...doc.data() });
    });

    console.log(`[Firestore] Pets encontrados (${pets.length}) para Tenant ID ${tenantId}` + (ownerId ? ` com Owner ID ${ownerId}` : '') + ":", pets);
    return pets;

  } catch (error) {
    console.error("[Firestore] Erro ao filtrar/listar Pets:", error);
    if (error.code === 'failed-precondition' && ownerId) {
       console.error("*************************************************************************");
       console.error("ERRO FIREBASE: Provavelmente falta um ÍNDICE COMPOSTO na subcoleção 'pets'!");
       console.error("A consulta filtrando por 'owner_id' exige um índice nessa subcoleção.");
       console.error(`Verifique os índices para: /tenants/{tenantId}/pets. Campo necessário: owner_id ASC/DESC`);
       console.error("*************************************************************************");
       throw new Error('Erro de configuração do Firestore (índice composto ausente?). Verifique o console.');
    }
    throw new Error('Erro ao buscar pets no banco de dados.');
  }
}

/**
 * Cria um novo pet no Firestore, associado ao tenant atual e a um owner.
 * @param {object} petData - Dados do pet (deve incluir owner_id, name, etc.).
 * @returns {Promise<object>} - O objeto do pet recém-criado.
 */
async function create(petData) {
  const tenantId = localStorage.getItem('current_tenant');
  if (!tenantId) {
    console.error("[Firestore] Erro: Tenant ID não encontrado no localStorage para criar Pet.");
    throw new Error('Tenant não identificado. Faça login novamente.');
  }
  console.log(`[Firestore] Criando Pet para Tenant ID: ${tenantId} com dados:`, petData);

  try {
    // eslint-disable-next-line no-unused-vars
    const { owner_id, name, tenant_id: ignoredTenantId, ...cleanRestData } = petData;

    if (!owner_id || !name) {
      console.error("[Firestore] Erro: Tentativa de criar Pet sem owner_id ou name", petData);
      throw new Error('Dados insuficientes para criar o pet (owner_id e name são obrigatórios).');
    }

    const dataToSave = {
      ...cleanRestData,
      owner_id: owner_id,
      name: name,
      created_at: serverTimestamp(),
    };

    const petsCollectionRef = collection(db, "tenants", tenantId, "pets");
    const docRef = await addDoc(petsCollectionRef, dataToSave);

    console.log(`[Firestore] Pet criado com ID: ${docRef.id} na subcoleção do Tenant ID: ${tenantId} para Owner ID: ${owner_id}`);
    return { id: docRef.id, ...dataToSave };

  } catch (error) {
    console.error("[Firestore] Erro ao criar Pet:", error);
    if (error.code === 'permission-denied') {
        console.error("*************************************************************************");
        console.error("ERRO FIREBASE: Permissão negada ao criar Pet! Verifique as REGRAS DE SEGURANÇA.");
        console.error("A regra 'allow create' para '/tenants/{tenantId}/pets/{petId}' está correta?");
        console.error("Ela valida 'isTenantMember(tenantId)' e a existência/propriedade do 'owner_id'?");
        console.error("*************************************************************************");
        throw new Error('Permissão negada ao salvar pet. Verifique as regras.');
    }
    throw new Error('Erro ao salvar pet no banco de dados.');
  }
}

/**
 * Busca um pet específico no Firestore pelo ID dentro do tenant atual.
 * @param {string} id - O ID do pet a ser buscado.
 * @returns {Promise<object|null>} - Os dados do pet ou null se não encontrado.
 */
async function get(id) {
  const tenantId = localStorage.getItem('current_tenant');
  if (!tenantId) {
    console.error("[Firestore] Erro: Tenant ID não encontrado no localStorage para buscar Pet.");
    throw new Error('Tenant não identificado. Faça login novamente.');
  }
  if (!id) {
     console.error("[Firestore] Erro: ID do Pet não fornecido para a função get.");
     return null;
  }
  console.log(`[Firestore] Buscando Pet ID: ${id} na subcoleção do Tenant ID: ${tenantId}`);

  try {
    const docRef = doc(db, "tenants", tenantId, "pets", id);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const petData = docSnap.data();
      console.log("[Firestore] Pet encontrado:", { id: docSnap.id, ...petData });
      return { id: docSnap.id, ...petData };
    } else {
      console.warn(`[Firestore] Pet com ID ${id} não encontrado na subcoleção do Tenant ${tenantId}.`);
      return null;
    }
  } catch (error) {
    console.error(`[Firestore] Erro ao buscar Pet ID ${id} para Tenant ${tenantId}:`, error);
    if (error.code === 'permission-denied') {
         console.error("*************************************************************************");
         console.error("ERRO FIREBASE: Permissão negada ao LER Pet! Verifique as REGRAS DE SEGURANÇA.");
         console.error("A regra 'allow read' para '/tenants/{tenantId}/pets/{petId}' permite 'isTenantMember(tenantId)'?");
         console.error("*************************************************************************");
         throw new Error('Permissão negada ao ler dados do pet. Verifique as regras.');
    }
    throw new Error('Erro ao buscar pet no banco de dados.');
  }
}

/**
 * Atualiza um pet existente no Firestore dentro do tenant atual.
 * @param {string} id - O ID do pet a ser atualizado.
 * @param {object} dataToUpdate - Objeto com os campos a serem atualizados (não incluir tenant_id, owner_id).
 * @returns {Promise<void>}
 */
async function update(id, dataToUpdate) {
  const tenantId = localStorage.getItem('current_tenant');
  if (!tenantId) {
    console.error("[Firestore] Erro: Tenant ID não encontrado no localStorage para atualizar Pet.");
    throw new Error('Tenant não identificado. Faça login novamente.');
  }
   if (!id) {
      console.error("[Firestore] Erro: Tentativa de atualizar Pet sem ID.");
      throw new Error("ID do pet é obrigatório para atualização.");
    }
  console.log(`[Firestore] Tentando atualizar Pet ID: ${id} na subcoleção do Tenant ID: ${tenantId} com dados:`, dataToUpdate);

  try {
    const petDocRef = doc(db, "tenants", tenantId, "pets", id);

    // eslint-disable-next-line no-unused-vars
    const { id: ignoredId, tenant_id: ignoredTenantId, owner_id: ignoredOwnerId, created_at: ignoredCreatedAt, ...updateData } = dataToUpdate;
    if (ignoredTenantId || ignoredOwnerId || ignoredCreatedAt) {
        console.warn("[Firestore] Tentativa de atualizar tenant_id, owner_id ou created_at via update ignorada.");
    }

    const dataWithTimestamp = {
        ...updateData,
        updated_at: serverTimestamp()
    };

    await updateDoc(petDocRef, dataWithTimestamp);
    console.log(`[Firestore] Pet ID: ${id} atualizado com sucesso na subcoleção do Tenant ID: ${tenantId}.`);

  } catch (error) {
    console.error(`[Firestore] Erro ao atualizar Pet ID: ${id} para Tenant ${tenantId}:`, error);
    if (error.code === 'permission-denied') {
        console.error("*************************************************************************");
        console.error("ERRO FIREBASE: Permissão negada ao ATUALIZAR Pet! Verifique as REGRAS DE SEGURANÇA.");
        console.error("A regra 'allow update' para '/tenants/{tenantId}/pets/{petId}' permite 'isTenantMember(tenantId)'?");
        console.error("*************************************************************************");
        throw new Error('Permissão negada ao atualizar pet. Verifique as regras.');
    }
     if (error.code === 'not-found') {
        console.error(`[Firestore] Erro: Pet com ID ${id} não encontrado para atualização na subcoleção do Tenant ${tenantId}.`);
        throw new Error('Pet não encontrado para atualização.');
    }
    throw new Error('Erro ao atualizar pet no banco de dados.');
  }
}

/**
 * Lista todos os pets no Firestore para o tenant atual.
 * @returns {Promise<Array<object>>} - Array com os pets encontrados para o tenant.
 */
async function list() {
  console.log('[Firestore] Listando todos os Pets para o tenant atual');
  const tenantId = localStorage.getItem('current_tenant');
  if (!tenantId) {
    console.error("[Firestore] Erro: Tenant ID não encontrado no localStorage para listar Pets.");
    throw new Error('Tenant não identificado. Faça login novamente.');
  }

  try {
    const petsCollectionRef = collection(db, "tenants", tenantId, "pets");
    const q = query(petsCollectionRef);

    const querySnapshot = await getDocs(q);
    const pets = [];
    querySnapshot.forEach((doc) => {
      pets.push({ id: doc.id, ...doc.data() });
    });

    console.log(`[Firestore] Pets listados para o Tenant ID ${tenantId} (${pets.length}):`, pets);
    return pets;

  } catch (error) {
    console.error(`[Firestore] Erro ao listar Pets para Tenant ${tenantId}:`, error);
     if (error.code === 'permission-denied') {
         console.error("*************************************************************************");
         console.error("ERRO FIREBASE: Permissão negada ao LISTAR Pets! Verifique as REGRAS DE SEGURANÇA.");
         console.error("A regra 'allow list' (ou 'allow read') para '/tenants/{tenantId}/pets/{petId}' permite 'isTenantMember(tenantId)'?");
         console.error("*************************************************************************");
         throw new Error('Permissão negada ao listar pets. Verifique as regras.');
    }
    throw new Error('Erro ao listar pets no banco de dados.');
  }
}

/**
 * Inativa um pet (marca como inativo) no Firestore.
 * @param {string} id - O ID do pet a ser inativado.
 * @param {string} reason - O motivo da inativação.
 * @returns {Promise<void>}
 */
async function inactivate(id, reason) {
  console.log(`[Firestore] Tentando inativar Pet ID: ${id} com motivo: ${reason}`);
  if (!reason || reason.trim() === '') {
     throw new Error('O motivo da inativação é obrigatório.');
  }
  await update(id, {
    status: 'inactive',
    inactivation_reason: reason,
    inactivated_at: serverTimestamp()
  });
   console.log(`[Firestore] Pet ID: ${id} marcado como inativo.`);
}

export const Pet = {
  filter,
  create,
  get,
  update,
  list,
  inactivate,
}; 