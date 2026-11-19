-- =============================================================================
-- WMS-Tec / CMG Inventory — PostgreSQL 初始 schema
-- 目标版本：PostgreSQL 14+
-- 约定：
--   1. 主键统一 text（业务可读 id，如 'wh_good' / 'u_admin'），不用自增序列
--   2. 时间统一 timestamptz，字段名 _at
--   3. 数量/金额统一 numeric，不用 float（避免浮点误差）
--   4. 所有业务表带created_at / updated_at，软删除用 deleted_at
--   5. 迁移脚本按序号执行：migrations/001_init.sql → 002_xxx.sql
--
-- 注意：本文件由 backend/src/db/migrate.js 在单个事务内执行，
--       因此不要在此写 BEGIN / COMMIT，否则与 advisory lock 冲突。
-- =============================================================================

-- 幂等更新时间戳触发器函数
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- -----------------------------------------------------------------------------
-- 1. 仓库
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS warehouses (
  id          text PRIMARY KEY,
  code        text NOT NULL UNIQUE,
  name        text NOT NULL,
  address     text,
  sort_order  integer NOT NULL DEFAULT 0,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  deleted_at  timestamptz
);

COMMENT ON TABLE warehouses IS '仓库主数据，对应 shared/constants.js DEFAULT_WAREHOUSES';

-- -----------------------------------------------------------------------------
-- 2. 用户
--    口令哈希格式：pbkdf2-sha256$<iterations>$<saltHex>$<hashHex>
--    兼容现有 authService.js 的 PBKDF2 实现，便于灰度迁移
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id             text PRIMARY KEY,
  username       text NOT NULL UNIQUE,
  display_name   text,
  password_hash  text NOT NULL,
  role           text NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
  -- 功能权限位，对应 shared/permissions.js FEATURES 的 key
  features       text[] NOT NULL DEFAULT '{}',
  -- 数据范围：空数组表示不限制（管理员）
  warehouse_ids  text[] NOT NULL DEFAULT '{}',
  -- 订阅/套餐（现仅存于前端 auth vault，需迁到服务端）
  plan           text,
  paid           boolean NOT NULL DEFAULT true,
  valid_from     date,
  valid_until    date,
  enabled        boolean NOT NULL DEFAULT true,
  must_change_pwd boolean NOT NULL DEFAULT false,
  fail_count     integer NOT NULL DEFAULT 0,
  locked_until   timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  deleted_at     timestamptz
);

CREATE INDEX IF NOT EXISTS idx_users_username_lower ON users (lower(username));
CREATE INDEX IF NOT EXISTS idx_users_role ON users (role) WHERE deleted_at IS NULL;

DROP TRIGGER IF EXISTS trg_users_updated_at ON users;
CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- -----------------------------------------------------------------------------
-- 3. 会话
--    token_hash 存 sha256(token) 十六进制；原 token 只在登录响应中返回一次
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sessions (
  id           text PRIMARY KEY,
  token_hash   text NOT NULL UNIQUE,
  user_id      text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ua_hash      text,
  ip           inet,
  created_at   timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  expires_at   timestamptz NOT NULL,
  revoked_at   timestamptz
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions (user_id) WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions (expires_at);

-- -----------------------------------------------------------------------------
-- 4. 商品主数据（SKU）
--    对应 shared/dto/inventory.js normalizeItem
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS items (
  id           text PRIMARY KEY,
  code         text NOT NULL,
  barcode      text,
  name         text NOT NULL,
  category     text,
  unit         text,
  spec         text,
  -- 一件商品可归属多仓，故为数组；空表示全局商品
  warehouse_ids text[] NOT NULL DEFAULT '{}',
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  deleted_at   timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_items_code ON items (code) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_items_barcode ON items (barcode) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_items_name_trgm ON items (lower(name));

DROP TRIGGER IF EXISTS trg_items_updated_at ON items;
CREATE TRIGGER trg_items_updated_at BEFORE UPDATE ON items
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- -----------------------------------------------------------------------------
-- 5. 库存（按仓 × 商品）
--    system_qty = 账面库存；actual_qty = 实盘库存；diff 由数据库计算
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS inventory (
  warehouse_id text NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
  item_id      text NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  system_qty   numeric(18,4) NOT NULL DEFAULT 0,
  actual_qty   numeric(18,4),
  diff         numeric(18,4) GENERATED ALWAYS AS (COALESCE(actual_qty, 0) - system_qty) STORED,
  updated_by   text REFERENCES users(id),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (warehouse_id, item_id)
);

CREATE INDEX IF NOT EXISTS idx_inventory_item ON inventory (item_id);
CREATE INDEX IF NOT EXISTS idx_inventory_diff ON inventory (warehouse_id) WHERE actual_qty IS NOT NULL AND diff <> 0;

DROP TRIGGER IF EXISTS trg_inventory_updated_at ON inventory;
CREATE TRIGGER trg_inventory_updated_at BEFORE UPDATE ON inventory
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- -----------------------------------------------------------------------------
-- 6. 盘点会话（一次盘点任务）
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS stocktake_sessions (
  id           text PRIMARY KEY,
  warehouse_id text NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
  title        text NOT NULL,
  status       text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed', 'archived')),
  item_count   integer NOT NULL DEFAULT 0,
  summary      jsonb,
  created_by   text REFERENCES users(id),
  created_at   timestamptz NOT NULL DEFAULT now(),
  closed_at    timestamptz,
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stk_sessions_wh ON stocktake_sessions (warehouse_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stk_sessions_status ON stocktake_sessions (status);

DROP TRIGGER IF EXISTS trg_stk_sessions_updated_at ON stocktake_sessions;
CREATE TRIGGER trg_stk_sessions_updated_at BEFORE UPDATE ON stocktake_sessions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- -----------------------------------------------------------------------------
-- 7. 盘点明细（快照式，落盘后不再随库存变动）
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS stocktake_lines (
  id          bigserial PRIMARY KEY,
  session_id  text NOT NULL REFERENCES stocktake_sessions(id) ON DELETE CASCADE,
  item_id     text NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  system_qty  numeric(18,4) NOT NULL DEFAULT 0,
  actual_qty  numeric(18,4),
  diff        numeric(18,4) GENERATED ALWAYS AS (COALESCE(actual_qty, 0) - system_qty) STORED,
  scanned_at  timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_stk_line ON stocktake_lines (session_id, item_id);
CREATE INDEX IF NOT EXISTS idx_stk_lines_session ON stocktake_lines (session_id);

-- -----------------------------------------------------------------------------
-- 8. 单据
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS documents (
  id           text PRIMARY KEY,
  warehouse_id text REFERENCES warehouses(id) ON DELETE SET NULL,
  title        text NOT NULL,
  doc_type     text,
  status       text NOT NULL DEFAULT 'draft'
               CHECK (status IN ('draft', 'submitted', 'archived')),
  storage_path text NOT NULL,
  mime_type    text NOT NULL,
  size_bytes   bigint NOT NULL,
  checksum     text,
  uploaded_by  text REFERENCES users(id),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  deleted_at   timestamptz
);

CREATE INDEX IF NOT EXISTS idx_documents_wh ON documents (warehouse_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_documents_status ON documents (status);

DROP TRIGGER IF EXISTS trg_documents_updated_at ON documents;
CREATE TRIGGER trg_documents_updated_at BEFORE UPDATE ON documents
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- -----------------------------------------------------------------------------
-- 9. 机台毛利
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS machine_profit (
  id           text PRIMARY KEY,
  warehouse_id text REFERENCES warehouses(id) ON DELETE CASCADE,
  machine_code text NOT NULL,
  period_type  text NOT NULL CHECK (period_type IN ('day', 'week', 'month')),
  period_start date NOT NULL,
  period_end   date NOT NULL,
  revenue      numeric(18,2) NOT NULL DEFAULT 0,
  cost         numeric(18,2) NOT NULL DEFAULT 0,
  profit       numeric(18,2) GENERATED ALWAYS AS (revenue - cost) STORED,
  extra        jsonb,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (warehouse_id, machine_code, period_type, period_start)
);

DROP TRIGGER IF EXISTS trg_machine_profit_updated_at ON machine_profit;
CREATE TRIGGER trg_machine_profit_updated_at BEFORE UPDATE ON machine_profit
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- -----------------------------------------------------------------------------
-- 10. 品类统计
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS category_stats (
  id           text PRIMARY KEY,
  warehouse_id text REFERENCES warehouses(id) ON DELETE CASCADE,
  category     text NOT NULL,
  period_type  text NOT NULL CHECK (period_type IN ('day', 'week', 'month')),
  period_start date NOT NULL,
  period_end   date NOT NULL,
  qty          numeric(18,4) NOT NULL DEFAULT 0,
  amount       numeric(18,2) NOT NULL DEFAULT 0,
  extra        jsonb,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (warehouse_id, category, period_type, period_start)
);

DROP TRIGGER IF EXISTS trg_category_stats_updated_at ON category_stats;
CREATE TRIGGER trg_category_stats_updated_at BEFORE UPDATE ON category_stats
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- -----------------------------------------------------------------------------
-- 11. 审计日志（替代 audit.jsonl，支持分页与条件检索）
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_logs (
  id          bigserial PRIMARY KEY,
  at          timestamptz NOT NULL DEFAULT now(),
  actor       text,
  actor_id    text REFERENCES users(id) ON DELETE SET NULL,
  action      text NOT NULL,
  resource    text,
  detail      jsonb,
  ip          inet,
  scope       jsonb
);

CREATE INDEX IF NOT EXISTS idx_audit_at ON audit_logs (at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_actor ON audit_logs (actor, at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs (action, at DESC);

-- -----------------------------------------------------------------------------
-- 12. 种子数据：仓主数据（与 shared/constants.js DEFAULT_WAREHOUSES 对齐）
-- -----------------------------------------------------------------------------
INSERT INTO warehouses (id, code, name, sort_order) VALUES
  ('wh_good',    'GOOD',    '良品仓库', 1),
  ('wh_plush',   'PLUSH',   '毛绒仓库', 2),
  ('wh_transit', 'TRANSIT', '中转仓库', 3)
ON CONFLICT (id) DO NOTHING;

-- 迁移版本表
CREATE TABLE IF NOT EXISTS schema_migrations (
  version    text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);

-- =============================================================================
-- 后续迁移脚本建议（按需拆分）
--   002_seed_admin.sql        首个管理员（口令哈希由后端生成后写入，勿写明文）
--   003_row_level_security.sql 仓库级数据范围（可选，配合应用层过滤双保险）
-- =============================================================================