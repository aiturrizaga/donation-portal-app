import { ChangeDetectionStrategy, Component } from '@angular/core';
import { PortalSystemLayout } from '../../layouts/portal-system-layout/portal-system-layout';

@Component({
  selector: 'app-not-found-page',
  imports: [PortalSystemLayout],
  templateUrl: './not-found.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'contents' },
})
export class NotFoundPage {}
