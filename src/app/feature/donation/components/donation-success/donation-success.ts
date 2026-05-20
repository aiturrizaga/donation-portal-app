import { Component, computed, input } from '@angular/core';
import { DonationStore } from '../../store/donation.store';

@Component({
  selector: 'app-donation-success',
  imports: [],
  templateUrl: './donation-success.html',
})
export class DonationSuccess {
  readonly store = input.required<InstanceType<typeof DonationStore>>();
  readonly result = computed(() => this.store().submitResult());

  getCurrencySymbol(currency: string): string {
    return currency === 'PEN' ? 'S/' : 'US$';
  }

  donateAgain(): void {
    this.store().resetForm();
    window.location.reload();
  }
}
