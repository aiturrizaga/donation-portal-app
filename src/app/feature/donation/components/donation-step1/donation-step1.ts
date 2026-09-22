import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DonationStore } from '../../store/donation.store';
import { getCurrencySymbol } from '@shared/utils/currency.util';
import { getTargetTypeLabel } from '@shared/utils/target-type.util';

// Beyond this many targets, chips stop being usable — the portal switches
// to a <select> instead (see donation-step1.html).
const TARGETS_CHIP_LIMIT = 3;

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

  readonly showTargetsAsSelect = computed(() => this.visibleTargets().length > TARGETS_CHIP_LIMIT);

  readonly allowNoneTarget = computed(() => this.config()?.allowNoneTarget ?? false);

  // Header label above the choices — the type of the objetivos shown, e.g.
  // "Causa" or "Labor". Targets assigned to a single page are normally all
  // the same type; when they aren't, falls back to a generic "Objetivo"
  // instead of guessing which one to show.
  readonly targetsLabel = computed(() => {
    const types = new Set(this.visibleTargets().map((t) => t.targetType));
    if (types.size !== 1) return 'Objetivo';
    return getTargetTypeLabel([...types][0]);
  });

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

  // Bound to the <select> variant (>3 targets) — a plain value change, not
  // the chip variant's toggle-on-reclick behavior.
  onTargetSelectChange(value: string): void {
    const id = value ? Number(value) : null;
    this.store.updateForm({ targetId: id });
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
