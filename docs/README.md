# docs — API 契约（唯一真相）

前后端接口变更流程：

1. 修改 `openapi.yaml`
2. 同步 `shared/` 中的权限/常量（如有）
3. 再改 `backend/` 与 `frontend/` 实现

禁止在未更新本文档的情况下合并接口字段变更。
