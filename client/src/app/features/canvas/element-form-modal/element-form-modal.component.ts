// src/app/features/canvas/element-form-modal/element-form-modal.component.ts
import {
  Component, Input, Output, EventEmitter, OnInit, OnChanges,
  SimpleChanges, inject, signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin, of, Observable } from 'rxjs';
import { ApiService } from '../../../core/services/api.service';
import {
  ElementClass, AttributeDefinition, Element as CmElement,
  ElementWithRelations, Relation, EnumOption,
} from '../../../core/models/api.models';

@Component({
  selector: 'app-element-form-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
<div class="efm-backdrop" (click)="onBackdropClick($event)">
  <div class="efm-dialog" (click)="$event.stopPropagation()">

    <div class="efm-header">
      <span class="efm-title">{{ existing ? 'Modifier' : 'Créer' }} · {{ cls.name }}</span>
      <button class="efm-close" (click)="cancelled.emit()">✕</button>
    </div>

    <div class="efm-body">

      <!-- Libellé -->
      <div class="efm-field">
        <label class="efm-label">Libellé <span class="req">*</span></label>
        <input class="efm-input" [(ngModel)]="label" placeholder="Nom de l'élément"
               (keydown.escape)="cancelled.emit()" />
      </div>

      <!-- Attributs SIMPLE -->
      @for (attr of simpleAttrs(); track attr.id) {
        <div class="efm-field">
          <label class="efm-label">
            {{ attr.name }}
            @if (attr.required) { <span class="req">*</span> }
          </label>

          @if (attr.simpleType === 'TEXT') {
            <textarea class="efm-input efm-textarea" [(ngModel)]="attrValues[attr.id]"
                      [placeholder]="attr.description ?? ''"></textarea>
          } @else if (attr.simpleType === 'BOOLEAN') {
            <input type="checkbox" class="efm-check"
                   [checked]="attrValues[attr.id] === 'true'"
                   (change)="attrValues[attr.id] = $any($event.target).checked ? 'true' : 'false'" />
          } @else if (attr.simpleType === 'ENUM') {
            <select class="efm-input efm-select" [(ngModel)]="attrValues[attr.id]">
              <option value="">—</option>
              @for (opt of parseEnum(attr.enumOptions); track opt.value) {
                <option [value]="opt.value">{{ opt.label }}</option>
              }
            </select>
          } @else if (attr.simpleType === 'INTEGER') {
            <input type="number" step="1" class="efm-input"
                   [(ngModel)]="attrValues[attr.id]" [placeholder]="attr.description ?? ''" />
          } @else if (attr.simpleType === 'FLOAT') {
            <input type="number" step="any" class="efm-input"
                   [(ngModel)]="attrValues[attr.id]" [placeholder]="attr.description ?? ''" />
          } @else if (attr.simpleType === 'DATE') {
            <input type="date" class="efm-input" [(ngModel)]="attrValues[attr.id]" />
          } @else if (attr.simpleType === 'DATETIME') {
            <input type="datetime-local" class="efm-input" [(ngModel)]="attrValues[attr.id]" />
          } @else {
            <input type="text" class="efm-input"
                   [(ngModel)]="attrValues[attr.id]" [placeholder]="attr.description ?? ''" />
          }
        </div>
      }

      <!-- Attributs COMPLEX -->
      @for (attr of complexAttrs(); track attr.id) {
        <div class="efm-field">
          <label class="efm-label">
            {{ attr.name }}
            @if (attr.required) { <span class="req">*</span> }
          </label>

          @if (loadingTargets()) {
            <div class="efm-loading">Chargement…</div>
          } @else {
            @let targets = complexTargetsMap().get(attr.id) ?? [];
            @let isMulti = attr.maxRelations === null || (attr.maxRelations ?? 1) > 1;
            <select class="efm-input efm-select"
                    [class.efm-grayed]="!targets.length"
                    [disabled]="!targets.length"
                    [size]="isMulti ? 3 : 1"
                    [multiple]="isMulti"
                    (change)="onComplexChange($event, attr.id, isMulti)">
              @if (!isMulti) {
                <option value="">{{ targets.length ? '—' : '(Aucun disponible)' }}</option>
              }
              @for (el of targets; track el.id) {
                <option [value]="el.id"
                        [selected]="complexValues[attr.id]?.includes(el.id)">{{ el.label }}</option>
              }
            </select>
            @if (!targets.length) {
              <span class="efm-hint">Aucun élément disponible pour "{{ targetClassName(attr) }}"</span>
            }
          }
        </div>
      }

      @if (error()) {
        <div class="efm-error">{{ error() }}</div>
      }
    </div>

    <div class="efm-footer">
      <button class="efm-btn" (click)="cancelled.emit()">Annuler</button>
      <button class="efm-btn primary" (click)="submit()" [disabled]="saving()">
        {{ saving() ? 'Enregistrement…' : 'Enregistrer' }}
      </button>
    </div>

  </div>
</div>
  `,
  styles: [`
    .efm-backdrop {
      position:fixed; inset:0; background:rgba(0,0,0,.75); z-index:500;
      display:flex; align-items:center; justify-content:center;
    }
    .efm-dialog {
      background:#151515; border:1px solid #2a2a2a; border-radius:10px;
      width:100%; max-width:520px; max-height:85vh;
      display:flex; flex-direction:column;
    }
    .efm-header {
      display:flex; align-items:center; justify-content:space-between;
      padding:.85rem 1.1rem; border-bottom:1px solid #2a2a2a; flex-shrink:0;
    }
    .efm-title { font-size:.88rem; font-weight:600; color:#e8e8e8; }
    .efm-close {
      background:none; border:none; color:#555; cursor:pointer;
      font-size:.85rem; padding:.1rem .35rem; border-radius:4px;
    }
    .efm-close:hover { color:#aaa; background:#1f1f1f; }

    .efm-body {
      overflow-y:auto; padding:1rem 1.1rem; display:flex; flex-direction:column; gap:.85rem;
      scrollbar-width:thin; scrollbar-color:#2a2a2a transparent;
    }
    .efm-field { display:grid; grid-template-columns:140px 1fr; align-items:start; gap:.4rem .75rem; }
    .efm-label { font-size:.78rem; color:#888; padding-top:.45rem; }
    .req { color:#6366f1; }
    .efm-input {
      width:100%; background:#1a1a1a; border:1px solid #2a2a2a; border-radius:6px;
      color:#e8e8e8; font-size:.83rem; padding:.45rem .65rem; outline:none;
      font-family:inherit; box-sizing:border-box;
    }
    .efm-input:focus { border-color:#6366f1; }
    .efm-textarea { min-height:70px; resize:vertical; }
    .efm-select { cursor:pointer; }
    .efm-select[multiple] { padding:.3rem; }
    .efm-grayed { opacity:.4; cursor:not-allowed; }
    .efm-check { width:16px; height:16px; margin-top:.5rem; accent-color:#6366f1; cursor:pointer; }
    .efm-hint {
      grid-column:2; font-size:.72rem; color:#555; font-style:italic; margin-top:.1rem;
    }
    .efm-loading { font-size:.78rem; color:#555; padding-top:.4rem; }
    .efm-error { color:#f87171; font-size:.78rem; padding:.35rem 0; }

    .efm-footer {
      display:flex; gap:.5rem; justify-content:flex-end;
      padding:.75rem 1.1rem; border-top:1px solid #2a2a2a; flex-shrink:0;
    }
    .efm-btn {
      background:none; border:1px solid #2a2a2a; border-radius:6px;
      color:#888; cursor:pointer; font-size:.82rem; padding:.4rem .9rem;
    }
    .efm-btn:hover { color:#ccc; border-color:#444; }
    .efm-btn.primary { background:#4f46e5; border-color:#4f46e5; color:#fff; }
    .efm-btn.primary:hover { background:#4338ca; }
    .efm-btn:disabled { opacity:.5; cursor:not-allowed; }
  `],
})
export class ElementFormModalComponent implements OnInit, OnChanges {
  @Input() cls!: ElementClass;
  @Input() attrs: AttributeDefinition[] = [];
  @Input() existing?: CmElement;
  @Input() allClasses: ElementClass[] = [];

  @Output() saved = new EventEmitter<CmElement>();
  @Output() cancelled = new EventEmitter<void>();

  private readonly api = inject(ApiService);

  label = '';
  attrValues: Record<string, string> = {};
  complexValues: Record<string, string[]> = {};
  saving = signal(false);
  error = signal('');
  loadingTargets = signal(false);

  simpleAttrs = signal<AttributeDefinition[]>([]);
  complexAttrs = signal<AttributeDefinition[]>([]);
  complexTargetsMap = signal(new Map<string, CmElement[]>());

  ngOnInit() {
    this.initForm();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['attrs'] || changes['existing'] || changes['allClasses']) {
      this.initForm();
    }
  }

  private initForm() {
    const simple = this.attrs.filter(a => a.kind === 'SIMPLE').sort((a, b) => a.order - b.order);
    const complex = this.attrs.filter(a => a.kind === 'COMPLEX').sort((a, b) => a.order - b.order);
    this.simpleAttrs.set(simple);
    this.complexAttrs.set(complex);

    this.label = this.existing?.label ?? '';
    this.attrValues = {};
    this.complexValues = {};

    if (this.existing) {
      for (const av of this.existing.attributeValues ?? []) {
        this.attrValues[av.attributeDefinitionId] = av.value ?? '';
      }
    }

    this.loadComplexTargets(complex);
  }

  private loadComplexTargets(complex: AttributeDefinition[]) {
    if (!complex.length) return;

    this.loadingTargets.set(true);

    // For each COMPLEX attr, fetch from all targetClassIds and merge
    const requests: Observable<CmElement[]>[] = complex.map(a => {
      const ids = a.targetClassIds ?? [];
      if (ids.length === 0) return of([]);
      const perClass = ids.map(classId => this.api.elements.getAll({ classId }));
      return new Observable<CmElement[]>(obs => {
        forkJoin(perClass).subscribe({
          next: (arrays) => {
            const seen = new Set<string>();
            const merged: CmElement[] = [];
            for (const arr of arrays) {
              for (const el of arr) {
                if (!seen.has(el.id)) { seen.add(el.id); merged.push(el); }
              }
            }
            obs.next(merged); obs.complete();
          },
          error: (e) => obs.error(e),
        });
      });
    });

    forkJoin(requests).subscribe({
      next: (results) => {
        const m = new Map<string, CmElement[]>();
        complex.forEach((a, i) => m.set(a.id, results[i]));
        this.complexTargetsMap.set(m);
        this.loadingTargets.set(false);
      },
      error: () => this.loadingTargets.set(false),
    });
  }

  parseEnum(raw?: string | null): EnumOption[] {
    if (!raw) return [];
    try { return JSON.parse(raw) as EnumOption[]; } catch { return []; }
  }

  targetClassName(attr: AttributeDefinition): string {
    const ids = attr.targetClassIds ?? [];
    if (ids.length === 0) return 'Toute classe';
    return ids.map(id => this.allClasses.find(c => c.id === id)?.name ?? id).join(', ');
  }

  onComplexChange(event: Event, attrId: string, multi: boolean) {
    const select = event.target as HTMLSelectElement;
    this.complexValues[attrId] = multi
      ? Array.from(select.selectedOptions).map(o => o.value)
      : (select.value ? [select.value] : []);
  }

  onBackdropClick(e: MouseEvent) {
    if (e.target === e.currentTarget) this.cancelled.emit();
  }

  submit() {
    if (!this.label.trim()) {
      this.error.set('Le libellé est requis.');
      return;
    }
    this.saving.set(true);
    this.error.set('');

    const attributeValues = Object.entries(this.attrValues)
      .filter(([, v]) => v !== '' && v !== undefined && v !== null)
      .map(([attributeDefinitionId, value]) => ({ attributeDefinitionId, value }));

    const createOrUpdate$ = this.existing
      ? this.api.elements.update(this.existing.id, { label: this.label.trim(), attributeValues })
      : this.api.elements.create({ label: this.label.trim(), elementClassId: this.cls.id, attributeValues });

    createOrUpdate$.subscribe({
      next: (el) => this.handleRelations(el),
      error: (err: { error?: { message?: string } }) => {
        this.saving.set(false);
        this.error.set(err?.error?.message ?? 'Erreur lors de la sauvegarde.');
      },
    });
  }

  private handleRelations(el: CmElement) {
    const complexAttrs = this.complexAttrs();
    if (!complexAttrs.length) {
      this.saving.set(false);
      this.saved.emit(el);
      return;
    }

    const prepareDelete$: Observable<ElementWithRelations | null> = this.existing
      ? this.api.elements.getWithRelations(el.id)
      : of(null);

    prepareDelete$.subscribe({
      next: (withRels: ElementWithRelations | null) => {
        const deleteObs = complexAttrs.flatMap(attr => {
          if (!withRels) return [];
          return [
            ...(withRels.outgoing ?? []).filter((r: Relation) => r.attributeDefinitionId === attr.id),
            ...(withRels.incoming ?? []).filter((r: Relation) => r.attributeDefinitionId === attr.id),
          ].map((r: Relation) => this.api.relations.delete(r.id));
        });

        const deleteAll$ = deleteObs.length ? forkJoin(deleteObs) : of([]);
        deleteAll$.subscribe(() => {
          const createObs = complexAttrs.flatMap(attr =>
            (this.complexValues[attr.id] ?? []).filter(t => t).map(targetId =>
              this.api.relations.create({
                sourceId: el.id,
                targetId,
                relationType: attr.relationType!,
                attributeDefinitionId: attr.id,
              })
            )
          );
          const createAll$ = createObs.length ? forkJoin(createObs) : of([]);
          createAll$.subscribe({
            next: () => { this.saving.set(false); this.saved.emit(el); },
            error: (err: { error?: { message?: string } }) => {
              this.saving.set(false);
              this.error.set(err?.error?.message ?? 'Erreur lors de la création des relations.');
            },
          });
        });
      },
      error: (err: { error?: { message?: string } }) => {
        this.saving.set(false);
        this.error.set(err?.error?.message ?? 'Erreur.');
      },
    });
  }
}
