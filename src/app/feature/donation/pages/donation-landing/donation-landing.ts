import { Component, computed, effect, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { DonationForm } from '../../components/donation-form/donation-form';
import { DonationStore } from '../../store/donation.store';
import { DonationPage } from '../../models/donation.model';
import { PortalHeader } from '@shared/ui/portal-header/portal-header';
import { PortalFooter } from '@shared/ui/portal-footer/portal-footer';

@Component({
  selector: 'app-donation-landing-page',
  imports: [DonationForm, PortalHeader, PortalFooter],
  providers: [DonationStore],
  templateUrl: './donation-landing.html',
})
export class DonationLandingPage {
  readonly #route = inject(ActivatedRoute);
  readonly store = inject(DonationStore);

  // Page comes already resolved and validated by the resolver
  readonly #page = toSignal(this.#route.data.pipe(map((d) => d['page'] as DonationPage)), {
    initialValue: null,
  });

  constructor() {
    effect(() => {
      const page = this.#page();
      if (page) this.store.init(page);
    });
  }

  readonly branding = computed(() => this.store.branding());
  readonly primaryColor = computed(() => this.branding()?.primaryColor ?? '#10b981');
  readonly heroImageUrl = computed(() => this.branding()?.heroImageUrl ?? null);
  readonly logoUrl = computed(() => this.branding()?.logoUrl ?? null);
  readonly orgName = computed(() => this.store.page()?.organizationName ?? '');

  readonly backgroundStyle = computed(() => {
    const hero = this.heroImageUrl();
    if (hero) {
      return `background: linear-gradient(to bottom, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.65) 100%), url('${hero}') center/cover no-repeat`;
    }
    return 'background: linear-gradient(135deg, #0f1923 0%, #1a2a3a 50%, #0d2318 100%)';
  });
}
