// src/auth/strategies/jwt.strategy.ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../entities/user.entity';

export interface JwtPayload {
  sub: string;       // userId
  email: string;
  role: string;
  iat?: number;
  exp?: number;
}

/**
 * Stratégie JWT Passport.
 *
 * Sécurité :
 * - Extraction UNIQUEMENT depuis le header Authorization (Bearer).
 *   Pas de cookie, pas de query param → pas de CSRF possible.
 * - Le secret est lu depuis l'env (jamais hardcodé).
 * - On recharge l'user depuis la DB à chaque requête pour vérifier
 *   isActive et détecter une révocation de compte en temps réel.
 *   Impact perf négligeable sur SQLite ; sur Postgres ajouter un cache Redis.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET,
    });
  }

  async validate(payload: JwtPayload): Promise<User> {
    const user = await this.userRepo.findOne({
      where: { id: payload.sub },
      select: ['id', 'email', 'username', 'role', 'isActive', 'lockedUntil'],
    });

    if (!user) throw new UnauthorizedException('Utilisateur introuvable');
    if (!user.isActive) throw new UnauthorizedException('Compte désactivé');
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new UnauthorizedException('Compte temporairement verrouillé');
    }

    return user;
  }
}
