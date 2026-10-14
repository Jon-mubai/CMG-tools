# deploy

- `.env.example` — env template
- `nginx.conf` — static + `/api` proxy
- `docker-compose.yml` — local stack

```bash
cp deploy/.env.example deploy/.env
cd deploy && docker compose up
```
