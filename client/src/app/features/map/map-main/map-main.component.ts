import {
  Component, OnInit, inject, signal, input, effect,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { debounceTime, Subject, switchMap, of } from 'rxjs';
import { ApiService } from '../../../core/services/api.service';
import { Element as Cm2bElement, Relation, ElementClass } from '../../../core/models/api.models';
import { MapSelection } from '../map-nav/map-nav.component';
import { MapCanvasComponent } from '../map-canvas/map-canvas.component';
import { ListViewComponent } from '../../canvas/list-view/list-view.component';
import { ViewMembers } from '../../../core/models/document.models';

@Component({
  selector: 'app-map-main',
  standalone: true,
  imports: [CommonModule, FormsModule, MapCanvasComponent, ListViewComponent],
  template: `
<div class="main-shell">

  <!-- ── Context bar ── -->
  <div class="context-bar">
    <div class="context-left">
      @if (contextLabel()) {
        <span class="context-label">{{ contextLabel() }}</span>
        <span class="element-count">{{ nodes().length }} élément{{ nodes().length !== 1 ? 's' : '' }}</span>
      } @else {
        <span class="context-hint">Sélectionnez une structure</span>
      }
    </div>

    <!-- Recherche -->
    <div class="search-wrap">
      <input class="search-input"
        [(ngModel)]="searchQuery"
        (ngModelChange)="search$.next($event)"
        placeholder="🔍 Rechercher un élément…"/>
      @if (searchResults().length > 0) {
        <div class="search-dropdown">
          @for (el of searchResults(); track el.id) {
            <div class="search-item" (click)="focusNode(el)">
              <span class="search-cls">{{ el.elementClass?.name }}</span>
              <span class="search-lbl">{{ el.label }}</span>
            </div>
          }
        </div>
      }
    </div>

    <!-- Switch vue -->
    <div class="view-switch">
      <button [class.active]="viewMode() === 'carte'" (click)="viewMode.set('carte')">
        Carte
      </button>
      <button [class.active]="viewMode() === 'liste'" (click)="viewMode.set('liste')">
        Liste
      </button>
    </div>
  </div>

  <!-- ── Zone principale ── -->
  <div class="main-area">
    @if (loading()) {
      <div class="loading-state">Chargement…</div>
    } @else if (viewMode() === 'carte') {
      <app-map-canvas
        [nodes]="nodes()"
        [edges]="edges()"
        (positionChanged)="onMove($event)"
        (nodeSelected)="onNodeSelected($event)"
        (nodeDeleted)="onNodeDeleted($event)"
        (relationCreated)="reload()"
      />
    } @else {
      <app-list-view [members]="membersForList()" [allClasses]="allClasses()" />
    }
  </div>

  <!-- ── Panneau détail nœud ── -->
  @if (selectedNode()) {
    <div class="detail-panel">
      <div class="detail-header">
        <span class="detail-title">{{ selectedNode()!.label }}</span>
        <button class="detail-close" (click)="clearSelection()">✕</button>
      </div>
      <div class="detail-meta">
        <span class="detail-badge">{{ selectedNode()!.elementClass?.type?.name }}</span>
        <span class="detail-class">{{ selectedNode()!.elementClass?.name }}</span>
      </div>
      @if (selectedNode()!.attributeValues?.length) {
        <div class="detail-attrs">
          @for (av of selectedNode()!.attributeValues; track av.id) {
            @if (av.value) {
              <div class="attr-row">
                <span class="attr-name">{{ av.attributeDefinition?.name }}</span>
                <span class="attr-val">{{ av.value }}</span>
              </div>
            }
          }
        </div>
      }
      @if (selectedRelations().length) {
        <div class="detail-rels">
          <div class="rels-title">Relations</div>
          @for (r of selectedRelations(); track r.id) {
            <div class="rel-row">
              <span class="rel-type">{{ r.relationType }}</span>
              <span class="rel-target">{{ relTarget(r) }}</span>
            </div>
          }
        </div>
      }
    </div>
  }

  <!-- ── Toolbar bas ── -->
  <div class="toolbar">
    <img src="/cm2b.png" alt="CM2B" class="logo-img"/>
    <div class="toolbar-classes">
      @for (cls of visibleClasses(); track cls.id) {
        <button class="btn-add" (click)="openCreate(cls)">
          <span class="btn-dot" [style.background]="cls.color ?? cls.type?.color ?? '#555'"></span>
          + {{ cls.name }}
        </button>
      }
      @if (visibleClasses().length === 0 && contextLabel()) {
        <span class="toolbar-hint">Aucune classe disponible pour cette structure</span>
      }
    </div>
    <div class="toolbar-right">
      <span class="stat">
        Éléments : <strong>{{ nodes().length }}</strong>
      </span>
      <span class="stat">
        Relations : <strong>{{ edges().length }}</strong>
      </span>
    </div>
  </div>
</div>

<!-- Dialog création -->
@if (createDlg.visible) {
  <div class="dialog-backdrop" (click)="createDlg.visible = false">
    <div class="dialog" (click)="$event.stopPropagation()">
      <h4>Créer · {{ createDlg.className }}</h4>
      <input [(ngModel)]="createDlg.label"
        placeholder="Libellé de l'élément"
        (keydown.enter)="confirmCreate()"
        (keydown.escape)="createDlg.visible = false"/>
      @if (createDlg.error) { <div class="dlg-error">{{ createDlg.error }}</div> }
      <div class="dlg-btns">
        <button (click)="createDlg.visible = false">Annuler</button>
        <button class="primary" (click)="confirmCreate()">Créer</button>
      </div>
    </div>
  </div>
}
  `,
  styles: [`
    :host { display:flex; flex-direction:column; height:100%; overflow:hidden; }

    .main-shell { display:flex; flex-direction:column; height:100%; position:relative; }

    /* ── Context bar ── */
    .context-bar {
      display:flex; align-items:center; gap:.8rem;
      padding:.45rem 1rem; background:#111;
      border-bottom:1px solid #2a2a2a; flex-shrink:0; flex-wrap:wrap;
      font-family:'Syne',sans-serif;
    }
    .context-left { display:flex; align-items:center; gap:.5rem; min-width:0; }
    .context-label {
      font-size:.9rem; font-weight:600; color:#e8e8e8;
      white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:220px;
    }
    .context-hint { font-size:.82rem; color:#444; font-style:italic; }
    .element-count {
      font-size:.7rem; font-family:'JetBrains Mono',monospace;
      color:#555; background:#1c1c1c; border:1px solid #2a2a2a;
      border-radius:10px; padding:.1rem .5rem;
    }

    /* Search */
    .search-wrap { position:relative; flex:1; min-width:160px; max-width:320px; }
    .search-input {
      width:100%; background:#1c1c1c; border:1px solid #2a2a2a;
      border-radius:6px; color:#e8e8e8; font-size:.82rem;
      padding:.42rem .75rem; outline:none; font-family:'Syne',sans-serif;
    }
    .search-input:focus { border-color:#4f46e5; }
    .search-dropdown {
      position:absolute; top:calc(100% + 4px); left:0; right:0; z-index:200;
      background:#151515; border:1px solid #3a3a3a; border-radius:8px;
      box-shadow:0 8px 24px rgba(0,0,0,.7); max-height:220px; overflow-y:auto;
    }
    .search-item {
      display:flex; gap:.5rem; align-items:center;
      padding:.45rem .75rem; cursor:pointer; border-bottom:1px solid #1e1e1e;
      font-family:'Syne',sans-serif;
    }
    .search-item:hover { background:#1e1e1e; }
    .search-cls { font-size:.7rem; color:#4f46e5; white-space:nowrap; }
    .search-lbl { font-size:.82rem; color:#ccc; }

    /* View switch */
    .view-switch { display:flex; border:1px solid #2a2a2a; border-radius:6px; overflow:hidden; }
    .view-switch button {
      padding:.32rem .75rem; background:none; border:none; color:#666;
      cursor:pointer; font-size:.78rem; font-family:'Syne',sans-serif;
      transition:all .12s;
    }
    .view-switch button.active { background:#1e1b3a; color:#a5b4fc; }
    .view-switch button:hover:not(.active) { color:#aaa; }

    /* ── Main area ── */
    .main-area { flex:1; overflow:hidden; position:relative; }

    .loading-state {
      display:flex; align-items:center; justify-content:center;
      height:100%; color:#444; font-size:.9rem; font-family:'Syne',sans-serif;
    }

    /* ── Detail panel ── */
    .detail-panel {
      position:absolute; top:0; right:0; bottom:56px;
      width:260px; background:#111; border-left:1px solid #2a2a2a;
      overflow-y:auto; z-index:50; font-family:'Syne',sans-serif;
      display:flex; flex-direction:column;
    }
    .detail-header {
      display:flex; align-items:center; justify-content:space-between;
      padding:.65rem .75rem; border-bottom:1px solid #2a2a2a;
    }
    .detail-title { font-size:.9rem; font-weight:600; color:#e8e8e8; }
    .detail-close {
      background:none; border:none; color:#555; cursor:pointer; font-size:.9rem;
    }
    .detail-close:hover { color:#aaa; }
    .detail-meta {
      display:flex; gap:.4rem; flex-wrap:wrap;
      padding:.45rem .75rem; border-bottom:1px solid #1a1a1a;
    }
    .detail-badge {
      font-size:.65rem; background:#1e1b3a; color:#818cf8;
      border:1px solid #3730a3; border-radius:8px; padding:.1rem .45rem;
    }
    .detail-class { font-size:.72rem; color:#555; align-self:center; }
    .detail-attrs { padding:.5rem .75rem; display:flex; flex-direction:column; gap:.35rem; }
    .attr-row { display:flex; flex-direction:column; gap:.15rem; }
    .attr-name { font-size:.65rem; color:#555; text-transform:uppercase; letter-spacing:.06em; }
    .attr-val { font-size:.8rem; color:#ccc; font-family:'JetBrains Mono',monospace; }
    .detail-rels { padding:.5rem .75rem; }
    .rels-title {
      font-size:.65rem; color:#555; text-transform:uppercase;
      letter-spacing:.08em; margin-bottom:.4rem;
    }
    .rel-row { display:flex; flex-direction:column; gap:.12rem; margin-bottom:.4rem; }
    .rel-type { font-size:.65rem; color:#4f46e5; }
    .rel-target { font-size:.78rem; color:#aaa; }

    /* ── Toolbar ── */
    .toolbar {
      display:flex; align-items:center; gap:.5rem; flex-wrap:wrap;
      padding:.45rem 1rem; background:#111; border-top:1px solid #2a2a2a;
      flex-shrink:0; min-height:48px; font-family:'Syne',sans-serif;
    }
    .logo-img { height:22px; width:auto; display:block; object-fit:contain; margin-right:.25rem; }
    .toolbar-classes { display:flex; align-items:center; gap:.4rem; flex-wrap:wrap; flex:1; }
    .btn-add {
      display:flex; align-items:center; gap:.4rem;
      padding:.28rem .65rem; background:#1c1c1c; border:1px solid #3a3a3a;
      border-radius:5px; color:#aaa; cursor:pointer; font-size:.76rem;
      font-family:'Syne',sans-serif; transition:all .12s; white-space:nowrap;
    }
    .btn-add:hover { background:#2a2a2a; border-color:#555; color:#e8e8e8; }
    .btn-dot { width:8px; height:8px; border-radius:50%; flex-shrink:0; }
    .toolbar-hint { font-size:.75rem; color:#333; font-style:italic; }
    .toolbar-right { margin-left:auto; display:flex; gap:.75rem; }
    .stat { font-size:.72rem; color:#444; font-family:'JetBrains Mono',monospace; }
    .stat strong { color:#666; }

    /* ── Dialog ── */
    .dialog-backdrop {
      position:fixed; inset:0; background:rgba(0,0,0,.7);
      z-index:500; display:flex; align-items:center; justify-content:center;
    }
    .dialog {
      background:#151515; border:1px solid #3a3a3a; border-radius:10px;
      padding:1.25rem; min-width:300px; display:flex; flex-direction:column; gap:.75rem;
      font-family:'Syne',sans-serif;
    }
    .dialog h4 { font-size:.9rem; color:#e8e8e8; margin:0; }
    .dialog input {
      background:#1c1c1c; border:1px solid #3a3a3a; border-radius:6px;
      color:#e8e8e8; font-size:.88rem; padding:.55rem .75rem; outline:none;
    }
    .dialog input:focus { border-color:#6366f1; }
    .dlg-error { font-size:.78rem; color:#f87171; }
    .dlg-btns { display:flex; gap:.5rem; justify-content:flex-end; }
    .dlg-btns button {
      padding:.4rem .9rem; border-radius:5px; border:1px solid #3a3a3a;
      background:none; color:#888; cursor:pointer; font-size:.82rem;
      font-family:'Syne',sans-serif;
    }
    .dlg-btns button.primary { background:#4f46e5; border-color:#4f46e5; color:white; }
  `],
})
export class MapMainComponent implements OnInit {
  private readonly api = inject(ApiService);

  selection = input<MapSelection | null>(null);

  nodes      = signal<Cm2bElement[]>([]);
  edges      = signal<Relation[]>([]);
  allClasses = signal<ElementClass[]>([]);
  loading    = signal(false);
  viewMode   = signal<'carte' | 'liste'>('carte');

  contextLabel    = signal('');
  selectedNode    = signal<Cm2bElement | null>(null);
  selectedRelations = signal<Relation[]>([]);

  searchQuery   = '';
  searchResults = signal<Cm2bElement[]>([]);
  search$       = new Subject<string>();

  createDlg = {
    visible: false, className: '', classId: '', label: '', error: '',
  };

  visibleClasses = signal<ElementClass[]>([]);

  membersForList = (): any => ({
    viewId: '',
    viewName: this.contextLabel(),
    structureId: null,
    allowedClassIds: [],
    nodes: this.nodes(),
    edges: this.edges(),
    hasPerViewPositions: true,
  } as ViewMembers);

  constructor() {
    effect(() => {
      const sel = this.selection();
      if (sel) this.load(sel);
    });
  }

  ngOnInit() {
    this.api.elementclasses.getClasses().subscribe(c => this.allClasses.set(c));

    this.search$.pipe(
      debounceTime(280),
      switchMap(q => q.length > 1
        ? this.api.elements.getAll({ search: q })
        : of([])
      ),
    ).subscribe(r => this.searchResults.set(r));
  }

  private load(sel: MapSelection) {
    this.contextLabel.set(sel.label === '__all__' ? 'Tout' : sel.label);
    this.selectedNode.set(null);
    this.loading.set(true);

    const filters = sel.classIds.length ? { classIds: sel.classIds } : undefined;

    this.api.graph.get(filters).subscribe({
      next: ({ nodes, edges }) => {
        this.nodes.set(nodes);
        this.edges.set(edges);
        this.loading.set(false);
        this.updateVisibleClasses(sel.classIds);
      },
      error: () => this.loading.set(false),
    });
  }

  reload() {
    const sel = this.selection();
    if (sel) this.load(sel);
  }

  private updateVisibleClasses(classIds: string[]) {
    if (!classIds.length) {
      this.visibleClasses.set(this.allClasses().slice(0, 10));
    } else {
      this.visibleClasses.set(
        this.allClasses().filter(c => classIds.includes(c.id))
      );
    }
  }

  // ── Events from canvas ────────────────────────────────────────────────────

  onMove(ev: { id: string; x: number; y: number }) {
    this.api.elements.move(ev.id, ev.x, ev.y).subscribe();
  }

  onNodeSelected(id: string | null) {
    if (!id) { this.selectedNode.set(null); return; }
    this.api.elements.getWithRelations(id).subscribe(({ element, outgoing, incoming }) => {
      this.selectedNode.set(element);
      this.selectedRelations.set([...outgoing, ...incoming]);
    });
  }

  onNodeDeleted(id: string) {
    this.nodes.update(ns => ns.filter(n => n.id !== id));
    this.edges.update(es => es.filter(e => e.sourceId !== id && e.targetId !== id));
    if (this.selectedNode()?.id === id) this.selectedNode.set(null);
  }

  clearSelection() { this.selectedNode.set(null); }

  relTarget(r: Relation): string {
    const id  = this.selectedNode()?.id;
    const target = r.sourceId === id ? r.target : r.source;
    return target?.label ?? r.targetId;
  }

  // ── Search ────────────────────────────────────────────────────────────────

  focusNode(el: Cm2bElement) {
    this.searchQuery = '';
    this.searchResults.set([]);
    // Add to canvas if not there already
    if (!this.nodes().find(n => n.id === el.id)) {
      this.nodes.update(ns => [...ns, el]);
    }
    this.onNodeSelected(el.id);
  }

  // ── Create element ────────────────────────────────────────────────────────

  openCreate(cls: ElementClass) {
    this.createDlg = { visible: true, className: cls.name, classId: cls.id, label: '', error: '' };
  }

  confirmCreate() {
    if (!this.createDlg.label.trim()) return;
    this.api.elements.create({
      label: this.createDlg.label.trim(),
      elementClassId: this.createDlg.classId,
    }).subscribe({
      next: el => {
        this.createDlg.visible = false;
        this.nodes.update(ns => [...ns, el]);
      },
      error: err => { this.createDlg.error = err?.error?.message ?? 'Erreur'; },
    });
  }
}
