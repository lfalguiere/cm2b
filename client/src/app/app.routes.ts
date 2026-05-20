import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { roleGuard } from './core/guards/role.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () =>
      import('./features/auth/login/login.component').then((m) => m.LoginComponent),
  },
  {
    path: 'forbidden',
    loadComponent: () =>
      import('./features/auth/forbidden/forbidden.component').then((m) => m.ForbiddenComponent),
  },
  {
    path: '',
    canActivate: [authGuard],
    children: [
      { path: '', redirectTo: 'map', pathMatch: 'full' },
      {
        path: 'map',
        loadComponent: () =>
          import('./features/canvas/canvas.component').then((m) => m.CanvasComponent),
        title: 'CM2B — Éléments',
      },
      {
        path: 'liste',
        loadComponent: () =>
          import('./features/liste/liste.component').then((m) => m.ListeComponent),
        title: 'CM2B — Liste',
      },
      {
        path: 'admin',
        canActivate: [roleGuard],
        data: { roles: ['ADMIN'] },
        loadChildren: () =>
          import('./features/admin/admin.routes').then((m) => m.adminRoutes),
        title: 'CM2B — Administration',
      },
    ],
  },
  { path: '**', redirectTo: 'map' },
];
