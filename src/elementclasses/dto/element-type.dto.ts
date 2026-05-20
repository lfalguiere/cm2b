// src/metamodel/dto/element-type.dto.ts
import {
  IsString,
  IsOptional,
  MinLength,
  MaxLength,
  Matches,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateElementTypeDto {
  @IsString()
  @MinLength(2)
  @MaxLength(64)
  @Transform(({ value }) => value?.trim())
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  description?: string;

  /** Couleur hex (#RRGGBB) */
  @IsOptional()
  @IsString()
  @Matches(/^#[0-9A-Fa-f]{6}$/, { message: 'color doit être au format #RRGGBB' })
  color?: string;

  /** Nom d'icône (lucide, fontawesome…) */
  @IsOptional()
  @IsString()
  @MaxLength(64)
  icon?: string;
}

export class UpdateElementTypeDto extends CreateElementTypeDto {}
