// Importa APENAS os Mocks das entidades de mockData.js
import { 
    HospitalizationProgressMock,
    // CustomerMock, // Removido - Usaremos o serviço Firebase
    // PetMock,             // <<< Não usado mais
    // ServiceMock,         // <<< Removido - Usaremos Serviço Firebase
    // QueueServiceMock,    // <<< Removido - Usaremos Serviço Firebase
    ProductMock,        
    // TenantMock, // <-- REMOVE MOCK
    // CustomizationMock, // <-- REMOVE MOCK
    FinancialConfigMock,
    FinancialTransactionMock,
    HealthPlanMock,
    HospitalizationMock, 
    MedicalRecordMock,   
    // ConsultationMock, // <<< REMOVER IMPORT NÃO USADO
    MedicationTaskMock,  
    AllergyMock,         
    VaccineMock,         
    PetClinicalDataMock, 
    MedicationMock,      
    PetshopDataMock,     
    PurchaseHistoryMock, 
    OCRStatisticMock,    
    SupportTicketMock,   
    SupportMessageMock,  
    UserMock,            
    KnowledgeArticleMock,
    TenantUserMock,      
    TransportDriverMock, 
    TransportRouteMock,  
    TransportServiceMock,
    TransportVehicleMock,
    TransportZonePricingMock,
    // uploadFileMock // Removido
} from './mockData';

// <<< IMPORTA OS NOVOS SERVIÇOS FIREBASE >>>
import { customerService } from './firebase/customerService';
import { petService } from './firebase/petService'; 
import { storageService } from './firebase/storageService'; 
import { appointmentService } from './firebase/appointmentService'; 
import { cancellationReasonService } from './firebase/cancellationReasonService'; 
// <<< Adiciona imports dos novos serviços >>>
import { serviceService } from './firebase/serviceService';
import { queueService } from './firebase/queueService'; 
// <-- IMPORT NEW SERVICES -->
import { tenantService } from './firebase/tenantService';
import { customizationService } from './firebase/customizationService';
import { consultationService } from './firebase/consultationService';

// REMOVIDAS outras importações de mockData.js que causavam conflito

// Exporta as entidades usando os Mocks ou Serviços Firebase
export const Customer = customerService;
export const Pet = petService;
export const Service = serviceService; // <<< Usa Serviço Firebase
export const Appointment = appointmentService;
export const QueueService = queueService; // <<< Usa Serviço Firebase
export const Product = ProductMock;
export const Tenant = tenantService; // <-- USE REAL SERVICE
export const Customization = customizationService; // <-- USE REAL SERVICE
export const FinancialConfig = FinancialConfigMock;
export const FinancialTransaction = FinancialTransactionMock;
export const HealthPlan = HealthPlanMock;
export const Hospitalization = HospitalizationMock;
export const MedicalRecord = MedicalRecordMock;
export const Consultation = consultationService;
export const MedicationTask = MedicationTaskMock;
export const Allergy = AllergyMock;
export const Vaccine = VaccineMock;
export const PetClinicalData = PetClinicalDataMock;
export const Medication = MedicationMock;
export const PetshopData = PetshopDataMock;   
export const PurchaseHistory = PurchaseHistoryMock; 
export const OCRStatistic = OCRStatisticMock;      
export const SupportTicket = SupportTicketMock;    
export const SupportMessage = SupportMessageMock; 
export const User = UserMock;                      
export const KnowledgeArticle = KnowledgeArticleMock;
export const HospitalizationProgress = HospitalizationProgressMock;
export const TenantUser = TenantUserMock;           
export const TransportDriver = TransportDriverMock; 
export const TransportRoute = TransportRouteMock;   
export const TransportService = TransportServiceMock; 
export const TransportVehicle = TransportVehicleMock; 
export const TransportZonePricing = TransportZonePricingMock; 
export const CancellationReason = cancellationReasonService;

// Exporta o serviço de storage
export const UploadFile = storageService;

// Outros mocks que podem estar definidos diretamente aqui (se houver)
// Exemplo:
// const AlgumaOutraCoisaMock = { /* ... */ };
// export const AlgumaOutraCoisa = AlgumaOutraCoisaMock;