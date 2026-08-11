import { Injectable, inject, signal } from '@angular/core';
import { DonationApi } from '../api/donation.api';
import { IdentityVerifyResponse } from '../models/donation.model';

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

  readonly departments = signal<string[]>([]);
  readonly provinces = signal<string[]>([]);
  readonly districts = signal<string[]>([]);
  readonly loadingProvinces = signal(false);
  readonly loadingDistricts = signal(false);

  // Resolved once department + province + district are all selected — see
  // resolveUbigeo(). null until then, or if the triple doesn't match any
  // row (stale SUNAT casing, catalog gap).
  readonly ubigeoId = signal<string | null>(null);
  readonly resolvingUbigeo = signal(false);

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

  loadDistricts(department: string, province: string): void {
    this.loadingDistricts.set(true);
    this.#api.getDistricts(department, province).subscribe({
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

  // Called once department + province + district are all selected — the
  // resolved id is what actually gets persisted (see DonationFormState.ubigeoId).
  resolveUbigeo(department: string, province: string, district: string): void {
    this.resolvingUbigeo.set(true);
    this.#api.searchUbigeo(department, province, district).subscribe({
      next: (result) => {
        this.ubigeoId.set(result.id);
        this.resolvingUbigeo.set(false);
      },
      error: () => {
        this.ubigeoId.set(null);
        this.resolvingUbigeo.set(false);
      },
    });
  }

  resetUbigeo(): void {
    this.ubigeoId.set(null);
  }
}
