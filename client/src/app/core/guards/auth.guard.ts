// src/app/core/guards/auth.guard.ts
import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { map, catchError, of } from 'rxjs';

/**
 * Protège les routes qui nécessitent une authentification.
 * Redirige vers /login si l'utilisateur n'est pas connecté.
 */
export const authGuard: CanActivateFn = () => {
  const auth   = inject(AuthService);
  const router = inject(Router);

  if (auth.isAuthenticated()) return true;

  const refreshToken = auth.getRefreshToken();
  if (refreshToken) {
    return auth.refreshAccessToken().pipe(
      map(() => true),
      catchError(() => of(router.createUrlTree(['/login']))),
    );
  }

  return router.createUrlTree(['/login']);
};
