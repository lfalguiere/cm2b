import { Entity, PrimaryColumn, Column } from 'typeorm';

/** Position d'un élément dans une vue spécifique (layout par vue). */
@Entity('view_element_position')
export class ViewElementPosition {
  @PrimaryColumn({ type: 'text' })
  viewId: string;

  @PrimaryColumn({ type: 'text' })
  elementId: string;

  @Column({ type: 'real' })
  canvasX: number;

  @Column({ type: 'real' })
  canvasY: number;
}
