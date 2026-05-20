// src/view/view.controller.ts
import {
  Controller, Get, Post, Put, Patch, Delete, Param, Body, Query,
  ParseUUIDPipe, HttpCode, HttpStatus, UseGuards,
} from '@nestjs/common';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserRole, User } from '../entities/user.entity';
import { ViewService } from './view.service';
import { StructureService } from './structure.service';
import {
  CreateViewDto, UpdateViewDto,
  CreateStructureDto, UpdateStructureDto, ReorderStructuresDto,
  AddMemberDto,
} from './dto/view.dto';

// ══════════════════════════════════════════════════
// STRUCTURES (templates)
// ══════════════════════════════════════════════════

@Controller('structures')
@UseGuards(RolesGuard)
export class StructureController {
  constructor(private readonly svc: StructureService) {}

  @Get()
  findAll() { return this.svc.findAll(); }

  @Get('applicable')
  findApplicable(@Query('classId') classId: string) {
    return this.svc.findApplicable(classId);
  }

  @Patch('order')
  @Roles(UserRole.EDITOR, UserRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  reorder(@Body() dto: ReorderStructuresDto) { return this.svc.reorder(dto.ids); }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) { return this.svc.findOne(id); }

  @Post()
  @Roles(UserRole.ADMIN)
  create(@Body() dto: CreateStructureDto, @CurrentUser() user: User) {
    return this.svc.create(dto, user.id);
  }

  @Put(':id')
  @Roles(UserRole.ADMIN)
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateStructureDto) {
    return this.svc.update(id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseUUIDPipe) id: string) { return this.svc.remove(id); }
}

// ══════════════════════════════════════════════════
// VUES
// ══════════════════════════════════════════════════

@Controller('views')
@UseGuards(RolesGuard)
export class ViewsController {
  constructor(private readonly svc: ViewService) {}

  @Get()
  findAll(@Query('organisationId', ParseUUIDPipe) organisationId: string) {
    return this.svc.findAll(organisationId);
  }

  @Get('for-element/:elementId')
  findForElement(@Param('elementId') elementId: string) {
    return this.svc.findForElement(elementId);
  }

  @Get('structure-tree')
  getStructureTree(
    @Query('organisationId', ParseUUIDPipe) organisationId: string,
    @CurrentUser() user: User,
  ) { return this.svc.getStructureTree(organisationId, user.id); }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) { return this.svc.findOne(id); }

  @Get(':id/members')
  getMembers(@Param('id', ParseUUIDPipe) id: string) { return this.svc.getMembers(id); }

  @Get(':id/search')
  search(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('q') q: string,
  ) { return this.svc.searchCompatibleElements(id, q || ''); }

  @Get(':id/revisions')
  getRevisions(@Param('id', ParseUUIDPipe) id: string) { return this.svc.getRevisions(id); }

  @Post()
  @Roles(UserRole.EDITOR, UserRole.ADMIN)
  create(@Body() dto: CreateViewDto, @CurrentUser() user: User) {
    return this.svc.create(dto, user.id);
  }

  @Put(':id')
  @Roles(UserRole.EDITOR, UserRole.ADMIN)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateViewDto,
    @CurrentUser() user: User,
  ) { return this.svc.update(id, dto, user.id); }

  @Delete(':id')
  @Roles(UserRole.EDITOR, UserRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseUUIDPipe) id: string) { return this.svc.remove(id); }

  @Post(':id/members')
  @Roles(UserRole.EDITOR, UserRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  addMember(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddMemberDto,
    @CurrentUser() user: User,
  ) { return this.svc.addMember(id, dto.elementId, user.id); }

  @Patch(':id/elements/:elementId/position')
  @Roles(UserRole.EDITOR, UserRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  moveInView(
    @Param('id', ParseUUIDPipe) viewId: string,
    @Param('elementId', ParseUUIDPipe) elementId: string,
    @Body() dto: { canvasX: number; canvasY: number },
  ) { return this.svc.moveInView(viewId, elementId, dto.canvasX, dto.canvasY); }

  @Delete(':id/members/:elementId')
  @Roles(UserRole.EDITOR, UserRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  removeMember(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('elementId', ParseUUIDPipe) elementId: string,
    @CurrentUser() user: User,
  ) { return this.svc.removeMember(id, elementId, user.id); }
}
