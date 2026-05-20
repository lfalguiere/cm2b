// src/database/data-source.ts
import { DataSource } from 'typeorm';
import {
  ElementType,
  ElementClass,
  AttributeDefinition,
  Element,
  AttributeValue,
  Relation,
  User,
  RefreshToken,
} from '../entities';

export const AppDataSource = new DataSource({
  type: 'better-sqlite3',
  database: process.env.DB_PATH ?? 'cm2b.sqlite',

  /**
   * En production : migrations UNIQUEMENT (synchronize: false).
   * En développement : synchronize: true acceptable mais attention
   * aux pertes de données lors des changements de schéma.
   */
  synchronize: process.env.NODE_ENV !== 'production',
  migrationsRun: process.env.NODE_ENV === 'production',

  logging: process.env.DB_LOGGING === 'true' ? ['query', 'error'] : ['error'],

  entities: [
    ElementType,
    ElementClass,
    AttributeDefinition,
    Element,
    AttributeValue,
    Relation,
    User,
    RefreshToken,
  ],

  migrations: ['dist/database/migrations/*.js'],

  /**
   * WAL mode SQLite : améliore les performances en écriture concurrente
   * et la résilience aux crashes.
   */
  extra: {
    // Pour better-sqlite3
    pragma: {
      journal_mode: 'WAL',
      foreign_keys: 'ON',
      busy_timeout: 5000,
    },
  },
});
