import { Component, computed, inject, input, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { DonationStore } from '../../store/donation.store';
import { DonationApi } from '../../api/donation.api';
import { IdentityVerifyResponse, UbigeoItem } from '../../models/donation.model';

const DOCUMENT_TYPES = [
  { label: 'DNI', value: 'dni' },
  { label: 'RUC', value: 'ruc' },
  { label: 'CE', value: 'ce' },
  { label: 'Pasaporte', value: 'passport' },
];

@Component({
  selector: 'app-donation-step2',
  imports: [ReactiveFormsModule, FormsModule],
  templateUrl: './donation-step2.html',
})
export class DonationStep2 implements OnInit {
  readonly store = input.required<InstanceType<typeof DonationStore>>();
  readonly #api = inject(DonationApi);
  readonly #fb = inject(FormBuilder);

  readonly documentTypes = DOCUMENT_TYPES;
  readonly verifying = signal(false);
  readonly verified = signal<IdentityVerifyResponse | null>(null);
  readonly verifyError = signal(false);

  readonly departments = signal<UbigeoItem[]>([]);
  readonly provinces = signal<UbigeoItem[]>([]);
  readonly districts = signal<UbigeoItem[]>([]);
  readonly loadingProvinces = signal(false);
  readonly loadingDistricts = signal(false);

  get isIndividual(): boolean {
    const dt = this.form.controls.documentType.value;
    return dt === 'dni' || dt === 'ce' || dt === 'passport';
  }

  readonly form = this.#fb.group({
    documentType: this.#fb.control('dni', { nonNullable: true }),
    documentNumber: this.#fb.control('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(6)],
    }),
    firstName: this.#fb.control(''),
    lastName: this.#fb.control(''),
    businessName: this.#fb.control(''),
    email: this.#fb.control('', {
      nonNullable: true,
      validators: [Validators.required, Validators.email],
    }),
    phone: this.#fb.control(''),
    address: this.#fb.control(''),
    country: this.#fb.control('PE', { nonNullable: true }),
    department: this.#fb.control(''),
    province: this.#fb.control(''),
    district: this.#fb.control(''),
  });

  constructor() {
    // Auto-verify DNI/RUC after typing
    this.form.controls.documentNumber.valueChanges
      .pipe(debounceTime(600), distinctUntilChanged(), takeUntilDestroyed())
      .subscribe(() => this._tryVerify());

    // Reset verification when doc type changes
    this.form.controls.documentType.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => {
      this.verified.set(null);
      this.verifyError.set(false);
      this.form.controls.documentNumber.reset('');
      this.form.controls.firstName.reset('');
      this.form.controls.lastName.reset('');
      this.form.controls.businessName.reset('');
      this.form.controls.address.reset('');
      this.form.controls.department.reset('');
      this.form.controls.province.reset('');
      this.form.controls.district.reset('');
      this.provinces.set([]);
      this.districts.set([]);
    });

    // Load provinces when department changes
    this.form.controls.department.valueChanges.pipe(takeUntilDestroyed()).subscribe((dept) => {
      this.form.controls.province.reset('');
      this.form.controls.district.reset('');
      this.provinces.set([]);
      this.districts.set([]);
      if (dept && this.form.controls.country.value === 'PE') {
        this._loadProvinces(dept);
      }
    });

    // Load districts when province changes
    this.form.controls.province.valueChanges.pipe(takeUntilDestroyed()).subscribe((prov) => {
      this.form.controls.district.reset('');
      this.districts.set([]);
      if (prov) this._loadDistricts(prov);
    });
  }

  ngOnInit(): void {
    // Patch from store state
    const s = this.store().formState();
    this.form.patchValue({
      documentType: s.documentType,
      documentNumber: s.documentNumber,
      firstName: s.firstName ?? '',
      lastName: s.lastName ?? '',
      businessName: s.businessName ?? '',
      email: s.email,
      phone: s.phone ?? '',
      address: s.address ?? '',
      country: s.country,
      department: s.department ?? '',
      province: s.province ?? '',
      district: s.district ?? '',
    });
    this._loadDepartments();
  }

  private _tryVerify(): void {
    const docType = this.form.controls.documentType.value;
    const docNumber = this.form.controls.documentNumber.value.trim();

    if (docType === 'ce' || docType === 'passport') return;

    const minLen = docType === 'dni' ? 8 : 11;
    if (docNumber.length < minLen) return;

    this.verifying.set(true);
    this.verified.set(null);
    this.verifyError.set(false);

    this.#api.verifyIdentity(docType, docNumber).subscribe({
      next: (result) => {
        this.verifying.set(false);
        this.verified.set(result);

        if (result.verified) {
          if (result.firstName) this.form.controls.firstName.setValue(result.firstName);
          if (result.lastName) this.form.controls.lastName.setValue(result.lastName);
          if (result.businessName) this.form.controls.businessName.setValue(result.businessName);
          if (result.address) this.form.controls.address.setValue(result.address);
          if (result.ubigeoDepart) this.form.controls.department.setValue(result.ubigeoDepart);
          if (result.ubigeoProv) this.form.controls.province.setValue(result.ubigeoProv);
          if (result.ubigeoDist) this.form.controls.district.setValue(result.ubigeoDist);
        }
      },
      error: () => {
        this.verifying.set(false);
        this.verifyError.set(true);
      },
    });
  }

  private _loadDepartments(): void {
    this.#api.getDepartments().subscribe((data) => this.departments.set(data));
  }

  private _loadProvinces(dept: string): void {
    this.loadingProvinces.set(true);
    this.#api
      .getProvinces(dept)
      .pipe()
      .subscribe({
        next: (data) => {
          this.provinces.set(data);
          this.loadingProvinces.set(false);
        },
        error: () => this.loadingProvinces.set(false),
      });
  }

  private _loadDistricts(prov: string): void {
    this.loadingDistricts.set(true);
    this.#api.getDistricts(prov).subscribe({
      next: (data) => {
        this.districts.set(data);
        this.loadingDistricts.set(false);
      },
      error: () => this.loadingDistricts.set(false),
    });
  }

  canProceed(): boolean {
    const v = this.form.value;
    const hasName = this.isIndividual
      ? !!(v.firstName?.trim() && v.lastName?.trim())
      : !!v.businessName?.trim();
    return !!(v.email?.trim() && v.documentNumber?.trim() && hasName);
  }

  next(): void {
    if (!this.canProceed()) return;
    const v = this.form.getRawValue();
    this.store().updateStep2({
      documentType: v.documentType as any,
      documentNumber: v.documentNumber,
      firstName: v.firstName || null,
      lastName: v.lastName || null,
      businessName: v.businessName || null,
      email: v.email,
      phone: v.phone || null,
      address: v.address || null,
      country: v.country,
      department: v.department || null,
      province: v.province || null,
      district: v.district || null,
    });
    this.store().nextStep();
  }

  back(): void {
    this.store().prevStep();
  }
}
