# HTTPS 部署建议（S3）

生产环境必须使用 HTTPS，否则：

- `crypto.subtle` 在部分环境下不可用
- Cookie `Secure` 无法生效
- 会话与业务数据可被中间人窃听

## 推荐方式

1. **反向代理终止 TLS**（Nginx / Caddy / 云负载均衡）
2. 前端静态资源与 `/api` 同域，避免跨域带 Cookie 的复杂配置
3. 后端仅监听内网，不直接暴露公网

### Nginx 示例要点

```nginx
listen 443 ssl http2;
ssl_certificate     /path/fullchain.pem;
ssl_certificate_key /path/privkey.pem;
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

location /api/ {
  proxy_pass http://127.0.0.1:3001/api/;
  proxy_set_header Host $host;
  proxy_set_header X-Forwarded-Proto https;
}
```

### 环境变量

```bash
NODE_ENV=production
CORS_ORIGIN=https://your-domain.example
CMG_USE_COOKIE=1
```

本地开发可继续使用 `http://localhost`。
