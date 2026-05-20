// src/app/app.config.ts
import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import {
  provideHttpClient,
  withInterceptors,
  withFetch,
} from '@angular/common/http';
import { routes } from './app.routes';
import { authInterceptor } from './core/interceptors/auth.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),

    // Router avec binding automatique des inputs sur les params de route
    provideRouter(routes, withComponentInputBinding()),

    // HttpClient avec l'intercepteur JWT fonctionnel
    provideHttpClient(
      withFetch(),                         // Fetch API (meilleure perf, SSR-ready)
      withInterceptors([authInterceptor]), // Bearer token + refresh automatique
    ),
  ],
};
