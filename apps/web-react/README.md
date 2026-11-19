# web-react（阶段 0）

React + TypeScript 重构底座。**不替换** `apps/web` 经典前端。

## 本阶段内容

- Vite + React 19 + TypeScript
- 全局引入现有 `apps/web/css` 令牌与组件样式
- 基础组件：Button、Input、Select、DateRangePicker、Table、Pager、Modal、Toast
- 统一 API client（`/api` → Nest `:3001`）
- 预览页用于对照样式，无业务写入

## 启动

```bash
cd apps/web-react
npm install
npm run dev
```

浏览器：http://127.0.0.1:5174

经典前端仍用 `npm run dev:web`（:8080）。


## 阶段 1

- 登录页（优先走 `/api/v1/auth/login`，服务端不可用时进入演示会话）
- 布局壳：侧栏菜单 + 内容区
- 菜单项对应占位页，尚未迁移业务
- 退出清除会话

刷新后若已有会话会直接进入壳。
