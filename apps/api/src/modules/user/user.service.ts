/**
 * Author: zcl (MuBai)
 * Date: 2026-10-14
 * Role: Full-Stack Developer
 */
import {
  Injectable, NotFoundException, ForbiddenException, ConflictException, BadRequestException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

const FEATURES = [
  'dashboard', 'inventory', 'scan', 'compare', 'stock-import',
  'machine-profit', 'machine-ops', 'machine-category', 'wh-docs', 'help',
  'finance-ledger', 'finance-register', 'finance-source', 'finance-amount',
  'review-pending', 'review-progress', 'review-passed', 'review-rejected', 'review-done',
];

@Injectable()
export class UserService {
  constructor(private prisma: PrismaService, private audit: AuditService) {}

  /** 仅超级管理员可做账号/权限管理 */
  private assertSuperAdmin(role: string) {
    if (role !== 'super_admin') throw new ForbiddenException('仅超级管理员可管理账号与权限');
  }

  private isPrivileged(role: string) {
    return role === 'super_admin' || role === 'admin';
  }

  private pub(u: any) {
    return {
      id: u.id,
      username: u.username,
      displayName: u.displayName,
      role: u.role,
      enabled: u.enabled,
      mustChangePwd: u.mustChangePwd,
      features: this.isPrivileged(u.role) ? ['*'] : u.features,
      plan: u.plan,
      paid: u.paid,
      validFrom: u.validFrom,
      validUntil: u.validUntil,
    };
  }

  async me(id: string) {
    const u = await this.prisma.user.findFirst({ where: { id, deletedAt: null } });
    if (!u) throw new NotFoundException();
    return this.pub(u);
  }

  async list(role: string) {
    this.assertSuperAdmin(role);
    const rows = await this.prisma.user.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((u) => this.pub(u));
  }

  features() { return FEATURES.map((key) => ({ key })); }

  /** 账号：5–8 位，大小写字母或字母+数字，以字母开头，禁止中文 */
  private assertUsername(username: string) {
    const u = String(username || '').trim();
    if (!/^[a-zA-Z][a-zA-Z0-9]{4,7}$/.test(u)) {
      throw new BadRequestException('账号须为 5–8 位，以字母开头，可含大小写字母与数字，不能使用中文');
    }
    return u;
  }

  /** 密码：8–12 位，须含字母与数字，禁止非 ASCII（中文等） */
  private assertPassword(password: string) {
    const p = String(password || '');
    if (p.length < 8 || p.length > 12 || !/^[ -~]+$/.test(p) || !/[A-Za-z]/.test(p) || !/[0-9]/.test(p)) {
      throw new BadRequestException('密码须为 8–12 位且同时包含字母和数字，可含 . * # 等符号，不能使用中文');
    }
    return p;
  }

  async create(actorId: string, role: string, dto: any) {
    this.assertSuperAdmin(role);
    const username = this.assertUsername(dto.username);
    const password = this.assertPassword(dto.password);
    if (await this.prisma.user.findUnique({ where: { username } })) {
      throw new ConflictException('用户名已存在');
    }
    /* 禁止通过接口再创建超级管理员；普通管理员/用户均可由超管创建 */
    let r = dto.role || 'user';
    if (r === 'super_admin') r = 'admin';
    if (r !== 'admin' && r !== 'user') r = 'user';
    const u = await this.prisma.user.create({
      data: {
        username,
        passwordHash: await bcrypt.hash(password, 12),
        role: r,
        enabled: dto.enabled !== false,
        mustChangePwd: true,
        features: this.isPrivileged(r) ? [] : (dto.features || []).filter((k: string) => FEATURES.includes(k)),
        plan: dto.plan || 'month',
        paid: this.isPrivileged(r) ? true : (dto.paid !== false),
        validFrom: dto.validFrom ? new Date(dto.validFrom) : null,
        validUntil: dto.validUntil ? new Date(dto.validUntil) : null,
      },
    });
    await this.audit.log({ actorUserId: actorId, action: 'user.create', targetId: u.id });
    return this.pub(u);
  }

  async update(actorId: string, role: string, id: string, dto: any) {
    this.assertSuperAdmin(role);
    const u = await this.prisma.user.findFirst({ where: { id, deletedAt: null } });
    if (!u) throw new NotFoundException();
    if (u.role === 'super_admin' && (dto.enabled === false || (dto.role && dto.role !== 'super_admin'))) {
      throw new BadRequestException('不能降级或禁用超级管理员');
    }
    if (u.role === 'admin' && (dto.enabled === false || dto.role === 'user')) {
      const c = await this.prisma.user.count({
        where: { role: { in: ['admin', 'super_admin'] }, enabled: true, deletedAt: null },
      });
      if (c <= 1) throw new BadRequestException('不能禁用唯一管理员');
    }
    const data: any = {};
    if (dto.role !== undefined) {
      /* 禁止通过编辑接口指定 super_admin */
      data.role = dto.role === 'super_admin' ? 'admin' : dto.role;
    }
    if (dto.enabled !== undefined) data.enabled = dto.enabled;
    if (dto.features !== undefined) data.features = (dto.features || []).filter((k: string) => FEATURES.includes(k));
    if (dto.plan !== undefined) data.plan = dto.plan;
    if (dto.paid !== undefined) data.paid = dto.paid;
    if (dto.validFrom !== undefined) data.validFrom = dto.validFrom ? new Date(dto.validFrom) : null;
    if (dto.validUntil !== undefined) data.validUntil = dto.validUntil ? new Date(dto.validUntil) : null;
    const updated = await this.prisma.user.update({ where: { id }, data });
    await this.audit.log({ actorUserId: actorId, action: 'user.update', targetId: id });
    return this.pub(updated);
  }

  async resetPassword(actorId: string, role: string, id: string, newPassword?: string) {
    this.assertSuperAdmin(role);
    const plain = newPassword || `Tmp${randomBytes(4).toString('hex')}A1`;
    await this.prisma.user.update({
      where: { id },
      data: {
        passwordHash: await bcrypt.hash(this.assertPassword(plain), 12),
        mustChangePwd: true,
        failCount: 0,
        lockedUntil: null,
      },
    });
    await this.audit.log({ actorUserId: actorId, action: 'user.reset_password', targetId: id });
    return { ok: true, temporaryPassword: newPassword ? undefined : plain };
  }

  async disable(actorId: string, role: string, id: string) {
    this.assertSuperAdmin(role);
    const u = await this.prisma.user.findFirst({ where: { id, deletedAt: null } });
    if (!u) throw new NotFoundException();
    if (u.role === 'super_admin') throw new BadRequestException('不能禁用超级管理员');
    if (u.role === 'admin') {
      const c = await this.prisma.user.count({
        where: { role: { in: ['admin', 'super_admin'] }, enabled: true, deletedAt: null },
      });
      if (c <= 1) throw new BadRequestException('不能禁用唯一管理员');
    }
    /* 删除 = 软删除：写入 deletedAt，列表与登录均不可见 */
    await this.prisma.user.update({
      where: { id },
      data: { enabled: false, deletedAt: new Date() },
    });
    await this.audit.log({ actorUserId: actorId, action: 'user.delete', targetId: id });
    return { ok: true };
  }
}
