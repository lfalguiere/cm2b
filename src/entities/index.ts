// src/entities/index.ts
// Barrel export — à importer dans le module NestJS et la DataSource

export { ElementType } from './element-type.entity';
export { ElementClass } from './element-class.entity';
export { AttributeDefinition, AttributeKind, SimpleAttributeType, RelationType } from './attribute-definition.entity';
export { Element } from './element.entity';
export { AttributeValue } from './attribute-value.entity';
export { Relation } from './relation.entity';
export { User, UserRole } from './user.entity';
export { RefreshToken } from './refresh-token.entity';
export { DocumentRevision } from './document-revision.entity';
export { ViewElementPosition } from './view-element-position.entity';
