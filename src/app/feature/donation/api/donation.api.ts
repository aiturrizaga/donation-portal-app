import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '@env/environment';
import {
  DonationPage,
  DonationFormState,
  DonationSubmitResponse,
  IdentityVerifyResponse,
  UbigeoItem,
} from '../models/donation.model';

interface ApiResponse<T> {
  status: boolean;
  message: string;
  data: T;
}

@Injectable({ providedIn: 'root' })
export class DonationApi {
  readonly #http = inject(HttpClient);
  readonly #base = `${environment.apiUrl}/v1/portal`;

  getPage(slug: string): Observable<DonationPage> {
    return this.#http
      .get<ApiResponse<DonationPage>>(`${this.#base}/pages/${slug}`)
      .pipe(map((r) => r.data));
  }

  getDefaultPage(): Observable<DonationPage> {
    return this.#http
      .get<ApiResponse<DonationPage>>(`${this.#base}/default-page`)
      .pipe(map((r) => r.data));
  }

  verifyIdentity(documentType: string, documentNumber: string): Observable<IdentityVerifyResponse> {
    return this.#http
      .post<
        ApiResponse<IdentityVerifyResponse>
      >(`${this.#base}/identity/verify`, { documentType, documentNumber })
      .pipe(map((r) => r.data));
  }

  // idempotencyKey: generated once per checkout session by
  // CulqiCheckoutService and reused on every retry of the same submission
  // — see PAYMENTS_ARCHITECTURE.md §8 Capa 0/1. The backend uses it to
  // guarantee a double-click/refresh/retry never charges twice.
  submit(
    pageId: string,
    state: DonationFormState,
    idempotencyKey: string,
  ): Observable<DonationSubmitResponse> {
    const body = {
      pageId,
      donor: {
        documentType: state.documentType,
        documentNumber: state.documentNumber,
        firstName: state.firstName,
        lastName: state.lastName,
        businessName: state.businessName,
        email: state.email,
        phone: state.phone,
        address: state.address,
        country: state.country,
        department: state.department,
        province: state.province,
        district: state.district,
      },
      amount: {
        targetId: state.targetId,
        currency: state.currency,
        amount: state.amount,
        donationType: state.donationType,
        frequency: state.frequency,
      },
      payment: {
        gatewayId: state.gatewayId,
        culqiToken: state.culqiToken,
        paymentMethod: state.paymentMethod,
        deviceFingerPrintId: state.culqiDeviceId,
      },
      consents: {
        privacyPolicy: state.privacyPolicy,
        termsOfService: false,
      },
    };
    const headers = new HttpHeaders({ 'Idempotency-Key': idempotencyKey });

    return this.#http
      .post<ApiResponse<DonationSubmitResponse>>(`${this.#base}/donations`, body, { headers })
      .pipe(map((r) => r.data));
  }

  // Follow-up call once the donor completes a Culqi3DS challenge for a
  // donation POST /donations already reported as status "requires_3ds".
  // Resends the SAME token — Culqi's own flow reuses it, never issues a
  // new one for the second attempt — plus the challenge's proof.
  confirm3ds(
    donationId: string,
    paymentAttemptId: string,
    culqiToken: string,
    deviceFingerPrintId: string | null,
    authentication3ds: {
      eci: string;
      xid: string;
      cavv: string;
      protocolVersion: string;
      directoryServerTransactionId: string;
    },
  ): Observable<DonationSubmitResponse> {
    const body = {
      paymentAttemptId,
      culqiToken,
      deviceFingerPrintId,
      authentication3ds,
    };

    return this.#http
      .post<
        ApiResponse<DonationSubmitResponse>
      >(`${this.#base}/donations/${donationId}/confirm-3ds`, body)
      .pipe(map((r) => r.data));
  }

  // Reports that the donor's Culqi3DS challenge itself failed/was abandoned
  // client-side (timeout, exhausted OTP attempts, the widget erroring out)
  // — no second charge was ever attempted, unlike confirm3ds. Without this
  // call the backend has no way to know the challenge is over, and the
  // donation stays stuck at "requires_3ds"/"pending" forever — confirmed
  // live 2026-07-27 (declined 3DS test cards showed as "Pendiente" in the
  // admin panel indefinitely instead of "Fallido").
  fail3ds(
    donationId: string,
    paymentAttemptId: string,
    reason?: string,
  ): Observable<DonationSubmitResponse> {
    const body = { paymentAttemptId, reason };

    return this.#http
      .post<
        ApiResponse<DonationSubmitResponse>
      >(`${this.#base}/donations/${donationId}/fail-3ds`, body)
      .pipe(map((r) => r.data));
  }

  // Polled after a recurring donation comes back at status "processing" with
  // no paymentCode (a card-based subscription awaiting its first charge's
  // webhook confirmation) — see DonationStore.pollConfirmation. Returns the
  // same shape as submit()/confirm3ds(), so the frontend can render whatever
  // status comes back identically.
  getStatus(donationId: string): Observable<DonationSubmitResponse> {
    return this.#http
      .get<ApiResponse<DonationSubmitResponse>>(`${this.#base}/donations/${donationId}/status`)
      .pipe(map((r) => r.data));
  }

  getDepartments(): Observable<UbigeoItem[]> {
    return this.#http
      .get<ApiResponse<UbigeoItem[]>>(`${this.#base}/ubigeo/departments`)
      .pipe(map((r) => r.data));
  }

  getProvinces(department: string): Observable<UbigeoItem[]> {
    return this.#http
      .get<ApiResponse<UbigeoItem[]>>(`${this.#base}/ubigeo/provinces?department=${department}`)
      .pipe(map((r) => r.data));
  }

  getDistricts(province: string): Observable<UbigeoItem[]> {
    return this.#http
      .get<ApiResponse<UbigeoItem[]>>(`${this.#base}/ubigeo/districts?province=${province}`)
      .pipe(map((r) => r.data));
  }

  // certificateFileUrl viene del backend (DonationSubmitResponse.certificateFileUrl) —
  // ya es la ruta de descarga completa, keyed por el UUID del certificado, no por su
  // número secuencial (que es predecible y no debe usarse como identificador público).

  // Abre en visor del navegador
  getCertificateUrl(certificateFileUrl: string): string {
    return `${environment.apiUrl}${certificateFileUrl}`;
  }

  // Descarga directamente
  downloadCertificate(certificateFileUrl: string): Observable<Blob> {
    return this.#http.get(`${environment.apiUrl}${certificateFileUrl}`, {
      responseType: 'blob',
    });
  }
}
