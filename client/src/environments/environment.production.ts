// src/environments/environment.production.ts
export const environment = {
  production: true,
  apiUrl: '/api/v1', // proxied via nginx en production (même domaine → pas de CORS)
};
