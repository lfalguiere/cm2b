import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  AfterLoad,
} from 'typeorm';
import { ElementClass } from './element-class.entity';

// Helpers internes — ne pas exporter
function parseIds(json: string | null | undefined): string[] {
  try { return JSON.parse(json || '[]') as string[]; } catch { return []; }
}

/**
 * Type d'attribut :
 * - SIMPLE  : valeur scalaire (string, number, date, ip, email…)
 * - COMPLEX : relation bidirectionnelle vers une autre classe d'élément
 */
export enum AttributeKind {
  SIMPLE = 'SIMPLE',
  COMPLEX = 'COMPLEX',
}

/**
 * Sous-type pour les attributs simples.
 * Permet la validation côté applicatif.
 */
export enum SimpleAttributeType {
  STRING = 'STRING',
  INTEGER = 'INTEGER',
  FLOAT = 'FLOAT',
  DATE = 'DATE',
  DATETIME = 'DATETIME',
  BOOLEAN = 'BOOLEAN',
  IP_ADDRESS = 'IP_ADDRESS',
  EMAIL = 'EMAIL',
  URL = 'URL',
  TEXT = 'TEXT',
  CUSTOM = 'CUSTOM',
  ENUM = 'ENUM', // liste de valeurs prédéfinies avec style (color + bgColor)
}

/** Une valeur possible d'un attribut de type ENUM */
export interface EnumOption {
  value: string;        // valeur stockée
  label: string;        // libellé affiché
  description?: string; // texte affiché au survol
  color?: string;       // couleur du texte (ex: #ffffff)
  bgColor?: string;     // couleur de fond  (ex: #ef4444)
}

/**
 * Type de relation pour les attributs complexes.
 * Correspond aux 5 types de relations du modèle.
 */
export enum RelationType {
  APPARTENANCE = 'APPARTENANCE', // Appartient à / Comprend
  DEPENDANCE = 'DEPENDANCE',     // Dépend de / Supporte
  PRODUCTION = 'PRODUCTION',     // Produit / Est alimenté par
  ACCES = 'ACCES',               // Accède à / Est accédé depuis
  ASSOCIATION = 'ASSOCIATION',   // Associé à / Est associé à
}

/**
 * Définit un attribut d'une classe (méta-modèle).
 *
 * Pour les attributs COMPLEX, la bidirectionnalité est modélisée
 * par inverseAttributeDefinition : l'attribut de la classe cible
 * qui "répond" à cet attribut.
 */
@Entity('attribute_definition')
export class AttributeDefinition {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Classe propriétaire de cet attribut */
  @ManyToOne(() => ElementClass, (cls) => cls.attributeDefinitions, { nullable: false })
  @JoinColumn({ name: 'elementClassId' })
  elementClass: ElementClass;

  @Column({ type: 'text' })
  elementClassId: string;

  /** Nom de l'attribut tel qu'affiché sur la classe source */
  @Column({ type: 'text' })
  name: string; // ex: "hyperviseur", "RAM (Go)", "nom"

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({
    type: 'text',
    enum: AttributeKind,
    default: AttributeKind.SIMPLE,
  })
  kind: AttributeKind;

  /** Ordre d'affichage dans les formulaires */
  @Column({ type: 'integer', default: 0 })
  order: number;

  /** Est-ce obligatoire ? */
  @Column({ type: 'boolean', default: false })
  required: boolean;

  // ─── Attributs SIMPLES ───────────────────────────────────────────────────────

  @Column({
    type: 'text',
    enum: SimpleAttributeType,
    nullable: true,
  })
  simpleType: SimpleAttributeType | null;

  /** Regex de validation (pour CUSTOM ou renforcement d'autres types) */
  @Column({ type: 'text', nullable: true })
  validationRegex: string | null;

  /** Longueur max pour les STRING */
  @Column({ type: 'integer', nullable: true })
  maxLength: number | null;

  /** Valeur par défaut (sérialisée en JSON string) */
  @Column({ type: 'text', nullable: true })
  defaultValue: string | null;

  /** Valeurs possibles pour simpleType === ENUM (JSON : EnumOption[]) */
  @Column({ type: 'text', nullable: true })
  enumOptions: string | null;

  // ─── Attributs COMPLEXES ─────────────────────────────────────────────────────

  /**
   * Classes cibles autorisées (JSON array d'UUIDs).
   * '[]' = joker (toute classe acceptée).
   * Ex: '["uuid1","uuid2"]'
   */
  @Column({
    type: 'text',
    nullable: false,
    default: '[]',
    transformer: {
      to: (v: unknown) => Array.isArray(v) ? JSON.stringify(v) : '[]',
      from: (v: string | null | undefined) => parseIds(v),
    },
  })
  targetClassIds: string[];

  /** @deprecated Ancien champ mono-cible — conservé pour rétrocompatibilité des données existantes. */
  @Column({ type: 'text', nullable: true })
  targetClassId: string | null;

  /** Retourne les IDs cibles, avec repli sur l'ancien champ targetClassId. */
  get targetClassIdList(): string[] {
    if (this.targetClassIds.length === 0 && this.targetClassId) return [this.targetClassId];
    return this.targetClassIds;
  }

  /** Après chargement depuis la DB : migre les anciens champs mono-valeur vers les tableaux. */
  @AfterLoad()
  migrateTargetClassId() {
    if (this.targetClassIds.length === 0 && this.targetClassId) {
      this.targetClassIds = [this.targetClassId];
    }
    if (this.inverseAttributeDefinitionIds.length === 0 && this.inverseAttributeDefinitionId) {
      this.inverseAttributeDefinitionIds = [this.inverseAttributeDefinitionId];
    }
  }

  /** Type de relation utilisé pour relier les éléments */
  @Column({
    type: 'text',
    enum: RelationType,
    nullable: true,
  })
  relationType: RelationType | null;

  /**
   * Nom de l'attribut côté classe CIBLE (relation inverse).
   * Ex: si ici c'est "hyperviseur", côté machine physique ce sera "machines virtuelles"
   */
  @Column({ type: 'text', nullable: true })
  inverseAttributeName: string | null;

  /**
   * ID de l'AttributeDefinition inverse (sur la classe cible).
   * @deprecated Conservé pour rétrocompatibilité — utiliser inverseAttributeDefinitionIds.
   */
  @Column({ type: 'text', nullable: true })
  inverseAttributeDefinitionId: string | null;

  /**
   * IDs de tous les AttributeDefinition inverses (un par classe cible).
   * Remplace inverseAttributeDefinitionId pour le cas multi-cibles.
   */
  @Column({
    type: 'text',
    nullable: false,
    default: '[]',
    transformer: {
      to: (v: unknown) => Array.isArray(v) ? JSON.stringify(v) : '[]',
      from: (v: string | null | undefined) => parseIds(v),
    },
  })
  inverseAttributeDefinitionIds: string[];

  /** Nombre minimum de relations autorisées (0 = optionnel) */
  @Column({ type: 'integer', default: 0 })
  minRelations: number;

  /**
   * Nombre maximum de relations autorisées.
   * null = illimité, 1 = relation unique (ex: OS → machine : 1 seul)
   */
  @Column({ type: 'integer', nullable: true })
  maxRelations: number | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
