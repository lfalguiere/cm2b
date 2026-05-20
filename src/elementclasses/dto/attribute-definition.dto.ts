// src/metamodel/dto/attribute-definition.dto.ts
import {
  IsString,
  IsOptional,
  IsUUID,
  IsEnum,
  IsBoolean,
  IsInt,
  IsPositive,
  IsArray,
  Min,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import {
  AttributeKind,
  SimpleAttributeType,
  RelationType,
} from '../../entities/attribute-definition.entity';

export class CreateAttributeDefinitionDto {
  @IsUUID()
  elementClassId: string;

  @IsString()
  @MaxLength(128)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  description?: string;

  @IsEnum(AttributeKind)
  kind: AttributeKind;

  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number;

  @IsOptional()
  @IsBoolean()
  required?: boolean;

  // ─── Attributs SIMPLES ─────────────────────────────────────────────────────

  @ValidateIf((o) => o.kind === AttributeKind.SIMPLE)
  @IsEnum(SimpleAttributeType)
  simpleType?: SimpleAttributeType;

  @IsOptional()
  @IsString()
  @MaxLength(256)
  validationRegex?: string;

  @IsOptional()
  @IsInt()
  @IsPositive()
  maxLength?: number;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  defaultValue?: string;

  /** JSON sérialisé de EnumOption[] — utilisé si simpleType === ENUM */
  @IsOptional()
  @IsString()
  enumOptions?: string;

  // ─── Attributs COMPLEXES ────────────────────────────────────────────────────

  /** UUIDs des classes cibles autorisées. Tableau vide = joker (toute classe). */
  @ValidateIf((o) => o.kind === AttributeKind.COMPLEX)
  @IsArray()
  @IsUUID('4', { each: true })
  targetClassIds?: string[];

  @ValidateIf((o) => o.kind === AttributeKind.COMPLEX)
  @IsEnum(RelationType)
  relationType?: RelationType;

  @ValidateIf((o) => o.kind === AttributeKind.COMPLEX)
  @IsString()
  @MaxLength(128)
  inverseAttributeName?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  minRelations?: number;

  /**
   * null = illimité.
   * Envoyez null explicitement pour "pas de limite".
   */
  @IsOptional()
  @IsInt()
  @IsPositive()
  maxRelations?: number | null;
}

export class UpdateAttributeDefinitionDto extends CreateAttributeDefinitionDto {}
