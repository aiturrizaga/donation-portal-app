import { inject } from '@angular/core';
import { ResolveFn, Router } from '@angular/router';
import { catchError, of } from 'rxjs';
import { DonationApi } from '../api/donation.api';
import { DonationPage } from '../models/donation.model';

export const donationPageResolver: ResolveFn<DonationPage | null> = (route) => {
  const api = inject(DonationApi);
  const router = inject(Router);
  const slug = route.paramMap.get('slug')!;

  return api.getPage(slug).pipe(
    catchError(() => {
      router.navigate(['/not-found'], { skipLocationChange: true }).then();
      return of(null);
    }),
  );
};
