import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { RefreshToken } from './refresh-token.entity';

export enum UserRole {
  ADMIN = 'ADMIN',
  EDITOR = 'EDITOR',
  VIEWER = 'VIEWER',
}

/**
 * Utilisateur de l'application.
 *
 * Sécurité :
 * - Le mot de passe est TOUJOURS stocké hashé (bcrypt, coût ≥ 12).
 * - isActive permet de révoquer un compte sans le supprimer.
 * - failedLoginCount + lockedUntil implémentent le verrouillage
 *   après N tentatives échouées (anti brute-force).
 */
@Entity('user')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'text', unique: true })
  email: string;

  @Column({ type: 'text', unique: true })
  username: string;

  /** Mot de passe hashé bcrypt — NE JAMAIS exposer dans les DTOs de réponse */
  @Column({ type: 'text', select: false })
  passwordHash: string;

  @Column({
    type: 'text',
    enum: UserRole,
    default: UserRole.VIEWER,
  })
  role: UserRole;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  /** Compteur de tentatives de connexion échouées consécutives */
  @Column({ type: 'integer', default: 0 })
  failedLoginCount: number;

  /** Date jusqu'à laquelle le compte est verrouillé (null = non verrouillé) */
  @Column({ type: 'datetime', nullable: true })
  lockedUntil: Date | null;

  /** Tokens de rafraîchissement actifs pour cet utilisateur */
  @OneToMany(() => RefreshToken, (rt) => rt.user, { cascade: true })
  refreshTokens: RefreshToken[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
