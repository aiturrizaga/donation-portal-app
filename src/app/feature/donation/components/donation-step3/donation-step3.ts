import { Component, computed, input } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DonationStore } from '../../store/donation.store';
import { TitleCasePipe } from '@angular/common';

@Component({
  selector: 'app-donation-step3',
  imports: [FormsModule, TitleCasePipe],
  templateUrl: './donation-step3.html',
})
export class DonationStep3 {
  readonly store = input.required<InstanceType<typeof DonationStore>>();

  readonly state = computed(() => this.store().formState());
  readonly config = computed(() => this.store().formConfig());
  readonly page = computed(() => this.store().page());

  readonly privacyAccepted = computed(() => this.state().privacyPolicy);

  getCurrencySymbol(currency: string): string {
    return currency === 'PEN' ? 'S/' : 'US$';
  }

  getTargetName(): string {
    const id = this.state().targetId;
    if (!id) return 'Ninguno';
    return this.config()?.targets.find((t) => t.id === id)?.name ?? 'Ninguno';
  }

  getDefaultGateway() {
    return this.config()?.gateways.find((g) => g.isDefault) ?? this.config()?.gateways[0] ?? null;
  }

  getFrequencyLabel(): string {
    const freq = this.state().frequency;
    if (!freq) return 'Única vez';
    if (freq === '1') return 'Mensual';
    if (freq === '12') return 'Anual';
    return `Cada ${freq} meses`;
  }

  togglePrivacy(value: boolean): void {
    this.store().updateStep2({ privacyPolicy: value });
  }

  submit(): void {
    if (!this.state().privacyPolicy) return;
    this.store().submit();
  }

  back(): void {
    this.store().prevStep();
  }
}
