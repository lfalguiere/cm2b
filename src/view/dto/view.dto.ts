// src/view/dto/view.dto.ts
import {
  IsString, IsOptional, IsUUID, MaxLength, MinLength,
  IsArray, IsEnum, IsInt, Min, IsNotEmpty,
} from 'class-validator';
import { RelationType } from '../../entities/attribute-definition.entity';

// ─── Structure (template de vue) ──────────────────────────────────────────────

export class CreateStructureDto {
  @IsString() @MinLength(1) @MaxLength(128)
  name: string;

  @IsOptional() @IsString() @MaxLength(512)
  description?: string;

  /** Type de structure : Organisationnelle | Technique | Physique */
  @IsEnum(['Organisationnelle', 'Technique', 'Physique'])
  structureType: 'Organisationnelle' | 'Technique' | 'Physique';

  /** IDs des ElementClass autorisées dans ce type de vue */
  @IsArray() @IsUUID(undefined, { each: true })
  allowedClassIds: string[];

  /** Types de relations autorisés */
  @IsArray() @IsEnum(RelationType, { each: true })
  allowedRelationTypes: RelationType[];

  /**
   * Nombre max de vues de ce type par organisation.
   * null = illimité.
   */
  @IsOptional() @IsInt() @Min(1)
  maxInstances?: number | null;

  /** Classe d'élément depuis laquelle cette structure peut être déclenchée (clic droit). */
  @IsOptional() @IsString()
  parentElementClassId?: string | null;
}

export class UpdateStructureDto extends CreateStructureDto {}

export class ReorderStructuresDto {
  @IsArray()
  @IsUUID(undefined, { each: true })
  ids: string[];
}

// ─── Vue ──────────────────────────────────────────────────────────────────────

export class CreateViewDto {
  @IsString() @MinLength(1) @MaxLength(256)
  name: string;

  /** null = vue libre */
  @IsOptional() @IsUUID()
  structureId?: string | null;

  /** Dossier parent (null = racine) */
  @IsOptional() @IsUUID()
  folderId?: string | null;

  /** Organisation à laquelle appartient cette vue */
  @IsString() @IsNotEmpty()
  organisationId: string;

  /** Élément depuis lequel cette vue a été créée (clic droit sur un nœud). */
  @IsOptional() @IsString()
  parentElementId?: string | null;
}

export class UpdateViewDto {
  @IsOptional() @IsString() @MaxLength(256)
  name?: string;

  @IsOptional() @IsUUID()
  folderId?: string | null;
}

// ─── Membres de la vue ────────────────────────────────────────────────────────

export class AddMemberDto {
  /** Element à ajouter à la vue */
  @IsUUID()
  elementId: string;
}

export class RemoveMemberDto {
  @IsUUID()
  elementId: string;
}

// ─── Réponses ─────────────────────────────────────────────────────────────────

export class ViewMembersResponseDto {
  viewId: string;
  viewName: string;
  structureId: string | null;
  allowedClassIds: string[];
  nodes: any[];
  edges: any[];
  hasPerViewPositions: boolean;
}
