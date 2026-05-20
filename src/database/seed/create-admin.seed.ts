/**
 * src/database/seed/create-admin.seed.ts
 *
 * Crée le premier utilisateur ADMIN directement en base,
 * sans passer par l'API (contourne volontairement les guards).
 *
 * Usage :
 *   npx ts-node -r tsconfig-paths/register src/database/seed/create-admin.seed.ts
 *
 * Variables d'environnement lues depuis .env.local :
 *   ADMIN_EMAIL    (défaut : admin@cm2b.local)
 *   ADMIN_USERNAME (défaut : admin)
 *   ADMIN_PASSWORD (obligatoire ou valeur par défaut ci-dessous)
 */

import 'reflect-metadata';
import * as bcrypt from 'bcrypt';
import * as path from 'path';
import * as fs from 'fs';

// Charge .env.local manuellement (pas de NestJS ici)
const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, 'utf-8').split('\n');
  for (const line of lines) {
    const [key, ...rest] = line.split('=');
    if (key && rest.length) {
      process.env[key.trim()] = rest.join('=').trim();
    }
  }
}

import { AppDataSource } from '../data-source';
import { User, UserRole } from '../../entities/user.entity';

const EMAIL    = process.env.ADMIN_EMAIL    ?? 'admin@cm2b.local';
const USERNAME = process.env.ADMIN_USERNAME ?? 'admin';
const PASSWORD = process.env.ADMIN_PASSWORD ?? 'Cm2b@Admin2024!';

async function createAdmin() {
  await AppDataSource.initialize();
  const repo = AppDataSource.getRepository(User);

  const existing = await repo.findOne({ where: { email: EMAIL } });
  if (existing) {
    console.log(`✅ Un utilisateur avec l'email "${EMAIL}" existe déjà.`);
    await AppDataSource.destroy();
    return;
  }

  const passwordHash = await bcrypt.hash(PASSWORD, 12);
  const admin = repo.create({
    email: EMAIL,
    username: USERNAME,
    passwordHash,
    role: UserRole.ADMIN,
    isActive: true,
  });

  await repo.save(admin);
  console.log(`✅ Administrateur créé avec succès :`);
  console.log(`   Email    : ${EMAIL}`);
  console.log(`   Username : ${USERNAME}`);
  console.log(`   Password : ${PASSWORD}`);
  console.log(`\n⚠️  Changez ce mot de passe dès la première connexion !`);

  await AppDataSource.destroy();
}

createAdmin().catch((err) => {
  console.error('❌ Erreur :', err.message);
  process.exit(1);
});
