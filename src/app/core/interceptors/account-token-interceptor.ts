import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { AccountSessionService } from '../../feature/account/services/account-session.service';

// Solo estas rutas llevan el token del donante — el resto del portal es
// público y no debe mandarlo (p. ej. la descarga de certificados ni el
// formulario de donación).
const AUTHENTICATED_PATHS = ['/v1/portal/me', '/v1/portal/auth/logout'];

export const accountTokenInterceptor: HttpInterceptorFn = (req, next) => {
  // Se compara el path y no `${environment.apiUrl}...`: este interceptor
  // va en el bundle principal, y ahí `import.meta.env` todavía no existe
  // cuando el build extrae las rutas para el SSR.
  const path = new URL(req.url, 'http://localhost').pathname;
  const isAuthenticated = AUTHENTICATED_PATHS.some(
    (p) => path.endsWith(p) || path.includes(`${p}/`),
  );
  if (!isAuthenticated) return next(req);

  const session = inject(AccountSessionService);
  const token = session.token();
  if (token) {
    req = req.clone({ setHeaders: { Authorization: `Bearer ${token}` } });
  }

  return next(req).pipe(
    catchError((err: unknown) => {
      // Token vencido o revocado (p. ej. cerró sesión en otro dispositivo):
      // se descarta y la página vuelve al login.
      if (err instanceof HttpErrorResponse && err.status === 401) session.clear();
      return throwError(() => err);
    }),
  );
};
