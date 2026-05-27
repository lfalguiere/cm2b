import { Routes } from '@angular/router';

export const adminRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./admin-home/admin-home.component').then((m) => m.AdminHomeComponent),
  },
  {
    path: 'elementclasses',
    loadComponent: () =>
      import('./elementclasses/elementclasses-admin.component').then((m) => m.ElementClassesAdminComponent),
    title: 'CM2B — Admin · Classes d\'éléments',
  },
  {
    path: 'structures',
    loadComponent: () =>
      import('./structures/structures-admin.component').then((m) => m.StructuresAdminComponent),
    title: 'CM2B — Admin · Structures',
  },
  {
    path: 'export-import',
    loadComponent: () =>
      import('./export-import/export-import.component').then((m) => m.ExportImportComponent),
    title: 'CM2B — Admin · Export / Import',
  },
  {
    path: 'seed',
    loadComponent: () =>
      import('./seed/seed-admin.component').then((m) => m.SeedAdminComponent),
    title: 'CM2B — Admin · Seed des classes',
  },
];
