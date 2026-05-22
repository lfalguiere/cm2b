// src/app/features/liste/liste.component.ts
import { Component, OnInit, inject, signal, computed, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { combineLatest, forkJoin, of, Subject, EMPTY } from 'rxjs';
import { debounceTime, switchMap } from 'rxjs';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';
import {
  ElementClass, AttributeDefinition, Element as CmElement, EnumOption,
} from '../../core/models/api.models';
import { ElementEditPanelComponent } from '../canvas/element-edit-panel/element-edit-panel.component';

@Component({
  selector: 'app-liste',
  standalone: true,
  imports: [CommonModule, RouterModule, ElementEditPanelComponent],
  template: `
<div class="shell">

  <!-- ── Topbar ── -->
  <header class="topbar">
    <img src="/cm2b.png" alt="CM2B" class="logo-img"/>
    <nav>
      <a href="/map">Cartographie</a>
      <a href="/liste" class="nav-active">Elements</a>
    </nav>
    <span class="page-title">Liste des éléments</span>
    <div class="topbar-right">
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

  <div class="body">

    <!-- ── Sidebar : classes ── -->
    <aside class="sidebar">
      <div class="sidebar-head">Classes</div>
      <div class="class-list">
        @for (cls of filteredClasses(); track cls.id) {
          <div class="cls-row"
            [class.active]="selectedClass()?.id === cls.id"
            (click)="selectClass(cls)"
            (contextmenu)="onClassCtx($event, cls)">
            <span class="cls-dot" [style.background]="effectiveColor(cls)"></span>
            <span class="cls-name">{{ cls.name }}</span>
            @if (selectedClass()?.id === cls.id && !loading()) {
              <span class="cls-count">{{ filteredRows().length }}</span>
            }
          </div>
        }
      </div>
    </aside>

    <!-- ── Zone principale ── -->
    <main class="main">

      <div class="search-bar">
        @if (selectedClass()) {
          <span class="cls-title-dot" [style.background]="effectiveColor(selectedClass()!)"></span>
          <span class="cls-title">{{ selectedClass()!.name }}</span>
          @if (selectedClass()!.type?.name) {
            <span class="type-badge">{{ selectedClass()!.type!.name }}</span>
          }
        }
        <input class="search-input" type="search"
               [value]="searchQuery()"
               (input)="onSearchInput($any($event.target).value)"
               placeholder="🔍 Rechercher une classe, un élément ou une propriété…"/>
        @if (selectedClass() && !loading()) {
          <span class="count-badge">{{ filteredRows().length }}{{ searchQuery() ? ' / ' + rows().length : '' }} élément{{ rows().length !== 1 ? 's' : '' }}</span>
        }
      </div>

      @if (!selectedClass()) {
        @if (!searchQuery()) {
          <div class="empty-state">
            <div class="empty-icon">☰</div>
            <p>Sélectionnez une classe dans le panneau gauche</p>
          </div>
        } @else if (globalSearching()) {
          <div class="loading">Recherche…</div>
        } @else if (globalRows().length > 0) {
          <div class="scroll-wrap">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Classe</th>
                  <th class="th-label">Libellé</th>
                </tr>
              </thead>
              <tbody>
                @for (el of globalRows(); track el.id) {
                  @let cls = getClass(el.elementClassId);
                  <tr (click)="cls && selectClass(cls)" style="cursor:pointer">
                    <td>
                      <span style="display:inline-flex;align-items:center;gap:.4rem">
                        <span class="cls-dot" [style.background]="cls ? effectiveColor(cls) : '#4f46e5'"></span>
                        {{ cls?.name ?? '?' }}
                      </span>
                    </td>
                    <td class="td-label">{{ el.label }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        } @else {
          <div class="table-empty">Aucun résultat pour "{{ searchQuery() }}".</div>
        }
      }

      @if (loading()) {
        <div class="loading">Chargement…</div>
      }

      @if (selectedClass() && !loading()) {
        <div class="table-wrap">

          @if (filteredRows().length === 0) {
            <div class="table-empty">{{ searchQuery() ? 'Aucun résultat pour "' + searchQuery() + '".' : 'Aucun élément pour cette classe.' }}</div>
          } @else {
            <div class="scroll-wrap">
              <table class="data-table">
                <thead>
                  <tr>
                    <th class="th-label">Libellé</th>
                    @for (attr of sortedAttrs(); track attr.id) {
                      <th [class.th-complex]="attr.kind === 'COMPLEX'"
                          [title]="attr.description || ''">{{ attr.name }}</th>
                    }
                    <th class="th-actions"></th>
                  </tr>
                </thead>
                <tbody>
                  @for (row of filteredRows(); track row.id) {
                    <tr>
                      <td class="td-label">{{ row.label }}</td>
                      @for (attr of sortedAttrs(); track attr.id) {
                        <td [title]="cellTooltip(row, attr)">{{ cellValue(row, attr) }}</td>
                      }
                      <td class="td-actions">
                        <button class="btn-edit" (click)="editElementId.set(row.id)" title="Éditer">✏️</button>
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }
        </div>
      }

    </main>
  </div>
</div>

<!-- Context menu classe -->
@if (ctx.visible) {
  <div class="ctx-menu" [style.left.px]="ctx.x" [style.top.px]="ctx.y">
    <div class="ctx-item" (click)="startCreate(ctx.classId)">＋ Ajouter un élément</div>
  </div>
}

<app-element-edit-panel
  [elementId]="editElementId()"
  [createForClassId]="createForClassId()"
  (saved)="onPanelSaved()"
  (closed)="onPanelClosed()"
/>
  `,
  styles: [`

    :host {
      display: block; height: 100vh;
      --bg: #0d0d0d; --bg-panel: #111; --bg-card: #1c1c1c;
      --border: #2a2a2a; --border-b: #3a3a3a;
      --text: #e8e8e8; --muted: #555; --dim: #888;
      --accent: #6366f1;
      font-family: 'Syne', sans-serif; color: var(--text);
    }

    .shell { display: flex; flex-direction: column; height: 100vh; background: var(--bg); }

    /* ── Topbar ── */
    .topbar {
      height: 44px; flex-shrink: 0;
      display: flex; align-items: center; gap: 1.5rem;
      padding: 0 1rem; background: #0a0a0a;
      border-bottom: 1px solid var(--border);
      position: relative;
    }
    .logo-img { height: 22px; width: auto; display: block; object-fit: contain; }
    nav { display: flex; gap: 1.5rem; }
    nav a { color: #555; text-decoration: none; font-size: .78rem; letter-spacing: .04em; }
    nav a:hover { color: #aaa; }
    nav a.nav-active { color: #a5b4fc; }
    .page-title {
      position: absolute; left: 50%; transform: translateX(-50%);
      font-size: .82rem; font-weight: 400; color: #555;
      letter-spacing: .02em; font-family: 'JetBrains Mono', monospace;
      pointer-events: none;
    }
    .search-bar {
      height: 44px; box-sizing: border-box;
      padding: 0 1.25rem; border-bottom: 1px solid var(--border);
      flex-shrink: 0; display: flex; align-items: center; gap: .6rem;
    }
    .search-input {
      flex: 1; max-width: 340px; min-width: 0;
      background: #1a1a1a; border: 1px solid #2a2a2a;
      border-radius: 5px; color: #e8e8e8; font-size: .8rem;
      padding: .35rem .7rem; outline: none; font-family: 'Syne', sans-serif;
    }
    .search-input:focus { border-color: #4f46e5; }
    .search-input::placeholder { color: #444; }
    .topbar-right { margin-left: auto; display: flex; align-items: center; gap: .6rem; }
    .btn-admin {
      display: flex; align-items: center; justify-content: center;
      width: 28px; height: 28px; border-radius: 5px;
      border: 1px solid #2a2a2a; opacity: .5; transition: all .15s;
    }
    .btn-admin:hover { border-color: #555; opacity: 1; }
    .btn-logout { background: none; border: 1px solid #2a2a2a; border-radius: 5px; color: #555; padding: .3rem .7rem; cursor: pointer; font-size: .75rem; font-family: 'Syne', sans-serif; }
    .btn-logout:hover { color: #aaa; border-color: #555; }

    /* ── Body ── */
    .body { display: flex; flex: 1; overflow: hidden; }

    /* ── Sidebar ── */
    .sidebar {
      width: 220px; flex-shrink: 0;
      background: var(--bg-panel); border-right: 1px solid var(--border);
      display: flex; flex-direction: column; overflow: hidden;
    }
    .sidebar-head {
      height: 44px; box-sizing: border-box;
      padding: 0 .75rem; border-bottom: 1px solid var(--border);
      display: flex; align-items: center;
      font-size: .68rem; font-weight: 700; text-transform: uppercase;
      letter-spacing: .1em; color: var(--muted); flex-shrink: 0;
    }
    .class-list { flex: 1; overflow-y: auto; padding: .25rem 0; scrollbar-width: thin; scrollbar-color: #2a2a2a transparent; }
    .class-list::-webkit-scrollbar { width: 5px; }
    .class-list::-webkit-scrollbar-thumb { background: #2a2a2a; border-radius: 3px; }

    .cls-row {
      display: flex; align-items: center; gap: .45rem;
      padding: .38rem .75rem; cursor: pointer; user-select: none;
      font-size: .8rem; color: var(--dim);
      border-left: 3px solid transparent;
      transition: background .1s;
    }
    .cls-row:hover { background: #1a1a1a; color: #ccc; }
    .cls-row.active { background: #16162a; color: #a5b4fc; border-color: var(--accent); }
    .cls-dot { width: 8px; height: 8px; border-radius: 2px; flex-shrink: 0; }
    .cls-name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .cls-count {
      font-size: .65rem; background: #1e1b3a; border: 1px solid #3730a3;
      border-radius: 8px; padding: .08rem .4rem; color: #818cf8; flex-shrink: 0;
    }

    /* ── Main ── */
    .main { flex: 1; overflow: hidden; display: flex; flex-direction: column; background: var(--bg); }

    .empty-state {
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      flex: 1; gap: .75rem; color: #333; text-align: center;
    }
    .empty-icon { font-size: 2.5rem; color: #222; }
    .empty-state p { font-size: .88rem; color: #444; margin: 0; }

    .loading {
      display: flex; align-items: center; justify-content: center;
      flex: 1; font-size: .85rem; color: #444;
    }

    /* ── Table ── */
    .table-wrap { display: flex; flex-direction: column; flex: 1; overflow: hidden; }

    .cls-title-dot { width: 10px; height: 10px; border-radius: 2px; flex-shrink: 0; }
    .cls-title { font-size: .92rem; font-weight: 700; color: var(--text); white-space: nowrap; }
    .type-badge {
      font-size: .65rem; padding: .12rem .5rem; border-radius: 10px;
      background: #1e1b3a; color: #818cf8; border: 1px solid #3730a3; white-space: nowrap;
    }
    .count-badge {
      margin-left: auto; font-size: .72rem; color: var(--muted);
      font-family: 'JetBrains Mono', monospace; white-space: nowrap;
    }

    .table-empty { padding: 2rem 1.25rem; font-size: .85rem; color: #444; }

    .scroll-wrap { flex: 1; overflow: auto; }

    .data-table {
      width: 100%; border-collapse: collapse;
      font-size: .83rem; min-width: 600px;
    }
    .data-table thead tr { border-bottom: 2px solid var(--border); }
    .data-table thead { background: #0f0f0f; position: sticky; top: 0; z-index: 1; }
    .data-table th {
      text-align: left; padding: .5rem 1rem;
      font-size: .68rem; font-weight: 700; color: var(--muted);
      letter-spacing: .08em; text-transform: uppercase;
      white-space: nowrap; background: #0f0f0f;
    }
    .th-label { color: #666; }
    .th-complex { color: #4f46e5; }
    .data-table tbody tr { border-bottom: 1px solid #1a1a1a; transition: background .1s; }
    .data-table tbody tr:hover { background: #141414; }
    .data-table td { padding: .5rem 1rem; color: #aaa; vertical-align: top; }
    .td-label { color: var(--text); font-weight: 500; white-space: nowrap; }
    .th-actions, .td-actions { width: 32px; text-align: center; padding: .2rem .5rem; }
    .btn-edit { background: none; border: none; cursor: pointer; font-size: .82rem; opacity: .25; transition: opacity .1s; }
    .data-table tbody tr:hover .btn-edit { opacity: .85; }

    .ctx-menu {
      position: fixed; z-index: 9999;
      background: #151515; border: 1px solid #3a3a3a; border-radius: 8px;
      padding: 5px; min-width: 190px; box-shadow: 0 8px 30px rgba(0,0,0,.8);
    }
    .ctx-item {
      padding: 6px 12px; border-radius: 5px; font-size: 12px;
      cursor: pointer; color: #888;
    }
    .ctx-item:hover { background: #242424; color: #e8e8e8; }
  `],
})
export class ListeComponent implements OnInit {
  private readonly api  = inject(ApiService);
  private readonly zone = inject(NgZone);
  readonly auth = inject(AuthService);

  allClasses       = signal<ElementClass[]>([]);
  selectedClass    = signal<ElementClass | null>(null);
  attrs            = signal<AttributeDefinition[]>([]);
  rows             = signal<CmElement[]>([]);
  loading          = signal(false);
  editElementId    = signal<string | null>(null);
  createForClassId = signal<string | null>(null);
  searchQuery      = signal('');
  globalRows       = signal<CmElement[]>([]);
  globalSearching  = signal(false);
  private globalSearch$ = new Subject<string>();

  ctx = { visible: false, x: 0, y: 0, classId: '' };

  // elementId → (attrDefId → labels[])
  private relationMap = signal<Map<string, Map<string, string[]>>>(new Map());

  sortedClasses = computed(() =>
    [...this.allClasses()].sort((a, b) => a.name.localeCompare(b.name, 'fr'))
  );

  filteredClasses = computed(() => {
    const q = this.searchQuery().trim().toLowerCase();
    if (!q) return this.sortedClasses();
    return this.sortedClasses().filter(c => c.name.toLowerCase().includes(q));
  });

  filteredRows = computed(() => {
    const q = this.searchQuery().trim().toLowerCase();
    if (!q) return this.rows();
    return this.rows().filter(row => {
      if (row.label?.toLowerCase().includes(q)) return true;
      if (row.attributeValues?.some(av => av.value?.toLowerCase().includes(q))) return true;
      const relLabels = this.relationMap().get(row.id);
      if (relLabels) {
        for (const labels of relLabels.values()) {
          if (labels.some(l => l.toLowerCase().includes(q))) return true;
        }
      }
      return false;
    });
  });

  sortedAttrs = computed(() =>
    [...this.attrs()].sort((a, b) => a.order - b.order)
  );

  ngOnInit() {
    this.api.elementclasses.getClasses().subscribe(c => this.allClasses.set(c));

    document.addEventListener('mousedown', (e) => {
      if (!(e.target as HTMLElement).closest('.ctx-menu')) {
        this.zone.run(() => { this.ctx.visible = false; });
      }
    });

    this.globalSearch$.pipe(
      debounceTime(300),
      switchMap(q => {
        if (!q.trim()) {
          this.globalRows.set([]);
          this.globalSearching.set(false);
          return EMPTY;
        }
        this.globalSearching.set(true);
        return this.api.elements.getAll({ search: q.trim() });
      }),
    ).subscribe(results => {
      this.globalRows.set(results);
      this.globalSearching.set(false);
    });
  }

  onSearchInput(value: string) {
    this.searchQuery.set(value);
    if (!this.selectedClass()) this.globalSearch$.next(value);
  }

  selectClass(cls: ElementClass) {
    this.selectedClass.set(cls);
    this.loading.set(true);
    this.attrs.set([]);
    this.rows.set([]);
    this.relationMap.set(new Map());

    combineLatest([
      this.api.elementclasses.getEffectiveAttrs(cls.id),
      this.api.elements.getAll({ classId: cls.id }),
    ]).subscribe(([attrs, elements]) => {
      this.attrs.set(attrs);
      this.rows.set(elements);

      const complexAttrs = attrs.filter(a => a.kind === 'COMPLEX');
      if (complexAttrs.length === 0 || elements.length === 0) {
        this.loading.set(false);
        return;
      }

      // IDs des attributs COMPLEX propres à cette classe (sens aller)
      const ownAttrIds = new Set(complexAttrs.map(a => a.id));
      // inverseAttrId → ourAttrId : pour retrouver les relations entrantes
      const inverseToOwn = new Map<string, string>();
      complexAttrs.forEach(a => {
        if (a.inverseAttributeDefinitionId) {
          inverseToOwn.set(a.inverseAttributeDefinitionId, a.id);
        }
      });

      forkJoin(
        elements.length > 0
          ? elements.map(el => this.api.elements.getWithRelations(el.id))
          : [of({ element: elements[0], outgoing: [], incoming: [] })]
      ).subscribe(withRels => {
        const rMap = new Map<string, Map<string, string[]>>();
        elements.forEach(el => rMap.set(el.id, new Map()));

        withRels.forEach(({ element: el, outgoing, incoming }) => {
          const elMap = rMap.get(el.id)!;

          // Relations sortantes : attributeDefinitionId = un de nos attrs COMPLEX
          outgoing.forEach(rel => {
            const attrId = rel.attributeDefinitionId;
            if (!attrId || !ownAttrIds.has(attrId)) return;
            const list = elMap.get(attrId) ?? [];
            list.push(rel.target?.label ?? '?');
            elMap.set(attrId, list);
          });

          // Relations entrantes : attributeDefinitionId = l'attr inverse d'un de nos attrs
          incoming.forEach(rel => {
            const attrId = rel.attributeDefinitionId;
            if (!attrId) return;
            const ourId = inverseToOwn.get(attrId);
            if (!ourId) return;
            const list = elMap.get(ourId) ?? [];
            list.push(rel.source?.label ?? '?');
            elMap.set(ourId, list);
          });
        });

        this.relationMap.set(rMap);
        this.loading.set(false);
      });
    });
  }

  cellTooltip(row: CmElement, attr: AttributeDefinition): string {
    if (attr.kind !== 'SIMPLE' || attr.simpleType !== 'ENUM' || !attr.enumOptions) return '';
    const av = row.attributeValues?.find(v => v.attributeDefinitionId === attr.id);
    if (!av?.value) return '';
    const opts = this.parseEnumOptions(attr.enumOptions);
    return opts.find(o => o.value === av.value)?.description ?? '';
  }

  cellValue(row: CmElement, attr: AttributeDefinition): string {
    if (attr.kind === 'COMPLEX') {
      const labels = this.relationMap().get(row.id)?.get(attr.id) ?? [];
      return labels.length ? labels.join(', ') : '—';
    }

    const av = row.attributeValues?.find(v => v.attributeDefinitionId === attr.id);
    if (!av?.value) return '—';

    if (attr.simpleType === 'ENUM' && attr.enumOptions) {
      const opts = this.parseEnumOptions(attr.enumOptions);
      return opts.find(o => o.value === av.value)?.label ?? av.value;
    }

    return av.value;
  }

  effectiveColor(cls: ElementClass): string {
    let cur: ElementClass | null | undefined = cls;
    const all = this.allClasses();
    while (cur) {
      if (cur.color) return cur.color;
      cur = cur.parentClassId ? all.find(c => c.id === cur!.parentClassId) : null;
    }
    return '#4f46e5';
  }

  getClass(id: string): ElementClass | undefined {
    return this.allClasses().find(c => c.id === id);
  }

  onClassCtx(e: MouseEvent, cls: ElementClass) {
    e.preventDefault();
    e.stopPropagation();
    this.ctx = { visible: true, x: e.clientX, y: e.clientY, classId: cls.id };
  }

  startCreate(classId: string) {
    this.ctx.visible = false;
    this.editElementId.set(null);
    this.createForClassId.set(classId);
  }

  onPanelSaved() {
    this.editElementId.set(null);
    this.createForClassId.set(null);
    const cls = this.selectedClass();
    if (cls) this.selectClass(cls);
  }

  onPanelClosed() {
    this.editElementId.set(null);
    this.createForClassId.set(null);
  }

  onEditSaved() {
    this.editElementId.set(null);
    const cls = this.selectedClass();
    if (cls) this.selectClass(cls);
  }

  private parseEnumOptions(json: string): EnumOption[] {
    try { return JSON.parse(json); } catch { return []; }
  }
}
