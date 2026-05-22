import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../../core/services/api.service';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-seed-admin',
  standalone: true,
  imports: [RouterLink],
  template: `
<div class="shell">
  <header class="topbar">
    <img src="/cm2b.png" alt="CM2B" class="logo-img"/>
    <nav>
      <a routerLink="/admin">Administration</a>
    </nav>
    <span class="page-title">Seed du méta-modèle</span>
    <button class="btn-logout" (click)="auth.logout()">Déconnexion</button>
  </header>

  <div class="content">
    <div class="section">
      <h2 class="section-title">Générer la fixture</h2>
      <p class="section-desc">
        Télécharge un fichier <code>classes.json</code> contenant les types, classes
        et attributs actuels. Placez-le dans
        <code>src/database/seed/fixtures/classes.json</code> puis rebuilder l'image
        pour que les futurs déploiements soient pré-seedés.
      </p>
      <button class="btn-primary" (click)="doExport()" [disabled]="exporting()">
        {{ exporting() ? 'Génération...' : 'Télécharger classes.json' }}
      </button>
      @if (error()) {
        <p class="error">{{ error() }}</p>
      }
      @if (success()) {
        <p class="success">Fichier téléchargé.</p>
      }
    </div>
  </div>
</div>
  `,
  styles: [`
    :host { display:block; height:100vh; background:#0d0d0d; color:#e8e8e8; font-family:'Syne',sans-serif; }
    .shell { display:flex; flex-direction:column; height:100vh; }
    .topbar {
      display:flex; align-items:center; gap:1rem;
      padding:.55rem 1.25rem; background:#0a0a0a; border-bottom:1px solid #2a2a2a;
      position:relative;
    }
    .btn-logout { margin-left:auto; background:none; border:1px solid #2a2a2a; border-radius:5px; color:#555; padding:.3rem .7rem; cursor:pointer; font-size:.75rem; font-family:'Syne',sans-serif; }
    .btn-logout:hover { color:#aaa; border-color:#555; }
    .logo-img { height:22px; width:auto; display:block; object-fit:contain; }
    nav a { color:#555; text-decoration:none; font-size:.78rem; letter-spacing:.04em; }
    nav a:hover { color:#aaa; }
    .page-title {
      position:absolute; left:50%; transform:translateX(-50%);
      font-size:.82rem; font-weight:400; color:#555;
      letter-spacing:.02em; font-family:'JetBrains Mono',monospace;
      pointer-events:none;
    }
    .content { padding:2rem; max-width:560px; }
    .section { background:#151515; border:1px solid #2a2a2a; border-radius:10px; padding:1.5rem; }
    .section-title { font-size:.95rem; font-weight:700; margin:0 0 .5rem; }
    .section-desc { font-size:.8rem; color:#777; margin:0 0 1.25rem; line-height:1.6; }
    code { background:#1e1e1e; border:1px solid #333; border-radius:3px; padding:.1rem .35rem; font-size:.78rem; font-family:'JetBrains Mono',monospace; color:#a78bfa; }
    .btn-primary {
      background:#4f46e5; color:#fff; border:none; border-radius:6px;
      padding:.55rem 1.1rem; cursor:pointer; font-size:.82rem; font-family:'Syne',sans-serif;
    }
    .btn-primary:hover:not(:disabled) { background:#4338ca; }
    .btn-primary:disabled { opacity:.5; cursor:not-allowed; }
    .error   { margin-top:.75rem; font-size:.8rem; color:#f87171; }
    .success { margin-top:.75rem; font-size:.8rem; color:#34d399; }
  `],
})
export class SeedAdminComponent {
  readonly auth    = inject(AuthService);
  private readonly api = inject(ApiService);

  exporting = signal(false);
  error     = signal('');
  success   = signal(false);

  doExport() {
    this.error.set('');
    this.success.set(false);
    this.exporting.set(true);

    this.api.admin.exportSeed().subscribe({
      next: (data) => {
        this.exporting.set(false);
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href     = url;
        a.download = `cm2b-classes-seed-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
        this.success.set(true);
      },
      error: (err) => {
        this.exporting.set(false);
        this.error.set(err?.error?.message ?? 'Erreur lors de la génération');
      },
    });
  }
}
