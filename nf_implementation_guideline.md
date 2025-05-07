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
    *   Permitir que cada tenant insira suas credenciais da API do provedor de NF.
    *   Armazenar de forma segura as chaves de API e outros dados de configuração.
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
    *   `ProviderApiUrl`
    *   `ProviderApiKey` (criptografado)
    *   `CertificateStoragePath` (ou referência ao Vault)
    *   `CertificatePassword` (criptografado, se necessário armazenar e não apenas usar no upload)
    *   `DefaultCfopProdutos`
    *   `DefaultCfopServicos`
    *   `OutrasConfiguracoesFiscais` (JSONB para flexibilidade)
    *   `focus_nfe_api_token_homologacao` (encrypted)
    *   `focus_nfe_api_token_producao` (encrypted)
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

### 4.1. Página de Integrações (`IntegrationsPage.jsx` - Estilo Marketplace)

A `IntegrationsPage.jsx` servirá como uma vitrine ou "marketplace" para todas as integrações externas disponíveis para o tenant.

*   **Layout:** Exibição em formato de grid de cards, onde cada card representa uma integração (ex: WhatsApp WAHA, Emissão de Nota Fiscal).
*   **Card de Integração (Exemplo para NF):**
    *   Ícone/Logo representativo.
    *   Título: "Emissão de Nota Fiscal Eletrônica".
    *   Breve descrição dos benefícios.
    *   Indicador de Status (Badge): "Não Configurado", "Ativo", "Requer Atenção".
    *   Botão de Ação: "Configurar" (se não ativa/configurada) ou "Gerenciar" (se ativa).
*   Ao clicar em "Configurar" (ou "Gerenciar") no card de Nota Fiscal, o usuário será redirecionado para uma página dedicada de configuração.

### 4.2. Página de Configuração da Nota Fiscal (`NFeSetupPage.jsx` - Dedicada)

Esta será uma página dedicada para o tenant configurar todos os aspectos da emissão de Notas Fiscais.

*   **URL:** Algo como `/integrations/nfe-setup`.
*   **Navegação:** Incluir um botão "Voltar para Integrações" ou breadcrumbs.
*   **Conteúdo:**
    *   **Seção de Certificado Digital:**
        *   Input para upload do arquivo de certificado digital (`.pfx`).
        *   Input para a senha do certificado digital.
        *   Exibição de informações do certificado após o upload (nome do arquivo, validade, emissor - se possível extrair).
        *   Feedback visual sobre o status do upload e validação do certificado.
    *   **Seção de Configuração da API (Focus NFe):**
        *   Input para o Token da API Focus NFe (este campo pode ser condicional, dependendo do modelo de parceria final com a Focus NFe – se o tenant fornece ou se é gerenciado centralmente).
        *   Seleção do Ambiente de Emissão: "Homologação" ou "Produção".
    *   **Botões de Ação:**
        *   "Salvar Configurações".
        *   (Opcional, mas recomendado) "Testar Conexão" – para verificar se o certificado e o token (se aplicável) estão corretos e comunicam com a API da Focus NFe (ex: chamando um endpoint de status da API).
        *   Feedback claro ao usuário sobre o sucesso ou falhas na configuração/salvamento.

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
*   [ ] Modelar e implementar as tabelas `TenantFiscalConfigs` e `NotasFiscais`.
*   [ ] Implementar o serviço de configuração de API e certificado para o tenant.
*   [ ] Definir e implementar a estratégia de armazenamento seguro de certificados.
*   [ ] Implementar o módulo de comunicação com a API do provedor (autenticação, headers).
*   [ ] Implementar o serviço de emissão de NF-e (incluindo mapeamento de dados).
*   [ ] Implementar o serviço de emissão de NFS-e (incluindo mapeamento de dados).
*   [ ] Implementar o serviço de consulta de status de NF.
*   [ ] Implementar o serviço de cancelamento de NF.
*   [ ] Implementar o armazenamento dos arquivos XML e PDF das notas.
*   [ ] (Opcional) Implementar endpoints para webhooks do provedor.
*   [ ] Criar testes unitários e de integração para os serviços de NF.
*   [ ] [ ] Pesquisar e definir o provedor de API de NF (Focus NFe escolhido inicialmente).
*   [ ] Detalhar as entidades e campos necessários no banco de dados, alinhado com `optimization_plan.md`.
*   [ ] Definir os DTOs (Data Transfer Objects) para a comunicação com a API da Focus NFe.
*   [ ] [ ] Implementar a lógica para armazenar de forma segura o Token da API da Focus NFe (homologação e produção) por tenant.
*   [ ] [ ] Implementar a lógica para processar as notificações e atualizar o status da NF no banco de dados local.
*   [ ] [ ] Configurar os Webhooks no painel da Focus NFe (ambiente de homologação) para apontar para os endpoints desenvolvidos.
*   [ ] [ ] Obter o Token de API de Produção da Focus NFe para cada tenant.
*   [ ] [ ] Configurar os Webhooks no ambiente de produção da Focus NFe.
*   [ ] [ ] Garantir que os certificados digitais de produção dos tenants estejam corretamente configurados.

### Frontend:
*   [x] Refatorar `IntegrationsPage.jsx` para um layout de "marketplace" com cards para cada integração (WAHA, NF-e).
*   [x] Desenvolver a página dedicada `NFeSetupPage.jsx` para configuração da NF (certificado, API token, ambiente) - Esqueleto inicial criado.
*   [ ] Implementar os formulários e a lógica de estado na `NFeSetupPage.jsx` para:
    *   [ ] Upload do arquivo de certificado (.pfx) e entrada da senha.
    *   [ ] Entrada do Token da API FocusNFe e seleção do ambiente (Homologação/Produção).
    *   [ ] Lógica de estado para gerenciar os campos do formulário.
    *   [ ] Função inicial para "Salvar Configurações" (ex: console.log dos dados).
*   [ ] Implementar a lógica de upload seguro do arquivo de certificado (.pfx) e envio da senha para o backend a partir da `NFeSetupPage.jsx`.
*   [ ] Implementar a funcionalidade de "Testar Conexão" na `NFeSetupPage.jsx`.
*   [ ] Desenvolver a interface para acionar a emissão de NF a partir de uma venda (manter fluxo, ajustar se necessário para obter configurações da nova tabela).
*   [ ] Desenvolver o formulário de NF com os campos necessários e validações.
*   [ ] Desenvolver a interface de listagem de NFs com filtros e paginação.
*   [ ] Implementar as ações na listagem de NFs (download XML/PDF, cancelamento).
*   [ ] Implementar a visualização de detalhes de uma NF.
*   [ ] Tratar os diferentes status da NF e da configuração da integração na interface.
*   [ ] Criar testes para os componentes de NF e para a página de configuração.

### Geral:
*   [ ] Documentar a configuração e uso do novo módulo.
*   [ ] Realizar testes end-to-end no ambiente de homologação do provedor de NF.

Este guideline servirá como base para o desenvolvimento. Detalhes específicos da API do provedor escolhido influenciarão a implementação final. 