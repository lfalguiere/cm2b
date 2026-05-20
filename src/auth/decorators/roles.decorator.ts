// src/auth/decorators/roles.decorator.ts
import { SetMetadata } from '@nestjs/common';
import { UserRole } from '../../entities/user.entity';

export const ROLES_KEY = 'roles';

/**
 * Décorateur à poser sur un controller ou une route.
 * @example @Roles(UserRole.ADMIN, UserRole.EDITOR)
 */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
