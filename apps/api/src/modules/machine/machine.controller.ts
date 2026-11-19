/**
 * Author: zcl (MuBai)
 * Date: 2026-10-14
 * Role: Full-Stack Developer
 */
import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { MachineService } from './machine.service';

@ApiTags('machine')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('machine')
export class MachineController {
  constructor(private machine: MachineService) {}
  @Get('profit/weekly')
  weekly(@Query('from') from?: string, @Query('to') to?: string) {
    return this.machine.listWeekly(from, to);
  }
  @Post('import')
  import(@Body() body: any) { return this.machine.importRows(body); }

  @Get('ops/:kind')
  listOps(@Param('kind') kind: string) {
    return this.machine.listOps(kind);
  }

  @Put('ops/:kind')
  saveOps(@Param('kind') kind: string, @Body() body: any) {
    return this.machine.saveOps(kind, body);
  }

  @Delete('ops/:kind')
  clearOps(@Param('kind') kind: string) {
    return this.machine.clearOps(kind);
  }
}
