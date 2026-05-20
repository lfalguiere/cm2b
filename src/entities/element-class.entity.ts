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
import { ElementType } from './element-type.entity';
import { AttributeDefinition } from './attribute-definition.entity';
import { Element } from './element.entity';

/**
 * Classe d'élément, avec héritage via parentClass.
 * Ex: Machine → Machine Physique → Serveur → Serveur Windows
 *
 * Les attributs de la classe enfant héritent de ceux du parent
 * (résolu au niveau applicatif en remontant la chaîne parentClass).
 */
@Entity('element_class')
export class ElementClass {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'text' })
  name: string; // ex: "Serveur Windows"

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'text', nullable: true })
  color: string; // surcharge couleur du type si besoin

  @Column({ type: 'text', nullable: true })
  icon: string;

  /** Type auquel appartient cette classe */
  @ManyToOne(() => ElementType, (type) => type.classes, { nullable: false })
  @JoinColumn({ name: 'typeId' })
  type: ElementType;

  @Column({ type: 'text' })
  typeId: string;

  /**
   * Classe parente pour l'héritage.
   * null = classe racine pour ce type.
   */
  @ManyToOne(() => ElementClass, (cls) => cls.children, { nullable: true })
  @JoinColumn({ name: 'parentClassId' })
  parentClass: ElementClass | null;

  @Column({ type: 'text', nullable: true })
  parentClassId: string | null;

  @OneToMany(() => ElementClass, (cls) => cls.parentClass)
  children: ElementClass[];

  /** Attributs propres à cette classe (sans héritage) */
  @OneToMany(() => AttributeDefinition, (attr) => attr.elementClass)
  attributeDefinitions: AttributeDefinition[];

  /** Instances de cette classe */
  @OneToMany(() => Element, (el) => el.elementClass)
  elements: Element[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
