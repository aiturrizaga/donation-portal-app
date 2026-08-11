import { ChangeDetectionStrategy, Component, computed, effect, inject } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { DonationForm } from '../../components/donation-form/donation-form';
import { DonationStore } from '../../store/donation.store';
import { DonationPage } from '../../models/donation.model';
import { LegalPageApi } from '../../api/legal-page.api';
import { PortalHeader } from '@shared/ui/portal-header/portal-header';
import { PortalFooter } from '@shared/ui/portal-footer/portal-footer';
import { environment } from '@env/environment';

@Component({
  selector: 'app-donation-landing-page',
  imports: [DonationForm, PortalHeader, PortalFooter],
  providers: [DonationStore],
  templateUrl: './donation-landing.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DonationLandingPage {
  readonly #route = inject(ActivatedRoute);
  readonly #document = inject(DOCUMENT);
  readonly #legalPageApi = inject(LegalPageApi);
  readonly store = inject(DonationStore);

  // Page comes already resolved and validated by the resolver
  readonly #page = toSignal(this.#route.data.pipe(map((d) => d['page'] as DonationPage)), {
    initialValue: null,
  });

  // Alimenta los links del footer — independiente de la página de donación,
  // no bloquea el resolver principal si la lista tarda o falla.
  readonly legalPages = toSignal(this.#legalPageApi.getAll(), { initialValue: [] });

  constructor() {
    effect(() => {
      const page = this.#page();
      if (page) this.store.init(page);
    });

    // Applied once per fresh load — there's no other route in this SPA that
    // would need a different favicon, and the <link> tag lives in <head>,
    // untouched by the router, so it stays set for the rest of the session.
    effect(() => {
      const favicon = this.faviconUrl();
      if (!favicon) return;
      let link = this.#document.querySelector<HTMLLinkElement>("link[rel~='icon']");
      if (!link) {
        link = this.#document.createElement('link');
        link.rel = 'icon';
        this.#document.head.appendChild(link);
      }
      link.href = `${environment.apiUrl}${favicon}`;
    });
  }

  readonly branding = computed(() => this.store.branding());
  readonly primaryColor = computed(() => this.branding()?.primaryColor ?? '#10b981');
  // El backend devuelve rutas de gateway relativas (/v1/donation-pages/{id}/branding/...)
  // — nunca la URL de storage directa (ver client.py: el bucket es privado). Hay que
  // anteponer environment.apiUrl para que el navegador pueda resolverlas.
  readonly heroImageUrl = computed(() => {
    const path = this.branding()?.heroImageUrl;
    return path ? `${environment.apiUrl}${path}` : null;
  });
  readonly logoUrl = computed(() => {
    const path = this.branding()?.logoUrl;
    return path ? `${environment.apiUrl}${path}` : null;
  });
  readonly faviconUrl = computed(() => this.branding()?.faviconUrl ?? null);
  readonly heroHeading = computed(() => this.branding()?.heroHeading ?? null);
  readonly welcomeText = computed(() => this.branding()?.welcomeText ?? null);
  readonly orgName = computed(() => this.store.page()?.organizationName ?? '');

  readonly backgroundStyle = computed(() => {
    const hero = this.heroImageUrl();
    if (hero) {
      return `background: linear-gradient(to bottom, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.65) 100%), url('${hero}') center/cover no-repeat`;
    }
    return 'background: linear-gradient(135deg, #0f1923 0%, #1a2a3a 50%, #0d2318 100%)';
  });
}
