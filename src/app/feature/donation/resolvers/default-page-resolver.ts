import { inject, PLATFORM_ID, RESPONSE_INIT } from '@angular/core';
import { isPlatformServer } from '@angular/common';
import { ResolveFn, Router, RedirectCommand } from '@angular/router';
import { catchError, of } from 'rxjs';
import { DonationApi } from '../api/donation.api';
import { DonationPage } from '../models/donation.model';

export const defaultPageResolver: ResolveFn<DonationPage | RedirectCommand | null> = () => {
  const api = inject(DonationApi);
  const router = inject(Router);
  const platformId = inject(PLATFORM_ID);
  const responseInit = inject(RESPONSE_INIT, { optional: true });

  return api.getDefaultPage().pipe(
    catchError((err) => {
      const isNotConfigured = err.status === 422 || err.error?.detail?.reason === 'no_default_page';

      if (isPlatformServer(platformId) && responseInit) {
        responseInit.status = isNotConfigured ? 503 : 404;
      }

      const target = isNotConfigured ? '/not-configured' : '/not-found';
      const urlTree = router.parseUrl(target);
      return of(new RedirectCommand(urlTree, { skipLocationChange: true }));
    }),
  );
};
