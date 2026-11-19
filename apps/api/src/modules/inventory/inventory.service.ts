/**
 * Author: zcl (MuBai)
 * Date: 2026-10-14
 * Role: Full-Stack Developer
 */
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/** 与前端 CMGShared.STORAGE_KEYS.INVENTORY 一致 */
const ITEMS_KV_KEY = 'inventory_check_v1';

@Injectable()
export class InventoryService {
  constructor(private prisma: PrismaService) {}

  private kv() {
    return this.prisma.appKv;
  }

  /** 盘点导入商品：读写 AppKv，兼容大批量导入 */
  async listItems(q?: string, page = 1, pageSize = 200) {
    const row = await this.kv().findUnique({
      where: { key_scope: { key: ITEMS_KV_KEY, scope: 'global' } },
    });
    let items: any[] = [];
    const payload = row?.payload as any;
    if (Array.isArray(payload)) items = payload;
    else if (payload && Array.isArray(payload.items)) items = payload.items;

    if (q && String(q).trim()) {
      const kw = String(q).trim().toLowerCase();
      items = items.filter((it) => {
        const blob = [
          it.code, it.sku, it.skuCode, it.name, it.skuName, it.warehouse, it.category,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return blob.includes(kw);
      });
    }

    const take = Math.min(50000, Math.max(1, pageSize || 200));
    const p = Math.max(1, page || 1);
    const total = items.length;
    const slice = items.slice((p - 1) * take, p * take);
    return { total, page: p, pageSize: take, items: slice };
  }

  async bulkItems(userId: string, items: any[]) {
    const list = Array.isArray(items) ? items : [];
    await this.kv().upsert({
      where: { key_scope: { key: ITEMS_KV_KEY, scope: 'global' } },
      create: {
        key: ITEMS_KV_KEY,
        scope: 'global',
        payload: list as any,
        updatedBy: userId,
      },
      update: {
        payload: list as any,
        updatedBy: userId,
      },
    });
    return { ok: true, count: list.length };
  }

  async list(page = 1, pageSize = 20) {
    const take = Math.min(100, pageSize);
    const skip = (Math.max(1, page) - 1) * take;
    const [total, rows] = await Promise.all([
      this.prisma.inventoryDoc.count(),
      this.prisma.inventoryDoc.findMany({
        orderBy: { createdAt: 'desc' },
        skip,
        take,
        include: { _count: { select: { lines: true } } },
      }),
    ]);
    return {
      total,
      page,
      pageSize: take,
      items: rows.map((d) => ({
        id: d.id,
        docNo: d.docNo,
        supplier: d.supplier,
        periodStart: d.periodStart,
        periodEnd: d.periodEnd,
        lineCount: d._count.lines,
        createdAt: d.createdAt,
      })),
    };
  }

  async get(id: string) {
    const d = await this.prisma.inventoryDoc.findUnique({
      where: { id },
      include: { lines: true },
    });
    if (!d) throw new NotFoundException();
    return d;
  }

  async create(userId: string, body: any) {
    return this.prisma.inventoryDoc.create({
      data: {
        docNo: body.docNo,
        supplier: body.supplier,
        periodStart: body.periodStart ? new Date(body.periodStart) : null,
        periodEnd: body.periodEnd ? new Date(body.periodEnd) : null,
        createdBy: userId,
        lines: body.lines?.length
          ? {
              create: body.lines.map((l: any) => ({
                skuCode: l.skuCode,
                skuName: l.skuName,
                qty: l.qty,
                amount: l.amount,
              })),
            }
          : undefined,
      },
      include: { lines: true },
    });
  }

  async remove(id: string) {
    await this.prisma.inventoryDoc.delete({ where: { id } });
    return { ok: true };
  }
}
