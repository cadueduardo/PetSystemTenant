import { db } from '@/lib/firebaseConfig'; // Importa a instância do Firestore
import { doc, getDoc, collection, query, getDocs, addDoc, updateDoc, serverTimestamp } from "firebase/firestore";

/**
 * Busca um cliente específico no Firestore pelo ID.
 * @param {string} id - O ID do cliente a ser buscado.
 * @returns {Promise<object|null>} - Os dados do cliente ou null se não encontrado.
 */
async function get(id) {
  console.log(`[Firestore] Buscando Customer ID: ${id}`);
  const tenantId = localStorage.getItem('current_tenant');
  if (!tenantId) {
    console.error("[Firestore] Erro: Tenant ID não encontrado no localStorage.");
    throw new Error('Tenant não identificado. Faça login novamente.');
  }

  try {
    const docRef = doc(db, "tenants", tenantId, "customers", id);
    const docSnap = await getDoc(docRef); // Busca o documento

    if (docSnap.exists()) {
      const customerData = docSnap.data();
      if (customerData.tenant_id !== tenantId) {
        console.warn(`[Firestore Client Check] Cliente ${id} lido, mas pertence a outro tenant (${customerData.tenant_id})?`);
        return null;
      }
      console.log("[Firestore] Customer encontrado:", { id: docSnap.id, ...customerData });
      return { id: docSnap.id, ...customerData };
    } else {
      console.warn(`[Firestore] Customer com ID ${id} não encontrado no caminho /tenants/${tenantId}/customers/${id}.`);
      return null;
    }
  } catch (error) {
    console.error("[Firestore] Erro ao buscar Customer:", error);
    if (error.code === 'permission-denied') {
        console.error(`>>> PERMISSION DENIED ao tentar ler /tenants/${tenantId}/customers/${id}. Verifique as Regras do Firestore.`);
    }
    throw new Error('Erro ao buscar cliente no banco de dados.');
  }
}

/**
 * Busca clientes no Firestore para o tenant atual.
 * @returns {Promise<Array<object>>} - Array com os clientes encontrados para o tenant.
 */
async function filter() { // Remove 'filters' parameter, always filters by current tenant
  console.log('[Firestore] Buscando Customers para o tenant atual');
  const tenantId = localStorage.getItem('current_tenant');
  if (!tenantId) {
    console.error("[Firestore] Erro: Tenant ID não encontrado no localStorage para filtrar Customers.");
    throw new Error('Tenant não identificado. Faça login novamente.');
  }

  try {
    // <<< CORREÇÃO: Usar caminho da SUBCOLEÇÃO >>>
    const customersCollectionRef = collection(db, "tenants", tenantId, "customers");
    // <<< REMOVIDO: Filtro explícito por tenant_id (já implícito no path) >>>
    // let q = query(customersCollectionRef, where("tenant_id", "==", tenantId)); 
    let q = query(customersCollectionRef); // Query base na subcoleção

    // Adicionar outros filtros aqui se necessário
    // Exemplo: q = query(customersCollectionRef, where("status", "==", "active"));

    const querySnapshot = await getDocs(q);
    const customers = [];
    querySnapshot.forEach((doc) => {
      customers.push({ id: doc.id, ...doc.data() });
    });

    console.log(`[Firestore] Customers encontrados para o Tenant ID ${tenantId} (${customers.length}):`, customers);
    return customers;

  } catch (error) {
    console.error("[Firestore] Erro ao buscar Customers:", error);
    // Verifica se é erro de índice ausente (exemplo, pode variar)
    if (error.code === 'failed-precondition') {
       console.error("*************************************************************************");
       console.error("ERRO FIREBASE: Provavelmente falta um índice composto no Firestore!");
       console.error("Verifique o console do navegador ou a documentação do Firebase.");
       console.error("Para criar o índice, acesse o link que pode aparecer no erro ou vá ao console do Firebase -> Firestore Database -> Índices.");
       console.error(`Filtro aplicado: tenant_id == ${tenantId}`);
       console.error("*************************************************************************");
       throw new Error('Erro de configuração do Firestore (índice ausente?). Verifique o console.');
    }
    throw new Error('Erro ao buscar clientes no banco de dados.');
  }
}

/**
 * Lista todos os clientes no Firestore para o tenant atual.
 * @returns {Promise<Array<object>>} - Array com os clientes encontrados para o tenant.
 */
async function list() { 
  console.log('[Firestore] Listando todos os Customers para o tenant atual');
  const tenantId = localStorage.getItem('current_tenant');
  if (!tenantId) {
    console.error("[Firestore] Erro: Tenant ID não encontrado no localStorage para listar Customers.");
    throw new Error('Tenant não identificado. Faça login novamente.');
  }

  try {
    // <<< CORREÇÃO: Usar caminho da SUBCOLEÇÃO >>>
    const customersCollectionRef = collection(db, "tenants", tenantId, "customers");
    // <<< REMOVIDO: Filtro explícito por tenant_id (já implícito no path) >>>
    // let q = query(customersCollectionRef, where("tenant_id", "==", tenantId)); 
    let q = query(customersCollectionRef); // Query base na subcoleção
    
    // Poderia adicionar ordenação aqui se necessário, ex: query(q, orderBy("full_name"));

    const querySnapshot = await getDocs(q);
    const customers = [];
    querySnapshot.forEach((doc) => {
      customers.push({ id: doc.id, ...doc.data() });
    });

    console.log(`[Firestore] Customers listados para o Tenant ID ${tenantId} (${customers.length}):`, customers);
    return customers;

  } catch (error) {
    console.error("[Firestore] Erro ao listar Customers:", error);
    if (error.code === 'failed-precondition') {
       console.error("ERRO FIREBASE: Índice ausente? Verifique o console.");
       throw new Error('Erro de configuração do Firestore (índice ausente?). Verifique o console.');
    } else if (error.code === 'permission-denied') {
        console.error("PERMISSION DENIED: Verifique as regras do Firestore para listagem de Customers.");
        throw new Error('Permissão negada para listar clientes.');
    }
    throw new Error('Erro ao listar clientes no banco de dados.');
  }
}

/**
 * Cria um novo cliente no Firestore associado ao tenant atual.
 * @param {object} customerData - Os dados do cliente a serem salvos (sem tenant_id).
 * @returns {Promise<object>} - O objeto do cliente recém-criado (incluindo o ID gerado e tenant_id).
 */
async function create(customerData) {
  console.log('[Firestore] Criando Customer com:', customerData);
  const tenantId = localStorage.getItem('current_tenant');
  if (!tenantId) {
    console.error("[Firestore] Erro: Tenant ID não encontrado no localStorage para criar Customer.");
    throw new Error('Tenant não identificado. Faça login novamente.');
  }

  try {
    // <<< Não precisa mais remover/adicionar tenant_id, pois salvamos na subcoleção correta >>>
    /*
    const { tenant_id, ...restData } = customerData;
    if (tenant_id) {
        console.warn("[Firestore] tenant_id fornecido em customerData foi ignorado. Usando o do localStorage.");
    }
    */
    const dataToSave = {
        // ...restData,
        ...customerData, // Usa os dados recebidos diretamente
        // tenant_id: tenantId, // Não precisa mais salvar explicitamente, está no path
        created_at: serverTimestamp(),
        status: customerData.status || 'active'
    };

    // <<< CORREÇÃO: Usar caminho da SUBCOLEÇÃO >>>
    const customersCollectionRef = collection(db, "tenants", tenantId, "customers");
    const docRef = await addDoc(customersCollectionRef, dataToSave);

    console.log(`[Firestore] Customer criado com ID: ${docRef.id} para Tenant ID: ${tenantId}`);
    // Retorna os dados salvos
    return { id: docRef.id, ...dataToSave };

  } catch (error) {
    console.error("[Firestore] Erro ao criar Customer:", error);
    throw new Error('Erro ao salvar cliente no banco de dados.');
  }
}

/**
 * Atualiza um cliente existente no Firestore, verificando a propriedade do tenant.
 * @param {string} id - O ID do cliente a ser atualizado.
 * @param {object} customerData - Os dados a serem atualizados (não deve conter tenant_id).
 * @returns {Promise<void>} - Retorna nada em caso de sucesso.
 */
async function update(id, customerData) {
  console.log(`[Firestore] Tentando atualizar Customer ID: ${id} com:`, customerData);
  const tenantId = localStorage.getItem('current_tenant');
  if (!tenantId) {
    console.error("[Firestore] Erro: Tenant ID não encontrado no localStorage para atualizar Customer.");
    throw new Error('Tenant não identificado. Faça login novamente.');
  }

  try {
    // <<< Remover verificação manual de tenant_id se regra de segurança já protege >>>
    /*
    const { tenant_id, ...updateData } = customerData;
    if (tenant_id) {
      console.warn("[Firestore] Tentativa de atualizar tenant_id via update ignorada.");
    }
    */
   const updateData = { ...customerData }; // Usa dados como recebidos
   delete updateData.tenant_id; // Garante que não tentamos mudar tenant_id
   delete updateData.id; // Garante que não tentamos mudar o ID

    // <<< CORREÇÃO: Usar caminho da SUBCOLEÇÃO >>>
    const docRef = doc(db, "tenants", tenantId, "customers", id);

    // <<< REMOVER getDoc e verificação manual de tenant (regra de segurança deve cuidar) >>>
    /*
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) {
        console.error(`[Firestore] Erro: Customer com ID ${id} não encontrado para atualização.`);
        throw new Error('Cliente não encontrado para atualização.');
    }
    const existingData = docSnap.data();
    if (existingData.tenant_id !== tenantId) {
        console.error(`[Firestore] ERRO: Tenant ${tenantId} tentando atualizar Customer ${id} que pertence ao Tenant ${existingData.tenant_id}. Acesso negado.`);
        throw new Error('Permissão negada para atualizar este cliente.');
    }
    */

    const dataWithTimestamp = {
        ...updateData,
        updated_at: serverTimestamp()
    };

    await updateDoc(docRef, dataWithTimestamp);

    console.log(`[Firestore] Customer ID: ${id} atualizado com sucesso pelo Tenant ID: ${tenantId}.`);

  } catch (error) {
    console.error(`[Firestore] Erro ao atualizar Customer ID: ${id}:`, error);
    // O erro de permissão já foi tratado acima na verificação de tenant_id
    if (error.message.includes('Permissão negada')) {
        throw error; // Repassa o erro específico
    }
    if (error.message.includes('Cliente não encontrado')) {
        throw error; // Repassa o erro específico
    }
    // Trata outros erros genéricos
    throw new Error('Erro ao atualizar cliente no banco de dados.');
  }
}

/**
 * Inativa um cliente existente no Firestore, verificando a propriedade do tenant.
 * @param {string} id - O ID do cliente a ser inativado.
 * @param {string} reasonId - O ID do motivo da inativação (da coleção cancellationReasons).
 * @returns {Promise<void>} - Retorna nada em caso de sucesso.
 */
async function inactivate(id, reasonId) {
  console.log(`[Firestore] Tentando inativar Customer ID: ${id} com motivo ID: ${reasonId}`);
  const tenantId = localStorage.getItem('current_tenant');
  if (!tenantId) {
    console.error("[Firestore] Erro: Tenant ID não encontrado no localStorage para inativar Customer.");
    throw new Error('Tenant não identificado. Faça login novamente.');
  }
  if (!id || !reasonId) {
    console.error("[Firestore] Erro: ID do cliente e ID do motivo são obrigatórios para inativar.");
    throw new Error('ID do cliente e motivo são obrigatórios para inativar.');
  }

  try {
    // <<< CORREÇÃO: Usar caminho da SUBCOLEÇÃO >>>
    const docRef = doc(db, "tenants", tenantId, "customers", id);

    // <<< REMOVER getDoc e verificação manual de tenant (regra de segurança deve cuidar) >>>
    /*
     const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) {
        console.error(`[Firestore] Erro: Customer com ID ${id} não encontrado para inativação.`);
        throw new Error('Cliente não encontrado para inativação.');
    }
    const existingData = docSnap.data();
    if (existingData.tenant_id !== tenantId) {
        console.error(`[Firestore] ERRO: Tenant ${tenantId} tentando inativar Customer ${id} que pertence ao Tenant ${existingData.tenant_id}. Acesso negado.`);
        throw new Error('Permissão negada para inativar este cliente.');
    }
    */

    const updateData = {
      status: 'inactive',
      inactivation_date: serverTimestamp(), // <<< Usa timestamp do servidor
      inactivation_reason_id: reasonId,
      updated_at: serverTimestamp() // <<< Adiciona timestamp de atualização
    };

    await updateDoc(docRef, updateData);

    console.log(`[Firestore] Customer ID: ${id} inativado com sucesso pelo Tenant ID: ${tenantId}.`);

  } catch (error) {
    console.error(`[Firestore] Erro ao inativar Customer ID: ${id}:`, error);
     // O erro de permissão já foi tratado acima na verificação de tenant_id
    if (error.message.includes('Permissão negada')) {
        throw error; // Repassa o erro específico
    }
     if (error.message.includes('Cliente não encontrado')) {
        throw error; // Repassa o erro específico
    }
    // Trata outros erros genéricos
    throw new Error('Erro ao inativar cliente no banco de dados.');
  }
}

// Exporta a função (ou um objeto com todas as funções CRUD)
export const customerService = {
  get,
  filter,
  list,
  create,
  update,
  inactivate,
  // Adicionaremos delete aqui depois
}; 