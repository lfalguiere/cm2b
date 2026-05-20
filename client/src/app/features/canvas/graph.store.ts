// src/app/features/canvas/graph.store.ts
import { Injectable, inject, signal, computed } from '@angular/core';
import { ApiService } from '../../core/services/api.service';
import { Element, Relation, ElementClass, ElementType } from '../../core/models/api.models';
import { tap, catchError, EMPTY } from 'rxjs';

/**
 * Store local du canvas.
 *
 * Utilise les signals Angular 17+ pour une réactivité fine-grained.
 * Pas de NgRx — le graphe est entièrement local au canvas.
 *
 * Architecture :
 *   - nodes / edges : état canonique (source de vérité)
 *   - selectedNodeId : sélection courante (panneau latéral)
 *   - pendingMoves : buffer de déplacements à débouncer avant envoi HTTP
 */
@Injectable()
export class GraphStore {
  private readonly api = inject(ApiService);

  // ── État ────────────────────────────────────────────────────────────────────

  readonly nodes = signal<Element[]>([]);
  readonly edges = signal<Relation[]>([]);
  readonly types = signal<ElementType[]>([]);
  readonly classes = signal<ElementClass[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly selectedNodeId = signal<string | null>(null);

  // ── Dérivés ─────────────────────────────────────────────────────────────────

  readonly selectedNode = computed(() => {
    const id = this.selectedNodeId();
    return id ? this.nodes().find((n) => n.id === id) ?? null : null;
  });

  readonly nodeCount = computed(() => this.nodes().length);
  readonly edgeCount = computed(() => this.edges().length);

  /** Index id → Element pour lookups O(1) */
  readonly nodeIndex = computed(() => {
    const idx = new Map<string, Element>();
    this.nodes().forEach((n) => idx.set(n.id, n));
    return idx;
  });

  // ── Chargement ──────────────────────────────────────────────────────────────

  loadGraph(filters?: { typeIds?: string[]; classIds?: string[] }): void {
    this.loading.set(true);
    this.error.set(null);

    this.api.graph
      .get(filters)
      .pipe(
        tap(({ nodes, edges }) => {
          this.nodes.set(nodes);
          this.edges.set(edges);
          this.loading.set(false);
        }),
        catchError((err) => {
          this.error.set(err?.error?.message ?? 'Erreur de chargement du graphe');
          this.loading.set(false);
          return EMPTY;
        }),
      )
      .subscribe();
  }

  loadElementClasses(): void {
    this.api.elementclasses.getTypes().pipe(
      tap((types) => this.types.set(types)),
    ).subscribe();

    this.api.elementclasses.getClasses().pipe(
      tap((classes) => this.classes.set(classes)),
    ).subscribe();
  }

  // ── Mutations locales (optimistic updates) ──────────────────────────────────

  addNode(node: Element): void {
    this.nodes.update((ns) => [...ns, node]);
  }

  updateNode(updated: Element): void {
    this.nodes.update((ns) =>
      ns.map((n) => (n.id === updated.id ? updated : n)),
    );
  }

  removeNode(id: string): void {
    this.nodes.update((ns) => ns.filter((n) => n.id !== id));
    // Supprime aussi les relations orphelines
    this.edges.update((es) =>
      es.filter((e) => e.sourceId !== id && e.targetId !== id),
    );
    if (this.selectedNodeId() === id) this.selectedNodeId.set(null);
  }

  moveNode(id: string, x: number, y: number): void {
    this.nodes.update((ns) =>
      ns.map((n) => (n.id === id ? { ...n, canvasX: x, canvasY: y } : n)),
    );
  }

  addEdge(edge: Relation): void {
    this.edges.update((es) => [...es, edge]);
  }

  removeEdge(id: string): void {
    this.edges.update((es) => es.filter((e) => e.id !== id));
  }

  selectNode(id: string | null): void {
    this.selectedNodeId.set(id);
  }

  // ── Actions HTTP avec mise à jour optimiste ──────────────────────────────────

  createElement(dto: Parameters<typeof this.api.elements.create>[0]): void {
    this.api.elements
      .create(dto)
      .pipe(tap((el) => this.addNode(el)))
      .subscribe();
  }

  deleteElement(id: string): void {
    // Optimistic : retire immédiatement du canvas
    this.removeNode(id);
    this.api.elements.delete(id).subscribe({
      error: () => {
        // Rollback : recharge le graphe en cas d'erreur
        this.loadGraph();
      },
    });
  }

  createRelation(dto: Parameters<typeof this.api.relations.create>[0]): void {
    this.api.relations
      .create(dto)
      .pipe(tap((rel) => this.addEdge(rel)))
      .subscribe();
  }

  deleteRelation(id: string): void {
    this.removeEdge(id);
    this.api.relations.delete(id).subscribe({
      error: () => this.loadGraph(),
    });
  }

  /**
   * Déplacement avec debounce côté canvas.
   * Le canvas appelle moveNode() à chaque frame de drag (local, instantané)
   * et persistMove() une seule fois au mouseup (HTTP).
   */
  persistMove(id: string, x: number, y: number): void {
    this.api.elements.move(id, x, y).subscribe();
  }
}
