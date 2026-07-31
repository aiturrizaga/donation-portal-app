import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DonationStore } from '../../store/donation.store';
import { TitleCasePipe } from '@angular/common';
import { getCurrencySymbol } from '@shared/utils/currency.util';
import { Spinner } from '@shared/ui/spinner/spinner';
import { CulqiCheckoutService } from '../../payment/culqi-checkout.service';
import { DonationGateway, DonationSubmitResponse } from '../../models/donation.model';

@Component({
  selector: 'app-donation-step3',
  imports: [FormsModule, TitleCasePipe, Spinner],
  templateUrl: './donation-step3.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DonationStep3 {
  readonly store = inject(DonationStore);
  readonly #culqiCheckout = inject(CulqiCheckoutService);
  protected readonly getCurrencySymbol = getCurrencySymbol;

  readonly state = computed(() => this.store.formState());
  readonly config = computed(() => this.store.formConfig());
  readonly page = computed(() => this.store.page());

  readonly privacyAccepted = computed(() => this.state().privacyPolicy);

  // Distinct from store.submitting() (which covers the backend call) —
  // this covers the SDK-load + Culqi modal window, before we ever touch
  // our own API. Also reused for the brief gap before a Culqi3DS challenge
  // modal appears, for the same reason. Kept local: no other component
  // needs to know about it.
  readonly openingCheckout = signal(false);

  constructor() {
    // Fires once the backend reports a donation as "requires_3ds" (set by
    // #submitToBackend below). Reading it here rather than branching
    // inside the submit() subscribe callback keeps the store the single
    // source of truth for "what happened to the last submission", instead
    // of this component tracking its own parallel copy.
    effect(() => {
      const pending = this.store.pendingConfirmation();
      console.log('[3DS debug] pendingConfirmation effect fired:', pending);
      if (pending) {
        this.store.clearPendingConfirmation();
        this.#run3DSChallenge(pending);
      }
    });
  }

  getTargetName(): string {
    const id = this.state().targetId;
    if (!id) return 'Ninguno';
    return this.config()?.targets.find((t) => t.id === id)?.name ?? 'Ninguno';
  }

  getDefaultGateway(): DonationGateway | null {
    return this.config()?.gateways.find((g) => g.isDefault) ?? this.config()?.gateways[0] ?? null;
  }

  togglePrivacy(value: boolean): void {
    this.store.updateForm({ privacyPolicy: value });
  }

  submit(): void {
    if (!this.state().privacyPolicy) return;

    // A previous attempt failed (declined/error) and the donor is trying
    // again — reopening Culqi checkout always produces a brand new token,
    // so this is genuinely a new attempt, not a replay of the failed one.
    // See PAYMENTS_ARCHITECTURE.md §8 Capa 0 for why the key must change here.
    if (this.store.submitError()) {
      this.#culqiCheckout.resetIdempotencyKey();
    }

    const paymentMethod = this.state().paymentMethod;
    if (paymentMethod === 'pago_efectivo') {
      // No Culqi interaction needed client-side — the backend creates the
      // deferred order itself using the donor data already submitted.
      this.#submitToBackend();
      return;
    }

    this.#openCulqiCheckoutForCard();
  }

  #openCulqiCheckoutForCard(): void {
    const gateway = this.getDefaultGateway();
    const page = this.page();
    if (!gateway || !page) {
      this.store.setPaymentError('Esta página no tiene un método de pago configurado.');
      return;
    }

    this.openingCheckout.set(true);
    this.#culqiCheckout
      .openForCard(
        gateway,
        this.state().amount ?? 0,
        this.state().currency,
        page.organizationName,
        this.state().email,
      )
      .subscribe(async (result) => {
        switch (result.kind) {
          case 'token': {
            // Culqi3DS.generateDevice() — antifraud_details on every card
            // charge, not only ones that end up needing 3DS. Awaited here
            // (still under openingCheckout) rather than fired-and-forgotten,
            // since the backend call right after needs it.
            const deviceId = await this.#culqiCheckout.generateDeviceId(gateway);
            this.openingCheckout.set(false);
            this.store.updateForm({
              culqiToken: result.token,
              gatewayId: gateway.id,
              culqiDeviceId: deviceId,
            });
            this.#submitToBackend();
            break;
          }
          case 'cancelled':
            // Donor closed the checkout without completing — not an
            // error, just return to a submittable idle state.
            this.openingCheckout.set(false);
            break;
          case 'error':
            this.openingCheckout.set(false);
            this.store.setPaymentError(result.message);
            break;
        }
      });
  }

  #submitToBackend(): void {
    const idempotencyKey = this.#culqiCheckout.getOrCreateIdempotencyKey();
    this.store.submit(idempotencyKey);
  }

  #run3DSChallenge(pending: DonationSubmitResponse): void {
    const gateway = this.getDefaultGateway();
    const token = this.state().culqiToken;
    const paymentAttemptId = pending.paymentAttemptId;
    console.log('[3DS debug] run3DSChallenge guard:', {
      gateway: !!gateway,
      token,
      paymentAttemptId,
    });
    if (!gateway || !token || !paymentAttemptId) {
      this.store.setPaymentError('No pudimos completar la verificación de tu tarjeta.');
      return;
    }

    this.openingCheckout.set(true);
    this.#culqiCheckout
      .runChallenge(gateway, token, this.state().amount ?? 0, this.state().currency, this.state().email)
      .subscribe((result) => {
        console.log('[3DS debug] runChallenge resolved with:', result);
        this.openingCheckout.set(false);

        if (result.kind === 'error') {
          this.store.setPaymentError(result.message);
          this.store.reportFailed3ds(pending.donationId, paymentAttemptId, result.message);
          return;
        }

        this.store.confirm3ds({
          donationId: pending.donationId,
          paymentAttemptId,
          culqiToken: token,
          deviceFingerPrintId: this.state().culqiDeviceId,
          authentication3ds: result.parameters3DS,
        });
      });
  }

  back(): void {
    this.store.prevStep();
  }
}
