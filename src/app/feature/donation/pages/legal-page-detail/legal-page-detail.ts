import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { PortalSystemLayout } from '@core/layouts/portal-system-layout/portal-system-layout';
import { PortalLegalPage } from '../../api/legal-page.api';
import { normalizeRichText } from '@shared/utils/rich-text.util';

@Component({
  selector: 'app-legal-page-detail-page',
  imports: [PortalSystemLayout],
  templateUrl: './legal-page-detail.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'contents' },
})
export class LegalPageDetailPage {
  readonly #route = inject(ActivatedRoute);

  // La página viene ya resuelta por legalPageResolver.
  readonly page = toSignal(
    this.#route.data.pipe(map((d) => d['page'] as PortalLegalPage)),
    { initialValue: null },
  );

  readonly title = computed(() => this.page()?.title ?? '');
  readonly content = computed(() => normalizeRichText(this.page()?.content) ?? '');
}
