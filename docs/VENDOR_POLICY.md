# 前端依赖本地化策略（强制）

## 规则

1. **禁止**在 HTML/JS/CSS 中引用 `https://` CDN 加载脚本、样式、字体。
2. **禁止**运行时 `document.createElement('script')` 指向外网。
3. **禁止**二维码/图标等走远程 API（如 api.qrserver.com、api.iconify.design）。
4. 新增库流程：下载 → 放入 `frontend/vendor/` → 本地 `<script src="vendor/...">` → 更新本表与 CSP（若需）。
5. 外链仅允许**用户点击跳转**（GitHub、小红书、帮助文档），不得用于资源加载。

## 检查清单（每次发版前）

```bash
# 应无业务源码命中（vendor 与文档说明除外）
grep -rn "unpkg\|jsdelivr\|cdn\.sheetjs\|iconify.design\|api.qrserver" frontend/js frontend/index.html
```

## 例外

- `connect-src` 访问本机 `backend` API（localhost:3001）
- `data:` / `blob:` 图片与 Worker
