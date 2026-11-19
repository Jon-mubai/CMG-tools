/**
 * 重置数据库中 admin（或指定用户）的登录密码
 * 用法：
 *   cd apps/api
 *   node scripts/reset-admin-password.mjs mubai123
 *   node scripts/reset-admin-password.mjs mubai123 admin
 */
import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcrypt';
import { PrismaClient } from '@prisma/client';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../.env') });

const password = process.argv[2] || 'mubai123';
const username = process.argv[3] || 'admin';

if (password.length < 6) {
  console.error('密码至少 6 位');
  process.exit(1);
}

const prisma = new PrismaClient();

async function main() {
  const hash = await bcrypt.hash(password, 12);
  let user = await prisma.user.findFirst({ where: { username, deletedAt: null } });
  if (!user) {
    user = await prisma.user.create({
      data: {
        username,
        passwordHash: hash,
        role: 'super_admin',
        paid: true,
        mustChangePwd: false,
        enabled: true,
        features: [],
      },
    });
    console.log(`已创建超级管理员 ${username}，密码：${password}`);
  } else {
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: hash,
        mustChangePwd: false,
        enabled: true,
        failCount: 0,
        lockedUntil: null,
        role: user.role === 'user' ? 'super_admin' : user.role,
      },
    });
    console.log(`已重置 ${username} 密码为：${password}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
