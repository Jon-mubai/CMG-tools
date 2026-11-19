/**
 * Author: zcl (MuBai)
 * Date: 2026-10-14
 * Role: Full-Stack Developer
 */
import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit() {
    const url = process.env.DATABASE_URL || '';
    if (!url) {
      this.logger.error('缺少 DATABASE_URL。请在 apps/api 下复制 .env.example 为 .env 并填写 PostgreSQL 连接串');
      throw new Error('DATABASE_URL is not set');
    }
    try {
      /* 仅打印脱敏后的主机信息，不打印密码 */
      const safe = url.replace(/:\/\/([^:]+):([^@]+)@/, '://$1:***@');
      this.logger.log(`Connecting: ${safe}`);
      await this.$connect();
      this.logger.log('Database connected');
    } catch (e: any) {
      this.logger.error(
        '数据库连接失败。请检查：1) PostgreSQL 已启动 2) apps/api/.env 中 DATABASE_URL 用户名/密码/库名正确 3) 可执行 npx prisma db push',
      );
      this.logger.error(e?.message || e);
      throw e;
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
