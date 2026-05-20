// src/app/core/interceptors/auth.interceptor.ts
import { HttpInterceptorFn, HttpRequest, HttpHandlerFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';

/**
 * Intercepteur fonctionnel (Angular 17+).
 *
 * Comportement :
 * 1. Injecte le header `Authorization: Bearer <token>` sur toutes les
 *    requêtes vers l'API (filtrées par l'URL).
 * 2. Sur 401, tente un refresh transparent une seule fois.
 *    - Si le refresh réussit → rejoue la requête originale avec le nouveau token.
 *    - Si le refresh échoue → AuthService redirige vers /login.
 * 3. Les requêtes vers /auth/login et /auth/refresh ne sont pas interceptées
 *    (pas de token à injecter et pas de boucle infinie possible).
 */
export const authInterceptor: HttpInterceptorFn = (
  req: HttpRequest<unknown>,
  next: HttpHandlerFn,
) => {
  const authService = inject(AuthService);

  // Ne pas intercepter les routes publiques d'auth
  if (isAuthRoute(req.url)) {
    return next(req);
  }

  const token = authService.getAccessToken();
  const authReq = token ? addBearer(req, token) : req;

  return next(authReq).pipe(
    catchError((err) => {
      if (err instanceof HttpErrorResponse && err.status === 401 && token) {
        // Tente un refresh, puis rejoue la requête
        return authService.refreshAccessToken().pipe(
          switchMap((newToken) => next(addBearer(req, newToken))),
        );
      }
      return throwError(() => err);
    }),
  );
};

function addBearer(req: HttpRequest<unknown>, token: string): HttpRequest<unknown> {
  return req.clone({
    setHeaders: { Authorization: `Bearer ${token}` },
  });
}

function isAuthRoute(url: string): boolean {
  return url.includes('/auth/login') || url.includes('/auth/refresh');
}
