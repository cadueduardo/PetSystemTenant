# Plano de Ação para Otimização de Custos - PetSystemTenant

Este documento detalha as tarefas necessárias para otimizar o uso de recursos do Google Cloud Platform (GCP) e Firebase, visando a escalabilidade e a sustentabilidade de custos para um modelo de assinatura fixa.

## Fase 0: Estancar Custos Fixos Imediatos (Prioridade Máxima)

*Objetivo: Reduzir custos que ocorrem independentemente do volume de uso.*

1.  **[X] Revisar Configuração do Cloud Run:**
    *   **Ação:** Para cada serviço no Cloud Run, acessar as configurações de revisão/implantação e definir o **"Número mínimo de instâncias" (`min-instances`) como `0`**.
    *   **Justificativa:** Eliminar custos de instâncias ociosas (`Idle Min-Instance CPU Allocation Time`). Aceitar "cold starts" em troca de economia significativa.
    *   **Impacto Esperado:** Redução substancial do custo associado ao Cloud Run (atualmente ~R$ 62).

2.  **[X] Revisar Configuração do Balanceador de Carga Global:**
    *   **Ação:**
        *   Acessar "Serviços de Rede" -> "Balanceamento de carga" no GCP.
        *   Identificar o Balanceador de Carga Global.
        *   **Simplificar/Eliminar:** Balanceador HTTPS reconfigurado para incluir frontend HTTP com redirecionamento. LB HTTP/Regra de encaminhamento separada eliminada.
    *   **Justificativa:** Eliminar ou reduzir os custos mínimos associados às regras de encaminhamento globais (`Cloud Load Balancer Forwarding Rule Minimum Global`).
    *   **Impacto Esperado:** Redução substancial ou eliminação do custo de Networking associado ao LB (atualmente ~R$ 77).

## Fase 1: Otimizar para Escalabilidade Firebase (Crítico para o Futuro)

*Objetivo: Prevenir que os custos do Firestore e Functions explodam com o aumento do uso.*

3.  **[X] Redesenhar Função Agendada `scheduledAppointmentCheck`:**
    *   **Ação:** **Função `scheduledWahaConfirmationSender` substituída por Cloud Tasks** (gatilho `scheduleWahaConfirmationTask` em `onDocumentWritten` de appointments e handler `wahaConfirmationTaskHandler`).
    *   **Justificativa:** Redução drástica em leituras Firestore e invocações/tempo de execução da função agendada.

4.  **[X] Refatorar Listeners (`onSnapshot`) das Filas/Dashboards:**
    *   **Ação:** Aplicar em `Cashier.jsx`, `LiveVetDashboard.jsx`, `ServiceQueue.jsx`, `MedicationQueue.jsx`.
        *   **Evitar `listen` global:** Não buscar todos os documentos do tenant (`.where('tenantId', '==', id).where('status', 'in', [...])`).
        *   **Implementar:** Paginação (`limit()`), filtros mais específicos, agregação no backend (se viável).
        *   **Exemplo Concluído:** `LiveVetDashboard.jsx` (removido onSnapshot, implementado carregamento manual com debounce).
        *   **Exemplo Concluído:** `ServiceQueue.jsx` (removido onSnapshot, implementado carregamento manual com debounce).
        *   **Exemplo Concluído:** `Cashier.jsx` (removidos listeners, implementado carregamento manual com debounce e verificação final ao carregar).
        *   **Concluído:** `MedicationQueue.jsx` (confirmado que já usa fetch manual).
    *   **Justificativa:** Listeners globais são a principal causa de leituras excessivas quando o número de documentos cresce.
    *   **Impacto Esperado:** Redução drástica de leituras em dashboards/filas conforme o volume de dados aumenta.

5.  **[X] Implementar Subcoleções para Itens:**
    *   **Ação:** Migrar arrays grandes para subcoleções.
        *   **[X] Prioridade:** `charge.items` -> subcoleção `ch_items`.
        *   **[X] Prioridade:** `order_service.items` -> subcoleção `os_items` (incluindo OS temporária do "Continuar Comprando").
        *   **[X] Investigar e migrar `consultation.prescriptionItems` -> `consultation_prescription_items` (Concluído)
        *   **[X] Investigar outros arrays grandes (ex: histórico, logs internos se houver) e avaliar migração.** (Investigado: `medicalRecords` já é uma coleção separada, logs internos são direcionados ao GCP. Nenhum outro array problemático identificado no momento.)
    *   **Refatorar:** Atualizar lógica de leitura e escrita (frontend e backend: `processPayment`, `cancelChargeItem`, `QuickSaleModal.jsx`, `createContinuedOrderService`, etc.) para usar subcoleções.
    *   **Justificativa:** Redução significativa no custo de escrita/atualização/remoção de itens (evita ler/reescrever documento pai inteiro).

## Fase 2: Otimização de Workflows e Dados

*Objetivo: Refinar a eficiência de operações comuns.*

6.  **[X] Auditar e Otimizar Triggers Firestore:**
    *   **Ação:** Revisar triggers como `onAppointmentCompleted`, `onAppointmentArrived`, `sendWahaReplyOnStatusChange`.
        *   Garantir que usem dados do `event.data.after`/`before` sempre que possível, evitando leituras adicionais do mesmo documento.
        *   Avaliar a necessidade de cada escrita (ex: atualizar pet com `prontuarioId` apenas se necessário).
    *   **Funções Analisadas/Otimizadas:**
        *   `onAppointmentCompletedCreateCharge`: Removida leitura redundante do appointment.
        *   `onAppointmentArrived` / `getOrCreateProntuario`: Removida escrita redundante no Pet quando `prontuarioId` já existe.
        *   `sendWahaReplyOnStatusChange`: Lógica parece adequada (depende do status change).
    *   **Impacto Esperado:** Redução de leituras/escritas em operações comuns (concluir agendamento, chegada de paciente), menor latência e custo.

7.  **[ ] Garantir Paginação em Todas as Listas:**
    *   **Ação:** Verificar e implementar paginação (usando `limit()` e `startAfter()` ou similar) em todas as páginas que exibem listas de dados (Clientes, Produtos, Serviços, Históricos, Colaboradores, Perfis, etc.).
    *   **Justificativa:** Evitar picos de leitura ao carregar listas grandes, melhorar performance percebida.

8.  **[X] Otimizar Webhook da WAHA (`handleWahaWebhook`):**
    *   **Ação:** Garantir que a busca pelo agendamento correspondente use um campo indexado no Firestore. Minimizar operações dentro da função.
    *   **Justificativa:** Reduzir tempo de execução e leituras associadas às respostas de WhatsApp.

## Fase 3: Melhoria Contínua e Monitoramento

*Objetivo: Manter visibilidade e capacidade de otimização a longo prazo.*

9.  **[ ] Implementar Monitoramento Detalhado:**
    *   **Ação:**
        *   Configurar/Utilizar Firebase Performance Monitoring e/ou Google Cloud Monitoring.
        *   Rastrear métricas chave: Leituras/Escritas/Exclusões Firestore por coleção, Invocações/Tempo de Execução/Networking Functions.
        *   **Obter Detalhes Atuais do Firestore:** Acessar "Faturamento" -> "Tabela de Custos" no GCP e filtrar por SKUs do Firestore para estabelecer linha de base.
        *   Configurar alertas para picos de custo/uso.
    *   **Justificativa:** Identificar gargalos proativamente e medir impacto das otimizações.

10. **[ ] Revisão Regular de Custos:**
    *   **Ação:** Analisar fatura detalhada do GCP/Firebase mensalmente para entender onde o custo está sendo gerado.
    *   **Justificativa:** Visibilidade financeira contínua.

11. **[ ] Refatoração Modular das Funções Firebase:**
    *   **Ação:** Quebrar o `functions/src/index.ts` monolítico em arquivos menores por funcionalidade (auth, appointments, charges, waha, etc.).
    *   **Justificativa:** Melhorar manutenibilidade, organização e facilitar análise/otimização de funções individuais.

---
*Observação: Marque as caixas `[ ]` como `[X]` conforme as tarefas forem concluídas.* 