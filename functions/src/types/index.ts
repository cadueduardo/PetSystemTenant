// import * as admin from "firebase-admin"; // REMOVED: Not used in this file

// --- Interfaces ---
export interface InviteCollaboratorData {
  email: string;
  collaboratorName: string;
  profileId: string;
}

export interface CreateTenantData {
  company_name: string;
  legal_name?: string;
  document_type: string;
  document: string;
  responsible_name: string; // Nome do Admin
  adminEmail: string;       // Email do Admin
  email: string;            // Email de contato geral
  phone: string;
  address: {
    cep: string;
    street: string;
    number: string;
    complement?: string;
    neighborhood: string;
    city: string;
    state: string;
  };
  business_type: string;
  selected_modules: string[];
  access_url: string;
  status: string;
  subscription_tier: string;
  payment_plan: string;
  payment_method: string;
}

export interface CompleteInvitationData {
  token: string;
  password: string;
}

export interface SendWahaConfirmationData {
  appointmentId: string;
}

export interface WahaWebhookPayload {
  event: string;
  session: string;
  payload?: any;
  me?: { id: string; pushName: string };
  timestamp?: number;
}

export interface CancelChargeItemData {
  chargeId: string;
  itemId: string;
  reason: string;
}

export interface CreateContinuedOsData {
  customerId: string;
  // petId?: string;
}

export interface DeleteOsData {
  osId: string;
}

export interface AddCancellationReasonData {
  reasonText: string;
}

export interface PaymentData {
  chargeIds?: string[];
  continuedOsIds?: string[];
  cartItems?: Array<{
    itemId: string;
    description: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    itemType: 'product' | 'service';
  }>;
  paymentMethod: 'pix' | 'credit_card' | 'debit_card' | 'cash' | 'other';
  amountPaid: number;
  customerId: string | null;
  cardInfo?: {
    number: string;
    holder: string;
    expiry: string;
    cvv: string;
  } | null;
} 