/**
 * Author: zcl (MuBai)
 * Date: 2026-10-14
 * Role: Full-Stack Developer
 */
import { Body, Controller, Delete, Get, Param, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { DataService } from './data.service';

@ApiTags('data')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('data')
export class DataController {
  constructor(private data: DataService) {}

  @Get('kv')
  list(@Query('prefix') prefix?: string, @Query('scope') scope?: string) {
    return this.data.list(prefix, scope || 'global');
  }

  @Get('kv/:key')
  get(@Param('key') key: string, @Query('scope') scope?: string) {
    return this.data.get(decodeURIComponent(key), scope || 'global');
  }

  @Put('kv/:key')
  put(
    @Param('key') key: string,
    @Body() body: { payload?: any; scope?: string },
    @CurrentUser() u: { id: string },
  ) {
    return this.data.put(decodeURIComponent(key), body?.payload, u.id, body?.scope || 'global');
  }

  @Delete('kv/:key')
  remove(@Param('key') key: string, @Query('scope') scope?: string) {
    return this.data.remove(decodeURIComponent(key), scope || 'global');
  }
}
