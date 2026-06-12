import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
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

  submit(pageId: string, state: DonationFormState): Observable<DonationSubmitResponse> {
    return this.#http
      .post<ApiResponse<DonationSubmitResponse>>(`${this.#base}/donations`, {
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
        },
        consents: {
          privacyPolicy: state.privacyPolicy,
          termsOfService: false,
        },
      })
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

  // Abre en visor del navegador
  getCertificateUrl(certificateNumber: string): string {
    return `${this.#base}/certificates/${certificateNumber}/download`;
  }

  // Descarga directamente
  downloadCertificate(certificateNumber: string): Observable<Blob> {
    return this.#http.get(`${this.#base}/certificates/${certificateNumber}/download`, {
      responseType: 'blob',
    });
  }
}
