import { CustomerMock, PetMock, ServiceMock, AppointmentMock, QueueServiceMock, uploadFileMock } from './mockData';

// Exporta as entidades com mocks
export const Customer = CustomerMock;
export const Pet = PetMock;
export const Service = ServiceMock;
export const Appointment = AppointmentMock;
export const QueueService = QueueServiceMock;
export const UploadFile = uploadFileMock;

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

// Mock para Product
const ProductMock = {
  async filter({ tenant_id }) {
    return [
      {
        id: '1',
        tenant_id,
        name: 'Produto Mock',
        description: 'Descrição do produto',
        price: 100.00,
        stock: 10,
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

export const Product = ProductMock;

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

// Mock para Tenant
const TenantMock = {
  async filter() {
    return [
      {
        id: '1',
        name: 'Tenant Mock',
        access_url: 'mock',
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

export const Tenant = TenantMock;

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
const TransportServiceMock = {
  async filter({ tenant_id }) {
    return [
      {
        id: '1',
        tenant_id,
        name: 'Serviço de Transporte Mock',
        description: 'Descrição do serviço',
        price: 50.00,
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