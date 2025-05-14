# Migração do PetFacil APP para MongoDB

## Objetivo
Migrar todo o backend e dados do projeto PetFacil APP do Firebase/Google Cloud para MongoDB, eliminando dependências do GCP e otimizando custos e performance.

---

## Etapas da Migração

### 1. Levantamento e Planejamento
- Mapear todas as coleções, subcoleções e regras do Firestore.
- Identificar integrações com Firebase Auth e planejar substituição.
- Listar funções backend que acessam Firestore e planejar refatoração para MongoDB.

### 2. Setup Inicial
- Instalar e configurar MongoDB na nova VM (Oracle Cloud).
- Configurar backend Node.js para conectar ao MongoDB.
- Definir estrutura de models/schemas (Mongoose ou driver nativo).

### 3. Migração de Dados
- Criar scripts para exportar dados do Firestore e importar no MongoDB.
- Validar integridade e consistência dos dados migrados.

### 4. Refatoração do Backend
- Refatorar módulos backend para usar MongoDB (substituir Firebase SDK por queries MongoDB).
- Ajustar autenticação e regras de acesso.

### 5. Testes e Validação
- Testar todos os fluxos principais do sistema.
- Garantir performance, segurança e integridade dos dados.

### 6. Desativação do Firebase/Google Cloud
- Remover dependências e custos do GCP após validação completa.

---

## Observações
- Documentar todas as decisões e mudanças relevantes neste arquivo.
- Atualizar este documento conforme a migração avança.

---

## Mapeamento dos Domínios/Módulos do Backend Firebase para Models MongoDB

### Módulos/Funções Principais Identificados
A partir dos arquivos `index.ts` dos módulos do backend, foram identificados os seguintes domínios:

- tenancy
- waha
- appointments
- medical
- billing
- orders
- admin
- barcodes
- nfe

### Proposta Inicial de Models MongoDB

| Módulo/Domínio   | Model MongoDB Sugerido         | Descrição/responsabilidade principal                |
|------------------|-------------------------------|----------------------------------------------------|
| tenancy          | Tenant                        | Dados da clínica/loja, configurações multi-tenant   |
| waha             | WahaSession, WahaMessage      | Integração WhatsApp, sessões, mensagens, webhooks   |
| appointments     | Appointment                   | Agendamentos, status, vínculo pet/tutor             |
| medical          | MedicalRecord, Episode        | Prontuários, episódios clínicos, histórico do pet   |
| billing          | Charge, ChargeItem            | Cobranças, itens de cobrança, pagamentos            |
| orders           | OrderService, OrderItem       | Ordens de serviço (petshop), itens de OS            |
| admin            | User, Admin                   | Usuários do sistema, perfis, permissões             |
| barcodes         | BarcodeLookup                 | Consulta de produtos por código de barras           |
| nfe              | Nfe, NfeEmit                  | Notas fiscais eletrônicas, emissão                  |

Esses models servirão como base para a estrutura do banco no MongoDB. Cada domínio pode ser detalhado em submodels ou collections auxiliares conforme necessário.

### Próximos Passos
- Detalhar os campos essenciais de cada model.
- Criar os arquivos de schema/model no backend.
- Refatorar endpoints/funções para usar os novos models.

---

## Model Tenant (MongoDB) - Estrutura Proposta

### Baseado em:
- Estrutura do Firebase (tenant.callable.ts)
- Tipo CreateTenantData (types/index.ts)

### Campos sugeridos para o model Tenant:

```js
{
  company_name: String,           // Nome fantasia
  legal_name: String,             // Razão social (opcional)
  document_type: String,          // Tipo de documento (ex: CNPJ)
  document: String,               // Número do documento
  responsible_name: String,       // Nome do responsável/admin
  adminEmail: String,             // Email do admin
  email: String,                  // Email de contato geral
  phone: String,                  // Telefone
  address: {
    cep: String,
    street: String,
    number: String,
    complement: String,
    neighborhood: String,
    city: String,
    state: String
  },
  business_type: String,          // Tipo de negócio
  selected_modules: [String],     // Módulos contratados
  access_url: String,             // URL de acesso personalizada
  status: String,                 // Status do tenant
  subscription_tier: String,      // Plano de assinatura
  payment_plan: String,           // Plano de pagamento
  payment_method: String,         // Método de pagamento
  adminAuthUid: String,           // UID do admin (Auth)
  createdBy: String,              // UID do super admin criador
  created_at: Date,
  updated_at: Date
}
```

- **Observação:**
  - O campo `id` será o próprio `_id` do MongoDB.
  - Campos como `card_info` não são salvos.
  - O campo `adminAuthUid` pode ser adaptado para o sistema de autenticação futuro.

### Garantias:
- **Separação total:** O model Tenant para MongoDB será criado em arquivos e collections separados, sem dependência ou mistura com o banco Firebase.
- **Documentação:** Todas as decisões e campos estão registrados aqui para rastreabilidade.

---

## Notas sobre Configuração do Firewall (VM Oracle Cloud)

Durante a configuração inicial da conexão entre a máquina local e o MongoDB na VM Oracle Cloud, encontramos erros `ETIMEDOUT`.
A solução envolveu múltiplas camadas de firewall:

1.  **Firewall da VM (Ubuntu):**
    *   O UFW (Uncomplicated Firewall) apresentou problemas em aplicar corretamente as regras na cadeia `INPUT` do `iptables` (a regra `allow 27017/tcp` aparecia em `ufw-user-input` mas não em `INPUT`).
    *   **Solução:** O UFW foi desabilitado (`sudo ufw disable`) e as regras foram adicionadas diretamente ao `iptables`:
        ```bash
        # Permitir SSH e MongoDB
        sudo iptables -I INPUT 1 -p tcp --dport 22 -j ACCEPT
        sudo iptables -I INPUT 1 -p tcp --dport 27017 -j ACCEPT
        ```
    *   As regras do `iptables` foram tornadas persistentes utilizando o pacote `iptables-persistent` e o comando `sudo netfilter-persistent save`.

2.  **Firewall da Oracle Cloud (NSG/Security List):**
    *   Era necessário adicionar uma Regra de Entrada (Ingress) para a porta TCP 27017.
    *   **Ponto Crítico:** A regra **precisou ser configurada como Stateful ("Sim")**. Quando estava como Stateless ("Não"), o tráfego de resposta do MongoDB era bloqueado, resultando em `ETIMEDOUT`.

**Conclusão:** A combinação da configuração direta do `iptables` na VM e a regra **Stateful** na camada da Oracle Cloud foi essencial para estabelecer a conexão.

---

## Histórico de Alterações
- [INICIADO] Documento criado para acompanhamento da migração (branch: feature/mongodb-setup).
- [ALTERADO] Nome do projeto atualizado para PetFacil APP.
- [MAPEAMENTO] Adicionados os domínios principais do backend e proposta inicial de models MongoDB.
- [TENANT] Estrutura detalhada do model Tenant para MongoDB documentada.
- [CONEXÃO] Conexão com MongoDB na VM Oracle Cloud estabelecida com sucesso.
- [TESTE] Script de teste (`scripts/testMongoConnection.js`) criado e executado com sucesso, inserindo um documento Tenant de exemplo.
- [FIREWALL] Documentada a solução detalhada para os problemas de firewall (iptables na VM + Regra Stateful na OCI).
- [AUTH] Implementação da rota de login (`POST /api/auth/login`) com geração de JWT concluída.
- [AUTHZ] Implementação de middlewares de autenticação (`authenticateToken`) e autorização por roles (`authorizeRoles`) concluída e aplicada às rotas de Tenant e User.
- [PET CRUD] Implementação das rotas e controllers para CRUD de Pets (`POST`, `GET`, `PUT`, `DELETE /api/pets`) concluída.
- [AUTHZ FLOW] Testado e refinado fluxo de criação de usuários e pets seguindo regras de negócio (SuperAdmin cria Tenant/Admin -> SuperAdmin define senha do Admin -> Admin loga e cria Tutor/Pet).
- [DEBUG] Resolvidos problemas complexos de login (bcrypt hash) e validação de criação de tenant/usuário.
- [SET PASSWORD] Adicionada rota `PUT /api/users/:userId/set-password` para Super Admin gerenciar senhas.
- [APPOINTMENT CRUD] Implementação das rotas e controllers para CRUD básico de Appointments (`POST`, `GET`, `PUT`, `DELETE /api/appointments`) concluída e testada.
- [EPISODE CRUD] Implementação das rotas e controllers para CRUD básico de Episodes (`POST`, `GET`, `PUT`, `DELETE /api/episodes`) concluída e testada.
- [SERVICE CRUD] Implementação das rotas e controllers para CRUD de Services (`POST`, `GET`, `PUT`, `DELETE /api/services`) concluída e testada.
- [PRODUCT CRUD] Implementação inicial dos models, routes e controllers para Product concluída.
- [PRODUCT FIX] Corrigido schema e controller de Product para alinhar nomes de campo e estrutura com Firebase (ex: tenant_id, cost_price, price, stock_quantity, etc.) e adicionado campo `ncm`. Testes pendentes.
- [REVISÃO SISTEMÁTICA] Iniciada revisão dos módulos anteriores para garantir consistência com Firebase.
- [TENANT FIX] Revisado e corrigido model e controller de Tenant para alinhar campos com Firebase (ibge_code, adminEmail, cnae_principal, etc.).
- [USER FIX] Revisado e corrigido model e controller de User para alinhar campos (tenant_id) e timestamps (created_at/updated_at) com Firebase/Tenant.
- [PET FIX] Revisado e corrigido model, controller e rotas de Pet para alinhar campos com Firebase (tenant_id, owner_id, birth_date, photo_url), substituir `status` por `is_inactive`/`date_of_death`, adicionar campos (`health_plan_id`, `inactivation_reason`), manter campos extras (`prontuarioId`, `allergies`, `observations`) e ajustar timestamps.
- [APPOINTMENT FIX] Revisado e corrigido model e controller de Appointment para alinhar campos com Firebase (tenant_id, patient_id, owner_id, appointment_date, etc.), ajustar timestamps e usar status centralizado. Decidido não usar coleção `queue` separada.
- [EPISODE FIX] Revisado e corrigido model e controller de Episode para alinhar campos com Firebase (tenant_id, patient_id, appointment_id, vet_id, start_timestamp, etc.), adicionar campos (`owner_id`, `created_by`), renomear `observations`->`internal_notes`, ajustar timestamps e nomes nos subschemas (prescrição, exames).
- [ONBOARDING] Implementado e depurado completamente o fluxo de criação de Tenant e Admin de Tenant, incluindo:
  - Autenticação do SuperAdmin.
  - Uso de transações MongoDB para criação atômica de Tenant e User Admin.
  - Geração e envio de email (via Nodemailer/Hostinger) com link contendo token para setup de senha do novo Admin.
  - Rota e controller para o Admin configurar sua senha inicial.
  - Testes de ponta a ponta do fluxo bem-sucedidos.
- [INFRA MONGO] Instância MongoDB configurada como Replica Set (`rs0`) para suportar transações.
- [PET LOGIC] Refinada a lógica de geração do `prontuarioId`: será gerado e associado ao Pet na criação do primeiro `Episode` clínico, e não na criação do Pet. Esta decisão foi baseada na análise do fluxo de atendimento em `AppointmentForm.jsx`.
- [PET TEST] Criação de Pet (`POST /api/pets`) testada com sucesso. Demais operações CRUD (GET, PUT, DELETE) pendentes e documentadas em "Testes Futuros por Coleção".
- [SERVICE FRONTEND] Refatorados `ServiceForm.jsx` e `Services.jsx` para remover `image_url` e usar `type` em vez de `module`.
- [SERVICE MODEL] Model `Service` (`service.model.js`) atualizado: `tenantId` para `tenant_id`, adicionado `points`, timestamps padronizados.
- [SERVICE CTRL] Controller `Service` (`service.controller.js`) atualizado para refletir mudanças no model, no frontend, e para usar `tenant_id`. Adicionado `handleServiceError`.
- [SERVICE TEST] Criação de Serviço (`POST /api/services`) testada com sucesso, incluindo serviços do tipo 'petshop' e 'clinical' (sem `required_specialty` persistido inicialmente).
- [SERVICE MODEL] Campo `required_specialty` adicionado ao `service.model.js` para persistir especialidade em serviços clínicos.
- [PRODUCT DEF] Estrutura final do model `Product` para MongoDB definida, alinhando campos do Firebase, `ProductForm.jsx` e necessidades futuras (como `isVaccine`, `requiresPrescription`). Campos `brand`, `supplier`, `unit` foram removidos da proposta inicial.
- [PRODUCT MODEL] Model `Product` (`product.model.js`) atualizado: `module` para `type` (com enum), `price` para `sellingPrice`, `low_stock_threshold` para `minStockLevel`, remoção de `brand`/`supplier`/`unit`, timestamps padronizados.
- [PRODUCT CTRL] Controller `Product` (`product.controller.js`) atualizado para refletir mudanças no model (incluindo `type`, `sellingPrice`, `minStockLevel`, `stockQuantity`), e para usar `tenant_id`. Adicionado `handleProductError`.
- [PRODUCT TEST] Criação de Produto (`POST /api/products`) testada com sucesso. Corrigido bug que causava erro de validação (`NaN`) para `administrationPrice` quando `null` era enviado.
- [APPOINTMENT TEST] Criação de Agendamento (`POST /api/appointments`) testada com sucesso. Demais operações CRUD (GET, PUT, DELETE) pendentes e documentadas em "Testes Futuros por Coleção".
- [SEGURANÇA] Servidor MongoDB recuperado após incidente de segurança (ransomware) que resultou em perda de dados. Autenticação (`authorization: enabled`), `bindIp: 127.0.0.1`, e `keyFile` para replica set foram (re)configurados em `/etc/mongod.conf`. Usuário administrador (`superAdminPetFacil`) recriado.
- [SEGURANÇA VM] Firewall da Oracle Cloud (NSG/SL) ajustado para remover acesso público à porta 27017 e restringir SSH. Fail2Ban instalado e configurado na VM para monitorar logs SSH.
- [CONEXÃO LOCAL] Túnel SSH (local:27018 -> vm:27017) estabelecido e estabilizado (com `ServerAliveInterval` e `ServerAliveCountMax`) como método principal de conexão para desenvolvimento local ao MongoDB na VM.
- [ENV FIX] Corrigido carregamento da variável `MONGODB_URI` em `src/config/database.js` (problema de não carregamento inicial). Adicionado `dotenv.config({ path: path.resolve(process.cwd(), '.env') })` em `src/server.js` para garantir que as variáveis de ambiente sejam carregadas.
- [ENV JWT] Adicionada `JWT_SECRET` ao arquivo `.env` local, resolvendo erro no login do SuperAdmin.
- [ENV EMAIL] Credenciais SMTP (`EMAIL_USER`, `EMAIL_PASS`) configuradas no `.env`, permitindo o envio real de emails (testado com o fluxo de setup de senha do admin do tenant).
- [SEED SUPERADMIN] Script `scripts/seedSuperAdmin.js` corrigido:
    - Senha do `superAdminPetFacil` no MongoDB alterada para `test123` para evitar problemas com caracteres especiais na URI de conexão durante os testes iniciais.
    - Geração do campo `authUid` implementada usando `crypto.randomUUID()`.
    - Conexão ajustada para usar `localhost:27018` (túnel SSH) e `directConnection=true`.
- [SERVER STARTUP] Erro `MongoServerSelectionError: Server selection timed out after 30000 ms` resolvido adicionando `&directConnection=true` à `MONGODB_URI` no arquivo `.env`.
- [TENANT MODEL FIX] Campo `access_url` removido do `TenantForm.jsx`, `src/models/tenant.model.js` (incluindo seu índice) e `src/controllers/tenant.controller.js`.
- [DB FIX] Índice duplicado `access_url_1` na coleção `tenants` (que impedia criação de tenant com `access_url: null`) removido manualmente via `mongosh`.
- [ONBOARDING FLOW] Fluxo de criação de Tenant e Admin de Tenant, incluindo envio de email para setup de senha e a rota `POST /api/auth/setup-password`, totalmente testado e funcional.
- [CORE DATA CREATION] Criação de Tutor (POST /api/users), Pet (POST /api/pets), e Serviços (POST /api/services - clínico e petshop) testada com sucesso como Admin de Tenant.
- [APPOINTMENT & EPISODE FLOW - INÍCIO] Criação de Agendamento clínico (POST /api/appointments) e subsequente atualização de status para "Chegou" (PUT /api/appointments/:id) testadas.
  - A mudança de status para "Chegou" disparou corretamente a criação automática de um Episódio clínico no backend Node.js/MongoDB.
  - O `prontuarioId` ('PT-7d1b382809') foi gerado e associado ao Pet.
  - O `_id` (ObjectId('6824e8e6ec6c3e1434047d41')) e `episodeNumber` ('EP-maob646d') do episódio criado foram identificados via acesso direto ao MongoDB.
- [PERMISSIONS ISSUE] Identificado problema de permissão: Admin de Tenant (Carla) e até mesmo SuperAdmin não conseguem listar dados via `GET /api/episodes` (erro "Acesso proibido para esta função"). Requer investigação no middleware de autenticação/autorização e/ou na lógica do controller de episódio.
- [ID GENERATION NOTE] Observada divergência na geração de `prontuarioId` e `episodeNumber` no backend Node.js/MongoDB (baseados em timestamp) versus o requisito de serem prefixos seguidos por sequências numéricas aleatórias únicas. Requer ajuste futuro.

---

## Model User (MongoDB) - Estrutura Proposta

### Objetivo
Representar os diferentes tipos de usuários (Super Admins, Admins de Tenant, Colaboradores, Tutores) e gerenciar o acesso e fluxo de convites.

### Baseado em:
- Lógica de criação de Admin em `tenant.callable.ts`.
- Lógica de convite/cadastro de Colaborador em `collaborator.callable.ts`.
- Necessidade de diferenciar Super Admins de usuários de Tenant.

### Campos sugeridos para o model User:

{
  // --- Campos Comuns a todos os Users ---
  tenant_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', index: true }, // Nulo/ausente para Super Admin, associado automaticamente para outros
  authUid: { type: String, required: true, unique: true, index: true }, // ID do sistema de autenticação (gerado pelo backend)
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  role: {
    type: String,
    required: true,
    enum: ['superAdmin', 'admin', 'collaborator', 'tutor'], // Tipos de usuário
  },
  status: { // Ex: "active", "inactive", "pending_invitation", "pending_password_setup"
    type: String,
    enum: ['active', 'inactive', 'pending_invitation', 'pending_password_setup'],
    default: 'active'
  },
  phone: { type: String }, // Telefone principal (comum a vários roles)
  created_at: { type: Date, default: Date.now }, // Gerenciado pelo Mongoose
  updated_at: { type: Date, default: Date.now }, // Gerenciado pelo Mongoose

  // --- Campos para SuperAdmin, Admin, Collaborator (usuários do sistema de gestão) ---
  password: { type: String, select: false }, // Senha (para superAdmin, admin, collaborator)
  displayName: { type: String }, // Nome de exibição para usuários do sistema (superAdmin, admin, collaborator)
                                  // Se um admin/collaborator também puder ser um tutor em outro contexto, full_name seria usado para o perfil tutor.
  profileId: { type: String }, // ID do Perfil de acesso (para admin/collaborators)
  invitationToken: { type: String }, // Token para completar convite de admin/collaborator
  invitationExpires: { type: Date }, // Data de expiração do token de admin/collaborator
  passwordSetupToken: { type: String }, // Token para setup de senha inicial do Admin de Tenant
  passwordSetupExpires: { type: Date }, // Expiração do token de setup de senha

  // --- Campos específicos para role: 'tutor' (espelhando a coleção 'customers' do Firebase) ---
  full_name: { type: String, required: function() { return this.role === 'tutor'; }  }, // Nome completo do tutor (Firebase: full_name)
  cpf: { type: String, index: true, sparse: true }, // CPF do tutor (Firebase: cpf). Sparse permite nulls, mas único se presente.
  // Endereço (campos flat para espelhar Firebase 'customers')
  address: { type: String }, // Rua, Avenida, etc. (Firebase: address)
  address_number: { type: String }, // (Firebase: address_number)
  address_complement: { type: String }, // (Firebase: address_complement)
  neighborhood: { type: String }, // Bairro (Firebase: neighborhood)
  city: { type: String }, // (Firebase: city)
  state: { type: String }, // UF (Firebase: state)
  cep: { type: String }, // CEP / Código Postal (Firebase: cep)
  ibge_code: { type: String }, // Código IBGE da cidade (Firebase: ibge_code)
  phone_waha_id: { type: String, index: true, sparse: true } // ID do WhatsApp (Firebase: phone_waha_id)
}
```

- **Índices:** `tenant_id`, `authUid`, `email` são bons candidatos para índices devido a buscas frequentes.
- **Autenticação:** O campo `authUid` será crucial para vincular o usuário no banco com o sistema de autenticação que substituirá o Firebase Auth.

---

## Histórico de Alterações
- [USER] Estrutura detalhada do model User para MongoDB documentada.

---

## Model Pet (MongoDB) - Estrutura Proposta

### Objetivo
Armazenar as informações cadastrais dos animais atendidos pela clínica (tenant).

### Baseado em:
- Fluxo de cadastro de Clientes e Pets descrito em `project_context.md`.
- Campos presentes em `PetForm.jsx` e `PetDetails.jsx` (inferido).

### Campos sugeridos para o model Pet:

```js
{
  tenant_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true }, // Clínica onde o pet está cadastrado
  owner_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },   // Tutor responsável (User com role='tutor')
  prontuarioId: { type: String, unique: true, sparse: true, index: true }, // ID único do prontuário na clínica (Formato: PT-XXXXXXXX). Gerado quando o primeiro Episode clínico do pet é criado.
  name: { type: String, required: true }, // Nome do Pet
  species: { type: String, required: true }, // Espécie (ex: "dog", "cat")
  breed: { type: String }, // Raça
  gender: { type: String, enum: ['male', 'female'], required: true }, // Sexo (Firebase: "male", "female")
  birth_date: { type: Date }, // Data de Nascimento
  photo_url: { type: String }, // URL da foto do pet (storage externo)
  allergies: [String], // Lista de alergias (mantido do model MongoDB original)
  observations: { type: String }, // Observações gerais (mantido do model MongoDB original)
  is_inactive: { type: Boolean, default: false }, // Status (substitui status string)
  date_of_death: { type: Date, default: null }, // Data do óbito (Firebase: date_of_death)
  inactivation_reason: { type: String, default: null }, // Motivo da inativação (Firebase: inactivation_reason)
  health_plan_id: { type: String, index: true, sparse: true, default: null }, // ID do plano de saúde (Firebase: health_plan_id)
  // O campo 'consultationHistory' (array) que existia no Firebase PETS não será replicado aqui.
  // Essa informação será consultada a partir da coleção 'Episodes' no MongoDB, vinculada ao pet.
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now }
}
```

- **Relações:** `tenant_id` e `owner_id` vinculam o Pet à clínica e ao seu dono.
- **Prontuário:** O `prontuarioId` é um identificador único *dentro do contexto da clínica*. O índice `sparse` permite que pets existam sem ele. Ele será gerado e atribuído ao Pet no momento da criação do seu primeiro Episode clínico. A lógica de geração (formato PT-XXXXXXXX) residirá no backend, associada à criação de Episodes.
- **Histórico:** Detalhes clínicos (consultas, vacinas, etc.) ficarão em uma coleção separada (`Episodes`) referenciando o `_id` deste Pet.

---

## Histórico de Alterações
- [PET] Estrutura detalhada do model Pet para MongoDB documentada.
- [INFRA MONGO] Instância MongoDB configurada como Replica Set (`rs0`) para suportar transações.
- [PET LOGIC] Refinada a lógica de geração do `prontuarioId`: será gerado e associado ao Pet na criação do primeiro `Episode` clínico, e não na criação do Pet. Esta decisão foi baseada na análise do fluxo de atendimento em `AppointmentForm.jsx`.

---

## Model Appointment (MongoDB) - Estrutura Proposta

### Objetivo
Gerenciar os agendamentos de serviços (clínicos ou petshop), incluindo status, confirmações e informações relacionadas.

### Baseado em:
- Módulo `appointments` nas Firebase Functions.
- Fluxo da Agenda descrito em `project_context.md`.
- Triggers e lógicas associadas (confirmação WAHA, check-in, etc.).

### Campos sugeridos para o model Appointment:

```js
{
  tenant_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  patient_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Pet', required: true, index: true },
  owner_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  associated_vet_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true, default: null }, // Veterinário responsável
  serviceId: { type: String, default: null }, // ID do serviço principal (pode virar ObjectId ref:'Service')
  service_name: { type: String, default: null }, // Nome do serviço
  appointment_date: { type: Date, required: true, index: true }, // Data/Hora do agendamento
  duration: { type: Number, default: null }, // Duração estimada
  status: {
    type: String,
    required: true,
    enum: ['Agendado', 'Confirmado', 'Cancelado', 'Chegou', 'Em Atendimento', 'Concluído', 'Não Compareceu'],
    default: 'Agendado',
    index: true
  },
  confirmationStatus: { // Detalhes da confirmação WAHA
    sent: { type: Boolean, default: false },
    sentAt: { type: Date, default: null },
    response: { type: String, enum: ['Sim', 'Não', null], default: null },
    responseAt: { type: Date, default: null }
  },
  check_in_timestamp: { type: Date, default: null }, // Data/Hora do Check-in
  checkout_timestamp: { type: Date, default: null }, // Data/Hora da Conclusão
  additional_info: { type: String, default: null }, // Observações do agendamento
  cancellationReason: { type: String, default: null }, // Motivo do cancelamento
  created_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  created_by_type: { type: String, enum: ['user', 'system', 'unknown'], default: 'unknown' },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now }
}
```

- **Status:** Campo chave que direciona o fluxo e triggers.
- **Confirmação WAHA:** Subdocumento para agrupar informações da interação com o WhatsApp.
- **Serviços:** Inicialmente `serviceId` como String, mas pode ser alterado para `ObjectId` referenciando uma coleção `Services` se esta for criada.

---

## Histórico de Alterações
- [APPOINTMENT] Estrutura detalhada do model Appointment para MongoDB documentada.
- [APPOINTMENT TEST] Criação de Agendamento (`POST /api/appointments`) testada com sucesso. Demais operações CRUD (GET, PUT, DELETE) pendentes e documentadas em "Testes Futuros por Coleção".
- [EPISODE] Model (`episode.model.js`), Controller (`episode.controller.js` com CRUD básico e função interna `createEpisodeInternal`), e Rotas (`episode.routes.js`) implementados. Integração da criação de episódio no `appointment.controller.js` (ao mudar status para 'Chegou' em serviço clínico) finalizada. Teste do fluxo integrado pendente. Testes diretos das rotas CRUD de Episode (GET, PUT, DELETE, POST direto) documentados como pendentes em "Testes Futuros por Coleção".

---

## Model Episode (MongoDB) - Estrutura Proposta

### Objetivo
Registrar os detalhes de cada atendimento clínico (episódio) de um Pet, formando seu histórico médico.

### Baseado em:
- Módulo `medical` nas Firebase Functions.
- Fluxo de atendimento descrito em `project_context.md` (Live Vet, criação via `onAppointmentArrived`).
- Necessidade de armazenar dados clínicos detalhados (anamnese, exames, diagnóstico, prescrição).

### Campos sugeridos para o model Episode:

```js
{
  tenant_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  patient_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Pet', required: true, index: true },
  appointmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Appointment', index: true, default: null }, // Agendamento de origem
  collaboratorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true, default: null }, // Veterinário responsável
  episodeNumber: { type: String, index: true, default: null }, // Identificador do episódio
  status: { type: String, enum: ['Em Atendimento', 'Aguardando Exames', 'Concluído', 'Cancelado'], default: 'Em Atendimento' },
  startTime: { type: Date, default: Date.now }, // Início do atendimento
  endTime: { type: Date, default: null }, // Fim do atendimento
  clinicalSigns: { type: String, default: null }, // Sinais clínicos / Queixa
  anamnesis: { type: String, default: null }, // Anamnese
  physicalExam: { type: String, default: null }, // Exame físico
  suspectedDiagnosis: { type: [String], default: [] }, // Suspeitas
  diagnosis: { type: [String], default: [] }, // Diagnósticos
  treatment: { type: String, default: null }, // Tratamento
  observations: { type: String, default: null }, // Observações gerais
  // Prescrição (subdocumento ou coleção separada?)
  prescription: {
    internalMedication: [{ // Para administração interna
      productId: { type: String, default: null }, // Ou ObjectId ref:'Product'
      productName: { type: String, default: null },
      dosage: { type: String, default: null },
      frequency: { type: String, default: null },
      duration: { type: String, default: null },
      administered: { type: Boolean, default: false },
      administrationDetails: [{ // Log de administração
        timestamp: { type: Date, default: Date.now },
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        notes: { type: String }
      }]
    }],
    externalPrescription: [{ // Receita para o tutor
      medication: { type: String, default: null },
      dosage: { type: String, default: null },
      frequency: { type: String, default: null },
      duration: { type: String, default: null },
      quantity: { type: String, default: null }
    }],
    recommendations: { type: String, default: null } // Recomendações da receita
  },
  // Exames (subdocumento ou coleção separada?)
  exams: [{
    examType: { type: String, default: null },
    requestDate: { type: Date, default: null },
    results: { type: String, default: null },
    resultDate: { type: Date, default: null }
  }],
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now }
}
```

- **Complexidade:** Os campos `prescription` e `exams` podem se tornar complexos. Avaliar se devem ser movidos para coleções separadas (`Prescriptions`, `Exams`) referenciando o `Episode` pode ser benéfico para performance e organização se muitos itens forem adicionados.
- **Rastreabilidade:** Ligações com `Pet`, `Tenant`, `Appointment` e `Collaborator` permitem rastrear todo o contexto do atendimento.

---

## Histórico de Alterações
- [EPISODE] Estrutura detalhada do model Episode para MongoDB documentada.

---

## Model Service (MongoDB) - Estrutura Proposta

### Objetivo
Cadastrar os serviços oferecidos pela clínica/petshop (tenant).

### Baseado em:
- CRUD de Serviços descrito em `project_context.md`.
- Necessidade de vincular serviços aos agendamentos (`Appointment`).

### Campos sugeridos para o model Service:

```js
{
  tenant_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  name: { type: String, required: true, index: true }, // Nome do serviço
  description: { type: String, default: null }, // Descrição
  type: { // Anteriormente 'module' no Firebase
    type: String,
    required: true,
    enum: ['clinical', 'petshop', 'other'], // Mapeia 'clinica' (Firebase) para 'clinical'
    index: true
  },
  category: { type: String, default: null, index: true }, // Categoria para agrupamento
  durationMinutes: { type: Number, default: null }, // Duração padrão em minutos (anteriormente 'duration')
  price: { type: Number, required: true }, // Preço
  points: { type: Number, default: 0 }, // Pontos de fidelidade associados ao serviço
  isActive: { type: Boolean, default: true, index: true }, // Disponibilidade (anteriormente 'is_active')
  requiresAppointment: { type: Boolean, default: true }, // Precisa agendar?
  applicableSpecies: { type: [String], default: [] }, // Espécies aplicáveis (opcional)
  required_specialty: { type: String, default: null, index: true }, // Especialidade veterinária requerida (para type='clinical')
  // image_url foi removido
  created_at: { type: Date, default: Date.now }, // Gerenciado pelo Mongoose
  updated_at: { type: Date, default: Date.now } // Gerenciado pelo Mongoose
}
```

- **Vinculação:** Cada serviço pertence a um `Tenant`.
- **Uso:** Usado para popular opções em agendamentos e para definir preços em cobranças/vendas.

---

## Histórico de Alterações
- [SERVICE] Estrutura detalhada do model Service para MongoDB documentada.

---

## Model Product (MongoDB) - Estrutura Proposta

### Objetivo
Cadastrar os produtos vendidos ou utilizados pela clínica/petshop (tenant).

### Baseado em:
- CRUD de Produtos descrito em `project_context.md`.
- Uso em Vendas, Prescrições (`Episode`).
- Funcionalidade de consulta por código de barras (`lookupBarcode`).

### Campos sugeridos para o model Product:

```js
{
  tenant_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  name: { type: String, required: true, index: true }, // Nome do produto
  description: { type: String, default: null }, // Descrição
  sku: { type: String, index: true, sparse: true, default: null }, // Código interno/SKU (sparse para permitir nulls mas único se presente)
  barcode: { type: String, index: true, sparse: true, default: null }, // Código de barras (sparse)
  category: { type: String, index: true, default: null }, // Categoria
  ncm: { type: String, default: null }, // NCM (Classificação Fiscal)

  type: { // Mapeia 'module' do Firebase e ProductForm.jsx
    type: String,
    required: true,
    enum: ['petshop', 'clinical', 'other'], // 'petshop' é o default vindo do form
    default: 'petshop',
    index: true
  },

  stockQuantity: { type: Number, required: true, default: 0 }, // Firebase: stock_quantity
  minStockLevel: { type: Number, default: 0 }, // Firebase: low_stock_threshold (alert level)
  
  cost_price: { type: Number, default: null }, // Preço de custo
  sellingPrice: { type: Number, required: true }, // Preço de venda (Firebase: price)
  
  image_url: { type: String, default: null }, // URL da imagem (Firebase: image_url, ProductForm: image_url)
  
  allowInternalUse: { type: Boolean, default: false }, // Se pode ser usado internamente (Firebase: allowInternalUse, ProductForm: allowInternalUse)
  administrationPrice: { type: Number, default: null }, // Preço de administração se allowInternalUse=true (Firebase: administrationPrice, ProductForm: administrationPrice)

  requiresPrescription: { type: Boolean, default: false }, // Exige receita? (Importante para medicamentos)
  isVaccine: { type: Boolean, default: false }, // É vacina? (Importante para lógica específica de vacinas)
  vaccineDetails: { // Detalhes específicos se for vacina
    batchNumber: { type: String, default: null }, // Lote da vacina
    expirationDate: { type: Date, default: null } // Validade da vacina
  },
  
  isActive: { type: Boolean, default: true, index: true }, // Produto ativo/disponível para venda/uso

  // Campos removidos da proposta inicial (não presentes no Firebase ou ProductForm.jsx):
  // brand: { type: String, default: null },
  // supplier: { type: String, default: null },
  // unit: { type: String, default: null },

  // Timestamps gerenciados pelo Mongoose
  // created_at: { type: Date, default: Date.now },
  // updated_at: { type: Date, default: Date.now }
}
```

- **Considerações:**
  - `tenant_id`, `name`, `type`, `stockQuantity`, `sellingPrice` são os campos mais críticos.
  - Índices em `sku`, `barcode`, `category`, `type`, `isActive` para otimizar buscas. `sparse: true` em `sku` e `barcode` permite valores nulos mas garante unicidade se preenchidos.
  - `module` do Firebase e `ProductForm.jsx` é mapeado para `type`.
  - `price` do Firebase é mapeado para `sellingPrice`.
  - `low_stock_threshold` do Firebase é mapeado para `minStockLevel`.
  - Campos como `brand`, `supplier`, `unit` foram removidos por enquanto por não haver uso claro no frontend ou Firebase.
  - `requiresPrescription`, `isVaccine`, `vaccineDetails` mantidos para futuras implementações de controle de medicamentos/vacinas.

---

## Histórico de Alterações
- [PRODUCT] Estrutura detalhada do model Product para MongoDB documentada.

---

## Model OrderService (MongoDB) - Estrutura Proposta

### Objetivo
Representar Ordens de Serviço, principalmente para o fluxo de atendimento de petshop e vendas diretas no caixa.

### Baseado em:
- Módulo `orders` nas Firebase Functions (`generateOsNumber`, etc.).
- Fluxo de Fila de Atendimento de Petshop e Vendas/Caixa (`project_context.md`).
- Necessidade de migrar `order_service.items` (`optimization_plan.md`).

### Campos sugeridos para o model OrderService:

```js
// Subschema para itens da OS
const orderItemSchema = new mongoose.Schema({
  itemId: { type: String, required: true }, // ObjectId ref: 'Service' ou ref: 'Product'
  itemType: { type: String, required: true, enum: ['service', 'product'] },
  description: { type: String, required: true },
  quantity: { type: Number, required: true, min: 1 },
  unitPrice: { type: Number, required: true },
  totalPrice: { type: Number, required: true }
}, { _id: false });

// Schema principal
{
  tenant_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  osNumber: { type: String, required: true, index: true }, // Número da Ordem de Serviço
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true }, // Cliente (Tutor)
  petId: { type: mongoose.Schema.Types.ObjectId, ref: 'Pet', index: true, default: null }, // Pet (opcional)
  appointmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Appointment', index: true, default: null }, // Agendamento origem
  status: {
    type: String,
    required: true,
    enum: ['Aguardando', 'Em Atendimento', 'Concluído', 'Cancelado', 'Pendente Pagamento'],
    default: 'Aguardando',
    index: true
  },
  serviceQueueStatusUpdatedAt: { type: Date, default: Date.now }, // Para ordenação na fila
  items: { type: [orderItemSchema], default: [] }, // Itens (serviços/produtos)
  totalAmount: { type: Number, required: true, default: 0 }, // Valor total
  notes: { type: String, default: null },
  isCashierOs: { type: Boolean, default: false }, // OS criada no caixa?
  chargeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Charge', index: true, default: null }, // Cobrança associada
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now }
}
```

- **Items:** Iniciando com subdocumento para `items` por simplicidade, alinhado à estrutura atual do Firestore antes da otimização planejada. Pode ser refatorado para coleção separada (`OrderItems`) se necessário.
- **Fluxo:** O campo `status` ajuda a controlar o fluxo da fila de petshop. O `isCashierOs` diferencia vendas diretas.
- **Cobrança:** `chargeId` vincula a OS à cobrança gerada no caixa.

---

## Histórico de Alterações
- [ORDERSERVICE] Estrutura detalhada do model OrderService para MongoDB documentada.

---

## Model Charge (MongoDB) - Estrutura Proposta

### Objetivo
Registrar as cobranças geradas por serviços clínicos (Episodes), ordens de serviço (OrderService) ou vendas diretas, controlando o status de pagamento.

### Baseado em:
- Módulo `billing` nas Firebase Functions (`processPayment`, `cancelChargeItem`, `onAppointmentCompletedCreateCharge`).
- Fluxo de Vendas/Caixa (`project_context.md`).
- Necessidade de migrar `charge.items` (`optimization_plan.md`).

### Campos sugeridos para o model Charge:

```js
// Subschema para itens da Cobrança
const chargeItemSchema = new mongoose.Schema({
  itemId: { type: String, required: true }, // ObjectId ref: 'Service', 'Product', etc.
  itemType: { type: String, required: true, enum: ['service', 'product', 'clinical_fee', 'other'] },
  description: { type: String, required: true },
  quantity: { type: Number, required: true, min: 1 },
  unitPrice: { type: Number, required: true },
  totalPrice: { type: Number, required: true },
  cancellationReason: { type: String, default: null } // Motivo de cancelamento do item
}, { _id: true });

// Subschema para detalhes de pagamento
const paymentDetailSchema = new mongoose.Schema({
  paymentDate: { type: Date, default: Date.now },
  method: { type: String, enum: ['pix', 'credit_card', 'debit_card', 'cash', 'other'], required: true },
  amount: { type: Number, required: true },
  transactionId: { type: String, default: null },
  processedByUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
}, { _id: false });

// Schema principal
{
  tenant_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  chargeNumber: { type: String, required: true, index: true }, // Número da Cobrança
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true }, // Cliente
  // Referências de Origem
  appointmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Appointment', index: true, default: null },
  orderServiceId: { type: mongoose.Schema.Types.ObjectId, ref: 'OrderService', index: true, default: null },
  episodeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Episode', index: true, default: null },
  status: {
    type: String,
    required: true,
    enum: ['Pending', 'Paid', 'Partially Paid', 'Cancelled', 'Refunded'],
    default: 'Pending',
    index: true
  },
  items: { type: [chargeItemSchema], default: [] }, // Itens da cobrança
  totalAmount: { type: Number, required: true, default: 0 }, // Valor total original
  discountAmount: { type: Number, default: 0 }, // Desconto
  amountPaid: { type: Number, default: 0 }, // Pago
  amountDue: { type: Number, default: 0 }, // Devido (calculado)
  paymentDetails: { type: [paymentDetailSchema], default: [] }, // Histórico de pagamentos
  cancellationReason: { type: String, default: null }, // Motivo de cancelamento geral
  notes: { type: String, default: null },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now }
}
```

- **Items:** Iniciando com subdocumento. `_id: true` no subschema permite referenciar itens específicos para cancelamento.
- **Valores:** Campos separados para `totalAmount`, `discountAmount`, `amountPaid` e `amountDue` (que pode ser calculado via hook pre-save).
- **Pagamentos:** Array `paymentDetails` para suportar pagamentos múltiplos/parciais.

---

## Histórico de Alterações
- [CHARGE] Estrutura detalhada do model Charge para MongoDB documentada.

---

## Model Profile (MongoDB) - Estrutura Proposta

### Objetivo
Definir perfis de acesso e permissões para colaboradores dentro de um Tenant.

### Baseado em:
- CRUD de Perfis descrito em `project_context.md`.
- Necessidade de associar permissões a `Users` com `role: 'collaborator'`.

### Campos sugeridos para o model Profile:

```js
{
  tenant_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  name: { type: String, required: true }, // Nome do perfil (ex: "Veterinário")
  description: { type: String, default: null },

  // --- Permissões --- 
  // TODO: Definir a estrutura final de permissões.
  // Opção 1: Lista simples de strings
  permissions: { type: [String], default: [] }, // Ex: ['read:appointment', 'write:pet']
  // Opção 2: Estrutura granular (objeto)
  // permissions: { 
  //   appointments: { read: Boolean, write: Boolean },
  //   pets: { read: Boolean, write: Boolean }, 
  //   // ...etc 
  // },

  isDefaultAdmin: { type: Boolean, default: false }, // É o perfil admin padrão?
  isDefaultCollaborator: { type: Boolean, default: false }, // É o perfil padrão para novos?
  isActive: { type: Boolean, default: true, index: true }, // Perfil ativo?
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now }
}
```

- **Permissões:** A estrutura do campo `permissions` é fundamental e precisa ser definida de acordo com a implementação do controle de acesso. A proposta inicial usará uma lista de strings (Opção 1).
- **Associação:** O `_id` deste `Profile` será referenciado no campo `profileId` do model `User`.

---

## Histórico de Alterações
- [PROFILE] Estrutura detalhada do model Profile para MongoDB documentada.

---

## Model PrescriptionTemplate (MongoDB) - Estrutura Proposta

### Objetivo
Armazenar modelos (templates) de prescrições médicas que podem ser reutilizados pelos veterinários para agilizar o preenchimento durante um `Episode`.

### Baseado em:
- CRUD de Modelos de Prescrição descrito em `project_context.md`.
- Necessidade de padronizar e agilizar a criação de prescrições.

### Campos sugeridos para o model PrescriptionTemplate:

```js
{
  tenant_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  name: { type: String, required: true, index: true }, // Nome do modelo
  description: { type: String, default: null },

  // --- Conteúdo do Template (espelhando a estrutura de 'prescription' em Episode) ---
  internalMedication: [{ // Itens de medicação interna padrão
    productId: { type: String, default: null }, // Ou ObjectId ref:'Product'
    productName: { type: String, default: null },
    dosage: { type: String, default: null },
    frequency: { type: String, default: null },
    duration: { type: String, default: null }
    // Sem campos de administração
  }],
  externalPrescription: [{ // Itens de receita externa padrão
    medication: { type: String, default: null },
    dosage: { type: String, default: null },
    frequency: { type: String, default: null },
    duration: { type: String, default: null },
    quantity: { type: String, default: null }
  }],
  recommendations: { type: String, default: null }, // Recomendações padrão
  // -----------------------------------------------------------------------------

  isActive: { type: Boolean, default: true, index: true }, // Template ativo?
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now }
}
```

- **Reutilização:** A estrutura do conteúdo (`internalMedication`, `externalPrescription`, `recommendations`) é fundamental para reutilização de prescrições.

---

## Histórico de Alterações
- [PRESCRIPTIONTEMPLATE] Estrutura detalhada do model PrescriptionTemplate para MongoDB documentada.

---

# Testes Futuros por Coleção

Esta seção documenta os testes que ainda precisam ser executados para cada coleção/modelo para garantir a funcionalidade completa do CRUD e das regras de negócio associadas.

## Tenants
- `GET /api/tenants` (Listar todos, SuperAdmin)
- `GET /api/tenants/:id` (Buscar tenant específico, SuperAdmin)
- `POST /api/tenants` (Criar tenant, SuperAdmin)
- `PUT /api/tenants/:id` (Atualizar tenant, SuperAdmin)
- `DELETE /api/tenants/:id` (Excluir tenant, SuperAdmin) - *Avaliar se será soft delete ou hard delete e as implicações.*

## Users
- `GET /api/users` (Listar usuários, testar filtros: `role`, `tenant_id` (para SuperAdmin), `status`)
- `GET /api/users/:id` (Buscar usuário específico)
- `POST /api/users` (Criar usuário):
  - SuperAdmin para Admins: [CONCLUÍDO - Admin de Tenant criado com sucesso como parte do fluxo de criação de Tenant.]
  - Admin para Collaborators: [PENDENTE]
  - Admin para Tutores: [CONCLUÍDO - Testado com sucesso pela Admin Carla.]
- `PUT /api/users/:id` (Atualizar dados do usuário, testar diferentes roles e permissões)
- `DELETE /api/users/:id` (Inativar/Excluir usuário - definir estratégia)
- `POST /api/users/:userId/set-password` (Definir/resetar senha, SuperAdmin para Admins, Admin para Collaborators) - *Revalidar após fluxo de setup*
- `POST /api/auth/setup-password` (Admin de Tenant configura senha via token) - [CONCLUÍDO - Testado com sucesso para o admin do novo tenant.]
- *Observação: Login (`POST /api/auth/login`) do SuperAdmin e Admin de Tenant também testados e funcionando.*

## Pets
- `GET /api/pets` (Listar todos os pets do tenant)
- `GET /api/pets/:id` (Buscar pet específico)
- `POST /api/pets` (Criar pet)
- `PUT /api/pets/:id` (Atualizar pet)
- `DELETE /api/pets/:id` (Inativar pet)

## Appointments
- `GET /api/appointments` (Listar agendamentos, testar filtros: `patient_id`, `owner_id`, `associated_vet_id`, `status`, `appointment_date` range)
- `GET /api/appointments/:id` (Buscar agendamento específico)
- `POST /api/appointments` (Criar agendamento)
- `PUT /api/appointments/:id` (Atualizar agendamento, testar mudança de `status` e seus efeitos)
- `DELETE /api/appointments/:id` (Cancelar/Excluir agendamento)

## Episodes
- `GET /api/episodes` (Listar episódios, testar filtros: `patient_id`, `appointmentId`, `collaboratorId`, `status`)
- `GET /api/episodes/:id` (Buscar episódio específico)
- `POST /api/episodes` (Criação manual, se necessária)
- `PUT /api/episodes/:id` (Atualizar episódio, ex: adicionar `diagnosis`, `treatment`, `prescription` items)
- `DELETE /api/episodes/:id` (Cancelar/Excluir episódio - avaliar se permitido ou se apenas status muda)

## Services
- `GET /api/services` (Listar todos os serviços do tenant)
- `GET /api/services/:id` (Buscar serviço específico)
- `POST /api/services` (Criar serviço)
- `PUT /api/services/:id` (Atualizar serviço)
- `DELETE /api/services/:id` (Inativar serviço)

## Products
- `GET /api/products` (Listar todos os produtos do tenant)
- `GET /api/products/:id` (Buscar produto específico)
- `PUT /api/products/:id` (Atualizar produto)
- `DELETE /api/products/:id` (Inativar produto)

## OrderServices (OS)
- `GET /api/orders` (Listar OS, testar filtros: `customerId`, `petId`, `status`, `isCashierOs`)
- `GET /api/orders/:id` (Buscar OS específica)
- `PUT /api/orders/:id` (Atualizar OS, ex: adicionar `items`, mudar `status`)
- `DELETE /api/orders/:id` (Cancelar/Excluir OS)

## Charges
- `GET /api/charges` (Listar Cobranças, testar filtros: `customerId`, `status`, `paymentDetails.method`)
- `GET /api/charges/:id` (Buscar Cobrança específica)
- `PUT /api/charges/:id` (Atualizar Cobrança, ex: adicionar `paymentDetails`, mudar `status` para `Paid`)
- `DELETE /api/charges/:id` (Cancelar/Excluir Cobrança - avaliar implicações)

## Profiles
- `GET /api/profiles` (Listar Perfis do tenant)
- `GET /api/profiles/:id` (Buscar Perfil específico)
- `PUT /api/profiles/:id` (Atualizar Perfil, ex: mudar `permissions`)
- `DELETE /api/profiles/:id` (Excluir Perfil - avaliar o que acontece com usuários associados)

## PrescriptionTemplates
- `GET /api/prescription-templates` (Listar Modelos do tenant)
- `GET /api/prescription-templates/:id` (Buscar Modelo específico)
- `PUT /api/prescription-templates/:id` (Atualizar Modelo)
- `DELETE /api/prescription-templates/:id` (Excluir Modelo)

---

## Fortalecimento da Segurança do Servidor MongoDB (Pós-Incidente)

Após a detecção de um acesso não autorizado e um ataque de ransomware à instância MongoDB (que resultou na perda dos dados existentes e exigiu a recriação do usuário administrador e repopulação inicial de dados como o SuperAdmin da aplicação), foram implementadas as seguintes medidas críticas de segurança na VM Oracle Cloud e na configuração do MongoDB:

**1. Configuração do MongoDB (`/etc/mongod.conf`):**
   - **Autenticação Ativada:**
     ```yaml
     security:
       authorization: enabled
     ```
   - **Restrição de IP de Acesso (Binding):** O MongoDB foi configurado para aceitar conexões apenas do localhost da VM.
     ```yaml
     net:
       bindIp: 127.0.0.1
     ```
     Isso impede conexões diretas ao MongoDB de fora da VM. A conexão da aplicação local exigirá um túnel SSH ou VPN.
   - **Replica Set Configurado:** Necessário para transações e habilitado com `keyFile`.
     ```yaml
     replication:
       replSetName: rs0
     ```
   - **Autenticação Interna do Replica Set (Keyfile):** Um arquivo de chave (`/etc/mongo-keyfile`) foi gerado e configurado para proteger a comunicação entre os membros do replica set (mesmo sendo um único nó por enquanto).
     ```yaml
     security:
       keyFile: /etc/mongo-keyfile
     ```

**2. Gerenciamento de Usuários MongoDB:**
   - **Criação de Usuário Administrador:** Um usuário administrador (`superAdminPetFacil`) foi criado no banco `admin` com roles apropriadas (`userAdminAnyDatabase`, `dbAdminAnyDatabase`, `readWriteAnyDatabase`) para gerenciar o MongoDB. A aplicação usará um usuário com permissões mais restritas futuramente.

**3. Configuração do Firewall (Oracle Cloud):**
   - **Network Security Group (NSG) da VCN:**
     - **Porta 22 (SSH):** Acesso restrito ao IP público dinâmico do desenvolvedor (ex: `73.17.251.207/32`). *Requer atualização manual se o IP do desenvolvedor mudar.*
     - **Porta 443 (HTTPS):** Aberta para `0.0.0.0/0` para acesso público à aplicação WAHA (e futuras aplicações web).
     - **Porta 27017 (MongoDB):** **REMOVIDA**. O acesso direto foi bloqueado.
     - Outras portas desnecessárias foram removidas ou mantidas bloqueadas por padrão.
   - **Security List (SL) da Subnet:**
     - **Porta 22 (SSH):** Regra **REMOVIDA**, sendo o NSG o controlador principal para esta porta.
     - **Porta 443 (HTTPS):** Aberta para `0.0.0.0/0`.
     - **Porta 27017 (MongoDB):** **REMOVIDA**.
     - A estratégia adotada é usar o NSG para regras mais específicas (como IPs de origem) e a Security List para regras mais amplas da subnet, com o NSG tendo precedência efetiva.

**4. Segurança do Sistema Operacional (VM Ubuntu):**
   - **Fail2Ban Instalado e Configurado:**
     - O serviço Fail2Ban foi instalado e configurado para monitorar logs de SSH (`sshd`).
     - Ele bane automaticamente IPs que demonstram comportamento malicioso (ex: múltiplas tentativas de login falhas).
     - Arquivo de configuração local: `/etc/fail2ban/jail.local` com as jails `[DEFAULT]` e `[sshd]` ativadas.

**5. Procedimentos de Acesso:**
   - O acesso SSH à VM agora é feito exclusivamente pelo IP configurado no NSG.
   - O acesso ao MongoDB de fora da VM (ex: Compass, aplicação local) requer um túnel SSH ou VPN devido ao `bindIp: 127.0.0.1`.

---

## Próximos Passos Pós-Segurança (Para o Agente de Amanhã)

**Estado Atual:**
*   O servidor MongoDB na VM Oracle Cloud foi recuperado e está agora significativamente mais seguro:
    *   Autenticação habilitada.
    *   Acesso restrito a `127.0.0.1` (localhost da VM).
    *   Comunicação interna do replica set protegida por `keyFile`.
    *   Usuário administrador (`superAdminPetFacil`) recriado (senha temporariamente `test123`).
*   O firewall da Oracle Cloud (NSG e Security List) foi reconfigurado para bloquear acesso externo direto ao MongoDB (porta 27017) e restringir SSH.
*   Fail2Ban está ativo na VM, protegendo o serviço SSH.
*   A aplicação Node.js rodando localmente na máquina do desenvolvedor **consegue** se conectar ao MongoDB na VM através de um túnel SSH.
*   O MongoDB Compass rodando localmente também **consegue** se conectar através do túnel SSH.

**Tarefas para Amanhã:**

1.  **Restabelecer a Conexão da Máquina de Desenvolvimento Local ao MongoDB na VM:**
    *   **Opção Principal (Recomendada para Desenvolvimento): Configurar um Túnel SSH.**
        *   **Instrução:** Criar um túnel SSH da máquina de desenvolvimento local para a VM Oracle Cloud. O comando geralmente é algo como:
          ```bash
          ssh -i "C:\path\to\your\ssh-key.key" -L 27018:127.0.0.1:27017 ubuntu@YOUR_VM_PUBLIC_IP -o ServerAliveInterval=60 -o ServerAliveCountMax=3
          ```
          (Substituir `27018` por uma porta local de sua escolha se esta estiver ocupada, e ajustar o caminho da chave e o IP da VM).
        *   **Ação na Aplicação Node.js:** Atualizar a string de conexão no arquivo `.env` (ou onde ela estiver configurada) para apontar para a porta local do túnel:
          ```
          DATABASE_URL="mongodb://superAdminPetFacil:test123@127.0.0.1:27018/petfacil_app?authSource=admin&replicaSet=rs0&directConnection=true"
          ```
          (Ajustar a porta se usou uma diferente de `27018`).
        *   **Ação no MongoDB Compass:** Configurar uma nova conexão.
            *   Hostname: `127.0.0.1`
            *   Port: `27018` (ou a porta local do túnel que você escolheu)
            *   Authentication: `Username / Password` (com as credenciais do `superAdminPetFacil` / `test123`)
            *   Auth Source: `admin`
            *   Replica Set Name: `rs0`
            *   Na aba "Advanced Connection Options", garantir que "Direct Connection" esteja como `True`.
            *   Se o Compass tiver uma opção nativa de "SSH Tunnel", usá-la preenchendo os dados da VM (IP, usuário, chave SSH) e os dados do MongoDB como se estivesse conectando de dentro da VM (host `127.0.0.1`, porta `27017`).

2.  **Testar a Aplicação Node.js:**
    *   Após restabelecer a conexão, iniciar o servidor Node.js.
    *   Verificar se o servidor conecta com sucesso ao MongoDB (observar os logs da aplicação).
    *   Testar os principais fluxos da API (login, criação de tenant, criação de usuário, etc.) para garantir que a comunicação com o banco de dados está funcionando corretamente com as novas configurações de segurança.

3.  **Repopular Dados (se necessário):**
    *   Como os dados foram perdidos no ataque, será preciso repopular as coleções com dados de teste.
    *   Executar o script `scripts/seedSuperAdmin.js` para garantir que o SuperAdmin exista.
    *   Criar tenants, usuários e outros dados de teste manualmente via API ou criar/executar scripts de seed adicionais.

4.  **Continuar Desenvolvimento da Migração:**
    *   Com a conexão segura e funcional, retomar o desenvolvimento a partir do último ponto:
        *   Revisar o estado da implementação do CRUD de `Episode`.
        *   Prosseguir para a próxima coleção conforme o plano: `OrderService`.
        *   Continuar seguindo o `MIGRATION_MONGODB.md` para as demais coleções.

5.  **(Opcional, mas Recomendado) Criar Usuário MongoDB Dedicado para a Aplicação:**
    *   Atualmente, a aplicação conectará com o `superAdminPetFacil`. Para maior segurança, criar um novo usuário MongoDB no banco `petfacil_app` com permissões mais restritas (ex: `readWrite` apenas para o banco `petfacil_app`) e usar essas credenciais na string de conexão da aplicação.

---

## Estado Atual Detalhado e Próximos Passos Imediatos (Sessão de 14/05/2025)

**Resumo da Sessão:**
A sessão focou em testar o fluxo de criação de dados dentro de um tenant, utilizando a administradora do tenant "Carla" (`carlass@gmail.com`). Foram criados com sucesso: um Tutor, um Pet (Rex), Serviços (clínico e petshop), e um Agendamento para o Pet Rex para o serviço clínico. A mudança de status do agendamento para "Chegou" disparou corretamente a criação automática de um Episódio clínico no backend Node.js/MongoDB. O `prontuarioId` ('PT-7d1b382809') foi gerado e associado ao Pet Rex. O `_id` (ObjectId('6824e8e6ec6c3e1434047d41')) e `episodeNumber` ('EP-maob646d') do episódio criado foram identificados via acesso direto ao MongoDB.

**Estado Atual do Sistema e Dados de Teste Relevantes:**
*   **Usuária Admin do Tenant:** Carla (`carlass@gmail.com`, senha definida anteriormente).
*   **Tutor Criado:** "Nome Completo do Tutor" (`_id: "6824e4caec6c3e1434047d26"`).
*   **Pet Criado:** "Rex" (`_id: "6824e5e0ec6c3e1434047d2a"`, `prontuarioId: 'PT-7d1b382809'`).
*   **Serviço Clínico Criado:** "Consulta Clínica Geral" (`_id: "6824e766ec6c3e1434047d2d"`).
*   **Agendamento Criado:** Para Rex, serviço "Consulta Clínica Geral" (`_id: "6824e840ec6c3e1434047d36"`), status atual "Chegou".
*   **Episódio Clínico Criado Automaticamente:**
    *   `_id`: `ObjectId('6824e8e6ec6c3e1434047d41')`
    *   `appointmentId`: `ObjectId('6824e840ec6c3e1434047d36')`
    *   `patient_id`: `ObjectId('6824e5e0ec6c3e1434047d2a')` (Rex)
    *   `episodeNumber`: `'EP-maob646d'`
    *   `status`: `'Aguardando Atendimento'`
    *   `collaboratorId`: `null`

**Próximos Passos Imediatos (para o próximo agente):**

1.  **Renovar Autenticação:**
    *   Obter um novo token JWT para a administradora do tenant, Carla (`carlass@gmail.com`), utilizando a rota `POST /api/auth/login`.

2.  **Continuar Fluxo do Episódio Clínico:**
    *   Utilizando o token da Carla, preencher os dados clínicos do episódio (`_id: ObjectId('6824e8e6ec6c3e1434047d41')`) através da rota `PUT /api/episodes/6824e8e6ec6c3e1434047d41`.
    *   **Corpo da Requisição Sugerido (iniciar atendimento):**
        ```json
        {
          "status": "Em Atendimento",
          // "collaboratorId": "ID_DO_VET_SE_CADASTRADO_E_DISPONIVEL", // Opcional por agora
          "clinicalSigns": "O pet apresenta tosse seca há 3 dias e apatia.",
          "anamnesis": "Tutor relata que o pet teve contato com outros cães no parque no último fim de semana. Nenhuma alteração na alimentação ou ambiente. Vacinação e vermifugação em dia."
        }
        ```
        *   Prosseguir com o preenchimento de `physicalExam`, `suspectedDiagnosis`, `diagnosis`, `treatment`, `prescription`, e finalmente mudar o status para `Concluído` (registrando `endTime`).

3.  **Corrigir Problema de Permissão em Listagens (Urgente):**
    *   Investigar e corrigir a falha "Acesso proibido para esta função" na rota `GET /api/episodes`.
    *   **Ação:** Revisar o middleware de autenticação/autorização (`src/middlewares/auth.middleware.js` ou similar) e a lógica de checagem de `role` e `tenant_id` no início da função `getEpisodes` em `src/controllers/episode.controller.js`.
    *   **Objetivo:** Garantir que um Admin de Tenant possa listar APENAS os episódios associados ao seu `tenant_id` (a filtragem por `tenant_id` já parece estar no lugar, o bloqueio ocorre antes). O SuperAdmin deve poder listar todos, opcionalmente com filtros.
    *   Estender a correção para outras rotas de listagem (`GET /api/pets`, `GET /api/appointments`, `GET /api/services`, etc.) para garantir consistência nas permissões.

4.  **Ajustar Geração de IDs Numéricos Aleatórios:**
    *   Revisar a lógica de geração de `prontuarioId` em `src/controllers/episode.controller.js` (função `createEpisodeInternal`, ao lidar com o Pet) para que seja `PT-` seguido de uma sequência numérica aleatória (ex: 8 dígitos) única por tenant.
        *   Considerar ler `functions/src/utils/generators.utils.ts` (se fornecido) para ver a lógica original do Firebase de `generateFormattedId`.
        *   Implementar um mecanismo de tentativa e erro com verificação de unicidade no banco de dados para evitar colisões.
    *   Revisar a lógica de geração de `episodeNumber` em `src/controllers/episode.controller.js` (função `createEpisodeInternal`) para que seja `EP-` (ou outro prefixo/sem prefixo) seguido de uma sequência numérica aleatória única por tenant (ou por prontuário). Mesmo princípio de unicidade e tentativa/erro.
    *   Aplicar lógica similar para IDs de Ordens de Serviço (OS) quando este módulo for implementado.

**Pendências de Médio Prazo (após passos imediatos):**
*   Cadastrar um usuário Colaborador (Veterinário) e associá-lo a atendimentos.
*   Testar o fluxo completo de um serviço de petshop, incluindo a criação de Ordem de Serviço (OS) a partir de um agendamento com status "Chegou".
*   Implementar e testar o módulo de Cobranças (`Charges`), incluindo a criação de uma cobrança ao concluir um episódio ou OS.
*   Validar todos os endpoints CRUD restantes para todas as coleções, conforme listado em "Testes Futuros por Coleção".