import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-portal-footer',
  imports: [RouterLink],
  templateUrl: './portal-footer.html',
})
export class PortalFooter {
  readonly organizationName = input.required<string>();
  readonly organizationRuc = input.required<string>();
  readonly organizationAddress = input<string>('');
  readonly organizationEmail = input<string>('');
  readonly organizationPhone = input<string>('');
  readonly primaryColor = input<string>('#10b981');
  readonly year = new Date().getFullYear();
}
