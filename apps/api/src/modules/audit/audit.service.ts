/**
 * Author: zcl (MuBai)
 * Date: 2026-10-14
 * Role: Full-Stack Developer
 */
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AuditService {
  constructor(private prisma: PrismaService) {}
  async log(input: {
    actorUserId?: string | null;
    action: string;
    targetType?: string;
    targetId?: string;
    /** JSON 详情；避免依赖 Prisma.InputJsonValue（部分 client 未导出） */
    detail?: Record<string, unknown> | unknown[] | string | number | boolean | null;
  }) {
    try {
      await this.prisma.auditLog.create({
        data: {
          actorUserId: input.actorUserId ?? null,
          action: input.action,
          targetType: input.targetType,
          targetId: input.targetId,
          detailJson: input.detail as any,
        },
      });
    } catch { /* ignore */ }
  }
}

