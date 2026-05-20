import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { Element } from './element.entity';
import { AttributeDefinition, RelationType } from './attribute-definition.entity';

/**
 * ARÊTE du graphe CM2B.
 *
 * Une Relation relie un Element SOURCE à un Element CIBLE.
 * Elle est toujours typée (RelationType) et peut être liée
 * à une AttributeDefinition pour les attributs COMPLEX.
 *
 * La bidirectionnalité est gérée par la paire :
 *   attributeDefinition  (côté source → cible)
 *   inverseAttributeDefinitionId (côté cible → source)
 *
 * Exemples :
 *   VM "srv-app-01" --[APPARTENANCE]--> Machine physique "esxi-01"
 *     attributeDefinition = "hyperviseur" (sur VM)
 *     inverse             = "machines virtuelles" (sur Machine physique)
 *
 *   OS "Win Server 2022" --[DEPENDANCE]--> Version OS "22H2"
 */
@Entity('relation')
@Index(['sourceId', 'targetId', 'attributeDefinitionId'], { unique: false })
export class Relation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Nœud source de la relation */
  @ManyToOne(() => Element, (el) => el.outgoingRelations, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'sourceId' })
  source: Element;

  @Column({ type: 'text' })
  sourceId: string;

  /** Nœud cible de la relation */
  @ManyToOne(() => Element, (el) => el.incomingRelations, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'targetId' })
  target: Element;

  @Column({ type: 'text' })
  targetId: string;

  /**
   * Type sémantique de la relation.
   * Redondant avec attributeDefinition.relationType mais
   * permet des requêtes directes sans jointure.
   */
  @Column({
    type: 'text',
    enum: RelationType,
  })
  relationType: RelationType;

  /**
   * AttributeDefinition qui a "déclenché" cette relation (côté source).
   * null si la relation est créée manuellement sans être portée
   * par un attribut complexe de classe.
   */
  @ManyToOne(() => AttributeDefinition, {
    nullable: true,
    eager: false,
  })
  @JoinColumn({ name: 'attributeDefinitionId' })
  attributeDefinition: AttributeDefinition | null;

  @Column({ type: 'text', nullable: true })
  attributeDefinitionId: string | null;

  /**
   * Libellé libre affiché sur l'arête du canvas.
   * Pré-rempli avec attributeDefinition.name si renseigné.
   */
  @Column({ type: 'text', nullable: true })
  label: string | null;

  /** Métadonnées libres (ex: depuis quand, niveau de confiance…) */
  @Column({ type: 'text', nullable: true })
  metadata: string | null; // JSON.stringify

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
