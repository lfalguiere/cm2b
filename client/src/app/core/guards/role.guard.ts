// src/app/core/guards/role.guard.ts
import { inject } from '@angular/core';
import { CanActivateFn, ActivatedRouteSnapshot, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

/**
 * Vérifie que l'utilisateur a l'un des rôles requis.
 *
 * Usage :
 *   {
 *     path: 'admin',
 *     canActivate: [authGuard, roleGuard],
 *     data: { roles: ['ADMIN'] }
 *   }
 */
export const roleGuard: CanActivateFn = (route: ActivatedRouteSnapshot) => {
  const auth   = inject(AuthService);
  const router = inject(Router);
  const required = (route.data['roles'] as string[]) ?? [];

  if (!required.length) return true;

  const userRole = auth.currentUser()?.role;
  if (!userRole) return router.createUrlTree(['/login']);

  const hierarchy: Record<string, number> = { ADMIN: 3, EDITOR: 2, VIEWER: 1 };
  const userLevel = hierarchy[userRole] ?? 0;
  const minRequired = Math.min(...required.map((r) => hierarchy[r] ?? 99));

  if (userLevel >= minRequired) return true;

  return router.createUrlTree(['/forbidden']);
};
