import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-setup',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="login-wrapper">
      <div class="login-card">

        <div class="login-brand">
          <img src="/cm2b.png" alt="CM2B" class="logo-img"/>
        </div>

        <div class="login-sep"></div>

        <form class="login-form" (ngSubmit)="onSubmit()">
          <p class="setup-title">Configuration initiale</p>
          <p class="setup-subtitle">Créez votre compte administrateur</p>

          <div class="field">
            <label for="email">Email</label>
            <input id="email" type="email" [(ngModel)]="email" name="email" autocomplete="email" required/>
          </div>
          <div class="field">
            <label for="username">Nom d'utilisateur</label>
            <input id="username" type="text" [(ngModel)]="username" name="username" autocomplete="username" required/>
          </div>
          <div class="field">
            <label for="password">Mot de passe</label>
            <input id="password" type="password" [(ngModel)]="password" name="password" autocomplete="new-password" required/>
            <span class="hint">12 car. min · maj · min · chiffre · spécial</span>
          </div>
          @if (error()) {
            <div class="error-msg">{{ error() }}</div>
          }
          @if (success()) {
            <div class="success-msg">{{ success() }}</div>
          }
          <button type="submit" [disabled]="loading()">
            {{ loading() ? 'Création…' : 'Créer le compte admin' }}
          </button>
        </form>

      </div>
    </div>
  `,
  styles: [`
    :host { display: block; }

    .login-wrapper {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #0d0d0d;
      font-family: 'Syne', sans-serif;
    }
    .login-card {
      display: flex; align-items: stretch; gap: 0;
      background: #111;
      border: 1px solid #2a2a2a;
      border-radius: 12px;
      width: 100%; max-width: 620px;
      overflow: hidden;
    }

    .login-brand {
      flex: 0 0 220px;
      display: flex; align-items: center; justify-content: center;
      padding: 2rem;
      background: #0d0d0d;
    }
    .logo-img {
      width: 140px; height: auto;
      display: block; object-fit: contain;
    }

    .login-sep {
      width: 1px; align-self: stretch;
      background: #2a2a2a; flex-shrink: 0;
    }

    .login-form {
      flex: 1;
      padding: 2rem;
      display: flex; flex-direction: column; gap: 0;
    }
    .setup-title {
      font-size: .95rem; font-weight: 700; color: #e8e8e8;
      margin-bottom: .2rem;
    }
    .setup-subtitle {
      font-size: .75rem; color: #555;
      margin-bottom: 1.2rem;
    }
    .field { display: flex; flex-direction: column; gap: .3rem; margin-bottom: .85rem; }
    label {
      font-size: .65rem; font-weight: 700; color: #555;
      letter-spacing: .08em; text-transform: uppercase;
    }
    input {
      padding: .52rem .75rem;
      background: #1c1c1c; border: 1px solid #3a3a3a;
      border-radius: 6px; color: #e8e8e8;
      font-size: .88rem; font-family: 'Syne', sans-serif;
      outline: none; width: 100%;
    }
    input:focus { border-color: #6366f1; }
    .hint { font-size: .68rem; color: #444; }
    button {
      width: 100%; padding: .62rem;
      background: #6366f1; color: #fff;
      border: none; border-radius: 6px;
      font-size: .86rem; font-weight: 700;
      font-family: 'Syne', sans-serif;
      cursor: pointer; margin-top: .5rem;
      letter-spacing: .04em;
    }
    button:hover { background: #4f46e5; }
    button:disabled { opacity: .5; cursor: not-allowed; }
    .error-msg {
      background: rgba(239,68,68,.08);
      border: 1px solid rgba(239,68,68,.25);
      color: #f87171;
      padding: .5rem .75rem;
      border-radius: 6px;
      font-size: .78rem;
      margin-bottom: .6rem;
    }
    .success-msg {
      background: rgba(16,185,129,.08);
      border: 1px solid rgba(16,185,129,.25);
      color: #34d399;
      padding: .5rem .75rem;
      border-radius: 6px;
      font-size: .78rem;
      margin-bottom: .6rem;
    }
  `],
})
export class SetupComponent {
  private readonly auth   = inject(AuthService);
  private readonly router = inject(Router);

  email    = '';
  username = '';
  password = '';
  loading  = signal(false);
  error    = signal<string | null>(null);
  success  = signal<string | null>(null);

  onSubmit() {
    if (!this.email || !this.username || !this.password) return;
    this.loading.set(true);
    this.error.set(null);

    this.auth.setupAdmin(this.email, this.username, this.password).subscribe({
      next: () => {
        this.success.set('Compte admin créé. Redirection vers la connexion…');
        this.loading.set(false);
        setTimeout(() => this.router.navigate(['/login']), 1500);
      },
      error: (err) => {
        this.error.set(err?.error?.message ?? 'Erreur lors de la création du compte');
        this.loading.set(false);
      },
    });
  }
}
