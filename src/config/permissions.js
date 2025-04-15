// src/config/permissions.js

// Definição centralizada dos recursos permissionáveis
// O 'id' deve ser estável e representar a funcionalidade central.
// O 'label' é usado para exibição na UI de gestão de perfis.
// 'modules' indica a quais tipos de negócio o recurso se aplica ('vet', 'shop').
export const PERMISSION_RESOURCES = [
  // --- Recursos Comuns (Vet & Shop) ---
  { id: 'dashboard',           label: 'Dashboard',           modules: ['vet', 'shop'] },
  { id: 'clientes',            label: 'Clientes (Tutores)',  modules: ['vet', 'shop'] }, // Permissão única cobre CRUD
  { id: 'pets',                label: 'Pets',                modules: ['vet', 'shop'] }, // Permissão única cobre CRUD
  { id: 'agenda',              label: 'Agenda (Geral)',      modules: ['vet', 'shop'] }, // Renomear label aqui se necessário -> 'Admissão (Agenda)'
  { id: 'fila_atendimento',    label: 'Fila de Atendimento', modules: ['vet', 'shop'] },
  { id: 'servicos_cadastro',   label: 'Serviços (Cadastro)', modules: ['vet', 'shop'] }, // Gerenciar os tipos de serviço
  { id: 'financeiro',          label: 'Financeiro',          modules: ['vet', 'shop'] },
  { id: 'configuracoes_tenant',label: 'Configurações Tenant',modules: ['vet', 'shop'] }, // Acesso Admin
  { id: 'perfis_gestao',       label: 'Perfis (Gestão)',     modules: ['vet', 'shop'] }, // Acesso Admin
  { id: 'colaboradores_gestao',label: 'Colaboradores(Gestão)',modules: ['vet', 'shop'] }, // Acesso Admin
  { id: 'suporte',             label: 'Suporte',             modules: ['vet', 'shop'] },

  // --- Recursos Específicos VET ---
  { id: 'prontuarios',         label: 'Prontuários Médicos', modules: ['vet'] }, // Permissão única cobre CRUD
  { id: 'live_vet',            label: 'Live Vet (Telemed)',  modules: ['vet'] },
  { id: 'medicacao_interna',   label: 'Medicação Interna',   modules: ['vet'] }, // Verificar escopo exato vs. Internação
  { id: 'modelos_prescricao',  label: 'Modelos Prescrição',  modules: ['vet'] },
  { id: 'historico_vacinas',   label: 'Histórico Vacinas',   modules: ['vet'] },
  { id: 'historico_medicamentos',label: 'Histórico Medicamentos',modules: ['vet'] },
  { id: 'historico_alergias',  label: 'Histórico Alergias',  modules: ['vet'] },
  // Adicionar outros recursos Vet aqui... (ex: 'internacao', 'exames')

  // --- Recursos Específicos SHOP ---
  { id: 'produtos_cadastro',   label: 'Produtos (Cadastro)', modules: ['shop'] },
  { id: 'vendas_pdv',          label: 'Vendas (PDV)',        modules: ['shop'] },
  { id: 'loja_config',         label: 'Loja (Configuração)', modules: ['shop'] },
  { id: 'loja_dashboard',      label: 'Loja (Dashboard)',    modules: ['shop'] },
  // Adicionar outros recursos Shop aqui... (ex: 'controle_estoque')
];

// Ações de permissão disponíveis
export const PERMISSION_ACTIONS = ['ler', 'escrever']; // Simplificado: 'escrever' implica criar/editar/excluir neste contexto

// --- Módulos Disponíveis no Sistema ---
// Define todos os módulos que podem ser contratados ou usados.
export const AVAILABLE_MODULES = [
  { id: 'vet', label: 'Clínica Veterinária' },
  { id: 'shop', label: 'Pet Shop' },
  // Adicionar futuros módulos aqui
  // { id: 'financeiro', label: 'Financeiro' },
  // { id: 'delivery', label: 'Leva e Traz' },
];

// Função auxiliar (opcional) para gerar a string de permissão
export const formatPermission = (resourceId, action) => `${resourceId}:${action}`;

// Função auxiliar (opcional) para parsear a string
export const parsePermission = (permissionString) => {
    const parts = permissionString.split(':');
    if (parts.length === 2) {
        return { resource: parts[0], action: parts[1] };
    }
    return null; // Formato inválido
};

// Poderíamos adicionar aqui funções para checar permissões se quiséssemos centralizar
// export const hasPermission = (userPermissions, resourceId, action) => { ... } 