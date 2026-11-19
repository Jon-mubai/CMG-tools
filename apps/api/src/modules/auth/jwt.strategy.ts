/**
 * Author: zcl (MuBai)
 * Date: 2026-10-14
 * Role: Full-Stack Developer
 */
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(config: ConfigService, private prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: config.get('JWT_ACCESS_SECRET') || 'dev',
    });
  }
  async validate(payload: { sub: string; sid?: string; role?: string }) {
    if (!payload?.sub) throw new UnauthorizedException('无效令牌');
    const user = await this.prisma.user.findFirst({
      where: { id: payload.sub, deletedAt: null, enabled: true },
    });
    if (!user) throw new UnauthorizedException('会话无效或账号已禁用');
    /* 以数据库角色为准（避免改角色后旧 token 立刻 401；仍校验用户有效） */
    return {
      id: user.id,
      username: user.username,
      role: user.role,
      features: user.features,
      paid: user.paid,
      validUntil: user.validUntil,
      sessionId: payload.sid || null,
    };
  }
}
