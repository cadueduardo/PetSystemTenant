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
      tenant_id: "default"
    },
    {
      id: "cust2",
      full_name: "Maria Santos",
      email: "maria@email.com",
      phone: "(11) 98888-8888",
      tenant_id: "default"
    }
  ],
  pets: [
    {
      id: "pet1",
      name: "Rex",
      species: "dog",
      breed: "Vira-lata",
      owner_id: "cust1",
      tenant_id: "default",
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
      tenant_id: "default",
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
      tenant_id: "default",
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
      tenant_id: 'default'
    },
    {
      id: 'serv2',
      name: 'Tosa Higiênica',
      category: 'tosa',
      description: 'Tosa das regiões íntimas, patas e face',
      price: 50,
      duration: 30,
      module: 'petshop',
      tenant_id: 'default'
    },
    {
      id: 'serv3',
      name: 'Consulta Veterinária',
      category: 'consulta',
      description: 'Consulta de rotina com veterinário',
      price: 120,
      duration: 30,
      module: 'clinica',
      tenant_id: 'default'
    },
    {
      id: 'serv4',
      name: 'Vacinação',
      category: 'vacina',
      description: 'Aplicação de vacinas',
      price: 70,
      duration: 15,
      module: 'clinica',
      tenant_id: 'default'
    },
    {
      id: 'serv5',
      name: 'Exame de Sangue',
      category: 'exame',
      description: 'Coleta e análise de sangue',
      price: 150,
      duration: 30,
      module: 'clinica',
      tenant_id: 'default'
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
      id: generateUniqueId(), // Usando nossa função
      pet_id: "pet1",
      owner_id: "cust1",
      service_id: "serv3", // Consulta Veterinária
      date: new Date().toISOString().split('T')[0], // Data de hoje
      time: "09:00",
      duration: 30,
      notes: "Check-up anual do Rex.",
      status: "scheduled", // Agendado
      tenant_id: "default" // Ajustará para o tenant atual se necessário
    },
    {
      id: generateUniqueId(),
      pet_id: "pet2",
      owner_id: "cust2",
      service_id: "serv4", // Vacinação
      date: new Date().toISOString().split('T')[0], // Data de hoje
      time: "10:30",
      duration: 15,
      notes: "Vacina V10 para Luna.",
      status: "confirmed", // Confirmado
      tenant_id: "default"
    },
    {
      id: generateUniqueId(),
      pet_id: "pet1",
      owner_id: "cust1",
      service_id: "serv5", // Exame de Sangue
      date: new Date().toISOString().split('T')[0], // Data de hoje
      time: "11:00",
      duration: 30,
      notes: "Exame pré-operatório.",
      status: "waiting", // Chegou e está aguardando
      tenant_id: "default"
    },
    { // Agendamento de Petshop (NÃO deve aparecer na fila Live Vet)
      id: generateUniqueId(),
      pet_id: "pet2",
      owner_id: "cust2",
      service_id: "serv1", // Banho Completo
      date: new Date().toISOString().split('T')[0], // Data de hoje
      time: "14:00",
      duration: 60,
      notes: "Banho e tosa higiênica.",
      status: "scheduled",
      tenant_id: "default"
    },
    { // Agendamento de Clínica para AMANHÃ (NÃO deve aparecer hoje)
      id: generateUniqueId(),
      pet_id: "pet1",
      owner_id: "cust1",
      service_id: "serv3", // Consulta Veterinária
      date: new Date(Date.now() + 86400000).toISOString().split('T')[0], // Data de amanhã
      time: "15:00",
      duration: 30,
      notes: "Consulta de acompanhamento.",
      status: "scheduled",
      tenant_id: "default"
    },
      { // Agendamento de Clínica CONCLUÍDO (NÃO deve aparecer na fila)
      id: generateUniqueId(),
      pet_id: "pet2",
      owner_id: "cust2",
      service_id: "serv4", // Vacinação
      date: new Date().toISOString().split('T')[0], // Data de hoje
      time: "08:00",
      duration: 15,
      notes: "Vacina aplicada.",
      status: "completed", // Concluído
      tenant_id: "default"
    }
  ],
  queueServices: [],
  allergies: [],
  vaccines: [],
  medications: [],
  petshopData: [],
  medicalRecords: [],
  transportServices: []
};

// Inicializa o armazenamento se não existir
if (!localStorage.getItem(STORAGE_KEY)) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(initialData));
}

// Funções auxiliares para manipular dados mockados
export const getMockData = () => {
  const data = localStorage.getItem(STORAGE_KEY);
  const currentTenant = localStorage.getItem('current_tenant') || "default";
  
  if (!data) {
    console.log('[getMockData] Dados não encontrados, inicializando com dados padrão');
    // Atualiza o tenant_id dos dados iniciais
    const updatedInitialData = {
      ...initialData,
      customers: initialData.customers.map(c => ({ ...c, tenant_id: currentTenant })),
      pets: initialData.pets.map(p => ({ ...p, tenant_id: currentTenant })),
      services: initialData.services.map(s => ({ ...s, tenant_id: currentTenant })),
      appointments: initialData.appointments.map(a => ({ ...a, tenant_id: currentTenant }))
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedInitialData));
    return updatedInitialData;
  }
  
  console.log('[getMockData] Dados encontrados no localStorage');
  const parsedData = JSON.parse(data);
  
  // Atualiza o tenant_id dos dados existentes se necessário
  const needsUpdate = parsedData.customers?.some(c => c.tenant_id !== currentTenant) ||
                      parsedData.pets?.some(p => p.tenant_id !== currentTenant) ||
                      parsedData.services?.some(s => s.tenant_id !== currentTenant) ||
                      parsedData.appointments?.some(a => a.tenant_id !== currentTenant);
                      
  if (needsUpdate) {    
    console.log('[getMockData] ATENÇÃO: Detectada necessidade de atualizar tenant_id para:', currentTenant);
    // Log ANTES da atualização
    console.log('[getMockData] Tenant IDs nos agendamentos ANTES da atualização:',
        parsedData.appointments?.map(a => ({ id: a.id, tenant_id: a.tenant_id })) || 'Nenhum agendamento encontrado'
    );

    parsedData.customers = parsedData.customers?.map(c => ({ ...c, tenant_id: currentTenant })) || [];
    parsedData.pets = parsedData.pets?.map(p => ({ ...p, tenant_id: currentTenant })) || [];
    parsedData.services = parsedData.services?.map(s => ({ ...s, tenant_id: currentTenant })) || [];
    parsedData.appointments = parsedData.appointments?.map(a => ({ ...a, tenant_id: currentTenant })) || []; // Adicionando atualização para appointments
    
    // Log DEPOIS da atualização (mas antes de salvar)
    console.log('[getMockData] Tenant IDs nos agendamentos DEPOIS da atualização:',
        parsedData.appointments?.map(a => ({ id: a.id, tenant_id: a.tenant_id })) || 'Nenhum agendamento encontrado'
    );

    localStorage.setItem(STORAGE_KEY, JSON.stringify(parsedData));
  }
  
  // Verifica se há pets com foto
  const petsWithPhotos = parsedData.pets.filter(p => p.photo_url);
  if (petsWithPhotos.length > 0) {
    console.log('[getMockData] Pets com fotos encontrados:', petsWithPhotos.map(p => ({
      id: p.id,
      name: p.name,
      hasPhoto: !!p.photo_url,
      photoUrlPreview: p.photo_url?.substring(0, 50) + '...'
    })));
  } else {
    console.log('[getMockData] Nenhum pet com foto encontrado');
  }
  
  return parsedData;
};

export const setMockData = (data) => {
  try {
    // Verifica se os dados são válidos antes de salvar
    if (!data || typeof data !== 'object') {
      console.error('[setMockData] Dados inválidos:', data);
      throw new Error('Dados inválidos para salvar');
    }

    // Verifica se há pets com foto antes de salvar
    const petsWithPhotos = data.pets?.filter(p => p.photo_url) || [];
    console.log('[setMockData] Verificando pets antes de salvar:', {
      totalPets: data.pets?.length || 0,
      petsWithPhotos: petsWithPhotos.length,
      photosInfo: petsWithPhotos.map(p => ({
        id: p.id,
        name: p.name,
        photo_url_length: p.photo_url.length,
        photo_url_preview: p.photo_url.substring(0, 50) + '...',
        is_base64: p.photo_url.startsWith('data:')
      }))
    });

    // Garante que os pets com foto mantenham suas fotos
    if (data.pets) {
      data.pets = data.pets.map(pet => {
        if (pet.photo_url) {
          console.log('[setMockData] Salvando pet com foto:', {
            id: pet.id,
            name: pet.name,
            photo_url_length: pet.photo_url.length,
            photo_url_preview: pet.photo_url.substring(0, 50) + '...',
            is_base64: pet.photo_url.startsWith('data:')
          });
        }
        return pet;
      });
    }

    // Converte para string e salva
    const jsonString = JSON.stringify(data);
    localStorage.setItem(STORAGE_KEY, jsonString);
    console.log('[setMockData] Dados salvos com sucesso');
    
    // Verifica se os dados foram salvos corretamente
    const savedData = JSON.parse(localStorage.getItem(STORAGE_KEY));
    const savedPetsWithPhotos = savedData.pets?.filter(p => p.photo_url) || [];
    
    if (petsWithPhotos.length !== savedPetsWithPhotos.length) {
      console.error('[setMockData] Número de pets com foto diferente após salvar:', {
        original: petsWithPhotos.length,
        saved: savedPetsWithPhotos.length
      });
      throw new Error('Erro ao salvar: número de pets com foto diferente');
    }
    
    // Verifica se cada pet com foto foi salvo corretamente
    for (const originalPet of petsWithPhotos) {
      const savedPet = savedPetsWithPhotos.find(p => p.id === originalPet.id);
      if (!savedPet) {
        console.error('[setMockData] Pet com foto não encontrado após salvar:', originalPet.id);
        throw new Error('Erro ao salvar: pet com foto não encontrado');
      }
      if (savedPet.photo_url !== originalPet.photo_url) {
        console.error('[setMockData] Foto do pet não foi salva corretamente:', {
          id: originalPet.id,
          name: originalPet.name,
          original: originalPet.photo_url.substring(0, 50) + '...',
          saved: savedPet.photo_url.substring(0, 50) + '...'
        });
        throw new Error('Erro ao salvar: foto do pet não foi salva corretamente');
      }
    }
    
    console.log('[setMockData] Verificação após salvar:', {
      totalPets: savedData.pets?.length || 0,
      petsWithPhotos: savedPetsWithPhotos.length,
      photosInfo: savedPetsWithPhotos.map(p => ({
        id: p.id,
        name: p.name,
        photo_url_length: p.photo_url.length,
        photo_url_preview: p.photo_url.substring(0, 50) + '...',
        is_base64: p.photo_url.startsWith('data:')
      }))
    });
  } catch (error) {
    console.error('[setMockData] Erro ao salvar dados:', error);
    throw error;
  }
};

// Mock da entidade Customer
export const CustomerMock = {
  list: async () => {
    const data = getMockData();
    return data.customers || [];
  },

  get: async (id) => {
    const data = getMockData(); // Busca os dados JÁ atualizados para o tenant atual
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

    // Aplica os filtros
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
    const data = getMockData(); // Busca os dados JÁ atualizados para o tenant atual
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

    // Aplica os filtros
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
    console.log('[PetMock] Dados recebidos para criar pet:', {
      ...petData,
      photo_url_preview: petData.photo_url ? `${petData.photo_url.substring(0, 50)}...` : null,
      photo_url_length: petData.photo_url?.length,
      is_base64: petData.photo_url?.startsWith('data:')
    });
    
    const data = getMockData();
    const newPet = {
      id: generateUniqueId(),
      ...petData,
      photo_url: petData.photo_url || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    // Verifica se o pet tem foto antes de salvar
    if (newPet.photo_url) {
      console.log('[PetMock] Pet possui foto:', {
        id: newPet.id,
        name: newPet.name,
        photo_url_length: newPet.photo_url.length,
        photo_url_preview: newPet.photo_url.substring(0, 50) + '...',
        is_base64: newPet.photo_url.startsWith('data:')
      });
    }
    
    // Inicializa o array de pets se não existir
    if (!data.pets) {
      data.pets = [];
    }
    
    data.pets.push(newPet);
    
    // Log antes de salvar
    const petsWithPhotos = data.pets.filter(p => p.photo_url);
    console.log('[PetMock] Estado antes de salvar:', {
      totalPets: data.pets.length,
      petsWithPhotos: petsWithPhotos.length,
      photosInfo: petsWithPhotos.map(p => ({
        id: p.id,
        name: p.name,
        photo_url_length: p.photo_url.length,
        photo_url_preview: p.photo_url.substring(0, 50) + '...',
        is_base64: p.photo_url.startsWith('data:')
      }))
    });
    
    setMockData(data);
    
    // Verifica se os dados foram salvos corretamente
    const savedData = getMockData();
    const savedPet = savedData.pets.find(p => p.id === newPet.id);
    
    if (!savedPet) {
      console.error('[PetMock] Pet não encontrado após salvar:', newPet.id);
      throw new Error('Erro ao salvar pet: não encontrado após salvar');
    }
    
    if (savedPet.photo_url !== newPet.photo_url) {
      console.error('[PetMock] Foto do pet não foi salva corretamente:', {
        original: newPet.photo_url?.substring(0, 50) + '...',
        saved: savedPet.photo_url?.substring(0, 50) + '...'
      });
      throw new Error('Erro ao salvar pet: foto não foi salva corretamente');
    }
    
    console.log('[PetMock] Pet salvo com sucesso:', {
      id: savedPet.id,
      name: savedPet.name,
      hasPhoto: !!savedPet.photo_url,
      photo_url_preview: savedPet.photo_url?.substring(0, 50) + '...'
    });
    
    return savedPet;
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

    // Aplica os filtros
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

    // Aplica os filtros
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
    const data = getMockData(); // Busca os dados JÁ atualizados para o tenant atual
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

    // Se não houver tenant_id no filtro, usa o tenant atual
    const tenantId = filters.tenant_id || localStorage.getItem('current_tenant') || "default";
    console.log('Filtrando serviços para tenant:', tenantId);
    filteredServices = filteredServices.filter(s => s.tenant_id === tenantId);
    console.log('Serviços após filtro de tenant:', filteredServices);

    // Filtra por módulo (clinica ou petshop)
    if (filters.module) {
      console.log('Filtrando por módulo:', filters.module);
      filteredServices = filteredServices.filter(s => s.module === filters.module);
      console.log('Serviços após filtro de módulo:', filteredServices);
    }

    // Remove serviços sem ID para evitar duplicatas
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

    // Aplica os filtros
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
      filteredItems = filteredItems.filter(q => q.status === filters.status);
    }

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
    const data = getMockData();
    data.healthPlans = (data.healthPlans || []).filter(p => p.id !== id);
    setMockData(data);
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
    const data = getMockData();
    let filteredHistory = [...(data.purchaseHistory || [])];

    // Aplica os filtros
    if (filters.tenant_id) {
      filteredHistory = filteredHistory.filter(p => p.tenant_id === filters.tenant_id);
    }

    if (filters.pet_id) {
      filteredHistory = filteredHistory.filter(p => p.pet_id === filters.pet_id);
    }

    return filteredHistory;
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

// Mock da entidade PetClinicalData
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

    // Aplica os filtros
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

// Mock da entidade PetshopData
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

    // Aplica os filtros
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

// Mock da entidade Vaccine
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

// Mock da entidade Allergy
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

    // Aplica os filtros
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

  update: async (id, appointmentData) => {
    const data = getMockData();
    const index = (data.appointments || []).findIndex(a => a.id === id);
    if (index === -1) throw new Error('Agendamento não encontrado');
    
    data.appointments[index] = {
      ...data.appointments[index],
      ...appointmentData,
      updated_at: new Date().toISOString()
    };
    setMockData(data);
    return data.appointments[index];
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