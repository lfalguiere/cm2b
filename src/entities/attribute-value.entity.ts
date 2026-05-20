import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Element } from './element.entity';
import { AttributeDefinition } from './attribute-definition.entity';

/**
 * Valeur d'un attribut SIMPLE pour une instance d'Element.
 *
 * Le pattern EAV (Entity–Attribute–Value) est utilisé ici car
 * les attributs sont définis dynamiquement dans AttributeDefinition.
 *
 * La valeur est toujours stockée en texte ; la conversion vers
 * le bon type (number, date, boolean…) est faite côté applicatif
 * en lisant le simpleType de l'AttributeDefinition.
 */
@Entity('attribute_value')
export class AttributeValue {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Element, (el) => el.attributeValues, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'elementId' })
  element: Element;

  @Column({ type: 'text' })
  elementId: string;

  @ManyToOne(() => AttributeDefinition, {
    nullable: false,
    eager: true,
  })
  @JoinColumn({ name: 'attributeDefinitionId' })
  attributeDefinition: AttributeDefinition;

  @Column({ type: 'text' })
  attributeDefinitionId: string;

  /**
   * Valeur sérialisée.
   * - STRING / TEXT / EMAIL / URL / IP → valeur brute
   * - INTEGER / FLOAT → toString()
   * - BOOLEAN → "true" | "false"
   * - DATE / DATETIME → ISO 8601
   */
  @Column({ type: 'text', nullable: true })
  value: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
