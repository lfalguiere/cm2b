// src/auth/dto/auth.dto.ts
import {
  IsEmail,
  IsString,
  MinLength,
  MaxLength,
  IsOptional,
  IsEnum,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { UserRole } from '../../entities/user.entity';

export class LoginDto {
  @IsEmail({}, { message: 'Email invalide' })
  @Transform(({ value }) => value?.toLowerCase()?.trim())
  email: string;

  @IsString()
  @MinLength(1)
  password: string;

  /** Empreinte de l'appareil (user-agent hashé côté client) */
  @IsOptional()
  @IsString()
  @MaxLength(64)
  deviceFingerprint?: string;
}

export class RegisterDto {
  @IsEmail({}, { message: 'Email invalide' })
  @Transform(({ value }) => value?.toLowerCase()?.trim())
  email: string;

  @IsString()
  @MinLength(3)
  @MaxLength(30)
  @Transform(({ value }) => value?.trim())
  username: string;

  @IsString()
  @MinLength(12, { message: 'Mot de passe : minimum 12 caractères' })
  password: string;

  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;
}

export class SetupDto {
  @IsEmail({}, { message: 'Email invalide' })
  @Transform(({ value }) => value?.toLowerCase()?.trim())
  email: string;

  @IsString()
  @MinLength(3)
  @MaxLength(30)
  @Transform(({ value }) => value?.trim())
  username: string;

  @IsString()
  @MinLength(12, { message: 'Mot de passe : minimum 12 caractères' })
  password: string;
}

export class RefreshDto {
  @IsString()
  @MinLength(1)
  refreshToken: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  deviceFingerprint?: string;
}

export class LogoutDto {
  @IsString()
  @MinLength(1)
  refreshToken: string;
}

// ─── Réponses (pas d'exposer l'entité User brute) ─────────────────────────

export class AuthResponseDto {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    username: string;
    role: UserRole;
  };
}

export class TokenPairDto {
  accessToken: string;
  refreshToken: string;
}
