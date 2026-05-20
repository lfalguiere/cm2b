// src/graph/relation.service.ts
import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Relation } from '../entities/relation.entity';
import { Element } from '../entities/element.entity';
import { ElementClass } from '../entities/element-class.entity';
import { AttributeDefinition, AttributeKind } from '../entities/attribute-definition.entity';
import { CreateRelationDto, UpdateRelationDto } from './dto/element.dto';

@Injectable()
export class RelationService {
  constructor(
    @InjectRepository(Relation)
    private readonly relationRepo: Repository<Relation>,

    @InjectRepository(Element)
    private readonly elementRepo: Repository<Element>,

    @InjectRepository(AttributeDefinition)
    private readonly attrDefRepo: Repository<AttributeDefinition>,

    @InjectRepository(ElementClass)
    private readonly classRepo: Repository<ElementClass>,
  ) {}

  private async getAncestorChain(classId: string): Promise<string[]> {
    const chain: string[] = [];
    let currentId: string | null = classId;
    while (currentId) {
      chain.push(currentId);
      const cls = await this.classRepo.findOne({ where: { id: currentId }, select: ['id', 'parentClassId'] });
      currentId = cls?.parentClassId ?? null;
    }
    return chain;
  }

  // ─── LECTURE ──────────────────────────────────────────────────────────────

  async findAll(filters?: { sourceId?: string; targetId?: string; relationType?: string }) {
    const where: any = {};
    if (filters?.sourceId) where.sourceId = filters.sourceId;
    if (filters?.targetId) where.targetId = filters.targetId;
    if (filters?.relationType) where.relationType = filters.relationType;

    return this.relationRepo.find({
      where,
      relations: [
        'source', 'source.elementClass',
        'target', 'target.elementClass',
        'attributeDefinition',
      ],
    });
  }

  async findOne(id: string): Promise<Relation> {
    const rel = await this.relationRepo.findOne({
      where: { id },
      relations: ['source', 'target', 'attributeDefinition'],
    });
    if (!rel) throw new NotFoundException(`Relation ${id} introuvable`);
    return rel;
  }

  // ─── CRÉATION ─────────────────────────────────────────────────────────────

  async create(dto: CreateRelationDto): Promise<Relation> {
    // Vérifie que source et target existent
    const [source, target] = await Promise.all([
      this.elementRepo.findOne({ where: { id: dto.sourceId }, relations: ['elementClass'] }),
      this.elementRepo.findOne({ where: { id: dto.targetId }, relations: ['elementClass'] }),
    ]);

    if (!source) throw new NotFoundException(`Element source ${dto.sourceId} introuvable`);
    if (!target) throw new NotFoundException(`Element cible ${dto.targetId} introuvable`);

    if (dto.sourceId === dto.targetId) {
      throw new BadRequestException('Un élément ne peut pas être relié à lui-même');
    }

    let attrDef: AttributeDefinition | null = null;

    if (!dto.attributeDefinitionId) {
      // Auto-détection avec héritage : remonte les chaînes de classes source et cible
      const srcChain = await this.getAncestorChain(source.elementClassId);
      const tgtChain = await this.getAncestorChain(target.elementClassId);

      // Charge tous les candidats pour chaque classe source et filtre par classe cible
      for (const srcId of srcChain) {
        if (attrDef) break;
        const candidates = await this.attrDefRepo.find({
          where: { elementClassId: srcId, kind: AttributeKind.COMPLEX, relationType: dto.relationType as any },
        });
        attrDef = candidates.find(a => {
          const ids = a.targetClassIdList;
          return ids.length === 0 || ids.some(id => tgtChain.includes(id));
        }) ?? null;
      }

      if (attrDef?.maxRelations != null) {
        const count = await this.relationRepo.count({
          where: { sourceId: dto.sourceId, attributeDefinitionId: attrDef.id },
        });
        if (count >= attrDef.maxRelations) {
          throw new BadRequestException(
            `Cardinalité maximale atteinte pour "${attrDef.name}" (max: ${attrDef.maxRelations})`,
          );
        }
      }
    }

    if (dto.attributeDefinitionId) {
      attrDef = await this.attrDefRepo.findOne({
        where: { id: dto.attributeDefinitionId },
        relations: [],
      });

      if (!attrDef) {
        throw new NotFoundException(
          `AttributeDefinition ${dto.attributeDefinitionId} introuvable`,
        );
      }

      // Vérifie que la classe cible est compatible (sous-classe incluse)
      const allowedIds = attrDef.targetClassIdList;
      if (allowedIds.length > 0) {
        const tgtChain = await this.getAncestorChain(target.elementClassId);
        if (!allowedIds.some(id => tgtChain.includes(id))) {
          throw new BadRequestException(
            `La cible n'est pas d'une classe autorisée pour cet attribut`,
          );
        }
      }

      // Vérifie le type de relation
      if (attrDef.relationType !== dto.relationType) {
        throw new BadRequestException(
          `Le type de relation doit être "${attrDef.relationType}" pour cet attribut`,
        );
      }

      // Vérifie la cardinalité maximale côté source
      if (attrDef.maxRelations !== null) {
        const existingCount = await this.relationRepo.count({
          where: {
            sourceId: dto.sourceId,
            attributeDefinitionId: dto.attributeDefinitionId,
          },
        });
        if (existingCount >= attrDef.maxRelations) {
          throw new BadRequestException(
            `Cardinalité maximale atteinte pour "${attrDef.name}" ` +
              `(max: ${attrDef.maxRelations})`,
          );
        }
      }
    }

    // Vérifie l'unicité source-target-attrDef pour éviter les doublons
    const dupQb = this.relationRepo
      .createQueryBuilder('r')
      .where('r.sourceId = :src AND r.targetId = :tgt', {
        src: dto.sourceId,
        tgt: dto.targetId,
      });
    if (dto.attributeDefinitionId) {
      dupQb.andWhere('r.attributeDefinitionId = :attrId', { attrId: dto.attributeDefinitionId });
    } else {
      dupQb.andWhere('r.attributeDefinitionId IS NULL');
    }
    const duplicate = await dupQb.getOne();
    if (duplicate) {
      throw new BadRequestException('Cette relation existe déjà');
    }

    const resolvedAttrDefId = dto.attributeDefinitionId ?? attrDef?.id ?? null;
    const relation = this.relationRepo.create({
      sourceId: dto.sourceId,
      targetId: dto.targetId,
      relationType: dto.relationType,
      attributeDefinitionId: resolvedAttrDefId,
      label: dto.label ?? attrDef?.name ?? null,
    });

    return this.relationRepo.save(relation);
  }

  // ─── MISE À JOUR ──────────────────────────────────────────────────────────

  async update(id: string, dto: UpdateRelationDto): Promise<Relation> {
    const relation = await this.findOne(id);
    if (dto.label !== undefined) relation.label = dto.label;
    return this.relationRepo.save(relation);
  }

  // ─── SUPPRESSION ──────────────────────────────────────────────────────────

  async remove(id: string): Promise<void> {
    const result = await this.relationRepo.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`Relation ${id} introuvable`);
    }
  }

  /**
   * Construit une vue graphe pour le canvas.
   * Retourne tous les éléments et relations d'un périmètre donné.
   */
  async getGraphView(filters?: {
    typeIds?: string[];
    classIds?: string[];
  }): Promise<{ nodes: Element[]; edges: Relation[] }> {
    const nodeQb = this.elementRepo
      .createQueryBuilder('el')
      .leftJoinAndSelect('el.elementClass', 'cls')
      .leftJoinAndSelect('cls.type', 'type')
      .leftJoinAndSelect('el.attributeValues', 'av')
      .orderBy('el.label');

    if (filters?.classIds?.length) {
      nodeQb.andWhere('cls.id IN (:...classIds)', { classIds: filters.classIds });
    }
    if (filters?.typeIds?.length) {
      nodeQb.andWhere('type.id IN (:...typeIds)', { typeIds: filters.typeIds });
    }

    const nodes = await nodeQb.getMany();
    const nodeIds = nodes.map((n) => n.id);

    if (!nodeIds.length) return { nodes: [], edges: [] };

    const edges = await this.relationRepo
      .createQueryBuilder('r')
      .where('r.sourceId IN (:...ids) AND r.targetId IN (:...ids)', {
        ids: nodeIds,
      })
      .leftJoinAndSelect('r.attributeDefinition', 'ad')
      .getMany();

    return { nodes, edges };
  }
}
