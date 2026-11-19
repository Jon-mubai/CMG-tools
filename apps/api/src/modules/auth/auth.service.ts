/**
 * Author: zcl (MuBai)
 * Date: 2026-10-14
 * Role: Full-Stack Developer
 */
import { Injectable, UnauthorizedException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService,
    private audit: AuditService,
  ) {}

  private remainRatio(u: { paid: boolean; validFrom: Date | null; validUntil: Date | null }) {
    if (!u.paid) return 0;
    if (!u.validUntil) return 1;
    const until = new Date(u.validUntil).getTime();
    const now = Date.now();
    if (now > until) return 0;
    const from = u.validFrom ? new Date(u.validFrom).getTime() : until - 30 * 86400000;
    return Math.max(0, Math.min(1, (until - now) / Math.max(1, until - from)));
  }

  async login(username: string, password: string) {
    const user = await this.prisma.user.findFirst({
      where: { username, deletedAt: null },
    });
    if (!user || !user.enabled) throw new UnauthorizedException('账号或密码错误');
    if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
      throw new UnauthorizedException('账号已临时锁定');
    }
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      const fails = user.failCount + 1;
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          failCount: fails,
          lockedUntil: fails >= 5 ? new Date(Date.now() + 5 * 60 * 1000) : null,
        },
      });
      throw new UnauthorizedException('账号或密码错误');
    }
    const privileged = user.role === 'super_admin' || user.role === 'admin';
    if (!privileged) {
      if (!user.paid) throw new ForbiddenException('账号尚未付费开通，请联系管理员');
      if (user.validUntil) {
        const end = new Date(user.validUntil);
        end.setHours(23, 59, 59, 999);
        if (Date.now() > end.getTime()) throw new ForbiddenException('订阅已过期');
      }
    }
    await this.prisma.user.update({
      where: { id: user.id },
      data: { failCount: 0, lockedUntil: null },
    });
    const sessionId = randomBytes(16).toString('hex');
    const payload = {
      sub: user.id,
      username: user.username,
      role: user.role,
      sid: sessionId,
    };
    const accessToken = await this.jwt.signAsync(payload, {
      secret: this.config.get('JWT_ACCESS_SECRET') || 'dev',
      expiresIn: this.config.get('JWT_ACCESS_EXPIRES') || '12h',
    });
    const refreshToken = await this.jwt.signAsync(
      { ...payload, typ: 'refresh' },
      {
        secret: this.config.get('JWT_REFRESH_SECRET') || 'dev-r',
        expiresIn: '7d',
      },
    );
    await this.prisma.session.create({
      data: {
        userId: user.id,
        tokenHash: createHash('sha256').update(refreshToken).digest('hex'),
        expiresAt: new Date(Date.now() + 7 * 86400000),
      },
    });
    await this.audit.log({ actorUserId: user.id, action: 'login.success' });
    const ratio = this.remainRatio(user);
    return {
      accessToken,
      refreshToken,
      sessionId,
      mustChangePwd: user.mustChangePwd,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        features: privileged ? ['*'] : user.features,
        subscription: {
          paid: user.paid,
          plan: user.plan,
          validFrom: user.validFrom,
          validUntil: user.validUntil,
          remainRatio: ratio,
          needRenewalPrompt: !privileged && ratio > 0 && ratio < 1 / 3,
        },
      },
    };
  }

  async changePassword(userId: string, oldPassword: string, newPassword: string) {
    const p = String(newPassword || '');
    if (p.length < 8 || p.length > 12 || !/^[\x20-\x7E]+$/.test(p) || !/[A-Za-z]/.test(p) || !/[0-9]/.test(p)) {
      throw new BadRequestException('密码须为 8–12 位且同时包含字母和数字，可含 . * # 等符号，不能使用中文');
    }
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('用户不存在或会话已失效');
    /* 强制改密（mustChangePwd）时可不校验原密码；主动改密必须校验 */
    if (!user.mustChangePwd) {
      if (!oldPassword || !(await bcrypt.compare(oldPassword, user.passwordHash))) {
        throw new UnauthorizedException('原密码不正确');
      }
    }
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: await bcrypt.hash(newPassword, 12), mustChangePwd: false },
    });
    await this.destroyBootstrapIfNeeded(userId);
    return { ok: true };
  }

  async ensureBootstrapAdmin() {
    const superN = await this.prisma.user.count({ where: { role: 'super_admin', deletedAt: null } });
    if (superN > 0) return;
    /* 存量：将最早的 admin 提升为超级管理员 */
    const legacy = await this.prisma.user.findFirst({
      where: { role: 'admin', deletedAt: null },
      orderBy: { createdAt: 'asc' },
    });
    if (legacy) {
      await this.prisma.user.update({ where: { id: legacy.id }, data: { role: 'super_admin' } });
      console.log(`[SECURITY] 已将账号 ${legacy.username} 提升为超级管理员`);
      return;
    }
    const pwd = this.config.get('BOOTSTRAP_ADMIN_PASSWORD') || 'ChangeMe123!';
    await this.prisma.user.create({
      data: {
        username: 'admin',
        passwordHash: await bcrypt.hash(pwd, 12),
        role: 'super_admin',
        paid: true,
        mustChangePwd: true,
        isBootstrap: true,
        features: [],
      },
    });
    console.log(`[SECURITY] 已创建示例超级管理员 admin / ${pwd}（首次改密后示例凭据失效）`);
  }

  /** 首次改密后销毁示例引导身份 */
  async destroyBootstrapIfNeeded(userId: string) {
    const u = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!u || !(u as any).isBootstrap) return;
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        isBootstrap: false,
        bootstrapDestroyed: true,
        mustChangePwd: false,
      } as any,
    });
    await this.audit.log({ actorUserId: userId, action: 'bootstrap.destroyed' });
  }
}
