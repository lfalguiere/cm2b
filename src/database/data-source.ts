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
  DocumentRevision,
  ViewElementPosition,
} from '../entities';

export const AppDataSource = new DataSource({
  type: 'better-sqlite3',
  database: process.env.DB_PATH ?? 'cm2b.sqlite',

  // TYPEORM_SYNC=false pour désactiver (ex: migration manuelle). Par défaut true.
  synchronize: process.env.TYPEORM_SYNC !== 'false',
  migrationsRun: false,

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
    DocumentRevision,
    ViewElementPosition,
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
