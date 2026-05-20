import {
  Component, OnInit, AfterViewInit, OnChanges, OnDestroy,
  input, output, inject, NgZone, SimpleChanges, signal, computed,
  ElementRef, ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Element as Cm2bElement, Relation, RelationType } from '../../../core/models/api.models';
import { ApiService } from '../../../core/services/api.service';

interface NodeRenderData {
  id: string;
  label: string;
  typeName: string;
  typeColor: string;
  className: string;
  x: number;
  y: number;
}

interface LinkRenderData {
  id: string;
  fromId: string;
  toId: string;
  relationType: RelationType;
}

const TYPE_COLORS: Record<string, string> = {
  'Organisationnel':   '#6366f1',
  'Actifs Humains':    '#f59e0b',
  'Actifs Techniques': '#10b981',
  'Actifs Physiques':  '#64748b',
};

/** Returns shape class for a type name */
function shapeClass(typeName: string): string {
  if (typeName === 'Actifs Humains')   return 'shape-circle';
  if (typeName === 'Actifs Physiques') return 'shape-hex';
  return 'shape-rect';
}

@Component({
  selector: 'app-map-canvas',
  standalone: true,
  imports: [CommonModule],
  template: `
<div class="canvas-wrap" #wrap
  (wheel)="onWheel($event)"
  (contextmenu)="$event.preventDefault()">

  <!-- Viewport transformé (pan + zoom) -->
  <div class="viewport" #viewport [style.transform]="vpTransform()">
    <!-- SVG des liens (même espace de coord que les nœuds) -->
    <svg class="links-svg" #linksSvg xmlns="http://www.w3.org/2000/svg">
      <defs>
        <marker id="mc-arr" markerWidth="8" markerHeight="8" refX="4" refY="3" orient="auto">
          <path d="M0,0 L0,6 L6,3 z" fill="rgba(255,255,255,0.85)"/>
        </marker>
        <marker id="mc-arr-dep" markerWidth="8" markerHeight="8" refX="4" refY="3" orient="auto">
          <path d="M0,0 L0,6 L6,3 z" fill="rgba(255,255,255,0.55)"/>
        </marker>
        <marker id="mc-arr-acc" markerWidth="8" markerHeight="8" refX="4" refY="3" orient="auto">
          <path d="M0,0 L0,6 L6,3 z" fill="rgba(100,200,255,0.8)"/>
        </marker>
      </defs>
      <g #linksGroup></g>
      <line #tempLine display="none"
        stroke="rgba(255,214,0,0.75)" stroke-width="1.5" stroke-dasharray="5,4"/>
    </svg>

    <!-- Nœuds DOM -->
    <div class="nodes-layer" #nodesEl></div>
  </div>

  <!-- État vide -->
  @if (nodes().length === 0) {
    <div class="empty-hint">
      Sélectionnez une structure ou une classe dans le panneau gauche
    </div>
  }

  <!-- Mini-map / zoom indicator -->
  <div class="zoom-badge">{{ (zoom() * 100) | number:'1.0-0' }}%</div>

  <!-- Contrôles zoom -->
  <div class="zoom-controls">
    <button (click)="zoomIn()">+</button>
    <button (click)="zoomOut()">−</button>
    <button (click)="resetView()" title="Réinitialiser la vue">⊙</button>
  </div>
</div>

<!-- Context menu nœud -->
@if (nodeCtx.visible) {
  <div class="ctx-menu" [style.left.px]="nodeCtx.x" [style.top.px]="nodeCtx.y">
    <div class="ctx-item" (click)="ctxRename()">✏ Renommer</div>
    <div class="ctx-item danger" (click)="ctxDelete()">✕ Supprimer</div>
  </div>
}
  `,
  styles: [`
    :host { display:block; height:100%; position:relative; }

    .canvas-wrap {
      width:100%; height:100%; overflow:hidden; position:relative;
      background-color:#0d0d0d;
      background-image: radial-gradient(#2a2a2a 1px, transparent 1px);
      background-size: 28px 28px;
      cursor: default;
    }
    .canvas-wrap.panning { cursor: grabbing; }
    .canvas-wrap.connecting { cursor: crosshair; }

    .viewport {
      position: absolute;
      top: 0; left: 0;
      transform-origin: 0 0;
      will-change: transform;
    }

    .links-svg {
      position: absolute;
      top: 0; left: 0;
      width: 8000px; height: 8000px;
      pointer-events: none;
      overflow: visible;
    }

    .nodes-layer {
      position: absolute;
      top: 0; left: 0;
      width: 8000px; height: 8000px;
    }

    /* ─── NODE SHAPES ───────────────────────────────────── */
    :host ::ng-deep .node {
      position: absolute;
      user-select: none;
      cursor: grab;
    }
    :host ::ng-deep .node:active { cursor: grabbing; }

    /* Rectangle (organisationnel, technique) */
    :host ::ng-deep .shape-rect .node-body {
      min-width: 150px;
      padding: 12px 28px;
      border-radius: 8px;
      display: flex; flex-direction: column; align-items: center;
      justify-content: center; position: relative;
      transition: box-shadow 0.2s;
    }

    /* Circle (humains) */
    :host ::ng-deep .shape-circle .node-body {
      width: 76px; height: 76px;
      border-radius: 50%;
      display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      position: relative;
      border-width: 2px; border-style: solid;
      transition: box-shadow 0.2s;
    }
    :host ::ng-deep .shape-circle .node-class {
      margin-top: 6px;
      text-align: center;
      max-width: 90px;
    }

    /* Hexagone (physique) */
    :host ::ng-deep .shape-hex .hex-wrap {
      position: relative;
      width: 130px; height: 74px;
      display: flex; align-items: center; justify-content: center;
    }
    :host ::ng-deep .shape-hex .hex-bg {
      position: absolute;
      inset: 0;
      clip-path: polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%);
    }
    :host ::ng-deep .shape-hex .node-label {
      position: relative; z-index: 1;
      width: 80px;
      padding: 0 4px;
    }

    /* Labels communs */
    :host ::ng-deep .node-label {
      color: #fff;
      font-size: 12px; font-weight: 600;
      text-align: center;
      word-break: break-word; line-height: 1.4;
      outline: none; cursor: text;
      font-family: 'Syne', sans-serif;
    }
    :host ::ng-deep .node-label:focus { background: rgba(0,0,0,0.15); border-radius: 4px; }
    :host ::ng-deep .node-class {
      font-size: 9px; font-family: 'JetBrains Mono', monospace;
      color: rgba(255,255,255,0.45); letter-spacing: 0.07em;
      text-transform: uppercase; margin-top: 3px;
      text-align: center; pointer-events: none;
    }
    :host ::ng-deep .node.selected .node-body,
    :host ::ng-deep .node.selected .hex-bg {
      outline: 2px solid rgba(255,255,255,0.35);
      outline-offset: 3px;
    }

    /* ─── HANDLES ───────────────────────────────────────── */
    :host ::ng-deep .handle {
      position: absolute;
      width: 13px; height: 13px;
      z-index: 10; cursor: crosshair;
    }
    :host ::ng-deep .handle-diamond {
      background: #FFD600;
      transform: rotate(45deg);
      border-radius: 2px;
      box-shadow: 0 0 5px rgba(255,214,0,0.5);
    }
    :host ::ng-deep .handle-circle {
      background: #777;
      border-radius: 50%;
      border: 2px solid #555;
    }

    /* ─── MISC ──────────────────────────────────────────── */
    .empty-hint {
      position: absolute; inset: 0;
      display: flex; align-items: center; justify-content: center;
      color: #333; font-size: .88rem; pointer-events: none;
      text-align: center; line-height: 1.6;
      font-family: 'Syne', sans-serif;
    }

    .zoom-badge {
      position: absolute; bottom: 12px; left: 14px;
      font-family: 'JetBrains Mono', monospace;
      font-size: 10px; color: #444; letter-spacing: .06em;
    }

    .zoom-controls {
      position: absolute; bottom: 8px; right: 12px;
      display: flex; flex-direction: column; gap: 2px;
    }
    .zoom-controls button {
      width: 26px; height: 26px;
      background: #1c1c1c; border: 1px solid #2a2a2a;
      border-radius: 5px; color: #666; cursor: pointer;
      font-size: 14px; line-height: 1; font-weight: 700;
      transition: all .12s;
    }
    .zoom-controls button:hover { color: #ccc; border-color: #555; }

    .ctx-menu {
      position: fixed; z-index: 999; background: #151515;
      border: 1px solid #3a3a3a; border-radius: 8px;
      padding: 5px; min-width: 160px; box-shadow: 0 8px 30px rgba(0,0,0,.7);
    }
    .ctx-item {
      padding: 7px 12px; border-radius: 5px; font-size: 12px;
      cursor: pointer; color: #888; font-family: 'Syne', sans-serif;
    }
    .ctx-item:hover { background: #242424; color: #e8e8e8; }
    .ctx-item.danger:hover { background: rgba(244,67,54,.15); color: #f44336; }
  `],
})
export class MapCanvasComponent implements OnInit, AfterViewInit, OnChanges, OnDestroy {
  @ViewChild('wrap')      private wrapRef!: ElementRef<HTMLDivElement>;
  @ViewChild('viewport')  private vpRef!: ElementRef<HTMLDivElement>;
  @ViewChild('linksGroup') private linksGroupRef!: ElementRef<SVGGElement>;
  @ViewChild('tempLine')  private tempLineRef!: ElementRef<SVGLineElement>;
  @ViewChild('nodesEl')   private nodesElRef!: ElementRef<HTMLDivElement>;

  private readonly zone = inject(NgZone);
  private readonly api  = inject(ApiService);

  nodes  = input<Cm2bElement[]>([]);
  edges  = input<Relation[]>([]);

  nodeSelected    = output<string | null>();
  positionChanged = output<{ id: string; x: number; y: number }>();
  relationCreated = output<{ sourceId: string; targetId: string }>();
  nodeDeleted     = output<string>();

  // ─── Pan / Zoom ──────────────────────────────────────────────────────────
  panX  = signal(60);
  panY  = signal(60);
  zoom  = signal(1);

  vpTransform = computed(() =>
    `translate(${this.panX()}px, ${this.panY()}px) scale(${this.zoom()})`
  );

  // ─── Context menu ─────────────────────────────────────────────────────────
  nodeCtx = { visible: false, x: 0, y: 0, nodeId: '' };

  // ─── Internal state ───────────────────────────────────────────────────────
  private nodeEls  = new Map<string, HTMLElement>();
  private linkData: LinkRenderData[] = [];

  private isPanning   = false;
  private panStartX   = 0; private panStartY = 0;
  private panOriginX  = 0; private panOriginY = 0;

  private dragging: HTMLElement | null = null;
  private dragNodeId  = '';
  private dragOffX    = 0; private dragOffY = 0;
  private dragStartX  = 0; private dragStartY = 0;

  private connecting: { nodeId: string; role: string } | null = null;
  private isConnecting = false;

  private selectedNodeId: string | null = null;

  private listeners: { el: EventTarget; type: string; fn: EventListener }[] = [];

  ngOnInit() {}

  ngAfterViewInit() {
    this.zone.runOutsideAngular(() => {
      const wrap = this.wrapRef.nativeElement;
      this.addListener(wrap, 'mousedown', (e) => this.onMouseDown(e as MouseEvent));
      this.addListener(wrap, 'mousemove', (e) => this.onMouseMove(e as MouseEvent));
      this.addListener(wrap, 'mouseup',   (e) => this.onMouseUp(e as MouseEvent));
      this.addListener(document, 'mousedown', (e) => this.onDocClick(e as MouseEvent));
      this.addListener(document, 'keydown',   (e) => this.onKeyDown(e as KeyboardEvent));
    });
    this.renderAll();
  }

  ngOnChanges(ch: SimpleChanges) {
    if ((ch['nodes'] || ch['edges']) && this.nodesElRef) {
      this.renderAll();
    }
  }

  ngOnDestroy() {
    this.listeners.forEach(({ el, type, fn }) => el.removeEventListener(type, fn));
  }

  private addListener(el: EventTarget, type: string, fn: EventListener) {
    el.addEventListener(type, fn);
    this.listeners.push({ el, type, fn });
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  private renderAll() {
    if (!this.nodesElRef) return;
    const nodesEl  = this.nodesElRef.nativeElement;
    const linksGrp = this.linksGroupRef.nativeElement;
    nodesEl.innerHTML  = '';
    linksGrp.innerHTML = '';
    this.nodeEls.clear();

    this.nodes().forEach(n => this.createNodeEl(n));
    this.linkData = this.edges().map(e => ({
      id: e.id, fromId: e.sourceId, toId: e.targetId, relationType: e.relationType,
    }));
    // Give DOM a tick before drawing links (nodes need to be painted first)
    setTimeout(() => this.redrawLinks(), 40);
  }

  private createNodeEl(node: Cm2bElement) {
    const typeName  = node.elementClass?.type?.name ?? '';
    const color     = this.colorFor(node);
    const shape     = shapeClass(typeName);
    const className = node.elementClass?.name ?? '';
    const x = node.canvasX ?? (100 + Math.random() * 400);
    const y = node.canvasY ?? (100 + Math.random() * 300);

    const el = document.createElement('div');
    el.className = `node ${shape}`;
    el.dataset['id'] = node.id;
    el.style.left = `${x}px`;
    el.style.top  = `${y}px`;

    el.innerHTML = this.buildNodeHTML(node.id, node.label, className, color, shape);
    this.setupNodeEvents(el, node.id, node.label);
    this.nodesElRef.nativeElement.appendChild(el);
    this.nodeEls.set(node.id, el);
  }

  private buildNodeHTML(id: string, label: string, className: string, color: string, shape: string): string {
    const dimColor = color + '33';
    if (shape === 'shape-circle') {
      return `
        <div class="node-body" style="background:${dimColor};border-color:${color};box-shadow:0 4px 20px ${color}22;">
          <div class="node-label" data-nid="${id}">${label}</div>
          <div class="handle handle-diamond" data-role="in"
            style="top:-7px;left:50%;transform:translateX(-50%) rotate(45deg);"></div>
          <div class="handle handle-diamond" data-role="out"
            style="bottom:-7px;left:50%;transform:translateX(-50%) rotate(45deg);"></div>
        </div>
        <div class="node-class">${className}</div>`;
    }
    if (shape === 'shape-hex') {
      return `
        <div class="hex-wrap">
          <div class="hex-bg" style="background:${color};box-shadow:0 4px 18px ${color}33;"></div>
          <div class="node-label" data-nid="${id}">${label}</div>
          <div class="handle handle-diamond" data-role="in"
            style="left:-7px;top:50%;transform:translateY(-50%) rotate(45deg);"></div>
          <div class="handle handle-diamond" data-role="out"
            style="right:-7px;top:50%;transform:translateY(-50%) rotate(45deg);"></div>
        </div>
        <div class="node-class">${className}</div>`;
    }
    // default: rect
    return `
      <div class="node-body" style="background:${color};box-shadow:0 4px 20px ${color}44;">
        <div class="node-label" data-nid="${id}">${label}</div>
        <div class="node-class">${className}</div>
        <div class="handle handle-diamond" data-role="in"
          style="left:-7px;top:50%;transform:translateY(-50%) rotate(45deg);"></div>
        <div class="handle handle-diamond" data-role="out"
          style="right:-7px;top:50%;transform:translateY(-50%) rotate(45deg);"></div>
        <div class="handle handle-circle" data-role="dep"
          style="bottom:-7px;left:50%;transform:translateX(-50%);"></div>
      </div>`;
  }

  private setupNodeEvents(el: HTMLElement, nodeId: string, label: string) {
    // Label double-click edit
    el.querySelectorAll('.node-label').forEach(lbl => {
      lbl.addEventListener('dblclick', e => {
        e.stopPropagation();
        (lbl as HTMLElement).contentEditable = 'true';
        (lbl as HTMLElement).focus();
      });
      lbl.addEventListener('blur', () => {
        (lbl as HTMLElement).contentEditable = 'false';
        const newLabel = (lbl as HTMLElement).innerText.trim();
        if (newLabel && newLabel !== label) {
          this.zone.run(() => this.api.elements.update(nodeId, { label: newLabel }).subscribe());
        }
      });
      lbl.addEventListener('keydown', e => {
        const ke = e as KeyboardEvent;
        if (ke.key === 'Enter') { ke.preventDefault(); (lbl as HTMLElement).blur(); }
        if (ke.key === 'Escape') (lbl as HTMLElement).blur();
      });
    });

    // Handle mousedown → start connection
    el.querySelectorAll('.handle').forEach(h => {
      h.addEventListener('mousedown', (e: Event) => {
        const me = e as MouseEvent;
        me.stopPropagation(); me.preventDefault();
        const role = (h as HTMLElement).dataset['role']!;
        const pos  = this.handleVpPos(el, h as HTMLElement);
        this.connecting = { nodeId, role };
        this.isConnecting = true;
        this.zone.run(() => this.wrapRef.nativeElement.classList.add('connecting'));
        const tl = this.tempLineRef.nativeElement;
        tl.setAttribute('x1', String(pos.x));
        tl.setAttribute('y1', String(pos.y));
        tl.setAttribute('x2', String(pos.x));
        tl.setAttribute('y2', String(pos.y));
        tl.setAttribute('display', 'block');
      });
    });

    // Right-click context
    el.addEventListener('contextmenu', (e: MouseEvent) => {
      e.preventDefault();
      this.zone.run(() => {
        this.nodeCtx = { visible: true, x: e.clientX, y: e.clientY, nodeId };
      });
    });
  }

  // ─── Mouse events on canvas-wrap ──────────────────────────────────────────

  private onMouseDown(e: MouseEvent) {
    const target = e.target as HTMLElement;
    if (target.closest('.ctx-menu')) return;

    // If clicking a handle, setupNodeEvents handles it
    if (target.classList.contains('handle')) return;

    // Click on a node body → start dragging
    const nodeEl = target.closest('.node') as HTMLElement | null;
    if (nodeEl && !this.isConnecting) {
      const nid = nodeEl.dataset['id']!;
      e.preventDefault();
      this.dragging   = nodeEl;
      this.dragNodeId = nid;
      const rect = nodeEl.getBoundingClientRect();
      this.dragOffX = (e.clientX - rect.left) / this.zoom();
      this.dragOffY = (e.clientY - rect.top)  / this.zoom();
      this.dragStartX = parseFloat(nodeEl.style.left);
      this.dragStartY = parseFloat(nodeEl.style.top);
      nodeEl.style.zIndex = '20';
      this.selectNode(nid);
      return;
    }

    // Click on background → pan
    if (!this.isConnecting) {
      this.isPanning  = true;
      this.panStartX  = e.clientX;
      this.panStartY  = e.clientY;
      this.panOriginX = this.panX();
      this.panOriginY = this.panY();
      this.wrapRef.nativeElement.classList.add('panning');
    }
  }

  private onMouseMove(e: MouseEvent) {
    if (this.dragging) {
      const wrap     = this.wrapRef.nativeElement;
      const wRect    = wrap.getBoundingClientRect();
      const z        = this.zoom();
      const newX = this.dragStartX + (e.clientX - wRect.left - this.panX()) / z - this.dragOffX;
      const newY = this.dragStartY + (e.clientY - wRect.top  - this.panY()) / z - this.dragOffY;
      this.dragging.style.left = `${Math.max(0, newX)}px`;
      this.dragging.style.top  = `${Math.max(0, newY)}px`;
      this.redrawLinks();
    }

    if (this.isPanning) {
      const dx = e.clientX - this.panStartX;
      const dy = e.clientY - this.panStartY;
      this.zone.run(() => {
        this.panX.set(this.panOriginX + dx);
        this.panY.set(this.panOriginY + dy);
      });
      this.redrawLinks();
    }

    if (this.isConnecting && this.connecting) {
      const wrap  = this.wrapRef.nativeElement;
      const wRect = wrap.getBoundingClientRect();
      const z     = this.zoom();
      const vpX   = (e.clientX - wRect.left - this.panX()) / z;
      const vpY   = (e.clientY - wRect.top  - this.panY()) / z;
      const tl    = this.tempLineRef.nativeElement;
      tl.setAttribute('x2', String(vpX));
      tl.setAttribute('y2', String(vpY));
    }
  }

  private onMouseUp(e: MouseEvent) {
    if (this.dragging) {
      const id = this.dragNodeId;
      const x  = parseFloat(this.dragging.style.left);
      const y  = parseFloat(this.dragging.style.top);
      this.dragging.style.zIndex = '';
      this.dragging = null;
      this.zone.run(() => this.positionChanged.emit({ id, x, y }));
    }

    if (this.isPanning) {
      this.isPanning = false;
      this.wrapRef.nativeElement.classList.remove('panning');
    }

    if (this.isConnecting && this.connecting) {
      const from = this.connecting;
      this.connecting   = null;
      this.isConnecting = false;
      this.wrapRef.nativeElement.classList.remove('connecting');
      this.tempLineRef.nativeElement.setAttribute('display', 'none');

      const els = document.elementsFromPoint(e.clientX, e.clientY);
      const h   = els.find(el =>
        (el as HTMLElement).classList.contains('handle') &&
        (el as HTMLElement).closest('[data-id]')?.getAttribute('data-id') !== from.nodeId
      ) as HTMLElement | undefined;

      if (h) {
        const toEl = h.closest('[data-id]') as HTMLElement;
        const toId = toEl?.dataset['id'];
        if (toId) {
          const isDep = from.role === 'dep' || h.dataset['role'] === 'dep';
          const relationType: RelationType = isDep ? 'DEPENDANCE' : 'PRODUCTION';
          this.zone.run(() => {
            this.api.relations.create({ sourceId: from.nodeId, targetId: toId, relationType })
              .subscribe(rel => {
                this.linkData.push({ id: rel.id, fromId: from.nodeId, toId, relationType });
                this.redrawLinks();
                this.relationCreated.emit({ sourceId: from.nodeId, targetId: toId });
              });
          });
        }
      }
    }
  }

  private onDocClick(e: MouseEvent) {
    if (!(e.target as HTMLElement).closest('.ctx-menu')) {
      this.zone.run(() => { this.nodeCtx.visible = false; });
    }
    if (!(e.target as HTMLElement).closest('.node')) {
      this.zone.run(() => {
        this.clearSelection();
        this.nodeSelected.emit(null);
      });
    }
  }

  private onKeyDown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      if (this.isConnecting) {
        this.connecting   = null;
        this.isConnecting = false;
        this.zone.run(() => this.wrapRef.nativeElement.classList.remove('connecting'));
        this.tempLineRef.nativeElement.setAttribute('display', 'none');
      }
    }
  }

  // ─── Zoom ──────────────────────────────────────────────────────────────────

  onWheel(e: WheelEvent) {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.08 : 0.925;
    const wrap   = this.wrapRef.nativeElement;
    const wRect  = wrap.getBoundingClientRect();
    const curX   = e.clientX - wRect.left;
    const curY   = e.clientY - wRect.top;

    this.zone.run(() => {
      const oldZ   = this.zoom();
      const newZ   = Math.min(3, Math.max(0.15, oldZ * factor));
      // Keep point under cursor fixed
      const vpCurX = (curX - this.panX()) / oldZ;
      const vpCurY = (curY - this.panY()) / oldZ;
      this.panX.set(curX - vpCurX * newZ);
      this.panY.set(curY - vpCurY * newZ);
      this.zoom.set(newZ);
    });
    this.redrawLinks();
  }

  zoomIn()    { this.applyZoom(1.15); }
  zoomOut()   { this.applyZoom(0.87); }
  resetView() {
    this.zone.run(() => { this.panX.set(60); this.panY.set(60); this.zoom.set(1); });
    this.redrawLinks();
  }

  private applyZoom(factor: number) {
    const wrap  = this.wrapRef.nativeElement;
    const wRect = wrap.getBoundingClientRect();
    const cx    = wRect.width  / 2;
    const cy    = wRect.height / 2;
    const oldZ  = this.zoom();
    const newZ  = Math.min(3, Math.max(0.15, oldZ * factor));
    const vpCx  = (cx - this.panX()) / oldZ;
    const vpCy  = (cy - this.panY()) / oldZ;
    this.zone.run(() => {
      this.panX.set(cx - vpCx * newZ);
      this.panY.set(cy - vpCy * newZ);
      this.zoom.set(newZ);
    });
    this.redrawLinks();
  }

  // ─── Links ────────────────────────────────────────────────────────────────

  private redrawLinks() {
    if (!this.linksGroupRef) return;
    const grp = this.linksGroupRef.nativeElement;
    grp.innerHTML = '';

    this.linkData.forEach(lk => {
      const from = this.handleVpPosByNodeId(lk.fromId, 'out');
      const to   = this.handleVpPosByNodeId(lk.toId,   'in');
      if (!from || !to) return;

      const dx = to.x - from.x;
      const cp = Math.abs(dx) * 0.5 + 40;
      const d  = `M${from.x} ${from.y} C${from.x+cp} ${from.y},${to.x-cp} ${to.y},${to.x} ${to.y}`;

      const [stroke, dash, markerId] = this.linkStyle(lk.relationType);

      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', d);
      path.setAttribute('fill', 'none');
      path.setAttribute('stroke', stroke);
      path.setAttribute('stroke-width', '1.8');
      path.setAttribute('marker-end', markerId);
      if (dash) path.setAttribute('stroke-dasharray', dash);

      // Invisible hit area for right-click delete
      const hit = path.cloneNode() as SVGPathElement;
      hit.setAttribute('stroke', 'transparent');
      hit.setAttribute('stroke-width', '10');
      hit.setAttribute('marker-end', 'none');
      hit.style.cursor = 'pointer';
      hit.style.pointerEvents = 'stroke';
      hit.addEventListener('contextmenu', ev => {
        ev.preventDefault();
        this.linkData = this.linkData.filter(l => l.id !== lk.id);
        this.zone.run(() => this.api.relations.delete(lk.id).subscribe());
        this.redrawLinks();
      });

      grp.appendChild(path);
      grp.appendChild(hit);
    });
  }

  private linkStyle(rt: RelationType): [string, string, string] {
    switch (rt) {
      case 'DEPENDANCE':   return ['rgba(255,255,255,0.55)', '6,4', 'url(#mc-arr-dep)'];
      case 'ACCES':        return ['rgba(100,200,255,0.75)', '3,3', 'url(#mc-arr-acc)'];
      case 'APPARTENANCE': return ['rgba(255,180,50,0.8)',   '',    'url(#mc-arr)'];
      case 'ASSOCIATION':  return ['rgba(180,180,180,0.5)',  '2,5', 'url(#mc-arr-dep)'];
      default:             return ['rgba(255,255,255,0.85)', '',    'url(#mc-arr)'];
    }
  }

  // ─── Positions viewport ───────────────────────────────────────────────────

  private handleVpPos(nodeEl: HTMLElement, handleEl: HTMLElement): { x: number; y: number } {
    const vpRect = this.vpRef.nativeElement.getBoundingClientRect();
    const hRect  = handleEl.getBoundingClientRect();
    const z      = this.zoom();
    return {
      x: (hRect.left + hRect.width  / 2 - vpRect.left) / z,
      y: (hRect.top  + hRect.height / 2 - vpRect.top)  / z,
    };
  }

  private handleVpPosByNodeId(nodeId: string, role: string): { x: number; y: number } | null {
    const el = this.nodeEls.get(nodeId);
    if (!el) return null;
    const h = el.querySelector(`.handle[data-role="${role}"]`) as HTMLElement;
    // Fallback: centre of node body
    if (!h) {
      const body = el.querySelector('.node-body') as HTMLElement ?? el;
      const vpRect = this.vpRef.nativeElement.getBoundingClientRect();
      const r = body.getBoundingClientRect();
      const z = this.zoom();
      return {
        x: (r.left + r.width  / 2 - vpRect.left) / z,
        y: (r.top  + r.height / 2 - vpRect.top)  / z,
      };
    }
    return this.handleVpPos(el, h);
  }

  // ─── Selection ────────────────────────────────────────────────────────────

  private selectNode(id: string) {
    this.clearSelection();
    this.selectedNodeId = id;
    this.nodeEls.get(id)?.classList.add('selected');
    this.zone.run(() => this.nodeSelected.emit(id));
  }

  private clearSelection() {
    if (this.selectedNodeId) {
      this.nodeEls.get(this.selectedNodeId)?.classList.remove('selected');
      this.selectedNodeId = null;
    }
  }

  // ─── Context menu actions ─────────────────────────────────────────────────

  ctxRename() {
    const el = this.nodeEls.get(this.nodeCtx.nodeId);
    const lbl = el?.querySelector('.node-label') as HTMLElement | null;
    if (lbl) { lbl.contentEditable = 'true'; lbl.focus(); }
    this.nodeCtx.visible = false;
  }

  ctxDelete() {
    const id = this.nodeCtx.nodeId;
    this.nodeCtx.visible = false;
    this.linkData = this.linkData.filter(l => l.fromId !== id && l.toId !== id);
    this.nodeEls.get(id)?.remove();
    this.nodeEls.delete(id);
    this.redrawLinks();
    this.zone.run(() => {
      this.nodeDeleted.emit(id);
      this.api.elements.delete(id).subscribe();
    });
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private colorFor(node: Cm2bElement): string {
    if (node.elementClass?.color) return node.elementClass.color;
    const typeName = node.elementClass?.type?.name ?? '';
    if (node.elementClass?.type?.color) return node.elementClass.type.color;
    return TYPE_COLORS[typeName] ?? '#4f46e5';
  }
}
