import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { normalizeRichText } from '@shared/utils/rich-text.util';

@Component({
  selector: 'app-legal-content-modal',
  templateUrl: './legal-content-modal.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LegalContentModal {
  readonly open = input.required<boolean>();
  readonly title = input.required<string>();
  readonly content = input<string>('');
  readonly normalizedContent = computed(() => normalizeRichText(this.content()) ?? '');
  readonly closed = output<void>();

  close(): void {
    this.closed.emit();
  }
}
