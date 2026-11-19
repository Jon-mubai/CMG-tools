# 接口变更门禁（建议4）

合并前必须完成：

- [ ] 已更新 `docs/openapi.yaml`
- [ ] 若涉及权限/存储键/枚举，已同步 `shared/`
- [ ] backend 实现与路径/状态码一致
- [ ] frontend `CMGApi` / 仓储门面已适配
- [ ] 不在前端新增明文密钥或联系链接硬编码（走 `/meta/config`）

未勾选不得合并接口相关 PR。
