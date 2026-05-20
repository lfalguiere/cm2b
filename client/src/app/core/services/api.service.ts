// src/app/core/services/api.service.ts
import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  ElementType, ElementClass, AttributeDefinition,
  Element, Relation, GraphView, ElementWithRelations,
  CreateElementDto, UpdateElementDto, CreateRelationDto,
  ElementQuery, Structure, CreateStructureDto,
} from '../models/api.models';

/**
 * Service HTTP central de CM2B.
 *
 * Chaque méthode correspond exactement à un endpoint REST backend.
 * L'intercepteur authInterceptor pose le header Bearer automatiquement.
 *
 * Organisation :
 *  - elementclasses() → /api/v1/elementclasses/*
 *  - elements()  → /api/v1/map/*
 *  - relations() → /api/v1/relations/*
 *  - graph()     → /api/v1/graph
 */
@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiUrl; // ex: http://localhost:3000/api/v1

  // ══════════════════════════════════════════════════
  // ELEMENT CLASSES
  // ══════════════════════════════════════════════════

  readonly elementclasses = {
    // ── Types ──────────────────────────────────────
    getTypes: (): Observable<ElementType[]> =>
      this.http.get<ElementType[]>(`${this.base}/elementclasses/types`),

    getType: (id: string): Observable<ElementType> =>
      this.http.get<ElementType>(`${this.base}/elementclasses/types/${id}`),

    createType: (dto: Partial<ElementType>): Observable<ElementType> =>
      this.http.post<ElementType>(`${this.base}/elementclasses/types`, dto),

    updateType: (id: string, dto: Partial<ElementType>): Observable<ElementType> =>
      this.http.put<ElementType>(`${this.base}/elementclasses/types/${id}`, dto),

    deleteType: (id: string): Observable<void> =>
      this.http.delete<void>(`${this.base}/elementclasses/types/${id}`),

    // ── Classes ────────────────────────────────────
    getClasses: (): Observable<ElementClass[]> =>
      this.http.get<ElementClass[]>(`${this.base}/elementclasses/classes`),

    getClassTree: (): Observable<ElementClass[]> =>
      this.http.get<ElementClass[]>(`${this.base}/elementclasses/classes/tree`),

    getClass: (id: string): Observable<ElementClass> =>
      this.http.get<ElementClass>(`${this.base}/elementclasses/classes/${id}`),

    createClass: (dto: Partial<ElementClass>): Observable<ElementClass> =>
      this.http.post<ElementClass>(`${this.base}/elementclasses/classes`, dto),

    updateClass: (id: string, dto: Partial<ElementClass>): Observable<ElementClass> =>
      this.http.put<ElementClass>(`${this.base}/elementclasses/classes/${id}`, dto),

    deleteClass: (id: string): Observable<void> =>
      this.http.delete<void>(`${this.base}/elementclasses/classes/${id}`),

    // ── AttributeDefinitions ───────────────────────
    /** Attributs propres (sans héritage) */
    getClassAttrs: (classId: string): Observable<AttributeDefinition[]> =>
      this.http.get<AttributeDefinition[]>(
        `${this.base}/elementclasses/classes/${classId}/attrs`,
      ),

    /** Attributs effectifs (héritage résolu) */
    getEffectiveAttrs: (classId: string): Observable<AttributeDefinition[]> =>
      this.http.get<AttributeDefinition[]>(
        `${this.base}/elementclasses/classes/${classId}/attrs/effective`,
      ),

    getAttr: (id: string): Observable<AttributeDefinition> =>
      this.http.get<AttributeDefinition>(`${this.base}/elementclasses/attrs/${id}`),

    createAttr: (
      dto: Partial<AttributeDefinition>,
    ): Observable<AttributeDefinition> =>
      this.http.post<AttributeDefinition>(`${this.base}/elementclasses/attrs`, dto),

    updateAttr: (
      id: string,
      dto: Partial<AttributeDefinition>,
    ): Observable<AttributeDefinition> =>
      this.http.put<AttributeDefinition>(
        `${this.base}/elementclasses/attrs/${id}`,
        dto,
      ),

    deleteAttr: (id: string): Observable<void> =>
      this.http.delete<void>(`${this.base}/elementclasses/attrs/${id}`),
  };

  // ══════════════════════════════════════════════════
  // ÉLÉMENTS (nœuds du graphe)
  // ══════════════════════════════════════════════════

  readonly elements = {
    getAll: (query?: ElementQuery): Observable<Element[]> => {
      let params = new HttpParams();
      if (query?.classId)  params = params.set('classId', query.classId);
      if (query?.typeId)   params = params.set('typeId', query.typeId);
      if (query?.search)   params = params.set('search', query.search);
      return this.http.get<Element[]>(`${this.base}/map`, { params });
    },

    getOne: (id: string): Observable<Element> =>
      this.http.get<Element>(`${this.base}/map/${id}`),

    /** Élément + ses relations — pour le panneau détail du canvas */
    getWithRelations: (id: string): Observable<ElementWithRelations> =>
      this.http.get<ElementWithRelations>(`${this.base}/map/${id}/graph`),

    create: (dto: CreateElementDto): Observable<Element> =>
      this.http.post<Element>(`${this.base}/map`, dto),

    update: (id: string, dto: UpdateElementDto): Observable<Element> =>
      this.http.put<Element>(`${this.base}/map/${id}`, dto),

    /** Déplacement canvas (drag & drop) — PATCH minimal */
    move: (id: string, x: number, y: number): Observable<void> =>
      this.http.patch<void>(`${this.base}/map/${id}/move`, {
        canvasX: x,
        canvasY: y,
      }),

    delete: (id: string): Observable<void> =>
      this.http.delete<void>(`${this.base}/map/${id}`),
  };

  // ══════════════════════════════════════════════════
  // RELATIONS (arêtes du graphe)
  // ══════════════════════════════════════════════════

  readonly relations = {
    getAll: (filters?: {
      sourceId?: string;
      targetId?: string;
      relationType?: string;
    }): Observable<Relation[]> => {
      let params = new HttpParams();
      if (filters?.sourceId)    params = params.set('sourceId', filters.sourceId);
      if (filters?.targetId)    params = params.set('targetId', filters.targetId);
      if (filters?.relationType) params = params.set('relationType', filters.relationType);
      return this.http.get<Relation[]>(`${this.base}/relations`, { params });
    },

    getOne: (id: string): Observable<Relation> =>
      this.http.get<Relation>(`${this.base}/relations/${id}`),

    create: (dto: CreateRelationDto): Observable<Relation> =>
      this.http.post<Relation>(`${this.base}/relations`, dto),

    updateLabel: (id: string, label: string): Observable<Relation> =>
      this.http.put<Relation>(`${this.base}/relations/${id}`, { label }),

    delete: (id: string): Observable<void> =>
      this.http.delete<void>(`${this.base}/relations/${id}`),
  };

  // ══════════════════════════════════════════════════
  // STRUCTURES
  // ══════════════════════════════════════════════════

  readonly structures = {
    getAll: (): Observable<Structure[]> =>
      this.http.get<Structure[]>(`${this.base}/structures`),

    getOne: (id: string): Observable<Structure> =>
      this.http.get<Structure>(`${this.base}/structures/${id}`),

    create: (dto: CreateStructureDto): Observable<Structure> =>
      this.http.post<Structure>(`${this.base}/structures`, dto),

    update: (id: string, dto: CreateStructureDto): Observable<Structure> =>
      this.http.put<Structure>(`${this.base}/structures/${id}`, dto),

    delete: (id: string): Observable<void> =>
      this.http.delete<void>(`${this.base}/structures/${id}`),

    reorder: (ids: string[]): Observable<void> =>
      this.http.patch<void>(`${this.base}/structures/order`, { ids }),
  };

  // ══════════════════════════════════════════════════
  // VUE GRAPHE (canvas)
  // ══════════════════════════════════════════════════

  readonly graph = {
    /**
     * Charge la vue canvas complète.
     * Filtrer par typeIds et/ou classIds pour limiter le périmètre affiché.
     */
    get: (filters?: {
      typeIds?: string[];
      classIds?: string[];
    }): Observable<GraphView> => {
      let params = new HttpParams();
      if (filters?.typeIds?.length)
        params = params.set('typeIds', filters.typeIds.join(','));
      if (filters?.classIds?.length)
        params = params.set('classIds', filters.classIds.join(','));
      return this.http.get<GraphView>(`${this.base}/graph`, { params });
    },
  };

  // ══════════════════════════════════════════════════
  // ADMIN — Export / Import
  // ══════════════════════════════════════════════════

  readonly admin = {
    exportData: (): Observable<any> =>
      this.http.get<any>(`${this.base}/admin/export`),

    importData: (data: any): Observable<{ imported: Record<string, number> }> =>
      this.http.post<{ imported: Record<string, number> }>(`${this.base}/admin/import`, data),
  };
}
