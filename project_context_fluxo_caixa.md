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

1.  [ ] **Frontend:** Refatorar `Cashier.jsx` para nova UX (sem abas, linhas de cliente expansíveis com detalhes dos itens via collapse, modal "Continuar Comprando" gerando nova OS para itens avulsos).
2.  [ ] **Frontend:** Refatorar `SalesHistory.jsx` para buscar e exibir `charges` pagas (em vez da estrutura antiga `PurchaseHistory`).
3.  [ ] **Backend/Frontend:** Implementar funcionalidade "Gerar NF" em `SalesHistory.jsx` (botão por linha, chamar função backend para separar itens e integrar com API de NF).
4.  [ ] **Backend:** Integração completa com API de emissão de NFSe/NFC-e.
5.  [ ] **Backend:** Implementação da lógica de cálculo e registro de comissões.
6.  [ ] **Backend/Frontend:** Tratamento de pagamentos parciais e estorno/reembolso.
7.  [ ] **Frontend:** Implementar funcionalidade de exportação para Excel em `ChargeHistory.jsx`.

## 9. Últimas Atualizações (28/04/2025)

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
