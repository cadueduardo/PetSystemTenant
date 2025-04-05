import { CustomerMock, PetMock, ServiceMock, AppointmentMock, QueueServiceMock, uploadFileMock, getMockData, setMockData, generateUniqueId } from './mockData';

// Exporta as entidades com mocks
export const Customer = CustomerMock;
export const Pet = PetMock;
export const Service = ServiceMock;
export const Appointment = AppointmentMock;
export const QueueService = QueueServiceMock;
export const UploadFile = uploadFileMock;

// Mock para Product
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

export const Product = ProductMock;

// Mock para Tenant
const TenantMock = {
  async list() {
    const mockData = getMockData();
    return mockData.tenants || [];
  },
  async filter({ status }) {
    const mockData = getMockData();
    if (status) {
      return mockData.tenants?.filter(t => t.status === status) || [];
    }
    return mockData.tenants || [];
  },
  async create(data) {
    const mockData = getMockData();
    const newTenant = {
      id: Date.now().toString(),
      ...data,
      created_at: new Date().toISOString()
    };
    mockData.tenants = [...(mockData.tenants || []), newTenant];
    setMockData(mockData);
    return newTenant;
  },
  async update(id, data) {
    const mockData = getMockData();
    const index = mockData.tenants?.findIndex(t => t.id === id);
    if (index === -1) throw new Error('Tenant não encontrado');
    
    const updatedTenant = {
      ...mockData.tenants[index],
      ...data,
      updated_at: new Date().toISOString()
    };
    mockData.tenants[index] = updatedTenant;
    setMockData(mockData);
    return updatedTenant;
  },
  async delete(id) {
    const mockData = getMockData();
    mockData.tenants = mockData.tenants?.filter(t => t.id !== id) || [];
    setMockData(mockData);
    return true;
  }
};

export const Tenant = TenantMock;

// Mock para Customization
const CustomizationMock = {
  async filter({ tenant_id }) {
    return [
      {
        id: '1',
        tenant_id,
        theme: 'light',
        logo_url: 'https://via.placeholder.com/150',
        created_at: new Date().toISOString()
      }
    ];
  },
  async create(data) {
    return {
      id: Date.now().toString(),
      ...data,
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

export const Customization = CustomizationMock;

// Mock para FinancialConfig
const FinancialConfigMock = {
  async filter({ tenant_id }) {
    return [
      {
        id: '1',
        tenant_id,
        currency: 'BRL',
        tax_rate: 0.1,
        created_at: new Date().toISOString()
      }
    ];
  },
  async create(data) {
    return {
      id: Date.now().toString(),
      ...data,
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

export const FinancialConfig = FinancialConfigMock;

// Mock para FinancialTransaction
const FinancialTransactionMock = {
  async filter({ tenant_id }) {
    return [
      {
        id: '1',
        tenant_id,
        amount: 100.00,
        type: 'income',
        description: 'Transação mock',
        created_at: new Date().toISOString()
      }
    ];
  },
  async create(data) {
    return {
      id: Date.now().toString(),
      ...data,
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

export const FinancialTransaction = FinancialTransactionMock;

// Mock para HealthPlan
const HealthPlanMock = {
  async list() {
    return [
      {
        id: '1',
        name: 'Plano Básico',
        description: 'Plano básico de saúde para pets',
        price: 100.00,
        created_at: new Date().toISOString()
      },
      {
        id: '2',
        name: 'Plano Premium',
        description: 'Plano premium de saúde para pets',
        price: 200.00,
        created_at: new Date().toISOString()
      }
    ];
  },
  async filter({ tenant_id }) {
    return [
      {
        id: '1',
        tenant_id,
        name: 'Plano Básico',
        description: 'Plano básico de saúde para pets',
        price: 100.00,
        created_at: new Date().toISOString()
      }
    ];
  },
  async create(data) {
    return {
      id: Date.now().toString(),
      ...data,
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

export const HealthPlan = HealthPlanMock;

// Mock para Medication
const MedicationMock = {
  async filter({ tenant_id }) {
    return [
      {
        id: '1',
        tenant_id,
        name: 'Medicação Mock',
        description: 'Descrição da medicação',
        dosage: '1 comprimido',
        created_at: new Date().toISOString()
      }
    ];
  },
  async create(data) {
    return {
      id: Date.now().toString(),
      ...data,
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

export const Medication = MedicationMock;

// Mock para PurchaseHistory
const PurchaseHistoryMock = {
  async filter({ tenant_id }) {
    return [
      {
        id: '1',
        tenant_id,
        customer_id: '1',
        amount: 100.00,
        items: [],
        created_at: new Date().toISOString()
      }
    ];
  },
  async create(data) {
    return {
      id: Date.now().toString(),
      ...data,
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

export const PurchaseHistory = PurchaseHistoryMock;

// Mock para TenantUser
const TenantUserMock = {
  async filter({ tenant_id }) {
    return [
      {
        id: '1',
        tenant_id,
        user_id: '1',
        role: 'admin',
        created_at: new Date().toISOString()
      }
    ];
  },
  async create(data) {
    return {
      id: Date.now().toString(),
      ...data,
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

export const TenantUser = TenantUserMock;

// Mock para Vaccine
const VaccineMock = {
  async filter({ tenant_id }) {
    return [
      {
        id: '1',
        tenant_id,
        name: 'Vacina Mock',
        description: 'Descrição da vacina',
        created_at: new Date().toISOString()
      }
    ];
  },
  async create(data) {
    return {
      id: Date.now().toString(),
      ...data,
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

export const Vaccine = VaccineMock;

// Mock para Allergy
const AllergyMock = {
  async filter({ tenant_id }) {
    return [
      {
        id: '1',
        tenant_id,
        name: 'Alergia Mock',
        description: 'Descrição da alergia',
        created_at: new Date().toISOString()
      }
    ];
  },
  async create(data) {
    return {
      id: Date.now().toString(),
      ...data,
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

export const Allergy = AllergyMock;

// Mock para PetClinicalData
const PetClinicalDataMock = {
  async filter({ pet_id, tenant_id }) {
    return [
      {
        id: '1',
        pet_id,
        tenant_id,
        weight: 10.5,
        temperature: 38.5,
        created_at: new Date().toISOString()
      }
    ];
  },
  async create(data) {
    return {
      id: Date.now().toString(),
      ...data,
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

export const PetClinicalData = PetClinicalDataMock;

// Mock para PetshopData
const PetshopDataMock = {
  async filter({ tenant_id }) {
    return [
      {
        id: '1',
        tenant_id,
        name: 'Petshop Mock',
        address: 'Endereço mock',
        created_at: new Date().toISOString()
      }
    ];
  },
  async create(data) {
    return {
      id: Date.now().toString(),
      ...data,
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

export const PetshopData = PetshopDataMock;

// Mock para Hospitalization
const HospitalizationMock = {
  async filter({ tenant_id }) {
    return [
      {
        id: '1',
        tenant_id,
        pet_id: '1',
        start_date: new Date().toISOString(),
        end_date: null,
        status: 'active',
        created_at: new Date().toISOString()
      }
    ];
  },
  async create(data) {
    return {
      id: Date.now().toString(),
      ...data,
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

export const Hospitalization = HospitalizationMock;

// Mock para HospitalizationProgress
const HospitalizationProgressMock = {
  async filter({ hospitalization_id }) {
    return [
      {
        id: '1',
        hospitalization_id,
        description: 'Progresso mock',
        created_at: new Date().toISOString()
      }
    ];
  },
  async create(data) {
    return {
      id: Date.now().toString(),
      ...data,
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

export const HospitalizationProgress = HospitalizationProgressMock;

// Mock para TransportService
export const TransportServiceMock = {
  list: async () => {
    const data = getMockData();
    return data.transportServices || [];
  },

  get: async (id) => {
    const data = getMockData();
    const service = (data.transportServices || []).find(s => s.id === id);
    if (!service) throw new Error('Serviço de transporte não encontrado');
    return service;
  },

  filter: async (filters = {}) => {
    const data = getMockData();
    let filteredServices = [...(data.transportServices || [])];

    if (filters.tenant_id) {
      filteredServices = filteredServices.filter(s => s.tenant_id === filters.tenant_id);
    }

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
    data.transportServices = data.transportServices || [];
    data.transportServices.push(newService);
    setMockData(data);
    return newService;
  },

  update: async (id, serviceData) => {
    const data = getMockData();
    const index = (data.transportServices || []).findIndex(s => s.id === id);
    if (index === -1) throw new Error('Serviço de transporte não encontrado');
    
    data.transportServices[index] = {
      ...data.transportServices[index],
      ...serviceData,
      updated_at: new Date().toISOString()
    };
    setMockData(data);
    return data.transportServices[index];
  },

  delete: async (id) => {
    const data = getMockData();
    data.transportServices = (data.transportServices || []).filter(s => s.id !== id);
    setMockData(data);
  }
};

export const TransportService = TransportServiceMock;

// Mock para TransportZonePricing
const TransportZonePricingMock = {
  async filter({ tenant_id }) {
    return [
      {
        id: '1',
        tenant_id,
        zone: 'Zona Mock',
        price: 30.00,
        created_at: new Date().toISOString()
      }
    ];
  },
  async create(data) {
    return {
      id: Date.now().toString(),
      ...data,
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

export const TransportZonePricing = TransportZonePricingMock;

// Mock para TransportDriver
const TransportDriverMock = {
  async filter({ tenant_id }) {
    return [
      {
        id: '1',
        tenant_id,
        name: 'Motorista Mock',
        phone: '123456789',
        created_at: new Date().toISOString()
      }
    ];
  },
  async create(data) {
    return {
      id: Date.now().toString(),
      ...data,
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

export const TransportDriver = TransportDriverMock;

// Mock para TransportVehicle
const TransportVehicleMock = {
  async filter({ tenant_id }) {
    return [
      {
        id: '1',
        tenant_id,
        model: 'Modelo Mock',
        plate: 'ABC1234',
        created_at: new Date().toISOString()
      }
    ];
  },
  async create(data) {
    return {
      id: Date.now().toString(),
      ...data,
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

export const TransportVehicle = TransportVehicleMock;

// Mock para TransportRoute
const TransportRouteMock = {
  async filter({ tenant_id }) {
    return [
      {
        id: '1',
        tenant_id,
        origin: 'Origem Mock',
        destination: 'Destino Mock',
        distance: 10,
        created_at: new Date().toISOString()
      }
    ];
  },
  async create(data) {
    return {
      id: Date.now().toString(),
      ...data,
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

export const TransportRoute = TransportRouteMock;

// Mock para TransportConfig
const TransportConfigMock = {
  async filter({ tenant_id }) {
    return [
      {
        id: '1',
        tenant_id,
        config: {},
        created_at: new Date().toISOString()
      }
    ];
  },
  async create(data) {
    return {
      id: Date.now().toString(),
      ...data,
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

export const TransportConfig = TransportConfigMock;

// Mock para KnowledgeArticle
const KnowledgeArticleMock = {
  async filter({ tenant_id }) {
    return [
      {
        id: '1',
        tenant_id,
        title: 'Artigo Mock',
        content: 'Conteúdo do artigo',
        created_at: new Date().toISOString()
      }
    ];
  },
  async create(data) {
    return {
      id: Date.now().toString(),
      ...data,
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

export const KnowledgeArticle = KnowledgeArticleMock;

// Mock para SupportMessage
const SupportMessageMock = {
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
    return {
      id: Date.now().toString(),
      ...data,
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

export const SupportMessage = SupportMessageMock;

// Mock para MedicalRecord
const MedicalRecordMock = {
  async filter({ pet_id, tenant_id }) {
    return [
      {
        id: '1',
        pet_id,
        tenant_id,
        type: 'consultation',
        description: 'Consulta de rotina',
        date: new Date().toISOString(),
        created_at: new Date().toISOString()
      }
    ];
  },
  async create(data) {
    return {
      id: Date.now().toString(),
      ...data,
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

export const MedicalRecord = MedicalRecordMock;

// Mock para OCRStatistic
const OCRStatisticMock = {
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
  async create(data) {
    return {
      id: Date.now().toString(),
      ...data,
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

export const OCRStatistic = OCRStatisticMock;

// Mock para SupportTicket
const SupportTicketMock = {
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

export const SupportTicket = SupportTicketMock;

// Mock para User
const UserMock = {
  async me() {
    return {
      id: '1',
      email: 'user@example.com',
      name: 'Usuário Teste',
      role: 'admin',
      created_at: new Date().toISOString()
    };
  },
  async filter({ tenant_id }) {
    return [
      {
        id: '1',
        tenant_id,
        email: 'user@example.com',
        name: 'Usuário Teste',
        role: 'admin',
        created_at: new Date().toISOString()
      }
    ];
  },
  async create(data) {
    return {
      id: Date.now().toString(),
      ...data,
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

export const User = UserMock;

// Mock para VehicleHygiene
const VehicleHygieneMock = {
  async filter({ tenant_id }) {
    return [
      {
        id: '1',
        tenant_id,
        vehicle_id: '1',
        date: new Date().toISOString(),
        status: 'clean',
        photos: [],
        created_at: new Date().toISOString()
      }
    ];
  },
  async create(data) {
    return {
      id: Date.now().toString(),
      ...data,
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

export const VehicleHygiene = VehicleHygieneMock;