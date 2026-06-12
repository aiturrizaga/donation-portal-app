import { HttpInterceptorFn } from '@angular/common/http';
import { PORTAL_REQUEST_HOST_HEADER } from '@core/constants/headers';

export const portalRequestHostInterceptor: HttpInterceptorFn = (req, next) => {
  const host = typeof window !== 'undefined' ? window.location.hostname : '';
  if (host) {
    req = req.clone({
      setHeaders: { [PORTAL_REQUEST_HOST_HEADER]: host },
    });
  }
  return next(req);
};
