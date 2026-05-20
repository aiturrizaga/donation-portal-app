import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadChildren: () => import('./feature/donation/donation.routes').then(m => m.routes)
  },
  {
    path: 'account',
    loadChildren: () => import('./feature/account/account.routes').then(m => m.routes)
  },
  {
    path: '**',
    pathMatch: 'full',
    redirectTo: '',
  }
];
