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
    // Etiqueta tal cual viene del catálogo `frequency_options` del admin —
    // ya no se traduce/adivina acá. El fallback genérico solo cubre un
    // value sin entrada en el catálogo (no debería pasar en uso normal).
    const label = this.config()?.frequencyLabels?.[value];
    if (label) return label;
    return value === 'one_time' ? 'Única vez' : `Por ${value} meses`;
  }

  // Uno se elige al azar por carga de página, desde la lista configurada en
  // el admin (Objetivo > Formulario > Mensajes de impacto) — computed()
  // solo reevalúa cuando cambia la referencia de config(), es decir una vez
  // por carga, no en cada change detection. Sin mensajes configurados, no
  // se muestra nada (sin texto de respaldo hardcodeado).
  readonly impactMessage = computed(() => {
    const messages = this.config()?.impactMessages;
    if (!messages || messages.length === 0) return null;
    return messages[Math.floor(Math.random() * messages.length)];
  });

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
