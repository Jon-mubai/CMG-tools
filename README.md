# CMG WMS / WMS-Tec

## 架构

| 层 | 技术 | 目录 |
|----|------|------|
| **前端 UI** | 完整经典 SPA（全部业务模块 + 原版 UI/CSS） | `apps/web` |
| **后端 API** | NestJS + Prisma + PostgreSQL | `apps/api` |

旧版 `frontend/` / 裸 Node `backend/` 已移除；**业务页面与样式已从完整备份恢复到 `apps/web`**。

## 启动

### 1. PostgreSQL + NestJS

```bash
cd apps/api
cp .env.example .env   # 配置 DATABASE_URL
npm install
npx prisma generate
npx prisma db push
npm run start:dev      # :3001
```

### 2. 完整前端

```bash
cd apps/web
npm install
npm run dev            # :8080，/api 代理到 3001
```

浏览器打开：http://127.0.0.1:8080

登录可先用前端本地 vault 演示；服务端账户对接 Nest 后走 `/api/v1`。

## 已恢复的前端模块（与历史版本一致）

- 登录门禁（3D Banner、联系管理员）
- 侧栏：工作台 / 数据 / 仓库管理 / 机台数据
- 数据看板、扫码盘点、盘点数据
- 仓库可视化（3D）、库存管理、单据设置
- 机台毛利、运营数据、品类统计
- 账号与权限、帮助、账户菜单

## 说明

- **UI/功能模块**：以 `apps/web` 经典前端为准（全量恢复）。
- **服务端**：以 `apps/api` NestJS 为准；数据权威逐步切到 PostgreSQL。
