/**
 * Author: zcl (MuBai)
 * Date: 2026-10-14
 * Role: Full-Stack Developer
 */
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/** Prisma 模型 AppKv → client 属性 appKv（需 npx prisma generate） */
type KvClient = {
  findUnique: (args: any) => Promise<any>;
  upsert: (args: any) => Promise<any>;
  delete: (args: any) => Promise<any>;
  findMany: (args: any) => Promise<any[]>;
};

@Injectable()
export class DataService {
  constructor(private prisma: PrismaService) {}

  private kv(): KvClient {
    const client = (this.prisma as any).appKv as KvClient | undefined;
    if (!client) {
      throw new Error('Prisma client 缺少 appKv，请在 apps/api 执行: npx prisma generate && npx prisma db push');
    }
    return client;
  }

  async get(key: string, scope = 'global') {
    const row = await this.kv().findUnique({
      where: { key_scope: { key, scope } },
    });
    return row ? { key, scope, payload: row.payload, updatedAt: row.updatedAt } : { key, scope, payload: null };
  }

  async put(key: string, payload: any, userId: string, scope = 'global') {
    const row = await this.kv().upsert({
      where: { key_scope: { key, scope } },
      create: { key, scope, payload: payload ?? {}, updatedBy: userId },
      update: { payload: payload ?? {}, updatedBy: userId },
    });
    return { key, scope, payload: row.payload, updatedAt: row.updatedAt };
  }

  async remove(key: string, scope = 'global') {
    try {
      await this.kv().delete({ where: { key_scope: { key, scope } } });
    } catch {
      /* ignore missing */
    }
    return { ok: true };
  }

  async list(prefix?: string, scope = 'global') {
    const rows = await this.kv().findMany({
      where: {
        scope,
        ...(prefix ? { key: { startsWith: prefix } } : {}),
      },
      orderBy: { key: 'asc' },
    });
    return {
      items: rows.map((r) => ({
        key: r.key,
        scope: r.scope,
        payload: r.payload,
        updatedAt: r.updatedAt,
      })),
    };
  }
}
