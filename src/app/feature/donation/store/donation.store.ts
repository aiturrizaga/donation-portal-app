import { computed, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import {
  catchError,
  EMPTY,
  finalize,
  interval,
  pipe,
  startWith,
  switchMap,
  take,
  takeWhile,
  tap,
} from 'rxjs';
import { DonationApi } from '../api/donation.api';
import {
  DonationFormState,
  DonationPage,
  DonationSubmitResponse,
  INITIAL_FORM_STATE,
} from '../models/donation.model';

type DonationStep = 1 | 2 | 3 | 'success' | 'error';

// A recurring card subscription's first charge is confirmed asynchronously
// by Culqi's webhook, not in POST /donations's own synchronous response —
// confirmed live 2026-07-28 that the webhook typically lands well within a
// minute. Polling this long, at this interval, lets most donors see the real
// success screen instead of the "we'll email you" fallback, without keeping
// the ones whose webhook is slow waiting much longer than they already would.
const CONFIRMATION_POLL_INTERVAL_MS = 3000;
const CONFIRMATION_POLL_MAX_ATTEMPTS = 20; // ~60s total

export interface Confirm3DSArgs {
  donationId: string;
  paymentAttemptId: string;
  culqiToken: string;
  deviceFingerPrintId: string | null;
  authentication3ds: {
    eci: string;
    xid: string;
    cavv: string;
    protocolVersion: string;
    directoryServerTransactionId: string;
  };
}

interface DonationState {
  page: DonationPage | null;
  step: DonationStep;
  formState: DonationFormState;
  submitting: boolean;
  submitResult: DonationSubmitResponse | null;
  submitError: string | null;
  direction: 'forward' | 'backward';
  // Set when the backend reports status "requires_3ds" — the donor has a
  // real token but needs to clear a Culqi3DS challenge before the charge
  // can be decided. donation-step3.ts watches this to kick off the
  // challenge; it's cleared immediately once picked up (see
  // clearPendingConfirmation) so it never re-triggers on unrelated state
  // changes.
  pendingConfirmation: DonationSubmitResponse | null;
  // True while pollConfirmation() is waiting on a recurring card
  // subscription's first-charge webhook. donation-success.ts shows a loader
  // instead of the normal success content/CIP-style waiting message while
  // this is true — see PAYMENTS_ARCHITECTURE.md and pollConfirmation below.
  awaitingConfirmation: boolean;
}

const initialState: DonationState = {
  page: null,
  step: 1,
  formState: { ...INITIAL_FORM_STATE },
  submitting: false,
  submitResult: null,
  submitError: null,
  direction: 'forward',
  pendingConfirmation: null,
  awaitingConfirmation: false,
};

export const DonationStore = signalStore(
  withState(initialState),

  withComputed(({ direction, page, step, formState }) => ({
    // Queries
    formConfig: computed(() => page()?.formConfig ?? null),
    branding: computed(() => page()?.branding ?? null),
    isStep1: computed(() => step() === 1),
    isStep2: computed(() => step() === 2),
    isStep3: computed(() => step() === 3),
    isSuccess: computed(() => step() === 'success'),
    showError: computed(() => step() === 'error'),
    progressWidth: computed(() => {
      const s = step();
      if (s === 1) return '33%';
      if (s === 2) return '66%';
      return '100%';
    }),
    frequencyLabel: computed(() => {
      const freq = formState().frequency;
      if (!freq || freq === 'one_time') return 'Única vez';
      if (freq === '1') return 'Mensual';
      if (freq === '12') return 'Anual';
      // Fixed-term pledge: monthly charge for exactly `freq` months, then
      // auto-cancelled (backend: ChargeDonationUseCase.frequency_to_plan).
      // "Por N meses" — the previous "Cada N meses" read as an interval
      // ("every N months"), not a duration, which is what this actually is.
      return `Por ${freq} meses`;
    }),
    stepClass: computed(() => (direction() === 'forward' ? 'step-enter' : 'step-enter-back')),
  })),

  // Split into its own withMethods block, ahead of the one below, purely so
  // submit()'s implementation can call store.pollConfirmation(...) — NgRx
  // SignalStore types `store` in a withMethods factory as everything defined
  // in EARLIER blocks only, never siblings within the same object literal.
  withMethods((store, api = inject(DonationApi)) => ({
    // Polls GET .../donations/{id}/status every few seconds for up to
    // CONFIRMATION_POLL_MAX_ATTEMPTS tries, waiting for a recurring
    // subscription's first charge to be confirmed by Culqi's webhook
    // (ProcessWebhookUseCase._handle_possible_renewal). Stops as soon as
    // the status moves off "processing"; if the window runs out first,
    // awaitingConfirmation just drops back to false and the donor sees the
    // existing "we'll email you" fallback (submitResult is left as-is).
    pollConfirmation: rxMethod<string>(
      pipe(
        switchMap((donationId) =>
          interval(CONFIRMATION_POLL_INTERVAL_MS).pipe(
            startWith(0),
            take(CONFIRMATION_POLL_MAX_ATTEMPTS),
            switchMap(() => api.getStatus(donationId)),
            tap((result) => {
              if (result.status !== 'processing') {
                patchState(store, { submitResult: result });
              }
            }),
            takeWhile((result) => result.status === 'processing'),
            catchError(() => EMPTY),
            finalize(() => patchState(store, { awaitingConfirmation: false })),
          ),
        ),
      ),
    ),
  })),

  withMethods((store, api = inject(DonationApi)) => ({
    // Commands

    // Receives the already-resolved page and seeds form defaults
    init(page: DonationPage): void {
      const fc = page.formConfig;
      patchState(store, {
        page,
        formState: {
          ...INITIAL_FORM_STATE,
          currency: fc?.currencyDefault ?? 'PEN',
          amount: fc?.amountDefault ?? null,
          donationType: 'one_time',
          frequency: fc?.frequencyDefault === 'one_time' ? null : (fc?.frequencyDefault ?? null),
          targetId: fc?.targets.find((t) => t.isDefault)?.id ?? null,
          gatewayId: fc?.gateways.find((g) => g.isDefault)?.id ?? null,
        },
      });
    },

    updateForm(partial: Partial<DonationFormState>): void {
      patchState(store, { formState: { ...store.formState(), ...partial } });
    },

    nextStep(): void {
      const current = store.step();
      if (current === 1) patchState(store, { step: 2, direction: 'forward' });
      else if (current === 2) patchState(store, { step: 3, direction: 'forward' });
    },

    prevStep(): void {
      const current = store.step();
      if (current === 2) patchState(store, { step: 1, direction: 'backward' });
      else if (current === 3) patchState(store, { step: 2, direction: 'backward' });
    },

    // idempotencyKey comes from CulqiCheckoutService.getOrCreateIdempotencyKey()
    // (donation-step3.ts) — the store itself stays payment-provider-agnostic,
    // it just forwards whatever key the caller already resolved.
    submit: rxMethod<string>(
      pipe(
        tap(() => patchState(store, { submitting: true, submitError: null })),
        switchMap((idempotencyKey) => {
          const page = store.page();
          if (!page) return EMPTY;
          return api.submit(page.id, store.formState(), idempotencyKey).pipe(
            tap((result) => {
              // A declined/failed charge is still an HTTP 200 (a valid
              // business outcome, not a server error) — the response
              // status field, not the HTTP status code, decides whether
              // this is a success or failure screen. Confirmed missing
              // during live verification 2026-07-23: a declined charge was
              // silently shown as a success screen with no certificate.
              if (result.status === 'failed') {
                patchState(store, {
                  submitting: false,
                  submitError: 'Tu banco no aprobó el pago. Intenta con otra tarjeta.',
                  step: 'error',
                });
                return;
              }
              // Not resolved yet — the donor still has to clear a Culqi3DS
              // challenge. Stays on step 3; donation-step3.ts's effect on
              // pendingConfirmation() drives the next step, not this pipe.
              if (result.status === 'requires_3ds') {
                patchState(store, { submitting: false, pendingConfirmation: result });
                return;
              }
              patchState(store, { submitting: false, submitResult: result, step: 'success' });
              // Recurring card subscription, first charge not yet confirmed
              // (no paymentCode — that's only ever set for PagoEfectivo,
              // which has nothing to poll for since it's genuinely deferred).
              if (result.status === 'processing' && !result.paymentCode) {
                patchState(store, { awaitingConfirmation: true });
                store.pollConfirmation(result.donationId);
              }
            }),
            catchError((err) => {
              const message = err?.error?.message ?? 'Ocurrió un error al procesar el pago.';
              patchState(store, { submitting: false, submitError: message, step: 'error' });
              return EMPTY;
            }),
          );
        }),
      ),
    ),

    // Called by donation-step3.ts once the donor completes the Culqi3DS
    // challenge for a donation left at pendingConfirmation.
    confirm3ds: rxMethod<Confirm3DSArgs>(
      pipe(
        tap(() => patchState(store, { submitting: true, submitError: null })),
        switchMap((args) =>
          api
            .confirm3ds(
              args.donationId,
              args.paymentAttemptId,
              args.culqiToken,
              args.deviceFingerPrintId,
              args.authentication3ds,
            )
            .pipe(
              tap((result) => {
                if (result.status === 'failed') {
                  patchState(store, {
                    submitting: false,
                    submitError: 'Tu banco no aprobó el pago. Intenta con otra tarjeta.',
                    step: 'error',
                  });
                  return;
                }
                patchState(store, { submitting: false, submitResult: result, step: 'success' });
              }),
              catchError((err) => {
                const message = err?.error?.message ?? 'Ocurrió un error al procesar el pago.';
                patchState(store, { submitting: false, submitError: message, step: 'error' });
                return EMPTY;
              }),
            ),
        ),
      ),
    ),

    clearPendingConfirmation(): void {
      patchState(store, { pendingConfirmation: null });
    },

    retryPayment(): void {
      patchState(store, { step: 3, submitError: null });
    },

    // Used for a failure that happens BEFORE the backend is ever called —
    // Culqi Checkout itself declining/erroring on tokenization. Routed
    // through the same error step as a backend-side failure so the UI
    // doesn't need two different failure presentations.
    setPaymentError(message: string): void {
      patchState(store, { submitting: false, submitError: message, step: 'error' });
    },

    // Called alongside setPaymentError whenever a Culqi3DS challenge fails
    // client-side (timeout, error, or the widget crashing) — the donor
    // already sees the error from setPaymentError, so this is purely
    // best-effort bookkeeping: it tells the backend the attempt is over so
    // the donation resolves out of "requires_3ds" instead of staying
    // "pending" forever (see PortalDonationService.fail_3ds). A network
    // failure here doesn't change what the donor sees, so it's swallowed
    // rather than surfaced — retrying or blocking the UI on it would only
    // confuse a donor who has already been told their payment failed.
    reportFailed3ds(donationId: string, paymentAttemptId: string, reason: string): void {
      api.fail3ds(donationId, paymentAttemptId, reason).subscribe({ error: () => {} });
    },

    resetForm(): void {
      patchState(store, { ...initialState });
    },
  })),
);
