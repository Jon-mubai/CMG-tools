# deploy

- `.env.example`：环境变量模板
- `nginx.conf`：静态站 + `/api` 反代
- `docker-compose.yml`：本地联调骨架

```bash
cp deploy/.env.example deploy/.env
cd deploy && docker compose up
```
