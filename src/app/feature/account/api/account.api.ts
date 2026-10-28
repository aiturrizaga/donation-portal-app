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

// Formato de error de /v1/portal/auth y /me (donation-manager-api):
// { status: false, message, data: { code, detail: { code, attemptsLeft?,
// retryAfterSeconds? } } }. También se aceptan `code`/`detail` en la raíz,
// que es como responden otros endpoints de la API.
export function toAccountApiError(err: unknown): AccountApiError {
  const http = err instanceof HttpErrorResponse ? err : null;
  const body = (http?.error ?? {}) as Record<string, any>;
  const root = (body['data'] && typeof body['data'] === 'object' ? body['data'] : body) as Record<
    string,
    any
  >;
  const detail = (
    root['detail'] && typeof root['detail'] === 'object' ? root['detail'] : {}
  ) as Record<string, any>;
  const pick = (key: string) => detail[key] ?? root[key];
  return {
    status: http?.status ?? 0,
    code: pick('code') ?? null,
    attemptsLeft: typeof pick('attemptsLeft') === 'number' ? pick('attemptsLeft') : null,
    retryAfterSeconds:
      typeof pick('retryAfterSeconds') === 'number' ? pick('retryAfterSeconds') : null,
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
      return 'El código ya no es válido. Solicita uno nuevo.';
    case 'otp_locked':
      return 'Superaste el número de intentos. Solicita un código nuevo.';
    case 'rate_limited':
      return error.retryAfterSeconds
        ? `Espera ${error.retryAfterSeconds} s antes de pedir otro código.`
        : 'Solicitaste demasiados códigos. Espera unos minutos e inténtalo de nuevo.';
    case 'email_already_linked':
      return 'Ese correo ya está vinculado a tu cuenta.';
    case 'too_many_emails':
      return 'Alcanzaste el máximo de 10 correos vinculados.';
    case 'email_not_linked':
      return 'Ese correo ya no está vinculado a tu cuenta.';
  }
  if (error.status === 429) {
    return 'Solicitaste demasiados códigos. Espera unos minutos e inténtalo de nuevo.';
  }
  if (error.status === 0) return 'No pudimos conectar con el servidor. Revisa tu conexión.';
  return 'Ocurrió un error. Inténtalo de nuevo.';
}
