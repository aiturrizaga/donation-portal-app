import { inject } from '@angular/core';
import { ResolveFn, Router } from '@angular/router';
import { catchError, of } from 'rxjs';
import { DonationApi } from '../api/donation.api';
import { DonationPage } from '../models/donation.model';

export const defaultPageResolver: ResolveFn<DonationPage | null> = () => {
  const api = inject(DonationApi);
  const router = inject(Router);

  return api.getDefaultPage().pipe(
    catchError((err) => {
      if (err.status === 422 || err.error?.detail?.reason === 'no_default_page') {
        router.navigate(['/not-configured'], { skipLocationChange: true }).then();
      } else {
        router.navigate(['/not-found'], { skipLocationChange: true }).then();
      }
      return of(null);
    }),
  );
};
