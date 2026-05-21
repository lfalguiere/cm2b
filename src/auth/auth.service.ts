// src/auth/auth.service.ts
import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { User, UserRole } from '../entities/user.entity';
import { RefreshToken } from '../entities/refresh-token.entity';
import { JwtPayload } from './strategies/jwt.strategy';

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_DURATION_MS = 15 * 60 * 1000; // 15 minutes
const REFRESH_TTL_DAYS = 30;
const ACCESS_TTL_SECONDS = 15 * 60; // 15 minutes

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,

    @InjectRepository(RefreshToken)
    private readonly refreshTokenRepo: Repository<RefreshToken>,

    private readonly jwtService: JwtService,
  ) {}

  // ─── LOGIN ────────────────────────────────────────────────────────────────

  async login(
    email: string,
    password: string,
    deviceFingerprint?: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    // select: false sur passwordHash → on doit le demander explicitement
    const user = await this.userRepo.findOne({
      where: { email: email.toLowerCase() },
      select: [
        'id', 'email', 'username', 'role', 'isActive',
        'passwordHash', 'failedLoginCount', 'lockedUntil',
      ],
    });

    // Même délai si user inexistant (anti-timing attack)
    const passwordMatch = user
      ? await bcrypt.compare(password, user.passwordHash)
      : await bcrypt.compare(password, '$2b$12$invalidhashtopreventtimingleak00');

    if (!user || !passwordMatch) {
      if (user) await this.recordFailedAttempt(user);
      // Message volontairement vague
      throw new UnauthorizedException('Identifiants invalides');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Compte désactivé');
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const remaining = Math.ceil(
        (user.lockedUntil.getTime() - Date.now()) / 60000,
      );
      throw new UnauthorizedException(
        `Compte verrouillé. Réessayez dans ${remaining} min`,
      );
    }

    // Réinitialise le compteur d'échecs
    await this.userRepo.update(user.id, {
      failedLoginCount: 0,
      lockedUntil: null,
    });

    return this.issueTokenPair(user, deviceFingerprint);
  }

  // ─── REFRESH ──────────────────────────────────────────────────────────────

  async refresh(
    rawRefreshToken: string,
    deviceFingerprint?: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const hash = this.hashToken(rawRefreshToken);

    const stored = await this.refreshTokenRepo.findOne({
      where: { tokenHash: hash },
      relations: ['user'],
    });

    if (!stored) {
      throw new UnauthorizedException('Token de rafraîchissement invalide');
    }

    // Token révoqué → replay attack détectée → révocation globale
    if (stored.isRevoked) {
      await this.revokeAllUserTokens(stored.userId);
      throw new UnauthorizedException(
        'Token révoqué. Toutes les sessions ont été fermées.',
      );
    }

    if (stored.expiresAt < new Date()) {
      await this.refreshTokenRepo.update(stored.id, { isRevoked: true });
      throw new UnauthorizedException('Token de rafraîchissement expiré');
    }

    // Révoque l'ancien token (rotation one-time-use)
    await this.refreshTokenRepo.update(stored.id, { isRevoked: true });

    return this.issueTokenPair(stored.user, deviceFingerprint);
  }

  // ─── LOGOUT ───────────────────────────────────────────────────────────────

  async logout(rawRefreshToken: string): Promise<void> {
    const hash = this.hashToken(rawRefreshToken);
    await this.refreshTokenRepo.update({ tokenHash: hash }, { isRevoked: true });
  }

  async logoutAll(userId: string): Promise<void> {
    await this.revokeAllUserTokens(userId);
  }

  // ─── REGISTER (usage interne / ADMIN uniquement) ─────────────────────────

  async register(
    email: string,
    username: string,
    password: string,
    role = 'VIEWER',
  ): Promise<User> {
    this.validatePasswordStrength(password);

    const exists = await this.userRepo.findOne({
      where: [{ email: email.toLowerCase() }, { username }],
    });
    if (exists) throw new BadRequestException('Email ou username déjà utilisé');

    const passwordHash = await bcrypt.hash(password, 12);
    const user = this.userRepo.create({
      email: email.toLowerCase(),
      username,
      passwordHash,
      role: role as any,
    });
    return this.userRepo.save(user);
  }

  // ─── SETUP (premier démarrage) ───────────────────────────────────────────

  async isSetupNeeded(): Promise<boolean> {
    const count = await this.userRepo.count({ where: { role: UserRole.ADMIN } });
    return count === 0;
  }

  async setupAdmin(email: string, username: string, password: string): Promise<User> {
    if (!(await this.isSetupNeeded())) {
      throw new ForbiddenException('Setup déjà effectué');
    }
    return this.register(email, username, password, UserRole.ADMIN);
  }

  // ─── NETTOYAGE PÉRIODIQUE ─────────────────────────────────────────────────

  /**
   * À appeler via un cron job (ex: toutes les heures).
   * Supprime les refresh tokens expirés pour éviter la croissance de la table.
   */
  async purgeExpiredTokens(): Promise<number> {
    const result = await this.refreshTokenRepo.delete({
      expiresAt: LessThan(new Date()),
    });
    return result.affected ?? 0;
  }

  // ─── PRIVÉ ────────────────────────────────────────────────────────────────

  private async issueTokenPair(
    user: User,
    deviceFingerprint?: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    const accessToken = this.jwtService.sign(payload, {
      expiresIn: ACCESS_TTL_SECONDS,
    });

    // Refresh token : valeur aléatoire opaque (pas un JWT)
    const rawRefreshToken = crypto.randomBytes(64).toString('hex');
    const tokenHash = this.hashToken(rawRefreshToken);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + REFRESH_TTL_DAYS);

    await this.refreshTokenRepo.save({
      userId: user.id,
      tokenHash,
      expiresAt,
      deviceFingerprint: deviceFingerprint ?? null,
    });

    return { accessToken, refreshToken: rawRefreshToken };
  }

  private async recordFailedAttempt(user: User): Promise<void> {
    const count = user.failedLoginCount + 1;
    const lockedUntil =
      count >= MAX_FAILED_ATTEMPTS
        ? new Date(Date.now() + LOCK_DURATION_MS)
        : null;

    await this.userRepo.update(user.id, {
      failedLoginCount: count,
      lockedUntil,
    });
  }

  private async revokeAllUserTokens(userId: string): Promise<void> {
    await this.refreshTokenRepo.update({ userId }, { isRevoked: true });
  }

  private hashToken(raw: string): string {
    return crypto.createHash('sha256').update(raw).digest('hex');
  }

  private validatePasswordStrength(password: string): void {
    const errors: string[] = [];
    if (password.length < 12) errors.push('minimum 12 caractères');
    if (!/[A-Z]/.test(password)) errors.push('une majuscule');
    if (!/[a-z]/.test(password)) errors.push('une minuscule');
    if (!/\d/.test(password)) errors.push('un chiffre');
    if (!/[^A-Za-z0-9]/.test(password)) errors.push('un caractère spécial');
    if (errors.length) {
      throw new BadRequestException(
        `Mot de passe insuffisant : ${errors.join(', ')}`,
      );
    }
  }
}
