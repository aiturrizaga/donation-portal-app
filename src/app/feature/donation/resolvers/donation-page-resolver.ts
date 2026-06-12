import { inject, PLATFORM_ID, RESPONSE_INIT } from '@angular/core';
import { isPlatformServer } from '@angular/common';
import { ResolveFn, Router, RedirectCommand } from '@angular/router';
import { catchError, of } from 'rxjs';
import { DonationApi } from '../api/donation.api';
import { DonationPage } from '../models/donation.model';

export const donationPageResolver: ResolveFn<DonationPage | RedirectCommand | null> = (route) => {
  const api = inject(DonationApi);
  const router = inject(Router);
  const platformId = inject(PLATFORM_ID);
  const responseInit = inject(RESPONSE_INIT, { optional: true });
  const slug = route.paramMap.get('slug')!;

  return api.getPage(slug).pipe(
    catchError(() => {
      if (isPlatformServer(platformId) && responseInit) {
        responseInit.status = 404;
      }
      const urlTree = router.parseUrl('/not-found');
      return of(new RedirectCommand(urlTree, { skipLocationChange: true }));
    }),
  );
};
