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
import { normalizeRichText, richTextToPlain } from '@shared/utils/rich-text.util';
import { BrandThemeService } from '@core/services/brand-theme.service';
import { SeoService } from '@core/services/seo.service';
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
  readonly #seo = inject(SeoService);
  readonly #legalPageApi = inject(LegalPageApi);
  readonly #brandTheme = inject(BrandThemeService);
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

    // Título + metatags (Google y vista previa al compartir). Corre en el
    // SSR, que es lo único que leen los bots de Facebook/WhatsApp/X.
    effect(() => {
      const page = this.#page();
      if (page) this.#seo.apply(this.#seoData(page));
    });

    // Color primario del branding → paleta `brand-*` de todo el portal
    // (formulario, botones, barra de progreso). Corre también en el SSR, así
    // que el HTML ya llega con el color de la organización.
    effect(() => this.#brandTheme.apply(this.primaryColor()));

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
  readonly heroHeading = computed(() => normalizeRichText(this.branding()?.heroHeading));
  readonly welcomeText = computed(() => normalizeRichText(this.branding()?.welcomeText));
  readonly orgName = computed(() => this.store.page()?.organizationName ?? '');
  // "Título de encabezado" del branding (admin → Páginas → Branding); si está
  // vacío, el nombre de la organización. El footer sigue usando el nombre
  // legal de la organización (va junto al RUC).
  readonly headerTitle = computed(() => this.branding()?.companyName?.trim() || this.orgName());

  // Respaldos cuando el admin no completó la pestaña SEO: nombre de la página,
  // texto de bienvenida e imagen hero → logo.
  #seoData(page: DonationPage) {
    const seo = page.seo;
    const branding = page.branding;
    const siteName = branding?.companyName?.trim() || page.organizationName;
    const imagePath = seo?.ogImageUrl ?? branding?.heroImageUrl ?? branding?.logoUrl ?? null;
    return {
      title: seo?.metaTitle?.trim() || page.name,
      description:
        seo?.metaDescription?.trim() ||
        richTextToPlain(branding?.welcomeText) ||
        `Dona a ${page.organizationName} de forma segura.`,
      imageUrl: imagePath ? `${environment.apiUrl}${imagePath}` : null,
      siteName,
      noIndex: seo?.noIndex ?? false,
    };
  }

  readonly backgroundStyle = computed(() => {
    const hero = this.heroImageUrl();
    if (hero) {
      return `background: linear-gradient(to bottom, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.65) 100%), url('${hero}') center/cover no-repeat`;
    }
    // Sin imagen hero: degradado oscuro teñido con el color primario (antes
    // el último tramo era un verde fijo, #0d2318).
    return 'background: linear-gradient(135deg, #0f1923 0%, #1a2a3a 50%, color-mix(in oklab, var(--brand) 22%, #0b0f14) 100%)';
  });
}
