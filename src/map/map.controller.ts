// src/map/map.controller.ts
import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../entities/user.entity';
import { MapService } from './map.service';
import { RelationService } from './relation.service';
import {
  CreateElementDto,
  UpdateElementDto,
  MoveElementDto,
  CreateRelationDto,
  UpdateRelationDto,
  ElementQueryDto,
} from './dto/element.dto';
import { RelationType } from '../entities/attribute-definition.entity';

// ══════════════════════════════════════════════════
// MAP (éléments cartographiques)
// ══════════════════════════════════════════════════

/**
 * Convention URL :
 *   /map                      → liste + création
 *   /map/:id                  → détail / update / delete
 *   /map/:id/move             → PATCH position canvas (drag & drop)
 *   /map/:id/graph            → élément + ses relations (pour le panneau latéral)
 */
@Controller('map')
@UseGuards(RolesGuard)
export class MapController {
  constructor(private readonly mapService: MapService) {}

  @Get()
  findAll(@Query() query: ElementQueryDto) {
    return this.mapService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.mapService.findOne(id);
  }

  @Get(':id/graph')
  findWithRelations(@Param('id', ParseUUIDPipe) id: string) {
    return this.mapService.findOneWithRelations(id);
  }

  @Post()
  @Roles(UserRole.EDITOR, UserRole.ADMIN)
  create(@Body() dto: CreateElementDto) {
    return this.mapService.create(dto);
  }

  @Put(':id')
  @Roles(UserRole.EDITOR, UserRole.ADMIN)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateElementDto,
  ) {
    return this.mapService.update(id, dto);
  }

  /**
   * PATCH /map/:id/move
   * Uniquement la position canvas — appelé en continu pendant le drag.
   * Payload minimal pour minimiser la bande passante.
   */
  @Patch(':id/move')
  @Roles(UserRole.EDITOR, UserRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  move(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: MoveElementDto,
  ) {
    return this.mapService.move(id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.EDITOR, UserRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.mapService.remove(id);
  }
}

// ══════════════════════════════════════════════════
// RELATIONS
// ══════════════════════════════════════════════════

/**
 * Convention URL :
 *   /relations                     → liste + création
 *   /relations/:id                 → détail / update / delete
 *   /graph                         → vue complète canvas (nodes + edges)
 */
@Controller('relations')
@UseGuards(RolesGuard)
export class RelationController {
  constructor(private readonly relationService: RelationService) {}

  @Get()
  findAll(
    @Query('sourceId') sourceId?: string,
    @Query('targetId') targetId?: string,
    @Query('relationType') relationType?: RelationType,
  ) {
    return this.relationService.findAll({ sourceId, targetId, relationType });
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.relationService.findOne(id);
  }

  @Post()
  @Roles(UserRole.EDITOR, UserRole.ADMIN)
  create(@Body() dto: CreateRelationDto) {
    return this.relationService.create(dto);
  }

  @Put(':id')
  @Roles(UserRole.EDITOR, UserRole.ADMIN)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRelationDto,
  ) {
    return this.relationService.update(id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.EDITOR, UserRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.relationService.remove(id);
  }
}

// ══════════════════════════════════════════════════
// VUE GRAPHE (canvas Angular)
// ══════════════════════════════════════════════════

@Controller('graph')
@UseGuards(RolesGuard)
export class GraphController {
  constructor(private readonly relationService: RelationService) {}

  /**
   * GET /graph?typeIds=uuid1,uuid2&classIds=uuid3
   * Retourne { nodes: Element[], edges: Relation[] }
   * pour initialiser le canvas Angular/Canvas.
   */
  @Get()
  getGraph(
    @Query('typeIds') typeIds?: string,
    @Query('classIds') classIds?: string,
  ) {
    return this.relationService.getGraphView({
      typeIds: typeIds?.split(',').filter(Boolean),
      classIds: classIds?.split(',').filter(Boolean),
    });
  }
}
