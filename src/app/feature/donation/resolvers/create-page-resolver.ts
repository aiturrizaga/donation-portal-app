import { inject, PLATFORM_ID, RESPONSE_INIT } from '@angular/core';
import { isPlatformServer } from '@angular/common';
import { ActivatedRouteSnapshot, RedirectCommand, ResolveFn, Router } from '@angular/router';
import { catchError, Observable, of } from 'rxjs';
import { DonationApi } from '../api/donation.api';
import { DonationPage } from '../models/donation.model';

interface ErrorRedirect {
  /** HTTP status the SSR response should report before redirecting. */
  status: number;
  target: string;
}

/**
 * Shared shape for the donation-page resolvers: fetch a page, and on failure
 * set the right SSR status code before redirecting client + server to an error route.
 */
export function createPageResolver(
  fetchPage: (api: DonationApi, route: ActivatedRouteSnapshot) => Observable<DonationPage>,
  mapError: (err: unknown) => ErrorRedirect,
): ResolveFn<DonationPage | RedirectCommand | null> {
  return (route) => {
    const api = inject(DonationApi);
    const router = inject(Router);
    const platformId = inject(PLATFORM_ID);
    const responseInit = inject(RESPONSE_INIT, { optional: true });

    return fetchPage(api, route).pipe(
      catchError((err) => {
        const { status, target } = mapError(err);
        if (isPlatformServer(platformId) && responseInit) {
          responseInit.status = status;
        }
        const urlTree = router.parseUrl(target);
        return of(new RedirectCommand(urlTree, { skipLocationChange: true }));
      }),
    );
  };
}
