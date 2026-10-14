/*
 * Author: zcl (MuBai)
 * Date: 2026-10-14
 * Role: Full-Stack Developer
 * 所属：backend/services — 库存聚合（S5 支持 warehouseId 数据范围）
 */
'use strict';

const path = require('path');
const dto = require(path.join(__dirname, '../../../shared/dto/inventory.js'));

const store = new Map();

function list(query, scope) {
  query = query || {};
  scope = scope || {};
  const q = String(query.q || '').trim().toLowerCase();
  let page = Math.max(1, parseInt(query.page, 10) || 1);
  let pageSize = Math.min(200, Math.max(1, parseInt(query.pageSize, 10) || 50));
  let all = Array.from(store.values());

  const allowed = scope.warehouseIds;
  if (Array.isArray(allowed) && allowed.length && scope.role !== 'admin') {
    const set = {};
    allowed.forEach(function (id) { set[id] = true; });
    all = all.filter(function (it) {
      if (!it.warehouseId) return true;
      return !!set[it.warehouseId];
    });
  }

  if (q) {
    all = all.filter(function (it) {
      return (it.name && it.name.toLowerCase().indexOf(q) >= 0) ||
        (it.code && it.code.toLowerCase().indexOf(q) >= 0) ||
        (it.barcode && String(it.barcode).toLowerCase().indexOf(q) >= 0);
    });
  }
  const total = all.length;
  const start = (page - 1) * pageSize;
  const items = all.slice(start, start + pageSize);
  return { total: total, page: page, pageSize: pageSize, items: items };
}

function upsertMany(items) {
  if (!Array.isArray(items)) return { ok: false, error: 'items 必须为数组' };
  let n = 0;
  items.forEach(function (raw) {
    const it = dto.normalizeItem(raw);
    if (!dto.isValidItem(it)) return;
    if (!it.id) it.id = it.code || it.barcode;
    if (raw && raw.warehouseId) it.warehouseId = String(raw.warehouseId);
    store.set(it.id, it);
    n++;
  });
  return { ok: true, count: n };
}

function clear() {
  store.clear();
  return { ok: true };
}

module.exports = { list: list, upsertMany: upsertMany, clear: clear };
