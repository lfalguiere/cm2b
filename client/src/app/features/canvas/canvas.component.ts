// src/app/features/canvas/canvas.component.ts
import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { forkJoin, of } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { ApiService } from '../../core/services/api.service';
import { DocumentApiService } from '../../core/services/document-api.service';
import { LeftPanelComponent } from './left-panel/left-panel.component';
import { DocumentViewComponent } from './document-view/document-view.component';
import { ElementFormModalComponent } from './element-form-modal/element-form-modal.component';
import {
  ElementClass, AttributeDefinition, Element as CmElement,
} from '../../core/models/api.models';
import { Structure } from '../../core/models/document.models';

interface ViewMenuItem {
  mode: 'open' | 'create';
  label: string;
  viewId?: string;
  structure?: Structure;
}

/**
 * Composant racine du canvas.
 * Gère le layout global : topbar, panneau gauche, zone principale.
 *
 * Quand aucun document n'est sélectionné, affiche le nœud "Organisation" racine.
 * Si aucun élément Organisation n'existe encore, une modale de création s'ouvre
 * automatiquement.
 */
@Component({
  selector: 'app-canvas',
  standalone: true,
  imports: [CommonModule, LeftPanelComponent, DocumentViewComponent, ElementFormModalComponent],
  template: `
<div class="shell">

  <!-- Topbar -->
  <header class="topbar">
    <img src="/cm2b.png" alt="CM2B" class="logo-img"/>
    <nav>
      <a href="/map" class="nav-active">Cartographie</a>
      <a href="/liste">Elements</a>
    </nav>
    <span class="page-title">Cartographie</span>
    <div class="topbar-right">
      <span class="user-badge">{{ auth.currentUser()?.username }}</span>
      @if (auth.isAdmin()) {
        <a href="/admin" class="btn-admin" title="Administration">
          <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="white">
            <path d="M12 15.5A3.5 3.5 0 0 1 8.5 12 3.5 3.5 0 0 1 12 8.5a3.5 3.5 0 0 1 3.5 3.5 3.5 3.5 0 0 1-3.5 3.5m7.43-2.92c.04-.34.07-.69.07-1.08s-.03-.73-.07-1.08l2.11-1.63c.19-.15.24-.42.12-.64l-2-3.46c-.12-.22-.39-.3-.61-.22l-2.49 1c-.52-.4-1.08-.73-1.69-.98l-.38-2.65C14.46 2.18 14.25 2 14 2h-4c-.25 0-.46.18-.49.42l-.38 2.65c-.61.25-1.17.59-1.69.98l-2.49-1c-.23-.09-.49 0-.61.22l-2 3.46c-.13.22-.07.49.12.64L4.57 10.5c-.04.34-.07.69-.07 1.08s.03.73.07 1.08L2.46 14.29c-.19.15-.24.42-.12.64l2 3.46c.12.22.39.3.61.22l2.49-1c.52.4 1.08.73 1.69.98l.38 2.65c.03.24.24.42.49.42h4c.25 0 .46-.18.49-.42l.38-2.65c.61-.25 1.17-.59 1.69-.98l2.49 1c.23.09.49 0 .61-.22l2-3.46c.12-.22.07-.49-.12-.64l-2.11-1.37z"/>
          </svg>
        </a>
      }
      <button class="btn-logout" (click)="auth.logout()">Déconnexion</button>
    </div>
  </header>

  <!-- Corps -->
  <div class="body">

    <!-- Panneau gauche -->
    <app-left-panel
      [organisationId]="DEMO_ORG_ID"
      [selectedViewId]="activeViewId()"
      [refreshTrigger]="leftPanelRefresh()"
      (viewSelected)="activeViewId.set($event)"
      (viewCreated)="activeViewId.set($event)"
      (viewDeleted)="onViewDeleted($event)"
    />

    <!-- Zone principale -->
    <main class="main-area">
      @if (activeViewId()) {
        <app-document-view
          [viewId]="activeViewId()!"
          (viewRequested)="onViewRequested($event)"
        />
      } @else {
        <!-- Vue Organisation (home) -->
        <div class="org-home" (click)="closeOrgCtx()">

          @if (orgLoading()) {
            <div class="org-spinner">Chargement…</div>

          } @else if (!orgClass()) {
            <!-- Méta-modèle non initialisé -->
            <div class="empty-state">
              <div class="empty-icon">📂</div>
              <p>Sélectionnez ou créez un document</p>
              <small>Clic droit dans le panneau gauche → Nouveau</small>
            </div>

          } @else if (orgElement()) {
            <!-- Nœud Organisation existant -->
            <div class="org-canvas">
              <div class="org-node" (contextmenu)="onOrgRightClick($event)"
                   [style.background]="orgColor()"
                   [style.box-shadow]="'0 0 0 1px ' + orgColor() + ', 0 4px 24px ' + orgColor() + '40'">
                <div class="org-node-label">{{ orgElement()!.label }}</div>
                <div class="org-node-class">Organisation</div>
              </div>
            </div>

            <!-- Menu contextuel clic droit -->
            @if (orgCtx.visible) {
              <div class="node-ctx"
                   [style.left.px]="orgCtx.x"
                   [style.top.px]="orgCtx.y"
                   (click)="$event.stopPropagation()">
                <div class="ctx-item" (click)="openEditOrg()">✏ Modifier</div>
                <div class="ctx-sep"></div>
                @if (orgCtxLoading()) {
                  <div class="ctx-item ctx-muted">Chargement des vues…</div>
                }
                @if (orgCtxData(); as vd) {
                  @if (vd.viewMenuItems.length > 0) {
                    <div class="ctx-section-label">Vues</div>
                    @for (item of vd.viewMenuItems; track $index) {
                      @if (item.mode === 'open') {
                        <div class="ctx-item" (click)="orgCtxOpenView(item.viewId!)">👁 {{ item.label }}</div>
                      } @else {
                        <div class="ctx-item" (click)="orgCtxCreateView(item.structure!)">＋ {{ item.label }}</div>
                      }
                    }
                  }
                }
              </div>
            }
          }

          <!-- Modale création / édition -->
          @if (orgModalMode()) {
            <app-element-form-modal
              [cls]="orgClass()!"
              [attrs]="orgAttrs()"
              [existing]="orgModalMode() === 'edit' ? orgElement()! : undefined"
              [allClasses]="allClasses()"
              (saved)="onOrgSaved($event)"
              (cancelled)="orgModalMode.set(null)"
            />
          }

        </div><!-- /org-home -->
      }
    </main>

  </div>
</div>
  `,
  styles: [`

    :host {
      display: block; height: 100vh;
      --bg-base: #0d0d0d;
      --bg-panel: #111;
      --border: #2a2a2a;
      --text-primary: #e8e8e8;
      --text-muted: #555;
      --topbar-h: 44px;
    }

    .shell { display:flex; flex-direction:column; height:100vh; background:var(--bg-base); color:var(--text-primary); font-family:'Syne',sans-serif; }

    /* Topbar */
    .topbar {
      height: var(--topbar-h); flex-shrink:0;
      display:flex; align-items:center; gap:1.5rem;
      padding:0 1rem; background:#0a0a0a; border-bottom:1px solid var(--border);
      z-index:50; position:relative;
    }
    .logo-img { height:22px; width:auto; display:block; object-fit:contain; }
    nav { display:flex; gap:1.5rem; }
    nav a { color:#555; text-decoration:none; font-size:.78rem; letter-spacing:.04em; }
    nav a:hover { color:#aaa; }
    nav a.nav-active { color:#a5b4fc; }
    .page-title {
      position:absolute; left:50%; transform:translateX(-50%);
      font-size:.82rem; font-weight:400; color:#555;
      letter-spacing:.02em; font-family:'JetBrains Mono',monospace;
      pointer-events:none;
    }
    .topbar-right { margin-left:auto; display:flex; align-items:center; gap:.6rem; }
    .user-badge { font-size:.75rem; color:#444; font-family:'JetBrains Mono',monospace; }
    .btn-admin {
      display:flex; align-items:center; justify-content:center;
      width:28px; height:28px; border-radius:5px;
      border:1px solid #2a2a2a; color:#555; opacity:.5; transition:all .15s;
    }
    .btn-admin:hover { border-color:#555; opacity:1; }
    .btn-logout { background:none; border:1px solid #2a2a2a; border-radius:5px; color:#555; padding:.3rem .7rem; cursor:pointer; font-size:.75rem; }
    .btn-logout:hover { color:#aaa; border-color:#555; }

    /* Corps */
    .body { display:flex; flex:1; overflow:hidden; }

    /* Zone principale */
    .main-area { flex:1; overflow:hidden; display:flex; flex-direction:column; }

    /* Vue Organisation */
    .org-home {
      flex:1; display:flex; align-items:center; justify-content:center;
      position:relative; overflow:hidden;
    }
    .org-canvas { display:flex; align-items:center; justify-content:center; flex:1; }
    .org-node {
      border:none; border-radius:10px;
      padding:1.1rem 1.6rem; min-width:170px; text-align:center;
      cursor:default; user-select:none; transition:box-shadow .15s;
    }
    .org-node-label { font-size:1rem; font-weight:600; color:#fff; }
    .org-node-class {
      font-size:.68rem; color:rgba(255,255,255,.6); margin-top:.25rem;
      font-family:'JetBrains Mono',monospace; letter-spacing:.04em;
    }

    /* Menu contextuel */
    .node-ctx {
      position:fixed; z-index:300; background:#151515;
      border:1px solid #3a3a3a; border-radius:8px; padding:5px; min-width:180px;
      box-shadow:0 8px 30px rgba(0,0,0,.8);
    }
    .ctx-item {
      padding:6px 12px; border-radius:5px; font-size:12px;
      cursor:pointer; color:#888; user-select:none;
    }
    .ctx-item:hover { background:#242424; color:#e8e8e8; }
    .ctx-muted { color:#444; cursor:default; font-style:italic; }
    .ctx-muted:hover { background:none; color:#444; }
    .ctx-sep { height:1px; background:#2a2a2a; margin:4px 0; }
    .ctx-section-label {
      padding:4px 12px 2px; font-size:10px; color:#444;
      letter-spacing:.06em; text-transform:uppercase;
    }

    /* Spinner */
    .org-spinner { color:#444; font-size:.85rem; }

    /* État vide (méta-modèle absent) */
    .empty-state {
      flex:1; display:flex; flex-direction:column;
      align-items:center; justify-content:center;
      gap:.75rem; color:#333;
    }
    .empty-icon { font-size:3rem; }
    .empty-state p { font-size:.9rem; color:#444; margin:0; }
    .empty-state small { font-size:.75rem; color:#2a2a2a; }
  `],
})
export class CanvasComponent implements OnInit {
  readonly auth    = inject(AuthService);
  private readonly api     = inject(ApiService);
  private readonly docApi  = inject(DocumentApiService);

  activeViewId      = signal<string | null>(null);
  leftPanelRefresh  = signal(0);

  // ── Signaux Organisation ───────────────────────────────────────────────────
  allClasses   = signal<ElementClass[]>([]);
  orgClass     = signal<ElementClass | null>(null);
  orgColor     = signal<string>('#6366f1');
  orgAttrs     = signal<AttributeDefinition[]>([]);
  orgElement   = signal<CmElement | null>(null);
  orgLoading   = signal(true);
  orgModalMode = signal<'create' | 'edit' | null>(null);
  orgCtx        = { visible: false, x: 0, y: 0 };
  orgCtxLoading = signal(false);
  orgCtxData    = signal<{ viewMenuItems: ViewMenuItem[] } | null>(null);

  /**
   * TODO : remplacer par l'ID de l'organisation réelle de l'utilisateur.
   * En production : charger depuis /auth/me → user.organisationId
   */
  readonly DEMO_ORG_ID = '00000000-0000-0000-0000-000000000001';

  onViewRequested(viewId: string) {
    this.activeViewId.set(viewId);
    this.leftPanelRefresh.update(n => n + 1);
  }

  onViewDeleted(viewId: string) {
    if (this.activeViewId() === viewId) {
      this.activeViewId.set(null);
    }
  }

  ngOnInit() {
    if (this.auth.getAccessToken()) {
      this.auth.getMe().subscribe();
    }
    this.loadOrgData();
  }

  // ── Chargement ─────────────────────────────────────────────────────────────

  loadOrgData() {
    this.orgLoading.set(true);
    forkJoin({
      classes: this.api.elementclasses.getClasses(),
      types:   this.api.elementclasses.getTypes(),
    }).subscribe({
      next: ({ classes, types }) => {
        this.allClasses.set(classes);
        const orgCls = classes.find(c => c.name === 'Organisation') ?? null;
        if (!orgCls) { this.orgLoading.set(false); return; }
        const orgType = types.find(t => t.id === orgCls.typeId);
        if (orgType?.color) this.orgColor.set(orgType.color);
        this.orgClass.set(orgCls);

        forkJoin({
          attrs:    this.api.elementclasses.getEffectiveAttrs(orgCls.id),
          elements: this.api.elements.getAll({ classId: orgCls.id }),
        }).subscribe({
          next: ({ attrs, elements }) => {
            this.orgAttrs.set(attrs);
            const el = elements[0] ?? null;
            this.orgElement.set(el);
            if (!el) this.orgModalMode.set('create');
            this.orgLoading.set(false);
          },
          error: () => this.orgLoading.set(false),
        });
      },
      error: () => this.orgLoading.set(false),
    });
  }

  // ── Callbacks ──────────────────────────────────────────────────────────────

  onOrgSaved(el: CmElement) {
    this.orgElement.set(el);
    this.orgModalMode.set(null);
    this.orgCtx.visible = false;
  }

  onOrgRightClick(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    this.orgCtx = { visible: true, x: e.clientX, y: e.clientY };
    this.orgCtxData.set(null);

    const el = this.orgElement();
    if (!el) return;

    this.orgCtxLoading.set(true);
    forkJoin({
      applicableStructures: this.docApi.structures.applicable(el.elementClassId),
      existingViews:        this.docApi.views.forElement(el.id),
      orgViews:             this.docApi.views.getAll(this.DEMO_ORG_ID),
    }).subscribe({
      next: ({ applicableStructures, existingViews, orgViews }) => {
        this.orgCtxData.set({ viewMenuItems: this.buildOrgViewMenuItems(applicableStructures, existingViews, orgViews) });
        this.orgCtxLoading.set(false);
      },
      error: () => this.orgCtxLoading.set(false),
    });
  }

  private buildOrgViewMenuItems(structures: Structure[], elementViews: any[], orgViews: any[]): ViewMenuItem[] {
    const items: ViewMenuItem[] = [];
    for (const s of structures) {
      const elementView = elementViews.find((v: any) => v.structureId === s.id);
      if (elementView) {
        items.push({ mode: 'open', label: s.name, viewId: elementView.id });
      } else {
        const globalViews = orgViews.filter((v: any) => v.structureId === s.id);
        const maxReached  = s.maxInstances != null && globalViews.length >= s.maxInstances;
        if (maxReached) {
          for (const gv of globalViews) {
            items.push({ mode: 'open', label: gv.name, viewId: gv.id });
          }
        } else {
          items.push({ mode: 'create', label: s.name, structure: s });
        }
      }
    }
    return items;
  }

  orgCtxOpenView(viewId: string) {
    this.orgCtx.visible = false;
    this.activeViewId.set(viewId);
    this.leftPanelRefresh.update(n => n + 1);
  }

  orgCtxCreateView(structure: Structure) {
    this.orgCtx.visible = false;
    const el = this.orgElement();
    if (!el) return;
    this.docApi.views.create({
      name: `${structure.name} — ${el.label}`,
      structureId: structure.id,
      organisationId: this.DEMO_ORG_ID,
      parentElementId: el.id,
    }).subscribe(view => {
      this.activeViewId.set(view.id);
      this.leftPanelRefresh.update(n => n + 1);
    });
  }

  openEditOrg() {
    this.orgCtx.visible = false;
    this.orgModalMode.set('edit');
  }

  closeOrgCtx() {
    this.orgCtx.visible = false;
  }
}
