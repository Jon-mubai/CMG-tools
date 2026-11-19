/**
 * Author: zcl (MuBai)
 * Date: 2026-10-14
 * Role: Full-Stack Developer
 */
import { config as loadEnv } from 'dotenv';
import { resolve } from 'path';
loadEnv({ path: resolve(process.cwd(), '.env') });

import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { json, urlencoded } from 'express';
import { AppModule } from './app.module';

async function bootstrap() {
  if (!process.env.DATABASE_URL) {
    console.error('[FATAL] 缺少 DATABASE_URL，请复制 apps/api/.env.example 为 .env 并配置 PostgreSQL');
    process.exit(1);
  }
  /* 关闭默认 bodyParser，自定义更大上限（备用金图片 base64 易超 100kb 默认限制） */
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  const config = app.get(ConfigService);
  const bodyLimit = config.get('BODY_LIMIT') || '200mb';
  app.use(json({ limit: bodyLimit }));
  app.use(urlencoded({ extended: true, limit: bodyLimit }));
  app.use(helmet({ contentSecurityPolicy: false }));
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  const origins = String(config.get('CORS_ORIGINS') || 'http://localhost:5173')
    .split(',').map((s) => s.trim()).filter(Boolean);
  app.enableCors({ origin: origins, credentials: true });
  const swagger = new DocumentBuilder()
    .setTitle('CMG WMS API').setVersion('3.0').addBearerAuth().build();
  SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, swagger));
  const port = Number(config.get('PORT') || 3001);
  await app.listen(port);
  console.log(`[cmg-api] http://127.0.0.1:${port}/api/v1  docs:/api/docs  bodyLimit=${bodyLimit}`);
}
bootstrap();
