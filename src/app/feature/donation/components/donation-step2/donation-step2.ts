import { ChangeDetectionStrategy, Component, computed, effect, inject, OnInit } from '@angular/core';
import { TitleCasePipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DonationStore } from '../../store/donation.store';
import { DOCUMENT_TYPES } from '../../models/donation.model';
import { IdentityVerificationFacade } from '../../facade/identity-verification.facade';
import { Spinner } from '@shared/ui/spinner/spinner';
import { InlineError } from '@shared/ui/inline-error/inline-error';
import { getFieldError } from '@shared/utils/form-validation.util';
import { TextField } from '@shared/ui/text-field/text-field';

@Component({
  selector: 'app-donation-step2',
  imports: [ReactiveFormsModule, Spinner, InlineError, TextField, TitleCasePipe],
  templateUrl: './donation-step2.html',
  providers: [IdentityVerificationFacade],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DonationStep2 implements OnInit {
  readonly store = inject(DonationStore);
  readonly identity = inject(IdentityVerificationFacade);
  readonly #fb = inject(FormBuilder);

  readonly documentTypes = DOCUMENT_TYPES;
  protected readonly getFieldError = getFieldError;

  get isIndividual(): boolean {
    const dt = this.form.controls.documentType.value;
    return dt === 'dni' || dt === 'ce' || dt === 'passport';
  }

  // Only recurring donations ever reach Culqi's POST /customers (a
  // one-time card charge never sends the address at all) — and Culqi
  // rejects that call outright if address is missing or too short
  // (confirmed live 2026-07-28: "El campo 'address' es inválido o está
  // vacío. El valor debe ser de menos de 100 caracteres, y más de 5.").
  // Required + validated here so the donor finds out before submitting,
  // instead of the backend having to silently substitute a fallback.
  readonly isRecurring = computed(() => this.store.formState().donationType === 'recurring');

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
    // Reactive forms directives warn if [disabled] is set via template
    // binding on a formControlName element — the DOM and the control's own
    // disabled state can drift apart that way. Driving it from the control
    // itself instead. emitEvent:false so this doesn't re-trigger the
    // valueChanges subscriptions below (which already own reset/reload).
    effect(() => {
      const hasProvinces = this.identity.provinces().length > 0;
      if (hasProvinces) this.form.controls.province.enable({ emitEvent: false });
      else this.form.controls.province.disable({ emitEvent: false });
    });
    effect(() => {
      const hasDistricts = this.identity.districts().length > 0;
      if (hasDistricts) this.form.controls.district.enable({ emitEvent: false });
      else this.form.controls.district.disable({ emitEvent: false });
    });

    // See isRecurring's comment above for why this is conditional rather
    // than always-required — a one-time donation never sends address to
    // Culqi at all, so forcing it there would be friction with no payoff.
    effect(() => {
      const control = this.form.controls.address;
      if (this.isRecurring()) {
        control.setValidators([Validators.required, Validators.minLength(6)]);
      } else {
        control.clearValidators();
      }
      control.updateValueAndValidity({ emitEvent: false });
    });

    // Autofill the form as soon as the identity facade resolves a verified match
    effect(() => {
      const result = this.identity.verified();
      if (!result?.verified) return;

      if (result.firstName) this.form.controls.firstName.setValue(result.firstName);
      if (result.lastName) this.form.controls.lastName.setValue(result.lastName);
      if (result.businessName) this.form.controls.businessName.setValue(result.businessName);
      if (result.address) this.form.controls.address.setValue(result.address);
      if (result.department) this.form.controls.department.setValue(result.department);
      if (result.province) this.form.controls.province.setValue(result.province);
      if (result.district) this.form.controls.district.setValue(result.district);
    });

    // Auto-verify DNI/RUC after typing
    this.form.controls.documentNumber.valueChanges
      .pipe(debounceTime(600), distinctUntilChanged(), takeUntilDestroyed())
      .subscribe(() =>
        this.identity.verify(
          this.form.controls.documentType.value,
          this.form.controls.documentNumber.value.trim(),
        ),
      );

    // Reset verification when doc type changes
    this.form.controls.documentType.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => {
      this.identity.resetVerification();
      this.identity.resetProvinces();
      this.form.controls.documentNumber.reset('');
      this.form.controls.firstName.reset('');
      this.form.controls.lastName.reset('');
      this.form.controls.businessName.reset('');
      this.form.controls.address.reset('');
      this.form.controls.department.reset('');
      this.form.controls.province.reset('');
      this.form.controls.district.reset('');
      this.identity.resetUbigeo();
    });

    // Load provinces when department changes
    this.form.controls.department.valueChanges.pipe(takeUntilDestroyed()).subscribe((dept) => {
      this.form.controls.province.reset('');
      this.form.controls.district.reset('');
      this.identity.resetProvinces();
      this.identity.resetUbigeo();
      if (dept && this.form.controls.country.value === 'PE') {
        this.identity.loadProvinces(dept);
      }
    });

    // Load districts when province changes
    this.form.controls.province.valueChanges.pipe(takeUntilDestroyed()).subscribe((prov) => {
      this.form.controls.district.reset('');
      this.identity.resetDistricts();
      this.identity.resetUbigeo();
      const dept = this.form.controls.department.value;
      if (prov && dept) this.identity.loadDistricts(dept, prov);
    });

    // Once all three are picked, resolve the ubigeo id — this is what
    // actually gets submitted (see next()), never the raw names.
    this.form.controls.district.valueChanges.pipe(takeUntilDestroyed()).subscribe((dist) => {
      this.identity.resetUbigeo();
      const dept = this.form.controls.department.value;
      const prov = this.form.controls.province.value;
      if (dist && dept && prov) this.identity.resolveUbigeo(dept, prov, dist);
    });
  }

  ngOnInit(): void {
    // Patch from store state
    const s = this.store.formState();
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
    this.identity.loadDepartments();
  }

  canProceed(): boolean {
    const v = this.form.value;
    const hasName = this.isIndividual
      ? !!(v.firstName?.trim() && v.lastName?.trim())
      : !!v.businessName?.trim();
    const addressOk = !this.isRecurring() || (v.address?.trim().length ?? 0) >= 6;
    return !!(v.email?.trim() && v.documentNumber?.trim() && hasName) && addressOk;
  }

  next(): void {
    if (!this.canProceed()) return;
    const v = this.form.getRawValue();
    this.store.updateForm({
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
      ubigeoId: this.identity.ubigeoId(),
    });
    this.store.nextStep();
  }

  back(): void {
    this.store.prevStep();
  }

  retryVerification(): void {
    this.identity.verify(
      this.form.controls.documentType.value,
      this.form.controls.documentNumber.value.trim(),
    );
  }
}
