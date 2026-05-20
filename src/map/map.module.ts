// src/map/map.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Element } from '../entities/element.entity';
import { ElementClass } from '../entities/element-class.entity';
import { AttributeValue } from '../entities/attribute-value.entity';
import { AttributeDefinition } from '../entities/attribute-definition.entity';
import { Relation } from '../entities/relation.entity';
import { MapService } from './map.service';
import { RelationService } from './relation.service';
import { MapController, RelationController, GraphController } from './map.controller';
import { ElementClassesModule } from '../elementclasses/elementclasses.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Element,
      ElementClass,
      AttributeValue,
      AttributeDefinition,
      Relation,
    ]),
    ElementClassesModule, // pour AttributeDefinitionService (héritage)
  ],
  providers: [MapService, RelationService],
  controllers: [MapController, RelationController, GraphController],
  exports: [MapService, RelationService],
})
export class MapModule {}
