// src/app/features/canvas/list-view/list-view.component.ts
import { Component, input, computed, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ViewMembers } from '../../../core/models/document.models';
import { ElementClass, EnumOption } from '../../../core/models/api.models';

interface GroupedNode {
  typeName: string;
  typeColor: string;
  classes: {
    className: string;
    nodes: any[];
  }[];
}

@Component({
  selector: 'app-list-view',
  standalone: true,
  imports: [CommonModule],
  template: `
<div class="list-view">
  @if (grouped().length === 0) {
    <div class="empty">Aucun élément dans cette vue.</div>
  }

  @for (group of grouped(); track group.typeName) {
    <div class="type-section">
      <div class="type-header" [style.border-color]="group.typeColor">
        <span class="type-dot" [style.background]="group.typeColor"></span>
        {{ group.typeName }}
        <span class="type-count">{{ countNodes(group) }}</span>
      </div>

      @for (cls of group.classes; track cls.className) {
        <div class="class-section">
          <div class="class-header">{{ cls.className }}</div>

          <table class="node-table">
            <thead>
              <tr>
                <th>Libellé</th>
                @for (col of getColumns(cls.nodes); track col.name) {
                  <th [title]="col.description">{{ col.name }}</th>
                }
                <th class="th-actions"></th>
              </tr>
            </thead>
            <tbody>
              @for (node of cls.nodes; track node.id) {
                <tr>
                  <td class="label-cell">{{ node.label }}</td>
                  @for (col of getColumns(cls.nodes); track col.name) {
                    <td [title]="getCellTooltip(node, col.name)">
                      @let enumOpt = getEnumOpt(node, col.name);
                      @if (enumOpt) {
                        <span class="val-chip"
                              [style.color]="enumOpt.color || '#e8e8e8'"
                              [style.background]="enumOpt.bgColor || '#2a2a2a'">
                          {{ enumOpt.label || enumOpt.value }}
                        </span>
                      } @else {
                        {{ getCellValue(node, col.name) }}
                      }
                    </td>
                  }
                  <td class="td-actions">
                    <button class="btn-edit" (click)="editRequested.emit(node.id)" title="Éditer">✏️</button>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </div>
  }
</div>
  `,
  styles: [`
    .list-view {
      padding: 1.25rem;
      overflow-y: auto;
      height: 100%;
      background: #0d0d0d;
      color: #e8e8e8;
      font-family: 'Syne', system-ui, sans-serif;
    }

    .empty {
      color: #444; font-size: .9rem;
      display: flex; align-items: center; justify-content: center;
      height: 200px;
    }

    .type-section { margin-bottom: 2rem; }

    .type-header {
      display: flex; align-items: center; gap: .6rem;
      font-size: .72rem; font-weight: 700; text-transform: uppercase;
      letter-spacing: .1em; color: #777;
      border-left: 3px solid #444;
      padding: .35rem .75rem;
      margin-bottom: .75rem;
    }
    .type-dot {
      width: 8px; height: 8px; border-radius: 2px; flex-shrink: 0;
    }
    .type-count {
      margin-left: auto;
      background: #1c1c1c; border: 1px solid #2a2a2a;
      border-radius: 10px; padding: .1rem .5rem;
      font-size: .68rem; color: #555;
    }

    .class-section { margin-bottom: 1.25rem; margin-left: .75rem; }

    .class-header {
      font-size: .78rem; font-weight: 600; color: #555;
      margin-bottom: .5rem; letter-spacing: .05em;
    }

    .node-table {
      width: 100%; border-collapse: collapse;
      font-size: .82rem;
    }
    .node-table thead tr {
      border-bottom: 1px solid #2a2a2a;
    }
    .node-table th {
      text-align: left; padding: .4rem .75rem;
      font-size: .7rem; font-weight: 600; color: #555;
      letter-spacing: .06em; text-transform: uppercase;
      white-space: nowrap;
    }
    .node-table tbody tr {
      border-bottom: 1px solid #1a1a1a;
      transition: background .1s;
    }
    .node-table tbody tr:hover { background: #151515; }
    .node-table td {
      padding: .45rem .75rem; color: #aaa;
      vertical-align: top;
    }
    .label-cell { color: #e8e8e8; font-weight: 500; }
    .th-actions, .td-actions { width: 32px; text-align: center; padding: .2rem .4rem; }
    .btn-edit { background: none; border: none; cursor: pointer; font-size: .82rem; opacity: .25; transition: opacity .1s; }
    .node-table tbody tr:hover .btn-edit { opacity: .8; }
    .val-chip {
      display: inline-block; padding: .15rem .5rem;
      border-radius: 4px; font-size: .75rem; font-weight: 600;
      font-family: 'Syne', system-ui, sans-serif;
      white-space: nowrap;
    }
  `],
})
export class ListViewComponent {
  members        = input<ViewMembers | null>(null);
  allClasses     = input<ElementClass[]>([]);
  filterQuery    = input<string>('');
  extraEdges     = input<any[]>([]);
  editRequested  = output<string>();

  grouped = computed((): GroupedNode[] => {
    const m = this.members();
    if (!m || m.nodes.length === 0) return [];

    const q = this.filterQuery().trim().toLowerCase();
    const nodes = q
      ? m.nodes.filter((n: any) => n.label?.toLowerCase().includes(q))
      : m.nodes;

    // Groupe par type puis par classe
    const typeMap = new Map<string, Map<string, any[]>>();

    for (const node of nodes) {
      const typeName  = node.elementClass?.type?.name ?? 'Autre';
      const className = node.elementClass?.name ?? 'Inconnu';

      if (!typeMap.has(typeName)) typeMap.set(typeName, new Map());
      const classMap = typeMap.get(typeName)!;
      if (!classMap.has(className)) classMap.set(className, []);
      classMap.get(className)!.push(node);
    }

    const result: GroupedNode[] = [];
    typeMap.forEach((classMap, typeName) => {
      const color = this.getTypeColor(typeName);
      const classes: { className: string; nodes: any[] }[] = [];
      classMap.forEach((nodes, className) => classes.push({ className, nodes }));
      result.push({ typeName, typeColor: color, classes });
    });

    return result;
  });

  countNodes(group: GroupedNode): number {
    return group.classes.reduce((acc, c) => acc + c.nodes.length, 0);
  }

  getColumns(nodes: any[]): { name: string; description: string }[] {
    const cols = new Map<string, string>(); // name → description
    const allEdges = [...(this.members()?.edges ?? []), ...this.extraEdges()];
    for (const node of nodes) {
      for (const av of node.attributeValues ?? []) {
        const ad = av.attributeDefinition;
        if (ad?.name && !cols.has(ad.name)) cols.set(ad.name, ad.description ?? '');
      }
      for (const e of allEdges) {
        const ad = e.attributeDefinition;
        if (e.sourceId === node.id && ad?.name && !cols.has(ad.name)) {
          cols.set(ad.name, ad.description ?? '');
        }
        if (e.targetId === node.id && ad?.inverseAttributeName && !cols.has(ad.inverseAttributeName)) {
          cols.set(ad.inverseAttributeName, ad.description ?? '');
        }
      }
    }
    return Array.from(cols.entries()).map(([name, description]) => ({ name, description }));
  }

  getEnumOpt(node: any, colName: string): EnumOption | null {
    const av = (node.attributeValues ?? []).find(
      (v: any) => v.attributeDefinition?.name === colName,
    );
    if (!av?.value) return null;
    const ad = av.attributeDefinition;
    if (ad?.simpleType !== 'ENUM' || !ad.enumOptions) return null;
    try {
      const opts = JSON.parse(ad.enumOptions) as EnumOption[];
      return opts.find(o => o.value === av.value) ?? null;
    } catch { return null; }
  }

  getCellTooltip(node: any, colName: string): string {
    const av = (node.attributeValues ?? []).find(
      (v: any) => v.attributeDefinition?.name === colName,
    );
    if (!av?.value) return '';
    const ad = av.attributeDefinition;
    if (ad?.simpleType !== 'ENUM' || !ad.enumOptions) return '';
    try {
      const opts = JSON.parse(ad.enumOptions) as { value: string; description?: string }[];
      return opts.find(o => o.value === av.value)?.description ?? '';
    } catch { return ''; }
  }

  getCellValue(node: any, colName: string): string {
    const av = (node.attributeValues ?? []).find(
      (v: any) => v.attributeDefinition?.name === colName,
    );
    if (av) return av.value ?? '—';

    const allNodes = this.members()?.nodes ?? [];
    const allEdges = [...(this.members()?.edges ?? []), ...this.extraEdges()];

    const resolveLabel = (id: string, populated?: any): string =>
      populated?.label ?? allNodes.find((n: any) => n.id === id)?.label ?? '?';

    const outgoing = allEdges.filter((e: any) =>
      e.sourceId === node.id && e.attributeDefinition?.name === colName,
    );
    if (outgoing.length > 0) {
      return [...new Set(outgoing.map((e: any) => resolveLabel(e.targetId, e.target)))].join(', ');
    }

    const incoming = allEdges.filter((e: any) =>
      e.targetId === node.id && e.attributeDefinition?.inverseAttributeName === colName,
    );
    if (incoming.length === 0) return '—';
    return [...new Set(incoming.map((e: any) => resolveLabel(e.sourceId, e.source)))].join(', ');
  }

  private getTypeColor(typeName: string): string {
    const map: Record<string, string> = {
      'Organisationnel':  '#6366f1',
      'Actifs Humains':   '#f59e0b',
      'Actifs Techniques':'#10b981',
      'Actifs Physiques': '#64748b',
    };
    return map[typeName] ?? '#4f46e5';
  }
}
