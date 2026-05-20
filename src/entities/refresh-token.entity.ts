import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { User } from './user.entity';

/**
 * Refresh Token JWT.
 *
 * Stratégie de sécurité :
 * - Le token brut N'EST PAS stocké — seul son hash SHA-256 l'est.
 *   (Si la table est compromise, les tokens ne peuvent pas être réutilisés.)
 * - isRevoked permet la révocation individuelle (logout sur un appareil).
 * - La révocation de TOUS les tokens d'un user est possible via
 *   DELETE WHERE userId = ? (logout global / changement de mot de passe).
 * - expiresAt permet le nettoyage automatique des tokens expirés.
 *
 * Rotation des refresh tokens :
 * - À chaque usage d'un refresh token, l'ancien est révoqué et
 *   un nouveau est émis (rotation one-time-use).
 * - Si un token révoqué est réutilisé → tous les tokens de l'user
 *   sont révoqués (détection de replay attack).
 */
@Entity('refresh_token')
export class RefreshToken {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, (user) => user.refreshTokens, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'text' })
  userId: string;

  /**
   * Hash SHA-256 du refresh token brut.
   * Le token brut est envoyé au client, seul le hash est persisté.
   */
  @Index()
  @Column({ type: 'text', unique: true })
  tokenHash: string;

  @Column({ type: 'datetime' })
  expiresAt: Date;

  @Column({ type: 'boolean', default: false })
  isRevoked: boolean;

  /**
   * Identifiant de l'appareil/session (user-agent + IP partielle, hash).
   * Permet de détecter les usages depuis des contextes inhabituels.
   */
  @Column({ type: 'text', nullable: true })
  deviceFingerprint: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
