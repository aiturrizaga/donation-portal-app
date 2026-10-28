import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { interval } from 'rxjs';
import { AccountApi, otpErrorMessage, toAccountApiError } from '../../api/account.api';
import { DonorAccount } from '../../models/account.model';
import { TextField } from '@shared/ui/text-field/text-field';
import { OtpInput } from '@shared/ui/otp-input/otp-input';
import { Spinner } from '@shared/ui/spinner/spinner';
import { maskEmail } from '../../utils/mask-email';

/**
 * Correos vinculados a la cuenta. Agregar uno exige el OTP enviado a ESE
 * correo (prueba que es del donante); si ya era de otra cuenta, el backend
 * las fusiona y avisa a todos los correos.
 */
@Component({
  selector: 'app-account-emails',
  imports: [ReactiveFormsModule, TextField, OtpInput, Spinner],
  templateUrl: './account-emails.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccountEmails {
  readonly account = input.required<DonorAccount>();
  readonly accountChange = output<DonorAccount>();

  readonly #api = inject(AccountApi);

  protected readonly mode = signal<'idle' | 'email' | 'code'>('idle');
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly notice = signal<string | null>(null);
  protected readonly code = signal('');
  protected readonly resendIn = signal(0);
  protected readonly pendingEmail = signal('');
  protected readonly busyEmail = signal<string | null>(null);
  protected readonly maskEmail = maskEmail;

  private readonly otpInput = viewChild(OtpInput);

  protected readonly form = inject(FormBuilder).nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
  });

  constructor() {
    interval(1000)
      .pipe(takeUntilDestroyed(inject(DestroyRef)))
      .subscribe(() => {
        if (this.resendIn() > 0) this.resendIn.update((s) => s - 1);
      });
  }

  startAdd(): void {
    this.form.reset();
    this.error.set(null);
    this.notice.set(null);
    this.mode.set('email');
  }

  cancel(): void {
    this.mode.set('idle');
    this.error.set(null);
  }

  sendCode(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const email = this.form.controls.email.value.trim().toLowerCase();
    if (this.account().emails.some((e) => e.email.toLowerCase() === email)) {
      this.error.set('Ese correo ya está vinculado a tu cuenta.');
      return;
    }
    this.busy.set(true);
    this.error.set(null);
    this.#api.addEmail(email).subscribe({
      next: (res) => {
        this.busy.set(false);
        this.pendingEmail.set(email);
        this.code.set('');
        this.resendIn.set(res.resendAfterSeconds ?? 60);
        this.mode.set('code');
      },
      error: (err) => {
        this.busy.set(false);
        this.error.set(otpErrorMessage(toAccountApiError(err)));
      },
    });
  }

  verify(code = this.code()): void {
    if (code.length !== 6 || this.busy()) return;
    this.busy.set(true);
    this.error.set(null);
    this.#api.verifyEmail(this.pendingEmail(), code).subscribe({
      next: (account) => {
        this.busy.set(false);
        this.mode.set('idle');
        this.notice.set(
          `Vinculamos ${this.pendingEmail()}. Sus donaciones ya aparecen en tu cuenta.`,
        );
        this.accountChange.emit(account);
      },
      error: (err) => {
        this.busy.set(false);
        this.error.set(otpErrorMessage(toAccountApiError(err)));
        this.otpInput()?.clear();
      },
    });
  }

  setPrimary(email: string): void {
    this.#runOnEmail(
      email,
      this.#api.setPrimaryEmail(email),
      'No se pudo cambiar el correo principal.',
    );
  }

  remove(email: string): void {
    const ok = confirm(
      `¿Quitar ${email} de tu cuenta? Dejarás de ver las donaciones hechas con ese correo.`,
    );
    if (!ok) return;
    this.#runOnEmail(email, this.#api.removeEmail(email), 'No se pudo quitar el correo.');
  }

  #runOnEmail(
    email: string,
    request: ReturnType<AccountApi['setPrimaryEmail']>,
    fallback: string,
  ): void {
    if (this.busyEmail()) return;
    this.busyEmail.set(email);
    this.error.set(null);
    this.notice.set(null);
    request.subscribe({
      next: (account) => {
        this.busyEmail.set(null);
        this.accountChange.emit(account);
      },
      error: (err) => {
        this.busyEmail.set(null);
        const apiError = toAccountApiError(err);
        this.error.set(
          apiError.code === 'last_email' ? 'Tu cuenta debe tener al menos un correo.' : fallback,
        );
      },
    });
  }
}
