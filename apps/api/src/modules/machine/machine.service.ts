/**
 * Author: zcl (MuBai)
 * Date: 2026-10-14
 * Role: Full-Stack Developer
 */
import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class MachineService {
  constructor(private prisma: PrismaService) {}

  listWeekly(from?: string, to?: string) {
    const where: any = {};
    if (from) where.periodStart = { gte: new Date(from) };
    if (to) where.periodEnd = { lte: new Date(to) };
    return this.prisma.machineProfitWeekly.findMany({
      where, orderBy: { periodStart: 'desc' }, take: 5000,
    });
  }

  async importRows(body: {
    periodStart: string; periodEnd: string;
    rows?: Array<{ machineCode?: string; machineName?: string; coinRevenue?: number; giftCost?: number }>;
  }) {
    if (!body.periodStart || !body.periodEnd) throw new BadRequestException('账期必填');
    const periodStart = new Date(body.periodStart);
    const periodEnd = new Date(body.periodEnd);
    const rows = body.rows || [];
    if (!rows.length) return { ok: true, count: 0 };
    await this.prisma.machineProfitWeekly.createMany({
      data: rows.map((r) => {
        const coin = r.coinRevenue ?? 0;
        const gift = r.giftCost ?? 0;
        const profit = coin - gift;
        return {
          periodStart, periodEnd,
          machineCode: r.machineCode, machineName: r.machineName,
          coinRevenue: coin, giftCost: gift, grossProfit: profit,
          grossMargin: coin > 0 ? profit / coin : 0,
        };
      }),
    });
    return { ok: true, count: rows.length };
  }

  private assertKind(kind: string) {
    if (kind !== 'transfer' && kind !== 'change') throw new BadRequestException('类型无效');
    return kind;
  }

  async listOps(kind: string) {
    this.assertKind(kind);
    const rows = await this.prisma.machineOpsRow.findMany({
      where: { kind },
      orderBy: { id: 'asc' },
    });
    return { kind, count: rows.length, rows: rows.map((r) => this.toClient(r)) };
  }

  async saveOps(kind: string, body: { rows?: any[]; replace?: boolean }) {
    this.assertKind(kind);
    const rows = Array.isArray(body?.rows) ? body.rows : [];
    const replace = body?.replace !== false;
    if (replace) await this.prisma.machineOpsRow.deleteMany({ where: { kind } });
    const data = rows.map((r) => this.fromClient(kind, r));
    const size = 2000;
    for (let i = 0; i < data.length; i += size) {
      await this.prisma.machineOpsRow.createMany({ data: data.slice(i, i + size) });
    }
    return { ok: true, kind, count: data.length };
  }

  async clearOps(kind: string) {
    this.assertKind(kind);
    const res = await this.prisma.machineOpsRow.deleteMany({ where: { kind } });
    return { ok: true, kind, count: res.count };
  }

  private fromClient(kind: string, r: any) {
    if (kind === 'transfer') {
      return {
        kind,
        docNo: String(r['单号'] || ''),
        product: String(r['商品'] || ''),
        qty: Number(r['数量']) || 0,
        amount: Number(r['金额']) || 0,
        fromWh: String(r['转出仓库'] || ''),
        toWh: String(r['转入仓库'] || ''),
        period: String(r['账期'] || ''),
        operator: String(r['创建人'] || ''),
        occurredAt: String(r['创建时间'] || ''),
      };
    }
    return {
      kind,
      warehouse: String(r['仓库'] || ''),
      product: String(r['商品名称'] || ''),
      qty: Number(r['变更数量']) || 0,
      amount: Number(r['变更金额']) || 0,
      changeType: String(r['变更类型'] || ''),
      summary: String(r['摘要'] || ''),
      docNo: String(r['单号'] || ''),
      occurredAt: String(r['变更时间'] || ''),
      period: String(r['账期'] || ''),
      operator: String(r['操作人'] || ''),
    };
  }

  private toClient(r: any) {
    if (r.kind === 'transfer') {
      return {
        '单号': r.docNo || '', '商品': r.product || '', '数量': r.qty || 0, '金额': r.amount || 0,
        '转出仓库': r.fromWh || '', '转入仓库': r.toWh || '', '账期': r.period || '',
        '创建人': r.operator || '', '创建时间': r.occurredAt || '',
      };
    }
    return {
      '仓库': r.warehouse || '', '商品名称': r.product || '', '变更数量': r.qty || 0,
      '变更金额': r.amount || 0, '变更类型': r.changeType || '', '摘要': r.summary || '',
      '单号': r.docNo || '', '变更时间': r.occurredAt || '', '账期': r.period || '', '操作人': r.operator || '',
    };
  }
}
