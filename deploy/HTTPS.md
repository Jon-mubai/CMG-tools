# HTTPS deployment notes (S3)

Production must use HTTPS.

## Recommended

1. Terminate TLS at reverse proxy (Nginx / Caddy / cloud LB)
2. Same origin for static + `/api`
3. Backend listens on private network only

```bash
NODE_ENV=production
CORS_ORIGIN=https://your-domain.example
CMG_USE_COOKIE=1
```
