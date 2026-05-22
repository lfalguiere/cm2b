// src/admin/admin.service.ts
import { Injectable } from '@nestjs/common';
import { DataSource, In } from 'typeorm';
import { ElementType } from '../entities/element-type.entity';
import { ElementClass } from '../entities/element-class.entity';
import { AttributeDefinition, AttributeKind } from '../entities/attribute-definition.entity';
import { Element } from '../entities/element.entity';
import { AttributeValue } from '../entities/attribute-value.entity';
import { Relation } from '../entities/relation.entity';
import { ViewElementPosition } from '../entities/view-element-position.entity';
import { DocumentRevision } from '../entities/document-revision.entity';

export interface ImportResult {
  imported: Record<string, number>;
}

@Injectable()
export class AdminService {
  constructor(private readonly dataSource: DataSource) {}

  async exportAll() {
    const m = this.dataSource.manager;
    const [
      elementTypes,
      elementClasses,
      attributeDefinitions,
      elements,
      attributeValues,
      relations,
      viewElementPositions,
    ] = await Promise.all([
      m.find(ElementType),
      m.find(ElementClass),
      m.find(AttributeDefinition),
      m.find(Element),
      m.find(AttributeValue),
      m.find(Relation),
      m.find(ViewElementPosition),
    ]);

    return {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      elementTypes,
      elementClasses,
      attributeDefinitions,
      elements,
      attributeValues,
      relations,
      viewElementPositions,
    };
  }

  async exportSeed() {
    const m = this.dataSource.manager;
    const [elementTypes, elementClasses, attributeDefinitions] = await Promise.all([
      m.find(ElementType),
      m.find(ElementClass, { relations: ['type', 'parentClass'] }),
      m.find(AttributeDefinition),
    ]);

    const classNameById = new Map(elementClasses.map(c => [c.id, c.name]));

    const structureClass = elementClasses.find(c => c.name === 'Structure');
    let structures: any[] = [];
    if (structureClass) {
      const structureAttrs = await m.find(AttributeDefinition, { where: { elementClassId: structureClass.id } });
      const attrIdByName = new Map(structureAttrs.map(a => [a.name, a.id]));
      const structureElements = await m.find(Element, { where: { elementClassId: structureClass.id } });
      const elementIds = structureElements.map(e => e.id);
      const allAvs = elementIds.length ? await m.find(AttributeValue, { where: { elementId: In(elementIds) } }) : [];
      const avsByElement = new Map<string, AttributeValue[]>();
      for (const av of allAvs) {
        if (!avsByElement.has(av.elementId)) avsByElement.set(av.elementId, []);
        avsByElement.get(av.elementId)!.push(av);
      }
      structures = structureElements.map(el => {
        const avs = avsByElement.get(el.id) ?? [];
        const getVal = (name: string) =>
          avs.find(av => av.attributeDefinitionId === attrIdByName.get(name))?.value ?? null;
        const allowedRaw = getVal('allowedClassIds');
        const parentRaw = getVal('parentElementClassId');
        const maxRaw = getVal('maxInstances');
        return {
          label: el.label,
          structureType: getVal('structureType'),
          description: getVal('description'),
          allowedClassNames: allowedRaw
            ? (JSON.parse(allowedRaw) as string[]).map(id => classNameById.get(id) ?? id)
            : [],
          allowedRelTypes: getVal('allowedRelTypes') ? JSON.parse(getVal('allowedRelTypes')!) : [],
          maxInstances: maxRaw != null ? parseInt(maxRaw, 10) : null,
          parentElementClassName: parentRaw ? (classNameById.get(parentRaw) ?? null) : null,
        };
      });
    }

    return {
      version: '1.0',
      generatedAt: new Date().toISOString(),
      elementTypes: elementTypes.map(t => ({
        name: t.name,
        color: t.color ?? null,
        icon: t.icon ?? null,
      })),
      elementClasses: elementClasses.map(c => ({
        name: c.name,
        typeName: (c as any).type?.name ?? null,
        parentClassName: (c as any).parentClass?.name ?? null,
        icon: c.icon ?? null,
        color: c.color ?? null,
        description: c.description ?? null,
      })),
      attributeDefinitions: attributeDefinitions.map(a => {
        const base = {
          className: classNameById.get(a.elementClassId) ?? null,
          name: a.name,
          kind: a.kind,
          order: a.order,
          required: a.required,
          description: a.description ?? null,
        };
        if (a.kind === AttributeKind.SIMPLE) {
          return {
            ...base,
            simpleType: a.simpleType,
            validationRegex: a.validationRegex ?? null,
            maxLength: a.maxLength ?? null,
            defaultValue: a.defaultValue ?? null,
            enumOptions: a.enumOptions ?? null,
          };
        }
        return {
          ...base,
          relationType: a.relationType,
          inverseAttributeName: a.inverseAttributeName ?? null,
          targetClassNames: a.targetClassIds.map(id => classNameById.get(id) ?? id),
          minRelations: a.minRelations,
          maxRelations: a.maxRelations ?? null,
        };
      }),
      structures,
    };
  }

  async importAll(data: any): Promise<ImportResult> {
    // Les PRAGMA ne peuvent pas s'exécuter dans une transaction SQLite
    await this.dataSource.query('PRAGMA foreign_keys = OFF');

    try {
      await this.dataSource.transaction(async (manager) => {
        // Suppression dans l'ordre inverse des dépendances
        await manager.clear(ViewElementPosition);
        await manager.clear(DocumentRevision);
        await manager.clear(Relation);
        await manager.clear(AttributeValue);
        await manager.clear(Element);
        await manager.clear(AttributeDefinition);
        await manager.clear(ElementClass);
        await manager.clear(ElementType);

        // Insertion dans l'ordre des dépendances
        if (data.elementTypes?.length)
          await manager.insert(ElementType, data.elementTypes);
        if (data.elementClasses?.length)
          await manager.insert(ElementClass, data.elementClasses);
        if (data.attributeDefinitions?.length)
          await manager.insert(AttributeDefinition, data.attributeDefinitions);
        if (data.elements?.length)
          await manager.insert(Element, data.elements);
        if (data.attributeValues?.length)
          await manager.insert(AttributeValue, data.attributeValues);
        if (data.relations?.length)
          await manager.insert(Relation, data.relations);
        if (data.viewElementPositions?.length)
          await manager.insert(ViewElementPosition, data.viewElementPositions);
      });
    } finally {
      await this.dataSource.query('PRAGMA foreign_keys = ON');
    }

    return {
      imported: {
        elementTypes: data.elementTypes?.length ?? 0,
        elementClasses: data.elementClasses?.length ?? 0,
        attributeDefinitions: data.attributeDefinitions?.length ?? 0,
        elements: data.elements?.length ?? 0,
        attributeValues: data.attributeValues?.length ?? 0,
        relations: data.relations?.length ?? 0,
        viewElementPositions: data.viewElementPositions?.length ?? 0,
      },
    };
  }
}
