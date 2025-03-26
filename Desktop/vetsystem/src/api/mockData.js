// Armazenamento local para dados mockados
export const STORAGE_KEY = 'mock_data';

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
      species: "Cachorro",
      breed: "Vira-lata",
      owner_id: "cust1",
      tenant_id: "default"
    },
    {
      id: "pet2",
      name: "Luna",
      species: "Gato",
      breed: "Siamês",
      owner_id: "cust2",
      tenant_id: "default"
    }
  ],
  services: [
    {
      id: "serv1",
      name: "Banho Completo",
      category: "banho",
      description: "Banho completo com shampoo e condicionador premium",
      price: 80.00,
      duration: 60,
      points: 8,
      tenant_id: "default"
    },
    {
      id: "serv2",
      name: "Tosa Higiênica",
      category: "tosa",
      description: "Tosa das regiões íntimas, patas e face",
      price: 50.00,
      duration: 30,
      points: 5,
      tenant_id: "default"
    },
    {
      id: "serv3",
      name: "Banho e Tosa",
      category: "banho",
      description: "Serviço completo de banho e tosa",
      price: 120.00,
      duration: 90,
      points: 12,
      tenant_id: "default"
    },
    {
      id: "serv4",
      name: "Hidratação",
      category: "hidratacao",
      description: "Hidratação completa da pelagem",
      price: 70.00,
      duration: 45,
      points: 7,
      tenant_id: "default"
    },
    {
      id: "serv5",
      name: "Spa Completo",
      category: "spa",
      description: "Banho, hidratação, massagem e perfume",
      price: 150.00,
      duration: 120,
      points: 15,
      tenant_id: "default"
    }
  ],
  appointments: [],
  queueServices: []
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
    // Atualiza o tenant_id dos dados iniciais
    const updatedInitialData = {
      ...initialData,
      customers: initialData.customers.map(c => ({ ...c, tenant_id: currentTenant })),
      pets: initialData.pets.map(p => ({ ...p, tenant_id: currentTenant })),
      services: initialData.services.map(s => ({ ...s, tenant_id: currentTenant }))
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedInitialData));
    return updatedInitialData;
  }
  
  const parsedData = JSON.parse(data);
  
  // Atualiza o tenant_id dos dados existentes se necessário
  if (parsedData.customers?.some(c => c.tenant_id === "default") ||
      parsedData.pets?.some(p => p.tenant_id === "default") ||
      parsedData.services?.some(s => s.tenant_id === "default")) {
    
    parsedData.customers = parsedData.customers.map(c => ({ ...c, tenant_id: currentTenant }));
    parsedData.pets = parsedData.pets.map(p => ({ ...p, tenant_id: currentTenant }));
    parsedData.services = parsedData.services.map(s => ({ ...s, tenant_id: currentTenant }));
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(parsedData));
  }
  
  return parsedData;
};

export const setMockData = (data) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
};

// Mock da entidade Customer
export const CustomerMock = {
  list: async () => {
    const data = getMockData();
    return data.customers;
  },

  get: async (id) => {
    const data = getMockData();
    const customer = data.customers.find(c => c.id === id);
    if (!customer) throw new Error('Cliente não encontrado');
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
      id: Date.now().toString(),
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
    return data.pets;
  },

  get: async (id) => {
    const data = getMockData();
    const pet = data.pets.find(p => p.id === id);
    if (!pet) throw new Error('Pet não encontrado');
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
    const data = getMockData();
    const newPet = {
      id: Date.now().toString(),
      ...petData,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    data.pets.push(newPet);
    setMockData(data);
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
      id: Date.now().toString(),
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
      id: Date.now().toString(),
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
    if (!service) throw new Error('Serviço não encontrado');
    return service;
  },

  filter: async (filters = {}) => {
    const data = getMockData();
    let filteredServices = [...(data.services || [])];

    // Se não houver tenant_id no filtro, usa o tenant atual
    const tenantId = filters.tenant_id || localStorage.getItem('current_tenant') || "default";
    filteredServices = filteredServices.filter(s => s.tenant_id === tenantId);

    return filteredServices;
  },

  create: async (serviceData) => {
    const data = getMockData();
    const newService = {
      id: Date.now().toString(),
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
      id: Date.now().toString(),
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

    // Aplica os filtros
    if (filters.tenant_id) {
      filteredPlans = filteredPlans.filter(p => p.tenant_id === filters.tenant_id);
    }

    if (filters.is_active !== undefined) {
      filteredPlans = filteredPlans.filter(p => p.is_active === filters.is_active);
    }

    return filteredPlans;
  },

  create: async (planData) => {
    const data = getMockData();
    const newPlan = {
      id: Date.now().toString(),
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
    let filteredPurchases = [...(data.purchaseHistory || [])];

    // Aplica os filtros
    if (filters.tenant_id) {
      filteredPurchases = filteredPurchases.filter(p => p.tenant_id === filters.tenant_id);
    }

    if (filters.pet_id) {
      filteredPurchases = filteredPurchases.filter(p => p.pet_id === filters.pet_id);
    }

    return filteredPurchases;
  },

  create: async (purchaseData) => {
    const data = getMockData();
    const newPurchase = {
      id: Date.now().toString(),
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
      id: Date.now().toString(),
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
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      const base64Data = reader.result.split(',')[1];
      resolve({
        url: `data:${file.type};base64,${base64Data}`,
        filename: file.name,
        size: file.size,
        type: file.type
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
      id: Date.now().toString(),
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
      id: Date.now().toString(),
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
      id: Date.now().toString(),
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
      id: Date.now().toString(),
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
      id: Date.now().toString(),
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
      id: Date.now().toString(),
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