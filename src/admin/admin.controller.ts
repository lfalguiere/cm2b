// src/admin/admin.controller.ts
import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { AdminService } from './admin.service';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UserRole } from '../entities/user.entity';

@Controller('admin')
@UseGuards(RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('export')
  exportData() {
    return this.adminService.exportAll();
  }

  @Post('import')
  importData(@Body() body: any) {
    return this.adminService.importAll(body);
  }
}
