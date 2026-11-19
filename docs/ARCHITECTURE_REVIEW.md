# 前后端架构评审与重构方案

> 评审日期：2026-10-16
> 评审范围：`frontend/` · `backend/` · `shared/` · `deploy/` · `docs/`
> 目标：为接入 PostgreSQL 与前后端重构提供可执行依据

---

## 一、现状体检

### 1.1 代码规模

| 模块 | 文件数 | 最大文件 | 问题 |
|------|--------|----------|------|
| frontend/js | 38 个 JS | **app.js 11186 行** | 拼接产物，全局作用域 |
| frontend/css | 32 个 CSS | 30-pages-auth.css 2359 行 | 手写样式，无预处理器 |
| backend/src | 6 个服务 | server.js 275 行 | 零依赖，if-else 路由 |
| frontend/warehouse-next | 3 个 TSX | ParkScene.tsx 244 行 | **实验分支，未接入主流程** |

### 1.2 关键结论

**做得好的地方（应保留）**

1. `shared/` 用 UMD 模式同时服务浏览器与 Node，权限/常量/DTO 单点定义，是全项目最正确的设计。
2. `docs/openapi.yaml` + `CHANGE_CHECKLIST.md` 已建立接口变更门禁意识。
3. 安全加固（S1–S5）有实际成果：CORS 白名单、随机首启口令、登录限流、feature 级鉴权、HttpOnly Cookie、审计落盘、文件魔数校验。
4. `CMGApi` 门面 + Adapter 双实现，为切换后端预留了唯一入口。

**阻塞级问题**

| # | 问题 | 位置 | 后果 |
|---|------|------|------|
| **P0-1** | 数据真身在浏览器 localStorage | `core/storage.js`、`api/client.js` LocalAdapter | 清缓存即丢数据；多端不共享；无备份 |
| **P0-2** | 后端数据全在内存 Map/数组 | `authService.js` users/sessions、`inventoryService.js` store、`stocktakeService.js` sessions | **进程重启全部丢失**；无法多实例 |
| **P0-3** | local 模式下用户体系可被前端完全伪造 | `core/auth.js` `createUser` 无服务端校验，`loadVault` 直接读浏览器数据 | 任何人在控制台即可给自己造 admin |
| **P1-1** | `app.js` 为 11186 行全局拼接产物 | `scripts/build.js` 按固定顺序 concat | 无模块边界，改一处影响全局；无法 tree-shake |
| **P1-2** | 双入口/双实现并存 | LocalAdapter vs HttpAdapter；`modules/` 已废弃但仍在仓库 | 逻辑双份维护，易分叉 |
| **P1-3** | 无版本控制 | 仓库根目录无 `.git` | **无历史、无回滚、无协作**，这是最高风险项 |
| **P2-1** | 无测试、无 lint、无 CI | 全项目 | 每次重构都是盲改 |
| **P2-2** | 库存过滤逻辑有语义漏洞 | `inventoryService.list` 未标仓数据对范围内用户可见 | 数据越权 |
| **P2-3** | `warehouse-next` 实验分支游离 | frontend/warehouse-next | 无明确去留 |

---

## 二、优化建议（按优先级）

### P0 阶段：先止血，不做架构改动

**1. 立即初始化 Git 仓库**

无版本控制下做任何重构都是不可逆的。这是投入产出比最高的一步。

```bash
cd D:/ProgramData/others/cucumber-inventory-project
git init
# 先提交当前可用状态作为基线 tag
git add -A && git commit -m "chore: baseline before refactor"
git tag baseline-v2.1.0
```

同时补 `.gitignore`，排除 `backend/data/`、`node_modules/`、`dist/`。

**2. 关闭 local 模式的管理写入口**

后端接入 PG 前，`admin-users`（创建/修改/删除用户）在 local 模式下必须禁用，改为「请切换到服务端模式」。避免 P0-3 被利用。

**3. 后端内存数据落盘兜底**

在接 PG 前，给 `inventoryService` 加一个写 JSON 快照的定时兜底，至少做到重启不丢。

---

### P1 阶段：接入 PostgreSQL

#### 技术选型

| 项 | 选择 | 理由 |
|----|------|------|
| 数据库 | PostgreSQL 14+ | 事务、JSONB、生成列、数组类型都正好匹配现有模型 |
| 驱动 | `pg`（node-postgres） | 与 Fastify/原生均兼容，无 ORM 隐式魔法 |
| 查询层 | 手写 SQL + 轻量 repository | 现有模型简单，无需 ORM；SQL 可控 |
| 迁移 | `node-pg-migrate` 或手写 .sql + schema_migrations | 见 `docs/db/001_init.sql` |
| 会话 | 存 `sessions` 表，token 存 sha256 | 支持多实例、可主动吊销 |

#### 分层落地

```
backend/src/
  db/
    pool.js              连接池 + 健康检查 + 事务包装
    migrate.js           执行 docs/db/*.sql，记录 schema_migrations
  repositories/          ← 只有这一层写 SQL
    userRepo.js  sessionRepo.js  itemRepo.js
    inventoryRepo.js  stocktakeRepo.js  documentRepo.js
    machineRepo.js  categoryRepo.js  auditRepo.js
  services/              ← 业务编排，事务边界在这一层
  routes/                ← 表驱动路由
  middleware/            ← auth / rateLimit / errorHandler / logger
  server.js              ← 只做装配，不写业务
```

#### 迁移要点

1. **口令哈希格式对齐**：现有 `authService` 是 PBKDF2-SHA256（120000 轮）。`users.password_hash` 采用 `pbkdf2-sha256$iters$salt$hash` 格式存储，老用户可**免重置**直接迁移。后续可平滑升级到 argon2id。
2. **数组字段沿用**：`features` / `warehouse_ids` 直接用 `text[]`，与现有 `shared/permissions.js` 结构一致，不做多表关联。
3. **diff 用生成列**：`inventory.diff` 与 `stocktake_lines.diff` 用 `GENERATED ALWAYS AS ... STORED`，避免应用层算错。
4. **数量用 numeric**：绝不用 float/double，盘点系统对数量精度零容忍。
5. **历史数据导入**：写一次性脚本从浏览器 localStorage 导出 items/snapshots，经 API 批量入库。

---

### P2 阶段：前端重构

#### 核心问题

`app.js` 的本质是**把 21 个文件按顺序 concat 进同一个全局作用域**。所有 `var`、`function` 都是全局的，模块之间靠"加载顺序"隐式通信。这使得：

- 改一个函数可能影响任意其他模块
- 无法按需加载，首屏加载全部 11186 行
- 任何 IDE 的「转到定义」都只能定位到拼接后的产物

#### 改造方案

**引入 Vite + ES Module，替换手工拼接。**

```
frontend/src/
  api/          client.js（含 types.js 生成类型）
  core/         router / auth / modal / toast / storage
  state/        store.js  ← 替代散落的全局变量
  features/     inventory / scan / compare / machine / category / docs
  warehouse/    wh-module 拆分
  pages/        路由级组件
```

改造顺序（每步都可独立验证，不要一次推完）：

| 步骤 | 动作 | 验证点 |
|------|------|--------|
| 1 | Vite 接入，现有 app.js 作为单个 entry 跑通 | 页面与现在完全一致 |
| 2 | 抽出 `state/store.js`，把 `items`、`savedSnapshots`、`currentWorkView` 等全局变量收进去 | 功能不变 |
| 3 | `wh-module.js`（3342 行）按视图拆分 | 仓储各页正常 |
| 4 | `core/auth.js`（1727 行）拆分：vault / session / 管理页 | 管理页正常 |
| 5 | 删除 LocalAdapter，前端只走 HTTP | 配合后端 PG 完成 |

**关于 `warehouse-next`（Next.js 实验）**

建议**明确放弃**。项目主体是无构建的原生 JS SPA，引入 Next.js 会形成两套前端栈、双倍维护成本。若 3D 可视化确有长期演进需求，只保留 `modules/park3d/` 作为原生模块，通过 `<script type="module">` 集成即可。

---

### P3 阶段：工程化补齐

| 项 | 建议 |
|----|------|
| 测试 | 后端 repositories 用 `pg-mem` 或测试库做单测；前端至少覆盖 dto/normalize 与 store |
| Lint/Format | ESLint + Prettier，前后端统一 |
| CI | GitHub Actions：`lint → test → migrate → build` |
| 日志 | 结构化日志（pino），替代 `console.log` |
| 错误处理 | 统一错误中间件，替代各处 `try/catch` + 手写 JSON |
| OpenAPI | 用 openapi.yaml 生成前端类型与 mock，杜绝前后端漂移 |

---

## 三、推荐执行顺序

```
① git init + baseline           ← 立刻做，风险最低收益最高
② 禁 local 模式管理写入口         ← 堵住 P0-3 越权
③ 起 PostgreSQL，跑 001_init.sql  ← 有了持久化再谈重构
④ 后端接 db/ + repositories/     ← 数据先落到 PG
⑤ 前端 Vite + store 化           ← 此时已有数据兜底，可放心改
⑥ 删 LocalAdapter，全量走 HTTP
⑦ 测试 / CI / 日志补齐
```

关键原则：**先把数据搬到数据库，再动前端**。反过来做，改造期间数据只有浏览器一份，风险不可控。

---

## 四、需要你确认的决策点

1. **是否同意放弃 `warehouse-next`（Next.js 实验分支）？**
2. **前端是否接受引入 Vite 构建工具？**（会改变部署方式，从纯静态变为需构建产物）
3. **历史浏览器数据是否需要保留导入？**（决定是否写迁移脚本）
4. **老用户口令是否需要免重置迁移？**（PBKDF2 格式对齐 vs 统一重置）