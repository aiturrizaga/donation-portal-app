// Culqi ships no TypeScript types for Custom Checkout — this is our own,
// minimal typing of the parts of window.Culqi we actually use. Confined to
// this file so nothing outside culqi-checkout.service.ts ever needs to know
// this shape exists — see that service for the encapsulation boundary.

export interface CulqiSettings {
  title: string;
  currency: string;
  amount: number; // cents
  order?: string;
}

export interface CulqiOptions {
  lang: 'es' | 'en';
  installments: boolean;
  paymentMethods: {
    tarjeta: boolean;
    yape: boolean;
    billetera: boolean;
    bancaMovil: boolean;
    agente: boolean;
    cuotealo: boolean;
  };
  style?: Record<string, unknown>;
}

export interface CulqiConfig {
  settings: CulqiSettings;
  client: { email: string; first_name?: string; last_name?: string };
  options: CulqiOptions;
}

export interface CulqiToken {
  id: string;
  email: string;
}

export interface CulqiError {
  user_message?: string;
  merchant_message?: string;
  code?: string;
}

export interface CulqiGlobal {
  publicKey: string;
  token?: CulqiToken;
  order?: { id: string };
  error?: CulqiError;
  culqi?: () => void;
  open(): void;
  close(): void;
  settingsRSAID?(id: string, publicKey: string): void;
}

// Culqi3DS — a SEPARATE library from Custom Checkout, loaded from its own
// script (https://3ds.culqi.com). It hooks into whatever token Checkout
// already produced; it doesn't replace it. Shape confirmed against
// docs.culqi.com/culqi-3ds and the official demo repo
// culqi/culqi-python-demo-checkoutv4-culqi3ds — see culqi-checkout.service.ts.
export interface Culqi3DSOptions {
  showModal: boolean;
  showLoading: boolean;
  showIcon: boolean;
  closeModalAction?: () => void;
}

export interface Culqi3DSAuthParameters {
  eci: string;
  xid: string;
  cavv: string;
  protocolVersion: string;
  directoryServerTransactionId: string;
}

// event.data after Culqi3DS posts a message back to window.location.origin.
export interface Culqi3DSMessageData {
  loading?: boolean;
  parameters3DS?: Culqi3DSAuthParameters;
  error?: string;
}

export interface Culqi3DSGlobal {
  publicKey: string;
  options: Culqi3DSOptions;
  settings: {
    charge: { totalAmount: number; returnUrl: string };
    card: { email: string };
  };
  generateDevice(): Promise<string | null>;
  initAuthentication(tokenId: string): void;
  reset(): void;
}

declare global {
  interface Window {
    Culqi?: CulqiGlobal;
    CulqiCheckout?: new (publicKey: string, config: CulqiConfig) => CulqiGlobal;
    Culqi3DS?: Culqi3DSGlobal;
  }
}
