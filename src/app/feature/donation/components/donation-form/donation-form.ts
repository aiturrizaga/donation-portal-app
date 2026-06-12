import { Component, inject } from '@angular/core';
import { DonationStore } from '../../store/donation.store';
import { DonationStep1 } from '../donation-step1/donation-step1';
import { DonationStep2 } from '../donation-step2/donation-step2';
import { DonationStep3 } from '../donation-step3/donation-step3';
import { DonationSuccess } from '../donation-success/donation-success';
import { DonationError } from '../donation-error/donation-error';

@Component({
  selector: 'app-donation-form',
  imports: [DonationStep1, DonationStep2, DonationStep3, DonationSuccess, DonationError],
  templateUrl: './donation-form.html',
})
export class DonationForm {
  readonly store = inject(DonationStore);
}
