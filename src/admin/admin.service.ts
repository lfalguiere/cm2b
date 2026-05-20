// src/admin/admin.service.ts
import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ElementType } from '../entities/element-type.entity';
import { ElementClass } from '../entities/element-class.entity';
import { AttributeDefinition } from '../entities/attribute-definition.entity';
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
