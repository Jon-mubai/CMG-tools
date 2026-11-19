/**
 * Author: zcl (MuBai)
 * Date: 2026-10-14
 * Role: Full-Stack Developer
 */
import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { FinanceService } from './finance.service';

@ApiTags('finance')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('finance')
export class FinanceController {
  constructor(private finance: FinanceService) {}

  @Get('ledger')
  getLedger() {
    return this.finance.getLedger();
  }

  @Put('ledger')
  putLedger(@CurrentUser() u: { id: string }, @Body() body: any) {
    return this.finance.putLedger(u.id, body);
  }
}
