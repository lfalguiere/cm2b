// src/metamodel/attribute-definition.service.ts
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, In } from 'typeorm';
import {
  AttributeDefinition,
  AttributeKind,
  RelationType,
} from '../entities/attribute-definition.entity';
import { ElementClass } from '../entities/element-class.entity';
import { AttributeValue } from '../entities/attribute-value.entity';
import { Relation } from '../entities/relation.entity';
import {
  CreateAttributeDefinitionDto,
  UpdateAttributeDefinitionDto,
} from './dto/attribute-definition.dto';

@Injectable()
export class AttributeDefinitionService {
  constructor(
    @InjectRepository(AttributeDefinition)
    private readonly attrRepo: Repository<AttributeDefinition>,

    @InjectRepository(ElementClass)
    private readonly classRepo: Repository<ElementClass>,

    private readonly dataSource: DataSource,
  ) {}

  // ─── LECTURE ──────────────────────────────────────────────────────────────

  async findByClass(elementClassId: string): Promise<AttributeDefinition[]> {
    await this.assertClassExists(elementClassId);
    return this.attrRepo.find({
      where: { elementClassId },
      relations: [],
      order: { order: 'ASC', name: 'ASC' },
    });
  }

  /**
   * Retourne les attributs effectifs d'une classe, héritage inclus.
   * Remonte la chaîne parentClass et fusionne les AttributeDefinitions.
   * Les attributs propres à la classe ont priorité sur les parents (même nom).
   */
  async findEffectiveByClass(
    elementClassId: string,
  ): Promise<AttributeDefinition[]> {
    const chain = await this.getClassChain(elementClassId);
    const seen = new Set<string>();
    const result: AttributeDefinition[] = [];

    for (const classId of chain) {
      const attrs = await this.attrRepo.find({
        where: { elementClassId: classId },
        relations: [],
        order: { order: 'ASC' },
      });
      for (const attr of attrs) {
        if (!seen.has(attr.name)) {
          seen.add(attr.name);
          result.push(attr);
        }
      }
    }

    return result;
  }

  async findOne(id: string): Promise<AttributeDefinition> {
    const attr = await this.attrRepo.findOne({
      where: { id },
      relations: ['elementClass'],
    });
    if (!attr) throw new NotFoundException(`AttributeDefinition ${id} introuvable`);
    return attr;
  }

  // ─── CRÉATION ─────────────────────────────────────────────────────────────

  /**
   * Pour les attributs COMPLEX, crée automatiquement l'attribut inverse
   * sur CHAQUE classe cible (bidirectionnalité) dans une transaction.
   */
  async create(dto: CreateAttributeDefinitionDto): Promise<AttributeDefinition> {
    await this.assertClassExists(dto.elementClassId);
    await this.assertUniqueName(dto.elementClassId, dto.name);

    if (dto.kind === AttributeKind.COMPLEX) {
      return this.createComplexBidirectional(dto);
    }

    return this.attrRepo.save(
      this.attrRepo.create({
        elementClassId: dto.elementClassId,
        name: dto.name,
        description: dto.description,
        kind: dto.kind,
        order: dto.order ?? 0,
        required: dto.required ?? false,
        simpleType: dto.simpleType ?? null,
        validationRegex: dto.validationRegex ?? null,
        maxLength: dto.maxLength ?? null,
        defaultValue: dto.defaultValue ?? null,
        enumOptions: dto.enumOptions ?? null,
        targetClassIds: [],
        targetClassId: null,
      }),
    );
  }

  // ─── MISE À JOUR ──────────────────────────────────────────────────────────

  async update(
    id: string,
    dto: UpdateAttributeDefinitionDto,
  ): Promise<AttributeDefinition> {
    const existing = await this.findOne(id);

    if (dto.kind && dto.kind !== existing.kind) {
      throw new BadRequestException(
        'Impossible de changer le kind d\'un attribut existant',
      );
    }

    if (dto.name && dto.name !== existing.name) {
      await this.assertUniqueName(existing.elementClassId, dto.name, id);
    }

    if (existing.kind !== AttributeKind.COMPLEX) {
      Object.assign(existing, dto);
      return this.attrRepo.save(existing);
    }

    // Pour COMPLEX : synchronisation complète des inverses
    return this.dataSource.transaction(async (em) => {
      // Récupère tous les IDs d'inverses connus (compat ancien champ mono)
      const allInverseIds: string[] =
        existing.inverseAttributeDefinitionIds.length > 0
          ? [...existing.inverseAttributeDefinitionIds]
          : existing.inverseAttributeDefinitionId
            ? [existing.inverseAttributeDefinitionId]
            : [];

      // --- Synchronise les changements de nom sur tous les inverses ---
      const inverseUpdates: Partial<AttributeDefinition> = {};

      if (dto.name && dto.name !== existing.name) {
        inverseUpdates.inverseAttributeName = dto.name;
      }

      if (
        dto.inverseAttributeName !== undefined &&
        dto.inverseAttributeName !== existing.inverseAttributeName &&
        dto.inverseAttributeName
      ) {
        // Valide l'unicité sur chaque classe portant un inverse
        for (const inverseId of allInverseIds) {
          const inv = await em.findOne(AttributeDefinition, { where: { id: inverseId } });
          if (inv) {
            await this.assertUniqueName(inv.elementClassId, dto.inverseAttributeName, inverseId);
          }
        }
        inverseUpdates.name = dto.inverseAttributeName;
      }

      for (const inverseId of allInverseIds) {
        if (Object.keys(inverseUpdates).length > 0) {
          await em.update(AttributeDefinition, inverseId, inverseUpdates);
        }
      }

      // --- Gère l'ajout / la suppression de classes cibles ---
      if (dto.targetClassIds !== undefined) {
        const oldTargetIds = existing.targetClassIds;
        const newTargetIds = dto.targetClassIds;
        const added   = newTargetIds.filter(tid => !oldTargetIds.includes(tid));
        const removed = oldTargetIds.filter(tid => !newTargetIds.includes(tid));

        // Supprime les inverses des classes cibles retirées
        for (const removedId of removed) {
          if (allInverseIds.length === 0) continue;
          const inv = await em.findOne(AttributeDefinition, {
            where: { id: In(allInverseIds), elementClassId: removedId },
          });
          if (inv) {
            const idx = allInverseIds.indexOf(inv.id);
            if (idx !== -1) allInverseIds.splice(idx, 1);
            await em.delete(Relation, { attributeDefinitionId: inv.id });
            await em.delete(AttributeDefinition, { id: inv.id });
          }
        }

        // Crée les inverses pour les nouvelles classes cibles
        const inverseName =
          (dto.inverseAttributeName ?? existing.inverseAttributeName) || null;
        const sourceName = dto.name ?? existing.name;

        for (const addedId of added) {
          await this.assertClassExists(addedId);
          if (!inverseName) continue;

          // Si le nom existe déjà sur cette classe, on passe (pas d'erreur)
          const conflict = await em.findOne(AttributeDefinition, {
            where: { elementClassId: addedId, name: inverseName },
          });
          if (conflict) continue;

          const inv = em.create(AttributeDefinition, {
            elementClassId: addedId,
            name: inverseName,
            description: `Inverse de "${sourceName}"`,
            kind: AttributeKind.COMPLEX,
            order: 99,
            required: false,
            targetClassIds: [existing.elementClassId],
            targetClassId: null,
            relationType: this.invertRelationType(existing.relationType!),
            inverseAttributeName: sourceName,
            inverseAttributeDefinitionId: id,
            inverseAttributeDefinitionIds: [id],
            minRelations: 0,
            maxRelations: null,
          });
          const savedInv = await em.save(AttributeDefinition, inv);
          allInverseIds.push(savedInv.id);
        }
      }

      // Sauvegarde la source avec les IDs d'inverses à jour
      Object.assign(existing, dto);
      existing.inverseAttributeDefinitionIds = allInverseIds;
      existing.inverseAttributeDefinitionId = allInverseIds[0] ?? null;
      return em.save(AttributeDefinition, existing);
    });
  }

  // ─── SUPPRESSION ──────────────────────────────────────────────────────────

  /**
   * Supprime l'attribut et TOUS ses inverses si COMPLEX.
   */
  async remove(id: string): Promise<void> {
    const attr = await this.findOne(id);
    await this.dataSource.transaction(async (em) => {
      if (attr.kind === AttributeKind.COMPLEX) {
        const allInverseIds =
          attr.inverseAttributeDefinitionIds.length > 0
            ? attr.inverseAttributeDefinitionIds
            : attr.inverseAttributeDefinitionId
              ? [attr.inverseAttributeDefinitionId]
              : [];

        for (const inverseId of allInverseIds) {
          await em.delete(Relation, { attributeDefinitionId: inverseId });
          await em.delete(AttributeDefinition, { id: inverseId });
        }
      }
      await em.delete(AttributeValue, { attributeDefinitionId: id });
      await em.delete(Relation, { attributeDefinitionId: id });
      await em.delete(AttributeDefinition, { id });
    });
  }

  // ─── PRIVÉ ────────────────────────────────────────────────────────────────

  private async createComplexBidirectional(
    dto: CreateAttributeDefinitionDto,
  ): Promise<AttributeDefinition> {
    if (!dto.relationType) {
      throw new BadRequestException(
        'relationType est requis pour un attribut COMPLEX',
      );
    }

    const targetIds = dto.targetClassIds ?? [];

    // Valide toutes les classes cibles et l'unicité du nom inverse avant la transaction
    for (const targetId of targetIds) {
      await this.assertClassExists(targetId);
      if (dto.inverseAttributeName) {
        await this.assertUniqueName(targetId, dto.inverseAttributeName);
      }
    }

    return this.dataSource.transaction(async (em) => {
      // 1) Attribut source
      const source = em.create(AttributeDefinition, {
        elementClassId: dto.elementClassId,
        name: dto.name,
        description: dto.description,
        kind: AttributeKind.COMPLEX,
        order: dto.order ?? 0,
        required: dto.required ?? false,
        targetClassIds: targetIds,
        targetClassId: null,
        relationType: dto.relationType,
        inverseAttributeName: dto.inverseAttributeName ?? null,
        minRelations: dto.minRelations ?? 0,
        maxRelations: dto.maxRelations ?? null,
      });
      const savedSource = await em.save(AttributeDefinition, source);

      if (!targetIds.length || !dto.inverseAttributeName) {
        return savedSource;
      }

      // 2) Un attribut inverse par classe cible
      const inverseIds: string[] = [];
      for (const targetId of targetIds) {
        const inverse = em.create(AttributeDefinition, {
          elementClassId: targetId,
          name: dto.inverseAttributeName,
          description: `Inverse de "${dto.name}"`,
          kind: AttributeKind.COMPLEX,
          order: 99,
          required: false,
          targetClassIds: [dto.elementClassId],
          targetClassId: null,
          relationType: this.invertRelationType(dto.relationType!),
          inverseAttributeName: dto.name,
          inverseAttributeDefinitionId: savedSource.id,
          inverseAttributeDefinitionIds: [savedSource.id],
          minRelations: 0,
          maxRelations: null,
        });
        const savedInverse = await em.save(AttributeDefinition, inverse);
        inverseIds.push(savedInverse.id);
      }

      // 3) Croise les IDs sur la source
      await em.update(AttributeDefinition, savedSource.id, {
        inverseAttributeDefinitionId: inverseIds[0],
        inverseAttributeDefinitionIds: inverseIds,
      });

      return em.findOne(AttributeDefinition, {
        where: { id: savedSource.id },
        relations: [],
      }) as Promise<AttributeDefinition>;
    });
  }

  private invertRelationType(rel: RelationType): RelationType {
    return rel;
  }

  private async getClassChain(classId: string): Promise<string[]> {
    const chain: string[] = [classId];
    let current = await this.classRepo.findOne({ where: { id: classId } });
    while (current?.parentClassId) {
      chain.push(current.parentClassId);
      current = await this.classRepo.findOne({
        where: { id: current.parentClassId },
      });
    }
    return chain;
  }

  private async assertClassExists(classId: string): Promise<void> {
    const exists = await this.classRepo.existsBy({ id: classId });
    if (!exists) throw new NotFoundException(`ElementClass ${classId} introuvable`);
  }

  private async assertUniqueName(
    classId: string,
    name: string,
    excludeId?: string,
  ): Promise<void> {
    const qb = this.attrRepo
      .createQueryBuilder('a')
      .where('a.elementClassId = :classId AND a.name = :name', {
        classId,
        name,
      });
    if (excludeId) qb.andWhere('a.id != :excludeId', { excludeId });
    const exists = await qb.getExists();
    if (exists) {
      throw new ConflictException(
        `Un attribut "${name}" existe déjà sur cette classe`,
      );
    }
  }
}
