# backend

最小 Node HTTP 服务，对齐 `docs/openapi.yaml`。

```bash
cd backend
npm start
# http://127.0.0.1:3001/api/v1/health
```

当前登录仍由前端 LocalAdapter 处理；本服务提供 health / features 与后续迁移锚点。
