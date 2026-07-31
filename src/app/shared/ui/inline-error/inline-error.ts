import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

@Component({
  selector: 'app-inline-error',
  templateUrl: './inline-error.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InlineError {
  readonly message = input('Ocurrió un error. Inténtalo de nuevo.');
  readonly retry = output<void>();
}
