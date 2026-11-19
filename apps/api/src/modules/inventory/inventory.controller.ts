/**
 * Author: zcl (MuBai)
 * Date: 2026-10-14
 * Role: Full-Stack Developer
 */
import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { InventoryService } from './inventory.service';

@ApiTags('inventory')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('inventory')
export class InventoryController {
  constructor(private inv: InventoryService) {}

  /** 盘点导入商品列表（与前端 CMGInventory 对齐） */
  @Get('items')
  listItems(
    @Query('q') q?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.inv.listItems(q, Number(page) || 1, Number(pageSize) || 200);
  }

  /** 批量覆盖写入导入商品（盘点同步） */
  @Post('items/bulk')
  bulkItems(@CurrentUser() u: { id: string }, @Body() body: { items?: any[] }) {
    return this.inv.bulkItems(u.id, Array.isArray(body?.items) ? body.items : []);
  }

  @Get('docs')
  list(@Query('page') p?: string, @Query('pageSize') s?: string) {
    return this.inv.list(Number(p) || 1, Number(s) || 20);
  }
  @Get('docs/:id')
  get(@Param('id') id: string) {
    return this.inv.get(id);
  }
  @Post('docs')
  create(@CurrentUser() u: { id: string }, @Body() body: any) {
    return this.inv.create(u.id, body);
  }
  @Delete('docs/:id')
  remove(@Param('id') id: string) {
    return this.inv.remove(id);
  }
}
