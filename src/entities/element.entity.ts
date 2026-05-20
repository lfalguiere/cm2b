import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ElementClass } from './element-class.entity';
import { AttributeValue } from './attribute-value.entity';
import { Relation } from './relation.entity';

/**
 * Instance concrète d'une ElementClass.
 * C'est le NŒUD du graphe CM2B.
 *
 * Ex: le serveur "SRV-DC-01" est un Element de classe "Serveur Windows"
 */
@Entity('element')
export class Element {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * Libellé principal affiché sur le canvas.
   * Toujours présent, indépendamment des attributs de classe.
   */
  @Column({ type: 'text' })
  label: string;

  /** Classe de cet élément */
  @ManyToOne(() => ElementClass, (cls) => cls.elements, { nullable: false })
  @JoinColumn({ name: 'elementClassId' })
  elementClass: ElementClass;

  @Column({ type: 'text' })
  elementClassId: string;

  /**
   * Position X sur le canvas (persistée pour retrouver le layout).
   */
  @Column({ type: 'real', nullable: true })
  canvasX: number | null;

  @Column({ type: 'real', nullable: true })
  canvasY: number | null;

  /** Métadonnées libres en JSON (ex: données d'import, tags) */
  @Column({ type: 'text', nullable: true })
  metadata: string | null; // JSON.stringify

  /** Valeurs des attributs simples de cet élément */
  @OneToMany(() => AttributeValue, (v) => v.element, { cascade: true })
  attributeValues: AttributeValue[];

  /** Relations dont cet élément est la SOURCE */
  @OneToMany(() => Relation, (r) => r.source)
  outgoingRelations: Relation[];

  /** Relations dont cet élément est la CIBLE */
  @OneToMany(() => Relation, (r) => r.target)
  incomingRelations: Relation[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
