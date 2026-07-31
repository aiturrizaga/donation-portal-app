import { Injectable, inject, signal } from '@angular/core';
import { DonationApi } from '../api/donation.api';
import { IdentityVerifyResponse, UbigeoItem } from '../models/donation.model';

/**
 * Owns the identity-verification + Peru ubigeo (department/province/district) cascade
 * used by the step-2 donor form. Kept out of the component so the form only orchestrates
 * controls, not HTTP/debounce concerns.
 */
@Injectable()
export class IdentityVerificationFacade {
  readonly #api = inject(DonationApi);

  readonly verifying = signal(false);
  readonly verified = signal<IdentityVerifyResponse | null>(null);
  readonly verifyError = signal(false);

  readonly departments = signal<UbigeoItem[]>([]);
  readonly provinces = signal<UbigeoItem[]>([]);
  readonly districts = signal<UbigeoItem[]>([]);
  readonly loadingProvinces = signal(false);
  readonly loadingDistricts = signal(false);

  verify(documentType: string, documentNumber: string): void {
    if (documentType === 'ce' || documentType === 'passport') return;

    const minLength = documentType === 'dni' ? 8 : 11;
    if (documentNumber.length < minLength) return;

    this.verifying.set(true);
    this.verified.set(null);
    this.verifyError.set(false);

    this.#api.verifyIdentity(documentType, documentNumber).subscribe({
      next: (result) => {
        this.verifying.set(false);
        this.verified.set(result);
      },
      error: () => {
        this.verifying.set(false);
        this.verifyError.set(true);
      },
    });
  }

  resetVerification(): void {
    this.verified.set(null);
    this.verifyError.set(false);
  }

  loadDepartments(): void {
    this.#api.getDepartments().subscribe((data) => this.departments.set(data));
  }

  loadProvinces(department: string): void {
    this.loadingProvinces.set(true);
    this.#api.getProvinces(department).subscribe({
      next: (data) => {
        this.provinces.set(data);
        this.loadingProvinces.set(false);
      },
      error: () => this.loadingProvinces.set(false),
    });
  }

  loadDistricts(province: string): void {
    this.loadingDistricts.set(true);
    this.#api.getDistricts(province).subscribe({
      next: (data) => {
        this.districts.set(data);
        this.loadingDistricts.set(false);
      },
      error: () => this.loadingDistricts.set(false),
    });
  }

  resetProvinces(): void {
    this.provinces.set([]);
    this.districts.set([]);
  }

  resetDistricts(): void {
    this.districts.set([]);
  }
}
