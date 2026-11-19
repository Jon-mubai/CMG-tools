-- 备用金使用记录：已报销标记
-- 在 apps/api 目录也可改用: npx prisma db push
ALTER TABLE finance_records
  ADD COLUMN IF NOT EXISTS reimbursed BOOLEAN NOT NULL DEFAULT false;
