// src/graph/dto/element.dto.ts
import {
  IsString,
  IsOptional,
  IsUUID,
  IsNumber,
  MaxLength,
  MinLength,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';

// ─── AttributeValue ────────────────────────────────────────────────────────

export class UpsertAttributeValueDto {
  @IsUUID()
  attributeDefinitionId: string;

  /**
   * null = suppression de la valeur.
   * Toujours une string côté transport, typée et validée par le service
   * selon SimpleAttributeType de l'AttributeDefinition.
   */
  @IsOptional()
  @IsString()
  @MaxLength(4096)
  value: string | null;
}

// ─── Element ───────────────────────────────────────────────────────────────

export class CreateElementDto {
  @IsString()
  @MinLength(1)
  @MaxLength(256)
  @Transform(({ value }) => value?.trim())
  label: string;

  @IsUUID()
  elementClassId: string;

  @IsOptional()
  @IsNumber()
  canvasX?: number;

  @IsOptional()
  @IsNumber()
  canvasY?: number;

  /** Valeurs initiales des attributs simples */
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpsertAttributeValueDto)
  attributeValues?: UpsertAttributeValueDto[];
}

export class UpdateElementDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(256)
  @Transform(({ value }) => value?.trim())
  label?: string;

  @IsOptional()
  @IsNumber()
  canvasX?: number;

  @IsOptional()
  @IsNumber()
  canvasY?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpsertAttributeValueDto)
  attributeValues?: UpsertAttributeValueDto[];
}

/** Mise à jour de position depuis le canvas (drag & drop) */
export class MoveElementDto {
  @IsNumber()
  canvasX: number;

  @IsNumber()
  canvasY: number;
}

// ─── Relation ──────────────────────────────────────────────────────────────

import { IsEnum } from 'class-validator';
import { RelationType } from '../../entities/attribute-definition.entity';

export class CreateRelationDto {
  @IsUUID()
  sourceId: string;

  @IsUUID()
  targetId: string;

  @IsEnum(RelationType)
  relationType: RelationType;

  /**
   * Optionnel : lie la relation à un attribut complexe de classe.
   * Si fourni, le service vérifie la conformité (targetClass, maxRelations…).
   */
  @IsOptional()
  @IsUUID()
  attributeDefinitionId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  label?: string;
}

export class UpdateRelationDto {
  @IsOptional()
  @IsString()
  @MaxLength(128)
  label?: string;
}

// ─── Filtres de recherche ──────────────────────────────────────────────────

export class ElementQueryDto {
  @IsOptional()
  @IsUUID()
  classId?: string;

  @IsOptional()
  @IsUUID()
  typeId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  search?: string;
}
