export interface DonationPage {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  welcomeText: string | null;
  thankYouText: string | null;
  allowsRecurring: boolean;
  suggestedAmounts: number[] | null;
  organizationName: string;
  organizationRuc: string;
  branding: PageBranding | null;
  formConfig: DonationFormConfig | null;
}

export interface PageBranding {
  companyName: string;
  logoUrl: string | null;
  heroImageUrl: string | null;
  faviconUrl: string | null;
  primaryColor: string;
  secondaryColor: string | null;
}

export interface DonationFormConfig {
  currencyOptions: string[];
  currencyDefault: string;
  currencyVisible: boolean;
  amountDefault: number | null;
  amountLocked: boolean;
  amountAllowCustom: boolean;
  amountMinCustom: number | null;
  suggestedAmounts: number[] | null;
  frequencyOptions: string[];
  frequencyDefault: string;
  frequencyVisible: boolean;
  confirmHeading: string;
  confirmMessage: string | null;
  confirmQuoteText: string | null;
  confirmQuoteAuthor: string | null;
  targets: DonationTarget[];
  gateways: DonationGateway[];
}

export interface DonationTarget {
  id: number;
  name: string;
  description: string | null;
  targetType: string;
  amountGoal: number | null;
  amountRaised: number;
  isDefault: boolean;
  isLocked: boolean;
  isVisible: boolean;
}

export interface DonationGateway {
  id: number;
  provider: string;
  publicKey: string;
  rsaId: string | null;
  rsaPublicKey: string | null;
  testMode: boolean;
  isDefault: boolean;
}

// Form state accumulated across steps

export interface DonationFormState {
  // Step 1
  targetId: number | null;
  currency: string;
  amount: number | null;
  donationType: 'one_time' | 'recurring';
  frequency: string | null;
  // Step 2
  documentType: DocumentType;
  documentNumber: string;
  firstName: string | null;
  lastName: string | null;
  businessName: string | null;
  email: string;
  phone: string | null;
  address: string | null;
  country: string;
  department: string | null;
  province: string | null;
  district: string | null;
  // Step 3
  gatewayId: number | null;
  culqiToken: string | null;
  paymentMethod: string;
  privacyPolicy: boolean;
}

export type DocumentType = 'dni' | 'ruc' | 'ce' | 'passport';

export const INITIAL_FORM_STATE: DonationFormState = {
  targetId: null,
  currency: 'PEN',
  amount: null,
  donationType: 'one_time',
  frequency: null,
  documentType: 'dni',
  documentNumber: '',
  firstName: null,
  lastName: null,
  businessName: null,
  email: '',
  phone: null,
  address: null,
  country: 'PE',
  department: null,
  province: null,
  district: null,
  gatewayId: null,
  culqiToken: null,
  paymentMethod: 'card',
  privacyPolicy: false,
};

// Identity

export interface IdentityVerifyResponse {
  verified: boolean;
  documentType: string;
  documentNumber: string;
  firstName: string | null;
  lastName: string | null;
  fullName: string | null;
  businessName: string | null;
  address: string | null;
  ubigeoDepart: string | null;
  ubigeoProv: string | null;
  ubigeoDist: string | null;
  existsAsDonor: boolean;
  donorId: string | null;
}

// Submit

export interface DonationSubmitResponse {
  donationId: string;
  donorId: string;
  status: string;
  amount: number;
  currency: string;
  certificateNumber: string | null;
  donorFirstName: string | null;
  confirmHeading: string;
  confirmMessage: string | null;
  confirmQuoteText: string | null;
  confirmQuoteAuthor: string | null;
}

// Ubigeo

export interface UbigeoItem {
  code: string;
  name: string;
}
