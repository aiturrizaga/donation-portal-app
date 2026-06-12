import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'not-found',
    loadComponent: () => import('./core/pages/not-found').then((m) => m.NotFoundPage),
  },
  {
    path: 'not-configured',
    loadComponent: () => import('./core/pages/not-configured').then((m) => m.NotConfiguredPage),
  },
  {
    path: 'account',
    loadChildren: () => import('./feature/account/account.routes').then((m) => m.routes),
  },
  {
    path: '',
    loadChildren: () => import('./feature/donation/donation.routes').then((m) => m.routes),
  },
  {
    path: '**',
    loadComponent: () => import('./core/pages/not-found').then((m) => m.NotFoundPage),
  },
];
