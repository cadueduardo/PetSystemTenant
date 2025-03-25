import { base44 } from './base44Client';
import { 
  CustomerMock, 
  PetMock, 
  TenantMock, 
  TenantUserMock,
  ServiceMock,
  QueueServiceMock,
  HealthPlanMock,
  PurchaseHistoryMock,
  PetClinicalDataMock,
  PetshopDataMock,
  MedicationMock,
  VaccineMock,
  AllergyMock,
  AppointmentMock,
  ProductMock
} from './mockData';

// Use mocks por padrão
const useMocks = true;

export const Customization = base44.entities.Customization;

export const Customer = useMocks ? CustomerMock : base44.entities.Customer;

export const Pet = useMocks ? PetMock : base44.entities.Pet;

export const Product = useMocks ? ProductMock : base44.entities.Product;

export const FinancialConfig = base44.entities.FinancialConfig;

export const MedicalRecord = base44.entities.MedicalRecord;

export const Hospitalization = base44.entities.Hospitalization;

export const HospitalizationProgress = base44.entities.HospitalizationProgress;

export const Appointment = useMocks ? AppointmentMock : base44.entities.Appointment;

export const HealthPlan = useMocks ? HealthPlanMock : base44.entities.HealthPlan;

export const OCRStatistic = base44.entities.OCRStatistic;

export const SupportTicket = base44.entities.SupportTicket;

export const SupportMessage = base44.entities.SupportMessage;

export const KnowledgeArticle = base44.entities.KnowledgeArticle;

export const Service = useMocks ? ServiceMock : base44.entities.Service;

export const PromotionConfig = base44.entities.PromotionConfig;

export const MembershipPlan = base44.entities.MembershipPlan;

export const CustomerMembership = base44.entities.CustomerMembership;

export const PurchaseOrder = base44.entities.PurchaseOrder;

export const DeliveryOrder = base44.entities.DeliveryOrder;

export const Tenant = useMocks ? TenantMock : base44.entities.Tenant;

export const TenantUser = useMocks ? TenantUserMock : base44.entities.TenantUser;

export const Species = base44.entities.Species;

export const Breed = base44.entities.Breed;

export const TransportService = base44.entities.TransportService;

export const TransportZonePricing = base44.entities.TransportZonePricing;

export const TransportVehicle = base44.entities.TransportVehicle;

export const TransportDriver = base44.entities.TransportDriver;

export const TransportPartner = base44.entities.TransportPartner;

export const TransportRoute = base44.entities.TransportRoute;

export const TransportConfig = base44.entities.TransportConfig;

export const VehicleHygiene = base44.entities.VehicleHygiene;

export const TransportNotification = base44.entities.TransportNotification;

export const TransportReport = base44.entities.TransportReport;

export const PurchaseHistory = useMocks ? PurchaseHistoryMock : base44.entities.PurchaseHistory;

export const Medication = useMocks ? MedicationMock : base44.entities.Medication;

export const Vaccine = useMocks ? VaccineMock : base44.entities.Vaccine;

export const Allergy = useMocks ? AllergyMock : base44.entities.Allergy;

export const QueueService = useMocks ? QueueServiceMock : base44.entities.QueueService;

export const PetClinicalData = useMocks ? PetClinicalDataMock : base44.entities.PetClinicalData;

export const PetshopData = useMocks ? PetshopDataMock : base44.entities.PetshopData;

// auth sdk:
export const User = base44.auth;