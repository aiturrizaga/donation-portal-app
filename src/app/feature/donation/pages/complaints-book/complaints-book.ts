import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { PortalSystemLayout } from '@core/layouts/portal-system-layout/portal-system-layout';
import { DatePipe } from '@angular/common';

const DOCUMENT_TYPES = [
  { label: 'DNI', value: 'dni' },
  { label: 'RUC', value: 'ruc' },
  { label: 'CE', value: 'ce' },
  { label: 'Pasaporte', value: 'passport' },
];

@Component({
  selector: 'app-complaints-book-page',
  imports: [ReactiveFormsModule, PortalSystemLayout, DatePipe],
  templateUrl: './complaints-book.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'contents' },
})
export class ComplaintsBookPage {
  readonly #fb = inject(FormBuilder);

  readonly documentTypes = DOCUMENT_TYPES;
  readonly today = new Date();

  readonly form = this.#fb.group({
    // 2. Consumidor
    fullName: this.#fb.control('', { nonNullable: true, validators: [Validators.required] }),
    documentType: this.#fb.control('dni', { nonNullable: true }),
    documentNumber: this.#fb.control('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(6)],
    }),
    email: this.#fb.control('', {
      nonNullable: true,
      validators: [Validators.required, Validators.email],
    }),
    phone: this.#fb.control('', { nonNullable: true, validators: [Validators.required] }),
    address: this.#fb.control('', { nonNullable: true, validators: [Validators.required] }),

    // Menor de edad
    isMinor: this.#fb.control(false, { nonNullable: true }),
    guardianName: this.#fb.control(''),

    // 3. Detalle
    recordType: this.#fb.control<'reclamo' | 'queja'>('reclamo', { nonNullable: true }),
    goodType: this.#fb.control<'producto' | 'servicio'>('servicio', { nonNullable: true }),
    amount: this.#fb.control<number | null>(null),
    detail: this.#fb.control('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(10)],
    }),
    request: this.#fb.control('', { nonNullable: true, validators: [Validators.required] }),

    // Consentimiento
    dataConsent: this.#fb.control(false, {
      nonNullable: true,
      validators: [Validators.requiredTrue],
    }),
  });

  readonly isReclamo = computed(() => this.recordTypeSignal() === 'reclamo');

  // toSignal para reaccionar a cambios del tipo en el template sin getters por CD
  private readonly recordTypeSignal = toSignal(this.form.controls.recordType.valueChanges, {
    initialValue: this.form.controls.recordType.value,
  });
  private readonly isMinorSignal = toSignal(this.form.controls.isMinor.valueChanges, {
    initialValue: this.form.controls.isMinor.value,
  });

  readonly showGuardian = computed(() => this.isMinorSignal());

  selectRecordType(value: 'reclamo' | 'queja'): void {
    this.form.controls.recordType.setValue(value);
  }

  submit(): void {
    // Si es menor, el dato del apoderado es obligatorio
    if (this.form.controls.isMinor.value && !this.form.controls.guardianName.value?.trim()) {
      this.form.controls.guardianName.setErrors({ required: true });
    }

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const payload = this.form.getRawValue();
    // TODO: conectar al backend cuando exista el endpoint del libro de reclamaciones
    console.log('Reclamación a enviar:', payload);
  }
}
