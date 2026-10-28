import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  input,
  OnInit,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { interval } from 'rxjs';
import { AccountApi, otpErrorMessage, toAccountApiError } from '../../api/account.api';
import { AccountSessionService } from '../../services/account-session.service';
import { DonorAccount } from '../../models/account.model';
import { TextField } from '@shared/ui/text-field/text-field';
import { OtpInput } from '@shared/ui/otp-input/otp-input';
import { Spinner } from '@shared/ui/spinner/spinner';
import { maskEmail } from '../../utils/mask-email';

const DEFAULT_RESEND_SECONDS = 60;

@Component({
  selector: 'app-account-login',
  imports: [ReactiveFormsModule, TextField, OtpInput, Spinner],
  templateUrl: './account-login.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccountLogin implements OnInit {
  // Prellenado desde /mi-cuenta?email=... (enlace del correo de confirmación).
  readonly initialEmail = input<string | null>(null);
  readonly loggedIn = output<DonorAccount>();

  readonly #api = inject(AccountApi);
  readonly #session = inject(AccountSessionService);
  readonly #destroyRef = inject(DestroyRef);

  protected readonly step = signal<'email' | 'code'>('email');
  protected readonly sending = signal(false);
  protected readonly verifying = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly code = signal('');
  protected readonly resendIn = signal(0);
  protected readonly maskedEmail = computed(() => maskEmail(this.form.controls.email.value));

  private readonly otpInput = viewChild(OtpInput);

  protected readonly form = inject(FormBuilder).nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    remember: [true],
  });

  constructor() {
    interval(1000)
      .pipe(takeUntilDestroyed(this.#destroyRef))
      .subscribe(() => {
        if (this.resendIn() > 0) this.resendIn.update((s) => s - 1);
      });
  }

  ngOnInit(): void {
    const email = this.initialEmail();
    if (email) this.form.controls.email.setValue(email);
  }

  sendCode(): void {
    if (this.form.controls.email.invalid) {
      this.form.controls.email.markAsTouched();
      return;
    }
    if (this.sending()) return;
    const email = this.#email();
    this.sending.set(true);
    this.error.set(null);
    this.#api.requestOtp(email).subscribe({
      next: (res) => {
        this.sending.set(false);
        this.code.set('');
        this.resendIn.set(res.resendAfterSeconds ?? DEFAULT_RESEND_SECONDS);
        this.step.set('code');
      },
      error: (err) => {
        this.sending.set(false);
        const apiError = toAccountApiError(err);
        if (apiError.retryAfterSeconds) this.resendIn.set(apiError.retryAfterSeconds);
        this.error.set(otpErrorMessage(apiError));
      },
    });
  }

  verify(code = this.code()): void {
    if (code.length !== 6 || this.verifying()) return;
    this.verifying.set(true);
    this.error.set(null);
    const { remember } = this.form.getRawValue();
    this.#api.verifyOtp(this.#email(), code, remember).subscribe({
      next: (res) => {
        this.#session.save(res.accessToken, res.expiresAt, remember);
        this.verifying.set(false);
        this.loggedIn.emit(res.account);
      },
      error: (err) => {
        this.verifying.set(false);
        this.error.set(otpErrorMessage(toAccountApiError(err)));
        this.otpInput()?.clear();
      },
    });
  }

  changeEmail(): void {
    this.step.set('email');
    this.error.set(null);
    this.code.set('');
  }

  #email(): string {
    return this.form.controls.email.value.trim().toLowerCase();
  }
}
