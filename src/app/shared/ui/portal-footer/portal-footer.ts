import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

export interface PortalFooterLegalLink {
  slug: string;
  title: string;
}

@Component({
  selector: 'app-portal-footer',
  imports: [RouterLink],
  templateUrl: './portal-footer.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PortalFooter {
  readonly organizationName = input.required<string>();
  readonly organizationRuc = input.required<string>();
  readonly organizationAddress = input<string>('');
  readonly organizationEmail = input<string>('');
  readonly organizationPhone = input<string>('');
  readonly primaryColor = input<string>('#10b981');
  readonly legalPages = input<PortalFooterLegalLink[]>([]);
  readonly year = new Date().getFullYear();
}
