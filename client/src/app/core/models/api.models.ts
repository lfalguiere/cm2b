// src/app/core/models/api.models.ts

// ─── Auth ──────────────────────────────────────────────────────────────────

export interface LoginRequest {
  email: string;
  password: string;
  deviceFingerprint?: string;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: UserProfile;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface UserProfile {
  id: string;
  email: string;
  username: string;
  role: 'ADMIN' | 'EDITOR' | 'VIEWER';
}

// ─── Méta-modèle ───────────────────────────────────────────────────────────

export interface ElementType {
  id: string;
  name: string;
  description?: string;
  color?: string;
  icon?: string;
  classes?: ElementClass[];
}

export interface ElementClass {
  id: string;
  name: string;
  typeId: string;
  type?: ElementType;
  parentClassId?: string | null;
  parentClass?: ElementClass | null;
  children?: ElementClass[];
  description?: string;
  color?: string;
  icon?: string;
}

export type AttributeKind = 'SIMPLE' | 'COMPLEX';

export type SimpleAttributeType =
  | 'STRING' | 'INTEGER' | 'FLOAT' | 'DATE' | 'DATETIME'
  | 'BOOLEAN' | 'IP_ADDRESS' | 'EMAIL' | 'URL' | 'TEXT' | 'CUSTOM' | 'ENUM';

export interface EnumOption {
  value: string;
  label: string;
  description?: string;
  color?: string;
  bgColor?: string;
}

export type RelationType =
  | 'APPARTENANCE' | 'DEPENDANCE' | 'PRODUCTION' | 'ACCES' | 'ASSOCIATION';

export interface AttributeDefinition {
  id: string;
  elementClassId: string;
  name: string;
  description?: string;
  kind: AttributeKind;
  order: number;
  required: boolean;
  // Simple
  simpleType?: SimpleAttributeType;
  validationRegex?: string;
  maxLength?: number;
  defaultValue?: string;
  enumOptions?: string | null; // JSON : EnumOption[]
  // Complex
  targetClassIds?: string[];
  relationType?: RelationType;
  inverseAttributeName?: string;
  inverseAttributeDefinitionId?: string;
  minRelations?: number;
  maxRelations?: number | null;
}

// ─── Graphe ────────────────────────────────────────────────────────────────

export interface AttributeValue {
  id: string;
  elementId: string;
  attributeDefinitionId: string;
  attributeDefinition?: AttributeDefinition;
  value: string | null;
}

export interface Element {
  id: string;
  label: string;
  elementClassId: string;
  elementClass?: ElementClass;
  canvasX?: number | null;
  canvasY?: number | null;
  attributeValues?: AttributeValue[];
  createdAt?: string;
  updatedAt?: string;
}

export interface Relation {
  id: string;
  sourceId: string;
  source?: Element;
  targetId: string;
  target?: Element;
  relationType: RelationType;
  attributeDefinitionId?: string | null;
  attributeDefinition?: AttributeDefinition | null;
  label?: string | null;
}

export interface GraphView {
  nodes: Element[];
  edges: Relation[];
}

export interface ElementWithRelations {
  element: Element;
  outgoing: Relation[];
  incoming: Relation[];
}

// ─── Requêtes ──────────────────────────────────────────────────────────────

export interface CreateElementDto {
  label: string;
  elementClassId: string;
  canvasX?: number;
  canvasY?: number;
  attributeValues?: { attributeDefinitionId: string; value: string | null }[];
}

export interface UpdateElementDto {
  label?: string;
  canvasX?: number;
  canvasY?: number;
  attributeValues?: { attributeDefinitionId: string; value: string | null }[];
}

export interface CreateRelationDto {
  sourceId: string;
  targetId: string;
  relationType: RelationType;
  attributeDefinitionId?: string;
  label?: string;
}

export interface ElementQuery {
  classId?: string;
  typeId?: string;
  search?: string;
}

// ─── Structures ────────────────────────────────────────────────────────────

export type StructureType = 'Organisationnelle' | 'Technique' | 'Physique';

export interface Structure {
  id: string;
  name: string;
  description?: string;
  structureType: StructureType;
  allowedClassIds: string[];
  allowedRelationTypes: RelationType[];
  maxInstances?: number | null;
  parentElementClassId?: string | null;
}

export interface CreateStructureDto {
  name: string;
  description?: string;
  structureType: StructureType;
  allowedClassIds: string[];
  allowedRelationTypes: RelationType[];
  maxInstances?: number | null;
  parentElementClassId?: string | null;
}
