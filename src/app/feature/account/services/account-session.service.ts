import { computed, inject, Injectable, PLATFORM_ID, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

const STORAGE_KEY = 'donor-account-session';

interface StoredSession {
  token: string;
  expiresAt: string;
}

/**
 * Token de sesión del donante. "Mantener sesión iniciada" → localStorage
 * (sobrevive al cierre del navegador); si no, sessionStorage. Vive por
 * dominio: cada portal de organización inicia su propia sesión. Solo existe
 * en el navegador — /mi-cuenta se renderiza en cliente (app.routes.server.ts).
 */
@Injectable({ providedIn: 'root' })
export class AccountSessionService {
  readonly #isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  readonly #session = signal<StoredSession | null>(this.#read());

  readonly token = computed(() => {
    const session = this.#session();
    if (!session) return null;
    return new Date(session.expiresAt).getTime() > Date.now() ? session.token : null;
  });
  readonly isLoggedIn = computed(() => this.token() !== null);

  save(token: string, expiresAt: string, remember: boolean): void {
    const session: StoredSession = { token, expiresAt };
    this.#session.set(session);
    if (!this.#isBrowser) return;
    try {
      this.#storages().forEach((s) => s.removeItem(STORAGE_KEY));
      (remember ? localStorage : sessionStorage).setItem(STORAGE_KEY, JSON.stringify(session));
    } catch {
      // Storage bloqueado (modo privado, cookies deshabilitadas): la sesión
      // vale solo mientras la pestaña siga abierta.
    }
  }

  clear(): void {
    this.#session.set(null);
    if (!this.#isBrowser) return;
    try {
      this.#storages().forEach((s) => s.removeItem(STORAGE_KEY));
    } catch {
      // ver save()
    }
  }

  #read(): StoredSession | null {
    if (!this.#isBrowser) return null;
    try {
      for (const storage of this.#storages()) {
        const raw = storage.getItem(STORAGE_KEY);
        if (raw) return JSON.parse(raw) as StoredSession;
      }
    } catch {
      // ver save()
    }
    return null;
  }

  #storages(): Storage[] {
    return [localStorage, sessionStorage];
  }
}
