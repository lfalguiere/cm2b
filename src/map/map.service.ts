// src/graph/map.service.ts
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, Like, FindManyOptions } from 'typeorm';
import { Element } from '../entities/element.entity';
import { ElementClass } from '../entities/element-class.entity';
import { AttributeValue } from '../entities/attribute-value.entity';
import { AttributeDefinition, AttributeKind, SimpleAttributeType } from '../entities/attribute-definition.entity';
import { Relation } from '../entities/relation.entity';
import {
  CreateElementDto,
  UpdateElementDto,
  MoveElementDto,
  UpsertAttributeValueDto,
  ElementQueryDto,
} from './dto/element.dto';
import { AttributeDefinitionService } from '../elementclasses/attribute-definition.service';

@Injectable()
export class MapService {
  constructor(
    @InjectRepository(Element)
    private readonly elementRepo: Repository<Element>,

    @InjectRepository(ElementClass)
    private readonly classRepo: Repository<ElementClass>,

    @InjectRepository(AttributeValue)
    private readonly attrValueRepo: Repository<AttributeValue>,

    @InjectRepository(AttributeDefinition)
    private readonly attrDefRepo: Repository<AttributeDefinition>,

    @InjectRepository(Relation)
    private readonly relationRepo: Repository<Relation>,

    private readonly attrDefService: AttributeDefinitionService,

    private readonly dataSource: DataSource,
  ) {}

  // ─── LECTURE ──────────────────────────────────────────────────────────────

  async findAll(query?: ElementQueryDto): Promise<Element[]> {
    const where: FindManyOptions<Element>['where'] = {};
    if (query?.classId) where.elementClassId = query.classId;
    if (query?.search) where.label = Like(`%${query.search}%`);

    return this.elementRepo.find({
      where,
      relations: ['elementClass', 'elementClass.type', 'attributeValues'],
      order: { label: 'ASC' },
    });
  }

  async findOne(id: string): Promise<Element> {
    const el = await this.elementRepo.findOne({
      where: { id },
      relations: [
        'elementClass',
        'elementClass.type',
        'attributeValues',
        'attributeValues.attributeDefinition',
      ],
    });
    if (!el) throw new NotFoundException(`Element ${id} introuvable`);
    return el;
  }

  /**
   * Retourne l'élément avec ses relations entrantes et sortantes.
   * Utilisé pour afficher le panneau détail sur le canvas.
   */
  async findOneWithRelations(id: string): Promise<{
    element: Element;
    outgoing: Relation[];
    incoming: Relation[];
  }> {
    const element = await this.findOne(id);
    const [outgoing, incoming] = await Promise.all([
      this.relationRepo.find({
        where: { sourceId: id },
        relations: ['target', 'target.elementClass', 'attributeDefinition'],
      }),
      this.relationRepo.find({
        where: { targetId: id },
        relations: ['source', 'source.elementClass', 'attributeDefinition'],
      }),
    ]);
    return { element, outgoing, incoming };
  }

  // ─── CRÉATION ─────────────────────────────────────────────────────────────

  async create(dto: CreateElementDto): Promise<Element> {
    const cls = await this.classRepo.findOne({
      where: { id: dto.elementClassId },
    });
    if (!cls) {
      throw new NotFoundException(`ElementClass ${dto.elementClassId} introuvable`);
    }

    return this.dataSource.transaction(async (em) => {
      const element = em.create(Element, {
        label: dto.label,
        elementClassId: dto.elementClassId,
        canvasX: dto.canvasX ?? null,
        canvasY: dto.canvasY ?? null,
      });
      const saved = await em.save(Element, element);

      if (dto.attributeValues?.length) {
        await this.upsertAttributeValues(saved.id, dto.attributeValues, em);
      }

      return em.findOne(Element, {
        where: { id: saved.id },
        relations: ['elementClass', 'attributeValues'],
      }) as Promise<Element>;
    });
  }

  // ─── MISE À JOUR ──────────────────────────────────────────────────────────

  async update(id: string, dto: UpdateElementDto): Promise<Element> {
    const element = await this.findOne(id);

    return this.dataSource.transaction(async (em) => {
      if (dto.label !== undefined) element.label = dto.label;
      if (dto.canvasX !== undefined) element.canvasX = dto.canvasX;
      if (dto.canvasY !== undefined) element.canvasY = dto.canvasY;
      await em.save(Element, element);

      if (dto.attributeValues?.length) {
        await this.upsertAttributeValues(id, dto.attributeValues, em);
      }

      return em.findOne(Element, {
        where: { id },
        relations: ['elementClass', 'attributeValues', 'attributeValues.attributeDefinition'],
      }) as Promise<Element>;
    });
  }

  /** Mise à jour de position seule — endpoint optimisé pour le canvas */
  async move(id: string, dto: MoveElementDto): Promise<void> {
    const result = await this.elementRepo.update(id, {
      canvasX: dto.canvasX,
      canvasY: dto.canvasY,
    });
    if (result.affected === 0) {
      throw new NotFoundException(`Element ${id} introuvable`);
    }
  }

  // ─── SUPPRESSION ──────────────────────────────────────────────────────────

  async remove(id: string): Promise<void> {
    // Les relations sont supprimées en cascade (ON DELETE CASCADE sur sourceId/targetId)
    const result = await this.elementRepo.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`Element ${id} introuvable`);
    }
  }

  // ─── ATTRIBUTS ────────────────────────────────────────────────────────────

  private async upsertAttributeValues(
    elementId: string,
    dtos: UpsertAttributeValueDto[],
    em: any,
  ): Promise<void> {
    for (const dto of dtos) {
      const attrDef = await this.attrDefRepo.findOne({
        where: { id: dto.attributeDefinitionId },
      });

      if (!attrDef) {
        throw new NotFoundException(
          `AttributeDefinition ${dto.attributeDefinitionId} introuvable`,
        );
      }

      if (attrDef.kind === AttributeKind.COMPLEX) {
        throw new BadRequestException(
          `L'attribut "${attrDef.name}" est de type COMPLEX. Utilisez l'API /relations pour le lier.`,
        );
      }

      // Validation de la valeur selon le type
      if (dto.value !== null) {
        this.validateSimpleValue(dto.value, attrDef);
      }

      // UPSERT : cherche si une valeur existe déjà
      const existing = await em.findOne(AttributeValue, {
        where: { elementId, attributeDefinitionId: dto.attributeDefinitionId },
      });

      if (dto.value === null) {
        // Suppression explicite de la valeur
        if (existing) await em.delete(AttributeValue, existing.id);
      } else if (existing) {
        await em.update(AttributeValue, existing.id, { value: dto.value });
      } else {
        await em.save(
          AttributeValue,
          em.create(AttributeValue, {
            elementId,
            attributeDefinitionId: dto.attributeDefinitionId,
            value: dto.value,
          }),
        );
      }
    }
  }

  private validateSimpleValue(value: string, def: AttributeDefinition): void {
    // Regex personnalisée en priorité
    if (def.validationRegex) {
      const re = new RegExp(def.validationRegex);
      if (!re.test(value)) {
        throw new BadRequestException(
          `Valeur invalide pour "${def.name}" : ne correspond pas au pattern attendu`,
        );
      }
    }

    // Validation par type
    switch (def.simpleType) {
      case SimpleAttributeType.INTEGER:
        if (!Number.isInteger(Number(value))) {
          throw new BadRequestException(`"${def.name}" doit être un entier`);
        }
        break;
      case SimpleAttributeType.FLOAT:
        if (isNaN(Number(value))) {
          throw new BadRequestException(`"${def.name}" doit être un nombre`);
        }
        break;
      case SimpleAttributeType.BOOLEAN:
        if (!['true', 'false'].includes(value.toLowerCase())) {
          throw new BadRequestException(`"${def.name}" doit être true ou false`);
        }
        break;
      case SimpleAttributeType.IP_ADDRESS:
        if (!/^(\d{1,3}\.){3}\d{1,3}$/.test(value) && !/^[0-9a-f:]+$/i.test(value)) {
          throw new BadRequestException(`"${def.name}" doit être une adresse IP valide`);
        }
        break;
      case SimpleAttributeType.EMAIL:
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
          throw new BadRequestException(`"${def.name}" doit être un email valide`);
        }
        break;
      case SimpleAttributeType.STRING:
        if (def.maxLength && value.length > def.maxLength) {
          throw new BadRequestException(
            `"${def.name}" dépasse la longueur maximale (${def.maxLength} caractères)`,
          );
        }
        break;
    }
  }
}
