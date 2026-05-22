/**
 * src/database/seed/seed-metamodel.seed.ts
 *
 * Seede les types, classes et attributs depuis fixtures/classes.json.
 * Idempotent : vérifie l'existence avant toute création.
 * Remplace initial-metamodel.seed.ts (classes hardcodées).
 *
 * Usage : node dist/database/seed/seed-metamodel.seed.js
 */

import 'reflect-metadata';
import * as path from 'path';
import * as fs from 'fs';

const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
    const [k, ...rest] = line.split('=');
    if (k && rest.length) process.env[k.trim()] = rest.join('=').trim();
  }
}

import { AppDataSource } from '../data-source';
import { ElementType } from '../../entities/element-type.entity';
import { ElementClass } from '../../entities/element-class.entity';
import { AttributeDefinition, AttributeKind } from '../../entities/attribute-definition.entity';
import { Element } from '../../entities/element.entity';
import { AttributeValue } from '../../entities/attribute-value.entity';

interface FixtureType  { name: string; color?: string | null; icon?: string | null; }
interface FixtureClass {
  name: string; typeName: string; parentClassName?: string | null;
  icon?: string | null; color?: string | null; description?: string | null;
}
interface FixtureAttr {
  className: string; name: string; kind: string; order: number; required: boolean;
  description?: string | null;
  simpleType?: string | null; validationRegex?: string | null; maxLength?: number | null;
  defaultValue?: string | null; enumOptions?: string | null;
  relationType?: string | null; inverseAttributeName?: string | null;
  targetClassNames?: string[]; minRelations?: number; maxRelations?: number | null;
}
interface FixtureStructure {
  label: string;
  structureType?: string | null;
  description?: string | null;
  allowedClassNames?: string[];
  allowedRelTypes?: string[];
  maxInstances?: number | null;
  parentElementClassName?: string | null;
}
interface Fixture {
  version: string;
  elementTypes: FixtureType[];
  elementClasses: FixtureClass[];
  attributeDefinitions: FixtureAttr[];
  structures?: FixtureStructure[];
}

async function seed() {
  const fixturePath = path.join(__dirname, 'fixtures', 'classes.json');
  if (!fs.existsSync(fixturePath)) {
    console.log('⚠️  fixtures/classes.json absent — seed ignoré.');
    return;
  }

  let fixture: Fixture;
  try {
    fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf-8'));
  } catch (e) {
    console.error('❌ Lecture fixtures/classes.json impossible :', (e as Error).message);
    return;
  }

  if (!fixture.elementClasses?.length) {
    console.log('⚠️  Fixture vide — seed ignoré.');
    return;
  }

  await AppDataSource.initialize();

  const typeRepo  = AppDataSource.getRepository(ElementType);
  const classRepo = AppDataSource.getRepository(ElementClass);
  const attrRepo  = AppDataSource.getRepository(AttributeDefinition);

  // ── ElementTypes ────────────────────────────────────────────────────────────
  const typeMap = new Map<string, string>();
  for (const existing of await typeRepo.find()) typeMap.set(existing.name, existing.id);

  for (const ft of fixture.elementTypes ?? []) {
    if (!typeMap.has(ft.name)) {
      const entity = typeRepo.create();
      entity.name  = ft.name;
      if (ft.color) entity.color = ft.color;
      if (ft.icon)  entity.icon  = ft.icon;
      const t = await typeRepo.save(entity);
      typeMap.set(ft.name, t.id);
      console.log(`  → Type "${ft.name}" créé`);
    }
  }

  // ── ElementClasses (tri topologique : parents avant enfants) ────────────────
  const classMap = new Map<string, string>();
  for (const existing of await classRepo.find()) classMap.set(existing.name, existing.id);

  const remaining = [...(fixture.elementClasses ?? [])];
  let pass = 0;
  while (remaining.length > 0 && pass++ < 50) {
    const before = remaining.length;
    for (let i = remaining.length - 1; i >= 0; i--) {
      const fc = remaining[i];
      if (fc.parentClassName && !classMap.has(fc.parentClassName)) continue;

      const typeId = typeMap.get(fc.typeName);
      if (!typeId) {
        console.warn(`⚠️  Type "${fc.typeName}" inconnu — classe "${fc.name}" ignorée`);
        remaining.splice(i, 1);
        continue;
      }

      if (!classMap.has(fc.name)) {
        const entity = classRepo.create();
        entity.name   = fc.name;
        entity.typeId = typeId;
        entity.parentClassId = fc.parentClassName ? (classMap.get(fc.parentClassName) ?? null) : null;
        if (fc.icon)        entity.icon        = fc.icon;
        if (fc.color)       entity.color       = fc.color;
        if (fc.description) entity.description = fc.description;
        const c = await classRepo.save(entity);
        classMap.set(fc.name, c.id);
        console.log(`  → Classe "${fc.name}" créée`);
      }
      remaining.splice(i, 1);
    }
    if (remaining.length === before) {
      console.warn('⚠️  Parent introuvable pour :', remaining.map(c => c.name).join(', '));
      break;
    }
  }

  // ── AttributeDefinitions ────────────────────────────────────────────────────
  for (const fa of fixture.attributeDefinitions ?? []) {
    const classId = classMap.get(fa.className);
    if (!classId) {
      console.warn(`⚠️  Classe "${fa.className}" introuvable — attribut "${fa.name}" ignoré`);
      continue;
    }
    const exists = await attrRepo.findOne({ where: { elementClassId: classId, name: fa.name } });
    if (exists) continue;

    const base: Partial<AttributeDefinition> = {
      elementClassId: classId,
      name: fa.name,
      kind: fa.kind as AttributeKind,
      order: fa.order ?? 0,
      required: fa.required ?? false,
      ...(fa.description ? { description: fa.description } : {}),
    };

    if (fa.kind === AttributeKind.SIMPLE) {
      await attrRepo.save(attrRepo.create({
        ...base,
        simpleType: fa.simpleType as any,
        validationRegex: fa.validationRegex ?? null,
        maxLength: fa.maxLength ?? null,
        defaultValue: fa.defaultValue ?? null,
        enumOptions: fa.enumOptions ?? null,
      }));
    } else {
      await attrRepo.save(attrRepo.create({
        ...base,
        relationType: fa.relationType as any,
        inverseAttributeName: fa.inverseAttributeName ?? null,
        targetClassIds: (fa.targetClassNames ?? []).map(n => classMap.get(n)).filter((id): id is string => !!id),
        minRelations: fa.minRelations ?? 0,
        maxRelations: fa.maxRelations ?? null,
      }));
    }
    console.log(`  → Attribut "${fa.className}.${fa.name}" créé`);
  }

  // ── Résolution des inverseAttributeDefinitionId ────────────────────────────
  // Le seed crée les attrs directement via le repo (sans passer par le service),
  // donc inverseAttributeDefinitionId reste null. On le résout ici par nom dans
  // les classes cibles. La passe est idempotente (skip si déjà résolu).
  {
    const complexAttrs = await attrRepo.find({ where: { kind: AttributeKind.COMPLEX } });
    const attrByClassAndName = new Map<string, AttributeDefinition>();
    for (const a of complexAttrs) {
      attrByClassAndName.set(`${a.elementClassId}::${a.name}`, a);
    }

    let nLinked = 0;
    for (const attr of complexAttrs) {
      if (!attr.inverseAttributeName || attr.inverseAttributeDefinitionId) continue;

      const inverseIds: string[] = [];
      for (const targetClassId of attr.targetClassIds ?? []) {
        const inv = attrByClassAndName.get(`${targetClassId}::${attr.inverseAttributeName}`);
        if (!inv) continue;
        inverseIds.push(inv.id);
        if (!inv.inverseAttributeDefinitionId) {
          inv.inverseAttributeDefinitionId = attr.id;
          inv.inverseAttributeDefinitionIds = [attr.id];
          await attrRepo.save(inv);
        }
      }
      if (inverseIds.length > 0) {
        attr.inverseAttributeDefinitionId = inverseIds[0];
        attr.inverseAttributeDefinitionIds = inverseIds;
        await attrRepo.save(attr);
        nLinked++;
      }
    }
    if (nLinked > 0) console.log(`  → ${nLinked} paire(s) d'attributs inverses liées`);
  }

  // ── Structures (Element + AttributeValue) ──────────────────────────────────
  const elementRepo = AppDataSource.getRepository(Element);
  const avRepo      = AppDataSource.getRepository(AttributeValue);

  const structureClassId = classMap.get('Structure');
  let ns = 0;
  if (structureClassId && fixture.structures?.length) {
    const structureAttrs = await attrRepo.find({ where: { elementClassId: structureClassId } });
    const attrIdByName = new Map(structureAttrs.map(a => [a.name, a.id]));

    for (const fs of fixture.structures) {
      const exists = await elementRepo.findOne({ where: { elementClassId: structureClassId, label: fs.label } });
      if (exists) continue;

      const el = elementRepo.create();
      el.elementClassId = structureClassId;
      el.label = fs.label;
      const saved = await elementRepo.save(el);

      const avData: Array<{ elementId: string; attributeDefinitionId: string; value: string }> = [];

      const addAv = (name: string, value: string | null) => {
        const defId = attrIdByName.get(name);
        if (defId && value != null) avData.push({ elementId: saved.id, attributeDefinitionId: defId, value });
      };

      addAv('structureType', fs.structureType ?? null);
      addAv('description', fs.description ?? null);
      addAv('allowedRelTypes', JSON.stringify(fs.allowedRelTypes ?? []));
      addAv('maxInstances', fs.maxInstances != null ? String(fs.maxInstances) : null);

      const allowedClassIds = (fs.allowedClassNames ?? []).map(n => classMap.get(n)).filter((id): id is string => !!id);
      addAv('allowedClassIds', JSON.stringify(allowedClassIds));

      const parentClassId = fs.parentElementClassName ? (classMap.get(fs.parentElementClassName) ?? null) : null;
      addAv('parentElementClassId', parentClassId);

      if (avData.length) await avRepo.insert(avData);
      console.log(`  → Structure "${fs.label}" créée`);
      ns++;
    }
  }

  const [nt, nc, na] = await Promise.all([typeRepo.count(), classRepo.count(), attrRepo.count()]);
  console.log(`✅ Seed terminé : ${nt} types, ${nc} classes, ${na} attributs, ${ns} structures créées`);
  await AppDataSource.destroy();
}

seed().catch(err => { console.error('❌', err.message); process.exit(1); });
