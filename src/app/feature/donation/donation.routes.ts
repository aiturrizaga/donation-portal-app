import { Routes } from '@angular/router';
import { donationPageResolver } from './resolvers/donation-page-resolver';
import { defaultPageResolver } from './resolvers/default-page-resolver';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    resolve: { page: defaultPageResolver },
    loadComponent: () =>
      import('./pages/donation-landing/donation-landing').then((m) => m.DonationLandingPage),
  },
  {
    path: ':slug',
    resolve: { page: donationPageResolver },
    loadComponent: () =>
      import('./pages/donation-landing/donation-landing').then((m) => m.DonationLandingPage),
  },
];
