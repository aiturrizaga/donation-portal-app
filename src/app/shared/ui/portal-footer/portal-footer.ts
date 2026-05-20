import { Component, input } from '@angular/core';

@Component({
  selector: 'app-portal-footer',
  imports: [],
  templateUrl: './portal-footer.html',
})
export class PortalFooter {
  readonly organizationName = input.required<string>();
  readonly organizationRuc = input.required<string>();
  readonly primaryColor = input<string>('#10b981');
  readonly year = new Date().getFullYear();
}
