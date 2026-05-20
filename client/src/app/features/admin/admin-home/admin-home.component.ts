// src/app/features/admin/admin-home/admin-home.component.ts
import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-admin-home',
  standalone: true,
  imports: [RouterLink],
  template: `
<div class="shell">
  <header class="topbar">
    <img src="/cm2b.png" alt="CM2B" class="logo-img"/>
    <nav>
      <a href="/map">Cartographie</a>
      <a href="/liste">Elements</a>
    </nav>
    <span class="page-title">Administration</span>
    <button class="btn-logout" (click)="auth.logout()">Déconnexion</button>
  </header>
  <div class="cards">
    <a routerLink="elementclasses" class="card">
      <span class="card-icon">◈</span>
      <div class="card-body">
        <span class="card-title">Classes d'éléments</span>
        <span class="card-desc">Classes d'éléments, types et propriétés</span>
      </div>
      <span class="card-arrow">→</span>
    </a>
    <a routerLink="structures" class="card">
      <span class="card-icon">⬡</span>
      <div class="card-body">
        <span class="card-title">Structures</span>
        <span class="card-desc">Modèles de documents, classes et relations autorisées</span>
      </div>
      <span class="card-arrow">→</span>
    </a>
    <a routerLink="export-import" class="card">
      <span class="card-icon">⇅</span>
      <div class="card-body">
        <span class="card-title">Export / Import</span>
        <span class="card-desc">Sauvegarde et restauration complète des données</span>
      </div>
      <span class="card-arrow">→</span>
    </a>
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
    nav { display:flex; gap:1.5rem; }
    nav a { color:#555; text-decoration:none; font-size:.78rem; letter-spacing:.04em; }
    nav a:hover { color:#aaa; }
    .page-title {
      position:absolute; left:50%; transform:translateX(-50%);
      font-size:.82rem; font-weight:400; color:#555;
      letter-spacing:.02em; font-family:'JetBrains Mono',monospace;
      pointer-events:none;
    }
    .cards { padding:2rem; display:flex; flex-direction:column; gap:.75rem; max-width:480px; }
    .card {
      display:flex; align-items:center; gap:1rem;
      padding:1rem 1.25rem; background:#151515;
      border:1px solid #2a2a2a; border-radius:10px; text-decoration:none;
      color:#e8e8e8; transition:all .15s;
    }
    .card:hover { border-color:#3a3a3a; background:#1c1c1c; }
    .card-icon { font-size:1.4rem; color:#4f46e5; }
    .card-body { display:flex; flex-direction:column; gap:.15rem; flex:1; }
    .card-title { font-size:.88rem; font-weight:700; }
    .card-desc { font-size:.74rem; color:#555; }
    .card-arrow { color:#333; font-size:1rem; }
    .card:hover .card-arrow { color:#666; }
  `],
})
export class AdminHomeComponent {
  readonly auth = inject(AuthService);
}
