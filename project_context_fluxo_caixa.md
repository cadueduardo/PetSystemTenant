# Plano de Implementação: Módulo de Caixa

## 1. Objetivo Principal

Substituir a página de "Vendas" atual por um módulo de "Caixa" mais robusto, capaz de:
*   Receber pagamentos de serviços clínicos (Episódios) e de petshop (Ordens de Serviço) finalizados.
*   Agrupar múltiplos serviços/consultas de um mesmo cliente/pet realizados em uma mesma "visita" para um único pagamento.
*   Permitir a venda avulsa de produtos e serviços diretamente no caixa.
*   Registrar todas as transações financeiras de forma estruturada.
*   Exibir um histórico financeiro detalhado na página do cliente.
*   Preparar a base para futuras integrações de emissão de Nota Fiscal (NFSe/NFC-e) e cálculo de comissões.

## 2. Conceitos Chave

*   **Cobrança (`charge`):** Representa um conjunto de itens (serviços, produtos) que devem ser pagos pelo cliente em um determinado momento. Uma cobrança pode originar-se de um ou mais Episódios/OS finalizados ou de uma venda direta no caixa.
*   **Transação (`transaction`):** Representa um pagamento (ou tentativa) efetuado para quitar (total ou parcialmente) uma Cobrança.
*   **Agrupamento:** Itens de Episódios/OS finalizados para o mesmo tutor/pet em um curto período serão automaticamente adicionados a uma única `charge` pendente.
*   **Venda Direta:** Itens adicionados diretamente no carrinho do caixa (sem carregar uma `charge` pendente) gerarão uma nova `charge` com status `paid` no momento da finalização do pagamento.

## 3. Modelagem de Dados (Firestore)

*   **Coleção `charges`:**
    *   `tenantId`: string (ID do tenant)
    *   `tutorId`: string (ID do cliente/tutor)
    *   `petId?`: string (ID do pet principal, se aplicável)
    *   `items`: Array<{
        *   `itemId`: string (ID do serviço/produto)
        *   `sourceType`: 'episode' | 'order_service' | 'product' | 'service' (Origem do item)
        *   `sourceId?`: string (ID do Episódio/OS de origem, se aplicável)
        *   `description`: string (Nome do serviço/produto)
        *   `quantity`: number
        *   `unitPrice`: number
        *   `totalPrice`: number
        *   `itemType`: 'clinic' | 'petshop' | 'product' (Para segregação fiscal futura)
        *   }> 
    *   `totalAmount`: number (Valor total da cobrança)
    *   `amountPaid`: number (Valor já pago, para pagamentos parciais)
    *   `status`: 'pending' | 'partially_paid' | 'paid' | 'canceled'
    *   `sourceType`: 'service_completion' | 'cashier_direct' (Origem da cobrança)
    *   `cashierId?`: string (ID do colaborador que registrou o pagamento)
    *   `createdAt`: Timestamp
    *   `updatedAt`: Timestamp
    *   `paidAt?`: Timestamp
    *   `nfseUrl?`: string (Placeholder para link NFSe)
    *   `nfceUrl?`: string (Placeholder para link NFC-e)

*   **Coleção `transactions`:**
    *   `tenantId`: string
    *   `chargeId`: string (Link para a `charge` correspondente)
    *   `tutorId`: string
    *   `method`: 'pix' | 'credit_card' | 'debit_card' | 'cash' | 'bank_transfer' | 'check' | 'other' (Forma de pagamento)
    *   `amount`: number (Valor desta transação específica)
    *   `status`: 'completed' | 'pending' | 'failed' | 'refunded'
    *   `transactionTimestamp`: Timestamp (Quando a transação ocorreu)
    *   `cashierId?`: string
    *   `notes?`: string

## 4. Lógica de Backend (Firebase Functions)

*   **Gatilho Firestore (`onUpdate` Episódio/OS):**
    *   Observar mudanças de status para 'completed' (ou similar) nas coleções de Episódios e Ordens de Serviço.
    *   Ao detectar conclusão, buscar por uma `charge` 'pending' recente para o `tutorId`/`petId`.
    *   Se encontrada, adicionar os itens finalizados ao array `items` da `charge` existente.
    *   Se não encontrada, criar uma nova `charge` com status 'pending'.
*   **Função Callable (`processPayment`):**
    *   Receber dados do pagamento (chargeId ou itens do carrinho, paymentMethod, amountPaid).
    *   **Se `chargeId` fornecido (pagando cobrança pendente):**
        *   Usar Transação Firestore:
            *   Buscar e validar a `charge`.
            *   Criar documento em `transactions`.
            *   Atualizar `status` e `amountPaid` da `charge`.
    *   **Se itens do carrinho fornecidos (venda direta):**
        *   Usar Transação Firestore:
            *   Criar *nova* `charge` com `sourceType: 'cashier_direct'`, `status: 'paid'`, e os itens do carrinho.
            *   Criar documento em `transactions`.
    *   Retornar sucesso ou erro.
    *   *(Adiar: Geração de NF, cálculo de comissão)*.

## 5. Alterações no Frontend

*   **Renomear:** `src/pages/Sales.jsx` -> `src/pages/Cashier.jsx`. Atualizar rota e links.
*   **`Cashier.jsx` (Antigo `Sales.jsx`):**
    *   Remover lógica baseada em `localStorage` (`pendingCharges`, `getPendingItems`, `clearPendingItems`).
    *   Modificar Aba "Pendentes": Implementar query `onSnapshot` para buscar `charges` com status 'pending'/'partially_paid'. Exibir lista.
    *   Modificar `handleLoadAppointmentToCart` para `handleLoadChargeToCart`: Receber `charge`, preencher `cart` com `charge.items`, definir `selectedCustomer` e `currentLoadedChargeId`.
    *   Modificar `PaymentDialog` e `handlePaymentSuccess`: Chamar a função `processPayment`, tratar resposta, limpar estado local (carrinho, cliente, chargeId). A lista de pendentes atualizará via `onSnapshot`.
    *   Ajustar UI para desabilitar adição/remoção/edição de itens no carrinho quando uma `charge` estiver carregada.
    *   Garantir que a seleção de cliente (`CustomerDialog`) limpe qualquer `charge` carregada.
*   **`CustomerDetails.jsx`:**
    *   Adicionar nova Seção/Aba "Histórico Financeiro".
    *   Implementar query para buscar `charges` com `status: 'paid'` para o `tutorId` atual.
    *   Exibir lista de cobranças passadas (data, total). Opcionalmente, permitir expandir para ver itens e transações.

## 6. Considerações Futuras

*   Integração com API de emissão de NFSe/NFC-e.
*   Implementação da lógica de cálculo e registro de comissões.
*   Tratamento de pagamentos parciais (atualização do status e `amountPaid` na `charge`).
*   Funcionalidade de estorno/reembolso (atualização do status da `transaction` e da `charge`).

## 7. Lista de Tarefas (MVP Inicial)

1.  [X] **Backend:** Definir e aplicar estrutura das coleções `charges` e `transactions` no Firestore.
2.  [X] **Backend:** Implementar Gatilho Firestore (`onUpdate` Episódio/OS) para criar/atualizar `charges` pendentes.
3.  [X] **Backend:** Implementar Função Callable `processPayment` (lógica básica de atualização de status e criação de transação, sem NF/comissão).
4.  [X] **Frontend:** Renomear `Sales.jsx` para `Cashier.jsx`, atualizar rota em `index.jsx` e link em `Layout.jsx`.
5.  [X] **Frontend:** Refatorar `Cashier.jsx`: Remover lógica de `localStorage` para pendentes.
6.  [X] **Frontend:** Refatorar `Cashier.jsx`: Implementar `onSnapshot` para buscar e exibir `charges` pendentes na aba "Pendentes".
7.  [X] **Frontend:** Refatorar `Cashier.jsx`: Implementar `handleLoadChargeToCart`.
8.  [X] **Frontend:** Refatorar `Cashier.jsx` e `PaymentDialog`: Implementar chamada à função `processPayment` e `handlePaymentSuccess`.
9.  [X] **Frontend:** Refatorar `Cashier.jsx`: Ajustar UI para bloquear edição do carrinho quando `charge` estiver carregada.
10. [X] **Frontend:** Implementar Seção/Aba "Histórico Financeiro" em `CustomerDetails.jsx`.
11. [X] **Segurança:** Implementar regras básicas do Firestore para `charges` e `transactions`.

## 8. Tarefas Pós-MVP

1.  [ ] **Frontend:** Refatorar `Cashier.jsx` para nova UX:
    *   [ ] Layout de duas colunas (Esquerda: Pendentes agrupadas por cliente, Direita: Caixa/Carrinho/Produtos).
    *   [ ] Remover `Tabs`.
    *   [ ] Implementar lista de cobranças pendentes na coluna esquerda com cards por cliente (usar dados agregados do listener).
    *   [ ] Botão "Finalizar Compra" por cliente/grupo na coluna esquerda (chama `handleLoadChargeToCart`).
    *   [ ] Botão "Ver Detalhes" (placeholder ou expandir para mostrar itens da charge).
    *   [ ] Botão "Continuar Comprando" (aparece quando charge está carregada):
        *   [ ] Backend: Criar função para gerar nova OS vazia (`createDirectSaleOrderService`).
        *   [ ] Frontend: Chamar função backend, abrir modal de busca/adição de produtos/serviços.
        *   [ ] Frontend: Adicionar itens do modal ao carrinho principal marcados com a nova OS.
    *   [ ] Implementar fluxo de **Venda Anônima/Rápida** (*Nota: Lógica principal implementada, aguardando testes*):
        *   [ ] Adicionar estado `isAnonymousSaleActive`.
        *   [ ] Adicionar botão "Novo Pedido" (chama `handleNewAnonymousOrder` para limpar estado e ativar modo anônimo).
        *   [ ] Ajustar funções (`handleDeselectCustomerOrCharge`, `onSelectCustomer`, `handleLoadChargeToCart`) para gerenciar `isAnonymousSaleActive`.
        *   [ ] Ajustar condições de `disabled` na coluna direita (busca, carrinho) para permitir ações no modo anônimo.
        *   [ ] Adicionar botão/link "Cadastrar Cliente e Vincular Compra?" (visível em modo anônimo com itens no carrinho).
        *   [X] Ajustar `CustomerDialog` e `CustomerForm` (`onSuccess`) para vincular cliente novo/existente à venda anônima *sem* limpar o carrinho.
        *   [X] Ajustar `PaymentDialog` e backend `processPayment` para lidar com vendas anônimas (sem `tutorId` ou com marcador especial).
2.  [X] **Frontend:** Refatorar `SalesHistory.jsx` para `ChargeHistory.jsx` (buscar e exibir `charges` pagas, com paginação e filtros básicos).
3.  [ ] **Backend/Frontend:** Implementar funcionalidade "Gerar NF" em `ChargeHistory.jsx` (botão por linha, chamar função backend para separar itens e integrar com API de NF).
4.  [ ] **Backend:** Integração completa com API de emissão de NFSe/NFC-e.
5.  [ ] **Backend:** Implementação da lógica de cálculo e registro de comissões.
6.  [ ] **Backend/Frontend:** Tratamento de pagamentos parciais e estorno/reembolso.
7.  [ ] **Frontend:** Implementar funcionalidade de exportação para Excel em `ChargeHistory.jsx`.
8.  [ ] **Correção Lógica OS/Episódio:** Ajustar `AgendaPage.jsx` para **não** gerar `osNumber` para agendamentos `service_type: 'clinica'`. A geração de OS deve ocorrer apenas para tipos de serviço apropriados (ex: 'petshop'). (Detectado em 29/04/2025)
9.  [ ] **Correção Layout Caixa:** Investigar por que as alterações no layout da coluna de cobranças pendentes em `Cashier.jsx` (exibição individual por charge) não estão refletindo visualmente, mesmo após limpeza de cache/restart. (Detectado em 29/04/2025)

## 9. Últimas Atualizações (28/04/2025 - 20:00)

*   **Backend (`functions/src/index.ts`):**
    *   Corrigido gatilho `onAppointmentCompletedCreateCharge` para buscar consultas (`consultations`) usando `tenant_id`.
    *   Removidos gatilhos e funções redundantes (`onEpisodeUpdateCreateCharge`, `createOrUpdateChargeOnCompletion`, `onEpisodeUpdate`, `onOrderServiceUpdate`).
    *   Corrigido gatilho `onAppointmentArrived` para salvar `prontuarioId` e `currentEpisodeId` (formato `EP-...`) de volta no documento `appointment`.
    *   Ajustado `onAppointmentCompletedCreateCharge` para passar IDs (`prontuarioId`/`episodeId` OU `osNumber`) condicionalmente para `addItemsToPendingCharge`.
    *   Ajustado `addItemsToPendingCharge` para receber e salvar corretamente os IDs e `petName`.
    *   Ajustado `processPayment` para salvar `paymentMethod` na `charge`.
*   **Frontend (`Cashier.jsx`):**
    *   Ajustada a busca de cobranças pendentes para usar `onSnapshot` e buscar dados do Pet.
    *   Ajustada a exibição do card de cobrança pendente para mostrar IDs corretos (Prontuário/Episódio ou OS).
*   **Frontend (`ChargeHistory.jsx` - antigo `SalesHistory.jsx`):**
    *   Renomeado arquivo e componente.
    *   Rota atualizada em `src/pages/index.jsx`.
    *   Refatorada busca de dados para usar `charges` com status `paid`.
    *   Atualizada exibição da tabela para mostrar origem (OS/Episódio), método de pagamento (lido da `charge`), status e botão placeholder "Gerar NF".
    *   Implementada paginação na tabela.
*   **Plano (`project_context_fluxo_caixa.md`):**
    *   Tarefas MVP marcadas como concluídas.
    *   Adicionadas tarefas Pós-MVP (Refatoração Caixa UX, Refatoração Histórico, Geração NF, Exportação Excel).
    *   Adicionada esta seção de últimas atualizações.

## 10. Últimas Atualizações (29/04/2025 - ~21:00)

*   **Backend (`functions/src/index.ts`):**
    *   Corrigida a função `processPayment` para aceitar `customerId: null` em casos de venda direta do caixa (sem `chargeId`), resolvendo o erro 400 que impedia vendas anônimas. A lógica agora exige `customerId` apenas se um `chargeId` existente estiver sendo pago.
    *   Garantido que `tutorId` seja salvo como `null` nas coleções `charges` e `transactions` quando `customerId` não for fornecido na venda direta.
*   **Contexto (`project_context_fluxo_caixa.md`):**
    *   Tarefa Pós-MVP relacionada ao backend da venda anônima marcada como concluída.
    *   Adicionada esta seção de últimas atualizações.

## 11. Fluxo "Continuar Comprando" (Adição de Itens a Cobranças Existentes)

Este fluxo permite adicionar novos produtos/serviços diretamente no caixa a um conjunto de cobranças (`charges`) já existentes para um cliente, originadas de serviços/episódios concluídos.

**Lógica Detalhada:**

1.  **Acionamento (Frontend - `Cashier.jsx`):**
    *   Usuário clica no botão "Continuar Comprando" exibido junto às cobranças pendentes de um cliente carregado.
    *   O frontend chama a nova função backend `createContinuedOrderService`, passando o `customerId`.
2.  **Criação da OS Temporária (Backend - Nova Função `createContinuedOrderService`):**
    *   Recebe `customerId` (e `tenantId` do auth).
    *   Gera um novo `osNumber` (ex: `OS-CASHIER-XXXXXX`).
    *   Cria um novo documento na coleção **`order_services`** com:
        *   `osNumber`, `customerId`, `tenantId`.
        *   `status: 'cashier_adding_items'` (ou similar para indicar que está em edição no caixa).
        *   `source: 'cashier_direct'` (ou `cashier_continued`).
        *   `items: []` (array de itens vazio).
        *   `createdAt`, `updatedAt`.
    *   Retorna o `id` do documento OS recém-criado (`newOsId`) e o `osNumber` para o frontend.
3.  **Interação no Modal (Frontend - Modal de Produtos/Serviços):**
    *   O frontend abre o modal de seleção de produtos/serviços, mantendo o `newOsId` em estado.
    *   **Adicionar Item:** Cria/atualiza um objeto item e usa o SDK do Firestore para adicioná-lo ao array `items` do documento OS com ID `newOsId`.
    *   **Remover Item:** Usa o SDK do Firestore para remover o item correspondente do array `items` do documento OS `newOsId`.
    *   **Atualizar Quantidade:** Usa o SDK do Firestore para encontrar e atualizar o item no array `items` do documento OS `newOsId`.
    *   **Importante:** Todas as modificações de itens são persistidas diretamente no documento da OS no Firestore.
4.  **Exibição Atualizada (Frontend - `Cashier.jsx`):**
    *   A lista de pendentes (coluna esquerda) agora também busca e exibe a OS com ID `newOsId` (se existir), mostrando seus itens lidos do Firestore.
    *   A UI permite remover itens *apenas* desta nova OS (`newOsId`).
    *   O carrinho (coluna direita) exibe a *soma* dos itens das `charges` originais + os itens atuais lidos do documento `newOsId`.
5.  **Exclusão da OS Vazia (Frontend + Backend?):**
    *   Após uma remoção de item que deixa o array `items` da `newOsId` vazio no Firestore, o frontend detecta isso.
    *   O frontend pode chamar uma nova função backend `deleteEmptyCashierOs(osId)` para remover o documento OS do Firestore **OU** o frontend pode ter permissão para deletar diretamente via SDK (requer análise de regras de segurança).
6.  **Finalização do Pagamento (Frontend + Backend `processPayment`):**
    *   O `PaymentDialog` recebe a lista de `chargeIds` originais *e* o `newOsId` (se existir e tiver itens).
    *   A função `processPayment` recebe ambos `chargeIds` e um novo parâmetro, talvez `continuedOsId`.
    *   **Validação:** Remove a validação que proíbe `chargeIds` e `cartItems` simultaneamente. Adapta a validação para o cenário híbrido.
    *   **Transação Híbrida:**
        *   **Leituras:** Lê todas as `charges` (usando `chargeIds`) e a `order_service` (usando `continuedOsId`).
        *   **Escritas:**
            *   Atualiza status das `charges` originais para `paid`.
            *   Atualiza status da `order_service` (`continuedOsId`) para `completed` (ou `paid`).
            *   Cria *uma* `transaction` referenciando *todos* os IDs pagos (`chargeIds` e `continuedOsId`) no campo `chargeIds` (ou um novo campo como `relatedDocumentIds`).

**Novas Tarefas / Alterações Necessárias:**

*   [X] **Backend:** Criar função `createContinuedOrderService`.
*   [ ] **Backend:** Criar (ou decidir sobre) função `deleteEmptyCashierOs`.
*   [ ] **Backend:** Refatorar `processPayment` para:
    *   [ ] Remover validação de `chargeIds` + `cartItems` simultâneos.
    *   [ ] Aceitar `chargeIds` e `continuedOsId` (ou estrutura similar).
    *   [ ] Implementar lógica de leitura/escrita híbrida na transação (atualizar `charges` e `order_service`).
    *   [ ] Ajustar criação da `transaction` para referenciar todos os documentos pagos.
*   [X] **Frontend (`Cashier.jsx`):**
    *   [X] Implementar chamada a `createContinuedOrderService` no clique do botão "Continuar Comprando".
    *   [X] Abrir modal de produtos e guardar `newOsId`.
    *   [ ] Modificar query/exibição da lista de pendentes para incluir a `order_service` ativa (`newOsId`).
    *   [ ] Permitir remoção de itens apenas da `newOsId` (atualizando Firestore).
    *   [ ] Implementar lógica para chamar `deleteEmptyCashierOs` quando a `newOsId` ficar vazia.
    *   [ ] Ajustar cálculo e exibição do carrinho para combinar itens das `charges` e da `newOsId`.
    *   [ ] Passar `chargeIds` e `newOsId` para o `PaymentDialog`.
*   [X] **Frontend (Modal Produtos/Serviços):**
    *   [X] Modificar lógica de adição/remoção/atualização para salvar itens diretamente no documento Firestore da OS (`newOsId`) em vez de apenas no estado local.
*   [ ] **Firestore:** Ajustar/Confirmar estrutura da coleção `order_services` para incluir `status: 'cashier_adding_items'`, `source: 'cashier_direct'`, e `items: []`.
*   [ ] **Firestore:** Definir regras de segurança para permitir escrita no array `items` da OS pelo usuário do caixa e a exclusão da OS vazia.

## 12. Últimas Atualizações (30/04/2025 - Tarde)

*   **Fluxo "Continuar Comprando":**
    *   **Backend (`functions/src/index.ts`):**
        *   Função `createContinuedOrderService` implementada para criar a OS temporária com status `pending_cashier`.
        *   Função `deleteEmptyCashierOs` implementada para remover a OS temporária se ela ficar sem itens.
        *   Função `processPayment` refatorada para aceitar `chargeIds` e `continuedOsIds`, lendo e atualizando ambos os tipos de documentos na transação e referenciando ambos na `transaction` resultante.
    *   **Frontend (`Cashier.jsx`, `QuickSaleModal.jsx`, `PaymentDialog.jsx`):**
        *   Listeners e estado `pendingItems` ajustados para incluir `order_services` com status `pending_cashier`.
        *   Exibição da coluna esquerda atualizada para mostrar ambos os tipos de itens e destacar a OS ativa.
        *   Lógica de `handleContinueShopping` modificada para reutilizar uma OS `pending_cashier` existente antes de criar uma nova.
        *   `QuickSaleModal.jsx` adaptado para interagir diretamente com a `order_service` (`targetOsId`).
        *   Função de carregamento de itens adaptada para carregar de `charges` e `order_services`.
        *   `PaymentDialog.jsx` atualizado para receber e enviar `continuedOsIds`.
        *   Chamada a `deleteEmptyCashierOs` implementada ao fechar o modal.
        *   Introduzido `cartItemId` (UUID) para identificar linhas no carrinho principal; `removeFromCart` ajustado.
        *   Implementada lógica condicional no botão 'X' do carrinho: remoção direta para itens de OS/venda anônima, chamada a `handleOpenCancellationModal` para itens de `charges`.
    *   **Regras Firestore (`firestore.rules`):**
        *   Adicionadas regras para permitir `read` e `update` em `order_services` por membros do tenant.

*   **Fluxo "Cancelamento com Motivo" (para itens de `charges`):**
    *   **Frontend (`CancellationReasonModal.jsx`):**
        *   Componente criado com input de texto para o motivo.
        *   Lógica implementada para chamar `onConfirm` com `item.id` (ID original da charge), `originalDocumentId` e `reason`.
    *   **Frontend (`Cashier.jsx`):**
        *   Modal `CancellationReasonModal` importado e integrado.
        *   Estado `isCancellationModalOpen` e `itemToCancel` adicionado.
        *   Função `handleOpenCancellationModal` implementada para abrir o modal com o item correto.
        *   Função `handleConfirmCancellation` implementada:
            *   Chama a Cloud Function `cancelChargeItem`.
            *   Em caso de sucesso, remove o item visualmente do carrinho (`cartItems`) usando `cartItemId`.
    *   **Backend (`functions/src/index.ts`):**
        *   Cloud Function `cancelChargeItem` (v2 `onCall`) implementada:
            *   Valida autenticação e `tenantId` (via `request.auth.token`).
            *   Recebe `chargeId`, `itemId` e `reason`.
            *   Usa transação Firestore para encontrar o item na `charge` e marcar `cancelled: true` e `cancellationReason`.
            *   Interface `ChargeItem` e `CancelChargeItemData` adicionadas.
    *   **Depuração:**
        *   Resolvidos múltiplos erros de compilação TypeScript (`TS2307`, `TS6133`, `TS2345`, `TS2694`, `TS2552`) relacionados a imports (v1 vs v2, `./firebaseAdmin`), tipos (`CallableContext`, `CallableRequest`), e uso de interfaces.
        *   Identificado e corrigido erro de permissão na `cancelChargeItem` devido à falta da claim `tenantId` no token do usuário.
*   **Segurança / Administração:**
    *   **Problema:** Identificado que a ausência da claim `tenantId` no token do usuário administrador impedia o funcionamento correto das funções que validam o tenant (ex: `cancelChargeItem`).
    *   **Solução Temporária:** Decidido **remover** a função utilitária `setCustomUserClaimsUtil` (que permitiria setar a claim manualmente) e optar por **deletar e recriar a loja de teste**. A função `createTenantAndAdmin` existente já define as claims corretamente durante a criação.
    *   **Preocupação:** Levantada a questão da falta de exclusão em cascata no Firestore ao deletar um tenant manualmente, o que pode deixar dados órfãos em outras coleções.

*   **Estado Atual:**
    *   Fluxo "Continuar Comprando" funcionalmente completo, aguardando testes mais extensos.
    *   Fluxo "Cancelamento com Motivo" implementado (frontend e backend), mas **aguardando teste final** após a recriação da loja/usuário de teste (para garantir que a claim `tenantId` esteja presente).
    *   Consciente da necessidade futura de implementar uma solução para exclusão completa de dados do tenant (Cloud Function ou Script).

*   **Próximos Passos Imediatos:**
    1. Deletar a loja e usuário de teste atuais.
    2. Criar uma nova loja de teste usando a funcionalidade existente (que chama `createTenantAndAdmin`).
    3. Logar com o novo usuário administrador.
    4. Testar o fluxo completo de cancelamento de item com motivo no caixa.
    5. (Opcional) Testar novamente o fluxo "Continuar Comprando".
    6. Proceder com as próximas tarefas Pós-MVP (ex: refatoração da UI do caixa, modal de confirmação de finalização, etc.).
