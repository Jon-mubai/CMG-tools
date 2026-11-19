-- 机台运营明细表：调拨 / 库存变更，支持大批量行存储
CREATE TABLE IF NOT EXISTS machine_ops_rows (
  id SERIAL PRIMARY KEY,
  kind TEXT NOT NULL,
  doc_no TEXT,
  product TEXT,
  qty DOUBLE PRECISION NOT NULL DEFAULT 0,
  amount DOUBLE PRECISION NOT NULL DEFAULT 0,
  from_wh TEXT,
  to_wh TEXT,
  period TEXT,
  operator TEXT,
  occurred_at TEXT,
  change_type TEXT,
  summary TEXT,
  warehouse TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS machine_ops_rows_kind_idx ON machine_ops_rows (kind);
