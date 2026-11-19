/**
 * Author: zcl (MuBai)
 * Date: 2026-10-14
 * Role: Full-Stack Developer
 */
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Prisma Decimal 兼容写入：部分环境 Prisma.Decimal 未挂到 namespace，
 * 直接传 number/string 即可写入 @db.Decimal 字段。
 */
function toDecimal(v: unknown): any {
  if (v == null || v === '') return null;
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isFinite(n)) return 0;
  /* 保留两位，避免浮点噪声 */
  return Math.round(n * 100) / 100;
}

@Injectable()
export class FinanceService {
  constructor(private prisma: PrismaService) {}

  /** Prisma 模型 AppKv；generate 后可用。运行时用 any 避免未 generate 时 TS2339 */
  private kv(client: any = this.prisma) {
    if (!client?.appKv) {
      throw new Error('Prisma client 缺少 appKv，请执行: npx prisma generate && npx prisma db push');
    }
    return client.appKv;
  }

  /** 聚合台账：与前端 FinanceModule load/save 结构对齐 */
  async getLedger() {
    const [reserveRow, records, sourcesKv, periodsKv, reimbursedKv] = await Promise.all([
      this.prisma.financeReserve.findFirst({ orderBy: { updatedAt: 'desc' } }),
      this.prisma.financeRecord.findMany({
        where: { deletedAt: null },
        orderBy: { createdAt: 'desc' },
      }),
      this.kv().findUnique({
        where: { key_scope: { key: 'finance_sources', scope: 'global' } },
      }),
      this.kv().findUnique({
        where: { key_scope: { key: 'finance_reserve_periods', scope: 'global' } },
      }),
      this.kv().findUnique({
        where: { key_scope: { key: 'finance_reimbursed', scope: 'global' } },
      }),
    ]);
    const sources =
      sourcesKv && Array.isArray((sourcesKv.payload as any)?.sources)
        ? (sourcesKv.payload as any).sources
        : [];
    /* periods：列字段 → KV 备份 → 结构化表，三层兜底，避免刷新丢失 */
    let periods: any[] =
      reserveRow && Array.isArray((reserveRow as any).periods)
        ? ((reserveRow as any).periods as any[])
        : [];
    if (!periods.length && periodsKv && Array.isArray((periodsKv.payload as any)?.periods)) {
      periods = (periodsKv.payload as any).periods;
    }
    if (!periods.length) {
      try {
        const rows = await (this.prisma as any).financeReservePeriod?.findMany?.({
          where: { deletedAt: null },
          orderBy: { startDate: 'asc' },
        });
        if (Array.isArray(rows) && rows.length) {
          periods = rows.map((r: any) => ({
            id: r.id,
            amount: r.amount != null ? Number(r.amount) : 0,
            start: r.startDate ? String(r.startDate).slice(0, 10) : '',
            end: r.endDate ? String(r.endDate).slice(0, 10) : '',
          }));
        }
      } catch (_) {}
    }
    const sourcesFromReserve =
      reserveRow && Array.isArray((reserveRow as any).sources)
        ? ((reserveRow as any).sources as any[])
        : [];
    const sourcesMerged = sources.length ? sources : sourcesFromReserve;
    const reimbursedMap =
      reimbursedKv && (reimbursedKv.payload as any)?.flags && typeof (reimbursedKv.payload as any).flags === 'object'
        ? (reimbursedKv.payload as any).flags
        : {};
    return {
      reserve: reserveRow ? Number(reserveRow.totalAmount) : 0,
      reservePeriods: periods,
      records: records.map((r) => {
        const row = this.toFrontRecord(r);
        if (reimbursedMap[row.id] != null) row.reimbursed = !!reimbursedMap[row.id];
        return row;
      }),
      sources: sourcesMerged,
      updatedAt: reserveRow?.updatedAt || null,
    };
  }

  async putLedger(userId: string, body: any) {
    const reserve = Number(body?.reserve) || 0;
    const records = Array.isArray(body?.records) ? body.records : [];
    const sources = Array.isArray(body?.sources) ? body.sources : [];
    const reservePeriods = Array.isArray(body?.reservePeriods) ? body.reservePeriods : [];

    await this.prisma.$transaction(async (tx) => {
      const existing = await tx.financeReserve.findFirst();
      const reserveData: any = {
        totalAmount: toDecimal(reserve),
        sources: sources as any,
        updatedBy: userId,
      };
      /* periods 列存在时写入；失败则仅依赖 KV 备份 */
      try {
        reserveData.periods = reservePeriods as any;
      } catch (_) {}
      try {
        if (existing) {
          await tx.financeReserve.update({
            where: { id: existing.id },
            data: reserveData,
          });
        } else {
          await tx.financeReserve.create({
            data: reserveData,
          });
        }
      } catch (eCol) {
        /* 去掉 periods 再试一次（旧库无该列） */
        delete reserveData.periods;
        if (existing) {
          await tx.financeReserve.update({
            where: { id: existing.id },
            data: reserveData,
          });
        } else {
          await tx.financeReserve.create({
            data: reserveData,
          });
        }
      }

      await this.kv(tx).upsert({
        where: { key_scope: { key: 'finance_sources', scope: 'global' } },
        create: {
          key: 'finance_sources',
          scope: 'global',
          payload: { sources },
          updatedBy: userId,
        },
        update: { payload: { sources }, updatedBy: userId },
      });

      /* 额度周期 KV 备份（与 periods 列双写，防止列未 migrate 时刷新丢失） */
      await this.kv(tx).upsert({
        where: { key_scope: { key: 'finance_reserve_periods', scope: 'global' } },
        create: {
          key: 'finance_reserve_periods',
          scope: 'global',
          payload: { periods: reservePeriods },
          updatedBy: userId,
        },
        update: { payload: { periods: reservePeriods }, updatedBy: userId },
      });

      /* 结构化双写：额度周期 */
      try {
        const periodIds = new Set<string>();
        for (const p of reservePeriods) {
          if (!p || !p.id) continue;
          const pid = String(p.id);
          periodIds.add(pid);
          const start = p.start ? new Date(String(p.start)) : new Date();
          const end = p.end ? new Date(String(p.end)) : start;
          const pdata: any = {
            amount: toDecimal(Number(p.amount) || 0),
            startDate: start,
            endDate: end,
            locked: true,
            deletedAt: null,
          };
          await (tx as any).financeReservePeriod.upsert({
            where: { id: pid },
            create: { id: pid, ...pdata },
            update: pdata,
          });
        }
        if ((tx as any).financeReservePeriod) {
          const allP = await (tx as any).financeReservePeriod.findMany({ select: { id: true, deletedAt: true } });
          for (const row of allP) {
            if (!periodIds.has(row.id) && !row.deletedAt) {
              await (tx as any).financeReservePeriod.update({
                where: { id: row.id },
                data: { deletedAt: new Date() },
              });
            }
          }
        }
      } catch (ePeriod) {
        /* 表未 migrate 时不阻断主流程 */
      }

      /* 结构化双写：来源 */
      try {
        const srcIds = new Set<string>();
        for (const s of sources) {
          if (!s || !s.id) continue;
          const sid = String(s.id);
          srcIds.add(sid);
          const sdata: any = {
            serial: s.serial ? String(s.serial) : sid,
            name: String(s.name || ''),
            amount: toDecimal(Number(s.amount) || 0),
            payer: s.payer ? String(s.payer) : null,
            payee: s.payee ? String(s.payee) : null,
            boundAt: s.boundAt ? new Date(String(s.boundAt)) : null,
            periodId: s.periodId ? String(s.periodId) : null,
            images: (s.images || []) as any,
            deletedAt: null,
          };
          await (tx as any).financeSource.upsert({
            where: { id: sid },
            create: { id: sid, ...sdata },
            update: sdata,
          });
        }
        if ((tx as any).financeSource) {
          const allS = await (tx as any).financeSource.findMany({ select: { id: true, deletedAt: true } });
          for (const row of allS) {
            if (!srcIds.has(row.id) && !row.deletedAt) {
              await (tx as any).financeSource.update({
                where: { id: row.id },
                data: { deletedAt: new Date() },
              });
            }
          }
        }
      } catch (eSrc) {
        /* 表未 migrate 时不阻断主流程 */
      }


      /* 全量同步 records：按 id upsert，库中多余且不在提交列表中的软删 */
      const keepIds = new Set<string>();
      const reimbursedFlags: Record<string, boolean> = {};
      for (const r of records) {
        if (!r || !r.id) continue;
        keepIds.add(String(r.id));
        reimbursedFlags[String(r.id)] = !!r.reimbursed;
        const data = this.fromFrontRecord(r, userId);
        try {
          await tx.financeRecord.upsert({
            where: { id: String(r.id) },
            create: { id: String(r.id), ...data },
            update: data,
          });
        } catch (eRec) {
          /* 库未加 reimbursed 列时去掉该字段再写，避免整单回滚丢数据 */
          const { reimbursed: _drop, ...rest } = data as any;
          await tx.financeRecord.upsert({
            where: { id: String(r.id) },
            create: { id: String(r.id), ...rest },
            update: rest,
          });
        }
      }
      await this.kv(tx).upsert({
        where: { key_scope: { key: 'finance_reimbursed', scope: 'global' } },
        create: {
          key: 'finance_reimbursed',
          scope: 'global',
          payload: { flags: reimbursedFlags },
          updatedBy: userId,
        },
        update: { payload: { flags: reimbursedFlags }, updatedBy: userId },
      });
      const all = await tx.financeRecord.findMany({ select: { id: true, deletedAt: true } });
      for (const row of all) {
        if (!keepIds.has(row.id) && !row.deletedAt) {
          await tx.financeRecord.update({
            where: { id: row.id },
            data: { deletedAt: new Date(), deletedBy: userId },
          });
        }
      }
    });

    return this.getLedger();
  }

  private toFrontRecord(r: any) {
    return {
      id: r.id,
      item: r.item,
      purpose: r.purpose,
      description: r.description,
      qty: r.qty != null ? Number(r.qty) : 0,
      amount: r.amount != null ? Number(r.amount) : 0,
      dateStart: r.dateStart,
      dateEnd: r.dateEnd,
      userName: r.userName,
      auditor: r.auditor,
      operator: r.operator,
      payType: r.payType,
      receiptType: r.receiptType,
      inboundNo: r.inboundNo,
      remark: r.remark,
      payImages: r.payImages || [],
      invoiceImages: r.invoiceImages || [],
      otherImages: r.otherImages || [],
      reviewStatus: r.reviewStatus || 'pending',
      reviewNeedRevise: !!r.reviewNeedRevise,
      reviewTerminate: !!r.reviewTerminate,
      reviewer: r.reviewer,
      reviewedAt: r.reviewedAt,
      reviewNote: r.reviewNote,
      reviewHidden: !!r.reviewHidden,
      reviewHiddenAt: r.reviewHiddenAt || null,
      reviewHistory: r.reviewHistory || [],
      reimbursed: !!r.reimbursed,
      deleted: !!r.deletedAt,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    };
  }

  private fromFrontRecord(r: any, userId: string) {
    return {
      item: String(r.item || ''),
      purpose: r.purpose || null,
      description: r.description || null,
      qty: r.qty != null ? toDecimal(r.qty) : null,
      amount: toDecimal(Number(r.amount) || 0),
      dateStart: r.dateStart ? new Date(r.dateStart) : null,
      dateEnd: r.dateEnd ? new Date(r.dateEnd) : null,
      userName: r.userName || null,
      auditor: r.auditor || null,
      operator: r.operator || null,
      payType: r.payType || null,
      receiptType: r.receiptType || null,
      inboundNo: r.inboundNo || null,
      remark: r.remark || null,
      reimbursed: !!r.reimbursed,
      payImages: (r.payImages || []) as any,
      invoiceImages: (r.invoiceImages || []) as any,
      otherImages: (r.otherImages || []) as any,
      reviewStatus: r.reviewStatus || 'pending',
      reviewNeedRevise: !!r.reviewNeedRevise,
      reviewTerminate: !!r.reviewTerminate,
      reviewer: r.reviewer || null,
      reviewedAt: r.reviewedAt ? new Date(r.reviewedAt) : null,
      reviewNote: r.reviewNote || null,
      reviewHidden: !!r.reviewHidden,
      reviewHiddenAt: r.reviewHiddenAt ? new Date(r.reviewHiddenAt) : (r.reviewHidden ? new Date() : null),
      reviewHistory: (r.reviewHistory || []) as any,
      deletedAt: r.deleted ? new Date() : null,
      deletedBy: r.deleted ? userId : null,
    };
  }
}
