// src/view/view.service.ts
import {
  Injectable, NotFoundException, BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, In } from 'typeorm';
import { Element } from '../entities/element.entity';
import { ElementClass } from '../entities/element-class.entity';
import { Relation } from '../entities/relation.entity';
import { AttributeValue } from '../entities/attribute-value.entity';
import { AttributeDefinition } from '../entities/attribute-definition.entity';
import { DocumentRevision } from '../entities/document-revision.entity';
import { ViewElementPosition } from '../entities/view-element-position.entity';
import { RelationType } from '../entities/attribute-definition.entity';
import { CreateViewDto, UpdateViewDto, ViewMembersResponseDto } from './dto/view.dto';
import { StructureService } from './structure.service';

@Injectable()
export class ViewService {
  constructor(
    @InjectRepository(Element)
    private readonly elementRepo: Repository<Element>,

    @InjectRepository(ElementClass)
    private readonly classRepo: Repository<ElementClass>,

    @InjectRepository(Relation)
    private readonly relationRepo: Repository<Relation>,

    @InjectRepository(AttributeValue)
    private readonly attrValueRepo: Repository<AttributeValue>,

    @InjectRepository(AttributeDefinition)
    private readonly attrDefRepo: Repository<AttributeDefinition>,

    @InjectRepository(DocumentRevision)
    private readonly revisionRepo: Repository<DocumentRevision>,

    @InjectRepository(ViewElementPosition)
    private readonly positionRepo: Repository<ViewElementPosition>,

    private readonly structureService: StructureService,

    private readonly dataSource: DataSource,
  ) {}

  // ─── Classe utilitaire ────────────────────────────────────────────────────────

  private async getViewClass(): Promise<ElementClass> {
    const cls = await this.classRepo.findOne({ where: { name: 'Vue' } });
    if (!cls) throw new NotFoundException('ElementClass "Vue" introuvable — lancez le seed');
    return cls;
  }

  private async getAttrDefs(classId: string) {
    const defs = await this.attrDefRepo.find({ where: { elementClassId: classId } });
    return new Map(defs.map(d => [d.name, d]));
  }

  // ─── LECTURE ─────────────────────────────────────────────────────────────────

  async findAll(organisationId: string): Promise<any[]> {
    const cls = await this.getViewClass();
    const all = await this.elementRepo.find({
      where: { elementClassId: cls.id },
      relations: ['attributeValues', 'attributeValues.attributeDefinition'],
    });
    return all
      .filter(d => d.attributeValues?.find(v =>
        v.attributeDefinition?.name === 'organisationId' && v.value === organisationId,
      ))
      .map(d => this.deserializeView(d));
  }

  async findOne(id: string): Promise<any> {
    const el = await this.elementRepo.findOne({
      where: { id },
      relations: ['attributeValues', 'attributeValues.attributeDefinition', 'elementClass'],
    });
    if (!el) throw new NotFoundException(`Vue ${id} introuvable`);
    return this.deserializeView(el);
  }

  // ─── Membres (nodes + edges) ─────────────────────────────────────────────────

  async getMembers(viewId: string): Promise<ViewMembersResponseDto> {
    const view = await this.findOne(viewId);

    let allowedClassIds: string[] = [];
    if (view.structureId) {
      const structure = await this.structureService.findOne(view.structureId);
      allowedClassIds = structure.allowedClassIds;
    }

    const memberRelations = await this.relationRepo.find({
      where: { sourceId: viewId, relationType: RelationType.APPARTENANCE },
      relations: [
        'target', 'target.elementClass', 'target.elementClass.type',
        'target.elementClass.parentClass', 'target.elementClass.parentClass.parentClass',
        'target.attributeValues', 'target.attributeValues.attributeDefinition',
      ],
    });

    const rawNodes = memberRelations.map(r => r.target);

    // Overlay per-view positions over global canvasX/canvasY
    const viewPositions = await this.positionRepo.find({ where: { viewId } });
    const posMap = new Map(viewPositions.map(p => [p.elementId, p]));
    const nodes = rawNodes.map(el => {
      const pos = posMap.get(el.id);
      if (pos) { el.canvasX = pos.canvasX; el.canvasY = pos.canvasY; }
      return el;
    });

    const nodeIds = nodes.map(n => n.id);

    let edges: Relation[] = [];
    if (nodeIds.length > 0) {
      edges = await this.relationRepo
        .createQueryBuilder('r')
        .where('r.sourceId IN (:...ids) AND r.targetId IN (:...ids)', { ids: nodeIds })
        .leftJoinAndSelect('r.attributeDefinition', 'ad')
        .getMany();
    }

    return { viewId, viewName: view.name, structureId: view.structureId, allowedClassIds, nodes, edges, hasPerViewPositions: viewPositions.length > 0 };
  }

  // ─── CRÉATION ────────────────────────────────────────────────────────────────

  async create(dto: CreateViewDto, userId: string): Promise<any> {
    const cls     = await this.getViewClass();
    const attrMap = await this.getAttrDefs(cls.id);

    let allowedClassIds: string[] = [];
    let structureMaxInstances: number | null = null;
    if (dto.structureId) {
      const structure = await this.structureService.findOne(dto.structureId);
      allowedClassIds = structure.allowedClassIds;
      structureMaxInstances = structure.maxInstances;
      if (structure.maxInstances != null) {
        const count = await this.structureService.countViewsOfStructure(dto.structureId, dto.organisationId);
        if (count >= structure.maxInstances) {
          throw new BadRequestException(
            `Cette structure est limitée à ${structure.maxInstances} vue(s) par organisation`,
          );
        }
      }
    }

    const view = await this.dataSource.transaction(async em => {
      const el = em.create(Element, { label: dto.name, elementClassId: cls.id });
      const saved = await em.save(Element, el);

      const pairs: [string, string | null][] = [
        ['organisationId', dto.organisationId],
        ['structureId',    dto.structureId ?? null],
        ['folderId',       dto.folderId ?? null],
        ['authorId',       userId],
        ['parentElementId', dto.parentElementId ?? null],
      ];

      for (const [name, value] of pairs) {
        const def = attrMap.get(name);
        if (def && value) {
          await em.save(AttributeValue, em.create(AttributeValue, {
            elementId: saved.id,
            attributeDefinitionId: def.id,
            value,
          }));
        }
      }

      await this.saveRevision(em, saved.id, userId, [], [], 'Création de la vue');
      return this.findOne(saved.id);
    });

    if (allowedClassIds.length > 0) {
      const isMultiInstance = structureMaxInstances === null || structureMaxInstances > 1;
      if (dto.parentElementId && isMultiInstance) {
        const elementIds = await this.collectLinkedElements(dto.parentElementId, allowedClassIds);
        if (elementIds.length > 0) {
          await this.relationRepo.save(
            elementIds.map(id => this.relationRepo.create({
              sourceId: view.id,
              targetId: id,
              relationType: RelationType.APPARTENANCE,
              label: 'membre',
            })),
          );
        }
      } else {
        await this.autoPopulateView(view.id, allowedClassIds, userId);
      }
    }

    return view;
  }

  // ─── MISE À JOUR ─────────────────────────────────────────────────────────────

  async update(id: string, dto: UpdateViewDto, userId: string): Promise<any> {
    const el = await this.elementRepo.findOneBy({ id });
    if (!el) throw new NotFoundException(`Vue ${id} introuvable`);
    if (dto.name) el.label = dto.name;
    await this.elementRepo.save(el);

    if (dto.folderId !== undefined) {
      const cls     = await this.getViewClass();
      const attrMap = await this.getAttrDefs(cls.id);
      const def     = attrMap.get('folderId');
      if (def) {
        await this.attrValueRepo.delete({ elementId: id, attributeDefinitionId: def.id });
        if (dto.folderId) {
          await this.attrValueRepo.save(this.attrValueRepo.create({
            elementId: id, attributeDefinitionId: def.id, value: dto.folderId,
          }));
        }
      }
    }

    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    await this.positionRepo.delete({ viewId: id });
    await this.revisionRepo.delete({ documentId: id });
    await this.relationRepo.delete({ sourceId: id });
    await this.elementRepo.delete(id);
  }

  // ─── POSITION PAR VUE ─────────────────────────────────────────────────────────

  async moveInView(viewId: string, elementId: string, canvasX: number, canvasY: number): Promise<void> {
    await this.positionRepo.save(
      this.positionRepo.create({ viewId, elementId, canvasX, canvasY }),
    );
  }

  // ─── AJOUT / RETRAIT DE MEMBRES ───────────────────────────────────────────────

  async addMember(viewId: string, elementId: string, userId: string): Promise<void> {
    const view = await this.findOne(viewId);

    const el = await this.elementRepo.findOneBy({ id: elementId });
    if (!el) throw new NotFoundException(`Element ${elementId} introuvable`);

    if (view.structureId) {
      await this.structureService.validate(view.structureId, el.elementClassId);
    }

    const existing = await this.relationRepo.findOne({
      where: { sourceId: viewId, targetId: elementId, relationType: RelationType.APPARTENANCE },
    });
    if (existing) return;

    await this.relationRepo.save(this.relationRepo.create({
      sourceId: viewId,
      targetId: elementId,
      relationType: RelationType.APPARTENANCE,
      label: 'membre',
    }));

    await this.snapshotView(viewId, userId, `Ajout de "${el.label}"`);
  }

  async removeMember(viewId: string, elementId: string, userId: string): Promise<void> {
    await this.relationRepo.delete({
      sourceId: viewId,
      targetId: elementId,
      relationType: RelationType.APPARTENANCE,
    });
    const el = await this.elementRepo.findOneBy({ id: elementId });
    await this.snapshotView(viewId, userId, `Retrait de "${el?.label ?? elementId}"`);
  }

  // ─── RECHERCHE d'éléments compatibles ────────────────────────────────────────

  async searchCompatibleElements(viewId: string, query: string): Promise<Element[]> {
    const view = await this.findOne(viewId);
    let allowedClassIds: string[] = [];

    if (view.structureId) {
      const structure = await this.structureService.findOne(view.structureId);
      allowedClassIds = structure.allowedClassIds;
    }

    const qb = this.elementRepo
      .createQueryBuilder('el')
      .leftJoinAndSelect('el.elementClass', 'cls')
      .where('LOWER(el.label) LIKE LOWER(:q)', { q: `%${query}%` });

    if (allowedClassIds.length > 0) {
      qb.andWhere('el.elementClassId IN (:...classIds)', { classIds: allowedClassIds });
    }

    return qb.limit(20).getMany();
  }

  // ─── ARBORESCENCE PILOTÉE PAR LES STRUCTURES ────────────────────────────────

  async getStructureTree(organisationId: string, userId: string): Promise<any[]> {
    const structures = await this.structureService.findAll();
    const views      = await this.findAll(organisationId);

    const types = ['Organisationnelle', 'Technique', 'Physique'] as const;
    const result: any[] = [];

    for (const type of types) {
      const typeStructures = structures.filter((s: any) => s.structureType === type);
      if (typeStructures.length === 0) continue;

      const nodes: any[] = [];
      for (const structure of typeStructures) {
        const structureViews = views.filter((v: any) => v.structureId === structure.id);

        if (structure.maxInstances === 1) {
          const view = structureViews[0] ?? null;
          nodes.push({
            structureId:   structure.id,
            structureName: structure.name,
            maxInstances:  1,
            view: view ? { id: view.id, name: view.name } : null,
          });
        } else {
          nodes.push({
            structureId:   structure.id,
            structureName: structure.name,
            maxInstances:  structure.maxInstances,
            views: structureViews.map((v: any) => ({ id: v.id, name: v.name })),
          });
        }
      }

      result.push({ type, structures: nodes });
    }

    return result;
  }

  // ─── HISTORIQUE ──────────────────────────────────────────────────────────────

  async getRevisions(viewId: string): Promise<DocumentRevision[]> {
    return this.revisionRepo.find({
      where: { documentId: viewId },
      relations: ['user'],
      order: { changedAt: 'DESC' },
      take: 50,
    });
  }

  // ─── PRIVÉ ───────────────────────────────────────────────────────────────────

  private async collectLinkedElements(startId: string, allowedClassIds: string[]): Promise<string[]> {
    const allowed = new Set(allowedClassIds);
    const result  = new Set<string>();

    const startEl = await this.elementRepo.findOne({
      where: { id: startId }, select: ['id', 'elementClassId'],
    });
    if (startEl && allowed.has(startEl.elementClassId)) result.add(startId);

    const [relFrom, relTo] = await Promise.all([
      this.relationRepo.find({ where: { sourceId: startId }, select: ['targetId', 'relationType'] }),
      this.relationRepo.find({ where: { targetId: startId }, select: ['sourceId', 'relationType'] }),
    ]);

    const neighborIds = new Set<string>();
    for (const r of relFrom) {
      if (r.relationType !== RelationType.APPARTENANCE) neighborIds.add(r.targetId);
    }
    for (const r of relTo) {
      if (r.relationType !== RelationType.APPARTENANCE) neighborIds.add(r.sourceId);
    }

    if (neighborIds.size > 0) {
      const elements = await this.elementRepo.find({
        where: { id: In([...neighborIds]) }, select: ['id', 'elementClassId'],
      });
      for (const el of elements) {
        if (allowed.has(el.elementClassId)) result.add(el.id);
      }
    }

    return [...result];
  }

  private async syncSingletonMembers(viewId: string, allowedClassIds: string[]): Promise<void> {
    const existing = await this.relationRepo.find({
      where: { sourceId: viewId, relationType: RelationType.APPARTENANCE },
      select: ['targetId'],
    });
    const existingIds = new Set(existing.map(r => r.targetId));

    const compatible = await this.elementRepo.find({
      where: { elementClassId: In(allowedClassIds) },
    });
    const missing = compatible.filter(el => !existingIds.has(el.id));
    if (missing.length === 0) return;

    await this.relationRepo.save(
      missing.map(el => this.relationRepo.create({
        sourceId: viewId,
        targetId: el.id,
        relationType: RelationType.APPARTENANCE,
        label: 'membre',
      })),
    );
  }

  private async autoPopulateView(viewId: string, allowedClassIds: string[], userId: string): Promise<void> {
    if (allowedClassIds.length === 0) return;
    const elements = await this.elementRepo.find({
      where: { elementClassId: In(allowedClassIds) },
    });
    if (elements.length === 0) return;
    const relations = elements.map(el =>
      this.relationRepo.create({
        sourceId: viewId,
        targetId: el.id,
        relationType: RelationType.APPARTENANCE,
        label: 'membre',
      }),
    );
    await this.relationRepo.save(relations);
    await this.snapshotView(viewId, userId, `Initialisation automatique (${elements.length} élément(s))`);
  }

  private async snapshotView(viewId: string, userId: string, message: string) {
    const members = await this.getMembers(viewId);
    await this.saveRevision(null, viewId, userId, members.nodes, members.edges, message);
  }

  private async saveRevision(em: any, viewId: string, userId: string, nodes: any[], edges: any[], message: string) {
    const repo = em ? em.getRepository(DocumentRevision) : this.revisionRepo;
    const snapshot = JSON.stringify({ nodes, edges });
    await (em
      ? em.save(DocumentRevision, em.create(DocumentRevision, { documentId: viewId, userId, snapshot, message }))
      : repo.save(repo.create({ documentId: viewId, userId, snapshot, message })));
  }

  async findForElement(elementId: string): Promise<any[]> {
    const cls = await this.getViewClass();
    const all = await this.elementRepo.find({
      where: { elementClassId: cls.id },
      relations: ['attributeValues', 'attributeValues.attributeDefinition'],
    });
    return all
      .filter(d => d.attributeValues?.find(v =>
        v.attributeDefinition?.name === 'parentElementId' && v.value === elementId,
      ))
      .map(d => this.deserializeView(d));
  }

  private deserializeView(el: Element): any {
    const get = (name: string) =>
      el.attributeValues?.find(v => v.attributeDefinition?.name === name)?.value ?? null;
    return {
      id:              el.id,
      name:            el.label,
      organisationId:  get('organisationId'),
      structureId:     get('structureId'),
      folderId:        get('folderId'),
      authorId:        get('authorId'),
      parentElementId: get('parentElementId'),
      createdAt:       el.createdAt,
      updatedAt:       el.updatedAt,
    };
  }
}
