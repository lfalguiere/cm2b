// src/view/structure.service.ts
import {
  Injectable, NotFoundException, BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, In } from 'typeorm';
import { Element } from '../entities/element.entity';
import { ElementClass } from '../entities/element-class.entity';
import { AttributeValue } from '../entities/attribute-value.entity';
import { AttributeDefinition, AttributeKind, SimpleAttributeType } from '../entities/attribute-definition.entity';
import { Relation } from '../entities/relation.entity';
import { CreateStructureDto, UpdateStructureDto } from './dto/view.dto';
import { RelationType } from '../entities/attribute-definition.entity';

/**
 * Une Structure est un Element de la classe "Structure".
 * Ses propriétés sont stockées dans AttributeValue :
 *   - structureType      : STRING  ('Organisationnelle' | 'Technique' | 'Physique')
 *   - allowedClassIds    : TEXT    (JSON array of UUIDs)
 *   - allowedRelTypes    : TEXT    (JSON array of RelationType)
 *   - maxInstances       : INTEGER (null = illimité)
 *   - description        : TEXT
 */
@Injectable()
export class StructureService {
  constructor(
    @InjectRepository(Element)
    private readonly elementRepo: Repository<Element>,

    @InjectRepository(ElementClass)
    private readonly classRepo: Repository<ElementClass>,

    @InjectRepository(AttributeValue)
    private readonly attrValueRepo: Repository<AttributeValue>,

    @InjectRepository(AttributeDefinition)
    private readonly attrDefRepo: Repository<AttributeDefinition>,

    private readonly dataSource: DataSource,
  ) {}

  // ─── Récupère la ElementClass "Structure" ────────────────────────────────────

  async getStructureClass(): Promise<ElementClass> {
    const cls = await this.classRepo.findOne({ where: { name: 'Structure' } });
    if (!cls) throw new NotFoundException('ElementClass "Structure" introuvable — lancez le seed');
    return cls;
  }

  // ─── LECTURE ────────────────────────────────────────────────────────────────

  async findAll(): Promise<any[]> {
    const cls = await this.getStructureClass();
    const elements = await this.elementRepo.find({
      where: { elementClassId: cls.id },
      relations: ['attributeValues', 'attributeValues.attributeDefinition'],
    });
    return elements
      .map(e => this.deserialize(e))
      .sort((a, b) => {
        if (a.sortOrder != null && b.sortOrder != null) return a.sortOrder - b.sortOrder;
        if (a.sortOrder != null) return -1;
        if (b.sortOrder != null) return 1;
        return a.name.localeCompare(b.name, 'fr');
      });
  }

  async findOne(id: string): Promise<any> {
    const el = await this.elementRepo.findOne({
      where: { id },
      relations: ['attributeValues', 'attributeValues.attributeDefinition', 'elementClass'],
    });
    if (!el) throw new NotFoundException(`Structure ${id} introuvable`);
    return this.deserialize(el);
  }

  // ─── CRÉATION ────────────────────────────────────────────────────────────────

  async create(dto: CreateStructureDto, userId: string): Promise<any> {
    const cls     = await this.getStructureClass();
    const attrDefs = await this.getAttrDefs(cls.id);

    return this.dataSource.transaction(async em => {
      const el = em.create(Element, {
        label: dto.name,
        elementClassId: cls.id,
      });
      const saved = await em.save(Element, el);
      await this.saveAttrValues(em, saved.id, dto, attrDefs);
      return this.findOne(saved.id);
    });
  }

  // ─── MISE À JOUR ─────────────────────────────────────────────────────────────

  async update(id: string, dto: UpdateStructureDto): Promise<any> {
    const el = await this.elementRepo.findOneBy({ id });
    if (!el) throw new NotFoundException(`Structure ${id} introuvable`);

    const attrDefs = await this.getAttrDefs(el.elementClassId);
    const dtoAttrNames = ['structureType', 'allowedClassIds', 'allowedRelTypes', 'maxInstances', 'description', 'parentElementClassId'];
    const dtoAttrIds = attrDefs.filter(d => dtoAttrNames.includes(d.name)).map(d => d.id);

    return this.dataSource.transaction(async em => {
      el.label = dto.name;
      await em.save(Element, el);
      if (dtoAttrIds.length > 0) {
        await em.delete(AttributeValue, { elementId: id, attributeDefinitionId: In(dtoAttrIds) });
      }
      await this.saveAttrValues(em, id, dto, attrDefs);
      return this.findOne(id);
    });
  }

  // ─── RÉORDONNANCEMENT ────────────────────────────────────────────────────────

  async reorder(orderedIds: string[]): Promise<void> {
    const cls = await this.getStructureClass();
    const attrDefs = await this.getAttrDefs(cls.id);
    let sortOrderDef = attrDefs.find(d => d.name === 'sortOrder');
    if (!sortOrderDef) {
      sortOrderDef = await this.attrDefRepo.save(this.attrDefRepo.create({
        elementClassId: cls.id, name: 'sortOrder',
        kind: AttributeKind.SIMPLE, simpleType: SimpleAttributeType.INTEGER,
        required: false, order: 99,
      }));
    }
    await this.attrValueRepo.delete({ attributeDefinitionId: sortOrderDef.id, elementId: In(orderedIds) });
    await this.attrValueRepo.save(
      orderedIds.map((id, i) => this.attrValueRepo.create({
        elementId: id, attributeDefinitionId: sortOrderDef!.id, value: String(i),
      })),
    );
  }

  // ─── SUPPRESSION ─────────────────────────────────────────────────────────────

  async remove(id: string): Promise<void> {
    // Cascade : supprimer toutes les vues liées à cette structure
    const viewClass = await this.classRepo.findOne({ where: { name: 'Vue' } });
    if (viewClass) {
      const structureAttrDef = await this.attrDefRepo.findOne({
        where: { elementClassId: viewClass.id, name: 'structureId' },
      });
      if (structureAttrDef) {
        const linkedAttrs = await this.attrValueRepo.find({
          where: { attributeDefinitionId: structureAttrDef.id, value: id },
        });
        const viewIds = linkedAttrs.map(a => a.elementId);
        if (viewIds.length > 0) {
          await this.dataSource.transaction(async em => {
            await em.delete(Relation, { sourceId: In(viewIds) });
            await em.delete(AttributeValue, { elementId: In(viewIds) });
            await em.delete(Element, { id: In(viewIds) });
          });
        }
      }
    }

    const result = await this.elementRepo.delete(id);
    if (result.affected === 0) throw new NotFoundException(`Structure ${id} introuvable`);
  }

  // ─── VALIDATION (utilisée par DocumentService) ────────────────────────────────

  async validate(structureId: string, classId: string): Promise<void> {
    const structure = await this.findOne(structureId);
    if (!structure.allowedClassIds.includes(classId)) {
      throw new BadRequestException(
        `La classe de cet élément n'est pas autorisée dans cette structure`,
      );
    }
  }

  async countViewsOfStructure(structureId: string, organisationId: string): Promise<number> {
    const docClass = await this.classRepo.findOne({ where: { name: 'Vue' } });
    if (!docClass) return 0;
    const attrDefs = await this.attrDefRepo.find({ where: { elementClassId: docClass.id } });
    const structureAttr = attrDefs.find(a => a.name === 'structureId');
    if (!structureAttr) return 0;
    return this.attrValueRepo.count({
      where: { attributeDefinitionId: structureAttr.id, value: structureId },
    });
  }

  // ─── PRIVÉ ───────────────────────────────────────────────────────────────────

  private async getAttrDefs(classId: string): Promise<AttributeDefinition[]> {
    const defs = await this.attrDefRepo.find({ where: { elementClassId: classId } });
    if (!defs.find(d => d.name === 'parentElementClassId')) {
      const newDef = await this.attrDefRepo.save(this.attrDefRepo.create({
        elementClassId: classId, name: 'parentElementClassId',
        kind: AttributeKind.SIMPLE, simpleType: SimpleAttributeType.STRING,
        required: false, order: 7,
      }));
      defs.push(newDef);
    }
    return defs;
  }

  private async saveAttrValues(em: any, elementId: string, dto: CreateStructureDto, defs: AttributeDefinition[]) {
    const map = new Map(defs.map(d => [d.name, d]));

    const pairs: [string, string][] = [
      ['structureType',        dto.structureType],
      ['allowedClassIds',      JSON.stringify(dto.allowedClassIds)],
      ['allowedRelTypes',      JSON.stringify(dto.allowedRelationTypes)],
      ['maxInstances',         dto.maxInstances != null ? String(dto.maxInstances) : ''],
      ['description',          dto.description ?? ''],
      ['parentElementClassId', dto.parentElementClassId ?? ''],
    ];

    for (const [name, value] of pairs) {
      const def = map.get(name);
      if (def && value !== '') {
        await em.save(AttributeValue, em.create(AttributeValue, {
          elementId,
          attributeDefinitionId: def.id,
          value,
        }));
      }
    }
  }

  async findApplicable(classId: string): Promise<any[]> {
    const all = await this.findAll();
    return all.filter((s: any) => s.parentElementClassId === classId);
  }

  private deserialize(el: Element): any {
    const get = (name: string) =>
      el.attributeValues?.find(v => v.attributeDefinition?.name === name)?.value ?? null;

    return {
      id:                   el.id,
      name:                 el.label,
      structureType:        get('structureType'),
      allowedClassIds:      JSON.parse(get('allowedClassIds') ?? '[]'),
      allowedRelationTypes: JSON.parse(get('allowedRelTypes') ?? '[]'),
      maxInstances:         get('maxInstances') ? parseInt(get('maxInstances')!) : null,
      description:          get('description'),
      sortOrder:            get('sortOrder') != null ? parseInt(get('sortOrder')!) : null,
      parentElementClassId: get('parentElementClassId'),
    };
  }
}
