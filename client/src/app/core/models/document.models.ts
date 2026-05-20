// src/app/core/models/document.models.ts
import { RelationType } from './api.models';

export interface Structure {
  id: string;
  name: string;
  structureType: 'Organisationnelle' | 'Technique' | 'Physique';
  allowedClassIds: string[];
  allowedRelationTypes: RelationType[];
  maxInstances: number | null;
  description: string | null;
  parentElementClassId: string | null;
}

export interface ViewMeta {
  id: string;
  name: string;
  structureId: string | null;
}

export interface ViewDetail extends ViewMeta {
  organisationId: string;
  folderId: string | null;
  authorId: string | null;
  parentElementId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ViewMembers {
  viewId: string;
  viewName: string;
  structureId: string | null;
  allowedClassIds: string[];
  nodes: any[];
  edges: any[];
  hasPerViewPositions: boolean;
}

// ── Arborescence pilotée par les Structures ────────────────────────────────────

export interface StructureNode {
  structureId: string;
  structureName: string;
  maxInstances: number | null;
  view?: { id: string; name: string };   // maxInstances === 1
  views?: { id: string; name: string }[]; // maxInstances > 1 || null
}

export interface StructureTreeGroup {
  type: 'Organisationnelle' | 'Technique' | 'Physique';
  structures: StructureNode[];
}

// ── Contexte du menu clic-droit ───────────────────────────────────────────────

export type ContextTarget =
  | { type: 'folder'; id: string; name: string }
  | { type: 'view';   id: string; name: string }
  | { type: 'canvas' };

export interface ContextMenuState {
  visible: boolean;
  x: number;
  y: number;
  target: ContextTarget | null;
}
