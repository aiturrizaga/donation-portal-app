import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DonationStore } from '../../store/donation.store';
import { getCurrencySymbol } from '@shared/utils/currency.util';

@Component({
  selector: 'app-donation-step1',
  imports: [FormsModule],
  templateUrl: './donation-step1.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DonationStep1 {
  readonly store = inject(DonationStore);
  protected readonly getCurrencySymbol = getCurrencySymbol;

  readonly customAmount = signal<number | null>(null);
  readonly showCustom = signal(false);

  readonly config = computed(() => this.store.formConfig());
  readonly state = computed(() => this.store.formState());

  readonly visibleTargets = computed(() => this.config()?.targets.filter((t) => t.isVisible) ?? []);

  readonly hasTargets = computed(() => this.visibleTargets().length > 0);

  readonly selectedFreq = computed(() =>
    this.state().donationType === 'one_time' ? 'one_time' : this.state().frequency,
  );

  getFrequencyLabel(value: string): string {
    if (value === 'one_time') return 'Única vez';
    if (value === '1') return 'Mensual';
    if (value === '12') return 'Anual';
    // Fixed-term pledge: charged monthly for exactly `value` months, then
    // stops automatically (see ChargeDonationUseCase.frequency_to_plan,
    // backend). "Por N meses" reads unambiguously as a duration — the
    // previous "N meses" label was easy to misread as "every N months".
    return `Por ${value} meses`;
  }

  getImpactMessage(amount: number | null, frequency: string | null): string | null {
    if (!amount) return null;
    if (frequency === 'one_time' || !frequency) {
      if (amount >= 100) return `Tu aporte de ${amount} ayuda a financiar una beca.`;
      if (amount >= 50) return `Tu aporte ayuda a 2 estudiantes este mes.`;
      return `Tu aporte hace la diferencia.`;
    }
    return `Tu aporte mensual ayuda a 3 niños a estudiar.`;
  }

  selectAmount(amount: number): void {
    this.showCustom.set(false);
    this.customAmount.set(null);
    this.store.updateForm({ amount, donationType: this.getDonationType() });
  }

  selectCustom(): void {
    this.showCustom.set(true);
    this.store.updateForm({ amount: null });
  }

  onCustomAmountChange(value: number | null): void {
    this.customAmount.set(value);
    this.store.updateForm({ amount: value });
  }

  selectCurrency(currency: string): void {
    this.store.updateForm({ currency });
  }

  selectFrequency(value: string): void {
    const isRecurring = value !== 'one_time';
    this.store.updateForm({
      donationType: isRecurring ? 'recurring' : 'one_time',
      frequency: isRecurring ? value : null,
    });
  }

  selectTarget(id: number): void {
    const current = this.state().targetId;
    const target = this.config()?.targets.find((t) => t.id === id);
    if (target?.isLocked) return;
    this.store.updateForm({ targetId: current === id ? null : id });
  }

  private getDonationType(): 'one_time' | 'recurring' {
    const freq = this.state().frequency;
    return freq && freq !== 'one_time' ? 'recurring' : 'one_time';
  }

  canProceed(): boolean {
    const s = this.state();
    return !!s.amount && s.amount > 0;
  }

  next(): void {
    if (this.canProceed()) this.store.nextStep();
  }
}
