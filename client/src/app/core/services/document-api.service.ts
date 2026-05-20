// src/app/core/services/document-api.service.ts
import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Structure, ViewDetail, ViewMembers, StructureTreeGroup } from '../models/document.models';
import { Element } from '../models/api.models';

@Injectable({ providedIn: 'root' })
export class DocumentApiService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiUrl;

  // ── Structures (templates) ────────────────────────────────────────────────

  readonly structures = {
    getAll: (): Observable<Structure[]> =>
      this.http.get<Structure[]>(`${this.base}/structures`),

    getOne: (id: string): Observable<Structure> =>
      this.http.get<Structure>(`${this.base}/structures/${id}`),

    applicable: (classId: string): Observable<Structure[]> =>
      this.http.get<Structure[]>(`${this.base}/structures/applicable`, {
        params: new HttpParams().set('classId', classId),
      }),

    create: (dto: Partial<Structure>): Observable<Structure> =>
      this.http.post<Structure>(`${this.base}/structures`, dto),

    update: (id: string, dto: Partial<Structure>): Observable<Structure> =>
      this.http.put<Structure>(`${this.base}/structures/${id}`, dto),

    delete: (id: string): Observable<void> =>
      this.http.delete<void>(`${this.base}/structures/${id}`),
  };

  // ── Vues ──────────────────────────────────────────────────────────────────

  readonly views = {
    getAll: (organisationId: string): Observable<ViewDetail[]> =>
      this.http.get<ViewDetail[]>(`${this.base}/views`, {
        params: new HttpParams().set('organisationId', organisationId),
      }),

    getStructureTree: (organisationId: string): Observable<StructureTreeGroup[]> =>
      this.http.get<StructureTreeGroup[]>(`${this.base}/views/structure-tree`, {
        params: new HttpParams().set('organisationId', organisationId),
      }),

    getOne: (id: string): Observable<ViewDetail> =>
      this.http.get<ViewDetail>(`${this.base}/views/${id}`),

    getMembers: (id: string): Observable<ViewMembers> =>
      this.http.get<ViewMembers>(`${this.base}/views/${id}/members`),

    search: (id: string, q: string): Observable<Element[]> =>
      this.http.get<Element[]>(`${this.base}/views/${id}/search`, {
        params: new HttpParams().set('q', q),
      }),

    forElement: (elementId: string): Observable<ViewDetail[]> =>
      this.http.get<ViewDetail[]>(`${this.base}/views/for-element/${elementId}`),

    create: (dto: {
      name: string; structureId?: string | null;
      folderId?: string | null; organisationId: string;
      parentElementId?: string | null;
    }): Observable<ViewDetail> =>
      this.http.post<ViewDetail>(`${this.base}/views`, dto),

    update: (id: string, dto: { name?: string; folderId?: string | null }): Observable<ViewDetail> =>
      this.http.put<ViewDetail>(`${this.base}/views/${id}`, dto),

    delete: (id: string): Observable<void> =>
      this.http.delete<void>(`${this.base}/views/${id}`),

    addMember: (id: string, elementId: string): Observable<void> =>
      this.http.post<void>(`${this.base}/views/${id}/members`, { elementId }),

    removeMember: (id: string, elementId: string): Observable<void> =>
      this.http.delete<void>(`${this.base}/views/${id}/members/${elementId}`),

    moveInView: (viewId: string, elementId: string, x: number, y: number): Observable<void> =>
      this.http.patch<void>(`${this.base}/views/${viewId}/elements/${elementId}/position`, {
        canvasX: x, canvasY: y,
      }),
  };
}
