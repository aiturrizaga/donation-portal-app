import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: ':slug',
    loadComponent: () =>
      import('./pages/donation-landing/donation-landing').then((m) => m.DonationLandingPage),
  },
];
