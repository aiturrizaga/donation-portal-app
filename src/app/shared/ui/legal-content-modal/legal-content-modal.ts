import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

@Component({
  selector: 'app-legal-content-modal',
  templateUrl: './legal-content-modal.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LegalContentModal {
  readonly open = input.required<boolean>();
  readonly title = input.required<string>();
  readonly content = input<string>('');
  readonly closed = output<void>();

  close(): void {
    this.closed.emit();
  }
}
