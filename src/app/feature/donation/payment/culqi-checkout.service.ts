import { Injectable } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { take } from 'rxjs/operators';
import { DonationGateway } from '../models/donation.model';
import { CulqiConfig, CulqiOptions, Culqi3DSAuthParameters } from './culqi-checkout.types';
import { PaymentResult, ThreeDSChallengeResult } from './payment-result.model';

const CULQI_SCRIPT_URL = 'https://js.culqi.com/checkout-js';
const CULQI_3DS_SCRIPT_URL = 'https://3ds.culqi.com';
const IDEMPOTENCY_STORAGE_KEY = 'donation_idempotency_key';
// The Cardinal Commerce challenge iframe Culqi3DS embeds is cross-origin —
// a script error thrown inside it (confirmed live 2026-07-27 with BOTH
// 3DS-decline test cards: 4456 5300 0000 1013 "error de autenticación" and
// 4456 5300 0000 1070 "time-out") never reaches this window's own
// error/unhandledrejection listeners, since browsers don't propagate
// cross-origin frame errors to the parent. Without a bound, the donor is
// left staring at the "procesando" overlay forever with no way out. Picked
// generously (well above how long a real donor takes to receive and type
// an OTP, based on the earlier successful live test) so this only ever
// fires for a genuinely broken/hung challenge, not a slow donor.
const CHALLENGE_TIMEOUT_MS = 90_000;

/**
 * The single point of contact with Culqi in the whole app. Everything
 * outside this file works with PaymentResult (payment-result.model.ts) and
 * never touches window.Culqi, a token, or an error object shaped by Culqi
 * itself — see PAYMENTS_ARCHITECTURE.md §11 for the full design rationale.
 *
 * Culqi Custom Checkout is used deliberately, not the older CulqiJS v2/v3/v4
 * — Culqi's own documentation states those are being phased out. There is
 * no official Angular package for Custom Checkout (it's a vanilla JS
 * global), which is exactly why this wrapper exists.
 */
@Injectable({ providedIn: 'root' })
export class CulqiCheckoutService {
  #scriptLoadPromise: Promise<void> | null = null;
  #threeDsScriptLoadPromise: Promise<void> | null = null;

  /**
   * Loads js.culqi.com lazily — only when the donor actually reaches the
   * payment step, never at app bootstrap — and only once (subsequent calls
   * reuse the same promise, so reopening the checkout doesn't re-inject the
   * script tag).
   */
  #loadScript(): Promise<void> {
    if (this.#scriptLoadPromise) return this.#scriptLoadPromise;

    this.#scriptLoadPromise = new Promise<void>((resolve, reject) => {
      if (window.CulqiCheckout) {
        resolve();
        return;
      }
      const script = document.createElement('script');
      script.src = CULQI_SCRIPT_URL;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('No se pudo cargar el sistema de pago.'));
      document.head.appendChild(script);
    });

    return this.#scriptLoadPromise;
  }

  /**
   * Loads 3ds.culqi.com — a library SEPARATE from Custom Checkout, only
   * needed once our backend reports a charge as requiring a 3DS challenge.
   * Lazy for the same reason as #loadScript: most donations never need it.
   */
  #load3DSScript(): Promise<void> {
    if (this.#threeDsScriptLoadPromise) return this.#threeDsScriptLoadPromise;

    this.#threeDsScriptLoadPromise = new Promise<void>((resolve, reject) => {
      if (window.Culqi3DS) {
        resolve();
        return;
      }
      const script = document.createElement('script');
      script.src = CULQI_3DS_SCRIPT_URL;
      script.defer = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('No se pudo cargar la autenticación 3DS.'));
      document.head.appendChild(script);
    });

    return this.#threeDsScriptLoadPromise;
  }

  /**
   * Culqi3DS.generateDevice() fingerprints the browser — sent as
   * antifraud_details.device_finger_print_id on EVERY card charge (not
   * only ones that end up needing 3DS), since it's what Culqi's antifraud
   * engine uses to decide whether a challenge is required at all. Returns
   * null if the script fails to load or generation fails — the charge
   * still proceeds without it rather than blocking the donor.
   */
  async generateDeviceId(gateway: DonationGateway): Promise<string | null> {
    try {
      await this.#load3DSScript();
      const culqi3ds = window.Culqi3DS;
      console.log('[3DS debug] generateDeviceId: culqi3ds present?', !!culqi3ds);
      if (!culqi3ds) return null;
      culqi3ds.publicKey = gateway.publicKey;
      const id = await culqi3ds.generateDevice();
      console.log('[3DS debug] generateDeviceId result:', id);
      return id;
    } catch (err) {
      console.log('[3DS debug] generateDeviceId threw:', err);
      return null;
    }
  }

  /**
   * Runs a Culqi3DS challenge for a token our backend already reported as
   * needing one. Resolves once via postMessage — Culqi3DS renders its own
   * modal/iframe and posts the result back to window.location.origin (no
   * documented alternative like a returned Promise — confirmed against
   * docs.culqi.com/culqi-3ds/v1/configuracion, 2026-07-27).
   */
  runChallenge(
    gateway: DonationGateway,
    tokenId: string,
    amount: number,
    currency: string,
    donorEmail: string,
  ): Observable<ThreeDSChallengeResult> {
    const result$ = new Subject<ThreeDSChallengeResult>();

    this.#load3DSScript()
      .then(() => this.#startChallenge(gateway, tokenId, amount, currency, donorEmail, result$))
      .catch((err: Error) => {
        result$.next({ kind: 'error', message: err.message });
        result$.complete();
      });

    return result$.pipe(take(1));
  }

  #startChallenge(
    gateway: DonationGateway,
    tokenId: string,
    amount: number,
    currency: string,
    donorEmail: string,
    result$: Subject<ThreeDSChallengeResult>,
  ): void {
    const culqi3ds = window.Culqi3DS;
    console.log('[3DS debug] startChallenge: culqi3ds present?', !!culqi3ds, 'tokenId:', tokenId);
    if (!culqi3ds) {
      result$.next({ kind: 'error', message: 'El sistema de autenticación no está disponible.' });
      result$.complete();
      return;
    }

    culqi3ds.publicKey = gateway.publicKey;
    culqi3ds.options = { showModal: true, showLoading: true, showIcon: true };
    culqi3ds.settings = {
      // returnUrl isn't actually navigated to in this flow (the challenge
      // result arrives via postMessage, not a redirect) — window.location.href
      // is the closest honest value, mirroring the official demo's own use
      // of a same-origin URL here.
      charge: { totalAmount: Math.round(amount * 100), returnUrl: window.location.href },
      card: { email: donorEmail },
    };

    let settled = false;
    // Explicit `number`, not ReturnType<typeof window.setTimeout> — this
    // project's tsconfig pulls in @types/node, whose ambient NodeJS.Timeout
    // type shadows the DOM one, causing that utility-type spelling to
    // resolve to the wrong type and fail the build.
    let timeoutId: number;
    const settle = (result: ThreeDSChallengeResult): void => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeoutId);
      window.removeEventListener('message', listener);
      window.removeEventListener('error', onUncaughtError);
      window.removeEventListener('unhandledrejection', onUnhandledRejection);
      culqi3ds.reset();
      // reset() only clears Culqi3DS.settings/the token (confirmed verbatim
      // against docs.culqi.com/es/documentacion/culqi-3ds/v1/uso-libreria,
      // 2026-07-27) — it does NOT remove the modal from the DOM. The only
      // documented close hook, options.closeModalAction, is scoped
      // exclusively to the error dialog's own "aceptar" button (confirmed
      // against .../v1/configuracion the same day), never fired for a
      // successful challenge. So the library's self-injected #culqi-3ds
      // container (a Vue app mounted straight onto document.body) is left
      // orphaned on screen with no native way to dismiss it.
      //
      // HIDE it, don't remove it from the DOM — reset()'s own docs say it
      // exists precisely "para un nuevo uso" (to prepare the SAME mounted
      // instance for the NEXT charge), meaning Culqi3DS expects to be
      // reused across attempts in one page session, not remounted. Removing
      // the container (an earlier version of this fix) broke exactly that:
      // confirmed live 2026-07-27 — a donor who retried a declined card
      // without reloading the page got stuck forever on "Abriendo pago
      // seguro...", because generateDeviceId() (called on every card
      // attempt, not just 3DS ones) awaits Culqi3DS methods that never
      // resolve once their mounted root is gone. Culqi3DS's own showModal
      // option re-shows this element the next time initAuthentication()
      // runs, so hiding it here doesn't block a later challenge.
      const container = document.getElementById('culqi-3ds');
      if (container) container.style.display = 'none';
      result$.next(result);
      result$.complete();
    };

    const listener = (event: MessageEvent<unknown>): void => {
      if (event.origin !== window.location.origin) return;
      const data = event.data as
        | { loading?: boolean; parameters3DS?: unknown; error?: string }
        | null
        | undefined;
      // Same-origin postMessages aren't exclusively Culqi3DS's — browser
      // extensions (React/Vue DevTools, etc.) post their own same-origin
      // handshake messages too (e.g. {source:'react-devtools-content-script',
      // hello:true}). Without this shape check, one of those got
      // misinterpreted as "the challenge finished with an error", settling
      // and tearing down the flow (culqi3ds.reset()) before the real
      // Culqi3DS/Cardinal Commerce result ever arrived — confirmed live
      // 2026-07-27. Only react to messages that actually look like Culqi3DS.
      const looksLikeCulqi3DSMessage =
        !!data && ('loading' in data || 'parameters3DS' in data || 'error' in data);
      if (!looksLikeCulqi3DSMessage) return;
      // `loading: false` does NOT mean "finished" — confirmed live
      // 2026-07-27: Culqi3DS posts an intermediate {parameters3DS: null,
      // error: null, loading: false} right as it hands off to the actual
      // challenge UI (Cardinal Commerce's OTP step), well before the donor
      // has done anything. Treating that as a final result closed the flow
      // and missed the REAL result that arrived after the donor submitted
      // the OTP. Only a message that actually carries parameters3DS or a
      // real error is a terminal result — anything else, keep listening.
      if (!data?.parameters3DS && !data?.error) return;

      if (data?.parameters3DS) {
        settle({ kind: 'success', parameters3DS: data.parameters3DS as Culqi3DSAuthParameters });
      } else {
        settle({ kind: 'error', message: this.#friendlyErrorMessage() });
      }
    };

    // Culqi3DS's own script can throw uncaught, without ever posting a
    // result message at all — confirmed live 2026-07-27 with the "Autenticación
    // fallida por error de autenticación" test card (4456 5300 0000 1013):
    // a TypeError inside Culqi's own chunk (index-*.js), never delivered
    // through the postMessage channel the `listener` above relies on.
    // Without this safety net, `settled` never flips and the donor is left
    // staring at the "procesando" overlay forever with no error shown —
    // this is what actually resolves that case instead.
    const onUncaughtError = (): void => {
      settle({ kind: 'error', message: this.#friendlyErrorMessage() });
    };
    const onUnhandledRejection = (): void => {
      settle({ kind: 'error', message: this.#friendlyErrorMessage() });
    };

    // The real backstop — see CHALLENGE_TIMEOUT_MS above for why the
    // error/unhandledrejection listeners alone aren't enough.
    timeoutId = window.setTimeout(() => {
      settle({ kind: 'error', message: this.#friendlyErrorMessage() });
    }, CHALLENGE_TIMEOUT_MS);

    window.addEventListener('message', listener, false);
    window.addEventListener('error', onUncaughtError);
    window.addEventListener('unhandledrejection', onUnhandledRejection);

    console.log('[3DS debug] calling initAuthentication with token:', tokenId);
    culqi3ds.initAuthentication(tokenId);
    console.log('[3DS debug] initAuthentication call returned (sync)');
  }

  /**
   * Opens Culqi Custom Checkout for a card payment and resolves with the
   * outcome. Emits exactly once — token, cancelled, or error — then
   * completes. The card data itself never touches our frontend code: Culqi
   * tokenizes it directly against Culqi's own servers.
   */
  openForCard(
    gateway: DonationGateway,
    amount: number,
    currency: string,
    organizationName: string,
    donorEmail: string,
    donorFirstName?: string | null,
    donorLastName?: string | null,
  ): Observable<PaymentResult> {
    const result$ = new Subject<PaymentResult>();

    this.#loadScript()
      .then(() =>
        this.#openCheckout(
          gateway, amount, currency, organizationName, donorEmail,
          donorFirstName, donorLastName, result$,
        ),
      )
      .catch((err: Error) => {
        result$.next({ kind: 'error', message: err.message });
        result$.complete();
      });

    return result$.pipe(take(1));
  }

  #openCheckout(
    gateway: DonationGateway,
    amount: number,
    currency: string,
    organizationName: string,
    donorEmail: string,
    donorFirstName: string | null | undefined,
    donorLastName: string | null | undefined,
    result$: Subject<PaymentResult>,
  ): void {
    const CulqiCheckoutCtor = window.CulqiCheckout;
    if (!CulqiCheckoutCtor) {
      result$.next({ kind: 'error', message: 'El sistema de pago no está disponible.' });
      result$.complete();
      return;
    }

    const config: CulqiConfig = {
      settings: {
        title: organizationName,
        currency,
        amount: Math.round(amount * 100), // Culqi expects cents
      },
      client: {
        email: donorEmail,
        ...(donorFirstName ? { first_name: donorFirstName } : {}),
        ...(donorLastName ? { last_name: donorLastName } : {}),
      },
      options: {
        lang: 'es',
        installments: false,
        paymentMethods: this.#buildPaymentMethods(gateway.enabledPaymentMethods),
      },
    };

    const culqi = new CulqiCheckoutCtor(gateway.publicKey, config);
    window.Culqi = culqi;

    if (gateway.rsaId && gateway.rsaPublicKey && culqi.settingsRSAID) {
      culqi.settingsRSAID(gateway.rsaId, gateway.rsaPublicKey);
    }

    let settled = false;
    let observer: MutationObserver | undefined;

    const settle = (result: PaymentResult): void => {
      if (settled) return;
      settled = true;
      observer?.disconnect();
      result$.next(result);
      result$.complete();
    };

    culqi.culqi = () => {
      // Per Culqi's own reference implementation (docs.culqi.com/checkout/checkout-custom),
      // the merchant is responsible for calling close() — Culqi never closes the modal
      // on its own. Without this, the widget stayed open after a real successful
      // charge in Sandbox, confirmed during live verification 2026-07-23.
      culqi.close();
      if (culqi.token) {
        // A card charge always carries a brand-new Culqi token, so any
        // idempotency key persisted from a previous attempt (e.g. one that
        // survived a tab reload) would pair a stale key with a payload that
        // can never hash-match it — the backend correctly rejects that as
        // a conflict, but it's a dead end for the donor. A fresh token
        // means this is unambiguously a new attempt, so it always gets a
        // fresh key. Confirmed live 2026-07-23: reloading mid-flow reused
        // a stale key and produced a permanent 409 on retry.
        this.resetIdempotencyKey();
        settle({ kind: 'token', token: culqi.token.id });
        return;
      }
      settle({ kind: 'error', message: this.#friendlyErrorMessage() });
    };

    culqi.open();

    // Culqi documents no event for a manual close (verified against
    // docs.culqi.com/checkout/checkout-custom, 2026-07-23 — culqi.culqi()
    // only fires after a token or error, never on a bare close). Without
    // this, closing the widget left the donor's own "Abriendo pago
    // seguro..." button stuck loading forever, confirmed live the same
    // day. Detected instead by watching Culqi's own iframe leave the DOM.
    observer = new MutationObserver(() => {
      if (!document.querySelector('iframe[src*="checkoutview.culqi.com"]')) {
        settle({ kind: 'cancelled' });
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  /**
   * Builds Culqi's all-or-nothing paymentMethods flags from whatever the
   * admin panel configured for this gateway (`enabledPaymentMethods`).
   * Falls back to card-only if the list is empty/missing — the one method
   * with a verified backend integration — rather than opening a widget
   * with every tab off.
   */
  #buildPaymentMethods(enabled: string[]): CulqiOptions['paymentMethods'] {
    const methods = enabled.length ? enabled : ['tarjeta'];
    const has = (method: string): boolean => methods.includes(method);
    return {
      tarjeta: has('tarjeta'),
      yape: has('yape'),
      billetera: has('billetera'),
      bancaMovil: has('bancaMovil'),
      agente: has('agente'),
      cuotealo: has('cuotealo'),
    };
  }

  /**
   * Never surfaces Culqi's own technical error text to the donor — always a
   * short, generic, actionable message instead.
   */
  #friendlyErrorMessage(): string {
    return 'Tu banco no aprobó el pago. Intenta con otra tarjeta.';
  }

  /**
   * A donor's checkout session keeps the SAME idempotency key across every
   * retry of the same submission (double-click, refresh, a dropped
   * response) — sessionStorage survives a refresh within the tab. A
   * genuinely new attempt (different card after a decline) gets a new key,
   * since reopening the checkout is the only way to get a new token anyway
   * — see PAYMENTS_ARCHITECTURE.md §8 Capa 0.
   */
  getOrCreateIdempotencyKey(): string {
    const existing = sessionStorage.getItem(IDEMPOTENCY_STORAGE_KEY);
    if (existing) return existing;
    const generated = crypto.randomUUID();
    sessionStorage.setItem(IDEMPOTENCY_STORAGE_KEY, generated);
    return generated;
  }

  resetIdempotencyKey(): void {
    sessionStorage.removeItem(IDEMPOTENCY_STORAGE_KEY);
  }
}
