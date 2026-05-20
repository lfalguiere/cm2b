// src/view/view.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Element } from '../entities/element.entity';
import { ElementClass } from '../entities/element-class.entity';
import { Relation } from '../entities/relation.entity';
import { AttributeValue } from '../entities/attribute-value.entity';
import { AttributeDefinition } from '../entities/attribute-definition.entity';
import { DocumentRevision } from '../entities/document-revision.entity';
import { ViewElementPosition } from '../entities/view-element-position.entity';
import { User } from '../entities/user.entity';
import { ViewService } from './view.service';
import { StructureService } from './structure.service';
import { ViewsController, StructureController } from './view.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Element,
      ElementClass,
      Relation,
      AttributeValue,
      AttributeDefinition,
      DocumentRevision,
      ViewElementPosition,
      User,
    ]),
  ],
  providers: [ViewService, StructureService],
  controllers: [ViewsController, StructureController],
  exports: [ViewService, StructureService],
})
export class ViewModule {}
