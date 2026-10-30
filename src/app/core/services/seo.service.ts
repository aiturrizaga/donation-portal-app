import { DOCUMENT, isPlatformServer } from '@angular/common';
import { inject, Injectable, PLATFORM_ID, REQUEST } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';

export interface SeoData {
  title: string;
  description: string;
  /** URL absoluta — los bots de las redes no resuelven rutas relativas. */
  imageUrl: string | null;
  siteName: string;
  noIndex: boolean;
}

/**
 * Título y metatags para buscadores y para la vista previa al compartir el
 * link (Open Graph: Facebook/WhatsApp/LinkedIn; Twitter Cards: X). Los bots
 * de las redes no ejecutan JavaScript: leen el HTML que devuelve el SSR, por
 * eso esto debe aplicarse durante el render en el servidor (las rutas del
 * portal se renderizan con RenderMode.Server).
 */
@Injectable({ providedIn: 'root' })
export class SeoService {
  readonly #meta = inject(Meta);
  readonly #title = inject(Title);
  readonly #document = inject(DOCUMENT);
  readonly #isServer = isPlatformServer(inject(PLATFORM_ID));
  readonly #request = inject(REQUEST, { optional: true });

  apply(data: SeoData): void {
    const url = this.#currentUrl();
    const description = data.description.trim();

    this.#title.setTitle(data.title);
    this.#name('description', description);
    this.#name('robots', data.noIndex ? 'noindex, nofollow' : 'index, follow');

    this.#property('og:type', 'website');
    this.#property('og:locale', 'es_PE');
    this.#property('og:site_name', data.siteName);
    this.#property('og:title', data.title);
    this.#property('og:description', description);
    this.#property('og:url', url);
    this.#property('og:image', data.imageUrl);
    this.#property(
      'og:image:secure_url',
      data.imageUrl?.startsWith('https:') ? data.imageUrl : null,
    );
    this.#property('og:image:alt', data.imageUrl ? data.title : null);

    this.#name('twitter:card', data.imageUrl ? 'summary_large_image' : 'summary');
    this.#name('twitter:title', data.title);
    this.#name('twitter:description', description);
    this.#name('twitter:image', data.imageUrl);

    this.#canonical(url);
  }

  #name(name: string, content: string | null): void {
    if (content) this.#meta.updateTag({ name, content });
    else this.#meta.removeTag(`name="${name}"`);
  }

  #property(property: string, content: string | null): void {
    if (content) this.#meta.updateTag({ property, content });
    else this.#meta.removeTag(`property="${property}"`);
  }

  #canonical(url: string | null): void {
    const head = this.#document.head;
    let link = head.querySelector<HTMLLinkElement>("link[rel='canonical']");
    if (!url) {
      link?.remove();
      return;
    }
    if (!link) {
      link = this.#document.createElement('link');
      link.setAttribute('rel', 'canonical');
      head.appendChild(link);
    }
    link.setAttribute('href', url);
  }

  // URL pública de la página, sin query string (?utm_..., ?email=...): así
  // todas las variantes del link comparten el mismo preview y canonical.
  #currentUrl(): string | null {
    const href = this.#isServer ? this.#request?.url : this.#document.location?.href;
    if (!href) return null;
    try {
      const url = new URL(href);
      // Detrás de nginx/ingress el SSR recibe http:// — los dominios públicos
      // del portal se sirven siempre por https.
      if (url.hostname !== 'localhost') url.protocol = 'https:';
      return `${url.origin}${url.pathname}`;
    } catch {
      return null;
    }
  }
}
