// Contrato de "Mi cuenta" del donante — acordado con el backend
// (donation-manager-api, rama claude/donor-account). Login sin contraseña:
// correo + OTP. Una cuenta agrupa N correos verificados y ve las donaciones
// hechas con cualquiera de ellos, en todas las organizaciones que lo permiten.

export interface AccountEmail {
  email: string;
  isPrimary: boolean;
  verifiedAt: string;
}

export interface DonorAccount {
  id: string;
  displayName: string | null;
  primaryEmail: string;
  emails: AccountEmail[];
}

export interface OtpRequestResponse {
  expiresInSeconds: number;
  resendAfterSeconds: number;
}

export interface OtpVerifyResponse {
  accessToken: string;
  expiresAt: string;
  account: DonorAccount;
}

export interface AccountOrganization {
  id: number;
  name: string;
}

export interface AccountDonationCertificate {
  id: string;
  certificateNumber: string;
  fileUrl: string;
}

export interface AccountDonation {
  id: string;
  createdAt: string;
  amount: number;
  currency: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'refunded' | 'expired' | 'cancelled';
  donationType: 'one_time' | 'recurring';
  frequencyLabel: string | null;
  targetName: string | null;
  email: string;
  organization: AccountOrganization;
  certificate: AccountDonationCertificate | null;
}

export interface AccountSubscription {
  id: string;
  organization: AccountOrganization;
  amount: number;
  currency: string;
  frequencyLabel: string | null;
  status: 'active' | 'past_due' | 'paused' | 'cancelled';
  nextChargeAt: string | null;
  targetName: string | null;
}

export interface PageContent<T> {
  items: T[];
  total: number;
  page: number;
  size: number;
  pages: number;
}

export const DONATION_STATUS_LABELS: Record<AccountDonation['status'], string> = {
  pending: 'Pendiente',
  processing: 'En proceso',
  completed: 'Completada',
  failed: 'Fallida',
  refunded: 'Reembolsada',
  expired: 'Expirada',
  cancelled: 'Anulada',
};

export const SUBSCRIPTION_STATUS_LABELS: Record<AccountSubscription['status'], string> = {
  active: 'Activa',
  past_due: 'Pago pendiente',
  paused: 'Pausada',
  cancelled: 'Cancelada',
};
