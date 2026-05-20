// src/app/features/canvas/element-edit-panel/element-edit-panel.component.ts
import {
  Component, effect, inject, input, output, signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin, of, Observable } from 'rxjs';
import { ApiService } from '../../../core/services/api.service';
import {
  AttributeDefinition, Element as CmElement,
  ElementWithRelations, Relation, EnumOption,
} from '../../../core/models/api.models';

@Component({
  selector: 'app-element-edit-panel',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
<div class="panel" [class.open]="elementId() !== null || createForClassId() !== null">

  <div class="panel-header">
    <div class="panel-title">
      <span class="el-label">{{ label || '…' }}</span>
      @if (elementClassName()) {
        <span class="el-class">· {{ elementClassName() }}</span>
      }
    </div>
    <button class="btn-close" (click)="close()">✕</button>
  </div>

  @if (loading()) {
    <div class="panel-loading">Chargement…</div>
  } @else {

    <div class="panel-body">

      <!-- Libellé -->
      <div class="field">
        <label class="field-label">Libellé <span class="req">*</span></label>
        <input class="field-input" [(ngModel)]="label" placeholder="Nom de l'élément" />
      </div>

      <!-- Attributs SIMPLE -->
      @for (attr of simpleAttrs(); track attr.id) {
        <div class="field">
          <label class="field-label">
            {{ attr.name }}
            @if (attr.required) { <span class="req">*</span> }
          </label>

          @if (attr.simpleType === 'TEXT') {
            <textarea class="field-input field-textarea" [(ngModel)]="attrValues[attr.id]"
                      [placeholder]="attr.description ?? ''"></textarea>
          } @else if (attr.simpleType === 'BOOLEAN') {
            <input type="checkbox" class="field-check"
                   [checked]="attrValues[attr.id] === 'true'"
                   (change)="attrValues[attr.id] = $any($event.target).checked ? 'true' : 'false'" />
          } @else if (attr.simpleType === 'ENUM') {
            @let selOpt = enumOption(attr.enumOptions, attrValues[attr.id]);
            <select class="field-input field-select" [(ngModel)]="attrValues[attr.id]"
                    [style.color]="selOpt?.color || ''"
                    [style.background]="selOpt?.bgColor || ''">
              <option value="" style="color:#aaa;background:#1a1a1a;">—</option>
              @for (opt of parseEnum(attr.enumOptions); track opt.value) {
                <option [value]="opt.value"
                        [style.color]="opt.color || '#e8e8e8'"
                        [style.background]="opt.bgColor || '#1a1a1a'">
                  {{ opt.label }}
                </option>
              }
            </select>
          } @else if (attr.simpleType === 'INTEGER') {
            <input type="number" step="1" class="field-input"
                   [(ngModel)]="attrValues[attr.id]" [placeholder]="attr.description ?? ''" />
          } @else if (attr.simpleType === 'FLOAT') {
            <input type="number" step="any" class="field-input"
                   [(ngModel)]="attrValues[attr.id]" [placeholder]="attr.description ?? ''" />
          } @else if (attr.simpleType === 'DATE') {
            <input type="date" class="field-input" [(ngModel)]="attrValues[attr.id]" />
          } @else if (attr.simpleType === 'DATETIME') {
            <input type="datetime-local" class="field-input" [(ngModel)]="attrValues[attr.id]" />
          } @else {
            <input type="text" class="field-input"
                   [(ngModel)]="attrValues[attr.id]" [placeholder]="attr.description ?? ''" />
          }
        </div>
      }

      <!-- Attributs COMPLEX -->
      @for (attr of complexAttrs(); track attr.id) {
        <div class="field">
          <label class="field-label">
            {{ attr.name }}
            @if (attr.required) { <span class="req">*</span> }
          </label>

          <div class="complex-editor">
            @if (loadingTargets()) {
              <div class="field-loading">Chargement…</div>
            } @else {
              @let selected = complexValues[attr.id] ?? [];
              @let isMulti = attr.maxRelations === null || (attr.maxRelations ?? 1) > 1;
              @let canAdd = isMulti || selected.length === 0;

              @if (selected.length > 0) {
                <div class="chips">
                  @for (elId of selected; track elId) {
                    <span class="chip">
                      <span class="chip-label">{{ labelForId(attr.id, elId) }}</span>
                      <button class="chip-remove" (click)="removeComplex(attr.id, elId)" title="Retirer">✕</button>
                    </span>
                  }
                </div>
              }

              @if (canAdd) {
                @let available = availableTargets(attr.id);
                @if (available.length > 0) {
                  <select class="field-input add-select" (change)="addComplex($event, attr.id)">
                    <option value="">＋ Ajouter…</option>
                    @for (el of available; track el.id) {
                      <option [value]="el.id">{{ el.label }}</option>
                    }
                  </select>
                } @else if (selected.length === 0) {
                  <span class="field-hint">Aucun élément disponible</span>
                }
              }
            }
          </div>
        </div>
      }

      @if (error()) {
        <div class="field-error">{{ error() }}</div>
      }

    </div>

    <div class="panel-footer">
      <button class="btn" (click)="close()">Annuler</button>
      <button class="btn primary" (click)="submit()" [disabled]="saving()">
        {{ saving() ? 'Enregistrement…' : (elementId() ? 'Enregistrer' : 'Créer') }}
      </button>
    </div>
  }

</div>
  `,
  styles: [`
    :host { color-scheme: dark; }

    .panel {
      position: fixed; right: 0; top: 0; bottom: 0; width: 560px;
      background: #111; border-left: 1px solid #2a2a2a;
      display: flex; flex-direction: column;
      transform: translateX(100%); transition: transform .25s ease;
      z-index: 400;
    }
    .panel.open { transform: translateX(0); }

    .panel-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: .85rem 1.1rem; border-bottom: 1px solid #2a2a2a; flex-shrink: 0;
      gap: .75rem; min-width: 0;
    }
    .panel-title { display: flex; flex-direction: column; gap: .15rem; min-width: 0; overflow: hidden; }
    .el-label { font-size: .92rem; font-weight: 600; color: #e8e8e8; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .el-class { font-size: .72rem; color: #555; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .btn-close { background: none; border: none; color: #555; cursor: pointer; font-size: .85rem; padding: .15rem .4rem; border-radius: 4px; flex-shrink: 0; }
    .btn-close:hover { color: #aaa; background: #1f1f1f; }

    .panel-loading { flex: 1; display: flex; align-items: center; justify-content: center; font-size: .85rem; color: #444; }

    .panel-body {
      flex: 1; overflow-y: auto; padding: 1rem 1.1rem;
      display: flex; flex-direction: column; gap: .85rem;
      scrollbar-width: thin; scrollbar-color: #2a2a2a transparent;
    }

    .field { display: grid; grid-template-columns: 150px 1fr; align-items: start; gap: .4rem .75rem; }
    .field-label { font-size: .78rem; color: #888; padding-top: .45rem; }
    .req { color: #6366f1; }

    .field-input {
      width: 100%; background: #1a1a1a; border: 1px solid #2a2a2a; border-radius: 6px;
      color: #e8e8e8; font-size: .83rem; padding: .45rem .65rem; outline: none;
      font-family: inherit; box-sizing: border-box; color-scheme: dark;
    }
    option { background: #1a1a1a; color: #e8e8e8; }
    .field-input:focus { border-color: #6366f1; }
    .field-textarea { min-height: 70px; resize: vertical; }
    .field-select { cursor: pointer; }
    .enum-preview {
      display: inline-block; padding: .2rem .6rem; border-radius: 5px;
      font-size: .78rem; font-weight: 600; margin-bottom: .35rem;
    }
    .field-check { width: 16px; height: 16px; margin-top: .5rem; accent-color: #6366f1; cursor: pointer; }
    .field-hint { font-size: .72rem; color: #555; font-style: italic; }
    .field-loading { font-size: .78rem; color: #555; padding-top: .4rem; }
    .field-error { color: #f87171; font-size: .78rem; padding: .35rem 0; }

    .complex-editor { display: flex; flex-direction: column; gap: .4rem; }
    .chips { display: flex; flex-wrap: wrap; gap: .35rem; }
    .chip {
      display: inline-flex; align-items: baseline; gap: .35rem;
      background: #1e1b3a; border: 1px solid #3730a3;
      border-radius: 4px; padding: .22rem .5rem .22rem .6rem;
      font-size: .78rem; color: #a5b4fc;
    }
    .chip-label { word-break: break-word; }
    .chip-remove {
      background: none; border: none; color: #818cf8; cursor: pointer;
      padding: 0; font-size: .65rem; line-height: 1; flex-shrink: 0; opacity: .7;
    }
    .chip-remove:hover { opacity: 1; color: #f87171; }
    .add-select { cursor: pointer; }

    .panel-footer {
      display: flex; gap: .5rem; justify-content: flex-end;
      padding: .75rem 1.1rem; border-top: 1px solid #2a2a2a; flex-shrink: 0;
    }
    .btn {
      background: none; border: 1px solid #2a2a2a; border-radius: 6px;
      color: #888; cursor: pointer; font-size: .82rem; padding: .4rem .9rem;
    }
    .btn:hover { color: #ccc; border-color: #444; }
    .btn.primary { background: #4f46e5; border-color: #4f46e5; color: #fff; }
    .btn.primary:hover { background: #4338ca; }
    .btn:disabled { opacity: .5; cursor: not-allowed; }
  `],
})
export class ElementEditPanelComponent {
  private readonly api = inject(ApiService);

  elementId        = input<string | null>(null);
  createForClassId = input<string | null>(null);
  saved            = output<void>();
  closed           = output<void>();
  relationsCreated = output<string[]>();

  loading        = signal(false);
  saving         = signal(false);
  error          = signal('');
  loadingTargets = signal(false);

  label            = '';
  elementClassName = signal('');
  private currentElementId: string | null = null;
  private createClassId: string | null = null;

  attrValues: Record<string, string>    = {};
  complexValues: Record<string, string[] | undefined> = {};
  private relationLabelMap = new Map<string, string>(); // elementId → label
  // attr IDs dont les valeurs proviennent des relations entrantes (attributs inverses)
  private inverseAttrIds = new Set<string>();

  simpleAttrs       = signal<AttributeDefinition[]>([]);
  complexAttrs      = signal<AttributeDefinition[]>([]);
  complexTargetsMap = signal(new Map<string, CmElement[]>());

  constructor() {
    effect(() => {
      const id      = this.elementId();
      const classId = this.createForClassId();

      if (id && id !== this.currentElementId) {
        this.currentElementId = id;
        this.createClassId = null;
        this.loadElement(id);
      } else if (!id && classId && classId !== this.createClassId) {
        this.createClassId = classId;
        this.currentElementId = null;
        this.loadForCreate(classId);
      } else if (!id && !classId) {
        this.currentElementId = null;
        this.createClassId = null;
        this.reset();
      }
    });
  }

  private reset() {
    this.label = '';
    this.elementClassName.set('');
    this.attrValues = {};
    this.complexValues = {};
    this.relationLabelMap.clear();
    this.inverseAttrIds.clear();
    this.simpleAttrs.set([]);
    this.complexAttrs.set([]);
    this.complexTargetsMap.set(new Map());
    this.error.set('');
  }

  private loadElement(id: string) {
    this.loading.set(true);
    this.error.set('');
    this.attrValues = {};
    this.complexValues = {};
    this.relationLabelMap.clear();

    this.api.elements.getWithRelations(id).subscribe({
      next: ({ element, outgoing, incoming }) => {
        this.label = element.label;
        this.elementClassName.set(element.elementClass?.name ?? '');

        for (const av of element.attributeValues ?? []) {
          this.attrValues[av.attributeDefinitionId] = av.value ?? '';
        }

        this.api.elementclasses.getEffectiveAttrs(element.elementClassId).subscribe({
          next: (defs) => {
            const simple  = defs.filter(d => d.kind === 'SIMPLE').sort((a, b) => a.order - b.order);
            const complex = defs.filter(d => d.kind === 'COMPLEX').sort((a, b) => a.order - b.order);
            this.simpleAttrs.set(simple);
            this.complexAttrs.set(complex);
            this.inverseAttrIds.clear();

            // Même logique que liste.component.ts :
            // relations sortantes → attributs directs
            // relations entrantes dont attrDefId = inverseAttributeDefinitionId → attributs inverses
            const ownAttrIds = new Set(complex.map(a => a.id));
            const inverseToOwn = new Map<string, string>();
            for (const attr of complex) {
              this.complexValues[attr.id] = [];
              if (attr.inverseAttributeDefinitionId) {
                inverseToOwn.set(attr.inverseAttributeDefinitionId, attr.id);
              }
            }

            for (const rel of outgoing) {
              const attrId = rel.attributeDefinitionId;
              if (!attrId || !ownAttrIds.has(attrId)) continue;
              this.complexValues[attrId]!.push(rel.targetId);
              if (rel.target?.label) this.relationLabelMap.set(rel.targetId, rel.target.label);
            }

            for (const rel of incoming) {
              const attrId = rel.attributeDefinitionId;
              if (!attrId) continue;
              const ourAttrId = inverseToOwn.get(attrId);
              if (!ourAttrId) continue;
              this.complexValues[ourAttrId]!.push(rel.sourceId);
              this.inverseAttrIds.add(ourAttrId);
              if (rel.source?.label) this.relationLabelMap.set(rel.sourceId, rel.source.label);
            }

            this.loading.set(false);
            this.loadComplexTargets(complex);
          },
          error: () => this.loading.set(false),
        });
      },
      error: () => this.loading.set(false),
    });
  }

  private loadForCreate(classId: string) {
    this.loading.set(true);
    this.error.set('');
    this.label = '';
    this.attrValues = {};
    this.complexValues = {};
    this.relationLabelMap.clear();
    this.inverseAttrIds.clear();

    forkJoin([
      this.api.elementclasses.getClass(classId),
      this.api.elementclasses.getEffectiveAttrs(classId),
    ]).subscribe({
      next: ([cls, defs]) => {
        this.elementClassName.set(cls.name);
        const simple  = defs.filter(d => d.kind === 'SIMPLE').sort((a, b) => a.order - b.order);
        const complex = defs.filter(d => d.kind === 'COMPLEX').sort((a, b) => a.order - b.order);
        this.simpleAttrs.set(simple);
        this.complexAttrs.set(complex);
        for (const attr of complex) this.complexValues[attr.id] = [];
        this.loading.set(false);
        this.loadComplexTargets(complex);
      },
      error: () => this.loading.set(false),
    });
  }

  private loadComplexTargets(complex: AttributeDefinition[]) {
    if (!complex.length) return;
    this.loadingTargets.set(true);

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

  enumOption(raw: string | null | undefined, value: string): EnumOption | null {
    if (!value) return null;
    return this.parseEnum(raw).find(o => o.value === value) ?? null;
  }

  availableTargets(attrId: string): CmElement[] {
    const targets = this.complexTargetsMap().get(attrId) ?? [];
    const selected = new Set(this.complexValues[attrId] ?? []);
    return targets.filter(t => !selected.has(t.id));
  }

  labelForId(attrId: string, elementId: string): string {
    const targets = this.complexTargetsMap().get(attrId) ?? [];
    return targets.find(t => t.id === elementId)?.label
      ?? this.relationLabelMap.get(elementId)
      ?? '…';
  }

  addComplex(event: Event, attrId: string) {
    const select = event.target as HTMLSelectElement;
    const id = select.value;
    if (!id) return;
    const current = this.complexValues[attrId] ?? [];
    if (!current.includes(id)) {
      this.complexValues = { ...this.complexValues, [attrId]: [...current, id] };
    }
    select.value = '';
  }

  removeComplex(attrId: string, elementId: string) {
    const current = this.complexValues[attrId] ?? [];
    this.complexValues = { ...this.complexValues, [attrId]: current.filter(id => id !== elementId) };
  }

  close() { this.closed.emit(); }

  submit() {
    if (!this.label.trim()) { this.error.set('Le libellé est requis.'); return; }
    this.saving.set(true);
    this.error.set('');

    const attributeValues = Object.entries(this.attrValues)
      .filter(([, v]) => v !== '' && v !== undefined && v !== null)
      .map(([attributeDefinitionId, value]) => ({ attributeDefinitionId, value }));

    const id = this.elementId();

    if (!id) {
      // Mode création
      this.api.elements.create({ label: this.label.trim(), elementClassId: this.createClassId! }).subscribe({
        next: (el) => {
          if (attributeValues.length) {
            this.api.elements.update(el.id, { label: el.label, attributeValues }).subscribe({
              next: (updated) => this.handleRelations(updated),
              error: (err: { error?: { message?: string } }) => {
                this.saving.set(false);
                this.error.set(err?.error?.message ?? 'Erreur lors de la création.');
              },
            });
          } else {
            this.handleRelations(el);
          }
        },
        error: (err: { error?: { message?: string } }) => {
          this.saving.set(false);
          this.error.set(err?.error?.message ?? 'Erreur lors de la création.');
        },
      });
      return;
    }

    this.api.elements.update(id, { label: this.label.trim(), attributeValues }).subscribe({
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
      this.saved.emit();
      return;
    }

    this.api.elements.getWithRelations(el.id).subscribe({
      next: (withRels: ElementWithRelations) => {
        // Mémorise les labels de poignées canvas (format "out:in") avant suppression
        const handleLabels = new Map<string, string>(); // "attrId:peerId" → label

        complexAttrs.forEach(attr => {
          if (this.inverseAttrIds.has(attr.id)) {
            (withRels.incoming ?? [])
              .filter((r: Relation) => r.attributeDefinitionId === attr.inverseAttributeDefinitionId && r.label)
              .forEach((r: Relation) => handleLabels.set(`${attr.id}:${r.sourceId}`, r.label!));
          } else {
            (withRels.outgoing ?? [])
              .filter((r: Relation) => r.attributeDefinitionId === attr.id && r.label)
              .forEach((r: Relation) => handleLabels.set(`${attr.id}:${r.targetId}`, r.label!));
          }
        });

        const deleteObs = complexAttrs.flatMap(attr => {
          if (this.inverseAttrIds.has(attr.id)) {
            // Attr inverse : supprimer les relations ENTRANTES dont attrDef = inverseAttributeDefinitionId
            return (withRels.incoming ?? [])
              .filter((r: Relation) => r.attributeDefinitionId === attr.inverseAttributeDefinitionId)
              .map((r: Relation) => this.api.relations.delete(r.id));
          } else {
            // Attr direct : supprimer les relations SORTANTES dont attrDef = attr.id
            return (withRels.outgoing ?? [])
              .filter((r: Relation) => r.attributeDefinitionId === attr.id)
              .map((r: Relation) => this.api.relations.delete(r.id));
          }
        });

        const deleteAll$ = deleteObs.length ? forkJoin(deleteObs) : of([]);
        deleteAll$.subscribe(() => {
          const createObs = complexAttrs.flatMap(attr => {
            const isInverse = this.inverseAttrIds.has(attr.id);
            return (this.complexValues[attr.id] ?? []).filter(t => t).map(elementId => {
              const label = handleLabels.get(`${attr.id}:${elementId}`) ?? undefined;
              return isInverse
                // Attr inverse : créer elementId → el.id avec attrDef = inverseAttributeDefinitionId
                ? this.api.relations.create({
                    sourceId: elementId,
                    targetId: el.id,
                    relationType: attr.relationType!,
                    attributeDefinitionId: attr.inverseAttributeDefinitionId!,
                    label,
                  })
                // Attr direct : créer el.id → elementId avec attrDef = attr.id
                : this.api.relations.create({
                    sourceId: el.id,
                    targetId: elementId,
                    relationType: attr.relationType!,
                    attributeDefinitionId: attr.id,
                    label,
                  });
            });
          });
          const newRelatedIds = [...new Set(
            complexAttrs.flatMap(attr => (this.complexValues[attr.id] ?? []).filter(Boolean))
          )];
          const createAll$ = createObs.length ? forkJoin(createObs) : of([]);
          createAll$.subscribe({
            next: () => {
              this.saving.set(false);
              this.saved.emit();
              if (newRelatedIds.length) this.relationsCreated.emit(newRelatedIds);
            },
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
