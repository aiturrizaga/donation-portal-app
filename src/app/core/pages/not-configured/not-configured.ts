import { ChangeDetectionStrategy, Component } from '@angular/core';
import { PortalSystemLayout } from '../../layouts/portal-system-layout/portal-system-layout';

@Component({
  selector: 'app-not-configured-page',
  templateUrl: './not-configured.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'contents' },
  imports: [PortalSystemLayout],
})
export class NotConfiguredPage {}
