# Contexto do Projeto: PetSystemTenant

## 1. Objetivo Principal

Sistema de gerenciamento para clínicas veterinárias, focando em agendamentos, prontuários de pets e comunicação com tutores. Baseado em Multi-Tenant

## 2. Tecnologias Principais

*   **Frontend:** React, Vite, TypeScript, Tailwind CSS
*   **Backend:** Node.js, JavaScript
*   **Banco de Dados:** Firebase
*   **Autenticação:** Firebase Auth
*   **Infraestrutura/Hospedagem:** Google Cloud, Domínio na Godaddy, VM na Oracle Cloud
*   **Outras Bibliotecas/Ferramentas Importantes:** Zustand, Radix UI
## 3. Estrutura de Diretórios Chave

*   `src/`: Código fonte principal
    *   `pages/`: Componentes de página
    *   `components/`: Componentes React reutilizáveis
        *   `ui/`: Componentes de UI genéricos (baseados em shadcn/ui, tailwindcss, radix-ui)
    *   `lib/`: Funções utilitárias, clientes de API, etc.
    *   `hooks/`: Hooks React customizados
    *   `contexts/`: Contextos React
    *   `api/`: Código do backend 
*   

## 4. Convenções e Padrões
*   Para roteamento, a página está em src/pages/index.jsx
*   O layout das loja Tenant que é o menu principalmente, está em src/pages/layout.jsx
*   As funções do Firebase está em functions/index.ts
*   As Regras do Firebase está na raiz do projeto no arquivo firestore.rules
*   Estado global gerenciado com Zustand
*   Chamadas de API usam os SDKs do Firebase e a fetch API, com lógica distribuída em src/lib/ e src/api/

## 4.1 Backend (Firebase Functions)

*   **Funções Firebase (`functions/src/index.ts`):**
    *   **Criação de Tenant/Admin (`createTenantAndAdmin`):** Cria novos tenants e seus administradores iniciais (Callable, Super Admin).
    *   **Gestão de Convites (`inviteCollaborator`, `completeInvitation`):** Gerencia o fluxo de convite e cadastro de novos colaboradores (Callable).
    *   **Confirmação WhatsApp (`sendWahaConfirmation`, `wahaWebhook`, `scheduledAppointmentCheck`):** Envia mensagens de confirmação de agendamento via WAHA (Callable, HTTP Webhook, Scheduler) e processa respostas para atualizar status.
    *   **Gatilho de Agendamento (`onAppointmentUpdate`):** Cria/atualiza registros associados (Episódios Clínicos, Ordens de Serviço Petshop) quando o status do agendamento muda (ex: para 'Chegou') (Firestore Trigger).

## 5. Fluxos Importantes / Lógica Complexa

*   Principais recursos do sistema Lojas Tenants:
    
    Dashboard - Panorama e dados gerais do sistema que ainda está estático e teremos que refatorar em algum momento 
        (src/pages/Dashboard.jsx)

    Clientes - Área responsável pelo cadastramento de clientes (tutores) e seus Pets
        src/pages/Customers.jsx - Lista dos clientes
        src/components/customers/CustomerForm.jsx - Cadastro de Clientes
        src/pages/CustomerDetails.jsx - Detalhamento do cliente que é possível editar seus dados através do menu de Ações e Adicionar Novo Pet
        src/pages/PetForm.jsx - É o cadastro do Pet, com sistema de upload de imagem do Pet
        src/pages/PetDetails.jsx - Detalhe do Pet, onde é guardado o Histórico Clínico (Episódios)
    
    Agenda - Aqui é o sistema de Admissão e praticamente o controle geral do projeto onde acontece o fluxo do Paciente. 
        src/pages/Tenant/AgendaPage.jsx - Controle do Calendário e agendamentos
        src/components/appointment/AppointmentForm.jsx - Formulário de agendamento

    Live Vet - Fila de atendimento do médico veterinário
        src/modules/live-vet/pages/LiveVetDashboard.jsx - Fila de Atendimento do Live Vet, onde temos abas de status do atendimento: Fila de Espera, Retornos, Aguardando, Histórico
        src/modules/live-vet/pages/LiveVetConsulta.jsx - Área de atendimento do médico veterinário, onde ele tem todas as informações necessárias para fazer o atendimento do pet, como seus dados, prontuário, episódios anteriores, prescrição médica, atendimento por IA etc...

    Fila de Atendimento - Atendimento de serviços de petshop
        src/pages/ServiceQueue.jsx - Fila de atendimento de petshop, onde é possível ver o atendimento em modo Lista ou Quadro

    Medicação Interna - Quando o Médico Veterinário indica que tem prescrição médica para medicação interna, o pet vai para esta fila de atendimento
        src/pages/MedicationQueue.jsx - Fila de Atendimento para medicação Interna
        src/components/medication/MedicationAdministrationModal.jsx - Área de administração da medicação do pet
    
    Produtos - Cadastro de produtos de petshop ou clinica veterinária
        src/pages/Products.jsx - Lista dos produtos cadastrados
        src/components/products/ProductForm.jsx - Formulário para cadastro de produtos

    Vendas (Vamos mudar para Caixa) - Área de recebimento dos valores dos serviços clinicos e veterinários, além da compra de produtos
        src/pages/Sales.jsx - controle das vendas pendentes além de também vender produtos e serviços direto no caixa
        src/pages/SalesHistory.jsx - Histórico de vendas
    
    Serviços - CRUD de cadastro de serviços
        src/pages/Services.jsx - lista dos serviços cadastrados
        src/components/services/ServiceForm.jsx - Cadastro dos serviços

    Modelos de Prescrição - CRUD de cadastramento de templates para prescrição
        src/pages/PrescriptionManager.jsx - Lista das prescrições cadastradas
        src/components/prescriptions/PrescriptionTemplateForm.jsx - Cadastro das Prescrições

    Financeiro - Gestão Financeira - Módulo que ainda não foi implementado
        src/pages/Financial.jsx - Quando implantado, será aqui o controle financeiro

    Configurações - Área de configurações gerais da loja Tenant
       src\pages\Settings.jsx - Lista as configurações em Abas como: 
            Identidade Visual
            Informações da Empresa
            Preferências
            Horários
            Mensagens

    Perfis - Gestão de Perfis do sistema
        src/pages/Tenant/ProfilesPage.jsx - Lista dos Perfis Cadastrados
        src/pages/Tenant/ProfileFormPage.jsx - Cadastro dos Perfis

    Colaboradores - Gestão de Colaboradores da loja Tenant
        src/pages/Tenant/EmployeesPage.jsx - Lista os Colaboradores Cadastrados
        src/pages/Tenant/EmployeeFormPage.jsx - Cadastro dos Colaboradores

    Integrações - Destinado a ser o local de integrações com outros sistemas/api
        src/pages/Tenant/IntegrationsPage.jsx - Aqui temos apenas uma integração por enquanto que é com a API WAHA que serve para conectar e desconectar o WhatsApp

    Suporte - Área de Suporte ao cliente (ainda em desenvolvimento)
        src/pages/Support.jsx - Área ao qual você autoriza um super admin entrar no sistema para entender o problema do usuário (ainda não está funcionando)
        
    Segue o fluxo:
        Cliente conhece a clínica/petshop e entra em contato
        Cliente agenda um dia e horário para uma consulta
        Cliente é cadastrado em Clientes, Junto com seu Pet
        Cliente na agenda, fica com o status - Agendado
            Se ele agendou 24hs antes, uma rotina verifica agendamentos futuros de 15 em 15 minutos
            Se ele encontra um agendamento dentro das 24hs, manda uma mensagem via WhatsApp pela API Waha (waha.petfacil.app) para o Cliente Confirmar a consulta.
            Se ele confirmar com Sim, o Status do cliente passa de Agendado para Confirmado
            Se ele confirmar com Não, o Status do cliente passa de Agendado para Cancelado
        Uma vez o cliente confirmado, ele é aguardado chegar na clínica.
        Cliente chega na clínica
        Atendente muda o status para "Chegou" - Aqui inicia o Check-in
            Pet do tutor recebe um número de prontuário único que será seu registro na clínica
            Pet do tutor recebe seu número de atendimento que chamamos de episódio, a cada novo atendimento, um novo episódio
            Check-in Iniciado, cliente é enviado para a Fila de Atendimento Live Vet
            Médico Veterinário Inicia Atendimento
        Status da Agenda, muda de Chegou para: Em Atendimento
            Médico Veterinário entra no ambiente de atendimento do pet com todas as suas informações e histórico de episódios anteriores
            Médico Veterinário finaliza atendimento
        Agenda recebe o status de Concluído
            Episódio atual vai para o histórico de episódio do pet na página de detalhes do pet
    Caso o agendamento for serviços de petshop, o fluxo é praticamente igual, porém em vez de abrir um episódio para serviços clínicos, é aberto uma Ordem de Serviço para os serviços de Petshop. A fila de atendimento é apartado da fila médica também com controle de: Aguardando, Em Atendimento e Concluídos


## 6. Pontos de Atenção / Dívidas Técnicas

*   Reestruturar o recurso Vendas (Caixa) para ler as OS e Episódios dos clientes para cobrança
*   Criar o módulo Financeiro
*   Trabalhar envio de link para o cliente fazer seu auto-cadastro no estabelecimento
*   Definir como será o Dashboard funcional
*   Existem lugares que fazem pacotes mensais de serviços de petshop, precisamos trabalhar como isso se encaixa no nosso fluxo
*   Área de importação de clientes, ter a possibilidade de ler um excel, csv, etc, para cadastrar clientes automaticamente
*   Internação - trabalhar o fluxo de internação do Pet
*   Leva e Traz - trabalhar um sistema simples de controle de Leva e Traz dos pets, como módulo
*   Refatorar `functions/src/index.ts` para uma estrutura modular (múltiplos arquivos) para melhor organização e manutenção


## 7. Links Úteis (Opcional)

*   _(Ex: Documentação da API externa: [link])_
*   _(Ex: Design no Figma: [link])_

---

_(Lembre-se de manter este arquivo atualizado conforme o projeto evolui!)_
