// src/app/features/auth/forbidden/forbidden.component.ts
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-forbidden',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:1rem;">
      <h1 style="font-size:4rem;margin:0;color:#4f46e5">403</h1>
      <p style="color:#555">Accès refusé — droits insuffisants.</p>
      <a routerLink="/" style="color:#4f46e5">Retour à l'accueil</a>
    </div>
  `,
})
export class ForbiddenComponent {}
