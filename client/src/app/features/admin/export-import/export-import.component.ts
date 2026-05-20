// src/app/features/admin/export-import/export-import.component.ts
import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../../core/services/api.service';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-export-import',
  standalone: true,
  imports: [CommonModule],
  template: `
<div class="shell">

  <!-- Topbar -->
  <header class="topbar">
    <img src="/cm2b.png" alt="CM2B" class="logo-img"/>
    <nav>
      <a href="/map">Cartographie</a>
      <a href="/liste">Elements</a>
    </nav>
    <a class="back" href="/admin">← Admin</a>
    <span class="page-title">Export / Import</span>
    <div class="topbar-right">
      <button class="btn-logout" (click)="auth.logout()">Déconnexion</button>
    </div>
  </header>

  <div class="body">

    <!-- Export -->
    <section class="card">
      <h2 class="section-title">Export</h2>
      <p class="section-desc">Télécharge l'intégralité des données (éléments, classes, structures, vues) au format JSON.</p>
      <button class="btn-primary" [disabled]="exporting()" (click)="doExport()">
        {{ exporting() ? 'Export en cours…' : 'Télécharger le fichier JSON' }}
      </button>
      @if (exportError()) {
        <div class="msg-error">{{ exportError() }}</div>
      }
    </section>

    <!-- Import -->
    <section class="card">
      <h2 class="section-title">Import</h2>
      <p class="section-desc">Restaure les données depuis un fichier JSON précédemment exporté.
        <strong>Cette opération remplace toutes les données existantes.</strong>
      </p>

      <label class="file-label">
        <input type="file" accept=".json" class="file-input" (change)="onFileSelected($event)"/>
        <span class="file-btn">{{ fileName() || 'Choisir un fichier .json' }}</span>
      </label>

      @if (preview()) {
        <div class="preview">
          <div class="preview-title">Contenu du fichier</div>
          <div class="preview-grid">
            @for (entry of previewEntries(); track entry.key) {
              <span class="preview-key">{{ entry.key }}</span>
              <span class="preview-val">{{ entry.count }}</span>
            }
          </div>
        </div>
      }

      @if (fileError()) {
        <div class="msg-error">{{ fileError() }}</div>
      }

      <button class="btn-danger" [disabled]="!preview() || importing()" (click)="confirmImport()">
        {{ importing() ? 'Import en cours…' : 'Importer (remplace tout)' }}
      </button>

      @if (importResult()) {
        <div class="msg-success">
          Import réussi — {{ importSummary() }}
        </div>
      }
      @if (importError()) {
        <div class="msg-error">{{ importError() }}</div>
      }
    </section>

  </div>
</div>

<!-- Modale de confirmation -->
@if (confirmVisible()) {
  <div class="backdrop" (click)="confirmVisible.set(false)">
    <div class="dialog" (click)="$event.stopPropagation()">
      <h4>Confirmer l'import</h4>
      <p>Cette opération <strong>supprimera toutes les données existantes</strong> et les remplacera par le contenu du fichier sélectionné. Cette action est irréversible.</p>
      <div class="dialog-btns">
        <button (click)="confirmVisible.set(false)">Annuler</button>
        <button class="btn-danger" (click)="doImport()">Oui, importer</button>
      </div>
    </div>
  </div>
}
  `,
  styles: [`
    @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500&family=Syne:wght@400;600;700&display=swap');
    :host { display:block; height:100vh; background:#0d0d0d; color:#e8e8e8; font-family:'Syne',sans-serif; }
    .shell { display:flex; flex-direction:column; height:100vh; }

    /* Topbar */
    .topbar {
      display:flex; align-items:center; gap:1rem;
      padding:.55rem 1.25rem; background:#0a0a0a; border-bottom:1px solid #2a2a2a;
      position:relative; flex-shrink:0;
    }
    .logo-img { height:22px; width:auto; display:block; object-fit:contain; }
    nav { display:flex; gap:1.5rem; }
    nav a { color:#555; text-decoration:none; font-size:.78rem; letter-spacing:.04em; }
    nav a:hover { color:#aaa; }
    .back { color:#555; text-decoration:none; font-size:.78rem; margin-left:.5rem; }
    .back:hover { color:#aaa; }
    .page-title {
      position:absolute; left:50%; transform:translateX(-50%);
      font-size:.82rem; font-weight:400; color:#555;
      letter-spacing:.02em; font-family:'JetBrains Mono',monospace;
      pointer-events:none;
    }
    .topbar-right { margin-left:auto; display:flex; align-items:center; gap:.75rem; }
    .btn-logout { background:none; border:1px solid #2a2a2a; border-radius:5px; color:#555; padding:.3rem .7rem; cursor:pointer; font-size:.75rem; font-family:'Syne',sans-serif; }
    .btn-logout:hover { color:#aaa; border-color:#555; }

    /* Body */
    .body { padding:2rem; display:flex; flex-direction:column; gap:1.5rem; max-width:560px; overflow-y:auto; }

    /* Cards */
    .card {
      background:#151515; border:1px solid #2a2a2a; border-radius:10px;
      padding:1.5rem; display:flex; flex-direction:column; gap:1rem;
    }
    .section-title { font-size:.88rem; font-weight:700; margin:0; }
    .section-desc { font-size:.78rem; color:#666; margin:0; line-height:1.5; }
    .section-desc strong { color:#aaa; }

    /* Boutons */
    .btn-primary {
      padding:.5rem 1.1rem; background:#4f46e5; border:none; border-radius:6px;
      color:white; cursor:pointer; font-size:.82rem; font-family:'Syne',sans-serif;
      align-self:flex-start; transition:background .15s;
    }
    .btn-primary:hover:not(:disabled) { background:#4338ca; }
    .btn-primary:disabled { opacity:.45; cursor:not-allowed; }
    .btn-danger {
      padding:.5rem 1.1rem; background:#991b1b; border:1px solid #7f1d1d; border-radius:6px;
      color:#fca5a5; cursor:pointer; font-size:.82rem; font-family:'Syne',sans-serif;
      align-self:flex-start; transition:background .15s;
    }
    .btn-danger:hover:not(:disabled) { background:#7f1d1d; }
    .btn-danger:disabled { opacity:.45; cursor:not-allowed; }

    /* File input */
    .file-label { display:inline-block; cursor:pointer; }
    .file-input { display:none; }
    .file-btn {
      display:inline-block; padding:.45rem .9rem;
      background:#1c1c1c; border:1px solid #3a3a3a; border-radius:6px;
      color:#aaa; font-size:.8rem; font-family:'Syne',sans-serif;
      transition:all .15s;
    }
    .file-btn:hover { border-color:#555; color:#e8e8e8; }

    /* Preview */
    .preview {
      background:#0f0f0f; border:1px solid #2a2a2a; border-radius:8px;
      padding:.75rem 1rem;
    }
    .preview-title { font-size:.7rem; color:#555; text-transform:uppercase; letter-spacing:.06em; margin-bottom:.5rem; }
    .preview-grid { display:grid; grid-template-columns:auto 1fr; gap:.2rem .75rem; }
    .preview-key { font-size:.78rem; color:#888; }
    .preview-val { font-size:.78rem; color:#a5b4fc; font-family:'JetBrains Mono',monospace; }

    /* Messages */
    .msg-error { font-size:.78rem; color:#f87171; padding:.4rem .6rem; background:#1c0d0d; border:1px solid #7f1d1d; border-radius:5px; }
    .msg-success { font-size:.78rem; color:#6ee7b7; padding:.4rem .6rem; background:#0d1c17; border:1px solid #065f46; border-radius:5px; }

    /* Modale */
    .backdrop { position:fixed; inset:0; background:rgba(0,0,0,.75); z-index:500; display:flex; align-items:center; justify-content:center; }
    .dialog {
      background:#151515; border:1px solid #3a3a3a; border-radius:10px;
      padding:1.5rem; max-width:400px; display:flex; flex-direction:column; gap:1rem;
    }
    .dialog h4 { margin:0; font-size:.9rem; color:#e8e8e8; }
    .dialog p { margin:0; font-size:.8rem; color:#888; line-height:1.55; }
    .dialog p strong { color:#fca5a5; }
    .dialog-btns { display:flex; gap:.5rem; justify-content:flex-end; }
    .dialog-btns button { padding:.4rem .9rem; border-radius:5px; border:1px solid #3a3a3a; background:none; color:#888; cursor:pointer; font-size:.82rem; font-family:'Syne',sans-serif; }
  `],
})
export class ExportImportComponent {
  private readonly api = inject(ApiService);
  readonly auth = inject(AuthService);

  exporting    = signal(false);
  exportError  = signal('');

  fileName     = signal('');
  fileError    = signal('');
  preview      = signal<any | null>(null);
  importing    = signal(false);
  importResult = signal<Record<string, number> | null>(null);
  importError  = signal('');
  confirmVisible = signal(false);

  previewEntries = () => {
    const p = this.preview();
    if (!p) return [];
    const keys = ['elementTypes','elementClasses','attributeDefinitions','elements','attributeValues','relations','viewElementPositions'] as const;
    return keys
      .filter(k => Array.isArray(p[k]))
      .map(k => ({ key: k, count: (p[k] as any[]).length }));
  };

  importSummary = () => {
    const r = this.importResult();
    if (!r) return '';
    return Object.entries(r).map(([k, v]) => `${v} ${k}`).join(', ');
  };

  doExport() {
    this.exportError.set('');
    this.exporting.set(true);
    this.api.admin.exportData().subscribe({
      next: (data) => {
        this.exporting.set(false);
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `cm2b-export-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
      },
      error: (err) => {
        this.exporting.set(false);
        this.exportError.set(err?.error?.message ?? 'Erreur lors de l\'export');
      },
    });
  }

  onFileSelected(event: Event) {
    this.fileError.set('');
    this.preview.set(null);
    this.importResult.set(null);
    this.importError.set('');

    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.fileName.set(file.name);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);
        if (typeof data !== 'object' || !data.version) {
          this.fileError.set('Fichier invalide — il ne s\'agit pas d\'un export CM2B.');
          return;
        }
        this.preview.set(data);
      } catch {
        this.fileError.set('Impossible de lire le fichier JSON.');
      }
    };
    reader.readAsText(file);
  }

  confirmImport() {
    if (!this.preview()) return;
    this.confirmVisible.set(true);
  }

  doImport() {
    this.confirmVisible.set(false);
    this.importError.set('');
    this.importResult.set(null);
    this.importing.set(true);
    this.api.admin.importData(this.preview()).subscribe({
      next: (res) => {
        this.importing.set(false);
        this.importResult.set(res.imported);
        this.preview.set(null);
        this.fileName.set('');
      },
      error: (err) => {
        this.importing.set(false);
        this.importError.set(err?.error?.message ?? 'Erreur lors de l\'import');
      },
    });
  }
}
