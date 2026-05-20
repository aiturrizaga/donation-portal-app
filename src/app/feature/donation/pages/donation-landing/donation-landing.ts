import { Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { DonationForm } from '../../components/donation-form/donation-form';

@Component({
  selector: 'app-donation-landing-page',
  imports: [DonationForm],
  templateUrl: './donation-landing.html',
})
export class DonationLandingPage {
  readonly #route = inject(ActivatedRoute);
  readonly slug = toSignal(this.#route.paramMap.pipe(map((p) => p.get('slug') ?? '')), {
    initialValue: '',
  });
}
