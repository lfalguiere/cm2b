/**
 * src/database/seed/seed-structures.seed.ts
 *
 * Ajoute les classes Structure / Vue et les structures prédéfinies au méta-modèle.
 *
 * À lancer APRÈS initial-metamodel.seed.ts :
 *   npm run seed:structures
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
import { AttributeDefinition, AttributeKind, SimpleAttributeType, RelationType } from '../../entities/attribute-definition.entity';
import { Element } from '../../entities/element.entity';
import { AttributeValue } from '../../entities/attribute-value.entity';

async function seed() {
  await AppDataSource.initialize();
  console.log('✅ Connexion OK');

  const typeRepo  = AppDataSource.getRepository(ElementType);
  const classRepo = AppDataSource.getRepository(ElementClass);
  const attrRepo  = AppDataSource.getRepository(AttributeDefinition);
  const elemRepo  = AppDataSource.getRepository(Element);
  const avRepo    = AppDataSource.getRepository(AttributeValue);

  // ── Type organisationnel (déjà créé) ──────────────────────────────────────
  const tOrg  = await typeRepo.findOneByOrFail({ name: 'Organisationnel' })
    .catch(() => typeRepo.findOneByOrFail({ name: 'Organisationnel' }))
    .catch(async () => {
      // Cherche avec accent ou sans
      const all = await typeRepo.find();
      return all.find(t => t.name.toLowerCase().includes('organ'))!;
    });

  const tTech = await typeRepo.find().then(ts => ts.find(t => t.name.toLowerCase().includes('tech'))!);

  // ── ElementClass : Structure ──────────────────────────────────────────────
  let cStructure = await classRepo.findOne({ where: { name: 'Structure' } });
  if (!cStructure) {
    cStructure = await classRepo.save({ name: 'Structure', typeId: tOrg.id, icon: 'layout', color: '#8b5cf6' });
    console.log('  → Classe "Structure" créée');
  }

  // Attributs de Structure
  const structureAttrs = [
    { name: 'nom',                  kind: AttributeKind.SIMPLE, simpleType: SimpleAttributeType.STRING,  required: true,  order: 0 },
    { name: 'structureType',        kind: AttributeKind.SIMPLE, simpleType: SimpleAttributeType.STRING,  required: true,  order: 1 },
    { name: 'description',          kind: AttributeKind.SIMPLE, simpleType: SimpleAttributeType.TEXT,    required: false, order: 2 },
    { name: 'allowedClassIds',      kind: AttributeKind.SIMPLE, simpleType: SimpleAttributeType.TEXT,    required: true,  order: 3 }, // JSON[]
    { name: 'allowedRelTypes',      kind: AttributeKind.SIMPLE, simpleType: SimpleAttributeType.TEXT,    required: false, order: 4 }, // JSON[]
    { name: 'maxInstances',         kind: AttributeKind.SIMPLE, simpleType: SimpleAttributeType.INTEGER, required: false, order: 5 },
    { name: 'sortOrder',            kind: AttributeKind.SIMPLE, simpleType: SimpleAttributeType.INTEGER, required: false, order: 6 },
    { name: 'parentElementClassId', kind: AttributeKind.SIMPLE, simpleType: SimpleAttributeType.STRING,  required: false, order: 7 },
  ];
  for (const a of structureAttrs) {
    const exists = await attrRepo.findOne({ where: { elementClassId: cStructure.id, name: a.name } });
    if (!exists) await attrRepo.save({ ...a, elementClassId: cStructure.id });
  }

  // ── ElementClass : Vue ────────────────────────────────────────────────────
  let cView = await classRepo.findOne({ where: { name: 'Vue' } });
  if (!cView) {
    cView = await classRepo.save({ name: 'Vue', typeId: tOrg.id, icon: 'file-text', color: '#06b6d4' });
    console.log('  → Classe "Vue" créée');
  }

  const viewAttrs = [
    { name: 'organisationId',  kind: AttributeKind.SIMPLE, simpleType: SimpleAttributeType.STRING, required: true,  order: 0 },
    { name: 'structureId',     kind: AttributeKind.SIMPLE, simpleType: SimpleAttributeType.STRING, required: false, order: 1 },
    { name: 'folderId',        kind: AttributeKind.SIMPLE, simpleType: SimpleAttributeType.STRING, required: false, order: 2 },
    { name: 'authorId',        kind: AttributeKind.SIMPLE, simpleType: SimpleAttributeType.STRING, required: false, order: 3 },
    { name: 'parentElementId', kind: AttributeKind.SIMPLE, simpleType: SimpleAttributeType.STRING, required: false, order: 4 },
  ];
  for (const a of viewAttrs) {
    const exists = await attrRepo.findOne({ where: { elementClassId: cView.id, name: a.name } });
    if (!exists) await attrRepo.save({ ...a, elementClassId: cView.id });
  }

  // ── Récupère les classes existantes pour les structures prédéfinies ────────
  const allClasses = await classRepo.find();
  const cls = (name: string) => allClasses.find(c => c.name === name)?.id;

  const attrDefs = await attrRepo.find({ where: { elementClassId: cStructure.id } });
  const attrMap  = new Map(attrDefs.map(d => [d.name, d]));

  const createStructure = async (
    name: string,
    structureType: string,
    allowedClassNames: string[],
    allowedRelTypes: RelationType[],
    maxInstances: number | null,
    description: string,
    parentElementClassId: string | null = null,
  ) => {
    const existing = await elemRepo.findOne({ where: { label: name, elementClassId: cStructure!.id } });
    if (existing) {
      // Met à jour parentElementClassId si l'attribut n'est pas encore défini
      if (parentElementClassId) {
        const def = attrMap.get('parentElementClassId');
        if (def) {
          const av = await avRepo.findOne({ where: { elementId: existing.id, attributeDefinitionId: def.id } });
          if (!av) await avRepo.save(avRepo.create({ elementId: existing.id, attributeDefinitionId: def.id, value: parentElementClassId }));
        }
      }
      return;
    }

    const allowedClassIds = allowedClassNames.map(cls).filter(Boolean) as string[];

    const el = await elemRepo.save(elemRepo.create({ label: name, elementClassId: cStructure!.id }));

    const pairs: [string, string][] = [
      ['structureType',   structureType],
      ['description',     description],
      ['allowedClassIds', JSON.stringify(allowedClassIds)],
      ['allowedRelTypes', JSON.stringify(allowedRelTypes)],
    ];
    if (maxInstances != null) pairs.push(['maxInstances', String(maxInstances)]);
    if (parentElementClassId) pairs.push(['parentElementClassId', parentElementClassId]);

    for (const [n, v] of pairs) {
      const def = attrMap.get(n);
      if (def) await avRepo.save(avRepo.create({ elementId: el.id, attributeDefinitionId: def.id, value: v }));
    }

    console.log(`  → Structure "${name}" créée`);
  };

  // ── Classe "Organisation" pour parentElementClassId ──────────────────────
  const cOrg = allClasses.find(c => c.name === 'Organisation');

  // ── Structures prédéfinies ────────────────────────────────────────────────

  await createStructure(
    'Ecosystème',
    'Organisationnelle',
    ['Organisation', 'Partie Prenante', 'Groupe', 'Humain'],
    [RelationType.APPARTENANCE, RelationType.ASSOCIATION],
    null,
    'Organisation et ses parties prenantes internes et externes',
    cOrg?.id ?? null,
  );

  await createStructure(
    'Organigramme',
    'Organisationnelle',
    ['Groupe', 'Humain'],
    [RelationType.APPARTENANCE],
    1, // 1 seul organigramme par organisation
    'Structure hiérarchique des équipes et collaborateurs',
    cOrg?.id ?? null,
  );

  await createStructure(
    'Métiers',
    'Organisationnelle',
    ['Macro-Processus', 'Processus Métier', 'Activité', 'Groupe', 'Humain'],
    [RelationType.APPARTENANCE, RelationType.PRODUCTION, RelationType.DEPENDANCE],
    null,
    'Missions, macro-processus, processus et activités métier',
    cOrg?.id ?? null,
  );

  await createStructure(
    'Système d\'information',
    'Technique',
    ['Machine Physique', 'Machine Virtuelle', 'Serveur', 'Serveur Windows', 'Serveur Linux',
     'Pare-feu', 'Routeur', "Système d'exploitation", 'Logiciel Serveur', 'Groupe'],
    [RelationType.APPARTENANCE, RelationType.DEPENDANCE],
    null,
    'Infrastructure matérielle et logicielle du SI',
    null,
  );

  await createStructure(
    'Services applicatifs',
    'Technique',
    ['Logiciel Serveur', 'Logiciel Bureautique', 'Composant', '.Net', 'PowerShell',
     'Domaine Active Directory', "Unité d'organisation", 'Serveur Web IIS', 'Groupe'],
    [RelationType.APPARTENANCE, RelationType.DEPENDANCE],
    null,
    'Applications, composants et services logiciels',
    null,
  );

  await createStructure(
    'Sites et locaux',
    'Physique',
    ['Organisation', 'Groupe'],
    [RelationType.APPARTENANCE, RelationType.ACCES],
    null,
    'Sites physiques et locaux de l\'organisation',
    null,
  );

  const total = await elemRepo.count({ where: { elementClassId: cStructure.id } });
  console.log(`\n✅ Seed terminé : ${total} structures disponibles.`);
  await AppDataSource.destroy();
}

seed().catch(err => { console.error('❌', err.message); process.exit(1); });
