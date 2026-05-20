import {
  Component, OnInit, inject, signal, output, computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { DocumentApiService } from '../../../core/services/document-api.service';
import { ApiService } from '../../../core/services/api.service';
import { Structure } from '../../../core/models/document.models';
import { ElementClass } from '../../../core/models/api.models';

export interface MapSelection {
  label:    string;
  classIds: string[];   // empty = all
}

type StructureType = 'Organisationnelle' | 'Technique' | 'Physique';
const STRUCTURE_TYPES: StructureType[] = ['Organisationnelle', 'Technique', 'Physique'];
const TYPE_ICONS: Record<StructureType, string> = {
  Organisationnelle: '🏢',
  Technique:         '⚙️',
  Physique:          '🗺',
};

@Component({
  selector: 'app-map-nav',
  standalone: true,
  imports: [CommonModule],
  template: `
<div class="nav-panel">
  <div class="nav-header">
    <span class="nav-title">Cartographie</span>
    <button class="btn-collapse" (click)="collapsed.set(!collapsed())">
      {{ collapsed() ? '»' : '«' }}
    </button>
  </div>

  @if (!collapsed()) {
    <div class="nav-scroll">

      <!-- Tout afficher -->
      <div class="nav-item all-item"
        [class.active]="selection()?.label === '__all__'"
        (click)="selectAll()">
        <span class="all-dot">◉</span>
        Tout l'espace
      </div>

      <!-- Structures groupées par type -->
      @for (type of structureTypes; track type) {
        @if (byType()[type]?.length) {
          <div class="group">
            <div class="group-label" (click)="toggleGroup(type)">
              <span class="chevron">{{ openGroups().has(type) ? '▾' : '▸' }}</span>
              <span class="group-icon">{{ typeIcons[type] }}</span>
              {{ type }}
            </div>

            @if (openGroups().has(type)) {
              @for (struct of byType()[type]; track struct.id) {
                <div class="struct-row"
                  [class.active]="isStructActive(struct.id)"
                  (click)="selectStructure(struct)">
                  <span class="struct-icon">◈</span>
                  <span class="struct-name">{{ struct.name }}</span>
                </div>

                <!-- Classes de la structure (expandable) -->
                @if (isStructActive(struct.id) && classesFor(struct).length > 0) {
                  <div class="class-section">
                    <div class="class-all"
                      [class.active]="activeClassId() === null"
                      (click)="clearClassFilter()">
                      Toutes les classes
                    </div>
                    @for (cls of classesFor(struct); track cls.id) {
                      <div class="class-row"
                        [class.active]="activeClassId() === cls.id"
                        (click)="selectClass(struct, cls)">
                        <span class="class-dot" [style.background]="cls.color ?? cls.type?.color ?? '#555'"></span>
                        {{ cls.name }}
                      </div>
                    }
                  </div>
                }
              }
            }
          </div>
        }
      }

      @if (!hasAnyStructure()) {
        <div class="empty-nav">Aucune structure configurée</div>
      }
    </div>
  }
</div>
  `,
  styles: [`
    :host { display: block; height: 100%; }

    .nav-panel {
      width: 220px; height: 100%;
      background: #111;
      border-right: 1px solid #2a2a2a;
      display: flex; flex-direction: column;
      overflow: hidden; flex-shrink: 0;
      font-family: 'Syne', sans-serif;
    }

    .nav-header {
      display: flex; align-items: center;
      justify-content: space-between;
      padding: .5rem .75rem;
      border-bottom: 1px solid #2a2a2a; flex-shrink: 0;
    }
    .nav-title {
      font-size: .7rem; font-weight: 700;
      letter-spacing: .1em; text-transform: uppercase; color: #555;
    }
    .btn-collapse {
      background: none; border: none; color: #555;
      cursor: pointer; font-size: .9rem;
    }
    .btn-collapse:hover { color: #aaa; }

    .nav-scroll { flex: 1; overflow-y: auto; padding-bottom: 1rem; }

    /* Tout afficher */
    .all-item {
      display: flex; align-items: center; gap: .5rem;
      padding: .45rem .75rem;
      font-size: .78rem; color: #666; cursor: pointer;
      border-bottom: 1px solid #1e1e1e;
    }
    .all-item:hover { color: #ccc; background: #1a1a1a; }
    .all-item.active { color: #a5b4fc; background: #1e1b3a; }
    .all-dot { font-size: .65rem; color: #4f46e5; }

    /* Groupes */
    .group { }
    .group-label {
      display: flex; align-items: center; gap: .4rem;
      padding: .45rem .75rem;
      font-size: .68rem; font-weight: 700;
      color: #555; letter-spacing: .08em; text-transform: uppercase;
      cursor: pointer; user-select: none;
    }
    .group-label:hover { color: #888; }
    .chevron { font-size: .6rem; }
    .group-icon { font-size: .75rem; }

    /* Structures */
    .struct-row {
      display: flex; align-items: center; gap: .4rem;
      padding: .35rem .75rem .35rem 1.4rem;
      font-size: .8rem; cursor: pointer; color: #777;
      user-select: none;
    }
    .struct-row:hover { background: #1a1a1a; color: #ccc; }
    .struct-row.active { color: #a5b4fc; border-left: 2px solid #6366f1; }
    .struct-icon { font-size: .65rem; color: #3a3a3a; }
    .struct-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

    /* Classes */
    .class-section { padding-left: 1.8rem; }
    .class-all {
      padding: .25rem .5rem;
      font-size: .73rem; color: #555; cursor: pointer;
      border-left: 2px solid transparent;
    }
    .class-all:hover { color: #888; }
    .class-all.active { color: #aaa; border-color: #3a3a3a; }
    .class-row {
      display: flex; align-items: center; gap: .4rem;
      padding: .25rem .5rem;
      font-size: .75rem; color: #555; cursor: pointer;
      border-left: 2px solid transparent;
    }
    .class-row:hover { color: #aaa; }
    .class-row.active { color: #e8e8e8; border-color: currentColor; }
    .class-dot {
      width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0;
    }

    .empty-nav {
      padding: 1.5rem .75rem; font-size: .78rem;
      color: #333; text-align: center;
    }
  `],
})
export class MapNavComponent implements OnInit {
  private readonly docApi = inject(DocumentApiService);
  private readonly api    = inject(ApiService);

  selectionChange = output<MapSelection>();

  structures   = signal<Structure[]>([]);
  allClasses   = signal<ElementClass[]>([]);
  collapsed    = signal(false);
  openGroups   = signal<Set<string>>(new Set(STRUCTURE_TYPES));
  selection    = signal<{ label: string } | null>(null);

  private activeStructureId = signal<string | null>(null);
  activeClassId             = signal<string | null>(null);

  readonly structureTypes = STRUCTURE_TYPES;
  readonly typeIcons = TYPE_ICONS;

  readonly byType = computed((): Record<string, Structure[]> => {
    const result: Record<string, Structure[]> = {};
    STRUCTURE_TYPES.forEach(t => { result[t] = []; });
    this.structures().forEach(s => {
      (result[s.structureType] ??= []).push(s);
    });
    return result;
  });

  hasAnyStructure = computed(() =>
    this.structures().length > 0
  );

  ngOnInit() {
    this.docApi.structures.getAll().subscribe(s => this.structures.set(s));
    this.api.elementclasses.getClasses().subscribe(c => this.allClasses.set(c));
  }

  isStructActive(id: string): boolean {
    return this.activeStructureId() === id;
  }

  classesFor(struct: Structure): ElementClass[] {
    if (!struct.allowedClassIds?.length) return [];
    return this.allClasses().filter(c => struct.allowedClassIds.includes(c.id));
  }

  toggleGroup(type: string) {
    this.openGroups.update(s => {
      const n = new Set(s);
      n.has(type) ? n.delete(type) : n.add(type);
      return n;
    });
  }

  selectAll() {
    this.activeStructureId.set(null);
    this.activeClassId.set(null);
    this.selection.set({ label: '__all__' });
    this.selectionChange.emit({ label: 'Tout', classIds: [] });
  }

  selectStructure(struct: Structure) {
    this.activeStructureId.set(struct.id);
    this.activeClassId.set(null);
    this.selection.set({ label: struct.name });
    this.selectionChange.emit({
      label:    struct.name,
      classIds: struct.allowedClassIds ?? [],
    });
  }

  selectClass(struct: Structure, cls: ElementClass) {
    this.activeClassId.set(cls.id);
    this.selection.set({ label: cls.name });
    this.selectionChange.emit({
      label:    `${struct.name} · ${cls.name}`,
      classIds: [cls.id],
    });
  }

  clearClassFilter() {
    const sid = this.activeStructureId();
    if (!sid) return;
    const struct = this.structures().find(s => s.id === sid);
    if (struct) {
      this.activeClassId.set(null);
      this.selectStructure(struct);
    }
  }
}
