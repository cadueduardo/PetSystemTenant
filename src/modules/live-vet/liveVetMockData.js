// src/modules/live-vet/liveVetMockData.js
import { generateUniqueId } from '@/api/mockData'; // Reutilizando o gerador de ID

// Chave separada para o localStorage do módulo Live Vet
export const LIVE_VET_STORAGE_KEY = 'live_vet_mock_data';

// Dados iniciais específicos do Live Vet
const initialLiveVetData = {
  consultations: {}, // Usaremos um objeto para acesso rápido por ID
  templates: [],
  // Adicionar outros dados específicos se necessário
};

// Inicializa o armazenamento do Live Vet se não existir
if (!localStorage.getItem(LIVE_VET_STORAGE_KEY)) {
  localStorage.setItem(LIVE_VET_STORAGE_KEY, JSON.stringify(initialLiveVetData));
}

// Funções auxiliares para manipular dados mockados do Live Vet
export const getLiveVetMockData = () => {
  const data = localStorage.getItem(LIVE_VET_STORAGE_KEY);
  if (!data) {
    localStorage.setItem(LIVE_VET_STORAGE_KEY, JSON.stringify(initialLiveVetData));
    return initialLiveVetData;
  }
  try {
    return JSON.parse(data);
  } catch (error) {
    console.error("Erro ao parsear dados mock do Live Vet:", error);
    localStorage.setItem(LIVE_VET_STORAGE_KEY, JSON.stringify(initialLiveVetData)); // Reseta se corrompido
    return initialLiveVetData;
  }
};

export const setLiveVetMockData = (data) => {
  try {
    if (!data || typeof data !== 'object') {
      throw new Error('Dados inválidos para salvar no Live Vet mock');
    }
    const jsonString = JSON.stringify(data);
    localStorage.setItem(LIVE_VET_STORAGE_KEY, jsonString);
  } catch (error) {
    console.error("Erro ao salvar dados mock do Live Vet:", error);
  }
};

// --- Mocks das Entidades Live Vet --- 

export const ConsultationMock = {
  list: async () => {
    const data = getLiveVetMockData();
    // Retorna um array das consultas (valores do objeto)
    return Object.values(data.consultations || {});
  },

  get: async (id) => {
    const data = getLiveVetMockData();
    const consultation = (data.consultations || {})[id];
    if (!consultation) throw new Error('Consulta não encontrada');
    return consultation;
  },

  filter: async (filters = {}) => {
    const data = getLiveVetMockData();
    let filteredConsultations = Object.values(data.consultations || {});

    if (filters.tenant_id) {
      filteredConsultations = filteredConsultations.filter(c => c.tenant_id === filters.tenant_id);
    }
    if (filters.petId) {
      // Importante para buscar o histórico do pet
      filteredConsultations = filteredConsultations.filter(c => c.petId === filters.petId);
    }
    if (filters.appointmentId) {
      filteredConsultations = filteredConsultations.filter(c => c.appointmentId === filters.appointmentId);
    }
    if (filters.status) {
      filteredConsultations = filteredConsultations.filter(c => c.status === filters.status);
    }
    // Adicionar mais filtros se necessário (ex: por data, por vetId)

    // Ordena por data (mais recente primeiro, opcional)
    filteredConsultations.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return filteredConsultations;
  },

  create: async (consultationData) => {
    const data = getLiveVetMockData();
    const newConsultation = {
      id: generateUniqueId(),
      ...consultationData,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      tenant_id: consultationData.tenant_id || localStorage.getItem('current_tenant') // Garante tenant_id
    };
    data.consultations = data.consultations || {};
    data.consultations[newConsultation.id] = newConsultation;
    setLiveVetMockData(data);
    return newConsultation;
  },

  update: async (id, consultationData) => {
    const data = getLiveVetMockData();
    if (!data.consultations || !data.consultations[id]) {
      throw new Error('Consulta não encontrada para atualização');
    }
    data.consultations[id] = {
      ...data.consultations[id],
      ...consultationData,
      updatedAt: new Date().toISOString()
    };
    setLiveVetMockData(data);
    return data.consultations[id];
  },

  delete: async (id) => {
    const data = getLiveVetMockData();
    if (data.consultations && data.consultations[id]) {
      delete data.consultations[id];
      setLiveVetMockData(data);
    }
  }
};

export const QuestionnaireMock = {
  // Implementação básica, pode ser expandida depois
  list: async () => {
    const data = getLiveVetMockData();
    return data.templates || [];
  },
  create: async (templateData) => {
    const data = getLiveVetMockData();
    const newTemplate = {
      id: generateUniqueId(),
      ...templateData,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      tenant_id: templateData.tenant_id || localStorage.getItem('current_tenant')
    };
    data.templates = data.templates || [];
    data.templates.push(newTemplate);
    setLiveVetMockData(data);
    return newTemplate;
  },
  // Adicionar get, filter, update, delete conforme necessário
}; 