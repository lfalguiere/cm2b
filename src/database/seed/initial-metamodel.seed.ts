/**
 * Peuple les ElementType et ElementClass de base.
 * Usage : npm run seed
 */

import 'reflect-metadata';
import * as path from 'path';
import * as fs from 'fs';

// Charge .env.local manuellement
const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, 'utf-8').split('\n');
  for (const line of lines) {
    const [key, ...rest] = line.split('=');
    if (key && rest.length) process.env[key.trim()] = rest.join('=').trim();
  }
}

import { AppDataSource } from '../data-source';
import { ElementType } from '../../entities/element-type.entity';
import { ElementClass } from '../../entities/element-class.entity';

async function seed() {
  await AppDataSource.initialize();
  console.log('✅ Connexion base de données OK');

  const typeRepo  = AppDataSource.getRepository(ElementType);
  const classRepo = AppDataSource.getRepository(ElementClass);

  // Vérifie si déjà seedé
  const existing = await typeRepo.count();
  if (existing > 0) {
    console.log(`⚠️  Méta-modèle déjà présent (${existing} types). Seed ignoré.`);
    await AppDataSource.destroy();
    return;
  }

  // ─── TYPES ───────────────────────────────────────────────────────────────────

  const [tOrg, tHumain, tTech] = await typeRepo.save([
    { name: 'Organisationnel',   color: '#6366f1', icon: 'building' },
    { name: 'Actifs Humains',    color: '#f59e0b', icon: 'users' },
    { name: 'Actifs Techniques', color: '#10b981', icon: 'server' },
    { name: 'Actifs Physiques',  color: '#64748b', icon: 'database' },
  ]);

  // ─── CLASSES ORGANISATIONNELLES ──────────────────────────────────────────────

  await classRepo.save([
    { name: 'Organisation',     typeId: tOrg.id },
    { name: 'Mission',          typeId: tOrg.id },
    { name: 'Macro-Processus',  typeId: tOrg.id },
    { name: 'Processus Métier', typeId: tOrg.id },
    { name: 'Activité',         typeId: tOrg.id },
  ]);

  // ─── CLASSES HUMAINES ────────────────────────────────────────────────────────

  const cPartiePrenante = await classRepo.save({ name: 'Partie Prenante', typeId: tHumain.id });
  await classRepo.save([
    { name: 'Groupe', typeId: tHumain.id, parentClassId: cPartiePrenante.id },
    { name: 'Humain', typeId: tHumain.id, parentClassId: cPartiePrenante.id },
  ]);

  // ─── CLASSES TECHNIQUES ──────────────────────────────────────────────────────

  const cMachine         = await classRepo.save({ name: 'Machine',          typeId: tTech.id });
  const cMachinePhysique = await classRepo.save({ name: 'Machine Physique', typeId: tTech.id, parentClassId: cMachine.id });
  await classRepo.save(              { name: 'Machine Virtuelle', typeId: tTech.id, parentClassId: cMachine.id });

  const cServeur = await classRepo.save({ name: 'Serveur', typeId: tTech.id, parentClassId: cMachinePhysique.id });
  await classRepo.save([
    { name: 'Serveur Windows', typeId: tTech.id, parentClassId: cServeur.id },
    { name: 'Serveur Linux',   typeId: tTech.id, parentClassId: cServeur.id },
    { name: 'Poste Windows',   typeId: tTech.id, parentClassId: cMachinePhysique.id },
    { name: 'Routeur',         typeId: tTech.id, parentClassId: cMachinePhysique.id },
    { name: 'Pare-feu',        typeId: tTech.id, parentClassId: cMachinePhysique.id },
  ]);

  const cOS = await classRepo.save({ name: "Système d'exploitation", typeId: tTech.id });
  await classRepo.save({ name: "Version de Système d'exploitation", typeId: tTech.id, parentClassId: cOS.id });

  const cLogiciel = await classRepo.save({ name: 'Logiciel', typeId: tTech.id });
  await classRepo.save([
    { name: 'Logiciel Serveur',    typeId: tTech.id, parentClassId: cLogiciel.id },
    { name: 'Logiciel Bureautique',typeId: tTech.id, parentClassId: cLogiciel.id },
  ]);

  const cComposant = await classRepo.save({ name: 'Composant', typeId: tTech.id });
  await classRepo.save([
    { name: '.Net',       typeId: tTech.id, parentClassId: cComposant.id },
    { name: 'PowerShell', typeId: tTech.id, parentClassId: cComposant.id },
  ]);

  const cRole = await classRepo.save({ name: 'Rôle Microsoft Windows', typeId: tTech.id });
  const cDomaine = await classRepo.save({ name: 'Domaine Active Directory', typeId: tTech.id, parentClassId: cRole.id });
  await classRepo.save([
    { name: "Unité d'organisation",      typeId: tTech.id, parentClassId: cDomaine.id },
    { name: 'Service de Fichier',        typeId: tTech.id, parentClassId: cRole.id },
    { name: 'Autorité de Certification', typeId: tTech.id, parentClassId: cRole.id },
    { name: 'Serveur Web IIS',           typeId: tTech.id, parentClassId: cRole.id },
  ]);

  const total = await classRepo.count();
  console.log(`✅ Méta-modèle seedé : 4 types, ${total} classes créées.`);
  await AppDataSource.destroy();
}

seed().catch((err) => {
  console.error('❌ Erreur seed :', err.message);
  process.exit(1);
});
