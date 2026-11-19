/**
 * Author: zcl (MuBai)
 * Date: 2026-10-14
 * Role: Full-Stack Developer
 */
import { Module } from '@nestjs/common';
import { AuditService } from './audit.service';
@Module({ providers: [AuditService], exports: [AuditService] })
export class AuditModule {}
