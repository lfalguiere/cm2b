// src/app/features/canvas/document-view/document-view.component.ts
import {
  Component, OnInit, OnChanges, input, output, inject, signal, computed, SimpleChanges
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DocumentApiService } from '../../../core/services/document-api.service';
import { ApiService } from '../../../core/services/api.service';
import { ViewMembers, Structure } from '../../../core/models/document.models';
import { ElementClass, Element as Cm2bElement } from '../../../core/models/api.models';
import { GraphStore } from '../graph.store';
import { CanvasViewComponent } from '../canvas-view/canvas-view.component';
import { ListViewComponent } from '../list-view/list-view.component';
import { ElementEditPanelComponent } from '../element-edit-panel/element-edit-panel.component';
import { debounceTime, forkJoin, Observable, Subject, switchMap, of } from 'rxjs';

@Component({
  selector: 'app-document-view',
  standalone: true,
  imports: [CommonModule, FormsModule, CanvasViewComponent, ListViewComponent, ElementEditPanelComponent],
  providers: [GraphStore],
  template: `
<div class="doc-view">

  <!-- ── Topbar ── -->
  <div class="doc-topbar">
    <div class="doc-title">
      <span class="doc-name">{{viewName()}}</span>
      @if (structure()) {
        <span class="struct-badge">{{structure()!.structureType}}</span>
      }
    </div>

    <!-- Recherche -->
    <div class="search-wrap">
      <input class="search-input" [(ngModel)]="searchQuery"
        (ngModelChange)="onSearch($event)"
        placeholder="🔍 Rechercher un élément à ajouter…"/>
      @if (searchResults().length > 0) {
        <div class="search-dropdown">
          @for (el of searchResults(); track el.id) {
            <div class="search-item" (click)="addMember(el)">
              <span class="search-class">{{el.elementClass?.name}}</span>
              <span class="search-label">{{el.label}}</span>
            </div>
          }
        </div>
      }
    </div>

    <!-- Switch vue -->
    <div class="view-switch">
      <button [class.active]="viewMode() === 'carte'" (click)="viewMode.set('carte')">
        🗺 Carte
      </button>
      <button [class.active]="viewMode() === 'liste'" (click)="setListMode()">
        ☰ Liste
      </button>
    </div>
  </div>

  <!-- ── Zone principale ── -->
  <div class="doc-main">
    @if (viewMode() === 'carte') {
      <app-canvas-view
        [viewId]="viewId()"
        [members]="members()"
        [allowedClassIds]="allowedClassIds()"
        [allClasses]="allClasses()"
        [organisationId]="organisationId()"
        (memberRemoved)="onMemberRemoved($event)"
        (positionChanged)="onPositionChanged($event)"
        (editRequested)="editElementId.set($event)"
        (viewRequested)="viewRequested.emit($event)"
        (createViewRequested)="onCreateViewRequested($event)"
      />
    } @else {
      <app-list-view
        [members]="members()"
        [allClasses]="allClasses()"
        [filterQuery]="searchQuery"
        [extraEdges]="listRelations()"
        (editRequested)="editElementId.set($event)"
      />
    }
    <app-element-edit-panel
      [elementId]="editElementId()"
      (saved)="onEditSaved()"
      (closed)="editElementId.set(null)"
      (relationsCreated)="onRelationsCreated($event)"
    />
  </div>

  <!-- ── Palette bas ── -->
  <div class="palette">
    <span class="palette-label">Créer :</span>
    @for (cls of allowedClasses(); track cls.id) {
      <button class="palette-btn" [style.border-left-color]="effectiveColor(cls) || '#3a3a3a'" (click)="openCreateDialog(cls)">
        <span class="cls-dot" [style.background]="effectiveColor(cls) || '#4f46e5'"></span>+ {{cls.name}}
      </button>
    }
    @if (allowedClasses().length === 0) {
      <span class="palette-hint">Vue libre — tous types disponibles</span>
      @for (cls of allClasses().slice(0, 8); track cls.id) {
        <button class="palette-btn" [style.border-left-color]="effectiveColor(cls) || '#3a3a3a'" (click)="openCreateDialog(cls)">
          <span class="cls-dot" [style.background]="effectiveColor(cls) || '#4f46e5'"></span>+ {{cls.name}}
        </button>
      }
    }
  </div>
</div>

<!-- Dialog création élément -->
@if (createDialog.visible) {
  <div class="dialog-backdrop" (click)="createDialog.visible = false">
    <div class="dialog" (click)="$event.stopPropagation()">
      <h4>Créer · {{createDialog.className}}</h4>
      <input [(ngModel)]="createDialog.label" placeholder="Libellé de l'élément"
        (keydown.enter)="confirmCreate()" (keydown.escape)="createDialog.visible = false"/>
      @if (createDialog.error) { <div class="dialog-error">{{createDialog.error}}</div> }
      <div class="dialog-btns">
        <button (click)="createDialog.visible = false">Annuler</button>
        <button class="primary" (click)="confirmCreate()">Créer</button>
      </div>
    </div>
  </div>
}
  `,
  styles: [`
    :host { display:flex; flex-direction:column; height:100%; overflow:hidden; }

    .doc-view { display:flex; flex-direction:column; height:100%; }

    /* Topbar */
    .doc-topbar {
      display:flex; align-items:center; gap:1rem;
      height:44px; box-sizing:border-box;
      padding:0 1rem; background:#111;
      border-bottom:1px solid #2a2a2a; flex-shrink:0;
    }
    .doc-title { display:flex; align-items:center; gap:.5rem; min-width:0; }
    .doc-name { font-size:.9rem; font-weight:600; color:#e8e8e8; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:200px; }
    .struct-badge {
      font-size:.68rem; padding:.15rem .5rem; border-radius:10px;
      background:#1e1b3a; color:#818cf8; border:1px solid #3730a3;
      white-space:nowrap;
    }

    /* Recherche */
    .search-wrap { position:relative; flex:1; min-width:180px; max-width:360px; }
    .search-input {
      width:100%; background:#1c1c1c; border:1px solid #2a2a2a;
      border-radius:6px; color:#e8e8e8; font-size:.82rem; padding:.45rem .75rem; outline:none;
    }
    .search-input:focus { border-color:#4f46e5; }
    .search-dropdown {
      position:absolute; top:calc(100% + 4px); left:0; right:0; z-index:200;
      background:#151515; border:1px solid #3a3a3a; border-radius:8px;
      box-shadow:0 8px 24px rgba(0,0,0,.7); max-height:240px; overflow-y:auto;
    }
    .search-item {
      display:flex; gap:.5rem; align-items:center;
      padding:.5rem .75rem; cursor:pointer; border-bottom:1px solid #1e1e1e;
    }
    .search-item:hover { background:#1e1e1e; }
    .search-class { font-size:.7rem; color:#4f46e5; white-space:nowrap; }
    .search-label { font-size:.82rem; color:#ccc; }

    /* Switch vue */
    .view-switch { display:flex; border:1px solid #2a2a2a; border-radius:6px; overflow:hidden; }
    .view-switch button {
      padding:.35rem .75rem; background:none; border:none; color:#666;
      cursor:pointer; font-size:.78rem; transition:all .15s;
    }
    .view-switch button.active { background:#1e1b3a; color:#a5b4fc; }
    .view-switch button:hover:not(.active) { color:#aaa; }

    /* Zone principale */
    .doc-main { flex:1; overflow:hidden; position:relative; }

    /* Palette bas */
    .palette {
      display:flex; align-items:center; gap:.5rem; flex-wrap:wrap;
      padding:.5rem 1rem; background:#111; border-top:1px solid #2a2a2a;
      flex-shrink:0; min-height:48px;
    }
    .palette-label { font-size:.7rem; color:#555; letter-spacing:.06em; text-transform:uppercase; white-space:nowrap; }
    .palette-btn {
      display:flex; align-items:center; gap:.35rem;
      padding:.3rem .7rem; background:#1c1c1c;
      border:1px solid #3a3a3a; border-left-width:3px;
      border-radius:5px; color:#aaa; cursor:pointer; font-size:.78rem;
      font-family:'Syne',sans-serif; transition:all .12s; white-space:nowrap;
    }
    .palette-btn:hover { background:#2a2a2a; color:#e8e8e8; }
    .cls-dot { width:7px; height:7px; border-radius:50%; flex-shrink:0; }
    .palette-hint { font-size:.75rem; color:#444; font-style:italic; }

    /* Dialog */
    .dialog-backdrop { position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:500;display:flex;align-items:center;justify-content:center; }
    .dialog { background:#151515;border:1px solid #3a3a3a;border-radius:10px;padding:1.25rem;min-width:300px;display:flex;flex-direction:column;gap:.75rem; }
    .dialog h4 { font-size:.9rem;color:#e8e8e8;margin:0; }
    .dialog input { background:#1c1c1c;border:1px solid #3a3a3a;border-radius:6px;color:#e8e8e8;font-size:.88rem;padding:.55rem .75rem;outline:none; }
    .dialog input:focus { border-color:#6366f1; }
    .dialog-error { font-size:.78rem;color:#f87171; }
    .dialog-btns { display:flex;gap:.5rem;justify-content:flex-end; }
    .dialog-btns button { padding:.4rem .9rem;border-radius:5px;border:1px solid #3a3a3a;background:none;color:#888;cursor:pointer;font-size:.82rem; }
    .dialog-btns button.primary { background:#4f46e5;border-color:#4f46e5;color:white; }
  `],
})
export class DocumentViewComponent implements OnInit, OnChanges {
  private readonly docApi = inject(DocumentApiService);
  private readonly api    = inject(ApiService);

  viewId = input.required<string>();

  viewRequested = output<string>();

  viewName        = signal('');
  organisationId  = signal('');
  members         = signal<ViewMembers | null>(null);
  structure       = signal<Structure | null>(null);
  viewMode      = signal<'carte' | 'liste'>('carte');
  allClasses    = signal<ElementClass[]>([]);
  editElementId = signal<string | null>(null);
  listRelations = signal<any[]>([]);

  searchQuery   = '';
  searchResults = signal<Cm2bElement[]>([]);
  private search$ = new Subject<string>();

  createDialog = { visible: false, className: '', classId: '', label: '', error: '' };

  allowedClassIds = computed(() => this.members()?.allowedClassIds ?? []);

  allowedClasses = computed(() => {
    const ids = this.allowedClassIds();
    if (ids.length === 0) return [];
    return this.allClasses().filter(c => ids.includes(c.id));
  });

  ngOnInit() {
    this.api.elementclasses.getClasses().subscribe(c => this.allClasses.set(c));
    this.loadView();

    this.search$.pipe(
      debounceTime(300),
      switchMap(q => q.length > 1
        ? this.docApi.views.search(this.viewId(), q)
        : of([])
      ),
    ).subscribe(results => this.searchResults.set(results));
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['viewId'] && !changes['viewId'].firstChange) {
      this.loadView();
    }
  }

  private loadView() {
    this.docApi.views.getOne(this.viewId()).subscribe(view => {
      this.viewName.set(view.name);
      this.organisationId.set(view.organisationId);
      if (view.structureId) {
        this.docApi.structures.getOne(view.structureId).subscribe(s => this.structure.set(s));
      } else {
        this.structure.set(null);
      }
    });
    this.docApi.views.getMembers(this.viewId()).subscribe(m => {
      this.members.set(m);
      if (this.viewMode() === 'liste') this.loadListRelations(m);
    });
  }

  effectiveColor(cls: ElementClass): string {
    let currentId: string | null | undefined = cls.id;
    const all = this.allClasses();
    while (currentId) {
      const c = all.find(c => c.id === currentId);
      if (c?.color) return c.color;
      currentId = c?.parentClassId;
    }
    return '';
  }

  // ── Modes de vue ──────────────────────────────────────────────────────────

  setListMode() {
    this.viewMode.set('liste');
    this.loadListRelations();
  }

  private loadListRelations(m?: any) {
    const members = m ?? this.members();
    if (!members?.nodes?.length) { this.listRelations.set([]); return; }
    const obs: Observable<any>[] = members.nodes.map((n: any) => this.api.elements.getWithRelations(n.id));
    forkJoin(obs).subscribe({
      next: (results) =>
        this.listRelations.set(results.flatMap((r: any) => [...r.outgoing, ...r.incoming])),
      error: () => this.listRelations.set([]),
    });
  }

  // ── Recherche ─────────────────────────────────────────────────────────────

  onSearch(q: string) { this.search$.next(q); }

  addMember(el: Cm2bElement) {
    this.searchQuery = '';
    this.searchResults.set([]);
    this.docApi.views.addMember(this.viewId(), el.id).subscribe(() => {
      this.loadView();
    });
  }

  // ── Création d'élément ────────────────────────────────────────────────────

  openCreateDialog(cls: ElementClass) {
    this.createDialog = { visible: true, className: cls.name, classId: cls.id, label: '', error: '' };
  }

  confirmCreate() {
    if (!this.createDialog.label.trim()) return;
    this.api.elements.create({
      label: this.createDialog.label.trim(),
      elementClassId: this.createDialog.classId,
    }).subscribe({
      next: (el) => {
        this.createDialog.visible = false;
        this.docApi.views.addMember(this.viewId(), el.id).subscribe(() => {
          this.loadView();
        });
      },
      error: (err) => { this.createDialog.error = err?.error?.message ?? 'Erreur'; },
    });
  }

  // ── Événements depuis le canvas ───────────────────────────────────────────

  onMemberRemoved(elementId: string) {
    this.docApi.views.removeMember(this.viewId(), elementId).subscribe(() => {
      this.loadView();
    });
  }

  onPositionChanged(ev: { id: string; x: number; y: number }) {
    this.docApi.views.moveInView(this.viewId(), ev.id, ev.x, ev.y).subscribe();
  }

  onEditSaved() {
    this.editElementId.set(null);
    this.loadView();
  }

  onCreateViewRequested(ev: { structureId: string; structureName: string; elementId: string; elementLabel: string }) {
    const orgId = this.organisationId();
    if (!orgId) return;
    this.docApi.views.create({
      name: `${ev.structureName} — ${ev.elementLabel}`,
      structureId: ev.structureId,
      organisationId: orgId,
      parentElementId: ev.elementId,
    }).subscribe(view => {
      this.viewRequested.emit(view.id);
    });
  }

  onRelationsCreated(ids: string[]) {
    const currentIds = new Set((this.members()?.nodes ?? []).map((n: any) => n.id));
    const toCheck = ids.filter(id => !currentIds.has(id));
    if (!toCheck.length) return;
    const allowed = this.allowedClassIds();
    forkJoin(toCheck.map(id => this.api.elements.getOne(id))).subscribe(elements => {
      const toAdd = elements.filter(el =>
        allowed.length === 0 || allowed.includes(el.elementClassId)
      );
      if (!toAdd.length) return;
      forkJoin(toAdd.map(el => this.docApi.views.addMember(this.viewId(), el.id)))
        .subscribe(() => this.loadView());
    });
  }
}
