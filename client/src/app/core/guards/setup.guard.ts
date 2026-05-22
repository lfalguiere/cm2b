import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../services/auth.service';

export const setupGuard: CanActivateFn = async () => {
  const auth   = inject(AuthService);
  const router = inject(Router);
  const needed = await firstValueFrom(auth.checkSetupNeeded());
  return needed ? true : router.createUrlTree(['/login']);
};
