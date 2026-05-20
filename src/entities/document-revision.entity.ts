// src/entities/document-revision.entity.ts
import {
  Entity, PrimaryGeneratedColumn, Column,
  ManyToOne, JoinColumn, CreateDateColumn, Index,
} from 'typeorm';
import { User } from './user.entity';

/**
 * Snapshot immutable d'un document à un instant T.
 * Créé automatiquement à chaque modification significative.
 * Le snapshot JSON contient : { nodes: [...], edges: [...] }
 */
@Entity('document_revision')
export class DocumentRevision {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** ID de l'Element de classe "Document" */
  @Index()
  @Column({ type: 'text' })
  documentId: string;

  @ManyToOne(() => User, { nullable: true, eager: false })
  @JoinColumn({ name: 'userId' })
  user: User | null;

  @Column({ type: 'text', nullable: true })
  userId: string | null;

  /** Snapshot complet : { nodes, edges, label } */
  @Column({ type: 'text' })
  snapshot: string; // JSON.stringify

  /** Message de modification optionnel (ex: "Ajout serveur DB-01") */
  @Column({ type: 'text', nullable: true })
  message: string | null;

  @CreateDateColumn()
  changedAt: Date;
}
