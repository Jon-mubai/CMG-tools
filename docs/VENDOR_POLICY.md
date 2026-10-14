# Frontend vendor policy (mandatory)

1. Do not load scripts/styles/fonts from CDN.
2. Do not inject remote scripts at runtime.
3. Do not use remote QR/icon APIs.
4. New libs: download → `frontend/vendor/` → local script tag → update this doc.
5. External https links only for user navigation (GitHub, Xiaohongshu), not asset loading.
