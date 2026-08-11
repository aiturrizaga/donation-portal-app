export interface ComplaintFormState {
  fullName: string;
  documentType: string;
  documentNumber: string;
  email: string;
  phone: string;
  address: string;
  isMinor: boolean;
  guardianName: string | null;
  recordType: 'reclamo' | 'queja';
  goodType: 'producto' | 'servicio';
  amount: number | null;
  detail: string;
  request: string;
  dataConsent: boolean;
}

export interface ComplaintSubmitResponse {
  id: string;
  sheetNumber: number;
}
