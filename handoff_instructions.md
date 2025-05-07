# Instruções para Continuação da Otimização - PetSystemTenant

**Contexto:**

Estamos trabalhando na otimização de custos do Firebase/GCP para o projeto PetSystemTenant, seguindo o plano definido em `optimization_plan.md`. O objetivo atual é concluir a **Tarefa 5: Implementar Subcoleções para Itens**.

Já migramos `charge.items` para `charge_items`. Agora estamos migrando `order_service.items` para `os_items`.

**Problema Atual:**

Estamos enfrentando erros persistentes de linter no arquivo `functions/src/index.ts` após tentar refatorar a função `createContinuedOrderService`.

1.  **Refatoração:** A função `createContinuedOrderService` (usada pelo botão "Continuar Comprando" no `Cashier.jsx`) estava incorretamente tentando chamar a função HTTP Callable `generateOsNumber` de forma interna. Para corrigir isso, realizamos a seguinte refatoração:
    *   Criamos uma função auxiliar interna: `function _internalGenerateOsNumber(tenantId: string): string { ... }` contendo a lógica de geração do número OS.
    *   Modificamos a função HTTP `okexport const generateOsNumber = https.onCall(...)` para ser um *wrapper* que apenas valida o tenant e chama `_internalGenerateOsNumber`.
    *   Modificamos a função `export const createContinuedOrderService = onCall<...>(...)` para chamar a função auxiliar interna `_internalGenerateOsNumber`.

2.  **Erro de Edição:** Múltiplas tentativas de aplicar essa refatoração via edição automática falharam em limpar corretamente o código. O arquivo `functions/src/index.ts` agora contém **definições duplicadas** das funções `generateOsNumber` e `createContinuedOrderService`, resultando em múltiplos erros de linter `Cannot redeclare block-scoped variable`. Pode haver também um erro remanescente `Argument of type 'Firestore' is not assignable to parameter of type 'Request'` de uma tentativa anterior incorreta e um erro `'request.auth' is possibly 'undefined'`.

**Próximos Passos:**

1.  **Corrigir `functions/src/index.ts` MANUALMENTE (Prioridade):**
    *   Abra o arquivo `functions/src/index.ts`.
    *   **Remova Definições Duplicadas:** Certifique-se de que exista **APENAS UMA** definição para cada uma das seguintes funções exportadas:
        *   `export const generateOsNumber = https.onCall(...)` (Esta deve ser a versão *wrapper* que chama `_internalGenerateOsNumber`).
        *   `export const createContinuedOrderService = onCall<...>(...)` (Esta deve ser a versão corrigida que chama `_internalGenerateOsNumber`).
    *   **Verifique a Função Auxiliar:** Confirme que a função `function _internalGenerateOsNumber(...)` existe apenas uma vez.
    *   **Remova Comentários de Blocos Antigos:** Delete quaisquer blocos de código comentados (`/* ... */`) que contenham definições antigas/duplicadas dessas funções.
    *   **Corrija `request.auth` (se necessário):** Verifique a linha onde o linter acusa `'request.auth' is possibly 'undefined'` (provavelmente dentro de `createContinuedOrderService` após a validação `if (!request.auth)`). Use optional chaining (`request.auth?.token?.tenant_id`) ou confirme se a validação anterior é suficiente para o TypeScript.
    *   **Confirme a Chamada Interna:** Garanta que dentro de `createContinuedOrderService`, a chamada para gerar o número seja `osNumber = _internalGenerateOsNumber(tenantId);`.

2.  **Deploy das Funções:**
    *   Após a correção manual, instrua o usuário a executar: `firebase deploy --only functions`

3.  **Teste do Fluxo:**
    *   Peça ao usuário para testar novamente o botão "Continuar Comprando" na página do Caixa (`Cashier.jsx`) para um cliente que *não* tenha uma OS de caixa pendente. O modal `QuickSaleModal` deve abrir corretamente agora.

4.  **Atualizar Plano e Continuar:**
    *   Se o teste for bem-sucedido, marque a subtarefa de `order_service.items` -> `os_items` como concluída na **Tarefa 5** do `optimization_plan.md`.
    *   Prossiga para a próxima etapa do plano (ex: investigar outros arrays ou passar para a Fase 2).

Boa sorte! 