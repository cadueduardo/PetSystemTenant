# Guideline para Implementação de Emissão de Nota Fiscal (NF-e e NFS-e)

## 1. Visão Geral

Este documento descreve a arquitetura e o plano de implementação para o sistema de emissão de Notas Fiscais eletrônicas (NF-e para produtos e NFS-e para serviços) dentro do PetSystemTenant. O sistema permitirá que cada tenant configure seus próprios dados fiscais, incluindo certificados digitais, e emita notas fiscais de forma integrada à plataforma.

A solução buscará um provedor de API de NF que ofereça:
*   Ambiente de homologação (sandbox) para testes.
*   Suporte para NF-e e NFS-e.
*   Gerenciamento seguro de certificados digitais ou orientação para tal.
*   APIs claras e bem documentadas para emissão, consulta e cancelamento.

## 2. Provedor de API de Nota Fiscal Escolhido: Focus NFe

Após análise e considerando a necessidade de um bom ambiente de sandbox, a Focus NFe foi a escolhida inicialmente.

**Detalhes da API Focus NFe:**

*   **Documentação Oficial:** [https://focusnfe.com.br/doc/](https://focusnfe.com.br/doc/)
*   **Autenticação:** Via Token. O mesmo token obtido no painel da Focus NFe é utilizado para os ambientes de homologação e produção. A distinção do ambiente é feita pela URL da API utilizada.
*   **URL de Sandbox (Homologação):** `https://homologacao.focusnfe.com.br`
*   **URL de Produção:** `https://api.focusnfe.com.br`
*   **Observação Importante:** Ao realizar chamadas para a API (especialmente para emissão), verifique na documentação do endpoint específico se é necessário enviar um parâmetro indicando o ambiente (ex: "ambiente": 2 para homologação, "ambiente": 1 para produção).
*   **Webhooks:** Suportados e recomendados para receber atualizações de status das notas (autorização, cancelamento, etc.). O cadastro é feito no painel da Focus NFe, apontando para um endpoint no backend do PetSystemTenant.

Uma análise mais aprofundada será necessária para escolher o que melhor se adapta, mas opções como [Nome do Provedor A], [Nome do Provedor B] e [Nome do Provedor C] também podem ser consideradas futuramente se necessário.

## 3. Estrutura do Backend

### 3.1. Módulo de Integração com a API de NF

*   **Serviço de Configuração:**
    *   Permitir que cada tenant insira suas credenciais da API do provedor de NF (se o modelo for o tenant ter sua própria conta Focus - verificar este fluxo).
    *   Coletar os dados do tenant necessários para o cadastro na API da Focus NFe (CNPJ, Razão Social, Endereço, etc., muitos podem vir da tabela `Tenants`).
    *   Chamar a API da Focus NFe para cadastrar/atualizar a empresa do tenant sob a conta principal do PetSystemTenant.
    *   Armazenar o ID da empresa retornado pela Focus NFe e quaisquer outros dados de configuração relevantes.
    *   Armazenar de forma segura as chaves de API da conta principal do PetSystemTenant na Focus NFe.
*   **Serviço de Certificado Digital:**
    *   Interface para upload do certificado A1 (arquivo .pfx) e senha.
    *   Armazenamento seguro do certificado (ex: Azure Key Vault, HashiCorp Vault, ou sistema de arquivos com criptografia forte e controle de acesso restrito).
    *   Renovação e gestão de validade dos certificados.
*   **Serviço de Emissão de NF:**
    *   Receber os dados da venda/serviço.
    *   Validar os dados necessários para a NF (dados do cliente, produtos/serviços, impostos).
    *   Montar o payload da requisição para a API do provedor.
    *   Enviar a requisição e tratar a resposta (sucesso, erro, status de processamento).
    *   Armazenar os dados da NF emitida (número, série, chave de acesso, XML, PDF do DANFE/DANFSe).
*   **Serviço de Consulta de NF:**
    *   Permitir a consulta do status de uma NF emitida.
    *   Atualizar o status local da NF com base na resposta do provedor.
*   **Serviço de Cancelamento de NF:**
    *   Permitir o cancelamento de uma NF (dentro das regras fiscais).
    *   Enviar a requisição de cancelamento para o provedor.
*   **Webhooks (se suportado pelo provedor):**
    *   Endpoint para receber atualizações de status das NFs do provedor de forma assíncrona.

### 3.2. Banco de Dados

Novas tabelas ou ajustes nas existentes serão necessários:

*   `TenantFiscalConfigs`:
    *   `TenantId` (FK)
    *   `ProviderApiUrl` (Pode ser fixo se sempre Focus NFe)
    *   `ProviderApiKey` (Token da conta principal PetSystemTenant na Focus NFe, criptografado)
    *   `FocusNFeCompanyId` (ID da empresa do tenant retornado pela API Focus, após cadastro)
    *   `CertificateStoragePath` (ou referência ao Vault)
    *   `CertificatePassword` (criptografado, se necessário armazenar e não apenas usar no upload)
    *   `DefaultCfopProdutos`
    *   `DefaultCfopServicos`
    *   `OutrasConfiguracoesFiscais` (JSONB para flexibilidade)
    *   `focus_nfe_api_token_homologacao` (encrypted, token da conta principal PetSystemTenant)
    *   `focus_nfe_api_token_producao` (encrypted, token da conta principal PetSystemTenant)
    *   `certificado_digital_path` (ou referência ao armazenamento seguro)
    *   `certificado_digital_senha` (encrypted)
    *   `status` (ativo, inativo, pendente_configuracao_fiscal)
    *   ... outros campos relevantes ...

### 3.3. Segurança

*   **Certificados Digitais:**
    *   Armazenamento extremamente seguro é crucial. Utilizar serviços de cofre de segredos (Vaults) é o ideal.
    *   A senha do certificado deve ser tratada com o mesmo nível de segurança.
*   **Chaves de API:**
    *   Armazenar criptografadas no banco de dados.
*   **Comunicação:**
    *   Toda comunicação com o provedor de API de NF deve ser via HTTPS.

## 4. Estrutura do Frontend

### 4.1. Página de Integrações (`IntegrationsMarketplacePage.jsx` - Estilo Marketplace)

A `IntegrationsMarketplacePage.jsx` servirá como uma vitrine ou "marketplace" para todas as integrações externas disponíveis para o tenant.

*   **Layout:** Exibição em formato de grid de cards, onde cada card representa uma integração.
*   **Card de Integração (Exemplo para NF):
    *   Ícone/Logo representativo.
    *   Título: "Emissão de Nota Fiscal Eletrônica".
    *   Breve descrição dos benefícios.
    *   **Status da Assinatura/Configuração (Badge):** "Não Contratado", "Não Configurado", "Ativo", "Inativo", "Requer Atenção", "Pendente Pagamento".
    *   **Informações de Custo:** Exibição clara do valor da integração (se aplicável, como adição à mensalidade).
    *   **Botão de Ação Dinâmico:** "Contratar", "Configurar", "Gerenciar", "Ativar", "Desativar", dependendo do status.
*   Ao interagir com o card, o sistema deve guiar o usuário pelo fluxo de contratação (se necessário), configuração e gerenciamento.
*   **Lógica de Status:** A determinação do status e do texto do botão de ação deve considerar tanto a configuração técnica da integração quanto o status da assinatura/contratação do tenant para aquele módulo.

### 4.2. Página de Configuração da Nota Fiscal (`NFeSetupPage.jsx` - Dedicada)

Esta será uma página dedicada para o tenant configurar todos os aspectos da emissão de Notas Fiscais, acessada após o fluxo de contratação, se aplicável.

*   **URL:** Algo como `/tenant/integracoes/nfe/setup`.
*   **Navegação:** Incluir um botão "Voltar para Central de Integrações".
*   **Conteúdo:**
    *   **Seção de Dados da Empresa e Endereço Fiscal (Read-Only):**
        *   Exibição dos dados cadastrais e fiscais do tenant (Razão Social, CNPJ, IE, IM, Regime Tributário, email, endereço completo, etc.) pré-preenchidos a partir dos dados do `currentTenant` (gerenciados em `Settings.jsx`).
        *   Estes campos são apenas para visualização nesta página.
        *   Um alerta e um botão/link direcionarão o usuário para a página de "Configurações" (`/tenant/configuracoes`) caso necessitem editar essas informações primárias.
    *   **Seção de Certificado Digital (Editável):**
        *   Input para upload do arquivo de certificado digital (`.pfx`) (obrigatório).
        *   Input para a senha do certificado digital (obrigatório).
    *   **Seção de Preferências de Emissão (Editável):**
        *   Seleção do Ambiente da Focus NFe: "Homologação (Testes)" ou "Produção (Real)". (Default: Homologação).
        *   Checkbox para `habilita_nfe` (NF de Produtos).
        *   Checkbox para `habilita_nfse` (NF de Serviços).
    *   **Botão de Ação:** "Salvar e Configurar Emissão de NF".
*   **Lógica:**
    *   Ao carregar, os dados do `currentTenant` preenchem os campos de visualização.
    *   A submissão do formulário envia para o backend: `tenantId`, o arquivo do certificado, a senha do certificado, o ambiente selecionado e as flags de habilitação (NF-e/NFS-e).
    *   O backend usará o `tenantId` para buscar os dados completos da empresa, fazer o cadastro na Focus NFe e armazenar o certificado de forma segura.

### 4.3. Emissão de NF

*   **A partir da Venda:**
    *   Opção na tela de detalhes de uma venda concluída para "Emitir Nota Fiscal".
    *   Pré-preenchimento dos dados da NF com base nos dados da venda e do cliente.
    *   Campos para ajustes finais e informações fiscais específicas (ex: impostos, informações adicionais).
*   **Emissão Avulsa (Opcional):**
    *   Formulário para emissão de NF não diretamente ligada a uma venda registrada no sistema.

### 4.4. Listagem e Gerenciamento de NFs

*   Tabela listando todas as NFs emitidas pelo tenant.
*   Colunas: Número, Série, Cliente, Data de Emissão, Status, Ações.
*   Filtros por período, status, cliente.
*   Ações:
    *   Visualizar detalhes da NF.
    *   Baixar XML da NF.
    *   Baixar DANFE/DANFSe (PDF).
    *   Solicitar cancelamento (se o status permitir).
    *   Reenviar NF por e-mail para o cliente.

### 4.1. Tabela: `Tenants` (Estrutura Existente a ser Considerada/Complementada)

*   ... (campos existentes como `company_name`, `document`, `address`, etc.) ...
*   Adicionar/Confirmar campos fiscais básicos já presentes:
    *   `inscricao_estadual`
    *   `inscricao_municipal`
    *   `cnae_principal`
    *   `regime_tributario`
*   `nf_module_active`: BOOLEAN (Indica se o módulo de NF está ativo para este tenant)
*   `nf_setup_complete`: BOOLEAN (Indica se a configuração fiscal inicial foi concluída pelo tenant)

### 4.2. Tabela: `TenantFiscalConfigs` (Nova)

Esta tabela armazenará as configurações fiscais específicas para cada tenant, necessárias para a emissão de notas fiscais.

*   `id`: PK (UUID/Serial)
*   `tenant_id`: FK para `Tenants(id)` (UNIQUE)
*   **Certificado Digital:**
    *   `digital_certificate_name`: STRING (Nome original do arquivo .pfx)
    *   `digital_certificate_data`: BYTEA/BLOB (Conteúdo do arquivo .pfx, criptografado. Alternativamente, caminho para armazenamento seguro)
    *   `digital_certificate_password`: STRING (Senha do certificado, criptografada)
    *   `digital_certificate_valid_from`: TIMESTAMP (Início da validade do certificado)
    *   `digital_certificate_valid_to`: TIMESTAMP (Fim da validade do certificado)
*   **Configurações da API de NF:**
    *   `nf_api_provider`: STRING (Default: "FocusNFe")
    *   `nf_api_token`: STRING (Token da API, criptografado. Preenchido pelo cliente ou gerenciado via parceria)
    *   `nf_environment`: STRING (Default: "homologation"; Valores: "homologation", "production")
*   **Sequenciais e Séries de NF (Opcional/Controle Interno):**
    *   `last_nfe_number_issued`: INTEGER
    *   `nfe_serie`: INTEGER (Default: 1)
    *   `last_nfse_number_issued`: INTEGER
    *   `nfse_serie`: INTEGER (Default: 1)
*   **Timestamps:**
    *   `created_at`: TIMESTAMP
    *   `updated_at`: TIMESTAMP

**Considerações Importantes para `TenantFiscalConfigs`:**

*   **Segurança do Certificado:** O arquivo `.pfx` e sua senha devem ser manuseados com extremo cuidado, garantindo criptografia em trânsito e em repouso.
*   **Armazenamento do Certificado:** Decidir entre armazenar o binário criptografado no banco de dados ou em um sistema de arquivos seguro dedicado (com apenas a referência no banco).
*   **Flexibilidade do Token:** O campo `nf_api_token` é projetado para ser flexível, acomodando tanto o cenário onde o cliente insere seu próprio token quanto um futuro modelo de parceria onde o PetSystemTenant gerencia isso.

### 4.3. Tabela: `NotasFiscais`

*   ... (campos existentes como `TenantId`, `Number`, `Series`, `Key`, `XML`, `PDF`, etc.) ...

## 5. Lista de Tarefas (Checklist)

### Backend:
*   [ ] Pesquisar e definir o provedor de API de NF (Focus NFe escolhido inicialmente).
*   [x] Modelar e implementar as tabelas `TenantFiscalConfigs` e `NotasFiscais` (ou usar subcoleção `integrations/nfeConfig` - **Implementado como subcoleção `tenants/{tenantId}/integrations/nfeConfig`**).
*   [x] Esboçar a Firebase Function `setupNFeIntegration` (callable) com validações e fluxo principal.
    *   [x] Recebimento de dados do frontend (ambiente, certificado base64, senha).
    *   [x] Validação dos dados cadastrais do tenant.
    *   [x] Upload do certificado `.pfx` para Firebase Storage. (**Resolvido problema de bucket e permissões iniciais.**)
    *   [x] Integração com Google Secret Manager para buscar tokens da API Focus NFe. (**Resolvido problema de nome do secret.**)
    *   [x] Salvamento da configuração (`focusCompanyId`, `certificatePath`, `environment`) no Firestore. (Estrutura existe, pendente sucesso da API Focus para `focusCompanyId`)
*   [x] Implementar a chamada à API da Focus NFe para cadastrar/gerenciar empresas (tenants) - **Estrutura inicial para verificar existência (GET) e criar (POST) / atualizar (PUT) implementada em `setupNFeIntegration`.**
*   [ ] **Testar Efetivamente `setupNFeIntegration`**: Realizar teste end-to-end com dados reais (certificado de teste) no ambiente de homologação Focus NFe. (**Em andamento. Problema atual: API Focus NFe retorna 404 ao tentar criar empresa via POST /v2/empresas.**)
*   [ ] **Investigar erro 404 da API Focus NFe**: Analisar o motivo do erro 404 Not Found ao tentar criar (POST) uma nova empresa em `https://homologacao.focusnfe.com.br/v2/empresas`. Verificar o payload enviado (logar o objeto `focusPayload` completo se necessário), comparar com a documentação da API da Focus NFe para o cadastro de empresas (campos obrigatórios, formatos), e considerar realizar um teste direto da requisição POST usando cURL ou Postman. (**FOCO ATUAL DA INVESTIGAÇÃO**)
*   [ ] **Revisar/Completar `mapRegimeTributarioToFocusCode`**: Garantir mapeamento correto conforme documentação Focus NFe.
*   [ ] **Tratamento de Erro API Focus**: Refinar tratamento de erros em `makeFocusApiCall` (embora já esteja capturando e propagando o erro 404).
*   [ ] **(Opcional/Recomendado) Senha do Certificado no Secret Manager**: Implementar busca da senha do certificado via Secret Manager.
*   [ ] Implementar o serviço de configuração de API (incluindo cadastro do tenant na Focus) e certificado para o tenant - (Parcialmente coberto por `setupNFeIntegration`).
*   [x] Definir e implementar a estratégia de armazenamento seguro de certificados - (Armazenamento no Firebase Storage implementado; senha ainda via request, considerar Secret Manager).
*   [x] Implementar o módulo de comunicação com a API do provedor (autenticação, headers) - (Função `makeFocusApiCall` implementada).
*   [ ] Implementar o serviço de emissão de NF-e (incluindo mapeamento de dados).
*   [ ] Implementar o serviço de emissão de NFS-e (incluindo mapeamento de dados).
*   [ ] Implementar o serviço de consulta de status de NF.
*   [ ] Implementar o serviço de cancelamento de NF.
*   [ ] Implementar o armazenamento dos arquivos XML e PDF das notas.
*   [ ] (Opcional) Implementar endpoints para webhooks do provedor.
*   [ ] Criar testes unitários e de integração para os serviços de NF.
*   [ ] Detalhar as entidades e campos necessários no banco de dados, alinhado com `optimization_plan.md`.
*   [ ] Definir os DTOs (Data Transfer Objects) para a comunicação com a API da Focus NFe.
*   [ ] Implementar a lógica para processar as notificações e atualizar o status da NF no banco de dados local.
*   [ ] Configurar os Webhooks no painel da Focus NFe (ambiente de homologação) para apontar para os endpoints desenvolvidos.
*   [ ] Obter o Token de API de Produção da Focus NFe para cada tenant.
*   [ ] Configurar os Webhooks no ambiente de produção da Focus NFe.
*   [ ] Garantir que os certificados digitais de produção dos tenants estejam corretamente configurados.
*   [ ] Desenvolver lógica de backend para gerenciar status de assinatura de integrações (ativação, desativação, billing).

### Frontend:
*   [x] Refatorar `IntegrationsMarketplacePage.jsx` para um layout de "marketplace" com cards para cada integração (WAHA, NF-e) - Estrutura inicial.
*   [ ] Expandir `IntegrationsMarketplacePage.jsx` para incluir lógica de status de assinatura, exibição de custos e botões de ação dinâmicos (Contratar, Ativar, Gerenciar).
*   [x] Desenvolver a página dedicada `NFeSetupPage.jsx` para configuração da NF (certificado, API token, ambiente) - Esqueleto inicial criado, UI do formulário de dados da empresa e certificado adicionada. Campos de dados da empresa agora são read-only, com link para `Settings.jsx`. Adicionado seletor de ambiente (Homologação/Produção).
*   [x] Implementar os formulários e a lógica de estado na `NFeSetupPage.jsx` para:
    *   [x] Coleta/confirmação dos dados da empresa para cadastro na Focus NFe - (Interface exibe dados do `currentTenant` como read-only).
    *   [x] Upload do arquivo de certificado (.pfx) e entrada da senha - (Interface do formulário criada e funcional).
    *   [x] Seleção do ambiente (Homologação/Produção) - (Interface criada).
*   [ ] **Chamar `setupNFeIntegration`**: Garantir que `NFeSetupPage.jsx` chama a Cloud Function com o payload correto. (Chamada implementada, payload sendo enviado; problema atual no backend/API externa).
*   [ ] **Feedback ao Usuário em `NFeSetupPage.jsx`**: Melhorar feedback durante e após a submissão (loading, sucesso, erros).
*   [x] Implementar a lógica de upload do arquivo de certificado (.pfx) como base64 e envio da senha para o backend a partir da `NFeSetupPage.jsx`.
*   [ ] Implementar a funcionalidade de "Testar Conexão" na `NFeSetupPage.jsx`.
*   [ ] Desenvolver a interface para acionar a emissão de NF a partir de uma venda (manter fluxo, ajustar se necessário para obter configurações da nova tabela).
*   [ ] Desenvolver o formulário de NF com os campos necessários e validações.
*   [ ] Desenvolver a interface de listagem de NFs com filtros e paginação.
*   [ ] Implementar as ações na listagem de NFs (download XML/PDF, cancelamento).
*   [ ] Implementar a visualização de detalhes de uma NF.
*   [ ] Tratar os diferentes status da NF e da configuração da integração na interface.
*   [ ] Criar testes para os componentes de NF e para a página de configuração.

### Geral:
*   [ ] **Certificado de Teste Focus NFe**: Investigar se a Focus NFe fornece um certificado digital de teste ou orientações para criar/obter um para o ambiente de homologação.
*   [ ] Documentar a configuração e uso do novo módulo.
*   [ ] Realizar testes end-to-end no ambiente de homologação do provedor de NF.

Este guideline servirá como base para o desenvolvimento. Detalhes específicos da API do provedor escolhido influenciarão a implementação final. 