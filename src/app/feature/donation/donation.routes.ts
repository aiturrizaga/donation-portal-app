import { Routes } from '@angular/router';
import { donationPageResolver } from './resolvers/donation-page-resolver';
import { defaultPageResolver } from './resolvers/default-page-resolver';
import { legalPageResolver } from './resolvers/legal-page-resolver';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    resolve: { page: defaultPageResolver },
    loadComponent: () =>
      import('./pages/donation-landing/donation-landing').then((m) => m.DonationLandingPage),
  },
  {
    path: 'libro-reclamaciones',
    loadComponent: () =>
      import('./pages/complaints-book/complaints-book').then((m) => m.ComplaintsBookPage),
  },
  {
    // Debe ir antes de ':slug' — si no, el router lo interpretaría como el
    // slug de una página de donación llamada "legal".
    path: 'legal/:slug',
    resolve: { page: legalPageResolver },
    loadComponent: () =>
      import('./pages/legal-page-detail/legal-page-detail').then((m) => m.LegalPageDetailPage),
  },
  {
    path: ':slug',
    resolve: { page: donationPageResolver },
    loadComponent: () =>
      import('./pages/donation-landing/donation-landing').then((m) => m.DonationLandingPage),
  },
];
