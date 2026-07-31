import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-portal-header',
  imports: [RouterLink],
  templateUrl: './portal-header.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PortalHeader {
  readonly organizationName = input.required<string>();
  readonly logoUrl = input<string | null>(null);
}
