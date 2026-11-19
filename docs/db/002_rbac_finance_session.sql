-- CMG / WMS-Tec 数据库扩展：RBAC + 会话 + 备用金/审批
-- 与 apps/api/prisma/schema.prisma 对齐；可在现有 001_init 之后执行

-- ========== 角色约定 ==========
-- super_admin : 唯一可管理账号与权限；业务全开
-- admin       : 普通管理员，业务全开，不可管账号
-- user        : 普通用户，按 features 授权

-- 存量：若无超级管理员，将最早的 admin 提升
UPDATE users SET role = 'super_admin'
WHERE id = (
  SELECT id FROM users
  WHERE deleted_at IS NULL AND role = 'admin'
  ORDER BY created_at ASC
  LIMIT 1
)
AND NOT EXISTS (
  SELECT 1 FROM users WHERE deleted_at IS NULL AND role = 'super_admin'
);

-- 示例引导标记（首次改密后清除）
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_bootstrap BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS bootstrap_destroyed BOOLEAN NOT NULL DEFAULT false;

-- ========== 备用金台账 ==========
CREATE TABLE IF NOT EXISTS finance_reserves (
  id            TEXT PRIMARY KEY,
  total_amount  NUMERIC(14,2) NOT NULL DEFAULT 0,
  sources       JSONB NOT NULL DEFAULT '[]',
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by    TEXT
);

CREATE TABLE IF NOT EXISTS finance_records (
  id              TEXT PRIMARY KEY,
  item            TEXT NOT NULL,
  purpose         TEXT,
  description     TEXT,
  qty             NUMERIC(14,3) DEFAULT 0,
  amount          NUMERIC(14,2) NOT NULL DEFAULT 0,
  date_start      DATE,
  date_end        DATE,
  user_name       TEXT,
  auditor         TEXT,          -- 须与登录 username 一致
  operator        TEXT,          -- 提交人 username
  pay_type        TEXT,
  receipt_type    TEXT,
  inbound_no      TEXT,
  remark          TEXT,
  pay_images      JSONB NOT NULL DEFAULT '[]',
  invoice_images  JSONB NOT NULL DEFAULT '[]',
  other_images    JSONB NOT NULL DEFAULT '[]',
  review_status   TEXT NOT NULL DEFAULT 'pending',  -- pending|passed|rejected
  review_need_revise BOOLEAN NOT NULL DEFAULT false,
  review_terminate   BOOLEAN NOT NULL DEFAULT false,
  reviewer        TEXT,
  reviewed_at     TIMESTAMPTZ,
  review_note     TEXT,
  review_history  JSONB NOT NULL DEFAULT '[]',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at      TIMESTAMPTZ,
  deleted_by      TEXT
);

CREATE INDEX IF NOT EXISTS idx_finance_records_review ON finance_records (review_status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_finance_records_auditor ON finance_records (auditor) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_finance_records_operator ON finance_records (operator) WHERE deleted_at IS NULL;

-- ========== 会话（已有 sessions 表则跳过）==========
-- token_hash 存 refresh token 的 SHA-256；access JWT 内含 sid + sub + role
-- 业务接口必须 JWT 校验，禁止仅靠前端路径鉴权

COMMENT ON TABLE finance_records IS '备用金使用登记与审批；待审仅 auditor=当前用户 或 super_admin/admin 可见';
;