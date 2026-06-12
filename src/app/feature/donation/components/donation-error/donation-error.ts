import { Component, computed, input } from '@angular/core';
import { DonationStore } from '../../store/donation.store';

@Component({
  selector: 'app-donation-error',
  imports: [],
  templateUrl: './donation-error.html',
})
export class DonationError {
  readonly store = input.required<InstanceType<typeof DonationStore>>();
  readonly error = computed(() => this.store().submitError());

  retry(): void {
    this.store().retryPayment();
  }

  back(): void {
    this.store().retryPayment();
  }
}
