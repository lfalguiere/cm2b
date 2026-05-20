// src/app/features/canvas/left-panel/left-panel.component.ts
import {
  Component, OnInit, OnChanges, SimpleChanges, inject, signal, output, input, NgZone
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DocumentApiService } from '../../../core/services/document-api.service';
import { StructureTreeGroup, StructureNode } from '../../../core/models/document.models';

@Component({
  selector: 'app-left-panel',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
<div class="panel">
  <div class="panel-header">
    <span class="panel-title">Vues</span>
    <button class="btn-collapse" (click)="collapsed.set(!collapsed())">
      {{ collapsed() ? '»' : '«' }}
    </button>
  </div>

  @if (!collapsed()) {
    <div class="tree-scroll">

      @for (group of structureTree(); track group.type) {
        <div class="group">
          <div class="group-label" (click)="toggleGroup(group.type)">
            <span class="chevron">{{ openGroups().has(group.type) ? '▾' : '▸' }}</span>
            {{ group.type }}
          </div>

          @if (openGroups().has(group.type)) {
            @for (node of group.structures; track node.structureId) {

              @if (node.maxInstances === 1) {
                @if (node.view) {
                  <!-- Vue singleton existante -->
                  <div class="doc-row" [style.padding-left.px]="16"
                    [class.active]="selectedViewId() === node.view.id"
                    (click)="selectView(node.view.id)"
                    (contextmenu)="onViewCtx($event, node.view)">
                    <span>📄</span>
                    <span class="item-name">{{ node.structureName }}</span>
                  </div>
                } @else {
                  <!-- Vue singleton absente : proposition de création -->
                  <div class="doc-row create-row" [style.padding-left.px]="16"
                    (click)="createSingletonView(node)">
                    <span>➕</span>
                    <span class="item-name">{{ node.structureName }}</span>
                  </div>
                }

              } @else {
                <!-- Dossier virtuel (structure multi-instances) -->
                <div class="folder-row" [style.padding-left.px]="16"
                  (click)="toggleStructure(node.structureId)"
                  (contextmenu)="onStructureCtx($event, node)">
                  <span>{{ openStructures().has(node.structureId) ? '📂' : '📁' }}</span>
                  <span class="item-name">{{ node.structureName }}</span>
                </div>

                @if (openStructures().has(node.structureId)) {
                  @for (view of node.views!; track view.id) {
                    <div class="doc-row" [style.padding-left.px]="28"
                      [class.active]="selectedViewId() === view.id"
                      (click)="selectView(view.id)"
                      (contextmenu)="onViewCtx($event, view)">
                      <span>📄</span>
                      <span class="item-name">{{ view.name }}</span>
                    </div>
                  }
                }
              }

            }
          }
        </div>
      }

    </div>
  }
</div>

<!-- Context menu -->
@if (ctx.visible) {
  <div class="ctx-menu" [style.left.px]="ctx.x" [style.top.px]="ctx.y">
    @if (ctx.targetType === 'structure') {
      <div class="ctx-item" (click)="createView()">📄 Nouvelle vue · {{ ctx.structureName }}</div>
    }
    @if (ctx.targetType === 'view') {
      <div class="ctx-item" (click)="renameView()">✏ Renommer</div>
      <div class="ctx-item danger" (click)="deleteView()">🗑 Supprimer</div>
    }
  </div>
}

<!-- Dialog création / renommage -->
@if (dialog.visible) {
  <div class="dialog-backdrop" (click)="dialog.visible = false">
    <div class="dialog" (click)="$event.stopPropagation()">
      <h4>{{ dialog.title }}</h4>
      <input [(ngModel)]="dialog.value"
        [placeholder]="dialog.placeholder"
        (keydown.enter)="confirmDialog()"
        (keydown.escape)="dialog.visible = false"
        #dialogInput/>
      @if (dialog.error) {
        <div class="dialog-error">{{ dialog.error }}</div>
      }
      <div class="dialog-btns">
        <button (click)="dialog.visible = false">Annuler</button>
        <button class="primary" (click)="confirmDialog()">{{ dialog.confirmLabel }}</button>
      </div>
    </div>
  </div>
}
  `,
  styles: [`
    :host { display:block; height:100%; }

    .panel {
      width:220px; height:100%; background:#111;
      border-right:1px solid #2a2a2a;
      display:flex; flex-direction:column; overflow:hidden; flex-shrink:0;
    }
    .panel-header {
      display:flex; align-items:center; justify-content:space-between;
      height:44px; box-sizing:border-box;
      padding:0 .75rem; border-bottom:1px solid #2a2a2a; flex-shrink:0;
    }
    .panel-title { font-size:.7rem; font-weight:700; letter-spacing:.1em; text-transform:uppercase; color:#555; }
    .btn-collapse { background:none; border:none; color:#555; cursor:pointer; font-size:.9rem; }
    .btn-collapse:hover { color:#aaa; }

    .tree-scroll { flex:1; overflow-y:auto; }

    .group { }
    .group-label {
      display:flex; align-items:center; gap:.4rem;
      padding:.4rem .75rem; font-size:.7rem; font-weight:700;
      color:#555; letter-spacing:.06em; text-transform:uppercase;
      cursor:pointer; user-select:none;
    }
    .group-label:hover { color:#888; }
    .chevron { font-size:.65rem; }

    .folder-row, .doc-row {
      display:flex; align-items:center; gap:.4rem;
      padding:.28rem .5rem; font-size:.8rem;
      cursor:pointer; user-select:none; color:#777;
    }
    .folder-row:hover, .doc-row:hover { background:#1a1a1a; color:#ccc; }
    .doc-row.active { background:#1e1b3a; color:#a5b4fc; border-left:2px solid #6366f1; }
    .create-row { color:#333; font-style:italic; }
    .create-row:hover { color:#666; }
    .item-name { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }

    .ctx-menu {
      position:fixed; z-index:9999; background:#151515;
      border:1px solid #3a3a3a; border-radius:8px;
      padding:5px; min-width:190px; box-shadow:0 8px 30px rgba(0,0,0,.8);
    }
    .ctx-item { padding:6px 12px; border-radius:5px; font-size:12px; cursor:pointer; color:#888; }
    .ctx-item:hover { background:#242424; color:#e8e8e8; }
    .ctx-item.danger:hover { background:rgba(244,67,54,.15); color:#f44336; }

    .dialog-backdrop { position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:10000;display:flex;align-items:center;justify-content:center; }
    .dialog { background:#151515;border:1px solid #3a3a3a;border-radius:10px;padding:1.25rem;min-width:280px;display:flex;flex-direction:column;gap:.75rem;box-shadow:0 20px 60px rgba(0,0,0,.9); }
    .dialog h4 { font-size:.9rem;color:#e8e8e8;margin:0; }
    .dialog input { background:#1c1c1c;border:1px solid #3a3a3a;border-radius:6px;color:#e8e8e8;font-size:.88rem;padding:.55rem .75rem;outline:none; }
    .dialog input:focus { border-color:#6366f1; }
    .dialog-error { font-size:.78rem; color:#f87171; }
    .dialog-btns { display:flex;gap:.5rem;justify-content:flex-end; }
    .dialog-btns button { padding:.4rem .9rem;border-radius:5px;border:1px solid #3a3a3a;background:none;color:#888;cursor:pointer;font-size:.82rem; }
    .dialog-btns button.primary { background:#4f46e5;border-color:#4f46e5;color:white; }
  `],
})
export class LeftPanelComponent implements OnInit, OnChanges {
  private readonly docApi = inject(DocumentApiService);
  private readonly zone   = inject(NgZone);

  organisationId  = input.required<string>();
  selectedViewId  = input<string | null>(null);
  refreshTrigger  = input<number>(0);
  viewSelected    = output<string>();
  viewCreated     = output<string>();
  viewDeleted     = output<string>();

  collapsed      = signal(false);
  structureTree  = signal<StructureTreeGroup[]>([]);
  openGroups     = signal<Set<string>>(new Set(['Organisationnelle', 'Technique', 'Physique']));
  openStructures = signal<Set<string>>(new Set());

  ctx = { visible: false, x: 0, y: 0, targetType: '', targetId: '', targetName: '', structureId: '', structureName: '' };
  dialog = { visible: false, mode: '' as 'create' | 'rename', title: '', placeholder: '', value: '', confirmLabel: '', structureId: '', viewId: '', error: '' };

  ngOnInit() {
    this.loadTree();
    document.addEventListener('mousedown', (e) => {
      if (!(e.target as HTMLElement).closest('.ctx-menu')) {
        this.zone.run(() => { this.ctx.visible = false; });
      }
    });
  }

  ngOnChanges(ch: SimpleChanges) {
    if (ch['refreshTrigger'] && !ch['refreshTrigger'].firstChange) {
      this.loadTree();
    }
  }

  private loadTree() {
    this.docApi.views.getStructureTree(this.organisationId()).subscribe({
      next: (tree: StructureTreeGroup[]) => this.structureTree.set(tree),
    });
  }

  // ── Navigation ────────────────────────────────────────────────────────────

  toggleGroup(type: string) {
    this.openGroups.update(s => { const n = new Set(s); n.has(type) ? n.delete(type) : n.add(type); return n; });
  }

  toggleStructure(id: string) {
    this.openStructures.update(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  selectView(id: string) { this.viewSelected.emit(id); }

  // ── Menus contextuels ─────────────────────────────────────────────────────

  onStructureCtx(e: MouseEvent, node: StructureNode) {
    e.preventDefault(); e.stopPropagation();
    this.ctx = {
      visible: true, x: e.clientX, y: e.clientY,
      targetType: 'structure', targetId: '', targetName: '',
      structureId: node.structureId, structureName: node.structureName,
    };
  }

  onViewCtx(e: MouseEvent, view: { id: string; name: string }) {
    e.preventDefault(); e.stopPropagation();
    this.ctx = {
      visible: true, x: e.clientX, y: e.clientY,
      targetType: 'view', targetId: view.id, targetName: view.name,
      structureId: '', structureName: '',
    };
  }

  // ── Actions ───────────────────────────────────────────────────────────────

  createView() {
    this.ctx.visible = false;
    this.dialog = {
      visible: true, mode: 'create',
      title: `Nouvelle vue · ${this.ctx.structureName}`,
      placeholder: 'Nom de la vue',
      value: '', confirmLabel: 'Créer',
      structureId: this.ctx.structureId, viewId: '',
      error: '',
    };
  }

  renameView() {
    const { targetId, targetName } = this.ctx;
    this.ctx.visible = false;
    this.dialog = {
      visible: true, mode: 'rename',
      title: 'Renommer la vue',
      placeholder: 'Nouveau nom',
      value: targetName, confirmLabel: 'Renommer',
      structureId: '', viewId: targetId,
      error: '',
    };
  }

  deleteView() {
    const id   = this.ctx.targetId;
    const name = this.ctx.targetName;
    this.ctx.visible = false;
    if (!confirm(`Supprimer la vue « ${name} » ? Cette action est irréversible.`)) return;
    this.docApi.views.delete(id).subscribe({
      next: () => {
        this.loadTree();
        this.viewDeleted.emit(id);
      },
    });
  }

  createSingletonView(node: StructureNode) {
    this.docApi.views.create({
      name: node.structureName,
      organisationId: this.organisationId(),
      structureId: node.structureId,
      folderId: null,
    }).subscribe({
      next: (view: any) => {
        this.loadTree();
        this.viewSelected.emit(view.id);
      },
    });
  }

  confirmDialog() {
    if (!this.dialog.value.trim()) return;
    this.dialog.error = '';

    if (this.dialog.mode === 'rename') {
      this.docApi.views.update(this.dialog.viewId, { name: this.dialog.value.trim() }).subscribe({
        next: () => {
          this.dialog.visible = false;
          this.loadTree();
        },
        error: (err: any) => {
          this.dialog.error = err?.error?.message ?? 'Erreur lors du renommage.';
        },
      });
      return;
    }

    const { value, structureId } = this.dialog;
    this.docApi.views.create({
      name: value.trim(),
      organisationId: this.organisationId(),
      structureId,
      folderId: null,
    }).subscribe({
      next: (view: any) => {
        this.dialog.visible = false;
        this.loadTree();
        this.viewCreated.emit(view.id);
        this.viewSelected.emit(view.id);
      },
      error: (err: any) => {
        this.dialog.error = err?.error?.message ?? 'Erreur lors de la création.';
      },
    });
  }
}
