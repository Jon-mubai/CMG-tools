/*
 * Author: zcl (MuBai)
 * Date: 2026-10-14
 * Role: Full-Stack Developer
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.CMGShared = root.CMGShared || {};
    root.CMGShared.dto = root.CMGShared.dto || {};
    root.CMGShared.dto.inventory = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  function normalizeItem(row) {
    row = row || {};
    return {
      id: row.id != null ? String(row.id) : '',
      code: row.code != null ? String(row.code) : '',
      name: row.name != null ? String(row.name) : '',
      barcode: row.barcode != null ? String(row.barcode) : '',
      systemQty: row.systemQty != null ? Number(row.systemQty) : 0,
      actualQty: row.actualQty != null ? Number(row.actualQty) : null,
      diff: row.diff != null ? Number(row.diff) : null,
      warehouseId: row.warehouseId != null ? String(row.warehouseId) : ''
    };
  }
  function isValidItem(it) {
    return !!(it && (it.code || it.barcode || it.name));
  }
  return { normalizeItem: normalizeItem, isValidItem: isValidItem };
});
