// src/app/features/canvas/canvas-view/canvas-view.component.ts
import {
  Component, OnInit, AfterViewInit, OnChanges, OnDestroy,
  input, output, inject, NgZone, SimpleChanges, signal
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ViewMembers, Structure } from '../../../core/models/document.models';
import { ApiService } from '../../../core/services/api.service';
import { DocumentApiService } from '../../../core/services/document-api.service';
import { AttributeDefinition, ElementClass } from '../../../core/models/api.models';
import { forkJoin, of } from 'rxjs';

interface ViewMenuItem {
  mode: 'open' | 'create';
  label: string;
  viewId?: string;
  structure?: Structure;
}

@Component({
  selector: 'app-canvas-view',
  standalone: true,
  imports: [CommonModule],
  template: `
<div class="canvas-wrap" #wrap
  [class.connecting]="isConnecting"
  (contextmenu)="$event.preventDefault()">

  <svg class="svg-layer" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <marker id="cv-arrow" markerWidth="8" markerHeight="8" refX="4" refY="3" orient="auto">
        <path d="M0,0 L0,6 L6,3 z" fill="rgba(255,255,255,0.85)"/>
      </marker>
      <marker id="cv-arrow-dep" markerWidth="8" markerHeight="8" refX="4" refY="3" orient="auto">
        <path d="M0,0 L0,6 L6,3 z" fill="rgba(255,255,255,0.6)"/>
      </marker>
    </defs>
    <g id="cv-links"></g>
    <line id="cv-temp" display="none"
      stroke="rgba(255,214,0,.7)" stroke-width="1.5" stroke-dasharray="5,4"/>
  </svg>

  <div id="cv-nodes"></div>

  @if (!members() || members()!.nodes.length === 0) {
    <div class="empty-hint">
      Cette vue est vide.<br/>
      <small>Utilisez la palette ci-dessous ou la recherche pour ajouter des éléments.</small>
    </div>
  }

  <button class="layout-btn" (click)="autoLayout()" title="Réorganiser automatiquement">⟳</button>
</div>

<!-- Context menu nœud -->
@if (nodeCtx.visible) {
  <div class="node-ctx" [style.left.px]="nodeCtx.x" [style.top.px]="nodeCtx.y">
    <div class="ctx-item" (click)="ctxEdit()">🖊 Éditer</div>
    <div class="ctx-item" (click)="ctxRename()">✏️ Renommer</div>
    <div class="ctx-sep"></div>
    @if (nodeCtxLoading()) {
      <div class="ctx-item ctx-muted">Chargement des vues…</div>
    }
    @if (nodeCtxData(); as vd) {
      @if (vd.viewMenuItems.length > 0) {
        <div class="ctx-section-label">Vues</div>
        @for (item of vd.viewMenuItems; track $index) {
          @if (item.mode === 'open') {
            <div class="ctx-item" (click)="ctxOpenView(item.viewId!)">👁 {{ item.label }}</div>
          } @else {
            <div class="ctx-item" (click)="ctxCreateView(item.structure!)">＋ {{ item.label }}</div>
          }
        }
        <div class="ctx-sep"></div>
      }
    }
    <div class="ctx-item" (click)="ctxRemove()">⎋ Retirer de la vue</div>
    <div class="ctx-item danger" (click)="ctxDelete()">🗑 Supprimer définitivement</div>
  </div>
}

<!-- Context menu relation -->
@if (linkCtx.visible) {
  <div class="node-ctx link-ctx" [style.left.px]="linkCtx.x" [style.top.px]="linkCtx.y">
    <div class="ctx-item danger" (click)="deleteLink()">🗑 Supprimer la relation</div>
  </div>
}

<!-- Picker relation -->
@if (relPicker.visible) {
  <div class="rel-picker" [style.left.px]="relPicker.x" [style.top.px]="relPicker.y">
    <div class="picker-title">Choisir la relation</div>
    @for (opt of relPicker.options; track opt.id) {
      <div class="picker-item" (click)="pickRelation(opt)">
        <span class="picker-name">{{ opt.name }}</span>
        <span class="picker-type">{{ opt.relationType }}</span>
      </div>
    }
    <div class="picker-cancel" (click)="relPicker.visible = false">Annuler</div>
  </div>
}
  `,
  styles: [`
    :host { display:block; height:100%; }
    .canvas-wrap {
      width:100%; height:100%; position:relative; overflow:hidden;
      background-color:#0d0d0d;
      background-image:radial-gradient(#2a2a2a 1px, transparent 1px);
      background-size:28px 28px;
    }
    .canvas-wrap.connecting { cursor:crosshair; }
    .svg-layer { position:absolute;top:0;left:0;width:100%;height:100%;z-index:1; }
    #cv-nodes { position:absolute;top:0;left:0;width:100%;height:100%;z-index:2; }
    .empty-hint {
      position:absolute;inset:0;display:flex;align-items:center;justify-content:center;
      flex-direction:column;gap:.5rem;text-align:center;
      color:#444;font-size:.9rem;pointer-events:none;
    }
    .empty-hint small { font-size:.75rem;color:#333; }
    .layout-btn {
      position:absolute;bottom:12px;right:12px;z-index:10;
      background:#1c1c1c;border:1px solid #3a3a3a;border-radius:6px;
      color:#555;font-size:1rem;width:32px;height:32px;
      cursor:pointer;display:flex;align-items:center;justify-content:center;
      transition:all .15s;
    }
    .layout-btn:hover { background:#2a2a2a;color:#aaa;border-color:#555; }
    .node-ctx {
      position:fixed;z-index:999;background:#151515;border:1px solid #3a3a3a;
      border-radius:8px;padding:5px;min-width:180px;box-shadow:0 8px 30px rgba(0,0,0,.7);
    }
    .ctx-item { padding:6px 12px;border-radius:5px;font-size:12px;cursor:pointer;color:#888;transition:all .1s; }
    .ctx-item:hover { background:#242424;color:#e8e8e8; }
    .ctx-item.danger:hover { background:rgba(244,67,54,.15);color:#f44336; }
    .ctx-item.ctx-muted { cursor:default;color:#555;font-style:italic; }
    .ctx-item.ctx-muted:hover { background:none;color:#555; }
    .ctx-section-label { padding:4px 12px 2px;font-size:9px;color:#555;letter-spacing:.08em;text-transform:uppercase; }
    .ctx-sep { height:1px;background:#2a2a2a;margin:3px 0; }
    .rel-picker {
      position:fixed;z-index:999;background:#151515;border:1px solid #3a3a3a;
      border-radius:8px;padding:5px;min-width:200px;box-shadow:0 8px 30px rgba(0,0,0,.7);
    }
    .picker-title { padding:4px 12px 6px;font-size:10px;color:#555;letter-spacing:.06em;text-transform:uppercase;border-bottom:1px solid #2a2a2a;margin-bottom:3px; }
    .picker-item { display:flex;justify-content:space-between;align-items:center;padding:6px 12px;border-radius:5px;font-size:12px;cursor:pointer;color:#888;transition:all .1s; }
    .picker-item:hover { background:#242424;color:#e8e8e8; }
    .picker-name { font-weight:500;color:#ccc; }
    .picker-type { font-size:10px;color:#555;font-family:'JetBrains Mono',monospace; }
    .picker-cancel { padding:5px 12px;border-radius:5px;font-size:11px;cursor:pointer;color:#555;text-align:center;margin-top:3px;border-top:1px solid #2a2a2a; }
    .picker-cancel:hover { color:#888; }
  `],
})
export class CanvasViewComponent implements OnInit, AfterViewInit, OnChanges, OnDestroy {
  private readonly zone    = inject(NgZone);
  private readonly api     = inject(ApiService);
  private readonly docApi  = inject(DocumentApiService);

  viewId          = input<string>('');
  members         = input<ViewMembers | null>(null);
  allowedClassIds = input<string[]>([]);
  allClasses      = input<ElementClass[]>([]);
  organisationId  = input<string>('');
  memberRemoved    = output<string>();
  positionChanged  = output<{ id: string; x: number; y: number }>();
  editRequested    = output<string>();
  viewRequested    = output<string>();
  createViewRequested = output<{ structureId: string; structureName: string; elementId: string; elementLabel: string }>();

  isConnecting = false;
  nodeCtx = { visible: false, x: 0, y: 0, nodeId: '', nodeClassId: '', nodeLabel: '' };
  nodeCtxLoading = signal(false);
  nodeCtxData    = signal<{ viewMenuItems: ViewMenuItem[] } | null>(null);
  linkCtx: { visible: boolean; x: number; y: number; link: any } = { visible: false, x: 0, y: 0, link: null };
  relPicker: { visible: boolean; x: number; y: number; options: AttributeDefinition[]; fromId: string; toId: string; fromRole: string; toRole: string } =
    { visible: false, x: 0, y: 0, options: [], fromId: '', toId: '', fromRole: '', toRole: '' };

  private complexAttrs = new Map<string, AttributeDefinition[]>();

  private readonly relationLabels: Record<string, string> = {
    APPARTENANCE: 'Appartenance',
    ASSOCIATION:  'Association',
    PRODUCTION:   'Production',
    DEPENDANCE:   'Dépendance',
    ACCES:        'Accès',
  };

  private tooltip!: HTMLElement;
  private wrap!: HTMLElement;
  private nodesEl!: HTMLElement;
  private linksEl!: SVGGElement;
  private tempLine!: SVGLineElement;
  private dragging: HTMLElement | null = null;
  private dragOffX = 0; private dragOffY = 0;
  private connecting: { nodeId: string; role: string } | null = null;
  private hoveringHandle = false;

  private nodeEls = new Map<string, HTMLElement>();
  private linkData: any[] = [];

  private onMove!: (e: MouseEvent) => void;
  private onUp!:   (e: MouseEvent) => void;
  private onDoc!:  (e: MouseEvent) => void;
  private onKey!:  (e: KeyboardEvent) => void;

  ngOnInit() {}

  ngAfterViewInit() {
    this.wrap    = document.querySelector('.canvas-wrap')!;
    this.nodesEl = document.getElementById('cv-nodes')!;
    this.linksEl = document.getElementById('cv-links') as unknown as SVGGElement;
    this.tempLine = document.getElementById('cv-temp') as unknown as SVGLineElement;

    this.tooltip = document.createElement('div');
    this.tooltip.style.cssText = [
      'position:fixed', 'z-index:9999', 'pointer-events:none', 'display:none',
      'background:#1c1c1c', 'border:1px solid #3a3a3a', 'border-radius:6px',
      'padding:3px 10px', 'font-size:11px', 'color:#aaa', 'white-space:nowrap',
      'box-shadow:0 4px 14px rgba(0,0,0,.7)',
      "font-family:'JetBrains Mono',monospace", 'letter-spacing:.04em',
    ].join(';');
    document.body.appendChild(this.tooltip);

    this.zone.runOutsideAngular(() => {
      this.onMove = this.handleMove.bind(this);
      this.onUp   = this.handleUp.bind(this);
      this.onKey  = (e: KeyboardEvent) => { if (e.key === 'Escape') { this.connecting = null; this.zone.run(() => this.isConnecting = false); this.tempLine.setAttribute('display','none'); } };
      this.onDoc  = (e: MouseEvent) => {
        const t = e.target as HTMLElement;
        if (!t.closest('.node-ctx')) this.zone.run(() => this.nodeCtx.visible = false);
        if (!t.closest('.rel-picker')) this.zone.run(() => this.relPicker.visible = false);
        if (!t.closest('.link-ctx')) this.zone.run(() => this.linkCtx.visible = false);
      };
      this.wrap?.addEventListener('mousemove', this.onMove);
      this.wrap?.addEventListener('mouseup', this.onUp);
      this.wrap?.addEventListener('contextmenu', (e: MouseEvent) => {
        // Si clic droit sur un nœud, laisser le handler du nœud gérer
        if ((e.target as HTMLElement).closest('[data-id]')) return;
        e.preventDefault();
        const r = this.wrap.getBoundingClientRect();
        const mx = e.clientX - r.left;
        const my = e.clientY - r.top;
        for (const lk of this.linkData) {
          if (lk._from && this.isNearBezier(mx, my, lk._from, lk._to, lk._p1, lk._p2)) {
            this.zone.run(() => { this.linkCtx = { visible: true, x: e.clientX, y: e.clientY, link: lk }; });
            return;
          }
        }
      });
      document.addEventListener('keydown', this.onKey);
      document.addEventListener('mousedown', this.onDoc);
    });

    this.renderAll();
  }

  ngOnChanges(ch: SimpleChanges) {
    if (ch['members'] && this.nodesEl) {
      this.renderAll();
    }
  }

  ngOnDestroy() {
    this.wrap?.removeEventListener('mousemove', this.onMove);
    this.wrap?.removeEventListener('mouseup', this.onUp);
    document.removeEventListener('keydown', this.onKey);
    document.removeEventListener('mousedown', this.onDoc);
    this.tooltip?.remove();
  }

  // ─── Rendu ────────────────────────────────────────────────────────────────

  private renderAll() {
    if (!this.nodesEl || !this.linksEl) return;
    this.nodesEl.innerHTML = '';
    this.linksEl.innerHTML = '';
    this.nodeEls.clear();

    const m = this.members();
    if (!m) return;

    const classIds = [...new Set(m.nodes.map(n => n.elementClass?.id).filter((id): id is string => !!id))];
    classIds.forEach(classId => {
      if (!this.complexAttrs.has(classId)) {
        this.api.elementclasses.getEffectiveAttrs(classId).subscribe(attrs => {
          this.complexAttrs.set(classId, attrs.filter(a => a.kind === 'COMPLEX'));
        });
      }
    });

    m.nodes.forEach(node => this.createNodeEl(node));
    const handleRe = /^(in|out|dep|top):(in|out|dep|top)$/;
    this.linkData = m.edges.map(e => {
      const roles = e.label && handleRe.test(e.label)
        ? { fromRole: e.label.split(':')[0], toRole: e.label.split(':')[1] }
        : { fromRole: e.relationType === 'DEPENDANCE' ? 'dep' : 'out',
            toRole:   e.relationType === 'DEPENDANCE' ? 'dep' : 'in' };
      return { id: e.id, fromId: e.sourceId, toId: e.targetId,
               ...roles, isDep: e.relationType === 'DEPENDANCE', relationType: e.relationType,
               attrName: e.attributeDefinition?.name ?? '',
               inverseAttrName: e.attributeDefinition?.inverseAttributeName ?? '' };
    });
    const nullPosNodes = m.nodes.filter((n: any) => n.canvasX == null || n.canvasY == null);
    const needsLayout = !m.hasPerViewPositions && m.nodes.length > 1;
    setTimeout(() => {
      this.redrawLinks();
      if (needsLayout) this.autoLayout();
      else if (nullPosNodes.length > 0) this.centerNewNodes(nullPosNodes);
    }, 50);
  }

  private centerNewNodes(nodes: any[]) {
    const rect = this.wrap.getBoundingClientRect();
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    nodes.forEach((node: any, i: number) => {
      const el = this.nodeEls.get(node.id);
      if (!el) return;
      const x = Math.round(cx - el.offsetWidth / 2 + i * 180);
      const y = Math.round(cy - el.offsetHeight / 2);
      el.style.left = x + 'px';
      el.style.top  = y + 'px';
      this.positionChanged.emit({ id: node.id, x, y });
    });
  }

  private createNodeEl(node: any) {
    const el = document.createElement('div');
    el.style.cssText = `position:absolute;user-select:none;cursor:grab;left:${node.canvasX ?? 80}px;top:${node.canvasY ?? 80}px;`;
    el.dataset['id'] = node.id;

    const color = this.getEffectiveClassColor(node.elementClass) || node.elementClass?.type?.color || '#4f46e5';
    el.innerHTML = `
      <div style="background:${color};border-radius:8px;min-width:140px;padding:12px 20px;
        position:relative;box-shadow:0 4px 16px ${color}44;font-family:'Syne',sans-serif;">
        <div class="node-label" style="color:#fff;font-size:12px;font-weight:600;
          text-align:center;word-break:break-word;outline:none;cursor:text;
          contenteditable:false;">${node.label}</div>
        <div style="font-size:9px;color:rgba(255,255,255,.5);text-align:center;margin-top:4px;
          font-family:'JetBrains Mono',monospace;letter-spacing:.06em;">${node.elementClass?.name ?? ''}</div>
        <div class="handle" data-role="in" style="position:absolute;left:-7px;top:50%;
          transform:translateY(-50%) rotate(45deg);width:13px;height:13px;
          background:#FFD600;border-radius:2px;cursor:crosshair;z-index:10;box-shadow:0 0 5px rgba(255,214,0,.5);"></div>
        <div class="handle" data-role="out" style="position:absolute;right:-7px;top:50%;
          transform:translateY(-50%) rotate(45deg);width:13px;height:13px;
          background:#FFD600;border-radius:2px;cursor:crosshair;z-index:10;box-shadow:0 0 5px rgba(255,214,0,.5);"></div>
        <div class="handle" data-role="top" style="position:absolute;top:-7px;left:50%;
          transform:translateX(-50%) rotate(45deg);width:13px;height:13px;
          background:#FFD600;border-radius:2px;cursor:crosshair;z-index:10;box-shadow:0 0 5px rgba(255,214,0,.5);"></div>
        <div class="handle" data-role="dep" style="position:absolute;bottom:-7px;left:50%;
          transform:translateX(-50%) rotate(45deg);width:13px;height:13px;
          background:#FFD600;border-radius:2px;cursor:crosshair;z-index:10;box-shadow:0 0 5px rgba(255,214,0,.5);"></div>
      </div>`;

    this.setupNodeEvents(el, node.id, node.label);
    this.nodesEl.appendChild(el);
    this.nodeEls.set(node.id, el);
  }

  private setupNodeEvents(el: HTMLElement, nodeId: string, label: string) {
    el.addEventListener('mousedown', (e: MouseEvent) => {
      if ((e.target as HTMLElement).classList.contains('handle')) return;
      e.preventDefault();
      this.dragging = el; el.style.zIndex = '20';
      const rect = el.getBoundingClientRect();
      this.dragOffX = e.clientX - rect.left;
      this.dragOffY = e.clientY - rect.top;
    });

    el.querySelectorAll('.node-label').forEach(lbl => {
      lbl.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        (lbl as HTMLElement).contentEditable = 'true';
        (lbl as HTMLElement).focus();
      });
      lbl.addEventListener('blur', () => {
        (lbl as HTMLElement).contentEditable = 'false';
        const newLabel = (lbl as HTMLElement).innerText.trim();
        if (newLabel && newLabel !== label) {
          this.api.elements.update(nodeId, { label: newLabel }).subscribe();
        }
      });
      lbl.addEventListener('keydown', (e: Event) => {
        const ke = e as KeyboardEvent;
        if (ke.key === 'Enter') { ke.preventDefault(); (lbl as HTMLElement).blur(); }
        if (ke.key === 'Escape') (lbl as HTMLElement).blur();
      });
    });

    el.querySelectorAll('.handle').forEach(h => {
      h.addEventListener('mousedown', (e: Event) => {
        const me = e as MouseEvent;
        me.stopPropagation(); me.preventDefault();
        const role = (h as HTMLElement).dataset['role']!;
        const pos  = this.getHandlePos(el, h as HTMLElement);
        this.connecting = { nodeId, role };
        this.zone.run(() => this.isConnecting = true);
        this.tempLine.setAttribute('x1', String(pos.x));
        this.tempLine.setAttribute('y1', String(pos.y));
        this.tempLine.setAttribute('x2', String(pos.x));
        this.tempLine.setAttribute('y2', String(pos.y));
        this.tempLine.setAttribute('display', 'block');
      });

      h.addEventListener('mousemove', (e: Event) => {
        const me = e as MouseEvent;
        const role = (h as HTMLElement).dataset['role']!;
        const names: string[] = [];
        for (const lk of this.linkData) {
          if (lk.fromId === nodeId && lk.fromRole === role && lk.attrName)
            names.push(lk.attrName);
          if (lk.toId === nodeId && lk.toRole === role)
            names.push(lk.inverseAttrName || lk.attrName);
        }
        const label = [...new Set(names.filter(Boolean))].join(' · ');
        if (label) {
          this.hoveringHandle = true;
          this.tooltip.textContent = label;
          this.tooltip.style.display = 'block';
          this.tooltip.style.left = (me.clientX + 14) + 'px';
          this.tooltip.style.top  = (me.clientY - 30) + 'px';
        }
      });

      h.addEventListener('mouseleave', () => {
        this.hoveringHandle = false;
        this.tooltip.style.display = 'none';
      });
    });

    el.addEventListener('contextmenu', (e: MouseEvent) => {
      e.preventDefault();
      const node = this.members()?.nodes.find((n: any) => n.id === nodeId);
      const classId = node?.elementClass?.id ?? '';
      this.zone.run(() => {
        this.nodeCtx = { visible: true, x: e.clientX, y: e.clientY, nodeId, nodeClassId: classId, nodeLabel: label };
        this.nodeCtxData.set(null);
        if (classId) {
          this.nodeCtxLoading.set(true);
          const orgId = this.organisationId();
          forkJoin({
            applicableStructures: this.docApi.structures.applicable(classId),
            existingViews: this.docApi.views.forElement(nodeId),
            orgViews: orgId ? this.docApi.views.getAll(orgId) : of([]),
          }).subscribe({
            next: ({ applicableStructures, existingViews, orgViews }) => {
              this.nodeCtxData.set({ viewMenuItems: this.buildViewMenuItems(applicableStructures, existingViews, orgViews) });
              this.nodeCtxLoading.set(false);
            },
            error: () => { this.nodeCtxLoading.set(false); },
          });
        }
      });
    });
  }

  // ─── Drag & Connect ───────────────────────────────────────────────────────

  private handleMove(e: MouseEvent) {
    const r = this.wrap.getBoundingClientRect();
    if (this.dragging) {
      const x = Math.max(0, e.clientX - r.left - this.dragOffX);
      const y = Math.max(0, e.clientY - r.top  - this.dragOffY);
      this.dragging.style.left = x + 'px';
      this.dragging.style.top  = y + 'px';
      this.redrawLinks();
    }
    if (this.connecting) {
      this.tempLine.setAttribute('x2', String(e.clientX - r.left));
      this.tempLine.setAttribute('y2', String(e.clientY - r.top));
    }
    if (!this.dragging && !this.connecting && this.tooltip && !this.hoveringHandle) {
      const mx = e.clientX - r.left;
      const my = e.clientY - r.top;
      let found: any = null;
      for (const lk of this.linkData) {
        if (lk._from && this.isNearBezier(mx, my, lk._from, lk._to, lk._p1, lk._p2)) {
          found = lk; break;
        }
      }
      if (found) {
        this.tooltip.textContent = this.relationLabels[found.relationType] ?? found.relationType;
        this.tooltip.style.display = 'block';
        this.tooltip.style.left = (e.clientX + 14) + 'px';
        this.tooltip.style.top  = (e.clientY - 30) + 'px';
      } else {
        this.tooltip.style.display = 'none';
      }
    }
  }

  private handleUp(e: MouseEvent) {
    if (this.dragging) {
      const id = this.dragging.dataset['id']!;
      const x  = parseInt(this.dragging.style.left);
      const y  = parseInt(this.dragging.style.top);
      this.dragging.style.zIndex = '';
      this.dragging = null;
      this.zone.run(() => this.positionChanged.emit({ id, x, y }));
    }
    if (this.connecting) {
      const from = this.connecting;
      this.connecting = null;
      this.zone.run(() => this.isConnecting = false);
      this.tempLine.setAttribute('display', 'none');

      const els = document.elementsFromPoint(e.clientX, e.clientY);
      const h = els.find(el =>
        (el as HTMLElement).classList.contains('handle') &&
        (el as HTMLElement).closest('[data-id]')?.getAttribute('data-id') !== from.nodeId
      ) as HTMLElement | undefined;

      if (h) {
        const toEl = h.closest('[data-id]') as HTMLElement;
        const toId = toEl?.dataset['id'];
        const toRole = h.dataset['role']!;
        const pickerX = e.clientX;
        const pickerY = e.clientY;
        if (toId) {
          this.zone.run(() => {
            const nodes = this.members()?.nodes ?? [];
            const srcClassId = nodes.find(n => n.id === from.nodeId)?.elementClass?.id;
            const tgtClassId = nodes.find(n => n.id === toId)?.elementClass?.id;
            const tgtAncestors = tgtClassId ? this.getAncestorIds(tgtClassId, this.allClasses()) : [];
            const candidates = (srcClassId ? (this.complexAttrs.get(srcClassId) ?? []) : [])
              .filter(a => {
                const ids = a.targetClassIds ?? [];
                return ids.length === 0 || ids.some(id => tgtAncestors.includes(id));
              });

            if (candidates.length === 0) {
              return;
            } else if (candidates.length === 1) {
              this.createRelFromAttrDef(from.nodeId, toId, from.role, toRole, candidates[0]);
            } else {
              this.relPicker = { visible: true, x: pickerX, y: pickerY, options: candidates, fromId: from.nodeId, toId, fromRole: from.role, toRole };
            }
          });
        }
      }
    }
  }

  // ─── Liens SVG ────────────────────────────────────────────────────────────

  autoLayout() {
    const m = this.members();
    if (!m || m.nodes.length === 0) return;

    const NODE_W = 180, NODE_H = 80, H_GAP = 48, V_GAP = 80, MARGIN = 60;
    const nodes   = m.nodes;
    const edges   = m.edges.filter((e: any) => e.relationType !== 'APPARTENANCE');
    const nodeSet = new Set(nodes.map((n: any) => n.id));
    const positions = new Map<string, { x: number; y: number }>();

    if (edges.length === 0) {
      const cols = Math.ceil(Math.sqrt(nodes.length));
      nodes.forEach((n: any, i: number) => {
        positions.set(n.id, {
          x: MARGIN + (i % cols) * (NODE_W + H_GAP),
          y: MARGIN + Math.floor(i / cols) * (NODE_H + V_GAP),
        });
      });
    } else {
      // ── 1. Calcul des couches ──────────────────────────────────────────────
      const layer   = new Map<string, number>();
      const inStack = new Set<string>();

      const computeLayer = (id: string): number => {
        if (inStack.has(id)) return layer.get(id) ?? 0;
        if (layer.has(id))   return layer.get(id)!;
        layer.set(id, 0); inStack.add(id);
        const parents = edges.filter((e: any) => e.targetId === id && nodeSet.has(e.sourceId));
        const l = parents.length === 0
          ? 0
          : Math.max(...parents.map((e: any) => computeLayer(e.sourceId))) + 1;
        layer.set(id, l); inStack.delete(id);
        return l;
      };
      nodes.forEach((n: any) => computeLayer(n.id));

      // ── 2. Grouper par couche ─────────────────────────────────────────────
      const byLayer = new Map<number, string[]>();
      for (const [id, l] of layer) {
        if (!byLayer.has(l)) byLayer.set(l, []);
        byLayer.get(l)!.push(id);
      }
      const maxLayer = Math.max(...byLayer.keys());

      // Ordre initial stable
      for (const ids of byLayer.values()) ids.sort();

      // ── 3. Adjacence ──────────────────────────────────────────────────────
      const parents  = new Map<string, string[]>(nodes.map((n: any) => [n.id, []]));
      const children = new Map<string, string[]>(nodes.map((n: any) => [n.id, []]));
      for (const e of edges) {
        if (nodeSet.has(e.sourceId) && nodeSet.has(e.targetId)) {
          parents.get(e.targetId)!.push(e.sourceId);
          children.get(e.sourceId)!.push(e.targetId);
        }
      }

      // ── 4. Minimisation des croisements (barycenter, 4 passes) ───────────
      // La position d'un nœud = son rang dans sa couche courante
      const rankOf = (id: string) => byLayer.get(layer.get(id)!)!.indexOf(id);

      const bary = (id: string, neighbors: string[]) =>
        neighbors.length === 0
          ? rankOf(id)
          : neighbors.reduce((s, nid) => s + rankOf(nid), 0) / neighbors.length;

      for (let pass = 0; pass < 4; pass++) {
        // Passe descendante : trier couche l par position des parents en l-1
        for (let l = 1; l <= maxLayer; l++) {
          const ids = byLayer.get(l); if (!ids) continue;
          ids.sort((a, b) => {
            const pa = (parents.get(a) ?? []).filter(p => layer.get(p) === l - 1);
            const pb = (parents.get(b) ?? []).filter(p => layer.get(p) === l - 1);
            return bary(a, pa) - bary(b, pb);
          });
        }
        // Passe montante : trier couche l par position des enfants en l+1
        for (let l = maxLayer - 1; l >= 0; l--) {
          const ids = byLayer.get(l); if (!ids) continue;
          ids.sort((a, b) => {
            const ca = (children.get(a) ?? []).filter(c => layer.get(c) === l + 1);
            const cb = (children.get(b) ?? []).filter(c => layer.get(c) === l + 1);
            return bary(a, ca) - bary(b, cb);
          });
        }
      }

      // ── 5. Coordonnées finales ────────────────────────────────────────────
      let maxLayerW = 0;
      for (const ids of byLayer.values()) {
        const w = ids.length * (NODE_W + H_GAP) - H_GAP;
        if (w > maxLayerW) maxLayerW = w;
      }

      for (const [l, ids] of byLayer) {
        const layerW = ids.length * (NODE_W + H_GAP) - H_GAP;
        const startX = MARGIN + (maxLayerW - layerW) / 2;
        const y      = MARGIN + l * (NODE_H + V_GAP);
        ids.forEach((id, i) => positions.set(id, { x: startX + i * (NODE_W + H_GAP), y }));
      }
    }

    // ── Appliquer et persister ─────────────────────────────────────────────
    for (const [id, pos] of positions) {
      const el = this.nodeEls.get(id);
      if (el) { el.style.left = pos.x + 'px'; el.style.top = pos.y + 'px'; }
      this.positionChanged.emit({ id, x: pos.x, y: pos.y });
    }
    this.redrawLinks();
  }

  private redrawLinks() {
    if (this.tooltip) this.tooltip.style.display = 'none';
    this.linksEl.innerHTML = '';
    this.linkData.forEach(lk => {
      const from = this.getHandlePosById(lk.fromId, lk.fromRole);
      const to   = this.getHandlePosById(lk.toId,   lk.toRole);
      if (!from || !to) return;

      const cpH = Math.abs(to.x - from.x) * 0.5 + 40;
      const cpV = Math.abs(to.y - from.y) * 0.5 + 40;
      const p1  = this.cpOffset(from, lk.fromRole, cpH, cpV);
      const p2  = this.cpOffset(to,   lk.toRole,   cpH, cpV);
      lk._from = from; lk._to = to; lk._p1 = p1; lk._p2 = p2;

      const d = `M${from.x} ${from.y} C${p1.x} ${p1.y},${p2.x} ${p2.y},${to.x} ${to.y}`;

      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', d); path.setAttribute('fill', 'none');
      path.setAttribute('stroke-width', '1.8');
      path.setAttribute('stroke', lk.isDep ? 'rgba(255,255,255,.6)' : 'rgba(255,255,255,.85)');
      path.setAttribute('marker-end', lk.isDep ? 'url(#cv-arrow-dep)' : 'url(#cv-arrow)');
      path.setAttribute('pointer-events', 'none');
      if (lk.isDep) path.setAttribute('stroke-dasharray', '6,4');

      const hit = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      hit.setAttribute('d', d); hit.setAttribute('fill', 'none');
      hit.setAttribute('stroke', 'transparent'); hit.setAttribute('stroke-width', '12');
      hit.setAttribute('pointer-events', 'stroke'); hit.style.cursor = 'pointer';
      hit.addEventListener('contextmenu', e => {
        e.preventDefault();
        this.tooltip.style.display = 'none';
        this.linkData = this.linkData.filter(l => l.id !== lk.id);
        this.api.relations.delete(lk.id).subscribe();
        this.redrawLinks();
      });

      this.linksEl.appendChild(path);
      this.linksEl.appendChild(hit);
    });
  }

  private cpOffset(pt: {x:number,y:number}, role: string, cpH: number, cpV: number): {x:number,y:number} {
    switch (role) {
      case 'in':  return { x: pt.x - cpH, y: pt.y };
      case 'dep': return { x: pt.x,       y: pt.y + cpV };
      case 'top': return { x: pt.x,       y: pt.y - cpV };
      default:    return { x: pt.x + cpH, y: pt.y };  // 'out' et inconnu
    }
  }

  private isNearBezier(mx: number, my: number, from: {x:number,y:number}, to: {x:number,y:number}, p1: {x:number,y:number}, p2: {x:number,y:number}): boolean {
    for (let i = 0; i <= 24; i++) {
      const t = i / 24; const mt = 1 - t;
      const x = mt*mt*mt*from.x + 3*mt*mt*t*p1.x + 3*mt*t*t*p2.x + t*t*t*to.x;
      const y = mt*mt*mt*from.y + 3*mt*mt*t*p1.y + 3*mt*t*t*p2.y + t*t*t*to.y;
      if ((x-mx)*(x-mx) + (y-my)*(y-my) < 64) return true;
    }
    return false;
  }

  // ─── Context menu nœud ───────────────────────────────────────────────────

  private buildViewMenuItems(structures: Structure[], elementViews: any[], orgViews: any[]): ViewMenuItem[] {
    const items: ViewMenuItem[] = [];
    for (const s of structures) {
      const elementView = elementViews.find((v: any) => v.structureId === s.id);
      if (elementView) {
        items.push({ mode: 'open', label: s.name, viewId: elementView.id });
      } else {
        const globalViews = orgViews.filter((v: any) => v.structureId === s.id);
        const maxReached = s.maxInstances != null && globalViews.length >= s.maxInstances;
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

  deleteLink() {
    const lk = this.linkCtx.link;
    this.linkCtx.visible = false;
    this.linkData = this.linkData.filter(l => l.id !== lk.id);
    this.api.relations.delete(lk.id).subscribe();
    this.redrawLinks();
  }

  ctxEdit() {
    this.editRequested.emit(this.nodeCtx.nodeId);
    this.nodeCtx.visible = false;
  }

  ctxRename() {
    const el = this.nodeEls.get(this.nodeCtx.nodeId);
    if (el) {
      const lbl = el.querySelector('.node-label') as HTMLElement;
      if (lbl) { lbl.contentEditable = 'true'; lbl.focus(); }
    }
    this.nodeCtx.visible = false;
  }

  ctxRemove() {
    const id = this.nodeCtx.nodeId;
    this.nodeCtx.visible = false;
    this.memberRemoved.emit(id);
  }

  ctxDelete() {
    const id = this.nodeCtx.nodeId;
    this.nodeCtx.visible = false;
    if (!confirm('Supprimer définitivement cet élément ? Cette action est irréversible.')) return;
    this.api.elements.delete(id).subscribe(() => {
      this.memberRemoved.emit(id);
    });
  }

  ctxOpenView(viewId: string) {
    this.nodeCtx.visible = false;
    this.viewRequested.emit(viewId);
  }

  ctxCreateView(structure: Structure) {
    this.nodeCtx.visible = false;
    this.createViewRequested.emit({
      structureId: structure.id,
      structureName: structure.name,
      elementId: this.nodeCtx.nodeId,
      elementLabel: this.nodeCtx.nodeLabel,
    });
  }

  // ─── Création de relation ─────────────────────────────────────────────────

  private getEffectiveClassColor(cls: ElementClass | null | undefined): string {
    let cur: ElementClass | null | undefined = cls;
    while (cur) {
      if (cur.color) return cur.color;
      cur = cur.parentClass ?? null;
    }
    return '';
  }

  private getAncestorIds(classId: string, classes: ElementClass[]): string[] {
    const ids: string[] = [];
    let cur: ElementClass | undefined = classes.find(c => c.id === classId);
    while (cur) {
      ids.push(cur.id);
      cur = cur.parentClassId ? classes.find(c => c.id === cur!.parentClassId) : undefined;
    }
    return ids;
  }

  private createRelFromAttrDef(fromId: string, toId: string, fromRole: string, toRole: string, attrDef: AttributeDefinition) {
    this.api.relations.create({
      sourceId: fromId, targetId: toId,
      relationType: attrDef.relationType!,
      attributeDefinitionId: attrDef.id,
      label: `${fromRole}:${toRole}`,
    }).subscribe(rel => {
      this.linkData.push({
        id: rel.id, fromId, toId, fromRole, toRole,
        isDep: rel.relationType === 'DEPENDANCE',
        relationType: rel.relationType,
      });
      this.redrawLinks();
    });
  }

  pickRelation(attrDef: AttributeDefinition) {
    const { fromId, toId, fromRole, toRole } = this.relPicker;
    this.relPicker.visible = false;
    this.createRelFromAttrDef(fromId, toId, fromRole, toRole, attrDef);
  }

  // ─── Positions ────────────────────────────────────────────────────────────

  private getHandlePos(nodeEl: HTMLElement, h: HTMLElement) {
    const r = this.wrap.getBoundingClientRect();
    const hr = h.getBoundingClientRect();
    return { x: hr.left + hr.width/2 - r.left, y: hr.top + hr.height/2 - r.top };
  }

  private getHandlePosById(nodeId: string, role: string) {
    const el = this.nodeEls.get(nodeId);
    if (!el) return null;
    const h = el.querySelector(`.handle[data-role="${role}"]`) as HTMLElement;
    return h ? this.getHandlePos(el, h) : null;
  }
}
