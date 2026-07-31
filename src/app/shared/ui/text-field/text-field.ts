import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { switchMap } from 'rxjs';
import { getFieldError } from '@shared/utils/form-validation.util';

/**
 * `tone` mirrors the two label/border color schemes already used across the donation
 * forms (gray + uppercase label vs. zinc + plain label) so this wrapper can replace the
 * duplicated markup without changing either screen's existing look.
 */
@Component({
  selector: 'app-text-field',
  imports: [ReactiveFormsModule],
  templateUrl: './text-field.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TextField {
  readonly control = input.required<FormControl<any>>();
  readonly label = input('');
  readonly hint = input('');
  readonly type = input<'text' | 'email' | 'tel'>('text');
  readonly placeholder = input('');
  readonly multiline = input(false);
  readonly rows = input(3);
  readonly tone = input<'default' | 'muted'>('default');

  // AbstractControl's touched/invalid flags are plain mutable properties, not signals, so
  // under OnPush this component would never re-check after an ancestor calls
  // form.markAllAsTouched() — bridge the control's event stream into the signal graph.
  private readonly controlEvents = toSignal(
    toObservable(this.control).pipe(switchMap((control) => control.events)),
  );

  protected readonly errorMessage = computed(() => {
    this.controlEvents();
    return getFieldError(this.control());
  });
}
