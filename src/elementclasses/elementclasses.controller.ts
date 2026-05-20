// src/elementclasses/elementclasses.controller.ts
import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ElementType } from '../entities/element-type.entity';
import { ElementClass } from '../entities/element-class.entity';
import { AttributeDefinition } from '../entities/attribute-definition.entity';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UserRole } from '../entities/user.entity';
import { CreateElementTypeDto, UpdateElementTypeDto } from './dto/element-type.dto';
import { CreateElementClassDto, UpdateElementClassDto } from './dto/element-class.dto';
import {
  CreateAttributeDefinitionDto,
  UpdateAttributeDefinitionDto,
} from './dto/attribute-definition.dto';
import { AttributeDefinitionService } from './attribute-definition.service';

/**
 * Toutes les routes du méta-modèle sont en lecture pour VIEWER
 * mais en écriture réservées à ADMIN uniquement.
 *
 * Convention URL :
 *   /elementclasses/types              → ElementType
 *   /elementclasses/classes            → ElementClass
 *   /elementclasses/classes/:id/attrs  → AttributeDefinition d'une classe
 *   /elementclasses/attrs/:id          → AttributeDefinition par id
 */
@Controller('elementclasses')
@UseGuards(RolesGuard)
export class ElementClassesController {
  constructor(
    @InjectRepository(ElementType)
    private readonly typeRepo: Repository<ElementType>,

    @InjectRepository(ElementClass)
    private readonly classRepo: Repository<ElementClass>,

    private readonly attrDefService: AttributeDefinitionService,
  ) {}

  // ══════════════════════════════════════════════════
  // ELEMENT TYPES
  // ══════════════════════════════════════════════════

  @Get('types')
  getTypes() {
    return this.typeRepo.find({
      relations: ['classes'],
      order: { name: 'ASC' },
    });
  }

  @Get('types/:id')
  getType(@Param('id', ParseUUIDPipe) id: string) {
    return this.typeRepo.findOneOrFail({
      where: { id },
      relations: ['classes'],
    });
  }

  @Post('types')
  @Roles(UserRole.ADMIN)
  createType(@Body() dto: CreateElementTypeDto) {
    return this.typeRepo.save(this.typeRepo.create(dto));
  }

  @Put('types/:id')
  @Roles(UserRole.ADMIN)
  async updateType(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateElementTypeDto,
  ) {
    await this.typeRepo.update(id, dto);
    return this.typeRepo.findOneByOrFail({ id });
  }

  @Delete('types/:id')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteType(@Param('id', ParseUUIDPipe) id: string) {
    return this.typeRepo.delete(id);
  }

  // ══════════════════════════════════════════════════
  // ELEMENT CLASSES
  // ══════════════════════════════════════════════════

  @Get('classes')
  getClasses() {
    return this.classRepo.find({
      relations: ['type', 'parentClass'],
      order: { name: 'ASC' },
    });
  }

  /** Arborescence complète (pour le sélecteur de classe dans le canvas) */
  @Get('classes/tree')
  async getClassTree() {
    const all = await this.classRepo.find({
      relations: ['type', 'parentClass', 'children'],
      order: { name: 'ASC' },
    });
    // Retourne seulement les racines ; children sont imbriqués via TypeORM
    return all.filter((c) => !c.parentClassId);
  }

  @Get('classes/:id')
  getClass(@Param('id', ParseUUIDPipe) id: string) {
    return this.classRepo.findOneOrFail({
      where: { id },
      relations: ['type', 'parentClass', 'children'],
    });
  }

  @Post('classes')
  @Roles(UserRole.ADMIN)
  createClass(@Body() dto: CreateElementClassDto) {
    return this.classRepo.save(this.classRepo.create(dto));
  }

  @Put('classes/:id')
  @Roles(UserRole.ADMIN)
  async updateClass(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateElementClassDto,
  ) {
    await this.classRepo.update(id, dto);
    return this.classRepo.findOneOrFail({
      where: { id },
      relations: ['type', 'parentClass'],
    });
  }

  @Delete('classes/:id')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteClass(@Param('id', ParseUUIDPipe) id: string) {
    return this.classRepo.delete(id);
  }

  // ══════════════════════════════════════════════════
  // ATTRIBUTE DEFINITIONS
  // ══════════════════════════════════════════════════

  /**
   * Attributs propres à une classe (sans héritage)
   * GET /elementclasses/classes/:id/attrs
   */
  @Get('classes/:id/attrs')
  getClassAttrs(@Param('id', ParseUUIDPipe) id: string) {
    return this.attrDefService.findByClass(id);
  }

  /**
   * Attributs effectifs d'une classe, héritage inclus
   * GET /elementclasses/classes/:id/attrs/effective
   */
  @Get('classes/:id/attrs/effective')
  getEffectiveAttrs(@Param('id', ParseUUIDPipe) id: string) {
    return this.attrDefService.findEffectiveByClass(id);
  }

  @Get('attrs/:id')
  getAttr(@Param('id', ParseUUIDPipe) id: string) {
    return this.attrDefService.findOne(id);
  }

  @Post('attrs')
  @Roles(UserRole.ADMIN)
  createAttr(@Body() dto: CreateAttributeDefinitionDto) {
    return this.attrDefService.create(dto);
  }

  @Put('attrs/:id')
  @Roles(UserRole.ADMIN)
  updateAttr(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAttributeDefinitionDto,
  ) {
    return this.attrDefService.update(id, dto);
  }

  @Delete('attrs/:id')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteAttr(@Param('id', ParseUUIDPipe) id: string) {
    return this.attrDefService.remove(id);
  }
}
