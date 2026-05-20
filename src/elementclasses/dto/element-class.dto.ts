// src/metamodel/dto/element-class.dto.ts
import {
  IsString,
  IsOptional,
  IsUUID,
  MinLength,
  MaxLength,
  Matches,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateElementClassDto {
  @IsString()
  @MinLength(2)
  @MaxLength(128)
  @Transform(({ value }) => value?.trim())
  name: string;

  @IsUUID()
  typeId: string;

  @IsOptional()
  @IsUUID()
  parentClassId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  description?: string;

  @IsOptional()
  @IsString()
  @Matches(/^#[0-9A-Fa-f]{6}$/, { message: 'color doit être au format #RRGGBB' })
  color?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  icon?: string;
}

export class UpdateElementClassDto extends CreateElementClassDto {}
