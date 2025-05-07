# Requisitos para Prescrição Médica Veterinária

Este documento descreve os requisitos funcionais e técnicos para a implementação de um sistema formal de prescrição médica veterinária dentro do PetSystemTenant, especificamente originando-se da tela de consulta (`LiveVetConsulta.jsx`).

## Objetivo

Garantir que as prescrições geradas pelo sistema atendam aos requisitos legais e profissionais, incluindo identificação do veterinário, assinatura (ou representação digital), formatação padronizada (timbrado), e tratamento diferenciado para medicamentos de controle especial.

## Requisitos Principais

1.  **Identificação do Veterinário:**
    *   Toda prescrição deve ser associada ao médico veterinário que a emitiu.
    *   O sistema deve capturar e exibir o **Nome Completo** e o número de registro profissional (**CRMV - Conselho Regional de Medicina Veterinária**) do veterinário responsável.
    *   **Fonte de Dados:** Dados do usuário/colaborador logado (`auth.currentUser` + dados da coleção `colaboradores` ou equivalente, onde o CRMV está armazenado).

2.  **Tipos de Prescrição:**
    *   O sistema deve diferenciar claramente entre:
        *   **Uso Interno:** Medicamentos administrados na própria clínica/hospital.
        *   **Uso Externo:** Medicamentos a serem adquiridos e administrados pelo tutor em casa.
    *   Pode haver necessidade de templates ligeiramente diferentes ou informações adicionais dependendo do tipo.

3.  **Template Padronizado (Timbrado):**
    *   As prescrições devem seguir um layout padrão e profissional.
    *   **Informações Mandatórias no Template:**
        *   Dados da Clínica/Tenant (Nome, Endereço, Telefone - obtidos do `tenantContextData`).
        *   Dados do Paciente (Nome do Pet, Espécie, Raça - obtidos de `pet`).
        *   Dados do Tutor (Nome Completo - obtido de `customer`).
        *   Data da Emissão.
        *   Detalhes da Medicação:
            *   Nome do medicamento/princípio ativo.
            *   Concentração/Apresentação.
            *   Quantidade.
            *   **Registro MAPA:** Número de registro no Ministério da Agricultura, Pecuária e Abastecimento (quando aplicável).
            *   Posologia (Dose, via de administração, frequência, duração do tratamento).
        *   Observações adicionais (campo `currentPrescriptionObservations`).
        *   Dados do Veterinário (Nome Completo, CRMV).
        *   Assinatura (ou espaço para assinatura / representação digital).

4.  **Assinatura:**
    *   Definir como a "assinatura" será representada. Opções:
        *   Espaço em branco para assinatura manual após impressão.
        *   Exibição digital do Nome e CRMV de forma destacada.
        *   (Futuro) Integração com assinatura digital certificada (mais complexo).
        *   (Futuro) Uso de uma imagem de assinatura pré-cadastrada no perfil do veterinário.
    *   **Inicialmente:** Pode-se focar em exibir claramente o Nome e CRMV do veterinário responsável.

5.  **Medicamentos Controlados:**
    *   O sistema precisa identificar medicamentos que exigem receita de controle especial (ex: psicotrópicos, antibióticos específicos).
    *   **Identificação:** Necessário um mecanismo para marcar um produto/medicamento como controlado (ex: um campo booleano `isControlled` na coleção `products`).
    *   **Template Diferenciado:** Prescrições controladas devem incluir:
        *   Aviso legal destacado (ex: "Receita de Controle Especial - 1ª via Retida", "Venda Sob Prescrição Veterinária").
        *   Geração em múltiplas vias (normalmente 2 ou 3, dependendo da legislação local e do tipo de medicamento - ex: 1 para farmácia, 1 retida pela clínica). O sistema deve facilitar a impressão dessas vias.
    *   **Retenção:** O sistema deve indicar a necessidade de retenção física da via apropriada pela clínica. (O controle físico em si é operacional, mas o sistema deve gerar a via destinada à retenção).

6.  **Geração e Armazenamento:**
    *   O sistema deve permitir a **geração/impressão** da prescrição finalizada a partir de `LiveVetConsulta.jsx`. (Utilizar/Melhorar `PrintablePrescriptionContent.jsx`).
    *   Definir como a prescrição finalizada será **armazenada** para referência futura e auditoria. Opções:
        *   Salvar os dados estruturados da prescrição (itens, vet, data, etc.) junto ao registro da consulta/episódio.
        *   Gerar um PDF da prescrição no momento da finalização e armazenar o link (ex: no Cloud Storage) associado à consulta/episódio. (Preferível para garantir a imutabilidade do documento emitido).

## Pontos de Atenção / Implementação

*   **Dados do Veterinário:** Confirmado que CRMV está disponível nos dados do colaborador/usuário logado. Garantir acesso a esses dados em `LiveVetConsulta.jsx`.
*   **Dados do Produto:** Campos adicionais necessários em `products` (ex: `isControlled`, `registroMAPA`).
*   **Identificação de Controlados:** Como marcar um item como controlado? Adicionar campo em `products`.
*   **Templates:** Como gerenciar os diferentes templates (interno, externo, controlado)? Pode ser condicional dentro do `PrintablePrescriptionContent.jsx`. (Avaliar necessidade de configuração via `Settings.jsx` em fase posterior).
*   **Interface:** `LiveVetConsulta.jsx` precisará de:
    *   Acesso aos dados do veterinário logado (Nome, CRMV).
    *   Possivelmente um passo de "Revisar e Finalizar Prescrição" antes de gerar/imprimir.
    *   Lógica para identificar se há itens controlados na prescrição atual.
*   **Componente de Impressão:** `PrintablePrescriptionContent.jsx` precisará ser refatorado para incluir todas as informações do template, lógica condicional para controlados e vias múltiplas.
*   **Armazenamento:** Decidir a estratégia de armazenamento (dados estruturados vs. PDF).

## Próximos Passos

1.  Validar estes requisitos.
2.  Discutir e definir as "Questões Abertas" (identificação de controlados, assinatura digital, armazenamento, necessidade real de configuração de template via `Settings.jsx`).
3.  Detalhar o modelo de dados necessário (novos campos em `products`, incluindo `registroMAPA`; confirmar campos em `colaboradores`).
4.  Planejar as tarefas de implementação. 