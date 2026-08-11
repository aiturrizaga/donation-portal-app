import { inject } from '@angular/core';
import { ResolveFn, Router } from '@angular/router';
import { catchError, EMPTY } from 'rxjs';
import { LegalPageApi, PortalLegalPage } from '../api/legal-page.api';

export const legalPageResolver: ResolveFn<PortalLegalPage> = (route) => {
  const api = inject(LegalPageApi);
  const router = inject(Router);
  const slug = route.paramMap.get('slug')!;

  return api.getBySlug(slug).pipe(
    catchError(() => {
      router.navigate(['/not-found']).then();
      return EMPTY;
    }),
  );
};
