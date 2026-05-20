import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { ElementClass } from './element-class.entity';

/**
 * Les 4 grands types d'éléments de l'organisation.
 * Ex: "organisationnel", "actifs humains", "actifs techniques", "actifs physiques"
 */
@Entity('element_type')
export class ElementType {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'text', unique: true })
  name: string; // ex: "organisationnel"

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'text', nullable: true })
  color: string; // couleur d'affichage sur le canvas (hex)

  @Column({ type: 'text', nullable: true })
  icon: string; // nom d'icône (ex: "building", "user", "server")

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => ElementClass, (cls) => cls.type)
  classes: ElementClass[];
}
