/**
 * Author: zcl (MuBai)
 * Date: 2026-10-14
 * Role: Full-Stack Developer
 */
import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserService } from './user.service';

@ApiTags('user')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class UserController {
  constructor(private users: UserService) {}

  @Get('me') me(@CurrentUser() u: { id: string }) { return this.users.me(u.id); }

  /** 仅超级管理员可访问账号/权限管理接口 */
  @Get('admin/features')
  @UseGuards(RolesGuard) @Roles('super_admin')
  features() { return this.users.features(); }

  @Get('admin/users')
  @UseGuards(RolesGuard) @Roles('super_admin')
  list(@CurrentUser() u: { role: string }) { return this.users.list(u.role); }

  @Post('admin/users')
  @UseGuards(RolesGuard) @Roles('super_admin')
  create(@CurrentUser() u: { id: string; role: string }, @Body() body: any) {
    return this.users.create(u.id, u.role, body);
  }

  @Patch('admin/users/:id')
  @UseGuards(RolesGuard) @Roles('super_admin')
  update(@CurrentUser() u: { id: string; role: string }, @Param('id') id: string, @Body() body: any) {
    return this.users.update(u.id, u.role, id, body);
  }

  @Post('admin/users/:id/reset-password')
  @UseGuards(RolesGuard) @Roles('super_admin')
  reset(@CurrentUser() u: { id: string; role: string }, @Param('id') id: string, @Body() body: any) {
    return this.users.resetPassword(u.id, u.role, id, body?.newPassword);
  }

  @Delete('admin/users/:id')
  @UseGuards(RolesGuard) @Roles('super_admin')
  disable(@CurrentUser() u: { id: string; role: string }, @Param('id') id: string) {
    return this.users.disable(u.id, u.role, id);
  }
}
