-- 报销状态独立索引，配合审核状态筛选
CREATE INDEX IF NOT EXISTS finance_records_reimbursed_idx ON finance_records (reimbursed);
