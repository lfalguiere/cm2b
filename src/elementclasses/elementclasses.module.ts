// src/elementclasses/elementclasses.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ElementType } from '../entities/element-type.entity';
import { ElementClass } from '../entities/element-class.entity';
import { AttributeDefinition } from '../entities/attribute-definition.entity';
import { AttributeDefinitionService } from './attribute-definition.service';
import { ElementClassesController } from './elementclasses.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([ElementType, ElementClass, AttributeDefinition]),
  ],
  providers: [AttributeDefinitionService],
  controllers: [ElementClassesController],
  exports: [AttributeDefinitionService],
})
export class ElementClassesModule {}
