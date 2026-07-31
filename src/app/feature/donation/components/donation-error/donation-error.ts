import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { DonationStore } from '../../store/donation.store';
import { SecondaryButton } from '@shared/ui/secondary-button/secondary-button';

@Component({
  selector: 'app-donation-error',
  imports: [SecondaryButton],
  templateUrl: './donation-error.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DonationError {
  readonly store = inject(DonationStore);
  readonly error = computed(() => this.store.submitError());

  retry(): void {
    this.store.retryPayment();
  }

  back(): void {
    this.store.retryPayment();
  }
}
