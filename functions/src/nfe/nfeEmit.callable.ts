// functions/src/nfe/nfeEmit.callable.ts
import * as admin from "firebase-admin";
import * as logger from "firebase-functions/logger";
import { HttpsError, onCall, CallableRequest } from "firebase-functions/v2/https";
// import axios from "axios"; // Removido - não utilizado e incorreto para este fluxo

if (admin.apps.length === 0) {
  admin.initializeApp();
}

const db = admin.firestore();

// --- Interfaces (definidas anteriormente) ---
interface EmitNFeData {
  tenantId: string;
  chargeId: string;
  environment?: "homologation" | "production";
}

interface NFeConfigTenant { // Renomeado para evitar conflito com a interface global NFeConfig
  status: string;
  environment: "homologation" | "production";
  focusCompanyId?: string;
  focusCompanyHomologationToken?: string;
  focusCompanyProductionToken?: string;
  cnpj?: string;
  inscricao_estadual?: string;
  inscricao_municipal?: string;
  regime_tributario_empresa?: string;
  simples_nacional_empresa?: boolean;
  incentivador_cultural_empresa?: boolean;
  company_name?: string; // Razao Social do Tenant
  legal_name?: string; // Nome Fantasia do Tenant
  address_tenant?: { // Endereço do Tenant
    street: string;
    number: string;
    complement?: string;
    neighborhood: string;
    city: string;
    state: string;
    zipCode: string;
    codigo_municipio?: string; // Código IBGE do município do emitente
  };
}

/* // Interface CustomerData comentada pois não está sendo utilizada explicitamente.
interface CustomerData {
  full_name: string;
  cpf_cnpj: string;
  tipo_pessoa: "F" | "J";
  inscricao_estadual?: string | null;
  email?: string;
  phone?: string;
  address: {
    street: string;
    number: string;
    complement?: string;
    neighborhood: string;
    city: string;
    state: string;
    zipCode: string;
    codigo_municipio?: string; // Código IBGE do município do destinatário
  };
}
*/

interface ChargeItemDataForNFe { // Interface para o item já preparado para NF-e
  // Campos da API FocusNFe
  numero_item: number; // Sequencial do item na nota (1, 2, 3...)
  codigo_produto?: string; // Seu código interno para o produto/serviço (itemId)
  descricao: string;
  ncm?: string | null; // Obrigatório para produtos
  cfop: string; // Obrigatório
  unidade_comercial: string; // "UN", "SV", "CX", etc.
  quantidade_comercial: number;
  valor_unitario_comercial: number;
  valor_bruto: number;
  // Campos de tributos (simplificado por enquanto, a API Focus calcula muitos)
  icms_situacao_tributaria?: string; // Ex: "102" para Simples Nacional
  // pis_situacao_tributaria?: string;
  // cofins_situacao_tributaria?: string;
  item_lista_servicos?: string | null; // Para serviços (LC 116/03)
}

interface ChargeItem {
    id: string;
    productId?: string; // ID do produto/serviço
    productSnapshot?: any; // Armazenar um snapshot do produto/serviço no momento da venda
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    description?: string; // Descrição do item como aparecerá na NF
    ncm?: string; // NCM (se aplicável, buscado do produto)
    itemListaServicos?: string; // Código do item da lista de serviços (se aplicável)
    cfop?: string;
    // Outros campos relevantes do item...
}

interface Charge {
    id: string;
    tenantId: string;
    customerId?: string; // <- Mantido caso use em outro lugar, mas vamos priorizar tutorId
    tutorId?: string;    // <- Adicionado para consistência
    status: string;     // Ex: 'paid', 'pending'
    totalAmount: number;
    items?: ChargeItem[]; // Se os itens estiverem diretamente no doc da Charge
    // Outros campos relevantes da charge...
    createdAt: admin.firestore.Timestamp; 
    paidAt?: admin.firestore.Timestamp;
    focusNFeId?: string; // ID da NFe na Focus (se já emitida)
    focusNFeStatus?: string; // Status da NFe na Focus
    focusNFePdfUrl?: string;
    focusNFeXmlUrl?: string;
    // ... outros campos relevantes da Charge ...
}

// Se você usar uma interface específica para os dados brutos do Firestore
interface ChargeData extends Charge { }

interface ProductData {
  name: string;
  ncm: string;
  // cfop_padrao?: string; // Se quiser definir CFOP por produto
}

// A função makeFocusApiCall foi removida pois não estava sendo utilizada neste arquivo
// e a chamada de emissão de NF-e foi refeita usando fetch diretamente com token na URL.

export const emitNFe = onCall(
  { 
    region: "southamerica-east1", 
    timeoutSeconds: 300, 
    memory: "512MiB" // Firebase usa MiB ou GiB para memória
  },
  async (request: CallableRequest<EmitNFeData>) => { // Tipagem explícita para request
    logger.info("--- emitNFe v1.0.5 --- Executando (Teste de Deploy com IBGE e IE Isento) ---"); // NOVO LOG DE VERSÃO
    const { data, auth } = request; // data e auth vêm de request
    logger.info(`[${data.tenantId}] Iniciando emissão de NF-e para cobrança ${data.chargeId}`, { data, authUid: auth?.uid });

    if (!auth) { // auth em vez de context.auth
      logger.warn(`[${data.tenantId}] Tentativa de emissão não autenticada para charge ${data.chargeId}.`);
      throw new HttpsError("unauthenticated", "Usuário não autenticado.");
    }
    if (!data.tenantId || !data.chargeId) {
      logger.error(`[${data.tenantId}] tenantId ou chargeId faltando na requisição.`, data);
      throw new HttpsError("invalid-argument", "tenantId e chargeId são obrigatórios.");
    }

    const { tenantId, chargeId } = data;
    const referenciaInterna = `chg_${chargeId.substring(0, 10)}_${Date.now()}`;

    try {
      // Passo 1: Buscar configuração NFe do tenant (nfeConfig) e dados do Tenant
      const tenantDocRef = db.doc(`tenants/${tenantId}`);
      const nfeConfigRef = db.doc(`tenants/${tenantId}/integrations/nfeConfig`);

      const [tenantDocSnap, nfeConfigSnap] = await Promise.all([
        tenantDocRef.get(),
        nfeConfigRef.get(),
      ]);

      if (!tenantDocSnap.exists) {
        throw new HttpsError("not-found", `Tenant ${tenantId} não encontrado.`);
      }
      if (!nfeConfigSnap.exists) {
        throw new HttpsError("not-found", `Configuração NF-e não encontrada para o tenant ${tenantId}.`);
      }

      logger.info(`[${tenantId}] nfeConfigSnap.exists:`, nfeConfigSnap.exists);

      const tenantData = tenantDocSnap.data();
      const nfeConfigData = nfeConfigSnap.data() as NFeConfigTenant;

      logger.info(`[${tenantId}] Conteúdo de nfeConfigData (após .data()):`, nfeConfigData);

      try {
        if (nfeConfigData) {
          logger.info(`[${tenantId}] Tentando acessar nfeConfigData.status:`, nfeConfigData.status);
          logger.info(`[${tenantId}] Tentando acessar nfeConfigData.focusCompanyHomologationToken:`, nfeConfigData.focusCompanyHomologationToken);
        } else {
          logger.warn(`[${tenantId}] nfeConfigData é undefined ou null ANTES da verificação de status.`);
        }
      } catch (e: any) {
        logger.error(`[${tenantId}] Erro ao tentar acessar propriedades de nfeConfigData:`, e.message);
      }

      if (!nfeConfigData || nfeConfigData.status !== "active") {
        logger.error(`[${tenantId}] Falha na validação de nfeConfigData. Status: ${nfeConfigData?.status}. nfeConfigData existe? ${!!nfeConfigData}`);
        throw new HttpsError("failed-precondition", `Integração NF-e não está ativa ou configuração é inválida para o tenant ${tenantId}.`);
      }

      // Combinar dados do tenant e nfeConfig para o emitente
      const emitenteConfig: NFeConfigTenant = {
        ...nfeConfigData,
        company_name: tenantData?.company_name || tenantData?.legal_name || nfeConfigData.company_name,
        legal_name: tenantData?.legal_name || tenantData?.company_name || nfeConfigData.legal_name,
        address_tenant: tenantData?.address ? {
            street: tenantData.address.street,
            number: tenantData.address.number,
            complement: tenantData.address.complement,
            neighborhood: tenantData.address.neighborhood,
            city: tenantData.address.city,
            state: tenantData.address.state,
            zipCode: tenantData.address.cep?.replace(/\D/g, ''),
            codigo_municipio: tenantData.address.ibge_code, // Supondo que ibge_code é o código do município
        } : nfeConfigData.address_tenant,
        // Garantir que CNPJ, IE, etc. do nfeConfigData tenham precedência se existirem lá
        cnpj: nfeConfigData.cnpj || tenantData?.document?.replace(/\D/g, ''),
        inscricao_estadual: nfeConfigData.inscricao_estadual || tenantData?.inscricao_estadual,
        // regime_tributario_empresa já vem de nfeConfigData
      };
      
      logger.info(`[${tenantId}] Emitente Config:`, emitenteConfig);


      // Passo 2: Determinar ambiente (homologação/produção) e token da API Focus
      const ambienteFocus = data.environment || emitenteConfig.environment || "homologation";
      const tokenFocus = ambienteFocus === "production"
        ? emitenteConfig.focusCompanyProductionToken
        : emitenteConfig.focusCompanyHomologationToken;

      if (!tokenFocus) {
        throw new HttpsError("failed-precondition", `Token da API Focus para ambiente ${ambienteFocus} não configurado.`);
      }
      const apiUrlFocus = ambienteFocus === "production"
        ? "https://api.focusnfe.com.br"
        : "https://homologacao.focusnfe.com.br";

      // Passo 3: Buscar dados da Cobrança (Charge)
      const chargeDocRef = db.doc(`tenants/${tenantId}/charges/${chargeId}`);
      const chargeDocSnap = await chargeDocRef.get();
      if (!chargeDocSnap.exists) {
        throw new HttpsError("not-found", `Cobrança ${chargeId} não encontrada.`);
      }
      const chargeData = chargeDocSnap.data() as ChargeData;

      if (!chargeData) {
        logger.error(`[emitNFe] Cobrança ${chargeId} não encontrada para o tenant ${tenantId}.`);
        return { success: false, message: `Cobrança ${chargeId} não encontrada.` };
      }

      const customerId = chargeData.tutorId; // Usando tutorId
      if (!customerId) {
        logger.error(`[emitNFe] tutorId não encontrado na cobrança ${chargeId}.`);
        return { success: false, message: `tutorId não encontrado na cobrança ${chargeId}.` };
      }

      // Passo 4: Buscar dados do Cliente (Customer) a partir da Charge
      const customerDocRef = db.doc(`tenants/${tenantId}/customers/${customerId}`);
      const customerDocSnap = await customerDocRef.get();
      if (!customerDocSnap.exists) {
        throw new HttpsError("not-found", `Cliente ${customerId} não encontrado.`);
      }
      const customerDataFirebase = customerDocSnap.data() as any; // Usar 'any' por enquanto

      // Mapeamento dos dados do cliente para a NF-e, restaurando tipo_pessoa e inscricao_estadual
      const clienteDadosParaNFe = {
        full_name: customerDataFirebase?.full_name || "",
        // Determinar tipo_pessoa (F ou J) e cpf_cnpj
        tipo_pessoa: (customerDataFirebase?.cpf?.replace(/\D/g, '')?.length === 11) ? "F" : 
                     ((customerDataFirebase?.cnpj?.replace(/\D/g, '')?.length === 14) ? "J" : 
                     ((customerDataFirebase?.document?.replace(/\D/g, '')?.length === 11) ? "F" : 
                     ((customerDataFirebase?.document?.replace(/\D/g, '')?.length === 14) ? "J" : "F"))), // Default para F se não identificável
        cpf_cnpj: customerDataFirebase?.cpf?.replace(/\D/g, '') || 
                  customerDataFirebase?.cnpj?.replace(/\D/g, '') || 
                  customerDataFirebase?.document?.replace(/\D/g, '') || "",
        inscricao_estadual: customerDataFirebase?.inscricao_estadual || null, // Mantém null se não houver
        email: customerDataFirebase?.email || "",
        phone: customerDataFirebase?.phone?.replace(/\D/g, "") || "",
        address: {
            street: customerDataFirebase?.address || "",
            number: customerDataFirebase?.address_number || "",
            complement: customerDataFirebase?.address_complement || "",
            neighborhood: customerDataFirebase?.neighborhood || "",
            city: customerDataFirebase?.city || "",
            state: customerDataFirebase?.state || "", // Alterado: Deixar vazio se não houver, em vez de "Brazil"
            zipCode: customerDataFirebase?.cep?.replace(/\D/g, "") || "",
            ibge_code: customerDataFirebase?.ibge_code || "", // Código IBGE do município do cliente
            country: "Brasil", // Fixo por enquanto
        },
      };
      
      // O campo 'document' e 'document_type' não são mais usados diretamente abaixo, 
      // pois tipo_pessoa e cpf_cnpj cobrem essa lógica.
      // O log do objeto clienteDadosParaNFe mostrará a estrutura correta.
      logger.info(`[${tenantId}] Cliente Dados (mapeado para NF-e):`, clienteDadosParaNFe);

      // Validação crítica para UF do destinatário
      if (!clienteDadosParaNFe.address.state || clienteDadosParaNFe.address.state.length !== 2) {
          const errorMessage = `UF do destinatário inválida ou ausente: '${clienteDadosParaNFe.address.state}'. Verifique e corrija os dados do cliente ${customerId}. A UF deve ser uma sigla de 2 letras (ex: SP).`;
          logger.error(`[${tenantId}] [${chargeId}] ${errorMessage}`);
          throw new HttpsError("invalid-argument", errorMessage);
      }

      // Validação crítica para Código do Município (IBGE) do destinatário
      if (!clienteDadosParaNFe.address.ibge_code) {
          const errorMessage = `Código do Município (IBGE) do destinatário ausente. Verifique e corrija os dados do cliente ${customerId}.`;
          logger.error(`[${tenantId}] [${chargeId}] ${errorMessage}`);
          throw new HttpsError("invalid-argument", errorMessage);
      }
      
      // Validação para cpf_cnpj
      if (!clienteDadosParaNFe.cpf_cnpj) {
        const errorMessage = `CPF/CNPJ do destinatário ausente. Verifique e corrija os dados do cliente ${customerId}.`;
        logger.error(`[${tenantId}] [${chargeId}] ${errorMessage}`);
        throw new HttpsError("invalid-argument", errorMessage);
      }


      // Passo 5: Buscar itens da cobrança (Charge Items)
      const chargeItemsRef = db.collection(`tenants/${tenantId}/charges/${chargeId}/charge_items`);
      const chargeItemsSnap = await chargeItemsRef.get();
      
      if (chargeItemsSnap.empty) {
        throw new HttpsError("failed-precondition", `Nenhum item encontrado para a cobrança ${chargeId}.`);
      }

      const itensDaNFeFormatados: ChargeItemDataForNFe[] = [];
      let itemNumero = 0;

      for (const itemDoc of chargeItemsSnap.docs) {
        itemNumero++;
        const chargeItem = itemDoc.data(); // Sem tipagem forte aqui, acesso direto
        let ncm = null;
        let cfop = ""; // Deve ser definido
        let unidadeComercial = "UN"; // Padrão
        let itemListaServicos = null;

        if (chargeItem.itemType === "product" || chargeItem.itemType === "produto") { // Ser flexível com itemType
          const productRef = db.doc(`tenants/${tenantId}/products/${chargeItem.itemId}`);
          const productSnap = await productRef.get();
          if (productSnap.exists) {
            const productData = productSnap.data() as ProductData;
            ncm = productData.ncm || null;
          } else {
            logger.warn(`[${tenantId}] Produto ${chargeItem.itemId} não encontrado para o item ${itemDoc.id} da cobrança ${chargeId}. Usando NCM genérico se necessário.`);
            // NCM genérico para "Outros Produtos" pode ser 00000000, mas a API pode rejeitar.
            // Melhor lançar erro ou definir uma política clara. Para MVP, deixaremos nulo se não encontrado.
          }
          cfop = "5102"; // CFOP Padrão para venda de produto
          unidadeComercial = "UN";
        } else if (chargeItem.itemType === "service" || chargeItem.itemType === "servico" || chargeItem.itemType === "clinic") {
          // Para serviços, buscar dados do serviço se necessário para item_lista_servicos
          // const serviceRef = db.doc(`tenants/${tenantId}/services/${chargeItem.itemId}`);
          // const serviceSnap = await serviceRef.get();
          // if (serviceSnap.exists) { // ... }
          itemListaServicos = "01.05"; // Padrão para Veterinário (LC116) - AJUSTAR CONFORME NECESSÁRIO
          cfop = "5933"; // CFOP Padrão para prestação de serviço tributado pelo ISSQN
          unidadeComercial = "SV"; // Ou "UN"
          // NCM não se aplica a serviços puros listados com item_lista_servicos
        } else {
            logger.warn(`[${tenantId}] Tipo de item desconhecido '${chargeItem.itemType}' para o item ${itemDoc.id}. Tratando como Outros.`);
            cfop = "5102"; // Ou um CFOP genérico como 5949 (Outra saída de mercadoria ou prestação de serviço não especificada)
            // Definir NCM ou outras propriedades se necessário para "custom"
        }
        
        if (!cfop) {
            throw new HttpsError("internal", `CFOP não pôde ser determinado para o item: ${chargeItem.description}`);
        }
        if ((chargeItem.itemType === "product" || chargeItem.itemType === "produto") && !ncm) {
             logger.warn(`[${tenantId}] NCM não encontrado para produto: ${chargeItem.description} (ID: ${chargeItem.itemId}). A emissão pode falhar.`);
             // Considerar lançar erro se NCM for estritamente obrigatório
             // throw new HttpsError("failed-precondition", `NCM é obrigatório e não foi encontrado para o produto: ${chargeItem.description}`);
        }

        // Adicionando log para depuração aqui, dentro do push, se necessário, mas a lógica principal do icms_situacao_tributaria usa o emitenteConfig.
        // A verificação de emitenteConfig.simples_nacional_empresa deve ser feita ANTES deste loop, idealmente.
        // No entanto, para um log rápido, vamos colocá-lo aqui para ver o valor no contexto do item.
        // logger.info(`[${tenantId}] DEBUG ITEM: emitenteConfig.simples_nacional_empresa = ${emitenteConfig.simples_nacional_empresa}`)

        itensDaNFeFormatados.push({
          numero_item: itemNumero,
          codigo_produto: chargeItem.itemId,
          descricao: chargeItem.description,
          ncm: ncm,
          cfop: cfop,
          unidade_comercial: unidadeComercial,
          quantidade_comercial: chargeItem.quantity,
          valor_unitario_comercial: chargeItem.unitPrice,
          valor_bruto: chargeItem.totalPrice,
          item_lista_servicos: itemListaServicos,
          // Definir icms_situacao_tributaria com base no regime da empresa
          // CSOSN para Simples Nacional, CST para Regime Normal.
          // Para Simples Nacional, um CSOSN comum para venda/serviço é "102" (Tributada pelo Simples Nacional sem permissão de crédito)
          // Para Regime Normal, "00" (Tributada integralmente) é um exemplo.
          
          icms_situacao_tributaria: emitenteConfig.simples_nacional_empresa ? "102" : "00", 
        });
      }
      
      // Log de emitenteConfig.simples_nacional_empresa antes de montar o payload principal
      logger.info(`[${tenantId}] DEBUG FINAL emitenteConfig.simples_nacional_empresa = ${emitenteConfig.simples_nacional_empresa}, tipo: ${typeof emitenteConfig.simples_nacional_empresa}`);

      logger.info(`[${tenantId}] Itens Formatados para NF-e:`, itensDaNFeFormatados);

      // Passo 7: Montar o payload da NF-e para a API Focus
      // Documentação de referência: https://focusnfe.com.br/doc/api_nfe.html#autorizar-nfe
      const payloadNFe = {
        // Obrigatórios
        natureza_operacao: "Venda de mercadoria/prestação de serviço", // Ajustar conforme o caso mais comum
        data_emissao: new Date().toISOString(), // Formato YYYY-MM-DDThh:mm:ss-03:00 (Focus ajusta o timezone)
        tipo_documento: 1, // 1 = Saída
        finalidade_emissao: 1, // 1 = NF-e normal
        cnpj_emitente: emitenteConfig.cnpj?.replace(/\D/g, ''),
        nome_emitente: emitenteConfig.company_name, // Razão Social
        nome_fantasia_emitente: emitenteConfig.legal_name, // Nome Fantasia
        logradouro_emitente: emitenteConfig.address_tenant?.street,
        numero_emitente: emitenteConfig.address_tenant?.number,
        bairro_emitente: emitenteConfig.address_tenant?.neighborhood,
        municipio_emitente: emitenteConfig.address_tenant?.city,
        uf_emitente: emitenteConfig.address_tenant?.state,
        cep_emitente: emitenteConfig.address_tenant?.zipCode?.replace(/\D/g, ''),
        // Tratar IE do emitente "ISENTO"
        ...(emitenteConfig.inscricao_estadual?.toUpperCase() !== "ISENTO" && emitenteConfig.inscricao_estadual && {
            inscricao_estadual_emitente: emitenteConfig.inscricao_estadual?.replace(/\D/g, ''),
        }),
        // Se for ISENTO, a tag não é enviada ou uma tag específica pode ser necessária dependendo da API.
        // Para a Focus NFe, geralmente omitir a tag para ISENTO é o caminho quando o estado permite.
        // inscricao_municipal_emitente: emitenteConfig.inscricao_municipal?.replace(/\D/g, ''), // Não usual em NF-e
        codigo_regime_tributario_emitente: emitenteConfig.regime_tributario_empresa, // 1 para Simples, 3 para Normal
        telefone_emitente: tenantData?.phone?.replace(/\D/g, ''), // Telefone do cadastro do Tenant

        // Destinatário
        [clienteDadosParaNFe.tipo_pessoa === "J" ? "cnpj_destinatario" : "cpf_destinatario"]: clienteDadosParaNFe.cpf_cnpj,
        nome_destinatario: clienteDadosParaNFe.full_name,
        telefone_destinatario: clienteDadosParaNFe.phone,
        logradouro_destinatario: clienteDadosParaNFe.address.street,
        numero_destinatario: clienteDadosParaNFe.address.number,
        bairro_destinatario: clienteDadosParaNFe.address.neighborhood,
        municipio_destinatario: clienteDadosParaNFe.address.city,
        uf_destinatario: clienteDadosParaNFe.address.state, // Já validado acima
        pais_destinatario: clienteDadosParaNFe.address.country, // Usar o do objeto, embora fixo como Brasil
        codigo_municipio_destinatario: clienteDadosParaNFe.address.ibge_code, // Já validado
        cep_destinatario: clienteDadosParaNFe.address.zipCode?.replace(/\D/g, ''),
        
        // Lógica para indicador_inscricao_estadual_destinatario e inscricao_estadual_destinatario
        ...(clienteDadosParaNFe.tipo_pessoa === "J" && 
           clienteDadosParaNFe.inscricao_estadual && 
           clienteDadosParaNFe.inscricao_estadual.toUpperCase() !== "ISENTO" && {
            indicador_inscricao_estadual_destinatario: 1, // 1=Contribuinte ICMS
            inscricao_estadual_destinatario: clienteDadosParaNFe.inscricao_estadual.replace(/\D/g, ''),
        }),
        ...(clienteDadosParaNFe.tipo_pessoa === "J" && 
           (clienteDadosParaNFe.inscricao_estadual === null || clienteDadosParaNFe.inscricao_estadual.toUpperCase() === "ISENTO") && {
            indicador_inscricao_estadual_destinatario: 2, // 2=Contribuinte isento de Inscrição
        }),
        ...(clienteDadosParaNFe.tipo_pessoa === "F" && {
            indicador_inscricao_estadual_destinatario: 9, // 9=Não Contribuinte
        }),
        email_destinatario: clienteDadosParaNFe.email,

        // Itens
        items: itensDaNFeFormatados,

        // Informações Adicionais (opcional)
        informacoes_adicionais_contribuinte: `Cobrança Ref: ${chargeId}. Atendido por: ${auth?.token.name || auth?.uid}.`,
        // presença_comprador: 1, // 1=Operação presencial (ajustar se for online)
        // modalidade_frete: 9, // 9=Sem ocorrência de transporte
      };
      
      logger.info(`[${tenantId}] Payload Final para Focus NFe:`, JSON.stringify(payloadNFe, null, 2));

      // Passo 8: Chamar a API Focus para emitir a NF-e
      // A emissão de NF-e usa o token da empresa na URL, não Basic Auth.
      const urlEmissaoComToken = `${apiUrlFocus}/v2/nfe2?ref=${referenciaInterna}&token=${tokenFocus}`;
      
      logger.info(`[${tenantId}] [${chargeId}] Enviando para URL (com token): ${urlEmissaoComToken}`);
      // logger.info(`[${tenantId}] [${chargeId}] Payload para Focus NFe:`, JSON.stringify(payloadNFe, null, 2)); // Já logado acima

      let respostaFocus: any;
      try {
          const fetchResponse = await fetch(urlEmissaoComToken, {
              method: "POST",
              headers: {
                  "Content-Type": "application/json",
                  // Nenhum header 'Authorization' aqui para este endpoint
              },
              body: JSON.stringify(payloadNFe),
              // Considerar timeout, embora fetch não suporte diretamente como axios.
              // Para Cloud Functions, o timeout da função é o limite principal.
          });

          respostaFocus = await fetchResponse.json(); // Tenta parsear JSON mesmo em caso de erro para obter o corpo

          if (!fetchResponse.ok) {
              logger.error(`[${tenantId}] [${chargeId}] Focus API Error ao emitir NF-e:`, {
                  status: fetchResponse.status,
                  statusText: fetchResponse.statusText,
                  responseBody: respostaFocus, // corpo da resposta já parseado
                  url: urlEmissaoComToken,
              });
              const errorMessage = respostaFocus?.mensagem ||
                                 respostaFocus?.message ||
                                 (Array.isArray(respostaFocus?.erros) && respostaFocus.erros[0]?.mensagem) ||
                                 fetchResponse.statusText ||
                                 "Erro desconhecido da API Focus.";
              
              // Para consistência com o tratamento de erro esperado pelo resto da função,
              // e para fornecer detalhes ao cliente, lançamos HttpsError com o corpo da API.
              // O `notaFiscalDoc` que é passado como 'details' no caso de 'aborted' mais abaixo
              // não está disponível aqui, então passamos o corpo da API.
              throw new HttpsError("internal", `API Focus: ${errorMessage}`, { 
                  apiStatus: fetchResponse.status, 
                  apiBody: respostaFocus, // Este é o corpo da resposta da API Focus com o erro
                  // Adicionamos os campos que a lógica posterior poderia esperar de 'respostaFocus'
                  status: respostaFocus?.status || `erro_api_${fetchResponse.status}`,
                  mensagem_sefaz: respostaFocus?.mensagem_sefaz,
                  erros: respostaFocus?.erros,
              });
          }
          logger.info(`[${tenantId}] [${chargeId}] Resposta da Focus API (emissão bem-sucedida HTTP):`, respostaFocus);

      } catch (error) {
          if (error instanceof HttpsError) { // Se já é um HttpsError (lançado acima ou por outra validação)
              throw error;
          }
          // Erro de rede ou outro erro do fetch antes do .json(), ou json malformado
          logger.error(`[${tenantId}] [${chargeId}] Erro genérico na chamada fetch para Focus API (emissão):`, error);
          const finalErrorMessage = (error instanceof Error ? error.message : String(error));
          throw new HttpsError("internal", `Erro na chamada à API Focus (emissão): ${finalErrorMessage}`);
      }
      
      // A partir daqui, 'respostaFocus' é o corpo da resposta JSON da API Focus (para HTTP 2xx)
      // logger.info(`[${tenantId}] Resposta da Focus API:`, respostaFocus); // Log já feito acima

      // Passo 9: Tratar a resposta da API Focus
      // Passo 10: Salvar os dados da NF-e emitida no Firestore (coleção notasFiscais)
      const notaFiscalDoc = {
        tenantId,
        chargeId,
        referenciaInterna,
        ambienteFocus,
        statusFocus: respostaFocus.status, // "autorizado", "processando_autorizacao", "erro_autorizacao", "rejeitado", etc.
        mensagemSefaz: respostaFocus.mensagem_sefaz,
        chaveNfe: respostaFocus.chave_nfe,
        numeroNfe: respostaFocus.numero,
        serieNfe: respostaFocus.serie,
        protocoloNfe: respostaFocus.protocolo_nfe, // Ou protocolo_cancelamento, etc.
        caminhoXml: respostaFocus.caminho_xml_nota_fiscal,
        caminhoDanfe: respostaFocus.caminho_danfe,
        focusCompanyId: emitenteConfig.focusCompanyId,
        errosApi: respostaFocus.erros || null, // Array de erros
        criadaEm: admin.firestore.FieldValue.serverTimestamp(),
        payloadEnviado: payloadNFe, // Salvar o payload pode ser útil para debug
        respostaCompletaFocus: respostaFocus, // Salvar a resposta completa para auditoria
      };

      await db.collection(`tenants/${tenantId}/notasFiscais`).add(notaFiscalDoc);
      logger.info(`[${tenantId}] Nota fiscal registrada no Firestore para charge ${chargeId}.`);

      // Passo 11: Atualizar a Charge com referências da NF-e (opcional)
      await chargeDocRef.update({
          nfeId: (await db.collection(`tenants/${tenantId}/notasFiscais`).where("referenciaInterna", "==", referenciaInterna).limit(1).get()).docs[0]?.id || null,
          nfeStatus: respostaFocus.status,
      });


      if (respostaFocus.status === "autorizado" || respostaFocus.status === "processando_autorizacao") {
        return { 
            success: true, 
            message: `NF-e ${respostaFocus.status === "autorizado" ? "autorizada" : "em processamento"}. Chave: ${respostaFocus.chave_nfe || ""}`, 
            data: notaFiscalDoc 
        };
      } else {
        // Se não foi autorizado nem está em processamento, consideramos um erro para o cliente final da função.
        // O erro já foi logado pela makeFocusApiCall.
        throw new HttpsError("aborted", 
            `Falha ao emitir NF-e. Status Focus: ${respostaFocus.status}. Mensagem: ${respostaFocus.mensagem_sefaz || JSON.stringify(respostaFocus.erros)}`, 
            notaFiscalDoc);
      }

    } catch (error: any) {
      logger.error(`[${tenantId}] ERRO GERAL em emitNFe para charge ${chargeId}:`, error);
      if (error instanceof HttpsError) {
        throw error;
      }
      throw new HttpsError("internal", `Erro inesperado ao emitir NF-e: ${error.message}`, { originalError: error });
    }
  });

// Não se esqueça de exportar a função em functions/src/index.ts:
// No módulo nfe (functions/src/nfe/index.ts):
// export * from "./nfeEmit.callable";
// E depois no functions/src/index.ts principal:
// export * from "./nfe"; (ou o nome do seu módulo nfe)