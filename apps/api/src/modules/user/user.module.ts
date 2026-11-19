/**
 * Author: zcl (MuBai)
 * Date: 2026-10-14
 * Role: Full-Stack Developer
 */
import { Module } from '@nestjs/common';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { AuditModule } from '../audit/audit.module';
@Module({ imports: [AuditModule], controllers: [UserController], providers: [UserService] })
export class UserModule {}
