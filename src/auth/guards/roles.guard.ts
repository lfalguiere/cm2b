// src/auth/guards/roles.guard.ts
import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '../../entities/user.entity';
import { ROLES_KEY } from '../decorators/roles.decorator';

/**
 * Guard RBAC.
 *
 * À chaîner APRÈS JwtAuthGuard (qui a déjà validé le token et posé req.user).
 *
 * Hiérarchie implicite : ADMIN > EDITOR > VIEWER.
 * Si aucun rôle n'est requis via @Roles(), la route est accessible
 * à tout utilisateur authentifié.
 *
 * Utilisé via @UseGuards(JwtAuthGuard, RolesGuard) ou globalement.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  private static readonly HIERARCHY: Record<UserRole, number> = {
    [UserRole.ADMIN]: 3,
    [UserRole.EDITOR]: 2,
    [UserRole.VIEWER]: 1,
  };

  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    // Aucun rôle spécifique requis → tout user authentifié est ok
    if (!requiredRoles || requiredRoles.length === 0) return true;

    const { user } = context.switchToHttp().getRequest();
    if (!user) throw new ForbiddenException('Accès refusé');

    const userLevel = RolesGuard.HIERARCHY[user.role as UserRole] ?? 0;
    const minRequired = Math.min(
      ...requiredRoles.map((r) => RolesGuard.HIERARCHY[r] ?? 99),
    );

    if (userLevel < minRequired) {
      throw new ForbiddenException(
        `Rôle insuffisant. Requis : ${requiredRoles.join(' ou ')}`,
      );
    }

    return true;
  }
}
