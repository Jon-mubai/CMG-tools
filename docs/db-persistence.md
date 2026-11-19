# 业务数据入库说明

## 目标

页面「提交 / 保存」写入 **PostgreSQL（`wms`）**，不再以浏览器 `localStorage` 作为业务持久化。

## 前置

1. 配置 `apps/api/.env` 的 `DATABASE_URL` 指向 `wms`
2. 推表并启动 API：

```bash
cd apps/api
npx prisma generate
npx prisma db push
npm run start:dev
```

3. 前端启动后登录页 **勾选「使用服务端登录」**（默认 API 模式为 `http`）
4. 使用引导账号登录并完成强制改密

## 数据落点

| 业务 | 接口 | 表 |
|------|------|----|
| 备用金台账/审批 | `GET/PUT /api/v1/finance/ledger` | `finance_records`、`finance_reserves` |
| 其它模块键值（机台、盘点缓存等） | `GET/PUT /api/v1/data/kv/:key` | `app_kv` |
| 账号 | 认证 / 用户管理 | `users`、`sessions` |

## 注意

- 未启动 API 或未服务端登录时，保存会提示失败，**不会再静默写入 localStorage**
- 仅 UI 偏好（侧栏折叠等）可仍用本地，与业务数据无关
- 改完 Prisma 后需再次 `db push`
