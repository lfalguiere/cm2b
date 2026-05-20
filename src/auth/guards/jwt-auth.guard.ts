// src/auth/guards/jwt-auth.guard.ts
import {
  Injectable,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Marque une route comme publique (pas de JWT requis).
 * @example @Public() @Get('health')
 */
import { SetMetadata } from '@nestjs/common';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

/**
 * Guard JWT global.
 *
 * Appliqué globalement dans AppModule (APP_GUARD).
 * Les routes marquées @Public() passent sans token.
 *
 * En cas de token invalide/expiré, renvoie 401 avec un message
 * générique (pas de fuite d'info sur la raison exacte de l'échec).
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;
    return super.canActivate(context);
  }

  handleRequest(err: any, user: any) {
    if (err || !user) {
      // Message volontairement vague pour ne pas aider un attaquant
      throw new UnauthorizedException('Authentification requise');
    }
    return user;
  }
}
