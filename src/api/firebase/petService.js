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
    const petsCollectionRef = collection(db, "pets");

    // <<< Constraints sempre incluem tenant_id >>>
    const constraints = [where("tenant_id", "==", tenantId)];

    // Adiciona filtro por owner_id se fornecido
    if (ownerId) {
      console.log(`[Firestore] Aplicando filtro adicional owner_id == ${ownerId}`);
      constraints.push(where("owner_id", "==", ownerId));
    }

    // Monta a query final com todas as constraints
    // IMPORTANTE: A query com tenant_id e owner_id EXIGE um índice composto.
    const q = query(petsCollectionRef, ...constraints);

    const querySnapshot = await getDocs(q);
    const pets = [];
    querySnapshot.forEach((doc) => {
      pets.push({ id: doc.id, ...doc.data() });
    });

    console.log(`[Firestore] Pets encontrados (${pets.length}) para Tenant ID ${tenantId}` + (ownerId ? ` e Owner ID ${ownerId}` : '') + ":", pets);
    return pets;

  } catch (error) {
    console.error("[Firestore] Erro ao filtrar Pets:", error);
    if (error.code === 'failed-precondition') {
       console.error("*************************************************************************");
       console.error("ERRO FIREBASE: Provavelmente falta um ÍNDICE COMPOSTO no Firestore!");
       console.error("A consulta em 'pets' com filtros em 'tenant_id' e 'owner_id' exige um índice.");
       console.error("Verifique o console do navegador pelo link para criar o índice ou vá ao console do Firebase -> Firestore Database -> Índices.");
       console.error(`Filtros aplicados: tenant_id == ${tenantId}` + (ownerId ? `, owner_id == ${ownerId}` : ''));
       console.error("*************************************************************************");
       throw new Error('Erro de configuração do Firestore (índice composto ausente?). Verifique o console.');
    }
    throw new Error('Erro ao buscar pets no banco de dados.');
  }
}

/**
 * Cria um novo pet no Firestore, associado ao tenant atual e a um owner.
 * @param {object} petData - Dados do pet (deve incluir owner_id, name, etc., mas não tenant_id).
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
    // <<< Remove tenant_id de petData se existir e valida campos essenciais >>>
    const { tenant_id, owner_id, name, ...restData } = petData;
    if (tenant_id) {
        console.warn("[Firestore] tenant_id fornecido em petData foi ignorado. Usando o do localStorage.");
    }
    if (!owner_id || !name) {
      console.error("[Firestore] Erro: Tentativa de criar Pet sem owner_id ou name", petData);
      throw new Error('Dados insuficientes para criar o pet (owner_id e name são obrigatórios).');
    }

    // <<< TODO: Verificar se o owner_id (cliente) pertence ao tenant_id atual >>>
    // Esta validação é CRUCIAL para segurança e integridade.
    // Poderíamos fazer: const ownerDoc = await customerService.get(owner_id);
    //                 if (!ownerDoc || ownerDoc.tenant_id !== tenantId) throw new Error(...);
    // Por ora, vamos confiar que a UI passou o owner_id correto do tenant atual.
    console.warn(`[Firestore] TODO: Implementar verificação se Owner ID ${owner_id} pertence ao Tenant ID ${tenantId} antes de criar o Pet.`);

    // <<< Adiciona tenant_id e timestamp >>>
    const dataToSave = {
      ...restData,
      owner_id: owner_id, // Garante que owner_id está no objeto final
      name: name,         // Garante que name está no objeto final
      tenant_id: tenantId,
      created_at: serverTimestamp(),
      // Adicionar outros campos padrão, se houver (ex: status: 'active')
    };

    const petsCollectionRef = collection(db, "pets");
    const docRef = await addDoc(petsCollectionRef, dataToSave);

    console.log(`[Firestore] Pet criado com ID: ${docRef.id} para Tenant ID: ${tenantId} e Owner ID: ${owner_id}`);
    return { id: docRef.id, ...dataToSave }; // Retorna dados com timestamps resolvidos se possível

  } catch (error) {
    console.error("[Firestore] Erro ao criar Pet:", error);
    // As regras de segurança devem impedir a criação se owner não for do tenant
    if (error.code === 'permission-denied') {
        console.error("*************************************************************************");
        console.error("ERRO FIREBASE: Permissão negada ao criar Pet no Firestore!");
        console.error("Verifique as Regras de Segurança. Elas validam se request.resource.data.tenant_id == request.auth.token.tenant_id E se o owner_id pertence a esse tenant?");
        console.error("*************************************************************************");
        throw new Error('Permissão negada ao salvar pet. Verifique as regras.');
    }
    throw new Error('Erro ao salvar pet no banco de dados.');
  }
}

/**
 * Busca um pet específico no Firestore pelo ID, verificando o tenant.
 * @param {string} id - O ID do pet a ser buscado.
 * @returns {Promise<object|null>} - Os dados do pet ou null se não encontrado ou não pertence ao tenant.
 */
async function get(id) {
  const tenantId = localStorage.getItem('current_tenant');
  if (!tenantId) {
    console.error("[Firestore] Erro: Tenant ID não encontrado no localStorage para buscar Pet.");
    throw new Error('Tenant não identificado. Faça login novamente.');
  }
  console.log(`[Firestore] Buscando Pet ID: ${id} para Tenant ID: ${tenantId}`);

  try {
    const docRef = doc(db, "pets", id);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const petData = docSnap.data();
      // <<< Verifica se o pet pertence ao tenant logado >>>
      if (petData.tenant_id !== tenantId) {
        console.warn(`[Firestore] Tentativa de acesso não autorizado ao Pet ID ${id} pelo Tenant ID ${tenantId}. Pertence ao Tenant ID ${petData.tenant_id}.`);
        return null; // Retorna null como se não encontrado para este tenant
      }
      console.log("[Firestore] Pet encontrado:", { id: docSnap.id, ...petData });
      return { id: docSnap.id, ...petData };
    } else {
      console.warn(`[Firestore] Pet com ID ${id} não encontrado.`);
      return null;
    }
  } catch (error) {
    console.error("[Firestore] Erro ao buscar Pet:", error);
    throw new Error('Erro ao buscar pet no banco de dados.');
  }
}

/**
 * Atualiza um pet existente no Firestore, verificando a propriedade do tenant.
 * @param {string} id - O ID do pet a ser atualizado.
 * @param {object} dataToUpdate - Objeto com os campos a serem atualizados (não deve conter tenant_id ou owner_id).
 * @returns {Promise<void>}
 */
async function update(id, dataToUpdate) {
  const tenantId = localStorage.getItem('current_tenant');
  if (!tenantId) {
    console.error("[Firestore] Erro: Tenant ID não encontrado no localStorage para atualizar Pet.");
    throw new Error('Tenant não identificado. Faça login novamente.');
  }
  console.log(`[Firestore] Tentando atualizar Pet ID: ${id} para Tenant ID: ${tenantId} com dados:`, dataToUpdate);

  try {
    const petDocRef = doc(db, "pets", id);

    if (!id) {
      console.error("[Firestore] Erro: Tentativa de atualizar Pet sem ID.");
      throw new Error("ID do pet é obrigatório para atualização.");
    }

    // <<< Remove campos sensíveis que não devem ser atualizados aqui >>>
    // eslint-disable-next-line no-unused-vars
    const { id: _, tenant_id, owner_id, ...updateData } = dataToUpdate;
    if (tenant_id || owner_id) {
        console.warn("[Firestore] Tentativa de atualizar tenant_id ou owner_id via update ignorada.");
    }

    // <<< Verifica se o pet pertence ao tenant antes de atualizar >>>
    const docSnap = await getDoc(petDocRef);
    if (!docSnap.exists()) {
        console.error(`[Firestore] Erro: Pet com ID ${id} não encontrado para atualização.`);
        throw new Error('Pet não encontrado para atualização.');
    }
    const existingData = docSnap.data();
    if (existingData.tenant_id !== tenantId) {
        console.error(`[Firestore] ERRO: Tenant ${tenantId} tentando atualizar Pet ${id} que pertence ao Tenant ${existingData.tenant_id}. Acesso negado.`);
        throw new Error('Permissão negada para atualizar este pet.');
    }

    // <<< Adiciona timestamp de atualização >>>
    const dataWithTimestamp = {
        ...updateData,
        updated_at: serverTimestamp()
    };

    await updateDoc(petDocRef, dataWithTimestamp);
    console.log(`[Firestore] Pet ID: ${id} atualizado com sucesso pelo Tenant ID: ${tenantId}.`);

  } catch (error) {
    console.error(`[Firestore] Erro ao atualizar Pet ID: ${id}:`, error);
    // Erros de permissão ou 'não encontrado' já são tratados acima
    if (error.message.includes('Permissão negada') || error.message.includes('não encontrado')) {
        throw error; // Repassa o erro específico
    }
    // Lembre-se das regras de segurança do Firestore!
    if (error.code === 'permission-denied') {
        console.error("*************************************************************************");
        console.error("ERRO FIREBASE: Permissão negada ao atualizar Pet! Verifique as regras de segurança.");
        console.error("A regra permite 'update' se request.resource.data.tenant_id == request.auth.token.tenant_id?");
        console.error("*************************************************************************");
        throw new Error('Permissão negada ao atualizar pet. Verifique as regras.');
    }
    throw new Error('Erro ao atualizar pet no banco de dados.');
  }
}

// Exporta as funções
export const petService = {
  get,
  filter,
  create,
  update,
  // Adicionaremos delete aqui depois
}; 