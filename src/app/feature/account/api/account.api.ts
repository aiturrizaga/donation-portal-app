import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '@env/environment';
import {
  AccountDonation,
  AccountOrganization,
  AccountSubscription,
  DonorAccount,
  OtpRequestResponse,
  OtpVerifyResponse,
  PageContent,
} from '../models/account.model';

interface ApiResponse<T> {
  status: boolean;
  message: string;
  data: T;
}

/**
 * Endpoints de "Mi cuenta". Las rutas /me/* y /auth/logout llevan el token
 * Bearer — lo agrega accountTokenInterceptor, no esta clase.
 */
@Injectable({ providedIn: 'root' })
export class AccountApi {
  readonly #http = inject(HttpClient);
  readonly #base = `${environment.apiUrl}/v1/portal`;

  requestOtp(email: string): Observable<OtpRequestResponse> {
    return this.#http
      .post<ApiResponse<OtpRequestResponse>>(`${this.#base}/auth/otp/request`, { email })
      .pipe(map((r) => r.data));
  }

  verifyOtp(email: string, code: string, remember: boolean): Observable<OtpVerifyResponse> {
    return this.#http
      .post<
        ApiResponse<OtpVerifyResponse>
      >(`${this.#base}/auth/otp/verify`, { email, code, remember })
      .pipe(map((r) => r.data));
  }

  logout(): Observable<void> {
    return this.#http
      .post<ApiResponse<null>>(`${this.#base}/auth/logout`, {})
      .pipe(map(() => undefined));
  }

  getMe(): Observable<DonorAccount> {
    return this.#http.get<ApiResponse<DonorAccount>>(`${this.#base}/me`).pipe(map((r) => r.data));
  }

  getOrganizations(): Observable<AccountOrganization[]> {
    return this.#http
      .get<ApiResponse<AccountOrganization[]>>(`${this.#base}/me/organizations`)
      .pipe(map((r) => r.data));
  }

  getDonations(
    page: number,
    size: number,
    organizationId: number | null,
  ): Observable<PageContent<AccountDonation>> {
    const params: Record<string, string> = { page: String(page), size: String(size) };
    if (organizationId) params['organizationId'] = String(organizationId);
    return this.#http
      .get<ApiResponse<PageContent<AccountDonation>>>(`${this.#base}/me/donations`, { params })
      .pipe(map((r) => r.data));
  }

  getSubscriptions(): Observable<AccountSubscription[]> {
    return this.#http
      .get<ApiResponse<AccountSubscription[]>>(`${this.#base}/me/subscriptions`)
      .pipe(map((r) => r.data));
  }

  addEmail(email: string): Observable<OtpRequestResponse> {
    return this.#http
      .post<ApiResponse<OtpRequestResponse>>(`${this.#base}/me/emails`, { email })
      .pipe(map((r) => r.data));
  }

  verifyEmail(email: string, code: string): Observable<DonorAccount> {
    return this.#http
      .post<ApiResponse<DonorAccount>>(`${this.#base}/me/emails/verify`, { email, code })
      .pipe(map((r) => r.data));
  }

  setPrimaryEmail(email: string): Observable<DonorAccount> {
    return this.#http
      .put<ApiResponse<DonorAccount>>(`${this.#base}/me/emails/primary`, { email })
      .pipe(map((r) => r.data));
  }

  removeEmail(email: string): Observable<DonorAccount> {
    return this.#http
      .delete<ApiResponse<DonorAccount>>(`${this.#base}/me/emails/${encodeURIComponent(email)}`)
      .pipe(map((r) => r.data));
  }

  downloadCertificate(fileUrl: string): Observable<Blob> {
    return this.#http.get(`${environment.apiUrl}${fileUrl}`, { responseType: 'blob' });
  }
}

export interface AccountApiError {
  status: number;
  code: string | null;
  attemptsLeft: number | null;
  retryAfterSeconds: number | null;
}

// El backend puede devolver el error plano ({ code, ... }) o envuelto en el
// `detail` de FastAPI ({ detail: { code, ... } }) — se aceptan ambos.
export function toAccountApiError(err: unknown): AccountApiError {
  const http = err instanceof HttpErrorResponse ? err : null;
  const body = (http?.error ?? {}) as Record<string, any>;
  const source = (
    body['detail'] && typeof body['detail'] === 'object' ? body['detail'] : body
  ) as Record<string, any>;
  return {
    status: http?.status ?? 0,
    code: source['code'] ?? source['reason'] ?? null,
    attemptsLeft: typeof source['attemptsLeft'] === 'number' ? source['attemptsLeft'] : null,
    retryAfterSeconds:
      typeof source['retryAfterSeconds'] === 'number' ? source['retryAfterSeconds'] : null,
  };
}

/** Mensaje para el donante a partir de un error de OTP (login o vincular correo). */
export function otpErrorMessage(error: AccountApiError): string {
  switch (error.code) {
    case 'otp_invalid':
      return error.attemptsLeft !== null
        ? `Código incorrecto. Te quedan ${error.attemptsLeft} ${error.attemptsLeft === 1 ? 'intento' : 'intentos'}.`
        : 'Código incorrecto.';
    case 'otp_expired':
      return 'El código venció. Solicita uno nuevo.';
    case 'otp_locked':
      return 'Superaste el número de intentos. Solicita un código nuevo.';
    case 'otp_rate_limited':
      return 'Solicitaste demasiados códigos. Espera unos minutos e inténtalo de nuevo.';
    case 'email_already_linked':
      return 'Ese correo ya está vinculado a tu cuenta.';
  }
  if (error.status === 429) {
    return 'Solicitaste demasiados códigos. Espera unos minutos e inténtalo de nuevo.';
  }
  if (error.status === 0) return 'No pudimos conectar con el servidor. Revisa tu conexión.';
  return 'Ocurrió un error. Inténtalo de nuevo.';
}
