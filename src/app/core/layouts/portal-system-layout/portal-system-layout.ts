import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-portal-system-layout',
  templateUrl: './portal-system-layout.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'contents' },
})
export class PortalSystemLayout {
  readonly currentYear = new Date().getFullYear();
}
