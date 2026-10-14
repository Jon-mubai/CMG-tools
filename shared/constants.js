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
    Object.assign(root.CMGShared, factory());
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  return {
    AUTH_STORE: 'cmg_auth_vault_v1',
    SESSION_KEY: 'cmg_session_v1',
    PBKDF2_ITERS: 120000,
    SALT_BYTES: 16,
    MAX_FAIL: 5,
    LOCK_MS: 5 * 60 * 1000,
    SESSION_TTL_MS: 8 * 60 * 60 * 1000,
    API_PREFIX: '/api/v1',
    STORAGE_KEYS: {
      INVENTORY: 'inventory_check_v1',
      SNAPSHOTS: 'inventory_check_snapshots_v1',
      DOCS: 'cmg_warehouse_docs_v1',
      MACHINE: 'cmg_machine_profit_v1',
      CATEGORY: 'cmg_category_stats_v1',
      API_MODE: 'cmg_api_mode'
    },
    STORAGE_VERSION: 1,
    DOC_STATUS: ['draft', 'submitted', 'archived'],
    STOCKTAKE_STATUS: ['open', 'closed'],
    DEFAULT_WAREHOUSES: [
      { id: 'wh_good', name: '良品仓库' },
      { id: 'wh_plush', name: '毛绒仓库' },
      { id: 'wh_transit', name: '中转仓库' }
    ]
  };
});
