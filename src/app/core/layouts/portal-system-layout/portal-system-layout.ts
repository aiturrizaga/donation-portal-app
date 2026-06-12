import { ChangeDetectionStrategy, Component } from '@angular/core';
import { environment } from '@env/environment';

@Component({
  selector: 'app-portal-system-layout',
  templateUrl: './portal-system-layout.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'contents' },
})
export class PortalSystemLayout {
  readonly currentYear = new Date().getFullYear();
  readonly supportUrl = environment.support.url;
}
