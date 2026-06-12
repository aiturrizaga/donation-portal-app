import { HttpInterceptorFn } from '@angular/common/http';
import { inject, PLATFORM_ID, REQUEST } from '@angular/core';
import { isPlatformServer } from '@angular/common';
import { PORTAL_REQUEST_HOST_HEADER } from '@core/constants/headers';

export const portalRequestHostInterceptor: HttpInterceptorFn = (req, next) => {
  const platformId = inject(PLATFORM_ID);
  let host = '';

  if (isPlatformServer(platformId)) {
    const request = inject(REQUEST, { optional: true });
    host = request?.headers.get('host')?.split(':')[0] ?? '';
  } else {
    host = window.location.hostname;
  }

  if (host) {
    req = req.clone({ setHeaders: { [PORTAL_REQUEST_HOST_HEADER]: host } });
  }

  return next(req);
};
