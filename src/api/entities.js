// Importa APENAS os Mocks das entidades de mockData.js
import { 
    HospitalizationProgressMock,
    CustomerMock, 
    PetMock, 
    ServiceMock, 
    AppointmentMock, 
    QueueServiceMock, 
    ProductMock,        // Adiciona ProductMock se foi definido lá
    TenantMock,         // Adiciona TenantMock
    CustomizationMock,  // Adiciona CustomizationMock
    FinancialConfigMock, // etc...
    FinancialTransactionMock,
    HealthPlanMock,
    HospitalizationMock, // Adiciona HospitalizationMock
    MedicalRecordMock,   // Adiciona MedicalRecordMock
    ConsultationMock,    // Adiciona ConsultationMock
    MedicationTaskMock,  // Adiciona MedicationTaskMock
    AllergyMock,         // Adiciona AllergyMock
    VaccineMock,         // Adiciona VaccineMock
    PetClinicalDataMock, // Adiciona PetClinicalDataMock
    MedicationMock,      // Adiciona MedicationMock
    PetshopDataMock,     // <<< ADICIONADO PetshopDataMock >>>
    PurchaseHistoryMock, // <<< ADICIONADO PurchaseHistoryMock >>>
    OCRStatisticMock,    // <<< ADICIONADO OCRStatisticMock >>>
    SupportTicketMock,   // <<< ADICIONADO SupportTicketMock >>>
    SupportMessageMock,  // <<< ADICIONADO SupportMessageMock >>>
    UserMock,            // <<< ADICIONADO UserMock >>>
    KnowledgeArticleMock, // <<< ADICIONADO KnowledgeArticleMock >>>
    TenantUserMock,      // <<< ADICIONADO TenantUserMock >>>
    TransportDriverMock, // <<< ADICIONADO TransportDriverMock >>>
    TransportRouteMock,  // <<< ADICIONADO TransportRouteMock >>>
    TransportServiceMock, // <<< ADICIONADO TransportServiceMock >>>
    TransportVehicleMock, // <<< ADICIONADO TransportVehicleMock >>>
    TransportZonePricingMock, // <<< ADICIONADO TransportZonePricingMock >>>
    // ... adicione outros mocks que você exporta de mockData.js
    uploadFileMock 
} from './mockData';

// REMOVIDAS outras importações de mockData.js que causavam conflito
// import { Appointment, QueueService, Service } from "@/api/entities"; // Importação redundante
// import { getMockData, addRemovalReason, getRemovalReasons } from "@/api/mockData"; 

// Exporta as entidades usando os Mocks importados
export const Customer = CustomerMock;
export const Pet = PetMock;
export const Service = ServiceMock;
export const Appointment = AppointmentMock;
export const QueueService = QueueServiceMock;
export const Product = ProductMock;
export const Tenant = TenantMock;
export const Customization = CustomizationMock;
export const FinancialConfig = FinancialConfigMock;
export const FinancialTransaction = FinancialTransactionMock;
export const HealthPlan = HealthPlanMock;
export const Hospitalization = HospitalizationMock;
export const MedicalRecord = MedicalRecordMock;
export const Consultation = ConsultationMock;
export const MedicationTask = MedicationTaskMock;
export const Allergy = AllergyMock;
export const Vaccine = VaccineMock;
export const PetClinicalData = PetClinicalDataMock;
export const Medication = MedicationMock;
export const PetshopData = PetshopDataMock;   // <<< ADICIONADO EXPORT >>>
export const PurchaseHistory = PurchaseHistoryMock; // <<< ADICIONADO EXPORT >>>
export const OCRStatistic = OCRStatisticMock;      // <<< ADICIONADO EXPORT >>>
export const SupportTicket = SupportTicketMock;    // <<< ADICIONADO EXPORT >>>
export const SupportMessage = SupportMessageMock; // <<< ADICIONADO EXPORT >>>
export const User = UserMock;                      // <<< ADICIONADO EXPORT >>>
export const KnowledgeArticle = KnowledgeArticleMock; // <<< ADICIONANDO EXPORT QUE FALTOU >>>
export const HospitalizationProgress = HospitalizationProgressMock;
export const TenantUser = TenantUserMock;           // <<< ADICIONADO EXPORT >>>
export const TransportDriver = TransportDriverMock; // <<< ADICIONADO EXPORT >>>
export const TransportRoute = TransportRouteMock;   // <<< ADICIONADO EXPORT >>>
export const TransportService = TransportServiceMock; // <<< ADICIONADO EXPORT >>>
export const TransportVehicle = TransportVehicleMock; // <<< ADICIONADO EXPORT >>>
export const TransportZonePricing = TransportZonePricingMock; // <<< ADICIONADO EXPORT >>>
// ... exporte outras entidades mock
export const UploadFile = uploadFileMock;

// Outros mocks que podem estar definidos diretamente aqui (se houver)
// Exemplo:
// const AlgumaOutraCoisaMock = { /* ... */ };
// export const AlgumaOutraCoisa = AlgumaOutraCoisaMock;