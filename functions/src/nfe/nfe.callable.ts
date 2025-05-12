import { HttpsError, onCall, CallableRequest } from "firebase-functions/v2/https"; // SDK v2
import * as logger from "firebase-functions/logger"; // Logger do SDK v2
import * as admin from "firebase-admin";
import { Storage } from "@google-cloud/storage";
import { SecretManagerServiceClient } from "@google-cloud/secret-manager";
import * as https from "https"; // Mantido para makeFocusApiCall

// admin.initializeApp() // Inicializado no index.ts
const db = admin.firestore();

// MODIFICAÇÃO IMPORTANTE AQUI:
const PROJECT_ID = process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || 'petclinic-14d1f';
const storageClient = new Storage({ projectId: PROJECT_ID }); 

const secretManager = new SecretManagerServiceClient(); 
// const STORAGE_BUCKET_NAME = process.env.STORAGE_BUCKET || 'nf_tenant_focus_api'; // Linha original comentada
const TARGET_STORAGE_BUCKET_NAME = 'nf_tenant_focus_api'; // Usar diretamente o nome do bucket desejado

// Função auxiliar para acessar secrets (adaptada para logger v2 e HttpsError v2)
async function accessSecretVersion(secretName: string, version: string = 'latest'): Promise<string | null> {
  if (!process.env.GCLOUD_PROJECT) {
    logger.error("GCLOUD_PROJECT environment variable not set.");
    throw new HttpsError("internal", "Project ID não configurado no ambiente do servidor.");
  }
  try {
    const name = `projects/${process.env.GCLOUD_PROJECT}/secrets/${secretName}/versions/${version}`;
    const [secretVersionResponse] = await secretManager.accessSecretVersion({
      name: name,
    });
    const payload = secretVersionResponse.payload?.data?.toString();
    if (payload) {
      logger.info(`Secret ${secretName} version ${version} acessado com sucesso.`);
      return payload;
    } else {
      logger.error(`Payload do secret ${secretName} version ${version} está vazio.`);
      return null;
    }
  } catch (error: any) {
    logger.error(`Erro ao acessar secret ${secretName} version ${version}:`, error.message);
    throw new HttpsError("internal", `Falha ao acessar configuração segura (${secretName}).`, { secretName: secretName, errorDetails: error.message });
  }
}

interface SetupNFeData {
    tenantId: string;
    environment: 'homologation' | 'production';
    certificatePassword: string;
    certificateBase64: string;
}

const allowedCorsOrigins = [
    'http://localhost:5173',
    'https://petclinic-14d1f.web.app',
     /petclinic-14d1f--.+\.web\.app$/ // Regex para previews do Firebase Hosting
];

export const setupNFeIntegration = onCall(
    { 
        region: "southamerica-east1",
        cors: allowedCorsOrigins,
        // Outras opções como memory, timeoutSeconds podem ser adicionadas aqui
    },
    async (request: CallableRequest<SetupNFeData>) => {
        // 1. Obter Tenant ID e Autenticação
        if (!request.auth) {
            throw new HttpsError("unauthenticated", "Usuário não autenticado.");
        }
        const uid = request.auth.uid;
        const tenantId = request.data.tenantId;

        if (!tenantId) {
            throw new HttpsError("invalid-argument", "Tenant ID é obrigatório no corpo da requisição.");
        }

        const userTenantIdFromToken = request.auth.token.tenantId;
        if (userTenantIdFromToken && userTenantIdFromToken !== tenantId) {
            logger.warn(`[AUTH] Usuário ${uid} (tenant ${userTenantIdFromToken}) tentou configurar tenant ${tenantId}`);
            throw new HttpsError("permission-denied", "Você não tem permissão para configurar este tenant.");
        }
        logger.info(`[AUTH] Usuário ${uid} autorizado para configurar tenant ${tenantId}`);

        // 2. Validação de Entrada
        if (!request.data.certificateBase64 || !request.data.certificatePassword || !request.data.environment) {
            throw new HttpsError("invalid-argument", "Dados incompletos: Certificado (Base64), senha e ambiente são obrigatórios.");
        }
        if (request.data.environment !== 'homologation' && request.data.environment !== 'production') {
            throw new HttpsError("invalid-argument", "Ambiente inválido. Use 'homologation' ou 'production'.");
        }

        logger.info(`[${tenantId}] Iniciando configuração NF-e para ambiente: ${request.data.environment}`);

        try {
            const tenantDocRef = db.collection("tenants").doc(tenantId);
            const tenantDoc = await tenantDocRef.get();
            if (!tenantDoc.exists) {
                throw new HttpsError("not-found", `Tenant ${tenantId} não encontrado.`);
            }
            const tenantData = tenantDoc.data();
            if (!tenantData) {
                throw new HttpsError("internal", `Dados do tenant ${tenantId} estão vazios.`);
            }

            // Validação dos dados do tenant (requiredFields, etc.) - SEM ALTERAÇÕES NA LÓGICA INTERNA
            // ... (código de validação existente)
             const requiredFields = [
                { field: 'legal_name', alternate: 'company_name', path: tenantData, label: 'Razão Social / Nome da Empresa' },
                { field: 'document', path: tenantData, label: 'CNPJ' }, 
                { field: 'regime_tributario', path: tenantData, label: 'Regime Tributário' },
                { field: 'email', path: tenantData, label: 'Email' }, 
                { field: 'street', path: tenantData.address, label: 'Logradouro (Endereço)' },
                { field: 'number', path: tenantData.address, label: 'Número (Endereço)' },
                { field: 'neighborhood', path: tenantData.address, label: 'Bairro (Endereço)' },
                { field: 'city', path: tenantData.address, label: 'Cidade (Endereço)' },
                { field: 'state', path: tenantData.address, label: 'Estado (UF - Endereço)' },
                { field: 'cep', path: tenantData.address, label: 'CEP (Endereço)' }, 
            ];

            const missingFields: string[] = []; // Tipagem explícita
            for (const req of requiredFields) {
                const value = req.path?.[req.field];
                const alternateValue = req.alternate ? req.path?.[req.alternate] : undefined;
                if (!value && !alternateValue) {
                    missingFields.push(req.label);
                }
                if (req.field === 'cep' && value && String(value).replace(/[^0-9]/g, '').length !== 8) {
                    missingFields.push(`${req.label} (formato inválido)`);
                }
                if (req.field === 'state' && value && String(value).length !== 2) {
                    missingFields.push(`${req.label} (deve ter 2 caracteres)`);
                }
                if (req.field === 'regime_tributario' && value && !['1', '2', '3', '4', 'simples_nacional', 'simples_nacional_excesso', 'lucro_presumido', 'lucro_real', 'mei'].includes(String(value))) {
                    missingFields.push(`${req.label} (valor inválido '${value}')`);
                }
            }
            const codigoMunicipio = tenantData.address?.ibge_code;
            if (!codigoMunicipio) {
                // missingFields.push('Código IBGE do Município'); // Decidir se é sempre obrigatório
            } else if (String(codigoMunicipio).replace(/[^0-9]/g, '').length !== 7) {
                missingFields.push('Código IBGE do Município (deve ter 7 dígitos)');
            }
            if (missingFields.length > 0) {
                const errorMessage = `Complete o cadastro da sua empresa em Configurações. Campos faltando ou inválidos: ${missingFields.join(", ")}.`;
                logger.warn(`[${tenantId}] Validação falhou: ${errorMessage}`);
                throw new HttpsError("failed-precondition", errorMessage);
            }
            logger.info(`[${tenantId}] Dados do tenant validados com sucesso.`);
            // Fim da validação

            let certificateStoragePath = "";
            try {
                const certificateBuffer = Buffer.from(request.data.certificateBase64, 'base64');
                
                // Adicionar logs para depuração
                logger.info(`[${tenantId}] Tentando salvar no bucket. TARGET_STORAGE_BUCKET_NAME: "${TARGET_STORAGE_BUCKET_NAME}", PROJECT_ID: "${PROJECT_ID}"`);

                // Obter referência ao bucket desejado explicitamente
                const targetBucket = storageClient.bucket(TARGET_STORAGE_BUCKET_NAME); 
                
                const filePath = `certificates/${tenantId}/focus_nfe_certificate.pfx`;
                // Usar a referência 'targetBucket' para obter o arquivo
                const file = targetBucket.file(filePath); 
                
                await file.save(certificateBuffer, { contentType: 'application/x-pkcs12' });
                certificateStoragePath = filePath;
                logger.info(`[${tenantId}] Certificado salvo com sucesso em: gs://${TARGET_STORAGE_BUCKET_NAME}/${certificateStoragePath}`);
            } catch (storageError: any) {
                logger.error(`[${tenantId}] Erro ao salvar certificado no Storage:`, storageError);
                // Adicionar mais detalhes do erro, se possível
                let detailedErrorMessage = "Falha ao armazenar o arquivo do certificado.";
                if (storageError.errors && storageError.errors.length > 0 && storageError.errors[0].message) {
                    detailedErrorMessage += ` Detalhes: ${storageError.errors[0].message}`;
                } else if (storageError.message) {
                    detailedErrorMessage += ` Detalhes: ${storageError.message}`;
                }
                throw new HttpsError("internal", detailedErrorMessage, storageError);
            }

            // MODIFICAÇÃO IMPORTANTE AQUI: URL para API de Empresas será sempre a de produção.
            const apiUrlFocusForCompanySetup = 'https://api.focusnfe.com.br'; 
            // A URL de homologação (https://homologacao.focusnfe.com.br) continua relevante para EMISSÃO de notas em homologação,
            // mas o cadastro da empresa, conforme a hipótese, ocorreria na URL de produção.

            const focusTokenSecretName = 'FOCUS_NFE_TOKEN'; // O token é o mesmo para ambos, conforme confirmado.
            
            let tokenPrincipalFocus: string | null = null;
            try {
                // Log ainda pode mencionar o ambiente para clareza, mas o token é o mesmo.
                tokenPrincipalFocus = await accessSecretVersion(focusTokenSecretName);
            } catch (error) {
                throw error; // accessSecretVersion já lança HttpsError
            }
            if (!tokenPrincipalFocus) {
                throw new HttpsError("internal", `Token da API Focus NFe está vazio (${focusTokenSecretName}).`);
            }
            // Log ajustado para refletir que o token é para o 'ambiente de destino da empresa'
            logger.info(`Token Focus NFe para ambiente de empresa (produção) obtido com sucesso.`);

            const codigoRegimeFocus = mapRegimeTributarioToFocusCode(tenantData.regime_tributario);
            if (!codigoRegimeFocus) {
                throw new HttpsError("failed-precondition", `Regime tributário inválido ou não mapeado: ${tenantData.regime_tributario}`);
            }

            const focusPayload = {
                nome: tenantData.legal_name || tenantData.company_name,
                nome_fantasia: tenantData.company_name,
                cnpj: tenantData.document?.replace(/[^0-9]/g, ''),
                
                inscricao_estadual: tenantData.inscricao_estadual === "ISENTO" 
                                    ? "ISENTO" 
                                    : tenantData.inscricao_estadual?.replace(/[^0-9A-Za-z]/g, '') || undefined,
                inscricao_municipal: tenantData.inscricao_municipal?.replace(/[^0-9]/g, '') || undefined,
                
                regime_tributario: codigoRegimeFocus,
                simples_nacional: calcularSimplesNacional(tenantData.regime_tributario, codigoRegimeFocus), 
                incentivador_cultural: tenantData.incentivador_cultural || false, 

                email: tenantData.email,
                telefone: tenantData.phone?.replace(/[^0-9]/g, '') || undefined,
                logradouro: tenantData.address?.street,
                numero: tenantData.address?.number,
                bairro: tenantData.address?.neighborhood,
                complemento: tenantData.address?.complement || "",
                cep: tenantData.address?.cep?.replace(/[^0-9]/g, ''),
                municipio: tenantData.address?.city,
                uf: tenantData.address?.state,
                codigo_municipio: tenantData.address?.ibge_code?.replace(/[^0-9]/g, '') || undefined,
                pais: "Brasil",
                codigo_pais: "1058",
                
                cnae: tenantData.cnae_principal?.replace(/[^0-9]/g, '') || undefined, 

                // Adicionar informações do certificado digital
                nome_arquivo_certificado: "focus_nfe_certificate.pfx", // Nome padrão para o arquivo
                conteudo_arquivo_certificado: request.data.certificateBase64,
                senha_certificado: request.data.certificatePassword,

                habilita_nfe: true, 
                habilita_nfse: true, 
            };
            if (!focusPayload.cnpj) {
                delete focusPayload.cnpj;
                throw new HttpsError("failed-precondition", "CNPJ é obrigatório para cadastrar na Focus NFe.");
            }
            logger.info(`[${tenantId}] Payload para Focus NFe montado. Verificando existência...`, { cnpj: focusPayload.cnpj });

            let focusNFeCompanyId: string | null = null; // Tipagem explícita
            let companyExists = false;

            try {
                // Usar apiUrlFocusForCompanySetup para a verificação
                const checkUrl = `${apiUrlFocusForCompanySetup}/v2/empresas?cnpj=${focusPayload.cnpj}`;
                const existingCompanies = await makeFocusApiCall('GET', checkUrl, tokenPrincipalFocus);
                if (Array.isArray(existingCompanies) && existingCompanies.length > 0) {
                    focusNFeCompanyId = existingCompanies[0].id;
                    companyExists = true;
                    logger.info(`[${tenantId}] Empresa já existe na Focus NFe com ID: ${focusNFeCompanyId}. Tentando atualizar...`);
                }
            } catch (error: any) {
                if (error instanceof HttpsError && error.httpErrorCode && error.httpErrorCode.status === 404) {
                    logger.info(`[${tenantId}] Empresa não encontrada na Focus NFe. Tentando criar...`);
                    companyExists = false;
                } else {
                    logger.error(`[${tenantId}] Erro ao verificar empresa na Focus NFe:`, error);
                    throw error;
                }
            }

            try {
                if (companyExists && focusNFeCompanyId) {
                    // Atualiza empresa existente: O focusPayload já contém os dados do certificado.
                    const updateUrl = `${apiUrlFocusForCompanySetup}/v2/empresas/${focusNFeCompanyId}`;
                    await makeFocusApiCall('PUT', updateUrl, tokenPrincipalFocus, focusPayload);
                    logger.info(`[${tenantId}] Empresa atualizada na Focus NFe com ID: ${focusNFeCompanyId} (via URL de produção)`);
                } else {
                    // Cria nova empresa em duas etapas:
                    // Etapa 1: Criar a empresa sem os dados do certificado.
                    const {
                        nome_arquivo_certificado,
                        conteudo_arquivo_certificado,
                        senha_certificado,
                        ...companyDataOnlyPayload // Restante dos campos vão para companyDataOnlyPayload
                    } = focusPayload;

                    const createUrl = `${apiUrlFocusForCompanySetup}/v2/empresas`;
                    logger.info(`[${tenantId}] Etapa 1: Tentando criar empresa (sem cert) na Focus NFe. URL: ${createUrl}, Payload JSON:`, JSON.stringify(companyDataOnlyPayload, null, 2));
                    const createResponse = await makeFocusApiCall('POST', createUrl, tokenPrincipalFocus, companyDataOnlyPayload);
                    
                    if (!createResponse || !createResponse.id) {
                        throw new Error("Resposta da criação de empresa (etapa 1) na Focus NFe não contém ID.");
                    }
                    focusNFeCompanyId = createResponse.id;
                    logger.info(`[${tenantId}] Etapa 1: Nova empresa criada na Focus NFe com ID: ${focusNFeCompanyId}.`);

                    // Etapa 2: Atualizar a empresa recém-criada APENAS com os dados do certificado.
                    const certificateOnlyPayload = {
                        nome_arquivo_certificado: focusPayload.nome_arquivo_certificado,
                        conteudo_arquivo_certificado: focusPayload.conteudo_arquivo_certificado,
                        senha_certificado: focusPayload.senha_certificado
                    };
                    const updateWithCertUrl = `${apiUrlFocusForCompanySetup}/v2/empresas/${focusNFeCompanyId}`;
                    logger.info(`[${tenantId}] Etapa 2: Tentando adicionar certificado (payload mínimo) à empresa ID ${focusNFeCompanyId}. URL: ${updateWithCertUrl}`, JSON.stringify(certificateOnlyPayload, null, 2));
                    await makeFocusApiCall('PUT', updateWithCertUrl, tokenPrincipalFocus, certificateOnlyPayload); 
                    logger.info(`[${tenantId}] Etapa 2: Certificado adicionado/atualizado para a empresa ID ${focusNFeCompanyId}.`);
                }
            } catch (error: any) {
                logger.error(`[${tenantId}] Erro ao criar/atualizar empresa na Focus NFe:`, error);
                // Se o erro for uma HttpsError já formatada pela makeFocusApiCall, propague-a.
                if (error instanceof HttpsError) throw error;
                // Caso contrário, encapsule em uma HttpsError genérica.
                throw new HttpsError("internal", "Falha ao comunicar com a API da Focus NFe para cadastrar/atualizar a empresa.", { errorDetails: error.message });
            }
            
            if (!focusNFeCompanyId) {
                throw new HttpsError("internal", "Não foi possível obter o ID da empresa na Focus NFe após cadastro/atualização.");
            }

            // PASSO ADICIONAL: Buscar os tokens de emissão da empresa recém-cadastrada/atualizada
            let companyFocusHomologationToken: string | null = null;
            let companyFocusProductionToken: string | null = null;

            try {
                const companyDetailsUrl = `${apiUrlFocusForCompanySetup}/v2/empresas/${focusNFeCompanyId}`;
                logger.info(`[${tenantId}] Buscando detalhes da empresa na Focus NFe para obter tokens de emissão. URL: ${companyDetailsUrl}`);
                const companyDetails = await makeFocusApiCall('GET', companyDetailsUrl, tokenPrincipalFocus);

                if (companyDetails && companyDetails.id) { // Verifica se a resposta é válida e contém o ID esperado
                    companyFocusHomologationToken = companyDetails.token_homologacao || null;
                    companyFocusProductionToken = companyDetails.token_producao || null;
                    logger.info(`[${tenantId}] Tokens de emissão obtidos. Homologação: ${companyFocusHomologationToken ? 'OK' : 'NÃO ENCONTRADO'}, Produção: ${companyFocusProductionToken ? 'OK' : 'NÃO ENCONTRADO'}`);
                    
                    if (!companyFocusHomologationToken || !companyFocusProductionToken) {
                        logger.warn(`[${tenantId}] Um ou ambos os tokens de emissão (homologação/produção) não foram retornados pela API da Focus para a empresa ${focusNFeCompanyId}.`);
                        // Decide-se prosseguir mesmo sem os tokens, mas logando o aviso.
                        // Poderia lançar um erro aqui se fossem estritamente obrigatórios para salvar a configuração.
                    }
                } else {
                    logger.error(`[${tenantId}] Resposta inválida ao buscar detalhes da empresa ${focusNFeCompanyId} na Focus NFe.`);
                    throw new HttpsError("internal", `Falha ao obter detalhes e tokens da empresa ${focusNFeCompanyId} na Focus NFe após cadastro.`);
                }
            } catch (error: any) {
                logger.error(`[${tenantId}] Erro ao buscar detalhes/tokens da empresa ${focusNFeCompanyId} na Focus NFe:`, error);
                // Se o erro for uma HttpsError já formatada, propague-a.
                if (error instanceof HttpsError) throw error;
                // Caso contrário, encapsule.
                throw new HttpsError("internal", `Falha ao buscar tokens de emissão para a empresa ${focusNFeCompanyId}.`, { errorDetails: error.message });
            }

            const integrationConfigRef = db.collection("tenants").doc(tenantId).collection("integrations").doc("nfeConfig");
            await integrationConfigRef.set({
                provider: "FocusNFe",
                environment: request.data.environment, // Ambiente de emissão de notas
                focusCompanyId: focusNFeCompanyId,
                focusCompanyHomologationToken: companyFocusHomologationToken,
                focusCompanyProductionToken: companyFocusProductionToken,
                certificatePath: certificateStoragePath,
                lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
                status: 'active',

                // Adicionar os dados fiscais do emitente que foram enviados/confirmados pela Focus
                company_name: focusPayload.nome, // Razão Social
                legal_name: focusPayload.nome_fantasia, // Nome Fantasia
                cnpj: focusPayload.cnpj,
                // Preservar "ISENTO" se for o caso, senão o valor limpo enviado para Focus
                inscricao_estadual: tenantData.inscricao_estadual === "ISENTO" ? "ISENTO" : focusPayload.inscricao_estadual,
                inscricao_municipal: focusPayload.inscricao_municipal,
                regime_tributario_empresa: focusPayload.regime_tributario, // Código '1', '2', '3' da Focus
                simples_nacional_empresa: focusPayload.simples_nacional, // true/false
                incentivador_cultural_empresa: focusPayload.incentivador_cultural,
                email_emitente: focusPayload.email, // Email do emitente usado na Focus
                telefone_emitente: focusPayload.telefone, // Telefone do emitente usado na Focus
                cnae_emitente: focusPayload.cnae,

                address_tenant: { // Endereço do emitente usado/confirmado na Focus
                    street: focusPayload.logradouro,
                    number: focusPayload.numero,
                    complement: focusPayload.complemento,
                    neighborhood: focusPayload.bairro,
                    city: focusPayload.municipio,
                    state: focusPayload.uf,
                    zipCode: focusPayload.cep,
                    codigo_municipio: focusPayload.codigo_municipio, // Código IBGE do município do emitente
                    // pais: focusPayload.pais, // Já é "Brasil"
                    // codigo_pais: focusPayload.codigo_pais, // Já é "1058"
                },
                // Outros campos do focusPayload que podem ser úteis para referência futura
                // habilita_nfe: focusPayload.habilita_nfe,
                // habilita_nfse: focusPayload.habilita_nfse,

            }, { merge: true });

            logger.info(`[${tenantId}] Configuração NFe completa salva no Firestore, incluindo dados detalhados do emitente.`);

            return {
                success: true,
                message: `Configuração da NF-e (${request.data.environment}) para Focus NFe ${companyExists ? 'atualizada' : 'criada'} com sucesso! ID da Empresa: ${focusNFeCompanyId}`,
                focusCompanyId: focusNFeCompanyId,
            };

        } catch (error: any) {
            logger.error(`[${tenantId}] Erro GERAL ao configurar NF-e:`, error);
            if (error instanceof HttpsError) {
                throw error;
            }
            throw new HttpsError("internal", `Erro interno ao processar a configuração NF-e: ${error.message}`, error);
        }
    }
);

// mapRegimeTributarioToFocusCode (adaptado para logger v2)
function mapRegimeTributarioToFocusCode(regimeInterno: string | null | undefined): string | null {
    if (!regimeInterno) return null;
    switch (String(regimeInterno).toLowerCase()) {
        case '1':
        case 'simples_nacional':
        case 'mei':
            return '1';
        case '2':
        case 'simples_nacional_excesso':
            return '2';
        case '3':
        case 'lucro_presumido':
        case '4':
        case 'lucro_real':
             return '3';
        default:
            logger.warn(`Regime tributário interno desconhecido: ${regimeInterno}`);
            return null;
    }
}

// Função para determinar o valor do campo simples_nacional da Focus NFe
function calcularSimplesNacional(regimeInterno: string | null | undefined, codigoRegimeFocus: string | null): boolean {
    if (!regimeInterno || !codigoRegimeFocus) return false; 

    // Se o código Focus para Simples Nacional for '1' (geralmente MEI ou Simples Nacional puro)
    if (codigoRegimeFocus === '1') {
        return true; 
    }
    // Se o código Focus para Simples Nacional - Excesso for '2'
    if (codigoRegimeFocus === '2') {
        return false; // Neste caso, a API da Focus pode esperar simples_nacional como false
    }
    // Outros regimes (Lucro Presumido/Real, código '3') não são Simples Nacional
    return false;
}

// makeFocusApiCall (adaptado para logger v2 e HttpsError v2)
async function makeFocusApiCall(method: string, url: string, token: string, payload?: any): Promise<any> {
    return new Promise((resolve, reject) => {
        const options: https.RequestOptions = {
            method,
            headers: {
                'Authorization': `Basic ${Buffer.from(token + ':').toString('base64')}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            timeout: 15000 
        };

        const req = https.request(url, options, (res) => {
            let responseBody = '';
            res.setEncoding('utf8');
            res.on('data', (chunk) => { responseBody += chunk; });
            res.on('end', () => {
                try {
                    if (!responseBody && res.statusCode === 204) {
                        resolve({}); 
                        return;
                    }
                    const jsonResponse = responseBody ? JSON.parse(responseBody) : {}; 

                    if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
                        resolve(jsonResponse);
                    } else {
                        const errorDetail = jsonResponse.erros?.[0]?.mensagem || jsonResponse.message || jsonResponse.error || responseBody || `Status ${res.statusCode}`;
                        logger.error(`Focus API Error (${res.statusCode}) for ${method} ${url}:`, errorDetail, "Response Body:", responseBody);
                        reject(new HttpsError(
                            res.statusCode === 404 ? "not-found" : 
                            res.statusCode === 401 ? "unauthenticated" :
                            res.statusCode === 400 ? "invalid-argument" : "internal", 
                            `Erro na API Focus (${res.statusCode}): ${errorDetail}`,
                            { focusResponse: jsonResponse, statusCode: res.statusCode }
                        ));
                    }
                } catch (e: any) {
                    logger.error("Focus API JSON Parse Error:", e, "URL:", url, "Status:", res.statusCode, "Body:", responseBody);
                    reject(new HttpsError("internal", "Resposta inválida da API Focus.", { rawResponse: responseBody }));
                }
            });
        });

        req.on('error', (error) => {
            logger.error("Focus API Request Error:", error);
            reject(new HttpsError("internal", "Erro ao conectar com a API Focus.", error.message));
        });
        
        req.on('timeout', () => {
            req.destroy();
            logger.error("Focus API Request Timeout for:", url);
            reject(new HttpsError("deadline-exceeded", "Tempo limite excedido ao conectar com a API Focus."));
        });

        if (payload && (method === 'POST' || method === 'PUT')) {
            req.write(JSON.stringify(payload));
        }
        req.end();
    });
} 