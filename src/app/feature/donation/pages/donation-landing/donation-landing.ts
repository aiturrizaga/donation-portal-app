import { Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { DonationForm } from '../../components/donation-form/donation-form';
import { DonationStore } from '../../store/donation.store';
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

  readonly slug = toSignal(this.#route.paramMap.pipe(map((p) => p.get('slug') ?? '')), {
    initialValue: '',
  });
}
