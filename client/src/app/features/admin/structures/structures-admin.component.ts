import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../core/services/api.service';
import { AuthService } from '../../../core/services/auth.service';
import {
  Structure, StructureType, CreateStructureDto,
  ElementType, ElementClass, RelationType,
} from '../../../core/models/api.models';

const STRUCTURE_TYPES: StructureType[] = ['Organisationnelle', 'Technique', 'Physique'];

const RELATION_TYPES: { value: RelationType; label: string; color: string }[] = [
  { value: 'APPARTENANCE', label: 'Appartenance', color: '#6366f1' },
  { value: 'DEPENDANCE',   label: 'Dépendance',   color: '#f59e0b' },
  { value: 'PRODUCTION',   label: 'Production',   color: '#10b981' },
  { value: 'ACCES',        label: 'Accès',        color: '#3b82f6' },
  { value: 'ASSOCIATION',  label: 'Association',  color: '#8b5cf6' },
];

@Component({
  selector: 'app-structures-admin',
  standalone: true,
  imports: [CommonModule, FormsModule],
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
    <span class="page-title">Structures</span>
    <div class="topbar-right">
      <button class="btn-logout" (click)="auth.logout()">Déconnexion</button>
    </div>
  </header>

  <div class="body">

    <!-- Sidebar gauche -->
    <aside class="sidebar">
      <div class="sidebar-top">
        <button class="btn-new" (click)="openNew()">+ Nouvelle structure</button>
      </div>
      <div class="tree">
        @for (type of structureTypes; track type) {
          @if (structuresOfType(type).length > 0 || true) {
            <div class="tree-group">
              <span class="tree-group-label">{{ type }}</span>
            </div>
            @for (s of structuresOfType(type); track s.id) {
              <div class="tree-item"
                [class.active]="selectedId() === s.id"
                [class.drag-over]="dragOverId() === s.id"
                draggable="true"
                (dragstart)="onDragStart(s.id)"
                (dragover)="onDragOver($event, s.id)"
                (drop)="onDrop(s.id, type)"
                (dragend)="onDragEnd()"
                (click)="selectStructure(s)">
                <span class="drag-handle">⠿</span>
                <span class="tree-item-name">{{ s.name }}</span>
                @if (s.maxInstances) {
                  <span class="tree-item-badge">×{{ s.maxInstances }}</span>
                }
              </div>
            }
          }
        }
      </div>
    </aside>

    <!-- Zone principale -->
    <main class="main">

      @if (!form.id && !formVisible()) {
        <div class="empty-state">
          <div class="empty-icon">⬡</div>
          <p>Sélectionnez une structure ou créez-en une nouvelle</p>
        </div>
      }

      @if (formVisible()) {
        <div class="editor">
          <div class="editor-header">
            <h2>{{ form.id ? 'Modifier la structure' : 'Nouvelle structure' }}</h2>
          </div>

          <div class="editor-cols">

            <!-- Colonne gauche : champs de base -->
            <div class="editor-left">
              <div class="form">

                <div class="form-field">
                  <label>Nom <span class="required">*</span></label>
                  <input [(ngModel)]="form.name" placeholder="ex: Organigramme"/>
                </div>

                <div class="form-field">
                  <label>Type <span class="required">*</span></label>
                  <select [(ngModel)]="form.structureType">
                    @for (t of structureTypes; track t) {
                      <option [value]="t">{{ t }}</option>
                    }
                  </select>
                </div>

                <div class="form-field">
                  <label>Description</label>
                  <input [(ngModel)]="form.description" placeholder="Description de la structure"/>
                </div>

                <div class="form-field">
                  <label>Classe d'élément parente <span class="hint">(clic droit depuis)</span></label>
                  <select [(ngModel)]="form.parentElementClassId">
                    <option [ngValue]="null">— Aucune (accès libre) —</option>
                    @for (cls of allClasses(); track cls.id) {
                      <option [ngValue]="cls.id">{{ cls.name }}</option>
                    }
                  </select>
                </div>

                <div class="form-field">
                  <label>Max instances <span class="hint">(vide = illimité)</span></label>
                  <input type="number" [(ngModel)]="form.maxInstances" min="1" placeholder="Illimité"/>
                </div>

                <!-- Relations autorisées -->
                <div class="form-field">
                  <label>Relations autorisées</label>
                  <div class="rel-badges">
                    @for (rt of relationTypes; track rt.value) {
                      <button type="button"
                        class="rel-badge"
                        [class.active]="isRelTypeAllowed(rt.value)"
                        [style.--rel-color]="rt.color"
                        (click)="toggleRelationType(rt.value)">
                        {{ rt.label }}
                      </button>
                    }
                  </div>
                </div>

                @if (formError()) {
                  <div class="form-error">{{ formError() }}</div>
                }
                <div class="form-btns">
                  @if (form.id) {
                    <button class="btn-danger" (click)="deleteStructure()">Supprimer</button>
                  }
                  <button (click)="cancelEdit()">Annuler</button>
                  <button class="primary" (click)="saveStructure()" [disabled]="saving()">
                    {{ saving() ? 'Enregistrement…' : (form.id ? 'Enregistrer' : 'Créer') }}
                  </button>
                </div>
              </div>
            </div>

            <!-- Colonne droite : classes autorisées -->
            <div class="editor-right">
              <div class="classes-section">
                <div class="section-header">
                  <span class="section-title">Classes autorisées</span>
                  <span class="section-count">{{ form.allowedClassIds.length }} sélectionnée(s)</span>
                </div>

                @if (types().length === 0) {
                  <div class="classes-empty">Chargement…</div>
                }

                @for (type of types(); track type.id) {
                  @if (classesByType(type.id).length > 0) {
                    <!-- En-tête de type -->
                    <div class="class-type-header" (click)="toggleAllOfType(type.id)">
                      <span class="type-dot" [style.background]="type.color ?? '#4f46e5'"></span>
                      <span class="type-name">{{ type.name }}</span>
                      <span class="type-count">
                        {{ selectedOfType(type.id) }}/{{ classesByType(type.id).length }}
                      </span>
                    </div>

                    <!-- Classes du type -->
                    @for (cls of classesByType(type.id); track cls.id) {
                      <label class="class-row" [class.checked]="isClassAllowed(cls.id)">
                        <input type="checkbox"
                          [checked]="isClassAllowed(cls.id)"
                          (change)="toggleClass(cls.id)"/>
                        <span class="class-name">{{ cls.name }}</span>
                        @if (cls.parentClassId) {
                          <span class="class-parent">↳ {{ parentName(cls.parentClassId) }}</span>
                        }
                      </label>
                    }
                  }
                }
              </div>
            </div>

          </div><!-- /editor-cols -->
        </div><!-- /editor -->
      }

    </main>
  </div>
</div>
  `,
  styles: [`
    @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500&family=Syne:wght@400;600;700&display=swap');

    :host {
      display: block; height: 100vh;
      --bg: #0d0d0d; --bg-panel: #111; --bg-card: #1c1c1c;
      --border: #2a2a2a; --border-b: #3a3a3a;
      --text: #e8e8e8; --muted: #555; --dim: #888;
      --accent: #6366f1;
      font-family: 'Syne', sans-serif; color: var(--text);
    }

    .shell { display:flex; flex-direction:column; height:100vh; background:var(--bg); }

    /* Topbar */
    .topbar {
      display:flex; align-items:center; gap:1rem;
      padding:.55rem 1.25rem; background:#0a0a0a;
      border-bottom:1px solid var(--border); flex-shrink:0;
      position:relative;
    }
    .logo-img { height:22px; width:auto; display:block; object-fit:contain; }
    nav { display:flex; gap:1.5rem; }
    nav a { color:#555; text-decoration:none; font-size:.78rem; letter-spacing:.04em; }
    nav a:hover { color:#aaa; }
    .back { color:var(--muted); text-decoration:none; font-size:.78rem; }
    .back:hover { color:var(--dim); }
    .page-title {
      position:absolute; left:50%; transform:translateX(-50%);
      font-size:.82rem; font-weight:400; color:#555;
      letter-spacing:.02em; font-family:'JetBrains Mono',monospace;
      pointer-events:none;
    }
    .topbar-right { margin-left:auto; }
    .btn-logout { background:none; border:1px solid #2a2a2a; border-radius:5px; color:#555; padding:.3rem .7rem; cursor:pointer; font-size:.75rem; font-family:'Syne',sans-serif; }
    .btn-logout:hover { color:#aaa; border-color:#555; }

    /* Body */
    .body { display:flex; flex:1; overflow:hidden; }

    /* Sidebar */
    .sidebar {
      width:240px; flex-shrink:0;
      background:var(--bg-panel); border-right:1px solid var(--border);
      display:flex; flex-direction:column; overflow:hidden;
    }
    .sidebar-top { padding:.6rem .75rem; border-bottom:1px solid var(--border); }
    .btn-new {
      width:100%; padding:.38rem .6rem; background:none;
      border:1px solid var(--border-b); border-radius:5px;
      color:var(--dim); font-size:.78rem; cursor:pointer; font-family:'Syne',sans-serif;
      text-align:left;
    }
    .btn-new:hover { border-color:#555; color:var(--text); }

    .tree {
      flex:1; overflow-y:auto; padding:.25rem 0;
      scrollbar-width:thin; scrollbar-color:#2a2a2a transparent;
    }
    .tree::-webkit-scrollbar { width:5px; }
    .tree::-webkit-scrollbar-track { background:transparent; }
    .tree::-webkit-scrollbar-thumb { background:#2a2a2a; border-radius:3px; }
    .tree::-webkit-scrollbar-thumb:hover { background:#3a3a3a; }

    .tree-group { padding:.55rem .75rem .2rem; }
    .tree-group-label {
      font-size:.6rem; font-weight:700; text-transform:uppercase;
      letter-spacing:.1em; color:#333;
    }
    .tree-item {
      display:flex; align-items:center; gap:.4rem;
      padding:.35rem .75rem .35rem 1rem;
      cursor:pointer; font-size:.8rem; color:var(--dim);
      border-left:3px solid transparent;
    }
    .tree-item:hover { background:#1a1a1a; color:#ccc; }
    .tree-item.active { background:#16162a; color:#a5b4fc; border-color:var(--accent); }
    .tree-item.drag-over { background:#1e1b3a !important; border-color:var(--accent); }
    .drag-handle { opacity:.35; cursor:grab; font-size:.9rem; flex-shrink:0; }
    .tree-item:hover .drag-handle { opacity:.8; }
    .tree-item-name { flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .tree-item-badge {
      font-size:.6rem; font-family:'JetBrains Mono',monospace;
      color:#2a2a2a; background:#1a1a1a; border-radius:3px; padding:.05rem .3rem;
    }

    /* Main */
    .main {
      flex:1; overflow:hidden;
      display:flex; flex-direction:column;
      padding:1.25rem 1.5rem; background:var(--bg);
    }

    .empty-state {
      display:flex; flex-direction:column; align-items:center; justify-content:center;
      flex:1; gap:.75rem; color:#333; text-align:center;
    }
    .empty-icon { font-size:2.5rem; color:#222; }
    .empty-state p { font-size:.88rem; color:#444; margin:0; }

    /* Editor */
    .editor { display:flex; flex-direction:column; flex:1; min-height:0; }
    .editor-header {
      display:flex; align-items:center; justify-content:space-between;
      margin-bottom:1rem; flex-shrink:0;
    }
    .editor-header h2 { margin:0; font-size:1rem; font-weight:700; }

    .editor-cols { display:flex; flex:1; gap:1.5rem; min-height:0; overflow:hidden; }
    .editor-left { flex:2; min-width:300px; overflow-y:auto; padding-right:.5rem; }
    .editor-right { flex:3; overflow-y:auto; border-left:1px solid var(--border); padding-left:1.5rem; }

    /* Form */
    .form { display:flex; flex-direction:column; gap:.7rem; }
    .form-field { display:flex; flex-direction:column; gap:.25rem; }

    label {
      font-size:.68rem; font-weight:700; color:var(--muted);
      letter-spacing:.08em; text-transform:uppercase;
    }
    .required { color:#f87171; }
    .hint { font-size:.6rem; color:#333; text-transform:none; letter-spacing:0; font-weight:400; }

    input:not([type=checkbox]), select {
      background:var(--bg-card); border:1px solid var(--border-b);
      border-radius:6px; color:var(--text); font-size:.84rem;
      padding:.5rem .75rem; outline:none; font-family:'Syne',sans-serif; width:100%;
    }
    input:focus, select:focus { border-color:var(--accent); }
    select option { background:#1c1c1c; }

    /* Relation badges */
    .rel-badges { display:flex; flex-wrap:wrap; gap:.4rem; }
    .rel-badge {
      padding:.28rem .7rem; border-radius:5px;
      border:1px solid #2a2a2a; background:none;
      color:#444; cursor:pointer; font-size:.75rem; font-family:'Syne',sans-serif;
      transition:all .15s;
    }
    .rel-badge.active {
      border-color:var(--rel-color); color:var(--rel-color);
      background:color-mix(in srgb, var(--rel-color) 12%, transparent);
    }
    .rel-badge:hover { border-color:#555; color:#aaa; }
    .rel-badge.active:hover { opacity:.85; }

    /* Boutons */
    .form-btns { display:flex; gap:.5rem; justify-content:flex-end; margin-top:.5rem; }
    .form-btns button {
      padding:.42rem 1rem; border-radius:5px;
      border:1px solid var(--border-b); background:none;
      color:var(--dim); cursor:pointer; font-size:.8rem; font-family:'Syne',sans-serif;
    }
    .form-btns button:hover { color:var(--text); border-color:#555; }
    .form-btns button.primary { background:var(--accent); border-color:var(--accent); color:#fff; }
    .form-btns button.primary:hover { background:#4f46e5; }
    .form-btns button:disabled { opacity:.5; cursor:not-allowed; }
    .btn-danger {
      margin-right:auto; padding:.42rem 1rem; border-radius:5px;
      border:1px solid #991b1b; background:#ef4444; color:#fff;
      cursor:pointer; font-size:.8rem; font-family:'Syne',sans-serif;
    }
    .btn-danger:hover { background:#dc2626; }
    .form-error { font-size:.78rem; color:#f87171; }

    /* Classes section */
    .classes-section { display:flex; flex-direction:column; }
    .section-header {
      display:flex; align-items:center; justify-content:space-between;
      margin-bottom:.75rem;
    }
    .section-title {
      font-size:.7rem; font-weight:700; text-transform:uppercase;
      letter-spacing:.09em; color:var(--muted);
    }
    .section-count { font-size:.7rem; color:#3a3a3a; font-family:'JetBrains Mono',monospace; }
    .classes-empty { font-size:.8rem; color:#333; padding:.5rem 0; }

    .class-type-header {
      display:flex; align-items:center; gap:.4rem;
      padding:.4rem .5rem; margin-top:.5rem;
      cursor:pointer; border-radius:5px;
      font-size:.72rem; font-weight:700; color:#555; letter-spacing:.06em; text-transform:uppercase;
    }
    .class-type-header:hover { background:#1a1a1a; }
    .type-dot { width:7px; height:7px; border-radius:2px; flex-shrink:0; }
    .type-name { flex:1; }
    .type-count { font-size:.62rem; font-family:'JetBrains Mono',monospace; color:#333; }

    .class-row {
      display:flex; align-items:center; gap:.5rem;
      padding:.3rem .5rem .3rem 1.25rem;
      cursor:pointer; border-radius:4px; font-size:.8rem; color:var(--dim);
    }
    .class-row:hover { background:#1a1a1a; }
    .class-row.checked { color:var(--text); }
    .class-row input[type=checkbox] { cursor:pointer; accent-color:var(--accent); flex-shrink:0; }
    .class-name { flex:1; }
    .class-parent { font-size:.65rem; color:#333; font-family:'JetBrains Mono',monospace; }
  `],
})
export class StructuresAdminComponent implements OnInit {
  private readonly api = inject(ApiService);
  readonly auth = inject(AuthService);

  structures  = signal<Structure[]>([]);
  types       = signal<ElementType[]>([]);
  allClasses  = signal<ElementClass[]>([]);

  selectedId  = signal<string | null>(null);
  formVisible = signal(false);
  saving      = signal(false);
  formError   = signal('');

  draggingId  = signal<string | null>(null);
  dragOverId  = signal<string | null>(null);

  readonly structureTypes = STRUCTURE_TYPES;
  readonly relationTypes  = RELATION_TYPES;

  form: {
    id: string; name: string; description: string;
    structureType: StructureType;
    allowedClassIds: string[];
    allowedRelationTypes: RelationType[];
    maxInstances: number | null;
    parentElementClassId: string | null;
  } = this.emptyForm();

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  ngOnInit() { this.loadAll(); }

  private loadAll() {
    this.api.structures.getAll().subscribe(s => this.structures.set(s));
    this.api.elementclasses.getTypes().subscribe(t => this.types.set(t));
    this.api.elementclasses.getClasses().subscribe(c => this.allClasses.set(c));
  }

  private emptyForm() {
    return {
      id: '', name: '', description: '',
      structureType: 'Organisationnelle' as StructureType,
      allowedClassIds: [] as string[],
      allowedRelationTypes: [] as RelationType[],
      maxInstances: null as number | null,
      parentElementClassId: null as string | null,
    };
  }

  // ── Navigation ────────────────────────────────────────────────────────────

  structuresOfType(type: StructureType): Structure[] {
    return this.structures().filter(s => s.structureType === type);
  }

  // ── Drag-and-drop (réordonnancement dans un groupe de type) ───────────────

  onDragStart(id: string) { this.draggingId.set(id); }

  onDragOver(e: DragEvent, id: string) { e.preventDefault(); this.dragOverId.set(id); }

  onDragEnd() { this.draggingId.set(null); this.dragOverId.set(null); }

  onDrop(targetId: string, type: StructureType) {
    const srcId = this.draggingId();
    if (!srcId || srcId === targetId) { this.dragOverId.set(null); return; }

    const list = [...this.structuresOfType(type)];
    const si = list.findIndex(s => s.id === srcId);
    const ti = list.findIndex(s => s.id === targetId);
    if (si === -1 || ti === -1) { this.dragOverId.set(null); return; }

    list.splice(ti, 0, list.splice(si, 1)[0]);
    this.structures.set([...this.structures().filter(s => s.structureType !== type), ...list]);

    const allIds = [
      ...this.structuresOfType('Organisationnelle'),
      ...this.structuresOfType('Technique'),
      ...this.structuresOfType('Physique'),
    ].map(s => s.id);
    this.api.structures.reorder(allIds).subscribe();

    this.draggingId.set(null);
    this.dragOverId.set(null);
  }

  classesByType(typeId: string): ElementClass[] {
    return this.allClasses().filter(c => c.typeId === typeId);
  }

  parentName(id: string): string {
    return this.allClasses().find(c => c.id === id)?.name ?? '';
  }

  openNew() {
    this.form = this.emptyForm();
    this.selectedId.set(null);
    this.formVisible.set(true);
    this.formError.set('');
  }

  selectStructure(s: Structure) {
    this.form = {
      id: s.id, name: s.name,
      description: s.description ?? '',
      structureType: s.structureType,
      allowedClassIds: [...s.allowedClassIds],
      allowedRelationTypes: [...s.allowedRelationTypes],
      maxInstances: s.maxInstances ?? null,
      parentElementClassId: s.parentElementClassId ?? null,
    };
    this.selectedId.set(s.id);
    this.formVisible.set(true);
    this.formError.set('');
  }

  cancelEdit() {
    this.form = this.emptyForm();
    this.selectedId.set(null);
    this.formVisible.set(false);
    this.formError.set('');
  }

  // ── Classes / relations toggles ───────────────────────────────────────────

  isClassAllowed(id: string): boolean {
    return this.form.allowedClassIds.includes(id);
  }

  toggleClass(id: string) {
    if (this.isClassAllowed(id)) {
      this.form.allowedClassIds = this.form.allowedClassIds.filter(c => c !== id);
    } else {
      this.form.allowedClassIds = [...this.form.allowedClassIds, id];
    }
  }

  selectedOfType(typeId: string): number {
    return this.classesByType(typeId).filter(c => this.isClassAllowed(c.id)).length;
  }

  toggleAllOfType(typeId: string) {
    const classes = this.classesByType(typeId);
    const allSelected = classes.every(c => this.isClassAllowed(c.id));
    if (allSelected) {
      const ids = new Set(classes.map(c => c.id));
      this.form.allowedClassIds = this.form.allowedClassIds.filter(id => !ids.has(id));
    } else {
      const toAdd = classes.map(c => c.id).filter(id => !this.isClassAllowed(id));
      this.form.allowedClassIds = [...this.form.allowedClassIds, ...toAdd];
    }
  }

  isRelTypeAllowed(rt: RelationType): boolean {
    return this.form.allowedRelationTypes.includes(rt);
  }

  toggleRelationType(rt: RelationType) {
    if (this.isRelTypeAllowed(rt)) {
      this.form.allowedRelationTypes = this.form.allowedRelationTypes.filter(r => r !== rt);
    } else {
      this.form.allowedRelationTypes = [...this.form.allowedRelationTypes, rt];
    }
  }

  // ── CRUD ──────────────────────────────────────────────────────────────────

  saveStructure() {
    if (!this.form.name.trim()) { this.formError.set('Le nom est requis.'); return; }
    if (!this.form.structureType) { this.formError.set('Le type est requis.'); return; }
    this.saving.set(true);
    this.formError.set('');

    const dto: CreateStructureDto = {
      name: this.form.name.trim(),
      description: this.form.description || undefined,
      structureType: this.form.structureType,
      allowedClassIds: this.form.allowedClassIds,
      allowedRelationTypes: this.form.allowedRelationTypes,
      maxInstances: this.form.maxInstances || null,
      parentElementClassId: this.form.parentElementClassId || undefined,
    };

    const req = this.form.id
      ? this.api.structures.update(this.form.id, dto)
      : this.api.structures.create(dto);

    req.subscribe({
      next: (s) => {
        this.saving.set(false);
        if (!this.form.id) {
          this.form.id = s.id;
          this.selectedId.set(s.id);
        }
        this.loadAll();
      },
      error: err => {
        this.saving.set(false);
        this.formError.set(err?.error?.message ?? 'Erreur');
      },
    });
  }

  deleteStructure() {
    if (!this.form.id) return;
    if (!confirm(`Supprimer la structure "${this.form.name}" ?`)) return;
    this.api.structures.delete(this.form.id).subscribe({
      next: () => { this.cancelEdit(); this.loadAll(); },
      error: err => this.formError.set(err?.error?.message ?? 'Erreur'),
    });
  }
}
