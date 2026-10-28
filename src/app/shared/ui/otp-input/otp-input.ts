import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  input,
  model,
  output,
  viewChildren,
} from '@angular/core';

/**
 * Código OTP en casillas de un dígito. Acepta pegar el código completo en
 * cualquier casilla, avanza/retrocede solo y emite `completed` al llenar la
 * última. `autocomplete="one-time-code"` deja que el celular lo sugiera.
 */
@Component({
  selector: 'app-otp-input',
  templateUrl: './otp-input.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OtpInput {
  readonly length = input(6);
  readonly disabled = input(false);
  readonly invalid = input(false);
  readonly value = model('');
  readonly completed = output<string>();

  protected readonly cells = computed(() => Array.from({ length: this.length() }, (_, i) => i));
  protected readonly digits = computed(() => this.value().padEnd(this.length(), ' ').split(''));

  private readonly inputs = viewChildren<ElementRef<HTMLInputElement>>('cell');

  constructor() {
    afterNextRender(() => this.focus(0));
  }

  focus(index = 0): void {
    this.inputs()[Math.min(index, this.length() - 1)]?.nativeElement.focus();
  }

  clear(): void {
    this.value.set('');
    this.focus(0);
  }

  protected onInput(index: number, event: Event): void {
    const target = event.target as HTMLInputElement;
    const typed = target.value.replace(/\D/g, '');
    if (!typed) {
      target.value = this.digits()[index].trim();
      return;
    }
    // Más de un dígito: autocompletado del celular o pegado — se reparte
    // desde esta casilla en adelante.
    this.#write(index, typed);
  }

  protected onPaste(index: number, event: ClipboardEvent): void {
    const pasted = event.clipboardData?.getData('text')?.replace(/\D/g, '') ?? '';
    if (!pasted) return;
    event.preventDefault();
    this.#write(index, pasted);
  }

  protected onKeydown(index: number, event: KeyboardEvent): void {
    if (event.key === 'Backspace') {
      event.preventDefault();
      const chars = this.digits();
      if (chars[index].trim()) {
        chars[index] = ' ';
        this.value.set(chars.join('').trimEnd());
      } else if (index > 0) {
        chars[index - 1] = ' ';
        this.value.set(chars.join('').trimEnd());
        this.focus(index - 1);
      }
    } else if (event.key === 'ArrowLeft' && index > 0) {
      this.focus(index - 1);
    } else if (event.key === 'ArrowRight') {
      this.focus(index + 1);
    }
  }

  #write(index: number, typed: string): void {
    const chars = this.digits();
    for (let i = 0; i < typed.length && index + i < this.length(); i++) {
      chars[index + i] = typed[i];
    }
    const next = chars.join('').replace(/\s+$/, '');
    this.value.set(next);
    this.focus(Math.min(index + typed.length, this.length() - 1));
    if (/^\d+$/.test(next) && next.length === this.length()) this.completed.emit(next);
  }
}
