// Armazenamento local para dados mockados
export const STORAGE_KEY = 'mock_data';

// Função para gerar IDs únicos com sufixo aleatório
export const generateUniqueId = () => {
  // Cria um ID baseado em timestamp + string aleatória de 8 caracteres
  return `${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
};

const initialData = {
  customers: [
    {
      id: "cust1",
      full_name: "João Silva",
      email: "joao@email.com",
      phone: "(11) 99999-9999",
      tenant_id: 'clinica-veterinaria-teste'
    },
    {
      id: "cust2",
      full_name: "Maria Santos",
      email: "maria@email.com",
      phone: "(11) 98888-8888",
      tenant_id: 'clinica-veterinaria-teste'
    }
  ],
  pets: [
    {
      id: "pet1",
      name: "Rex",
      species: "dog",
      breed: "Vira-lata",
      owner_id: "cust1",
      tenant_id: 'clinica-veterinaria-teste',
      gender: "male",
      birth_date: "2022-03-15",
      notes: "Amigável, mas medroso",
      consultationHistory: []
    },
    {
      id: "pet2",
      name: "Luna",
      species: "cat",
      breed: "Siamês",
      owner_id: "cust2",
      tenant_id: 'clinica-veterinaria-teste',
      gender: "female",
      birth_date: "2023-01-20",
      notes: "Muito ativa",
      consultationHistory: []
    },
    {
      id: "pet3",
      name: "Thor",
      species: "dog",
      breed: "Golden Retriever",
      owner_id: "cust1",
      tenant_id: 'clinica-veterinaria-teste',
      gender: "male",
      birth_date: "2021-08-10",
      notes: "Adora buscar a bola",
      consultationHistory: []
    }
  ],
  services: [
    {
      id: 'serv1',
      name: 'Banho Completo',
      category: 'banho',
      description: 'Banho completo com shampoo e condicionador premium',
      price: 80,
      duration: 60,
      module: 'petshop',
      tenant_id: 'clinica-veterinaria-teste'
    },
    {
      id: 'serv2',
      name: 'Tosa Higiênica',
      category: 'tosa',
      description: 'Tosa das regiões íntimas, patas e face',
      price: 50,
      duration: 30,
      module: 'petshop',
      tenant_id: 'clinica-veterinaria-teste'
    },
    {
      id: 'serv3',
      name: 'Consulta Veterinária',
      category: 'consulta',
      description: 'Consulta de rotina com veterinário',
      price: 120,
      duration: 30,
      module: 'clinica',
      tenant_id: 'clinica-veterinaria-teste'
    },
    {
      id: 'serv4',
      name: 'Vacinação',
      category: 'vacina',
      description: 'Aplicação de vacinas',
      price: 70,
      duration: 15,
      module: 'clinica',
      tenant_id: 'clinica-veterinaria-teste'
    },
    {
      id: 'serv5',
      name: 'Exame de Sangue',
      category: 'exame',
      description: 'Coleta e análise de sangue',
      price: 150,
      duration: 30,
      module: 'clinica',
      tenant_id: 'clinica-veterinaria-teste'
    }
  ],
  products: [
    {
      id: 'prod1',
      name: 'Ração Premium',
      category: 'food',
      description: 'Ração premium para cães adultos',
      price: 89.90,
      cost_price: 65.00,
      stock_quantity: 50,
      low_stock_threshold: 10,
      tenant_id: 'default'
    },
    {
      id: 'prod2',
      name: 'Shampoo Pet',
      category: 'hygiene',
      description: 'Shampoo para cães e gatos',
      price: 29.90,
      cost_price: 15.00,
      stock_quantity: 30,
      low_stock_threshold: 5,
      tenant_id: 'default'
    }
  ],
  tenants: [
    {
      id: 'clinica-veterinaria-teste',
      name: 'Clínica Veterinária Teste',
      status: 'active',
      selected_modules: ['clinica', 'petshop', 'transport'],
      created_at: '2024-01-01T00:00:00.000Z'
    }
  ],
  appointments: [
    {
      id: generateUniqueId(),
      pet_id: "pet1",
      owner_id: "cust1",
      service_id: "serv3",
      date: new Date().toISOString().split('T')[0],
      time: "09:00",
      duration: 30,
      notes: "Check-up anual do Rex.",
      status: "scheduled",
      tenant_id: 'clinica-veterinaria-teste'
    },
    {
      id: generateUniqueId(),
      pet_id: "pet2",
      owner_id: "cust2",
      service_id: "serv4",
      date: new Date().toISOString().split('T')[0],
      time: "10:30",
      duration: 15,
      notes: "Vacina V10 para Luna.",
      status: "confirmed",
      tenant_id: 'clinica-veterinaria-teste'
    },
    {
      id: generateUniqueId(),
      pet_id: "pet1",
      owner_id: "cust1",
      service_id: "serv5",
      date: new Date().toISOString().split('T')[0],
      time: "11:00",
      duration: 30,
      notes: "Exame pré-operatório.",
      status: "waiting",
      tenant_id: 'clinica-veterinaria-teste'
    },
    {
      id: generateUniqueId(),
      pet_id: "pet2",
      owner_id: "cust2",
      service_id: "serv1",
      date: new Date().toISOString().split('T')[0],
      time: "14:00",
      duration: 60,
      notes: "Banho e tosa higiênica.",
      status: "scheduled",
      tenant_id: 'clinica-veterinaria-teste'
    },
    {
      id: generateUniqueId(),
      pet_id: "pet1",
      owner_id: "cust1",
      service_id: "serv3",
      date: new Date(Date.now() + 86400000).toISOString().split('T')[0],
      time: "15:00",
      duration: 30,
      notes: "Consulta de acompanhamento.",
      status: "scheduled",
      tenant_id: 'clinica-veterinaria-teste'
    },
      {
      id: generateUniqueId(),
      pet_id: "pet2",
      owner_id: "cust2",
      service_id: "serv4",
      date: new Date().toISOString().split('T')[0],
      time: "08:00",
      duration: 15,
      notes: "Vacina aplicada.",
      status: "completed",
      tenant_id: 'clinica-veterinaria-teste'
    }
  ],
  queueServices: [],
  allergies: [],
  vaccines: [],
  medications: [
    {
      id: 'mock-med-1',
      tenant_id: 'clinica-veterinaria-teste',
      name: 'Dipirona Gotas 500mg/ml',
      description: 'Analgésico e antitérmico',
      category: 'Analgésicos',
      unit: 'ml',
      concentration: '500mg/ml',
      presentation: 'Frasco 20ml',
      manufacturer: 'Medley',
      cost_price: 5.50,
      selling_price: 12.00,
      stock_quantity: 50,
      min_stock_level: 10,
      location: 'Prateleira A3',
      notes: 'Uso oral.',
      created_at: '2024-01-10T10:00:00Z',
      updated_at: '2024-01-10T10:00:00Z'
    }
  ],
  medicationTasks: [],
  petshopData: [],
  medicalRecords: [],
  transportServices: [],
  removalReasons: []
};

// Inicializa o armazenamento se não existir
if (!localStorage.getItem(STORAGE_KEY)) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(initialData));
}

// Funções auxiliares para manipular dados mockados
export const getMockData = (entityName = null) => {
  console.log('[getMockData] Buscando dados...');
  try {
    const dataString = localStorage.getItem(STORAGE_KEY);
    if (dataString) {
      console.log('[getMockData] Dados encontrados no localStorage');
      const data = JSON.parse(dataString);
      
      return entityName ? data[entityName] : data;
    } else {
      console.log('[getMockData] localStorage vazio, inicializando com dados padrão.');
      const initialDataCopy = { ...initialData, removalReasons: initialData.removalReasons || [] };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(initialDataCopy));
      return entityName ? initialDataCopy[entityName] : initialDataCopy;
    }
  } catch (error) {
    console.error('[getMockData] Erro ao ler localStorage:', error);
    const fallbackData = { ...initialData, removalReasons: initialData.removalReasons || [] };
    return entityName ? fallbackData[entityName] : fallbackData;
  }
};

export function setMockData(newData) {
    try {
      if (!newData || typeof newData !== 'object') {
        console.error('[setMockData] Dados inválidos:', newData);
        throw new Error('Dados inválidos para salvar');
      }
  
      const jsonString = JSON.stringify(newData);
      localStorage.setItem(STORAGE_KEY, jsonString);
      console.log('[setMockData] Dados salvos com sucesso');
  
    } catch (error) {
      console.error('[setMockData] Erro ao salvar no localStorage:', error);
    }
};

// Mock da entidade Customer
export const CustomerMock = {
  list: async () => {
    const data = getMockData();
    return data.customers || [];
  },

  get: async (id) => {
    const data = getMockData();
    const customer = (data.customers || []).find(c => c.id === id);
    if (!customer) {
      console.error(`[CustomerMock.get] Cliente com ID ${id} não encontrado para o tenant atual.`);
      throw new Error('Cliente não encontrado');
    }
    return customer;
  },

  filter: async (filters = {}) => {
    const data = getMockData();
    let filteredCustomers = [...data.customers];

    if (filters.tenant_id) {
      filteredCustomers = filteredCustomers.filter(c => c.tenant_id === filters.tenant_id);
    }

    return filteredCustomers;
  },

  create: async (customerData) => {
    const data = getMockData();
    const newCustomer = {
      id: generateUniqueId(),
      ...customerData,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    data.customers.push(newCustomer);
    setMockData(data);
    return newCustomer;
  },

  update: async (id, customerData) => {
    const data = getMockData();
    const index = data.customers.findIndex(c => c.id === id);
    if (index === -1) throw new Error('Cliente não encontrado');
    
    data.customers[index] = {
      ...data.customers[index],
      ...customerData,
      updated_at: new Date().toISOString()
    };
    setMockData(data);
    return data.customers[index];
  },

  delete: async (id) => {
    const data = getMockData();
    data.customers = data.customers.filter(c => c.id !== id);
    setMockData(data);
  }
};

// Mock da entidade Pet
export const PetMock = {
  list: async () => {
    const data = getMockData();
    return data.pets || [];
  },

  get: async (id) => {
    const data = getMockData();
    const pet = (data.pets || []).find(p => p.id === id);
    if (!pet) {
      console.error(`[PetMock.get] Pet com ID ${id} não encontrado para o tenant atual.`);
      throw new Error('Pet não encontrado');
    }
    console.log('[PetMock.get] Pet encontrado:', pet);
    return pet;
  },

  filter: async (filters = {}) => {
    const data = getMockData();
    let filteredPets = [...data.pets];

    if (filters.tenant_id) {
      filteredPets = filteredPets.filter(p => p.tenant_id === filters.tenant_id);
    }

    if (filters.owner_id) {
      filteredPets = filteredPets.filter(p => p.owner_id === filters.owner_id);
    }

    console.log('Filtros aplicados:', filters);
    console.log('Pets filtrados:', filteredPets);

    return filteredPets;
  },

  create: async (petData) => {
    console.log('[PetMock.create] Iniciado com dados:', petData);
    const data = getMockData();
    const newPet = {
      ...petData,
      id: generateUniqueId('pet'),
      created_date: new Date().toISOString(),
      updated_date: new Date().toISOString(),
      tenant_id: petData.tenant_id || localStorage.getItem('current_tenant'),
      owner_id: petData.owner_id
    };
    
    if (!newPet.name || !newPet.species || !newPet.breed || !newPet.gender || !newPet.birth_date || !newPet.owner_id || !newPet.tenant_id) {
      console.error('[PetMock.create] Erro: Campos obrigatórios ausentes.', newPet);
      throw new Error('Erro ao criar pet: Campos obrigatórios ausentes.');
    }

    data.pets.push(newPet);
    setMockData(data);
    console.log('[PetMock.create] Pet adicionado e dados salvos:', newPet);
    return newPet;
  },

  update: async (id, petData) => {
    const data = getMockData();
    const index = data.pets.findIndex(p => p.id === id);
    if (index === -1) throw new Error('Pet não encontrado');
    
    data.pets[index] = {
      ...data.pets[index],
      ...petData,
      updated_at: new Date().toISOString()
    };
    setMockData(data);
    return data.pets[index];
  },

  delete: async (id) => {
    const data = getMockData();
    data.pets = data.pets.filter(p => p.id !== id);
    setMockData(data);
  }
};

// Mock da entidade Tenant
export const TenantMock = {
  list: async () => {
    const data = getMockData();
    return data.tenants || [];
  },

  get: async (id) => {
    const data = getMockData();
    const tenant = (data.tenants || []).find(t => t.id === id);
    if (!tenant) throw new Error('Tenant não encontrado');
    return tenant;
  },

  filter: async (filters = {}) => {
    const data = getMockData();
    let filteredTenants = [...(data.tenants || [])];

    if (filters.status) {
      filteredTenants = filteredTenants.filter(t => t.status === filters.status);
    }

    if (filters.access_url) {
      filteredTenants = filteredTenants.filter(t => t.access_url === filters.access_url);
    }

    return filteredTenants;
  },

  create: async (tenantData) => {
    const data = getMockData();
    const newTenant = {
      id: generateUniqueId(),
      ...tenantData,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    data.tenants = data.tenants || [];
    data.tenants.push(newTenant);
    setMockData(data);
    return newTenant;
  },

  update: async (id, tenantData) => {
    const data = getMockData();
    const index = (data.tenants || []).findIndex(t => t.id === id);
    if (index === -1) throw new Error('Tenant não encontrado');
    
    data.tenants[index] = {
      ...data.tenants[index],
      ...tenantData,
      updated_at: new Date().toISOString()
    };
    setMockData(data);
    return data.tenants[index];
  },

  delete: async (id) => {
    const data = getMockData();
    data.tenants = (data.tenants || []).filter(t => t.id !== id);
    setMockData(data);
  }
};

// Mock da entidade TenantUser
export const TenantUserMock = {
  list: async () => {
    const data = getMockData();
    return data.tenantUsers || [];
  },

  get: async (id) => {
    const data = getMockData();
    const user = (data.tenantUsers || []).find(u => u.id === id);
    if (!user) throw new Error('Usuário não encontrado');
    return user;
  },

  filter: async (filters = {}) => {
    const data = getMockData();
    let filteredUsers = [...(data.tenantUsers || [])];

    if (filters.tenant_id) {
      filteredUsers = filteredUsers.filter(u => u.tenant_id === filters.tenant_id);
    }

    return filteredUsers;
  },

  create: async (userData) => {
    const data = getMockData();
    const newUser = {
      id: generateUniqueId(),
      ...userData,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    data.tenantUsers = data.tenantUsers || [];
    data.tenantUsers.push(newUser);
    setMockData(data);
    return newUser;
  },

  update: async (id, userData) => {
    const data = getMockData();
    const index = (data.tenantUsers || []).findIndex(u => u.id === id);
    if (index === -1) throw new Error('Usuário não encontrado');
    
    data.tenantUsers[index] = {
      ...data.tenantUsers[index],
      ...userData,
      updated_at: new Date().toISOString()
    };
    setMockData(data);
    return data.tenantUsers[index];
  },

  delete: async (id) => {
    const data = getMockData();
    data.tenantUsers = (data.tenantUsers || []).filter(u => u.id !== id);
    setMockData(data);
  }
};

// Mock da entidade Service
export const ServiceMock = {
  list: async () => {
    const data = getMockData();
    return data.services || [];
  },

  get: async (id) => {
    const data = getMockData();
    const service = (data.services || []).find(s => s.id === id);
    if (!service) {
       console.error(`[ServiceMock.get] Serviço com ID ${id} não encontrado para o tenant atual.`);
      throw new Error('Serviço não encontrado');
    }
    return service;
  },

  filter: async (filters = {}) => {
    const data = getMockData();
    let filteredServices = [...(data.services || [])];

    const tenantId = filters.tenant_id || localStorage.getItem('current_tenant') || "default";
    console.log('Filtrando serviços para tenant:', tenantId);
    filteredServices = filteredServices.filter(s => s.tenant_id === tenantId);
    console.log('Serviços após filtro de tenant:', filteredServices);

    if (filters.module) {
      console.log('Filtrando por módulo:', filters.module);
      filteredServices = filteredServices.filter(s => s.module === filters.module);
      console.log('Serviços após filtro de módulo:', filteredServices);
    }

    filteredServices = filteredServices.filter(s => s.id);

    return filteredServices;
  },

  create: async (serviceData) => {
    const data = getMockData();
    const newService = {
      id: generateUniqueId(),
      ...serviceData,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    data.services = data.services || [];
    data.services.push(newService);
    setMockData(data);
    return newService;
  },

  update: async (id, serviceData) => {
    const data = getMockData();
    const index = (data.services || []).findIndex(s => s.id === id);
    if (index === -1) throw new Error('Serviço não encontrado');
    
    data.services[index] = {
      ...data.services[index],
      ...serviceData,
      updated_at: new Date().toISOString()
    };
    setMockData(data);
    return data.services[index];
  },

  delete: async (id) => {
    const data = getMockData();
    data.services = (data.services || []).filter(s => s.id !== id);
    setMockData(data);
  }
};

// Mock da entidade QueueService
export const QueueServiceMock = {
  list: async () => {
    const data = getMockData();
    return data.queueServices || [];
  },

  get: async (id) => {
    const data = getMockData();
    const queueItem = (data.queueServices || []).find(q => q.id === id);
    if (!queueItem) throw new Error('Item da fila não encontrado');
    return queueItem;
  },

  filter: async (filters = {}) => {
    const data = getMockData();
    let filteredItems = [...(data.queueServices || [])];
    console.log('[QueueServiceMock.filter] Itens antes de filtrar:', filteredItems.length, 'Filtros:', filters);

    if (filters.tenant_id) {
      filteredItems = filteredItems.filter(q => q.tenant_id === filters.tenant_id);
    }

    if (filters.pet_id) {
      filteredItems = filteredItems.filter(q => q.pet_id === filters.pet_id);
    }

    if (filters.customer_id) {
      filteredItems = filteredItems.filter(q => q.customer_id === filters.customer_id);
    }

    if (filters.service_id) {
      filteredItems = filteredItems.filter(q => q.service_id === filters.service_id);
    }

    if (filters.status) {
       if (typeof filters.status === 'object' && filters.status.$ne) {
           filteredItems = filteredItems.filter(q => q.status !== filters.status.$ne);
       } else {
           filteredItems = filteredItems.filter(q => q.status === filters.status);
       }
    }
    
    if (filters.appointment_date && typeof filters.appointment_date === 'object') {
      const filterDate = filters.appointment_date;
      filteredItems = filteredItems.filter(q => {
        try {
          const itemDate = new Date(q.appointment_date);
          let match = true;
          if (filterDate.$gte) {
            match = match && itemDate >= new Date(filterDate.$gte);
          }
          if (filterDate.$lte) {
            match = match && itemDate <= new Date(filterDate.$lte);
          }
          return match;
        } catch (e) {
          console.error("Erro ao comparar data no filtro da QueueService:", q.appointment_date, e);
          return false;
        }
      });
    }

    console.log('[QueueServiceMock.filter] Itens DEPOIS de filtrar:', filteredItems.length);
    return filteredItems;
  },

  create: async (queueData) => {
    const data = getMockData();
    const newQueueItem = {
      id: generateUniqueId(),
      ...queueData,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    data.queueServices = data.queueServices || [];
    data.queueServices.push(newQueueItem);
    setMockData(data);
    return newQueueItem;
  },

  update: async (id, queueData) => {
    const data = getMockData();
    const index = (data.queueServices || []).findIndex(q => q.id === id);
    if (index === -1) throw new Error('Item da fila não encontrado');
    
    data.queueServices[index] = {
      ...data.queueServices[index],
      ...queueData,
      updated_at: new Date().toISOString()
    };
    setMockData(data);
    return data.queueServices[index];
  },

  delete: async (id) => {
    const data = getMockData();
    data.queueServices = (data.queueServices || []).filter(q => q.id !== id);
    setMockData(data);
  }
};

// Mock da entidade HealthPlan
export const HealthPlanMock = {
  list: async () => {
    const data = getMockData();
    return data.healthPlans || [];
  },

  get: async (id) => {
    const data = getMockData();
    const plan = (data.healthPlans || []).find(p => p.id === id);
    if (!plan) throw new Error('Plano de saúde não encontrado');
    return plan;
  },

  filter: async (filters = {}) => {
    const data = getMockData();
    let filteredPlans = [...(data.healthPlans || [])];

    if (filters.tenant_id) {
      filteredPlans = filteredPlans.filter(p => p.tenant_id === filters.tenant_id);
    }

    return filteredPlans;
  },

  create: async (planData) => {
    const data = getMockData();
    const newPlan = {
      id: generateUniqueId(),
      ...planData,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    data.healthPlans = data.healthPlans || [];
    data.healthPlans.push(newPlan);
    setMockData(data);
    return newPlan;
  },

  update: async (id, planData) => {
    const data = getMockData();
    const index = (data.healthPlans || []).findIndex(p => p.id === id);
    if (index === -1) throw new Error('Plano de saúde não encontrado');
    
    data.healthPlans[index] = {
      ...data.healthPlans[index],
      ...planData,
      updated_at: new Date().toISOString()
    };
    setMockData(data);
    return data.healthPlans[index];
  },

  delete: async (id) => {
    console.log(`Simulando exclusão do plano ${id}`);
    return true;
  }
};

// Mock da entidade PurchaseHistory
export const PurchaseHistoryMock = {
  list: async () => {
    const data = getMockData();
    return data.purchaseHistory || [];
  },

  get: async (id) => {
    const data = getMockData();
    const purchase = (data.purchaseHistory || []).find(p => p.id === id);
    if (!purchase) throw new Error('Histórico de compra não encontrado');
    return purchase;
  },

  filter: async (filters = {}) => {
    console.log("[PurchaseHistoryMock.filter] Filtrando por:", { tenant_id: filters.tenant_id, pet_id: filters.pet_id, customer_id: filters.customer_id, dateRange: filters.dateRange });
    const data = getMockData();
    return Promise.resolve(data.purchaseHistory || []);
  },

  create: async (purchaseData) => {
    const data = getMockData();
    const newPurchase = {
      id: generateUniqueId(),
      ...purchaseData,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    data.purchaseHistory = data.purchaseHistory || [];
    data.purchaseHistory.push(newPurchase);
    setMockData(data);
    return newPurchase;
  },

  update: async (id, purchaseData) => {
    const data = getMockData();
    const index = (data.purchaseHistory || []).findIndex(p => p.id === id);
    if (index === -1) throw new Error('Histórico de compra não encontrado');
    
    data.purchaseHistory[index] = {
      ...data.purchaseHistory[index],
      ...purchaseData,
      updated_at: new Date().toISOString()
    };
    setMockData(data);
    return data.purchaseHistory[index];
  },

  delete: async (id) => {
    const data = getMockData();
    data.purchaseHistory = (data.purchaseHistory || []).filter(p => p.id !== id);
    setMockData(data);
  }
};

// Mock para Vaccine
export const VaccineMock = {
  list: async () => {
    const data = getMockData();
    return data.vaccines || [];
  },

  get: async (id) => {
    const data = getMockData();
    const vaccine = (data.vaccines || []).find(v => v.id === id);
    if (!vaccine) throw new Error('Vacina não encontrada');
    return vaccine;
  },

  filter: async (filters = {}) => {
    const data = getMockData();
    let filteredVaccines = [...(data.vaccines || [])];

    if (filters.tenant_id) {
      filteredVaccines = filteredVaccines.filter(v => v.tenant_id === filters.tenant_id);
    }

    return filteredVaccines;
  },

  create: async (vaccineData) => {
    const data = getMockData();
    const newVaccine = {
      id: generateUniqueId(),
      ...vaccineData,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    data.vaccines = data.vaccines || [];
    data.vaccines.push(newVaccine);
    setMockData(data);
    return newVaccine;
  },

  update: async (id, vaccineData) => {
    const data = getMockData();
    const index = (data.vaccines || []).findIndex(v => v.id === id);
    if (index === -1) throw new Error('Vacina não encontrada');
    
    data.vaccines[index] = {
      ...data.vaccines[index],
      ...vaccineData,
      updated_at: new Date().toISOString()
    };
    setMockData(data);
    return data.vaccines[index];
  },

  delete: async (id) => {
    const data = getMockData();
    data.vaccines = (data.vaccines || []).filter(v => v.id !== id);
    setMockData(data);
  }
};

// Mock para Allergy
export const AllergyMock = {
  list: async () => {
    const data = getMockData();
    return data.allergies || [];
  },

  get: async (id) => {
    const data = getMockData();
    const allergy = (data.allergies || []).find(a => a.id === id);
    if (!allergy) throw new Error('Alergia não encontrada');
    return allergy;
  },

  filter: async (filters = {}) => {
    const data = getMockData();
    let filteredAllergies = [...(data.allergies || [])];

    if (filters.tenant_id) {
      filteredAllergies = filteredAllergies.filter(a => a.tenant_id === filters.tenant_id);
    }

    return filteredAllergies;
  },

  create: async (allergyData) => {
    const data = getMockData();
    const newAllergy = {
      id: generateUniqueId(),
      ...allergyData,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    data.allergies = data.allergies || [];
    data.allergies.push(newAllergy);
    setMockData(data);
    return newAllergy;
  },

  update: async (id, allergyData) => {
    const data = getMockData();
    const index = (data.allergies || []).findIndex(a => a.id === id);
    if (index === -1) throw new Error('Alergia não encontrada');
    
    data.allergies[index] = {
      ...data.allergies[index],
      ...allergyData,
      updated_at: new Date().toISOString()
    };
    setMockData(data);
    return data.allergies[index];
  },

  delete: async (id) => {
    const data = getMockData();
    data.allergies = (data.allergies || []).filter(a => a.id !== id);
    setMockData(data);
  }
};

// Mock para PetClinicalData
export const PetClinicalDataMock = {
  list: async () => {
    const data = getMockData();
    return data.petClinicalData || [];
  },

  get: async (id) => {
    const data = getMockData();
    const clinicalData = (data.petClinicalData || []).find(c => c.id === id);
    if (!clinicalData) throw new Error('Dados clínicos não encontrados');
    return clinicalData;
  },

  filter: async (filters = {}) => {
    const data = getMockData();
    let filteredData = [...(data.petClinicalData || [])];

    if (filters.tenant_id) {
      filteredData = filteredData.filter(c => c.tenant_id === filters.tenant_id);
    }

    if (filters.pet_id) {
      filteredData = filteredData.filter(c => c.pet_id === filters.pet_id);
    }

    return filteredData;
  },

  create: async (clinicalData) => {
    const data = getMockData();
    const newClinicalData = {
      id: generateUniqueId(),
      ...clinicalData,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    data.petClinicalData = data.petClinicalData || [];
    data.petClinicalData.push(newClinicalData);
    setMockData(data);
    return newClinicalData;
  },

  update: async (id, clinicalData) => {
    const data = getMockData();
    const index = (data.petClinicalData || []).findIndex(c => c.id === id);
    if (index === -1) throw new Error('Dados clínicos não encontrados');
    
    data.petClinicalData[index] = {
      ...data.petClinicalData[index],
      ...clinicalData,
      updated_at: new Date().toISOString()
    };
    setMockData(data);
    return data.petClinicalData[index];
  },

  delete: async (id) => {
    const data = getMockData();
    data.petClinicalData = (data.petClinicalData || []).filter(c => c.id !== id);
    setMockData(data);
  }
};

// Mock para upload de arquivos
export const uploadFileMock = async (file) => {
  console.log('[uploadFileMock] Iniciando upload do arquivo:', {
    name: file.name,
    type: file.type,
    size: file.size
  });

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = () => {
      const base64String = reader.result;
      console.log('[uploadFileMock] Arquivo convertido para base64:', {
        resultLength: base64String.length,
        resultStart: base64String.substring(0, 50) + '...',
        isBase64: base64String.startsWith('data:')
      });
      
      resolve({
        success: true,
        url: base64String,
        key: `mock-${Date.now()}`,
        filename: file.name,
        size: file.size,
        type: file.type
      });
    };
    
    reader.onerror = (error) => {
      console.error('[uploadFileMock] Erro ao ler arquivo:', error);
      reject({
        success: false,
        error: error.message
      });
    };
    
    reader.readAsDataURL(file);
  });
};

// Mock para PetshopData
export const PetshopDataMock = {
  list: async () => {
    const data = getMockData();
    return data.petshopData || [];
  },

  get: async (id) => {
    const data = getMockData();
    const petshopData = (data.petshopData || []).find(p => p.id === id);
    if (!petshopData) throw new Error('Dados da petshop não encontrados');
    return petshopData;
  },

  filter: async (filters = {}) => {
    const data = getMockData();
    let filteredData = [...(data.petshopData || [])];

    if (filters.tenant_id) {
      filteredData = filteredData.filter(p => p.tenant_id === filters.tenant_id);
    }

    return filteredData;
  },

  create: async (petshopData) => {
    const data = getMockData();
    const newPetshopData = {
      id: generateUniqueId(),
      ...petshopData,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    data.petshopData = data.petshopData || [];
    data.petshopData.push(newPetshopData);
    setMockData(data);
    return newPetshopData;
  },

  update: async (id, petshopData) => {
    const data = getMockData();
    const index = (data.petshopData || []).findIndex(p => p.id === id);
    if (index === -1) throw new Error('Dados da petshop não encontrados');
    
    data.petshopData[index] = {
      ...data.petshopData[index],
      ...petshopData,
      updated_at: new Date().toISOString()
    };
    setMockData(data);
    return data.petshopData[index];
  },

  delete: async (id) => {
    const data = getMockData();
    data.petshopData = (data.petshopData || []).filter(p => p.id !== id);
    setMockData(data);
  }
};

// Mock da entidade Medication
export const MedicationMock = {
  list: async () => {
    const data = getMockData();
    return data.medications || [];
  },

  get: async (id) => {
    const data = getMockData();
    const medication = (data.medications || []).find(m => m.id === id);
    if (!medication) throw new Error('Medicamento não encontrado');
    return medication;
  },

  filter: async (filters = {}) => {
    const data = getMockData();
    let filteredMedications = [...(data.medications || [])];

    if (filters.tenant_id) {
      filteredMedications = filteredMedications.filter(m => m.tenant_id === filters.tenant_id);
    }

    return filteredMedications;
  },

  create: async (medicationData) => {
    const data = getMockData();
    const newMedication = {
      id: generateUniqueId(),
      ...medicationData,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    data.medications = data.medications || [];
    data.medications.push(newMedication);
    setMockData(data);
    return newMedication;
  },

  update: async (id, medicationData) => {
    const data = getMockData();
    const index = (data.medications || []).findIndex(m => m.id === id);
    if (index === -1) throw new Error('Medicamento não encontrado');
    
    data.medications[index] = {
      ...data.medications[index],
      ...medicationData,
      updated_at: new Date().toISOString()
    };
    setMockData(data);
    return data.medications[index];
  },

  delete: async (id) => {
    const data = getMockData();
    data.medications = (data.medications || []).filter(m => m.id !== id);
    setMockData(data);
  }
};

// Mock da entidade Appointment
export const AppointmentMock = {
  list: async () => {
    const data = getMockData();
    return data.appointments || [];
  },

  get: async (id) => {
    const data = getMockData();
    const appointment = (data.appointments || []).find(a => a.id === id);
    if (!appointment) throw new Error('Agendamento não encontrado');
    return appointment;
  },

  filter: async (filters = {}) => {
    const data = getMockData();
    let filteredAppointments = [...(data.appointments || [])];

    if (filters.tenant_id) {
      filteredAppointments = filteredAppointments.filter(a => a.tenant_id === filters.tenant_id);
    }

    if (filters.date) {
      if (filters.date.$gte) {
        filteredAppointments = filteredAppointments.filter(a => new Date(a.date) >= new Date(filters.date.$gte));
      }
      if (filters.date.$lte) {
        filteredAppointments = filteredAppointments.filter(a => new Date(a.date) <= new Date(filters.date.$lte));
      }
    }

    return filteredAppointments;
  },

  create: async (appointmentData) => {
    const data = getMockData();
    const newAppointment = {
      id: generateUniqueId(),
      ...appointmentData,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    data.appointments = data.appointments || [];
    data.appointments.push(newAppointment);
    setMockData(data);
    return newAppointment;
  },

  update: async (id, updateData) => {
    console.log(`[AppointmentMock.update] ID: ${id}, Dados recebidos:`, updateData);
    const data = getMockData();
    const index = data.appointments.findIndex(appt => appt.id === id);
    if (index === -1) {
      console.error('[AppointmentMock.update] Agendamento não encontrado:', id);
      throw new Error('Agendamento não encontrado');
    }
    const updatedAppointment = {
      ...data.appointments[index],
      ...updateData,
      updated_date: new Date().toISOString()
    };
    
    if (updateData.status === 'completed') {
        console.log('[AppointmentMock.update] Atualizando para COMPLETED:', {
            id: id,
            end_time: updatedAppointment.end_time,
            duration_minutes: updatedAppointment.duration_minutes
        });
    }
    
    data.appointments[index] = updatedAppointment;
    setMockData(data);
    console.log('[AppointmentMock.update] Agendamento atualizado no mock:', updatedAppointment);
    return updatedAppointment;
  },

  delete: async (id) => {
    const data = getMockData();
    data.appointments = (data.appointments || []).filter(a => a.id !== id);
    setMockData(data);
  }
};

// Mock da entidade Product
export const ProductMock = {
  list: async () => {
    const data = getMockData();
    return data.products || [];
  },

  get: async (id) => {
    const data = getMockData();
    const product = (data.products || []).find(p => p.id === id);
    if (!product) throw new Error('Produto não encontrado');
    return product;
  },

  filter: async (filters = {}) => {
    const data = getMockData();
    let filteredProducts = [...(data.products || [])];

    if (filters.tenant_id) {
      filteredProducts = filteredProducts.filter(p => p.tenant_id === filters.tenant_id);
    }

    return filteredProducts;
  },

  create: async (productData) => {
    const data = getMockData();
    const newProduct = {
      id: generateUniqueId(),
      ...productData,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    data.products = data.products || [];
    data.products.push(newProduct);
    setMockData(data);
    return newProduct;
  },

  update: async (id, productData) => {
    const data = getMockData();
    const index = (data.products || []).findIndex(p => p.id === id);
    if (index === -1) throw new Error('Produto não encontrado');
    
    data.products[index] = {
      ...data.products[index],
      ...productData,
      updated_at: new Date().toISOString()
    };
    setMockData(data);
    return data.products[index];
  },

  delete: async (id) => {
    const data = getMockData();
    data.products = (data.products || []).filter(p => p.id !== id);
    setMockData(data);
  }
}; 

// --- Novas Funções para Motivos de Remoção ---

export function getRemovalReasons() {
  const data = getMockData();
  return data.removalReasons || [];
}

export function addRemovalReason(newReason) {
  if (!newReason || typeof newReason !== 'string') return;
  
  const reasonTrimmed = newReason.trim();
  if (!reasonTrimmed) return;
  
  const data = getMockData();
  const currentReasons = data.removalReasons || [];
  
  const exists = currentReasons.some(reason => reason.toLowerCase() === reasonTrimmed.toLowerCase());
  
  if (!exists) {
    const updatedReasons = [...currentReasons, reasonTrimmed];
    setMockData({ ...data, removalReasons: updatedReasons });
    console.log('[addRemovalReason] Novo motivo adicionado:', reasonTrimmed);
  } else {
    console.log('[addRemovalReason] Motivo já existe:', reasonTrimmed);
  }
}

const initializeReasons = () => {
    const data = getMockData();
    if (!data.removalReasons) {
        console.log('[initializeReasons] Inicializando motivos de remoção padrão.');
        const defaultReasons = [
            "Cliente desistiu",
            "Emergência interna",
            "Falta de profissional",
            "Equipamento indisponível",
            "Erro de agendamento"
        ];
        setMockData({ ...data, removalReasons: defaultReasons });
    }
};

initializeReasons();

// Mock para Customization
export const CustomizationMock = {
  // ... (implementação)
};

// Mock para FinancialConfig
export const FinancialConfigMock = {
  // ... (implementação)
};

// Mock para FinancialTransaction
export const FinancialTransactionMock = {
  // ... (implementação)
};

// Mock para Hospitalization
export const HospitalizationMock = {
  // ... (implementação)
};

// Mock para MedicalRecord
export const MedicalRecordMock = {
  // ... (implementação)
};

// Mock para Consultation
export const ConsultationMock = {
  async filter({ petId, tenant_id, appointmentId }) {
    console.log(`[ConsultationMock.filter] Filtrando consultas... Pet: ${petId}, Tenant: ${tenant_id}, Appointment: ${appointmentId}`);
    const data = getMockData();
    const filtered = (data.consultations || []).filter(c => 
      (!petId || c.pet_id === petId) && 
      (!tenant_id || c.tenant_id === tenant_id) &&
      (!appointmentId || c.appointmentId === appointmentId)
    );
    console.log('[ConsultationMock.filter] Consultas filtradas:', filtered);
    return Promise.resolve(filtered);
  },

  async get(id) {
      console.log(`[ConsultationMock.get] Buscando consulta id: ${id}`);
      const data = getMockData();
      const item = (data.consultations || []).find(c => c.id === id);
      if (!item) {
          console.warn(`[ConsultationMock.get] Consulta ${id} não encontrada.`);
          return Promise.resolve(null);
      }
      console.log(`[ConsultationMock.get] Consulta ${id} encontrada:`, item);
      return Promise.resolve(item);
  },

   async update(id, updateData) {
    const data = getMockData();
    const index = (data.consultations || []).findIndex(c => c.id === id);
    if (index === -1) throw new Error(`Consulta não encontrada para o ID: ${id}`);
    
    data.consultations[index] = {
      ...data.consultations[index],
      ...updateData,
      updated_at: new Date().toISOString()
    };
    setMockData(data);
    console.log('[ConsultationMock] Updated consultation ID', id, ':', data.consultations[index]);
    return data.consultations[index];
  },

  async create(newData) {
    console.log('[ConsultationMock.create] Criando nova consulta com dados:', newData);
    let data = getMockData();
    if (!data.consultations) data.consultations = [];
    const newItem = {
        id: newData.appointmentId || generateUniqueId(),
        date: new Date().toISOString(),
        ...newData,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
    };
    const existingIndex = data.consultations.findIndex(c => c.id === newItem.id);
    if (existingIndex === -1) {
       data.consultations.push(newItem);
       console.log('[ConsultationMock.create] Nova consulta criada:', newItem);
    } else {
       console.warn(`[ConsultationMock.create] Consulta com ID ${newItem.id} já existe. Atualizando...`);
       data.consultations[existingIndex] = {
          ...data.consultations[existingIndex],
          ...newItem,
          updated_at: new Date().toISOString(),
       };
       setMockData(data);
       return Promise.resolve(data.consultations[existingIndex]);
    }
    setMockData(data);
    return Promise.resolve(newItem);
  },
  
  async delete(id) {
    console.log(`[ConsultationMock.delete] Deletando consulta ID: ${id}`);
    const data = getMockData();
    data.consultations = (data.consultations || []).filter(c => c.id !== id);
    setMockData(data);
    return Promise.resolve(true);
  },

  async list() {
    console.log('[ConsultationMock.list] Listando todas as consultas...');
    const data = getMockData();
    const consultations = data.consultations || [];
    console.log('[ConsultationMock.list] Consultas encontradas:', consultations);
    return Promise.resolve(consultations);
  }
};

// Mock para MedicationTask
export const MedicationTaskMock = {
  async filter({ tenant_id, pet_id, status }) {
    console.log(`[MedicationTaskMock.filter] Filtrando por:`, { tenant_id, pet_id, status });
    const allData = getMockData();
    let tasks = [...(allData.medicationTasks || [])];

    if (tenant_id) {
      tasks = tasks.filter(task => task.tenant_id === tenant_id);
    }
    if (pet_id) {
      tasks = tasks.filter(task => task.pet_id === pet_id);
    }
    if (status) {
      if (status === 'pending') {
          tasks = tasks.filter(task => task.status === 'pending' || task.status === 'in_progress');
      } else {
          tasks = tasks.filter(task => task.status === status);
      }
    } else {
       // Se nenhum status for passado, talvez retornar apenas pending/in_progress por padrão?
       // Ou retornar todos? Por enquanto, retorna todos se status for null/undefined.
    }

    console.log(`[MedicationTaskMock.filter] Tarefas encontradas: ${tasks.length}`, tasks);
    return Promise.resolve(tasks);
  },

  async create(newData) {
    console.log("[MedicationTaskMock.create] Criando com dados:", newData);
    const allData = getMockData();
    
    const { petId, ...restData } = newData;
    const finalData = { 
        ...restData, 
        pet_id: petId || newData.pet_id
    };

    const newTask = {
      id: generateUniqueId('task'),
      ...finalData,
      status: finalData.status || 'pending',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    if (!allData.medicationTasks) {
        allData.medicationTasks = [];
    }

    allData.medicationTasks.push(newTask);
    setMockData(allData);
    console.log("[MedicationTaskMock.create] Tarefa adicionada e salva (com pet_id):");
    console.log(newTask);
    return Promise.resolve(newTask);
  },

  async update(id, updateData) {
    console.log(`[MedicationTaskMock.update] ID: ${id}, Dados:`, updateData);
    const allData = getMockData(); 
    if (!allData.medicationTasks) {
        allData.medicationTasks = [];
        console.warn('[MedicationTaskMock.update] Array medicationTasks não existia, foi criado.');
    }
    const index = allData.medicationTasks.findIndex(task => task.id === id);
    if (index === -1) {
      if (id === 'mock-task-1') {
          console.warn(`[MedicationTaskMock.update] Tarefa mock ${id} não encontrada no array, aplicando virtualmente.`);
           return Promise.resolve({ 
               id: id, 
               ...updateData, 
               updated_at: new Date().toISOString() 
           });
      } else {
           console.error(`[MedicationTaskMock.update] Tarefa com ID ${id} não encontrada.`);
           throw new Error('Tarefa de medicação não encontrada');
      }
    }
    allData.medicationTasks[index] = {
      ...allData.medicationTasks[index],
      ...updateData,
      updated_at: new Date().toISOString()
    };
    setMockData(allData);
    console.log('[MedicationTaskMock.update] Tarefa atualizada e dados salvos:', allData.medicationTasks[index]);
    return Promise.resolve(allData.medicationTasks[index]);
  },

  async delete(id) {
    console.log(`[MedicationTaskMock.delete] Tentando deletar ID: ${id}`);
    const allData = getMockData();
    const initialLength = allData.medicationTasks?.length || 0;
    if (allData.medicationTasks) {
        allData.medicationTasks = allData.medicationTasks.filter(task => task.id !== id);
    }
    if ((allData.medicationTasks?.length || 0) < initialLength) {
        setMockData(allData);
        console.log(`[MedicationTaskMock.delete] Tarefa ${id} deletada e dados salvos.`);
        return Promise.resolve({ success: true, id });
    } else {
        console.warn(`[MedicationTaskMock.delete] Tarefa ${id} não encontrada para deletar.`);
        return Promise.resolve({ success: false, id });
    }
  }
};

// Mock para OCRStatistic
export const OCRStatisticMock = {
  async filter({ tenant_id }) {
    return [
      {
        id: '1',
        tenant_id,
        total_processed: 100,
        successful: 80,
        failed: 20,
        last_processed: new Date().toISOString(),
        created_at: new Date().toISOString()
      }
    ];
  },
  async create(data) { /*...*/ },
  async update(id, data) { /*...*/ },
  async delete() { /*...*/ }
};

// Mock para SupportTicket
export const SupportTicketMock = {
  async filter({ tenant_id }) {
    return [
      {
        id: '1',
        tenant_id,
        title: 'Problema com login',
        description: 'Não consigo fazer login no sistema',
        priority: 'high',
        category: 'technical',
        status: 'open',
        created_at: new Date().toISOString()
      }
    ];
  },
  async create(data) {
     return {
      id: Date.now().toString(),
      ...data,
      status: 'open',
      created_at: new Date().toISOString()
    };
  },
  async update(id, data) {
     return {
      id,
      ...data,
      updated_at: new Date().toISOString()
    };
  },
  async delete() {
     return true;
   }
};

// Mock para SupportMessage
export const SupportMessageMock = {
  async filter({ ticket_id }) {
    return [
      {
        id: '1',
        ticket_id,
        sender_id: '1',
        content: 'Mensagem mock',
        created_at: new Date().toISOString()
      }
    ];
  },
  async create(data) { 
    console.warn("[SupportMessageMock.create] Mock não implementado para salvar dados.");
    return { id: 'new-msg-id', ...data }; 
  },
  async update(id, data) { 
    console.warn("[SupportMessageMock.update] Mock não implementado para salvar dados.");
    return { id, ...data }; 
  },
  async delete() { /*...*/ }
};

// Mock para User
export const UserMock = {
  async me() {
    return {
      id: '1',
      email: 'user@example.com',
      name: 'Usuário Teste',
      role: 'admin',
      created_at: new Date().toISOString()
    };
  },
  async filter() { 
    console.warn("[UserMock.filter] Mock não implementado para filtrar, retornando usuário fixo.");
    return [{ id: '1', email: 'user@example.com', name: 'Usuário Teste', role: 'admin' }];
   },
  async create(data) { 
    console.warn("[UserMock.create] Mock não implementado para salvar dados.");
    return { id: 'new-user-id', ...data }; 
  },
  async update(id, data) { 
    console.warn("[UserMock.update] Mock não implementado para salvar dados.");
    return { id, ...data }; 
  },
  async delete() { /*...*/ }
};

// Mock para VehicleHygiene (exemplo, se existir)
// export const VehicleHygieneMock = { /*...*/ }; 

// Mock para KnowledgeArticle
export const KnowledgeArticleMock = {
  async filter({ tenant_id }) {
    console.log('[KnowledgeArticleMock] Filtrando para tenant:', tenant_id);
    return [{ id: '1', title: 'Artigo Mock' }];
  },
  async create(data) { 
    return { id: 'new-article-id', ...data };
  },
  async update(id, data) { 
    return { id, ...data };
  },
  async delete() { /*...*/ }
};

// Mock para TransportConfig (exemplo, se existir)
// export const TransportConfigMock = { /*...*/ }; 

// Mock para HospitalizationProgress
export const HospitalizationProgressMock = {
  async filter({ hospitalization_id }) {
    console.log("[HospitalizationProgressMock] Filtrando para hospitalização:", hospitalization_id);
    return [{ id: '1', description: 'Progresso mock' }];
  },
  async create(data) { 
    return { id: 'new-progress-id', ...data }; 
  },
  async update(id, data) { 
    return { id, ...data }; 
  },
  async delete() { /*...*/ }
};

// Mock para TransportService
export const TransportServiceMock = {
  async filter({ tenant_id }) {
    console.log("[TransportServiceMock] Filtrando para tenant:", tenant_id);
    return [
      {
        id: 'tserv1',
        tenant_id,
        name: 'Transporte Básico Mock',
        description: 'Serviço de transporte mockado',
        price_per_km: 5.0,
        base_fare: 10.0,
        created_at: new Date().toISOString()
      }
    ];
  },
  async create(data) {
    console.log("[TransportServiceMock] Criando com dados:", data);
    const newService = { id: generateUniqueId(), ...data, created_at: new Date().toISOString() };
    return newService;
  },
  async update(id, data) {
    console.log("[TransportServiceMock] Atualizando ID", id, "com dados:", data);
    return { id, ...data, updated_at: new Date().toISOString() };
  },
  async delete(id) {
    console.log("[TransportServiceMock] Deletando ID", id);
    return true;
  }
};

// Mock para TransportZonePricing
export const TransportZonePricingMock = {
  async filter({ tenant_id }) {
    console.log("[TransportZonePricingMock] Filtrando para tenant:", tenant_id);
    return [{ id: 'zone1', zone: 'Zona Mock', price: 30.00 }];
  },
  async create(data) { 
    return { id: 'new-zone-id', ...data }; 
  },
  async update(id, data) { 
    return { id, ...data }; 
  },
  async delete() { /*...*/ }
};

// Mock para TransportDriver
export const TransportDriverMock = {
  async filter({ tenant_id }) {
    console.log("[TransportDriverMock] Filtrando para tenant:", tenant_id);
    return [{ id: '1', name: 'Motorista Mock' }];
  },
  async create(data) { 
    return { id: 'new-driver-id', ...data }; 
  },
  async update(id, data) { 
    return { id, ...data }; 
  },
  async delete() { /*...*/ }
};

// Mock para TransportVehicle
export const TransportVehicleMock = {
  async filter({ tenant_id }) {
    console.log("[TransportVehicleMock] Filtrando para tenant:", tenant_id);
    return [{ id: 'v1', model: 'Modelo Mock', plate: 'ABC1234' }];
  },
  async create(data) { 
    return { id: 'new-vehicle-id', ...data }; 
  },
  async update(id, data) { 
    return { id, ...data }; 
  },
  async delete() { /*...*/ }
};

// Mock para TransportRoute
export const TransportRouteMock = {
  async filter({ tenant_id }) {
    console.log("[TransportRouteMock] Filtrando para tenant:", tenant_id);
    return [{ id: '1', origin: 'Origem Mock', destination: 'Destino Mock' }];
  },
  async create(data) { 
    return { id: 'new-route-id', ...data }; 
  },
  async update(id, data) { 
    return { id, ...data }; 
  },
  async delete() { /*...*/ }
};

// Mock para TransportConfig
export const TransportConfigMock = {
  // ... (implementação)
}; 