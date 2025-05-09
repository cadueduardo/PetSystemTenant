import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
// import { CallableContext } from "firebase-functions/v1/https"; // Importando CallableContext explicitamente
import { Storage } from "@google-cloud/storage"; // Descomentar e usar
import { SecretManagerServiceClient } from "@google-cloud/secret-manager"; // <--- Adicionar Import
import * as https from "https"; // Ou usar axios/node-fetch para chamadas HTTP

// admin.initializeApp(); // Garantir que está inicializado no index.ts principal
const db = admin.firestore();
const storage = new Storage(); // Inicializar Storage
const secretManagerClient = new SecretManagerServiceClient(); // <--- Inicializar Cliente
// const GCLOUD_PROJECT_ID = process.env.GCLOUD_PROJECT || functions.config().gcp?.project_id; // Obter Project ID - COMENTADO E CORRETO
const STORAGE_BUCKET_NAME = process.env.STORAGE_BUCKET || 'NF_TENANT_FOCUS_API'; // Removido functions.config()

// Função auxiliar para acessar secrets
async function accessSecretVersion(secretName: string, version: string = 'latest'): Promise<string | null> {
  if (!process.env.GCLOUD_PROJECT) {
    functions.logger.error("GCLOUD_PROJECT environment variable not set.");
    throw new functions.https.HttpsError("internal", "Project ID não configurado no ambiente do servidor.");
  }
  try {
    const name = `projects/${process.env.GCLOUD_PROJECT}/secrets/${secretName}/versions/${version}`;
    const [secretVersion] = await secretManagerClient.accessSecretVersion({
      name: name,
    });
    const payload = secretVersion.payload?.data?.toString();
    if (payload) {
      functions.logger.info(`Secret ${secretName} version ${version} acessado com sucesso.`);
      return payload;
    } else {
      functions.logger.error(`Payload do secret ${secretName} version ${version} está vazio.`);
      return null;
    }
  } catch (error: any) {
    functions.logger.error(`Erro ao acessar secret ${secretName} version ${version}:`, error.message);
    // Lançar um erro mais específico para o frontend
    throw new functions.https.HttpsError("internal", `Falha ao acessar configuração segura (${secretName}). Verifique as permissões e se o secret existe.`, { secretName: secretName, errorDetails: error.message });
  }
}

interface SetupNFeData {
    tenantId: string; // Recebido diretamente do frontend
    environment: 'homologation' | 'production'; // Renomeado para consistência
    certificatePassword: string; // Renomeado para consistência
    certificateBase64: string; // Renomeado para consistência
    // Opcional: adicionar habilitaNFe/habilitaNFSe se for enviar do frontend
}

export const setupNFeIntegration = functions.https.onCall(async (request: functions.https.CallableRequest<SetupNFeData>) => {
    // 1. Obter Tenant ID e Autenticação
    const auth = request.auth;
    if (!auth) {
        throw new functions.https.HttpsError("unauthenticated", "Usuário não autenticado.");
    }
    const uid = auth.uid; // UID do usuário que fez a chamada
    
    // !!! Usar tenantId do request.data !!!
    const tenantId = request.data.tenantId;
    if (!tenantId) {
        // Essa validação agora pega se o frontend não enviar
        throw new functions.https.HttpsError("invalid-argument", "Tenant ID é obrigatório no corpo da requisição.");
    }
    
    // --- Verificação Opcional: O usuário pode configurar ESTE tenant? ---
    // Esta verificação assume que o token de autenticação AINDA contém o tenant_id
    // Se o usuário é admin GERAL, ele pode configurar qualquer tenant?
    // Se ele pertence a um tenant específico, ele só pode configurar o SEU tenant?
    const userTenantIdFromToken = auth.token.tenantId;
    if (userTenantIdFromToken && userTenantIdFromToken !== tenantId) {
        // Se o token tem um tenantId, e ele é DIFERENTE do tenantId que se quer configurar
        functions.logger.warn(`[AUTH] Usuário ${uid} (tenant ${userTenantIdFromToken}) tentou configurar tenant ${tenantId}`);
        throw new functions.https.HttpsError("permission-denied", "Você não tem permissão para configurar este tenant.");
    }
    // TODO: Refinar a lógica de permissão acima conforme necessário (ex: checar roles isAdmin/isCollaborator do token)
    functions.logger.info(`[AUTH] Usuário ${uid} autorizado para configurar tenant ${tenantId}`);
    // --- Fim Verificação Opcional ---

    // 2. Validação de Entrada (usando nomes atualizados)
    if (!request.data.certificateBase64 || !request.data.certificatePassword || !request.data.environment) {
        throw new functions.https.HttpsError("invalid-argument", "Dados incompletos: Certificado (Base64), senha e ambiente são obrigatórios.");
    }
    if (request.data.environment !== 'homologation' && request.data.environment !== 'production') {
        throw new functions.https.HttpsError("invalid-argument", "Ambiente inválido. Use 'homologation' ou 'production'.");
    }

    functions.logger.info(`[${tenantId}] Iniciando configuração NF-e para ambiente: ${request.data.environment}`);

    try {
        // 3. Buscar Dados Cadastrais Completos do Tenant (usando tenantId do request.data)
        const tenantDocRef = db.collection("tenants").doc(tenantId);
        const tenantDoc = await tenantDocRef.get();
        if (!tenantDoc.exists) {
            throw new functions.https.HttpsError("not-found", `Tenant ${tenantId} não encontrado.`);
        }
        const tenantData = tenantDoc.data();
        if (!tenantData) {
             throw new functions.https.HttpsError("internal", `Dados do tenant ${tenantId} estão vazios.`);
        }
        
        // --> Início da Validação dos Dados do Tenant <--
        const requiredFields = [
            { field: 'legal_name', alternate: 'company_name', path: tenantData, label: 'Razão Social / Nome da Empresa' },
            { field: 'document', path: tenantData, label: 'CNPJ' }, // TODO: Adicionar validação de formato CNPJ?
            { field: 'regime_tributario', path: tenantData, label: 'Regime Tributário' },
            { field: 'email', path: tenantData, label: 'Email' }, // Email é usado pela Focus
            { field: 'street', path: tenantData.address, label: 'Logradouro (Endereço)' },
            { field: 'number', path: tenantData.address, label: 'Número (Endereço)' },
            { field: 'neighborhood', path: tenantData.address, label: 'Bairro (Endereço)' },
            { field: 'city', path: tenantData.address, label: 'Cidade (Endereço)' },
            { field: 'state', path: tenantData.address, label: 'Estado (UF - Endereço)' },
            { field: 'cep', path: tenantData.address, label: 'CEP (Endereço)' }, // TODO: Validar formato CEP?
            //{ field: 'ibge_code', path: tenantData.address, label: 'Código IBGE do Município (Endereço)' } // Descomentar se tiver este campo
        ];

        const missingFields = [];
        for (const req of requiredFields) {
            const value = req.path?.[req.field];
            const alternateValue = req.alternate ? req.path?.[req.alternate] : undefined;
            if (!value && !alternateValue) {
                missingFields.push(req.label);
            }
            // Adicionar validações específicas se necessário (ex: formato CNPJ, CEP)
            if (req.field === 'cep' && value && String(value).replace(/[^0-9]/g, '').length !== 8) {
                missingFields.push(`${req.label} (formato inválido)`);
            }
             if (req.field === 'state' && value && String(value).length !== 2) {
                missingFields.push(`${req.label} (deve ter 2 caracteres)`);
            }
            // Validar Regime Tributário (se os valores são conhecidos)
            if (req.field === 'regime_tributario' && value && !['1', '2', '3', '4', 'simples_nacional', 'simples_nacional_excesso', 'lucro_presumido', 'lucro_real', 'mei'].includes(String(value))) {
                 missingFields.push(`${req.label} (valor inválido '${value}')`);
            }
        }

        // Verificar Código IBGE separadamente, pois é crucial para NFSe
        const codigoMunicipio = tenantData.address?.ibge_code;
        if (!codigoMunicipio) {
            // TODO: Tentar buscar o código IBGE baseado em UF/Cidade se não existir?
            // Por enquanto, apenas adiciona ao erro se NFS-e estiver habilitada.
            // REMOVENDO a checagem de habilitaNFSe pois não está na interface atual
            // if (request.data.habilitaNFSe) { 
            //      missingFields.push('Código IBGE do Município (Necessário para NFS-e)');
            // }
            // Considerar se o Código IBGE deve ser sempre obrigatório ou opcional
            // Se for sempre necessário (mesmo para NF-e em alguns estados), descomente a linha abaixo:
            // missingFields.push('Código IBGE do Município'); 
        } else if (String(codigoMunicipio).replace(/[^0-9]/g, '').length !== 7) {
             missingFields.push('Código IBGE do Município (deve ter 7 dígitos)');
        }

        if (missingFields.length > 0) {
            const errorMessage = `Complete o cadastro da sua empresa em Configurações. Campos faltando ou inválidos: ${missingFields.join(", ")}.`;
            functions.logger.warn(`[${tenantId}] Validação falhou: ${errorMessage}`);
            throw new functions.https.HttpsError("failed-precondition", errorMessage);
        }
        // --> Fim da Validação dos Dados do Tenant <--

        functions.logger.info(`[${tenantId}] Dados do tenant validados com sucesso.`);

        // 4. Decodificar e Salvar Certificado no Firebase Storage (usando nomes atualizados)
        let certificateStoragePath = "";
        try {
            const certificateBuffer = Buffer.from(request.data.certificateBase64, 'base64'); // Usa certificateBase64
            const bucket = storage.bucket(STORAGE_BUCKET_NAME);
            const filePath = `certificates/${tenantId}/focus_nfe_certificate.pfx`;
            const file = bucket.file(filePath);
            
            await file.save(certificateBuffer, {
                contentType: 'application/x-pkcs12',
            });
            certificateStoragePath = filePath;
            functions.logger.info(`[${tenantId}] Certificado salvo com sucesso em: gs://${STORAGE_BUCKET_NAME}/${certificateStoragePath}`);
        } catch (storageError: any) {
            functions.logger.error(`[${tenantId}] Erro ao salvar certificado no Storage:`, storageError);
            throw new functions.https.HttpsError("internal", "Falha ao armazenar o arquivo do certificado.", storageError.message);
        }

        // --- 5. Obter Senha do Certificado --- 
        // A senha vem diretamente do request.data.certificatePassword
        // Se fosse usar Secret Manager, a lógica para buscar/validar a senha do secret viria aqui.
        // Exemplo:
        // const certificatePasswordSecretName = `tenant_${tenantId}_nfe_cert_password`;
        // const certificatePasswordFromSecret = await accessSecretVersion(certificatePasswordSecretName);
        // if (!certificatePasswordFromSecret) { 
        //   throw new functions.https.HttpsError("internal", "Senha do certificado não encontrada no Secret Manager."); 
        // }
        // Por enquanto, a senha é usada diretamente de request.data.certificatePassword se necessário em alguma chamada futura.
        functions.logger.info(`[${tenantId}] Senha do certificado (se fornecida) será usada diretamente do request.`);
        
        // --- 6. Determinar URL da API Focus e Obter Token Principal do Secret Manager --- 
        const apiUrlFocus = request.data.environment === 'homologation' ? 'https://homologacao.focusnfe.com.br' : 'https://api.focusnfe.com.br';
        
        // Determinar o nome do secret baseado no ambiente
        const focusTokenSecretName = request.data.environment === 'homologation' 
            ? 'FOCUSNFE_HOMOLOG_TOKEN' // <-- Use o ID exato do seu secret
            : 'FOCUSNFE_PROD_TOKEN';    // <-- Use o ID exato do seu secret
        
        let tokenPrincipalFocus: string | null = null;
        try {
             tokenPrincipalFocus = await accessSecretVersion(focusTokenSecretName);
        } catch(error) {
            // accessSecretVersion já loga o erro detalhado e lança HttpsError
            // Apenas repassamos o erro
            throw error; 
        }

        if (!tokenPrincipalFocus) {
             // Se chegou aqui, accessSecretVersion retornou null (payload vazio)
             throw new functions.https.HttpsError("internal", `Token da API Focus NFe para ${request.data.environment} está vazio no Secret Manager (${focusTokenSecretName}).`);
        }
        functions.logger.info(`Token Focus NFe para ${request.data.environment} obtido com sucesso do Secret Manager.`);
        // --- Fim Obtenção Token --- 

        // 7. Montar Payload para Cadastro de Empresa na Focus NFe
        const codigoRegimeFocus = mapRegimeTributarioToFocusCode(tenantData.regime_tributario);
        if (!codigoRegimeFocus) {
             // A validação anterior já deveria ter pego isso, mas verificamos de novo.
             throw new functions.https.HttpsError("failed-precondition", `Regime tributário inválido ou não mapeado: ${tenantData.regime_tributario}`);
        }

        const focusPayload = {
            razao_social: tenantData.legal_name || tenantData.company_name,
            nome_fantasia: tenantData.company_name,
            cnpj: tenantData.document?.replace(/[^0-9]/g, ''),
            inscricao_estadual: tenantData.inscricao_estadual?.replace(/[^0-9]/g, '') || undefined, // Usar undefined se for null/empty?
            inscricao_municipal: tenantData.inscricao_municipal?.replace(/[^0-9]/g, '') || undefined, // Usar undefined se for null/empty?
            codigo_de_regime_tributario: codigoRegimeFocus, 
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
            habilita_nfe: true, // TODO: Obter do request.data se for enviado
            habilita_nfse: true, // TODO: Obter do request.data se for enviado
            // Outros campos opcionais podem ser adicionados aqui
        };
        // Remover CNPJ do payload se for nulo ou vazio, pois a API pode rejeitar
        if (!focusPayload.cnpj) {
            delete focusPayload.cnpj;
            // Poderia lançar erro aqui também, pois CNPJ é essencial
            throw new functions.https.HttpsError("failed-precondition", "CNPJ é obrigatório para cadastrar na Focus NFe.");
        }

        functions.logger.info(`[${tenantId}] Payload para Focus NFe montado. Verificando existência...`, { cnpj: focusPayload.cnpj });

        // 8. Chamar API da Focus NFe para Cadastrar/Atualizar Empresa
        let focusNFeCompanyId = null;
        let companyExists = false;

        try {
            // 8.1 Verificar se a empresa já existe na Focus NFe pelo CNPJ
            const checkUrl = `${apiUrlFocus}/v2/empresas?cnpj=${focusPayload.cnpj}`;
            const existingCompanies = await makeFocusApiCall('GET', checkUrl, tokenPrincipalFocus);
            
            if (Array.isArray(existingCompanies) && existingCompanies.length > 0) {
                focusNFeCompanyId = existingCompanies[0].id; // Assumindo que o primeiro resultado é o correto
                companyExists = true;
                functions.logger.info(`[${tenantId}] Empresa já existe na Focus NFe com ID: ${focusNFeCompanyId}. Tentando atualizar...`);
            }
        } catch (error: any) {
            // Se a API retornar erro (ex: 404 Not Found), consideramos que a empresa não existe.
            // Outros erros (ex: 500, 401) serão relançados.
            if (error instanceof functions.https.HttpsError && error.httpErrorCode?.status === 404) {
                 functions.logger.info(`[${tenantId}] Empresa não encontrada na Focus NFe. Tentando criar...`);
                 companyExists = false;
            } else {
                 functions.logger.error(`[${tenantId}] Erro ao verificar empresa na Focus NFe:`, error);
                 throw error; // Relança o erro
            }
        }

        try {
            if (companyExists && focusNFeCompanyId) {
                 // 8.2 Atualizar empresa existente
                 const updateUrl = `${apiUrlFocus}/v2/empresas/${focusNFeCompanyId}`;
                 // A API de PUT pode retornar 200 OK sem corpo ou com o objeto atualizado.
                 await makeFocusApiCall('PUT', updateUrl, tokenPrincipalFocus, focusPayload);
                 functions.logger.info(`[${tenantId}] Empresa atualizada na Focus NFe com ID: ${focusNFeCompanyId}`);
            } else {
                 // 8.3 Criar nova empresa
                 const createUrl = `${apiUrlFocus}/v2/empresas`;
                 const createResponse = await makeFocusApiCall('POST', createUrl, tokenPrincipalFocus, focusPayload);
                 if (!createResponse || !createResponse.id) {
                     throw new Error("Resposta da criação de empresa na Focus NFe não contém ID.");
                 }
                 focusNFeCompanyId = createResponse.id;
                 functions.logger.info(`[${tenantId}] Nova empresa criada na Focus NFe com ID: ${focusNFeCompanyId}`);
            }
        } catch (error: any) {
             functions.logger.error(`[${tenantId}] Erro ao criar/atualizar empresa na Focus NFe:`, error);
             // Tentar limpar certificado/senha se a chamada falhou?
             throw new functions.https.HttpsError("internal", "Falha ao comunicar com a API da Focus NFe para cadastrar/atualizar a empresa.", error.message);
        }
        
        if (!focusNFeCompanyId) {
             throw new functions.https.HttpsError("internal", "Não foi possível obter o ID da empresa na Focus NFe após cadastro/atualização.");
        }

        // 9. Salvar configuração no Firestore
        const integrationConfigRef = db.collection("tenants").doc(tenantId).collection("integrations").doc("nfeConfig");
        await integrationConfigRef.set({
            provider: "FocusNFe",
            environment: request.data.environment,
            focusCompanyId: focusNFeCompanyId,
            certificatePath: certificateStoragePath,
            // NÃO salvar a senha aqui. Se precisar referenciar, salve o nome do secret
            // certificatePasswordSecretName: certificatePasswordSecretName, 
            lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
            status: 'active',
        }, { merge: true });
        functions.logger.info(`[${tenantId}] Configuração NFe salva no Firestore (sem senha).`);

        // 10. Retornar Sucesso
        return {
            success: true,
            message: `Configuração da NF-e (${request.data.environment}) para Focus NFe ${companyExists ? 'atualizada' : 'criada'} com sucesso! ID da Empresa: ${focusNFeCompanyId}`,
            focusCompanyId: focusNFeCompanyId,
        };

    } catch (error: any) {
        functions.logger.error(`[${tenantId}] Erro GERAL ao configurar NF-e:`, error);
        // Garantir que erros HttpsError sejam repassados com seus detalhes
        if (error instanceof functions.https.HttpsError) {
            throw error;
        }
        // Encapsular outros erros
        throw new functions.https.HttpsError("internal", `Erro interno ao processar a configuração NF-e: ${error.message}`, error);
    }
});

// Função para mapear nosso regime tributário para o código da Focus NFe
function mapRegimeTributarioToFocusCode(regimeInterno: string | null | undefined): string | null {
    if (!regimeInterno) return null;
    // TODO: Confirmar estes códigos com a documentação da API de Empresas da Focus NFe!
    switch (String(regimeInterno).toLowerCase()) {
        case '1':
        case 'simples_nacional':
        case 'mei': // Assumindo que MEI é tratado como Simples pela Focus?
            return '1';
        case '2':
        case 'simples_nacional_excesso':
            return '2';
        case '3':
        case 'lucro_presumido':
        case '4':
        case 'lucro_real':
             return '3'; // Assumindo Regime Normal cobre ambos?
        default:
            functions.logger.warn(`Regime tributário interno desconhecido: ${regimeInterno}`);
            return null; // Ou retornar um valor padrão/erro?
    }
}

// Função auxiliar para chamadas à API Focus (Exemplo)
// Descomentar e ajustar conforme necessário
async function makeFocusApiCall(method: string, url: string, token: string, payload?: any): Promise<any> {
    return new Promise((resolve, reject) => {
        const options: https.RequestOptions = {
            method,
            headers: {
                'Authorization': `Basic ${Buffer.from(token + ':').toString('base64')}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            // Definir timeout para evitar que a função fique presa
            timeout: 15000 // 15 segundos
        };

        const req = https.request(url, options, (res) => {
            let responseBody = '';
            res.setEncoding('utf8');
            res.on('data', (chunk) => { responseBody += chunk; });
            res.on('end', () => {
                try {
                    // Tratar respostas vazias (ex: 204 No Content)
                    if (!responseBody && res.statusCode === 204) {
                        resolve({}); // Retorna objeto vazio para sucesso sem conteúdo
                        return;
                    }
                    // Tentar parsear JSON apenas se houver corpo
                    const jsonResponse = responseBody ? JSON.parse(responseBody) : {}; 

                    if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
                        resolve(jsonResponse);
                    } else {
                        // Log detalhado do erro da API externa
                        const errorDetail = jsonResponse.erros?.[0]?.mensagem || jsonResponse.message || jsonResponse.error || responseBody || `Status ${res.statusCode}`;
                        functions.logger.error(`Focus API Error (${res.statusCode}) for ${method} ${url}:`, errorDetail, "Response Body:", responseBody);
                        // Construir um erro HttpsError mais informativo
                        reject(new functions.https.HttpsError(
                            res.statusCode === 404 ? "not-found" : 
                            res.statusCode === 401 ? "unauthenticated" :
                            res.statusCode === 400 ? "invalid-argument" : "internal", 
                            `Erro na API Focus (${res.statusCode}): ${errorDetail}`,
                            { focusResponse: jsonResponse, statusCode: res.statusCode } // Adicionar detalhes extras
                        ));
                    }
                } catch (e: any) {
                    functions.logger.error("Focus API JSON Parse Error:", e, "URL:", url, "Status:", res.statusCode, "Body:", responseBody);
                    reject(new functions.https.HttpsError("internal", "Resposta inválida da API Focus.", { rawResponse: responseBody }));
                }
            });
        });

        req.on('error', (error) => {
            functions.logger.error("Focus API Request Error:", error);
            reject(new functions.https.HttpsError("internal", "Erro ao conectar com a API Focus.", error.message));
        });
        
        req.on('timeout', () => {
            req.destroy();
            functions.logger.error("Focus API Request Timeout for:", url);
            reject(new functions.https.HttpsError("deadline-exceeded", "Tempo limite excedido ao conectar com a API Focus."));
        });

        if (payload && (method === 'POST' || method === 'PUT')) {
            req.write(JSON.stringify(payload));
        }
        req.end();
    });
} 