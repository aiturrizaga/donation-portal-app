import { inject } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { computed } from '@angular/core';
import { catchError, EMPTY, pipe, switchMap, tap } from 'rxjs';
import { DonationApi } from '../api/donation.api';
import {
  DonationFormState,
  DonationPage,
  DonationSubmitResponse,
  INITIAL_FORM_STATE,
} from '../models/donation.model';

type DonationStep = 1 | 2 | 3 | 'success' | 'error';

interface DonationState {
  page: DonationPage | null;
  pageLoading: boolean;
  step: DonationStep;
  formState: DonationFormState;
  submitting: boolean;
  submitResult: DonationSubmitResponse | null;
  submitError: string | null;
  direction: 'forward' | 'backward';
}

const initialState: DonationState = {
  page: null,
  pageLoading: true,
  step: 1,
  formState: { ...INITIAL_FORM_STATE },
  submitting: false,
  submitResult: null,
  submitError: null,
  direction: 'forward',
};

export const DonationStore = signalStore(
  withState(initialState),

  withComputed(({ direction, page, step, formState }) => ({
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
      if (s === 3 || s === 'success' || s === 'error') return '100%';
      return '0%';
    }),
    // Derived label for frequency display
    frequencyLabel: computed(() => {
      const freq = formState().frequency;
      if (!freq || freq === 'one_time') return 'Única vez';
      if (freq === '1') return 'Mensual';
      if (freq === '12') return 'Anual';
      return `Cada ${freq} meses`;
    }),

    stepClass: computed(() => (direction() === 'forward' ? 'step-enter' : 'step-enter-back')),
  })),

  withMethods((store, api = inject(DonationApi)) => ({
    loadPage: rxMethod<string>(
      pipe(
        tap(() => patchState(store, { pageLoading: true })),
        switchMap((slug) =>
          api.getPage(slug).pipe(
            tap((page) => {
              // Set defaults from form config
              const fc = page.formConfig;
              patchState(store, {
                page,
                pageLoading: false,
                formState: {
                  ...INITIAL_FORM_STATE,
                  currency: fc?.currencyDefault ?? 'PEN',
                  amount: fc?.amountDefault ?? null,
                  donationType: 'one_time',
                  frequency:
                    fc?.frequencyDefault === 'one_time' ? null : (fc?.frequencyDefault ?? null),
                  targetId: fc?.targets.find((t) => t.isDefault)?.id ?? null,
                  gatewayId: fc?.gateways.find((g) => g.isDefault)?.id ?? null,
                },
              });
            }),
            catchError(() => {
              patchState(store, { pageLoading: false });
              return EMPTY;
            }),
          ),
        ),
      ),
    ),

    updateStep1(partial: Partial<DonationFormState>): void {
      patchState(store, {
        formState: { ...store.formState(), ...partial },
      });
    },

    updateStep2(partial: Partial<DonationFormState>): void {
      patchState(store, {
        formState: { ...store.formState(), ...partial },
      });
    },

    goToStep(step: DonationStep): void {
      patchState(store, { step });
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

    submit: rxMethod<void>(
      pipe(
        tap(() => patchState(store, { submitting: true, submitError: null })),
        switchMap(() => {
          const page = store.page();
          if (!page) return EMPTY;
          return api.submit(page.id, store.formState()).pipe(
            tap((result) =>
              patchState(store, {
                submitting: false,
                submitResult: result,
                step: 'success',
              }),
            ),
            catchError((err) => {
              const message = err?.error?.message ?? 'Ocurrió un error al procesar el pago.';
              patchState(store, {
                submitting: false,
                submitError: message,
                step: 'error',
              });
              return EMPTY;
            }),
          );
        }),
      ),
    ),

    retryPayment(): void {
      patchState(store, {
        step: 3,
        submitError: null,
      });
    },

    resetForm(): void {
      patchState(store, { ...initialState });
    },
  })),
);
