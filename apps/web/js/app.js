/**
 * Author: zcl (MuBai)
 * Date: 2026-10-14
 * Role: Full-Stack Developer
 */


/* ========== shared/constants.js ========== */
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

    /* 业务本地存储键（LocalAdapter 与迁移对照） */
    STORAGE_KEYS: {
      INVENTORY: 'inventory_check_v1',
      SNAPSHOTS: 'inventory_check_snapshots_v1',
      DOCS: 'cmg_warehouse_docs_v1',
      MACHINE: 'cmg_machine_profit_v1',
      CATEGORY: 'cmg_category_stats_v1',
      API_MODE: 'cmg_api_mode'
    },
    STORAGE_VERSION: 1,

    /* 领域枚举 */
    DOC_STATUS: ['draft', 'submitted', 'archived'],
    STOCKTAKE_STATUS: ['open', 'closed'],

    /* S5：数据范围（门店/仓）— 空数组表示不限制（管理员） */
    DEFAULT_WAREHOUSES: [
      { id: 'wh_good', name: '良品仓库' },
      { id: 'wh_plush', name: '毛绒仓库' },
      { id: 'wh_transit', name: '中转仓库' }
    ]
  };
});


/* ========== shared/permissions.js ========== */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.CMGShared = root.CMGShared || {};
    Object.assign(root.CMGShared, factory());
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var FEATURES = [
    { key: 'dashboard', label: '仓库看板' },
    { key: 'scan', label: '扫码盘点（盘点设置）' },
    { key: 'scan-data', label: '盘点数据（盘点设置）' },
    { key: 'wh-park', label: '仓库可视化（仓库管理）' },
    { key: 'wh-docs', label: '单据设置（仓库管理）' },
    { key: 'wh-stock', label: '库存管理（仓库管理）' },
    { key: 'machine-profit', label: '机台毛利' },
    { key: 'machine-ops', label: '运营数据' },
    { key: 'machine-category', label: '品类统计' },
    { key: 'finance-ledger', label: '财务管理' },
    { key: 'other-demo-1', label: 'Hometown（OTher）' },
    { key: 'other-demo-2', label: '示例菜单二（OTher）' },
    { key: 'other-demo-3', label: '示例菜单三（OTher）' },
    { key: 'other-demo-4', label: '示例菜单四（OTher）' },
    { key: 'other-demo-5', label: '示例菜单五（OTher）' },
    { key: 'help', label: '系统说明' },
    { key: 'admin-users', label: '账号与权限（仅管理员）' }
  ];

  var ROLES = {
    ADMIN: 'admin',
    USER: 'user'
  };

  var ROLE_LABELS = {
    admin: '管理员',
    user: '普通用户'
  };

  /** 普通用户默认可访问（不含 admin-users） */
  function defaultUserFeatures() {
    return FEATURES.filter(function (f) { return f.key !== 'admin-users'; }).map(function (f) { return f.key; });
  }

  function allFeatureKeys() {
    return FEATURES.map(function (f) { return f.key; });
  }

  return {
    FEATURES: FEATURES,
    ROLES: ROLES,
    ROLE_LABELS: ROLE_LABELS,
    defaultUserFeatures: defaultUserFeatures,
    allFeatureKeys: allFeatureKeys
  };
});


/* ========== shared/dto/inventory.js ========== */
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

  function normalizeItem(raw) {
    raw = raw || {};
    var systemQty = Number(raw.systemQty);
    var actualQty = Number(raw.actualQty);
    if (!isFinite(systemQty)) systemQty = 0;
    if (!isFinite(actualQty)) actualQty = 0;
    return {
      id: String(raw.id || raw.code || ''),
      code: String(raw.code || ''),
      name: String(raw.name || ''),
      barcode: String(raw.barcode || ''),
      systemQty: systemQty,
      actualQty: actualQty,
      diff: actualQty - systemQty
    };
  }

  function isValidItem(item) {
    return !!(item && (item.code || item.barcode) && item.name != null);
  }

  return { normalizeItem: normalizeItem, isValidItem: isValidItem };
});



/* —— 业务数据优先入库（PostgreSQL via /api/v1/data/kv），内存缓存；不再作为浏览器持久化 —— */
window.CMGUserStore = window.CMGUserStore || {
  _mem: {},
  currentUserKey: function () {
    try {
      var s = null;
      if (window.Auth && typeof Auth.current === 'function') s = Auth.current();
      if (!s) {
        var raw = sessionStorage.getItem('cmg_session_v1');
        if (raw) s = JSON.parse(raw);
      }
      if (s && (s.userId || s.username)) {
        return String(s.userId || s.username).replace(/[^a-zA-Z0-9_-]/g, '_');
      }
    } catch (e) {}
    return '_anon';
  },
  key: function (base) {
    return String(base || 'cmg_data') + '__u_' + this.currentUserKey();
  },
  scope: function () {
    return 'user:' + this.currentUserKey();
  },
  /** 本地持久化：localStorage 优先，失败则 sessionStorage */
  _lsGet: function (k) {
    try {
      var v = localStorage.getItem(k);
      if (v != null) return v;
    } catch (e0) {}
    try {
      return sessionStorage.getItem('ls_' + k);
    } catch (e1) {}
    return null;
  },
  _lsSet: function (k, val) {
    try {
      if (val == null) localStorage.removeItem(k);
      else localStorage.setItem(k, String(val));
      return true;
    } catch (e0) {
      try {
        if (val == null) sessionStorage.removeItem('ls_' + k);
        else sessionStorage.setItem('ls_' + k, String(val));
        return true;
      } catch (e1) {
        return false;
      }
    }
  },
  _lsRemove: function (k) {
    try { localStorage.removeItem(k); } catch (e0) {}
    try { sessionStorage.removeItem('ls_' + k); } catch (e1) {}
  },
  getItem: function (base) {
    var k = this.key(base);
    if (Object.prototype.hasOwnProperty.call(this._mem, k) && this._mem[k] != null) {
      return this._mem[k];
    }
    var fromLs = this._lsGet(k);
    if (fromLs != null) {
      this._mem[k] = fromLs;
      return fromLs;
    }
    return null;
  },
  setItem: function (base, val) {
    var k = this.key(base);
    var str = val == null ? null : String(val);
    this._mem[k] = str;
    /* 盘点导入等业务数据必须本地落盘，刷新不丢 */
    this._lsSet(k, str);
    if (typeof CMGApi !== 'undefined' && CMGApi.getMode && CMGApi.getMode() === 'http' && CMGApi.putKv) {
      var payload = null;
      try { payload = JSON.parse(String(val)); } catch (e) { payload = { raw: String(val) }; }
      CMGApi.putKv(k, payload, this.scope()).catch(function (err) {
        /* 本地已保存，同步失败仅提示，不阻断 */
        if (typeof toast === 'function') toast('云端同步失败（本地已保存）：' + (err && err.message || err), 'warning');
      });
    }
    return true;
  },
  removeItem: function (base) {
    var k = this.key(base);
    delete this._mem[k];
    this._lsRemove(k);
    if (typeof CMGApi !== 'undefined' && CMGApi.getMode && CMGApi.getMode() === 'http' && CMGApi.removeKv) {
      CMGApi.removeKv(k, this.scope()).catch(function () {});
    }
  },
  /** 登录后从数据库预热缓存 */
  hydrate: function (base) {
    var self = this;
    var k = this.key(base);
    if (typeof CMGApi === 'undefined' || !CMGApi.getKv || CMGApi.getMode() !== 'http') {
      return Promise.resolve(null);
    }
    return CMGApi.getKv(k, this.scope()).then(function (res) {
      if (res && res.payload != null) {
        var str = typeof res.payload === 'string' ? res.payload : JSON.stringify(res.payload);
        if (res.payload && res.payload.raw != null && Object.keys(res.payload).length === 1) {
          str = String(res.payload.raw);
        }
        self._mem[k] = str;
        return str;
      }
      return null;
    }).catch(function () { return null; });
  }
};

/* ========== js/api/client.js ========== */
/*
 * Author: zcl (MuBai)
 * Date: 2026-10-14
 * Role: Full-Stack Developer
 * 所属：frontend/api — 统一门面：LocalAdapter | HttpAdapter（核心问题2/1 治理入口）
 */
(function () {
  'use strict';

  var MODE_KEY = (typeof CMGShared !== 'undefined' && CMGShared.STORAGE_KEYS && CMGShared.STORAGE_KEYS.API_MODE)
    ? CMGShared.STORAGE_KEYS.API_MODE
    : 'cmg_api_mode';
  var TOKEN_KEY = 'cmg_api_token';
  var DEFAULT_BASE = '/api/v1';

  function getMode() {
    try { localStorage.setItem(MODE_KEY, 'http'); } catch (e0) {}
    return 'http';
  }
  function setMode(mode) {
    try { localStorage.setItem(MODE_KEY, mode === 'http' ? 'http' : 'local'); } catch (e) {}
  }
  function getBase() {
    if (typeof window !== 'undefined' && window.CMG_API_BASE) return window.CMG_API_BASE;
    if (typeof CMGShared !== 'undefined' && CMGShared.API_PREFIX) return CMGShared.API_PREFIX;
    return DEFAULT_BASE;
  }
  function isJwtToken(t) {
    if (!t) return false;
    var parts = String(t).split('.');
    return parts.length === 3 && parts[0].length > 10 && parts[1].length > 10;
  }
  function getToken() {
    try {
      var t = sessionStorage.getItem(TOKEN_KEY) || '';
      if (isJwtToken(t)) return t;
      try {
        t = localStorage.getItem('cmg_jwt_backup') || '';
        if (isJwtToken(t)) {
          try { sessionStorage.setItem(TOKEN_KEY, t); } catch (eb) {}
          return t;
        }
      } catch (eBk) {}
      /* 从登录会话 / 跨标签锁恢复 JWT */
      var sources = [];
      try { sources.push(sessionStorage.getItem('cmg_session_v1')); } catch (e0) {}
      try { sources.push(sessionStorage.getItem('cmg_auth_session_v1')); } catch (e1) {}
      try { sources.push(localStorage.getItem('cmg_session_lock_v1')); } catch (e2) {}
      for (var i = 0; i < sources.length; i++) {
        var raw = sources[i];
        if (!raw) continue;
        try {
          var s = JSON.parse(raw);
          if (s && isJwtToken(s.token)) {
            try { sessionStorage.setItem(TOKEN_KEY, s.token); } catch (e3) {}
            try { localStorage.setItem('cmg_jwt_backup', s.token); } catch (e3b) {}
            return s.token;
          }
        } catch (e4) {}
      }
      return '';
    } catch (e) { return ''; }
  }
  function setToken(t) {
    try {
      if (t && isJwtToken(t)) {
        sessionStorage.setItem(TOKEN_KEY, t);
        try { localStorage.setItem('cmg_jwt_backup', t); } catch (eB) {}
      } else if (!t) {
        sessionStorage.removeItem(TOKEN_KEY);
        try { localStorage.removeItem('cmg_jwt_backup'); } catch (eC) {}
      }
    } catch (e) {}
  }

  var LocalAdapter = {
    name: 'local',
    health: function () {
      return Promise.resolve({ ok: true, service: 'local-adapter', time: new Date().toISOString() });
    },
    features: function () {
      var list = (typeof CMGShared !== 'undefined' && CMGShared.FEATURES) ? CMGShared.FEATURES : [];
      return Promise.resolve({ features: list });
    },
    metaConfig: function () {
      return Promise.resolve({ contactAdminUrl: '', appName: 'WMS-Tec', apiModeDefault: 'local' });
    },
    login: function () {
      return Promise.reject(new Error('Local 模式请使用 Auth.login（浏览器本地保险库）'));
    },
    me: function () { return Promise.reject(new Error('Local 模式无服务端会话')); },
    logout: function () { return Promise.resolve(); },
    listInventory: function () {
      return Promise.resolve({ total: 0, page: 1, pageSize: 50, items: [], note: 'local: 使用页面内存 items' });
    },
    bulkInventory: function () {
      return Promise.resolve({ ok: true, note: 'local: 由 saveItems 持久化' });
    },
    listStocktake: function () {
      return Promise.resolve({ items: [] });
    },
    saveStocktake: function () {
      return Promise.resolve({ ok: true, note: 'local: 由 snapshots 模块处理' });
    }
  };

  var HttpAdapter = {
    name: 'http',
    request: function (method, path, body) {
      var headers = { 'Content-Type': 'application/json' };
      var token = getToken();
      var publicPaths = ['/auth/login', '/health', '/meta/config'];
      var isPublic = publicPaths.some(function (p) { return path === p || path.indexOf(p + '?') === 0; });
      /* 业务接口必须带 JWT；登录/健康检查可匿名 */
      if (!isPublic) {
        if (!isJwtToken(token)) {
          var e0 = new Error('登录已失效，请重新登录');
          e0.status = 401;
          return Promise.reject(e0);
        }
        headers.Authorization = 'Bearer ' + token;
      } else if (isJwtToken(token)) {
        headers.Authorization = 'Bearer ' + token;
      }
      var opts = { method: method, headers: headers, credentials: 'include' };
      if (body !== undefined) opts.body = JSON.stringify(body);
      return fetch(getBase() + path, opts).then(function (res) {
        if (res.status === 204) return null;
        return res.text().then(function (text) {
          var data = null;
          if (text) {
            try { data = JSON.parse(text); } catch (e) { data = { message: text }; }
          }
          if (!res.ok) {
            var msg = (data && (data.message || data.error || data.msg)) || res.statusText || ('HTTP ' + res.status);
            if (Array.isArray(msg)) msg = msg.join('; ');
            if (res.status === 401) msg = '登录已失效，请重新登录';
            if (res.status === 403) msg = (msg && msg !== 'Forbidden') ? msg : '无权限执行此操作';
            var err = new Error(String(msg));
            err.status = res.status;
            err.data = data;
            throw err;
          }
          return data;
        });
      });
    },
    health: function () { return this.request('GET', '/health'); },
    features: function () { return this.request('GET', '/meta/features'); },
    metaConfig: function () { return this.request('GET', '/meta/config'); },
    login: function (username, password) {
      var self = this;
      return this.request('POST', '/auth/login', { username: username, password: password }).then(function (data) {
        if (data && (data.accessToken || data.token)) setToken(data.accessToken || data.token);
        return data;
      });
    },
    me: function () { return this.request('GET', '/auth/me'); },
    logout: function () {
      var self = this;
      return this.request('POST', '/auth/logout').catch(function () {}).then(function () { setToken(''); });
    },
    listInventory: function (query) {
      query = query || {};
      var qs = [];
      if (query.q) qs.push('q=' + encodeURIComponent(query.q));
      if (query.page) qs.push('page=' + encodeURIComponent(query.page));
      if (query.pageSize) qs.push('pageSize=' + encodeURIComponent(query.pageSize));
      return this.request('GET', '/inventory/items' + (qs.length ? '?' + qs.join('&') : ''));
    },
    bulkInventory: function (items) {
      return this.request('POST', '/inventory/items/bulk', { items: items });
    },
    listStocktake: function () { return this.request('GET', '/stocktake/sessions'); },
    saveStocktake: function (payload) { return this.request('POST', '/stocktake/sessions', payload); },
    getFinanceLedger: function () { return this.request('GET', '/finance/ledger'); },
    putFinanceLedger: function (body) { return this.request('PUT', '/finance/ledger', body); },
    getKv: function (key, scope) {
      var q = scope ? ('?scope=' + encodeURIComponent(scope)) : '';
      return this.request('GET', '/data/kv/' + encodeURIComponent(key) + q);
    },
    putKv: function (key, payload, scope) {
      return this.request('PUT', '/data/kv/' + encodeURIComponent(key), { payload: payload, scope: scope || 'global' });
    },
    removeKv: function (key, scope) {
      var q = scope ? ('?scope=' + encodeURIComponent(scope)) : '';
      return this.request('DELETE', '/data/kv/' + encodeURIComponent(key) + q);
    },
    getMachineOps: function (kind) {
      return this.request('GET', '/machine/ops/' + encodeURIComponent(kind));
    },
    putMachineOps: function (kind, body) {
      return this.request('PUT', '/machine/ops/' + encodeURIComponent(kind), body);
    },
    clearMachineOps: function (kind) {
      return this.request('DELETE', '/machine/ops/' + encodeURIComponent(kind));
    },
    listAdminUsers: function () { return this.request('GET', '/admin/users'); },
    createAdminUser: function (body) { return this.request('POST', '/admin/users', body); },
    updateAdminUser: function (id, body) { return this.request('PATCH', '/admin/users/' + encodeURIComponent(id), body); },
    resetAdminPassword: function (id, newPassword) {
      return this.request('POST', '/admin/users/' + encodeURIComponent(id) + '/reset-password', { newPassword: newPassword });
    },
    disableAdminUser: function (id) { return this.request('DELETE', '/admin/users/' + encodeURIComponent(id)); }
  };

  function adapter() {
    return getMode() === 'http' ? HttpAdapter : LocalAdapter;
  }

  window.CMGApi = {
    getMode: getMode,
    setMode: setMode,
    getBase: getBase,
    getToken: getToken,
    setToken: setToken,
    health: function () { return adapter().health(); },
    features: function () { return adapter().features(); },
    metaConfig: function () { return adapter().metaConfig(); },
    login: function (u, p) { return adapter().login(u, p); },
    me: function () { return adapter().me(); },
    logout: function () { return adapter().logout(); },
    listInventory: function (q) { return adapter().listInventory(q); },
    bulkInventory: function (items) { return adapter().bulkInventory(items); },
    listStocktake: function () { return adapter().listStocktake(); },
    saveStocktake: function (p) { return adapter().saveStocktake(p); },
    getFinanceLedger: function () {
      return getMode() === 'http' ? HttpAdapter.getFinanceLedger() : Promise.resolve({ reserve: 0, records: [], sources: [] });
    },
    putFinanceLedger: function (body) {
      return getMode() === 'http' ? HttpAdapter.putFinanceLedger(body) : Promise.resolve(body);
    },
    listAdminUsers: function () {
      return getMode() === 'http' ? HttpAdapter.listAdminUsers() : Promise.resolve([]);
    },
    createAdminUser: function (body) {
      return getMode() === 'http' ? HttpAdapter.createAdminUser(body) : Promise.reject(new Error('需要服务端'));
    },
    updateAdminUser: function (id, body) {
      return getMode() === 'http' ? HttpAdapter.updateAdminUser(id, body) : Promise.reject(new Error('需要服务端'));
    },
    resetAdminPassword: function (id, pwd) {
      return getMode() === 'http' ? HttpAdapter.resetAdminPassword(id, pwd) : Promise.reject(new Error('需要服务端'));
    },
    disableAdminUser: function (id) {
      return getMode() === 'http' ? HttpAdapter.disableAdminUser(id) : Promise.reject(new Error('需要服务端'));
    },
    getKv: function (key, scope) {
      return getMode() === 'http' ? HttpAdapter.getKv(key, scope) : Promise.resolve({ payload: null });
    },
    putKv: function (key, payload, scope) {
      return getMode() === 'http' ? HttpAdapter.putKv(key, payload, scope) : Promise.resolve({ payload: payload });
    },
    removeKv: function (key, scope) {
      return getMode() === 'http' ? HttpAdapter.removeKv(key, scope) : Promise.resolve({ ok: true });
    },
    getMachineOps: function (kind) {
      return getMode() === 'http' ? HttpAdapter.getMachineOps(kind) : Promise.resolve({ rows: [] });
    },
    putMachineOps: function (kind, body) {
      return getMode() === 'http' ? HttpAdapter.putMachineOps(kind, body) : Promise.resolve({ ok: true });
    },
    clearMachineOps: function (kind) {
      return getMode() === 'http' ? HttpAdapter.clearMachineOps(kind) : Promise.resolve({ ok: true });
    },
    adapter: adapter
  };
})();


/* ========== js/api/inventory.js ========== */
/*
 * Author: zcl (MuBai)
 * Date: 2026-10-14
 * Role: Full-Stack Developer
 * 所属：frontend/api — 库存门面（S2：Http 模式下写路径强制 API，失败不静默成功）
 */
(function () {
  'use strict';

  var KEY = (typeof CMGShared !== 'undefined' && CMGShared.STORAGE_KEYS && CMGShared.STORAGE_KEYS.INVENTORY)
    ? CMGShared.STORAGE_KEYS.INVENTORY
    : 'inventory_check_v1';
  var VER = (typeof CMGShared !== 'undefined' && CMGShared.STORAGE_VERSION) ? CMGShared.STORAGE_VERSION : 1;

  function isHttp() {
    return typeof CMGApi !== 'undefined' && CMGApi.getMode && CMGApi.getMode() === 'http';
  }
  function forceApiWrite() {
    if (typeof window !== 'undefined' && window.__CMG_FORCE_API_WRITE__ === false) return false;
    return isHttp();
  }

  function normalizeList(list) {
    if (!Array.isArray(list)) return [];
    if (typeof CMGShared !== 'undefined' && CMGShared.dto && CMGShared.dto.inventory) {
      return list.map(function (row) { return CMGShared.dto.inventory.normalizeItem(row); });
    }
    return list;
  }

  function readLocal() {
    try {
      var raw = CMGUserStore.getItem(KEY);
      if (!raw) return [];
      var data = JSON.parse(raw);
      if (!data || data.v !== VER || !Array.isArray(data.items)) return [];
      return normalizeList(data.items);
    } catch (e) {
      return [];
    }
  }

  function writeLocal(items) {
    try {
      CMGUserStore.setItem(KEY, JSON.stringify({ v: VER, items: items || [], t: Date.now() }));
      return true;
    } catch (e) {
      console.warn('[CMGInventory] 本地保存失败', e);
      return false;
    }
  }

  function save(items) {
    items = normalizeList(items);
    /* 先本地持久化，保证刷新不丢；再尝试服务端同步 */
    writeLocal(items);
    if (forceApiWrite()) {
      return CMGApi.bulkInventory(items).then(function (res) {
        writeLocal(items);
        return { ok: true, count: (res && res.count) || items.length, server: true, local: true };
      }).catch(function (err) {
        var msg = (err && err.message) || '保存失败';
        if (typeof window.toast === 'function') {
          window.toast('云端同步失败（本地已保存）：' + msg, 'warning');
        }
        return { ok: true, error: msg, server: false, local: true, count: items.length };
      });
    }
    return Promise.resolve({ ok: true, local: true, count: items.length });
  }

  function load() {
    var local = readLocal();
    if (isHttp()) {
      return CMGApi.listInventory({ page: 1, pageSize: 50000 }).then(function (page) {
        var remote = normalizeList((page && page.items) || []);
        /* 服务端有数据用服务端并回写本地；否则保留本地导入结果 */
        if (remote.length) {
          writeLocal(remote);
          return remote;
        }
        if (local.length) {
          /* 本地有数据则回传服务端，避免刷新后只靠空库 */
          try { CMGApi.bulkInventory(local).catch(function () {}); } catch (eB) {}
        }
        return local;
      }).catch(function () {
        return local;
      });
    }
    return Promise.resolve(local);
  }

  function clear() {
    try { writeLocal([]); } catch (e0) {}
    try { localStorage.removeItem(KEY); } catch (e) {}
    try {
      if (typeof CMGUserStore !== 'undefined' && CMGUserStore.removeItem) CMGUserStore.removeItem(KEY);
    } catch (e2) {}
    return Promise.resolve({ ok: true });
  }

  window.CMGInventory = {
    load: load,
    save: save,
    readLocal: readLocal,
    writeLocal: writeLocal,
    clear: clear,
    normalizeList: normalizeList,
    forceApiWrite: forceApiWrite
  };
})();


/* ========== js/api/stocktake.js ========== */
/*
 * Author: zcl (MuBai)
 * Date: 2026-10-14
 * Role: Full-Stack Developer
 * 所属：frontend/api — 盘点报告（S2：Http 模式强制 stocktake API）
 */
(function () {
  'use strict';

  var KEY = (typeof CMGShared !== 'undefined' && CMGShared.STORAGE_KEYS && CMGShared.STORAGE_KEYS.SNAPSHOTS)
    ? CMGShared.STORAGE_KEYS.SNAPSHOTS
    : 'inventory_check_snapshots_v1';
  var LEGACY_KEY = 'inventory_check_snapshots_v1';

  function isHttp() {
    return typeof CMGApi !== 'undefined' && CMGApi.getMode && CMGApi.getMode() === 'http';
  }
  function forceApiWrite() {
    if (typeof window !== 'undefined' && window.__CMG_FORCE_API_WRITE__ === false) return false;
    return isHttp();
  }

  function readLocal() {
    try {
      var raw = CMGUserStore.getItem(KEY) || localStorage.getItem(LEGACY_KEY);
      var arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch (e) {
      return [];
    }
  }

  function writeLocal(list) {
    try {
      CMGUserStore.setItem(KEY, JSON.stringify(list || []));
      if (KEY !== LEGACY_KEY) {
        try { localStorage.setItem(LEGACY_KEY, JSON.stringify(list || [])); } catch (e2) {}
      }
      return true;
    } catch (e) {
      return false;
    }
  }

  function saveReport(snapshot) {
    if (forceApiWrite()) {
      return CMGApi.saveStocktake({
        title: snapshot.name,
        summary: {
          id: snapshot.id,
          savedAt: snapshot.savedAt,
          itemCount: snapshot.itemCount
        },
        items: snapshot.items || []
      }).then(function (res) {
        if (res && res.session && res.session.id) snapshot.serverId = res.session.id;
        var list = readLocal();
        list.unshift(snapshot);
        writeLocal(list);
        return { ok: true, snapshot: snapshot, server: res };
      }).catch(function (err) {
        var msg = (err && err.message) || '保存失败';
        if (typeof window.toast === 'function') window.toast('同步失败：' + msg, 'error');
        return { ok: false, error: msg, snapshot: snapshot };
      });
    }
    var list = readLocal();
    list.unshift(snapshot);
    writeLocal(list);
    return Promise.resolve({ ok: true, snapshot: snapshot, localOnly: true });
  }

  function listReports() {
    if (isHttp()) {
      return CMGApi.listStocktake().then(function (page) {
        return { local: readLocal(), server: (page && page.items) || [] };
      }).catch(function () {
        return { local: readLocal(), server: [] };
      });
    }
    return Promise.resolve({ local: readLocal(), server: [] });
  }

  function replaceAllLocal(list) {
    writeLocal(list || []);
    return Promise.resolve({ ok: true });
  }

  window.CMGStocktake = {
    saveReport: saveReport,
    listReports: listReports,
    readLocal: readLocal,
    writeLocal: writeLocal,
    replaceAllLocal: replaceAllLocal,
    STORAGE_KEY: KEY,
    forceApiWrite: forceApiWrite
  };
})();


/* ========== js/api/fileMagic.js ========== */
/*
 * Author: zcl (MuBai)
 * Date: 2026-10-14
 * Role: Full-Stack Developer
 * 所属：frontend/api — S4 上传魔数（文件头）校验
 */
(function () {
  'use strict';

  var SIGS = [
    { mime: 'image/jpeg', ext: ['jpg', 'jpeg'], bytes: [0xFF, 0xD8, 0xFF] },
    { mime: 'image/png', ext: ['png'], bytes: [0x89, 0x50, 0x4E, 0x47] },
    { mime: 'image/gif', ext: ['gif'], bytes: [0x47, 0x49, 0x46, 0x38] },
    { mime: 'image/webp', ext: ['webp'], bytes: [0x52, 0x49, 0x46, 0x46], webp: true },
    { mime: 'image/bmp', ext: ['bmp'], bytes: [0x42, 0x4D] }
  ];

  function matchSig(arr, sig) {
    for (var i = 0; i < sig.bytes.length; i++) {
      if (arr[i] !== sig.bytes[i]) return false;
    }
    if (sig.webp) {
      /* RIFF....WEBP */
      if (arr.length < 12) return false;
      return arr[8] === 0x57 && arr[9] === 0x45 && arr[10] === 0x42 && arr[11] === 0x50;
    }
    return true;
  }

  function detectMimeFromBytes(u8) {
    for (var i = 0; i < SIGS.length; i++) {
      if (matchSig(u8, SIGS[i])) return SIGS[i].mime;
    }
    return '';
  }

  function readFileHead(file, n) {
    n = n || 16;
    return new Promise(function (resolve, reject) {
      var blob = file.slice(0, n);
      var reader = new FileReader();
      reader.onload = function () {
        resolve(new Uint8Array(reader.result));
      };
      reader.onerror = function () { reject(reader.error); };
      reader.readAsArrayBuffer(blob);
    });
  }

  /** @returns {Promise<{ok:boolean, mime?:string, error?:string}>} */
  function validateImageFile(file) {
    if (!file) return Promise.resolve({ ok: false, error: '无文件' });
    return readFileHead(file, 16).then(function (u8) {
      var mime = detectMimeFromBytes(u8);
      if (!mime) return { ok: false, error: '文件内容不是允许的图片格式' };
      var declared = String(file.type || '').toLowerCase();
      if (declared && declared !== mime && !(declared === 'image/jpg' && mime === 'image/jpeg')) {
        /* 声明与魔数不一致时以魔数为准，仍允许（防错误 MIME） */
      }
      return { ok: true, mime: mime };
    }).catch(function () {
      return { ok: false, error: '无法读取文件头' };
    });
  }

  window.CMGFileMagic = {
    detectMimeFromBytes: detectMimeFromBytes,
    validateImageFile: validateImageFile,
    readFileHead: readFileHead
  };
})();


/* ========== js/core/bootstrap.js ========== */
/* js/core/bootstrap.js — 全局工具与初始化入口 */
(function () {
  'use strict';

  var PAGE_SIZE = 20;
  var PAGE_SIZE_OPTIONS = [10, 20, 50, 100, 200];
  var CODE_KEYS = ['商品编号', '编号', '编码', 'SKU', 'code', '货号', '物料编码'];
  var NAME_KEYS = ['商品名称', '名称', 'name', '品名', '物料名称'];
  var QTY_KEYS  = ['库存数量', '系统库存', '账面库存', '库存', '系统库存数量', '数量'];
  var BAR_KEYS  = ['条形码', '条码', 'barcode', '商品条码'];
  var CAT_KEYS  = ['商品分类', '分类', 'category'];

  var PAGE_INFO = {
    dashboard:  { title: '仓库看板',   subtitle: '汇总盘点执行、仓库库存与滞销消耗的全局实时数据' },
    scan:       { title: '扫码盘点',   subtitle: '导入账面库存，再通过 USB 扫码枪或摄像头录入实盘' },
    'scan-data':{ title: '盘点数据',   subtitle: '明细核对、账面基线、盘点报告与比对' },
    'wh-park':  { title: '仓库可视化', subtitle: 'Three.js 3D 园区：拖拽旋转/平移 · 滚轮缩放 · 点层查看商品库存 · 仓库设置可增删改' },
    'wh-docs': { title: '单据设置', subtitle: '按账期上传采购单据，关联采购单号与供应商' },
    'wh-stock': { title: '库存管理',   subtitle: '出入库动态监控、库存预警配置与礼品消耗分析' },
    help:       { title: '系统说明',   subtitle: '使用指南、设计初衷与最佳实践' },
    'admin-users': { title: '账号与权限', subtitle: '管理员分配账号、重置密码与功能访问权限（密码不可查看）' },
    'machine-profit':   { title: '机台毛利',   subtitle: '按周/月查看机台毛利，数据来自数据源导入' },
    'machine-ops':      { title: '运营数据',   subtitle: '机台运营指标与运行概况' },
    'machine-category': { title: '品类统计',   subtitle: '按品类汇总机台经营数据' },
    'finance-ledger': { title: '财务管理', subtitle: '数据看板、使用登记与记录查询' },
    'finance-board': { title: '额度看板', subtitle: '额度汇总与统计分析' },
    'finance-register': { title: '新增使用信息', subtitle: '登记使用支出信息' },
    'finance-records': { title: '使用记录', subtitle: '查询、导出与维护使用记录' },
    'finance-source': { title: '备用金设置', subtitle: '设定额度并维护来源渠道' },
    'finance-amount': { title: '备用金设置', subtitle: '设定额度并维护来源渠道' },
    'review-pending':  { title: '待审核',   subtitle: '新提交单据 · 审核人可接收后进入审核中' },
    'review-progress': { title: '审核中',   subtitle: '处理中 · 通过/驳回前须填写审核说明' },
    'review-passed':   { title: '已通过',   subtitle: '审核通过的登记（含审核说明）' },
    'review-rejected': { title: '已驳回',   subtitle: '审核驳回的登记（含驳回原因）' },
    'review-done':     { title: '审核记录', subtitle: '已通过与已驳回的汇总列表' },
    'admin-users': { title: '账号与权限', subtitle: '管理员分配账号、重置密码与功能访问权限' },
    help: { title: '系统说明', subtitle: '使用帮助与版本信息' },
    'other-demo-1': { title: 'Hometown', subtitle: '河南省信阳市商城县李集乡杨畈村古楼 · Three.js 三维示意' },
    'other-demo-2': { title: '示例菜单二', subtitle: 'OTher · Home 示例子页' },
    'other-demo-3': { title: '示例菜单三', subtitle: 'OTher · Home 示例子页' },
    'other-demo-4': { title: '示例菜单四', subtitle: 'OTher · Home 示例子页' },
    'other-demo-5': { title: '示例菜单五', subtitle: 'OTher · Home 示例子页' }
  };
  /* 路径白名单（所有合法跳转目标，唯一对应一个页面） */
  var PAGE_PATHS = {
    '/login': 'login',
    '/dashboard': 'dashboard',
    '/import': 'scan',
    '/scan': 'scan',
    '/scan/import': 'scan',
    '/scan/entry': 'scan',
    '/detail': 'scan-data',
    '/scan-data': 'scan-data',
    '/scan-data/detail': 'scan-data',
    '/scan-data/pre': 'scan-data',
    '/scan-data/reports': 'scan-data',
    '/scan-data/compare': 'scan-data',
    '/wh-park': 'wh-park',
    '/wh-stock': 'wh-stock',
    '/wh-docs': 'wh-docs',
    '/help': 'help',
    '/other-demo-1': 'other-demo-1',
    '/other-demo-2': 'other-demo-2',
    '/other-demo-3': 'other-demo-3',
    '/other-demo-4': 'other-demo-4',
    '/other-demo-5': 'other-demo-5',
    '/admin-users': 'admin-users',
    '/machine-profit': 'machine-profit',
    '/machine-profit/week': 'machine-profit',
    '/machine-profit/month': 'machine-profit',
    '/machine-profit/import': 'machine-profit',
    '/machine-ops': 'machine-ops',
    '/machine-category': 'machine-category',
    '/machine-category/import': 'machine-category',
    '/machine-category/analysis': 'machine-category',
    '/finance-ledger': 'finance-board',
    '/finance': 'finance-board',
    '/finance-board': 'finance-board',
    '/finance-register': 'finance-register',
    '/finance-records': 'finance-records',
    '/finance-source': 'finance-source',
    '/finance-amount': 'finance-amount',
    '/review-pending': 'review-pending',
    '/review-progress': 'review-progress',
    '/review-done': 'review-done',
    '/review-passed': 'review-passed',
    '/review-rejected': 'review-rejected'
  };
  /* 扫码盘点页子导航（数据导入 + 扫码录入，复用 sub-tabs） */
  var WORK_VIEWS = ['import', 'entry'];
  var WORK_VIEW_DEFAULT = 'import';
  var WORK_VIEW_INFO = {
    import: { title: '数据导入', subtitle: '从 Excel 导入账面库存，作为盘点的比对基线' },
    entry:  { title: '扫码录入', subtitle: '通过 USB 扫码枪或摄像头录入实盘数量' }
  };
  var currentWorkView = WORK_VIEW_DEFAULT;
  /* 盘点数据页子导航：明细 + 账面 + 报告 + 比对 */
  var SCAN_VIEWS = ['detail', 'pre', 'reports', 'compare'];
  var SCAN_VIEW_DEFAULT = 'detail';
  var SCAN_VIEW_INFO = {
    detail:  { title: '盘点明细',         subtitle: '查看、筛选和编辑所有商品盘点数据' },
    pre:     { title: '盘点前账面库存', subtitle: '导入时的原始账面数据，可作为比对基线随时导出' },
    reports: { title: '已保存盘点报告',   subtitle: '每次盘点保存的结果，可查看、导出、删除或直接发起比对' },
    compare: { title: '账面比对',         subtitle: '盘点前账面 vs 盘点后实盘，自动输出差异与准确率' }
  };
  var currentScanView = SCAN_VIEW_DEFAULT;
  /* 机台毛利子导航 */
  var MACHINE_PROFIT_VIEWS = ['week', 'month', 'import'];
  var MACHINE_PROFIT_VIEW_DEFAULT = 'week';
  var MACHINE_PROFIT_VIEW_INFO = {
    week:   { title: '周毛利数据', subtitle: '按自然周汇总各机台收入、成本与毛利' },
    month:  { title: '月毛利数据', subtitle: '按自然月汇总各机台收入、成本与毛利' },
    import: { title: '数据源导入', subtitle: '导入机台流水 Excel，作为毛利分析的唯一数据来源' }
  };
  var currentMachineProfitView = MACHINE_PROFIT_VIEW_DEFAULT;
  var CATEGORY_VIEWS = ['import', 'analysis'];
  var CATEGORY_VIEW_DEFAULT = 'import';
  var CATEGORY_VIEW_INFO = {
    import: { title: '数据导入', subtitle: '导入零售商品表，作为品类分析数据源' },
    analysis: { title: '品类分析', subtitle: '按商品名称、估算成本、供应商、分类与创建时间分析' }
  };
  var currentCategoryView = CATEGORY_VIEW_DEFAULT;

  var items = [];
  var lookup = new Map();
  /* 已保存的盘点历史快照（用户在盘点明细页「保存为盘点报告」后生成）
     [{ id, name, savedAt, itemCount, items: [...] }] */
  var SNAPSHOTS_KEY = (typeof CMGShared !== 'undefined' && CMGShared.STORAGE_KEYS && CMGShared.STORAGE_KEYS.SNAPSHOTS)
    ? CMGShared.STORAGE_KEYS.SNAPSHOTS
    : 'inventory_check_snapshots_v1';
  var savedSnapshots = [];
  var currentFilter = 'all';
  var searchKeyword = '';
  var currentPage = 1;
  var filteredIndexes = [];
  var lastHighlightId = null;
  var html5QrCode = null;
  var cameraRunning = false;
  var currentPageName = 'dashboard';

  function loadSnapshots() {
    if (typeof CMGStocktake !== 'undefined' && CMGStocktake.readLocal) {
      return CMGStocktake.readLocal();
    }
    try {
      var raw = localStorage.getItem(SNAPSHOTS_KEY);
      var arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch (err) { return []; }
  }
  function saveSnapshotsList() {
    if (typeof CMGStocktake !== 'undefined' && CMGStocktake.writeLocal) {
      CMGStocktake.writeLocal(savedSnapshots);
    } else {
      try { localStorage.setItem(SNAPSHOTS_KEY, JSON.stringify(savedSnapshots)); } catch (err) {}
    }
    /* 侧栏「盘点数据」徽标始终跟随报告份数（不依赖当前子页是否渲染） */
    var badge = $('menuScanDataBadge');
    if (badge) {
      badge.textContent = savedSnapshots.length;
      badge.style.display = savedSnapshots.length > 0 ? '' : 'none';
    }
  }
  var scanMode = 'none'; /* 'usb' | 'camera' | 'none' —— 扫码互斥 */

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
  window.escapeHtml = escapeHtml;



/* ========== js/core/auth.js ========== */
/* js/core/auth.js — 高安全登录门禁 · 双角色 · 权限分配 · 密码哈希永不回显 */
(function () {
  'use strict';

  /* 优先使用 shared 层（构建时已拼入）；缺失时回退本地定义 */
  var _S = (typeof CMGShared !== 'undefined') ? CMGShared : {};
  var AUTH_STORE = _S.AUTH_STORE || 'cmg_auth_vault_v1';
  var SESSION_KEY = _S.SESSION_KEY || 'cmg_session_v1';
  var SESSION_LOCK_KEY = _S.SESSION_LOCK_KEY || 'cmg_session_lock_v1';
  var PBKDF2_ITERS = _S.PBKDF2_ITERS || 120000;
  var SALT_BYTES = _S.SALT_BYTES || 16;
  var MAX_FAIL = _S.MAX_FAIL || 5;
  var LOCK_MS = _S.LOCK_MS || (5 * 60 * 1000);
  var SESSION_TTL_MS = _S.SESSION_TTL_MS || (8 * 60 * 60 * 1000);

  /** 功能权限键 — 与 shared/permissions.js、docs/openapi 对齐 */
  var FEATURES = _S.FEATURES || [
    { key: 'dashboard', label: '仓库看板' },
    { key: 'wh-park', label: '仓库可视化（仓库管理）' },
    { key: 'wh-stock', label: '库存管理（仓库管理）' },
    { key: 'wh-docs', label: '单据设置（仓库管理）' },
    { key: 'scan', label: '扫码盘点（盘点设置）' },
    { key: 'scan-data', label: '盘点数据（盘点设置）' },
    { key: 'machine-profit', label: '机台毛利' },
    { key: 'machine-ops', label: '运营数据' },
    { key: 'machine-category', label: '品类统计' },
    { key: 'finance-ledger', label: '财务管理' },
    { key: 'other-demo-1', label: 'Hometown（OTher）' },
    { key: 'other-demo-2', label: '示例菜单二（OTher）' },
    { key: 'other-demo-3', label: '示例菜单三（OTher）' },
    { key: 'other-demo-4', label: '示例菜单四（OTher）' },
    { key: 'other-demo-5', label: '示例菜单五（OTher）' },
    { key: 'help', label: '系统说明' },
    { key: 'admin-users', label: '账号与权限（仅管理员）' }
  ];

  function $(id) { return document.getElementById(id); }

  function bufToHex(buf) {
    return Array.from(new Uint8Array(buf)).map(function (b) {
      return b.toString(16).padStart(2, '0');
    }).join('');
  }
  function hexToBuf(hex) {
    var len = hex.length / 2;
    var out = new Uint8Array(len);
    for (var i = 0; i < len; i++) out[i] = parseInt(hex.substr(i * 2, 2), 16);
    return out.buffer;
  }
  function randomHex(bytes) {
    var a = new Uint8Array(bytes);
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      crypto.getRandomValues(a);
    } else {
      for (var i = 0; i < bytes; i++) a[i] = Math.floor(Math.random() * 256);
    }
    return bufToHex(a);
  }

  function getSubtle() {
    try {
      if (typeof crypto !== 'undefined' && crypto.subtle && typeof crypto.subtle.importKey === 'function') {
        return crypto.subtle;
      }
    } catch (e) {}
    return null;
  }

  /** 纯 JS SHA-256（仅作 subtle 不可用时的回退，如 file:// 或非安全 HTTP） */
  function sha256Bytes(dataBytes) {
    function rotr(n, x) { return (x >>> n) | (x << (32 - n)); }
    var K = [
      0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
      0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
      0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
      0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
      0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
      0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
      0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
      0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2
    ];
    var h0 = 0x6a09e667, h1 = 0xbb67ae85, h2 = 0x3c6ef372, h3 = 0xa54ff53a;
    var h4 = 0x510e527f, h5 = 0x9b05688c, h6 = 0x1f83d9ab, h7 = 0x5be0cd19;
    var l = dataBytes.length;
    var withOne = new Uint8Array(((l + 9 + 63) & ~63));
    withOne.set(dataBytes);
    withOne[l] = 0x80;
    var bitLen = l * 8;
    withOne[withOne.length - 1] = bitLen & 0xff;
    withOne[withOne.length - 2] = (bitLen >>> 8) & 0xff;
    withOne[withOne.length - 3] = (bitLen >>> 16) & 0xff;
    withOne[withOne.length - 4] = (bitLen >>> 24) & 0xff;
    var w = new Uint32Array(64);
    for (var i = 0; i < withOne.length; i += 64) {
      for (var j = 0; j < 16; j++) {
        var o = i + j * 4;
        w[j] = (withOne[o] << 24) | (withOne[o + 1] << 16) | (withOne[o + 2] << 8) | withOne[o + 3];
      }
      for (var j = 16; j < 64; j++) {
        var s0 = rotr(7, w[j - 15]) ^ rotr(18, w[j - 15]) ^ (w[j - 15] >>> 3);
        var s1 = rotr(17, w[j - 2]) ^ rotr(19, w[j - 2]) ^ (w[j - 2] >>> 10);
        w[j] = (w[j - 16] + s0 + w[j - 7] + s1) | 0;
      }
      var a = h0, b = h1, c = h2, d = h3, e = h4, f = h5, g = h6, h = h7;
      for (var j = 0; j < 64; j++) {
        var S1 = rotr(6, e) ^ rotr(11, e) ^ rotr(25, e);
        var ch = (e & f) ^ (~e & g);
        var t1 = (h + S1 + ch + K[j] + w[j]) | 0;
        var S0 = rotr(2, a) ^ rotr(13, a) ^ rotr(22, a);
        var maj = (a & b) ^ (a & c) ^ (b & c);
        var t2 = (S0 + maj) | 0;
        h = g; g = f; f = e; e = (d + t1) | 0;
        d = c; c = b; b = a; a = (t1 + t2) | 0;
      }
      h0 = (h0 + a) | 0; h1 = (h1 + b) | 0; h2 = (h2 + c) | 0; h3 = (h3 + d) | 0;
      h4 = (h4 + e) | 0; h5 = (h5 + f) | 0; h6 = (h6 + g) | 0; h7 = (h7 + h) | 0;
    }
    var out = new Uint8Array(32);
    var hs = [h0, h1, h2, h3, h4, h5, h6, h7];
    for (var i = 0; i < 8; i++) {
      out[i * 4] = (hs[i] >>> 24) & 0xff;
      out[i * 4 + 1] = (hs[i] >>> 16) & 0xff;
      out[i * 4 + 2] = (hs[i] >>> 8) & 0xff;
      out[i * 4 + 3] = hs[i] & 0xff;
    }
    return out;
  }

  function pbkdf2Sha256Fallback(password, saltHex, iterations, dkLen) {
    var enc = new TextEncoder();
    var pwd = enc.encode(String(password));
    var salt = new Uint8Array(hexToBuf(saltHex));
    var blockCount = Math.ceil(dkLen / 32);
    var result = new Uint8Array(blockCount * 32);
    for (var block = 1; block <= blockCount; block++) {
      var blockBytes = new Uint8Array(4);
      blockBytes[0] = (block >>> 24) & 0xff;
      blockBytes[1] = (block >>> 16) & 0xff;
      blockBytes[2] = (block >>> 8) & 0xff;
      blockBytes[3] = block & 0xff;
      var asalt = new Uint8Array(salt.length + 4);
      asalt.set(salt);
      asalt.set(blockBytes, salt.length);
      /* HMAC-SHA256(password, asalt) via hash(o_key XOR opad || hash(i_key XOR ipad || msg)) simplified: use sha256(pwd||msg) chain */
      /* 简化版：迭代 sha256(pwd || salt || counter || prev) —— 与 WebCrypto PBKDF2 不互通，仅用于非安全上下文本地库 */
      var prev = sha256Bytes(function () {
        var x = new Uint8Array(pwd.length + asalt.length);
        x.set(pwd); x.set(asalt, pwd.length); return x;
      }());
      var out = prev.slice();
      for (var i = 1; i < iterations; i++) {
        var mixed = new Uint8Array(pwd.length + prev.length);
        mixed.set(pwd); mixed.set(prev, pwd.length);
        prev = sha256Bytes(mixed);
        for (var j = 0; j < 32; j++) out[j] ^= prev[j];
      }
      result.set(out, (block - 1) * 32);
    }
    return bufToHex(result.subarray(0, dkLen).buffer);
  }

  function hashPassword(password, saltHex) {
    var subtle = getSubtle();
    if (subtle) {
      var enc = new TextEncoder();
      var salt = hexToBuf(saltHex);
      return subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits'])
        .then(function (key) {
          return subtle.deriveBits(
            { name: 'PBKDF2', salt: salt, iterations: PBKDF2_ITERS, hash: 'SHA-256' },
            key,
            256
          );
        })
        .then(function (bits) { return bufToHex(bits); });
    }
    /* S1：默认禁止弱回退；仅演示开关 window.__CMG_ALLOW_INSECURE_CRYPTO__ = true */
    if (typeof window !== 'undefined' && window.__CMG_ALLOW_INSECURE_CRYPTO__) {
      var iters = Math.min(PBKDF2_ITERS, 12000);
      return new Promise(function (resolve) {
        setTimeout(function () {
          resolve(pbkdf2Sha256Fallback(password, saltHex, iters, 32));
        }, 0);
      });
    }
    return Promise.reject(new Error('当前非安全上下文，无法加密密码。请使用 http://localhost 访问，或启动 backend 使用服务端登录。'));
  }

  function timingSafeEqual(a, b) {
    if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
    var diff = 0;
    for (var i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
    return diff === 0;
  }

  function loadVault() {
    try {
      var raw = localStorage.getItem(AUTH_STORE);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) {
      console.warn('[Auth] localStorage 不可用（Tracking Prevention / 隐私模式）', e);
      return null;
    }
  }
  function saveVault(vault) {
    try {
      localStorage.setItem(AUTH_STORE, JSON.stringify(vault));
    } catch (e) {
      console.warn('[Auth] 无法写入 localStorage', e);
    }
  }

  function isSuperAdminSession(s) {
    if (!s) return false;
    if (s.role === 'super_admin') return true;
    /* 过渡：迁移前已登录的 admin 账号，按 vault 再判定一次 */
    try {
      var vault = loadVault();
      if (!vault) return false;
      var u = (vault.users || []).find(function (x) { return x && x.id === s.userId && !x.deleted; });
      return !!(u && u.role === 'super_admin');
    } catch (e) { return false; }
  }
  function isPrivilegedRole(role) {
    return role === 'super_admin' || role === 'admin';
  }
  function migrateVaultRoles(vault) {
    if (!vault || !Array.isArray(vault.users)) return vault;
    var hasSuper = vault.users.some(function (u) { return u && !u.deleted && u.role === 'super_admin'; });
    if (hasSuper) return vault;
    var admins = vault.users.filter(function (u) {
      return u && !u.deleted && u.role === 'admin';
    }).sort(function (a, b) { return (a.createdAt || 0) - (b.createdAt || 0); });
    if (admins.length) {
      var pick = admins.find(function (u) { return u.username === 'admin' || u.id === 'u_admin'; }) || admins[0];
      pick.role = 'super_admin';
      pick.features = allFeatureKeys('super_admin');
      pick.updatedAt = Date.now();
      saveVault(vault);
    }
    return vault;
  }
  function allFeatureKeys(role) {
    return FEATURES.map(function (f) {
      if (f.key === 'admin-users' && role !== 'super_admin') return null;
      return f.key;
    }).filter(Boolean);
  }

  function ensureVault() {
    var v = loadVault();
    if (v && Array.isArray(v.users) && v.users.length) {
      migrateVaultRoles(v);
      return Promise.resolve(v);
    }
    var salt = randomHex(SALT_BYTES);
    /* S1：禁止源码固定口令；首次生成随机密码，仅弹窗展示一次 */
    var bootstrapPwd = (function () {
      var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$';
      var a = new Uint8Array(16);
      if (typeof crypto !== 'undefined' && crypto.getRandomValues) crypto.getRandomValues(a);
      else for (var i = 0; i < 16; i++) a[i] = Math.floor(Math.random() * 256);
      var s = '';
      for (var j = 0; j < 16; j++) s += chars[a[j] % chars.length];
      return s;
    })();
    return hashPassword(bootstrapPwd, salt).then(function (hash) {
      v = {
        version: 1,
        createdAt: Date.now(),
        users: [{
          id: 'u_admin',
          username: 'admin',
          role: 'super_admin',
          salt: salt,
          hash: hash,
          mustChangePwd: true,
          enabled: true,
          features: allFeatureKeys('super_admin'),
          createdAt: Date.now(),
          updatedAt: Date.now()
        }],
        failLog: {}
      };
      saveVault(v);
      /* 服务端登录为主：不再弹窗展示本地演示库初始密码 */
      try { console.info('[Auth] local vault ready (silent)'); } catch (e) {}
      return v;
    }).catch(function (err) {
      console.error('[Auth] ensureVault 失败:', err);
      try {
        if (typeof window.showModal === 'function') {
          window.showModal(String(err && err.message || err), 'alert');
        }
      } catch (e2) {}
      return { version: 1, users: [], createdAt: Date.now(), failLog: {}, _broken: true };
    });
  }

  var IDLE_MS = 30 * 60 * 1000;
  var SERVER_IDLE_MS = 12 * 60 * 60 * 1000;

  function readSessionLock() {
    try {
      var raw = localStorage.getItem(SESSION_LOCK_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) { return null; }
  }
  function writeSessionLock(s) {
    try {
      localStorage.setItem(SESSION_LOCK_KEY, JSON.stringify({
        sessionId: s.sessionId,
        userId: s.userId,
        username: s.username,
        token: s.token,
        at: Date.now()
      }));
    } catch (e) {}
  }
  function clearSessionLock() {
    try { localStorage.removeItem(SESSION_LOCK_KEY); } catch (e) {}
  }
  function syncSessionFromVault(s) {
    /* 仅当本地 vault 有对应用户时同步；服务端登录用户不在 vault 中，不得清会话 */
    try {
      if (!s || !s.userId) return s;
      if (s.source === 'server') return s;
      var vault = loadVault();
      if (!vault || !Array.isArray(vault.users)) return s;
      var u = vault.users.find(function (x) { return x && x.id === s.userId && !x.deleted; });
      if (!u) return s;
      if (!u.enabled) return null;
      s.role = u.role;
      s.username = u.username;
      s.features = (u.features || []).slice();
      s.mustChangePwd = !!u.mustChangePwd;
      return s;
    } catch (e) { return s; }
  }
  function getSession() {
    try {
      var raw = sessionStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      var s = JSON.parse(raw);
      if (!s || !s.token || !s.exp || Date.now() > s.exp) {
        sessionStorage.removeItem(SESSION_KEY);
        return null;
      }
      var idleLimit = (s.source === 'server') ? SERVER_IDLE_MS : IDLE_MS;
      if (s.lastSeen && Date.now() - s.lastSeen > idleLimit) {
        sessionStorage.removeItem(SESSION_KEY);
        try { sessionStorage.removeItem(TOKEN_KEY); } catch (eIdle) {}
        return null;
      }
      /* 兼容旧会话：无 sessionId 时补发并写入锁，避免误判无权限 */
      if (!s.sessionId) {
        s.sessionId = randomHex(16);
        writeSessionLock(s);
      } else {
        var lock = readSessionLock();
        if (!lock) {
          /* 锁丢失：本页会话自愈，写回锁（支持换账号登录） */
          writeSessionLock(s);
        } else if (lock.sessionId !== s.sessionId) {
          /* 其它标签页已用不同账号登录 → 本页失效（仅比 sessionId，避免 JWT 字符串误判） */
          try { sessionStorage.removeItem(SESSION_KEY); } catch (e0) {}
          try { sessionStorage.removeItem(TOKEN_KEY); } catch (e0b) {}
          return null;
        } else if (lock.userId && s.userId && lock.userId !== s.userId) {
          try { sessionStorage.removeItem(SESSION_KEY); } catch (e0c) {}
          return null;
        }
      }
      s = syncSessionFromVault(s);
      if (!s) {
        try { sessionStorage.removeItem(SESSION_KEY); } catch (e4) {}
        return null;
      }
      s.lastSeen = Date.now();
      try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(s)); } catch (e2) {}
      return s;
    } catch (e) {
      try { sessionStorage.removeItem(SESSION_KEY); } catch (e3) {}
      return null;
    }
  }
  function setSession(user) {
    var s = {
      token: randomHex(32),
      sessionId: randomHex(16),
      userId: user.id,
      username: user.username,
      role: user.role,
      features: (user.features || []).slice(),
      mustChangePwd: !!user.mustChangePwd,
      exp: Date.now() + SESSION_TTL_MS,
      lastSeen: Date.now()
    };
    /* 换账号登录：覆盖本页会话与全局锁，允许不同账号依次登录 */
    try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(s)); } catch (e) {}
    writeSessionLock(s);
    return s;
  }
  function clearSession() {
    try {
      var raw = sessionStorage.getItem(SESSION_KEY);
      if (raw) {
        var s = JSON.parse(raw);
        var lock = readSessionLock();
        if (lock && s && lock.sessionId === s.sessionId) clearSessionLock();
      }
    } catch (e) {}
    try { sessionStorage.removeItem(SESSION_KEY); } catch (e2) {}
  }

  function publicUser(u) {
    return {
      id: u.id,
      username: u.username,
      role: u.role,
      enabled: !!u.enabled,
      mustChangePwd: !!u.mustChangePwd,
      features: (u.features || []).slice(),
      paid: !!u.paid,
      validFrom: u.validFrom || null,
      validUntil: u.validUntil || null,
      createdAt: u.createdAt,
      updatedAt: u.updatedAt
    };
  }

  function findUser(vault, username) {
    var name = String(username || '').trim().toLowerCase();
    /* 已软删除的账号不参与登录匹配 */
    return (vault.users || []).find(function (u) {
      if (u.deleted) return false;
      return String(u.username || '').toLowerCase() === name;
    }) || null;
  }

  function isLocked(vault, username) {
    var key = String(username || '').trim().toLowerCase();
    var log = (vault.failLog && vault.failLog[key]) || null;
    if (!log) return false;
    if (log.count >= MAX_FAIL && log.until && Date.now() < log.until) return true;
    if (log.until && Date.now() >= log.until) {
      delete vault.failLog[key];
      saveVault(vault);
      return false;
    }
    return false;
  }
  function recordFail(vault, username) {
    var key = String(username || '').trim().toLowerCase();
    if (!vault.failLog) vault.failLog = {};
    var log = vault.failLog[key] || { count: 0, until: 0 };
    log.count += 1;
    if (log.count >= MAX_FAIL) log.until = Date.now() + LOCK_MS;
    vault.failLog[key] = log;
    saveVault(vault);
    return log;
  }
  function clearFail(vault, username) {
    var key = String(username || '').trim().toLowerCase();
    if (vault.failLog && vault.failLog[key]) {
      delete vault.failLog[key];
      saveVault(vault);
    }
  }

  function loginLocal(username, password) {
    return ensureVault().then(function (vault) {
      username = String(username || '').trim();
      password = String(password || '');
      if (!username || !password) return { ok: false, error: '请输入账号名称和密码' };
      if (isLocked(vault, username)) {
        return { ok: false, error: '尝试次数过多，账号已临时锁定，请约 5 分钟后再试' };
      }
      var user = findUser(vault, username);
      if (!user || !user.enabled) {
        recordFail(vault, username);
        return { ok: false, error: '账号或密码错误' };
      }
      return hashPassword(password, user.salt).then(function (h) {
        if (!timingSafeEqual(h, user.hash)) {
          var log = recordFail(vault, username);
          var left = Math.max(0, MAX_FAIL - log.count);
          return {
            ok: false,
            error: left > 0
              ? ('账号或密码错误（还可尝试 ' + left + ' 次）')
              : '尝试次数过多，账号已临时锁定约 5 分钟'
          };
        }
        clearFail(vault, username);
        var session = setSession(user);
        /* 本地登录无 JWT：清掉可能残留的伪 token，避免 401 */
        try {
          if (typeof CMGApi !== 'undefined') {
            if (CMGApi.setToken) CMGApi.setToken('');
            if (CMGApi.setMode) CMGApi.setMode('local');
          }
        } catch (eClr) {}
        return { ok: true, session: session, mustChangePwd: !!user.mustChangePwd, source: 'local' };
      });
    });
  }

  /** 服务端登录：CMGApi.login → 写入本地会话形态，便于现有菜单权限复用 */
  var BACKEND_DOWN_MSG = '系统服务暂不可用，请稍后重试或联系管理员。';

  function notifyBackendDown(msg) {
    msg = msg || BACKEND_DOWN_MSG;
    if (typeof window.showModal === 'function') {
      window.showModal(msg, 'alert');
    } else if (typeof showModal === 'function') {
      showModal(msg, 'alert');
    } else if (typeof window.toast === 'function') {
      window.toast(msg, 'error');
    } else {
      try { alert(msg); } catch (e) {}
    }
  }

  /** 探测 backend /health，超时视为未启动 */
  function checkBackendReady(timeoutMs) {
    timeoutMs = timeoutMs || 2500;
    var bases = [];
    if (typeof CMGApi !== 'undefined' && CMGApi.getBase) bases.push(CMGApi.getBase());
    /* 静态站在 :8080 时 /api 常无反代，回退直连 backend :3001 */
    bases.push('http://127.0.0.1:3001/api/v1');
    bases.push('http://localhost:3001/api/v1');
    var uniq = [];
    bases.forEach(function (b) {
      if (b && uniq.indexOf(b) < 0) uniq.push(b);
    });
    function tryOne(i) {
      if (i >= uniq.length) return Promise.resolve(false);
      var base = uniq[i];
      var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
      var timer = setTimeout(function () {
        if (ctrl) try { ctrl.abort(); } catch (e) {}
      }, timeoutMs);
      var opts = { method: 'GET', credentials: 'omit' };
      if (ctrl) opts.signal = ctrl.signal;
      return fetch(base + '/health', opts)
        .then(function (res) {
          clearTimeout(timer);
          /* 能连上端口即视为后端已启动（2xx/4xx 均可；仅网络失败才重试） */
          if (res.status > 0) {
            if (typeof window !== 'undefined') window.CMG_API_BASE = base;
            return true;
          }
          return tryOne(i + 1);
        })
        .catch(function () {
          clearTimeout(timer);
          return tryOne(i + 1);
        });
    }
    return tryOne(0);
  }

  function loginServer(username, password) {
    username = String(username || '').trim();
    password = String(password || '');
    if (!username || !password) {
      return Promise.resolve({ ok: false, error: '请输入账号名称和密码' });
    }
    if (typeof CMGApi === 'undefined' || !CMGApi.login) {
      notifyBackendDown('登录服务暂不可用');
      return Promise.resolve({ ok: false, error: '登录服务暂不可用' });
    }
    var prevMode = CMGApi.getMode ? CMGApi.getMode() : 'local';
    return checkBackendReady(2500).then(function (ok) {
      if (!ok) {
        notifyBackendDown(BACKEND_DOWN_MSG);
                if (CMGApi.setMode) CMGApi.setMode(prevMode === 'http' ? 'local' : prevMode);
        return { ok: false, error: BACKEND_DOWN_MSG };
      }
      if (CMGApi.setMode) CMGApi.setMode('http');
      return CMGApi.login(username, password).then(function (data) {
        if (!data || !data.user) {
          return { ok: false, error: '登录失败，请稍后重试' };
        }
        var jwt = data.accessToken || data.token;
        if (!jwt) {
          return { ok: false, error: '登录失败，请稍后重试' };
        }
        var u = data.user;
        var session = {
          token: jwt,
          sessionId: data.sessionId || randomHex(16),
          userId: u.id || u.userId,
          username: u.username,
          role: u.role,
          features: u.features || [],
          mustChangePwd: !!u.mustChangePwd,
          exp: Date.now() + SESSION_TTL_MS,
          lastSeen: Date.now(),
          source: 'server'
        };
        try {
          sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
          writeSessionLock(session);
        } catch (e) {}
        if (CMGApi.setToken) CMGApi.setToken(jwt);
        if (CMGApi.setMode) CMGApi.setMode('http');
        try { sessionStorage.setItem('cmg_api_token', jwt); } catch (eTok2) {}
        return { ok: true, session: session, mustChangePwd: !!u.mustChangePwd, source: 'server' };
      }).catch(function (err) {
        if (CMGApi.setMode) CMGApi.setMode(prevMode);
        var msg = (err && err.data && (err.data.message || err.data.error)) || (err && err.message) || '登录失败';
        if (Array.isArray(msg)) msg = msg.join('; ');
        if (/^Unauthorized$/i.test(String(msg))) msg = '账号或密码错误';
        if (err && (err.status === 0 || err.name === 'TypeError')) {
          msg = BACKEND_DOWN_MSG;
          notifyBackendDown(msg);
                  } else if (err && err.status === 501) {
          msg = '登录服务异常，请稍后重试';
          notifyBackendDown(msg);
        }
        return { ok: false, error: msg };
      });
    });
  }

  /**
   * @param {string} username
   * @param {string} password
   * @param {{ useServer?: boolean }} [opts]
   */
  function login(username, password, opts) {
    opts = opts || {};
    /* 统一走服务端登录：账号与业务数据写入 PostgreSQL，不再提供本地登录开关 */
    return loginServer(username, password);
  }

  function logout() {
    closeAccountPanel();
    clearSession();
    if (typeof CMGApi !== 'undefined' && CMGApi.logout) {
      try { CMGApi.logout(); } catch (e) {}
    }
    if (typeof CMGApi !== 'undefined' && CMGApi.setToken) CMGApi.setToken('');
    showGate(true);
    try {
      if (location.hash !== '#/login') history.replaceState(null, '', '#/login');
    } catch (e2) {}
  }

  function onSessionLockChanged() {
    var s = null;
    try {
      var raw = sessionStorage.getItem(SESSION_KEY);
      if (raw) s = JSON.parse(raw);
    } catch (e) { s = null; }
    var lock = readSessionLock();
    if (!s) return;
    if (!lock || lock.sessionId !== s.sessionId || lock.token !== s.token) {
      try { sessionStorage.removeItem(SESSION_KEY); } catch (e2) {}
      showGate(true);
      try { if (location.hash !== '#/login') history.replaceState(null, '', '#/login'); } catch (e3) {}
      if (typeof toast === 'function') {
        toast('账号已在其它标签页登录或登出，本页会话已失效，请重新登录', 'warning');
      }
    }
  }
  if (!window.__cmgSessionLockBound) {
    window.__cmgSessionLockBound = true;
    window.addEventListener('storage', function (e) {
      if (e.key === SESSION_LOCK_KEY) onSessionLockChanged();
    });
  }

  function current() {
    return getSession();
  }

  function hasFeature(key) {
    var s = getSession();
    if (!s) return false;
    if (key === 'admin-users') return isSuperAdminSession(s);
    if (isPrivilegedRole(s.role)) return true;
    var feats = s.features || [];
    if (feats.indexOf(key) >= 0) return true;
    /* 勾选「财务管理」后，所有子功能与审核中心对普通账号可用 */
    if (key && (String(key).indexOf('finance-') === 0 || String(key).indexOf('review-') === 0)) {
      return feats.indexOf('finance-ledger') >= 0;
    }
    return false;
  }

  function requireAuth() {
    return !!getSession();
  }

  /* —— UI —— */
  function markAuthReady(needLogin) {
    var html = document.documentElement;
    /* 先进入 settling：继续禁止过渡，再切 ready，避免闪屏抖动 */
    html.classList.add('auth-settling');
    html.classList.remove('auth-boot', 'auth-need-login', 'auth-has-session');
    html.classList.add('auth-ready');
    html.classList.add(needLogin ? 'auth-need-login' : 'auth-has-session');
    document.body.classList.remove('auth-pending');
    /* 双 rAF + 短延时后解除 settling，再允许过渡 */
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        setTimeout(function () {
          html.classList.remove('auth-settling', 'sidebar-boot-collapsed');
        }, 120);
      });
    });
  }

  function setLoginRoute() {
    try {
      if (location.hash !== '#/login') history.replaceState(null, '', '#/login');
    } catch (e) {
      location.hash = '#/login';
    }
  }
  function setDefaultAppRoute() {
    var h = (location.hash || '').replace(/^#/, '');
    if (!h || h === '/login' || h === 'login') {
      try {
        history.replaceState(null, '', '#/dashboard');
      } catch (e) {
        location.hash = '#/dashboard';
      }
      if (typeof window.switchPage === 'function') {
        try { window.switchPage('dashboard'); } catch (e2) {}
      } else if (typeof _applyPage === 'function') {
        try { _applyPage('dashboard'); } catch (e3) {}
      }
    }
  }
  function showGate(show) {
    if (show) setLoginRoute();
    var html = document.documentElement;
    html.classList.add('auth-settling');
    var gate = $('authGate');
    var app = document.querySelector('.app-layout');
    if (gate) {
      if (show) {
        gate.hidden = false;
        gate.removeAttribute('hidden');
        gate.classList.add('is-open');
        gate.style.display = 'flex';
        gate.style.visibility = 'visible';
        gate.style.opacity = '1';
      } else {
        gate.hidden = true;
        gate.setAttribute('hidden', '');
        gate.classList.remove('is-open');
        gate.style.display = 'none';
        gate.style.visibility = 'hidden';
        gate.style.opacity = '0';
      }
    }
    if (app) {
      if (show) {
        app.style.visibility = 'hidden';
        app.style.opacity = '0';
        app.style.pointerEvents = 'none';
      } else {
        app.style.visibility = 'visible';
        app.style.opacity = '1';
        app.style.pointerEvents = '';
      }
    }
    document.body.classList.toggle('auth-locked', !!show);
    if (!show) {
      document.body.style.background = '#ffffff';
    } else {
      document.body.style.background = '#0a0a0a';
    }
    markAuthReady(!!show);
  }

  var _contactUrlCache = '';
  function getContactUrl() {
    /* 建议6：优先使用服务端 /meta/config 下发；否则回退本地混淆串 */
    if (_contactUrlCache) return _contactUrlCache;
    if (typeof window !== 'undefined' && window.__CMG_CONTACT_URL__) {
      _contactUrlCache = String(window.__CMG_CONTACT_URL__);
      return _contactUrlCache;
    }
    var parts = [104,116,116,112,115,58,47,47,113,109,46,113,113,46,99,111,109,47,113,47,99,106,53,120,111,98,55,68,109,85];
    return String.fromCharCode.apply(null, parts);
  }

  function refreshContactConfig() {
    if (typeof CMGApi === 'undefined' || !CMGApi.getMode || CMGApi.getMode() !== 'http') return;
    var base = CMGApi.getBase ? CMGApi.getBase() : '/api/v1';
    fetch(base + '/meta/config').then(function (r) { return r.json(); }).then(function (cfg) {
      if (cfg && cfg.contactAdminUrl) {
        _contactUrlCache = String(cfg.contactAdminUrl);
        window.__CMG_CONTACT_URL__ = _contactUrlCache;
      }
    }).catch(function () {});
  }

  var authQrRefreshTimer = null;
  var AUTH_QR_REFRESH_SEC = 12;

  function clearAuthQrTimer() {
    if (authQrRefreshTimer) {
      clearTimeout(authQrRefreshTimer);
      authQrRefreshTimer = null;
    }
    if (typeof clearAuthQrCountdown === 'function') clearAuthQrCountdown();
  }

  function renderAdminContactQr(fromRefresh) {
    var canvas = $('authAdminQrCanvas');
    var fallback = $('authQrFallback');
    var tip = $('authQrTip');
    if (!canvas) return;
    var url = getContactUrl();
    /* 带时间戳，保证每次绘制内容变化（防缓存、可感知刷新） */
    try {
      var sep = url.indexOf('?') >= 0 ? '&' : '?';
      url = url + sep + '_t=' + Date.now();
    } catch (eT) {}
    function fail() {
      if (fallback) fallback.hidden = false;
      canvas.style.display = 'none';
      if (tip) tip.textContent = '二维码加载失败，请切换页签后重试';
    }
    function ok() {
      canvas.style.display = 'block';
      if (fallback) fallback.hidden = true;
      if (tip) {
        var base = fromRefresh
          ? '二维码已自动刷新，请使用手机扫描'
          : '请使用手机扫描二维码联系管理员';
        tip.innerHTML = base + ' · <span id="authQrCountdown">' + AUTH_QR_REFRESH_SEC + '</span>s 后刷新';
      }
      /* 绘制成功后重新启动倒计时循环 */
      scheduleAuthQrRefreshLoop();
    }
    try {
      if (typeof QRCode !== 'undefined' && QRCode.toCanvas) {
        QRCode.toCanvas(canvas, url, {
          width: 200,
          margin: 1,
          color: { dark: '#0f172a', light: '#ffffff' }
        }, function (err) {
          if (err) fail();
          else ok();
        });
      } else {
        console.warn('[Auth] QRCode.toCanvas 不可用，请确认已加载 vendor/qrcode-adapter.js');
        fail();
      }
    } catch (e) {
      fail();
    }
  }

  var authQrCountdownTimer = null;

  function clearAuthQrCountdown() {
    if (authQrCountdownTimer) {
      clearInterval(authQrCountdownTimer);
      authQrCountdownTimer = null;
    }
  }

  /** 每 12 秒循环刷新二维码；倒计时归零后立即重绘并重新计时 */
  function scheduleAuthQrRefreshLoop() {
    clearAuthQrTimer();
    clearAuthQrCountdown();
    var left = AUTH_QR_REFRESH_SEC;
    function paint() {
      var el = $('authQrCountdown');
      if (el) el.textContent = String(Math.max(0, left));
    }
    paint();
    authQrCountdownTimer = setInterval(function () {
      left -= 1;
      if (left <= 0) {
        clearAuthQrCountdown();
        paint();
        return;
      }
      paint();
    }, 1000);
    authQrRefreshTimer = setTimeout(function () {
      authQrRefreshTimer = null;
      clearAuthQrCountdown();
      renderAdminContactQr(true);
    }, AUTH_QR_REFRESH_SEC * 1000);
  }

  function switchAuthView(name) {
    document.querySelectorAll('[data-auth-view]').forEach(function (el) {
      el.hidden = el.getAttribute('data-auth-view') !== name;
    });
    document.querySelectorAll('[data-auth-tab]').forEach(function (btn) {
      btn.classList.toggle('active', btn.getAttribute('data-auth-tab') === name);
    });
    if (name === 'contact') {
      clearAuthQrTimer();
      renderAdminContactQr(false);
    } else {
      clearAuthQrTimer();
    }
  }

  function applyMenuPermissions() {
    var s = getSession();
    if (!s) return;
    document.querySelectorAll('#sidebarMenu .menu-item[data-page]').forEach(function (item) {
      var page = item.getAttribute('data-page');
      var allow = hasFeature(page);
      item.style.display = allow ? '' : 'none';
    });
    document.querySelectorAll('#sidebarMenu .menu-group').forEach(function (grp) {
      var visible = Array.prototype.some.call(grp.querySelectorAll('.menu-item[data-page]'), function (it) {
        return it.style.display !== 'none';
      });
      grp.style.display = visible ? '' : 'none';
    });
    var adminItem = document.querySelector('.menu-item[data-page="admin-users"]');
    if (adminItem) adminItem.style.display = isSuperAdminSession(s) ? '' : 'none';
    var settingsGroup = document.getElementById('menuGroupSettings');
    if (settingsGroup) settingsGroup.style.display = 'none';
    var accSettings = $('btnAccountSettings');
    if (accSettings) {
      accSettings.style.display = isSuperAdminSession(s) ? 'flex' : 'none';
    }
    var accPwd = $('btnChangePwd');
    if (accPwd) {
      accPwd.style.display = 'flex';
      accPwd.style.visibility = 'visible';
      accPwd.hidden = false;
      accPwd.removeAttribute('hidden');
    }
    var roleLabel = s.role === 'super_admin' ? '超级管理员' : (s.role === 'admin' ? '管理员' : '普通用户');
    var label = $('accountLabel');
    if (label) label.textContent = s.username + ' · ' + roleLabel;
    var email = document.querySelector('.account-email');
    if (email) email.textContent = s.username;
    var hint = document.querySelector('.account-hint') || $('accountSubHint');
    if (hint) hint.textContent = roleLabel;
  }

  function closeAccountPanel() {
    var accBtn = $('sidebarAccountBtn');
    var accPanel = $('sidebarAccountPanel');
    var accRoot = $('sidebarAccount');
    var shell = document.getElementById('menuShell');
    if (accBtn) accBtn.setAttribute('aria-expanded', 'false');
    if (accPanel) {
      accPanel.setAttribute('hidden', '');
      accPanel.hidden = true;
      accPanel.style.display = 'none';
    }
    if (accRoot) accRoot.classList.remove('is-open');
    if (shell) shell.classList.remove('is-account-open');
  }
  /** 兼容旧调用名 */
  function closeSidebarAccountPanel() {
    closeAccountPanel();
  }

  function openChangePwdModal(forced) {
    var box = $('authChangePwd');
    if (!box) return;
    closeAccountPanel();
    closeSidebarAccountPanel();
    box.hidden = false;
    box.removeAttribute('hidden');
    box.classList.add('is-open');
    box.setAttribute('data-forced', forced ? '1' : '0');
    var tip = $('authChangePwdTip');
    if (tip) tip.textContent = forced
      ? '首次登录或密码已重置，必须修改密码后才能继续使用。'
      : '请设置新密码（8–12 位，含字母与数字，可含 . * #）。';
    ['authOldPwd', 'authNewPwd', 'authNewPwd2'].forEach(function (id) {
      var el = $(id);
      if (el) el.value = '';
    });
    var err = $('authChangePwdError');
    if (err) err.textContent = '';
    if ($('authOldPwdWrap')) $('authOldPwdWrap').style.display = forced ? 'none' : '';
    /* 强制改密时取消 = 退出；主动改密可取消关闭 */
    var cancelBtn = $('authChangePwdCancel');
    if (cancelBtn) cancelBtn.style.display = '';
  }
  function closeChangePwdModal() {
    var box = $('authChangePwd');
    if (!box) return;
    box.classList.remove('is-open');
    box.hidden = true;
    box.setAttribute('hidden', '');
    box.removeAttribute('data-forced');
    ['authOldPwd', 'authNewPwd', 'authNewPwd2'].forEach(function (id) {
      var el = $(id);
      if (el) el.value = '';
    });
    var err = $('authChangePwdError');
    if (err) err.textContent = '';
    closeAccountPanel();
  }

  function changePassword(oldPwd, newPwd, newPwd2, forced) {
    var s = getSession();
    if (!s) return Promise.resolve({ ok: false, error: '未登录' });
    newPwd = String(newPwd || '');
    newPwd2 = String(newPwd2 || '');
    if (newPwd.length < 8 || newPwd.length > 12 || !/^[\x20-\x7E]+$/.test(newPwd) || !/[A-Za-z]/.test(newPwd) || !/[0-9]/.test(newPwd)) {
      return Promise.resolve({ ok: false, error: '新密码须为 8–12 位，须含字母和数字，可含 . * # 等符号，不能使用中文' });
    }
    if (newPwd !== newPwd2) return Promise.resolve({ ok: false, error: '两次输入的新密码不一致' });
    /* 服务端会话：走 API 改密，不再查本地用户库 */
    if (s.source === 'server' || (s.token && String(s.token).split('.').length === 3)) {
      if (typeof CMGApi === 'undefined' || !CMGApi.getToken || !CMGApi.getToken()) {
        return Promise.resolve({ ok: false, error: '登录已失效，请重新登录' });
      }
      var base = (CMGApi.getBase && CMGApi.getBase()) || '/api/v1';
      var headers = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + CMGApi.getToken() };
      return fetch(base + '/auth/change-password', {
        method: 'POST',
        headers: headers,
        credentials: 'include',
        body: JSON.stringify({ oldPassword: String(oldPwd || ''), newPassword: newPwd })
      }).then(function (res) {
        return res.text().then(function (text) {
          var data = null;
          try { data = text ? JSON.parse(text) : null; } catch (e) { data = { message: text }; }
          if (!res.ok) {
            var msg = (data && (data.message || data.error)) || '修改失败';
            if (Array.isArray(msg)) msg = msg.join('; ');
            if (/unauthor/i.test(String(msg))) msg = '原密码不正确或登录已失效';
            return { ok: false, error: String(msg) };
          }
          s.mustChangePwd = false;
          try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(s)); } catch (e2) {}
          return { ok: true };
        });
      }).catch(function () {
        return { ok: false, error: '网络异常，请稍后重试' };
      });
    }
    return ensureVault().then(function (vault) {
      var user = vault.users.find(function (u) { return u.id === s.userId; });
      if (!user) return { ok: false, error: '用户不存在' };
      var chain = Promise.resolve(true);
      if (!forced) {
        chain = hashPassword(String(oldPwd || ''), user.salt).then(function (h) {
          return timingSafeEqual(h, user.hash);
        });
      }
      return chain.then(function (okOld) {
        if (!okOld) return { ok: false, error: '原密码不正确' };
        var salt = randomHex(SALT_BYTES);
        return hashPassword(newPwd, salt).then(function (hash) {
          user.salt = salt;
          user.hash = hash;
          user.mustChangePwd = false;
          user.updatedAt = Date.now();
          saveVault(vault);
          setSession(user);
          return { ok: true };
        });
      });
    });
  }

  /* —— 管理员：账号与权限（密码永不回显） —— */
  function listUsersPublic() {
    /* 同步占位：列表以 fetchAdminUsers 为准 */
    return _adminUsersCache || [];
  }
  var _adminUsersCache = [];
  function fetchAdminUsers() {
    var s = getSession();
    if (!isSuperAdminSession(s)) {
      _adminUsersCache = [];
      return Promise.resolve([]);
    }
    try {
      if (s && s.token && typeof CMGApi !== 'undefined' && CMGApi.setToken) CMGApi.setToken(s.token);
    } catch (eTok) {}
    if (typeof CMGApi === 'undefined' || !CMGApi.listAdminUsers || !CMGApi.getToken || !CMGApi.getToken()) {
      _adminUsersCache = [];
      if (typeof toast === 'function') toast('登录已失效，请重新登录后再查看账号列表', 'warning');
      return Promise.resolve([]);
    }
    return CMGApi.listAdminUsers().then(function (rows) {
      var list = Array.isArray(rows) ? rows : (rows && rows.items) || [];
      _adminUsersCache = list.map(function (u) {
        return {
          id: u.id,
          username: u.username,
          role: u.role,
          enabled: u.enabled !== false,
          mustChangePwd: !!u.mustChangePwd,
          features: Array.isArray(u.features) ? u.features.filter(function (k) { return k !== '*'; }) : [],
          paid: u.paid,
          validFrom: u.validFrom,
          validUntil: u.validUntil,
          deleted: false
        };
      });
      return _adminUsersCache;
    }).catch(function (err) {
      if (typeof toast === 'function') toast('加载账号列表失败：' + (err && err.message || err), 'warning');
      return _adminUsersCache;
    });
  }

  function createUser(username, password, role, features) {
    var s = getSession();
    if (!isSuperAdminSession(s)) return Promise.resolve({ ok: false, error: '仅超级管理员可新增账号' });
    username = String(username || '').trim();
    password = String(password || '');
    role = role === 'admin' ? 'admin' : 'user';
    /* 账号：5–8 位，大小写字母或字母+数字，以字母开头，禁止中文 */
    if (!/^[a-zA-Z][a-zA-Z0-9]{4,7}$/.test(username)) {
      return Promise.resolve({ ok: false, error: '账号须为 5–8 位，以字母开头，可含大小写字母与数字，不能使用中文' });
    }
    /* 密码：8–12 位，须同时含字母与数字，禁止中文 */
    if (password.length < 8 || password.length > 12 || !/^[\x20-\x7E]+$/.test(password) || !/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
      return Promise.resolve({ ok: false, error: '密码须为 8–12 位，须含字母和数字，可含 . * # 等符号，不能使用中文' });
    }
    var feats = role === 'admin'
      ? []
      : (Array.isArray(features) ? features.filter(function (k) { return k !== 'admin-users'; }) : []);
    if (typeof CMGApi === 'undefined' || !CMGApi.createAdminUser || !CMGApi.getToken || !CMGApi.getToken()) {
      return Promise.resolve({ ok: false, error: '请重新登录后再创建账号' });
    }
    return CMGApi.createAdminUser({
      username: username,
      password: password,
      role: role,
      features: feats,
      paid: true,
      enabled: true
    }).then(function () {
      return { ok: true };
    }).catch(function (err) {
      var msg = (err && err.message) || '创建失败';
      if (Array.isArray(msg)) msg = msg.join('; ');
      return { ok: false, error: String(msg) };
    });
  }

  function resetUserPassword(userId, newPassword) {
    var s = getSession();
    if (!isSuperAdminSession(s)) return Promise.resolve({ ok: false, error: '仅超级管理员可重置密码' });
    newPassword = String(newPassword || '');
    if (newPassword.length < 8 || newPassword.length > 12 || !/^[\x20-\x7E]+$/.test(newPassword) || !/[A-Za-z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      return Promise.resolve({ ok: false, error: '密码须为 8–12 位，须含字母和数字，可含 . * # 等符号，不能使用中文' });
    }
    if (typeof CMGApi === 'undefined' || !CMGApi.resetAdminPassword) {
      return Promise.resolve({ ok: false, error: '请重新登录后再操作' });
    }
    return CMGApi.resetAdminPassword(userId, newPassword).then(function () {
      return { ok: true };
    }).catch(function (err) {
      return { ok: false, error: (err && err.message) || '重置失败' };
    });
  }

  function updateUserMeta(userId, patch) {
    var s = getSession();
    if (!isSuperAdminSession(s)) return Promise.resolve({ ok: false, error: '仅超级管理员可编辑账号与权限' });
    userId = String(userId || '').trim();
    if (!userId) return Promise.resolve({ ok: false, error: '请先选择账号' });
    if (typeof CMGApi === 'undefined' || !CMGApi.updateAdminUser) {
      return Promise.resolve({ ok: false, error: '请重新登录后再操作' });
    }
    var body = {};
    if (patch.role === 'admin' || patch.role === 'user') body.role = patch.role;
    if (typeof patch.enabled === 'boolean') body.enabled = patch.enabled;
    if (Array.isArray(patch.features)) {
      body.features = patch.features.filter(function (k) { return k !== 'admin-users' && k !== '*'; });
    }
    if (typeof patch.paid === 'boolean') body.paid = patch.paid;
    if ('validFrom' in patch) body.validFrom = patch.validFrom || null;
    if ('validUntil' in patch) body.validUntil = patch.validUntil || null;
    return CMGApi.updateAdminUser(userId, body).then(function () {
      return { ok: true };
    }).catch(function (err) {
      return { ok: false, error: (err && err.message) || '更新失败' };
    });
  }

  function deleteUser(userId) {
    var s = getSession();
    if (!isSuperAdminSession(s)) return Promise.resolve({ ok: false, error: '仅超级管理员可禁用账号' });
    if (userId === s.userId) return Promise.resolve({ ok: false, error: '不能删除当前登录账号' });
    if (typeof CMGApi === 'undefined' || !CMGApi.disableAdminUser) {
      return Promise.resolve({ ok: false, error: '请重新登录后再操作' });
    }
    return CMGApi.disableAdminUser(userId).then(function () {
      return { ok: true };
    }).catch(function (err) {
      return { ok: false, error: (err && err.message) || '操作失败' };
    });
  }

  function renderAdminUsers() {
    var body = $('adminUsersBody');
    if (!body) return;
    var s = getSession();
    /* 仅超级管理员；勿用 role === 'admin'，否则 super_admin 会被误判无权限 */
    if (!isSuperAdminSession(s)) {
      body.innerHTML = '<tr><td colspan="8" class="empty-cell">无权限访问（仅超级管理员）</td></tr>';
      return;
    }
    body.innerHTML = '<tr><td colspan="8" class="empty-cell">加载中…</td></tr>';
    fetchAdminUsers().then(function (list) {
      list = list || [];
      if (!list.length) {
        body.innerHTML = '<tr><td colspan="8" class="empty-cell">暂无账号</td></tr>';
        return;
      }
      __renderAdminUsersRows(body, list, s);
    });
  }
  function __renderAdminUsersRows(body, list, s) {
    if (!list.length) {
      body.innerHTML = '<tr><td colspan="8" class="empty-cell">暂无账号</td></tr>';
      return;
    }
    body.innerHTML = list.map(function (u, i) {
      var featCount = (u.features || []).length;
      var priv = isPrivilegedRole(u.role);
      var roleTxt = u.role === 'super_admin' ? '超级管理员' : (u.role === 'admin' ? '管理员' : '普通用户');
      var paidTxt = priv ? '—' : (u.paid ? '已开通' : '未开通');
      var periodTxt = priv ? '不限' : (
        (u.validFrom ? String(u.validFrom).slice(0, 10) : '—') + ' ~ ' +
        (u.validUntil ? String(u.validUntil).slice(0, 10) : '—')
      );
      var canDel = u.id !== s.userId && u.role !== 'super_admin';
      return '<tr data-uid="' + u.id + '">' +
        '<td class="num">' + (i + 1) + '</td>' +
        '<td>' + escapeHtml(u.username) + '</td>' +
        '<td>' + roleTxt + '</td>' +
        '<td>' + (u.enabled ? '启用' : '禁用') + '</td>' +
        '<td>' + paidTxt + '</td>' +
        '<td class="mono">' + periodTxt + '</td>' +
        '<td>' + (priv ? '全部业务' : (featCount + ' 项')) + (u.mustChangePwd ? ' · 待改密' : '') + '</td>' +
        '<td class="docs-ops">' +
          '<button type="button" data-admin-edit="' + u.id + '">编辑</button>' +
          '<button type="button" data-admin-reset="' + u.id + '">重置密码</button>' +
          (canDel ? '<button type="button" class="docs-op-danger" data-admin-del="' + u.id + '">删除</button>' : '') +
        '</td></tr>';
    }).join('');
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function openUserPermDrawer(userId) {
    var s = getSession();
    if (!isSuperAdminSession(s)) {
      if (typeof toast === 'function') toast('仅超级管理员可编辑账号权限', 'warning');
      return;
    }
    var user = (_adminUsersCache || []).find(function (u) { return u.id === userId; });
    if (!user) {
      if (typeof toast === 'function') toast('请先刷新账号列表', 'warning');
      return;
    }
    var drawer = $('adminUserDrawer');
    if (!drawer) return;
    $('adminEditUserId').value = user.id;
    $('adminEditName').textContent = user.username;
    $('adminEditRole').value = user.role;
    if (typeof upgradeNativeSelect === 'function') {
      try {
        upgradeNativeSelect($('adminEditRole'));
        upgradeNativeSelect($('adminNewRole'));
      } catch (e) {}
    }
    var enYes = $('adminEditEnabledYes');
    var enNo = $('adminEditEnabledNo');
    if (enYes && enNo) {
      if (user.enabled) { enYes.checked = true; enNo.checked = false; }
      else { enYes.checked = false; enNo.checked = true; }
    }
    var paidYes = $('adminEditPaidYes');
    var paidNo = $('adminEditPaidNo');
    var paidVal = user.role === 'admin' ? true : !!user.paid;
    if (paidYes && paidNo) {
      if (paidVal) { paidYes.checked = true; paidNo.checked = false; }
      else { paidYes.checked = false; paidNo.checked = true; }
    }
    var vf = $('adminEditValidFrom');
    if (vf) vf.value = user.validFrom ? String(user.validFrom).slice(0, 10) : '';
    var vu = $('adminEditValidUntil');
    if (vu) vu.value = user.validUntil ? String(user.validUntil).slice(0, 10) : '';
    var disp = $('adminEditPeriodDisplay');
    if (disp) {
      var a = user.validFrom ? String(user.validFrom).slice(0, 10) : '';
      var b = user.validUntil ? String(user.validUntil).slice(0, 10) : '';
      if (a) {
        var fa = a.replace(/-/g, '/'), fb = (b || a).replace(/-/g, '/');
        disp.textContent = fa + '  →  ' + fb;
        disp.classList.remove('is-placeholder');
      } else {
        disp.textContent = '请选择期限';
        disp.classList.add('is-placeholder');
      }
    }
    var box = $('adminEditFeatures');
    if (box) {
      box.innerHTML = FEATURES.filter(function (f) { return f.key !== 'admin-users'; }).map(function (f) {
        var checked = user.role === 'admin' || (user.features || []).indexOf(f.key) >= 0;
        return '<label class="auth-feat-item"><input type="checkbox" data-feat="' + f.key + '"' +
          (checked ? ' checked' : '') + (user.role === 'admin' ? ' disabled' : '') + ' /> ' + f.label + '</label>';
      }).join('');
    }
    drawer.hidden = false;
    drawer.classList.add('is-open');
    var mask = $('adminUserDrawerMask');
    if (mask) {
      mask.hidden = false;
      mask.classList.add('is-open');
    }
  }
  function closeUserPermDrawer() {
    var drawer = $('adminUserDrawer');
    var mask = $('adminUserDrawerMask');
    if (drawer) {
      drawer.classList.remove('is-open');
      drawer.hidden = true;
      drawer.setAttribute('hidden', '');
    }
    if (mask) {
      mask.classList.remove('is-open');
      mask.hidden = true;
      mask.setAttribute('hidden', '');
    }
  }


  /* —— 套餐设置：读写 KV，驱动升级弹窗价格与说明 —— */
  var PLAN_SETTINGS_KEY = 'cmg_plan_settings_v1';
  var DEFAULT_PLAN_SETTINGS = {
    plans: [
      { id: 'week', name: '体验', priceM: 29, priceY: 290, unitM: '/周', unitY: '/年', note: '适合短期试用与验收', badge: '', feats: '基础盘点与库存查看\n单仓库数据范围\n标准导出', cta: '选择体验' },
      { id: 'month', name: '专业', priceM: 99, priceY: 999, unitM: '/月', unitY: '/年', note: '团队日常运营推荐', badge: '最受欢迎', feats: '体验版全部能力\n扫码盘点与差异报告\n机台毛利与品类分析\n多功能权限分配', cta: '领取优惠' },
      { id: 'quarter', name: '进阶', priceM: 269, priceY: 2690, unitM: '/季', unitY: '/年', note: '约合每月更低成本', badge: '季卡更省', feats: '专业版全部能力\n优先支持响应\n批量导入导出', cta: '选择进阶' },
      { id: 'year', name: '旗舰', priceM: 899, priceY: 799, unitM: '/年', unitY: '/年', note: '全年开通，长期使用', noteY: '年度订阅优惠价，长期使用', badge: '年度最优', feats: '进阶版全部能力\n专属开通通道\n功能迭代优先体验', cta: '选择旗舰' }
    ],
    modalTitle: '一份订阅。畅享全部能力。',
    payMethods: '微信, 支付宝, 对公转账',
    payChannel: '联系管理员开通',
    footerNote: '价格不含税。开通后由管理员确认生效；可随时取消弹窗，登录后仍可能提示续费。'
  };
  var _planSettingsCache = null;

  function clonePlanSettings(src) {
    return JSON.parse(JSON.stringify(src || DEFAULT_PLAN_SETTINGS));
  }

  function loadPlanSettings() {
    if (_planSettingsCache) return Promise.resolve(clonePlanSettings(_planSettingsCache));
    if (typeof CMGApi === 'undefined' || !CMGApi.getKv || !CMGApi.getMode || CMGApi.getMode() !== 'http') {
      _planSettingsCache = clonePlanSettings(DEFAULT_PLAN_SETTINGS);
      return Promise.resolve(clonePlanSettings(_planSettingsCache));
    }
    return CMGApi.getKv(PLAN_SETTINGS_KEY, 'global').then(function (res) {
      var payload = res && (res.payload !== undefined ? res.payload : res);
      if (payload && payload.plans && payload.plans.length) {
        _planSettingsCache = payload;
      } else {
        _planSettingsCache = clonePlanSettings(DEFAULT_PLAN_SETTINGS);
      }
      return clonePlanSettings(_planSettingsCache);
    }).catch(function () {
      _planSettingsCache = clonePlanSettings(DEFAULT_PLAN_SETTINGS);
      return clonePlanSettings(_planSettingsCache);
    });
  }

  function savePlanSettings(data) {
    _planSettingsCache = clonePlanSettings(data);
    if (typeof CMGApi === 'undefined' || !CMGApi.putKv || CMGApi.getMode() !== 'http') {
      return Promise.resolve({ ok: false, error: '请登录服务端后再保存' });
    }
    return CMGApi.putKv(PLAN_SETTINGS_KEY, data, 'global').then(function () {
      applyPlanSettingsToModal(data);
      return { ok: true };
    }).catch(function (err) {
      return { ok: false, error: (err && err.message) || '保存失败' };
    });
  }

  function applyPlanSettingsToModal(cfg) {
    cfg = cfg || _planSettingsCache || DEFAULT_PLAN_SETTINGS;
    var grid = document.getElementById('payPlanGrid');
    if (!grid || !cfg.plans) return;
    cfg.plans.forEach(function (p) {
      var card = grid.querySelector('[data-plan="' + p.id + '"]');
      if (!card) return;
      card.setAttribute('data-price-m', String(p.priceM));
      card.setAttribute('data-price-y', String(p.priceY));
      if (p.unitM) card.setAttribute('data-unit-m', p.unitM);
      if (p.unitY) card.setAttribute('data-unit-y', p.unitY);
      var nameEl = card.querySelector('.pay-plan-name');
      if (nameEl) nameEl.textContent = p.name || '';
      var noteEl = card.querySelector('.pay-plan-note');
      if (noteEl) {
        noteEl.textContent = p.note || '';
        if (p.noteY) noteEl.setAttribute('data-note-y', p.noteY);
        if (p.note) noteEl.setAttribute('data-note-m', p.note);
      }
      var badge = card.querySelector('.pay-plan-badge');
      if (p.badge) {
        if (!badge) {
          var head = card.querySelector('.pay-plan-head');
          if (head) {
            badge = document.createElement('span');
            badge.className = 'pay-plan-badge' + (p.id !== 'month' ? ' pay-plan-badge-soft' : '');
            head.appendChild(badge);
          }
        }
        if (badge) badge.textContent = p.badge;
      } else if (badge) {
        badge.remove();
      }
      var priceEl = card.querySelector('[data-price]');
      if (priceEl) priceEl.textContent = String(p.priceM);
      var unitEl = card.querySelector('.pay-plan-unit');
      if (unitEl && p.unitM) unitEl.textContent = p.unitM;
      var cta = card.querySelector('[data-plan-cta]');
      if (cta && p.cta) cta.textContent = p.cta;
      var ul = card.querySelector('.pay-plan-feats');
      if (ul && p.feats) {
        ul.innerHTML = String(p.feats).split(/\n+/).filter(Boolean).map(function (line) {
          return '<li>' + String(line).replace(/</g, '&lt;') + '</li>';
        }).join('');
      }
    });
    var titleEl = document.getElementById('payModalTitle');
    if (titleEl && cfg.modalTitle) titleEl.textContent = cfg.modalTitle;
    var foot = document.querySelector('.pay-modal-foot');
    if (foot && cfg.footerNote) foot.textContent = cfg.footerNote;
    var conf = document.getElementById('payModalConfirm');
    if (conf && cfg.payChannel) conf.textContent = cfg.payChannel.length > 12 ? '联系开通' : cfg.payChannel;
  }

  function renderPlanSettingsForm(cfg) {
    var box = document.getElementById('planSettingsPlans');
    if (!box) return;
    cfg = cfg || DEFAULT_PLAN_SETTINGS;
    box.innerHTML = (cfg.plans || []).map(function (p, i) {
      return '<div class="plan-edit-card" data-plan-idx="' + i + '">' +
        '<h4>' + (p.name || p.id) + ' <span style="font-weight:500;color:#a3a3a3;font-size:12px;">(' + p.id + ')</span></h4>' +
        '<div class="plan-edit-row">' +
          '<div><label>套餐名称</label><input class="field-control" data-f="name" value="' + String(p.name || '').replace(/"/g, '&quot;') + '" /></div>' +
          '<div><label>角标文案</label><input class="field-control" data-f="badge" value="' + String(p.badge || '').replace(/"/g, '&quot;') + '" placeholder="可选" /></div>' +
        '</div>' +
        '<div class="plan-edit-row">' +
          '<div><label>月价 / 周期价</label><input class="field-control" type="number" min="0" step="1" data-f="priceM" value="' + (p.priceM != null ? p.priceM : '') + '" /></div>' +
          '<div><label>年价</label><input class="field-control" type="number" min="0" step="1" data-f="priceY" value="' + (p.priceY != null ? p.priceY : '') + '" /></div>' +
        '</div>' +
        '<div class="plan-edit-row">' +
          '<div><label>月价单位</label><input class="field-control" data-f="unitM" value="' + String(p.unitM || '').replace(/"/g, '&quot;') + '" placeholder="/月" /></div>' +
          '<div><label>年价单位</label><input class="field-control" data-f="unitY" value="' + String(p.unitY || '').replace(/"/g, '&quot;') + '" placeholder="/年" /></div>' +
        '</div>' +
        '<div><label>套餐说明</label><input class="field-control" data-f="note" value="' + String(p.note || '').replace(/"/g, '&quot;') + '" /></div>' +
        '<div><label>按钮文案</label><input class="field-control" data-f="cta" value="' + String(p.cta || '').replace(/"/g, '&quot;') + '" /></div>' +
        '<div><label>能力说明（每行一条）</label><textarea class="field-control" rows="6" data-f="feats">' + String(p.feats || '').replace(/</g, '&lt;') + '</textarea></div>' +
      '</div>';
    }).join('');
    var mt = document.getElementById('planModalTitle');
    var pm = document.getElementById('planPayMethods');
    var pc = document.getElementById('planPayChannel');
    var fn = document.getElementById('planFooterNote');
    if (mt) mt.value = cfg.modalTitle || '';
    if (pm) pm.value = cfg.payMethods || '';
    if (pc) pc.value = cfg.payChannel || '';
    if (fn) fn.value = cfg.footerNote || '';
  }

  function collectPlanSettingsFromForm() {
    var base = clonePlanSettings(_planSettingsCache || DEFAULT_PLAN_SETTINGS);
    var cards = document.querySelectorAll('#planSettingsPlans .plan-edit-card');
    cards.forEach(function (card, i) {
      if (!base.plans[i]) return;
      card.querySelectorAll('[data-f]').forEach(function (el) {
        var f = el.getAttribute('data-f');
        var v = el.value;
        if (f === 'priceM' || f === 'priceY') v = parseFloat(v) || 0;
        base.plans[i][f] = v;
      });
    });
    var mt = document.getElementById('planModalTitle');
    var pm = document.getElementById('planPayMethods');
    var pc = document.getElementById('planPayChannel');
    var fn = document.getElementById('planFooterNote');
    if (mt) base.modalTitle = mt.value;
    if (pm) base.payMethods = pm.value;
    if (pc) base.payChannel = pc.value;
    if (fn) base.footerNote = fn.value;
    return base;
  }

  function switchAdminTab(tab) {
    tab = tab === 'plans' ? 'plans' : 'users';
    document.querySelectorAll('#page-admin-users [data-admin-tab]').forEach(function (btn) {
      var on = btn.getAttribute('data-admin-tab') === tab;
      btn.classList.toggle('is-active', on);
      btn.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    document.querySelectorAll('#page-admin-users [data-admin-panel]').forEach(function (panel) {
      var on = panel.getAttribute('data-admin-panel') === tab;
      panel.classList.toggle('is-active-panel', on);
      if (on) {
        panel.hidden = false;
        panel.removeAttribute('hidden');
        panel.style.display = '';
      } else {
        panel.hidden = true;
        panel.setAttribute('hidden', '');
        panel.style.display = 'none';
      }
    });
    if (tab === 'plans') {
      loadPlanSettings().then(function (cfg) { renderPlanSettingsForm(cfg); });
    } else if (tab === 'users') {
      try { renderAdminUsers(); } catch (eR) {}
    }
  }

  function bindAdminPage() {
    if (window.__adminUsersBound) return;
    window.__adminUsersBound = true;
    var adminRoot = document.getElementById('page-admin-users');
    if (adminRoot) {
      adminRoot.addEventListener('click', function (e) {
        var tab = e.target.closest && e.target.closest('[data-admin-tab]');
        if (tab) { switchAdminTab(tab.getAttribute('data-admin-tab')); return; }
      });
    }
    var btnPlanSave = document.getElementById('planSettingsSave');
    if (btnPlanSave) {
      btnPlanSave.addEventListener('click', function () {
        var data = collectPlanSettingsFromForm();
        savePlanSettings(data).then(function (r) {
          if (!r.ok) {
            if (typeof toast === 'function') toast(r.error || '保存失败', 'error');
            return;
          }
          if (typeof toast === 'function') toast('已保存', 'success');
        });
      });
    }
    var btnPlanReset = document.getElementById('planSettingsReset');
    if (btnPlanReset) {
      btnPlanReset.addEventListener('click', function () {
        _planSettingsCache = null;
        renderPlanSettingsForm(clonePlanSettings(DEFAULT_PLAN_SETTINGS));
        if (typeof toast === 'function') toast('已恢复默认（需点保存才会生效）', 'info');
      });
    }
    try { loadPlanSettings().then(function (cfg) { applyPlanSettingsToModal(cfg); }); } catch (eP) {}
    try { switchAdminTab('users'); } catch (eTab) {}
    if (typeof window.bindSharedDatePicker === 'function') {
      try {
        window.bindSharedDatePicker({
          rootId: 'adminEditDatePicker',
          triggerId: 'adminEditPeriodTrigger',
          panelId: 'adminEditPeriodPanel',
          startId: 'adminEditValidFrom',
          endId: 'adminEditValidUntil',
          displayId: 'adminEditPeriodDisplay',
          presetsId: 'adminEditPeriodPresets',
          calDaysL: 'adminEditCalDaysL',
          calDaysR: 'adminEditCalDaysR',
          calTitleL: 'adminEditCalTitleL',
          calTitleR: 'adminEditCalTitleR',
          placeholder: '请选择期限',
          stateKey: '__dp_adminEdit'
        });
      } catch (e) { console.warn('[admin-daterange]', e); }
    }
    if (typeof upgradeAllSelects === 'function') {
      try { upgradeAllSelects($('page-admin-users') || document); } catch (e) {}
    }
    var page = $('page-admin-users');
    if (!page) return;
    page.addEventListener('click', function (e) {
      var t = e.target;
      if (!t || !t.closest) return;
      if (t.closest('#adminBtnCreate')) {
        e.preventDefault();
        var name = ($('adminNewUser') && $('adminNewUser').value || '').trim();
        var pwd = ($('adminNewPwd') && $('adminNewPwd').value) || '';
        var role = ($('adminNewRole') && $('adminNewRole').value) || 'user';
        createUser(name, pwd, role, null).then(function (r) {
          if (!r.ok) {
            if (typeof showModal === 'function') showModal(r.error, 'alert');
            else alert(r.error);
            return;
          }
          if ($('adminNewUser')) $('adminNewUser').value = '';
          if ($('adminNewPwd')) $('adminNewPwd').value = '';
          renderAdminUsers();
          if (typeof toast === 'function') toast('已创建账号（密码不会在界面显示）', 'success');
        });
        return;
      }
      var edit = t.closest('[data-admin-edit]');
      if (edit) { openUserPermDrawer(edit.getAttribute('data-admin-edit')); return; }
      var reset = t.closest('[data-admin-reset]');
      if (reset) {
        var uid = reset.getAttribute('data-admin-reset');
        if (typeof showConfirm === 'function') {
          showConfirm({
            title: 'WMS-Tec',
            message: '请输入新密码（8–12 位，含字母和数字，可含 . * #）。密码不会在列表中显示。',
            confirmText: '确定',
            cancelText: '取消',
            danger: false,
            input: true,
            inputType: 'password',
            inputLabel: '新密码',
            inputPlaceholder: '请输入新密码',
            inputRequired: true,
            onConfirm: function (np) {
              resetUserPassword(uid, np).then(function (r) {
                if (!r.ok) {
                  if (typeof showModal === 'function') showModal(r.error, 'alert');
                  else alert(r.error);
                  return;
                }
                renderAdminUsers();
                if (typeof toast === 'function') toast('密码已重置，用户下次登录须修改', 'success');
              });
            }
          });
        } else {
          var np = window.prompt('请输入新密码（8–12 位，含字母和数字，可含 . * #）');
          if (np == null) return;
          resetUserPassword(uid, np).then(function (r) {
            if (!r.ok) { alert(r.error); return; }
            renderAdminUsers();
          });
        }
        return;
      }
      var del = t.closest('[data-admin-del]');
      if (del) {
        var msg = '确认删除该账号？删除后不可恢复。';
        var run = function () {
          var delId = del.getAttribute('data-admin-del');
          Promise.resolve(deleteUser(delId)).then(function (r) {
            if (!r.ok) {
              if (typeof showModal === 'function') showModal(r.error, 'alert');
              else alert(r.error);
              return;
            }
            _adminUsersCache = (_adminUsersCache || []).filter(function (u) { return u.id !== delId; });
            renderAdminUsers();
            if (typeof toast === 'function') toast('已删除', 'success');
          });
        };
        if (typeof window.showConfirm === 'function') {
          window.showConfirm({
            title: '删除账号',
            message: msg + '\n账号将被停用并从列表中移除，',
            onConfirm: run
          });
        } else if (typeof showModal === 'function') {
          showModal(msg + '\n\n删除后数据不可恢复。', 'confirm', function (ok) { if (ok) run(); });
        } else if (window.confirm(msg)) run();
      }
    });
    var savePerm = $('adminSavePerm');
    if (savePerm) {
      savePerm.addEventListener('click', function () {
        var id = $('adminEditUserId') && $('adminEditUserId').value;
        id = String(id || '').trim();
        if (!id) {
          if (typeof showModal === 'function') showModal('请先选择账号', 'alert');
          else if (typeof toast === 'function') toast('请先选择账号', 'warning');
          else alert('请先选择账号');
          return;
        }
        var role = $('adminEditRole').value;
        var enChecked = document.querySelector('input[name="adminEditEnabled"]:checked');
        var enabled = enChecked ? enChecked.value === '1' : true;
        var paidChecked = document.querySelector('input[name="adminEditPaid"]:checked');
        var paid = paidChecked ? paidChecked.value === '1' : false;
        var vf = $('adminEditValidFrom');
        var vu = $('adminEditValidUntil');
        var feats = [];
        document.querySelectorAll('#adminEditFeatures input[data-feat]:checked').forEach(function (cb) {
          feats.push(cb.getAttribute('data-feat'));
        });
        Promise.resolve(updateUserMeta(id, {
          role: role,
          enabled: enabled,
          features: feats,
          paid: paid,
          validFrom: vf && vf.value ? vf.value : null,
          validUntil: vu && vu.value ? vu.value : null
        })).then(function (r) {
          if (!r.ok) {
            if (typeof showModal === 'function') showModal(r.error, 'alert');
            else if (typeof showToast === 'function') showToast(r.error, 'error');
            else alert(r.error || '保存失败');
            return;
          }
          closeUserPermDrawer();
          renderAdminUsers();
          if (typeof showToast === 'function') showToast('权限已更新', 'success');
          else if (typeof toast === 'function') toast('权限已更新', 'success');
        });
      });
    }
    ['adminUserDrawerClose', 'adminUserDrawerCancel', 'adminUserDrawerMask'].forEach(function (id) {
      var el = $(id);
      if (el) el.addEventListener('click', closeUserPermDrawer);
    });
    var roleSel = $('adminEditRole');
    if (roleSel) {
      roleSel.addEventListener('change', function () {
        var isAdmin = roleSel.value === 'admin';
        document.querySelectorAll('#adminEditFeatures input[data-feat]').forEach(function (cb) {
          cb.disabled = isAdmin;
          if (isAdmin) cb.checked = true;
        });
      });
    }
  }

  function bindGate() {
  
  /* 登录左栏：身体弯曲 + 瞳孔跟随鼠标 */
  

  function initAuthCrewEyes() {
    var stage = document.getElementById('authCrewBanner') || document.getElementById('crewStage');
    if (!stage || stage.__crewBound) return;
    stage.__crewBound = true;
    var stageEl = stage.querySelector('.crew-stage') || stage;
    var bodies = stage.querySelectorAll('[data-crew]');
    var pupils = stage.querySelectorAll('.crew-pupil');
    var faces = stage.querySelectorAll('.crew-face');
    var reduceMotion = false;
    try {
      reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch (eRm) {}

    function onMove(e) {
      if (reduceMotion) return;
      var r = stageEl.getBoundingClientRect();
      if (!r.width || !r.height) return;
      var nx = ((e.clientX - r.left) / r.width - 0.5) * 2;
      nx = Math.max(-1, Math.min(1, nx));
      for (var i = 0; i < bodies.length; i++) {
        var el = bodies[i];
        var depth = parseFloat(el.getAttribute('data-depth') || String(0.4 + i * 0.1)) || 0.5;
        /* 减弱弯曲幅度，底部仍固定 */
        var skew = nx * -3.5 * depth;
        var rot = nx * 1.6 * depth;
        el.style.transform =
          'translate3d(0, 0, 0) skewX(' + skew.toFixed(2) + 'deg) rotate(' + rot.toFixed(2) + 'deg)';
      }
      for (var p = 0; p < pupils.length; p++) {
        var pupil = pupils[p];
        var eye = pupil.parentElement;
        if (!eye) continue;
        var er = eye.getBoundingClientRect();
        var cx = er.left + er.width / 2;
        var cy = er.top + er.height / 2;
        var dx = e.clientX - cx;
        var dy = e.clientY - cy;
        var dist = Math.sqrt(dx * dx + dy * dy) || 1;
        var lim = Math.min(4.5, er.width * 0.28);
        pupil.style.transform =
          'translate(calc(-50% + ' + ((dx / dist) * lim).toFixed(2) + 'px), calc(-50% + ' + ((dy / dist) * lim).toFixed(2) + 'px))';
      }
    }
    function onLeave() {
      for (var i = 0; i < bodies.length; i++) {
        bodies[i].style.transform = 'translate3d(0,0,0) skewX(0deg) rotate(0deg)';
      }
      for (var p = 0; p < pupils.length; p++) {
        pupils[p].style.transform = 'translate(-50%, -50%)';
      }
    }
    document.addEventListener('mousemove', onMove, { passive: true });
    document.addEventListener('mouseleave', onLeave);

    /* 随机眨眼：每 4～8 秒抽一只角色眨一次 */
    function scheduleBlink() {
      if (reduceMotion || !faces.length) return;
      var delay = 4000 + Math.random() * 4000;
      setTimeout(function () {
        var face = faces[Math.floor(Math.random() * faces.length)];
        if (face) {
          face.classList.remove('is-blink');
          void face.offsetWidth;
          face.classList.add('is-blink');
          setTimeout(function () { face.classList.remove('is-blink'); }, 180);
        }
        scheduleBlink();
      }, delay);
    }
    scheduleBlink();
  }
  function initAuthFlyBall() {
    return;
    var ball = document.getElementById('authFlyBall');
    var title = document.querySelector('.auth-form-title .auth-brand-accent') || document.querySelector('.auth-form-title');
    if (!ball || ball.__flyBound) return;
    ball.__flyBound = true;
    function placeEnd() {
      if (!title) return;
      var tr = title.getBoundingClientRect();
      ball.style.left = Math.max(8, tr.left + tr.width * 0.35) + 'px';
      ball.style.top = Math.max(8, tr.top - 8) + 'px';
    }
    function run() {
      ball.classList.remove('is-run');
      void ball.offsetWidth;
      ball.classList.add('is-run');
      setTimeout(function () {
        placeEnd();
        ball.style.animation = 'none';
        ball.style.opacity = '0.95';
        ball.style.transform = 'translate3d(0,0,0) scale(0.55)';
      }, 2850);
    }
    run();
    /* 每 12s 再跳一次 */
    setInterval(run, 12000);
    window.addEventListener('resize', placeEnd);
  }

  if (window.__authGateBound) return;
    window.__authGateBound = true;
    try { initAuthCrewEyes(); } catch (eCrew) {}
   

    document.querySelectorAll('[data-auth-tab]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        switchAuthView(btn.getAttribute('data-auth-tab'));
      });
    });

    /* 联系通道：页面与属性中不直接写明文链接，运行时解码后打开 */
    function openContactChannel() {
      try {
        var url = getContactUrl();
        var w = window.open('about:blank', '_blank', 'noopener,noreferrer');
        if (w) {
          w.opener = null;
          w.location.replace(url);
        } else {
          /* 弹窗被拦截时仍避免在当前页展示链接文本 */
          var a = document.createElement('a');
          a.rel = 'noopener noreferrer';
          a.target = '_blank';
          a.href = url;
          a.click();
        }
      } catch (e) {
        if (typeof toast === 'function') toast('无法打开联系通道', 'error');
      }
    }
    var contactBtn = $('authContactAdminBtn');
    if (contactBtn) {
      contactBtn.addEventListener('click', function (e) {
        e.preventDefault();
        openContactChannel();
      });
    }

    /* 强制同步文案（避免浏览器缓存旧 HTML 仍显示括号说明） */
    /* 已取消「使用服务端登录」开关：统一服务端鉴权，隐藏遗留 DOM */
    try {
      var useServerCb = $('authUseServer');
      if (useServerCb) {
        useServerCb.checked = true;
        var lab = useServerCb.closest('label') || document.querySelector('label[for="authUseServer"]');
        if (lab) lab.style.display = 'none';
        useServerCb.style.display = 'none';
      }
      if (typeof CMGApi !== 'undefined' && CMGApi.setMode) CMGApi.setMode('http');
    } catch (eHide) {}
    var form = $('authLoginForm');
    if (form) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var u = ($('authUsername') && $('authUsername').value) || '';
        var p = ($('authPassword') && $('authPassword').value) || '';
        var err = $('authLoginError');
        if (err) err.textContent = '';
        var btn = $('authLoginBtn');
        if (btn) btn.disabled = true;
        login(u, p, { useServer: true }).then(function (r) {
          if (btn) btn.disabled = false;
          if (!r.ok) {
            if (err) err.textContent = r.error || '登录失败';
            if ($('authPassword')) $('authPassword').value = '';
            return;
          }
          if ($('authPassword')) $('authPassword').value = '';
          if ($('authUsername')) $('authUsername').value = '';
          var okMsg = r.mustChangePwd ? '登录成功，请先修改密码' : '登录成功';
          if (typeof window.toast === 'function') window.toast(okMsg, 'success');
          else if (typeof window.showModal === 'function') window.showModal(okMsg, 'alert');
          enterApp(r.mustChangePwd);
        }).catch(function () {
          if (btn) btn.disabled = false;
          if (err) err.textContent = '登录异常，请刷新重试';
        });
      });
    }

    var cpCancel = $('authChangePwdCancel');
    if (cpCancel) {
      cpCancel.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        var box = $('authChangePwd');
        var forced = !!(box && box.getAttribute('data-forced') === '1');
        var s = getSession();
        if (forced || (s && s.mustChangePwd)) {
          closeChangePwdModal();
          logout();
          return;
        }
        closeChangePwdModal();
      });
    }
    var cpForm = $('authChangePwdForm');
    if (cpForm) {
      cpForm.addEventListener('submit', function (e) {
        e.preventDefault();
        var s = getSession();
        var forced = !!(s && s.mustChangePwd);
        changePassword(
          ($('authOldPwd') && $('authOldPwd').value) || '',
          ($('authNewPwd') && $('authNewPwd').value) || '',
          ($('authNewPwd2') && $('authNewPwd2').value) || '',
          forced
        ).then(function (r) {
          var err = $('authChangePwdError');
          if (!r.ok) {
            if (err) err.textContent = r.error;
            return;
          }
          if (err) err.textContent = '';
          closeChangePwdModal();
          closeSidebarAccountPanel();
          if (typeof window.toast === 'function') window.toast('密码已更新', 'success');
          else if (typeof toast === 'function') toast('密码已更新', 'success');
          enterApp(false);
        });
      });
    }
    
    var accSettingsBtn = $('btnAccountSettings');
    if (accSettingsBtn && !accSettingsBtn.__bound) {
      accSettingsBtn.__bound = true;
      accSettingsBtn.addEventListener('click', function (e) {
        e.preventDefault();
        closeAccountPanel();
        if (typeof window.switchPage === 'function') window.switchPage('admin-users');
        else if (typeof switchPage === 'function') switchPage('admin-users');
      });
    }

    var logoutBtn = $('btnLogout');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', function (e) {
        e.preventDefault();
        logout();
      });
    }
  }

  function enterApp(mustChange) {
    /* 恢复服务端 JWT：仅当 token 为 JWT 形态时挂回 Authorization */
    try {
      var s0 = getSession();
      if (!s0) {
        /* 会话刚写入却读不到：直接从 sessionStorage 再读一次，避免卡在登录页 */
        try {
          var raw0 = sessionStorage.getItem(SESSION_KEY);
          if (raw0) s0 = JSON.parse(raw0);
        } catch (eR) {}
      }
      if (s0 && s0.token && String(s0.token).split('.').length === 3 && typeof CMGApi !== 'undefined' && CMGApi.setToken) {
        CMGApi.setToken(s0.token);
        if (CMGApi.setMode) CMGApi.setMode('http');
      }
    } catch (eTok) {}
    showGate(false);
    try {
      document.documentElement.classList.remove('auth-need-login', 'auth-boot');
      document.documentElement.classList.add('auth-has-session');
    } catch (eCls) {}
    setDefaultAppRoute();
    applyMenuPermissions();
    /* 切换账号后按用户重新加载业务数据 */
    try { if (window.FinanceModule && FinanceModule.reload) FinanceModule.reload(); } catch (e1) {}
    try { if (window.DocsModule && DocsModule.render) DocsModule.render(); } catch (e2) {}
    bindAdminPage();
    if (mustChange) {
      openChangePwdModal(true);
      return;
    }
    if (typeof window.Auth !== 'undefined' && window.Auth._onReady) {
      try { window.Auth._onReady(); } catch (e) {}
    }
    /* 无权限时落到帮助页 */
    var s = getSession();
    if (s && s.role !== 'admin') {
      var path = location.hash.replace(/^#/, '') || '/dashboard';
      var page = (typeof PAGE_PATHS !== 'undefined' && PAGE_PATHS[path]) ? PAGE_PATHS[path] : 'dashboard';
      if (!hasFeature(page)) {
        var first = (s.features || []).find(function (k) { return k !== 'admin-users'; }) || 'help';
        if (typeof window.switchPage === 'function') window.switchPage(first);
      }
    }
  }

  function boot() {
    bindGate();
    try { refreshContactConfig(); } catch (e) {}
    var s0 = getSession();
    if (s0) {
      /* 保持 auth-boot：主界面仍隐藏，等 vault + enterApp 再一次亮出 */
      ensureVault().then(function () {
        var s = getSession();
        if (s) enterApp(!!s.mustChangePwd);
        else {
          showGate(true);
          switchAuthView('login');
        }
      }).catch(function () {
        showGate(true);
        switchAuthView('login');
      });
    } else {
      showGate(true);
      switchAuthView('login');
      /* 统一服务端登录：登录页不预热本地演示库，避免弹出初始密码提示 */
    }
  }

  /* 拦截无权限页面 */
  var _origSwitch = null;
  function wrapRouter() {
    if (typeof window.switchPage !== 'function' || window.__authRouterWrapped) return;
    window.__authRouterWrapped = true;
    _origSwitch = window.switchPage;
    window.switchPage = function (name) {
      if (!requireAuth()) {
        showGate(true);
        setLoginRoute();
        return;
      }
      /* hasFeature 已映射 finance-ledger → finance-* / review-* */
      if (!hasFeature(name) && name !== 'help') {
        if (typeof toast === 'function') toast('当前账号无权限访问该功能', 'warning');
        return;
      }
      if (name === 'admin-users') {
        var s = getSession();
        if (!isSuperAdminSession(s)) {
          if (typeof toast === 'function') toast('仅超级管理员可访问账号与权限管理', 'warning');
          return;
        }
        renderAdminUsers();
      }
      return _origSwitch(name);
    };
  }

  window.Auth = {
    openChangePwdModal: openChangePwdModal,
    closeChangePwdModal: closeChangePwdModal,
    closeAccountPanel: closeAccountPanel,
    closeSidebarAccountPanel: closeSidebarAccountPanel,
    boot: boot,
    login: login,
    logout: logout,
    current: current,
    hasFeature: hasFeature,
    requireAuth: requireAuth,
    features: FEATURES,
    listUsersPublic: listUsersPublic,
    renderAdminUsers: renderAdminUsers,
    wrapRouter: wrapRouter,
    applyMenuPermissions: applyMenuPermissions,
    _onReady: null
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      setTimeout(function () { wrapRouter(); boot(); }, 0);
    });
  } else {
    setTimeout(function () { wrapRouter(); boot(); }, 0);
  }
})();


/* ========== js/core/storage.js ========== */
/* js/core/storage.js */
/* ===== 持久化存储（localStorage）===== */
  var _SK = (typeof CMGShared !== 'undefined' && CMGShared.STORAGE_KEYS) ? CMGShared.STORAGE_KEYS : null;
  var STORAGE_KEY = (_SK && _SK.INVENTORY) ? _SK.INVENTORY : 'inventory_check_v1';
  var STORAGE_VERSION = (typeof CMGShared !== 'undefined' && CMGShared.STORAGE_VERSION) ? CMGShared.STORAGE_VERSION : 1;
  /* 软删除墓碑区：已删除商品保留在存储中，仅从工作集合移除 */
  var deletedItems = [];
  function allItems() { return items.concat(deletedItems); }
  function saveItems() {
    /* 建议1：经 CMGInventory 门面，Http 模式自动 bulk 同步 */
    if (typeof CMGInventory !== 'undefined' && CMGInventory.save) {
      CMGInventory.save(allItems());
      return;
    }
    try {
      var payload = { v: STORAGE_VERSION, items: allItems(), t: Date.now() };
      CMGUserStore.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch (err) {
      console.warn('保存失败：', err);
    }
  }
  function loadItems() {
    if (typeof CMGInventory !== 'undefined' && CMGInventory.readLocal) {
      var list = CMGInventory.readLocal();
      if (list && list.length) return list;
    }
    try {
      var raw = (typeof CMGUserStore !== 'undefined' && CMGUserStore.getItem)
        ? CMGUserStore.getItem(STORAGE_KEY)
        : null;
      if (!raw) {
        try { raw = localStorage.getItem(STORAGE_KEY); } catch (eLs) {}
      }
      if (!raw) return [];
      var data = JSON.parse(raw);
      if (Array.isArray(data)) return data;
      if (!data || !Array.isArray(data.items)) return [];
      return data.items;
    } catch (err) {
      console.warn('读取失败：', err);
      return [];
    }
  }
  function clearStoredItems() {
    if (typeof CMGInventory !== 'undefined' && CMGInventory.clear) {
      CMGInventory.clear();
      return;
    }
    try { localStorage.removeItem(STORAGE_KEY); } catch (err) {}
  }
  /* 启动恢复：本地 localStorage 优先；有服务端再合并 */
  (function () {
    function applyRestored(restored) {
      if (!restored || !restored.length) return;
      items = [];
      deletedItems = [];
      restored.forEach(function (it) {
        if (it && it.deleted) deletedItems.push(it);
        else items.push(it);
      });
      try { rebuildLookup(); } catch (eR) {}
    }
    applyRestored(loadItems());
    savedSnapshots = loadSnapshots();
    /* 登录后异步拉取：服务端有数据覆盖本地；本地有而服务端空则回写 */
    if (typeof CMGInventory !== 'undefined' && CMGInventory.load) {
      try {
        CMGInventory.load().then(function (list) {
          if (list && list.length) {
            applyRestored(list);
            try {
              if (typeof renderPage === 'function') renderPage();
              if (typeof calcStats === 'function') calcStats();
              if (typeof renderScanData === 'function') renderScanData();
            } catch (eUi) {}
          }
        }).catch(function () {});
      } catch (eL) {}
    }
  })();

  var $ = function (id) { return document.getElementById(id); };
  var tableBody = $('tableBody');
  var pager = $('pager');
  var pagerInfo = $('pagerInfo');
  var pageNumEl = $('pageNum');

  /* 初始化侧栏「盘点数据」徽标（已保存报告份数） */
  (function () {
    var b = $('menuScanDataBadge');
    if (!b) return;
    b.textContent = savedSnapshots.length;
    b.style.display = savedSnapshots.length > 0 ? '' : 'none';
  })();


/* ========== js/core/modal.js ========== */
/* js/core/modal.js */
/* ===== 自定义模态弹窗 ===== */
  var modalOverlay = $('modalOverlay');
  var modalContent = $('modalContent');
  var modalOk = $('modalOk');
  var modalCancel = $('modalCancel');
  var _modalCallback = null;
  var modalBox = $('modalBox');
  var modalHead = $('modalHead');
  var modalTitle = $('modalTitle');
  var modalHeadIco = $('modalHeadIco');

  function showModal(msg, type, callback, variant) {
    /* 含 HTML 标签时按富文本渲染（如报告详情表格），否则按纯文本 */
    if (/<[a-z][\s\S]*>/i.test(String(msg))) modalContent.innerHTML = msg;
    else modalContent.textContent = msg;
    _modalCallback = callback || null;
    /* 重置头部与危险态：普通弹窗不显示标题栏 */
    if (modalHead) modalHead.hidden = true;
    if (modalBox) modalBox.classList.remove('modal-danger');
    modalOk.classList.remove('btn-danger');
    /* 宽度变体：'wide' = 数据表格（1040px），'form' = 表单面板（760px） */
    modalOverlay.classList.remove('modal-wide', 'modal-form', 'modal-form-lg');
    if (variant === 'wide') modalOverlay.classList.add('modal-wide');
    else if (variant === 'form-lg') modalOverlay.classList.add('modal-form-lg');
    else if (variant === 'form') modalOverlay.classList.add('modal-form');
    if ((variant === 'form' || variant === 'form-lg') && type !== 'confirm') {
      /* 仅「纯表单页」隐藏默认按钮；confirm+form 需保留确定/取消 */
      modalOk.style.display = 'none';
      modalCancel.style.display = 'none';
      if (modalHead) modalHead.hidden = true;
      if (modalHeadIco) modalHeadIco.innerHTML = '';
    } else if (type === 'confirm') {
      modalOk.style.display = '';
      modalCancel.style.display = '';
      modalOk.textContent = '确定';
      modalCancel.textContent = '取消';
      /* 无独立标题时用简短默认标题，保证标题+正文结构 */
      if (modalHead && modalTitle && (modalHead.hidden || modalHead.hasAttribute('hidden'))) {
        modalTitle.textContent = '请确认';
        modalHead.hidden = false;
        modalHead.removeAttribute('hidden');
      }
    } else {
      modalOk.style.display = '';
      modalCancel.style.display = 'none';
      modalOk.textContent = '知道了';
    }
    if (modalCloseBtn || $('modalClose')) {
      var mc = $('modalClose');
      if (mc) mc.style.display = '';
    }
    modalOverlay.classList.add('show');
  }

  /* 居中二次确认弹窗：标题 + 内容 + 确认/取消。
     所有删除类操作统一走这里（软删除前的最后一步）。
     用法：showConfirm({ title, message, confirmText, cancelText, danger, onConfirm, onCancel }) */
  function showConfirm(opts) {
    if (typeof opts === 'string') { showModal(opts, 'confirm', arguments[1]); return; }
    opts = opts || {};
    var msgHtml = '';
    if (/<[a-z][\s\S]*>/i.test(String(opts.message))) msgHtml = opts.message;
    else msgHtml = '<div class="modal-msg">' + String(opts.message || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br/>') + '</div>';
    /* 可选输入框：审核通过/驳回时填写说明备注 */
    if (opts.input) {
      var ph = opts.inputPlaceholder || '请填写说明（必填）';
      var req = opts.inputRequired !== false;
      var inputType = opts.inputType || 'textarea';
      var fieldHtml = inputType === 'password' || inputType === 'text'
        ? ('<input id="modalInputField" type="' + inputType + '" class="field-control" placeholder="' + ph + '" autocomplete="new-password" />')
        : ('<textarea id="modalInputField" class="modal-textarea field-control" rows="3" placeholder="' + ph + '"></textarea>');
      msgHtml += '<div class="modal-input-wrap">' +
        '<label class="modal-input-label">' + (opts.inputLabel || '审核说明') + (req ? ' <i class="req">*</i>' : '') + '</label>' +
        fieldHtml +
        '<div class="modal-input-error" id="modalInputError" hidden>请填写后再确认</div>' +
        '</div>';
      modalOverlay.classList.add('modal-form');
    } else {
      modalOverlay.classList.remove('modal-form');
    }
    modalContent.innerHTML = msgHtml;
    if (modalTitle) modalTitle.textContent = opts.title || '操作确认';
    if (modalHead) {
      modalHead.hidden = false;
      modalHead.removeAttribute('hidden');
    }
    /* 不再展示左侧圆形图标，统一标题+正文 */
    if (modalHeadIco) {
      modalHeadIco.innerHTML = '';
      modalHeadIco.hidden = true;
      modalHeadIco.setAttribute('hidden', '');
    }
    var danger = !!opts.danger;
    if (modalBox) modalBox.classList.toggle('modal-danger', danger);
    modalOk.classList.toggle('btn-danger', danger);
    modalOk.textContent = opts.confirmText || (danger ? '确认删除' : '确定');
    modalCancel.textContent = opts.cancelText || '取消';
    modalOk.style.display = '';
    modalCancel.style.display = '';
    modalOverlay.classList.remove('modal-wide');
    _modalCallback = function (ok) {
      if (ok && opts.input) {
        var inp = document.getElementById('modalInputField');
        var err = document.getElementById('modalInputError');
        var val = inp ? String(inp.value || '').trim() : '';
        if (opts.inputRequired !== false && !val) {
          if (err) err.hidden = false;
          if (inp) inp.focus();
          /* 校验失败时不关闭弹窗：重新显示 */
          modalOverlay.classList.add('show');
          return;
        }
        if (typeof opts.onConfirm === 'function') opts.onConfirm(val);
      } else if (ok && typeof opts.onConfirm === 'function') {
        opts.onConfirm();
      }
      if (!ok && typeof opts.onCancel === 'function') opts.onCancel();
    };
    modalOverlay.classList.add('show');
    setTimeout(function () {
      var inp = document.getElementById('modalInputField');
      if (inp) inp.focus();
    }, 50);
  }
  function hideModal() {
    modalOverlay.classList.remove('show');
    /* 清除宽度变体，避免影响后续普通弹窗 */
    modalOverlay.classList.remove('modal-wide', 'modal-form', 'modal-form-lg');
  }
  modalOk.addEventListener('click', function () {
    var cb = _modalCallback;
    /* 带输入框的弹窗：先校验再关闭，避免说明未填就消失 */
    var inp = document.getElementById('modalInputField');
    if (inp && modalOverlay.classList.contains('modal-form')) {
      var val = String(inp.value || '').trim();
      var err = document.getElementById('modalInputError');
      if (!val) {
        if (err) err.hidden = false;
        inp.focus();
        return;
      }
    }
    hideModal();
    if (cb) cb(true);
  });
  modalCancel.addEventListener('click', function () {
    var cb = _modalCallback;
    hideModal();
    if (cb) cb(false);
  });
  var modalCloseBtn = $('modalClose');
  if (modalCloseBtn && !modalCloseBtn.__bound) {
    modalCloseBtn.__bound = true;
    modalCloseBtn.addEventListener('click', function () {
      var cb = _modalCallback;
      hideModal();
      if (cb) cb(false);
    });
  }
  modalOverlay.addEventListener('click', function (e) {
    if (e.target !== modalOverlay) return;
    /* 危险确认：禁止点遮罩关闭，避免误触 */
    if (modalBox && modalBox.classList.contains('modal-danger')) return;
    var cb = _modalCallback;
    hideModal();
    if (cb) cb(false);
  });


  /** 清空类确认：标题 + 正文，无圆形图标 */
  function confirmClear(title, message, onOk) {
    if (typeof window.showConfirm === 'function') {
      window.showConfirm({
        title: title || '确认清空',
        message: message || '',
        confirmText: '确定',
        cancelText: '取消',
        danger: false,
        onConfirm: function () { if (typeof onOk === 'function') onOk(); }
      });
      return;
    }
    showModal(message, 'confirm', function (ok) { if (ok && typeof onOk === 'function') onOk(); });
  }

  window.showModal = showModal;
  window.showConfirm = showConfirm;
  window.hideModal = hideModal;
  window.confirmClear = confirmClear;


/* ========== js/core/router.js ========== */
/* js/core/router.js */
/* ===== 页面切换（基于 hash 路由，路径唯一） ===== */
  function _applyPage(name) {
    /* login 仅为门禁路由，不对应业务 page-section */
    if (name === 'login') return;
    if (!PAGE_INFO[name]) name = 'dashboard';
    var prevName = currentPageName;   /* 记录切页前的页面，供「是否离开园区」判断 */
    currentPageName = name;
    var sectionId = 'page-' + name;
    if (name.indexOf('finance-') === 0) sectionId = 'page-finance-ledger';
    if (name.indexOf('review-') === 0) sectionId = 'page-review-center';
    document.querySelectorAll('.page-section').forEach(function (s) {
      s.classList.toggle('active', s.id === sectionId);
    });
    document.querySelectorAll('.menu-item').forEach(function (m) {
      m.classList.toggle('active', m.getAttribute('data-page') === name);
    });
    /* 标记含当前页的一级分组（收起态用 has-active 高亮分组图标） */
    document.querySelectorAll('.menu-group').forEach(function (grp) {
      var on = !!grp.querySelector('.menu-item.active');
      grp.classList.toggle('has-active', on);
    });
    /* 自动展开当前页所在的菜单组 */
    var activeItem = document.querySelector('.menu-item.active');
    if (activeItem) {
      var grp = activeItem.closest('.menu-group');
      if (grp) {
        grp.classList.remove('collapsed');
        var head = grp.querySelector('.menu-group-head');
        if (head) head.setAttribute('aria-expanded', 'true');
      }
    }
    /* 同步常驻图标栏：切换页面后高亮其所属模块 */
    if (typeof syncRailToCurrentPage === 'function') {
      try { syncRailToCurrentPage(); } catch (eRail) {}
    }
    $('pageTitle').textContent = PAGE_INFO[name].title;
    if (name === 'scan-data') {
      $('pageSubtitle').textContent = SCAN_VIEW_INFO[currentScanView].subtitle;
    } else if (name === 'scan') {
      $('pageSubtitle').textContent = WORK_VIEW_INFO[currentWorkView].subtitle;
    } else if (name === 'machine-profit') {
      $('pageSubtitle').textContent = MACHINE_PROFIT_VIEW_INFO[currentMachineProfitView].subtitle;
    } else {
      $('pageSubtitle').textContent = PAGE_INFO[name].subtitle;
    }
    if (name === 'scan-data') applyScanView(currentScanView);
    else if (name === 'scan') applyWorkView(currentWorkView);
    else if (name === 'machine-profit') applyMachineProfitView(currentMachineProfitView);
    /* 数据看板：跨模块概览（盘点执行 + 仓库库存 + 滞销消耗） */
    if (name === 'dashboard') calcStats();
    /* 仓库管理：3D 园区 / 库存管理 */
    if (name === 'wh-park') WH.enterPark();
    else if (name === 'wh-stock') WH.enterStock();
    else if (name && name.indexOf('finance-') === 0 && window.FinanceModule) {
      try {
        var finView = ({
          'finance-ledger': 'board', 'finance-board': 'board',
          'finance-register': 'register', 'finance-records': 'records',
          'finance-source': 'amount', 'finance-amount': 'amount'
        })[name] || 'board';
        FinanceModule.render(finView);
      } catch (eFin) {}
    }
    /* 审核中心：待审核 / 已审核 / 已通过 / 已驳回 */
    else if (name && name.indexOf('review-') === 0 && window.FinanceModule) {
      try {
        FinanceModule.showView(({
          'review-pending': 'pending', 'review-progress': 'progress', 'review-done': 'done',
          'review-passed': 'passed', 'review-rejected': 'rejected'
        })[name] || 'pending');
      } catch (eRev) {}
    }
    if (name === 'wh-docs') {
      if (name && name.indexOf('finance-') === 0 && window.FinanceModule) {
      try {
        var finView2 = ({ 'finance-ledger':'board','finance-board':'board','finance-register':'register','finance-records':'records','finance-source':'amount','finance-amount':'amount' })[name] || 'board';
        FinanceModule.render(finView2);
      } catch (e0) {}
    }
    if (typeof DocsModule !== 'undefined' && DocsModule.render) {
        try { DocsModule.render(); } catch (e) { console.warn('[docs]', e); }
      }
    } else if (name === 'machine-category') {
      if (typeof applyCategoryView === 'function') {
        try { applyCategoryView(currentCategoryView || 'import'); } catch (e) { console.warn('[category]', e); }
      } else if (typeof CategoryModule !== 'undefined' && CategoryModule.render) {
        try { CategoryModule.render(currentCategoryView || 'import'); } catch (e2) { console.warn('[category]', e2); }
      }
    } else if (name === 'admin-users') {
      if (typeof Auth !== 'undefined' && Auth.renderAdminUsers) {
        try { Auth.renderAdminUsers(); } catch (e) { console.warn('[auth]', e); }
      }
    }
    /* 仅在真正离开园区时卸载，避免每次切页都执行 unmount 造成无谓开销 */
    if (name !== 'wh-park' && prevName === 'wh-park') WH.leave();
  }

  /* 解析 hash 子路径 → 扫码盘点页的子页标识 */
  function _parseWorkView(path) {
    if (path === '/import') return 'import';
    var m = path.match(/^\/scan\/(import|entry)$/);
    return m ? m[1] : WORK_VIEW_DEFAULT;
  }
  /* 解析 hash 子路径 → 盘点数据页的子页标识 */
  function _parseScanView(path) {
    if (path === '/detail') return 'detail';
    var m = path.match(/^\/scan-data\/(detail|pre|reports|compare)$/);
    return m ? m[1] : SCAN_VIEW_DEFAULT;
  }

  /* 切换扫码盘点页子导航：数据导入 / 扫码录入 */
  function applyWorkView(view) {
    if (WORK_VIEWS.indexOf(view) === -1) view = WORK_VIEW_DEFAULT;
    currentWorkView = view;
    var tabs = document.querySelectorAll('#workNav .sub-tab');
    for (var i = 0; i < tabs.length; i++) {
      var on = tabs[i].getAttribute('data-stab') === view;
      tabs[i].classList.toggle('active', on);
      tabs[i].setAttribute('aria-selected', on ? 'true' : 'false');
    }
    document.querySelectorAll('#page-scan [data-stab-panel]').forEach(function (p) {
      p.classList.toggle('active', p.getAttribute('data-stab-panel') === view);
    });
    if (view === 'entry') focusScanInput(120);
  }
  /* 切换盘点数据页的独立子页：只渲染当前板块 */
  function applyScanView(view) {
    if (SCAN_VIEWS.indexOf(view) === -1) view = SCAN_VIEW_DEFAULT;
    currentScanView = view;
    /* 切换 sub-tab active 状态（参考库存管理 Tab 布局） */
    var tabs = document.querySelectorAll('#globalNav .sub-tab');
    for (var i = 0; i < tabs.length; i++) {
      var on = tabs[i].getAttribute('data-stab') === view;
      tabs[i].classList.toggle('active', on);
      tabs[i].setAttribute('aria-selected', on ? 'true' : 'false');
    }
    /* 切换 tab-panel active 状态（data-stab-panel 委托） */
    document.querySelectorAll('#page-scan-data [data-stab-panel]').forEach(function (p) {
      p.classList.toggle('active', p.getAttribute('data-stab-panel') === view);
    });
    /* 独立渲染：每个子页只加载自己需要的数据 */
    if (view === 'detail') renderPage();
    else if (view === 'pre') renderPreScan();
    else if (view === 'reports') { renderSnapshots(); }
    else if (view === 'compare') {
      refreshCompareSelect();
      var empty = $('compareEmpty'), res = $('compareResult');
      if (empty) empty.style.display = (compareState.rows && compareState.rows.length) ? 'none' : '';
      if (res && (!compareState.rows || !compareState.rows.length)) res.style.display = 'none';
    }
  }
  /* 扫码盘点子导航点击 */
  (function () {
    var wNav = $('workNav');
    if (wNav) wNav.addEventListener('click', function (e) {
      var t = (e.target && e.target.closest) ? e.target.closest('.sub-tab') : null;
      if (!t) return;
      var view = t.getAttribute('data-view') || WORK_VIEW_DEFAULT;
      if (WORK_VIEWS.indexOf(view) === -1) view = WORK_VIEW_DEFAULT;
      var next = '#/scan/' + view;
      if (location.hash !== next) location.hash = next;
      else applyWorkView(view);
    });
  })();
  /* sub-tab 点击 → 通过 hash 路由触发切换（保留可直达与前进后退） */
  (function () {
    var gNav = $('globalNav');
    if (gNav) gNav.addEventListener('click', function (e) {
      var t = (e.target && e.target.closest) ? e.target.closest('.sub-tab') : null;
      if (!t) return;
      var view = t.getAttribute('data-view') || 'pre';
      if (SCAN_VIEWS.indexOf(view) === -1) view = SCAN_VIEW_DEFAULT;
      var next = '#/scan-data/' + view;
      if (location.hash !== next) location.hash = next;
      else applyScanView(view);
    });
  })();
  /* 切换到指定路径（hash 变化即触发实际渲染） */

  function _parseMachineProfitView(path) {
    var m = path.match(/^\/machine-profit\/(week|month|import)$/);
    return m ? m[1] : MACHINE_PROFIT_VIEW_DEFAULT;
  }
  function applyMachineProfitView(view) {
    if (MACHINE_PROFIT_VIEWS.indexOf(view) === -1) view = MACHINE_PROFIT_VIEW_DEFAULT;
    currentMachineProfitView = view;
    var root = $('page-machine-profit');
    if (!root) return;
    root.querySelectorAll('[data-mp-panel]').forEach(function (p) {
      var on = p.getAttribute('data-mp-panel') === view;
      p.classList.toggle('active', on);
      p.hidden = !on;
      p.style.display = on ? 'block' : 'none';
    });
    var nav = $('machineProfitNav');
    if (nav) {
      nav.querySelectorAll('.sub-tab').forEach(function (t) {
        var on = t.getAttribute('data-mp-view') === view;
        t.classList.toggle('active', on);
        t.setAttribute('aria-selected', on ? 'true' : 'false');
      });
    }
    if (PAGE_INFO['machine-profit'] && currentPageName === 'machine-profit') {
      $('pageSubtitle').textContent = MACHINE_PROFIT_VIEW_INFO[view].subtitle;
    }
    if (typeof MachineModule !== 'undefined' && MachineModule.render) {
      MachineModule.render(view);
    }
  }
  window.applyMachineProfitView = applyMachineProfitView;
  window.goMachineProfitView = function (view) {
    if (MACHINE_PROFIT_VIEWS.indexOf(view) === -1) view = MACHINE_PROFIT_VIEW_DEFAULT;
    currentMachineProfitView = view;
    var hash = '#/machine-profit/' + view;
    if (location.hash !== hash) location.hash = hash;
    else applyMachineProfitView(view);
  };

  function _parseCategoryView(path) {
    var m = String(path || '').match(/^\/machine-category\/(import|analysis)$/);
    return m ? m[1] : CATEGORY_VIEW_DEFAULT;
  }
  function applyCategoryView(view) {
    if (CATEGORY_VIEWS.indexOf(view) === -1) view = CATEGORY_VIEW_DEFAULT;
    currentCategoryView = view;
    var nav = $('categoryNav');
    if (nav) {
      nav.querySelectorAll('.sub-tab').forEach(function (t) {
        var on = t.getAttribute('data-cat-view') === view;
        t.classList.toggle('active', on);
        t.setAttribute('aria-selected', on ? 'true' : 'false');
      });
    }
    document.querySelectorAll('#page-machine-category [data-cat-panel]').forEach(function (p) {
      p.classList.toggle('active', p.getAttribute('data-cat-panel') === view);
    });
    if (PAGE_INFO['machine-category'] && currentPageName === 'machine-category') {
      var info = CATEGORY_VIEW_INFO[view];
      if (info && $('pageSubtitle')) $('pageSubtitle').textContent = info.subtitle;
    }
    if (typeof CategoryModule !== 'undefined' && CategoryModule.render) {
      try { CategoryModule.render(view); } catch (e) { console.warn('[category]', e); }
    }
  }
  window.applyCategoryView = applyCategoryView;
  window.goCategoryView = function (view) {
    if (CATEGORY_VIEWS.indexOf(view) === -1) view = CATEGORY_VIEW_DEFAULT;
    currentCategoryView = view;
    var hash = '#/machine-category/' + view;
    if (location.hash !== hash) location.hash = hash;
    else applyCategoryView(view);
  };

  window.switchPage = function (name) {
    if (!PAGE_INFO[name]) return;
    /* 带子页的页面保证路径唯一、可直达与前进后退 */
    var target;
    if (name === 'scan-data') target = '/scan-data/' + currentScanView;
    else if (name === 'scan') target = '/scan/' + currentWorkView;
    else if (name === 'machine-profit') target = '/machine-profit/' + currentMachineProfitView;
    else if (name === 'machine-category') target = '/machine-category/' + currentCategoryView;
    else target = '/' + name;
    if (location.hash.replace(/^#/, '') !== target) {
      location.hash = '#' + target;
    } else {
      _applyPage(name);
    }
  };
  /* 跳转到盘点数据页的指定子页（供侧栏/看板/说明页等入口调用） */
  window.goScanView = function (view) {
    if (SCAN_VIEWS.indexOf(view) === -1) view = SCAN_VIEW_DEFAULT;
    currentScanView = view;
    var next = '#/scan-data/' + view;
    if (location.hash === next) { _applyPage('scan-data'); }
    else location.hash = next;
  };
  window.addEventListener('hashchange', function () {
    var path = location.hash.replace(/^#/, '') || '';
    if (path === '/login' || path === 'login') {
      if (typeof Auth !== 'undefined' && typeof Auth.requireAuth === 'function' && Auth.requireAuth()) {
        history.replaceState(null, '', '#/dashboard');
        _applyPage('dashboard');
      }
      return;
    }
    var name = PAGE_PATHS[path] || 'dashboard';
    if (name === 'scan') {
      currentWorkView = _parseWorkView(path);
      var canonicalWork = '#/scan/' + currentWorkView;
      /* 旧路径 #/import 或 #/scan 规范化为 #/scan/import|entry */
      if (location.hash !== canonicalWork) {
        history.replaceState(null, '', canonicalWork);
      }
    }
    if (name === 'scan-data') {
      currentScanView = _parseScanView(path);
      /* 规范化为完整子路径（#/scan-data → #/scan-data/pre），避免同一页面出现两条路径 */
      var canonical = '#/scan-data/' + currentScanView;
      if (location.hash !== canonical) {
        history.replaceState(null, '', canonical);
      }
    }
    if (name === 'machine-profit') {
      currentMachineProfitView = _parseMachineProfitView(path);
      var canonicalMp = '#/machine-profit/' + currentMachineProfitView;
      if (location.hash !== canonicalMp) {
        history.replaceState(null, '', canonicalMp);
      }
    }
    if (name === 'machine-category') {
      currentCategoryView = _parseCategoryView(path);
      var canonicalCat = '#/machine-category/' + currentCategoryView;
      if (location.hash !== canonicalCat) {
        history.replaceState(null, '', canonicalCat);
      }
    }
    _applyPage(name);
    closeSidebar();
  });

  /* 跳转到扫码盘点的子页：import=数据导入，scan/entry=扫码录入 */
  window.goWork = function (section) {
    if (section === 'scan' || section === 'entry') {
      currentWorkView = 'entry';
      var nextE = '#/scan/entry';
      if (location.hash === nextE) { _applyPage('scan'); focusScanInput(320); }
      else location.hash = nextE;
      return;
    }
    currentWorkView = 'import';
    var nextI = '#/scan/import';
    if (location.hash === nextI) { _applyPage('scan'); }
    else location.hash = nextI;
  };
  /* 聚焦桌面扫码输入框 */
  function focusScanInput(delay) {
    setTimeout(function () {
      try { if (typeof window.__rebindScanInputs === 'function') window.__rebindScanInputs(); } catch (eR) {}
      var d = $('scanInputDesktop');
      var m = $('scanInputMobile');
      var el = (window.innerWidth < 768 && m) ? m : d;
      if (el) {
        try { el.focus({ preventScroll: true }); } catch (err) { try { el.focus(); } catch (e2) {} }
      }
    }, delay || 100);
  }
  window.goScanPage = function () { window.goWork('entry'); };

  document.querySelectorAll('.menu-item').forEach(function (item) {
    item.addEventListener('click', function () {
      if (item.classList.contains('menu-item-section')) return;
      var page = item.getAttribute('data-page');
      if (!page) return;
      switchPage(page);
    });
  });

  /* 机台毛利子导航：周毛利 / 月毛利 / 数据源导入 */
  document.addEventListener('click', function (e) {
    var t = e.target && e.target.closest ? e.target.closest('#machineProfitNav .sub-tab') : null;
    if (!t) return;
    var v = t.getAttribute('data-mp-view');
    if (!v) return;
    e.preventDefault();
    if (typeof window.goMachineProfitView === 'function') window.goMachineProfitView(v);
  });

  /* 备用金子导航：额度 / 来源 */
  window.__finSettingsTab = window.__finSettingsTab || 'reserve';
  function applyFinSettingsTab(tab) {
    tab = tab === 'source' ? 'source' : 'reserve';
    window.__finSettingsTab = tab;
    var nav = document.getElementById('finSettingsNav');
    if (nav) {
      nav.querySelectorAll('.sub-tab').forEach(function (btn) {
        var on = btn.getAttribute('data-fin-settings') === tab;
        btn.classList.toggle('active', on);
        btn.setAttribute('aria-selected', on ? 'true' : 'false');
      });
    }
    document.querySelectorAll('#page-finance-ledger [data-fin-settings-panel]').forEach(function (p) {
      p.classList.toggle('active', p.getAttribute('data-fin-settings-panel') === tab);
    });
    if (tab === 'source') {
      try { renderSources(); } catch (e0) {}
    }
    if (tab === 'reserve') {
      try { renderReservePeriods(); } catch (eP) {}
      try { updateStats(); } catch (e1) {}
      try {
        if (typeof window.ensureReserveDp === 'function') window.ensureReserveDp();
        else if (typeof ensureReserveDp === 'function') ensureReserveDp();
      } catch (eDp2) {}
    }
  }
  window.applyFinSettingsTab = applyFinSettingsTab;
  document.addEventListener('click', function (e) {
    var t = e.target && e.target.closest ? e.target.closest('#finSettingsNav .sub-tab') : null;
    if (!t) return;
    var v = t.getAttribute('data-fin-settings');
    if (!v) return;
    e.preventDefault();
    applyFinSettingsTab(v);
  });

  /* 品类统计子导航：数据导入 / 品类分析 */
  document.addEventListener('click', function (e) {
    var t = e.target && e.target.closest ? e.target.closest('#categoryNav .sub-tab') : null;
    if (!t) return;
    var v = t.getAttribute('data-cat-view');
    if (!v) return;
    e.preventDefault();
    e.stopPropagation();
    if (typeof window.goCategoryView === 'function') window.goCategoryView(v);
    else if (typeof window.applyCategoryView === 'function') window.applyCategoryView(v);
  });

  /* 菜单组标题：展开态折叠分组；收起态点击一级图标进入该组第一个页面 */
  document.querySelectorAll('.menu-group-head').forEach(function (head) {
    head.addEventListener('click', function () {
      var group = head.parentElement;
      if (!group || !group.classList.contains('menu-group')) return;
      var shell = document.getElementById('menuShell');
      /* 外壳收起态（一级菜单只显示图标）：点击图标直接进入该组首个页面 */
      if (shell && shell.classList.contains('is-collapsed')) {
        var firstPage = group.querySelector('.menu-item[data-page]');
        if (firstPage) switchPage(firstPage.getAttribute('data-page'));
        return;
      }
      var collapsed = group.classList.toggle('collapsed');
      head.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
    });
  });


/* ========== js/core/sidebar.js ========== */
/* js/core/sidebar.js — 侧边栏：移动端抽屉 · 折叠 · 搜索 · 账户 */
  var sidebar = $('menuShell');
  var overlay = $('sidebarOverlay');
  function openSidebar() {
    if (sidebar) sidebar.classList.add('open');
    if (overlay) overlay.classList.add('show');
  }
  function closeSidebar() {
    if (sidebar) sidebar.classList.remove('open');
    if (overlay) overlay.classList.remove('show');
  }
  var menuToggle = $('menuToggle');
  if (menuToggle) menuToggle.addEventListener('click', openSidebar);
  if (overlay) overlay.addEventListener('click', closeSidebar);

  /* 收起 / 展开：统一外壳收起后仅保留左侧图标栏 */
  var sidebarToggleBtn = $('sidebarToggle');
  var SHELL_KEY = 'cmg_menu_shell_collapsed';
  function syncCollapseIcon(collapsed) {
    var ico = document.getElementById('sidebarToggleIcon');
    if (!ico) return;
    /* 阿里巴巴 Ant Design 图标：收起用 menu-fold，展开（栏已收）用 menu-unfold */
    ico.setAttribute('icon', collapsed ? 'ant-design:menu-unfold-outlined' : 'ant-design:menu-fold-outlined');
  }
  function toggleSidebar() {
    if (!sidebar) return;
    var collapsed = sidebar.classList.toggle('is-collapsed');
    sidebar.setAttribute('data-collapsed', collapsed ? '1' : '0');
    try { localStorage.setItem(SHELL_KEY, collapsed ? '1' : '0'); } catch (e) {}
    if (sidebarToggleBtn) {
      sidebarToggleBtn.setAttribute('aria-label', collapsed ? '展开侧边菜单' : '收起侧边菜单');
      sidebarToggleBtn.setAttribute('title', collapsed ? '展开' : '收起');
      sidebarToggleBtn.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
      syncCollapseIcon(collapsed);
    }
    /* 从收起恢复时，确保一级标题节点可见（清可能被搜索写下的 display） */
    if (!collapsed) {
      document.querySelectorAll('#sidebarMenu .menu-group').forEach(function (grp) {
        if (grp.style.display === 'none' && !document.getElementById('sidebarSearch').value) {
          grp.style.display = '';
        }
      });
      document.querySelectorAll('#sidebarMenu .menu-item').forEach(function (it) {
        if (it.style.display === 'none' && !(document.getElementById('sidebarSearch') || {}).value) {
          it.style.display = '';
        }
      });
    }
  }
  if (sidebarToggleBtn) {
    sidebarToggleBtn.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      toggleSidebar();
    });
  }
  /* 收起态点击 Logo 亦可展开，避免只能找底部小按钮 */
  var shellLogo = document.querySelector('#menuShell .sidebar-logo');
  if (shellLogo) {
    shellLogo.addEventListener('click', function (e) {
      var shell = document.getElementById('menuShell');
      if (shell && shell.classList.contains('is-collapsed')) {
        e.preventDefault();
        e.stopPropagation();
        toggleSidebar();
      }
    });
  }
  /* 按本地记录同步折叠图标，避免刷新后图标与状态不一致 */
  (function initCollapseIcon() {
    var collapsed = sidebar && sidebar.classList.contains('is-collapsed');
    try {
      if (localStorage.getItem(SHELL_KEY) === '1') {
        if (sidebar && !sidebar.classList.contains('is-collapsed')) sidebar.classList.add('is-collapsed');
        collapsed = true;
      }
    } catch (e) {}
    syncCollapseIcon(!!collapsed);
    if (sidebarToggleBtn) {
      sidebarToggleBtn.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
      sidebarToggleBtn.setAttribute('title', collapsed ? '展开' : '收起');
      sidebarToggleBtn.setAttribute('aria-label', collapsed ? '展开侧边菜单' : '收起侧边菜单');
    }
  })();

  /* 菜单搜索过滤：仅点击搜索按钮触发 */
  function applySidebarSearch() {
    var searchInput = $('sidebarSearch');
    var q = searchInput ? (searchInput.value || '').trim().toLowerCase() : '';
    document.querySelectorAll('#sidebarMenu .menu-item').forEach(function (item) {
      var text = (item.textContent || '').toLowerCase();
      var show = !q || text.indexOf(q) >= 0;
      item.style.display = show ? '' : 'none';
    });
    document.querySelectorAll('#sidebarMenu .menu-group').forEach(function (grp) {
      var visible = Array.prototype.some.call(grp.querySelectorAll('.menu-item'), function (it) {
        return it.style.display !== 'none';
      });
      grp.style.display = visible || !q ? '' : 'none';
      if (q && visible) {
        var head = grp.querySelector('.menu-group-head');
        if (head) {
          head.setAttribute('aria-expanded', 'true');
          grp.classList.remove('collapsed');
        }
      }
    });
  }
  var searchInput = $('sidebarSearch');
  var btnSidebarSearch = $('btnSidebarSearch');
  if (btnSidebarSearch) {
    btnSidebarSearch.addEventListener('click', function (e) {
      e.preventDefault();
      applySidebarSearch();
    });
  }
  if (searchInput) {
    searchInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        applySidebarSearch();
      }
    });
  }

  /* ========== 常驻模块图标栏（Rail） ==========
     左侧窄栏长期保留，只放模块图标；点击后右侧面板仅显示该模块的子功能。
     菜单数据仍以原 .menu-group 为唯一来源，Rail 只是它的投影，
     因此既有路由 switchPage / 权限 applyMenuPermissions 逻辑完全不用改。 */
  var RAIL_KEY = 'cmg_rail_active_group';
  var railItemsEl = $('appRailItems');

  function railGroups() {
    return Array.prototype.slice.call(document.querySelectorAll('#sidebarMenu .menu-group[data-group]'));
  }

  /* 依据菜单分组生成图标栏按钮 */
  function buildRail() {
    if (!railItemsEl) return;
    var groups = railGroups();
    railItemsEl.innerHTML = groups.map(function (grp) {
      var key = grp.getAttribute('data-group');
      var head = grp.querySelector('.menu-group-head');
      var icon = head ? head.querySelector('iconify-icon') : null;
      var label = (grp.getAttribute('data-rail-label') || '').trim()
        || (head && head.querySelector('span') ? head.querySelector('span').textContent.trim() : '')
        || key;
      var iconName = icon ? icon.getAttribute('icon') : 'ant-design:appstore-outlined';
      return '<button type="button" class="app-rail-item" data-rail-group="' + key + '" ' +
        'data-rail-label="' + String(label).replace(/"/g, '&quot;') + '" title="' + String(label).replace(/"/g, '&quot;') + '">' +
        '<span class="app-rail-ico"><iconify-icon icon="' + iconName + '" width="18" height="18"></iconify-icon></span>' +
        '<span class="app-rail-text">' + String(label).replace(/[<>&]/g, '') + '</span>' +
        '<span class="app-rail-badge" data-rail-badge="' + key + '" hidden>0</span>' +
        '</button>';
    }).join('');
  }

  /* 切换右侧面板：只显示目标模块的分组 */
  function activateRailGroup(key, opts) {
    opts = opts || {};
    var groups = railGroups();
    if (!groups.length) return;
    var target = null;
    groups.forEach(function (g) { if (g.getAttribute('data-group') === key) target = g; });
    if (!target) target = groups[0];
    var activeKey = target.getAttribute('data-group');

    groups.forEach(function (g) {
      var on = g === target;
      /* 用 hidden 属性而非 display:none，避免与权限过滤的 style.display 互相覆盖 */
      g.hidden = !on;
      g.classList.toggle('is-rail-active', on);
      if (on) {
        g.classList.remove('collapsed');
        var head = g.querySelector('.menu-group-head');
        if (head) head.setAttribute('aria-expanded', 'true');
      }
    });

    if (railItemsEl) {
      railItemsEl.querySelectorAll('.app-rail-item').forEach(function (btn) {
        btn.classList.toggle('is-active', btn.getAttribute('data-rail-group') === activeKey);
      });
    }
    try { localStorage.setItem(RAIL_KEY, activeKey); } catch (e) {}
    /* 面板标题跟随模块名 */
    var head = target.querySelector('.menu-group-head');
    var titleEl = $('sidebarPanelTitle');
    if (titleEl && head) {
      var span = head.querySelector('span');
      titleEl.textContent = span ? span.textContent.trim() : activeKey;
    }

    if (!opts.noNavigate) {
      var first = target.querySelector('.menu-item[data-page]');
      if (first) {
        var page = first.getAttribute('data-page');
        /* 已在该模块内则不再跳页，避免打断用户操作 */
        if (page !== currentPageName) switchPage(page);
      }
    }
  }

  /* 当前页所属模块高亮（路由切换时同步） */
  function syncRailToCurrentPage() {
    var groups = railGroups();
    for (var i = 0; i < groups.length; i++) {
      var hit = groups[i].querySelector('.menu-item[data-page="' + currentPageName + '"]');
      if (hit) { activateRailGroup(groups[i].getAttribute('data-group'), { silent: true, noNavigate: true }); return; }
    }
  }

  if (railItemsEl) {
    railItemsEl.addEventListener('click', function (e) {
      var btn = e.target.closest && e.target.closest('[data-rail-group]');
      if (!btn) return;
      e.preventDefault();
      /* 收起态下点击图标：先展开外壳显示二级菜单列表，再切换模块。
         否则右侧列表被隐藏，用户点了图标看不到任何变化。 */
      var shell = document.getElementById('menuShell');
      if (shell && shell.classList.contains('is-collapsed') && typeof toggleSidebar === 'function') {
        toggleSidebar();
      }
      activateRailGroup(btn.getAttribute('data-rail-group'));
    });
  }
  buildRail();
  /* 初始模块：优先读上次选择，否则跟随默认页 */
  (function initRail() {
    var saved = '';
    try { saved = localStorage.getItem(RAIL_KEY) || ''; } catch (e) {}
    if (saved && document.querySelector('#sidebarMenu .menu-group[data-group="' + saved + '"]')) {
      activateRailGroup(saved, { noNavigate: true });
    } else if (currentPageName) {
      syncRailToCurrentPage();
    }
  })();
  window.activateRailGroup = activateRailGroup;

  /* 底部账户展开 */
  var accBtn = $('sidebarAccountBtn');
  var accPanel = $('sidebarAccountPanel');
  if (accBtn && accPanel) {
    accBtn.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      var shell = document.getElementById('menuShell');
      var open = accBtn.getAttribute('aria-expanded') === 'true';
      if (open) {
        accBtn.setAttribute('aria-expanded', 'false');
        accPanel.setAttribute('hidden', '');
        accPanel.hidden = true;
        accPanel.style.display = 'none';
        if (shell) shell.classList.remove('is-account-open');
      } else {
        accBtn.setAttribute('aria-expanded', 'true');
        accPanel.removeAttribute('hidden');
        accPanel.hidden = false;
        accPanel.style.display = '';
        if (shell) shell.classList.add('is-account-open');
        /* 打开时确保「修改密码」存在且可见 */
        (function ensureChangePwdBtn() {
          var actions = document.getElementById('accountActions') || accPanel.querySelector('.account-actions');
          if (!actions) return;
          var btn = document.getElementById('btnChangePwd');
          if (!btn) {
            btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'account-action';
            btn.id = 'btnChangePwd';
            btn.title = '修改登录密码';
            btn.innerHTML = '<iconify-icon class="account-action-ico" icon="ant-design:lock-outlined" width="16" height="16"></iconify-icon><span>修改密码</span><iconify-icon class="account-action-arrow" icon="ant-design:right-outlined" width="12" height="12"></iconify-icon>';
            var up = document.getElementById('btnUpgradePlan');
            if (up && up.parentNode === actions) actions.insertBefore(btn, up);
            else actions.appendChild(btn);
          }
          btn.style.display = 'flex';
          btn.style.visibility = 'visible';
          btn.hidden = false;
          btn.removeAttribute('hidden');
          if (!btn.__pwdBound) {
            btn.__pwdBound = true;
            btn.addEventListener('click', function (ev) {
              ev.preventDefault();
              ev.stopPropagation();
              if (typeof openChangePasswordFromUi === 'function') openChangePasswordFromUi();
              else if (window.Auth && Auth.openChangePwdModal) Auth.openChangePwdModal(false);
            });
          }
        })();
      }
    });
    /* 点击页面其它区域 / 非账号功能区 收起 */
    document.addEventListener('click', function (e) {
      if (!accPanel) return;
      var opened = !accPanel.hidden || (document.getElementById('menuShell') && document.getElementById('menuShell').classList.contains('is-account-open'));
      if (!opened) return;
      var root = $('sidebarAccount');
      var t = e.target;
      if (root && root.contains(t)) return;
      if (accBtn && accBtn.contains(t)) return;
      if (accPanel.contains(t)) return;
      closeAccountPanel();
    }, true);
  }


/* ========== js/core/bubble.js ========== */
/* js/core/bubble.js — 气泡弹窗 + 分页器工厂 */
/* js/core/pager.js */
/* ===== 通用分页器工厂 =====
     复用盘点明细页的 .pager 样式与交互（每页条数 / 上下页 / 跳页），
     以 class 查询代替 id，可在一个页面里实例化多份互不冲突。
       mount  : 分页器挂载的容器元素
       opts   : { pageSize, getData() -> 当前已过滤的全量数组,
                  onPage(rows, page, size, total, totalPages) }
     返回 { draw()当前数据重绘, reset()回到第 1 页并重绘 }
  */

/* js/core/bubble.js */
/* ===== 气泡弹窗工厂：把原生下拉/说明文字替换为轻量浮层 =====
     用法：createBubble(mountEl, { options:[{value,label}], value, onChange, info:'文本' })
     - options 传了即为下拉气泡；只传 info 即为信息气泡（? 按钮）
     - 点外部 / Esc / 页面滚动自动关闭；空间不足时向上弹出 */
  function createBubble(mount, opts) {
    if (!mount) return null;
    opts = opts || {};
    var isInfo = typeof opts.info === 'string';
    var value = opts.value != null ? opts.value : '';
    var options = opts.options || [];
    /* 初始值为空时回落到第一个选项（对齐原生 select 的默认选中行为） */
    if (!isInfo && options.length && (value === '' || value == null)) value = options[0].value;

    mount.classList.add('bubble');
    if (isInfo) mount.classList.add('bubble-info');
    mount.innerHTML =
      '<button type="button" class="bubble-trigger" aria-haspopup="' + (isInfo ? 'dialog' : 'listbox') + '" aria-expanded="false">' +
        '<span class="bubble-label"></span>' +
        (isInfo
          ? '<iconify-icon icon="ant-design:info-circle-outlined" width="14" height="14"></iconify-icon>'
          : '<iconify-icon class="bubble-caret" icon="ant-design:down-outlined" width="11" height="11"></iconify-icon>') +
      '</button>' +
      '<div class="bubble-menu" role="' + (isInfo ? 'dialog' : 'listbox') + '"></div>';

    var trigger = mount.querySelector('.bubble-trigger');
    var menu = mount.querySelector('.bubble-menu');
    var labelEl = mount.querySelector('.bubble-label');

    function render() {
      if (isInfo) { menu.innerHTML = '<div class="bubble-text">' + escapeHtml(opts.info) + '</div>'; return; }
      if (!options.length) {
        labelEl.textContent = '暂无可选项';
        menu.innerHTML = '<div class="bubble-text">暂无可选项</div>';
        return;
      }
      var active = null;
      for (var oi = 0; oi < options.length; oi++) {
        if (String(options[oi].value) === String(value)) { active = options[oi]; break; }
      }
      labelEl.textContent = active ? active.label : '';
      menu.innerHTML = options.map(function (o) {
        var on = String(o.value) === String(value);
        return '<div class="bubble-item' + (on ? ' active' : '') + '" role="option" aria-selected="' + on + '" data-value="' + escapeAttr(o.value) + '">' +
          '<span>' + escapeHtml(o.label) + '</span>' +
          '<iconify-icon class="bubble-check" icon="ant-design:check-outlined" width="13" height="13"></iconify-icon>' +
        '</div>';
      }).join('');
    }

    function place() {
      if (isInfo || !menu) return;
      var rect = trigger.getBoundingClientRect();
      var gap = 6;
      var menuH = menu.offsetHeight || 160;
      var below = window.innerHeight - rect.bottom;
      var up = below < menuH + gap && rect.top > below;
      menu.classList.toggle('up', up);
      menu.style.position = 'fixed';
      menu.style.left = Math.max(8, Math.min(rect.left, window.innerWidth - rect.width - 8)) + 'px';
      menu.style.width = rect.width + 'px';
      menu.style.minWidth = rect.width + 'px';
      menu.style.zIndex = '60000';
      menu.style.display = 'block';
      if (up) {
        menu.style.top = 'auto';
        menu.style.bottom = (window.innerHeight - rect.top + gap) + 'px';
      } else {
        menu.style.bottom = 'auto';
        menu.style.top = (rect.bottom + gap) + 'px';
      }
    }
    function parkMenu() {
      if (!menu) return;
      if (menu.parentNode !== mount) mount.appendChild(menu);
      menu.style.position = '';
      menu.style.left = '';
      menu.style.top = '';
      menu.style.bottom = '';
      menu.style.width = '';
      menu.style.minWidth = '';
      menu.style.zIndex = '';
      menu.style.display = '';
    }
    function open() {
      if (api) {
        _openBubbles.forEach(function (b) { if (b !== api) b.close(); });
        _openBubbles = [api];
      }
      mount.classList.add('open');
      trigger.setAttribute('aria-expanded', 'true');
      if (!isInfo && menu.parentNode !== document.body) document.body.appendChild(menu);
      place();
    }
    function close() {
      mount.classList.remove('open');
      trigger.setAttribute('aria-expanded', 'false');
      parkMenu();
    }
    function isOpen() { return mount.classList.contains('open'); }

    trigger.addEventListener('click', function (e) {
      e.stopPropagation();
      if (isOpen()) { close(); return; }
      render();
      open();
    });
    menu.addEventListener('click', function (e) {
      e.stopPropagation();
      var it = (e.target && e.target.closest) ? e.target.closest('.bubble-item') : null;
      if (!it) return;
      e.preventDefault();
      e.stopPropagation();
      value = it.getAttribute('data-value');
      close();
      /* 从全局打开列表移除，确保菜单立即收起 */
      _openBubbles = _openBubbles.filter(function (b) { return b !== api; });
      render();
      if (typeof opts.onChange === 'function') opts.onChange(value);
    });
    trigger.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && isOpen()) { close(); return; }
      if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && !isOpen()) {
        e.preventDefault();
        render(); open();
        var first = menu.querySelector('.bubble-item.active') || menu.querySelector('.bubble-item');
        if (first) first.focus();
      }
    });
    menu.addEventListener('keydown', function (e) {
      var items = Array.prototype.slice.call(menu.querySelectorAll('.bubble-item'));
      var idx = items.indexOf(document.activeElement);
      if (e.key === 'ArrowDown') { e.preventDefault(); (items[idx + 1] || items[0]).focus(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); (items[idx - 1] || items[items.length - 1]).focus(); }
      else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (items[idx]) items[idx].click(); }
      else if (e.key === 'Escape') { close(); trigger.focus(); }
    });

    render();
    var api = {
      el: mount,
      getValue: function () { return value; },
      setValue: function (v) { value = v; render(); },
      setOptions: function (list) {
        options = list || [];
        if (!options.some(function (o) { return String(o.value) === String(value); })) {
          value = options.length ? options[0].value : '';
        }
        render();
      },
      isOpen: isOpen,
      close: close
    };
    return api;
  }

  /* 同时只允许一个气泡打开（文档级单例管理） */
  var _openBubbles = [];
  document.addEventListener('click', function () {
    _openBubbles.forEach(function (b) { try { b.close(); } catch (e) {} });
    _openBubbles = [];
    document.querySelectorAll('.bubble.open').forEach(function (el) {
      el.classList.remove('open');
      var tr = el.querySelector('.bubble-trigger');
      if (tr) tr.setAttribute('aria-expanded', 'false');
      var orphan = document.body.querySelector(':scope > .bubble-menu');
      if (orphan && el.querySelector && !el.contains(orphan)) el.appendChild(orphan);
    });
  });
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    _openBubbles.forEach(function (b) { b.close(); });
    _openBubbles = [];
  });
  window.addEventListener('scroll', function () {
    _openBubbles.forEach(function (b) { b.close(); });
    _openBubbles = [];
  }, { passive: true });
  /* 暴露给兄弟模块（仓库设置弹窗的下拉也统一走这套气泡组件） */
  window.createBubble = createBubble;

  /**
   * 将原生 <select> 升级为气泡下拉（全站统一样式）
   * 保留原 select 隐藏同步 value，兼容既有逻辑。
   */
  function upgradeNativeSelect(selectEl, extra) {
    extra = extra || {};
    if (!selectEl || selectEl.tagName !== 'SELECT') return null;
    if (selectEl.__bubbleUpgraded) return selectEl.__bubbleApi || null;

    var parent = selectEl.parentNode;
    if (!parent) return null;

    var mount = document.createElement('div');
    mount.className = 'bubble bubble-block' + (extra.sm ? ' bubble-sm' : '');
    if (extra.className) mount.className += ' ' + extra.className;
    parent.insertBefore(mount, selectEl);

    selectEl.classList.add('bubble-native-hidden', 'bubble-upgraded-source');
    selectEl.setAttribute('tabindex', '-1');
    selectEl.setAttribute('aria-hidden', 'true');

    function readOptions() {
      return Array.prototype.map.call(selectEl.options || [], function (opt) {
        return { value: opt.value, label: opt.textContent || opt.label || opt.value };
      }).filter(function (o) { return o.value !== undefined; });
    }

    var api = createBubble(mount, {
      value: selectEl.value,
      options: readOptions(),
      onChange: function (v) {
        selectEl.value = v;
        try {
          selectEl.dispatchEvent(new Event('change', { bubbles: true }));
        } catch (e) {
          var ev = document.createEvent('HTMLEvents');
          ev.initEvent('change', true, false);
          selectEl.dispatchEvent(ev);
        }
        if (typeof extra.onChange === 'function') extra.onChange(v);
      }
    });

    selectEl.addEventListener('change', function () {
      if (api && api.getValue() !== selectEl.value) api.setValue(selectEl.value);
    });

    selectEl.__bubbleUpgraded = true;
    selectEl.__bubbleApi = api;
    return api;
  }

  function upgradeAllSelects(root) {
    root = root || document;
    var list = root.querySelectorAll('select.field-control, select.bubble-select, select[data-bubble="1"]');
    var apis = [];
    for (var i = 0; i < list.length; i++) {
      if (list[i].hasAttribute('data-bubble-skip')) continue;
      var a = upgradeNativeSelect(list[i]);
      if (a) apis.push(a);
    }
    return apis;
  }

  window.upgradeNativeSelect = upgradeNativeSelect;
  window.upgradeAllSelects = upgradeAllSelects;

  window.addEventListener('resize', function () {
    _openBubbles.forEach(function (b) { b.close(); });
    _openBubbles = [];
  });

  /* 日期格子去掉浏览器蓝色焦点框 */
  (function () {
    var s = document.createElement('style');
    s.textContent = '.mp-dp-day,.mp-dp-day:focus,.mp-dp-day:focus-visible,.mp-dp-day:active{outline:none!important;outline-offset:0!important;border:0!important;box-shadow:none!important}';
    document.head.appendChild(s);
  })();
  (function () {
    var tip = document.createElement('div');
    tip.className = 'app-tip';
    document.body.appendChild(tip);
    var current = null;
    function place(e) {
      tip.style.left = (e.clientX + 12) + 'px';
      tip.style.top = (e.clientY + 14) + 'px';
    }
    document.addEventListener('mouseover', function (e) {
      var el = e.target.closest && e.target.closest('[title], [data-tip]');
      if (!el || el.classList.contains('tooltip')) return;
      var text = el.getAttribute('data-tip') || el.getAttribute('title');
      if (!text) return;
      if (el.hasAttribute('title')) {
        el.setAttribute('data-tip-hold', text);
        el.removeAttribute('title');
      }
      current = el;
      tip.textContent = text;
      tip.style.display = 'block';
      place(e);
    });
    document.addEventListener('mousemove', function (e) {
      if (current) place(e);
    });
    document.addEventListener('mouseout', function (e) {
      if (!current) return;
      if (e.relatedTarget && current.contains(e.relatedTarget)) return;
      if (current.hasAttribute('data-tip-hold')) {
        current.setAttribute('title', current.getAttribute('data-tip-hold') || '');
        current.removeAttribute('data-tip-hold');
      }
      current = null;
      tip.style.display = 'none';
    });
  })();

  function createPager(mount, opts) {
    var state = { page: 1, size: opts.pageSize || 20 };
    mount.className = 'pager';
    mount.style.display = 'none';
    mount.innerHTML =
      '<div class="pager-left">' +
        '<span class="pager-info pg-info">-</span>' +
        '<span>每页</span>' +
        '<span class="bubble pg-size"></span>' +
        '<span>条</span>' +
      '</div>' +
      '<div class="pager-right">' +
        '<div class="pager-btns">' +
          '<button type="button" class="btn btn-outline btn-sm pg-prev">上一页</button>' +
          '<span class="pg-num" style="font-weight:700;color:var(--text);min-width:50px;text-align:center;font-variant-numeric:tabular-nums;">1</span>' +
          '<button type="button" class="btn btn-outline btn-sm pg-next">下一页</button>' +
        '</div>' +
      '</div>';
    var q = function (sel) { return mount.querySelector(sel); };
    var infoEl = q('.pg-info'), numEl = q('.pg-num'),
        prevBtn = q('.pg-prev'), nextBtn = q('.pg-next');
    var sizeBubble = createBubble(q('.pg-size'), {
      value: state.size,
      options: PAGE_SIZE_OPTIONS.map(function (n) { return { value: n, label: n + ' 条' }; }),
      onChange: function (v) {
        var n = parseInt(v, 10);
        if (!isNaN(n) && PAGE_SIZE_OPTIONS.indexOf(n) !== -1) {
          state.size = n;
          state.page = 1;
          draw();
        }
      }
    });
    function draw() {
      var data = opts.getData() || [];
      var total = data.length;
      var totalPages = Math.max(1, Math.ceil(total / state.size) || 1);
      if (state.page > totalPages) state.page = totalPages;
      if (state.page < 1) state.page = 1;
      var start = (state.page - 1) * state.size;
      var rows = data.slice(start, start + state.size);
      if (total === 0) {
        mount.style.display = 'none';
      } else {
        mount.style.display = 'flex';
        infoEl.textContent = '共 ' + total + ' 条，第 ' + state.page + '/' + totalPages + ' 页';
        numEl.textContent = state.page + ' / ' + totalPages;
        prevBtn.disabled = state.page <= 1;
        nextBtn.disabled = state.page >= totalPages;
      }
      opts.onPage(rows, state.page, state.size, total, totalPages);
    }
    prevBtn.addEventListener('click', function () {
      if (state.page > 1) { state.page--; draw(); }
    });
    nextBtn.addEventListener('click', function () {
      state.page++;
      draw();
    });
    return {
      draw: draw,
      reset: function () { state.page = 1; draw(); }
    };
  }
  window.createPager = createPager;

  /* 渲染第一段：盘点前账面（接入通用分页器） */
  var preScanPager = null;
  function renderPreScan() {
    var body = $('preScanBody');
    var summary = $('preScanSummary');
    if (!body) return;
    var mount = $('preScanPager');
    if (!preScanPager && mount) {
      preScanPager = createPager(mount, {
        pageSize: 20,
        getData: function () { return filterPreScan(loadOriginalSnapshot() || []); },
        onPage: function (rows, page, size, total) {
          renderPreScanRows(body, rows, total);
        }
      });
    }
    var orig = loadOriginalSnapshot() || [];
    var shown = filterPreScan(orig).length;
    summary.textContent = preScanKeyword
      ? ('— 匹配 ' + shown + ' / ' + orig.length + ' 条')
      : ('— 共 ' + orig.length + ' 条');
    if (preScanPager) {
      preScanPager.draw();
    } else {
      renderPreScanRows(body, filterPreScan(orig), shown);
    }
  }

  /* 盘点前账面搜索：按编号 / 条形码 / 名称 / 分类过滤 */
  var preScanKeyword = '';
  function filterPreScan(list) {
    var kw = preScanKeyword.trim().toLowerCase();
    if (!kw) return list;
    return list.filter(function (it) {
      return (it.code && it.code.toLowerCase().indexOf(kw) !== -1) ||
             (it.barcode && it.barcode.toLowerCase().indexOf(kw) !== -1) ||
             (it.name && it.name.toLowerCase().indexOf(kw) !== -1) ||
             (it.category && it.category.toLowerCase().indexOf(kw) !== -1);
    });
  }

  function renderPreScanRows(body, rows, total) {
    if (!total) {
      var hasData = (loadOriginalSnapshot() || []).length > 0;
      if (hasData && preScanKeyword) {
        body.innerHTML = '<tr><td colspan="5" class="empty">' +
          '<div class="empty-text"><strong>未找到匹配「' + escapeHtml(preScanKeyword.trim()) + '」的商品</strong>换个关键词试试</div>' +
          '</td></tr>';
        return;
      }
      body.innerHTML = '<tr><td colspan="5" class="empty">' +
        '<svg class="illus" width="132" height="96" viewBox="0 0 132 96">' +
        '<path class="il-a" d="M30 38l9-18h54l9 18"/>' +
        '<path class="il-f" d="M38 38h56v32a7 7 0 0 1-7 7H45a7 7 0 0 1-7-7z"/>' +
        '<path class="il-a" d="M38 38h56v32a7 7 0 0 1-7 7H45a7 7 0 0 1-7-7z"/>' +
        '<path class="il-b" d="M54 50h24M54 60h18"/></svg>' +
        '<div class="empty-text"><strong>暂无账面数据</strong>请先在「数据导入」页导入 Excel</div>' +
        '</td></tr>';
      return;
    }
    var html = [];
    for (var i = 0; i < rows.length; i++) {
      var it = rows[i];
      html.push(
        '<tr>' +
        '<td class="code-cell">' + escapeHtml(it.code) + '</td>' +
        '<td class="code-cell">' + escapeHtml(it.barcode || '-') + '</td>' +
        '<td class="name-cell">' + escapeHtml(it.name || '') + '</td>' +
        '<td>' + escapeHtml(it.category || '') + '</td>' +
        '<td class="num">' + (it.systemQty != null ? it.systemQty : 0) + '</td>' +
        '</tr>'
      );
    }
    body.innerHTML = html.join('');
  }

  /* 已保存报告的数据可视化：跨全部报告累计统计（复用 .cstat 卡片） */
  function renderReportStats() {
    var box = $('reportStats');
    if (!box) return;
    if (!savedSnapshots.length) { box.innerHTML = ''; box.style.display = 'none'; return; }
    box.style.display = '';

    var totalItems = 0, bookSum = 0, actualSum = 0;
    var bal = 0, sur = 0, def = 0, matched = 0, accSum = 0, accCount = 0;
    var codeSet = {};
    for (var i = 0; i < savedSnapshots.length; i++) {
      var s = savedSnapshots[i];
      var list = s.items || [];
      totalItems += list.length;
      var sBook = 0, sActual = 0, sBal = 0, sMatched = 0;
      for (var j = 0; j < list.length; j++) {
        var it = list[j];
        if (it.code) codeSet[it.code] = 1;
        if (it.systemQty != null) { bookSum += it.systemQty; sBook += it.systemQty; }
        if (it.actualQty != null) { actualSum += it.actualQty; sActual += it.actualQty; }
        if (it.status === 'balanced') { bal++; sBal++; }
        else if (it.status === 'surplus') sur++;
        else if (it.status === 'deficit') def++;
        if (it.status === 'balanced' || it.status === 'surplus' || it.status === 'deficit') {
          matched++; sMatched++;
        }
      }
      if (sMatched > 0) { accSum += (sBal / sMatched) * 100; accCount++; }
    }
    var uniqCount = Object.keys(codeSet).length;
    var avgAcc = accCount > 0 ? Math.round((accSum / accCount) * 10) / 10 : 0;
    var diffSum = actualSum - bookSum;
    var diffStr = (diffSum > 0 ? '+' : '') + diffSum;

    box.innerHTML =
      '<div class="cstat"><div class="cs-label">报告份数</div><div class="cs-value">' + savedSnapshots.length + '</div><div class="cs-sub">按保存时间倒序</div></div>' +
      '<div class="cstat"><div class="cs-label">累计盘点商品</div><div class="cs-value">' + uniqCount + '</div><div class="cs-sub">跨报告去重 · 共 ' + totalItems + ' 条</div></div>' +
      '<div class="cstat"><div class="cs-label">对平商品</div><div class="cs-value">' + bal + '</div><div class="cs-sub">账面 = 实盘</div></div>' +
      '<div class="cstat"><div class="cs-label">盘盈 / 盘亏</div><div class="cs-value is-text">' + sur + ' / ' + def + '</div><div class="cs-sub">差异商品 ' + (sur + def) + ' 个</div></div>' +
      '<div class="cstat"><div class="cs-label">数量总差异</div><div class="cs-value">' + diffStr + '</div><div class="cs-sub">实盘 ' + actualSum + ' − 账面 ' + bookSum + '</div></div>' +
      '<div class="cstat"><div class="cs-label">平均准确率</div><div class="cs-value">' + avgAcc + '%</div><div class="cs-sub">' + accCount + ' 份报告均值</div></div>';
  }

  /* 渲染第二段：已保存盘点报告列表 */
  function renderSnapshots() {
    var list = $('snapshotsList');
    var summary = $('snapshotsSummary');
    if (!list) return;
    summary.textContent = '— 共 ' + savedSnapshots.length + ' 份';
    renderReportStats();
    if (!savedSnapshots.length) {
      list.innerHTML = '<div class="empty empty-block">' +
        '<svg class="illus" width="132" height="96" viewBox="0 0 132 96">' +
        '<rect class="il-f" x="40" y="12" width="52" height="66" rx="7"/>' +
        '<rect class="il-a" x="40" y="12" width="52" height="66" rx="7"/>' +
        '<path class="il-b" d="M52 28h28M52 40h28M52 52h18"/></svg>' +
        '<div class="empty-text"><strong>暂无盘点报告</strong>完成盘点后，请到「盘点明细」页点击「保存为盘点报告」</div>' +
        '</div>';
      return;
    }
    var html = [];
    for (var i = 0; i < savedSnapshots.length; i++) {
      var s = savedSnapshots[i];
      var sur = 0, def = 0, bal = 0;
      for (var j = 0; j < s.items.length; j++) {
        if (s.items[j].status === 'surplus') sur++;
        else if (s.items[j].status === 'deficit') def++;
        else bal++;
      }
      html.push(
        '<div class="snapshot-card" data-sid="' + escapeAttr(s.id) + '">' +
          '<div class="snapshot-head">' +
            '<div class="snapshot-title">' +
              '<iconify-icon icon="ant-design:file-protect-outlined" width="16" height="16"></iconify-icon>' +
              '<strong>' + escapeHtml(s.name) + '</strong>' +
              '<span class="snapshot-time">' + escapeHtml(s.savedAt) + '</span>' +
            '</div>' +
            '<div class="snapshot-actions">' +
              '<button type="button" class="btn btn-outline btn-sm" data-act="view" data-sid="' + escapeAttr(s.id) + '"><iconify-icon icon="ant-design:eye-outlined" width="13" height="13"></iconify-icon>查看</button>' +
              '<button type="button" class="btn btn-outline btn-sm" data-act="compare" data-sid="' + escapeAttr(s.id) + '"><iconify-icon icon="ant-design:swap-outlined" width="13" height="13"></iconify-icon>比对</button>' +
              '<button type="button" class="btn btn-primary btn-sm" data-act="export" data-sid="' + escapeAttr(s.id) + '"><iconify-icon icon="ant-design:export-outlined" width="13" height="13"></iconify-icon>导出</button>' +
              '<button type="button" class="btn btn-ghost btn-sm" data-act="delete" data-sid="' + escapeAttr(s.id) + '"><iconify-icon icon="ant-design:delete-outlined" width="13" height="13"></iconify-icon>删除</button>' +
            '</div>' +
          '</div>' +
          '<div class="snapshot-meta">' +
            '<span>共 <b>' + s.itemCount + '</b> 件</span>' +
            '<span class="meta-ok">对平 <b>' + bal + '</b></span>' +
            '<span class="meta-up">盘盈 <b>' + sur + '</b></span>' +
            '<span class="meta-down">盘亏 <b>' + def + '</b></span>' +
          '</div>' +
        '</div>'
      );
    }
    list.innerHTML = html.join('');
  }

  /* 说明：盘点数据页已拆为三个独立子页，渲染入口统一由 applyScanView(view) 分发，
     原有 renderScanData（一次性渲染全部三段）已下线 */


/* ========== js/features/inventory-core.js ========== */
/* js/features/inventory-core.js — 盘点核心：Toast、统计、渲染、Excel 导入、筛选 */
/* ===== Toast & Popup ===== */
  function toast(msg, type) {
    var el = $('toast');
    if (!el) return;
    type = type || '';
    var textEl = el.querySelector('.toast-text');
    var iconEl = el.querySelector('.toast-icon');
    if (textEl) textEl.textContent = msg;
    else el.textContent = msg;
    if (iconEl) {
      if (type === 'success') iconEl.innerHTML = '<iconify-icon icon="ant-design:check-circle-filled" width="18" height="18"></iconify-icon>';
      else if (type === 'error') iconEl.innerHTML = '<iconify-icon icon="ant-design:close-circle-filled" width="18" height="18"></iconify-icon>';
      else if (type === 'warning') iconEl.innerHTML = '<iconify-icon icon="ant-design:exclamation-circle-filled" width="18" height="18"></iconify-icon>';
      else iconEl.innerHTML = '<iconify-icon icon="ant-design:info-circle-filled" width="18" height="18"></iconify-icon>';
    }
    el.className = 'toast show' + (type ? ' ' + type : '');
    clearTimeout(el._t);
    el._t = setTimeout(function () { el.classList.remove('show'); }, 2600);
  }
  window.toast = toast;

  function showScanPopup(item, isNew) {
    var popup = $('scanPopup');
    if (!popup) return;
    popup.classList.toggle('new', !!isNew);
    $('spTitle').textContent = isNew ? '盘盈新增' : '添加成功';
    $('spName').textContent = item.name;
    $('spMeta').innerHTML = '编号 ' + escapeHtml(item.code) +
      (item.barcode ? '<br>条码 ' + escapeHtml(item.barcode) : '') +
      '<br>盘点 ' + item.actualQty + '　差异 ' + (item.diff > 0 ? '+' : '') + item.diff;
    popup.classList.add('show');
    clearTimeout(popup._t);
    popup._t = setTimeout(function () { popup.classList.remove('show'); }, 1400);
  }

  function toNumber(val) {
    if (val === '' || val === null || val === undefined) return 0;
    if (typeof val === 'number') return isFinite(val) ? Math.max(0, Math.round(val)) : 0;
    var s = String(val).replace(/,/g, '').replace(/\s/g, '').trim();
    if (s === '') return 0;
    var n = Number(s);
    return isNaN(n) ? 0 : Math.max(0, Math.round(n));
  }

  function updateDiff(item) {
    item.diff = item.actualQty - item.systemQty;
    if (item.diff === 0) item.status = 'balanced';
    else if (item.diff > 0) item.status = 'surplus';
    else item.status = 'deficit';
  }

  function rebuildLookup() {
    lookup.clear();
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      if (!it) continue;
      var keys = [it.code, it.barcode, it.id];
      for (var k = 0; k < keys.length; k++) {
        var key = String(keys[k] || '').trim();
        if (!key) continue;
        if (!lookup.has(key)) lookup.set(key, i);
        /* 去前导 0 的数字码也索引，便于扫码枪差异 */
        var alt = key.replace(/^0+/, '');
        if (alt && alt !== key && !lookup.has(alt)) lookup.set(alt, i);
      }
    }
  }
  /** 全局唯一：任意商品的 code / barcode 不得与其它商品的 code 或 barcode 冲突 */
  function findCodeOwner(code, exceptId) {
    var c = String(code || '').trim();
    if (!c) return null;
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      if (!it) continue;
      if (exceptId != null && String(it.id) === String(exceptId)) continue;
      if (String(it.code || '') === c || String(it.barcode || '') === c) return it;
    }
    return null;
  }

  function calcStats() {
    var total = items.length, balanced = 0, surplus = 0, deficit = 0, scanned = 0;
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      updateDiff(it);
      if (it.status === 'balanced') balanced++;
      else if (it.status === 'surplus') surplus++;
      else deficit++;
      if (it.actualQty > 0) scanned++;
    }
    $('stat-total').textContent = total;
    $('stat-balanced').textContent = balanced;
    $('stat-surplus').textContent = surplus;
    $('stat-deficit').textContent = deficit;
    $('stat-scanned').textContent = scanned;

    /* 顶栏「总商品」徽标已移除：库存总数属于盘点模块，
       在机台毛利 / 品类统计 / 备用金等页面显示会造成语义错位 */

    $('menuTotalBadge').textContent = total;
    $('menuTotalBadge').style.display = total > 0 ? '' : 'none';
    var sb = $('menuScannedBadge');
    if (sb) {
      if (scanned > 0) { sb.textContent = scanned; sb.style.display = ''; }
      else sb.style.display = 'none';
    }

    /* 扫码页会话统计 */
    var s1 = $('ssScanned'), s2 = $('ssSurplus'), s3 = $('ssDeficit');
    if (s1) s1.textContent = scanned;
    if (s2) s2.textContent = surplus;
    if (s3) s3.textContent = deficit;

    renderDashOverview(total, scanned);
  }

  /* ---------- 数据看板：轻量 SVG 环形图 / 饼图 ----------
     单文件离线约束下不引入图表库，直接生成 SVG path。
     hole>0 为环形图（donut），hole=0 为饼图（pie）。
     配色沿用全局黑白灰阶，与仓库填充率色阶同族。 */
  var DASH_PIE_COLORS = ['#4f46e5', '#0ea5e9', '#0d9488', '#f59e0b', '#e11d48', '#8b5cf6'];
  function dashChartSvg(segments, opts) {
    opts = opts || {};
    var size = opts.size || 200;
    var R = size / 2;
    var hole = (typeof opts.hole === 'number' ? opts.hole : 0.62) * R;
    var cx = R, cy = R;
    var total = 0;
    segments.forEach(function (s) { total += Math.max(0, s.value); });
    if (total <= 0) {
      /* 空态：浅灰整环 + 提示 */
      var ringR = hole > 0 ? (R + hole) / 2 : 0;
      var ringW = hole > 0 ? (R - hole) : 0;
      var emptySvg = hole > 0
        ? '<circle cx="' + cx + '" cy="' + cy + '" r="' + ringR + '" fill="none" stroke="#f0f0ec" stroke-width="' + ringW + '"/>'
        : '<circle cx="' + cx + '" cy="' + cy + '" r="' + (R - 2) + '" fill="#f5f5f2"/>';
      return '<svg viewBox="0 0 ' + size + ' ' + size + '" role="img" aria-label="暂无数据" style="width:100%;height:100%">' +
        emptySvg +
        '<text x="' + cx + '" y="' + (cy + 4) + '" text-anchor="middle" font-size="12" fill="#a3a3a3">暂无数据</text></svg>';
    }
    function pt(r, a) { return (cx + r * Math.cos(a)).toFixed(2) + ' ' + (cy + r * Math.sin(a)).toFixed(2); }
    var a = -Math.PI / 2, paths = '';
    segments.forEach(function (s) {
      var v = Math.max(0, s.value);
      if (v <= 0) return;
      var frac = v / total;
      var a2 = a + frac * Math.PI * 2;
      var large = frac > 0.5 ? 1 : 0;
      var color = s.color || '#d2d2ce';
      var label = escapeAttr(s.label + ' ' + (s.hint || ''));
      if (frac >= 0.99999) {
        /* 单切片占满：path 弧无法闭合回自身，改用整圆/整环 */
        if (hole > 0) {
          var midR = (R + hole) / 2, w = R - hole;
          paths += '<circle cx="' + cx + '" cy="' + cy + '" r="' + midR + '" fill="none" stroke="' + color + '" stroke-width="' + w + '" data-tip="' + label + '"></circle>';
        } else {
          paths += '<circle cx="' + cx + '" cy="' + cy + '" r="' + (R - 1) + '" fill="' + color + '" data-tip="' + label + '"></circle>';
        }
      } else if (hole > 0) {
        paths += '<path d="M' + pt(R, a) + ' A' + R + ' ' + R + ' 0 ' + large + ' 1 ' + pt(R, a2) +
          ' L' + pt(hole, a2) + ' A' + hole + ' ' + hole + ' 0 ' + large + ' 0 ' + pt(hole, a) + ' Z' +
          '" fill="' + color + '" stroke="#fff" stroke-width="1.5" data-tip="' + label + '"></path>';
      } else {
        paths += '<path d="M' + cx + ' ' + cy + ' L' + pt(R, a) + ' A' + R + ' ' + R + ' 0 ' + large + ' 1 ' + pt(R, a2) +
          ' Z" fill="' + color + '" stroke="#fff" stroke-width="1.5" data-tip="' + label + '"></path>';
      }
      a = a2;
    });
    return '<svg viewBox="0 0 ' + size + ' ' + size + '" role="img" style="width:100%;height:100%">' + paths + '</svg>';
  }


  /* 折线图：整数刻度 + 点位抽样 + 命中层（供 hover） */
  function niceAxisMax(rawMax) {
    if (!(rawMax > 0)) return 1;
    var exp = Math.pow(10, Math.floor(Math.log(rawMax) / Math.LN10));
    var f = rawMax / exp;
    var nf = f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10;
    return nf * exp;
  }
  function drawLineChart(points, w, h) {
    w = w || 640; h = h || 220;
    var pad = { t: 18, r: 14, b: 34, l: 48 };
    var iw = w - pad.l - pad.r, ih = h - pad.t - pad.b;
    var pts = points || [];
    var gid = 'dlg' + String(w) + 'x' + String(h) + 'n' + String(pts.length);
    if (!pts.length) {
      return '<svg viewBox="0 0 ' + w + ' ' + h + '" class="dash-line-svg" preserveAspectRatio="none" role="img">' +
        '<text x="' + (w / 2) + '" y="' + (h / 2) + '" text-anchor="middle" fill="#94a3b8" font-size="13">暂无消耗数据</text></svg>';
    }
    var maxRaw = 0, peakIdx = 0, i, n = pts.length;
    for (i = 0; i < n; i++) {
      var q = Number(pts[i].qty) || 0;
      if (q > maxRaw) { maxRaw = q; peakIdx = i; }
    }
    var allZero = maxRaw <= 0;
    var max = allZero ? 1 : niceAxisMax(maxRaw * 1.05);
    function xAt(idx) { return pad.l + (n === 1 ? iw / 2 : (idx / (n - 1)) * iw); }
    function yAt(v) { return pad.t + ih - (Math.max(0, Number(v) || 0) / max) * ih; }

    var tickCount = 4;
    var parts = [];
    parts.push('<svg viewBox="0 0 ', w, ' ', h, '" class="dash-line-svg" preserveAspectRatio="none" role="img" aria-label="礼品消耗折线">');
    parts.push('<defs><linearGradient id="', gid, '" x1="0" y1="0" x2="0" y2="1">');
    parts.push('<stop offset="0%" stop-color="#3b82f6" stop-opacity="0.16"/>');
    parts.push('<stop offset="100%" stop-color="#3b82f6" stop-opacity="0.01"/>');
    parts.push('</linearGradient></defs>');

    var ti, gy, gv;
    for (ti = 0; ti <= tickCount; ti++) {
      gy = pad.t + (ih * ti / tickCount);
      gv = Math.round(max * (1 - ti / tickCount));
      parts.push('<line x1="', pad.l, '" y1="', gy.toFixed(1), '" x2="', (pad.l + iw), '" y2="', gy.toFixed(1),
        '" stroke="#e8eef5" stroke-width="1"/>');
      parts.push('<text x="', (pad.l - 8), '" y="', (gy + 3.5).toFixed(1),
        '" text-anchor="end" font-size="11" fill="#94a3b8">', gv, '</text>');
    }

    /* >14 天：抽样显示点；始终保留首、尾、峰值 */
    var dense = n > 14;
    var labelStep = n > 16 ? Math.ceil(n / 7) : (n > 10 ? 2 : 1);
    var dotStep = dense ? Math.max(2, Math.ceil(n / 10)) : 1;
    var lineCmds = [];
    for (i = 0; i < n; i++) {
      lineCmds.push((i ? 'L' : 'M') + xAt(i).toFixed(1) + ' ' + yAt(pts[i].qty).toFixed(1));
    }
    var lineD = lineCmds.join('');
    var x0 = xAt(0), xn = xAt(n - 1);
    if (!allZero) {
      parts.push('<path d="', lineD, ' L', xn.toFixed(1), ' ', (pad.t + ih), ' L', x0.toFixed(1), ' ', (pad.t + ih),
        ' Z" fill="url(#', gid, ')"/>');
    }
    parts.push('<path class="dash-line-path" d="', lineD,
      '" fill="none" stroke="#3b82f6" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>');

    for (i = 0; i < n; i++) {
      var isPeak = i === peakIdx && (Number(pts[i].qty) || 0) > 0;
      var showDot = !dense || (i % dotStep === 0) || i === 0 || i === n - 1 || isPeak;
      var showLab = (i % labelStep === 0) || i === n - 1;
      if (showLab && i === n - 1 && n > 3) {
        var prev = Math.floor((n - 2) / labelStep) * labelStep;
        if ((n - 1) - prev < Math.max(1, (labelStep >> 1))) showLab = false;
      }
      var x = xAt(i), y = yAt(pts[i].qty);
      if (showDot) {
        parts.push('<circle class="dash-line-dot" data-i="', i, '" cx="', x.toFixed(1), '" cy="', y.toFixed(1),
          '" r="', (isPeak ? '5' : '3.5'), '" fill="#3b82f6" stroke="#fff" stroke-width="1.5"/>');
      }
      if (showLab) {
        parts.push('<text x="', x.toFixed(1), '" y="', (h - 10),
          '" text-anchor="middle" font-size="10" fill="#64748b">', String(pts[i].label || ''), '</text>');
      }
    }
    /* 仅数据点附近可 hover（约 36×36），避免整列常显提示 */
    for (i = 0; i < n; i++) {
      var hx = xAt(i), hy = yAt(pts[i].qty);
      var hs = 36;
      parts.push('<rect class="dash-line-hit" data-i="', i, '" data-label="',
        String(pts[i].label || '').replace(/"/g, ''), '" data-qty="', String(Number(pts[i].qty) || 0),
        '" data-cx="', hx.toFixed(1), '" data-cy="', hy.toFixed(1),
        '" x="', (hx - hs / 2).toFixed(1), '" y="', (hy - hs / 2).toFixed(1),
        '" width="', hs, '" height="', hs, '" fill="transparent"/>');
    }
    parts.push('<line class="dash-line-guide" x1="0" y1="', pad.t, '" x2="0" y2="', (pad.t + ih),
      '" stroke="#3b82f6" stroke-width="1" stroke-dasharray="3 3" opacity="0" pointer-events="none"/>');
    parts.push('</svg>');
    return parts.join('');
  }

  var DASH_RANGE_HINT = {
    thisWeek: '本周 · 周一至今天',
    lastWeek: '上周 · 上周一至上周日',
    last30Days: '近 30 天 · 含今天共 30 个自然日',
    thisMonth: '本月 · 1 号至今天（不含未来日期）'
  };
  var DASH_RANGE_SUM_LABEL = {
    thisWeek: '本周合计',
    lastWeek: '上周合计',
    last30Days: '近 30 日合计',
    thisMonth: '本月合计'
  };
  function sumHint(arr) {
    var s = 0, i;
    for (i = 0; i < arr.length; i++) s += (arr[i].qty || 0);
    return s;
  }
  function setChartHtml(el, html, sig) {
    if (!el) return;
    if (sig && el.getAttribute('data-sig') === sig) return;
    if (sig) el.setAttribute('data-sig', sig);
    el.innerHTML = html;
  }
  function bindDashLineHover(container) {
    if (!container) return;
    var tip = document.getElementById('dashLineTip');
    if (!tip) {
      tip = document.createElement('div');
      tip.id = 'dashLineTip';
      tip.className = 'dash-line-tip';
      tip.setAttribute('hidden', '');
      tip.style.display = 'none';
      document.body.appendChild(tip);
    }
    function hide() {
      tip.setAttribute('hidden', '');
      tip.style.display = 'none';
      tip.classList.remove('is-show');
      var g = container.querySelector('.dash-line-guide');
      if (g) g.setAttribute('opacity', '0');
    }
    function showTip(hit, svg) {
      if (!hit) { hide(); return; }
      var label = hit.getAttribute('data-label') || '';
      var qty = hit.getAttribute('data-qty') || '0';
      tip.innerHTML = '<strong>' + label + '</strong><span>' + qty + ' 件</span>';
      tip.removeAttribute('hidden');
      tip.style.display = 'flex';
      tip.classList.add('is-show');
      /* 定位到数据点附近（SVG 坐标 → 屏幕） */
      var cx = parseFloat(hit.getAttribute('data-cx'));
      var cy = parseFloat(hit.getAttribute('data-cy'));
      var ctm = svg.getScreenCTM && svg.getScreenCTM();
      var left, top;
      if (ctm && !isNaN(cx) && !isNaN(cy)) {
        left = ctm.a * cx + ctm.e + 14;
        top = ctm.d * cy + ctm.f - 48;
      } else {
        var br = hit.getBoundingClientRect();
        left = br.left + br.width / 2 + 12;
        top = br.top - 44;
      }
      if (left + 110 > window.innerWidth) left = left - 120;
      if (top < 8) top = 8;
      tip.style.left = Math.round(left) + 'px';
      tip.style.top = Math.round(top) + 'px';
      var guide = svg.querySelector('.dash-line-guide');
      if (guide && !isNaN(cx)) {
        guide.setAttribute('x1', cx);
        guide.setAttribute('x2', cx);
        guide.setAttribute('opacity', '0.4');
      }
    }
    if (container.__dashHoverBound) return;
    container.__dashHoverBound = true;
    container.addEventListener('pointermove', function (e) {
      var hit = e.target && e.target.closest ? e.target.closest('.dash-line-hit') : null;
      var svg = container.querySelector('svg');
      if (!hit || !svg) { hide(); return; }
      showTip(hit, svg);
    });
    container.addEventListener('pointerleave', hide);
    container.addEventListener('pointercancel', hide);
  }
  function renderDashConsumeTrend(range) {
    range = range || window.__dashConsumeRange || 'thisWeek';
    window.__dashConsumeRange = range;
    var isCustom = range && typeof range === 'object';
    var putLocal = function (id, val) {
      var e = $(id);
      if (e) e.textContent = val;
    };
    var trend = [];
    try {
      if (typeof WH !== 'undefined' && WH && typeof WH.getConsumeTrend === 'function') {
        trend = WH.getConsumeTrend(range) || [];
      }
    } catch (err) {
      console.warn('[dash] getConsumeTrend failed', err);
      trend = [];
    }
    var sum = 0, peak = null, pi;
    for (pi = 0; pi < trend.length; pi++) {
      sum += (trend[pi].qty || 0);
      if (!peak || trend[pi].qty > peak.qty) peak = trend[pi];
    }
    var lineEl = $('dashConsumeLine');
    if (lineEl) {
      var cw = Math.max(560, Math.floor(lineEl.clientWidth || lineEl.offsetWidth || 720));
      var ch = Math.max(220, Math.floor(lineEl.clientHeight || 240));
      var stamp = '';
      try {
        if (typeof WH !== 'undefined' && WH && typeof WH.flowStamp === 'function') stamp = WH.flowStamp();
      } catch (e0) {}
      var sig = [range, stamp, cw, ch, trend.length, sum].join('|');
      if (lineEl.getAttribute('data-sig') !== sig) {
        lineEl.setAttribute('data-sig', sig);
        lineEl.innerHTML = drawLineChart(trend, cw, ch);
      }
      bindDashLineHover(lineEl);
    }
    putLocal('dashConsumeSum', sum);
    putLocal('dashConsumeAvg', trend.length ? Math.round(sum / trend.length) : 0);
    var sumLab = $('dashConsumeSumLabel');
    if (sumLab) sumLab.textContent = DASH_RANGE_SUM_LABEL[range] || '合计';
    var peakEl = $('dashConsumePeak');
    if (peakEl) peakEl.textContent = peak && peak.qty > 0 ? (peak.label + ' · ' + peak.qty + ' 件') : '—';
    /* Date Range Picker 已替代原 tab 按钮；自定义区间由 onChange 写入 hidden inputs */
  }
  /* 日期筛选统一使用 Date Range Picker */
  function bindDashConsumeDatePicker() {
    if (typeof window.bindSharedDatePicker !== 'function') return;
    try {
      window.bindSharedDatePicker({
        rootId: 'dashConsumeDatePicker',
        triggerId: 'dashConsumePeriodTrigger',
        panelId: 'dashConsumePeriodPanel',
        startId: 'dashConsumeStart',
        endId: 'dashConsumeEnd',
        displayId: 'dashConsumePeriodDisplay',
        presetsId: 'dashConsumePeriodPresets',
        calDaysL: 'dashConsumeCalDaysL',
        calTitleL: 'dashConsumeCalTitleL',
        calDaysR: 'dashConsumeCalDaysR',
        calTitleR: 'dashConsumeCalTitleR',
        placeholder: '请选择时间范围',
        defaultPreset: 'thisWeek',
        onChange: function (start, end) {
          renderDashConsumeTrend({ start: start, end: end });
        }
      });
    } catch (e) { console.warn('[dash] datepicker bind', e); }
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindDashConsumeDatePicker);
  } else {
    bindDashConsumeDatePicker();
  }

  /* resize 防抖：避免窗口缩放时连续重绘折线 */
  if (!window.__dashLineResizeBound) {
    window.__dashLineResizeBound = true;
    var __dashResizeTimer = 0;
    window.addEventListener('resize', function () {
      clearTimeout(__dashResizeTimer);
      __dashResizeTimer = setTimeout(function () {
        var page = $('page-dashboard');
        if (!page || !page.classList.contains('active')) return;
        var el = $('dashConsumeLine');
        if (el) el.removeAttribute('data-sig');
        try { renderDashConsumeTrend(window.__dashConsumeRange || 'thisWeek'); } catch (e) {}
      }, 140);
    }, { passive: true });
  }

  /* 日期筛选已统一使用 Date Range Picker（见下方绑定） */

  /* ---------- 数据看板：仓库侧概览 ----------
     数据源为 WH.getOverview()，与「库存管理」页共用同一批计算函数，
     不另建算法，避免同一指标在两处出现口径不一致。
     WH 在本文件之后才定义（var 提升 + 运行时才调用），故此处需判空。 */
  var __dashRaf = 0;
  function renderDashOverview(total, scanned) {
    var page = $('page-dashboard');
    /* 非看板页跳过重图表，仅更新 KPI 文案 */
    var onDash = page && page.classList.contains('active');
    var hint = $('dashExecHint');
    if (hint) {
      hint.textContent = total > 0
        ? ('已扫 ' + scanned + ' / ' + total + ' · ' + (total > 0 ? Math.round(scanned / total * 100) : 0) + '%')
        : '待导入账面数据';
    }
    if (!onDash) return;
    if (typeof WH === 'undefined' || !WH || !WH.getOverview) return;
    /* 仅在看板可见时计算：避免每次扫码都重算滞销分析（O(仓库×货架×层×货品)） */
    var sec = $('page-dashboard');
    if (!sec || !sec.classList.contains('active')) return;
    var o = WH.getOverview();
    /* ① 仓库与库存：环形图（各仓库存占比，中心为总库存） */
    var whChart = $('dashWhChart');
    if (whChart) {
      var byWh = (o.byWh || []).filter(function (w) { return w.stock > 0; });
      var segs = byWh.map(function (w, i) {
        return { label: w.name, value: w.stock, color: DASH_PIE_COLORS[i % DASH_PIE_COLORS.length], hint: w.stock.toLocaleString() + ' 件' };
      });
      whChart.innerHTML = dashChartSvg(segs, { hole: 0.68 });
    }
    var whLegend = $('dashWhLegend');
    if (whLegend) {
      var hasStock = (o.byWh || []).some(function (w) { return w.stock > 0; });
      whLegend.innerHTML = hasStock
        ? (o.byWh || []).filter(function (w) { return w.stock > 0; }).map(function (w, i) {
            return '<span class="dcl-item"><i class="dcl-dot" style="background:' + DASH_PIE_COLORS[i % DASH_PIE_COLORS.length] + ';"></i>' + escapeHtml(w.name) + '</span>';
          }).join('')
        : '<span class="dcl-item">暂无库存，导入数据后自动生成</span>';
    }
    /* ② 滞销与消耗：饼图（TOP 5 + 其他）。
       占用金额依赖单价，导入数据无单价列时金额恒 0 —— 此时回退按滞销数量切分，保证饼图有区分度。 */
    var slowChart = $('dashSlowChart');
    if (slowChart) {
      var useValue = (o.slowValue || 0) > 0;
      var segs = [];
      var topSum = 0;
      (o.topSlow || []).forEach(function (r, i) {
        var v = useValue ? r.value : r.qty;
        topSum += v;
        segs.push({
          label: r.name, value: v, color: DASH_PIE_COLORS[i % DASH_PIE_COLORS.length],
          hint: useValue ? ('¥' + Math.round(v).toLocaleString()) : (v.toLocaleString() + ' 件')
        });
      });
      var others = Math.max(0, (useValue ? o.slowValue : o.slowQty) - topSum);
      if (others > 0.5) segs.push({
        label: '其他滞销', value: others, color: DASH_PIE_COLORS[5],
        hint: useValue ? ('¥' + Math.round(others).toLocaleString()) : (others.toLocaleString() + ' 件')
      });
      setChartHtml(slowChart, dashChartSvg(segs, { hole: 0 }), "slow:" + (o.slowValue || 0) + ":" + segs.length);
    }
    var slowLegend = $('dashSlowLegend');
    if (slowLegend) {
      slowLegend.innerHTML = (o.topSlow && o.topSlow.length)
        ? o.topSlow.slice(0, 3).map(function (r, i) {
            return '<span class="dcl-item"><i class="dcl-dot" style="background:' + DASH_PIE_COLORS[i % DASH_PIE_COLORS.length] + ';"></i>' + escapeHtml(r.name) + '</span>';
          }).join('')
        : '<span class="dcl-item">当前无滞销礼品</span>';
    }
    var put = function (id, val) { var e = $(id); if (e) e.textContent = val; };
    put('dashWhTotal', o.stock.toLocaleString());
    put('dashWhTotalSub', '在库结存 · ' + o.wh + ' 仓');
    put('dashWh', o.wh);
    put('dashRack', o.rack + ' 个货架');
    put('dashIn', '+' + o.weekIn.toLocaleString());
    put('dashOut', '−' + o.weekOut.toLocaleString());
    put('dashAlert', o.alertCount);
    put('dashSlowCount', o.slowCount);

    put('dashGiftSku', o.giftSku);
    /* 礼品消耗折线（时间范围由 dashConsumeRange 控制） */
    renderDashConsumeTrend(window.__dashConsumeRange || 'thisWeek');

    var sv = $('dashSlowValue');
    if (sv) sv.textContent = (o.slowValue || 0) > 0
      ? ('占用 ¥' + Math.round(o.slowValue).toLocaleString())
      : ('共 ' + (o.slowQty || 0).toLocaleString() + ' 件');
    var sh = $('dashSlowHint');
    if (sh) sh.textContent = o.slowCount > 0
      ? ('按占用金额降序 · 共 ' + o.slowCount + ' 项')
      : '结合礼品消耗数据给出处理建议';
    var top = $('dashTopSlow');
    if (top) {
      top.innerHTML = o.topSlow.length ? o.topSlow.map(function (r, i) {
        return '<div class="dash-top-item">' +
          '<span class="dash-top-idx" style="background:' + DASH_PIE_COLORS[i % DASH_PIE_COLORS.length] + ';">' + (i + 1) + '</span>' +
          '<span class="dash-top-n" title="' + escapeAttr(r.name) + '">' + escapeHtml(r.name) + '</span>' +
          '<span class="dash-top-v">' + (r.value > 0 ? ('¥' + Math.round(r.value).toLocaleString()) : (r.qty.toLocaleString() + ' 件')) + '</span>' +
          '</div>';
      }).join('') : '<div class="dash-empty">当前无滞销礼品</div>';
    }
  }

  function statusHtml(st, diff) {
    if (st === 'balanced') return '<span class="tag tag-ok">对平</span>';
    if (st === 'surplus') return '<span class="tag tag-up">盘盈 +' + diff + '</span>';
    return '<span class="tag tag-down">盘亏 ' + diff + '</span>';
  }
  /* 原地更新单行（避免整页 renderPage 造成的抖动）
     只改数量输入框、差异单元格、行类名、状态标签、顶部统计卡数字。
     不动 tr 本身、不动其他兄弟行。 */
  function updateRowInPlace(item) {
    var tr = tableBody.querySelector('tr[data-id="' + CSS.escape(item.id) + '"]');
    if (!tr) return false;
    var qtyInput  = tr.querySelector('.qty-input');
    var diffCell  = tr.querySelector('.diff-cell');
    var statusCell= tr.querySelector('.row-status');
    if (qtyInput && document.activeElement !== qtyInput) qtyInput.value = item.actualQty;
    if (diffCell) {
      var sign = item.diff > 0 ? '+' : '';
      diffCell.textContent = sign + item.diff;
      diffCell.className = 'diff-cell ' + (item.diff > 0 ? 'diff-pos' : (item.diff < 0 ? 'diff-neg' : 'diff-zero'));
    }
    if (statusCell) statusCell.innerHTML = statusHtml(item.status, item.diff);
    var baseCls = item.status === 'surplus' ? 'surplus' : (item.status === 'deficit' ? 'deficit' : '');
    tr.className = baseCls + ' highlight';
    return true;
  }

  /* 空状态插图（内联 SVG 线描，沿用灰阶、无外链无授权风险） */
  var ILLUS_EMPTY_BOX =
    '<svg class="illus" width="132" height="96" viewBox="0 0 132 96" role="img" aria-label="暂无库存数据">' +
      '<path class="il-a" d="M30 38l9-18h54l9 18"/>' +
      '<path class="il-f" d="M38 38h56v32a7 7 0 0 1-7 7H45a7 7 0 0 1-7-7z"/>' +
      '<path class="il-a" d="M38 38h56v32a7 7 0 0 1-7 7H45a7 7 0 0 1-7-7z"/>' +
      '<path class="il-a" d="M57 38v-8h18v8"/>' +
      '<path class="il-b" d="M53 56h26M53 66h15"/>' +
      '<path class="il-b" d="M66 8V2M92 15l3-6M40 15l-3-6"/>' +
    '</svg>';

  var ILLUS_NO_RESULT =
    '<svg class="illus" width="132" height="96" viewBox="0 0 132 96" role="img" aria-label="没有匹配结果">' +
      '<rect class="il-f" x="40" y="12" width="52" height="66" rx="7"/>' +
      '<rect class="il-a" x="40" y="12" width="52" height="66" rx="7"/>' +
      '<path class="il-b" d="M52 28h28M52 40h28M52 52h18"/>' +
      '<circle class="il-f" cx="90" cy="68" r="15"/>' +
      '<circle class="il-a" cx="90" cy="68" r="15"/>' +
      '<path class="il-a" d="M101 79l10 10"/>' +
    '</svg>';

  function emptyStateHtml(title, sub, showBtn) {
    return '<tr><td colspan="8" class="empty">' +
      (showBtn ? ILLUS_EMPTY_BOX : ILLUS_NO_RESULT) +
      '<div class="empty-text"><strong>' + escapeHtml(title) + '</strong>' + escapeHtml(sub) + '</div>' +
      (showBtn ? '<button type="button" class="btn btn-primary btn-sm" onclick="window.goWork(\'import\')"><iconify-icon icon="ant-design:import-outlined" width="14" height="14"></iconify-icon>去导入库存</button>' : '') +
      '</td></tr>';
  }

  function applyFilter() {
    filteredIndexes = [];
    var kw = searchKeyword ? searchKeyword.toLowerCase() : '';
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      updateDiff(it);
      var ok = true;
      if (currentFilter === 'surplus' && it.status !== 'surplus') ok = false;
      if (currentFilter === 'deficit' && it.status !== 'deficit') ok = false;
      if (currentFilter === 'balanced' && it.status !== 'balanced') ok = false;
      if (currentFilter === 'scanned' && it.actualQty <= 0) ok = false;
      if (ok && kw) {
        var hit = (it.code && it.code.toLowerCase().indexOf(kw) !== -1) ||
                  (it.barcode && it.barcode.toLowerCase().indexOf(kw) !== -1) ||
                  (it.name && it.name.toLowerCase().indexOf(kw) !== -1);
        if (!hit) ok = false;
      }
      if (ok) filteredIndexes.push(i);
    }
    var maxPage = Math.max(1, Math.ceil(filteredIndexes.length / PAGE_SIZE) || 1);
    if (currentPage > maxPage) currentPage = maxPage;
    if (currentPage < 1) currentPage = 1;
  }

  function renderPage() {
    applyFilter();
    calcStats();

    var dc = $('detailCount');
    if (dc) dc.textContent = items.length;

    if (items.length === 0) {
      tableBody.innerHTML = emptyStateHtml('暂无盘点数据', '请先导入 Excel 账面库存后开始盘点', true);
      pager.style.display = 'none';
      return;
    }

    var totalFiltered = filteredIndexes.length;
    var maxPage = Math.max(1, Math.ceil(totalFiltered / PAGE_SIZE) || 1);
    var start = (currentPage - 1) * PAGE_SIZE;
    var end = Math.min(start + PAGE_SIZE, totalFiltered);

    if (totalFiltered === 0) {
      var emptyMsg = searchKeyword ? '未找到匹配「' + searchKeyword + '」的商品' : '当前筛选条件下无数据';
      tableBody.innerHTML = emptyStateHtml('没有匹配结果', emptyMsg, false);
    } else {
      var html = [];
      for (var p = start; p < end; p++) {
        var it = items[filteredIndexes[p]];
        var rowCls = it.status === 'surplus' ? 'surplus' : (it.status === 'deficit' ? 'deficit' : '');
        if (it.id === lastHighlightId) rowCls += ' highlight';
        var diffCls = it.diff > 0 ? 'diff-pos' : (it.diff < 0 ? 'diff-neg' : 'diff-zero');
        var diffText = (it.diff > 0 ? '+' : '') + it.diff;
        html.push(
          '<tr class="' + rowCls + '" data-id="' + escapeAttr(it.id) + '">' +
          '<td class="code-cell">' + escapeHtml(it.code) + '</td>' +
          '<td class="code-cell">' + escapeHtml(it.barcode || '-') + '</td>' +
          '<td class="name-cell">' + escapeHtml(it.name) + '</td>' +
          '<td>' + it.systemQty + '</td>' +
          '<td><div class="qty-wrap">' +
            '<button type="button" class="qty-step" data-step="-1" data-id="' + escapeAttr(it.id) + '" aria-label="减少"><iconify-icon icon="ant-design:minus-outlined" width="13" height="13"></iconify-icon></button>' +
            '<input type="number" class="qty-input" min="0" inputmode="numeric" value="' + it.actualQty +
            '" data-id="' + escapeAttr(it.id) + '" aria-label="盘点数量" />' +
            '<button type="button" class="qty-step" data-step="1" data-id="' + escapeAttr(it.id) + '" aria-label="增加"><iconify-icon icon="ant-design:plus-outlined" width="13" height="13"></iconify-icon></button>' +
          '</div></td>' +
          '<td class="diff-cell ' + diffCls + '">' + diffText + '</td>' +
          '<td class="row-status">' + statusHtml(it.status, it.diff) + '</td>' +
          '<td class="op-cell"><button type="button" class="btn-del" data-del-id="' + escapeAttr(it.id) + '"><iconify-icon icon="ant-design:delete-outlined" width="13" height="13"></iconify-icon>删除</button></td>' +
          '</tr>'
        );
      }
      tableBody.innerHTML = html.join('');
    }

    if (totalFiltered > PAGE_SIZE) {
      pager.style.display = 'flex';
      pagerInfo.textContent = '共 ' + totalFiltered + ' 条，第 ' + currentPage + '/' + maxPage + ' 页';
      pageNumEl.textContent = currentPage + ' / ' + maxPage;
      $('btnPrev').disabled = currentPage <= 1;
      $('btnNext').disabled = currentPage >= maxPage;
      var jumpInput = $('pageJumpInput');
      if (jumpInput) {
        jumpInput.max = maxPage;
        jumpInput.value = currentPage;
      }
    } else {
      pager.style.display = totalFiltered > 0 ? 'flex' : 'none';
      pagerInfo.textContent = '共 ' + totalFiltered + ' 条';
      pageNumEl.textContent = '1';
      $('btnPrev').disabled = true;
      $('btnNext').disabled = true;
      var jumpInput2 = $('pageJumpInput');
      if (jumpInput2) {
        jumpInput2.max = 1;
        jumpInput2.value = 1;
      }
    }
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
  function escapeAttr(s) {
    return escapeHtml(s).replace(/'/g, '&#39;');
  }

  function parseExcel(file) {
    if (typeof XLSX === 'undefined') {
      toast('Excel 解析库未加载，请检查网络后刷新', 'error');
      showLibError('Excel 解析库（SheetJS）未能加载，请确认可访问外网后刷新页面。');
      return;
    }
    if (!file) {
      toast('未选择文件', 'error');
      return;
    }

    var reader = new FileReader();
    reader.onload = function (e) {
      try {
        var data = new Uint8Array(e.target.result);
        var wb = XLSX.read(data, {
          type: 'array',
          raw: false,
          cellDates: false,
          cellNF: false,
          cellText: true
        });
        if (!wb.SheetNames || !wb.SheetNames.length) {
          toast('文件中没有工作表', 'error');
          return;
        }
        var sheet = wb.Sheets[wb.SheetNames[0]];
        var aoa = XLSX.utils.sheet_to_json(sheet, {
          header: 1,
          defval: '',
          raw: false,
          blankrows: false
        });
        if (!aoa || aoa.length < 2) {
          toast('表格无有效数据行', 'error');
          return;
        }

        var headers = aoa[0].map(function (h) {
          return String(h || '').replace(/\s+/g, '').trim();
        });

        function findCol(keys) {
          for (var k = 0; k < keys.length; k++) {
            var key = keys[k].replace(/\s+/g, '');
            for (var c = 0; c < headers.length; c++) {
              if (headers[c] === key || headers[c].indexOf(key) !== -1) return c;
            }
          }
          return -1;
        }
        var colCode = findCol(CODE_KEYS);
        var colName = findCol(NAME_KEYS);
        var colQty  = findCol(QTY_KEYS);
        var colBar  = findCol(BAR_KEYS);
        var colCat  = findCol(CAT_KEYS);

        if (colCode < 0) {
          toast('未找到「商品编号」列，请检查表头', 'error');
          return;
        }
        if (colQty < 0) {
          toast('未找到「库存数量」列，请检查表头', 'error');
          return;
        }

        var list = [];
        var codeSet = Object.create(null);
        var usedKeys = Object.create(null); /* 编号与条码全局唯一 */
        var skipEmpty = 0;
        var skipDup = 0;
        var skipBarDup = 0;

        for (var r = 1; r < aoa.length; r++) {
          var row = aoa[r];
          if (!row || !row.length) continue;

          var code = colCode >= 0 ? String(row[colCode] != null ? row[colCode] : '').trim() : '';
          if (/e\+/i.test(code)) {
            try {
              var n = Number(code);
              if (isFinite(n) && n > 1e10) code = n.toFixed(0);
            } catch (ex) {}
          }
          if (!code) {
            skipEmpty++;
            continue;
          }
          if (codeSet[code] || usedKeys[code]) {
            skipDup++;
            continue;
          }

          var name = colName >= 0 ? String(row[colName] != null ? row[colName] : '').trim() : '';
          var barcode = colBar >= 0 ? String(row[colBar] != null ? row[colBar] : '').trim() : '';
          if (/e\+/i.test(barcode)) {
            try {
              var bn = Number(barcode);
              if (isFinite(bn) && bn > 1e10) barcode = bn.toFixed(0);
            } catch (ex) {}
          }
          /* 条码与编号相同则清空条码，避免自冲突 */
          if (barcode && barcode === code) barcode = '';
          if (barcode && usedKeys[barcode]) {
            skipBarDup++;
            barcode = '';
          }
          codeSet[code] = 1;
          usedKeys[code] = 1;
          if (barcode) usedKeys[barcode] = 1;

          var category = colCat >= 0 ? String(row[colCat] != null ? row[colCat] : '').trim() : '';
          var systemQty = toNumber(colQty >= 0 ? row[colQty] : 0);

          list.push({
            id: code,
            code: code,
            barcode: barcode,
            name: name || code,
            category: category,
            systemQty: systemQty,
            actualQty: 0,
            diff: 0,
            status: 'deficit'
          });
        }

        if (list.length === 0) {
          toast('未解析到有效商品行', 'error');
          return;
        }

        items = list;
        /* 重新导入即整批替换，旧数据的软删除墓碑随之失效 */
        deletedItems = [];
        rebuildLookup();
        saveItems();
        /* 每次导入都覆盖原始快照，便于在「盘点数据」页做对比 */
        saveOriginalSnapshot(list);
        currentPage = 1;
        currentFilter = 'all';
        searchKeyword = '';
        var si = $('searchInput');
        if (si) si.value = '';
        lastHighlightId = null;
        document.querySelectorAll('.filter-bar .btn').forEach(function (b) {
          b.classList.toggle('active', b.getAttribute('data-filter') === 'all');
        });
        $('importToolbar').style.display = 'flex';
        /* 有数据时恢复「导出结果」可用 */
        var expBtn = $('btnExport');
        if (expBtn) expBtn.disabled = false;
        var detailTb = $('detailToolbar');
        if (detailTb) detailTb.style.display = 'flex';
        renderPage();
        calcStats();

        var resultMsg = '导入成功！\n共导入 ' + list.length + ' 条数据';
        if (skipEmpty) resultMsg += '\n跳过空编号 ' + skipEmpty + ' 行';
        if (skipDup) resultMsg += '\n跳过重复编号 ' + skipDup + ' 行';
        if (skipBarDup) resultMsg += '\n条码冲突已清空 ' + skipBarDup + ' 处';
        showModal(resultMsg, 'alert', function () { window.goWork('scan'); });
      } catch (err) {
        console.error(err);
        showModal('导入失败：' + (err.message || '请确认文件格式正确'), 'error');
      }
    };
    reader.onerror = function () {
      showModal('文件读取失败，请重试', 'error');
    };
    reader.readAsArrayBuffer(file);
  }

  /* 待补条形码状态：scan-target-id + scan-target-code */
  var _pendingBarcode = null; /* { id: 'item.id', code: 'item.code' } */

  /**
   * 统一解析扫码枪 / 摄像头结果：优先二维码有效载荷，再回落条形码数字。
   * 支持：纯码、URL 参数、JSON、多行文本中的商品码。
   */
  function normalizeScanCode(raw) {
    var s = String(raw || '').trim();
    if (!s) return '';
    /* 去掉常见前缀/空白与不可见字符 */
    s = s.replace(/^[\uFEFF\u200B]+/, '').replace(/\r/g, '').trim();

    /* 规则优先：最后一个「=」后面的内容（如 …&ID=LPCLGK000033 → LPCLGK000033） */
    function afterLastEq(str) {
      var i = str.lastIndexOf('=');
      if (i < 0 || i >= str.length - 1) return '';
      var tail = str.slice(i + 1).trim();
      /* 去掉 URL 哈希/多余分隔 */
      tail = tail.split('#')[0].split('&')[0].split('?')[0].trim();
      try { tail = decodeURIComponent(tail); } catch (eD) {}
      return tail;
    }

    /* JSON 二维码 */
    if (s.charAt(0) === '{' || s.charAt(0) === '[') {
      try {
        var obj = JSON.parse(s);
        if (Array.isArray(obj) && obj.length) obj = obj[0];
        if (obj && typeof obj === 'object') {
          var keys = ['barcode', 'barCode', 'code', 'sku', 'skuCode', 'id', 'ID', 'productCode', 'goodsCode', 'spu'];
          for (var ki = 0; ki < keys.length; ki++) {
            if (obj[keys[ki]] != null && String(obj[keys[ki]]).trim()) {
              return String(obj[keys[ki]]).trim();
            }
          }
        }
      } catch (eJ) {}
    }

    /* 优先匹配 ID= / id= / code= / barcode= 后的值 */
    var mId = s.match(/(?:[?&#]|^|[?&])(?:ID|id|code|barcode|sku|skuCode)=([^&#\s]+)/i);
    if (mId && mId[1]) {
      try { return decodeURIComponent(mId[1]).trim(); } catch (eM) { return String(mId[1]).trim(); }
    }
    /* 含 = 的链接/查询串：取最后一个 = 之后（如 …&ID=LPCLGK000033） */
    if (s.indexOf('=') >= 0) {
      var eqTail = afterLastEq(s);
      if (eqTail && eqTail.length >= 2) return eqTail;
    }

    /* URL：标准参数名再试一次（兼容大小写 ID） */
    if (/^https?:\/\//i.test(s) || s.indexOf('://') > 0) {
      try {
        var u = new URL(s.indexOf('://') > 0 ? s : ('https://' + s));
        var params = ['ID', 'id', 'barcode', 'barCode', 'code', 'sku', 'skuCode', 'productCode', 'q'];
        for (var pi = 0; pi < params.length; pi++) {
          var v = u.searchParams.get(params[pi]);
          if (v && String(v).trim()) return String(v).trim();
        }
        /* 畸形 query（无 ? 只有 path 上拼 mc=…）再取 last = */
        var eq2 = afterLastEq(s);
        if (eq2) return eq2;
        var parts = u.pathname.split('/').filter(Boolean);
        if (parts.length) {
          var last = decodeURIComponent(parts[parts.length - 1]);
          if (last && last.length >= 3 && last.indexOf('=') < 0) return last;
        }
      } catch (eU) {
        var eq3 = afterLastEq(s);
        if (eq3) return eq3;
      }
    }

    /* 多行：优先取含数字较多的一行 */
    if (s.indexOf('\n') >= 0) {
      var lines = s.split('\n').map(function (l) { return l.trim(); }).filter(Boolean);
      var best = lines[0] || s;
      var bestScore = 0;
      for (var li = 0; li < lines.length; li++) {
        var score = (lines[li].match(/[0-9A-Za-z]/g) || []).length;
        if (score > bestScore) { bestScore = score; best = lines[li]; }
      }
      s = best;
      if (s.indexOf('=') >= 0) {
        var eq4 = afterLastEq(s);
        if (eq4) return eq4;
      }
    }
    return s;
  }

  function handleScan(raw) {
    var code = normalizeScanCode(raw);
    if (!code) return;
    /* 扫码成功输入，标记USB扫码设备（键盘模式）为活跃状态 */
    if (typeof DeviceManager !== 'undefined') DeviceManager.markKbActive();

    if (!items || items.length === 0) {
      if (typeof toast === 'function') toast('请先在「数据导入」中导入盘点数据后再扫码', 'warning');
      return;
    }

    /* === 等待补条形码分支 === */
    if (_pendingBarcode) {
      var pendingIdx = lookup.get(_pendingBarcode.id);
      if (pendingIdx !== undefined) {
        var pi = items[pendingIdx];
        /* 校验：不能把条形码写成与商品编号相同的字符串（除非用户故意） */
        var clash = findCodeOwner(code, pi.id);
        if (clash) {
          toast('条码「' + code + '」已被「' + (clash.name || clash.code) + '」使用，请勿重复', 'warning');
          _pendingBarcode = null;
          var pend0 = $('pendingBarcodeHint');
          if (pend0) pend0.classList.remove('show');
          focusScan();
          return;
        }
        if (String(pi.code) === code) {
          toast('条码不能与商品编号相同', 'warning');
          focusScan();
          return;
        }
        pi.barcode = code;
        rebuildLookup();
        saveItems();
        renderPage();
        renderScanData();
        toast('已为「' + pi.name + '」补录条形码：' + code, 'success');
      } else {
        toast('原商品已不存在，条形码未写入', 'warning');
      }
      _pendingBarcode = null;
      var pend = $('pendingBarcodeHint');
      if (pend) pend.classList.remove('show');
      focusScan();
      return;
    }

    var idx = lookup.get(code);
    if (idx === undefined) {
      var alt = code.replace(/^0+/, '');
      if (alt && alt !== code) idx = lookup.get(alt);
    }
    /* 大小写不敏感再试 */
    if (idx === undefined) {
      var up = code.toUpperCase();
      for (var ui = 0; ui < items.length; ui++) {
        var uIt = items[ui];
        if (!uIt) continue;
        if (String(uIt.code || '').toUpperCase() === up || String(uIt.barcode || '').toUpperCase() === up) {
          idx = ui;
          break;
        }
      }
    }

    var isNew = false;
    if (idx === undefined) {
      /* 新建前检查：该码是否已被占用（理论上 lookup 已覆盖） */
      var owner = findCodeOwner(code, null);
      if (owner) {
        for (var oi = 0; oi < items.length; oi++) {
          if (items[oi] === owner) { idx = oi; break; }
        }
      }
    }
    if (idx === undefined) {
      var newItem = {
        id: code,
        code: code,
        barcode: '',
        name: '未知-' + code,
        category: '',
        systemQty: 0,
        actualQty: 0,
        diff: 0,
        status: 'surplus'
      };
      items.push(newItem);
      rebuildLookup();
      saveItems();
      idx = items.length - 1;
      isNew = true;
    }

    var item = items[idx];
    item.actualQty += 1;
    updateDiff(item);
    saveItems();
    lastHighlightId = item.id;

    var lastEl = $('lastScan');
    if (lastEl) {
      lastEl.textContent = '最近扫码：' + item.name + '  编号:' + item.code +
        (item.barcode ? '  条码:' + item.barcode : '') +
        '  盘点:' + item.actualQty + '  差异:' + (item.diff > 0 ? '+' : '') + item.diff;
      lastEl.classList.add('show');
    }

    /* 新增行需整页刷新（行不存在），否则原地更新避免抖动 */
    if (isNew) renderPage(); else updateRowInPlace(item);
    calcStats();
    showScanPopup(item, isNew);
    playBeep();

    /* 若该商品当前无条形码，提示用户扫码补录（下次扫码将写入 barcode） */
    if (!item.barcode) {
      _pendingBarcode = { id: item.id, code: item.code, name: item.name };
      var hint = $('pendingBarcodeHint');
      if (hint) {
        hint.textContent = '「' + item.name + '」（编号 ' + item.code + '）尚无条码 → 请扫描条形码或二维码以补录';
        hint.classList.add('show');
      }
      var pi = $('scanInputDesktop'); if (pi) pi.placeholder = '请扫描条形码/二维码，将自动写入「' + item.name + '」';
      var mi = $('scanInputMobile'); if (mi) mi.placeholder = '请扫描条形码/二维码，将自动写入「' + item.name + '」';
    }

    focusScan();
  }

  function onQtyChange(input) {
    var id = input.getAttribute('data-id');
    var idx = lookup.get(id);
    if (idx === undefined) return;
    var item = items[idx];
    var val = parseInt(input.value, 10);
    if (isNaN(val) || val < 0) val = 0;
    item.actualQty = val;
    input.value = val;
    updateDiff(item);
    saveItems();
    lastHighlightId = item.id;
    /* 原地更新该行 + 顶部统计卡数字，避免整页 renderPage 造成抖动 */
    if (!updateRowInPlace(item)) renderPage();
    calcStats();
    toast('已修改 ' + item.name + ' 盘点为 ' + val, 'success');
    focusScan();
  }

  function deleteItem(id) {
    var idx = lookup.get(id);
    if (idx === undefined) return;
    var item = items[idx];

    /* 软删除：标记后移入墓碑区，存储中保留，界面即时隐藏 */
    var go = function () {
      item.deleted = true;
      item.deletedAt = new Date().toISOString();
      deletedItems.push(item);
      items.splice(idx, 1);
      rebuildLookup();
      saveItems();
      if (lastHighlightId === id) lastHighlightId = null;
      applyFilter();
      var maxPage = Math.max(1, Math.ceil(filteredIndexes.length / PAGE_SIZE) || 1);
      if (currentPage > maxPage) currentPage = maxPage;
      renderPage();
      calcStats();
      toast('已删除 ' + item.name, 'success');
    };
    if (typeof window.showConfirm === 'function') {
      window.showConfirm({
        title: '删除商品',
        message: '确认删除「' + item.name + '」？\n编号：' + item.code + '，账面数量 ' + (item.systemQty || 0) + '。\n删除后不再参与盘点与统计，',
        onConfirm: go
      });
    } else {
      showModal('确定删除「' + item.name + '」（编号：' + item.code + '）？', 'confirm', function (ok) { if (ok) go(); });
    }
  }

  function playBeep() {
    try {
      var ctx = new (window.AudioContext || window.webkitAudioContext)();
      var o = ctx.createOscillator();
      var g = ctx.createGain();
      o.connect(g);
      g.connect(ctx.destination);
      o.frequency.value = 880;
      g.gain.value = 0.07;
      o.start();
      setTimeout(function () { o.stop(); ctx.close(); }, 70);
    } catch (e) {}
  }

  function focusScan() {
    var m = $('scanInputMobile');
    var d = $('scanInputDesktop');
    if (window.innerWidth < 768 && m) m.focus();
    else if (d) d.focus();
  }

  async function toggleCamera() {
    var reader = $('reader');
    var placeholder = $('cameraPlaceholder');
    var btns = [ $('btnCamera'), $('btnCameraMobile') ];

    function setBtnState(running) {
      btns.forEach(function (b) {
        if (!b) return;
        var txt = b.querySelector('.btn-camera-text');
        if (running) {
          if (txt) txt.textContent = '关闭摄像头';
          if (b.id === 'btnCameraMobile') return;
          b.classList.remove('btn-primary');
          b.classList.add('btn-danger');
        } else {
          if (txt) txt.textContent = b.id === 'btnCameraMobile' ? '摄像头' : '开启摄像头扫码';
          b.classList.remove('btn-danger');
          b.classList.add('btn-primary');
        }
      });
    }

    if (cameraRunning) {
      if (html5QrCode) {
        try { await html5QrCode.stop(); } catch (e) {}
      }
      cameraRunning = false;
      reader.classList.remove('active');
      if (placeholder) placeholder.classList.remove('hidden');
      setBtnState(false);
      setScanMode('none');
      return;
    }

    if (!items || items.length === 0) {
      if (typeof toast === 'function') toast('请先在「数据导入」中导入盘点数据后再扫码', 'warning');
      return;
    }
    if (typeof Html5Qrcode === 'undefined') {
      toast('摄像头库未加载', 'error');
      return;
    }
    if (location.protocol === 'file:') {
      toast('本地文件方式打开时，摄像头可能无法使用，请优先用扫码枪', 'warning');
    }

    /* 互斥：若 USB HID 已激活，先断开再开摄像头 */
    if (hidDevice) {
      try { hidDevice.close(); } catch (e) {}
      hidDevice = null;
      setState('disconnected');
    }

    try {
      if (!html5QrCode) html5QrCode = new Html5Qrcode('reader');
      /* 优先二维码，同时兼容常见一维条码 */
      var formats = undefined;
      try {
        if (typeof Html5QrcodeSupportedFormats !== 'undefined') {
          formats = [
            Html5QrcodeSupportedFormats.QR_CODE,
            Html5QrcodeSupportedFormats.DATA_MATRIX,
            Html5QrcodeSupportedFormats.AZTEC,
            Html5QrcodeSupportedFormats.PDF_417,
            Html5QrcodeSupportedFormats.EAN_13,
            Html5QrcodeSupportedFormats.EAN_8,
            Html5QrcodeSupportedFormats.CODE_128,
            Html5QrcodeSupportedFormats.CODE_39,
            Html5QrcodeSupportedFormats.CODE_93,
            Html5QrcodeSupportedFormats.UPC_A,
            Html5QrcodeSupportedFormats.UPC_E,
            Html5QrcodeSupportedFormats.ITF
          ];
        }
      } catch (eFmt) {}
      var camCfg = {
        fps: 12,
        qrbox: function (viewW, viewH) {
          /* 正方形取景框更利于二维码；宽度占画面 75% */
          var side = Math.floor(Math.min(viewW, viewH) * 0.75);
          side = Math.max(180, Math.min(side, 320));
          return { width: side, height: side };
        },
        aspectRatio: 1.333,
        disableFlip: false
      };
      if (formats && formats.length) camCfg.formatsToSupport = formats;
      await html5QrCode.start(
        { facingMode: 'environment' },
        camCfg,
        function (text) {
          handleScan(text);
          try {
            html5QrCode.pause(true);
            setTimeout(function () {
              try { html5QrCode.resume(); } catch (e) {}
            }, 700);
          } catch (e) {}
        },
        function () {}
      );
      cameraRunning = true;
      reader.classList.add('active');
      if (placeholder) placeholder.classList.add('hidden');
      setBtnState(true);
      setScanMode('camera');
      toast('摄像头已开启', 'success');
    } catch (err) {
      console.error(err);
      toast('无法开启摄像头：' + (err.message || '请检查权限'), 'error');
    }
  }

  function exportResult() {
    if (items.length === 0) {
      toast('无数据', 'warning');
      return;
    }
    if (typeof XLSX === 'undefined') {
      toast('导出库未加载', 'error');
      return;
    }
    var rows = [['商品编号', '商品分类', '商品名称', '库存数量', '盘点数量', '条形码', '差异', '状态']];
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      updateDiff(it);
      var st = it.status === 'balanced' ? '对平' : (it.status === 'surplus' ? '盘盈' : '盘亏');
      rows.push([it.code, it.category, it.name, it.systemQty, it.actualQty, it.barcode, it.diff, st]);
    }
    var ws = XLSX.utils.aoa_to_sheet(rows);
    var wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '盘点结果');
    var name = '盘点结果_' + new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-') + '.xlsx';
    XLSX.writeFile(wb, name);
    toast('已导出 ' + name, 'success');
  }


/* ========== js/features/scan-data.js ========== */
/* js/features/scan-data.js */
/* ===== 盘点数据页 =====
     两段式：
       1) 盘点前账面库存 —— 来自每次 Excel 导入时写入的 original snapshot
       2) 已保存盘点报告 —— 用户在盘点明细页点击「保存为盘点报告」后生成的快照列表
  */
  /* 首次导入的原始账面快照（用于对比），写入 localStorage */
  var ORIG_KEY = 'inventory_check_original_v1';
  function saveOriginalSnapshot(list) {
    try { localStorage.setItem(ORIG_KEY, JSON.stringify(list)); } catch (err) {}
  }
  function loadOriginalSnapshot() {
    try {
      var raw = localStorage.getItem(ORIG_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (err) { return null; }
  }
  function clearOriginalSnapshot() {
    try { localStorage.removeItem(ORIG_KEY); } catch (err) {}
  }


/* ========== js/features/compare.js ========== */
/* js/features/compare.js */
/* ===== 对账对比（盘点前账面 vs 盘点后实盘） ===== */
  var compareState = { rows: [], filter: 'all', pager: null, source: null };
  var compareBubble = null;

  /* 刷新对账数据源下拉（已保存报告 + 当前未保存数据） */
  function refreshCompareSelect() {
    var sel = $('compareSelect');
    if (!sel) return;
    var opts = [];
    if (items.length) {
      opts.push({ value: '__current__', label: '当前盘点数据（未保存 · ' + items.length + ' 件）' });
    }
    for (var i = 0; i < savedSnapshots.length; i++) {
      var s = savedSnapshots[i];
      opts.push({ value: s.id, label: s.name + '（' + s.savedAt + '）' });
    }
    var runBtn = $('btnCompareRun');
    if (!opts.length) {
      opts = [{ value: '', label: '— 暂无可用数据 —' }];
      if (runBtn) runBtn.disabled = true;
    } else if (runBtn) {
      runBtn.disabled = false;
    }
    if (!compareBubble) {
      compareBubble = createBubble(sel, { value: '', options: opts });
    } else {
      compareBubble.setOptions(opts);
    }
  }

  /* 按商品编号合并账面与报告，生成对账行 */
  function buildCompareRows(reportItems, reportName) {
    var orig = loadOriginalSnapshot() || [];
    var bookMap = {};
    var i, it;
    for (i = 0; i < orig.length; i++) {
      if (orig[i] && orig[i].code != null) bookMap[String(orig[i].code)] = { item: orig[i], used: false };
    }
    var useEmbeddedBook = orig.length === 0; /* 账面缺失时退回报告自带的账面数 */
    var rows = [];
    for (i = 0; i < reportItems.length; i++) {
      it = reportItems[i];
      var o = it && it.code != null ? bookMap[String(it.code)] : null;
      var actual = it && it.actualQty != null ? it.actualQty : 0;
      if (o) {
        o.used = true;
        var book = o.item.systemQty != null ? o.item.systemQty : 0;
        var diff = actual - book;
        rows.push({
          code: it.code,
          barcode: it.barcode || o.item.barcode || '',
          name: it.name || o.item.name || '',
          category: it.category || o.item.category || '',
          book: book, actual: actual, diff: diff,
          status: diff > 0 ? 'surplus' : (diff < 0 ? 'deficit' : 'balanced')
        });
      } else {
        var eb = useEmbeddedBook && it && it.systemQty != null ? it.systemQty : null;
        rows.push({
          code: it ? it.code : '',
          barcode: it && it.barcode ? it.barcode : '',
          name: it && it.name ? it.name : '',
          category: it && it.category ? it.category : '',
          book: eb, actual: actual,
          diff: eb != null ? actual - eb : null,
          status: 'no-book'
        });
      }
    }
    for (var key in bookMap) {
      if (!bookMap.hasOwnProperty(key)) continue;
      if (!bookMap[key].used) {
        var ob = bookMap[key].item;
        rows.push({
          code: ob.code,
          barcode: ob.barcode || '',
          name: ob.name || '',
          category: ob.category || '',
          book: ob.systemQty != null ? ob.systemQty : 0,
          actual: null, diff: null,
          status: 'no-count'
        });
      }
    }
    return rows;
  }

  /* 对账行 → 展示状态标签 */
  function compareStatusHtml(row) {
    if (row.status === 'balanced') return '<span class="tag tag-ok">对平</span>';
    if (row.status === 'surplus')   return '<span class="tag tag-up">盘盈 +' + row.diff + '</span>';
    if (row.status === 'deficit')   return '<span class="tag tag-down">盘亏 ' + row.diff + '</span>';
    if (row.status === 'no-count')  return '<span class="tag tag-mute">未盘点</span>';
    return '<span class="tag tag-mute">账面缺失</span>';
  }
  function compareStatusLabel(row) {
    if (row.status === 'balanced') return '对平';
    if (row.status === 'surplus') return '盘盈';
    if (row.status === 'deficit') return '盘亏';
    if (row.status === 'no-count') return '未盘点';
    return '账面缺失';
  }

  /* 执行对账 */
  function runCompare(sourceId) {
    var sid = sourceId != null ? sourceId : (compareBubble ? compareBubble.getValue() : '');
    var result = $('compareResult');
    if (!result) return;
    var reportItems = null, sourceName = '';
    if (sid === '__current__') {
      if (!items.length) { toast('当前无盘点数据', 'warning'); return; }
      reportItems = items;
      sourceName = '当前盘点数据（未保存）';
    } else if (sid) {
      var s = savedSnapshots.find(function (x) { return x.id === sid; });
      if (!s) { toast('报告不存在或已被删除', 'error'); return; }
      reportItems = s.items;
      sourceName = s.name + '（' + s.savedAt + '）';
    } else {
      toast('请先选择要对比的盘点数据', 'warning');
      return;
    }
    if (compareBubble && sid) compareBubble.setValue(sid);
    compareState.rows = buildCompareRows(reportItems, sourceName);
    compareState.source = sourceName;
    compareState.filter = 'all';
    var fbs = $('compareFilters');
    if (fbs) {
      fbs.querySelectorAll('button').forEach(function (b) {
        b.classList.toggle('active', b.getAttribute('data-cfilter') === 'all');
      });
    }
    renderCompareStats();
    result.style.display = '';
    var cmpEmpty = $('compareEmpty');
    if (cmpEmpty) cmpEmpty.style.display = 'none';
    var exBtn = $('btnExportCompare');
    if (exBtn) exBtn.style.display = '';
    if (!compareState.pager) {
      var mount = $('comparePager');
      if (mount) {
        compareState.pager = createPager(mount, {
          pageSize: 20,
          getData: function () { return filteredCompareRows(); },
          onPage: function (rows, page, size, total) {
            renderCompareRows(rows, total);
          }
        });
      }
    }
    if (compareState.pager) compareState.pager.reset();
    else renderCompareRows(filteredCompareRows(), filteredCompareRows().length);
    /* 对账结果为独立子页：若不在该子页则切换过去（结果已就绪，无需滚动定位） */
    if (currentPageName !== 'scan-data' || currentScanView !== 'compare') {
      location.hash = '#/scan-data/compare';
    }
  }

  /* 账面比对结果搜索：在筛选结果之上叠加关键词过滤 */
  var compareKeyword = '';
  function filteredCompareRows() {
    var f = compareState.filter;
    var base;
    if (f === 'all') base = compareState.rows;
    else {
      base = compareState.rows.filter(function (r) {
        if (f === 'diff') return r.status === 'surplus' || r.status === 'deficit' || r.status === 'no-book';
        return r.status === f;
      });
    }
    var kw = compareKeyword.trim().toLowerCase();
    if (!kw) return base;
    return base.filter(function (r) {
      return (r.code && r.code.toLowerCase().indexOf(kw) !== -1) ||
             (r.barcode && r.barcode.toLowerCase().indexOf(kw) !== -1) ||
             (r.name && r.name.toLowerCase().indexOf(kw) !== -1);
    });
  }

  function renderCompareStats() {
    var box = $('compareStats');
    if (!box) return;
    var rows = compareState.rows || [];
    var bookSum = 0, actualSum = 0, diffSum = 0;
    var bal = 0, sur = 0, def = 0, nc = 0, nb = 0, matched = 0;
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      if (r.status === 'balanced') bal++;
      else if (r.status === 'surplus') sur++;
      else if (r.status === 'deficit') def++;
      else if (r.status === 'no-count') nc++;
      else nb++;
      if (r.book != null) bookSum += r.book;
      if (r.actual != null) actualSum += r.actual;
      if (r.status === 'balanced' || r.status === 'surplus' || r.status === 'deficit') {
        matched++;
        diffSum += r.diff;
      }
    }
    var accuracy = matched > 0 ? Math.round(bal / matched * 1000) / 10 : 0;
    var diffStr = (diffSum > 0 ? '+' : '') + diffSum;
    box.innerHTML =
      '<div class="cstat"><div class="cs-label">对比对象</div><div class="cs-value is-text" title="' + escapeAttr(compareState.source || '') + '">' + escapeHtml(compareState.source || '-') + '</div><div class="cs-sub">按商品编号逐条比对</div></div>' +
      '<div class="cstat"><div class="cs-label">账面库存合计</div><div class="cs-value">' + bookSum + '</div><div class="cs-sub">盘点前 · ' + (rows.length - nb) + ' 条</div></div>' +
      '<div class="cstat"><div class="cs-label">实盘数量合计</div><div class="cs-value">' + actualSum + '</div><div class="cs-sub">盘点后 · ' + (rows.length - nc) + ' 条</div></div>' +
      '<div class="cstat"><div class="cs-label">数量总差异</div><div class="cs-value">' + diffStr + '</div><div class="cs-sub">实盘 − 账面（已盘点部分）</div></div>' +
      '<div class="cstat"><div class="cs-label">盘点准确率</div><div class="cs-value">' + accuracy + '%</div><div class="cs-sub">对平 ' + bal + ' / 已盘点 ' + matched + '</div></div>' +
      '<div class="cstat"><div class="cs-label">差异分布</div><div class="cs-value is-text">盘盈 ' + sur + ' · 盘亏 ' + def + '</div><div class="cs-sub">未盘点 ' + nc + ' · 账面缺失 ' + nb + '</div></div>';
  }

  function renderCompareRows(rows, total) {
    var body = $('compareBody');
    if (!body) return;
    if (!total) {
      body.innerHTML = '<tr><td colspan="7" class="empty">当前筛选条件下没有数据</td></tr>';
      return;
    }
    var html = [];
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      var diffCell;
      if (r.diff == null) diffCell = '<span style="color:var(--muted);">—</span>';
      else {
        var cls = r.diff > 0 ? 'diff-pos' : (r.diff < 0 ? 'diff-neg' : 'diff-zero');
        diffCell = '<span class="' + cls + '">' + (r.diff > 0 ? '+' + r.diff : r.diff) + '</span>';
      }
      html.push(
        '<tr>' +
        '<td class="code-cell">' + escapeHtml(r.code) + '</td>' +
        '<td class="code-cell">' + escapeHtml(r.barcode || '-') + '</td>' +
        '<td class="name-cell">' + escapeHtml(r.name || '') + '</td>' +
        '<td class="num">' + (r.book != null ? r.book : '—') + '</td>' +
        '<td class="num">' + (r.actual != null ? r.actual : '—') + '</td>' +
        '<td class="num">' + diffCell + '</td>' +
        '<td>' + compareStatusHtml(r) + '</td>' +
        '</tr>'
      );
    }
    body.innerHTML = html.join('');
  }

  /* 导出对账结果 Excel */
  function exportCompare() {
    if (!compareState.rows.length) { toast('请先执行账面比对', 'warning'); return; }
    if (typeof XLSX === 'undefined') { toast('导出库未加载', 'error'); return; }
    /* 导出遵循当前筛选 + 搜索结果 */
    var list = filteredCompareRows();
    if (!list.length) { toast('当前筛选/搜索没有匹配的数据', 'warning'); return; }
    var rows = [['商品编号', '条形码', '商品名称', '账面库存', '实盘数量', '差异', '比对结果']];
    for (var i = 0; i < list.length; i++) {
      var r = list[i];
      rows.push([
        r.code, r.barcode || '', r.name || '',
        r.book != null ? r.book : '',
        r.actual != null ? r.actual : '',
        r.diff != null ? r.diff : '',
        compareStatusLabel(r)
      ]);
    }
    var ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [{ wch: 14 }, { wch: 18 }, { wch: 24 }, { wch: 10 }, { wch: 10 }, { wch: 8 }, { wch: 10 }];
    var wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '账面比对');
    var name = '账面比对结果_' + new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-') + '.xlsx';
    XLSX.writeFile(wb, name);
    toast('已导出 ' + list.length + ' 条（全部 ' + compareState.rows.length + ' 条）', 'success');
  }

  /* 通过报告卡片上的「对账」按钮进入（自动切到对账子页） */
  function compareSnapshot(sid) {
    if (!sid) return;
    window.goScanView('compare');
    /* 路由切换是异步的，等子页就位后再执行对账 */
    setTimeout(function () { runCompare(sid); }, 60);
  }

  /* 第一段：导出账面 */
  function exportPreScan() {
    var orig = loadOriginalSnapshot();
    if (!orig || !orig.length) { toast('暂无账面数据', 'warning'); return; }
    if (typeof XLSX === 'undefined') { toast('导出库未加载', 'error'); return; }
    /* 有关键词时仅导出当前搜索结果，并在提示中说明范围 */
    var list = preScanKeyword.trim() ? filterPreScan(orig) : orig;
    if (!list.length) { toast('当前搜索没有匹配的数据', 'warning'); return; }
    var rows = [['商品编号', '条形码', '商品分类', '商品名称', '账面库存']];
    for (var i = 0; i < list.length; i++) {
      var it = list[i];
      rows.push([it.code, it.barcode || '', it.category || '', it.name || '', it.systemQty != null ? it.systemQty : 0]);
    }
    var ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [{ wch: 14 }, { wch: 18 }, { wch: 14 }, { wch: 24 }, { wch: 12 }];
    var wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '盘点前账面');
    var suffix = preScanKeyword.trim() ? '_搜索_' + preScanKeyword.trim().slice(0, 12) : '';
    var name = '盘点前账面' + suffix + '_' + new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-') + '.xlsx';
    XLSX.writeFile(wb, name);
    toast(preScanKeyword.trim()
      ? ('已按搜索条件导出 ' + list.length + ' 条（全部 ' + orig.length + ' 条）')
      : ('已导出 ' + name), 'success');
  }

  function clearPreScan() {
    confirmClear('清空盘点前账面', '确定清空「盘点前账面」？此操作不影响已保存的盘点报告。', function () {
      clearOriginalSnapshot();
      preScanKeyword = '';
      var si = $('preScanSearch');
      if (si) si.value = '';
      renderPreScan();
      toast('已清空账面数据', 'success');
    });
  }

  /* 第二段：快照操作 */
  function exportSnapshot(sid) {
    var s = savedSnapshots.find(function (x) { return x.id === sid; });
    if (!s) { toast('报告不存在', 'error'); return; }
    if (typeof XLSX === 'undefined') { toast('导出库未加载', 'error'); return; }
    var rows = [['商品编号', '条形码', '商品分类', '商品名称', '账面库存', '实盘数量', '差异', '状态']];
    for (var i = 0; i < s.items.length; i++) {
      var it = s.items[i];
      var st = it.status === 'balanced' ? '对平' : (it.status === 'surplus' ? '盘盈' : '盘亏');
      rows.push([it.code, it.barcode || '', it.category || '', it.name || '',
                 it.systemQty, it.actualQty, (it.diff > 0 ? '+' : '') + it.diff, st]);
    }
    var ws = XLSX.utils.aoa_to_sheet(rows);
    var wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '盘点报告');
    var name = s.name + '_' + new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-') + '.xlsx';
    XLSX.writeFile(wb, name);
    toast('已导出 ' + name, 'success');
  }

  function deleteSnapshot(sid) {
    var s = savedSnapshots.find(function (x) { return x.id === sid; });
    if (!s) return;
    /* 软删除：打标记后从工作集合移除，存储中保留 */
    var go = function () {
      s.deleted = true;
      s.deletedAt = new Date().toISOString();
      savedSnapshots = savedSnapshots.filter(function (x) { return x.id !== sid; });
      saveSnapshotsList();
      renderSnapshots();
      toast('已删除报告', 'success');
    };
    if (typeof window.showConfirm === 'function') {
      window.showConfirm({
        title: '删除盘点报告',
        message: '确认删除报告「' + s.name + '」？\n保存时间：' + (s.savedAt || '—') + '，共 ' + (s.itemCount || 0) + ' 件商品。\n删除后不再显示，',
        onConfirm: go
      });
    } else {
      showModal('确定删除报告「' + s.name + '」？此操作不可撤销。', 'confirm', function (ok) { if (ok) go(); });
    }
  }

  function clearAllSnapshots() {
    if (!savedSnapshots.length) { toast('暂无报告', 'warning'); return; }
    var go = function () {
      var now = new Date().toISOString();
      savedSnapshots.forEach(function (s) { s.deleted = true; s.deletedAt = now; });
      savedSnapshots = [];
      saveSnapshotsList();
      renderSnapshots();
      toast('已清空全部报告', 'success');
    };
    if (typeof window.showConfirm === 'function') {
      window.showConfirm({
        title: '清空全部报告',
        message: '确认清空全部 ' + savedSnapshots.length + ' 份盘点报告？\n清空后列表将不再显示这些报告，',
        confirmText: '确认清空',
        onConfirm: go
      });
    } else {
      confirmClear('清空全部报告', '确定清空全部 ' + savedSnapshots.length + ' 份报告？此操作不可撤销。', go);
    }
  }

  /* 查看快照详情（弹窗显示完整表格，接入通用分页器） */
  function viewSnapshot(sid) {
    var s = savedSnapshots.find(function (x) { return x.id === sid; });
    if (!s) return;
    var html =
      '<div class="snap-view">' +
        '<div class="snap-view-meta">保存时间：' + escapeHtml(s.savedAt) + ' · 共 ' + s.itemCount + ' 条</div>' +
        '<div class="table-wrap snap-view-table">' +
          '<table class="data-table">' +
            '<thead><tr><th>编号</th><th>条码</th><th>名称</th><th class="num">账面</th><th class="num">实盘</th><th class="num">差异</th><th>状态</th></tr></thead>' +
            '<tbody id="snapViewBody"></tbody>' +
          '</table>' +
        '</div>' +
        '<div id="snapViewPager"></div>' +
      '</div>';
    showModal(html, 'alert', null);
    /* 报告详情表格较宽，给弹窗加宽（参考盘点明细页表格宽度） */
    var overlay = document.querySelector('.modal-overlay');
    if (overlay) overlay.classList.add('modal-wide');
    var body = $('snapViewBody');
    var mount = $('snapViewPager');
    if (!body || !mount) return;
    createPager(mount, {
      pageSize: 20,
      getData: function () { return s.items; },
      onPage: function (rows, page, size, total) {
        if (!total) {
          body.innerHTML = '<tr><td colspan="7" class="empty">无数据</td></tr>';
          return;
        }
        var trs = [];
        for (var i = 0; i < rows.length; i++) {
          var it = rows[i];
          var diffCls = it.diff > 0 ? 'diff-pos' : (it.diff < 0 ? 'diff-neg' : 'diff-zero');
          var sign = it.diff > 0 ? '+' : '';
          var stLabel = it.status === 'balanced' ? '对平' : (it.status === 'surplus' ? '盘盈' : '盘亏');
          trs.push(
            '<tr>' +
            '<td>' + escapeHtml(it.code) + '</td>' +
            '<td>' + escapeHtml(it.barcode || '-') + '</td>' +
            '<td>' + escapeHtml(it.name || '') + '</td>' +
            '<td class="num">' + it.systemQty + '</td>' +
            '<td class="num">' + it.actualQty + '</td>' +
            '<td class="num ' + diffCls + '">' + sign + it.diff + '</td>' +
            '<td>' + stLabel + '</td>' +
            '</tr>'
          );
        }
        body.innerHTML = trs.join('');
      }
    }).draw();
  }

  /* 保存当前盘点为快照报告 */
  function saveCurrentSnapshot() {
    if (!items.length) { toast('暂无数据可保存', 'warning'); return; }
    /* 统计当前数据概况，给用户一个清晰反馈 */
    var sur = 0, def = 0, bal = 0;
    for (var i = 0; i < items.length; i++) {
      if (items[i].status === 'surplus') sur++;
      else if (items[i].status === 'deficit') def++;
      else bal++;
    }
    var now = new Date();
    var pad = function (n) { return n < 10 ? '0' + n : '' + n; };
    var defaultName = '盘点报告_' + now.getFullYear() + '-' + pad(now.getMonth() + 1) + '-' + pad(now.getDate()) +
      '_' + pad(now.getHours()) + ':' + pad(now.getMinutes());
    /* 借用 showModal 弹一个输入对话框 */
    showSnapshotNameDialog(defaultName, function (name) {
      if (name === null) return; /* 用户取消 */
      name = (name || '').trim() || defaultName;
      var snapshot = {
        id: 'snap_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
        name: name,
        savedAt: now.toISOString().slice(0, 19).replace('T', ' '),
        itemCount: items.length,
        items: items.map(function (it) { return JSON.parse(JSON.stringify(it)); })
      };
      /* 统一走 CMGStocktake：本地 +（Http 时）stocktake API */
      var finish = function (msg) {
        savedSnapshots = (typeof CMGStocktake !== 'undefined' && CMGStocktake.readLocal)
          ? CMGStocktake.readLocal()
          : (function () { savedSnapshots.unshift(snapshot); saveSnapshotsList(); return savedSnapshots; })();
        if (!savedSnapshots.length || savedSnapshots[0].id !== snapshot.id) {
          /* 门面未加载时的回退已在上面 IIFE 处理 */
        }
        saveSnapshotsList();
        toast(msg, 'success');
        window.goScanView('reports');
      };
      if (typeof CMGStocktake !== 'undefined' && CMGStocktake.saveReport) {
        CMGStocktake.saveReport(snapshot).then(function (r) {
          if (r && r.ok === false) {
            toast(r.error || '盘点报告保存失败', 'error');
            return;
          }
          savedSnapshots = CMGStocktake.readLocal();
          saveSnapshotsList();
          var tip = '已保存「' + name + '」（' + items.length + ' 件）';
          if (r && r.server && r.server.session) tip += ' · 已同步服务端';
          else if (r && r.localOnly) tip += ' · 本地';
          toast(tip, 'success');
          window.goScanView('reports');
        }).catch(function () {
          savedSnapshots.unshift(snapshot);
          saveSnapshotsList();
          toast('已保存「' + name + '」（本地）', 'success');
          window.goScanView('reports');
        });
      } else {
        savedSnapshots.unshift(snapshot);
        saveSnapshotsList();
        toast('已保存「' + name + '」（' + items.length + ' 件）', 'success');
        window.goScanView('reports');
      }
    }, items.length, items.length);
  }

  /* 自定义弹窗：输入快照名称 */
  function showSnapshotNameDialog(defaultName, onDone, total, count) {
    var overlay = document.createElement('div');
    overlay.className = 'modal-overlay show';
    overlay.innerHTML =
      '<div class="modal-box" role="dialog" aria-modal="true">' +
        '<div class="modal-title">保存盘点报告</div>' +
        '<div class="modal-content">' +
          '<p style="margin:0 0 10px;color:#525252;font-size:13px;">' +
            '当前共 <b>' + total + '</b> 件盘点数据（对平/盘盈/盘亏 见底部统计）。' +
            '保存后会出现在「盘点数据 → 已保存盘点报告」中，原工作区数据不变。' +
          '</p>' +
          '<label style="display:block;font-size:13px;color:#525252;margin-bottom:6px;">报告名称</label>' +
          '<input id="snapNameInput" type="text" maxlength="40" ' +
            'style="width:100%;padding:10px 12px;border:1px solid #d4d4d4;border-radius:6px;font-size:14px;outline:none;" ' +
            'value="' + escapeAttr(defaultName) + '" />' +
        '</div>' +
        '<div class="modal-actions">' +
          '<button class="btn btn-outline btn-sm" id="snapCancel">取消</button>' +
          '<button class="btn btn-primary btn-sm" id="snapConfirm">保存</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(overlay);
    var input = overlay.querySelector('#snapNameInput');
    setTimeout(function () { input.focus(); input.select(); }, 30);
    function close(value) {
      document.body.removeChild(overlay);
      document.removeEventListener('keydown', onKey);
      onDone(value);
    }
    function onKey(e) {
      if (e.key === 'Escape') close(null);
      if (e.key === 'Enter')  close(input.value);
    }
    document.addEventListener('keydown', onKey);
    overlay.querySelector('#snapCancel').addEventListener('click', function () { close(null); });
    overlay.querySelector('#snapConfirm').addEventListener('click', function () { close(input.value); });
    overlay.addEventListener('click', function (e) { if (e.target === overlay) close(null); });
  }

  function downloadTemplate() {
    if (typeof XLSX === 'undefined') {
      toast('导出库未加载', 'error');
      return;
    }
    var rows = [
      ['商品编号', '商品名称', '条形码', '商品分类', '库存数量'],
      ['SKU0001', '示例商品 A', '6901234567890', '日用百货', 120],
      ['SKU0002', '示例商品 B', '6901234567891', '食品饮料', 36],
      ['SKU0003', '示例商品 C', '', '办公用品', 8]
    ];
    var ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [{ wch: 14 }, { wch: 22 }, { wch: 18 }, { wch: 14 }, { wch: 12 }];
    var wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '库存模板');
    XLSX.writeFile(wb, '库存导入模板.xlsx');
    toast('模板已下载', 'success');
  }

  function clearAll() {
    confirmClear('清空盘点数据', '确定清空全部已导入与扫码数据？清空后可重新导入。', function () {
      if (cameraRunning) toggleCamera();
      items = [];
      lookup.clear();
      lastHighlightId = null;
      currentPage = 1;
      searchKeyword = '';
      var si = $('searchInput');
      if (si) si.value = '';
      $('importToolbar').style.display = 'none';
      /* 无数据时「导出结果」不可用（它始终可见，故需显式禁用） */
      var expBtn = $('btnExport');
      if (expBtn) expBtn.disabled = true;
      var dtb = $('detailToolbar');
      if (dtb) dtb.style.display = 'none';
      var last = $('lastScan');
      if (last) { last.textContent = ''; last.classList.remove('show'); }
      renderPage();
      calcStats();
      saveItems();
      toast('已清空', 'success');
    });
  }

  function showLibError(msg) {
    var el = $('libError');
    el.textContent = msg;
    el.classList.add('show');
  }


/* ========== js/features/scan-mutex.js ========== */
/* js/features/scan-mutex.js */
/* ===== 扫码互斥（USB / 摄像头 二选一） ===== */
  function setScanMode(mode) {
    scanMode = mode;
    var usbCard = document.querySelector('.scan-card-usb');
    var camCard = document.querySelector('.scan-card-cam');
    if (usbCard) usbCard.classList.toggle('locked', mode === 'camera');
    if (camCard) camCard.classList.toggle('locked', mode === 'usb');
    var inputs = [$('scanInputDesktop'), $('scanInputMobile')];
    var camBtns = [$('btnCamera'), $('btnCameraMobile')];
    inputs.forEach(function (i) {
      if (!i) return;
      i.disabled = mode === 'camera';
      i.placeholder = mode === 'camera' ? '摄像头模式已激活，USB 输入已锁定' : '将光标移至此框后扫码或按回车';
    });
    camBtns.forEach(function (b) {
      if (!b) return;
      b.disabled = mode === 'usb';
      b.title = mode === 'usb' ? 'USB 扫码枪已激活，摄像头已锁定' : '';
    });
    /* 互斥提示徽章 */
    var usbTitle = usbCard ? usbCard.querySelector('.card-title') : null;
    var camTitle = camCard ? camCard.querySelector('.card-title') : null;
    if (usbTitle && mode === 'camera') {
      usbTitle.classList.add('muted'); usbTitle.classList.remove('active');
    } else if (usbTitle && mode === 'usb') {
      usbTitle.classList.add('active'); usbTitle.classList.remove('muted');
    } else if (usbTitle) {
      usbTitle.classList.remove('active', 'muted');
    }
    if (camTitle && mode === 'usb') {
      camTitle.classList.add('muted'); camTitle.classList.remove('active');
    } else if (camTitle && mode === 'camera') {
      camTitle.classList.add('active'); camTitle.classList.remove('muted');
    } else if (camTitle) {
      camTitle.classList.remove('active', 'muted');
    }
  }

  function bindScanInput(el) {
    if (!el) return;
    if (el.__scanBound) return;
    el.__scanBound = true;
    var autoTimer = null;
    var typeStartTime = 0;
    var lastInputAt = 0;

    function submitScan(v) {
      v = String(v || '').trim();
      if (!v) return;
      el.value = '';
      typeStartTime = 0;
      lastInputAt = 0;
      try { handleScan(v); } catch (err) { console.warn('[scan]', err); }
      try { el.focus({ preventScroll: true }); } catch (eF) { try { el.focus(); } catch (e2) {} }
    }

    function tryAutoSubmit() {
      var v = el.value;
      if (!v || !v.trim()) return;
      var duration = Date.now() - typeStartTime;
      var gap = Date.now() - lastInputAt;
      /* 扫码枪：字间间隔短；长二维码 URL 总时长可能 >1s，不能用 1s 上限卡死 */
      var looksLikeScan = (gap >= 80 && duration < 8000 && v.trim().length >= 3)
        || (duration < 2500 && v.trim().length >= 3);
      if (looksLikeScan) submitScan(v);
    }

    el.addEventListener('input', function () {
      var v = el.value;
      lastInputAt = Date.now();
      if (!v) { typeStartTime = 0; clearTimeout(autoTimer); return; }
      if (typeStartTime === 0) typeStartTime = Date.now();
      clearTimeout(autoTimer);
      /* 长码（URL）字间可能稍慢，间隔放宽到 320ms */
      autoTimer = setTimeout(tryAutoSubmit, 320);
    });

    el.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        e.stopPropagation();
        clearTimeout(autoTimer);
        var v = el.value;
        typeStartTime = 0;
        if (!v || !v.trim()) { try { el.focus(); } catch (e0) {} return; }
        submitScan(v);
      }
    });

    /* 部分枪无 Enter，仅靠 input 静默结束 */
    el.addEventListener('blur', function () {
      clearTimeout(autoTimer);
      var v = el.value;
      if (v && v.trim().length >= 3) {
        var duration = typeStartTime ? (Date.now() - typeStartTime) : 0;
        if (duration < 8000) submitScan(v);
      }
      typeStartTime = 0;
    });
  }
  bindScanInput($('scanInputDesktop'));
  bindScanInput($('scanInputMobile'));
  /* 切到扫码页时重新绑定并聚焦（防止 DOM 重绘丢监听） */
  window.__rebindScanInputs = function () {
    bindScanInput($('scanInputDesktop'));
    bindScanInput($('scanInputMobile'));
    try { if (typeof focusScan === 'function') focusScan(); } catch (e) {}
  };

  /* 全局扫码兜底：仅在「非输入框」且处于扫码相关页面时生效。
     在任意 INPUT/TEXTAREA/可编辑区打字一律忽略，避免误弹盘点结果。 */
  var _scannerBuf = '';
  var _scannerLast = 0;
  var _scannerTimer = null;
  function isScanContextPage() {
    try {
      var hash = String(location.hash || '');
      if (/scan|stocktake|盘点/i.test(hash)) return true;
      var active = document.querySelector('.page-section.active');
      if (active && (active.id === 'page-scan' || active.id === 'page-scan-data')) return true;
      var entry = document.getElementById('scanInputDesktop') || document.getElementById('scanInputMobile');
      if (entry && entry.offsetParent !== null) return true;
    } catch (e0) {}
    return false;
  }
  document.addEventListener('keydown', function (e) {
    var t = e.target;
    /* 任何输入框 / 文本域 / 可编辑元素：完全不走扫码逻辑 */
    if (t) {
      var tag = (t.tagName || '').toUpperCase();
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || t.isContentEditable) {
        _scannerBuf = '';
        clearTimeout(_scannerTimer);
        return;
      }
      if (t.closest && (t.closest('input, textarea, select, [contenteditable="true"], .modal-box, .drawer-panel'))) {
        _scannerBuf = '';
        clearTimeout(_scannerTimer);
        return;
      }
    }
    /* 不在扫码盘点相关页：不兜底，防止其它页面误触发 */
    if (!isScanContextPage()) {
      _scannerBuf = '';
      return;
    }
    var now = Date.now();
    if (now - _scannerLast > 80) _scannerBuf = '';
    _scannerLast = now;
    if (e.key && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      _scannerBuf += e.key;
      clearTimeout(_scannerTimer);
      _scannerTimer = setTimeout(function () {
        /* 扫码枪：字间极短；人工慢打不会在 80ms 内堆出长串 */
        if (_scannerBuf.length >= 6) {
          var code = _scannerBuf;
          _scannerBuf = '';
          try { handleScan(code); } catch (err) {}
        } else {
          _scannerBuf = '';
        }
      }, 100);
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      clearTimeout(_scannerTimer);
      if (_scannerBuf.length >= 4) {
        e.preventDefault();
        var code2 = _scannerBuf;
        _scannerBuf = '';
        try { handleScan(code2); } catch (err2) {}
      } else {
        _scannerBuf = '';
      }
    }
  }, true);


/* ========== js/features/usb-device.js ========== */
/* js/features/usb-device.js */
/* ===== USB扫码设备接入状态管理 ===== */
  var DeviceManager = (function () {
    var statusEl = null;
    var dotEl = null;
    var textEl = null;
    var hidDevice = null;
    var kbConnected = false;
    var kbResetTimer = null;
    var currentState = 'disconnected';

    var STATES = {
      disconnected:  { cls: 'disconnected',  text: '等待扫码设备接入' },
      detecting:     { cls: 'detecting',     text: '正在检测扫码设备…' },
      connected_kb:  { cls: 'connected-kb',  text: '扫码枪已连接（键盘模式）' },
      connected_hid: { cls: 'connected-hid', text: 'USB设备已连接（直连模式）' },
      unsupported:   { cls: 'unsupported',   text: '当前浏览器不支持WebHID，使用键盘模式' }
    };

    function init() {
      statusEl = $('deviceStatus');
      if (!statusEl) return;
      dotEl = $('statusDot');
      textEl = $('statusText');
      setState('disconnected');

      if (!('hid' in navigator)) {
        setState('unsupported');
        var btn = $('btnConnectUsb');
        if (btn) { btn.style.display = 'none'; }
      } else {
        navigator.hid.addEventListener('disconnect', function (e) {
          if (hidDevice && e.device === hidDevice) {
            hidDevice = null;
            setState('disconnected');
            toast('USB扫码设备已断开', 'warning');
          }
        });
        navigator.hid.addEventListener('connect', function (e) {
          tryConnectHid(e.device);
        });
        navigator.hid.getDevices().then(function (devices) {
          if (devices && devices.length > 0) {
            tryConnectHid(devices[0]);
          }
        }).catch(function () {});
      }

      var connectBtn = $('btnConnectUsb');
      if (connectBtn) {
        connectBtn.addEventListener('click', requestHidDevice);
      }
    }

    function setState(state) {
      if (!statusEl || !STATES[state]) return;
      currentState = state;
      var s = STATES[state];
      statusEl.className = 'device-status ' + s.cls;
      if (textEl) textEl.textContent = s.text;
    }

    function getState() { return currentState; }

    /* --- WebHID 直连模式 --- */
    function requestHidDevice() {
      if (!('hid' in navigator)) {
        toast('当前浏览器不支持WebHID，请使用Chrome/Edge', 'warning');
        return;
      }
      setState('detecting');
      navigator.hid.requestDevice({ filters: [] }).then(function (devices) {
        if (devices && devices.length > 0) {
          tryConnectHid(devices[0]);
        } else {
          setState('disconnected');
        }
      }).catch(function (err) {
        setState('disconnected');
      });
    }

    function tryConnectHid(device) {
      if (!device) return;
      /* 互斥：若摄像头在跑，先停掉 */
      if (cameraRunning) {
        try { if (html5QrCode) html5QrCode.stop(); } catch (e) {}
        cameraRunning = false;
        var reader = $('reader'); if (reader) reader.classList.remove('active');
        var placeholder = $('cameraPlaceholder'); if (placeholder) placeholder.classList.remove('hidden');
        var btns = [$('btnCamera'), $('btnCameraMobile')];
        btns.forEach(function (b) {
          if (!b) return;
          var txt = b.querySelector('.btn-camera-text');
          if (txt) txt.textContent = b.id === 'btnCameraMobile' ? '摄像头' : '开启摄像头扫码';
          b.classList.remove('btn-danger'); b.classList.add('btn-primary');
        });
      }
      setState('detecting');
      device.open().then(function () {
        hidDevice = device;
        setState('connected_hid');
        var name = device.productName || 'USB扫码设备';
        toast('已连接：' + name, 'success');
        setScanMode('usb');
        device.addEventListener('inputreport', function (e) {
          var data = new Uint8Array(e.data.buffer);
          var code = parseHidReport(data);
          if (code) {
            handleScan(code);
            markKbActive();
          }
        });
      }).catch(function () {
        setState('disconnected');
        toast('设备连接失败，请重试', 'error');
      });
    }

    /* 解析HID报告为条码字符串（键盘楔入式HID设备通常发送键盘使用码） */
    var _hidBuf = '';
    var HID_KEYMAP = {
      4:'a',5:'b',6:'c',7:'d',8:'e',9:'f',10:'g',11:'h',12:'i',13:'j',
      14:'k',15:'l',16:'m',17:'n',18:'o',19:'p',20:'q',21:'r',22:'s',23:'t',
      24:'u',25:'v',26:'w',27:'x',28:'y',29:'z',30:'1',31:'2',32:'3',33:'4',
      34:'5',35:'6',36:'7',37:'8',38:'9',39:'0',44:' ',45:'-',46:'=',47:'[',
      48:']',49:'\\',51:';',52:"'",53:'`',54:',',55:'.',56:'/'
    };
    var HID_SHIFTMAP = {
      30:'!',31:'@',32:'#',33:'$',34:'%',35:'^',36:'&',37:'*',38:'(',39:')',
      45:'_',46:'+',47:'{',48:'}',49:'|',51:':',52:'"',53:'~',54:'<',55:'>',56:'?'
    };
    function parseHidReport(data) {
      if (!data || data.length < 3) return null;
      var modifier = data[0];
      var key = data[2];
      if (key === 0) return null;
      var shift = !!(modifier & 0x22);
      if (key === 40 || key === 43) {
        var code = _hidBuf;
        _hidBuf = '';
        return code.length >= 3 ? code : null;
      }
      var ch = shift ? (HID_SHIFTMAP[key] || HID_KEYMAP[key] || '') : (HID_KEYMAP[key] || '');
      if (ch) _hidBuf += ch;
      return null;
    }

    /* --- 键盘楔入模式检测 --- */
    function markKbActive() {
      kbConnected = true;
      if (currentState !== 'connected_hid') {
        setState('connected_kb');
      }
      clearTimeout(kbResetTimer);
      kbResetTimer = setTimeout(function () {
        if (currentState === 'connected_kb') {
          setState('disconnected');
          kbConnected = false;
        }
      }, 60000);
    }

    return {
      init: init,
      setState: setState,
      getState: getState,
      markKbActive: markKbActive,
      requestHidDevice: requestHidDevice
    };
  })();

  $('btnCamera').addEventListener('click', toggleCamera);
  $('btnCameraMobile').addEventListener('click', toggleCamera);
  $('btnClear').addEventListener('click', clearAll);
  $('btnExport').addEventListener('click', exportResult);
  var btnTemplate = $('btnTemplate');
  if (btnTemplate) btnTemplate.addEventListener('click', downloadTemplate);
  /* 盘点明细页顶部工具栏 */
  $('btnClearDetail').addEventListener('click', clearAll);
  $('btnExportDetail').addEventListener('click', exportResult);
  $('btnSaveSnapshot').addEventListener('click', saveCurrentSnapshot);
  $('btnExportPreScan').addEventListener('click', exportPreScan);
  $('btnClearPreScan').addEventListener('click', clearPreScan);
  $('btnClearSnapshots').addEventListener('click', clearAllSnapshots);

  /* 快照列表操作委托 */
  var snapshotsListEl = $('snapshotsList');
  if (snapshotsListEl) {
    snapshotsListEl.addEventListener('click', function (e) {
      var t = (e.target && e.target.closest) ? e.target.closest('button[data-act]') : null;
      if (!t) return;
      var act = t.getAttribute('data-act');
      var sid = t.getAttribute('data-sid');
      if (act === 'view')   viewSnapshot(sid);
      if (act === 'compare') compareSnapshot(sid);
      if (act === 'export') exportSnapshot(sid);
      if (act === 'delete') deleteSnapshot(sid);
    });
  }

  /* 对账对比：运行 / 导出 / 筛选 */
  var btnCompareRunEl = $('btnCompareRun');
  if (btnCompareRunEl) btnCompareRunEl.addEventListener('click', function () { runCompare(); });
  var btnExportCompareEl = $('btnExportCompare');
  if (btnExportCompareEl) btnExportCompareEl.addEventListener('click', exportCompare);
  var compareFiltersEl = $('compareFilters');
  if (compareFiltersEl) {
    compareFiltersEl.addEventListener('click', function (e) {
      var t = (e.target && e.target.closest) ? e.target.closest('button[data-cfilter]') : null;
      if (!t) return;
      compareState.filter = t.getAttribute('data-cfilter');
      /* 只切换筛选按钮的 active，搜索按钮不参与 */
      compareFiltersEl.querySelectorAll('button[data-cfilter]').forEach(function (b) {
        b.classList.toggle('active', b === t);
      });
      if (compareState.pager) compareState.pager.reset();
    });
  }


/* ========== js/features/scan-nav.js ========== */
/* js/features/scan-nav.js */
/* ===== 盘点数据页：全局导航（切换三个独立子页，路径唯一） ===== */
  (function initGlobalNav() {
    var nav = $('globalNav');
    if (!nav) return;
    var topbar = document.querySelector('.topbar');
    /* 动态测量顶栏高度，写入 CSS 变量供 sticky 定位使用 */
    function measureTopbar() {
      if (!topbar) return;
      document.documentElement.style.setProperty('--topbar-h', topbar.offsetHeight + 'px');
    }
    measureTopbar();
    window.addEventListener('resize', measureTopbar);
    var links = nav.querySelectorAll('.gn-link');
    links.forEach(function (a) {
      a.addEventListener('click', function (e) {
        e.preventDefault();
        var view = a.getAttribute('data-view');
        if (SCAN_VIEWS.indexOf(view) === -1) return;
        /* 立即高亮，切页渲染由 hashchange 统一处理 */
        for (var k = 0; k < links.length; k++) {
          links[k].classList.toggle('active', links[k] === a);
        }
        var next = '#/scan-data/' + view;
        if (location.hash === next) applyScanView(view);
        else location.hash = next;
      });
    });
  })();


/* ========== js/features/machine-module.js ========== */
/* js/features/machine-module.js — 机台数据：对接「经营报表 / 返奖概率 / 运营参数」 */
(function () {
  'use strict';
  var STORAGE_KEY = 'machine_profit_source_v2'; /* user-scoped via CMGUserStore when reading */;
  var COIN_VALUE_DEFAULT = 0.33;
  /* rows: 合并后的运营行 */
  var rows = [];
  var META_TYPES = ['爪机', '零食爪机', '礼品机', '玩法机']; /* 毛利合并不含卡牌机，对齐运营参数 */
  var weekPager = null, monthPager = null, importPager = null;

  function $(id) { return document.getElementById(id); }
  function load() {
    try {
      var raw = CMGUserStore.getItem(STORAGE_KEY);
      var data = raw ? JSON.parse(raw) : null;
      if (Array.isArray(data)) rows = data;
      else if (data && Array.isArray(data.rows)) rows = data.rows;
      else rows = [];
    } catch (e) { rows = []; }
  }
  function save() {
    try {
      CMGUserStore.setItem(STORAGE_KEY, JSON.stringify({
        version: 2,
        updatedAt: Date.now(),
        rows: rows
      }));
    } catch (e) {}
  }
  function money(n) {
    var v = Number(n) || 0;
    return v.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function pct(n) {
    if (!isFinite(n)) return '—';
    return (n * 100).toFixed(1) + '%';
  }
  function num(v) {
    if (v == null || v === '') return 0;
    if (typeof v === 'number') return isFinite(v) ? v : 0;
    var s = String(v).replace(/,/g, '').replace(/%/g, '').trim();
    if (!s || s === '#Div0' || s === '#DIV/0!' || s === '-') return 0;
    var n = parseFloat(s);
    return isFinite(n) ? n : 0;
  }
  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
  function normalizeHeader(h) {
    return String(h || '').replace(/\s+/g, '').replace(/\(元\)/g, '').toLowerCase();
  }
  function findCol(headers, keys) {
    var i, j, h, k;
    /* 先精确匹配，再包含匹配，避免「项目」命中「项目类型」 */
    for (j = 0; j < keys.length; j++) {
      k = String(keys[j]).toLowerCase().replace(/\s+/g, '').replace(/\(元\)/g, '');
      for (i = 0; i < headers.length; i++) {
        h = normalizeHeader(headers[i]);
        if (h === k) return i;
      }
    }
    for (j = 0; j < keys.length; j++) {
      k = String(keys[j]).toLowerCase().replace(/\s+/g, '').replace(/\(元\)/g, '');
      for (i = 0; i < headers.length; i++) {
        h = normalizeHeader(headers[i]);
        if (h.indexOf(k) >= 0) return i;
      }
    }
    return -1;
  }
  function normCode(c) {
    var s = String(c || '').replace(/\.0$/, '').trim();
    if (/^\d+$/.test(s)) {
      while (s.length < 4) s = '0' + s;
    }
    return s;
  }
  function normPort(p) {
    var s = String(p || '').trim().toUpperCase().replace(/\s+/g, '');
    if (!s) return '1P';
    if (/^\d+$/.test(s)) return s + 'P';
    return s;
  }
  function normName(n) {
    return String(n || '')
      .replace(/（[^）]*）/g, '')
      .replace(/\([^)]*\)/g, '')
      .replace(/\s+/g, '')
      .trim();
  }
  function parseDate(v) {
    if (v instanceof Date && !isNaN(v.getTime())) return v;
    if (typeof v === 'number' && v > 20000 && v < 80000) {
      var d = new Date(Date.UTC(1899, 11, 30));
      d.setUTCDate(d.getUTCDate() + Math.floor(v));
      return d;
    }
    var s = String(v || '').trim();
    if (!s) return null;
    var t = Date.parse(s.replace(/\./g, '-').replace(/\//g, '-'));
    return isNaN(t) ? null : new Date(t);
  }
  function weekKey(d) {
    var tmp = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    var day = tmp.getUTCDay() || 7;
    tmp.setUTCDate(tmp.getUTCDate() + 4 - day);
    var yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
    var weekNo = Math.ceil((((tmp - yearStart) / 86400000) + 1) / 7);
    return tmp.getUTCFullYear() + '-W' + String(weekNo).padStart(2, '0');
  }
  function monthKey(d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
  }
  function fmtDate(d) {
    if (!d || isNaN(d.getTime())) return '';
    var m = d.getMonth() + 1, day = d.getDate();
    return d.getFullYear() + '-' + (m < 10 ? '0' : '') + m + '-' + (day < 10 ? '0' : '') + day;
  }
  function fmtDateCN(d) {
    if (!d || isNaN(d.getTime())) return '';
    return d.getFullYear() + '/' + (d.getMonth() + 1) + '/' + d.getDate();
  }
  function startOfDay(d) {
    var x = new Date(d.getTime());
    x.setHours(0, 0, 0, 0);
    return x;
  }
  function sameDay(a, b) {
    return a && b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  }
  function periodRange() {
    var sEl = $('mpPeriodStart'), eEl = $('mpPeriodEnd');
    var start = sEl && sEl.value ? parseDate(sEl.value) : null;
    var end = eEl && eEl.value ? parseDate(eEl.value) : null;
    var now = startOfDay(new Date());
    if (!start) start = now;
    if (!end) end = start;
    if (end < start) { var tmp = start; start = end; end = tmp; }
    return { start: startOfDay(start), end: startOfDay(end) };
  }
  function periodDate() {
    return periodRange().start;
  }
  function updatePeriodDisplay() {
    var range = periodRange();
    var el = $('mpPeriodDisplay');
    if (!el) return;
    var sEl = $('mpPeriodStart');
    if (!sEl || !sEl.value) {
      el.textContent = '请选择账期';
      el.classList.add('is-placeholder');
      return;
    }
    el.textContent = fmtDateCN(range.start) + '  →  ' + fmtDateCN(range.end);
    el.classList.remove('is-placeholder');
  }
  function setPeriodRange(start, end, presetKey) {
    var sEl = $('mpPeriodStart'), eEl = $('mpPeriodEnd');
    if (sEl) sEl.value = fmtDate(start);
    if (eEl) eEl.value = fmtDate(end);
    updatePeriodDisplay();
    var bar = $('mpPeriodPresets');
    if (bar) {
      bar.querySelectorAll('.mp-preset').forEach(function (b) {
        b.classList.toggle('active', presetKey && b.getAttribute('data-preset') === presetKey);
      });
    }
    if (window.__mpDp) {
      window.__mpDp.view = new Date(start.getFullYear(), start.getMonth(), 1);
      window.__mpDp.pickStart = startOfDay(start);
      window.__mpDp.pickEnd = startOfDay(end);
      window.__mpDp.picking = false;
      renderDatePickerCals();
    }
  }
  function applyPreset(key) {
    var now = startOfDay(new Date());
    var start = now, end = now;
    if (key === 'today') { start = end = now; }
    else if (key === 'yesterday') {
      start = new Date(now); start.setDate(now.getDate() - 1); end = new Date(start);
    } else if (key === 'last7') {
      start = new Date(now); start.setDate(now.getDate() - 6); end = now;
    } else if (key === 'last30') {
      start = new Date(now); start.setDate(now.getDate() - 29); end = now;
    } else if (key === 'thisMonth') {
      start = new Date(now.getFullYear(), now.getMonth(), 1); end = now;
    } else if (key === 'lastMonth') {
      start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      end = new Date(now.getFullYear(), now.getMonth(), 0);
    } else if (key === 'thisYear') {
      start = new Date(now.getFullYear(), 0, 1); end = now;
    } else if (key === 'lastYear') {
      start = new Date(now.getFullYear() - 1, 0, 1);
      end = new Date(now.getFullYear() - 1, 11, 31);
    }
    setPeriodRange(start, end, key);
  }

  function renderOneCal(containerId, titleId, year, month, rangeStart, rangeEnd) {
    var box = $(containerId), title = $(titleId);
    if (!box) return;
    if (title) title.textContent = year + '年 ' + (month + 1) + '月';
    var first = new Date(year, month, 1);
    var startPad = (first.getDay() + 6) % 7; /* Mon=0 */
    var daysInMonth = new Date(year, month + 1, 0).getDate();
    var prevDays = new Date(year, month, 0).getDate();
    var today = startOfDay(new Date());
    var html = '';
    var i, day, d, cls, inR, isS, isE;
    for (i = 0; i < 42; i++) {
      if (i < startPad) {
        day = prevDays - startPad + i + 1;
        d = new Date(year, month - 1, day);
        cls = 'mp-dp-day other';
      } else if (i >= startPad + daysInMonth) {
        day = i - startPad - daysInMonth + 1;
        d = new Date(year, month + 1, day);
        cls = 'mp-dp-day other';
      } else {
        day = i - startPad + 1;
        d = new Date(year, month, day);
        cls = 'mp-dp-day';
      }
      d = startOfDay(d);
      if (sameDay(d, today)) cls += ' today';
      isS = rangeStart && sameDay(d, rangeStart);
      isE = rangeEnd && sameDay(d, rangeEnd);
      inR = rangeStart && rangeEnd && d >= rangeStart && d <= rangeEnd;
      if (inR) cls += ' in-range';
      if (isS) cls += ' range-start';
      if (isE) cls += ' range-end';
      html += '<button type="button" class="' + cls + '" data-date="' + fmtDate(d) + '">' + day + '</button>';
    }
    box.innerHTML = html;
  }
  function renderDatePickerCals() {
    var st = window.__mpDp;
    if (!st) return;
    var y = st.view.getFullYear(), m = st.view.getMonth();
    var r2 = new Date(y, m + 1, 1);
    renderOneCal('mpCalDaysL', 'mpCalTitleL', y, m, st.pickStart, st.pickEnd);
    renderOneCal('mpCalDaysR', 'mpCalTitleR', r2.getFullYear(), r2.getMonth(), st.pickStart, st.pickEnd);
  }
  function openDatePicker() {
    var root = $('mpDatePicker'), panel = $('mpPeriodPanel'), trigger = $('mpPeriodTrigger');
    if (!root || !panel) return;
    root.classList.add('open');
    panel.hidden = false;
    if (trigger) trigger.setAttribute('aria-expanded', 'true');
    renderDatePickerCals();
  }
  function closeDatePicker() {
    var root = $('mpDatePicker'), panel = $('mpPeriodPanel'), trigger = $('mpPeriodTrigger');
    if (!root || !panel) return;
    root.classList.remove('open');
    panel.hidden = true;
    if (trigger) trigger.setAttribute('aria-expanded', 'false');
  }
  function bindDatePicker() {
    bindSharedDatePicker({
      rootId: 'mpDatePicker',
      triggerId: 'mpPeriodTrigger',
      panelId: 'mpPeriodPanel',
      startId: 'mpPeriodStart',
      endId: 'mpPeriodEnd',
      displayId: 'mpPeriodDisplay',
      presetsId: 'mpPeriodPresets',
      calDaysL: 'mpCalDaysL',
      calDaysR: 'mpCalDaysR',
      calTitleL: 'mpCalTitleL',
      calTitleR: 'mpCalTitleR',
      defaultPreset: 'last7',
      stateKey: '__mpDp'
    });
  }

  function bindSharedDatePicker(cfg) {
    cfg = cfg || {};
    var key = cfg.stateKey || ('__dp_' + (cfg.rootId || 'dp'));
    function el(id) { return id ? document.getElementById(id) : null; }
    var rootCheck = el(cfg.rootId);
    /* 已完整绑定则直接复用，禁止重复挂 document 监听（否则第二次点选会被旧监听关掉） */
    if (window[key] && window[key].bound && rootCheck && rootCheck.getAttribute('data-dp-bound') === '1') {
      var tr0 = el(cfg.triggerId);
      if (tr0 && tr0.__dpClick && window[key].__docCloser) return window[key];
    }
    /* 重新绑定前卸掉旧的 document 关闭器 */
    if (window[key] && window[key].__docCloser) {
      try { document.removeEventListener('mousedown', window[key].__docCloser, true); } catch (eRm) {}
      try { document.removeEventListener('click', window[key].__docCloser, true); } catch (eRm2) {}
    }
    function fmt(d) {
      if (!d || isNaN(d.getTime())) return '';
      var m = d.getMonth() + 1, day = d.getDate();
      return d.getFullYear() + '-' + (m < 10 ? '0' : '') + m + '-' + (day < 10 ? '0' : '') + day;
    }
    function fmtCN(d) {
      if (!d || isNaN(d.getTime())) return '';
      return d.getFullYear() + '/' + (d.getMonth() + 1) + '/' + d.getDate();
    }
    function sod(d) {
      var x = new Date(d.getTime()); x.setHours(0,0,0,0); return x;
    }
    function same(a, b) {
      return a && b && a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate();
    }
    function parseD(v) {
      if (v instanceof Date && !isNaN(v.getTime())) return v;
      var s = String(v || '').trim();
      if (!s) return null;
      var t = Date.parse(s.replace(/\./g, '-').replace(/\//g, '-'));
      return isNaN(t) ? null : new Date(t);
    }
    var startEl = el(cfg.startId), endEl = el(cfg.endId), display = el(cfg.displayId);
    var root = el(cfg.rootId), panel = el(cfg.panelId), trigger = el(cfg.triggerId);
    if (!root || !panel) return;
    /* 单日模式：点击即选中并关闭，隐藏右侧第二个月面板 */
    var single = !!cfg.single;

    function updateDisplay() {
      if (!display) return;
      if (!startEl || !startEl.value) {
        display.textContent = (cfg.placeholder || '请选择日期范围');
        display.classList.add('is-placeholder');
        return;
      }
      var s = parseD(startEl.value), e = parseD(endEl && endEl.value);
      /* 起止同一天时只显示单个日期，跨天才显示区间箭头 */
      var sameDay = e && sod(e).getTime() === sod(s).getTime();
      display.textContent = (single || !e || sameDay) ? fmtCN(s) : (fmtCN(s) + '  →  ' + fmtCN(e));
      display.classList.remove('is-placeholder');
    }
    function setRange(start, end, presetKey) {
      if (startEl) startEl.value = fmt(start);
      if (endEl) endEl.value = fmt(end);
      updateDisplay();
      var bar = el(cfg.presetsId);
      if (bar) {
        bar.querySelectorAll('.mp-preset').forEach(function (b) {
          b.classList.toggle('active', presetKey && b.getAttribute('data-preset') === presetKey);
        });
      }
      var st = window[key];
      if (st) {
        st.view = new Date(start.getFullYear(), start.getMonth(), 1);
        st.pickStart = sod(start);
        st.pickEnd = sod(end);
        st.picking = false;
        paint();
      }
      if (typeof cfg.onChange === 'function') cfg.onChange(start, end);
    }
    function applyPreset(pkey) {
      var now = sod(new Date());
      var start = now, end = now;
      if (pkey === 'today') { start = end = now; }
      else if (pkey === 'yesterday') { start = new Date(now); start.setDate(now.getDate()-1); end = new Date(start); }
      else if (pkey === 'last24h') { start = new Date(now); start.setDate(now.getDate()-1); end = now; }
      else if (pkey === 'last72h') { start = new Date(now); start.setDate(now.getDate()-3); end = now; }
      else if (pkey === 'last7') { start = new Date(now); start.setDate(now.getDate()-6); end = now; }
      else if (pkey === 'thisWeek') { start = new Date(now); start.setDate(now.getDate() - now.getDay()); end = now; }
      else if (pkey === 'lastWeek') {
        end = new Date(now); end.setDate(now.getDate() - now.getDay() - 1);
        start = new Date(end); start.setDate(end.getDate() - 6);
      }
      else if (pkey === 'last30') { start = new Date(now); start.setDate(now.getDate()-29); end = now; }
      else if (pkey === 'thisMonth') { start = new Date(now.getFullYear(), now.getMonth(), 1); end = now; }
      else if (pkey === 'lastMonth') {
        start = new Date(now.getFullYear(), now.getMonth()-1, 1);
        end = new Date(now.getFullYear(), now.getMonth(), 0);
      }
      else if (pkey === 'thisQuarter') {
        var q = Math.floor(now.getMonth() / 3);
        start = new Date(now.getFullYear(), q * 3, 1); end = now;
      }
      else if (pkey === 'lastQuarter') {
        var q = Math.floor(now.getMonth() / 3);
        var sm = (q - 1) * 3;
        var sy = sm < 0 ? now.getFullYear() - 1 : now.getFullYear();
        start = new Date(sy, (sm + 12) % 12, 1);
        end = new Date(sy, ((sm + 12) % 12) + 3, 0);
      }
      else if (pkey === 'thisYear') { start = new Date(now.getFullYear(), 0, 1); end = now; }
      else if (pkey === 'lastYear') {
        start = new Date(now.getFullYear()-1, 0, 1);
        end = new Date(now.getFullYear()-1, 11, 31);
      }
      /* 单日模式：区间预设（近7天/本月/上月）取结束日作为那一天的取值，
         与"点选某一天"的语义保持一致，不会选出一个无法表达的范围。 */
      if (single) { start = end; }
      setRange(start, end, pkey);
    }
    function paintOne(daysId, titleId, year, month, rs, re) {
      var box = el(daysId), title = el(titleId);
      if (!box) return;
      if (title) title.textContent = year + '年 ' + (month + 1) + '月';
      var first = new Date(year, month, 1);
      var startPad = (first.getDay() + 6) % 7;
      var dim = new Date(year, month + 1, 0).getDate();
      var prevDim = new Date(year, month, 0).getDate();
      var today = sod(new Date());
      var html = '', i, day, d, cls;
      for (i = 0; i < 42; i++) {
        if (i < startPad) {
          day = prevDim - startPad + i + 1;
          d = new Date(year, month - 1, day);
          cls = 'mp-dp-day other';
        } else if (i >= startPad + dim) {
          day = i - startPad - dim + 1;
          d = new Date(year, month + 1, day);
          cls = 'mp-dp-day other';
        } else {
          day = i - startPad + 1;
          d = new Date(year, month, day);
          cls = 'mp-dp-day';
        }
        d = sod(d);
        if (same(d, today)) cls += ' today';
        if (rs && re && d >= rs && d <= re) cls += ' in-range';
        if (rs && same(d, rs)) cls += ' range-start';
        if (re && same(d, re)) cls += ' range-end';
        html += '<button type="button" class="' + cls + '" data-date="' + fmt(d) + '" style="outline:none;border:0;box-shadow:none">' + day + '</button>';
      }
      box.innerHTML = html;
    }
    function paint() {
      var st = window[key];
      if (!st) return;
      var y = st.view.getFullYear(), m = st.view.getMonth();
      paintOne(cfg.calDaysL, cfg.calTitleL, y, m, st.pickStart, st.pickEnd);
      /* 右日历始终渲染：它既是跨月翻页的导航，也是面板填充的来源。
         单日模式下 pickStart === pickEnd，选中态自然收成一个完整圆点。 */
      var r2 = new Date(y, m + 1, 1);
      paintOne(cfg.calDaysR, cfg.calTitleR, r2.getFullYear(), r2.getMonth(), st.pickStart, st.pickEnd);
    }
    var _panelHome = panel.parentNode;
    var _panelNext = panel.nextSibling;
    function placePanelFixed() {
      if (!panel || !trigger) return;
      /* 一律挂到 body + fixed，避免被 card/main overflow 裁切（账期点了无反应的根因） */
      if (panel.parentNode !== document.body) document.body.appendChild(panel);
      var rect = trigger.getBoundingClientRect();
      var vw = window.innerWidth || document.documentElement.clientWidth;
      var vh = window.innerHeight || document.documentElement.clientHeight;
      /* 面板宽度不超过视口，避免右侧日历被裁切 */
      var panelW = Math.min(720, vw - 24);
      var left = rect.left;
      if (left + panelW > vw - 12) left = Math.max(12, vw - panelW - 12);
      if (left < 12) left = 12;
      var spaceBelow = vh - rect.bottom - 12;
      var spaceAbove = rect.top - 12;
      var openUp = spaceBelow < 280 && spaceAbove > spaceBelow;
      var maxH = Math.max(300, Math.min(480, openUp ? spaceAbove - 6 : spaceBelow - 6));
      var top = openUp ? Math.max(12, rect.top - 6 - maxH) : rect.bottom + 4;
      panel.removeAttribute('hidden');
      panel.hidden = false;
      panel.style.setProperty('display', 'grid', 'important');
      panel.style.setProperty('grid-template-columns', '108px minmax(0, 1fr)', 'important');
      panel.style.setProperty('align-items', 'stretch', 'important');
      panel.style.setProperty('min-width', '0', 'important');
      panel.style.setProperty('background', 'linear-gradient(to right, #f5f6f8 108px, #fff 108px)', 'important');
      var presets = panel.querySelector('.mp-dp-presets');
      var main = panel.querySelector('.mp-dp-main') || panel.querySelector('.mp-dp-calendars');
      if (presets) {
        presets.style.setProperty('grid-column', '1', 'important');
        presets.style.setProperty('grid-row', '1', 'important');
        presets.style.setProperty('align-self', 'stretch', 'important');
        presets.style.setProperty('height', 'auto', 'important');
        presets.style.setProperty('min-height', '100%', 'important');
        presets.style.setProperty('width', '108px', 'important');
        presets.style.setProperty('padding', '12px 10px', 'important');
        presets.style.setProperty('background', '#f5f6f8', 'important');
      }
      if (main) {
        main.style.setProperty('grid-column', '2', 'important');
        main.style.setProperty('grid-row', '1', 'important');
        main.style.setProperty('min-width', '0', 'important');
      }
      panel.style.position = 'fixed';
      panel.style.zIndex = '50000';
      panel.style.boxSizing = 'border-box';
      panel.style.overflow = 'auto';
      panel.style.maxHeight = maxH + 'px';
      panel.style.width = panelW + 'px';
      panel.style.maxWidth = 'calc(100vw - 24px)';
      panel.style.left = left + 'px';
      panel.style.right = 'auto';
      panel.style.top = top + 'px';
      var footer = panel.querySelector('.mp-dp-footer');
      if (!footer) {
        footer = document.createElement('div');
        footer.className = 'mp-dp-footer';
        footer.innerHTML = '<button type="button" class="btn mp-dp-clear">清空</button><button type="button" class="btn mp-dp-ok">确定</button>';
        panel.appendChild(footer);
      } else if (footer.parentNode !== panel) {
        panel.appendChild(footer);
      }
      footer.style.cssText = 'display:flex;justify-content:flex-end;gap:12px;width:100%;grid-column:1 / -1;grid-row:2;background:#fff;padding:8px 12px;border-top:1px solid #f0f0f0;z-index:5;box-sizing:border-box;margin:0;position:sticky;bottom:0;';
      try {
        document.querySelectorAll('.bubble-menu.is-open, .bubble.open').forEach(function (el) {
          el.classList.remove('is-open', 'open');
        });
      } catch (eB) {}
    }
    function _onScrollOrResize() {
      /* 选区进行中不关闭；仅重定位，避免只选了开始日因滚动被关掉 */
      if (!root.classList.contains('open')) return;
      if (window[key] && window[key].picking) {
        placePanelFixed();
        return;
      }
      close();
    }
    function open() {
      /* 从已有值恢复选区高亮，保证再次打开仍显示起止 */
      var s0 = startEl ? parseD(startEl.value) : null;
      var e0 = endEl ? parseD(endEl.value) : null;
      if (s0) {
        window[key].pickStart = sod(s0);
        window[key].pickEnd = e0 ? sod(e0) : sod(s0);
        /* 只选了一天时保持 picking，下一次点击作为结束日 */
        window[key].picking = !e0 || same(sod(s0), sod(e0));
        window[key].view = new Date(s0.getFullYear(), s0.getMonth(), 1);
      } else {
        window[key].picking = false;
      }
      root.classList.add('open');
      if (trigger) trigger.setAttribute('aria-expanded', 'true');
      paint();
      placePanelFixed();
      if (panel) panel.classList.add('mp-dp-portal');
      requestAnimationFrame(function () { placePanelFixed(); });
      window.addEventListener('scroll', _onScrollOrResize, true);
      window.addEventListener('resize', _onScrollOrResize);
    }
    function close() {
      root.classList.remove('open');
      if (trigger) trigger.setAttribute('aria-expanded', 'false');
      window.removeEventListener('scroll', _onScrollOrResize, true);
      window.removeEventListener('resize', _onScrollOrResize);
      if (panel) {
        panel.classList.remove('mp-dp-portal');
        panel.hidden = true;
        panel.setAttribute('hidden', '');
        panel.style.display = '';
        panel.style.position = '';
        panel.style.top = '';
        panel.style.left = '';
        panel.style.right = '';
        panel.style.width = '';
        panel.style.maxWidth = '';
        panel.style.zIndex = '';
        panel.style.visibility = '';
        if (_panelHome && panel.parentNode !== _panelHome) {
          if (_panelNext && _panelNext.parentNode === _panelHome) _panelHome.insertBefore(panel, _panelNext);
          else _panelHome.appendChild(panel);
        }
      }
    }
    var now = sod(new Date());
    var prev = window[key] || {};
    window[key] = {
      bound: true,
      view: prev.view || new Date(now.getFullYear(), now.getMonth(), 1),
      pickStart: prev.pickStart || null,
      pickEnd: prev.pickEnd || null,
      picking: !!prev.picking,
      __docCloser: prev.__docCloser || null
    };
    if (root) root.setAttribute('data-dp-bound', '1');
    window[key].open = open;
    window[key].close = close;
    window[key].paint = paint;
    if (trigger) {
      trigger.disabled = false;
      trigger.removeAttribute('disabled');
      trigger.style.pointerEvents = 'auto';
      trigger.style.cursor = 'pointer';
      /* 统一只用 onclick，避免重复监听导致点一次开又关 */
      trigger.onclick = function (e) {
        e.preventDefault();
        e.stopPropagation();
        if (root.classList.contains('open')) close(); else open();
      };
      trigger.__dpClick = true;
    }
    if (!panel.__dpClickBound) {
      panel.__dpClickBound = true;
      panel.addEventListener('mousedown', function (e) { e.stopPropagation(); });
      panel.addEventListener('click', function (e) {
      var ok = e.target.closest && e.target.closest('.mp-dp-ok, [id$="DpOk"]');
      var clear = e.target.closest && e.target.closest('[id$="DpClear"], .mp-dp-clear');
      if (ok) {
        e.preventDefault();
        e.stopPropagation();
        close();
        return;
      }
      if (clear) {
        e.preventDefault();
        e.stopPropagation();
        if (startEl) startEl.value = '';
        if (endEl) endEl.value = '';
        window[key].picking = false;
        window[key].pickStart = null;
        window[key].pickEnd = null;
        if (display) {
          display.textContent = cfg.placeholder || '请选择日期范围';
          display.classList.add('is-placeholder');
        }
        var bar = el(cfg.presetsId);
        if (bar) bar.querySelectorAll('.mp-preset.active').forEach(function (b) { b.classList.remove('active'); });
        paint();
        close();
        return;
      }
      e.stopPropagation();
      var nav = e.target.closest && e.target.closest('.mp-dp-nav');
      if (nav) {
        var act = nav.getAttribute('data-nav') || '';
        var v = window[key].view;
        /* 左右月历导航（含 -r 后缀） */
        if (act === 'prev-month' || act === 'prev-month-r') window[key].view = new Date(v.getFullYear(), v.getMonth() - 1, 1);
        if (act === 'next-month' || act === 'next-month-r') window[key].view = new Date(v.getFullYear(), v.getMonth() + 1, 1);
        if (act === 'prev-year' || act === 'prev-year-r') window[key].view = new Date(v.getFullYear() - 1, v.getMonth(), 1);
        if (act === 'next-year' || act === 'next-year-r') window[key].view = new Date(v.getFullYear() + 1, v.getMonth(), 1);
        paint();
        return;
      }
      var dayBtn = e.target.closest && e.target.closest('.mp-dp-day');
      if (dayBtn && dayBtn.getAttribute('data-date')) {
        e.preventDefault();
        e.stopPropagation();
        if (dayBtn.blur) dayBtn.blur();
        var d = sod(parseD(dayBtn.getAttribute('data-date')));
        if (!d || isNaN(d.getTime())) return;
        /* 单日模式：一次点击即完成 */
        if (single) {
          window[key].picking = false;
          setRange(d, d, null);
          /* 不自动关闭，等待「确定」或「清空」 */
          return;
        }
        /* 区间模式：第一次选开始，第二次选结束；未完成前不关闭面板 */
        if (!window[key].picking || !window[key].pickStart) {
          window[key].pickStart = d;
          window[key].pickEnd = d;
          window[key].picking = true;
          if (startEl) startEl.value = fmt(d);
          if (endEl) endEl.value = fmt(d);
          paint();
          if (display) {
            display.textContent = fmtCN(d) + '  →  请选择结束日期';
            display.classList.remove('is-placeholder');
          }
        } else {
          var a = window[key].pickStart, b = d;
          if (b.getTime() < a.getTime()) { var t0 = a; a = b; b = t0; }
          window[key].picking = false;
          window[key].pickStart = a;
          window[key].pickEnd = b;
          setRange(a, b, null);
          /* 区间选完不自动关闭，等待「确定」或「清空」 */
        }
      }
    });
    }
    var presets = el(cfg.presetsId);
    if (presets) {
      presets.addEventListener('click', function (e) {
        var b = e.target.closest && e.target.closest('.mp-preset');
        if (!b) return;
        e.preventDefault();
        e.stopPropagation();
        applyPreset(b.getAttribute('data-preset'));
        window[key].picking = false;
        /* 预设不自动关闭 */
      });
    }
    /* 「确定」「清空」显式关闭 */
    if (panel && !panel.__footerBound) {
      panel.__footerBound = true;
      panel.addEventListener('click', function (e) {
        var ok = e.target.closest && e.target.closest('.mp-dp-ok, [id$="DpOk"]');
        var clear = e.target.closest && e.target.closest('[id$="DpClear"], .mp-dp-clear');
        if (ok) {
          e.preventDefault();
          e.stopPropagation();
          close();
          return;
        }
        if (clear) {
          e.preventDefault();
          e.stopPropagation();
          if (startEl) startEl.value = '';
          if (endEl) endEl.value = '';
          window[key].picking = false;
          window[key].pickStart = null;
          window[key].pickEnd = null;
          if (display) {
            display.textContent = cfg.placeholder || '请选择日期范围';
            display.classList.add('is-placeholder');
          }
          var bar = el(cfg.presetsId);
          if (bar) bar.querySelectorAll('.mp-preset.active').forEach(function (b) { b.classList.remove('active'); });
          paint();
          close();
        }
      });
    }

    /* 捕获阶段外部关闭已禁用：仅「确定」「清空」关闭面板 */
    function docCloser(e) {
      if (!root || !root.classList.contains('open')) return;
      var t = e.target;
      if (root.contains(t)) return;
      if (panel && panel.contains(t)) return;
      if (trigger && trigger.contains(t)) return;
      /* 区间选择进行中：忽略外部点击，避免只选了开始日就被关掉 */
      if (window[key] && window[key].picking) return;
      close();
    }
    /* 仅通过「确定」「清空」关闭，外部点击不退出 */
    window[key].__docCloser = null;
    /* document.addEventListener('mousedown', docCloser, true); */
    if (!startEl || !startEl.value) {
      if (cfg.defaultPreset) applyPreset(cfg.defaultPreset);
      else updateDisplay();
    } else updateDisplay();
  }
  window.bindSharedDatePicker = bindSharedDatePicker;

  /* —— Excel 解析 —— */
  function readSheetAoa(file) {
    return new Promise(function (resolve, reject) {
      if (typeof XLSX === 'undefined') {
        reject(new Error('Excel 解析库未加载，请刷新页面后重试'));
        return;
      }
      var reader = new FileReader();
      reader.onload = function (e) {
        try {
          var data = new Uint8Array(e.target.result);
          var wb = XLSX.read(data, { type: 'array', raw: true, cellDates: true });
          if (!wb.SheetNames || !wb.SheetNames.length) {
            reject(new Error('文件中没有工作表：' + (file.name || '')));
            return;
          }
          var sheet = wb.Sheets[wb.SheetNames[0]];
          var aoa = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: true, blankrows: false });
          resolve({ name: file.name || '', aoa: aoa || [] });
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = function () { reject(new Error('读取文件失败：' + (file.name || ''))); };
      reader.readAsArrayBuffer(file);
    });
  }

  function detectSheetKind(headers, fileName) {
    var h = headers.map(normalizeHeader).join('|');
    var fn = String(fileName || '');
    if (/经营报表|p位汇总|按p位/.test(fn) || (/净入币|总入币/.test(h) && /端口/.test(h))) return 'ops_report';
    if (/投币数/.test(h) && /出礼品价值|成本比例/.test(h) && !/总入币|项目编号/.test(h)) return 'profit';
    if (/毛利/.test(fn) && /投币数/.test(h)) return 'profit';
    if (/返奖|礼品概率|按端口汇总记录/.test(fn) || (/出礼品价值/.test(h) && /端口/.test(h) && /入币/.test(h) && !/净入币|总入币|投币数/.test(h))) return 'reward';
    if (/运营参数/.test(fn) || (/运营参数|机台类型/.test(h) && !/投币|入币/.test(h))) return 'ops';
    if (/出礼品|返奖/.test(h)) return 'reward';
    if (/投币|入币/.test(h)) return 'ops_report';
    return 'unknown';
  }

  function inferTypeFromName(name) {
    var n = String(name || '');
    if (/卡牌|战卡|光辉|共斗|变身|幻战|明耀|三国/.test(n)) return '卡牌机';
    if (/零食|大乱斗/.test(n)) return '零食爪机';
    if (/剪刀|勾勾|捞鱼|绘本|马戏团/.test(n)) return '玩法机';
    if (/娃娃|爪|玲珑|方舟|飞跃|先行者|盒子/.test(n)) return '爪机';
    if (/礼享|无尽|元气|酷玩|无双/.test(n)) return '礼品机';
    return '';
  }

  /* 精确匹配表头，避免「出礼品」误命中「出礼品价值」 */
  function findColExact(headers, keys) {
    var i, j, h, k;
    for (j = 0; j < keys.length; j++) {
      k = String(keys[j]).toLowerCase().replace(/\s+/g, '').replace(/\(元\)/g, '');
      for (i = 0; i < headers.length; i++) {
        h = normalizeHeader(headers[i]);
        if (h === k) return i;
      }
    }
    return -1;
  }

  function mapRowsFromAoa(aoa, kind) {
    if (!aoa || aoa.length < 2) return [];
    var headers = aoa[0];
    var exact = (kind === 'profit');
    var find = exact ? findColExact : findCol;
    var iCode = find(headers, ['项目编号', '编号', '机台编号', '项目号', 'code', '机器编号']);
    var iPort = find(headers, ['端口', 'P位', 'p位', '机位', 'port']);
    var iName = find(headers, exact
      ? ['项目', '机台名称', '项目名称']
      : ['项目', '机台名称', '项目名称', '名称', '机台', 'name']);
    var iType = find(headers, ['机台类型', '类型', '项目类型', 'type']);
    var iCoins = find(headers, exact
      ? ['投币数']
      : ['投币数', '净入币', '净入币数', '总入币', '总入币数', '入币数', '入币', '投币', '投币次数', 'coins']);
    var iGifts = find(headers, exact ? ['出礼品数'] : ['出礼品数', '出礼品数量', '出礼品', '礼品数', '返奖数', 'gifts']);
    var iCount = find(headers, exact ? ['盘点数'] : ['盘点数', '盘点']);
    var iGiftVal = find(headers, ['出礼品价值(元)', '出礼品价值', '礼品价值']);
    var iCoinVal = find(headers, exact ? ['投币营收'] : ['投币营收', '入币预估价值', '营收', '收入']);
    var iCoinUnit = find(headers, ['币值']);
    var iCostRate = find(headers, ['成本比例']);
    var iDate = find(headers, ['日期', '营业日期', '账期', 'date', '统计日期']);
    var list = [];
    var namePortCounter = Object.create(null);
    var coinUnitDefault = COIN_VALUE_DEFAULT;

    for (var r = 1; r < aoa.length; r++) {
      var row = aoa[r];
      if (!row || !row.length) continue;
      var name = iName >= 0 ? String(row[iName] != null ? row[iName] : '').trim() : '';
      if (!name || name === '合计' || name === '总营收' || name === '总成本' || name === '毛比例') continue;
      if (/^合计|总营收|总成本/.test(name)) continue;

      var code = iCode >= 0 ? normCode(row[iCode]) : '';
      /* 编号缺失时用完整项目名作 code，不再去掉括号（避免名称变残缺） */
      if (!code) code = String(name).trim();
      var port;
      if (iPort >= 0 && String(row[iPort] || '').trim()) {
        port = normPort(row[iPort]);
      } else {
        namePortCounter[name] = (namePortCounter[name] || 0) + 1;
        port = namePortCounter[name] + 'P';
      }

      var type = iType >= 0 ? String(row[iType] || '').trim() : '';
      if (!type) type = inferTypeFromName(name);
      var coins = iCoins >= 0 ? num(row[iCoins]) : 0;
      var gifts = iGifts >= 0 ? num(row[iGifts]) : 0;
      var count = iCount >= 0 ? num(row[iCount]) : 0;
      var giftVal = iGiftVal >= 0 ? num(row[iGiftVal]) : 0;
      var coinRev = iCoinVal >= 0 ? num(row[iCoinVal]) : 0;
      var unit = iCoinUnit >= 0 ? num(row[iCoinUnit]) : 0;
      if (unit > 0) coinUnitDefault = unit;
      /* 投币营收多为公式，解析不到时用 投币数×币值 回填 */
      if (!coinRev && coins) {
        coinRev = Math.round(coins * (unit > 0 ? unit : coinUnitDefault) * 10000) / 10000;
      }
      var costRate = iCostRate >= 0 ? num(row[iCostRate]) : null;
      var dt = iDate >= 0 ? parseDate(row[iDate]) : null;

      /* 保留有项目名的行（含全 0），保证与源表行数一致 */
      list.push({
        kind: kind,
        code: code,
        port: port,
        name: name,
        type: type,
        coins: coins,
        gifts: gifts,
        count: count,
        giftValue: giftVal,
        coinRevenue: coinRev,
        coinUnit: unit > 0 ? unit : coinUnitDefault,
        costRate: costRate,
        date: dt
      });
    }
    return list;
  }

  function mergeImported(parts) {
    var period = periodDate();
    var hasProfit = parts.some(function (p) { return p.kind === 'profit'; });
    var hasOps = parts.some(function (p) { return p.kind === 'ops_report'; });
    var hasReward = parts.some(function (p) { return p.kind === 'reward'; });

    function keyOf(r) {
      if (r.code) return String(r.code) + '|' + (r.port || '1P');
      return (r.name || '') + '|' + (r.port || '1P');
    }
    function finish(r) {
      /* 规则：投币营收 = 投币数 × 0.33（等价源表数组公式 {=B2:Bn*0.33}） */
      r.coinUnit = COIN_VALUE_DEFAULT;
      r.coinRevenue = Math.round((Number(r.coins) || 0) * COIN_VALUE_DEFAULT * 10000) / 10000;
      r.profit = (r.coinRevenue || 0) - (Number(r.giftValue) || 0);
      r.dateKey = r.date ? fmtDate(r.date) : fmtDate(period);
      if (r.count == null || r.count === '') r.count = 0;
      return r;
    }

    /* 仅上传毛利终表：原样汇总 */
    if (hasProfit && !hasOps && !hasReward) {
      var mapP = Object.create(null);
      var orderP = [];
      parts.forEach(function (p) {
        (p.rows || []).forEach(function (r) {
          var k = keyOf(r);
          if (!mapP[k]) {
            mapP[k] = {
              code: r.code, port: r.port || '1P', name: r.name || r.code, type: r.type || '',
              coins: 0, gifts: 0, count: 0, giftValue: 0, date: r.date || period
            };
            orderP.push(k);
          }
          var t = mapP[k];
          t.coins += r.coins || 0;
          t.gifts += r.gifts || 0;
          t.count += (r.count != null ? r.count : 0);
          t.giftValue += r.giftValue || 0;
          if (r.type) t.type = r.type;
          if (r.name && (!t.name || r.name.length > t.name.length)) t.name = r.name;
        });
      });
      return orderP.map(function (k) {
        var r = mapP[k];
        return finish(r);
      });
    }

    /*
     * 核心整合规则（经营报表 + 礼品返奖概率按端口汇总记录）：
     * 1. 盘点数         = 返奖表「出礼品数」
     * 2. 出礼品价值(元) = 返奖表「出礼品价值(元)」
     * 3. 投币营收       = 投币数 × 0.33
     * 4. 投币数         = 经营报表「净入币」（毛利表投币数/总入币口径）
     * 5. 出礼品数       = 经营报表「出礼品数」
     * 合并键：项目编号 + 端口
     */
    var map = Object.create(null);
    var order = [];
    function ensure(r) {
      var k = keyOf(r);
      if (!map[k]) {
        map[k] = {
          code: r.code || '',
          port: r.port || '1P',
          name: r.name || r.code || '',
          type: r.type || '',
          coins: 0,
          gifts: 0,
          count: 0,
          giftValue: 0,
          date: r.date || period,
          _hasReward: false
        };
        order.push(k);
      }
      var t = map[k];
      if (r.name && (!t.name || r.name.length > String(t.name).length)) t.name = r.name;
      if (r.type) t.type = r.type;
      if (r.code && !t.code) t.code = r.code;
      if (r.date) t.date = r.date;
      return t;
    }

    /* 有经营+返奖时，忽略同批上传的毛利终表，避免重复累加 */
    parts.forEach(function (p) {
      if (hasOps && hasReward && p.kind === 'profit') return;
      (p.rows || []).forEach(function (r) {
        var t = ensure(r);
        if (p.kind === 'ops_report') {
          t.coins += Number(r.coins) || 0;
          t.gifts += Number(r.gifts) || 0;
        } else if (p.kind === 'reward') {
          /* 盘点数 = 返奖出礼品数；出礼品价值 = 返奖出礼品价值 */
          t.count = Number(r.gifts) || 0;
          t.giftValue = Number(r.giftValue) || 0;
          t._hasReward = true;
        } else if (p.kind === 'ops') {
          if (r.type) t.type = r.type;
          if (r.name) t.name = r.name;
        } else {
          t.coins += Number(r.coins) || 0;
          t.gifts += Number(r.gifts) || 0;
          if (r.count) t.count = Number(r.count) || 0;
          if (r.giftValue) t.giftValue = Number(r.giftValue) || 0;
        }
      });
    });

    return order.map(function (k) { return finish(map[k]); });
  }

  function updateImportMeta() {
    var meta = $('mpImportMeta');
    var clr = $('mpBtnClear');
    var preview = $('mpImportPreview');
    var body = $('mpImportPreviewBody');
    var pagerEl = $('mpImportPager');
    if (meta) meta.textContent = rows.length ? ('已导入 ' + rows.length + ' 条机台数据') : '尚未导入';
    if (clr) clr.style.display = rows.length ? '' : 'none';
    if (!rows.length) {
      if (preview) preview.style.display = 'none';
      if (pagerEl) pagerEl.style.display = 'none';
      if (body) body.innerHTML = '';
      return;
    }
    if (preview) preview.style.display = '';
    function rowHtml(r, idx) {
      return '<tr>' +
        '<td>' + escapeHtml(r.type || '—') + '</td>' +
        '<td title="' + escapeHtml(r.name) + '">' + escapeHtml(r.name || r.code) + '</td>' +
        '<td>' + escapeHtml(r.port) + '</td>' +
        '<td class="num">' + (r.coins || 0) + '</td>' +
        '<td class="num">' + (r.gifts || 0) + '</td>' +
        '<td class="num">' + (r.count || r.gifts || 0) + '</td>' +
        '<td class="num">' + money(r.coinRevenue) + '</td>' +
        '<td class="num">' + money(r.giftValue) + '</td>' +
        '<td class="num">' + money(r.profit) + '</td>' +
        '</tr>';
    }
    if (typeof createPager === 'function' && pagerEl) {
      pagerEl.style.display = '';
      if (!importPager) {
        importPager = createPager(pagerEl, {
          pageSize: 20,
          getData: function () { return rows; },
          onPage: function (pageRows, page, size) {
            var base = ((page || 1) - 1) * (size || 20);
            if (body) body.innerHTML = pageRows.map(function (r, i) { return rowHtml(r, base + i); }).join('');
          }
        });
      }
      if (importPager.reset) importPager.reset();
      else if (importPager.draw) importPager.draw();
    } else if (body) {
      body.innerHTML = rows.slice(0, 100).map(function (r, i) { return rowHtml(r, i); }).join('');
    }
  }

  function aggregate(mode) {
    /* 最终毛利表：按 项目+端口 汇总；展示用序号而非周次 */
    var bucket = Object.create(null);
    var order = [];
    rows.forEach(function (r) {
      var k = (r.code ? (r.code + '|' + (r.port || '1P')) : ((r.name || '') + '|' + (r.port || '1P')));
      if (!bucket[k]) {
        bucket[k] = {
          code: r.code,
          port: r.port || '1P',
          name: r.name,
          type: r.type,
          coins: 0,
          gifts: 0,
          count: 0,
          coinRevenue: 0,
          giftValue: 0,
          profit: 0
        };
        order.push(k);
      }
      var b = bucket[k];
      b.coins += r.coins || 0;
      b.gifts += r.gifts || 0;
      b.count += r.count != null ? r.count : (r.gifts || 0);
      b.coinRevenue += r.coinRevenue || 0;
      b.giftValue += r.giftValue || 0;
      b.profit += r.profit != null ? r.profit : ((r.coinRevenue || 0) - (r.giftValue || 0));
      if (r.name) b.name = r.name;
      if (r.type) b.type = r.type;
    });
    return order.map(function (k) { return bucket[k]; });
  }

  function renderTable(bodyId, hintId, mode) {
    var body = $(bodyId);
    var hint = $(hintId);
    var list = aggregate(mode);
    if (hint) {
      hint.textContent = rows.length
        ? ('共 ' + list.length + ' 条汇总')
        : '请先在「数据源导入」中导入毛利表';
    }
    if (!body) return;
    var pagerId = mode === 'month' ? 'mpMonthPager' : 'mpWeekPager';
    var pagerEl = $(pagerId);
    function rowHtml(r, idx) {
      var rate = r.coinRevenue ? (r.profit / r.coinRevenue) : 0;
      return '<tr>' +
        '<td class="num">' + (idx + 1) + '</td>' +
        '<td>' + escapeHtml(r.type || '—') + '</td>' +
        '<td title="' + escapeHtml(r.name) + '">' + escapeHtml(r.name || r.code) + '</td>' +
        '<td>' + escapeHtml(r.port) + '</td>' +
        '<td class="num">' + (r.coins || 0) + '</td>' +
        '<td class="num">' + (r.gifts || 0) + '</td>' +
        '<td class="num">' + (r.count != null ? r.count : (r.gifts || 0)) + '</td>' +
        '<td class="num">' + money(r.coinRevenue) + '</td>' +
        '<td class="num">' + money(r.giftValue) + '</td>' +
        '<td class="num">' + money(r.profit) + '</td>' +
        '<td class="num">' + pct(rate) + '</td>' +
        '</tr>';
    }
    if (!list.length) {
      body.innerHTML = '<tr><td colspan="11" class="empty-cell">' + (rows.length ? '当前账期无数据' : '暂无数据，请先导入毛利表') + '</td></tr>';
      if (pagerEl) pagerEl.style.display = 'none';
      return;
    }
    if (typeof createPager === 'function' && pagerEl) {
      pagerEl.style.display = '';
      var pagerRef = mode === 'month' ? 'monthPager' : 'weekPager';
      if (!window.__mpPagers) window.__mpPagers = {};
      if (!window.__mpPagers[pagerRef]) {
        window.__mpPagers[pagerRef] = createPager(pagerEl, {
          pageSize: 20,
          getData: function () { return aggregate(mode); },
          onPage: function (pageRows, page, size) {
            var base = ((page || 1) - 1) * (size || 20);
            body.innerHTML = pageRows.map(function (r, i) { return rowHtml(r, base + i); }).join('');
          }
        });
      }
      var pg = window.__mpPagers[pagerRef];
      if (pg.reset) pg.reset();
      else if (pg.draw) pg.draw();
    } else {
      body.innerHTML = list.map(function (r, idx) { return rowHtml(r, idx); }).join('');
      if (pagerEl) pagerEl.style.display = 'none';
    }
  }

  function exportProfit(mode) {
    var list = aggregate(mode);
    if (!list.length) {
      if (typeof toast === 'function') toast('暂无数据可导出', 'warning');
      return;
    }

    /*
     * 完全对齐上传毛利终表样式：
     * - 投币数/出礼品数表头: theme accent5 tint 0.6 → 浅蓝
     * - 盘点数/出礼品价值表头: theme lt2 tint 0.6 → 浅米
     * - 出礼局数/投币营收/成本比例: theme lt1 tint -0.15 → 浅灰（含表头与数据）
     * - 投币营收: 数组公式 {=Bn:Bm*0.33}
     */
    function themeFill(theme, tint) {
      var o = { type: 'pattern', pattern: 'solid', fgColor: { theme: theme } };
      if (tint != null) o.fgColor.tint = tint;
      o.bgColor = { indexed: 64 };
      return o;
    }
    var FILL_GRAY = themeFill(0, -0.15);   /* 出礼局数、投币营收、成本比例 */
    var FILL_BLUE = themeFill(8, 0.6);    /* 投币数、出礼品数 表头 */
    var FILL_CREAM = themeFill(3, 0.6);   /* 盘点数、出礼品价值 表头 */
    var thinBorder = {
      top: { style: 'thin', color: { argb: 'FFB0B0B0' } },
      left: { style: 'thin', color: { argb: 'FFB0B0B0' } },
      bottom: { style: 'thin', color: { argb: 'FFB0B0B0' } },
      right: { style: 'thin', color: { argb: 'FFB0B0B0' } }
    };

    function finishExport(wb, tag) {
      wb.xlsx.writeBuffer().then(function (buf) {
        var blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        var a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = tag + '_' + new Date().toISOString().slice(0, 10) + '.xlsx';
        document.body.appendChild(a);
        a.click();
        setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 800);
        if (typeof toast === 'function') toast('已按毛利终表样式导出', 'success');
      }).catch(function (e) {
        console.error(e);
        if (typeof toast === 'function') toast('导出失败', 'error');
      });
    }

    if (typeof ExcelJS === 'undefined') {
      if (typeof toast === 'function') toast('ExcelJS 未加载', 'error');
      return;
    }

    var wb = new ExcelJS.Workbook();
    var ws = wb.addWorksheet('毛利表', { views: [{ state: 'frozen', ySplit: 1 }] });
    /* 与源表一致：8 列（不含币值） */
    var headers = ['项目', '投币数', '出礼品数', '盘点数', '出礼局数', '投币营收', '出礼品价值(元)', '成本比例'];
    ws.addRow(headers);

    var n = list.length;
    var lastRow = n + 1;
    var prevName = '';
    var alt = false;

    list.forEach(function (r, i) {
      var rowNum = i + 2;
      var coins = r.coins || 0;
      var gifts = r.gifts || 0;
      var count = r.count != null ? r.count : 0;
      var giftVal = r.giftValue || 0;
      var name = r.name || r.code || '';
      ws.addRow([name, coins, gifts, count, null, null, giftVal, null]);

      /* 出礼局数 */
      ws.getCell('E' + rowNum).value = { formula: 'B' + rowNum + '/C' + rowNum + '/4' };
      /* 成本比例 */
      ws.getCell('H' + rowNum).value = { formula: '(F' + rowNum + '-G' + rowNum + ')/F' + rowNum };
      /* 投币营收：逐行数组公式，与源表 {=Bn:Bm*0.33} 一致 */
      ws.getCell('F' + rowNum).value = {
        formula: 'B' + rowNum + ':B' + lastRow + '*0.33',
        shareType: 'array',
        ref: 'F' + rowNum
      };
    });

    /* —— 全表样式（写值之后统一套用，确保成本比例有填充） —— */
    function apply(addr, fill, numFmt, font) {
      var cell = ws.getCell(addr);
      if (fill) cell.fill = fill;
      if (numFmt) cell.numFmt = numFmt;
      if (font) cell.font = font;
      cell.border = thinBorder;
    }

    var fontHeader = { name: 'Arial', size: 10, bold: true };
    var fontData = { name: 'Arial', size: 10 };

    /* 表头填充 */
    apply('A1', null, null, fontHeader);
    apply('B1', FILL_BLUE, null, fontHeader);
    apply('C1', FILL_BLUE, null, fontHeader);
    apply('D1', FILL_CREAM, null, fontHeader);
    apply('E1', FILL_GRAY, null, fontHeader);
    apply('F1', FILL_GRAY, null, fontHeader);
    apply('G1', FILL_CREAM, null, fontHeader);
    apply('H1', FILL_GRAY, null, fontHeader); /* 成本比例表头浅灰 */

    for (var r = 2; r <= lastRow; r++) {
      apply('A' + r, null, null, fontData);
      apply('B' + r, null, '0', fontData);
      apply('C' + r, null, '0.00', fontData);
      apply('D' + r, null, '0', fontData);
      apply('E' + r, FILL_GRAY, '0', fontData);           /* 出礼局数 */
      apply('F' + r, FILL_GRAY, '0.00_);[Red]\\(0.00\\)', fontData); /* 投币营收 */
      apply('G' + r, null, '0.00', fontData);
      apply('H' + r, FILL_GRAY, '0.00%', fontData);
    }

    ws.getColumn(1).width = 42;
    ws.getColumn(2).width = 10;
    ws.getColumn(3).width = 10;
    ws.getColumn(4).width = 10;
    ws.getColumn(5).width = 12;
    ws.getColumn(6).width = 12;
    ws.getColumn(7).width = 14;
    ws.getColumn(8).width = 12;

    /*
     * 成本比例条件格式（对齐上传毛利终表 H2:H119）：
     *   < 0.4 → 绿底 #00B050
     *   > 0.8 → 红底 #FFC7CE + 红字 #9C0006
     *   中间区间保持浅灰底
     */
    if (n > 0) {
      ws.addConditionalFormatting({
        ref: 'H2:H' + lastRow,
        rules: [
          {
            type: 'cellIs',
            operator: 'lessThan',
            formulae: [0.4],
            priority: 1,
            style: {
              fill: {
                type: 'pattern',
                pattern: 'solid',
                bgColor: { argb: 'FF00B050' }
              }
            }
          },
          {
            type: 'cellIs',
            operator: 'greaterThan',
            formulae: [0.8],
            priority: 2,
            style: {
              fill: {
                type: 'pattern',
                pattern: 'solid',
                bgColor: { argb: 'FFFFC7CE' }
              },
              font: { color: { argb: 'FF9C0006' } }
            }
          }
        ]
      });
    }

    finishExport(wb, mode === 'month' ? '月毛利' : '周毛利');
  }

  function downloadTemplate() {
    if (typeof XLSX === 'undefined') {
      if (typeof toast === 'function') toast('Excel 库未加载', 'error');
      return;
    }
    var wb = XLSX.utils.book_new();
    var profit = [
      ['项目', '投币数', '出礼品数', '盘点数', '出礼局数', '投币营收', '出礼品价值(元)', '成本比例', '币值'],
      ['示例爪机1号', 445, 10, 9, 13.6, 146.85, 41.99, 0.71, 0.33],
      ['示例爪机1号', 545, 12, 10, 14.2, 179.85, 50.2, 0.72, 0.33],
      ['示例礼品机A', 971, 4, 14, 60.7, 320.43, 26.33, 0.92, 0.33]
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(profit), '毛利表');
    XLSX.writeFile(wb, '机台毛利表模板.xlsx');
    if (typeof toast === 'function') toast('模板已下载', 'success');
  }

  var sourceParts = { ops_report: null, reward: null, profit: null };
  function currentParts() {
    return ['ops_report', 'reward', 'profit'].map(function (k) { return sourceParts[k]; }).filter(Boolean);
  }
  function markUploadStatus() {
    var ops = $('mpOpsStatus');
    var reward = $('mpRewardStatus');
    var opsCard = $('mpUploadOps');
    var rewardCard = $('mpUploadReward');
    if (ops) ops.textContent = sourceParts.ops_report ? ('已上传 ' + sourceParts.ops_report.rows.length + ' 行') : '未上传';
    if (reward) reward.textContent = sourceParts.reward ? ('已上传 ' + sourceParts.reward.rows.length + ' 行') : '未上传';
    if (opsCard) opsCard.classList.toggle('is-ready', !!sourceParts.ops_report);
    if (rewardCard) rewardCard.classList.toggle('is-ready', !!sourceParts.reward);
  }
  function handleFiles(fileList, forcedKind) {
    var files = Array.prototype.slice.call(fileList || []).filter(function (f) {
      return f && /\.(xlsx|xls|csv)$/i.test(f.name || '');
    });
    if (!files.length) {
      if (typeof toast === 'function') toast('请选择 .xlsx / .xls / .csv 文件', 'warning');
      return;
    }
    if (typeof toast === 'function') toast('正在解析…', 'info');
    Promise.all(files.map(function (f) { return readSheetAoa(f); }))
      .then(function (sheets) {
        var unknown = [];
        sheets.forEach(function (s) {
          if (!s.aoa || s.aoa.length < 2) {
            unknown.push(s.name + '（空表）');
            return;
          }
          var aoa = s.aoa || [];
          var headerAt = 0;
          for (var hi = 0; hi < Math.min(6, aoa.length); hi++) {
            var joined = (aoa[hi] || []).map(normalizeHeader).join('|');
            if (/项目编号|端口|净入币|总入币|投币数|出礼品价值|出礼品数/.test(joined)) { headerAt = hi; break; }
          }
          var headers = aoa[headerAt] || [];
          var body = aoa.slice(headerAt);
          var kind = forcedKind || detectSheetKind(headers, s.name);
          if (kind === 'unknown') kind = forcedKind || 'ops_report';
          var mapped = mapRowsFromAoa(body, kind);
          if (!mapped.length) {
            unknown.push(s.name + '（未识别到有效行）');
            return;
          }
          sourceParts[kind] = { kind: kind, name: s.name, rows: mapped };
        });
        var parts = currentParts();
        if (!parts.length) {
          if (typeof toast === 'function') toast('未能解析出有效数据，请检查表头', 'error');
          return;
        }
        var merged = mergeImported(parts);
        rows = merged;
        save();
        markUploadStatus();
        updateImportMeta();
        renderTable('mpWeekBody', 'mpWeekHint', 'week');
        renderTable('mpMonthBody', 'mpMonthHint', 'month');
        var msg = '已合并 ' + merged.length + ' 条';
        if (unknown.length) msg += '；跳过：' + unknown.join('、');
        if (typeof toast === 'function') toast(msg, 'success');
      })
      .catch(function (err) {
        if (typeof toast === 'function') toast((err && err.message) || '导入失败', 'error');
      });
  }

    function bindUpload() {
    function bindZone(areaId, inputId, kind) {
      var area = $(areaId);
      var input = $(inputId);
      if (!area || !input || area.__bound) return;
      area.__bound = true;
      area.addEventListener('click', function () { input.click(); });
      input.addEventListener('change', function (e) {
        if (e.target.files && e.target.files.length) handleFiles(e.target.files, kind);
        e.target.value = '';
      });
      area.addEventListener('dragover', function (e) {
        e.preventDefault();
        area.classList.add('dragover');
      });
      area.addEventListener('dragleave', function () { area.classList.remove('dragover'); });
      area.addEventListener('drop', function (e) {
        e.preventDefault();
        area.classList.remove('dragover');
        if (e.dataTransfer.files && e.dataTransfer.files.length) handleFiles(e.dataTransfer.files, kind);
      });
    }
    bindDatePicker();
    if ($('mpPeriodStart') && !$('mpPeriodStart').value) applyPreset('last7');
    else updatePeriodDisplay();
    bindZone('mpUploadOps', 'mpExcelOps', 'ops_report');
    bindZone('mpUploadReward', 'mpExcelReward', 'reward');
    var tpl = $('mpBtnTemplate');
    if (tpl && !tpl.__bound) {
      tpl.__bound = true;
      tpl.addEventListener('click', downloadTemplate);
    }
    var wex = $('mpWeekExport');
    if (wex && !wex.__bound) {
      wex.__bound = true;
      wex.addEventListener('click', function () { exportProfit('week'); });
    }
    var mex = $('mpMonthExport');
    if (mex && !mex.__bound) {
      mex.__bound = true;
      mex.addEventListener('click', function () { exportProfit('month'); });
    }
    var clr = $('mpBtnClear');
    if (clr && !clr.__bound) {
      clr.__bound = true;
      clr.addEventListener('click', function () {
        rows = [];
        sourceParts.ops_report = null;
        sourceParts.reward = null;
        sourceParts.profit = null;
        markUploadStatus();
        save();
        updateImportMeta();
        renderTable('mpWeekBody', 'mpWeekHint', 'week');
        renderTable('mpMonthBody', 'mpMonthHint', 'month');
        if (typeof toast === 'function') toast('已清空机台数据源', 'success');
      });
    }
  }

  function render(view) {
    load();
    bindUpload();
    updateImportMeta();
    if (view === 'month') renderTable('mpMonthBody', 'mpMonthHint', 'month');
    else if (view === 'week') renderTable('mpWeekBody', 'mpWeekHint', 'week');
    else updateImportMeta();
  }

  load();
  window.MachineModule = {
    render: render,
    getRows: function () { return rows.slice(); },
    TYPES: META_TYPES
  };
})();


/* ========== js/features/category-module.js ========== */
/* js/features/category-module.js — 品类统计：数据导入 + 品类分析 */
(function () {
  'use strict';
  var STORAGE_KEY = 'category_retail_source_v1';
  var rows = [];
  var pager = null;
  var catVal = '';
  var supVal = '';
  var searchKw = '';
  var catSelect = null;
  var supSelect = null;

  function $(id) { return document.getElementById(id); }
  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
  function money(n) {
    var v = Number(n);
    if (!isFinite(v)) return '—';
    return v.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function load() {
    try {
      var raw = CMGUserStore.getItem(STORAGE_KEY);
      var data = raw ? JSON.parse(raw) : null;
      rows = data && Array.isArray(data.rows) ? data.rows : (Array.isArray(data) ? data : []);
    } catch (e) { rows = []; }
  }
  function save() {
    try {
      CMGUserStore.setItem(STORAGE_KEY, JSON.stringify({ version: 1, updatedAt: Date.now(), rows: rows }));
    } catch (e) {}
  }
  function normHeader(h) {
    return String(h || '').replace(/\s+/g, '').toLowerCase();
  }
  function findCol(headers, keys) {
    var i, j, h, k;
    for (j = 0; j < keys.length; j++) {
      k = String(keys[j]).toLowerCase().replace(/\s+/g, '');
      for (i = 0; i < headers.length; i++) {
        if (normHeader(headers[i]) === k) return i;
      }
    }
    for (j = 0; j < keys.length; j++) {
      k = String(keys[j]).toLowerCase().replace(/\s+/g, '');
      for (i = 0; i < headers.length; i++) {
        if (normHeader(headers[i]).indexOf(k) >= 0) return i;
      }
    }
    return -1;
  }
  function parseSheet(file, cb) {
    if (typeof XLSX === 'undefined') {
      if (typeof toast === 'function') toast('Excel 解析库未加载', 'error');
      return;
    }
    var reader = new FileReader();
    reader.onload = function (e) {
      try {
        var wb = XLSX.read(new Uint8Array(e.target.result), { type: 'array', cellDates: true });
        var sheet = wb.Sheets[wb.SheetNames[0]];
        var aoa = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
        cb(null, aoa);
      } catch (err) { cb(err); }
    };
    reader.onerror = function () { cb(new Error('读取失败')); };
    reader.readAsArrayBuffer(file);
  }
  function parseRetail(aoa) {
    if (!aoa || aoa.length < 2) return [];
    var headers = aoa[0].map(String);
    var cName = findCol(headers, ['商品名称', '名称']);
    var cCode = findCol(headers, ['商品编号', '编号']);
    var cCost = findCol(headers, ['估算成本', '成本']);
    var cPrice = findCol(headers, ['售价']);
    var cStock = findCol(headers, ['库存']);
    var cStatus = findCol(headers, ['状态']);
    var cSupplier = findCol(headers, ['供应商']);
    var cCat = findCol(headers, ['商品分类', '分类']);
    var cAttr = findCol(headers, ['商品属性']);
    var cTime = findCol(headers, ['创建时间', '创建']);
    var list = [];
    for (var i = 1; i < aoa.length; i++) {
      var row = aoa[i];
      if (!row || !row.length) continue;
      var name = String(cName >= 0 ? row[cName] : '').trim();
      if (!name) continue;
      var cost = cCost >= 0 ? parseFloat(String(row[cCost]).replace(/,/g, '')) : NaN;
      list.push({
        name: name,
        code: String(cCode >= 0 ? row[cCode] : '').trim(),
        cost: isFinite(cost) ? cost : null,
        price: cPrice >= 0 ? parseFloat(String(row[cPrice]).replace(/,/g, '')) : null,
        stock: cStock >= 0 ? parseFloat(String(row[cStock]).replace(/,/g, '')) : null,
        status: String(cStatus >= 0 ? row[cStatus] : '').trim(),
        supplier: String(cSupplier >= 0 ? row[cSupplier] : '').trim(),
        category: String(cCat >= 0 ? row[cCat] : '').trim(),
        attr: String(cAttr >= 0 ? row[cAttr] : '').trim(),
        createdAt: String(cTime >= 0 ? row[cTime] : '').trim()
      });
    }
    return list;
  }

  function filteredRows() {
    var kw = searchKw;
    var cat = catVal || '';
    var sup = supVal || '';
    return rows.filter(function (r) {
      if (cat && r.category !== cat) return false;
      if (sup && r.supplier !== sup) return false;
      if (!kw) return true;
      return (r.name + ' ' + r.code + ' ' + r.supplier + ' ' + r.category).toLowerCase().indexOf(kw) >= 0;
    });
  }

  function fillFilters() {
    var cats = {}, sups = {};
    rows.forEach(function (r) {
      if (r.category) cats[r.category] = 1;
      if (r.supplier) sups[r.supplier] = 1;
    });
    var catKeys = Object.keys(cats).sort(function (a, b) { return a.localeCompare(b, 'zh'); });
    var supKeys = Object.keys(sups).sort(function (a, b) { return a.localeCompare(b, 'zh'); });
    catSelect = createSelectSearch($('catFilterCatBubble'), {
      placeholder: '全部',
      value: catVal,
      options: [{ value: '', label: '全部分类' }].concat(catKeys.map(function (k) { return { value: k, label: k }; })),
      onChange: function (v) { catVal = v; renderAnalysis(); }
    });
    supSelect = createSelectSearch($('catFilterSupBubble'), {
      placeholder: '全部',
      value: supVal,
      options: [{ value: '', label: '全部供应商' }].concat(supKeys.map(function (k) { return { value: k, label: k }; })),
      onChange: function (v) { supVal = v; renderAnalysis(); }
    });
  }

  /* 可搜索下拉：参考运营后台「供应商：请选择 + 搜索」 */
  function createSelectSearch(mount, opts) {
    if (!mount) return null;
    opts = opts || {};
    var value = opts.value != null ? opts.value : '';
    var options = opts.options || [];
    var placeholder = opts.placeholder || '请选择';
    mount.className = 'select-search';
    mount.innerHTML =
      '<div class="select-search-trigger">' +
        '<input type="text" class="select-search-input" placeholder="' + String(placeholder).replace(/"/g, '&quot;') + '" autocomplete="off" />' +
      '</div>' +
      '<div class="select-search-menu" role="listbox"></div>';
    var input = mount.querySelector('.select-search-input');
    var menu = mount.querySelector('.select-search-menu');

    function labelOf(v) {
      for (var i = 0; i < options.length; i++) {
        if (String(options[i].value) === String(v)) return options[i].label;
      }
      return '';
    }
    function paint(filter) {
      var q = String(filter || '').trim().toLowerCase();
      var list = options.filter(function (o) {
        if (!q) return true;
        return String(o.label).toLowerCase().indexOf(q) >= 0 || String(o.value).toLowerCase().indexOf(q) >= 0;
      });
      if (!list.length) {
        menu.innerHTML = '<div class="select-search-empty">无匹配项</div>';
        return;
      }
      menu.innerHTML = list.map(function (o) {
        var on = String(o.value) === String(value);
        return '<div class="select-search-item' + (on ? ' active' : '') + '" data-value="' +
          String(o.value).replace(/"/g, '&quot;') + '" role="option">' + escapeHtml(o.label) + '</div>';
      }).join('');
    }
    function open() {
      mount.classList.add('open');
      paint(input.value);
    }
    function close() {
      mount.classList.remove('open');
      input.value = value ? labelOf(value) : '';
    }
    function setValue(v, silent) {
      value = v;
      input.value = v ? labelOf(v) : '';
      if (!silent && typeof opts.onChange === 'function') opts.onChange(v);
    }
    input.value = value ? labelOf(value) : '';
    input.addEventListener('focus', function () {
      input.value = '';
      open();
    });
    input.addEventListener('input', function () {
      open();
      paint(input.value);
    });
    menu.addEventListener('mousedown', function (e) {
      e.preventDefault();
      var item = e.target.closest && e.target.closest('.select-search-item');
      if (!item) return;
      setValue(item.getAttribute('data-value'));
      close();
    });
    input.addEventListener('blur', function () {
      setTimeout(close, 150);
    });
    document.addEventListener('click', function (e) {
      if (!mount.contains(e.target)) close();
    });
    return { setValue: setValue, getValue: function () { return value; } };
  }

  function rowHtml(r, idx) {
    return '<tr>' +
      '<td class="num">' + (idx + 1) + '</td>' +
      '<td title="' + escapeHtml(r.name) + '">' + escapeHtml(r.name) + '</td>' +
      '<td class="num">' + (r.cost != null ? money(r.cost) : '—') + '</td>' +
      '<td title="' + escapeHtml(r.supplier) + '">' + escapeHtml(r.supplier || '—') + '</td>' +
      '<td title="' + escapeHtml(r.category) + '">' + escapeHtml(r.category || '—') + '</td>' +
      '<td>' + escapeHtml(r.createdAt || '—') + '</td>' +
      '</tr>';
  }

  function renderAnalysisSummary(list) {
    var box = $('catAnalysisSummary');
    if (!box) return;
    list = list || [];
    if (!list.length) {
      box.innerHTML = '<div class="cat-sum-empty">暂无可视分析数据，请先导入或调整筛选条件</div>';
      return;
    }
    var total = list.length;
    var costSum = 0, costN = 0;
    var catMap = {}, supMap = {};
    var i, r, c, s, k;
    for (i = 0; i < list.length; i++) {
      r = list[i];
      if (r.cost != null && isFinite(Number(r.cost))) {
        costSum += Number(r.cost);
        costN++;
      }
      c = String(r.category || '未分类').trim() || '未分类';
      s = String(r.supplier || '未知供应商').trim() || '未知供应商';
      catMap[c] = (catMap[c] || 0) + 1;
      supMap[s] = (supMap[s] || 0) + 1;
    }
    function topEntries(map, n) {
      return Object.keys(map).map(function (k) {
        return { name: k, count: map[k] };
      }).sort(function (a, b) { return b.count - a.count; }).slice(0, n);
    }
    var topCat = topEntries(catMap, 8);
    var topSup = topEntries(supMap, 6);
    var maxCat = topCat.length ? topCat[0].count : 1;
    var maxSup = topSup.length ? topSup[0].count : 1;
    var avg = costN ? (costSum / costN) : 0;
    function bars(items, max) {
      return items.map(function (it) {
        var pct = max > 0 ? Math.round(it.count / max * 100) : 0;
        return '<div class="cat-bar-row" title="' + escapeHtml(it.name) + '：' + it.count + ' 件">' +
          '<span class="cat-bar-name">' + escapeHtml(it.name) + '</span>' +
          '<span class="cat-bar-track"><i style="width:' + pct + '%"></i></span>' +
          '<span class="cat-bar-val">' + it.count + '</span>' +
          '</div>';
      }).join('');
    }
    box.innerHTML =
      '<div class="cat-sum-kpis">' +
        '<div class="cat-sum-kpi"><span class="cat-sum-k">筛选商品</span><strong class="cat-sum-v">' + total.toLocaleString() + '</strong><span class="cat-sum-s">件</span></div>' +
        '<div class="cat-sum-kpi"><span class="cat-sum-k">商品分类</span><strong class="cat-sum-v">' + Object.keys(catMap).length + '</strong><span class="cat-sum-s">类</span></div>' +
        '<div class="cat-sum-kpi"><span class="cat-sum-k">供应商</span><strong class="cat-sum-v">' + Object.keys(supMap).length + '</strong><span class="cat-sum-s">家</span></div>' +
        '<div class="cat-sum-kpi"><span class="cat-sum-k">平均成本</span><strong class="cat-sum-v">' + (costN ? money(avg) : '—') + '</strong><span class="cat-sum-s">' + (costN ? '' : '无成本') + '</span></div>' +
      '</div>' +
      '<div class="cat-sum-charts">' +
        '<div class="cat-sum-panel"><div class="cat-sum-panel-hd">分类 TOP</div><div class="cat-sum-bars">' + (bars(topCat, maxCat) || '<div class="cat-sum-empty">暂无分类</div>') + '</div></div>' +
        '<div class="cat-sum-panel"><div class="cat-sum-panel-hd">供应商 TOP</div><div class="cat-sum-bars">' + (bars(topSup, maxSup) || '<div class="cat-sum-empty">暂无供应商</div>') + '</div></div>' +
      '</div>';
  }

  function renderAnalysis() {
    var body = $('catAnalysisBody');
    var hint = $('catAnalysisHint');
    var list = filteredRows();
    if (hint) hint.textContent = rows.length ? ('共 ' + rows.length + ' 条 · 筛选 ' + list.length + ' 条') : '请先导入零售商品数据';
    fillFilters();
    renderAnalysisSummary(list);
    if (!list.length) {
      if (body) body.innerHTML = '<tr><td colspan="8" class="empty-cell">暂无数据</td></tr>';
      var pg = $('catAnalysisPager');
      if (pg) pg.style.display = 'none';
      return;
    }
    if (typeof createPager === 'function' && $('catAnalysisPager')) {
      if (!pager) {
        pager = createPager($('catAnalysisPager'), {
          pageSize: 20,
          getData: function () { return filteredRows(); },
          onPage: function (pageRows, page, size) {
            var base = ((page || 1) - 1) * (size || 20);
            if (body) body.innerHTML = pageRows.map(function (r, i) { return rowHtml(r, base + i); }).join('');
          }
        });
      }
      pager.reset ? pager.reset() : pager.draw();
    } else if (body) {
      body.innerHTML = list.slice(0, 100).map(function (r, i) { return rowHtml(r, i); }).join('');
    }
  }

  function updateImportMeta() {
    var meta = $('catImportMeta');
    if (meta) meta.textContent = rows.length ? ('已导入 ' + rows.length + ' 条零售商品') : '尚未导入';
    var clr = $('catBtnClear');
    if (clr) clr.style.display = rows.length ? '' : 'none';
  }

  function handleFile(file) {
    parseSheet(file, function (err, aoa) {
      if (err) {
        if (typeof toast === 'function') toast(err.message || '解析失败', 'error');
        return;
      }
      var list = parseRetail(aoa);
      if (!list.length) {
        if (typeof toast === 'function') toast('未识别到商品数据，请确认表头含「商品名称」等列', 'warning');
        return;
      }
      rows = list;
      save();
      updateImportMeta();
      renderAnalysis();
      if (typeof toast === 'function') toast('已导入 ' + list.length + ' 条商品', 'success');
    });
  }

  function bind() {
    var area = $('catUploadArea'), input = $('catExcelFile');
    if (area && input && !area.__bound) {
      area.__bound = true;
      area.addEventListener('click', function () { input.click(); });
      input.addEventListener('change', function (e) {
        if (e.target.files && e.target.files[0]) handleFile(e.target.files[0]);
        e.target.value = '';
      });
      area.addEventListener('dragover', function (e) { e.preventDefault(); area.classList.add('dragover'); });
      area.addEventListener('dragleave', function () { area.classList.remove('dragover'); });
      area.addEventListener('drop', function (e) {
        e.preventDefault(); area.classList.remove('dragover');
        if (e.dataTransfer.files && e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
      });
    }
    var clr = $('catBtnClear');
    if (clr && !clr.__bound) {
      clr.__bound = true;
      clr.addEventListener('click', function () {
        rows = []; save(); updateImportMeta(); renderAnalysis();
        if (typeof toast === 'function') toast('已清空品类数据', 'success');
      });
    }
    var search = $('catSearch');
    if (search && !search.__bound) {
      search.__bound = true;
      var applyKw = function () {
        searchKw = (search.value || '').trim().toLowerCase();
        renderAnalysis();
      };
      search.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
          e.preventDefault();
          applyKw();
        }
      });
      /* 仅按钮 / 回车触发，禁止输入过程自动搜索 */
      var btnCat = $('btnCatSearch');
      if (btnCat && !btnCat.__bound) {
        btnCat.__bound = true;
        btnCat.addEventListener('click', function (e) {
          e.preventDefault();
          applyKw();
        });
      }
    }
  }

  function render(view) {
    load();
    bind();
    updateImportMeta();
    if (view === 'analysis') renderAnalysis();
  }

  window.CategoryModule = { render: render, getRows: function () { return rows.slice(); } };
})();


/* ========== js/features/docs-module.js ========== */
/* js/features/docs-module.js — 单据：内容哈希去重 + 文件名唯一 + 勾选下载 + 灯箱预览 */
(function () {
  'use strict';
  var STORAGE_KEY = 'warehouse_docs_v1';
  var docs = [];
  var pager = null;
  var bound = false;
  var editingId = null;
  var editImages = [];
  var selected = {};
  var lbList = [];
  var lbIndex = 0;
  var lbScale = 1;
  var searchKw = '';
  var MAX_DATA_URL = 1.8 * 1024 * 1024;
  var MAX_FILE_BYTES = 5 * 1024 * 1024;
  var ALLOWED_IMAGE_TYPES = {
    'image/jpeg': true,
    'image/jpg': true,
    'image/png': true,
    'image/webp': true,
    'image/gif': true,
    'image/bmp': true
  };

  function isAllowedImageFile(file) {
    if (!file) return false;
    var t = String(file.type || '').toLowerCase();
    if (!ALLOWED_IMAGE_TYPES[t]) return false;
    if (file.size > MAX_FILE_BYTES) return false;
    var name = String(file.name || '').toLowerCase();
    if (/\.(jpe?g|png|webp|gif|bmp)$/.test(name) === false && t.indexOf('image/') === 0) {
      /* 允许 type 正确但扩展名异常的少数情况 */
      return true;
    }
    if (name && !/\.(jpe?g|png|webp|gif|bmp)$/.test(name)) return false;
    return true;
  }

  function $(id) { return document.getElementById(id); }
  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
  function confirmDelete(message, onYes) {
    /* 统一走居中二次确认弹窗：标题 + 内容 + 确认/取消 */
    if (typeof window.showConfirm === 'function') {
      window.showConfirm({
        title: '删除确认',
        message: (message || '确认删除？') + '\n删除后该条目不再显示，',
        onConfirm: function () { if (typeof onYes === 'function') onYes(); }
      });
      return;
    }
    var msg = (message || '确认删除？') + '\n\n删除后数据不可恢复，请谨慎操作。';
    if (typeof showModal === 'function') {
      showModal(msg, 'confirm', function (ok) { if (ok && onYes) onYes(); });
      return;
    }
    if (window.confirm(msg) && onYes) onYes();
  }
  function alertDup(message) {
    var msg = message || '检测到重复文件';
    if (typeof showModal === 'function') {
      showModal(msg, 'alert');
      return;
    }
    if (typeof toast === 'function') toast(msg, 'warning');
    else window.alert(msg);
  }
  /* 软删除墓碑区：已删除单据保留在存储中，仅从工作集合移除 */
  var deletedDocs = [];
  function load() {
    deletedDocs = [];
    try {
      var raw = CMGUserStore.getItem(STORAGE_KEY);
      var data = raw ? JSON.parse(raw) : null;
      var all = data && Array.isArray(data.docs) ? data.docs : [];
      docs = [];
      all.forEach(function (d) {
        /* 软删除分区：墓碑单据保留在存储中，不进入工作集合 */
        if (d.deleted) { deletedDocs.push(d); return; }
        if (!Array.isArray(d.images) && d.dataUrl) {
          d.images = [{ dataUrl: d.dataUrl, fileName: d.fileName || '', hash: d.contentHash || '' }];
        }
        if (!Array.isArray(d.images)) d.images = [];
        if (d.images[0] && !d.dataUrl) d.dataUrl = d.images[0].dataUrl;
        docs.push(d);
      });
    } catch (e) { docs = []; }
  }
  function save() {
    try {
      CMGUserStore.setItem(STORAGE_KEY, JSON.stringify({ version: 1, updatedAt: Date.now(), docs: docs.concat(deletedDocs) }));
    } catch (e) {
      if (typeof toast === 'function') toast('存储空间不足，请删除旧单据后重试', 'warning');
    }
  }
  function parseDate(v) {
    if (v instanceof Date && !isNaN(v.getTime())) return v;
    var s = String(v || '').trim();
    if (!s) return null;
    var t = Date.parse(s.replace(/\./g, '-').replace(/\//g, '-'));
    return isNaN(t) ? null : new Date(t);
  }
  function periodRange() {
    var sEl = $('docsPeriodStart'), eEl = $('docsPeriodEnd');
    var start = sEl && sEl.value ? parseDate(sEl.value) : null;
    var end = eEl && eEl.value ? parseDate(eEl.value) : null;
    var now = new Date(); now.setHours(0, 0, 0, 0);
    if (!start) start = now;
    if (!end) end = start;
    if (end < start) { var tmp = start; start = end; end = tmp; }
    return { start: start, end: end };
  }
  function filtered() {
    var range = periodRange();
    var kw = searchKw;
    var startMs = range.start.getTime();
    var endMs = range.end.getTime() + 86400000 - 1;
    return docs.filter(function (d) {
      var dt = parseDate(d.periodStart) || parseDate(d.createdAt);
      if (dt) {
        var t = dt.getTime();
        if (t < startMs || t > endMs) return false;
      }
      if (!kw) return true;
      return (d.poNo + ' ' + d.supplier + ' ' + d.fileName + ' ' + (d.remark || '')).toLowerCase().indexOf(kw) >= 0;
    }).sort(function (a, b) {
      return String(b.createdAt).localeCompare(String(a.createdAt));
    });
  }
  function normalizeKey(s) {
    return String(s || '').trim().toLowerCase();
  }
  function hashFile(file) {
    return new Promise(function (resolve) {
      if (!file) { resolve(''); return; }
      var reader = new FileReader();
      reader.onload = function (e) {
        var buf = e.target.result;
        function fallback() {
          try {
            var u8 = new Uint8Array(buf);
            var step = Math.max(1, Math.floor(u8.length / 64));
            var h = (file.size || 0) >>> 0;
            for (var i = 0; i < u8.length; i += step) h = ((h << 5) - h + u8[i]) >>> 0;
            resolve('fb_' + (file.size || 0) + '_' + h.toString(16));
          } catch (err) {
            resolve('fb_' + (file.size || 0) + '_' + encodeURIComponent(file.name || ''));
          }
        }
        if (window.crypto && crypto.subtle && buf) {
          crypto.subtle.digest('SHA-256', buf).then(function (digest) {
            var arr = Array.from(new Uint8Array(digest));
            resolve(arr.map(function (b) { return b.toString(16).padStart(2, '0'); }).join(''));
          }).catch(fallback);
        } else fallback();
      };
      reader.onerror = function () {
        resolve('err_' + (file.size || 0) + '_' + encodeURIComponent(file.name || ''));
      };
      reader.readAsArrayBuffer(file);
    });
  }
  function isPoTaken(poNo, excludeId) {
    var key = normalizeKey(poNo);
    if (!key) return false;
    return docs.some(function (d) {
      return d.id !== excludeId && normalizeKey(d.poNo) === key;
    });
  }
  function isFileNameTaken(fileName, excludeId) {
    var key = normalizeKey(fileName);
    if (!key) return false;
    return docs.some(function (d) {
      if (d.id === excludeId) return false;
      if (normalizeKey(d.fileName) === key) return true;
      if (d.images && d.images.some(function (im) { return normalizeKey(im.fileName) === key; })) return true;
      return false;
    });
  }
  function isHashTaken(hash, excludeId) {
    var key = String(hash || '').trim();
    if (!key) return false;
    return docs.some(function (d) {
      if (d.id === excludeId) return false;
      if (d.contentHash && d.contentHash === key) return true;
      if (d.images && d.images.some(function (im) { return im.hash && im.hash === key; })) return true;
      return false;
    });
  }
  function thumbSrc(d) {
    if (d.images && d.images[0] && d.images[0].dataUrl) return d.images[0].dataUrl;
    return d.dataUrl || '';
  }
  function rowHtml(d, idx) {
    var src = thumbSrc(d);
    var checked = selected[d.id] ? ' checked' : '';
    var preview = src
      ? '<img class="docs-thumb" src="' + src + '" alt="" data-docs-preview="' + escapeHtml(d.id) + '" title="预览" />'
      : '<span class="card-hint">—</span>';
    return '<tr data-docs-id="' + escapeHtml(d.id) + '">' +
      '<td class="docs-col-check"><input type="checkbox" class="docs-check" data-docs-check="' + escapeHtml(d.id) + '"' + checked + ' /></td>' +
      '<td class="num">' + (idx + 1) + '</td>' +
      '<td>' + preview + '</td>' +
      '<td>' + escapeHtml(d.poNo || '—') + '</td>' +
      '<td>' + escapeHtml(d.supplier || '—') + '</td>' +
      '<td>' + escapeHtml((d.periodStart || '') + (d.periodEnd ? ' ~ ' + d.periodEnd : '')) + '</td>' +
      '<td><div class="docs-file-cell"><span title="' + escapeHtml(d.fileName) + '">' + escapeHtml(d.fileName || '—') + '</span></div></td>' +
      '<td>' + escapeHtml(d.createdAt || '') + '</td>' +
      '<td class="docs-ops">' +
        '<button type="button" data-docs-edit="' + escapeHtml(d.id) + '">编辑</button>' +
        '<button type="button" class="docs-op-danger" data-docs-del="' + escapeHtml(d.id) + '">删除</button>' +
      '</td>' +
      '</tr>';
  }
  function syncCheckAll() {
    var all = $('docsCheckAll');
    if (!all) return;
    var list = filtered();
    if (!list.length) { all.checked = false; all.indeterminate = false; return; }
    var n = 0;
    list.forEach(function (d) { if (selected[d.id]) n++; });
    all.checked = n === list.length;
    all.indeterminate = n > 0 && n < list.length;
  }
  function renderList() {
    var body = $('docsTableBody');
    var hint = $('docsListHint');
    var list = filtered();
    var selCount = 0;
    list.forEach(function (d) { if (selected[d.id]) selCount++; });
    if (hint) {
      hint.textContent = docs.length
        ? ('共 ' + docs.length + ' 份 · 当前筛选 ' + list.length + ' 份' + (selCount ? ' · 已选 ' + selCount + ' 份' : ''))
        : '按账期上传采购单据（单号/文件名/图片内容均不可重复）';
    }
    if (!list.length) {
      if (body) body.innerHTML = '<tr><td colspan="9" class="empty-cell">暂无单据，请先填写采购单号与供应商并上传图片</td></tr>';
      var pg = $('docsPager');
      if (pg) pg.style.display = 'none';
      syncCheckAll();
      return;
    }
    if (typeof createPager === 'function' && $('docsPager')) {
      if (!pager) {
        pager = createPager($('docsPager'), {
          pageSize: 15,
          getData: function () { return filtered(); },
          onPage: function (pageRows, page, size) {
            var base = ((page || 1) - 1) * (size || 15);
            if (body) body.innerHTML = pageRows.map(function (r, i) { return rowHtml(r, base + i); }).join('');
            syncCheckAll();
          }
        });
      }
      if (pager.reset) pager.reset(); else pager.draw();
    } else if (body) {
      body.innerHTML = list.map(function (r, i) { return rowHtml(r, i); }).join('');
    }
    syncCheckAll();
  }

  function readImageAsDataUrl(file, cb) {
    if (!isAllowedImageFile(file)) {
      cb(new Error('请上传图片文件'));
      return;
    }
    var startRead = function () {
      var reader = new FileReader();
      reader.onload = function (e) {
        var url = e.target.result;
        if (url && url.length > MAX_DATA_URL) {
          compressImage(url, function (small) {
            if (!small || small.length > MAX_DATA_URL) cb(new Error('图片过大，请压缩后上传'));
            else cb(null, small);
          });
        } else cb(null, url);
      };
      reader.onerror = function () { cb(new Error('读取图片失败')); };
      reader.readAsDataURL(file);
    };
    /* S4：魔数校验 */
    if (typeof CMGFileMagic !== 'undefined' && CMGFileMagic.validateImageFile) {
      CMGFileMagic.validateImageFile(file).then(function (r) {
        if (!r || !r.ok) {
          cb(new Error((r && r.error) || '文件内容校验失败'));
          return;
        }
        startRead();
      }).catch(function () { cb(new Error('文件校验异常')); });
    } else {
      startRead();
    }
  }
  function compressImage(dataUrl, cb) {
    var img = new Image();
    img.onload = function () {
      var maxW = 1280;
      var scale = img.width > maxW ? maxW / img.width : 1;
      var canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      try { cb(canvas.toDataURL('image/jpeg', 0.72)); } catch (e) { cb(null); }
    };
    img.onerror = function () { cb(null); };
    img.src = dataUrl;
  }

  function addDocs(fileList) {
    var files = Array.prototype.slice.call(fileList || []).filter(isAllowedImageFile);
    if (!files.length) {
      alertDup('仅支持 JPG/PNG/WebP/GIF/BMP，单张不超过 5MB');
      return;
    }
    var po = (($('docsPoNo') && $('docsPoNo').value) || '').trim();
    var sup = (($('docsSupplier') && $('docsSupplier').value) || '').trim();
    if (!po) { alertDup('请填写采购单号'); return; }
    if (!sup) { alertDup('请填写供应商'); return; }
    if (isPoTaken(po)) {
      alertDup('采购单号「' + po + '」已存在，不可重复上传。\n请更换单号或编辑已有单据。');
      return;
    }
    Promise.all(files.map(function (file) {
      return hashFile(file).then(function (hash) { return { file: file, hash: hash }; });
    })).then(function (items) {
      var nameDup = [];
      var hashDup = [];
      var seenName = {};
      var seenHash = {};
      items.forEach(function (it) {
        var nk = normalizeKey(it.file.name);
        if (seenName[nk] || isFileNameTaken(it.file.name)) nameDup.push(it.file.name);
        seenName[nk] = 1;
        if (it.hash && (seenHash[it.hash] || isHashTaken(it.hash))) hashDup.push(it.file.name);
        if (it.hash) seenHash[it.hash] = 1;
      });
      if (nameDup.length) {
        alertDup('检测到重复文件名，已阻止上传：\n\n' + nameDup.slice(0, 8).join('\n') +
          (nameDup.length > 8 ? '\n…' : '') + '\n\n请重命名后再试。');
        return;
      }
      if (hashDup.length) {
        alertDup('检测到图片内容与已有单据重复（内容指纹相同），已阻止上传：\n\n' +
          hashDup.slice(0, 8).join('\n') +
          (hashDup.length > 8 ? '\n…' : '') +
          '\n\n即使文件名不同，相同图片也不能重复入库。');
        return;
      }
      var loaded = [];
      var pending = items.length;
      var failed = 0;
      items.forEach(function (it) {
        readImageAsDataUrl(it.file, function (err, dataUrl) {
          if (err || !dataUrl) failed++;
          else loaded.push({
            dataUrl: dataUrl,
            fileName: it.file.name,
            fileSize: it.file.size || 0,
            hash: it.hash
          });
          pending--;
          if (pending > 0) return;
          if (!loaded.length) { alertDup('图片读取失败，请重试'); return; }
          var range = periodRange();
          docs.unshift({
            id: 'doc_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
            poNo: po,
            supplier: sup,
            periodStart: range.start.toISOString().slice(0, 10),
            periodEnd: range.end.toISOString().slice(0, 10),
            fileName: loaded.length === 1 ? loaded[0].fileName : (loaded[0].fileName + ' 等' + loaded.length + '张'),
            fileSize: loaded.reduce(function (s, x) { return s + (x.fileSize || 0); }, 0),
            dataUrl: loaded[0].dataUrl,
            contentHash: loaded[0].hash || '',
            images: loaded.map(function (x) {
              return { dataUrl: x.dataUrl, fileName: x.fileName, hash: x.hash };
            }),
            remark: '',
            createdAt: new Date().toLocaleString('zh-CN', { hour12: false })
          });
          save();
          renderList();
          if (typeof toast === 'function') {
            var msg = '已添加单据「' + po + '」· ' + loaded.length + ' 张图片';
            if (failed) msg += '（' + failed + ' 张失败）';
            toast(msg, 'success');
          }
          if ($('docsFile')) $('docsFile').value = '';
        });
      });
    });
  }

  function loadExcelJS(cb) {
    if (window.ExcelJS) { cb(null, window.ExcelJS); return; }
    var s = document.createElement('script');
    s.src = 'vendor/exceljs.min.js';
    s.onload = function () { cb(null, window.ExcelJS); };
    s.onerror = function () {
      cb(new Error('ExcelJS 本地库加载失败，请确认 frontend/vendor/exceljs.min.js 存在'));
    };
    document.head.appendChild(s);
  }
  function dataUrlParts(dataUrl) {
    var parts = String(dataUrl || '').split(',');
    var mime = (parts[0].match(/:(.*?);/) || [])[1] || 'image/png';
    var b64 = parts[1] || '';
    var ext = (mime.split('/')[1] || 'png').toLowerCase().replace('jpeg', 'jpg');
    var excelExt = (ext === 'jpg') ? 'jpeg' : ext;
    if (excelExt !== 'png' && excelExt !== 'jpeg' && excelExt !== 'gif') excelExt = 'png';
    return { base64: b64, mime: mime, excelExt: excelExt };
  }
  function exportList() {
    var list = filtered();
    var picked = list.filter(function (d) { return selected[d.id]; });
    return picked.length ? picked : list;
  }
  function exportExcel(withImages) {
    var list = exportList();
    if (!list.length) {
      alertDup('暂无单据可下载（请先勾选或调整筛选）');
      return;
    }
    withImages = !!withImages;
    if (typeof toast === 'function') {
      toast('正在导出 ' + list.length + ' 条' + (withImages ? '（含图片）' : '（仅数据）') + '…', 'info');
    }

    if (!withImages) {
      if (typeof XLSX === 'undefined') { alertDup('导出库未加载'); return; }
      var aoa = [['序号', '采购单号', '供应商', '账期开始', '账期结束', '文件名', '备注', '上传时间']];
      list.forEach(function (d, i) {
        aoa.push([i + 1, d.poNo || '', d.supplier || '', d.periodStart || '', d.periodEnd || '', d.fileName || '', d.remark || '', d.createdAt || '']);
      });
      var wb0 = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb0, XLSX.utils.aoa_to_sheet(aoa), '采购单据');
      XLSX.writeFile(wb0, '采购单据_' + new Date().toISOString().slice(0, 10) + '.xlsx');
      if (typeof toast === 'function') toast('已导出 ' + list.length + ' 条表格数据', 'success');
      return;
    }

    loadExcelJS(function (err, ExcelJS) {
      if (err || !ExcelJS) {
        if (typeof XLSX === 'undefined') { alertDup('导出库未加载'); return; }
        var aoa2 = [['序号', '采购单号', '供应商', '账期开始', '账期结束', '文件名', '备注', '上传时间']];
        list.forEach(function (d, i) {
          aoa2.push([i + 1, d.poNo || '', d.supplier || '', d.periodStart || '', d.periodEnd || '', d.fileName || '', d.remark || '', d.createdAt || '']);
        });
        var wb1 = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb1, XLSX.utils.aoa_to_sheet(aoa2), '采购单据');
        XLSX.writeFile(wb1, '采购单据_' + new Date().toISOString().slice(0, 10) + '.xlsx');
        if (typeof toast === 'function') toast('已导出 Excel（图片库加载失败，未嵌入图片）', 'warning');
        return;
      }
      var wb = new ExcelJS.Workbook();
      var ws = wb.addWorksheet('采购单据', { views: [{ state: 'frozen', ySplit: 1 }] });
      var maxImgs = 1;
      list.forEach(function (d) {
        var n = (d.images && d.images.length) ? d.images.length : (d.dataUrl ? 1 : 0);
        if (n > maxImgs) maxImgs = n;
      });
      if (maxImgs > 5) maxImgs = 5;
      var cols = [
        { header: '序号', width: 8 }, { header: '采购单号', width: 14 }, { header: '供应商', width: 16 },
        { header: '账期开始', width: 12 }, { header: '账期结束', width: 12 }, { header: '文件名', width: 26 },
        { header: '备注', width: 14 }, { header: '上传时间', width: 18 }
      ];
      for (var c = 0; c < maxImgs; c++) cols.push({ header: maxImgs === 1 ? '单据图片' : ('图片' + (c + 1)), width: 16 });
      ws.columns = cols;
      ws.getRow(1).font = { bold: true };
      ws.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };
      var embedCount = 0;
      list.forEach(function (d, i) {
        var rowIndex = i + 2;
        var row = ws.getRow(rowIndex);
        var vals = [i + 1, d.poNo || '', d.supplier || '', d.periodStart || '', d.periodEnd || '', d.fileName || '', d.remark || '', d.createdAt || ''];
        while (vals.length < 8 + maxImgs) vals.push('');
        row.values = vals;
        row.alignment = { vertical: 'middle' };
        row.height = 78;
        var imgs = (d.images && d.images.length) ? d.images : (d.dataUrl ? [{ dataUrl: d.dataUrl }] : []);
        var limit = Math.min(imgs.length, maxImgs);
        for (var j = 0; j < limit; j++) {
          var im = imgs[j];
          if (!im || !im.dataUrl) continue;
          try {
            var parts = dataUrlParts(im.dataUrl);
            if (!parts.base64) continue;
            var imageId = wb.addImage({ base64: parts.base64, extension: parts.excelExt });
            ws.addImage(imageId, { tl: { col: 8 + j, row: rowIndex - 1 }, ext: { width: 110, height: 72 }, editAs: 'oneCell' });
            embedCount++;
          } catch (e) { row.getCell(9 + j).value = '嵌入失败'; }
        }
        if (!limit) row.getCell(9).value = '无';
      });
      wb.xlsx.writeBuffer().then(function (buffer) {
        var blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        var a = document.createElement('a');
        var url = URL.createObjectURL(blob);
        a.href = url;
        a.download = '采购单据_' + new Date().toISOString().slice(0, 10) + '.xlsx';
        document.body.appendChild(a);
        a.click();
        setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 800);
        if (typeof toast === 'function') toast('已导出 ' + list.length + ' 条，嵌入 ' + embedCount + ' 张图片', 'success');
      }).catch(function () { alertDup('导出失败'); });
    });
  }

  function paintLightbox() {
    var img = $('docsLightboxImg');
    var counter = $('docsLbCounter');
    var prev = $('docsLbPrev');
    var next = $('docsLbNext');
    if (!lbList.length) return;
    if (lbIndex < 0) lbIndex = 0;
    if (lbIndex >= lbList.length) lbIndex = lbList.length - 1;
    if (img) {
      img.src = lbList[lbIndex].dataUrl || '';
      img.style.transform = 'scale(' + lbScale + ')';
    }
    if (counter) counter.textContent = (lbIndex + 1) + ' / ' + lbList.length;
    /* 始终可点：单图时点击仍循环（等同不切换） */
    if (prev) prev.disabled = false;
    if (next) next.disabled = false;
  }
  function openLightbox(list, index) {
    lbList = (list || []).filter(function (x) { return x && x.dataUrl; });
    if (!lbList.length) { alertDup('暂无图片可预览'); return; }
    lbIndex = index || 0;
    lbScale = 1;
    var lb = $('docsLightbox');
    if (lb) {
      lb.hidden = false;
      lb.removeAttribute('hidden');
      lb.classList.add('is-open');
      lb.style.cssText = 'display:flex;pointer-events:auto;z-index:400;';
      paintLightbox();
    }
  }
  function closeLightbox() {
    var lb = $('docsLightbox');
    if (lb) {
      lb.classList.remove('is-open');
      lb.hidden = true;
      lb.setAttribute('hidden', '');
      lb.style.cssText = 'display:none;pointer-events:none;';
    }
    var img = $('docsLightboxImg');
    if (img) { img.removeAttribute('src'); img.style.transform = ''; }
    lbList = [];
    lbScale = 1;
  }
  function openLightboxForDoc(id, index) {
    var doc = docs.find(function (d) { return d.id === id; });
    if (!doc) return;
    var list = (doc.images && doc.images.length) ? doc.images : (doc.dataUrl ? [{ dataUrl: doc.dataUrl, fileName: doc.fileName }] : []);
    openLightbox(list, index || 0);
  }

  function openDrawer(id) {
    var doc = docs.find(function (d) { return d.id === id; });
    if (!doc) return;
    editingId = id;
    if ($('docsDrawerTitle')) $('docsDrawerTitle').textContent = '编辑单据';
    function setField(fid, val) {
      var el = $(fid);
      if (!el) return;
      el.value = val == null ? '' : val;
      el.disabled = false;
      el.readOnly = false;
    }
    setField('docsEditPoNo', doc.poNo || '');
    setField('docsEditSupplier', doc.supplier || '');
    setField('docsEditRemark', doc.remark || '');
    if ($('docsEditStart')) $('docsEditStart').value = doc.periodStart || '';
    if ($('docsEditEnd')) $('docsEditEnd').value = doc.periodEnd || '';
    var disp = $('docsEditPeriodDisplay');
    var s = doc.periodStart || '', e = doc.periodEnd || s;
    if (disp) {
      if (s) {
        function cn(v) {
          var p = String(v).split('-');
          if (p.length < 3) return v;
          return p[0] + '/' + parseInt(p[1], 10) + '/' + parseInt(p[2], 10);
        }
        disp.textContent = cn(s) + '  →  ' + cn(e);
        disp.classList.remove('is-placeholder');
      } else {
        disp.textContent = '请选择账期';
        disp.classList.add('is-placeholder');
      }
    }
    var st = window.__docsEditDp;
    if (st && s) {
      var sd = parseDate(s), ed = parseDate(e) || sd;
      if (sd) {
        st.pickStart = sd; st.pickEnd = ed;
        st.view = new Date(sd.getFullYear(), sd.getMonth(), 1);
        st.picking = false;
      }
    }
    var trig = $('docsEditPeriodTrigger');
    if (trig) {
      trig.disabled = false;
      trig.removeAttribute('disabled');
      trig.style.pointerEvents = 'auto';
      trig.style.opacity = '1';
      trig.style.cursor = 'pointer';
    }
    /* 确保编辑账期可点：未绑定则绑定；已绑定则刷新状态与 onclick */
    try {
      if (typeof window.bindSharedDatePicker === 'function') {
        var needBind = !(window.__docsEditDp && typeof window.__docsEditDp.open === 'function');
        if (needBind) {
          var er = $('docsEditDatePicker');
          if (er) er.removeAttribute('data-dp-bound');
          if (trig) { trig.__dpClick = false; trig.onclick = null; }
          window.__docsEditDp = null;
          window.bindSharedDatePicker({
            rootId: 'docsEditDatePicker', triggerId: 'docsEditPeriodTrigger', panelId: 'docsEditPeriodPanel',
            startId: 'docsEditStart', endId: 'docsEditEnd', displayId: 'docsEditPeriodDisplay',
            presetsId: 'docsEditPeriodPresets', calDaysL: 'docsEditCalDaysL', calDaysR: 'docsEditCalDaysR',
            calTitleL: 'docsEditCalTitleL', calTitleR: 'docsEditCalTitleR',
            defaultPreset: null, stateKey: '__docsEditDp'
          });
        }
        var st2 = window.__docsEditDp;
        if (st2) {
          if (s) {
            var sd2 = parseDate(s), ed2 = parseDate(e) || sd2;
            if (sd2) {
              st2.pickStart = sd2; st2.pickEnd = ed2;
              st2.view = new Date(sd2.getFullYear(), sd2.getMonth(), 1);
              st2.picking = false;
            }
          }
          /* 重新挂上 onclick，防止被其它逻辑清掉 */
          if (trig && typeof st2.open === 'function') {
            trig.onclick = function (ev) {
              ev.preventDefault();
              ev.stopPropagation();
              if ($('docsEditDatePicker') && $('docsEditDatePicker').classList.contains('open')) st2.close();
              else st2.open();
            };
            trig.__dpClick = true;
          }
        }
      }
    } catch (errDp) { console.warn('[docs] ensure edit dp', errDp); }
    editImages = (doc.images && doc.images.length)
      ? doc.images.map(function (x) { return { dataUrl: x.dataUrl, fileName: x.fileName, hash: x.hash || '' }; })
      : (doc.dataUrl ? [{ dataUrl: doc.dataUrl, fileName: doc.fileName || '', hash: doc.contentHash || '' }] : []);
    renderEditImages(true);
    if ($('docsDrawerSave')) { $('docsDrawerSave').style.display = ''; $('docsDrawerSave').disabled = false; }
    var overlay = $('docsDrawerOverlay');
    if (overlay) {
      overlay.hidden = false;
      overlay.removeAttribute('hidden');
      overlay.classList.add('is-open');
      overlay.style.cssText = 'display:flex;pointer-events:auto;z-index:200;';
    }
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
  }
  function closeDrawer() {
    var overlay = $('docsDrawerOverlay');
    if (overlay) {
      overlay.classList.remove('is-open');
      overlay.hidden = true;
      overlay.setAttribute('hidden', '');
      overlay.style.cssText = 'display:none;pointer-events:none;';
    }
    var editRoot = $('docsEditDatePicker');
    if (editRoot) {
      editRoot.classList.remove('open');
      var ep = $('docsEditPeriodPanel');
      if (ep) { ep.hidden = true; ep.setAttribute('hidden', ''); }
    }
    document.body.style.overflow = '';
    document.documentElement.style.overflow = '';
    editingId = null;
    editImages = [];
  }
  function renderEditImages(canEdit) {
    var box = $('docsEditImgList');
    if (!box) return;
    var html = editImages.map(function (img, i) {
      return '<div class="docs-img-item">' +
        '<img src="' + img.dataUrl + '" alt="" data-edit-preview="' + i + '" />' +
        (canEdit ? '<button type="button" class="docs-img-del" data-img-idx="' + i + '">×</button>' : '') +
        '</div>';
    }).join('');
    if (canEdit) {
      html += '<button type="button" class="docs-img-add" id="docsImgAddBtn"><span style="font-size:18px;line-height:1;">+</span>添加图片</button>';
    }
    box.innerHTML = html;
  }
  function saveDrawer() {
    if (!editingId) return;
    var po = (($('docsEditPoNo') && $('docsEditPoNo').value) || '').trim();
    var sup = (($('docsEditSupplier') && $('docsEditSupplier').value) || '').trim();
    if (!po || !sup) { alertDup('请填写采购单号与供应商'); return; }
    if (isPoTaken(po, editingId)) {
      alertDup('采购单号「' + po + '」已存在，不可重复。\n请更换单号。');
      return;
    }
    for (var i = 0; i < editImages.length; i++) {
      var fn = editImages[i].fileName || '';
      if (fn && isFileNameTaken(fn, editingId)) {
        alertDup('文件名「' + fn + '」已存在，不可重复。');
        return;
      }
      if (editImages[i].hash && isHashTaken(editImages[i].hash, editingId)) {
        alertDup('图片「' + (fn || ('#' + (i + 1))) + '」内容与已有单据重复，不可保存。');
        return;
      }
      for (var j = i + 1; j < editImages.length; j++) {
        if (normalizeKey(editImages[i].fileName) && normalizeKey(editImages[i].fileName) === normalizeKey(editImages[j].fileName)) {
          alertDup('编辑中存在重复文件名，请删除多余图片。');
          return;
        }
        if (editImages[i].hash && editImages[j].hash && editImages[i].hash === editImages[j].hash) {
          alertDup('编辑中存在内容相同的图片，请删除重复项。');
          return;
        }
      }
    }
    var idx = docs.findIndex(function (d) { return d.id === editingId; });
    if (idx < 0) return;
    docs[idx].poNo = po;
    docs[idx].supplier = sup;
    docs[idx].periodStart = ($('docsEditStart') && $('docsEditStart').value) || docs[idx].periodStart;
    docs[idx].periodEnd = ($('docsEditEnd') && $('docsEditEnd').value) || docs[idx].periodEnd;
    docs[idx].remark = (($('docsEditRemark') && $('docsEditRemark').value) || '').trim();
    docs[idx].images = editImages.slice();
    docs[idx].dataUrl = editImages[0] ? editImages[0].dataUrl : '';
    docs[idx].contentHash = editImages[0] ? (editImages[0].hash || '') : '';
    docs[idx].fileName = editImages[0]
      ? (editImages.length === 1 ? editImages[0].fileName : (editImages[0].fileName + ' 等' + editImages.length + '张'))
      : '';
    save();
    closeDrawer();
    renderList();
    if (typeof toast === 'function') toast('已保存修改', 'success');
  }

  function bind() {
    if (typeof window.bindSharedDatePicker === 'function') {
      try {
        window.bindSharedDatePicker({
          rootId: 'docsDatePicker', triggerId: 'docsPeriodTrigger', panelId: 'docsPeriodPanel',
          startId: 'docsPeriodStart', endId: 'docsPeriodEnd', displayId: 'docsPeriodDisplay',
          presetsId: 'docsPeriodPresets', calDaysL: 'docsCalDaysL', calDaysR: 'docsCalDaysR',
          calTitleL: 'docsCalTitleL', calTitleR: 'docsCalTitleR',
          defaultPreset: 'last7', stateKey: '__docsDp', onChange: function () { renderList(); }
        });
      } catch (err) { console.warn('[docs] datepicker', err); }
      try {
        window.bindSharedDatePicker({
          rootId: 'docsEditDatePicker', triggerId: 'docsEditPeriodTrigger', panelId: 'docsEditPeriodPanel',
          startId: 'docsEditStart', endId: 'docsEditEnd', displayId: 'docsEditPeriodDisplay',
          presetsId: 'docsEditPeriodPresets', calDaysL: 'docsEditCalDaysL', calDaysR: 'docsEditCalDaysR',
          calTitleL: 'docsEditCalTitleL', calTitleR: 'docsEditCalTitleR',
          defaultPreset: null, stateKey: '__docsEditDp'
        });
      } catch (err) { console.warn('[docs] edit datepicker', err); }
    }
    if (bound) return;
    bound = true;

    var file = $('docsFile');
    var btn = $('docsBtnUpload');
    if (btn && file) {
      btn.addEventListener('click', function (e) { e.preventDefault(); file.click(); });
      file.addEventListener('change', function (e) {
        if (e.target.files && e.target.files.length) addDocs(e.target.files);
        e.target.value = '';
      });
    }
    (function bindExportMenu() {
      var btn = $('docsBtnExport');
      var menu = $('docsExportMenu');
      var wrap = $('docsExportWrap');
      if (!btn || !menu) return;
      function closeMenu() {
        menu.hidden = true;
        menu.setAttribute('hidden', '');
      }
      function openMenu() {
        menu.hidden = false;
        menu.removeAttribute('hidden');
      }
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        if (menu.hidden) openMenu(); else closeMenu();
      });
      menu.addEventListener('click', function (e) {
        var item = e.target.closest && e.target.closest('[data-export-mode]');
        if (!item) return;
        e.preventDefault();
        e.stopPropagation();
        closeMenu();
        var mode = item.getAttribute('data-export-mode');
        exportExcel(mode === 'with-images');
      });
      document.addEventListener('click', function (e) {
        if (!wrap) return;
        if (wrap.contains(e.target)) return;
        closeMenu();
      });
    })();
    var docsSearchBtn = $('btnDocsSearch');
    var docsSearchInput = $('docsSearch');
    if (docsSearchBtn) {
      docsSearchBtn.addEventListener('click', function (e) {
        e.preventDefault();
        searchKw = docsSearchInput ? (docsSearchInput.value || '').trim().toLowerCase() : '';
        renderList();
      });
    }
    if (docsSearchInput) {
      docsSearchInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
          e.preventDefault();
          searchKw = (docsSearchInput.value || '').trim().toLowerCase();
          renderList();
        }
      });
    }
    var checkAll = $('docsCheckAll');
    if (checkAll) {
      checkAll.addEventListener('change', function () {
        var on = !!checkAll.checked;
        filtered().forEach(function (d) {
          if (on) selected[d.id] = true;
          else delete selected[d.id];
        });
        renderList();
      });
    }

    var page = $('page-wh-docs');
    if (page) {
      page.addEventListener('click', function (e) {
        var previewBtn = e.target.closest && e.target.closest('[data-docs-preview]');
        if (previewBtn) { openLightboxForDoc(previewBtn.getAttribute('data-docs-preview'), 0); return; }
        var del = e.target.closest && e.target.closest('[data-docs-del]');
        if (del) {
          var id = del.getAttribute('data-docs-del');
          confirmDelete('确认删除该单据？', function () {
            /* 软删除：打标记保留在存储中 */
            docs.forEach(function (d) {
              if (d.id === id) { d.deleted = true; d.deletedAt = new Date().toISOString(); }
            });
            docs = docs.filter(function (d) { return d.id !== id; });
            delete selected[id];
            save();
            renderList();
            if (typeof toast === 'function') toast('已删除', 'success');
          });
          return;
        }
        var edit = e.target.closest && e.target.closest('[data-docs-edit]');
        if (edit) openDrawer(edit.getAttribute('data-docs-edit'));
      });
      page.addEventListener('change', function (e) {
        var cb = e.target.closest && e.target.closest('[data-docs-check]');
        if (!cb) return;
        var id = cb.getAttribute('data-docs-check');
        if (cb.checked) selected[id] = true;
        else delete selected[id];
        syncCheckAll();
        renderList();
      });
    }

    if (!window.__docsDrawerDelegate) {
      window.__docsDrawerDelegate = true;
      document.addEventListener('click', function (e) {
        var overlay = $('docsDrawerOverlay');
        if (!overlay || overlay.hidden || !overlay.classList.contains('is-open')) return;
        if (e.target === overlay) { e.preventDefault(); closeDrawer(); return; }
        var t = e.target;
        if (!t || !t.closest || !overlay.contains(t)) return;
        if (t.closest('#docsDrawerClose') || t.closest('#docsDrawerCancel')) {
          e.preventDefault(); e.stopPropagation(); closeDrawer(); return;
        }
        if (t.closest('#docsDrawerSave')) {
          e.preventDefault(); e.stopPropagation();
          try { saveDrawer(); } catch (err) { console.warn(err); closeDrawer(); }
          return;
        }
        if (t.closest('#docsImgAddBtn')) {
          e.preventDefault(); e.stopPropagation();
          if ($('docsEditFile')) $('docsEditFile').click();
          return;
        }
        var delImg = t.closest('[data-img-idx]');
        if (delImg) {
          e.preventDefault(); e.stopPropagation();
          var i = parseInt(delImg.getAttribute('data-img-idx'), 10);
          confirmDelete('确认删除该图片？', function () {
            if (!isNaN(i)) { editImages.splice(i, 1); renderEditImages(true); }
          });
          return;
        }
        var pv = t.closest('[data-edit-preview]');
        if (pv) {
          e.preventDefault();
          var pi = parseInt(pv.getAttribute('data-edit-preview'), 10);
          openLightbox(editImages, isNaN(pi) ? 0 : pi);
        }
      }, true);

      var editFile = $('docsEditFile');
      if (editFile && !editFile.__docsBound) {
        editFile.__docsBound = true;
        editFile.addEventListener('change', function (e) {
          var files = e.target.files ? Array.prototype.slice.call(e.target.files) : [];
          e.target.value = '';
          if (!files.length) return;
          var skipped = [];
          Promise.all(files.map(function (f) {
            return hashFile(f).then(function (hash) { return { file: f, hash: hash }; });
          })).then(function (items) {
            var pending = items.length;
            if (!pending) return;
            function finish() {
              renderEditImages(true);
              if (skipped.length) {
                alertDup('以下图片未添加：\n\n' + skipped.slice(0, 10).join('\n') + (skipped.length > 10 ? '\n…' : ''));
              }
            }
            items.forEach(function (it) {
              var f = it.file;
              if (isFileNameTaken(f.name, editingId) ||
                  editImages.some(function (im) { return normalizeKey(im.fileName) === normalizeKey(f.name); })) {
                skipped.push(f.name + '（文件名重复）');
                pending--;
                if (pending === 0) finish();
                return;
              }
              if (it.hash && (isHashTaken(it.hash, editingId) ||
                  editImages.some(function (im) { return im.hash && im.hash === it.hash; }))) {
                skipped.push(f.name + '（图片内容重复）');
                pending--;
                if (pending === 0) finish();
                return;
              }
              readImageAsDataUrl(f, function (err, dataUrl) {
                pending--;
                if (!err && dataUrl) editImages.push({ dataUrl: dataUrl, fileName: f.name, hash: it.hash });
                if (pending === 0) finish();
              });
            });
          });
        });
      }
    }

    if (!window.__docsLightboxDelegate) {
      window.__docsLightboxDelegate = true;
      document.addEventListener('click', function (e) {
        var lb = $('docsLightbox');
        if (!lb || lb.hidden || !lb.classList.contains('is-open')) return;
        var t = e.target;
        if (!t || !t.closest) return;
        /* 关闭 */
        if (t.closest('#docsLbClose')) {
          e.preventDefault(); e.stopPropagation();
          closeLightbox();
          return;
        }
        if (t.closest('#docsLbPrev')) {
          e.preventDefault(); e.stopPropagation();
          if (!lbList.length) return;
          lbIndex = (lbIndex - 1 + lbList.length) % lbList.length;
          lbScale = 1; paintLightbox();
          return;
        }
        if (t.closest('#docsLbNext')) {
          e.preventDefault(); e.stopPropagation();
          if (!lbList.length) return;
          lbIndex = (lbIndex + 1) % lbList.length;
          lbScale = 1; paintLightbox();
          return;
        }
        if (t.closest('#docsLbZoomIn')) {
          e.preventDefault(); e.stopPropagation();
          lbScale = Math.min(4, Math.round((lbScale + 0.25) * 100) / 100);
          paintLightbox();
          return;
        }
        if (t.closest('#docsLbZoomOut')) {
          e.preventDefault(); e.stopPropagation();
          lbScale = Math.max(0.5, Math.round((lbScale - 0.25) * 100) / 100);
          paintLightbox();
          return;
        }
        if (t.closest('#docsLbZoomReset')) {
          e.preventDefault(); e.stopPropagation();
          lbScale = 1; paintLightbox();
          return;
        }
        /* 点遮罩空白关闭（避开按钮与图片） */
        if (t === lb) {
          e.preventDefault();
          closeLightbox();
        }
      }, true);

      document.addEventListener('keydown', function (e) {
        var lbEl = $('docsLightbox');
        if (lbEl && !lbEl.hidden && lbEl.classList.contains('is-open')) {
          if (e.key === 'Escape') { closeLightbox(); return; }
          if (e.key === 'ArrowLeft') {
            if (!lbList.length) return;
            lbIndex = (lbIndex - 1 + lbList.length) % lbList.length;
            lbScale = 1; paintLightbox(); return;
          }
          if (e.key === 'ArrowRight') {
            if (!lbList.length) return;
            lbIndex = (lbIndex + 1) % lbList.length;
            lbScale = 1; paintLightbox(); return;
          }
        }
        if (e.key === 'Escape' && $('docsDrawerOverlay') && !$('docsDrawerOverlay').hidden &&
            $('docsDrawerOverlay').classList.contains('is-open')) closeDrawer();
      });

      var lbRoot = $('docsLightbox');
      if (lbRoot && !lbRoot.__wheelBound) {
        lbRoot.__wheelBound = true;
        lbRoot.addEventListener('wheel', function (e) {
          if (lbRoot.hidden) return;
          e.preventDefault();
          if (e.deltaY < 0) lbScale = Math.min(4, lbScale + 0.1);
          else lbScale = Math.max(0.5, lbScale - 0.1);
          paintLightbox();
        }, { passive: false });
      }
    }
  }

  function render() {
    load();
    bind();
    renderList();
  }
  window.DocsModule = { render: render };
})();



function normalizeFinImageList(list) {
  if (!list) return [];
  if (!Array.isArray(list)) list = [list];
  return list.map(function (img) {
    if (!img) return null;
    if (typeof img === 'string') {
      var s = img.trim();
      if (!s) return null;
      return { dataUrl: s, fileName: 'image' };
    }
    var url = img.dataUrl || img.url || img.src || '';
    if (!url) return null;
    return {
      dataUrl: url,
      fileName: img.fileName || img.name || 'image',
      hash: img.hash || ''
    };
  }).filter(Boolean);
}
function finImagesForRecord(rec, kind) {
  if (!rec) return [];
  var list = [];
  if (kind === 'invoice') list = rec.invoiceImages;
  else if (kind === 'other') list = rec.otherImages;
  else list = rec.payImages;
  list = normalizeFinImageList(list);
  if (!list.length) list = normalizeFinImageList(rec.images);
  return list;
}

/* 多图预览：缩放 / 切换 */
function openImageViewer(images, startIndex) {
  var list = [];
  (images || []).forEach(function (x) {
    if (!x) return;
    if (typeof x === 'string') {
      if (x.trim()) list.push({ dataUrl: x.trim() });
      return;
    }
    var url = x.dataUrl || x.url || x.src || '';
    if (url) list.push({ dataUrl: url, fileName: x.fileName || x.name || '' });
  });
  if (!list.length) return;
  var idx = Math.max(0, Math.min(startIndex || 0, list.length - 1));
  var scale = 1;
  var old = document.getElementById('finImgViewer');
  if (old) old.remove();
  var box = document.createElement('div');
  box.id = 'finImgViewer';
  box.className = 'fin-viewer';
  box.innerHTML =
    '<button type="button" class="fin-viewer-side fin-viewer-prev" data-v="prev" aria-label="上一张">‹</button>' +
    '<div class="fin-viewer-stage"><img alt="预览" draggable="false" /></div>' +
    '<button type="button" class="fin-viewer-side fin-viewer-next" data-v="next" aria-label="下一张">›</button>' +
    '<div class="fin-viewer-toolbar">' +
      '<button type="button" data-v="out">缩小</button>' +
      '<button type="button" data-v="in">放大</button>' +
      '<button type="button" data-v="reset">还原</button>' +
      '<span class="fin-viewer-idx"></span>' +
      '<button type="button" data-v="close">关闭</button>' +
    '</div>';
  document.body.appendChild(box);
  document.body.style.overflow = 'hidden';
  var img = box.querySelector('.fin-viewer-stage img');
  var idxEl = box.querySelector('.fin-viewer-idx');
  var panX = 0, panY = 0;
  var dragging = false;
  var dragStartX = 0, dragStartY = 0, originX = 0, originY = 0;
  function applyTransform() {
    img.style.transform = 'translate(' + panX + 'px,' + panY + 'px) scale(' + scale + ')';
  }
  function paint() {
    img.src = list[idx].dataUrl;
    applyTransform();
    idxEl.textContent = (idx + 1) + ' / ' + list.length;
    var prev = box.querySelector('[data-v="prev"]');
    var next = box.querySelector('[data-v="next"]');
    if (prev) {
      prev.style.visibility = 'visible';
      prev.disabled = list.length <= 1;
      prev.style.opacity = list.length <= 1 ? '0.35' : '1';
    }
    if (next) {
      next.style.visibility = 'visible';
      next.disabled = list.length <= 1;
      next.style.opacity = list.length <= 1 ? '0.35' : '1';
    }
  }
  function close() {
    box.remove();
    document.body.style.overflow = '';
    document.removeEventListener('keydown', onKey);
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
  }
  function onKey(e) {
    if (e.key === 'Escape') close();
    else if (e.key === 'ArrowLeft') { idx = (idx - 1 + list.length) % list.length; scale = 1; panX = 0; panY = 0; paint(); }
    else if (e.key === 'ArrowRight') { idx = (idx + 1) % list.length; scale = 1; panX = 0; panY = 0; paint(); }
  }
  function onMove(e) {
    if (!dragging) return;
    panX = originX + (e.clientX - dragStartX);
    panY = originY + (e.clientY - dragStartY);
    applyTransform();
  }
  function onUp() {
    if (!dragging) return;
    dragging = false;
    img.classList.remove('is-dragging');
  }
  paint();
  img.addEventListener('mousedown', function (e) {
    if (e.button !== 0) return;
    e.preventDefault();
    dragging = true;
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    originX = panX;
    originY = panY;
    img.classList.add('is-dragging');
  });
  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onUp);
  box.addEventListener('click', function (e) {
    var act = e.target.getAttribute && e.target.getAttribute('data-v');
    if (e.target === box || e.target.classList.contains('fin-viewer-stage')) { close(); return; }
    if (act === 'close') close();
    else if (act === 'prev') { idx = (idx - 1 + list.length) % list.length; scale = 1; panX = 0; panY = 0; paint(); }
    else if (act === 'next') { idx = (idx + 1) % list.length; scale = 1; panX = 0; panY = 0; paint(); }
    else if (act === 'in') { scale = Math.min(5, scale + 0.25); applyTransform(); }
    else if (act === 'out') { scale = Math.max(0.4, scale - 0.25); applyTransform(); }
    else if (act === 'reset') { scale = 1; panX = 0; panY = 0; applyTransform(); }
  });
  box.addEventListener('wheel', function (e) {
    e.preventDefault();
    scale = Math.max(0.4, Math.min(5, scale + (e.deltaY < 0 ? 0.12 : -0.12)));
    applyTransform();
  }, { passive: false });
  document.addEventListener('keydown', onKey);
}
window.openImageViewer = openImageViewer;

/* ========== finance-ledger module ========== */
(function () {
  'use strict';
  var BASE_KEY = 'cmg_finance_ledger_v1';
  var records = [];
  var sources = [];
  var reserve = 0;
  var reservePeriods = [];
  var finReserveEditId = null;
  var bound = false;
  var pendingImages = []; /* 兼容旧逻辑：合并三类图片 */
  var pendingPayImages = [];
  var pendingInvoiceImages = [];
  var pendingOtherImages = [];
  var editingId = null;
  var editPendingImages = [];
  var editPendingPayImages = [];
  var editPendingInvoiceImages = [];
  var editPendingOtherImages = [];
  var currentView = 'board';
  var filterOperator = '';
  var filterReviewStatus = '';
  var filterReimburse = '';
  var dateSort = 'desc';
  var filterStart = '';
  var filterEnd = '';
  var listPager = null;
  var filteredCache = [];
  var selectedIds = {}; /* 批量多选：id -> true */
  var REVIEW_VIEWS = ['pending', 'progress', 'passed', 'rejected', 'done'];

  function $(id) { return document.getElementById(id); }
  /* 备用金/审核数据改为账号间共享：审核人登录后才能看到登记人提交的待审单。
     旧版按用户隔离的 key（BASE_KEY__u_xxx）在首次加载时自动合并进共享库。 */
  function storeKey() {
    return BASE_KEY + '__shared';
  }
  function legacyUserStoreKey() {
    return (window.CMGUserStore && CMGUserStore.key) ? CMGUserStore.key(BASE_KEY) : (BASE_KEY + '__u__anon');
  }
  function mergeFinancePayload(into, from) {
    if (!from) return into;
    into.reserve = Math.max(Number(into.reserve) || 0, Number(from.reserve) || 0);
    var seenR = {};
    (into.records || []).forEach(function (r) { if (r && r.id) seenR[r.id] = true; });
    (from.records || []).forEach(function (r) {
      if (!r || !r.id || seenR[r.id]) return;
      seenR[r.id] = true;
      into.records.push(r);
    });
    var seenS = {};
    (into.sources || []).forEach(function (s) { if (s && s.id) seenS[s.id] = true; });
    (from.sources || []).forEach(function (s) {
      if (!s || !s.id || seenS[s.id]) return;
      seenS[s.id] = true;
      into.sources.push(s);
    });
    return into;
  }
  function collectLegacyFinanceData() {
    var merged = { reserve: 0, records: [], sources: [] };
    try {
      var keys = [];
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (!k) continue;
        if (k === BASE_KEY || k.indexOf(BASE_KEY + '__u_') === 0) keys.push(k);
      }
      keys.forEach(function (k) {
        try {
          var raw = localStorage.getItem(k);
          if (!raw) return;
          mergeFinancePayload(merged, JSON.parse(raw));
        } catch (e1) {}
      });
    } catch (e) {}
    return merged;
  }
  /* 软删除：deleted 记录与来源保留在存储中，仅在内存里分区隔离。
     加载时拆出墓碑，保存时合并写回，避免逐处补 !deleted 判断漏改 */
  var deletedRecords = [];
  var deletedSources = [];
  var dataLoaded = false;
  function ensureLoaded() {
    if (dataLoaded) return;
    /* 异步拉取完成后再标记已加载，避免刷新时先用空数据渲染 */
    if (typeof loadAsync === 'function') {
      loadAsync().then(function () {
        dataLoaded = true;
        try {
          updateStats(); updatePendingBadge();
          if (typeof renderReservePeriods === 'function') renderReservePeriods();
          if (typeof renderSources === 'function') renderSources();
          if (currentView === 'records') refreshList();
          if (currentView === 'board') renderCharts();
          if (REVIEW_VIEWS.indexOf(currentView) >= 0) renderReview();
        } catch (eU) {}
      }).catch(function () { dataLoaded = true; });
      return;
    }
    load();
    dataLoaded = true;
  }
  function applyFinanceData(data) {
    deletedRecords = []; deletedSources = [];
    if (!data) { records = []; sources = []; reserve = 0; reservePeriods = []; return; }
    reserve = Number(data.reserve) || 0;
    reservePeriods = Array.isArray(data.reservePeriods)
      ? data.reservePeriods
      : (Array.isArray(data.periods) ? data.periods : []);
    /* 规范化周期字段，避免 start/end 丢失导致列表空白 */
    reservePeriods = reservePeriods.map(function (p) {
      if (!p) return null;
      return {
        id: p.id || ('rp_' + Date.now()),
        amount: Number(p.amount) || 0,
        start: p.start || p.startDate || '',
        end: p.end || p.endDate || p.start || p.startDate || ''
      };
    }).filter(Boolean);
    try { syncReserveTotal(); } catch (eSync) {}
    var allRecords = Array.isArray(data.records) ? data.records : [];
    var allSources = Array.isArray(data.sources) ? data.sources : [];
    records = []; sources = [];
    allRecords.forEach(function (r) {
      if (r.deleted) { deletedRecords.push(r); return; }
      if (!r.reviewStatus) r.reviewStatus = 'pending';
      r.reviewHidden = !!r.reviewHidden;
      r.reimbursed = isReimbursed(r);
      /* 兼容服务端 JSON：统一图片结构，并补齐 images 聚合便于预览 */
      r.payImages = normalizeFinImageList(r.payImages);
      r.invoiceImages = normalizeFinImageList(r.invoiceImages);
      r.otherImages = normalizeFinImageList(r.otherImages);
      r.images = normalizeFinImageList(r.images).concat(r.payImages, r.invoiceImages, r.otherImages);
      /* 去重 by dataUrl */
      var seen = {};
      r.images = r.images.filter(function (im) {
        var k = im.dataUrl;
        if (seen[k]) return false;
        seen[k] = true;
        return true;
      });
      records.push(r);
    });
    allSources.forEach(function (s) {
      if (s.deleted) { deletedSources.push(s); return; }
      try { ensureSourceBoundAt(s); } catch (eB) {}
      sources.push(s);
    });
  }
  function load() {
    deletedRecords = []; deletedSources = [];
    /* 优先从数据库拉取；失败时不回退写 localStorage */
    if (typeof CMGApi !== 'undefined' && CMGApi.getFinanceLedger && CMGApi.getMode && CMGApi.getMode() === 'http') {
      CMGApi.getFinanceLedger().then(function (data) {
        applyFinanceData(data);
        dataLoaded = true;
        try {
          if (typeof window !== 'undefined' && window.FinanceModule && typeof FinanceModule.render === 'function') {
            /* 数据到达后刷新当前视图 */
          }
        } catch (eR) {}
      }).catch(function (err) {
        if (typeof toast === 'function') {
          var em = (err && err.message) || String(err);
          if (err && err.status === 401) em = '登录已失效，请重新登录';
          toast('加载失败：' + em, 'warning');
        }
        records = []; sources = []; reserve = 0; reservePeriods = [];
      });
      return;
    }
    records = []; sources = []; reserve = 0; reservePeriods = [];
  }
  function loadAsync() {
    try {
      var s = (window.Auth && Auth.current) ? Auth.current() : null;
      if ((!s || !s.token) && typeof sessionStorage !== 'undefined') {
        try {
          var raw = sessionStorage.getItem(SESSION_KEY || 'cmg_session_v1');
          if (raw) s = JSON.parse(raw);
        } catch (e0) {}
      }
      if (s && s.token && String(s.token).split('.').length === 3 && typeof CMGApi !== 'undefined' && CMGApi.setToken) {
        CMGApi.setToken(s.token);
        if (CMGApi.setMode) CMGApi.setMode('http');
      }
    } catch (e1) {}
    if (typeof CMGApi !== 'undefined' && CMGApi.getFinanceLedger && CMGApi.getMode && CMGApi.getMode() === 'http') {
      return CMGApi.getFinanceLedger().then(function (data) {
        applyFinanceData(data);
        dataLoaded = true;
        try {
          if (typeof renderReservePeriods === 'function') renderReservePeriods();
          if (typeof renderSources === 'function') renderSources();
          if (typeof updateStats === 'function') updateStats();
        } catch (eUi) {}
        return data;
      }).catch(function (err) {
        if (typeof toast === 'function') {
          var em = (err && err.message) || String(err);
          if (err && err.status === 401) em = '登录已失效，请重新登录';
          toast('加载失败：' + em, 'warning');
        }
        return null;
      });
    }
    applyFinanceData(null);
    dataLoaded = true;
    return Promise.resolve(null);
  }
  /**
   * @param {{ successMsg?: string, silent?: boolean, failMsg?: string }} [opts]
   * successMsg 例：'已保存' | '已删除' | '已删除来源'
   */
  function save(opts) {
    opts = opts || {};
    var successMsg = opts.successMsg || '已保存';
    var silent = !!opts.silent;
    var body = {
      reserve: reserve,
      reservePeriods: reservePeriods,
      records: records.concat(deletedRecords),
      sources: sources.concat(deletedSources),
      shared: true,
      updatedBy: (window.CMGUserStore && CMGUserStore.currentUserKey()) || '',
      updatedAt: new Date().toISOString()
    };
    /* 仅同步 JWT（含两个点的三段式），禁止把本地随机 session.token 写入 Authorization */
    try {
      var s = (window.Auth && Auth.current) ? Auth.current() : null;
      var cand = (s && s.token) || (typeof CMGApi !== 'undefined' && CMGApi.getToken && CMGApi.getToken()) || '';
      if (cand && String(cand).split('.').length === 3 && typeof CMGApi !== 'undefined' && CMGApi.setToken) {
        CMGApi.setToken(cand);
      }
    } catch (e0) {}
    var rawTok = (typeof CMGApi !== 'undefined' && CMGApi.getToken) ? CMGApi.getToken() : '';
    var hasToken = !!(rawTok && String(rawTok).split('.').length === 3);
    if (typeof CMGApi !== 'undefined' && CMGApi.putFinanceLedger && CMGApi.getMode && CMGApi.getMode() === 'http') {
      if (!hasToken) {
        if (typeof toast === 'function') {
          toast('登录已失效，请重新登录', 'error');
        }
        return;
      }
      return CMGApi.putFinanceLedger(body).then(function () {
        if (!silent && typeof toast === 'function') toast(successMsg, 'success');
        return { ok: true };
      }).catch(function (err) {
        var msg = (err && err.message) || String(err);
        if (err && (err.status === 401 || /unauthor/i.test(msg))) {
          msg = '登录已失效，请重新登录后再试';
        }
        if (typeof toast === 'function') toast((opts.failMsg || '操作失败') + '：' + msg, 'error');
        return { ok: false, error: msg };
      });
    }
    if (typeof toast === 'function') toast('操作失败，请检查网络后重试', 'error');
    return Promise.resolve({ ok: false, error: 'offline' });
  }
  /* 有效记录：所有统计 / 列表 / 图表均基于此，已删除记录不参与 */
  function activeRecords() {
    return records;
  }
  function findRecordAny(id) {
    var i;
    for (i = 0; i < records.length; i++) if (records[i].id === id) return records[i];
    for (i = 0; i < deletedRecords.length; i++) if (deletedRecords[i].id === id) return deletedRecords[i];
    return null;
  }
  function money(n) {
    return '¥' + (Number(n) || 0).toFixed(2);
  }
  function currentUser() {
    try {
      if (window.Auth && typeof Auth.current === 'function') {
        var s = Auth.current();
        if (s && s.username) return String(s.username);
      }
    } catch (e) {}
    return '—';
  }
  function normName(v) {
    return String(v == null ? '' : v)
      .replace(/[\u200B-\u200D\uFEFF]/g, '')
      .trim()
      .toLowerCase();
  }
  function currentUserNorm() {
    return normName(currentUser());
  }
  function isAdminUser() {
    try {
      if (window.Auth && typeof Auth.current === 'function') {
        var s = Auth.current();
        var r = String((s && s.role) || '').toLowerCase();
        /* 超级管理员与普通管理员可看全部待审；账号管理仍仅超管 */
        if (r === 'admin' || r === 'super_admin') return true;
      }
    } catch (e) {}
    return false;
  }
  /* 审核人字段必须与登录账号名称完全对应（规范化后相等） */
  function auditorMatchesMe(r) {
    var aud = normName(r && r.auditor);
    var me = currentUserNorm();
    if (!aud || !me || me === '—' || me === '-') return false;
    return aud === me;
  }
  function isRecordOperator(r) {
    var me = currentUserNorm();
    if (!me || me === '—' || me === '-') return false;
    var op = normName(r && r.operator);
    if (op && op === me) return true;
    return false;
  }
  /**
   * 审核中心可见性（安全关键）：
   * - 待审 pending：仅指定审核人；管理员可看全部待审
   * - 驳回修改：指定审核人 + 原提交人（改单重提）
   * - 已通过/驳回终止：指定审核人、实际操作审核人、原提交人、管理员
   * 其它账号一律不可见
   */
  function canSeeReviewRecord(r) {
    if (!r || r.deleted) return false;
    var st = r.reviewStatus || 'pending';
    var me = currentUserNorm();
    if (!me || me === '—' || me === '-') return false;

    if (st === 'pending' || st === 'in_review') {
      if (auditorMatchesMe(r)) return true;
      if (isAdminUser()) return true;
      return false;
    }
    if (st === 'rejected' && r.reviewNeedRevise) {
      if (auditorMatchesMe(r) || isRecordOperator(r) || isAdminUser()) return true;
      return false;
    }
    /* 已终态 */
    if (auditorMatchesMe(r) || isRecordOperator(r) || isAdminUser()) return true;
    var reviewer = normName(r.reviewer || r.reviewedBy);
    if (reviewer && reviewer === me) return true;
    return false;
  }
  /** 仅指定审核人（或管理员）可对「待审」执行通过/驳回 */
  function canActOnPending(r) {
    if (!r || r.deleted) return false;
    var st = r.reviewStatus || 'pending';
    if (st !== 'pending' && st !== 'in_review') return false;
    if (auditorMatchesMe(r)) return true;
    if (isAdminUser()) return true;
    return false;
  }
  /**
   * 使用记录/导出：待审单据仅审核人、提交人、管理员可见，防止其它账号在列表中窥探待审内容
   */
  function canSeeLedgerRecord(r) {
    if (!r || r.deleted) return false;
    if (isAdminUser()) return true;
    var st = r.reviewStatus || 'pending';
    if (st === 'pending' || st === 'in_review') {
      return auditorMatchesMe(r) || isRecordOperator(r);
    }
    if (st === 'rejected' && r.reviewNeedRevise) {
      return auditorMatchesMe(r) || isRecordOperator(r);
    }
    /* 已审结：有备用金权限的账号可查账（业务需要）；敏感待审已在上面拦截 */
    return true;
  }
  function isReimbursed(r) {
    return !!(r && (r.reimbursed === true || r.reimbursed === 1 || r.reimbursed === '1' || r.reimbursed === 'true'));
  }
  function totalUsed() {
    return records.reduce(function (s, r) {
      if (isReimbursed(r)) return s;
      return s + (Number(r.amount) || 0);
    }, 0);
  }
  function reimbursedTotal() {
    return records.reduce(function (s, r) {
      if (!isReimbursed(r)) return s;
      return s + (Number(r.amount) || 0);
    }, 0);
  }
  function balance() {
    var bal = Math.round((reserve - totalUsed()) * 100) / 100;
    if (bal > reserve) bal = reserve;
    return bal;
  }
  function escapeHtml(s) {
    return String(s || '').replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  }
  function formatDateRange(a, b) {
    if (!a) return '—';
    function cn(v) {
      var p = String(v).split('-');
      if (p.length < 3) return v;
      return p[0] + '/' + parseInt(p[1], 10) + '/' + parseInt(p[2], 10);
    }
    if (!b || b === a) return cn(a);
    return cn(a) + ' ~ ' + cn(b);
  }
  function updateStats() {
    var q = $('finStatQuota'), u = $('finStatUsed'), b = $('finStatBalance');
    var qf = $('finStatQuotaFoot'), uf = $('finStatUsedFoot'), bf = $('finStatBalanceFoot');
    var qs = $('finStatQuotaSide'), us = $('finStatUsedSide'), bs = $('finStatBalanceSide');
    var used = totalUsed(), bal = balance(), reb = reimbursedTotal();
    var rebCount = records.filter(function (r) { return isReimbursed(r); }).length;
    var openCount = Math.max(0, records.length - rebCount);
    var pct = reserve > 0 ? Math.round((used / reserve) * 1000) / 10 : 0;
    var balPct = reserve > 0 ? Math.round((bal / reserve) * 1000) / 10 : 0;
    var active = null;
    try { active = getActiveReservePeriod(); } catch (eP) { active = null; }
    var periodText = active ? periodLabel(active) : '未设周期';
    var srcCount = Array.isArray(sources) ? sources.filter(function (s) { return s && !s.deleted; }).length : 0;
    if (q) q.textContent = money(reserve);
    if (u) u.textContent = money(used);
    if (b) b.textContent = money(bal);
    if (qf) qf.textContent = reserve > 0 ? '已设置额度（固定）' : '尚未设置额度';
    if (uf) uf.textContent = '共 ' + records.length + ' 笔';
    if (bf) bf.textContent = '定额 − 未报销支出';
    if (qs) {
      qs.innerHTML =
        '<span><em>周期</em><b>' + escapeHtml(periodText) + '</b></span>' +
        '<span><em>来源</em><b>' + srcCount + ' 个</b></span>' +
        '<span><em>已用</em><b>' + pct + '%</b></span>';
    }
    if (us) {
      us.innerHTML =
        '<span><em>未报销</em><b>' + openCount + ' 笔</b></span>' +
        '<span><em>已报销</em><b>' + rebCount + ' 笔</b></span>' +
        '<span><em>回流</em><b>' + money(reb) + '</b></span>';
    }
    if (bs) {
      bs.innerHTML =
        '<span><em>余额占比</em><b>' + balPct + '%</b></span>' +
        '<span><em>已占用</em><b>' + money(used) + '</b></span>' +
        '<span><em>已回流</em><b>' + money(reb) + '</b></span>';
    }
    var ab = $('finAmountBalance');
    if (ab) ab.textContent = money(bal);
    var card = $('finStatBalanceCard');
    if (card) card.classList.toggle('is-low', bal < 0);
  }

  /* —— charts —— */
  function countBy(field) {
    var map = {};
    records.forEach(function (r) {
      if (!canSeeLedgerRecord(r)) return;
      var k = String(r[field] || '').trim() || '未填写';
      map[k] = (map[k] || 0) + 1;
    });
    return Object.keys(map).map(function (k) { return { label: k, value: map[k] }; })
      .sort(function (a, b) { return b.value - a.value; });
  }
  function timeSeries() {
    var map = {};
    records.forEach(function (r) {
      if (!canSeeLedgerRecord(r)) return;
      var d = String(r.dateStart || '').slice(0, 10);
      if (!d) return;
      map[d] = (map[d] || 0) + 1;
    });
    return Object.keys(map).sort().map(function (k) { return { x: k, y: map[k] }; });
  }

  /* ---------- GitHub 式年度热力图 ---------- */
  var HEAT_MONTHS = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
  var HEAT_DAYS = ['一', '二', '三', '四', '五', '六', '日'];
  var heatYear = null;      /* 当前展示年份 */
  var heatCells = [];       /* 年份下拉选项缓存 */

  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function heatLevel(n) {
    /* 0 = 空；1~4 笔 = 浅；5~9 = 中；10+ = 深 */
    if (n <= 0) return 0;
    if (n <= 2) return 1;
    if (n <= 5) return 2;
    if (n <= 9) return 3;
    return 4;
  }
  /** 热力图年份：仅系统当前年及往前共 3 年（如 2026 → 2026/2025/2024） */
  function availableHeatYears() {
    var nowY = new Date().getFullYear();
    var years = [];
    for (var i = 0; i < 3; i++) years.push(String(nowY - i));
    return years;
  }
  function defaultHeatYear(years) {
    var now = String(new Date().getFullYear());
    if (years.indexOf(now) >= 0) return now;
    /* 当前年不在列表时（极少见）取最近有数据或列表首项 */
    var withData = {};
    records.forEach(function (r) {
      var d = String(r.dateStart || '').slice(0, 4);
      if (/^\d{4}$/.test(d)) withData[d] = true;
    });
    for (var i = 0; i < years.length; i++) {
      if (withData[years[i]]) return years[i];
    }
    return years[0] || now;
  }
  function renderHeatmap() {
    var box = $('finChartTime');
    var yearsEl = $('finHeatYears');
    if (!box) return;
    heatCells = availableHeatYears();
    if (!heatYear || heatCells.indexOf(String(heatYear)) < 0) {
      heatYear = defaultHeatYear(heatCells);
    }

    if (yearsEl) {
      yearsEl.innerHTML = heatCells.map(function (y) {
        var hasData = records.some(function (r) {
          return String(r.dateStart || '').slice(0, 4) === String(y);
        });
        return '<button type="button" class="fin-heat-year' +
          (String(y) === String(heatYear) ? ' is-active' : '') +
          (hasData ? ' has-data' : '') +
          '" data-heat-year="' + y + '" title="' + (hasData ? y + ' 年（有登记）' : y + ' 年（暂无登记）') + '">' +
          y + '</button>';
      }).join('');
    }

    /* 当年每日登记次数（仅统计当前用户有权可见的记录） */
    var byDate = {};
    var total = 0;
    records.forEach(function (r) {
      if (!canSeeLedgerRecord(r)) return;
      var d = String(r.dateStart || '').slice(0, 10);
      if (d.slice(0, 4) !== String(heatYear)) return;
      byDate[d] = (byDate[d] || 0) + 1;
      total++;
    });

    var year = Number(heatYear);
    var first = new Date(year, 0, 1);
    /* 周一为一周之首：对齐到 1 月 1 日所在周的周一 */
    var lead = (first.getDay() + 6) % 7;
    var start = new Date(year, 0, 1 - lead);
    var monthLabels = [];
    var weeksHtml = [];
    var cursor = new Date(start.getTime());
    var guard = 0;

    while (guard++ < 60) {
      var weekCells = [];
      var monthMark = '';
      for (var d = 0; d < 7; d++) {
        var y = cursor.getFullYear(), m = cursor.getMonth(), day = cursor.getDate();
        var iso = y + '-' + pad2(m + 1) + '-' + pad2(day);
        var outside = (y !== year);
        var cnt = byDate[iso] || 0;
        if (!outside && cursor.getDate() === 1) monthMark = HEAT_MONTHS[m];
        weekCells.push(
          '<i class="fin-heat-cell lv' + heatLevel(cnt) + (outside ? ' is-out' : '') + '"' +
          (outside ? '' : ' title="' + iso + ' · ' + cnt + ' 笔登记" data-date="' + iso + '" data-count="' + cnt + '"') +
          '></i>'
        );
        cursor = new Date(cursor.getTime());
        cursor.setDate(cursor.getDate() + 1);
      }
      if (monthMark) {
        monthLabels.push('<span class="fin-heat-month" style="left:' + ((weeksHtml.length / 53) * 100) + '%">' + monthMark + '</span>');
      }
      weeksHtml.push('<div class="fin-heat-week">' + weekCells.join('') + '</div>');
      if (cursor.getFullYear() > year && cursor.getMonth() === 0) break;
    }

    var scale = [0, 1, 2, 3, 4].map(function (lv) {
      return '<i class="fin-heat-cell lv' + lv + '"></i>';
    }).join('');

    box.innerHTML =
      '<div class="fin-heat">' +
        '<div class="fin-heat-summary">' + total + ' 笔登记记录于 ' + escapeHtml(String(heatYear)) + ' 年</div>' +
        '<div class="fin-heat-scroll">' +
          '<div class="fin-heat-months">' + (monthLabels.join('') || '<span class="fin-heat-month">1月</span>') + '</div>' +
          '<div class="fin-heat-body">' +
            '<div class="fin-heat-days">' +
              HEAT_DAYS.map(function (d, i) {
                return '<span>' + ((i === 0 || i === 2 || i === 4) ? d : '') + '</span>';
              }).join('') +
            '</div>' +
            '<div class="fin-heat-weeks">' + weeksHtml.join('') + '</div>' +
          '</div>' +
        '</div>' +
        '<div class="fin-heat-foot">' +
          '<span class="fin-heat-scale">少' + scale + '多</span>' +
        '</div>' +
      '</div>';
  }

  function renderCharts() {
    var userEl = $('finChartUser');
    var audEl = $('finChartAuditor');
    var users = countBy('userName');
    var auds = countBy('auditor');

    /* 环形图：传入固定尺寸，配合 CSS 的 .fin-chart-plot 约束避免 SVG 撑满容器 */
    function donut(data, palette, plotElId, legendElId) {
      var plot = $(plotElId), legend = $(legendElId);
      var segs = data.slice(0, 8).map(function (u, i) {
        return { value: u.value, color: palette[i % palette.length], label: u.label };
      });
      if (!segs.length) segs = [{ value: 1, color: '#e5e5e5', label: '暂无' }];
      if (plot) plot.innerHTML = dashChartSvg(segs, { hole: 0.62, size: 168 });
      /* 图例独立渲染：色块 + 名称 + 笔数 + 占比，避免文字挤在图表内部 */
      var top = data.slice(0, 6);
      var sum = data.reduce(function (s, u) { return s + u.value; }, 0);
      if (legend) {
        legend.innerHTML = top.length
          ? top.map(function (u, i) {
              var pct = sum > 0 ? Math.round((u.value / sum) * 100) : 0;
              return '<span class="fin-legend-item">' +
                '<i class="fin-legend-dot" style="background:' + palette[i % palette.length] + '"></i>' +
                '<span class="fin-legend-name">' + escapeHtml(u.label) + '</span>' +
                '<span class="fin-legend-value">' + u.value + ' 笔</span>' +
                '<span class="fin-legend-pct">' + pct + '%</span>' +
                '</span>';
            }).join('')
          : '<span class="fin-legend-empty">暂无登记记录</span>';
      }
    }

    if (typeof dashChartSvg === 'function') {
      donut(users, ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4', '#84cc16', '#f97316'],
        'finChartUser', 'finChartUserLegend');
      donut(auds, ['#6366f1', '#14b8a6', '#eab308', '#ec4899', '#0ea5e9', '#22c55e', '#a855f7', '#f43f5e'],
        'finChartAuditor', 'finChartAuditorLegend');
    } else {
      if (userEl) userEl.innerHTML = '<div class="fin-empty-cell">暂无图表组件</div>';
    }

    renderHeatmap();
  }

  function getFiltered() {
    return records.filter(function (r) {
      /* 待审单据不向非指定审核人/提交人泄露 */
      if (!canSeeLedgerRecord(r)) return false;
      if (filterOperator) {
        var who = String(r.userName || r.operator || '').trim();
        if (who !== filterOperator) return false;
      }
      if (filterReviewStatus) {
        var st = r.reviewStatus || 'pending';
        if (filterReviewStatus === 'terminated') {
          if (!(st === 'rejected' && r.reviewTerminate)) return false;
        } else if (filterReviewStatus === 'in_review') {
          if (st !== 'in_review' && st !== 'progress') return false;
        } else if (filterReviewStatus === 'rejected') {
          if (st !== 'rejected' || r.reviewTerminate) return false;
        } else if (st !== filterReviewStatus) {
          return false;
        }
      }
      if (filterReimburse === 'yes' && !isReimbursed(r)) return false;
      if (filterReimburse === 'no' && isReimbursed(r)) return false;
      var d = String(r.dateStart || '').slice(0, 10);
      if (filterStart && d < filterStart) return false;
      if (filterEnd && d > filterEnd) return false;
      return true;
    }).sort(function (a, b) {
      var da = String(a.dateStart || '');
      var db = String(b.dateStart || '');
      if (da === db) return 0;
      return dateSort === 'asc' ? (da < db ? -1 : 1) : (da > db ? -1 : 1);
    });
  }
  function fillOperatorFilter() {
    var sel = $('finFilterOperator');
    if (!sel) return;
    var ops = {};
    records.forEach(function (r) {
      /* 与列表「操办人」列一致：优先 userName，兼容历史 operator */
      var o = String(r.userName || r.operator || '').trim();
      if (o) ops[o] = true;
    });
    var cur = sel.value;
    var keys = Object.keys(ops).sort();
    sel.innerHTML = '<option value="">全部</option>' +
      keys.map(function (o) {
        return '<option value="' + escapeHtml(o) + '">' + escapeHtml(o) + '</option>';
      }).join('');
    if (cur && ops[cur]) sel.value = cur;
    else sel.value = '';
    /* 气泡组件只升级一次，需主动同步 options，否则下拉永远只有「全部」 */
    try {
      var api = sel.__bubbleApi;
      if (api && typeof api.setOptions === 'function') {
        var opts = [{ value: '', label: '全部' }].concat(keys.map(function (o) {
          return { value: o, label: o };
        }));
        api.setOptions(opts);
        api.setValue(sel.value);
      } else if (typeof upgradeNativeSelect === 'function') {
        upgradeNativeSelect(sel);
      } else if (typeof upgradeAllSelects === 'function') {
        upgradeAllSelects($('page-finance-ledger') || document);
      }
    } catch (e) {}
  }
  function renderListPage(rows) {
    var body = $('finTableBody');
    if (!body) return;
    var all = getFiltered();
    filteredCache = all;
    var meta = $('finListMeta');
    var usedSum = all.reduce(function (s, r) {
      if (isReimbursed(r)) return s;
      return s + (Number(r.amount) || 0);
    }, 0);
    if (meta) meta.textContent = '共 ' + all.length + ' 条 · 累计使用 ' + money(usedSum);
    if (!rows || !rows.length) {
      body.innerHTML = '<tr><td colspan="18" class="fin-empty-cell">暂无记录</td></tr>';
      var foot0 = $('finTableFoot');
      if (foot0) { foot0.innerHTML = ''; foot0.hidden = true; }
      syncSelectAll();
      return;
    }
    /* 余额按全量时间序回算后映射到当前页 */
    var runningMap = {};
    var running = reserve;
    records.forEach(function (r) {
      if (isReimbursed(r)) { runningMap[r.id] = running; return; }
      running = Math.round((running - (Number(r.amount) || 0)) * 100) / 100;
      if (running > reserve) running = reserve;
      runningMap[r.id] = running;
    });
    var startIdx = 0;
    if (listPager && listPager.state) {
      startIdx = (listPager.state.page - 1) * listPager.state.size;
    }
    body.innerHTML = rows.map(function (r, i) {
      var remark = (r.remark && String(r.remark).trim()) ? escapeHtml(r.remark) : '-';
      function finThumbCell(list, kind) {
        var arr = normalizeFinImageList(list);
        if (!arr.length && kind === 'other') {
          arr = normalizeFinImageList(r.images);
        }
        if (!arr.length) return '<span class="fin-img-empty">-</span>';
        var src = arr[0].dataUrl || '';
        if (!src) return '<span class="fin-img-empty">-</span>';
        return '<button type="button" class="fin-thumb-btn" data-fin-view="' + r.id + '" data-fin-view-kind="' + kind + '">' +
          '<img class="fin-table-thumb" src="' + String(src).replace(/"/g, '&quot;') + '" alt="" />' +
          (arr.length > 1 ? '<span class="fin-thumb-count">+' + arr.length + '</span>' : '') +
          '</button>';
      }
      var qty = (r.qty != null && r.qty !== '') ? String(r.qty) : '-';
      var checked = selectedIds[r.id] ? ' checked' : '';
      return '<tr data-fin-id="' + r.id + '">' +
        '<td style="text-align:center;"><input type="checkbox" class="fin-row-check" data-fin-check="' + r.id + '"' + checked + ' aria-label="选择记录" /></td>' +
        '<td class="fin-date-cell">' + escapeHtml(formatDateRange(r.dateStart, r.dateEnd)) + '</td>' +
        '<td class="fin-col-item" title="' + escapeHtml(r.item || '') + '"><span class="fin-ellipsis">' + escapeHtml(r.item || '-') + '</span></td>' +
        '<td title="' + escapeHtml(r.purpose || '') + '"><span class="fin-ellipsis">' + escapeHtml(r.purpose || '-') + '</span></td>' +
        '<td>' + escapeHtml(qty) + '</td>' +
        '<td>' + money(r.amount) + '</td>' +
        '<td>' + escapeHtml(r.userName || '-') + '</td>' +
        '<td>' + escapeHtml(r.auditor || '-') + '</td>' +
        '<td>' + escapeHtml(r.payType || '-') + '</td>' +
        '<td>' + escapeHtml(r.receiptType || '-') + '</td>' +
        '<td>' + escapeHtml(r.inboundNo || '-') + '</td>' +
        '<td class="fin-col-remark" title="' + escapeHtml(r.remark || '') + '"><span class="fin-ellipsis">' + remark + '</span></td>' +
        '<td class="fin-col-image">' + finThumbCell(r.payImages, 'pay') + '</td>' +
        '<td class="fin-col-image">' + finThumbCell(r.invoiceImages, 'invoice') + '</td>' +
        '<td class="fin-col-image">' + finThumbCell(r.otherImages, 'other') + '</td>' +
        '<td class="fin-col-status">' +
          '<span class="fin-status-pill fin-status-' + escapeHtml(reviewTagClass(r)) + '">' + escapeHtml(reviewStatusLabel(r)) + '</span>' +
        '</td>' +
        '<td class="fin-col-reimburse">' +
          (isReimbursed(r)
            ? '<span class="fin-status-pill fin-status-reimbursed">已报销</span>'
            : '<span class="fin-status-pill fin-status-unreimbursed">未报销</span>') +
        '</td>' +
        '<td class="fin-ops fin-ops-col"><span class="fin-ops-links">' +
          '<button type="button" class="fin-link-edit" data-fin-edit="' + r.id + '">编辑</button>' +
          '<button type="button" class="fin-link-del" data-fin-del="' + r.id + '">删除</button>' +
        '</span></td></tr>';
    }).join('');

    /* 合计：表尾汇总当前筛选下全部记录（含已报销）；看板累计支出仍不含已报销 */
    var sumQty = 0;
    var sumAmt = 0;
    all.forEach(function (r) {
      var q = Number(r.qty);
      if (!isNaN(q)) sumQty += q;
      sumAmt += Number(r.amount) || 0;
    });
    var qtyText = (Math.round(sumQty * 1000) / 1000).toLocaleString('en-US');
    var foot = $('finTableFoot');
    if (foot) {
      foot.hidden = false;
      foot.innerHTML =
        '<tr class="fin-summary-row">' +
          '<td></td>' +
          '<td class="fin-summary-sticky-left" colspan="3"><span class="fin-summary-label">合计</span></td>' +
          '<td class="fin-summary-num">' + qtyText + '</td>' +
          '<td class="fin-summary-num">' + money(sumAmt) + '</td>' +
          '<td colspan="11"></td>' +
          '<td class="fin-summary-sticky-ops fin-ops-col"></td>' +
        '</tr>';
    }
    syncSelectAll();
  }
  function ensurePager() {
    var mount = $('finPager');
    if (!mount || typeof createPager !== 'function') return;
    if (listPager) { listPager.draw(); return; }
    listPager = createPager(mount, {
      pageSize: 20,
      getData: function () { return getFiltered(); },
      onPage: function (rows) { renderListPage(rows); }
    });
  }
  function refreshList() {
    selectedIds = {};
    fillOperatorFilter();
    ensurePager();
    if (listPager) listPager.reset();
    else renderListPage(getFiltered());
  }

  

  function finFileDisplayName(img) {
    var name = (img && (img.fileName || img.name)) ? String(img.fileName || img.name) : '';
    if (!name && img && img.dataUrl) name = 'image.jpg';
    if (!name) name = 'image';
    /* 仅保留文件名 + 后缀，过长中间省略 */
    var base = name.replace(/^.*[\\\/]/, '');
    if (base.length > 28) {
      var dot = base.lastIndexOf('.');
      var ext = dot > 0 ? base.slice(dot) : '';
      var stem = dot > 0 ? base.slice(0, dot) : base;
      base = stem.slice(0, 18) + '…' + ext;
    }
    return base;
  }
  function renderPendingImages(boxId, list, opts) {
    var box = $(boxId);
    if (!box) return;
    list = list || [];
    opts = opts || {};
    /* 编辑抽屉：缩略图 + 删除 + 点击预览；登记页：文件名条（宽高固定区） */
    var isEdit = opts.mode === 'edit'
      || (boxId && (String(boxId).indexOf('finEdit') === 0 || String(boxId).indexOf('finSrc') === 0));
    if (!list.length) { box.innerHTML = ''; return; }
    if (isEdit) {
      box.innerHTML = list.map(function (img, i) {
        var src = (img && img.dataUrl) ? String(img.dataUrl) : '';
        var full = (img && (img.fileName || img.name)) ? String(img.fileName || img.name) : ('图片' + (i + 1));
        return '<div class="fin-img-thumb" data-fin-thumb-idx="' + i + '" title="点击预览：' + String(full).replace(/"/g, '&quot;') + '">' +
          (src ? '<img src="' + src.replace(/"/g, '') + '" alt="" />' : '<span class="fin-img-file-name">' + String(finFileDisplayName(img)).replace(/</g, '&lt;') + '</span>') +
          '<button type="button" class="fin-img-x" data-fin-img-rm="' + i + '" title="删除" aria-label="删除">×</button>' +
          '</div>';
      }).join('');
      return;
    }
    box.innerHTML = list.map(function (img, i) {
      var label = finFileDisplayName(img);
      var full = (img && (img.fileName || img.name)) ? String(img.fileName || img.name) : label;
      return '<div class="fin-img-file" data-fin-thumb-idx="' + i + '" title="' + String(full).replace(/"/g, '&quot;') + '">' +
        '<span class="fin-img-file-name">' + String(label).replace(/</g, '&lt;') + '</span>' +
        '<button type="button" class="fin-img-x" data-fin-img-rm="' + i + '" title="移除" aria-label="移除">×</button>' +
        '</div>';
    }).join('');
  }
  function readFilesAsDataUrls(fileList) {
    var files = Array.prototype.slice.call(fileList || []);
    return Promise.all(files.map(function (file) {
      return new Promise(function (resolve) {
        var reader = new FileReader();
        reader.onload = function () {
          resolve({ dataUrl: String(reader.result || ''), fileName: file.name || 'image' });
        };
        reader.onerror = function () { resolve(null); };
        reader.readAsDataURL(file);
      });
    })).then(function (list) { return list.filter(Boolean); });
  }
  function resetForm() {
    [
      'finItem', 'finPurpose', 'finDesc', 'finQty', 'finAmount',
      'finUser', 'finAuditor', 'finPayType', 'finReceiptType', 'finInboundNo', 'finRemark'
    ].forEach(function (id) {
      if ($(id)) $(id).value = '';
    });
    if ($('finPeriodStart')) $('finPeriodStart').value = '';
    if ($('finPeriodEnd')) $('finPeriodEnd').value = '';
    var disp = $('finPeriodDisplay');
    if (disp) {
      disp.textContent = '请选择使用日期（可点选起止）';
      disp.classList.add('is-placeholder');
    }
    pendingPayImages = [];
    pendingInvoiceImages = [];
    pendingOtherImages = [];
    pendingImages = [];
    renderPendingImages('finPayImgPreview', pendingPayImages);
    renderPendingImages('finInvoiceImgPreview', pendingInvoiceImages);
    renderPendingImages('finOtherImgPreview', pendingOtherImages);
    if ($('finImgPreview')) renderPendingImages('finImgPreview', pendingImages);
  }
  function addRecord() {
    var item = (($('finItem') && $('finItem').value) || '').trim();
    var amount = parseFloat(($('finAmount') && $('finAmount').value) || '');
    var ds = ($('finPeriodStart') && $('finPeriodStart').value) || '';
    var de = ($('finPeriodEnd') && $('finPeriodEnd').value) || ds;
    var auditorName = (($('finAuditor') && $('finAuditor').value) || '').trim();
    if (!ds) { if (typeof toast === 'function') toast('请选择使用日期', 'warning'); return; }
    if (!item) { if (typeof toast === 'function') toast('请填写商品名称', 'warning'); return; }
    if (!(amount > 0)) { if (typeof toast === 'function') toast('请填写有效使用金额', 'warning'); return; }
    if (!auditorName) {
      if (typeof toast === 'function') toast('请填写审核人登录账号名称（须与对方账号一致）', 'warning');
      return;
    }
    var payImgs = pendingPayImages.slice(0, 6);
    var invImgs = pendingInvoiceImages.slice(0, 6);
    var othImgs = pendingOtherImages.slice(0, 6);
    var allImgs = payImgs.concat(invImgs).concat(othImgs);
    records.push({
      id: 'f_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
      item: item,
      purpose: (($('finPurpose') && $('finPurpose').value) || '').trim(),
      desc: (($('finDesc') && $('finDesc').value) || '').trim(),
      qty: parseFloat(($('finQty') && $('finQty').value) || '') || 0,
      amount: Math.round(amount * 100) / 100,
      dateStart: ds,
      dateEnd: de || ds,
      userName: (($('finUser') && $('finUser').value) || '').trim(),
      auditor: auditorName,
      operator: currentUser(),
      payType: (($('finPayType') && $('finPayType').value) || '').trim(),
      receiptType: (($('finReceiptType') && $('finReceiptType').value) || '').trim(),
      inboundNo: (($('finInboundNo') && $('finInboundNo').value) || '').trim(),
      remark: (($('finRemark') && $('finRemark').value) || '').trim(),
      reimbursed: false,
      payImages: payImgs,
      invoiceImages: invImgs,
      otherImages: othImgs,
      images: allImgs,
      reviewStatus: 'pending',
      createdAt: new Date().toISOString()
    });
    save({ successMsg: '提交成功', failMsg: '提交失败' });
    resetForm();
    updateStats();
  }

  var finSrcEditId = null;
  var pendingSourceImages = [];

  function periodLabel(p) {
    if (!p) return '—';
    var a = p.start || '';
    var b = p.end || p.start || '';
    if (!a && !b) return '未设日期';
    if (a && b && a !== b) return a + ' ~ ' + b;
    return a || b;
  }
  function parsePeriodDay(s) {
    if (!s) return null;
    var t = Date.parse(String(s).replace(/\./g, '-').replace(/\//g, '-'));
    if (isNaN(t)) return null;
    var d = new Date(t);
    d.setHours(0, 0, 0, 0);
    return d;
  }
  /**
   * 定额只认「今天落在 [start,end] 内」的周期；未到生效日 / 已过期一律不计入。
   * 多条生效时取开始日最新的一条。禁止历史/未来周期金额叠加进当前余额。
   */
  function getActiveReservePeriod() {
    if (!reservePeriods.length) return null;
    var now = new Date();
    now.setHours(0, 0, 0, 0);
    var active = null;
    reservePeriods.forEach(function (p) {
      if (!p) return;
      var a = parsePeriodDay(p.start);
      var b = parsePeriodDay(p.end) || a;
      if (!a) return;
      if (b) {
        b = new Date(b.getTime());
        b.setHours(23, 59, 59, 999);
      } else {
        b = a;
      }
      if (now.getTime() < a.getTime() || now.getTime() > b.getTime()) return;
      if (!active) active = p;
      else {
        var as = parsePeriodDay(active.start);
        if (a && as && a.getTime() >= as.getTime()) active = p;
      }
    });
    return active;
  }
  function periodStatus(p) {
    var a = parsePeriodDay(p && p.start);
    var b = parsePeriodDay(p && p.end) || a;
    if (!a) return 'unknown';
    var now = new Date();
    now.setHours(0, 0, 0, 0);
    if (b) {
      b = new Date(b.getTime());
      b.setHours(23, 59, 59, 999);
    } else b = a;
    if (now.getTime() < a.getTime()) return 'upcoming';
    if (now.getTime() > b.getTime()) return 'expired';
    return 'active';
  }
  function syncReserveTotal() {
    var active = getActiveReservePeriod();
    /* 无生效周期 → 当前定额为 0，未来/过期周期金额不进入余额 */
    reserve = active ? Math.round((Number(active.amount) || 0) * 100) / 100 : 0;
  }
  function fillSourcePeriodSelect(selected) {
    var sel = $('finSourcePeriod');
    if (!sel) return;
    var cur = selected != null ? selected : sel.value;
    sel.innerHTML = '<option value="">不绑定</option>' + reservePeriods.map(function (p) {
      return '<option value="' + escapeHtml(p.id) + '">' + escapeHtml(money(p.amount) + ' · ' + periodLabel(p)) + '</option>';
    }).join('');
    if (cur) sel.value = cur;
    try {
      if (sel.__bubbleApi && typeof sel.__bubbleApi.setOptions === 'function') {
        var opts = [{ value: '', label: '不绑定' }].concat(reservePeriods.map(function (p) {
          return { value: p.id, label: money(p.amount) + ' · ' + periodLabel(p) };
        }));
        sel.__bubbleApi.setOptions(opts);
        sel.__bubbleApi.setValue(sel.value);
      } else if (typeof upgradeNativeSelect === 'function') {
        upgradeNativeSelect(sel);
      }
    } catch (e) {}
  }
  function renderReservePeriods() {
    var box = $('finReserveCards');
    if (!box) return;
    var bal = $('finAmountBalance');
    var balText = bal ? bal.textContent : money(0);
    /* 统一卡片：首卡为余额汇总，其后为已锁定额度周期 */
    var html = '';
    var act = getActiveReservePeriod();
    var balSub = act
      ? ('生效定额 ' + money(act.amount) + ' − 累计支出')
      : '当前无生效周期，定额为 0';
    html += '<div class="fin-rsv-card fin-rsv-card-balance">' +
      '<div class="fin-rsv-card-main">' +
        '<span class="fin-rsv-card-k">当前剩余余额</span>' +
        '<strong class="fin-rsv-card-amt" id="finAmountBalance">' + escapeHtml(balText) + '</strong>' +
        '<span class="fin-rsv-card-sub">' + balSub + '</span>' +
      '</div>' +
    '</div>';
    if (!reservePeriods.length) {
      html += '<div class="fin-rsv-card fin-rsv-card-placeholder">' +
        '<div class="fin-rsv-card-main">' +
          '<span class="fin-rsv-card-k">额度周期</span>' +
          '<strong class="fin-rsv-card-amt is-muted">—</strong>' +
          '<span class="fin-rsv-card-sub">保存后在此展示（不可修改）</span>' +
        '</div>' +
      '</div>';
    } else {
      html += reservePeriods.map(function (p, i) {
        var st = periodStatus(p);
        var tag = st === 'active' ? ' · 生效中' : (st === 'upcoming' ? ' · 未生效' : (st === 'expired' ? ' · 已过期' : ''));
        var lock = st === 'active' ? '当前生效 · 已锁定' : (st === 'upcoming' ? '未到生效日 · 不计入余额' : '已过期 · 不计入余额');
        var cls = st === 'active' ? ' is-active' : (st === 'upcoming' ? ' is-upcoming' : (st === 'expired' ? ' is-expired' : ''));
        return '<div class="fin-rsv-card' + cls + '" data-id="' + escapeHtml(p.id) + '">' +
          '<div class="fin-rsv-card-main">' +
            '<span class="fin-rsv-card-k">额度周期 · #' + (i + 1) + tag + '</span>' +
            '<strong class="fin-rsv-card-amt">' + money(p.amount) + '</strong>' +
            '<span class="fin-rsv-card-sub">' + escapeHtml(periodLabel(p)) + '</span>' +
          '</div>' +
          '<div class="fin-rsv-card-foot">' +
            '<span class="fin-rsv-card-lock">' + lock + '</span>' +
            '<button type="button" class="fin-rsv-del-btn" data-fin-rsv-del="' + escapeHtml(p.id) + '" title="删除该额度周期">' +
              '<iconify-icon icon="ant-design:delete-outlined" width="14" height="14"></iconify-icon>删除</button>' +
          '</div>' +
        '</div>';
      }).join('');
    }
    box.innerHTML = html;
    /* 余额数字由 updateStats 维护 id，重建后需再刷一次 */
    try { if (typeof updateStats === 'function') updateStats(); } catch (e0) {}
  }
  function resetReserveForm() {
    finReserveEditId = null;
    if ($('finReserveAmount')) $('finReserveAmount').value = reserve || '';
    if ($('finReserveStart')) $('finReserveStart').value = '';
    if ($('finReserveEnd')) $('finReserveEnd').value = '';
    var d = $('finReservePeriodDisplay');
    if (d) {
      d.textContent = '请选择日期（可点选起止）';
      d.classList.add('is-placeholder');
    }
    var btn = $('finBtnSaveReserve');
    if (btn) {
      btn.innerHTML = '<iconify-icon icon="ant-design:save-outlined" width="15" height="15"></iconify-icon> 保存额度';
    }
  }


  function pad3(n) {
    n = Number(n) || 0;
    if (n < 10) return '00' + n;
    if (n < 100) return '0' + n;
    return String(n);
  }
  function ymdToday() {
    var d = new Date();
    var m = d.getMonth() + 1, day = d.getDate();
    return d.getFullYear() + (m < 10 ? '0' : '') + m + (day < 10 ? '0' : '') + day;
  }
  /** 序号：YYYYMMDD + 三位自增，如 20261028001；同一天从 001 递增 */
  function nextSourceSerial() {
    var day = ymdToday();
    var max = 0;
    sources.forEach(function (s) {
      var sn = String((s && (s.serial || s.id)) || '');
      if (sn.indexOf(day) === 0 && sn.length >= 11) {
        var n = parseInt(sn.slice(8, 11), 10);
        if (!isNaN(n) && n > max) max = n;
      }
    });
    return day + pad3(max + 1);
  }

  var srcDrawerImages = [];
  function fillSrcDrawerPeriodSelect(selected) {
    var sel = $('finSrcDrawerPeriod');
    if (!sel) return;
    var cur = selected != null ? selected : sel.value;
    sel.innerHTML = '<option value="">不绑定</option>' + reservePeriods.map(function (p) {
      return '<option value="' + escapeHtml(p.id) + '">' + escapeHtml(periodLabel(p)) + '</option>';
    }).join('');
    if (cur) sel.value = cur;
    else sel.value = '';
    /* 与页面其他下拉统一为气泡样式 */
    try {
      if (sel.__bubbleApi && typeof sel.__bubbleApi.setOptions === 'function') {
        var opts = [{ value: '', label: '不绑定' }].concat(reservePeriods.map(function (p) {
          return { value: p.id, label: periodLabel(p) };
        }));
        sel.__bubbleApi.setOptions(opts);
        sel.__bubbleApi.setValue(sel.value);
      } else if (typeof upgradeNativeSelect === 'function') {
        upgradeNativeSelect(sel);
      } else if (typeof ensureBubbleSelects === 'function') {
        ensureBubbleSelects($('finSourceDrawer') || document);
      }
    } catch (eB) {}
  }
  function openSourceDrawer(id) {
    var er = null;
    for (var i = 0; i < sources.length; i++) {
      if (sources[i].id === id) { er = sources[i]; break; }
    }
    if (!er) {
      if (typeof toast === 'function') toast('来源不存在', 'warning');
      return;
    }
    finSrcEditId = er.id;
    if ($('finSrcDrawerName')) $('finSrcDrawerName').value = er.name || '';
    if ($('finSrcDrawerAmount')) $('finSrcDrawerAmount').value = er.amount != null ? String(er.amount) : '';
    if ($('finSrcDrawerPayer')) $('finSrcDrawerPayer').value = er.payer || '';
    if ($('finSrcDrawerPayee')) $('finSrcDrawerPayee').value = er.payee || '';
    fillSrcDrawerPeriodSelect(er.periodId || '');
    srcDrawerImages = normalizeFinImageList(er.images).slice(0, 6);
    try { renderPendingImages('finSrcDrawerImagePreview', srcDrawerImages, { mode: 'edit' }); } catch (e0) {}
    bindSrcDrawerUpload();
    try {
      if (typeof ensureBubbleSelects === 'function') ensureBubbleSelects($('finSourceDrawer') || document);
    } catch (eBs) {}
    var overlay = $('finSourceDrawerOverlay');
    if (overlay) {
      overlay.hidden = false;
      overlay.removeAttribute('hidden');
      overlay.classList.add('is-open');
      overlay.style.cssText = 'display:flex !important;pointer-events:auto;z-index:230;';
    }
    document.body.style.overflow = 'hidden';
  }
  function closeSourceDrawer() {
    var overlay = $('finSourceDrawerOverlay');
    if (overlay) {
      overlay.classList.remove('is-open');
      overlay.hidden = true;
      overlay.setAttribute('hidden', '');
      overlay.style.cssText = 'display:none;';
    }
    document.body.style.overflow = '';
    finSrcEditId = null;
    srcDrawerImages = [];
  }
  function saveSourceDrawer() {
    if (!finSrcEditId) return;
    var hit = null;
    for (var i = 0; i < sources.length; i++) {
      if (sources[i].id === finSrcEditId) { hit = sources[i]; break; }
    }
    if (!hit) {
      if (typeof toast === 'function') toast('记录不存在', 'warning');
      closeSourceDrawer();
      return;
    }
    var name = (($('finSrcDrawerName') && $('finSrcDrawerName').value) || '').trim();
    var amountRaw = (($('finSrcDrawerAmount') && $('finSrcDrawerAmount').value) || '').trim();
    var amount = parseFloat(amountRaw);
    if (!name) { if (typeof toast === 'function') toast('请输入金额来源', 'warning'); return; }
    if (!(amount >= 0) || amountRaw === '') {
      if (typeof toast === 'function') toast('请输入有效金额', 'warning');
      return;
    }
    hit.name = name;
    hit.amount = Math.round(amount * 100) / 100;
    hit.payer = (($('finSrcDrawerPayer') && $('finSrcDrawerPayer').value) || '').trim();
    hit.payee = (($('finSrcDrawerPayee') && $('finSrcDrawerPayee').value) || '').trim();
    hit.periodId = (($('finSrcDrawerPeriod') && $('finSrcDrawerPeriod').value) || '');
    hit.images = srcDrawerImages.slice(0, 6);
    if (!hit.boundAt) hit.boundAt = new Date().toISOString().slice(0, 10);
    if (!hit.createdAt) hit.createdAt = new Date().toISOString();
    save({ successMsg: '已保存', failMsg: '保存失败' });
    closeSourceDrawer();
    renderSources();
  }
  function bindSrcDrawerUpload() {
    var zone = $('finSrcDrawerUploadZone');
    var file = $('finSrcDrawerImageFile');
    if (!zone || !file) return;
    if (zone.__srcDrBound) return;
    zone.__srcDrBound = true;
    function addFiles(fl) {
      readFilesAsDataUrls(fl).then(function (list) {
        srcDrawerImages = srcDrawerImages.concat(list).slice(0, 6);
        renderPendingImages('finSrcDrawerImagePreview', srcDrawerImages, { mode: 'edit' });
      });
    }
    zone.addEventListener('click', function (e) {
      if (e.target.closest && e.target.closest('[data-fin-img-rm]')) return;
      file.click();
    });
    zone.addEventListener('dragover', function (e) { e.preventDefault(); zone.classList.add('is-drag'); });
    zone.addEventListener('dragleave', function () { zone.classList.remove('is-drag'); });
    zone.addEventListener('drop', function (e) {
      e.preventDefault();
      zone.classList.remove('is-drag');
      if (e.dataTransfer && e.dataTransfer.files) addFiles(e.dataTransfer.files);
    });
    file.addEventListener('change', function (e) {
      if (e.target.files) addFiles(e.target.files);
      e.target.value = '';
    });
    var prev = $('finSrcDrawerImagePreview');
    if (prev && !prev.__rmBound) {
      prev.__rmBound = true;
      prev.addEventListener('click', function (e) {
        var rm = e.target.closest && e.target.closest('[data-fin-img-rm]');
        if (rm) {
          e.preventDefault();
          e.stopPropagation();
          var idx = parseInt(rm.getAttribute('data-fin-img-rm'), 10);
          if (!isNaN(idx)) {
            srcDrawerImages.splice(idx, 1);
            renderPendingImages('finSrcDrawerImagePreview', srcDrawerImages, { mode: 'edit' });
          }
          return;
        }
        var thumb = e.target.closest && e.target.closest('.fin-img-thumb');
        if (thumb && typeof openImageViewer === 'function') {
          var i = parseInt(thumb.getAttribute('data-fin-thumb-idx'), 10) || 0;
          openImageViewer(srcDrawerImages, i);
        }
      });
    }
  }
  if (!window.__finSrcDrawerBound) {
    window.__finSrcDrawerBound = true;
    document.addEventListener('click', function (e) {
      if (e.target.closest && (e.target.closest('#finSourceDrawerClose') || e.target.closest('#finSourceDrawerCancel'))) {
        closeSourceDrawer();
        return;
      }
      if (e.target.closest && e.target.closest('#finSourceDrawerSave')) {
        saveSourceDrawer();
        return;
      }
      var ov = $('finSourceDrawerOverlay');
      if (ov && e.target === ov) closeSourceDrawer();
    });
  }

  function resetSourceForm() {
    finSrcEditId = null;
    if ($('finSourceName')) $('finSourceName').value = '';
    if ($('finSourceAmount')) $('finSourceAmount').value = '';
    if ($('finSourcePayer')) $('finSourcePayer').value = '';
    if ($('finSourcePayee')) $('finSourcePayee').value = '';
    if ($('finSourcePeriod')) {
      $('finSourcePeriod').value = '';
      try {
        if ($('finSourcePeriod').__bubbleApi) $('finSourcePeriod').__bubbleApi.setValue('');
      } catch (e0) {}
    }
    pendingSourceImages = [];
    try { renderPendingImages('finSourceImagePreview', pendingSourceImages); } catch (e1) {}
    var btn = $('finBtnAddSource');
    if (btn) btn.textContent = '添加来源';
  }

  /** 绑定时间：优先 boundAt / createdAt；序号 YYYYMMDD 提取；有周期则用绑定日或周期开始日 */
  function formatSourceBoundAt(s, period) {
    function sliceDay(v) {
      if (!v) return '';
      var str = String(v);
      if (str.indexOf('T') > 0) return str.slice(0, 10);
      if (/^\d{4}-\d{2}-\d{2}/.test(str)) return str.slice(0, 10);
      return str;
    }
    var d = sliceDay(s && (s.boundAt || s.createdAt || s.updatedAt));
    if (d) return d;
    var serial = String((s && (s.serial || s.id)) || '');
    if (/^\d{8}/.test(serial)) {
      return serial.slice(0, 4) + '-' + serial.slice(4, 6) + '-' + serial.slice(6, 8);
    }
    if (period && (period.start || period.startDate)) {
      return sliceDay(period.start || period.startDate);
    }
    return '—';
  }
  function ensureSourceBoundAt(s) {
    if (!s) return s;
    var day = formatSourceBoundAt(s, null);
    if (day && day !== '—') {
      if (!s.boundAt) s.boundAt = day;
    } else {
      s.boundAt = new Date().toISOString().slice(0, 10);
    }
    return s;
  }

  function renderSources() {
    var body = $('finSourceBody');
    if (!body) return;
    fillSourcePeriodSelect();
    if (!sources.length) {
      body.innerHTML = '<tr><td colspan="9" class="fin-empty-cell">暂无来源，请添加</td></tr>';
      return;
    }
    var pmap = {};
    reservePeriods.forEach(function (p) { pmap[p.id] = p; });
    body.innerHTML = sources.map(function (s, i) {
      var bp = s.periodId ? pmap[s.periodId] : null;
      var bindTxt = bp ? periodLabel(bp) : '未绑定';
      var imgs = normalizeFinImageList(s.images);
      var imgCell;
      if (!imgs.length) {
        imgCell = '<span class="fin-img-empty">—</span>';
      } else {
        var first = imgs[0];
        imgCell = '<button type="button" class="fin-thumb-btn" data-fin-src-view="' + escapeHtml(s.id) + '" title="查看凭证">' +
          '<img class="fin-table-thumb" src="' + String(first.dataUrl || '').replace(/"/g, '') + '" alt="" />' +
          (imgs.length > 1 ? '<span class="fin-thumb-more">+' + (imgs.length - 1) + '</span>' : '') +
          '</button>';
      }
      var serial = s.serial || s.id || ('—' + (i + 1));
      var amt = s.amount != null && s.amount !== '' ? money(s.amount) : '—';
      var boundAt = formatSourceBoundAt(s, bp);
      return '<tr data-src-id="' + escapeHtml(s.id) + '">' +
        '<td class="num">' + escapeHtml(serial) + '</td>' +
        '<td>' + escapeHtml(s.name || '') + '</td>' +
        '<td class="num">' + amt + '</td>' +
        '<td>' + escapeHtml(s.payer || '—') + '</td>' +
        '<td>' + escapeHtml(s.payee || '—') + '</td>' +
        '<td>' + escapeHtml(boundAt) + '</td>' +
        '<td>' + escapeHtml(bindTxt) + '</td>' +
        '<td>' + imgCell + '</td>' +
        '<td class="fin-ops-cell">' +
          '<span class="fin-ops-links">' +
            '<button type="button" class="fin-link fin-link-edit" data-fin-src-edit="' + escapeHtml(s.id) + '">编辑</button>' +
            '<button type="button" class="fin-link fin-link-del" data-fin-src-del="' + escapeHtml(s.id) + '">删除</button>' +
          '</span>' +
        '</td></tr>';
    }).join('');
  }

  /* edit drawer (reuse existing if present) */


  function setSelectValue(id, val) {
    var el = $(id);
    if (!el) return;
    el.value = val == null ? '' : String(val);
    if (el.__bubbleApi && typeof el.__bubbleApi.setValue === 'function') {
      el.__bubbleApi.setValue(el.value);
    }
  }
  function ensureBubbleSelects(root) {
    if (typeof window.upgradeAllSelects === 'function') {
      try { window.upgradeAllSelects(root || document); } catch (e) {}
    }
  }

  function bindEditUploadZones() {
    var specs = [
      { zone: 'finEditPayUploadZone', file: 'finEditPayImageFile', preview: 'finEditPayImgPreview',
        get: function () { return editPendingPayImages; }, set: function (v) { editPendingPayImages = v; } },
      { zone: 'finEditInvoiceUploadZone', file: 'finEditInvoiceImageFile', preview: 'finEditInvoiceImgPreview',
        get: function () { return editPendingInvoiceImages; }, set: function (v) { editPendingInvoiceImages = v; } },
      { zone: 'finEditOtherUploadZone', file: 'finEditOtherImageFile', preview: 'finEditOtherImgPreview',
        get: function () { return editPendingOtherImages; }, set: function (v) { editPendingOtherImages = v; } }
    ];
    specs.forEach(function (s) {
      var zone = $(s.zone);
      var file = $(s.file);
      if (!file) return;
      /* 上传：仅依赖 label[for] 原生打开文件框；这里只处理 change / 拖拽 / 删除 */
      file.onchange = function () {
        if (!file.files || !file.files.length) return;
        readFilesAsDataUrls(file.files).then(function (list) {
          if (!list.length) return;
          s.set(s.get().concat(list).slice(0, 6));
          renderPendingImages(s.preview, s.get(), { mode: 'edit' });
          file.value = '';
          if (typeof toast === 'function') toast('已添加 ' + list.length + ' 张图片', 'success');
        });
      };
      if (zone) {
        zone.ondragover = function (e) { e.preventDefault(); e.stopPropagation(); zone.classList.add('is-drag'); };
        zone.ondragleave = function (e) { e.preventDefault(); zone.classList.remove('is-drag'); };
        zone.ondrop = function (e) {
          e.preventDefault();
          e.stopPropagation();
          zone.classList.remove('is-drag');
          if (!e.dataTransfer || !e.dataTransfer.files || !e.dataTransfer.files.length) return;
          readFilesAsDataUrls(e.dataTransfer.files).then(function (list) {
            if (!list.length) return;
            s.set(s.get().concat(list).slice(0, 6));
            renderPendingImages(s.preview, s.get(), { mode: 'edit' });
            if (typeof toast === 'function') toast('已添加 ' + list.length + ' 张图片', 'success');
          });
        };
      }
      var preview = $(s.preview);
      if (preview) {
        preview.onmousedown = function (e) {
          var rm = e.target.closest && e.target.closest('[data-fin-img-rm]');
          if (rm) {
            e.preventDefault();
            e.stopPropagation();
          }
        };
        preview.onclick = function (e) {
          e.stopPropagation();
          var rm = e.target.closest && e.target.closest('[data-fin-img-rm]');
          if (rm) {
            e.preventDefault();
            e.stopPropagation();
            var i = parseInt(rm.getAttribute('data-fin-img-rm'), 10);
            if (isNaN(i)) return false;
            var arr = s.get().slice();
            if (i < 0 || i >= arr.length) return false;
            arr.splice(i, 1);
            s.set(arr);
            renderPendingImages(s.preview, arr, { mode: 'edit' });
            if (typeof toast === 'function') toast('已删除', 'success');
            return false;
          }
          var thumb = e.target.closest && e.target.closest('.fin-img-thumb, .fin-img-file, [data-fin-thumb-idx]');
          if (thumb) {
            e.preventDefault();
            e.stopPropagation();
            var list = s.get();
            if (!list.length) return false;
            var idx = parseInt(thumb.getAttribute('data-fin-thumb-idx'), 10);
            if (isNaN(idx)) idx = 0;
            var urls = list.map(function (im) {
              return (im && im.dataUrl) ? im : { dataUrl: (im && (im.url || im.src)) || '' };
            }).filter(function (im) { return im && im.dataUrl; });
            if (!urls.length) {
              if (typeof toast === 'function') toast('暂无可预览图片', 'warning');
              return false;
            }
            if (idx >= urls.length) idx = 0;
            if (typeof window.openImageViewer === 'function') window.openImageViewer(urls, idx);
            else if (typeof openImageViewer === 'function') openImageViewer(urls, idx);
            return false;
          }
        };
      }
    });
  }

  function mapImgs(list) {
    return (list || []).map(function (x) {
      return { dataUrl: x.dataUrl, fileName: x.fileName || '' };
    });
  }
  function openEditDrawer(id) {
    ensureLoaded();
    var rec = records.find(function (r) { return r.id === id; });
    if (!rec) {
      if (typeof toast === 'function') toast('记录不存在或已删除', 'error');
      return;
    }
    if (!canSeeLedgerRecord(rec)) {
      if (typeof toast === 'function') toast('无权查看或编辑该单据（待审仅指定审核人可见）', 'error');
      return;
    }
    editingId = id;
    editPendingPayImages = mapImgs(rec.payImages);
    editPendingInvoiceImages = mapImgs(rec.invoiceImages);
    editPendingOtherImages = mapImgs(rec.otherImages);
    /* 兼容旧数据：仅有 images 时归入订单截图 */
    if (!editPendingPayImages.length && !editPendingInvoiceImages.length && !editPendingOtherImages.length) {
      editPendingOtherImages = mapImgs(rec.images);
    }
    editPendingImages = editPendingPayImages.concat(editPendingInvoiceImages).concat(editPendingOtherImages);
    if ($('finEditItem')) $('finEditItem').value = rec.item || '';
    if ($('finEditPurpose')) $('finEditPurpose').value = rec.purpose || '';
    if ($('finEditDesc')) $('finEditDesc').value = rec.desc || '';
    if ($('finEditQty')) $('finEditQty').value = rec.qty != null && rec.qty !== '' ? String(rec.qty) : '';
    if ($('finEditAmount')) $('finEditAmount').value = rec.amount != null ? String(rec.amount) : '';
    if ($('finEditUser')) $('finEditUser').value = rec.userName || '';
    if ($('finEditAuditor')) $('finEditAuditor').value = rec.auditor || '';
    ensureBubbleSelects($('finDrawer') || document);
    setSelectValue('finEditPayType', rec.payType || '');
    setSelectValue('finEditReceiptType', rec.receiptType || '');
    if ($('finEditInboundNo')) $('finEditInboundNo').value = rec.inboundNo || '';
    if ($('finEditRemark')) $('finEditRemark').value = rec.remark || '';
    if ($('finEditReimbursed')) $('finEditReimbursed').checked = isReimbursed(rec);
    if ($('finEditStart')) $('finEditStart').value = rec.dateStart || '';
    if ($('finEditEnd')) $('finEditEnd').value = rec.dateEnd || rec.dateStart || '';
    var disp = $('finEditPeriodDisplay');
    if (disp) {
      if (rec.dateStart) {
        disp.textContent = formatDateRange(rec.dateStart, rec.dateEnd);
        disp.classList.remove('is-placeholder');
      } else {
        disp.textContent = '请选择使用日期（可点选起止）';
        disp.classList.add('is-placeholder');
      }
    }
    if (typeof renderPendingImages === 'function') {
      renderPendingImages('finEditPayImgPreview', editPendingPayImages, { mode: 'edit' });
      renderPendingImages('finEditInvoiceImgPreview', editPendingInvoiceImages, { mode: 'edit' });
      renderPendingImages('finEditOtherImgPreview', editPendingOtherImages, { mode: 'edit' });
    }
    /* 驳回修改场景：标题与保存按钮文案提示「保存后重新提交」 */
    var isRevise = !!(rec.reviewNeedRevise && rec.reviewStatus === 'rejected');
    var titleEl = $('finDrawerTitle');
    if (titleEl) titleEl.textContent = isRevise ? '修改并重新提交' : '编辑使用记录';
    var saveBtn = $('finDrawerSave');
    if (saveBtn) saveBtn.textContent = isRevise ? '保存并重新提交' : '保存修改';
    ensureEditDatePicker();
    bindEditUploadZones();
    ensureBubbleSelects($('finDrawer') || document);
    var overlay = $('finDrawerOverlay');
    if (overlay) {
      overlay.hidden = false;
      overlay.removeAttribute('hidden');
      overlay.classList.add('is-open');
      overlay.style.cssText = 'display:flex !important;pointer-events:auto;z-index:220;';
    }
    document.body.style.overflow = 'hidden';
  }
  function closeEditDrawer() {
    var overlay = $('finDrawerOverlay');
    if (overlay) {
      overlay.classList.remove('is-open');
      overlay.hidden = true;
      overlay.setAttribute('hidden', '');
      overlay.style.cssText = 'display:none;';
    }
    document.body.style.overflow = '';
    editingId = null;
    var titleEl = $('finDrawerTitle');
    if (titleEl) titleEl.textContent = '编辑使用记录';
    var saveBtn = $('finDrawerSave');
    if (saveBtn) saveBtn.textContent = '保存修改';
  }
  function saveEditDrawer() {
    if (!editingId) return;
    var idx = records.findIndex(function (r) { return r.id === editingId; });
    if (idx < 0) return;
    var item = (($('finEditItem') && $('finEditItem').value) || '').trim();
    var amount = parseFloat(($('finEditAmount') && $('finEditAmount').value) || '');
    var ds = ($('finEditStart') && $('finEditStart').value) || '';
    var de = ($('finEditEnd') && $('finEditEnd').value) || ds;
    var auditorName = (($('finEditAuditor') && $('finEditAuditor').value) || '').trim();
    if (!ds || !item || !(amount > 0)) {
      if (typeof toast === 'function') toast('请完整填写必填项（日期 / 商品名称 / 金额）', 'warning');
      return;
    }
    if (!auditorName) {
      if (typeof toast === 'function') toast('请填写审核人登录账号名称（须与对方账号一致）', 'warning');
      return;
    }
    var payImgs = editPendingPayImages.slice(0, 6);
    var invImgs = editPendingInvoiceImages.slice(0, 6);
    var othImgs = editPendingOtherImages.slice(0, 6);
    var wasNeedRevise = !!(records[idx].reviewNeedRevise && records[idx].reviewStatus === 'rejected');
    records[idx].item = item;
    records[idx].purpose = (($('finEditPurpose') && $('finEditPurpose').value) || '').trim();
    records[idx].desc = (($('finEditDesc') && $('finEditDesc').value) || '').trim();
    records[idx].qty = parseFloat(($('finEditQty') && $('finEditQty').value) || '') || 0;
    records[idx].amount = Math.round(amount * 100) / 100;
    records[idx].dateStart = ds;
    records[idx].dateEnd = de || ds;
    records[idx].userName = (($('finEditUser') && $('finEditUser').value) || '').trim();
    records[idx].auditor = auditorName;
    records[idx].payType = (($('finEditPayType') && $('finEditPayType').value) || '').trim();
    records[idx].receiptType = (($('finEditReceiptType') && $('finEditReceiptType').value) || '').trim();
    records[idx].inboundNo = (($('finEditInboundNo') && $('finEditInboundNo').value) || '').trim();
    records[idx].remark = (($('finEditRemark') && $('finEditRemark').value) || '').trim();
    records[idx].reimbursed = !!($('finEditReimbursed') && $('finEditReimbursed').checked);
    records[idx].payImages = payImgs;
    records[idx].invoiceImages = invImgs;
    records[idx].otherImages = othImgs;
    records[idx].images = payImgs.concat(invImgs).concat(othImgs);
    /* 驳回修改后的保存：写入修改并自动重新进入待审核（申请人修改单据 → 重新提交） */
    if (wasNeedRevise) {
      records[idx].reviewStatus = 'pending';
      records[idx].reviewNeedRevise = false;
      records[idx].reviewTerminate = false;
      records[idx].resubmittedAt = new Date().toISOString();
      try {
        if (typeof appendReviewHistory === 'function') {
          appendReviewHistory(records[idx], 'edit_resubmit', '修改单据并重新提交');
        }
      } catch (histErr) { /* 历史写入失败不阻断保存 */ }
    }
    save({
      successMsg: wasNeedRevise ? '提交成功' : '已保存',
      failMsg: wasNeedRevise ? '提交失败' : '保存失败'
    });
    closeEditDrawer();
    if (typeof refreshList === 'function') refreshList();
    if (typeof updateStats === 'function') updateStats();
    if (typeof renderReview === 'function') renderReview();
    if (typeof updatePendingBadge === 'function') updatePendingBadge();
  }

  function ensureDatePicker(cfg) {
    if (typeof window.bindSharedDatePicker !== 'function') return;
    try {
      var root = $(cfg.rootId);
      var trig = $(cfg.triggerId);
      if (root) root.removeAttribute('data-dp-bound');
      if (trig) { trig.__dpClick = false; trig.onclick = null; }
      window[cfg.stateKey] = null;
      window.bindSharedDatePicker(cfg);
    } catch (e) { console.warn('[finance] dp', e); }
  }
  function ensureRegisterDp() {
    ensureDatePicker({
      rootId: 'finDatePicker', triggerId: 'finPeriodTrigger', panelId: 'finPeriodPanel',
      startId: 'finPeriodStart', endId: 'finPeriodEnd', displayId: 'finPeriodDisplay',
      presetsId: 'finPeriodPresets', calDaysL: 'finCalDaysL', calDaysR: 'finCalDaysR',
      calTitleL: 'finCalTitleL', calTitleR: 'finCalTitleR',
      /* 明确区间选择：第一次点选开始日，第二次点选结束日 */
      single: false,
      defaultPreset: null,
      stateKey: '__finDp',
      placeholder: '请选择使用日期（可点选起止区间）'
    });
  }
  function bindFinFilterDpActions() {
    var clearBtn = document.getElementById('finFilterDpClear');
    var okBtn = document.getElementById('finFilterDpOk');
    var root = document.getElementById('finFilterDatePicker');
    var panel = document.getElementById('finFilterPeriodPanel');
    var display = document.getElementById('finFilterPeriodDisplay');
    var startEl = document.getElementById('finFilterStart');
    var endEl = document.getElementById('finFilterEnd');
    function closePanel() {
      if (root) root.classList.remove('open');
      if (panel) {
        panel.hidden = true;
        panel.setAttribute('hidden', '');
        panel.style.display = 'none';
      }
      var st = window.__finFilterDp;
      if (st && typeof st.close === 'function') {
        try { st.close(); } catch (eC) {}
      }
    }
    function bindBtn(btn, handler) {
      if (!btn) return;
      if (btn.__finDpHandler) btn.removeEventListener('click', btn.__finDpHandler, true);
      btn.__finDpHandler = handler;
      btn.addEventListener('click', handler, true);
      btn.style.pointerEvents = 'auto';
      btn.style.cursor = 'pointer';
      btn.disabled = false;
    }
    bindBtn(clearBtn, function (e) {
      e.preventDefault();
      e.stopPropagation();
      if (startEl) startEl.value = '';
      if (endEl) endEl.value = '';
      if (display) {
        display.textContent = '请选择日期范围';
        display.classList.add('is-placeholder');
      }
      var st = window.__finFilterDp;
      if (st) {
        st.picking = false;
        st.pickStart = null;
        st.pickEnd = null;
        if (typeof st.paint === 'function') st.paint();
      }
      closePanel();
    });
    bindBtn(okBtn, function (e) {
      e.preventDefault();
      e.stopPropagation();
      closePanel();
    });
  }

function ensureFilterDp() {
    bindFinFilterDpActions();
    ensureDatePicker({
      rootId: 'finFilterDatePicker', triggerId: 'finFilterPeriodTrigger', panelId: 'finFilterPeriodPanel',
      startId: 'finFilterStart', endId: 'finFilterEnd', displayId: 'finFilterPeriodDisplay',
      presetsId: 'finFilterPeriodPresets', calDaysL: 'finFilterCalDaysL', calDaysR: 'finFilterCalDaysR',
      calTitleL: 'finFilterCalTitleL', calTitleR: 'finFilterCalTitleR',
      /* 明确区间：点选开始日 → 结束日，支持预设近7天/本月等 */
      single: false,
      defaultPreset: null,
      stateKey: '__finFilterDp',
      placeholder: '请选择日期范围',
      onChange: function (s, e) {
        /* 日期仅写入控件，点「搜索」后再写入 filterStart/End 并刷新 */
}
    });
  }
  function ensureEditDatePicker() {
    ensureDatePicker({
      rootId: 'finEditDatePicker', triggerId: 'finEditPeriodTrigger', panelId: 'finEditPeriodPanel',
      startId: 'finEditStart', endId: 'finEditEnd', displayId: 'finEditPeriodDisplay',
      presetsId: 'finEditPeriodPresets', calDaysL: 'finEditCalDaysL', calDaysR: 'finEditCalDaysR',
      calTitleL: 'finEditCalTitleL', calTitleR: 'finEditCalTitleR',
      single: false,
      defaultPreset: null,
      stateKey: '__finEditDp',
      placeholder: '请选择使用日期（可点选起止）'
    });
  }

  async function exportExcel() {
    var list = getFiltered();
    if (!list.length) {
      if (typeof toast === 'function') toast('没有可导出的记录', 'warning');
      return;
    }
    if (typeof ExcelJS === 'undefined') {
      if (typeof toast === 'function') toast('Excel 组件未加载', 'error');
      return;
    }
    try {
      /* 按全量时间序回算每条记录对应的当前余额，与列表页展示一致 */
      var runningMap = {};
      var running = reserve;
      records.forEach(function (r) {
        if (isReimbursed(r)) { runningMap[r.id] = running; return; }
        running = Math.round((running - (Number(r.amount) || 0)) * 100) / 100;
        if (running > reserve) running = reserve;
        runningMap[r.id] = running;
      });
      var wb = new ExcelJS.Workbook();
      var ws = wb.addWorksheet('使用记录');
      /* 与登记/列表字段对齐：图片分三列，表头分别为付款截图 / 发票图片 / 订单截图 */
      ws.columns = [
        { header: '序号', key: 'i', width: 8 },
        { header: '使用日期', key: 'date', width: 14 },
        { header: '商品名称', key: 'item', width: 22 },
        { header: '用途', key: 'purpose', width: 14 },
        { header: '说明', key: 'desc', width: 16 },
        { header: '数量', key: 'qty', width: 8 },
        { header: '使用金额', key: 'amount', width: 12 },
        { header: '操办人', key: 'user', width: 10 },
        { header: '审核人', key: 'auditor', width: 10 },
        { header: '支付类型', key: 'payType', width: 10 },
        { header: '票据类型', key: 'receiptType', width: 12 },
        { header: '入库单号', key: 'inboundNo', width: 14 },
        { header: '备注', key: 'remark', width: 16 },
        { header: '付款截图', key: 'payImg', width: 14 },
        { header: '发票图片', key: 'invoiceImg', width: 14 },
        { header: '订单截图', key: 'otherImg', width: 14 }
      ];
      var headerRow = ws.getRow(1);
      headerRow.font = { bold: true };
      headerRow.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      headerRow.height = 22;
      for (var i = 0; i < list.length; i++) {
        var r = list[i];
        var row = ws.addRow({
          i: i + 1,
          date: formatDateRange(r.dateStart, r.dateEnd),
          item: r.item || '',
          purpose: r.purpose || '',
          desc: r.desc || '',
          qty: r.qty != null ? r.qty : '',
          amount: Number(r.amount) || 0,
          user: r.userName || '',
          auditor: r.auditor || '',
          payType: r.payType || '',
          receiptType: r.receiptType || '',
          inboundNo: r.inboundNo || '',
          remark: r.remark || '',
          payImg: '',
          invoiceImg: '',
          otherImg: ''
        });
        row.height = 72;
        function putImgs(imgList, colIndex) {
          var arr = (imgList || []).slice(0, 3);
          for (var j = 0; j < arr.length; j++) {
            if (!arr[j] || !arr[j].dataUrl) continue;
            try {
              var b64 = String(arr[j].dataUrl).split(',')[1];
              if (!b64) continue;
              var ext = /image\/jpeg|image\/jpg/i.test(arr[j].dataUrl) ? 'jpeg' : 'png';
              var imgId = wb.addImage({ base64: b64, extension: ext });
              ws.addImage(imgId, {
                tl: { col: colIndex + j * 0.32, row: row.number - 1 },
                ext: { width: 48, height: 48 }
              });
            } catch (ie) {}
          }
        }
        /* 列：0序号 … 12备注, 13付款截图, 14发票图片, 15订单截图 */
        var payList = r.payImages || [];
        var invList = r.invoiceImages || [];
        var othList = (r.otherImages && r.otherImages.length) ? r.otherImages : ((!payList.length && !invList.length) ? (r.images || []) : (r.otherImages || []));
        putImgs(payList, 13);
        putImgs(invList, 14);
        putImgs(othList, 15);
      }
      var buf = await wb.xlsx.writeBuffer();
      var blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = '备用金使用记录.xlsx';
      a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
      if (typeof toast === 'function') toast('导出成功', 'success');
    } catch (err) {
      console.warn(err);
      if (typeof toast === 'function') toast('导出失败', 'error');
    }
  }

  function syncSelectAll() {
    var selAll = $('finSelectAll');
    if (!selAll) return;
    var checks = document.querySelectorAll('#finTableBody .fin-row-check');
    if (!checks.length) { selAll.checked = false; selAll.indeterminate = false; return; }
    var n = 0;
    checks.forEach(function (cb) { if (cb.checked) n++; });
    selAll.checked = n === checks.length;
    selAll.indeterminate = n > 0 && n < checks.length;
  }

  function getSelectedIds() {
    return Object.keys(selectedIds).filter(function (k) { return selectedIds[k]; });
  }

  function batchDeleteRecords(ids) {
    var n = ids.length;
    var go = function () {
      var removed = 0;
      ids.forEach(function (id) {
        var target = null;
        for (var i = 0; i < records.length; i++) {
          if (records[i].id === id) { target = records[i]; break; }
        }
        if (target) {
          target.deleted = true;
          target.deletedAt = new Date().toISOString();
          deletedRecords.push(target);
          records.splice(records.indexOf(target), 1);
          delete selectedIds[id];
          removed++;
        }
      });
      save({ successMsg: '已批量删除 ' + removed + ' 条' });
      refreshList(); updateStats();
      if (currentView === 'board') renderCharts();
    };
    if (typeof window.showConfirm === 'function') {
      window.showConfirm({
        title: '批量删除使用记录',
        message: '确认删除选中的 ' + n + ' 条使用记录？删除后列表中不再显示。',
        confirmText: '确认删除',
        onConfirm: go
      });
    } else if (window.confirm('确认删除选中的 ' + n + ' 条记录？')) go();
  }

  function batchSetReimbursed(ids, value) {
    var n = ids.length;
    var title = value ? '批量标记已报销' : '批量取消已报销';
    var message = value
      ? ('将选中的 ' + n + ' 条记录标记为已报销，金额回流定额且不再计入累计支出。')
      : ('取消选中的 ' + n + ' 条记录的已报销标记，金额重新计入累计支出。');
    var go = function () {
      var updated = 0;
      ids.forEach(function (id) {
        for (var i = 0; i < records.length; i++) {
          if (records[i].id === id) {
            records[i].reimbursed = !!value;
            updated++;
            break;
          }
        }
      });
      save({ successMsg: (value ? '已标记 ' : '已取消 ') + updated + ' 条' });
      selectedIds = {};
      refreshList();
      updateStats();
      if (currentView === 'board') renderCharts();
    };
    if (typeof window.showConfirm === 'function') {
      window.showConfirm({
        title: title,
        message: message,
        confirmText: value ? '确认标记' : '确认取消',
        onConfirm: go
      });
    } else if (window.confirm(message)) go();
  }

  function batchEditRemark(ids) {
    if (typeof window.showConfirm !== 'function') {
      var text = window.prompt('请输入新的备注内容（将覆盖选中的 ' + ids.length + ' 条记录）', '');
      if (text == null) return;
      text = String(text).trim();
      if (!text) {
        if (typeof toast === 'function') toast('备注不能为空', 'warning');
        return;
      }
      applyRemark(ids, text);
      return;
    }
    window.showConfirm({
      title: '批量修改备注',
      message: '将覆盖选中的 ' + ids.length + ' 条记录的备注。',
      input: true,
      inputType: 'text',
      inputLabel: '新备注',
      inputPlaceholder: '请输入备注内容',
      inputRequired: true,
      confirmText: '应用',
      onConfirm: function (val) {
        var text = String(val || '').trim();
        if (!text) return;
        applyRemark(ids, text);
      }
    });
  }
  function applyRemark(ids, text) {
    var updated = 0;
    ids.forEach(function (id) {
      for (var i = 0; i < records.length; i++) {
        if (records[i].id === id) {
          records[i].remark = text;
          updated++;
          break;
        }
      }
    });
    if (updated) {
      save({ successMsg: '已批量更新 ' + updated + ' 条备注' });
      refreshList();
    }
  }

  function showView(view) {
    currentView = view || 'board';
    /* 首次进入时确保数据已载入：绕过鉴权时 enterApp 不会调用 reload()，
       否则 records 为空，审核列表与图表都是空的 */
    ensureLoaded();
    /* 审核视图归属独立 section，需同步显隐，避免两组视图同时可见 */
    var isReview = REVIEW_VIEWS.indexOf(currentView) >= 0;
    document.querySelectorAll('#page-finance-ledger .fin-view').forEach(function (el) {
      var v = el.getAttribute('data-fin-view');
      el.hidden = isReview || v !== currentView;
    });
    document.querySelectorAll('#page-review-center .fin-view').forEach(function (el) {
      var v = el.getAttribute('data-review-view');
      el.hidden = !isReview || v !== currentView;
    });
    if (isReview) {
      bindReview();
      renderReview();
      return;
    }
    updateStats();
    updatePendingBadge();
    if (currentView === 'board') renderCharts();
    if (currentView === 'register') { ensureRegisterDp(); ensureBubbleSelects($('page-finance-ledger') || document); }
    if (currentView === 'records') {
      ensureFilterDp();
      refreshList();
    }
    if (currentView === 'amount' || currentView === 'source') {
      try { if (typeof applyFinSettingsTab === 'function') applyFinSettingsTab(window.__finSettingsTab || 'reserve'); } catch (eT) {}
      try { renderReservePeriods(); } catch (eP) {}
      try { renderSources(); } catch (eS) {}
      try { updateStats(); } catch (eU) {}
    }
  }

  function bind() {
    ensureLoaded();
    if (bound) return;
    bound = true;


    var btnResetReserve = $('finBtnResetReserve');
    if (btnResetReserve && !btnResetReserve.__bound) {
      btnResetReserve.__bound = true;
      btnResetReserve.addEventListener('click', function () {
        if ($('finReserveAmount')) $('finReserveAmount').value = '';
        if ($('finReserveStart')) $('finReserveStart').value = '';
        if ($('finReserveEnd')) $('finReserveEnd').value = '';
        var disp = $('finReservePeriodDisplay');
        if (disp) {
          disp.textContent = '请选择生效日期';
          disp.classList.add('is-placeholder');
        }
        if (typeof toast === 'function') toast('已重置额度表单', 'success');
      });
    }
    var btnResetSource = $('finBtnResetSource');
    if (btnResetSource && !btnResetSource.__bound) {
      btnResetSource.__bound = true;
      btnResetSource.addEventListener('click', function () {
        ['finSourceName', 'finSourceAmount', 'finSourcePayer', 'finSourcePayee'].forEach(function (id) {
          if ($(id)) $(id).value = '';
        });
        var per = $('finSourcePeriod');
        if (per) {
          per.value = '';
          try {
            if (per.__bubbleApi && per.__bubbleApi.setValue) per.__bubbleApi.setValue('');
          } catch (e0) {}
        }
        if (typeof pendingSourceImages !== 'undefined') pendingSourceImages = [];
        if (typeof sourcePendingImages !== 'undefined') sourcePendingImages = [];
        var prev = $('finSourceImagePreview');
        if (prev) prev.innerHTML = '';
        var hint = $('finSourceUploadHint');
        if (hint) hint.style.display = '';
        if (typeof toast === 'function') toast('已重置来源表单', 'success');
      });
    }
    var btnR = $('finBtnSaveReserve');
    if (btnR && !btnR.__rsvBound) {
      btnR.__rsvBound = true;
      btnR.addEventListener('click', function () {
        var v = parseFloat(($('finReserveAmount') && $('finReserveAmount').value) || '');
        if (!(v >= 0)) { if (typeof toast === 'function') toast('请输入有效额度', 'warning'); return; }
        var start = (($('finReserveStart') && $('finReserveStart').value) || '').trim();
        var end = (($('finReserveEnd') && $('finReserveEnd').value) || '').trim() || start;
        /* 选区未完成时，尝试从全局日历状态取起止 */
        if (!start && window.__finReserveDp) {
          var st = window.__finReserveDp;
          if (st.pickStart) {
            var ps = st.pickStart, pe = st.pickEnd || st.pickStart;
            start = ps.getFullYear() + '-' + String(ps.getMonth() + 1).padStart(2, '0') + '-' + String(ps.getDate()).padStart(2, '0');
            end = pe.getFullYear() + '-' + String(pe.getMonth() + 1).padStart(2, '0') + '-' + String(pe.getDate()).padStart(2, '0');
          }
        }
        if (!start) {
          if (typeof toast === 'function') toast('请选择生效日期（点选开始日与结束日）', 'warning');
          return;
        }
        var amount = Math.round(v * 100) / 100;
        if (finReserveEditId) {
          var hit = null;
          for (var i = 0; i < reservePeriods.length; i++) {
            if (reservePeriods[i].id === finReserveEditId) { hit = reservePeriods[i]; break; }
          }
          if (hit) {
            hit.amount = amount;
            hit.start = start;
            hit.end = end;
          } else {
            reservePeriods.push({ id: finReserveEditId, amount: amount, start: start, end: end });
          }
        } else {
          reservePeriods.push({ id: 'rp_' + Date.now(), amount: amount, start: start, end: end });
        }
        syncReserveTotal();
        save({ successMsg: '已保存', failMsg: '保存失败' });
        resetReserveForm();
        renderReservePeriods();
        fillSourcePeriodSelect();
        updateStats();
      });
    }
    /* 额度列表编辑/删除 */
    var rsvBox = $('finReserveCards') || $('finReserveTable');
    if (rsvBox && !rsvBox.__rsvBound) {
      rsvBox.__rsvBound = true;
      rsvBox.addEventListener('click', function (e) {
        var del = e.target.closest && e.target.closest('[data-fin-rsv-del]');
        if (!del) return;
        e.preventDefault();
        var did = del.getAttribute('data-fin-rsv-del');
        var go = function () {
          reservePeriods = reservePeriods.filter(function (x) { return x.id !== did; });
          sources.forEach(function (s) {
            if (s.periodId === did) s.periodId = '';
          });
          syncReserveTotal();
          if (finReserveEditId === did) resetReserveForm();
          save({ successMsg: '已删除' });
          renderReservePeriods();
          renderSources();
          updateStats();
        };
        if (typeof window.showConfirm === 'function') {
          window.showConfirm({ title: '删除额度周期', message: '确认删除该额度周期？已绑定来源将解除绑定。', onConfirm: go });
        } else if (window.confirm('确认删除？')) go();
      });
    }

    /* 来源凭证图片上传 */
    (function bindSourceUpload() {
      var zone = $('finSourceUploadZone');
      var file = $('finSourceImageFile');
      if (!zone || !file || zone.__srcUpBound) return;
      zone.__srcUpBound = true;
      function addFiles(fileList) {
        readFilesAsDataUrls(fileList).then(function (list) {
          pendingSourceImages = pendingSourceImages.concat(list).slice(0, 6);
          renderPendingImages('finSourceImagePreview', pendingSourceImages);
        });
      }
      zone.addEventListener('click', function (e) {
        if (e.target.closest && e.target.closest('[data-fin-img-rm]')) return;
        file.click();
      });
      zone.addEventListener('dragover', function (e) { e.preventDefault(); zone.classList.add('is-drag'); });
      zone.addEventListener('dragleave', function () { zone.classList.remove('is-drag'); });
      zone.addEventListener('drop', function (e) {
        e.preventDefault();
        zone.classList.remove('is-drag');
        if (e.dataTransfer && e.dataTransfer.files) addFiles(e.dataTransfer.files);
      });
      file.addEventListener('change', function (e) {
        if (e.target.files) addFiles(e.target.files);
        e.target.value = '';
      });
      var prev = $('finSourceImagePreview');
      if (prev && !prev.__rmBound) {
        prev.__rmBound = true;
        prev.addEventListener('click', function (e) {
          var rm = e.target.closest && e.target.closest('[data-fin-img-rm]');
          if (!rm) return;
          e.preventDefault();
          e.stopPropagation();
          var idx = parseInt(rm.getAttribute('data-fin-img-rm'), 10);
          if (!isNaN(idx)) {
            pendingSourceImages.splice(idx, 1);
            renderPendingImages('finSourceImagePreview', pendingSourceImages);
          }
        });
      }
    })();

    /* 额度页日期选择：完整配置与登记/筛选一致 */
    function ensureReserveDp() {
      var root0 = $('finReserveDatePicker');
      /* 已绑定且面板可交互时不重复绑定，避免选区过程中状态被清空 */
      if (root0 && root0.getAttribute('data-dp-bound') === '1' && window.__finReserveDp && window.__finReserveDp.bound) {
        return;
      }
      if (typeof ensureDatePicker === 'function') {
        ensureDatePicker({
          rootId: 'finReserveDatePicker',
          triggerId: 'finReservePeriodTrigger',
          panelId: 'finReservePeriodPanel',
          startId: 'finReserveStart',
          endId: 'finReserveEnd',
          displayId: 'finReservePeriodDisplay',
          presetsId: 'finReservePeriodPresets',
          calDaysL: 'finReserveCalDaysL',
          calDaysR: 'finReserveCalDaysR',
          calTitleL: 'finReserveCalTitleL',
          calTitleR: 'finReserveCalTitleR',
          single: false,
          defaultPreset: null,
          stateKey: '__finReserveDp',
          placeholder: '请选择日期（可点选起止）'
        });
      } else if (typeof window.bindSharedDatePicker === 'function') {
        var root = $('finReserveDatePicker');
        if (root) root.removeAttribute('data-dp-bound');
        window.__finReserveDp = null;
        window.bindSharedDatePicker({
          rootId: 'finReserveDatePicker',
          triggerId: 'finReservePeriodTrigger',
          panelId: 'finReservePeriodPanel',
          startId: 'finReserveStart',
          endId: 'finReserveEnd',
          displayId: 'finReservePeriodDisplay',
          presetsId: 'finReservePeriodPresets',
          calDaysL: 'finReserveCalDaysL',
          calDaysR: 'finReserveCalDaysR',
          calTitleL: 'finReserveCalTitleL',
          calTitleR: 'finReserveCalTitleR',
          single: false,
          stateKey: '__finReserveDp',
          placeholder: '请选择日期（可点选起止）'
        });
      }
    }
    ensureReserveDp();
    window.ensureReserveDp = ensureReserveDp;
    var btnA = $('finBtnAdd');
    if (btnA) btnA.addEventListener('click', function (e) { e.preventDefault(); addRecord(); });
    var btnReset = $('finBtnReset');
    if (btnReset) btnReset.addEventListener('click', function () { resetForm(); });

    /* 三类上传区：付款截图 / 发票 / 其他 */
    function bindFinUploadZone(zoneId, fileId, previewId, getList, setList) {
      var zone = $(zoneId);
      var file = $(fileId);
      if (!zone || !file) return;
      zone.addEventListener('click', function (e) {
        if (e.target.closest && e.target.closest('[data-fin-img-rm]')) return;
        file.click();
      });
      zone.addEventListener('dragover', function (e) { e.preventDefault(); zone.classList.add('is-drag'); });
      zone.addEventListener('dragleave', function () { zone.classList.remove('is-drag'); });
      zone.addEventListener('drop', function (e) {
        e.preventDefault();
        zone.classList.remove('is-drag');
        if (e.dataTransfer && e.dataTransfer.files) {
          readFilesAsDataUrls(e.dataTransfer.files).then(function (list) {
            setList(getList().concat(list).slice(0, 6));
            renderPendingImages(previewId, getList());
          });
        }
      });
      file.addEventListener('change', function () {
        if (!file.files || !file.files.length) return;
        readFilesAsDataUrls(file.files).then(function (list) {
          setList(getList().concat(list).slice(0, 6));
          renderPendingImages(previewId, getList());
          file.value = '';
        });
      });
      var preview = $(previewId);
      if (preview) {
        preview.addEventListener('click', function (e) {
          var rm = e.target.closest && e.target.closest('[data-fin-img-rm]');
          if (!rm) return;
          e.stopPropagation();
          var i = parseInt(rm.getAttribute('data-fin-img-rm'), 10);
          if (isNaN(i)) return;
          var arr = getList();
          arr.splice(i, 1);
          setList(arr);
          renderPendingImages(previewId, getList());
        });
      }
    }
    bindFinUploadZone('finPayUploadZone', 'finPayImageFile', 'finPayImgPreview',
      function () { return pendingPayImages; },
      function (v) { pendingPayImages = v; });
    bindFinUploadZone('finInvoiceUploadZone', 'finInvoiceImageFile', 'finInvoiceImgPreview',
      function () { return pendingInvoiceImages; },
      function (v) { pendingInvoiceImages = v; });
    bindFinUploadZone('finOtherUploadZone', 'finOtherImageFile', 'finOtherImgPreview',
      function () { return pendingOtherImages; },
      function (v) { pendingOtherImages = v; });

    var dateBtn = $('finDateSort');
    if (dateBtn && !dateBtn.__finSortBound) {
      dateBtn.__finSortBound = true;
      dateBtn.addEventListener('click', function () {
        dateSort = dateSort === 'desc' ? 'asc' : 'desc';
        dateBtn.setAttribute('data-sort', dateSort);
        refreshList();
      });
    }
    var statusTabs = $('finRecordsStatusTabs');
    if (statusTabs && !statusTabs.__finStatusBound) {
      statusTabs.__finStatusBound = true;
      statusTabs.addEventListener('click', function (e) {
        var btn = e.target && e.target.closest ? e.target.closest('[data-fin-status]') : null;
        if (!btn) return;
        filterReviewStatus = btn.getAttribute('data-fin-status') || '';
        var statusSel = $('finFilterStatus');
        if (statusSel) statusSel.value = filterReviewStatus;
        statusTabs.querySelectorAll('.fin-status-tab').forEach(function (t) {
          var on = t === btn;
          t.classList.toggle('is-active', on);
          t.setAttribute('aria-selected', on ? 'true' : 'false');
        });
        refreshList();
      });
    }
    var btnF = $('finBtnFilter');
    if (btnF && !btnF.__finSearchBound) {
      btnF.__finSearchBound = true;
      btnF.addEventListener('click', function () {
        var sel = $('finFilterOperator');
        filterOperator = sel ? String(sel.value || '') : '';
        var statusSel = $('finFilterStatus');
        filterReviewStatus = statusSel ? String(statusSel.value || '') : filterReviewStatus;
        var reimburseSel = $('finFilterReimburse');
        filterReimburse = reimburseSel ? String(reimburseSel.value || '') : '';
        filterStart = ($('finFilterStart') && $('finFilterStart').value) || '';
        filterEnd = ($('finFilterEnd') && $('finFilterEnd').value) || filterStart;
        refreshList();
      });
    }
    var btnFR = $('finBtnFilterReset');
    if (btnFR && !btnFR.__finResetBound) {
      btnFR.__finResetBound = true;
      btnFR.addEventListener('click', function () {
        filterOperator = '';
        filterReviewStatus = '';
        filterReimburse = '';
        filterStart = '';
        filterEnd = '';
        var op = $('finFilterOperator');
        if (op) op.value = '';
        var statusSel = $('finFilterStatus');
        if (statusSel) statusSel.value = '';
        var reimburseSel = $('finFilterReimburse');
        if (reimburseSel) reimburseSel.value = '';
        var fs = $('finFilterStart');
        if (fs) fs.value = '';
        var fe = $('finFilterEnd');
        if (fe) fe.value = '';
        var d = $('finFilterPeriodDisplay');
        if (d) {
          d.textContent = '请选择日期范围';
          d.classList.add('is-placeholder');
        }
        /* 同步气泡选择显示 */
        try {
          if (op && op.dispatchEvent) op.dispatchEvent(new Event('change', { bubbles: true }));
        } catch (e0) {}
        refreshList();
      });
    }
    var btnBatch = $('finBtnBatch');
    var pop = $('finBatchPopover');
    if (btnBatch && pop && !btnBatch.__batchBound) {
      btnBatch.__batchBound = true;
      var popHome = pop.parentNode;
      function placePopover() {
        if (pop.parentNode !== document.body) document.body.appendChild(pop);
        var r = btnBatch.getBoundingClientRect();
        pop.style.position = 'fixed';
        pop.style.top = Math.round(r.bottom + 4) + 'px';
        pop.style.left = 'auto';
        pop.style.right = Math.round(window.innerWidth - r.right) + 'px';
        pop.style.zIndex = '10000';
        pop.style.display = 'block';
      }
      function closePopover() {
        pop.hidden = true;
        pop.style.display = '';
        if (popHome && pop.parentNode !== popHome) popHome.appendChild(pop);
      }
      btnBatch.addEventListener('click', function (e) {
        e.stopPropagation();
        if (pop.hidden) {
          pop.hidden = false;
          placePopover();
        } else {
          closePopover();
        }
      });
      window.addEventListener('resize', function () { if (!pop.hidden) placePopover(); });
      window.addEventListener('scroll', function () { if (!pop.hidden) placePopover(); }, true);
      pop.addEventListener('click', function (e) {
        var item = e.target.closest && e.target.closest('[data-batch]');
        if (!item) return;
        var act = item.getAttribute('data-batch');
        closePopover();
        if (act === 'export') { exportExcel(); return; }
        var ids = Object.keys(selectedIds).filter(function (k) { return selectedIds[k]; });
        if (!ids.length) {
          if (typeof toast === 'function') toast('请先选择记录', 'warning');
          else window.alert('请先选择记录');
          return;
        }
        if (act === 'delete') { batchDeleteRecords(ids); return; }
        if (act === 'remark') { batchEditRemark(ids); return; }
        if (act === 'reimburse') { batchSetReimbursed(ids, true); return; }
        if (act === 'unreimburse') { batchSetReimbursed(ids, false); return; }
      });
      document.addEventListener('click', function (e) {
        if (pop.hidden) return;
        if (btnBatch.contains(e.target) || pop.contains(e.target)) return;
        closePopover();
      });
    }

    var btnEx = $('finBtnExport');
    if (btnEx) btnEx.addEventListener('click', function () { exportExcel(); });

    var btnSrc = $('finBtnAddSource');
    if (btnSrc && !btnSrc.__srcBound) {
      btnSrc.__srcBound = true;
      btnSrc.addEventListener('click', function () {
        var name = (($('finSourceName') && $('finSourceName').value) || '').trim();
        var amountRaw = (($('finSourceAmount') && $('finSourceAmount').value) || '').trim();
        var amount = parseFloat(amountRaw);
        var payer = (($('finSourcePayer') && $('finSourcePayer').value) || '').trim();
        var payee = (($('finSourcePayee') && $('finSourcePayee').value) || '').trim();
        var periodId = (($('finSourcePeriod') && $('finSourcePeriod').value) || '');
        if (!name) { if (typeof toast === 'function') toast('请输入金额来源', 'warning'); return; }
        if (!(amount >= 0) || amountRaw === '') {
          if (typeof toast === 'function') toast('请输入有效金额', 'warning');
          return;
        }
        amount = Math.round(amount * 100) / 100;
        if (finSrcEditId) {
          var hit = null;
          for (var i = 0; i < sources.length; i++) {
            if (sources[i].id === finSrcEditId) { hit = sources[i]; break; }
          }
          if (!hit) {
            if (typeof toast === 'function') toast('记录不存在，请刷新后重试', 'warning');
            resetSourceForm();
            renderSources();
            return;
          }
          hit.name = name;
          hit.amount = amount;
          hit.payer = payer;
          hit.payee = payee;
          hit.periodId = periodId;
          hit.images = pendingSourceImages.slice(0, 6);
          if (!hit.boundAt) hit.boundAt = new Date().toISOString().slice(0, 10);
          save({ successMsg: '已保存', failMsg: '保存失败' });
          resetSourceForm();
          renderSources();
          return;
        }
        var serial = nextSourceSerial();
        sources.push({
          id: serial,
          serial: serial,
          name: name,
          amount: amount,
          payer: payer,
          payee: payee,
          periodId: periodId,
          boundAt: new Date().toISOString().slice(0, 10),
          createdAt: new Date().toISOString(),
          images: pendingSourceImages.slice(0, 6)
        });
        resetSourceForm();
        save({ successMsg: '已添加', failMsg: '添加失败' });
        renderSources();
      });
    }
    var srcTable = $('finSourceTable');
    if (srcTable && !srcTable.__srcBound) {
      srcTable.__srcBound = true;
      srcTable.addEventListener('click', function (e) {
        var view = e.target.closest && e.target.closest('[data-fin-src-view]');
        if (view) {
          e.preventDefault();
          var vid = view.getAttribute('data-fin-src-view');
          var vs = null;
          for (var vi = 0; vi < sources.length; vi++) {
            if (sources[vi].id === vid) { vs = sources[vi]; break; }
          }
          if (vs && typeof openImageViewer === 'function') {
            openImageViewer(normalizeFinImageList(vs.images), 0);
          }
          return;
        }
        var edit = e.target.closest && e.target.closest('[data-fin-src-edit]');
        if (edit) {
          e.preventDefault();
          var eid = edit.getAttribute('data-fin-src-edit');
          if (typeof openSourceDrawer === 'function') openSourceDrawer(eid);
          return;
        }
        var del = e.target.closest && e.target.closest('[data-fin-src-del]');
        if (!del) return;
        e.preventDefault();
        var id = del.getAttribute('data-fin-src-del');
        var target = null;
        for (var si = 0; si < sources.length; si++) { if (sources[si].id === id) { target = sources[si]; break; } }
        var goSrc = function () {
          if (target) {
            target.deleted = true;
            target.deletedAt = new Date().toISOString();
            deletedSources.push(target);
            sources.splice(sources.indexOf(target), 1);
          }
          if (finSrcEditId === id) resetSourceForm();
          save({ successMsg: '已删除' });
          renderSources();
        };
        if (typeof window.showConfirm === 'function') {
          window.showConfirm({
            title: '删除备用金来源',
            message: '确认删除来源「' + ((target && target.name) || '未命名') + '」？删除后登记页不再可选该项。',
            onConfirm: goSrc
          });
        } else if (window.confirm('确认删除该来源？')) goSrc();
      });
    }

    var table = $('finTable');
    if (table) table.addEventListener('click', function (e) {
      if (e.target && (e.target.classList.contains('fin-row-check') || e.target.id === 'finSelectAll')) return;
      var edit = e.target.closest && e.target.closest('[data-fin-edit]');
      if (edit) { openEditDrawer(edit.getAttribute('data-fin-edit')); return; }
      var del = e.target.closest && e.target.closest('[data-fin-del]');
      if (del) {
        var id = del.getAttribute('data-fin-del');
        var target = null;
        for (var di = 0; di < records.length; di++) { if (records[di].id === id) { target = records[di]; break; } }
        var go = function () {
          /* 软删除：打标记并移入墓碑区，界面即时隐藏 */
          if (target) {
            target.deleted = true;
            target.deletedAt = new Date().toISOString();
            deletedRecords.push(target);
            records.splice(records.indexOf(target), 1);
          }
          save({ successMsg: '已删除' });
          refreshList(); updateStats();
          if (currentView === 'board') renderCharts();
        };
        if (typeof window.showConfirm === 'function') {
          window.showConfirm({
            title: '删除使用记录',
            message: '确认删除该条使用记录？' + (target ? '（' + (target.item || '无事项') + ' · ' + money(target.amount) + '）' : '') + '\n删除后列表中不再显示，',
            confirmText: '确认删除',
            onConfirm: go
          });
        } else if (window.confirm('确认删除该条使用记录？')) go();
        return;
      }
      var view = e.target.closest && e.target.closest('.fin-thumb-btn[data-fin-view]');
      if (view) {
        var rec = records.find(function (r) { return r.id === view.getAttribute('data-fin-view'); });
        var kind = view.getAttribute('data-fin-view-kind') || 'pay';
        var imgs = finImagesForRecord(rec, kind);
        if (imgs.length && typeof openImageViewer === 'function') {
          openImageViewer(imgs, 0);
        } else if (typeof toast === 'function') {
          toast('暂无可预览图片', 'warning');
        }
      }
    });

    if (table && !table.__finCheckBound) {
      table.__finCheckBound = true;
      table.addEventListener('change', function (e) {
        var cb = e.target.closest && e.target.closest('.fin-row-check');
        if (!cb) return;
        var id = cb.getAttribute('data-fin-check');
        if (!id) return;
        if (cb.checked) selectedIds[id] = true;
        else delete selectedIds[id];
        syncSelectAll();
      });
    }
    var selAll = $('finSelectAll');
    if (selAll && !selAll.__bound) {
      selAll.__bound = true;
      selAll.addEventListener('change', function () {
        var checks = document.querySelectorAll('#finTableBody .fin-row-check');
        checks.forEach(function (cb) {
          var id = cb.getAttribute('data-fin-check');
          if (!id) return;
          cb.checked = selAll.checked;
          if (selAll.checked) selectedIds[id] = true;
          else delete selectedIds[id];
        });
      });
    }

    if (!window.__finHeatBound) {
      window.__finHeatBound = true;
      document.addEventListener('click', function (e) {
        var btn = e.target.closest && e.target.closest('[data-heat-year]');
        if (!btn) return;
        heatYear = btn.getAttribute('data-heat-year');
        renderHeatmap();
      });
    }

    /* 抽屉保存/取消已改为全局委托（见下方 __finDrawerGlobalBound），此处不再重复绑定 */
  }

  /* 编辑抽屉：保存 / 取消 / 关闭 全局委托，不依赖 bind() 是否已跑过
     （从审核中心「修改并重新提交」打开时也能正常保存或取消） */
  if (!window.__finDrawerGlobalBound) {
    window.__finDrawerGlobalBound = true;
    document.addEventListener('click', function (e) {
      var overlay = document.getElementById('finDrawerOverlay');
      if (!overlay) return;
      var isOpen = !overlay.hidden && (overlay.classList.contains('is-open') || overlay.style.display === 'flex');
      if (!isOpen) return;
      if (e.target === overlay) {
        e.preventDefault();
        closeEditDrawer();
        return;
      }
      if (e.target.closest && (e.target.closest('#finDrawerClose') || e.target.closest('#finDrawerCancel'))) {
        e.preventDefault();
        e.stopPropagation();
        closeEditDrawer();
        return;
      }
      if (e.target.closest && e.target.closest('#finDrawerSave')) {
        e.preventDefault();
        e.stopPropagation();
        saveEditDrawer();
      }
    });
  }

  /* 编辑抽屉图片：全局委托，不依赖 bind 是否已跑过，避免「点了没反应」 */
  if (!window.__finEditImgGlobalBound) {
    window.__finEditImgGlobalBound = true;
    function editImgBucket(fileId) {
      if (fileId === 'finEditPayImageFile') return {
        get: function () { return editPendingPayImages; },
        set: function (v) { editPendingPayImages = v; },
        preview: 'finEditPayImgPreview'
      };
      if (fileId === 'finEditInvoiceImageFile') return {
        get: function () { return editPendingInvoiceImages; },
        set: function (v) { editPendingInvoiceImages = v; },
        preview: 'finEditInvoiceImgPreview'
      };
      if (fileId === 'finEditOtherImageFile' || fileId === 'finEditImageFile') return {
        get: function () { return editPendingOtherImages; },
        set: function (v) { editPendingOtherImages = v; },
        preview: 'finEditOtherImgPreview'
      };
      return null;
    }
    /* change 仅 bindEditUploadZones 处理，避免重复上传 */

    document.addEventListener('click', function (e) {
      /* 上传区已用 label[for] 原生触发，禁止在此 preventDefault / 二次 click */
      var rm = e.target.closest && e.target.closest('#finDrawer [data-fin-img-rm]');
      if (rm) {
        e.preventDefault();
        e.stopPropagation();
        var preview = rm.closest('.fin-img-preview');
        var i = parseInt(rm.getAttribute('data-fin-img-rm'), 10);
        if (isNaN(i) || !preview) return;
        var pid = preview.id;
        var arr = pid === 'finEditPayImgPreview' ? editPendingPayImages
          : (pid === 'finEditInvoiceImgPreview' ? editPendingInvoiceImages : editPendingOtherImages);
        arr.splice(i, 1);
        renderPendingImages(pid, arr);
        return;
      }
      var thumb = e.target.closest && e.target.closest('#finDrawer .fin-img-thumb');
      if (thumb && !(e.target.closest && e.target.closest('[data-fin-img-rm]'))) {
        var box = thumb.closest('.fin-img-preview');
        if (!box) return;
        var list = box.id === 'finEditPayImgPreview' ? editPendingPayImages
          : (box.id === 'finEditInvoiceImgPreview' ? editPendingInvoiceImages : editPendingOtherImages);
        if (!list || !list.length) return;
        var thumbs = box.querySelectorAll('.fin-img-thumb');
        var idx = 0;
        for (var ti = 0; ti < thumbs.length; ti++) {
          if (thumbs[ti] === thumb) { idx = ti; break; }
        }
        if (typeof openImageViewer === 'function') openImageViewer(list, idx);
        else if (typeof window.openImageViewer === 'function') window.openImageViewer(list, idx);
      }
    }, true);
  }

  /* ---------- 审核中心 ---------- */
  /* 对齐审批优化：单节点下区分 通过 / 驳回修改 / 驳回终止，并写流转历史 */
  var REVIEW_STATUS = { pending: '待审核', in_review: '审核中', progress: '审核中', passed: '已通过', rejected: '已驳回' };
  function reviewStatusLabel(r) {
    var st = r.reviewStatus || 'pending';
    if (st === 'rejected' && r.reviewNeedRevise) return '待修改';
    if (st === 'rejected' && r.reviewTerminate) return '已终止';
    return REVIEW_STATUS[st] || st;
  }
  function reviewTagClass(r) {
    var st = r.reviewStatus || 'pending';
    if (st === 'rejected' && r.reviewNeedRevise) return 'revise';
    if (st === 'rejected' && r.reviewTerminate) return 'rejected';
    return st;
  }
  function appendReviewHistory(rec, action, note) {
    if (!rec.reviewHistory) rec.reviewHistory = [];
    rec.reviewHistory.push({
      at: new Date().toISOString(),
      by: currentUser(),
      action: action,
      note: String(note || '').trim()
    });
  }
  function reviewRows(status) {
    /* 已删除不进入；再按「审核人账号 = 登录账号」过滤（管理员可见全部） */
    var list = activeRecords().filter(function (r) {
      return !r.deleted && !r.reviewHidden && canSeeReviewRecord(r);
    });
    if (status === 'done') {
      return list.filter(function (r) { return r.reviewStatus === 'passed' || r.reviewStatus === 'rejected'; })
        .sort(function (a, b) { return String(b.reviewedAt || '').localeCompare(String(a.reviewedAt || '')); });
    }
    if (status === 'progress') {
      return list.filter(function (r) { return r.reviewStatus === 'in_review'; })
        .sort(function (a, b) { return String(a.dateStart || '').localeCompare(String(b.dateStart || '')); });
    }
    return list.filter(function (r) { return (r.reviewStatus || 'pending') === status; })
      .sort(function (a, b) { return String(a.dateStart || '').localeCompare(String(b.dateStart || '')); });
  }
  function reviewRowHtml(r, i, mode) {
    /* mode: 'pending' | 'passed' | 'rejected' */
    var st = r.reviewStatus || 'pending';
    var dateCell = '<td class="fin-date-cell">' + escapeHtml(formatDateRange(r.dateStart, r.dateEnd)) + '</td>';
    var base =
      '<td>' + (i + 1) + '</td>' +
      '<td><span class="fin-ellipsis" title="' + escapeHtml(r.item || '') + '">' + escapeHtml(r.item || '') + '</span></td>' +
      '<td>' + money(r.amount) + '</td>' +
      dateCell +
      '<td>' + escapeHtml(r.userName || '—') + '</td>';
    if (mode === 'pending' || mode === 'progress') {
      var usageNote = (r.desc && String(r.desc).trim()) ? r.desc : (r.remark || '');
      var actHtml = '';
      if (!canActOnPending(r)) {
        actHtml = '<span class="fin-muted">无操作权限</span>';
      } else if (mode === 'pending') {
        /* 待审核：接收进入审核中；也可直接通过/驳回 */
        actHtml =
          '<button type="button" class="fin-link-resubmit" data-review-start="' + r.id + '">开始审核</button>' +
          '<button type="button" class="fin-link-pass" data-review-pass="' + r.id + '">通过</button>' +
          '<button type="button" class="fin-link-reject-revise" data-review-reject-revise="' + r.id + '">驳回修改</button>' +
          '<button type="button" class="fin-link-reject" data-review-reject="' + r.id + '">驳回终止</button>';
      } else {
        actHtml =
          '<button type="button" class="fin-link-pass" data-review-pass="' + r.id + '">通过</button>' +
          '<button type="button" class="fin-link-reject-revise" data-review-reject-revise="' + r.id + '">驳回修改</button>' +
          '<button type="button" class="fin-link-reject" data-review-reject="' + r.id + '">驳回终止</button>';
      }
      return '<tr>' + base +
        '<td><span class="fin-ellipsis" title="' + escapeHtml(usageNote || '') + '">' + escapeHtml(usageNote || '—') + '</span></td>' +
        '<td class="fin-review-ops-cell"><span class="fin-ops-links">' + actHtml + '</span></td></tr>';
    }
    var note = r.reviewNote || '';
    var noteTitle = note || '（无审核说明）';
    var tagLabel = reviewStatusLabel(r);
    var tagCls = reviewTagClass(r);
    var ops = '<span class="fin-review-tag tag-' + tagCls + '">' + escapeHtml(tagLabel) + '</span>';
    /* 驳回修改：先编辑单据再提交，对齐流程图「驳回修改 → 申请人修改单据」 */
    if (mode === 'rejected' && r.reviewNeedRevise) {
      ops += ' <button type="button" class="fin-link-resubmit" data-review-edit-resubmit="' + r.id + '" title="先修改内容再重新提交审核">修改并重新提交</button>';
    }
    return '<tr>' + base +
      '<td>' + escapeHtml(r.reviewer || r.auditor || '—') + '</td>' +
      '<td><span class="fin-ellipsis fin-review-note" title="' + escapeHtml(noteTitle) + '">' +
        escapeHtml(note || '—') + '</span></td>' +
      '<td class="fin-review-ops-cell">' + ops + '</td></tr>';
  }
  function reviewDoneRowHtml(r, i, startIdx) {
    var st = r.reviewStatus || 'rejected';
    var mode = st === 'rejected' ? 'rejected' : 'passed';
    var dateCell = '<td class="fin-date-cell">' + escapeHtml(formatDateRange(r.dateStart, r.dateEnd)) + '</td>';
    var note = r.reviewNote || '';
    var noteTitle = note || '（无审核说明）';
    var tagLabel = reviewStatusLabel(r);
    var tagCls = reviewTagClass(r);
    var idx = (typeof startIdx === 'number' ? startIdx : 0) + i + 1;
    return '<tr>' +
      '<td>' + idx + '</td>' +
      '<td><span class="fin-ellipsis" title="' + escapeHtml(r.item || '') + '">' + escapeHtml(r.item || '') + '</span></td>' +
      '<td>' + money(r.amount) + '</td>' +
      dateCell +
      '<td>' + escapeHtml(r.userName || '—') + '</td>' +
      '<td>' + escapeHtml(r.reviewer || r.auditor || '—') + '</td>' +
      '<td><span class="fin-ellipsis fin-review-note" title="' + escapeHtml(noteTitle) + '">' +
        escapeHtml(note || '—') + '</span></td>' +
      '<td class="fin-review-ops-cell"><span class="fin-review-tag tag-' + tagCls + '">' +
        escapeHtml(tagLabel) + '</span></td>' +
      '<td class="fin-review-ops-cell"><button type="button" class="fin-link-del" data-review-del="' +
        r.id + '">删除</button></td></tr>';
  }


function softDeleteReviewRecord(id) {
    var target = null;
    var di;
    for (di = 0; di < records.length; di++) {
      if (records[di].id === id) { target = records[di]; break; }
    }
    if (!target) {
      if (typeof toast === 'function') toast('记录不存在或已删除', 'error');
      return;
    }
    if (!canSeeReviewRecord(target) && !isAdminUser()) {
      if (typeof toast === 'function') toast('无权删除该记录', 'error');
      return;
    }
    var go = function () {
      /* 仅从审核视图隐藏，不删除使用记录业务数据 */
      target.reviewHidden = true;
      target.reviewHiddenAt = new Date().toISOString();
      try {
        if (target.deleted) {
          target.deleted = false;
          delete target.deletedAt;
        }
      } catch (eClr) {}
      save({ successMsg: '已从审核列表移除' });
      renderReview();
      if (typeof refreshList === 'function') refreshList();
      if (typeof updateStats === 'function') updateStats();
    };
    if (typeof window.showConfirm === 'function') {
      window.showConfirm({
        title: '从审核列表移除',
        message: '确认将「' + (target.item || '该记录') + '」从全部已审中移除？\n金额 ' + money(target.amount) + '。\n使用记录中的数据将保留，可在使用记录中单独删除。',
        confirmText: '确认移除',
        danger: true,
        onConfirm: go
      });
    } else if (window.confirm('确认从审核列表移除？使用记录数据将保留。')) go();
  }
  function renderReview() {
    updatePendingBadge();
    var pending = reviewRows('pending');
    var progress = reviewRows('progress');
    var passed = reviewRows('passed');
    var rejected = reviewRows('rejected');
    var done = reviewRows('done');
    renderFlowSteps({
      pending: pending.length,
      progress: progress.length,
      passed: passed.length,
      rejected: rejected.length,
      done: done.length
    }, currentView);
    var pb = $('reviewPendingBody');
    var pgb = $('reviewProgressBody');
    var psb = $('reviewPassedBody'), rb = $('reviewRejectedBody');
    var db = $('reviewDoneBody');
    if (pb) pb.innerHTML = pending.length
      ? pending.map(function (r, i) { return reviewRowHtml(r, i, 'pending'); }).join('')
      : '<tr><td colspan="7" class="fin-empty-cell">暂无指派给当前账号的待审单 · 审核人须与登录账号名称一致</td></tr>';
    if (pgb) pgb.innerHTML = progress.length
      ? progress.map(function (r, i) { return reviewRowHtml(r, i, 'progress'); }).join('')
      : '<tr><td colspan="7" class="fin-empty-cell">暂无审核中记录 · 请在待审核中点击「开始审核」</td></tr>';
    if (psb) psb.innerHTML = passed.length
      ? passed.map(function (r, i) { return reviewRowHtml(r, i, 'passed'); }).join('')
      : '<tr><td colspan="8" class="fin-empty-cell">暂无已通过记录</td></tr>';
    if (rb) rb.innerHTML = rejected.length
      ? rejected.map(function (r, i) { return reviewRowHtml(r, i, 'rejected'); }).join('')
      : '<tr><td colspan="8" class="fin-empty-cell">暂无已驳回记录</td></tr>';
    ensureReviewDonePager();
    if (reviewDonePager) {
      reviewDonePager.draw();
    } else if (db) {
      db.innerHTML = done.length
        ? done.map(function (r, i) { return reviewDoneRowHtml(r, i, 0); }).join('')
        : '<tr><td colspan="9" class="fin-empty-cell">暂无已审核记录</td></tr>';
    }
    var pm = $('reviewPendingMeta');
    var psm = $('reviewPassedMeta'), rm = $('reviewRejectedMeta'), dm = $('reviewDoneMeta');
    if (pm) {
      pm.textContent = isAdminUser()
        ? ('共 ' + pending.length + ' 条待接收（管理员可见全部）· 可开始审核或直接通过/驳回')
        : ('共 ' + pending.length + ' 条指派给「' + currentUser() + '」· 可开始审核');
    }
    var pgm = $('reviewProgressMeta');
    if (pgm) {
      pgm.textContent = '共 ' + progress.length + ' 条审核中 · 请填写说明后通过或驳回';
    }
    if (psm) psm.textContent = '共 ' + passed.length + ' 条已通过';
    if (rm) rm.textContent = '共 ' + rejected.length + ' 条已驳回（含待修改与已终止）';
    if (dm) dm.textContent = '共 ' + done.length + ' 条已处理（通过 ' + passed.length + ' · 驳回 ' + rejected.length + '）';
  }
  var reviewDonePager = null;
  function ensureReviewDonePager() {
    var mount = $('reviewDonePager');
    if (!mount || typeof createPager !== 'function') return;
    if (reviewDonePager) return;
    reviewDonePager = createPager(mount, {
      pageSize: 20,
      getData: function () { return reviewRows('done'); },
      onPage: function (rows, page, size) {
        var db = $('reviewDoneBody');
        if (!db) return;
        var startIdx = ((page || 1) - 1) * (size || 20);
        db.innerHTML = rows.length
          ? rows.map(function (r, i) { return reviewDoneRowHtml(r, i, startIdx); }).join('')
          : '<tr><td colspan="9" class="fin-empty-cell">暂无已审核记录</td></tr>';
      }
    });
  }
  function updatePendingBadge() {
    var n = reviewRows('pending').length;
    var badge = $('reviewPendingBadge');
    if (badge) {
      badge.textContent = n;
      badge.hidden = n <= 0;
    }
    var n2 = reviewRows('progress').length;
    var badge2 = $('reviewProgressBadge');
    if (badge2) {
      badge2.textContent = n2;
      badge2.hidden = n2 <= 0;
    }
    /* 同步常驻图标栏上的待办角标，让用户在任意页面都能看到待办量 */
    var railBadge = document.querySelector('[data-rail-badge="finance"]');
    if (railBadge) {
      railBadge.textContent = n;
      railBadge.hidden = n <= 0;
    }
  }

  /* 审批时间线：说明真实路径（提交→待审→通过/驳回），
     通过与驳回是终态分支，不是顺序第 3、第 4 步。 */
  function renderFlowSteps(counts, active) {
    var box = $('flowSteps');
    if (!box) return;
    var pendingN = Number(counts.pending) || 0;
    var progressN = Number(counts.progress) || 0;
    var passedN = Number(counts.passed) || 0;
    var rejectedN = Number(counts.rejected) || 0;
    var doneN = Number(counts.done) || 0;
    box.querySelectorAll('[data-flow-count]').forEach(function (el) {
      var attr = el.getAttribute('data-flow-count');
      var n = 0;
      if (attr === 'pending') n = pendingN;
      else if (attr === 'progress') n = progressN;
      else if (attr === 'passed') n = passedN;
      else if (attr === 'rejected') n = rejectedN;
      else if (attr === 'done') n = doneN;
      el.textContent = n + ' 条';
    });
    /* 流程：待审核 → 审核中 → 通过/驳回（终态）→ 全部已审（汇总） */
    box.querySelectorAll('.flow-step').forEach(function (btn) {
      var key = btn.getAttribute('data-flow');
      var isCurrent = key === active;
      var isDone = false;
      if (key === 'pending') {
        isDone = pendingN === 0 && (progressN > 0 || doneN > 0);
      } else if (key === 'progress') {
        isDone = progressN === 0 && doneN > 0;
      } else if (key === 'passed') {
        isDone = active === 'done' && passedN > 0;
      } else if (key === 'rejected') {
        isDone = active === 'done' && rejectedN > 0;
      } else if (key === 'done') {
        isDone = false;
      }
      btn.classList.toggle('is-current', isCurrent);
      btn.classList.toggle('is-done', isDone && !isCurrent);
      btn.classList.toggle('is-rejected', key === 'rejected' && (isCurrent || isDone));
      btn.classList.toggle('is-empty',
        (key === 'pending' && pendingN === 0 && !isCurrent) ||
        (key === 'progress' && progressN === 0 && !isCurrent) ||
        (key === 'passed' && passedN === 0 && !isCurrent) ||
        (key === 'rejected' && rejectedN === 0 && !isCurrent) ||
        (key === 'done' && doneN === 0 && !isCurrent));
      btn.setAttribute('aria-selected', isCurrent ? 'true' : 'false');
    });
  }

    function setReviewStatus(id, status, note, opts) {
    opts = opts || {};
    var rec = null;
    for (var i = 0; i < records.length; i++) { if (records[i].id === id) { rec = records[i]; break; } }
    if (!rec) { if (typeof toast === 'function') toast('记录不存在或已删除', 'error'); return; }
    if (!canActOnPending(rec)) {
      if (typeof toast === 'function') toast('仅单据指定的审核人（或管理员）可操作此审批', 'warning');
      return;
    }
    var noteText = String(note || '').trim();
    if (!noteText) {
      if (typeof toast === 'function') toast('请填写审核说明后再提交', 'warning');
      return;
    }
    var curSt = rec.reviewStatus || 'pending';
    /* 待审 / 审核中 均可终审；已通过、已驳回才禁止重复操作 */
    if (curSt !== 'pending' && curSt !== 'in_review') {
      if (typeof toast === 'function') toast('该记录已审核，无法重复操作', 'warning');
      return;
    }
    rec.reviewStatus = status;
    rec.reviewedAt = new Date().toISOString();
    rec.reviewer = currentUser();
    rec.reviewedBy = currentUser();
    rec.reviewNote = noteText;
    /* 驳回修改：申请人可改后重新提交；驳回终止：流程归档结束 */
    rec.reviewNeedRevise = !!(status === 'rejected' && opts.needRevise);
    rec.reviewTerminate = !!(status === 'rejected' && opts.terminate);
    if (!rec.remark) rec.remark = noteText;
    var histAction = 'passed';
    if (status === 'rejected') histAction = opts.needRevise ? 'reject_revise' : 'reject_terminate';
    appendReviewHistory(rec, histAction, noteText);
    var msg = '已通过';
    if (status === 'rejected') msg = opts.needRevise ? '已驳回，可修改后重新提交' : '已驳回终止';
    save({ successMsg: msg, failMsg: '操作失败' });
    renderReview();
  }

  function startReview(id) {
    var rec = null;
    for (var i = 0; i < records.length; i++) { if (records[i].id === id) { rec = records[i]; break; } }
    if (!rec || (rec.reviewStatus || 'pending') !== 'pending') {
      if (typeof toast === 'function') toast('仅待审核单据可开始审核', 'warning');
      return;
    }
    if (!canActOnPending(rec)) {
      if (typeof toast === 'function') toast('无权操作该单据', 'error');
      return;
    }
    rec.reviewStatus = 'in_review';
    rec.reviewStartedAt = new Date().toISOString();
    rec.reviewer = currentUser();
    appendReviewHistory(rec, 'start_review', '审核人开始处理');
    save({ successMsg: '已进入审核中', failMsg: '操作失败' });
    renderReview();
    if (typeof updatePendingBadge === 'function') updatePendingBadge();
  }

  function resubmitReview(id) {
    var rec = null;
    for (var i = 0; i < records.length; i++) { if (records[i].id === id) { rec = records[i]; break; } }
    if (!rec || !rec.reviewNeedRevise) {
      if (typeof toast === 'function') toast('仅「驳回修改」的单据可重新提交', 'warning');
      return;
    }
    if (!canSeeReviewRecord(rec)) {
      if (typeof toast === 'function') toast('无权操作该单据', 'error');
      return;
    }
    rec.reviewStatus = 'pending';
    rec.reviewNeedRevise = false;
    rec.reviewTerminate = false;
    rec.resubmittedAt = new Date().toISOString();
    appendReviewHistory(rec, 'resubmit', '申请人重新提交');
    save({ successMsg: '提交成功', failMsg: '提交失败' });
    renderReview();
  }

  function bindReview() {
    if (window.__reviewBound) return;
    window.__reviewBound = true;
    var root = $('page-review-center');
    if (!root) return;
    root.addEventListener('click', function (e) {
      var flow = e.target.closest && e.target.closest('[data-flow]');
      if (flow) {
        var view = flow.getAttribute('data-flow');
        var routes = { pending: 'review-pending', progress: 'review-progress', passed: 'review-passed', rejected: 'review-rejected', done: 'review-done' };
        var route = routes[view];
        if (!route) return;
        if (typeof window.switchPage === 'function') window.switchPage(route);
        else showView(view);
        return;
      }
      var delBtn = e.target.closest && e.target.closest('[data-review-del]');
      if (delBtn) {
        softDeleteReviewRecord(delBtn.getAttribute('data-review-del'));
        return;
      }
      /* 修改并重新提交：打开编辑抽屉，保存后自动回待审 */
      var editResub = e.target.closest && e.target.closest('[data-review-edit-resubmit]');
      if (editResub) {
        var editId = editResub.getAttribute('data-review-edit-resubmit');
        var editRec = null;
        for (var ei = 0; ei < records.length; ei++) {
          if (records[ei].id === editId) { editRec = records[ei]; break; }
        }
        if (!editRec || !editRec.reviewNeedRevise) {
          if (typeof toast === 'function') toast('仅「驳回修改」的单据可修改后重新提交', 'warning');
          return;
        }
        if (!canSeeReviewRecord(editRec)) {
          if (typeof toast === 'function') toast('无权查看或修改该单据', 'error');
          return;
        }
        if (typeof openEditDrawer === 'function') {
          openEditDrawer(editId);
          if (typeof toast === 'function') {
            toast('请按驳回原因修改后保存，将自动重新提交审核', 'info');
          }
        }
        return;
      }
      var resub = e.target.closest && e.target.closest('[data-review-resubmit]');
      if (resub) {
        resubmitReview(resub.getAttribute('data-review-resubmit'));
        return;
      }
      var startBtn = e.target.closest && e.target.closest('[data-review-start]');
      if (startBtn) {
        startReview(startBtn.getAttribute('data-review-start'));
        return;
      }
      var pass = e.target.closest && e.target.closest('[data-review-pass]');
      var rejRev = e.target.closest && e.target.closest('[data-review-reject-revise]');
      var rej = e.target.closest && e.target.closest('[data-review-reject]');
      if (!pass && !rej && !rejRev) return;
      var id = (pass || rejRev || rej).getAttribute(
        pass ? 'data-review-pass' : (rejRev ? 'data-review-reject-revise' : 'data-review-reject')
      );
      var next = pass ? 'passed' : 'rejected';
      var opts = {};
      if (rejRev) opts.needRevise = true;
      if (rej && !rejRev) opts.terminate = true;
      var rec = null;
      for (var i = 0; i < records.length; i++) { if (records[i].id === id) { rec = records[i]; break; } }
      if (!rec) return;
      if (!canActOnPending(rec)) {
        if (typeof toast === 'function') toast('无权操作：仅单据指定的审核人可审批', 'error');
        renderReview();
        return;
      }
      var title = '通过审核';
      var conf = '确认通过';
      var label = '通过说明';
      var place = '请填写通过说明 / 备注（必填）';
      if (rejRev) {
        title = '驳回修改'; conf = '确认驳回修改'; label = '驳回修改原因'; place = '请说明需修改的内容（必填）';
      } else if (rej) {
        title = '驳回终止'; conf = '确认驳回终止'; label = '驳回终止原因'; place = '请填写驳回并终止的原因（必填）';
      }
      if (typeof window.showConfirm === 'function') {
        window.showConfirm({
          title: title,
          message: '确认对「' + (rec.item || '该记录') + '」执行「' + title + '」？\n金额 ' + money(rec.amount) + '，操办人 ' + (rec.userName || '未填写') + '。',
          confirmText: conf,
          danger: next !== 'passed',
          input: true,
          inputRequired: true,
          inputLabel: label,
          inputPlaceholder: place,
          onConfirm: function (note) { setReviewStatus(id, next, note, opts); }
        });
      } else {
        var note = window.prompt(label, '');
        if (note == null || !String(note).trim()) {
          if (typeof toast === 'function') toast('请填写审核说明', 'warning');
          return;
        }
        setReviewStatus(id, next, note, opts);
      }
    });
  }

  function render(view) {
    bind();
    showView(view || currentView || 'board');
  }
  window.FinanceModule = {
    render: render,
    bind: bind,
    reload: function () {
      dataLoaded = false;
      var fin = (typeof loadAsync === 'function') ? loadAsync() : Promise.resolve();
      Promise.resolve(fin).then(function () {
        dataLoaded = true;
        updateStats(); updatePendingBadge();
        if (currentView === 'records') refreshList();
        if (currentView === 'board') renderCharts();
        if (REVIEW_VIEWS.indexOf(currentView) >= 0) renderReview();
      }).catch(function () {
        dataLoaded = true;
      });
    },
    showView: showView
  };
})();


/* ========== js/warehouse/wh-module.js ========== */
/* js/warehouse/wh-module.js — 仓库管理：3D 园区 + 库存管理 */
/* ==========================================================================
   仓库管理模块：3D 园区可视化 + 库存管理
   - 数据层：多仓库 / 货架 / 品类 / 出入库流水 / 预警配置（本地生成，可接入真实接口）
   - 可视化：CSS 3D 等轴测园区，轨道旋转 + 缩放 + 平移，点击货架出详情面板
   ========================================================================== */
var WH = (function () {
  'use strict';

  /* ---------- 数据层：仓库 / 货架 / 品类 ---------- */
  /* 仓库与布局均可自定义：DEFAULT_WH 是出厂模板，用户改动存 WH_CFG_KEY */
  var WH_CFG_KEY = 'inventory_check_warehouse_cfg_v8';
  /* 出厂模板：对齐平面图 WH-PL-001 毛绒 / WH-PL-002 良品 / WH-PL-003 中转（1:50）
     房间约 7.2 × 5.0~5.1 m（240 砖墙）。坐标：房间中心为原点，北=-z、西=-x，单位米。 */
  var DEFAULT_WH = [
    /* ========== WH-PL-002 良品仓库 7200×5000 ==========
       北：N-1 N-2 · 南：S-1 S-2 · 西竖列：W-1~W-4 · 中：M-1(五层1.5m) · 旁小货架
       东侧主通道/操作区≈2.4m · 入口 M1 东墙 */
    { id: 'WH-A', code: 'LP-01', name: '良品仓库', area: '约 36 m²', city: '7.2 × 5.0 m', accent: '#4a7cae',
      zones: [
        { key: 'north', name: '北侧靠墙货架组', isGift: false, cols: 2, rows: 1, levels: 4, codes: ['N-1', 'N-2'], pos: [-1.20, -2.10], gapX: 1.50, rw: 1.10, rd: 0.45, accent: '#4a7cae' },
        { key: 'west', name: '西端靠墙竖向列', isGift: false, cols: 1, rows: 4, levels: 4, codes: ['W-1', 'W-2', 'W-3', 'W-4'], pos: [-3.15, 0.0], orientation: 'v', gapZ: 1.15, rw: 1.00, rd: 0.45, accent: '#4a7cae' },
        { key: 'mid', name: '中间五层货架', isGift: false, cols: 1, rows: 1, levels: 5, codes: ['M-1'], pos: [-1.20, 0.0], rw: 1.50, rd: 0.55, accent: '#4a7cae' },
        { key: 'small', name: '小货架', isGift: false, cols: 1, rows: 1, levels: 3, codes: ['M-2'], pos: [-0.15, 0.0], orientation: 'v', rw: 0.55, rd: 0.30, accent: '#4a7cae' },
        { key: 'south', name: '南侧靠墙货架组', isGift: false, cols: 2, rows: 1, levels: 4, codes: ['S-1', 'S-2'], pos: [-1.20, 2.10], gapX: 1.50, rw: 1.10, rd: 0.45, accent: '#4a7cae' },
        { key: 'aisleN', kind: 'aisle', name: '北侧通道', dir: 'ew', note: '净宽≈900', noRack: true, pos: [-1.20, -1.35], pw: 3.2, pd: 0.9, accent: '#9aa3ad' },
        { key: 'aisleS', kind: 'aisle', name: '南侧通道', dir: 'ew', note: '净宽≈900', noRack: true, pos: [-1.20, 1.35], pw: 3.2, pd: 0.9, accent: '#9aa3ad' },
        { key: 'mainAisle', kind: 'aisle', name: '主通道/操作区', dir: 'ns', note: '东侧净宽≈2400', noRack: true, pos: [2.20, 0.0], pw: 2.40, pd: 4.80, accent: '#8a94a0' },
        { key: 'doorM1', kind: 'door', name: '入口 M1', noRack: true, note: '900×2100 内开', pos: [3.45, 0.30], pw: 0.28, pd: 0.90, accent: '#2e7d4f' }
      ] },
    /* ========== WH-PL-001 毛绒仓库 7200×5000 ==========
       北：4-1 4-2 · 中：2-1 2-2 · 南：1-1 1-2 · 西：3-1 3-2 3-3 · 东北杂物区 */
    { id: 'WH-B', code: 'MC-02', name: '毛绒仓库', area: '约 36 m²', city: '7.2 × 5.0 m', accent: '#7a5cb8',
      zones: [
        { key: 'row4', name: '北侧靠墙货架组', isGift: false, cols: 2, rows: 1, levels: 4, codes: ['4-1', '4-2'], pos: [-1.30, -2.10], gapX: 1.40, rw: 1.10, rd: 0.45, accent: '#7a5cb8' },
        { key: 'col3', name: '西端单排货架列', isGift: false, cols: 1, rows: 3, levels: 4, codes: ['3-1', '3-2', '3-3'], pos: [-3.15, -0.15], orientation: 'v', gapZ: 1.35, rw: 1.00, rd: 0.45, accent: '#7a5cb8' },
        { key: 'row2', name: '中间列货架组', isGift: false, cols: 2, rows: 1, levels: 4, codes: ['2-1', '2-2'], pos: [-1.30, -0.35], gapX: 1.30, rw: 1.10, rd: 0.45, accent: '#7a5cb8' },
        { key: 'row1', name: '南侧靠墙货架组', isGift: false, cols: 2, rows: 1, levels: 4, codes: ['1-1', '1-2'], pos: [-1.30, 2.10], gapX: 1.30, rw: 1.10, rd: 0.45, accent: '#7a5cb8' },
        { key: 'misc', name: '杂物区', isGift: false, cols: 1, rows: 1, levels: 1, noRack: true, pos: [2.55, -1.65], pw: 1.70, pd: 1.50, accent: '#b04a4a' },
        { key: 'colAisle', kind: 'aisle', name: '列间通道', dir: 'ew', note: '净宽≈600', noRack: true, pos: [-1.30, -1.20], pw: 3.0, pd: 0.60, accent: '#9aa3ad' },
        { key: 'mainAisle', kind: 'aisle', name: '内部主通道', dir: 'ew', note: '净宽≈1200', noRack: true, pos: [-1.30, 0.90], pw: 3.0, pd: 1.20, accent: '#8a94a0' },
        { key: 'opAisle', kind: 'aisle', name: '东侧操作区', dir: 'ns', note: '净宽≈2400', noRack: true, pos: [2.20, 0.40], pw: 2.40, pd: 3.20, accent: '#8a94a0' },
        { key: 'doorM1', kind: 'door', name: '入口 M1', noRack: true, note: '900×2100 内开', pos: [3.45, 0.20], pw: 0.28, pd: 0.90, accent: '#2e7d4f' }
      ] },
    /* ========== WH-PL-003 中转仓 7200×5100 ==========
       中部横排：S-1 | 承重墙 | S-2 | S-3 · 西南 W-1 竖向 · 东北临时存放 · 南侧主通道东西向 */
    { id: 'WH-C', code: 'ZZ-03', name: '中转仓库', area: '约 37 m²', city: '7.2 × 5.1 m', accent: '#3fb984',
      zones: [
        { key: 'west', name: '西南角靠墙', isGift: false, cols: 1, rows: 1, levels: 4, codes: ['W-1'], pos: [-3.15, 1.40], orientation: 'v', rw: 1.00, rd: 0.45, accent: '#3fb984' },
        { key: 's1', name: '货架 S-1', isGift: false, cols: 1, rows: 1, levels: 4, codes: ['S-1'], pos: [-1.70, -0.55], rw: 1.20, rd: 0.50, accent: '#3fb984' },
        { key: 'wallE', kind: 'wall', name: '承重墙', noRack: true, note: '240厚竖向', pos: [-0.70, -0.55], pw: 0.24, pd: 1.40, accent: '#555b60' },
        { key: 's2', name: '货架 S-2', isGift: false, cols: 1, rows: 1, levels: 4, codes: ['S-2'], pos: [0.40, -0.55], rw: 1.20, rd: 0.50, accent: '#3fb984' },
        { key: 's3', name: '货架 S-3', isGift: false, cols: 1, rows: 1, levels: 4, codes: ['S-3'], pos: [1.85, -0.55], rw: 1.20, rd: 0.50, accent: '#3fb984' },
        { key: 'temp', name: '临时存放点', isGift: false, cols: 1, rows: 1, levels: 1, noRack: true, pos: [2.25, -1.80], pw: 2.20, pd: 1.30, accent: '#d6a12f' },
        { key: 'mainAisle', kind: 'aisle', name: '主通道', dir: 'ew', note: '南侧靠墙 · 东西走向', noRack: true, pos: [0.40, 1.60], pw: 5.80, pd: 1.55, accent: '#8a94a0' },
        { key: 'doorM1', kind: 'door', name: '入口 M1', noRack: true, note: '900×2100 内开', pos: [3.45, -0.40], pw: 0.28, pd: 0.90, accent: '#2e7d4f' }
      ] }
  ];
  var ZONE_PRESETS = [
    { key: 'gift', name: '礼品区', isGift: true },
    { key: 'cargo', name: '货物区', isGift: false },
    { key: 'buffer', name: '暂存区', isGift: false }
  ];

  /* 读取用户配置（名称、编号、面积、城市、分区排布、货架层数） */
  function loadWhCfg() {
    try {
      var raw = localStorage.getItem(WH_CFG_KEY);
      var arr = raw ? JSON.parse(raw) : null;
      if (!Array.isArray(arr) || !arr.length) return JSON.parse(JSON.stringify(DEFAULT_WH));
      return arr.map(function (w, i) {
        var d = DEFAULT_WH[i] || DEFAULT_WH[0];
        var zones = Array.isArray(w.zones) && w.zones.length ? w.zones : d.zones;
        return {
          id: w.id || ('WH-' + i),
          code: (w.code || d.code).slice(0, 12),
          name: (w.name || d.name).slice(0, 20),
          area: (w.area || d.area).slice(0, 20),
          city: (w.city || d.city).slice(0, 30),
          /* 3D 主题色：仓库可自定义，未配置时沿用出厂模板 / 默认蓝 */
          accent: (w.accent || d.accent || '#4a7cae').slice(0, 9),
          zones: zones.map(function (z) {
            var p = ZONE_PRESETS.filter(function (x) { return x.key === z.key; })[0] || ZONE_PRESETS[1];
            var out = {
              key: z.key, name: (z.name || p.name).slice(0, 10), isGift: !!z.isGift,
              cols: Math.max(1, Math.min(6, parseInt(z.cols, 10) || 2)),
              rows: Math.max(1, Math.min(4, parseInt(z.rows, 10) || 1)),
              levels: Math.max(1, Math.min(6, parseInt(z.levels, 10) || 4))
            };
            /* 平面图扩展字段（显式货架编号 / 显式落位 / 无货架功能区）必须原样保留，
               否则保存一次仓库设置后 3D 就退回自动排布、货架名变回自动编号 */
            if (z.accent) out.accent = String(z.accent).slice(0, 9);
            if (Array.isArray(z.codes) && z.codes.length) {
              out.codes = z.codes.map(function (c) { return String(c).slice(0, 12); });
            }
            if (Array.isArray(z.pos) && z.pos.length >= 2 &&
                isFinite(parseFloat(z.pos[0])) && isFinite(parseFloat(z.pos[1]))) {
              out.pos = [parseFloat(z.pos[0]), parseFloat(z.pos[1])];
            }
            if (z.noRack) out.noRack = true;
            if (z.orientation === 'v') out.orientation = 'v';
            /* 建筑构件分区（入口门 / 主通道 / 隔墙）：类型、走向、说明文字必须保留，
               否则保存一次设置后 3D 里的门与通道就消失 */
            if (z.kind) out.kind = String(z.kind).slice(0, 10);
            if (z.dir) out.dir = String(z.dir).slice(0, 4);
            if (z.note) out.note = String(z.note).slice(0, 24);
            /* 平面图实测参数：分区级货架间距 / 货架尺寸 / 功能区地台尺寸，
               与 pos 同理必须原样保留，否则保存设置后间距退回统一网格 */
            ['gapX', 'gapZ', 'rw', 'rd', 'pw', 'pd'].forEach(function (k) {
              var v = parseFloat(z[k]);
              if (isFinite(v) && v > 0) out[k] = Math.min(6, Math.max(0.15, v));
            });
            return out;
          })
        };
      });
    } catch (e) { return JSON.parse(JSON.stringify(DEFAULT_WH)); }
  }
  function saveWhCfg(list) {
    try { localStorage.setItem(WH_CFG_KEY, JSON.stringify(list)); } catch (e) {}
  }

  /* ---------- 货架自定义（编号 / 名称 / 层名称） ----------
     存储结构：{ [whId]: { [rackId]: { code, name, levels: { [levelNo]: name } } } }
     applyRackCustom 在 rebuildLayouts 之后调用，把自定义覆盖到 rack.code/rack.name/level.name
     —— 货架与货架层都可重命名，改名后 3D 标签与详情面板同步生效。 */
  var RACK_CFG_KEY = 'inventory_check_rack_cfg_v1';
  function loadRackCfg() {
    try {
      var raw = localStorage.getItem(RACK_CFG_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) { return {}; }
  }
  function saveRackCfg(cfg) {
    try { localStorage.setItem(RACK_CFG_KEY, JSON.stringify(cfg)); } catch (e) {}
  }
  /* 把自定义编号 / 名称 / 层名称合并进 LAYOUTS 内的对象（原地修改） */
  function applyRackCustom() {
    var cfg = loadRackCfg();
    WAREHOUSES.forEach(function (wh) {
      var layout = LAYOUTS[wh.id];
      if (!layout) return;
      var whCfg = cfg[wh.id] || {};
      layout.racks.forEach(function (rack) {
        var c = whCfg[rack.id];
        if (c && c.code) rack.code = String(c.code).slice(0, 12);
        rack.name = (c && c.name) ? String(c.name).slice(0, 20) : '';
        var lvMap = (c && c.levels) || {};
        rack.levels.forEach(function (lv) {
          lv.name = lvMap[lv.level] ? String(lvMap[lv.level]).slice(0, 16) : '';
        });
      });
    });
  }

  var WAREHOUSES = loadWhCfg();

  /* 品类定义：isGift 决定园区内金色礼品区 / 灰色货物区 */
  var CATEGORIES = [
    { key: 'gift-box',  name: '礼品盒装', isGift: true  },
    { key: 'gift-bag',  name: '礼袋系列', isGift: true  },
    { key: 'drink',     name: '饮料酒水', isGift: false },
    { key: 'daily',     name: '日用百货', isGift: false },
    { key: 'snack',     name: '休闲零食', isGift: false },
    { key: 'season',    name: '节庆礼品', isGift: true  }
  ];

  /* 货品主数据不再内置示例：真实货品一律来自「数据导入」。
     导入的每个 SKU 会成为一条货品记录（含名称与结存数量），
     供 3D 园区陈列、库存预警、滞销分析共用，避免系统自带假数据干扰。
     buildImportGoodsPool() 负责从 STOCK_IMPORT 构建。 */

  var STAFF = ['张启明', '李慧敏', '王振华', '陈思远', '刘晓芸', '赵国强', '孙佳怡', '周文博'];
  var CARRIERS = ['顺丰速运', '京东物流', '德邦快递', '中通快运'];

  /* 伪随机（固定种子 → 每次打开数据一致，便于核对） */
  function seeded(seed) {
    var s = seed % 2147483647;
    if (s <= 0) s += 2147483646;
    return function () {
      s = (s * 16807) % 2147483647;
      return (s - 1) / 2147483646;
    };
  }

  /* 仓库布局：按用户配置生成分区 / 货架阵列 / 每架层数（种子固定，数据稳定可核对） */
  var LAYOUTS = {};
  /* 从导入数据构建货品池：合并 history + current 的 bySku，
     库存量优先取「变更后数量」（结存），无该字段时回退累计出库量。
     没有导入数据时返回空数组 —— 系统不自带示例商品。 */
  function buildImportGoodsPool() {
    var merged = {};
    ['history', 'current'].forEach(function (mode) {
      var im = STOCK_IMPORT[mode];
      if (!im || !im.bySku) return;
      Object.keys(im.bySku).forEach(function (sku) {
        var d = im.bySku[sku];
        if (!merged[sku]) {
          merged[sku] = {
            sku: sku, name: d.name || sku,
            cat: guessCatFromName(d.name || ''),
            price: d.price || 0, qty: 0, whs: {}
          };
        }
        /* 结存数量优先（反映当前真实库存），否则用出库累计 */
        var stock = (typeof d.qtyAfter === 'number' && d.qtyAfter > 0) ? d.qtyAfter : (d.outQty || 0);
        merged[sku].qty = Math.max(merged[sku].qty, stock);
        if (!merged[sku].name && d.name) merged[sku].name = d.name;
        /* 累计 SKU 在各来源仓库的出现次数，供「主仓库」归属判定 */
        if (d.whs) {
          Object.keys(d.whs).forEach(function (w) {
            if (w) merged[sku].whs[w] = (merged[sku].whs[w] || 0) + d.whs[w];
          });
        }
      });
    });
    return Object.keys(merged).map(function (k) {
      var g = merged[k];
      /* 主仓库：出现次数最多的来源仓库（无仓库信息则为空串） */
      var best = '', bestN = 0;
      Object.keys(g.whs).forEach(function (w) {
        if (g.whs[w] > bestN) { best = w; bestN = g.whs[w]; }
      });
      g.wh = best;
      return g;
    });
  }
  /* 按商品名关键词粗分品类：导入数据只给中文分类名，此处映射到内部 key */
  function guessCatFromName(name) {
    var s = String(name || '');
    if (/酒|茶|饮|咖|水|奶|液/.test(s)) return 'drink';
    if (/袋|包|纸|巾|卡|券/.test(s)) return 'daily';
    if (/玩|具|积木|模型|车/.test(s)) return 'toy';
    if (/美妆|护肤|面膜|洗|香/.test(s)) return 'beauty';
    if (/粮|食|饮|果|巧|糖|茶/.test(s)) return 'food';
    return 'gift-box';
  }

  /* ---------- 3D 园区网格常量（仓库设置里的「列数/行数/层数」直接决定这些值） ----------
     R3F 与原生 CSS 3D 两套渲染共用同一份推导，保证同一配置在两种渲染下布局一致。 */
  /* 比例尺：1 世界单位 = 1 米。房间 7.2 × 5.1 m。
     colGap / rowGap = 相邻货架中心距（米），aisle = 分区之间通道宽度（米）。
     RACK_SIZE = 货架物理尺寸（米），必须与 embed 侧 RACK_W / RACK_D 保持一致。 */
  var PARK_GRID = { colGap: 2.0, rowGap: 1.5, aisle: 1.0 };
  var RACK_SIZE = { w: 1.2, d: 0.6 };
  /* 当前舞台画布宽高比：决定分区该横排还是竖排，避免园区细长导致大片留白 */
  function parkAspect() {
    var st = document.getElementById('parkStage');
    if (!st) return 1.4;
    var r = st.getBoundingClientRect();
    return r.height > 0 ? (r.width / r.height) : 1.4;
  }
  /* 依据分区配置推导 3D 世界坐标（原地写入 zone.originX/originZ/spanX/spanZ）。
     修复前的 bug：所有分区共用同一套 (col,row) 网格坐标，只对 gift/buffer 做了
     硬编码偏移（-0.8 / +5.2），cargo 与用户新增的分区完全没有偏移 ——
     于是多个分区的货架叠在同一片区域，仓库设置里改行列，3D 显示对不上。

     本轮进一步修复「园区细长 / 可视范围过小」：
     旧实现把所有分区单向沿 Z 排开，3 分区时园区约 21×62（宽高比 0.34），
     而画布约 1.4 —— 横向必然浪费近七成视野，看起来就是「只有一小块」。
     现在按画布宽高比自动选最优排布：
       · 1~2 个分区 → 单列/单行（本就紧凑，无需拆）
       · 3 个分区 → 优先 1 行 × 3 列（横向铺开，贴近宽画布）
       · 4 个 → 2×2；5~6 个 → 2 行（3+3 / 3+2+1 均衡切分）
     并保证行列块内按块宽高居中，最后整体平移使园区几何中心落在原点。 */
  function layoutZones3D(zones) {
    zones = zones || [];
    if (!zones.length) return { width: 0, depth: 0 };
    /* 每个分区的自身占位（米）：按货架物理尺寸（分区级 rw/rd 可覆盖）+ 朝向 +
       分区级间距（gapX/gapZ 可覆盖）算外接矩形；无货架功能区用地台尺寸（pw/pd 可覆盖）。 */
    var sizes = zones.map(function (z) {
      if (z.noRack) return { w: z.pw || 1.6, d: z.pd || 1.2 };
      var n = Math.max(z.cols || 1, 1), m = Math.max(z.rows || 1, 1);
      var rw = z.rw || RACK_SIZE.w, rd = z.rd || RACK_SIZE.d;
      var gx = z.gapX || PARK_GRID.colGap, gz = z.gapZ || PARK_GRID.rowGap;
      var vert = z.orientation === 'v';
      if (vert) {
        return { w: rd, d: m * rw + (m - 1) * (gz - rw) };
      }
      return { w: n * rw + (n - 1) * (gx - rw),
               d: m * rd + (m - 1) * (gz - rd) };
    });
    var n = zones.length;

    /* 显式落位：全部分区都带 pos（平面图模式）时按「米坐标」直接摆放，
       pos = 分区中心的房间内坐标（以房间中心为原点），随后整体居中。
       只要有一个分区缺 pos（例如用户新增）就走下方自动排布兜底。 */
    var allPos = zones.every(function (z) { return Array.isArray(z.pos) && z.pos.length >= 2; });
    if (allPos) {
      var minXp = Infinity, maxXp = -Infinity, minZp = Infinity, maxZp = -Infinity;
      zones.forEach(function (z, i) {
        z.originX = z.pos[0];
        z.originZ = z.pos[1];
        z.spanX = sizes[i].w;
        z.spanZ = sizes[i].d;
        minXp = Math.min(minXp, z.originX - z.spanX / 2);
        maxXp = Math.max(maxXp, z.originX + z.spanX / 2);
        minZp = Math.min(minZp, z.originZ - z.spanZ / 2);
        maxZp = Math.max(maxZp, z.originZ + z.spanZ / 2);
      });
      /* pos 已是房间绝对坐标（以房间中心为原点、北 = -z），不能再重定心——
         平面图布局天然不对称（西侧列贴墙、东侧留主通道），
         按内容包围盒居中会把整组货架平移、破坏与平面图的对位。 */
      return { width: maxXp - minXp, depth: maxZp - minZp, blockCols: 0, blockRows: 0, explicit: true };
    }

    /* 决定分区块网格：cols 为每行放几个分区 */
    var blockCols;
    if (n <= 2) blockCols = n;                    /* 1~2 个：单行 */
    else if (n === 3) blockCols = 3;              /* 3 个：单行铺开最贴宽画布 */
    else if (n === 4) blockCols = 2;              /* 2×2 */
    else blockCols = 3;                           /* 5~6 个：每行 3 个，均衡 2 行 */
    var blockRows = Math.ceil(n / blockCols);

    /* 单行时若园区仍明显比画布"高瘦"，就转成竖排（2 个分区尤其明显） */
    if (blockRows === 1 && n > 1) {
      var w1 = 0, d1 = 0;
      sizes.forEach(function (s) { w1 += s.w + PARK_GRID.aisle; d1 = Math.max(d1, s.d); });
      w1 -= PARK_GRID.aisle;
      /* 目标比例：让园区宽高比靠近画布（不要求完全一致，取更接近的一侧） */
      var cur = w1 / Math.max(d1, 0.001);
      if (cur < parkAspect() * 0.62) { blockCols = 1; blockRows = n; }
    }

    /* 逐行分配：尽量让每行总宽接近，避免最后一行孤零零 */
    var rowW = [], rowD = [], rowCount = [];
    var idx = 0;
    for (var br = 0; br < blockRows; br++) {
      /* 均衡切分：前面的行多放一个 */
      var perRow = Math.floor(n / blockRows) + (br < (n % blockRows) ? 1 : 0);
      var wsum = 0, dmax = 0;
      for (var k = 0; k < perRow && idx < n; k++, idx++) {
        wsum += sizes[idx].w + PARK_GRID.aisle;
        dmax = Math.max(dmax, sizes[idx].d);
      }
      rowW.push(wsum - PARK_GRID.aisle);
      rowD.push(dmax);
      rowCount.push(perRow);
    }
    var totalW = Math.max.apply(null, rowW);
    var totalD = 0;
    rowD.forEach(function (d, i) { totalD += d + (i < rowD.length - 1 ? PARK_GRID.aisle : 0); });

    /* 落位：块内居中、块间留通道 */
    var cursorZ = 0, i2 = 0;
    for (var br2 = 0; br2 < blockRows; br2++) {
      var cx = -(totalW / 2);                 /* 本行起点（行内整体居中） */
      for (var k2 = 0; k2 < rowCount[br2] && i2 < n; k2++, i2++) {
        var z = zones[i2], s = sizes[i2];
        z.originX = cx + (rowW[br2] - s.w) / 2;
        z.originZ = cursorZ + (rowD[br2] - s.d) / 2;
        z.spanX = s.w;
        z.spanZ = s.d;
        cx += s.w + PARK_GRID.aisle;
      }
      cursorZ += rowD[br2] + PARK_GRID.aisle;
    }
    return { width: totalW, depth: totalD, blockCols: blockCols, blockRows: blockRows };
  }

  function rebuildLayouts() {
    LAYOUTS = {};
    /* 货品池来自导入数据（真实数据以导入为准）。
       无导入时为空数组 —— 仓库/分区/货架结构仍保留（3D 园区与设置面板依赖），
       但不塞入任何伪随机商品，避免系统自带示例数据干扰真实分析。 */
    var importPool = buildImportGoodsPool();
    /* 按 SKU 主仓库把货品池分配到对应仓库：名称能与配置仓库匹配的放对应仓；
       匹配不上（导入未填仓库或名称不一致）按序轮询均分。
       每个 SKU 只进一个仓库 —— 此前每个仓都装全量商品，库存被仓库数放大。 */
    var whPools = {};
    WAREHOUSES.forEach(function (w) { whPools[w.id] = []; });
    var rr = 0;
    importPool.forEach(function (g) {
      var target = null;
      if (g.wh) {
        for (var i = 0; i < WAREHOUSES.length; i++) {
          var w = WAREHOUSES[i];
          if (w.name === g.wh || g.wh.indexOf(w.name) >= 0 || w.name.indexOf(g.wh) >= 0) { target = w.id; break; }
        }
      }
      if (!target) { target = WAREHOUSES[rr % WAREHOUSES.length].id; rr++; }
      whPools[target].push(g);
    });
    WAREHOUSES.forEach(function (wh, wi) {
      var zones = wh.zones || [];
      /* 先按配置推导分区占位与原点，货架坐标才能与设置里的行列一一对应 */
      var lzInfo = layoutZones3D(zones);
      var racks = [];
      var zIndex = 0;   /* 货架渲染层级（用于 CSS 3D 的 z 轴排序） */
      zones.forEach(function (z) {
        /* 特殊功能区（杂物区 / 临时存放点）：只画地台，不生成货架 */
        if (z.noRack) return;
        /* 分区级间距（平面图实测）：缺省回退统一网格 */
        var gx = z.gapX || PARK_GRID.colGap, gz = z.gapZ || PARK_GRID.rowGap;
        /* 分区级货架尺寸（如 M-1 的 1.5m 长货架、小货架 0.6×0.25） */
        var rwZ = z.rw || RACK_SIZE.w, rdZ = z.rd || RACK_SIZE.d;
        for (var c = 0; c < (z.cols || 1); c++) {
          for (var r = 0; r < (z.rows || 1); r++) {
            var levels = [];
            var levelCount = z.levels || 4;
            for (var lv = 1; lv <= levelCount; lv++) {
              /* 品类按分区属性确定，不再随机 */
              var cat = z.isGift ? 'gift-box' : 'daily';
              levels.push({
                level: lv, cat: cat, capacity: 60, stock: 0, name: '',
                goods: []   /* 始终为数组：无导入数据时为空，下游 reduce/forEach 不再需判 null */
              });
            }
            /* 显式编号（平面图模式）：zone.codes 按 cols×rows 生成序对应货架，
               未配置时回退「仓编-分区首字母-序号」的自动规则 */
            var gen = racks.length + 1;
            var code = (Array.isArray(z.codes) && z.codes[c * (z.rows || 1) + r])
              ? z.codes[c * (z.rows || 1) + r]
              : wh.code + '-' + z.key.charAt(0).toUpperCase() + String(gen).padStart(2, '0');
            racks.push({
              id: wh.code + '-R' + String(gen).padStart(2, '0'),
              code: code,
              zone: z.key, zoneName: z.name, isGift: z.isGift,
              col: c, row: r, zIndex: zIndex++,
              /* 货架朝向：'h' 横放（长边沿东西 x）、'v' 竖放（长边沿南北 z，西侧列） */
              orientation: z.orientation === 'v' ? 'v' : 'h',
              /* 分区级货架长/短边（米），embed 按此渲染，缺省 RACK_SIZE */
              rw: rwZ, rd: rdZ,
              /* 3D 世界坐标（米）：分区中心 + 相对行列偏移（关于分区中心对称），
                 与仓库设置的行列严格对应 */
              wx: z.originX + (c - ((z.cols || 1) - 1) / 2) * gx,
              wz: z.originZ + (r - ((z.rows || 1) - 1) / 2) * gz,
              levels: levels
            });
          }
        }
      });
    /* 把本仓货品池逐个货位轮询分配：每个 SKU 在一个仓内只出现一次，
       库存总量 = 导入结存总量，不再被货架数放大。
       礼品类 SKU 优先落礼品分区，其余落普通分区。 */
    var pool0 = whPools[wh.id] || [];
    if (pool0.length) {
      var giftSlots = [], normalSlots = [];
      racks.forEach(function (r) {
        r.levels.forEach(function (lv) {
          (r.isGift ? giftSlots : normalSlots).push(lv);
        });
      });
      var gi = 0, ni = 0;
      pool0.forEach(function (g) {
        var isGift = g.cat === 'gift-box';
        var slot = null;
        if (isGift && giftSlots.length) slot = giftSlots[gi++ % giftSlots.length];
        else if (!isGift && normalSlots.length) slot = normalSlots[ni++ % normalSlots.length];
        else if (normalSlots.length) slot = normalSlots[ni++ % normalSlots.length];
        else if (giftSlots.length) slot = giftSlots[gi++ % giftSlots.length];
        if (slot) slot.goods.push({ sku: g.sku, name: g.name, price: g.price, qty: g.qty || 0 });
      });
      racks.forEach(function (r) {
        r.levels.forEach(function (lv) {
          /* 库存量取自导入的结存数量（变更后数量） */
          lv.stock = lv.goods.reduce(function (s, g) { return s + (g.qty || 0); }, 0);
        });
      });
    }
    /* 显式平面图模式附带房间尺寸：embed 据此画 240 砖墙轮廓、并把取景范围
       扩到整间房（而不是只框货架内容），与平面图逐米对齐一目了然 */
    /* 房间尺寸：优先用仓库 city 字段解析，否则 7.2×5.0；始终传给 R3F 以对齐平面图 */
    var roomW = 7.2, roomD = 5.0;
    if (wh.city) {
      var m = String(wh.city).match(/([\d.]+)\s*[×xX]\s*([\d.]+)/);
      if (m) { roomW = parseFloat(m[1]) || 7.2; roomD = parseFloat(m[2]) || 5.0; }
    }
    LAYOUTS[wh.id] = { zones: zones, racks: racks,
      room: { w: roomW, d: roomD, wall: 0.24 } };
    });
    /* 容量标定（第二遍）：导入数据不含真实货位容量，
       取货位库存的 P90 为基准容量（避免个别超大数量 SKU——如游戏币/积分卡——
       把所有货位压成 0%）。占用率为相对值，展示时截断到 100%。 */
    var lvStocks = [];
    WAREHOUSES.forEach(function (wh) {
      LAYOUTS[wh.id].racks.forEach(function (r) {
        r.levels.forEach(function (lv) { if (lv.stock > 0) lvStocks.push(lv.stock); });
      });
    });
    lvStocks.sort(function (a, b) { return a - b; });
    var p90 = lvStocks.length ? lvStocks[Math.min(lvStocks.length - 1, Math.floor(lvStocks.length * 0.9))] : 0;
    var baseCap = Math.max(60, p90);
    WAREHOUSES.forEach(function (wh) {
      LAYOUTS[wh.id].racks.forEach(function (r) {
        r.levels.forEach(function (lv) { lv.capacity = baseCap; });
      });
    });
  }
  /* 布局构建依赖导入数据（buildImportGoodsPool 读 STOCK_IMPORT）。
     注意：STOCK_IMPORT_KEY / loadStockImport 在下方才声明（var 提升后此处为 undefined），
     若在此处调用 loadStockImport 会以 "undefined" 为 key 读到空数据 ——
     首次构建统一下移到 STOCK_IMPORT 初始化之后（见下方「首次构建」注释）。 */

  /* ---------- 出入库流水（近 7 天） ---------- */
  var FLOWS = [];
  /* 出入库流水：
     有导入数据时以导入的真实变更记录为准（history + current 合并去重）；
     未导入时才回退到布局派生的占位流水，保证三维园区与预警模块有骨架可用。 */
  function rebuildFlows() {
    FLOWS = [];
    /* ---- 优先：导入的真实明细 ---- */
    var seen = {};
    ['history', 'current'].forEach(function (mode) {
      var im = STOCK_IMPORT[mode];
      if (!im || !im.detail || !im.detail.length) return;
      im.detail.forEach(function (d) {
        var key = (mode === 'history' ? 'H' : 'C') + (d.orderNo || '') + '|' + d.sku + '|' + d.time;
        if (seen[key]) return;
        seen[key] = 1;
        FLOWS.push({
          id: 'IM' + String(FLOWS.length + 1).padStart(5, '0'),
          type: d.type,
          whId: '', whName: d.wh || '—',
          rackCode: d.cat || '—', level: 0,
          sku: d.sku, goods: d.goods, qty: d.qty,
          staff: d.by || '—',
          carrier: d.kind || (d.type === 'in' ? '入库' : '出库'),
          orderNo: d.orderNo || '',
          time: new Date(d.time || Date.now())
        });
      });
    });
    /* ---- 回退：布局派生的占位流水 ---- */
    if (!FLOWS.length) {
      WAREHOUSES.forEach(function (wh, wi) {
        var rnd = seeded(421 + wi * 89);
        var racks = LAYOUTS[wh.id].racks;
        if (!racks || !racks.length) return;
        for (var d = 59; d >= 0; d--) {
          var cnt = 2 + Math.floor(rnd() * 5);
          for (var i = 0; i < cnt; i++) {
            var isIn = rnd() > 0.46;
            var rack = racks[Math.floor(rnd() * racks.length)];
            var lvl = rack.levels[Math.floor(rnd() * rack.levels.length)];
            /* 无导入数据时货位为空（goods:[]），跳过占位流水生成，避免越界取 undefined */
            if (!lvl.goods || !lvl.goods.length) continue;
            var g = lvl.goods[Math.floor(rnd() * lvl.goods.length)];
            var qty = 1 + Math.floor(rnd() * 24);
            var dt = new Date();
            dt.setDate(dt.getDate() - d);
            dt.setHours(8 + Math.floor(rnd() * 10), Math.floor(rnd() * 60), 0, 0);
            FLOWS.push({
              id: 'FL' + String(FLOWS.length + 1).padStart(5, '0'),
              type: isIn ? 'in' : 'out',
              whId: wh.id, whName: wh.name,
              rackCode: rack.code, level: lvl.level,
              sku: g.sku, goods: g.name, qty: qty,
              staff: STAFF[Math.floor(rnd() * STAFF.length)],
              carrier: CARRIERS[Math.floor(rnd() * CARRIERS.length)],
              orderNo: '',
              time: dt
            });
          }
        }
      });
    }
    FLOWS.sort(function (a, b) { return b.time - a.time; });
    __ovCache = null; __ovKey = '';
  }
  /* 注意：此处不立即调用 —— STOCK_IMPORT 在下方才初始化，
     提前调用会读到 undefined。首次构建移到 STOCK_IMPORT 赋值之后。 */

  /* ---------- 预警配置（可调，存 localStorage） ---------- */
  var ALERT_CFG_KEY = 'inventory_check_alert_cfg_v2';
  var DEFAULT_ALERT_CFG = {
    lowStock: 20, highValue: 5000, staleDays: 30, on: true,
    excludeKeywords: '游戏币,卡牌,彩票,卡游,卡片,积分币,代币'
  };
  function loadAlertCfg() {
    try {
      var raw = localStorage.getItem(ALERT_CFG_KEY);
      var o = raw ? JSON.parse(raw) : null;
      if (!o) return Object.assign({}, DEFAULT_ALERT_CFG);
      return {
        lowStock: typeof o.lowStock === 'number' ? o.lowStock : DEFAULT_ALERT_CFG.lowStock,
        highValue: typeof o.highValue === 'number' ? o.highValue : DEFAULT_ALERT_CFG.highValue,
        staleDays: typeof o.staleDays === 'number' ? o.staleDays : DEFAULT_ALERT_CFG.staleDays,
        on: o.on !== false,
        excludeKeywords: typeof o.excludeKeywords === 'string' ? o.excludeKeywords : DEFAULT_ALERT_CFG.excludeKeywords
      };
    } catch (e) { return Object.assign({}, DEFAULT_ALERT_CFG); }
  }
  function saveAlertCfg(cfg) {
    try { localStorage.setItem(ALERT_CFG_KEY, JSON.stringify(cfg)); } catch (e) {}
  }

  /* ---------- 统计：KPI / 预警 / 消耗分析 / 滞销分析 ---------- */
  function computeKpis() {
    var totalWh = WAREHOUSES.length;
    var totalRack = 0, totalCap = 0, totalStock = 0;
    WAREHOUSES.forEach(function (wh) {
      LAYOUTS[wh.id].racks.forEach(function (r) {
        totalRack++;
        r.levels.forEach(function (l) { totalCap += l.capacity; totalStock += l.stock; });
      });
    });
    var weekIn = 0, weekOut = 0;
    var now = Date.now();
    FLOWS.forEach(function (f) {
      if (now - f.time.getTime() > 7 * 864e5) return;
      if (f.type === 'in') weekIn += f.qty; else weekOut += f.qty;
    });
    var alerts = computeAlerts(loadAlertCfg());
    return {
      wh: totalWh, rack: totalRack,
      cap: totalCap, stock: totalStock,
      rate: totalCap ? Math.min(100, Math.round(totalStock / totalCap * 1000) / 10) : 0,
      weekIn: weekIn, weekOut: weekOut,
      alertCount: alerts.length
    };
  }

  function computeAlerts(cfg) {
    cfg = cfg || loadAlertCfg();
    var out = [];
    WAREHOUSES.forEach(function (wh) {
      var layout = LAYOUTS[wh.id];
      if (!layout || !layout.racks) return;
      layout.racks.forEach(function (r) {
        r.levels.forEach(function (l) {
          /* 空货位（无货品）不参与预警：无导入数据时所有层 stock=0，
             否则每个空格都误报「低库存」（看板曾因此显示 144 条噪音预警） */
          if (!l.goods || !l.goods.length) return;
          /* 礼品排除：货位上任一货品名称/品类命中关键词则整层跳过 */
          var cat = CATEGORIES.filter(function (c) { return c.key === l.cat; })[0];
          var catName = cat ? cat.name : (l.cat || '');
          var excluded = l.goods.some(function (g) {
            return isExcludedConsumeItem(g.name, catName, cfg);
          }) || isExcludedConsumeItem('', catName, cfg);
          if (excluded) return;
          var value = l.goods.reduce(function (s, g) { return s + g.qty * g.price; }, 0);
          if (cfg.on && l.stock <= cfg.lowStock) {
            out.push({
              level: 'low', wh: wh.name, rackCode: r.code, levelNo: l.level,
              cat: cat ? cat.name : l.cat, stock: l.stock, threshold: cfg.lowStock,
              msg: '库存 ' + l.stock + ' ≤ 阈值 ' + cfg.lowStock
            });
          }
          if (cfg.on && value >= cfg.highValue) {
            out.push({
              level: 'warn', wh: wh.name, rackCode: r.code, levelNo: l.level,
              cat: cat ? cat.name : l.cat, value: value, threshold: cfg.highValue,
              msg: '占用 ¥' + value.toLocaleString() + ' ≥ ¥' + cfg.highValue.toLocaleString()
            });
          }
        });
      });
    });
    return out;
  }

  /* ---------- 库存数据导入（支持 ≥50000 条，分批解析） ----------
     STOCK_IMPORT 存聚合后的统计（不存原始行，避免 localStorage 溢出）：
     { history: { totalRows, bySku: { sku: { name, qty, lastTime } }, importedAt },
       current: { ... } }
     computeConsume 优先用导入数据，回退到 FLOWS */
  var STOCK_IMPORT_KEY = 'inventory_check_stock_import_v1';
  var STOCK_IMPORT = { history: null, current: null };
  function loadStockImport() {
    try {
      var raw = localStorage.getItem(STOCK_IMPORT_KEY);
      var o = raw ? JSON.parse(raw) : null;
      if (!o || typeof o !== 'object') return { history: null, current: null };
      return {
        history: o.history && o.history.bySku ? o.history : null,
        current: o.current && o.current.bySku ? o.current : null
      };
    } catch (e) { return { history: null, current: null }; }
  }
  function saveStockImport() {
    try { localStorage.setItem(STOCK_IMPORT_KEY, JSON.stringify(STOCK_IMPORT)); } catch (e) {}
  }
  /* 首次构建：先读回持久化的导入数据，再建布局（货品池来自导入数据）、
     覆盖货架自定义，最后生成流水。顺序不可颠倒。 */
  STOCK_IMPORT = loadStockImport();
  rebuildLayouts();
  applyRackCustom(); /* 首次构建后把用户自定义编号/名称覆盖到 LAYOUTS */
  rebuildFlows();   /* 依赖 STOCK_IMPORT，必须在其初始化之后 */
  /* 解析单文件：分批处理 50000+ 条，每批 BATCH 条，setTimeout(0) 让出主线程避免卡 UI */
  function parseStockImport(file, mode, onDone) {
    if (typeof XLSX === 'undefined') { toast('Excel 解析库未加载', 'error'); return; }
    var prog = $('stockImportProgress');
    var fill = $('stockImportBarFill');
    var txt = $('stockImportBarText');
    if (prog) prog.hidden = false;
    if (fill) fill.style.width = '0%';
    if (txt) txt.textContent = '读取文件...';

    var reader = new FileReader();
    reader.onerror = function () {
      if (txt) txt.textContent = '文件读取失败';
      showModal('文件读取失败，请重试', 'error');
    };
    reader.onload = function (e) {
      try {
        var data = new Uint8Array(e.target.result);
        if (txt) txt.textContent = '解析工作表...';
        var wb = XLSX.read(data, { type: 'array', raw: false, cellDates: true, cellNF: false, cellText: true });
        if (!wb.SheetNames || !wb.SheetNames.length) { toast('文件中没有工作表', 'error'); return; }
        var sheet = wb.Sheets[wb.SheetNames[0]];
        var aoa = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: false, blankrows: false });
        if (!aoa.length) { toast('文件内容为空', 'error'); return; }
        var headers = aoa[0].map(function (s) { return String(s || '').trim().toLowerCase(); });
        /* 列匹配：SKU / 编号 / 数量 / 名称 / 时间 / 类型 */
        /* 列匹配：兼容两种表头
           A) 库存变更查询标准表头（19 列，见 downloadStockImportTemplate）
              仓库/商品名称/商品编码/商品分类/单位/原数量/变更数量/变更后数量/
              变更金额/变更含税金额/变更类型/摘要/单号/备注/变更时间/账期/供应商/操作人/操作终端
           B) 通用简表（SKU/名称/数量/时间/类型），保留兼容便于历史文件可用 */
        var colSku = -1, colName = -1, colQty = -1, colTime = -1, colType = -1,
            colWh = -1, colCat = -1, colNo = -1, colBy = -1, colQtyAfter = -1, colAmount = -1;
        headers.forEach(function (h, i) {
          if (colWh < 0 && /^(仓库|仓库名称|库房)$/.test(h)) colWh = i;
          if (colSku < 0 && /^(商品编码|商品编号|sku|编码|货号|商品码|条码)$/.test(h)) colSku = i;
          if (colName < 0 && /^(商品名称|名称|品名|商品名|礼品名)$/.test(h)) colName = i;
          if (colCat < 0 && /^(商品分类|分类|品类)$/.test(h)) colCat = i;
          /* 优先匹配「变更数量」；无此列才回退到通用「数量」 */
          if (colQty < 0 && /^(变更数量|变动数量|出库数量|入库数量|消耗量|库存量|数量|qty)$/.test(h)) colQty = i;
          if (colQtyAfter < 0 && /^(变更后数量|结存数量|剩余数量)$/.test(h)) colQtyAfter = i;
          if (colAmount < 0 && /^(变更金额|变更含税金额|金额)$/.test(h)) colAmount = i;
          if (colTime < 0 && /^(变更时间|时间|日期|date|记录时间)$/.test(h)) colTime = i;
          if (colType < 0 && /^(变更类型|类型|方向|出入库|type)$/.test(h)) colType = i;
          if (colNo < 0 && /^(单号|单据编号|流水号)$/.test(h)) colNo = i;
          if (colBy < 0 && /^(操作人|经办人|经手人|制单人)$/.test(h)) colBy = i;
        });
        /* 列匹配失败时按列序兜底：标准表头前 8 列位置固定，
           避免因个别表头多空格/全半角差异导致整表导入失败 */
        if (colSku < 0 && headers.length >= 3) colSku = 2;
        if (colName < 0 && headers.length >= 2) colName = 1;
        if (colQty < 0 && headers.length >= 7) colQty = 6;
        if (colSku < 0 || colQty < 0) {
          if (txt) txt.textContent = '缺少必填列';
          showModal('缺少必填列：需要「商品编码/SKU」和「变更数量/数量」列', 'error');
          if (prog) prog.hidden = true;
          return;
        }
        var total = aoa.length - 1;
        if (txt) txt.textContent = '共 ' + total + ' 行，分批解析中...';
        var bySku = {};
        /* 明细行：保留原始记录供「出入库动态」页使用。
           只存聚合会在流水页丢失去向/单号/操作人等字段；
           限 5000 条以免撑爆 localStorage，超出部分仅计入聚合。 */
        var detailRows = [];
        var DETAIL_CAP = 5000;
        var BATCH = 2000;
        var idx = 1;
        var skipBad = 0;
        function batch() {
          var end = Math.min(idx + BATCH, aoa.length);
          for (; idx < end; idx++) {
            var row = aoa[idx];
            var sku = String(row[colSku] || '').trim();
            if (!sku) { skipBad++; continue; }
            /* 防科学计数法 */
            if (/e\+/i.test(sku)) sku = Number(sku).toFixed(0);
            var qty = parseFloat(row[colQty]);
            if (isNaN(qty) || qty === 0) { skipBad++; continue; }
            /* 方向判定优先级：
               1) 变更类型列（兑换/领用/退货…）无法直接映射出入库，故以数量符号为准
                  —— 库存变更查询中「变更数量」为负表示出库（消耗），为正表示入库；
               2) 数量为正时，若类型列含 in/入库 则仍判为入库，否则默认出库（消耗场景为主） */
            var sign = qty > 0 ? 1 : -1;
            var mag = Math.abs(qty);
            var typeWord = colType >= 0 ? String(row[colType] || '').trim() : '';
            var type;
            if (sign < 0) {
              type = 'out';
            } else if (/入库|进货|收货|入库单/.test(typeWord) || /^in$/i.test(typeWord)) {
              type = 'in';
            } else {
              type = 'out';
            }
            var name = colName >= 0 ? String(row[colName] || '').trim() : '';
            var wh = colWh >= 0 ? String(row[colWh] || '').trim() : '';
            var cat = colCat >= 0 ? String(row[colCat] || '').trim() : '';
            var orderNo = colNo >= 0 ? String(row[colNo] || '').trim() : '';
            var by = colBy >= 0 ? String(row[colBy] || '').trim() : '';
            var t = colTime >= 0 ? row[colTime] : '';
            var tObj = t ? new Date(t) : null;
            if (tObj && isNaN(tObj.getTime())) tObj = null;
            /* 采集明细行：出入库动态页直接渲染这些记录 */
            if (detailRows.length < DETAIL_CAP) {
              detailRows.push({
                type: type, sku: sku, goods: name, qty: mag,
                wh: wh, cat: cat, orderNo: orderNo, by: by,
                kind: typeWord, time: tObj ? tObj.getTime() : (mode === 'current' ? Date.now() : 0)
              });
            }
            if (!bySku[sku]) {
              bySku[sku] = {
                name: name, qty: 0, lastTime: null,
                inQty: 0, outQty: 0, whs: {}, cats: {}, orders: 0, staff: {}
              };
            }
            var rec = bySku[sku];
            if (name && !rec.name) rec.name = name;
            if (type === 'in') rec.inQty += mag; else rec.outQty += mag;
            rec.qty = rec.outQty;                 /* 消耗分析以出库量为准 */
            /* 结存数量（变更后数量列）：同一 SKU 按变更时间取最新一条，反映当前真实库存 */
            if (colQtyAfter >= 0) {
              var qa = parseFloat(row[colQtyAfter]);
              if (!isNaN(qa)) {
                var qaT = tObj ? tObj.getTime() : 0;
                if (typeof rec.qtyAfterTime !== 'number' || qaT >= rec.qtyAfterTime) {
                  rec.qtyAfter = qa;
                  rec.qtyAfterTime = qaT;
                }
              }
            }
            if (wh) rec.whs[wh] = (rec.whs[wh] || 0) + 1;
            if (cat) rec.cats[cat] = (rec.cats[cat] || 0) + 1;
            if (orderNo) rec.orders++;
            if (by) rec.staff[by] = (rec.staff[by] || 0) + 1;
            if (tObj && (!rec.lastTime || tObj > rec.lastTime)) rec.lastTime = tObj;
          }
          var pct = Math.round(idx / aoa.length * 100);
          if (fill) fill.style.width = pct + '%';
          if (txt) txt.textContent = '已解析 ' + (idx - 1) + ' / ' + total + ' 行（' + pct + '%）';
          if (idx < aoa.length) {
            setTimeout(batch, 0);
          } else {
            var skuCount = Object.keys(bySku).length;
            var result = {
              totalRows: total - skipBad, skuCount: skuCount, skipBad: skipBad,
              bySku: bySku, detail: detailRows,
              detailTruncated: total - skipBad > DETAIL_CAP,
              importedAt: new Date().toISOString()
            };
            STOCK_IMPORT[mode] = result;
            saveStockImport();
            /* 导入后立刻重建布局与流水：让 3D 园区库存、KPI 与「出入库动态」页马上反映真实数据 */
            rebuildLayouts();
            applyRackCustom();
            rebuildFlows();
            if (txt) txt.textContent = '完成：' + skuCount + ' 个 SKU · ' + (total - skipBad) + ' 条有效';
            if (prog) setTimeout(function () { prog.hidden = true; }, 1800);
            renderStockImportOverview();
            /* 刷新各分析视图 */
            renderConsume();
            renderSlowSell();
            renderStockKpis();
            renderFlow();
            if (flowPager) { flowPager.pageSize = flowPager.pageSize || 10; flowPager.reset(); }
            if (onDone) onDone(result);
            toast((mode === 'history' ? '历史' : '当前') + '数据导入成功：' + skuCount + ' 个 SKU · ' + FLOWS.length + ' 条流水', 'success');
          }
        }
        setTimeout(batch, 0);
      } catch (err) {
        if (txt) txt.textContent = '解析失败';
        showModal('导入失败：' + (err && err.message ? err.message : '未知错误'), 'error');
        if (prog) prog.hidden = true;
      }
    };
    reader.readAsArrayBuffer(file);
  }

  /* 渲染已导入数据概览 */
  function renderStockImportOverview() {
    var box = $('stockImportOverview');
    if (!box) return;
    var html = '';
    var h = STOCK_IMPORT.history, c = STOCK_IMPORT.current;
    if (!h && !c) {
      box.innerHTML = '<div class="alert-empty">尚未导入数据，消耗分析将使用系统内置近 7 天流水</div>';
      return;
    }
    if (h) {
      var hQty = 0; Object.keys(h.bySku).forEach(function (k) { hQty += h.bySku[k].qty; });
      html += '<div class="stock-import-stat"><span class="stock-import-stat-k">历史数据</span>' +
        '<span class="stock-import-stat-v">' + h.skuCount + ' SKU · ' + hQty + ' 件出库</span></div>';
      html += '<div class="stock-import-stat"><span class="stock-import-stat-k">导入时间</span>' +
        '<span class="stock-import-stat-v">' + new Date(h.importedAt).toLocaleString('zh-CN', { hour12: false }) + '</span></div>';
    }
    if (c) {
      var cQty = 0; Object.keys(c.bySku).forEach(function (k) { cQty += c.bySku[k].qty; });
      html += '<div class="stock-import-stat"><span class="stock-import-stat-k">当前数据</span>' +
        '<span class="stock-import-stat-v">' + c.skuCount + ' SKU · ' + cQty + ' 件出库</span></div>';
      html += '<div class="stock-import-stat"><span class="stock-import-stat-k">导入时间</span>' +
        '<span class="stock-import-stat-v">' + new Date(c.importedAt).toLocaleString('zh-CN', { hour12: false }) + '</span></div>';
    }
    box.innerHTML = html;
  }

  /* 礼品排除关键词：与预警配置共用 */
  function getExcludeKeywordList(cfg) {
    cfg = cfg || loadAlertCfg();
    var raw = (cfg && cfg.excludeKeywords != null) ? String(cfg.excludeKeywords) : DEFAULT_ALERT_CFG.excludeKeywords;
    return raw.split(/[,，、;；\s]+/).map(function (s) { return s.trim(); }).filter(Boolean);
  }
  function isExcludedConsumeItem(name, cat, cfg) {
    var t = String(name || '') + ' ' + String(cat || '');
    if (!t.trim()) return false;
    var keys = getExcludeKeywordList(cfg);
    for (var i = 0; i < keys.length; i++) {
      if (keys[i] && t.indexOf(keys[i]) >= 0) return true;
    }
    return false;
  }
  function finalizeConsumeRows(rows) {
    rows = (rows || []).filter(function (r) {
      return !isExcludedConsumeItem(r.name, r.cat);
    });
    rows.sort(function (a, b) { return b.qty - a.qty; });
    var total = rows.reduce(function (s, r) { return s + r.qty; }, 0);
    var avg = rows.length ? total / rows.length : 0;
    var max = rows.length ? rows[0].qty : 0;
    return rows.map(function (r) {
      return {
        sku: r.sku,
        name: r.name,
        qty: r.qty,
        source: r.source,
        tier: r.qty >= avg * 1.5 ? 'high' : (r.qty <= avg * 0.5 ? 'low' : 'mid'),
        max: max
      };
    });
  }

  /* 礼品消耗分析：近 30 天出库数量 → 高/低消耗分层
     优先用 STOCK_IMPORT 数据，回退到 FLOWS；已排除游戏币/卡牌/彩票 */
  function computeConsume() {
    /* 优先用当前导入数据 */
    if (STOCK_IMPORT.current && STOCK_IMPORT.current.bySku) {
      var bySku = {};
      Object.keys(STOCK_IMPORT.current.bySku).forEach(function (sku) {
        var d = STOCK_IMPORT.current.bySku[sku];
        bySku[sku] = d.qty;
      });
      /* 补齐零消耗礼品 */
      var poolCur = buildImportGoodsPool();
      poolCur.forEach(function (g) { if (bySku[g.sku] === undefined) bySku[g.sku] = 0; });
      var rows = Object.keys(bySku).map(function (sku) {
        var g = poolCur.filter(function (x) { return x.sku === sku; })[0];
        var imported = STOCK_IMPORT.current.bySku[sku];
        return {
          sku: sku,
          name: (imported && imported.name) || (g ? g.name : sku),
          cat: (imported && imported.cat) || (g ? g.cat : ''),
          qty: bySku[sku],
          source: 'imported'
        };
      });
      return finalizeConsumeRows(rows);
    }
    /* 回退：FLOWS 近 30 天 */
    var bySku2 = {};
    var now = Date.now();
    FLOWS.forEach(function (f) {
      if (f.type !== 'out') return;
      if (now - f.time.getTime() > 30 * 864e5) return;
      bySku2[f.sku] = (bySku2[f.sku] || 0) + f.qty;
    });
    /* 补齐零消耗礼品，保证分层完整
       注意：本分支的累加容器是 bySku2（导入分支才用 bySku），此处必须一致，
       否则会读取到另一个分支的局部变量并抛 TypeError。 */
    var poolFb = buildImportGoodsPool();
    poolFb.forEach(function (g) {
      if (bySku2[g.sku] === undefined) bySku2[g.sku] = 0;
    });
    var rowsFb = Object.keys(bySku2).map(function (sku) {
      var g = poolFb.filter(function (x) { return x.sku === sku; })[0];
      return {
        sku: sku,
        name: g ? g.name : sku,
        cat: g ? g.cat : '',
        qty: bySku2[sku]
      };
    });
    return finalizeConsumeRows(rowsFb);
  }

  /* 滞销库存：仍有库存但超过阈值天数未出库 / 高占用
     结合消耗数据（consumeMap: { sku: qty }）给出处理建议 */
  function slowAdvice(r, cq, cfg) {
    if (r.idleDays >= 90 && cq === 0) return { text: '清仓促销', level: 'danger' };
    if (r.idleDays >= cfg.staleDays && cq === 0) return { text: '清仓促销', level: 'danger' };
    if (r.idleDays >= 60 && r.value >= cfg.highValue) return { text: '调拨热销仓', level: 'warn' };
    if (r.value >= cfg.highValue && cq === 0) return { text: '调拨热销仓', level: 'warn' };
    if (r.idleDays >= cfg.staleDays && cq > 0) return { text: '持续观察', level: 'info' };
    if (r.qty <= cfg.lowStock && cq > 0) return { text: '建议补货', level: 'ok' };
    if (r.value >= cfg.highValue) return { text: '调拨热销仓', level: 'warn' };
    return { text: '暂不处理', level: 'muted' };
  }
  function computeSlowSell(cfg, consumeMap) {
    var cmap = consumeMap || {};
    var lastOut = {};
    FLOWS.forEach(function (f) {
      if (f.type !== 'out') return;
      if (!lastOut[f.sku] || f.time > lastOut[f.sku]) lastOut[f.sku] = f.time;
    });
    /* SKU → 品类映射表：循环外建一次，避免在双层遍历里重复构建（O(货位) 次重建） */
    var catOf = {};
    buildImportGoodsPool().forEach(function (g) { catOf[g.sku] = g.cat; });
    var now = Date.now();
    var rows = [];
    WAREHOUSES.forEach(function (wh) {
      LAYOUTS[wh.id].racks.forEach(function (r) {
        r.levels.forEach(function (l) {
          l.goods.forEach(function (g) {
            var lo = lastOut[g.sku];
            var idleDays = lo ? Math.floor((now - lo.getTime()) / 864e5) : 999;
            var value = g.qty * g.price;
            if (g.qty > 0 && (idleDays >= cfg.staleDays || value >= cfg.highValue)) {
              var cq = cmap[g.sku] || 0;
              var row = {
                sku: g.sku, name: g.name, qty: g.qty, value: value,
                wh: wh.name, rackCode: r.code,
                cat: (CATEGORIES.filter(function (c) { return c.key === catOf[g.sku]; })[0] || {}).name || '-',
                idleDays: idleDays, lastOut: lo ? lo : null, consumeQty: cq,
                stale: idleDays >= cfg.staleDays,
                high: value >= cfg.highValue
              };
              row.advice = slowAdvice(row, cq, cfg);
              rows.push(row);
            }
          });
        });
      });
    });
    /* 跨仓库同 SKU 去重合并，保留占用最高的一条 */
    var map = {};
    rows.forEach(function (r) {
      if (!map[r.sku] || r.value > map[r.sku].value) map[r.sku] = r;
    });
    return Object.keys(map).map(function (k) { return map[k]; })
      .sort(function (a, b) { return b.value - a.value; });
  }

  /* ---------- 3D 园区渲染 ---------- */
  var stage = null, scene = null;
  /* 默认俯角 / 旋转角：集中定义一处，避免 JS 与 CSS 各写一份而漂移。
     56° 太陡（接近正交俯视，透视被压扁）；48° 能充分呈现"近大远小"。
     CSS 里 .park-scene 的初值只是首帧占位，真正生效的是 JS 的 applyCam。 */
  var CAM_RX = 48, CAM_RZ = -34;
  var cam = { rx: CAM_RX, rz: CAM_RZ, scale: 1.45, ox: -96, oy: -60 };
  var autoRotate = true, selectedRack = null, curWh = WAREHOUSES[0].id;
  var RACK_GAP = { x: 108, y: 82 };
  /* 货架立体参数（CSS 3D 降级路径）。
     【根因·层高不足】此前 LEVEL_Z=26、RACK_D=34，层板只是薄薄一片平面，
     加上整链路无透视，层与层的屏幕 Y 差实测仅 20px、层高恒为 24px ——
     视觉上所有层挤在同一平面，"像一摞贴纸"，完全没有立体感。
     现在：层间距与货架进深同步加大，并给每层加"层板 + 立柱 + 侧板 + 背板"，
     让每一层本身成为一个可见的立方体腔室，光影才有承载面。 */
  var LEVEL_Z = 42;  /* 层间距：控制货架总高，避免立柱穿地 */
  var RACK_W = 62, RACK_D = 52;  /* 货架宽 / 进深：进深加大才有侧板与背板的空间 */
  /* 立柱宽：5 → 7 → 9。立柱改为真正竖直的柱体后（见下方 park-rack-post-v），
     9px 在 48° 俯角下投影约 6px，是远距下仍能一眼分辨的最小宽度。
     不影响 RACK_W 与 RACK_D 的布局推算（柱位取的是 x + RACK_W - POST_W 增量固定）。 */
  var POST_W = 9;
  var BOARD_T = 5;               /* 层板厚 */
  /* 3D 标签的透视深度：须与 CSS .park-stage 的 perspective 一致，
     否则 projectLabels() 算出的屏幕位置与浏览器实际渲染会有偏移。 */
  var PARK_PERSPECTIVE = 1500;

  function fillVar(rate) {
    var v = Math.max(0, Math.min(1, rate));
    if (v >= 0.75) return 'var(--fill-3)';
    if (v >= 0.5)  return 'var(--fill-2)';
    if (v >= 0.25) return 'var(--fill-1)';
    return 'var(--fill-0)';
  }

  function renderWhSwitch() {
    var box = $('parkWhSwitch');
    if (!box) return;
    var html = '';
    WAREHOUSES.forEach(function (wh) {
      var st = whStat(wh.id);
      html += '<button type="button" class="park-wh' + (wh.id === curWh ? ' active' : '') +
        '" role="tab" aria-selected="' + (wh.id === curWh) + '" data-wh="' + wh.id + '">' +
        '<span class="park-wh-name">' + escapeHtml(wh.name) + '</span>' +
        '<span class="park-wh-meta">' + wh.code + ' · ' + st.rack + ' 架 · 占用 ' + st.rate + '%</span>' +
        '</button>';
    });
    box.innerHTML = html;
    box.querySelectorAll('.park-wh').forEach(function (b) {
      b.addEventListener('click', function () {
        curWh = b.getAttribute('data-wh');
        selectedRack = null;
        /* 换仓后园区占位可能完全不同，需重新取景 */
        cssCamFitted = false;
        renderWhSwitch();
        renderPark();
        renderPanelEmpty();
        if (r3fReady && parkApp && parkApp.setView) parkApp.setView('reset');
      });
    });
  }

  function whStat(whId) {
    var racks = LAYOUTS[whId].racks;
    var cap = 0, stock = 0;
    racks.forEach(function (r) { r.levels.forEach(function (l) { cap += l.capacity; stock += l.stock; }); });
    return { rack: racks.length, cap: cap, stock: stock, rate: cap ? Math.min(100, Math.round(stock / cap * 100)) : 0 };
  }

  function renderLegend() {
    var box = $('parkLegend');
    if (!box) return;
    box.innerHTML = '<span class="park-legend-title">货位占用</span>' +
      '<span class="park-legend-scale">' +
      '<span class="park-legend-sw" style="background:var(--fill-0)"></span>' +
      '<span class="park-legend-sw" style="background:var(--fill-1)"></span>' +
      '<span class="park-legend-sw" style="background:var(--fill-2)"></span>' +
      '<span class="park-legend-sw" style="background:var(--fill-3)"></span>' +
      '</span>' +
      '<span class="park-legend-title">低 → 高</span>';
  }

  function renderPark() {
    /* React Three Fiber 就绪时由其接管渲染 */
    if (r3fReady && parkApp) {
      var _wh = WAREHOUSES.filter(function (w) { return w.id === curWh; })[0];
      if (_wh) {
        /* 闪屏修复：未挂载走 mount；已挂载用 rAF 防抖合并同帧多次 update，
           避免 openRack→renderPark→updateR3F→root.render 链式高频全量重渲 */
        if (!r3fMounted) {
          mountR3F(curWh, LAYOUTS[curWh], selectedRack);
        } else {
          if (r3fRafId) cancelAnimationFrame(r3fRafId);
          r3fRafId = requestAnimationFrame(function () {
            r3fRafId = null;
            updateR3F(curWh, LAYOUTS[curWh], selectedRack);
          });
        }
        var st0 = whStat(curWh);
        var h1 = $('parkHudWh'); if (h1) h1.textContent = _wh.name;
        var h2 = $('parkHudRack'); if (h2) h2.textContent = st0.rack + ' 个';
        var h3 = $('parkHudCat'); if (h3) h3.textContent = LAYOUTS[curWh].zones.length + ' 个分区';
        return;
      }
    }
    if (!scene) {
      stage = $('parkStage'); scene = $('parkScene');
      if (!stage || !scene) return;
      bindParkControls();
    }
    /* 明确标记：当前为 CSS 降级，方便排查 */
    if (stage) {
      stage.classList.remove('r3f-active');
      stage.setAttribute('data-render', 'css3d');
      var modeTip = $('parkRenderModeTip');
      if (!modeTip) {
        modeTip = document.createElement('div');
        modeTip.id = 'parkRenderModeTip';
        modeTip.style.cssText = 'position:absolute;left:12px;bottom:48px;z-index:20;background:rgba(30,50,80,0.82);color:#fff;padding:6px 10px;border-radius:8px;font-size:12px;font-family:system-ui,sans-serif;pointer-events:none;';
        stage.appendChild(modeTip);
      }
      modeTip.textContent = r3fReady ? 'Three.js 渲染中…' : 'CSS 3D 降级（Three.js 未加载）';
      modeTip.style.background = r3fReady ? 'rgba(40,120,80,0.85)' : 'rgba(180,60,40,0.9)';
    }
    var wh = WAREHOUSES.filter(function (w) { return w.id === curWh; })[0];
    var layout = LAYOUTS[curWh];
    var html = '<div class="park-world">';
    html += '<div class="park-floor"></div>';
    /* 文字标签统一收集到屏幕空间覆盖层（不进 3D 变换链，避免被 rotateX 压扁） */
    var labelItems = [];

    /* 分区地台：按配置行列推导的真实占位（originX/originZ/spanX/spanZ 与 R3F 同一份数据），
       只把世界单位换算成 CSS 像素，保证两种渲染的布局完全一致。 */
    var U = RACK_GAP.x / PARK_GRID.colGap;   /* 世界单位 → CSS px 的统一换算系数 */
    layout.zones.forEach(function (z) {
      var w = (z.spanX || z.cols * PARK_GRID.colGap) * U + 44;
      var d = (z.spanZ || z.rows * PARK_GRID.rowGap) * U + 44;
      var ox = (typeof z.originX === 'number' ? z.originX * U : 0) + (RACK_W - (z.spanX || z.cols * PARK_GRID.colGap) * U) / 2;
      var oy = typeof z.originZ === 'number' ? z.originZ * U : 0;
      /* 建筑构件（入口门 / 主通道 / 隔墙）：只出标签不出地台色块，
         且标签文案走构件语义——这些分区没有 cols/rows/levels，
         拼「N 列 × N 行」会得到 undefined。 */
      if (z.kind) {
        labelItems.push({
          cls: 'park3d-zone' + (z.isGift ? ' gift' : '') + ' norack',
          html: '<span class="park3d-zone-n">' + escapeHtml(z.name) + '</span>' +
            '<span class="park3d-zone-m">' + escapeHtml(
              z.kind === 'door' ? '门洞 900 × 2100 · 内开' : (z.note || (z.dir === 'ns' ? '南北走向' : '东西走向'))
            ) + '</span>',
          wx: ox + w / 2, wy: oy + d - 4, wz: 30
        });
        return;
      }
      html += '<div class="park-bldg" style="left:' + ox + 'px;top:' + oy + 'px;width:' + w + 'px;height:' + d + 'px;">' +
        '<div class="park-bldg-face park-bldg-top" style="left:0;top:0;width:' + w + 'px;height:' + d + 'px;transform:translateZ(0.4px);"></div>' +
        '</div>';
      /* 分区标签移到屏幕空间层（见 projectLabels 注释） */
      labelItems.push({
        cls: 'park3d-zone' + (z.isGift ? ' gift' : ''),
        html: '<span class="park3d-zone-n">' + escapeHtml(z.name) + '</span>' +
          '<span class="park3d-zone-m">' + z.cols + ' 列 × ' + z.rows + ' 行 × ' + z.levels + ' 层</span>',
        wx: ox + w / 2, wy: oy + d - 4, wz: 30
      });
    });

    /* 仓库主建筑：立体体块（顶面 + 两个侧面 + 正面），给场景体量锚点。
       贴在园区左侧外围，随园区宽度一起外移，不压到货架区。 */
    var bW = 104, bD = 66, bH = 40;
    var parkMinX = Infinity;
    layout.zones.forEach(function (z) {
      if (typeof z.originX === 'number') parkMinX = Math.min(parkMinX, z.originX);
    });
    if (!isFinite(parkMinX)) parkMinX = 0;
    var bx = parkMinX * U - (bW + 46), by = -8;
    html += '<div class="park-bldg" style="left:' + bx + 'px;top:' + by + 'px;">' +
      /* 正面 */
      '<div class="park-bldg-face park-bldg-front" style="left:0;top:0;width:' + bW + 'px;height:' + bH + 'px;transform:translateZ(' + bH + 'px);"></div>' +
      /* 顶面 */
      '<div class="park-bldg-face park-bldg-top" style="left:0;top:0;width:' + bW + 'px;height:' + bD + 'px;transform:rotateX(-90deg) translateZ(' + bH + 'px);transform-origin:top left;"></div>' +
      /* 右侧 */
      '<div class="park-bldg-face park-bldg-side" style="left:0;top:0;width:' + bD + 'px;height:' + bH + 'px;transform:rotateY(90deg) translateZ(' + bW + 'px);transform-origin:left top;"></div>' +
      '<div class="park-bldg-skylight" style="left:16px;top:' + (bH + 10) + 'px;width:30px;height:16px;transform:translateZ(' + (bH + 1) + 'px);"></div>' +
      '<div class="park-bldg-skylight" style="left:56px;top:' + (bH + 10) + 'px;width:30px;height:16px;transform:translateZ(' + (bH + 1) + 'px);"></div>' +
      '</div>';
    labelItems.push({ cls: 'park3d-zone wh', html: escapeHtml(wh.name), wx: bx + bW / 2, wy: by + bH + 30, wz: 46 });

    /* 货架：每层是一个"立体腔室"（层板 + 前挡杆 + 侧板 + 背板 + 立柱），
       层层沿 Z 轴抬升。
       【根因·只有平面没有体积】旧实现每层只有一个 .park-rack-level 平面色块
       + 几个 8px 小方块，光照/阴影在纯平面上无处表现，旋转后完全退化成贴纸。
       现在每层补齐四个承重面与立柱，形成可读的立体腔室。
       坐标用 rebuildLayouts 推导的 wx/wz（与 R3F 同一份），按 U 换算成 CSS px。 */
    layout.racks.forEach(function (r) {
      var x = (typeof r.wx === 'number' ? r.wx : r.col * PARK_GRID.colGap) * U;
      var y = (typeof r.wz === 'number' ? r.wz : r.row * PARK_GRID.rowGap) * U;
      var cls = 'park-rack' + (r.isGift ? ' gift' : '') + (selectedRack && selectedRack.id === r.id ? ' selected' : '');
      var lvCount = r.levels.length;
      /* 货架总高（Z 方向）：顶层所在高度 + 顶板余量。
         【踩坑】曾写成 6 + lvCount * LEVEL_Z，多算了一整层的高度（4 层时多 46px），
         立柱因此高出货架一大截、戳出园区外，视觉上像"一排钉子"。
         顶层 lz = 6 + (lvCount-1) * LEVEL_Z，故总高取该值 + 顶板厚。 */
      var rackTopZ = 6 + Math.max(0, lvCount - 1) * LEVEL_Z + BOARD_T;
      var inner = '';

      /* 地面投影：跟着货架走，压在地面 */
      inner += '<div class="park-rack-shadow" style="left:' + (x + 8) + 'px;top:' + (y + 10) + 'px;width:' + RACK_W + 'px;height:' + RACK_D + 'px;"></div>';

      /* 底座：横跨整架宽度的地面承台，落在货架进深的最后端（贴地）。
         立柱改为真正竖直后柱脚自带落点，底座不再承担"防悬空"的主职责，
         这里只作为"柱脚与地面的过渡"，宽度略大于货架、把 4 根柱的脚连成一体。 */
      inner += '<div class="park-rack-base" style="left:' + (x - 2) + 'px;top:' + (y + RACK_D - POST_W) + 'px;' +
        'width:' + (RACK_W + 4) + 'px;height:' + (POST_W + 4) + 'px;transform:translateZ(0);"></div>';

      /* 立柱：四角竖直柱体，从地面直达顶板 —— 这是"货架"而非"一摞盘子"的核心语义。
         【根因重定位 · 此前三次改法都没解决用户反馈的"只有板没有立柱"】
         旧写法：left:x; top:y; width:POST_W; height:rackTopZ; transform:translateZ(0)。
         它只给了 x/y 偏移、z 恒为 0，因此躺在场景的 **XY 地面平面** 内，
         经场景 rotateX(48°) 之后变成一条**贴在地面上的扁平色带**，
         而不是从地面"站起来"的柱子 —— 俯视时与地面网格糊在一起，完全读不出立柱。
         【正确做法】竖直柱必须建在 **XZ 平面**：用 rotateX(-90deg) 把本地 y 映射到世界 z。
         场景本身已 rotateX(48°)，净角 48-90 = -42°，柱面与视线夹角合适，
         会呈现为真正的竖直构件（实测屏幕 18.5×101px，肉眼可辨）。
         【transform-origin 必须 0 0】CSS rotateX 默认绕元素中心旋转，
         中心为轴会让柱子"半沉地半朝天"（此前误判为"净角 -42° 会斜插进地"的真正原因）。
         以底端为轴才是"从地面立起来"。 */
      /* 立柱：按层分段生成短柱，避免一根超长柱穿出地面 */
      [0, 1].forEach(function (side) {
        [0, 1].forEach(function (end) {
          var px = side === 0 ? x : x + RACK_W - POST_W;
          var py = end === 0 ? y : y + RACK_D - POST_W;
          for (var pi = 0; pi < lvCount; pi++) {
            var pz = 6 + pi * LEVEL_Z;
            var ph = LEVEL_Z * 0.92;
            inner += '<div class="park-rack-post-v" style="left:' + px + 'px;top:' + py + 'px;' +
              'width:' + POST_W + 'px;height:' + ph + 'px;' +
              'transform:translateZ(' + pz + 'px) rotateX(-90deg);"></div>';
          }
        });
      });
      /* 层间横撑：连接同侧前后立柱，把四角柱串成框架。
         没有横撑时四根柱在屏幕上仍是四个孤立竖条，看不出"架子"；
         有了横撑，每层形成闭合的"格"，层与层的分隔也由它强化。 */
      r.levels.forEach(function (lv, li) {
        var bz = 6 + li * LEVEL_Z;
        [0, 1].forEach(function (side) {
          var bx = side === 0 ? x : x + RACK_W - POST_W / 2;
          var bTop = y + POST_W / 2, bH = RACK_D - POST_W;
          inner += '<div class="park-rack-brace-v" style="left:' + bx + 'px;top:' + bTop + 'px;' +
            'width:' + (POST_W / 2) + 'px;height:' + bH + 'px;' +
            'transform:translateZ(' + bz + 'px) rotateX(-90deg);"></div>';
        });
      });
      /* 顶板：封顶，强化体量（压在所有层之上，与立柱同高）。
         比层板内缩 4px（见 CSS 注释）：否则顶板高光面会向下盖住立柱上段。 */
      inner += '<div class="park-rack-top" style="left:' + (x + 4) + 'px;top:' + (y + 4) + 'px;width:' + (RACK_W - 8) + 'px;height:' + (RACK_D - 8) + 'px;' +
        'transform:translateZ(' + rackTopZ + 'px);"></div>';

      r.levels.forEach(function (lv, li) {
        var lz = 6 + li * LEVEL_Z;
        var rate = lv.capacity ? Math.min(1, lv.stock / lv.capacity) : 0;
        var on = selectedRack && selectedRack.id === r.id && selectedRack.level === lv.level;
        var fill = fillVar(rate);
        /* 层板顶面：可点击的拾取面（保留原类名与 data 属性，事件绑定不用改） */
        inner += '<div class="park-rack-level' + (on ? ' selected' : '') + '" data-rack="' + r.id + '" data-level="' + lv.level + '" ' +
          'style="left:' + x + 'px;top:' + y + 'px;width:' + RACK_W + 'px;height:' + RACK_D + 'px;' +
          'transform:translateZ(' + lz + 'px);">' +
          /* 用 background-color 而非 background 简写：简写会把 background-image
             重置为 none，层板上表面那道「白色高光 + 淡蓝反光」就没了，
             板面退化成纯色平面，旋转时立体感明显变弱。 */
          '<span class="park-rack-board" style="background-color:#e8edf3;"></span>' +
          /* 背板：挡住穿透，形成腔室纵深 */
          '<span class="park-rack-back"></span>' +
          /* 左右侧板：给宽度方向的两个面，制造明暗对比 */
          '<span class="park-rack-side l"></span>' +
          '<span class="park-rack-side r"></span>' +
          /* 前挡杆：横贯正面的立体条，是层与层的分隔线 */
          '<span class="park-rack-rail"></span>' +
          '</div>';

        /* 层板上的货品方块：随层抬升，尺寸加大才有体积感 */
        var n = Math.max(1, Math.min(5, Math.round(rate * 5)));
        for (var k = 0; k < n; k++) {
          var cw = (RACK_W - 16) / n;
          inner += '<div class="park-rack-crate" style="left:' + (x + 8 + k * cw) + 'px;top:' + (y + 12) + 'px;' +
            'width:' + (cw - 3) + 'px;height:' + (RACK_D - 22) + 'px;' +
            'transform:translateZ(' + (lz + BOARD_T) + 'px);"></div>';
        }
        /* 选中层的层名标签：收集到标签层（不进 3D 链，见 projectLabels 注释） */
        if (on) {
          labelItems.push({
            cls: 'park3d-tag level' + (lv.name ? ' named' : ''),
            html: escapeHtml(lv.name || ('第 ' + lv.level + ' 层')),
            wx: x + RACK_W / 2, wy: y - 10, wz: lz + 10
          });
        }
      });

      /* 货架编号 + 名称：浮于货架顶端之上 */
      labelItems.push({
        cls: 'park3d-tag rack' +
          ((selectedRack && selectedRack.id === r.id) ? ' active' : '') +
          (r.name ? ' named' : ''),
        html: '<span class="park3d-code">' + escapeHtml(r.code) + '</span>' +
          (r.name ? '<span class="park3d-name">' + escapeHtml(r.name) + '</span>' : ''),
        wx: x + RACK_W / 2, wy: y, wz: rackTopZ + 16
      });
      html += '<div class="' + cls + '" data-rack="' + r.id + '">' + inner + '</div>';
    });

    /* 标签探针：零尺寸的锚点元素，放在 3D 链内、坐标与对应标签一致。
       projectLabels() 用 getBoundingClientRect() 读它算出的屏幕位置，
       再把屏幕空间的文字标签贴过去 —— 透视/旋转/perspective-origin
       全部由浏览器计算，无需在 JS 里重复实现投影公式。

       【必须放在 .park-world 内部】探针要靠 translateZ 抬到货架顶端，
       而 translateZ 只有在同一个 preserve-3d 上下文里才具有"高度"语义。
       早先把它追加在 </div>（.park-world 闭合）之后，成为 #parkScene 的直接子元素，
       于是脱离了场景的 3D 定位上下文 —— translateZ 退化成"离观察者更近的平面缩放"，
       探针被整体甩到画面上方：实测探针屏幕 Y≈100~310，而货架几何在 Y≈510~720，
       标签与货架错开约 400px，看起来像"标签飘在园区外面"。
       正确做法：探针与货架同为 .park-world 的子元素，共用同一套 3D 变换。 */
    html += labelItems.map(function (it, i) {
      return '<i class="park-label-probe" data-probe="' + i + '" style="left:' + it.wx + 'px;top:' + it.wy +
        'px;transform:translateZ(' + it.wz + 'px);"></i>';
    }).join('');

    html += '</div>';

    scene.innerHTML = html;

    /* 文字标签渲染到屏幕空间覆盖层：与 .park-scene 同级，
       每帧由 projectLabels() 按 3D 坐标投影成像素位置。
       【为什么不放 3D 链内】场景的 rotateX 会把标签内的中文字形一起压扁
       （实测点击某层后标签宽度仅 21px，文字竖排不可见）。 */
    var labelLayer = $('parkLabelLayer');
    if (labelLayer) {
      /* 每条标签额外带一根<i class="park-label-link">：从标签中心画回 3D 锚点的细线。
         避让后标签可能被下推几十像素，没有连线时用户会以为标签属于旁边那个货架。
         线本身是纯 2D 绘制（不参与碰撞检测），长度随位移实时更新。 */
      labelLayer.innerHTML = labelItems.map(function (it, i) {
        return '<i class="park-label-link" data-link="' + i + '"></i>' +
          '<div class="' + it.cls + '" data-i="' + i + '" ' +
          'data-wx="' + it.wx + '" data-wy="' + it.wy + '" data-wz="' + it.wz + '">' + it.html + '</div>';
      }).join('');
    }

    /* 首次渲染（或园区/画布尺寸变化后）自动取景：
       用 doFitView 按实际占位算缩放与居中，避免固定 cam 参数把园区挤出画面 */
    if (!cssCamFitted) { cssCamFitted = true; doFitView(); }
    else applyCam();

    /* 事件绑定（每次重渲染后重绑） */
    scene.querySelectorAll('.park-rack-level').forEach(function (el) {
      el.addEventListener('click', function (ev) {
        ev.stopPropagation();
        openRack(curWh, el.getAttribute('data-rack'), parseInt(el.getAttribute('data-level'), 10));
      });
    });

    var st = whStat(curWh);
    var hud = $('parkHudWh'); if (hud) hud.textContent = wh.name;
    var hr = $('parkHudRack'); if (hr) hr.textContent = st.rack + ' 个';
    var hc = $('parkHudCat'); if (hc) hc.textContent = layout.zones.length + ' 个分区';
  }

  function applyCam() {
    if (!scene) return;
    /* 平移放在旋转之后，才是在「屏幕空间」做居中偏移（放前面会跟着一起被旋转） */
    scene.style.transform =
      'rotateX(' + cam.rx + 'deg) rotateZ(' + cam.rz + 'deg) scale(' + cam.scale + ') ' +
      'translate(' + cam.ox + 'px,' + cam.oy + 'px)';
    projectLabels();
  }

  /* ---------- 3D 标签的屏幕空间投影 ----------
     【根因·点击层后看不到名称】此前标签（.park3d-tag）是 .park-world 的子元素，
     放在 3D 变换链内。场景已有 rotateX(48deg)，我们又给标签叠加 rotateX(-48deg)
     抵消，但标签的 translateZ 仍会把它沿深度方向压缩 ——
     实测点击第 3 层后标签 DOM 存在、opacity=1、visibility=visible，
     可 boundingRect 宽度只有 21px（正常 60~100px），中文被压成竖排一列，等于看不见。
     根因是【文字元素不能放在 3D 变换链里】：3D 变换对文本栅格化后的
     字形同样生效，无法靠反向旋转完全抵消 translateZ 的深度压缩。

     【修复】把文字标签移出 3D 链，改为【屏幕空间覆盖层】：
     标签挂在 .park-stage 下（与 canvas 同级、position:absolute），
     每次视角变化时用「3D 世界坐标 → 屏幕坐标」的解析投影算出 left/top，
     直接用像素定位。文字始终正向、不受任何 3D 变换影响，
     同时也能正确地被 perspective 缩放（近大远小）。
     投影公式来自 CSS transform 的矩阵分解，与浏览器实际渲染一致。 */
  function projectLabels() {
    var host = $('parkLabelLayer');
    if (!host) return;
    var tags = host.querySelectorAll('.park3d-tag, .park3d-zone');
    if (!tags.length) { host.style.display = 'none'; return; }
    host.style.display = '';

    for (var i = 0; i < tags.length; i++) {
      var el = tags[i];
      var wx = parseFloat(el.getAttribute('data-wx'));
      var wy = parseFloat(el.getAttribute('data-wy'));
      var wz = parseFloat(el.getAttribute('data-wz'));
      if (isNaN(wx) || isNaN(wy) || isNaN(wz)) { el.style.display = 'none'; continue; }

      /* 【实测法】不用解析公式手算投影 —— 那是重复实现浏览器的透视除法，
         极易与实际渲染产生几十像素偏差（实测标签跑到画布左上角）。
         改为：在 3D 场景里放一个零尺寸的「探针」元素，坐标与标签一致，
         用 getBoundingClientRect() 读浏览器自己算出的屏幕位置，
         再把屏幕空间的标签贴到该位置。
         好处：透视、perspective-origin、场景旋转、未来的变换改动全部自动一致。 */
      var probe = scene.querySelector('[data-probe="' + el.getAttribute('data-i') + '"]');
      if (!probe) { el.style.display = 'none'; continue; }
      var r = probe.getBoundingClientRect();
      var sr = stage ? stage.getBoundingClientRect() : { left: 0, top: 0 };
      var sx = r.left - sr.left;
      var sy = r.top - sr.top;
      /* 探针是零尺寸，其中心即 3D 锚点；换算成标签层内的相对坐标 */
      el.style.display = '';
      el._sx = sx; el._sy = sy;
    }

    /* 标签避让：密集布局下多个货架标签会重叠成一片（实测 SH-01-01~14 糊在一起）。

       【为什么不能只用中心点间距判断】
       标签是有宽高的矩形（实测 54×26 到 130×26），且横向可排 3~4 个。
       早先的写法按「中心点 |Δx|<80 且 |Δy|<20」判定冲突，判据与实际矩形不符：
         · MIN_GAP=20 < 标签高 26 → 判为不重叠时实际已叠上；
         · 横向阈值固定 80px，遇到「分区标牌(宽 130)+ 仓库名(宽 90)」仍会漏判；
         · 位移超过 60px 就整体放弃避让 → 密集区直接退回重叠状态。
       实测三视角下重叠对数 14~15，正是这三处判据失效导致的。

       【改为矩形级避让】
       以标签真实 offsetWidth/offsetHeight 参与碰撞检测，
       沿 Y 轴按「下、上」交替生成候选位（先下后上，保持视觉上就近），
       取第一个与已放置集合完全不相交的候选；都不行时取重叠面积最小的。
       最后统一把标签夹回舞台内，避免贴边时被裁切。 */
    var ordered = [];
    for (var k = 0; k < tags.length; k++) {
      if (tags[k].style.display === 'none') continue;
      var pr = tags[k].className;
      /* 优先级：层名 > 选中货架 > 分区标牌 > 其余货架。
         高优先级先占位，低优先级的绕开它。 */
      var pri = /level/.test(pr) ? 0 : (/\bactive\b/.test(pr) ? 1 : (/zone/.test(pr) ? 2 : 3));
      ordered.push({
        el: tags[k], x: tags[k]._sx, y: tags[k]._sy, pri: pri,
        w: tags[k].offsetWidth, h: tags[k].offsetHeight
      });
    }
    ordered.sort(function (a, b) { return a.pri - b.pri || a.y - b.y || a.x - b.x; });

    var sr2 = stage ? stage.getBoundingClientRect() : { width: 0, height: 0 };
    var SW = sr2.width, SH = sr2.height;
    var PAD = 4;                       /* 贴边留白，避免被舞台 overflow 裁掉 */
    var STEP_BASE = 4;                 /* 候选位之间的基础步长 */
    /* 位移上限：超过就改为隐藏该标签。
       【为什么要有上限】斜视角下相邻货架在屏幕上的锚点间距会压缩到 30~40px，
       而货架标签本身宽 80px —— 此时"不重叠"在几何上就不可能 achieved，
       强行避让会把标签推到 90~180px 外，标签与货架彻底脱节，
       反而比遮挡更糟（实测 G04/G06 被推开 90px 互相换位，看起来像串号）。
       正确做法是「拥挤时收敛标签」：保留层名、选中货架与分区标牌，
       优先隐藏普通的货架编号；用户悬停/选中某个货架时该标签仍会显示。 */
    var MAX_SHIFT = 56;
    var placed = [];

    /* 候选位与已放置集合的总重叠面积：0 表示完全脱开。
       矩形相交判定：两矩形中心距在 X/Y 上都小于半宽和的一半时相交。 */
    function overlapArea(box) {
      var sum = 0;
      for (var i = 0; i < placed.length; i++) {
        var p = placed[i];
        var ox = (box.w + p.w) / 2 - Math.abs(box.x - p.x);
        var oy = (box.h + p.h) / 2 - Math.abs(box.y - p.y);
        if (ox > 0 && oy > 0) sum += ox * oy;
      }
      return sum;
    }

    /* 拥挤时被隐藏的标签不进入 placed —— 否则它虽然不显示，
       却仍然占位，把后面的标签继续挤走（雪崩式失效）。 */

    for (var m = 0; m < ordered.length; m++) {
      var it = ordered[m];
      var gapY = STEP_BASE + it.h;
      var gapX = STEP_BASE + it.w;
      /* 候选位用「螺旋」生成而非纯竖排：先原位，然后 下/上/右/左/下下/上上/右右/左左 …
         允许横向微调后，密集的一列会自然摊成两列三列，
         位移比纯竖排小得多（实测纯竖排最坏 186px，螺旋 90px）。 */
      var cands = [{ dx: 0, dy: 0 }];
      for (var ring = 1; ring <= 2; ring++) {
        cands.push({ dx: 0, dy: ring * gapY });            /* 下 */
        cands.push({ dx: 0, dy: -ring * gapY });           /* 上 */
        cands.push({ dx: ring * gapX, dy: 0 });            /* 右 */
        cands.push({ dx: -ring * gapX, dy: 0 });           /* 左 */
        cands.push({ dx: ring * gapX, dy: ring * gapY });
        cands.push({ dx: -ring * gapX, dy: ring * gapY });
        cands.push({ dx: ring * gapX, dy: -ring * gapY });
        cands.push({ dx: -ring * gapX, dy: -ring * gapY });
      }
      var best = null, bestArea = Infinity, bestShift = Infinity, bestClean = false;
      for (var s = 0; s < cands.length; s++) {
        var box = { x: it.x + cands[s].dx, y: it.y + cands[s].dy, w: it.w, h: it.h };
        /* 夹回舞台内（先夹再判重叠，否则贴边标签会误判为冲突） */
        box.x = Math.max(PAD + box.w / 2, Math.min(SW - PAD - box.w / 2, box.x));
        box.y = Math.max(PAD + box.h / 2, Math.min(SH - PAD - box.h / 2, box.y));
        var a = overlapArea(box);
        var shift = Math.hypot(box.x - it.x, box.y - it.y);
        if (a === 0) { best = box; bestShift = shift; bestClean = true; break; }
        if (a < bestArea - 1 || (a < bestArea + 1 && shift < bestShift)) {
          bestArea = Math.min(bestArea, a); best = box; bestShift = shift;
        }
      }
      /* 位移过大或仍有明显重叠 → 隐藏该标签（低优先级的先让位）。
         判「是否重叠」必须用 bestClean（本次选中的候选是否零重叠），
         不能用 bestArea —— 早先在找到零重叠候选后 break 时，
         bestArea 仍残留着前面候选的旧值，导致明明有空位却被误隐藏
         （实测默认视角下 21 个标签被隐藏掉 19 个）。 */
      var tooFar = !best || bestShift > MAX_SHIFT || (!bestClean && it.pri >= 2);
      if (tooFar && it.pri >= 2) {
        it.el.style.display = 'none';
        it.el._shift = 0;
        continue;                       /* 不入 placed，避免占位引发雪崩 */
      }
      if (tooFar && it.pri < 2) { best = best || { x: it.x, y: it.y, w: it.w, h: it.h }; bestShift = 0; }
      placed.push(best);
      it.el._shift = Math.round(bestShift);
      it.el._lx = best.x; it.el._ly = best.y;
      it.el.style.transform = 'translate(-50%, -50%) translate(' + Math.round(best.x) + 'px,' + Math.round(best.y) + 'px)';
    }

    /* 位移后补画「标签 → 锚点」的连线：标签被推开多远，就画多长的线，
       让用户仍能确认这个标签说的是哪个货架/哪一层。 */
    var links = host.querySelectorAll('.park-label-link');
    for (var q = 0; q < links.length; q++) {
      var tg = host.querySelector('[data-i="' + links[q].getAttribute('data-link') + '"]');
      if (!tg || tg.style.display === 'none' || typeof tg._sx !== 'number') {
        links[q].style.display = 'none';
        continue;
      }
      var ax = tg._sx, ay = tg._sy;
      var lx = tg._lx, ly = tg._ly;                 /* 标签最终落点（translate 后的坐标） */
      if (typeof lx !== 'number') { links[q].style.display = 'none'; continue; }
      var vx = lx - ax, vy = ly - ay;
      var len = Math.sqrt(vx * vx + vy * vy);
      if (len < 6) { links[q].style.display = 'none'; continue; }
      links[q].style.display = '';
      links[q].style.width = Math.round(len) + 'px';
      links[q].style.transform = 'translate(' + Math.round(ax) + 'px,' + Math.round(ay) + 'px) rotate(' +
        (Math.atan2(vy, vx) * 180 / Math.PI).toFixed(2) + 'deg)';
    }
  }
  /* 原生 CSS 3D 路径的取景参数是否已按当前园区/舞台算过 */
  var cssCamFitted = false;

  /* 降级路径的精确取景：先按估算比例摆一帧，再实测园区在屏幕上的真实包围盒，
     然后用「实测尺寸 + 实测偏差」反推修正量。之所以要实测：
     CSS 3D 的 rotateX + translateZ 抬升 + scale 组合后，解析式推算误差很大
     （实测园区会偏离预估位置近 200px，表现为"园区偏在一角、上方大片空白"）。
     实测法不依赖任何数学假设，对任意行列配置都成立。 */
  function fitCssScene() {
    if (!scene) return;
    var stageEl = $('parkStage');
    if (!stageEl) return;
    var stR = stageEl.getBoundingClientRect();
    if (!stR.width || !stR.height) return;

    /* 第一帧：按园区像素占位粗估一个比例 */
    var lay = LAYOUTS[curWh];
    if (!lay || !lay.racks || !lay.racks.length) return;
    var u = RACK_GAP.x / PARK_GRID.colGap;
    var minX = Infinity, maxX = -Infinity, maxZ = 0;
    lay.zones.forEach(function (z) {
      if (typeof z.originX !== 'number') return;
      minX = Math.min(minX, z.originX);
      maxX = Math.max(maxX, z.originX + z.spanX);
      maxZ = Math.max(maxZ, z.originZ + z.spanZ);
    });
    if (!isFinite(minX) || maxX <= minX) return;
    var parkW = Math.max(1, (maxX - minX) * u + RACK_W);
    var parkD = Math.max(1, maxZ * u + RACK_D);
    /* 俯角用统一常量（48°），与拖动旋转的初始值一致；rz 归零让园区正对观众 */
    cam.rx = CAM_RX; cam.rz = 0;
    cam.scale = Math.max(0.2, Math.min(1.2, stR.width / (parkW * 2.2)));
    cam.ox = 0; cam.oy = 0;
    applyCam();

    /* 第二帧：实测园区包围盒。
       探针含「标签探针」(.park-label-probe) —— 它位于货架顶板上方，是整架最高点。
       注意零尺寸元素：r.right === r.left，直接用 max() 不会扩展边界，
       必须把 left 当作 x2 候选、top 当作 y2 候选一并比较。
       仍需含外围建筑 .park-bldg —— 主建筑贴在园区左侧外围，不计入会被裁掉。 */
    function boundsOf(list) {
      var b = { x1: Infinity, x2: -Infinity, y1: Infinity, y2: -Infinity };
      for (var i = 0; i < list.length; i++) {
        var r = list[i].getBoundingClientRect();
        if (!isFinite(r.left) || r.left === 0) continue;
        if (r.width === 0 && r.height === 0) {
          /* 零尺寸探针：其所在点即 3D 锚点，四个方向都要参与比较 */
          b.x1 = Math.min(b.x1, r.left); b.x2 = Math.max(b.x2, r.left);
          b.y1 = Math.min(b.y1, r.top);  b.y2 = Math.max(b.y2, r.top);
          continue;
        }
        if (r.width <= 0 || r.height <= 0) continue;
        b.x1 = Math.min(b.x1, r.left); b.x2 = Math.max(b.x2, r.right);
        b.y1 = Math.min(b.y1, r.top);  b.y2 = Math.max(b.y2, r.bottom);
      }
      return isFinite(b.x1) && b.x2 > b.x1 ? b : null;
    }
    var measureSel = '.park-rack-level, .park-rack-top, .park-bldg, .park-label-probe';
    var b1 = boundsOf(scene.querySelectorAll(measureSel));
    if (!b1) return;
    var curW = b1.x2 - b1.x1, curH = b1.y2 - b1.y1;
    /* 缩放到刚好装下：宽高两个约束取较小者。
       留 4% 余量即可 —— 标签探针位于顶板上方 16px，若给太大余量
       会让园区被压得很小（实测占比掉到 0.29），实测 0.96~0.98 最合适。 */
    var target = Math.min((stR.width * 0.96) / curW, (stR.height * 0.9) / curH);
    cam.scale = Math.max(0.2, Math.min(2.4, cam.scale * target));
    applyCam();

    /* 第三帧：用最终 scale 再测一次，精确求居中偏移 */
    var b2 = boundsOf(scene.querySelectorAll(measureSel));
    if (!b2) return;
    /* 屏幕中心偏差 → 抵消它（translate 在 scale 之后，需除以 scale 才是场景内位移） */
    var offX = ((b2.x1 + b2.x2) / 2) - (stR.left + stR.width / 2);
    var offY = ((b2.y1 + b2.y2) / 2) - (stR.top + stR.height / 2);
    cam.ox = (cam.ox || 0) - offX / cam.scale;
    cam.oy = (cam.oy || 0) - offY / cam.scale;
    applyCam();
  }

  /* 视角操作统一入口：R3F 走相机预设，原生 CSS 3D 走实测取景。
     用户诉求「无法滑动查看全局」的兜底 —— 任何时候一键都能框住整个园区。 */
  function doFitView() {
    if (r3fReady && parkApp && parkApp.setView) {
      parkApp.setView('fit');
      var hint = $('parkNavHint');
      if (hint) hint.classList.remove('show');
      return;
    }
    /* 原生 CSS 3D：用实测法把园区精确装进并居中于舞台 */
    fitCssScene();
  }

  /* ---------- 交互模式（拖动=旋转 / 拖动=平移） ----------
     缩放与拖拽不冲突的实现要点：
     · 滚轮缩放走 wheel 事件，拖拽走 pointerdrag 事件，两条通道互不干扰；
     · 切换的只是「拖动映射到哪个动作」，不影响滚轮 —— 所以任意模式下都能缩放；
     · 用 three 的数字常量写键位（字符串会静默失效，见 app.park3d.js 注释）。 */
  var navMode = 'rotate';
  function applyNavModeUI() {
    var btn = $('parkBtnMode');
    var txt = $('parkBtnModeTxt');
    var hud = $('parkHudHint');
    var st = $('parkStage');
    var isPan = navMode === 'pan';
    if (btn) btn.setAttribute('aria-pressed', isPan ? 'true' : 'false');
    if (txt) txt.textContent = isPan ? '平移' : '旋转';
    if (st) st.classList.toggle('mode-pan', isPan);
    if (hud) {
      hud.textContent = isPan
        ? '按住左键拖动：上/下/左/右平移园区 · 滚轮缩放 · 点层选中单层 / 点货架选中整架'
        : '按住左键拖动：旋转视角 · 滚轮缩放 · 点层选中单层 / 点货架选中整架';
    }
  }
  function toggleNavMode() {
    navMode = (navMode === 'pan') ? 'rotate' : 'pan';
    if (r3fReady && parkApp && parkApp.setNavMode) parkApp.setNavMode(navMode);
    applyNavModeUI();
    toast(navMode === 'pan' ? '已切换为平移模式：按住拖动可四向查看园区' : '已切换为旋转模式：按住拖动旋转视角', 'success');
  }

  /* 右栏折叠：让 3D 园区占满整行宽度。折叠改变画布尺寸，
     必须重取景，否则用户会看到"画布变大了但园区还是那么小"。 */
  var panelCollapsed = false;
  function togglePanel() {
    panelCollapsed = !panelCollapsed;
    var wrap = $('parkStageWrap');
    if (wrap) wrap.classList.toggle('collapsed', panelCollapsed);
    var btn = $('parkBtnPanel');
    var txt = $('parkBtnPanelTxt');
    if (btn) btn.setAttribute('aria-pressed', panelCollapsed ? 'true' : 'false');
    if (txt) txt.textContent = panelCollapsed ? '展开面板' : '收起面板';
    /* 等 CSS transition 走完再重取景（240ms） */
    setTimeout(function () {
      if (r3fReady && parkApp && parkApp.refit) parkApp.refit();
      else { cssCamFitted = false; doFitView(); }
      renderPark();
    }, 280);
  }

  /* 画布尺寸变化（窗口缩放 / 折叠 / 布局变化）后自适应重取景。
     ResizeObserver 比 window.resize 更准：后者不触发容器自身的尺寸变化。 */
  var parkResizeObserver = null;
  function watchStageResize() {
    var st = $('parkStage');
    if (!st || parkResizeObserver) return;
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', function () {
        if (r3fReady && parkApp && parkApp.refit) parkApp.refit();
      });
      return;
    }
    parkResizeObserver = new ResizeObserver(debounce(function () {
      if (r3fReady && parkApp && parkApp.refit) parkApp.refit();
      else { cssCamFitted = false; doFitView(); }
    }, 220));
    parkResizeObserver.observe(st);
  }
  function debounce(fn, ms) {
    var t = null;
    return function () {
      var self = this, args = arguments;
      if (t) clearTimeout(t);
      t = setTimeout(function () { t = null; fn.apply(self, args); }, ms);
    };
  }

  /* 原生 CSS 3D 的舞台事件句柄：R3F 接管后必须解绑。
     关键坑：原生 pointerdown 里调了 stage.setPointerCapture()，
     它会把后续 pointermove/pointerup 全部改派给 stage，
     R3F canvas 永远收不到 pointerup → onClick 判定为拖拽而丢弃，
     表现为「点货架没反应」。同时 stage 的 click 取消选中也会误清 R3F 选中的货架。 */
  var parkCtlHandlers = [];
  function bindParkControls() {
    if (parkCtlHandlers.length) return;   /* 只绑一次 */
    function on(target, type, fn, opts) {
      target.addEventListener(type, fn, opts);
      parkCtlHandlers.push([target, type, fn, opts]);
    }
    var dragging = false, lastX = 0, lastY = 0, moved = 0;
    on(stage, 'pointerdown', function (e) {
      dragging = true; moved = 0;
      lastX = e.clientX; lastY = e.clientY;
      stage.classList.add('dragging');
      try { stage.setPointerCapture(e.pointerId); } catch (err) {}
    });
    on(stage, 'pointermove', function (e) {
      if (!dragging) return;
      var dx = e.clientX - lastX, dy = e.clientY - lastY;
      moved += Math.abs(dx) + Math.abs(dy);
      lastX = e.clientX; lastY = e.clientY;
      if (navMode === 'pan') {
        /* 平移模式：拖动直接移动场景偏移（ox/oy），四向自由查看。
           缩放仍由滚轮单独控制（见下方 wheel），与拖拽互不干扰。 */
        cam.ox += dx;
        cam.oy += dy;
      } else {
        /* 旋转模式：绕轴旋转 */
        cam.rz += dx * 0.4;
        cam.rx = Math.max(16, Math.min(78, cam.rx - dy * 0.3));
      }
      if (autoRotate) toggleAutoRotate(false);
      applyCam();
    });
    function endDrag(e) {
      if (!dragging) return;
      dragging = false;
      stage.classList.remove('dragging');
      try { stage.releasePointerCapture(e.pointerId); } catch (err) {}
      /* 轻点清空选中交由货位/舞台自身的 click 处理，此处只负责停止拖拽状态 */
    }
    on(stage, 'pointerup', endDrag);
    /* 点击舞台空白处取消选中；moved 阈值确保拖拽旋转后不会误清 */
    on(stage, 'click', function (e) {
      if (moved >= 4) return;
      if (e.target.closest('.park-rack-level')) return;
      if (selectedRack) { selectedRack = null; renderPark(); renderPanelEmpty(); }
    });
    on(stage, 'pointercancel', endDrag);

    on(stage, 'wheel', function (e) {
      e.preventDefault();
      var d = e.deltaY > 0 ? -0.08 : 0.08;
      cam.scale = Math.max(0.55, Math.min(1.6, cam.scale + d));
      applyCam();
    }, { passive: false });

    /* 工具栏按钮改由 bindParkToolbar 统一绑定（R3F / CSS 共用，避免 R3F 先就绪时点不动） */
    applyNavModeUI();
    watchStageResize();
  }

  /* 园区工具栏：与 CSS/R3F 渲染路径解耦，enterPark 时必定绑定一次 */
  var parkToolbarBound = false;
  function bindParkToolbar() {
    if (parkToolbarBound) return;
    parkToolbarBound = true;
    var rotBtn = $('parkBtnRotate');
    if (rotBtn) rotBtn.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      toggleAutoRotate(!autoRotate);
    });
    var fitBtn = $('parkBtnFit');
    if (fitBtn) fitBtn.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      doFitView();
    });
    var fitBtn2 = $('parkBtnFit2');
    if (fitBtn2) fitBtn2.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      doFitView();
    });
    var modeBtn = $('parkBtnMode');
    if (modeBtn) modeBtn.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      toggleNavMode();
    });
    var panelBtn = $('parkBtnPanel');
    if (panelBtn) panelBtn.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      togglePanel();
    });
    var cfgBtn = $('parkBtnConfig');
    if (cfgBtn) cfgBtn.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      openWhConfig();
    });
    var topBtn = $('parkBtnTop');
    if (topBtn) topBtn.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      if (r3fReady && parkApp && parkApp.setView) { parkApp.setView('top'); return; }
      cam.rx = 74; cam.rz = 0;
      applyCam();
    });
    applyNavModeUI();
  }

  function toggleAutoRotate(on) {
    autoRotate = on;
    var b = $('parkBtnRotate');
    if (b) b.setAttribute('aria-pressed', on ? 'true' : 'false');
    /* R3F 模式：autoRotate 是 React prop，需重渲一次让 OrbitControls 生效 */
    if (r3fReady && parkApp) { renderPark(); return; }
    if (scene) {
      if (on) { scene.style.transition = 'transform 0.6s cubic-bezier(0.16,1,0.3,1)'; startSpin(); }
      else { scene.style.transition = 'transform 0.6s cubic-bezier(0.16,1,0.3,1)'; stopSpin(); }
    }
  }
  var spinTimer = null;
  function startSpin() {
    stopSpin();
    spinTimer = setInterval(function () {
      if (!autoRotate || !scene) return;
      cam.rz += 0.12;
      scene.style.transition = 'none';
      applyCam();
    }, 32);
  }
  function stopSpin() { if (spinTimer) { clearInterval(spinTimer); spinTimer = null; } }


  /* ---------- 仓库设置面板（名称 / 布局自定义） ---------- */
  function openWhConfig() {
    var cfg = loadWhCfg();
    var html =
      '<div class="wh-cfg">' +
        '<div class="wh-cfg-bar">' +
          '<div class="wh-cfg-bar-label">仓库列表</div>' +
          '<div class="wh-cfg-bar-actions">' +
            '<button type="button" class="wh-cfg-ico" id="whCfgAdd" title="新增仓库" aria-label="新增仓库"><iconify-icon icon="ant-design:plus-outlined" width="15" height="15"></iconify-icon></button>' +
            '<button type="button" class="wh-cfg-ico danger" id="whCfgDel" title="删除当前仓库" aria-label="删除当前仓库"><iconify-icon icon="ant-design:delete-outlined" width="15" height="15"></iconify-icon></button>' +
          '</div>' +
        '</div>' +
        '<div class="wh-cfg-tabs" id="whCfgTabs"></div>' +
        '<div class="wh-cfg-body" id="whCfgBody"></div>' +
        '<div class="wh-cfg-foot">' +
          '<div style="flex:1"></div>' +
          '<button type="button" class="btn btn-outline btn-sm" id="whCfgCancel">取消</button>' +
          '<button type="button" class="btn btn-primary btn-sm" id="whCfgSave"><iconify-icon icon="ant-design:check-outlined" width="14" height="14"></iconify-icon>保存</button>' +
        '</div>' +
      '</div>';
    showModal(html, 'alert', null, 'form-lg');
    /* form-lg：仓库设置宽约 800px、高度受限可滚动；底栏按钮单行 */
    var editIdx = 0;
    var draft = JSON.parse(JSON.stringify(cfg));

    function renderTabs() {
      var box = $('whCfgTabs');
      box.innerHTML = draft.map(function (w, i) {
        return '<button type="button" class="wh-cfg-tab' + (i === editIdx ? ' active' : '') + '" data-i="' + i + '">' +
          escapeHtml(w.name || ('仓库 ' + (i + 1))) + '<span class="wh-cfg-tab-code">' + escapeHtml(w.code || '') + '</span></button>';
      }).join('');
      box.querySelectorAll('.wh-cfg-tab[data-i]').forEach(function (b) {
        b.addEventListener('click', function () { editIdx = parseInt(b.getAttribute('data-i'), 10); renderAll(); });
      });
      /* 操作按钮在栏内常驻（不随 Tab 重绘），事件只绑一次 —— 之前按钮混在
         Tab 列表里每次 innerHTML 重绘都重新绑定，容易出现点击丢失。 */
      var del = $('whCfgDel');
      if (del) {
        del.disabled = draft.length <= 1;
        del.title = draft.length <= 1 ? '至少保留一个仓库' : '删除当前仓库';
      }
    }

    /* 新增 / 删除：只在弹窗打开时绑定一次。
       放在 renderTabs 里会随每次 renderAll 叠加监听器，一次点击触发多次回调。 */
    function bindActions() {
      var add = $('whCfgAdd');
      if (add) add.addEventListener('click', function () {
        /* 编号取现有最大值 +1，避免与已有仓库 id 冲突 */
        var maxN = draft.reduce(function (m, w) {
          var mm = /-(\d+)\$/.exec(w.code || '');
          return mm ? Math.max(m, parseInt(mm[1], 10)) : m;
        }, 0);
        var n = maxN + 1;
        draft.push({
          id: 'WH-N' + n, code: 'WH-' + String(n).padStart(2, '0'), name: '新仓库 ' + n,
          area: '1,000 m²', city: '待填写',
          zones: [
            { key: 'gift', name: '礼品区', isGift: true, cols: 2, rows: 1, levels: 4 },
            { key: 'cargo', name: '货物区', isGift: false, cols: 2, rows: 1, levels: 4 }
          ]
        });
        editIdx = draft.length - 1;
        renderAll();
        toast('已新增仓库，填写名称后保存生效', 'success');
      });
      var del = $('whCfgDel');
      if (del) del.addEventListener('click', function () {
        if (draft.length <= 1) { toast('至少保留一个仓库', 'warning'); return; }
        var w = draft[editIdx];
        if (!w) return;
        showModal('确定删除仓库「' + (w.name || '') + '」？其分区、货架与自定义编号将一并移除。', 'confirm', function (ok) {
          if (!ok) return;
          draft.splice(editIdx, 1);
          editIdx = Math.min(editIdx, draft.length - 1);
          if (editIdx < 0) editIdx = 0;
          renderAll();
          toast('已删除仓库（保存后生效）', 'success');
        });
      });
    }

    function renderBody() {
      var w = draft[editIdx];
      if (!w) { $('whCfgBody').innerHTML = '<div class="alert-empty">请先新增一个仓库</div>'; return; }
      var zoneHtml = '';
      w.zones.forEach(function (z, zi) {
        /* 建筑构件（入口门 / 主通道 / 隔墙）不属于可编辑货架分区，面板不渲染、保存时原样保留 */
        if (z.kind) return;
        zoneHtml +=
          '<div class="wh-zone-row" data-z="' + zi + '">' +
            '<div class="wh-zone-head">' +
              '<span class="wh-zone-idx">' + (zi + 1) + '</span>' +
              '<input type="text" class="wh-inp wh-zone-name" value="' + escapeAttr(z.name) + '" maxlength="16" placeholder="分区名称" />' +
              '<label class="wh-chk"><input type="checkbox" class="wh-zone-gift"' + (z.isGift ? ' checked' : '') + ' /> 礼品区</label>' +
              '<button type="button" class="wh-zone-del" title="删除该分区" aria-label="删除该分区"><iconify-icon icon="ant-design:delete-outlined" width="14" height="14"></iconify-icon></button>' +
            '</div>' +
            '<div class="wh-zone-params">' +
              '<label class="wh-lbl">列数<span class="wh-bubble-mount" data-k="cols"></span></label>' +
              '<label class="wh-lbl">行数<span class="wh-bubble-mount" data-k="rows"></span></label>' +
              '<label class="wh-lbl">层数<span class="wh-bubble-mount" data-k="levels"></span></label>' +
              '<div class="wh-zone-sum">' + (z.cols * z.rows) + ' 货架 · ' + (z.cols * z.rows * z.levels) + ' 货位</div>' +
            '</div>' +
          '</div>';
      });

      /* 货架统计只计可编辑分区（建筑构件不生成货架） */
      var editableZones = w.zones.filter(function (z) { return !z.kind; });
      var rackCount = editableZones.reduce(function (s, z) { return s + z.cols * z.rows; }, 0);
      var levelTotal = editableZones.reduce(function (s, z) { return s + z.cols * z.rows * z.levels; }, 0);

      $('whCfgBody').innerHTML =
        '<div class="wh-cfg-grid">' +
          '<label class="wh-field"><span>仓库名称</span><input type="text" class="wh-inp" id="whCfgName" value="' + escapeAttr(w.name) + '" maxlength="20" placeholder="例如：华东中心仓" /></label>' +
          '<label class="wh-field"><span>仓库编号</span><input type="text" class="wh-inp" id="whCfgCode" value="' + escapeAttr(w.code) + '" maxlength="12" placeholder="SH-01" /></label>' +
          '<label class="wh-field"><span>面积</span><input type="text" class="wh-inp" id="whCfgArea" value="' + escapeAttr(w.area) + '" maxlength="20" placeholder="4,200 m²" /></label>' +
          '<label class="wh-field"><span>所在地</span><input type="text" class="wh-inp" id="whCfgCity" value="' + escapeAttr(w.city) + '" maxlength="30" placeholder="上海 · 嘉定" /></label>' +
        '</div>' +
        '<div class="wh-cfg-sub">' +
          '<span>分区与货架布局</span>' +
          '<button type="button" class="btn btn-outline btn-sm" id="whCfgAddZone"><iconify-icon icon="ant-design:plus-outlined" width="13" height="13"></iconify-icon>添加分区</button>' +
        '</div>' +
        '<div class="wh-zone-list">' + (zoneHtml || '<div class="alert-empty">暂无分区，点击「添加分区」开始规划</div>') + '</div>' +
        '<div class="wh-cfg-hint">当前布局：<b>' + editableZones.length + '</b> 个分区 · <b>' + rackCount + '</b> 个货架 · <b>' + levelTotal + '</b> 个货位</div>';

      /* 列数 / 行数 / 层数统一走全局气泡弹窗组件（与分页器、对比选择同一实现） */
      if (window.createBubble) {
        var ZONE_OPTS = { cols: [1, 2, 3, 4, 5, 6], rows: [1, 2, 3, 4], levels: [1, 2, 3, 4, 5, 6] };
        $('whCfgBody').querySelectorAll('.wh-bubble-mount').forEach(function (m) {
          var row = m.closest('.wh-zone-row');
          if (!row) return;
          var zi = parseInt(row.getAttribute('data-z'), 10);
          var k = m.getAttribute('data-k');
          window.createBubble(m, {
            value: String(w.zones[zi][k]),
            options: ZONE_OPTS[k].map(function (n) { return { value: String(n), label: String(n) }; }),
            onChange: function (v) {
              w.zones[zi][k] = parseInt(v, 10);
              renderBody();
            }
          });
        });
      }

      /* 字段双向绑定 */
      function bindField(id, key) {
        var el = $(id);
        if (el) el.addEventListener('input', function () { w[key] = this.value; });
      }
      bindField('whCfgName', 'name');
      bindField('whCfgCode', 'code');
      bindField('whCfgArea', 'area');
      bindField('whCfgCity', 'city');

      /* 分区行绑定 */
      $('whCfgBody').querySelectorAll('.wh-zone-row').forEach(function (row) {
        var zi = parseInt(row.getAttribute('data-z'), 10);
        var z = w.zones[zi];
        row.querySelector('.wh-zone-name').addEventListener('input', function () { z.name = this.value; renderTabs(); });
        row.querySelector('.wh-zone-gift').addEventListener('change', function () { z.isGift = this.checked; });
        row.querySelector('.wh-zone-del').addEventListener('click', function () {
          if (w.zones.filter(function (z) { return !z.kind; }).length <= 1) { toast('至少保留一个分区', 'warning'); return; }
          w.zones.splice(zi, 1);
          renderAll();
        });
      });

      var addZone = $('whCfgAddZone');
      if (addZone) addZone.addEventListener('click', function () {
        if (w.zones.filter(function (z) { return !z.kind; }).length >= 6) { toast('最多 6 个分区', 'warning'); return; }
        w.zones.push({ key: 'zone' + w.zones.length, name: '新分区', isGift: false, cols: 2, rows: 1, levels: 4 });
        renderAll();
      });
    }

    function renderAll() { renderTabs(); renderBody(); }
    bindActions();
    renderAll();

    $('whCfgCancel').addEventListener('click', function () { hideModal(); });
    $('whCfgSave').addEventListener('click', function () {
      var valid = draft.filter(function (w) { return (w.name || '').trim(); });
      if (!valid.length) { toast('请至少保留一个有效仓库', 'warning'); return; }
      saveWhCfg(draft);
      WAREHOUSES = loadWhCfg();
      rebuildLayouts();
      applyRackCustom(); /* 仓库变更后重新覆盖货架自定义 */
      rebuildFlows();
      /* 当前仓库可能已被删除，兜底切到第一个 */
      if (!WAREHOUSES.some(function (w) { return w.id === curWh; })) curWh = WAREHOUSES[0].id;
      selectedRack = null;
      renderWhSwitch();
      renderPark();
      renderPanelEmpty();
      renderStockKpis();
      updateAlertBadge();
      hideModal();
      toast('仓库配置已应用', 'success');
    });
  }

  /* ---------- React 3D 园区桥接 ----------
     渲染交给 React Three Fiber（WebGL），业务数据仍由本模块提供。
     parkApp 持有 R3F 挂载句柄；未就绪时回退到原生 CSS 3D 渲染。 */
  var parkApp = null, r3fReady = false;
  /* 闪屏修复：r3fMounted 标记避免重复 mount；r3fRafId 防抖合并同帧多次 renderPark；
     r3fOnPick 稳定引用避免每次 render 新建闭包触发 Canvas 内部 effect 重跑 */
  var r3fMounted = false, r3fRafId = null, r3fOnPick = null;

  function mountR3F(warehouseId, layout, selected) {
    /* 必须挂到 #parkCanvas 专用容器，不能用 #parkStage ——
       Park3D.mount() 首次会执行 container.innerHTML = ''，
       直接挂 stage 会把 HUD、操作提示条等兄弟节点全部清掉。 */
    var container = $('parkCanvas') || $('parkStage');
    if (!container || !parkApp) return false;
    /* 已挂载 → 走增量 update，避免重复 mount 清空容器 */
    if (r3fMounted) return updateR3F(warehouseId, layout, selected);
    /* 稳定 onPick：读模块级 curWh 实时值，不固化闭包 */
    if (!r3fOnPick) {
      /* 稳定引用的拾取回调。
         交互要点：命中货架时先暂停自动环绕 —— 自动旋转会持续移动相机，
         R3F 的 onClick 依赖 pointerdown/up 期间射线未移动，相机自己在动时
         会被判定为拖拽而吞掉点击，表现为「点货架没反应」。 */
      r3fOnPick = function (rack, level) {
        if (!rack) { selectedRack = null; renderPanelEmpty(); renderPark(); return; }
        if (autoRotate) toggleAutoRotate(false);
        openRack(curWh, rack.id, level);
      };
    }
    try {
      parkApp.mount(container, {
        layout: layout,
        selectedId: selected ? selected.id : null,
        selectedLevel: selected ? selected.level : null,
        autoRotate: autoRotate,
        tx: 0, tz: 0,
        onPick: r3fOnPick
      });
      r3fMounted = true;
      return true;
    } catch (err) {
      return false;
    }
  }

  function updateR3F(warehouseId, layout, selected) {
    if (!parkApp) return false;
    if (!r3fOnPick) {
      /* 稳定引用的拾取回调。
         交互要点：命中货架时先暂停自动环绕 —— 自动旋转会持续移动相机，
         R3F 的 onClick 依赖 pointerdown/up 期间射线未移动，相机自己在动时
         会被判定为拖拽而吞掉点击，表现为「点货架没反应」。 */
      r3fOnPick = function (rack, level) {
        if (!rack) { selectedRack = null; renderPanelEmpty(); renderPark(); return; }
        if (autoRotate) toggleAutoRotate(false);
        openRack(curWh, rack.id, level);
      };
    }
    try {
      parkApp.update({
        layout: layout,
        selectedId: selected ? selected.id : null,
        selectedLevel: selected ? selected.level : null,
        autoRotate: autoRotate,
        tx: 0, tz: 0,
        onPick: r3fOnPick
      });
      return true;
    } catch (err) { return false; }
  }

  /* R3F 模式下的舞台交互反馈：
     ① 拖拽时给出 grabbing 光标（原生 CSS 3D 路径的 dragging 类已被解绑）；
     ② 相机滑离园区时显示常驻操作条 + 「回到全园」，解决"滑出去就找不回全局"。
     注意：这里只监听、不调 setPointerCapture —— 那个调用会劫持 canvas 的
     pointerup 导致 R3F onClick 失效（见 unbindParkControls 注释）。 */
  function bindR3FStageHints(stageEl) {
    if (!stageEl || stageEl.__r3fHints) return;
    stageEl.__r3fHints = true;
    var hint = $('parkNavHint');
    var hintTxt = $('parkNavHintTxt');
    var dragging = false, checkTimer = null;
    function refreshHint() {
      var off = false;
      try { off = !!(parkApp && parkApp.isOffPark && parkApp.isOffPark()); } catch (e) {}
      if (hint) hint.classList.toggle('show', off);
      if (hintTxt) {
        hintTxt.textContent = off
          ? '已滑出园区范围，点「回到全园」重新框住全部货架'
          : (navMode === 'pan'
            ? '按住左键拖动可四向平移园区，滚轮缩放互不干扰'
            : '切到「平移」后按住左键拖动可四向查看，滚轮仍可缩放');
      }
    }
    stageEl.addEventListener('pointerdown', function (e) {
      if (e.button === 0) { dragging = true; stageEl.classList.add('dragging'); }
      if (autoRotate) toggleAutoRotate(false);
    });
    window.addEventListener('pointerup', function () {
      if (!dragging) return;
      dragging = false;
      stageEl.classList.remove('dragging');
    });
    /* 相机变化由 R3F 内部驱动，宿主用轻量轮询同步提示条（约 4fps，足够且不干扰渲染） */
    checkTimer = setInterval(refreshHint, 260);
    refreshHint();
    /* 切页时停掉轮询，避免空跑 */
    if (!r3fHintTimer) r3fHintTimer = { t: checkTimer, el: stageEl };
  }
  var r3fHintTimer = null;
  function stopR3FStageHints() {
    if (!r3fHintTimer) return;
    try { clearInterval(r3fHintTimer.t); } catch (e) {}
    r3fHintTimer = null;
  }

  /* React 层异步就绪后接管渲染 */
  function unbindParkControls() {
    parkCtlHandlers.forEach(function (h) {
      try { h[0].removeEventListener(h[1], h[2], h[3]); } catch (e) {}
    });
    parkCtlHandlers = [];
    if (stage) stage.classList.remove('dragging');
  }
  /* 等待独立 R3F 模块（park3d-module.js）就绪；模块为 type=module 异步加载 */
  var _r3fWaitTimer = null;
  function initR3F() {
    if (r3fReady) return;
    if (!window.Park3D) {
      if (_r3fWaitTimer) return;
      var tries = 0;
      _r3fWaitTimer = setInterval(function () {
        tries++;
        if (window.Park3D) {
          clearInterval(_r3fWaitTimer); _r3fWaitTimer = null;
          initR3F();
        } else if (tries > 80) {
          clearInterval(_r3fWaitTimer); _r3fWaitTimer = null;
          console.warn('[WH] Park3D 模块加载超时，使用 CSS 3D 降级');
        }
      }, 50);
      return;
    }
    window.Park3D.init().then(function (app) {
      parkApp = app;
      r3fReady = true;
      r3fMounted = false;
      var stageEl = $('parkStage');
      if (stageEl) {
        unbindParkControls();
        var oldScene = stageEl.querySelector('#parkScene');
        if (oldScene && oldScene.parentNode) oldScene.parentNode.removeChild(oldScene);
        var oldLabels = $('parkLabelLayer');
        if (oldLabels) oldLabels.innerHTML = '';
        var holder = document.getElementById('parkCanvas');
        if (!holder) {
          holder = document.createElement('div');
          holder.id = 'parkCanvas';
          holder.style.cssText = 'position:absolute;inset:0;z-index:0;';
          stageEl.insertBefore(holder, stageEl.firstChild);
        }
        scene = null;
        stageEl.classList.add('r3f-active');
        stageEl.setAttribute('data-render', 'r3f');
        var modeTip2 = document.getElementById('parkRenderModeTip');
        if (modeTip2) {
          modeTip2.textContent = 'Three.js 3D 已启用';
          modeTip2.style.background = 'rgba(40,120,80,0.88)';
          setTimeout(function () { if (modeTip2.parentNode) modeTip2.parentNode.removeChild(modeTip2); }, 2500);
        }
        if (parkApp.setNavMode) parkApp.setNavMode(navMode);
        applyNavModeUI();
        renderPark();
        setTimeout(function () { if (parkApp.setView) parkApp.setView('reset'); }, 80);
        bindR3FStageHints(stageEl);
        watchStageResize();
      }
    }).catch(function (err) {
      console.warn('[WH] Park3D init failed', err);
      r3fReady = false;
    });
  }

  /* ---------- 详情侧栏 ---------- */
  /* 层选中浮层：展示商品名称与库存，固定屏幕坐标避免 3D 变换导致抖动 */
  function showParkFloat(wh, rack, level) {
    var el = $('parkFloat');
    if (!el) return;
    if (!level) {
      /* 整架选中：汇总各层库存，列出前若干货品 */
      var totalStock = 0, totalCap = 0, goodsMap = {};
      (rack.levels || []).forEach(function (l) {
        totalStock += l.stock || 0;
        totalCap += l.capacity || 0;
        (l.goods || []).forEach(function (g) {
          var k = g.name || '未命名';
          goodsMap[k] = (goodsMap[k] || 0) + (g.qty || 0);
        });
      });
      var goods = Object.keys(goodsMap).map(function (n) { return { name: n, qty: goodsMap[n] }; })
        .sort(function (a, b) { return b.qty - a.qty; }).slice(0, 6);
      var title = escapeHtml(rack.code) + (rack.name ? ' · ' + escapeHtml(rack.name) : '');
      var meta = escapeHtml(wh.name) + ' · 整架 ' + (rack.levels ? rack.levels.length : 0) + ' 层';
      el.innerHTML =
        '<div class="park-float-head">' +
          '<span class="park-float-code">' + title + '</span>' +
          '<span class="park-float-meta">' + meta + '</span>' +
          '<button type="button" class="park-float-close" id="parkFloatClose" title="关闭" aria-label="关闭">' +
            '<iconify-icon icon="ant-design:close-outlined" width="12" height="12"></iconify-icon></button>' +
        '</div>' +
        '<div class="park-float-stock">库存 <b>' + totalStock + '</b> / 容量 ' + totalCap + '</div>' +
        (goods.length
          ? '<div class="park-float-goods">' + goods.map(function (g) {
              return '<div class="park-float-good"><span class="park-float-good-n">' + escapeHtml(g.name) +
                '</span><span class="park-float-good-q">' + g.qty + '</span></div>';
            }).join('') + '</div>'
          : '<div class="park-float-empty">暂无货品，导入库存后自动填充</div>');
    } else {
      var rate = level.capacity ? Math.min(100, Math.round(level.stock / level.capacity * 100)) : 0;
      var lvTitle = '第 ' + level.level + ' 层' + (level.name ? ' · ' + escapeHtml(level.name) : '');
      var goods2 = level.goods || [];
      el.innerHTML =
        '<div class="park-float-head">' +
          '<span class="park-float-code">' + escapeHtml(rack.code) + '</span>' +
          '<span class="park-float-meta">' + lvTitle + '</span>' +
          '<button type="button" class="park-float-close" id="parkFloatClose" title="关闭" aria-label="关闭">' +
            '<iconify-icon icon="ant-design:close-outlined" width="12" height="12"></iconify-icon></button>' +
        '</div>' +
        '<div class="park-float-stock">库存 <b>' + (level.stock || 0) + '</b> / 容量 ' + (level.capacity || 0) +
          '（' + rate + '%）</div>' +
        (goods2.length
          ? '<div class="park-float-goods">' + goods2.map(function (g) {
              return '<div class="park-float-good"><span class="park-float-good-n">' + escapeHtml(g.name) +
                '</span><span class="park-float-good-q">' + g.qty + '</span></div>';
            }).join('') + '</div>'
          : '<div class="park-float-empty">本层暂无货品</div>');
    }
    el.hidden = false;
    var closeBtn = $('parkFloatClose');
    if (closeBtn) closeBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      hideParkFloat();
      selectedRack = null;
      renderPark();
      renderPanelEmpty();
    });
  }
  function hideParkFloat() {
    var el = $('parkFloat');
    if (el) { el.hidden = true; el.innerHTML = ''; }
  }

  function renderPanelEmpty() {
    hideParkFloat();
    var p = $('parkPanel');
    if (!p) return;
    p.innerHTML =
      '<div class="park-panel-empty">' +
      '<svg class="illus" width="132" height="96" viewBox="0 0 132 96" role="img" aria-label="未选择货架">' +
      '<rect class="il-f" x="28" y="20" width="76" height="56" rx="6"/>' +
      '<rect class="il-a" x="28" y="20" width="76" height="56" rx="6"/>' +
      '<path class="il-b" d="M40 38h52M40 52h52M40 66h34"/></svg>' +
      '<p class="park-panel-title">未选择货架</p>' +
      '<p class="park-panel-sub">在左侧园区中点击任意货架层查看该层商品与库存，点击货架本体查看整架。选中后可在右侧重命名货架或层名称。</p>' +
      '</div>';
  }

  /* 选中态统一结构：{ id, level }，level 为 null 表示整架 */
  function openRack(whId, rackId, levelNo) {
    var wh = WAREHOUSES.filter(function (w) { return w.id === whId; })[0];
    var rack = LAYOUTS[whId].racks.filter(function (r) { return r.id === rackId; })[0];
    if (!rack) return;
    selectedRack = levelNo ? { id: rackId, level: levelNo } : { id: rackId, level: null };
    renderPark();

    var p = $('parkPanel');
    if (!p) return;
    var target = levelNo ? rack.levels.filter(function (l) { return l.level === levelNo; })[0] : null;
    var flows = FLOWS.filter(function (f) {
      return f.whId === whId && f.rackCode === rack.code && (!levelNo || f.level === levelNo);
    }).slice(0, 8);

    /* 层选中浮层：即时展示商品名称与库存数量（不依赖侧栏是否展开） */
    showParkFloat(wh, rack, target);

    /* 头部：整架视角显示「货架」重命名入口；层视角额外显示「本层」重命名入口 */
    var lvName = target ? (target.name || '') : '';
    var html =
      '<div class="park-panel-head">' +
      '<div class="park-panel-head-main">' +
        '<h3>' + escapeHtml(rack.code) + '</h3>' +
        (rack.name ? '<div class="park-panel-name">' + escapeHtml(rack.name) + '</div>' : '') +
      '</div>' +
      '<div class="park-panel-ops">' +
        '<button type="button" class="park-rename-btn" id="parkBtnEditRack" title="重命名货架编号与名称">' +
          '<iconify-icon icon="ant-design:edit-outlined" width="13" height="13"></iconify-icon>重命名货架</button>' +
        (target ? '<button type="button" class="park-rename-btn" id="parkBtnEditLevel" title="重命名当前层">' +
          '<iconify-icon icon="ant-design:edit-outlined" width="13" height="13"></iconify-icon>重命名本层</button>' : '') +
      '</div>' +
      '<div class="park-panel-path">' + escapeHtml(wh.name) + ' · ' + escapeHtml(rack.zoneName) +
      (target ? ' · 第 ' + target.level + ' 层' + (lvName ? ' · ' + escapeHtml(lvName) : '') : ' · 全部 ' + rack.levels.length + ' 层') + '</div>' +
      '</div>';

    if (target) {
      var rate = target.capacity ? Math.min(100, Math.round(target.stock / target.capacity * 100)) : 0;
      var cat = CATEGORIES.filter(function (c) { return c.key === target.cat; })[0];
      html += '<div class="park-sec"><div class="park-sec-title">货位信息</div>' +
        '<div class="park-kv"><span class="park-kv-k">层名称</span><span class="park-kv-v">' +
        (lvName ? escapeHtml(lvName) : '<span class="park-kv-empty">未命名</span>') + '</span></div>' +
        '<div class="park-kv"><span class="park-kv-k">品类</span><span class="park-kv-v">' + escapeHtml(cat ? cat.name : target.cat) + '</span></div>' +
        '<div class="park-kv"><span class="park-kv-k">库存 / 容量</span><span class="park-kv-v">' + target.stock + ' / ' + target.capacity + '（' + rate + '%）</span></div>' +
        '</div>';
      html += '<div class="park-sec"><div class="park-sec-title">货品清单</div><div class="park-goods">';
      if (!target.goods || !target.goods.length) {
        html += '<div class="alert-empty">暂无货品，导入库存数据后自动填充</div>';
      }
      target.goods.forEach(function (g) {
        var isGift = cat && cat.isGift;
        html += '<div class="park-good' + (isGift ? ' gift' : '') + '">' +
          '<iconify-icon icon="ant-design:' + (isGift ? 'gift-outlined' : 'inbox-outlined') + '" width="13" height="13"></iconify-icon>' +
          '<span class="park-good-n">' + escapeHtml(g.name) + '</span>' +
          '<span class="park-good-q">' + g.qty + '</span></div>';
      });
      html += '</div></div>';
    } else {
      html += '<div class="park-sec"><div class="park-sec-title">各层占用<span class="park-sec-tip">点行选中该层，点铅笔重命名</span></div>';
      rack.levels.forEach(function (l) {
        var rate = l.capacity ? Math.min(100, Math.round(l.stock / l.capacity * 100)) : 0;
        var c = CATEGORIES.filter(function (x) { return x.key === l.cat; })[0];
        html += '<div class="park-lv-row" data-lv="' + l.level + '">' +
          '<span class="park-lv-main"><span class="park-lv-no">第 ' + l.level + ' 层</span>' +
          (l.name ? '<span class="park-lv-name">' + escapeHtml(l.name) + '</span>' : '') +
          '<span class="park-lv-cat">' + escapeHtml(c ? c.name : l.cat) + '</span></span>' +
          '<span class="park-lv-v">' + l.stock + ' / ' + l.capacity + '（' + rate + '%）</span>' +
          '<button type="button" class="park-lv-edit" data-lv-edit="' + l.level + '" title="重命名第 ' + l.level + ' 层">' +
            '<iconify-icon icon="ant-design:edit-outlined" width="12" height="12"></iconify-icon></button>' +
          '</div>';
      });
      html += '</div>';
    }

    html += '<div class="park-sec"><div class="park-sec-title">出入库流水 / 人员取货</div>';
    if (!flows.length) {
      html += '<div class="alert-empty">该范围近 7 天暂无出入库记录</div>';
    } else {
      html += '<div class="park-flow">';
      flows.forEach(function (f) {
        var d = new Date(f.time);
        var ts = d.getMonth() + 1 + '/' + d.getDate() + ' ' +
          String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
        html += '<div class="park-flow-item">' +
          '<span class="park-flow-dot ' + f.type + '"></span>' +
          '<div class="park-flow-body">' +
          '<div class="park-flow-t">' + (f.type === 'in' ? '入库' : '出库') + ' ' + f.qty + ' 件 · ' + escapeHtml(f.goods) + '</div>' +
          '<div class="park-flow-m">' + ts + ' · 经办 ' + escapeHtml(f.staff) + (f.type === 'out' ? ' · ' + escapeHtml(f.carrier) : '') + '</div>' +
          '</div></div>';
      });
      html += '</div>';
    }
    html += '</div>';
    p.innerHTML = html;
    p.scrollTop = 0;
    /* 绑定重命名入口 */
    var editBtn = $('parkBtnEditRack');
    if (editBtn) editBtn.addEventListener('click', function () {
      openRackCfg(whId, rackId, null);
    });
    var editLvBtn = $('parkBtnEditLevel');
    if (editLvBtn) editLvBtn.addEventListener('click', function () {
      openLevelCfg(whId, rackId, levelNo);
    });
    /* 各层占用：点行 → 进入该层；点铅笔 → 只重命名该层（不切换选中） */
    p.querySelectorAll('.park-lv-row').forEach(function (row) {
      var lv = parseInt(row.getAttribute('data-lv'), 10);
      row.addEventListener('click', function (e) {
        if (e.target.closest('.park-lv-edit')) return;
        openRack(whId, rackId, lv);
      });
      var ed = row.querySelector('.park-lv-edit');
      if (ed) ed.addEventListener('click', function (e) {
        e.stopPropagation();
        openLevelCfg(whId, rackId, lv);
      });
    });
  }

  /* ---------- 层重命名弹窗 ---------- */
  function openLevelCfg(whId, rackId, levelNo) {
    var wh = WAREHOUSES.filter(function (w) { return w.id === whId; })[0];
    var layout = LAYOUTS[whId];
    if (!wh || !layout) return;
    var rack = layout.racks.filter(function (r) { return r.id === rackId; })[0];
    if (!rack) return;
    var lv = rack.levels.filter(function (l) { return l.level === levelNo; })[0];
    if (!lv) return;
    var cfg = loadRackCfg();
    var whCfg = cfg[whId] || {};
    var rc = whCfg[rackId] || {};
    var curName = lv.name || '';

    var html =
      '<div class="wh-cfg">' +
        '<div class="wh-cfg-body" style="padding:22px 24px;">' +
          '<div class="wh-cfg-sub" style="margin-bottom:14px;">层重命名 · ' + escapeHtml(wh.name) + ' · ' + escapeHtml(rack.code) + ' · 第 ' + lv.level + ' 层</div>' +
          '<div class="wh-field"><label class="wh-lbl">层名称（可选）</label>' +
            '<input class="wh-inp" id="lvCfgName" value="' + escapeHtml(curName) + '" maxlength="16" placeholder="如：顶层礼盒 / 底层重货" autocomplete="off">' +
            '<div class="wh-cfg-hint">显示在 3D 场景层标与详情面板，用于区分各层用途</div>' +
          '</div>' +
        '</div>' +
        '<div class="wh-cfg-foot">' +
          '<button type="button" class="btn btn-ghost btn-sm" id="lvCfgReset">清除名称</button>' +
          '<div style="flex:1"></div>' +
          '<button type="button" class="btn btn-outline btn-sm" id="lvCfgCancel">取消</button>' +
          '<button type="button" class="btn btn-primary btn-sm" id="lvCfgSave">保存</button>' +
        '</div>' +
      '</div>';
    showModal(html, 'alert', null, 'form');

    function commit(name) {
      /* 保留该货架已有的 code/name，只更新 levels 映射 */
      whCfg[rackId] = {
        code: rc.code || rack.code,
        name: rc.name || rack.name || '',
        levels: Object.assign({}, rc.levels || {})
      };
      if (name) whCfg[rackId].levels[lv.level] = name;
      else delete whCfg[rackId].levels[lv.level];
      if (!Object.keys(whCfg[rackId].levels).length) delete whCfg[rackId].levels;
      cfg[whId] = whCfg;
      saveRackCfg(cfg);
      applyRackCustom();
      renderPark();
      openRack(whId, rackId, selectedRack && selectedRack.level);
    }

    $('lvCfgCancel').addEventListener('click', function () { hideModal(); });
    $('lvCfgReset').addEventListener('click', function () { commit(''); hideModal(); toast('已清除层名称', 'success'); });
    $('lvCfgSave').addEventListener('click', function () {
      var name = $('lvCfgName').value.trim();
      commit(name);
      hideModal();
      toast(name ? ('第 ' + lv.level + ' 层已重命名为「' + name + '」') : '已清除层名称', 'success');
    });
    /* 回车即保存 */
    $('lvCfgName').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') $('lvCfgSave').click();
    });
  }

  /* ---------- 货架自定义弹窗（编号 / 名称） ---------- */
  function openRackCfg(whId, rackId, levelNo) {
    var wh = WAREHOUSES.filter(function (w) { return w.id === whId; })[0];
    var layout = LAYOUTS[whId];
    if (!wh || !layout) return;
    var rack = layout.racks.filter(function (r) { return r.id === rackId; })[0];
    if (!rack) return;
    var cfg = loadRackCfg();
    var whCfg = cfg[whId] || {};
    var cur = whCfg[rackId] || { code: rack.code, name: rack.name || '' };
    var defaultCode = rack.code; /* 当前已应用后的 code（含此前自定义） */
    /* 保留已有层名称：改货架名不应清掉逐层命名 */
    var curLevels = (cur.levels && Object.keys(cur.levels).length) ? cur.levels : null;

    var html =
      '<div class="wh-cfg">' +
        '<div class="wh-cfg-body" style="padding:22px 24px;">' +
          '<div class="wh-cfg-sub" style="margin-bottom:14px;">货架重命名 · ' + escapeHtml(wh.name) + '</div>' +
          '<div class="wh-cfg-grid">' +
            '<div class="wh-field"><label class="wh-lbl">货架编号</label>' +
              '<input class="wh-inp" id="rackCfgCode" value="' + escapeHtml(cur.code) + '" maxlength="12" placeholder="' + escapeHtml(defaultCode) + '" autocomplete="off">' +
              '<div class="wh-cfg-hint">显示在 3D 场景标签与详情面板标题</div>' +
            '</div>' +
            '<div class="wh-field"><label class="wh-lbl">货架名称（可选）</label>' +
              '<input class="wh-inp" id="rackCfgName" value="' + escapeHtml(cur.name) + '" maxlength="20" placeholder="如：A 区主推礼品架" autocomplete="off">' +
              '<div class="wh-cfg-hint">备注用途，便于快速识别货架用途</div>' +
            '</div>' +
          '</div>' +
          '<div class="wh-cfg-hint" style="margin-top:14px;">货架位于：<strong>' + escapeHtml(rack.zoneName) + '</strong> · 列 ' + (rack.col + 1) + ' · 行 ' + (rack.row + 1) + ' · ' + rack.levels.length + ' 层' +
          (curLevels ? '（已命名 ' + Object.keys(curLevels).length + ' 层，保存后保留）' : '') + '</div>' +
        '</div>' +
        '<div class="wh-cfg-foot">' +
          '<button type="button" class="btn btn-ghost btn-sm" id="rackCfgReset">恢复默认</button>' +
          '<div style="flex:1"></div>' +
          '<button type="button" class="btn btn-outline btn-sm" id="rackCfgCancel">取消</button>' +
          '<button type="button" class="btn btn-primary btn-sm" id="rackCfgSave">保存</button>' +
        '</div>' +
      '</div>';
    /* 表单变体：内容自带底部操作区，不渲染默认确认键 */
    showModal(html, 'alert', null, 'form');

    $('rackCfgCancel').addEventListener('click', function () { hideModal(); });
    $('rackCfgReset').addEventListener('click', function () {
      showModal('确定恢复该货架的默认编号？当前自定义将被清除。', 'confirm', function (ok) {
        if (!ok) return;
        delete whCfg[rackId];
        if (Object.keys(whCfg).length) cfg[whId] = whCfg;
        else delete cfg[whId];
        saveRackCfg(cfg);
        applyRackCustom();
        renderPark();
        if (levelNo || levelNo === 0) openRack(whId, rackId, levelNo);
        else openRack(whId, rackId, null);
        hideModal();
        toast('已恢复默认编号', 'success');
      });
    });
    $('rackCfgSave').addEventListener('click', function () {
      var code = $('rackCfgCode').value.trim();
      var name = $('rackCfgName').value.trim();
      if (!code && !name) {
        delete whCfg[rackId];
        if (Object.keys(whCfg).length) cfg[whId] = whCfg;
        else delete cfg[whId];
      } else {
        whCfg[rackId] = { code: code || defaultCode, name: name };
        /* 逐层名称独立保存，不随货架改名丢失 */
        if (curLevels) whCfg[rackId].levels = curLevels;
        cfg[whId] = whCfg;
      }
      saveRackCfg(cfg);
      applyRackCustom();
      renderPark();
      /* 刷新详情面板，保留当前层级选中态 */
      if (levelNo || levelNo === 0) openRack(whId, rackId, levelNo);
      else openRack(whId, rackId, null);
      hideModal();
      toast('货架已重命名', 'success');
    });
    /* 回车即保存 */
    $('rackCfgCode').addEventListener('keydown', function (e) { if (e.key === 'Enter') $('rackCfgSave').click(); });
    $('rackCfgName').addEventListener('keydown', function (e) { if (e.key === 'Enter') $('rackCfgSave').click(); });
  }

  /* ---------- 库存管理渲染 ---------- */
  var flowPager = null, slowPager = null;
  var flowFilter = 'all', flowKw = '', slowFilter = 'all';
  /* 变更类型多选：空数组 = 不限制（参考真实 Excel 的筛选面板交互） */
  var flowKinds = [];

  /* 取流水的变更类型名：导入数据带 kind 字段，内置占位流水用方向兜底 */
  function flowKindOf(f) {
    return (f.carrier && f.carrier !== '入库' && f.carrier !== '出库')
      ? f.carrier
      : (f.type === 'in' ? '入库' : '出库');
  }

  /* 变更类型筛选器：带各类型计数 + 全选/反选 */
  function renderFlowKindFilter() {
    var box = $('flowKindFilter');
    if (!box) return;
    /* 统计各类型出现次数，按数量降序（与 Excel 筛选面板一致） */
    var cnt = {};
    FLOWS.forEach(function (f) {
      var k = flowKindOf(f);
      if (k === '入库' || k === '出库') return;   /* 方向已由上方 Tab 单独控制，此处不重复列出 */
      cnt[k] = (cnt[k] || 0) + 1;
    });
    var keys = Object.keys(cnt).sort(function (a, b) { return cnt[b] - cnt[a]; });
    if (!keys.length) { box.innerHTML = ''; box.style.display = 'none'; return; }
    box.style.display = '';
    var all = keys.every(function (k) { return flowKinds.indexOf(k) >= 0; });
    var html = '<div class="flow-kind-head">' +
      '<span class="flow-kind-title">变更类型</span>' +
      '<button type="button" class="flow-kind-op" data-op="all">' + (all ? '全选' : '全不选') + '</button>' +
      '<button type="button" class="flow-kind-op" data-op="invert">反选</button>' +
      (flowKinds.length ? '<button type="button" class="flow-kind-op" data-op="clear">清除</button>' : '') +
      '</div><div class="flow-kind-list">';
    keys.forEach(function (k) {
      var on = flowKinds.indexOf(k) >= 0;
      html += '<label class="flow-kind-item' + (on ? ' on' : '') + '">' +
        '<input type="checkbox" data-kind="' + escapeAttr(k) + '"' + (on ? ' checked' : '') + ' />' +
        '<span class="flow-kind-name">' + escapeHtml(k) + '</span>' +
        '<span class="flow-kind-n">' + cnt[k] + '</span></label>';
    });
    box.innerHTML = html + '</div>';
  }
  /* 分页器的 getData 闭包会固化首次创建时的数组引用 → 必须读模块级实时状态，
     否则切换筛选后 hint 已更新但表格仍是旧数据 */
  var flowViewList = [], slowViewList = [];

  function renderStockPage() {
    try {
    if (!$('stockKpis')) return;
    renderStockKpis();
    renderFlow();
    renderAlertCfg();
    renderAlertList();
    renderConsume();
    renderSlowSell();
    renderStockImportOverview();
    } catch(err) { document.body.setAttribute('data-err', err.message + ' | ' + String(err.stack||'').split(String.fromCharCode(10))[1]); }
  }

  function renderStockKpis() {
    var k = computeKpis();
    var box = $('stockKpis');
    box.innerHTML =
      '<div class="stock-kpi"><div class="stock-kpi-k">在管仓库</div><div class="stock-kpi-v">' + k.wh + '</div><div class="stock-kpi-sub">' + k.rack + ' 个货架 · ' + CATEGORIES.length + ' 个品类</div></div>' +
      '<div class="stock-kpi"><div class="stock-kpi-k">总体占用率</div><div class="stock-kpi-v">' + k.rate + '%</div><div class="stock-kpi-sub">' + k.stock + ' / ' + k.cap + ' 件</div></div>' +
      '<div class="stock-kpi"><div class="stock-kpi-k">近 7 天入库</div><div class="stock-kpi-v">+' + k.weekIn + '</div><div class="stock-kpi-sub">件</div></div>' +
      '<div class="stock-kpi"><div class="stock-kpi-k">近 7 天出库</div><div class="stock-kpi-v">−' + k.weekOut + '</div><div class="stock-kpi-sub">件</div></div>' +
      '<div class="stock-kpi' + (k.alertCount ? ' alert' : '') + '"><div class="stock-kpi-k">库存预警</div><div class="stock-kpi-v">' + k.alertCount + '</div><div class="stock-kpi-sub">条待处理</div></div>';
  }

  function renderFlow() {
    var body = $('stockFlowBody');
    if (!body) return;
    var list = FLOWS.filter(function (f) {
      if (flowFilter !== 'all' && f.type !== flowFilter) return false;
      /* 变更类型多选筛选：flowKinds 为空表示不限制 */
      if (flowKinds.length && flowKinds.indexOf(flowKindOf(f)) < 0) return false;
      /* Date Range Picker 筛选 */
      var startVal = ($('stockFlowStart') && $('stockFlowStart').value) || '';
      var endVal = ($('stockFlowEnd') && $('stockFlowEnd').value) || '';
      if (startVal || endVal) {
        var ft = f.time ? new Date(f.time) : null;
        if (ft && !isNaN(ft.getTime())) {
          var day = ft.getFullYear() + '-' + String(ft.getMonth()+1).padStart(2,'0') + '-' + String(ft.getDate()).padStart(2,'0');
          if (startVal && day < startVal) return false;
          if (endVal && day > endVal) return false;
        }
      }
      if (!flowKw) return true;
      var k = flowKw.toLowerCase();
      return (f.id + f.goods + f.staff + f.rackCode + f.carrier + (f.orderNo || '')).toLowerCase().indexOf(k) !== -1;
    });
    flowViewList = list;
    var hint = $('stockFlowHint');
    if (hint) {
      var rangeTxt = ($('stockFlowPeriodDisplay') && $('stockFlowPeriodDisplay').textContent) || '近7天';
      hint.textContent = '— ' + rangeTxt + ' · ' + list.length + ' / ' + FLOWS.length + ' 条记录';
    }
    var fb = $('tabFlowBadge');
    if (fb) { fb.textContent = FLOWS.length; }
    renderFlowKindFilter();

    if (!flowPager) {
      flowPager = createPager($('stockFlowPager'), {
        pageSize: 12,
        getData: function () { return flowViewList; },
        onPage: function (rows, page, size, total) {
          if (!total) {
            body.innerHTML = '<tr><td colspan="8" class="empty">' +
              (FLOWS.length ? '没有符合筛选条件的出入库记录' : '暂无出入库数据，请先在「数据导入」中导入库存变更表') + '</td></tr>';
            return;
          }
          var html = '';
          rows.forEach(function (f) {
            var d = new Date(f.time);
            var ts = (d.getMonth() + 1) + '/' + d.getDate() + ' ' +
              String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
            html += '<tr>' +
              '<td class="code-cell">' + escapeHtml(f.orderNo || f.id) + '</td>' +
              '<td><span class="tag ' + (f.type === 'in' ? 'tag-ok' : 'tag-soft') + '">' + (f.type === 'in' ? '入库' : '出库') + '</span></td>' +
              '<td><span class="tag tag-mute">' + escapeHtml(flowKindOf(f)) + '</span></td>' +
              '<td>' + escapeHtml(f.whName) + ' / ' + escapeHtml(f.rackCode) + (f.level ? ' · ' + f.level + '层' : '') + '</td>' +
              '<td>' + escapeHtml(f.goods) + '<div class="stock-mini-m">' + escapeHtml(f.sku) + '</div></td>' +
              '<td class="num">' + (f.type === 'in' ? '+' : '−') + f.qty + '</td>' +
              '<td>' + escapeHtml(f.staff) + '</td>' +
              '<td>' + ts + '</td>' +
              '</tr>';
          });
          body.innerHTML = html;
        }
      });
    } else {
      flowPager.draw();
    }
    flowPager.draw();
  }

  function renderAlertCfg() {
    var box = $('stockAlertConfig');
    if (!box) return;
    var cfg = loadAlertCfg();
    var n = computeAlerts(cfg).length;
    var hint = $('stockAlertHint');
    if (hint) hint.textContent = '— 触发 ' + n + ' 条';
    box.innerHTML =
      '<div class="alert-row">' +
      '<div class="alert-row-k">启用预警<small>关闭后不再计算触发规则</small></div>' +
      '<div class="alert-row-ctrl"><div class="switch' + (cfg.on ? ' on' : '') + '" id="alertSwitch" role="switch" aria-checked="' + cfg.on + '" tabindex="0"></div></div>' +
      '</div>' +
      '<div class="alert-row">' +
      '<div class="alert-row-k">低库存阈值<small>货位库存低于该值时预警</small></div>' +
      '<div class="alert-row-ctrl"><input type="number" id="cfgLowStock" min="0" value="' + cfg.lowStock + '" /><span class="alert-row-unit">件</span></div>' +
      '</div>' +
      '<div class="alert-row">' +
      '<div class="alert-row-k">高占用阈值<small>货位占用金额超过该值时预警</small></div>' +
      '<div class="alert-row-ctrl"><input type="number" id="cfgHighValue" min="0" value="' + cfg.highValue + '" /><span class="alert-row-unit">元</span></div>' +
      '</div>' +
      '<div class="alert-row">' +
      '<div class="alert-row-k">滞销判定天数<small>超期未出库判定为滞销</small></div>' +
      '<div class="alert-row-ctrl"><input type="number" id="cfgStaleDays" min="1" value="' + cfg.staleDays + '" /><span class="alert-row-unit">天</span></div>' +
      '</div>' +
      '<div class="alert-row alert-row-block">' +
      '<div class="alert-row-k">礼品排除关键词<small>命中名称/品类的礼品不参与预警与消耗分析，逗号分隔</small></div>' +
      '<div class="alert-row-ctrl" style="width:100%"><input type="text" id="cfgExcludeKeywords" class="alert-exclude-input" value="' +
        String(cfg.excludeKeywords || '').replace(/"/g, '&quot;') +
        '" placeholder="游戏币,卡牌,彩票" /></div>' +
      '</div>';

    var sw = $('alertSwitch');
    function flip() {
      var c = loadAlertCfg(); c.on = !c.on; saveAlertCfg(c);
      renderAlertCfg(); renderAlertList(); renderStockKpis(); updateAlertBadge();
    }
    if (sw) { sw.addEventListener('click', flip); sw.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); flip(); } }); }
    [['cfgLowStock', 'lowStock'], ['cfgHighValue', 'highValue'], ['cfgStaleDays', 'staleDays']].forEach(function (pair) {
      var el = $(pair[0]);
      if (!el) return;
      el.addEventListener('change', function () {
        var c = loadAlertCfg();
        var v = parseInt(el.value, 10);
        if (!isNaN(v) && v >= 0) { c[pair[1]] = v; saveAlertCfg(c); }
        renderAlertCfg(); renderAlertList(); renderStockKpis(); renderSlowSell(); renderConsume(); updateAlertBadge();
      });
    });
    var exEl = $('cfgExcludeKeywords');
    if (exEl) {
      exEl.addEventListener('change', function () {
        var c = loadAlertCfg();
        c.excludeKeywords = String(exEl.value || '').trim();
        saveAlertCfg(c);
        renderAlertCfg(); renderAlertList(); renderStockKpis(); renderSlowSell(); renderConsume(); updateAlertBadge();
      });
    }
  }

  var alertListPager = null;
  function renderAlertListRows(rows) {
    var box = $('stockAlertList');
    if (!box) return;
    if (!rows || !rows.length) {
      box.innerHTML = '<div class="alert-empty">当前无触发预警</div>';
      return;
    }
    var html = '<div class="alert-list">';
    rows.forEach(function (a) {
      html += '<div class="alert-item ' + (a.level === 'warn' ? 'warn' : '') + '">' +
        '<iconify-icon icon="ant-design:' + (a.level === 'warn' ? 'money-collect-outlined' : 'warning-outlined') + '" width="13" height="13"></iconify-icon>' +
        '<span class="alert-item-n">' + escapeHtml(a.rackCode) + ' · 第 ' + a.levelNo + ' 层 · ' + escapeHtml(a.cat) + '</span>' +
        '<span class="alert-item-m">' + escapeHtml(a.msg) + '</span>' +
        '</div>';
    });
    html += '</div>';
    box.innerHTML = html;
  }
  function renderAlertList() {
    var alerts = computeAlerts(loadAlertCfg());
    var mount = $('stockAlertPager');
    if (!alerts.length) {
      renderAlertListRows([]);
      if (mount) mount.style.display = 'none';
      return;
    }
    if (mount && typeof createPager === 'function') {
      if (!alertListPager) {
        alertListPager = createPager(mount, {
          pageSize: 10,
          getData: function () { return computeAlerts(loadAlertCfg()); },
          onPage: function (rows) { renderAlertListRows(rows); }
        });
      }
      alertListPager.draw();
    } else {
      renderAlertListRows(alerts);
    }
  }

  function renderConsume() {
    var chart = $('stockConsumeChart');
    if (!chart) return;
    var rows = computeConsume();
    var top = rows.slice(0, 8);
    var max = top.length ? top[0].qty : 1;
    var html = '';
    top.forEach(function (r) {
      var pct = max ? Math.round(r.qty / max * 100) : 0;
      html += '<div class="consume-row">' +
        '<span class="consume-name" title="' + escapeAttr(r.name) + '">' + escapeHtml(r.name) + '</span>' +
        '<span class="consume-bar-wrap"><span class="consume-bar' + (r.tier === 'low' ? ' low' : '') + '" style="width:' + pct + '%"></span></span>' +
        '<span class="consume-val"><span class="consume-val-n">' + r.qty + '</span><span class="consume-val-u">件</span></span>' +
        '</div>';
    });
    chart.innerHTML = html || '<div class="alert-empty">暂无出库数据</div>';

    var high = rows.filter(function (r) { return r.tier === 'high'; });
    var low = rows.filter(function (r) { return r.tier === 'low'; });
    $('stockHighList').innerHTML = miniList(high.length ? high : rows.filter(function (r) { return r.qty > 0; }).slice(0, 4), '高');
    $('stockLowList').innerHTML = miniList(low.length ? low : rows.slice(-3), '低');
  }

  function miniList(rows, tag) {
    if (!rows.length) return '<div class="alert-empty">暂无' + tag + '消耗礼品</div>';
    var html = '';
    rows.slice(0, 5).forEach(function (r) {
      html += '<div class="stock-mini">' +
        '<span class="stock-mini-n" title="' + escapeAttr(r.name) + '">' + escapeHtml(r.name) + '</span>' +
        '<span class="stock-mini-qty"><span class="stock-mini-v">' + r.qty + '</span><span class="stock-mini-m">件</span></span>' +
        '</div>';
    });
    return html;
  }

  /* 把消耗数据转为 { sku: qty } 映射，供滞销分析复用。
     优先用历史导入数据（长期趋势更能反映滞销），其次当前导入，最后回退 FLOWS 计算 */
  function buildConsumeMap() {
    var map = {};
    if (STOCK_IMPORT.history && STOCK_IMPORT.history.bySku) {
      Object.keys(STOCK_IMPORT.history.bySku).forEach(function (sku) {
        map[sku] = STOCK_IMPORT.history.bySku[sku].qty;
      });
      return map;
    }
    if (STOCK_IMPORT.current && STOCK_IMPORT.current.bySku) {
      Object.keys(STOCK_IMPORT.current.bySku).forEach(function (sku) {
        map[sku] = STOCK_IMPORT.current.bySku[sku].qty;
      });
      return map;
    }
    computeConsume().forEach(function (r) { map[r.sku] = r.qty; });
    return map;
  }

  function renderSlowSell() {
    var body = $('stockSlowBody');
    if (!body) return;
    var cfg = loadAlertCfg();
    var all = computeSlowSell(cfg, buildConsumeMap());
    var list = all.filter(function (r) {
      if (slowFilter === 'stale') return r.stale;
      if (slowFilter === 'high') return r.high;
      return true;
    });
    slowViewList = list;
    var hint = $('stockSlowHint');
    if (hint) hint.textContent = '— ' + list.length + ' 项 / 合计 ¥' + list.reduce(function (s, r) { return s + r.value; }, 0).toLocaleString();

    if (!slowPager) {
      slowPager = createPager($('stockSlowPager'), {
        pageSize: 10,
        getData: function () { return slowViewList; },
        onPage: function (rows, page, size, total) {
          if (!total) { body.innerHTML = '<tr><td colspan="8" class="empty">没有匹配的滞销礼品</td></tr>'; return; }
          var html = '';
          rows.forEach(function (r) {
            var lo = r.lastOut ? (r.lastOut.getMonth() + 1) + '/' + r.lastOut.getDate() : '无记录';
            var adv = r.advice || { text: '暂不处理', level: 'muted' };
            html += '<tr>' +
              '<td>' + escapeHtml(r.name) + '<div class="stock-mini-m">' + r.sku + '</div></td>' +
              '<td>' + escapeHtml(r.cat) + '</td>' +
              '<td>' + escapeHtml(r.wh) + ' / ' + escapeHtml(r.rackCode) + '</td>' +
              '<td class="num">' + r.qty + '</td>' +
              '<td class="num">¥' + r.value.toLocaleString() + '</td>' +
              '<td class="num">' + lo + '</td>' +
              '<td><span class="tag ' + (r.stale ? 'tag-ok' : 'tag-soft') + '">' + (r.stale ? '超期未动' : '高占用') + '</span></td>' +
              '<td><span class="tag advice-' + adv.level + '">' + escapeHtml(adv.text) + '</span></td>' +
              '</tr>';
          });
          body.innerHTML = html;
        }
      });
    }
    slowPager.draw();
  }

  function updateAlertBadge() {
    var n = computeAlerts(loadAlertCfg()).length;
    var b = $('menuAlertBadge');
    if (b) { b.textContent = n; b.style.display = n > 0 ? '' : 'none'; }
    /* 同步库存预警 Tab 徽标 */
    var tb = $('tabAlertBadge');
    if (tb) { tb.textContent = n; tb.style.display = n > 0 ? '' : 'none'; }
  }

  /* 事件绑定（只绑一次） */
  var bound = false;
  function bind() {
    if (bound) return;
    bound = true;
    /* 库存管理子页 Tab 切换 */
  var tabs = $('stockTabs');
  if (tabs) tabs.addEventListener('click', function (e) {
    var t = (e.target && e.target.closest) ? e.target.closest('.sub-tab') : null;
    if (!t) return;
    var key = t.getAttribute('data-stab');
    tabs.querySelectorAll('.sub-tab').forEach(function (b) {
      var on = b === t;
      b.classList.toggle('active', on);
      b.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    document.querySelectorAll('#page-wh-stock [data-stab-panel]').forEach(function (p) {
      p.classList.toggle('active', p.getAttribute('data-stab-panel') === key);
    });
  });
  /* 出入库动态日期筛选统一使用 Date Range Picker */
  if (typeof window.bindSharedDatePicker === 'function') {
    try {
      window.bindSharedDatePicker({
        rootId: 'stockFlowDatePicker',
        triggerId: 'stockFlowPeriodTrigger',
        panelId: 'stockFlowPeriodPanel',
        startId: 'stockFlowStart',
        endId: 'stockFlowEnd',
        displayId: 'stockFlowPeriodDisplay',
        presetsId: 'stockFlowPeriodPresets',
        calDaysL: 'stockFlowCalDaysL',
        calTitleL: 'stockFlowCalTitleL',
        calDaysR: 'stockFlowCalDaysR',
        calTitleR: 'stockFlowCalTitleR',
        placeholder: '请选择时间范围',
        defaultPreset: 'last7',
        onChange: function () { if (typeof renderFlow === 'function') renderFlow(); }
      });
    } catch (e) { console.warn('[flow] datepicker', e); }
  }

  var fBar = $('stockFlowFilters');
    if (fBar) fBar.addEventListener('click', function (e) {
      var t = (e.target && e.target.closest) ? e.target.closest('button[data-sflow]') : null;
      if (!t) return;
      flowFilter = t.getAttribute('data-sflow');
      fBar.querySelectorAll('button[data-sflow]').forEach(function (b) { b.classList.toggle('active', b === t); });
      /* 过滤条件变了：必须先重算 flowViewList 再让分页器重绘。
         【旧实现 bug】写的是 flowPager.reset()，但 reset() 内部只重置页码再 draw()，
         而 draw() 通过 opts.getData() 读的是旧的 flowViewList —— 数据从未按新过滤条件重算，
         表现就是按钮高亮切了但列表内容不变（实测点「入库」后表格仍是「出库」）。
         renderFlow() 内部会先 filter 出新 flowViewList，再调用 draw()，二者顺序正确。 */
      renderFlow();
    });
    var fIn = $('stockFlowSearch');
    var fBtn = $('btnStockFlowSearch');
    if (fBtn && !fBtn.__bound) {
      fBtn.__bound = true;
      fBtn.addEventListener('click', function (e) {
        e.preventDefault();
        flowKw = fIn ? (fIn.value || '').trim() : '';
        renderFlow();
      });
    }
    if (fIn && !fIn.__boundEnter) {
      fIn.__boundEnter = true;
      fIn.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
          e.preventDefault();
          flowKw = (fIn.value || '').trim();
          renderFlow();
        }
      });
    }

    /* 变更类型筛选：change 用委托（复选框被 innerHTML 重绘，需委托而非逐个绑定） */
    var kBar = $('flowKindFilter');
    if (kBar) {
      kBar.addEventListener('change', function (e) {
        var cb = (e.target && e.target.closest) ? e.target.closest('input[data-kind]') : null;
        if (!cb) return;
        var k = cb.getAttribute('data-kind');
        var i = flowKinds.indexOf(k);
        if (cb.checked) { if (i < 0) flowKinds.push(k); }
        else if (i >= 0) flowKinds.splice(i, 1);
        renderFlow();
        if (flowPager) flowPager.reset();
      });
      kBar.addEventListener('click', function (e) {
        var op = (e.target && e.target.closest) ? e.target.closest('.flow-kind-op') : null;
        if (!op) return;
        var mode = op.getAttribute('data-op');
        var keys = [];
        kBar.querySelectorAll('input[data-kind]').forEach(function (cb) { keys.push(cb.getAttribute('data-kind')); });
        if (mode === 'all') flowKinds = (flowKinds.length === keys.length) ? [] : keys.slice();
        else if (mode === 'invert') {
          var next = [];
          keys.forEach(function (k) { if (flowKinds.indexOf(k) < 0) next.push(k); });
          flowKinds = next;
        } else if (mode === 'clear') flowKinds = [];
        else return;
        renderFlow();
        if (flowPager) flowPager.reset();
      });
    }

    var sBar = $('stockSlowFilters');
    if (sBar) sBar.addEventListener('click', function (e) {
      var t = (e.target && e.target.closest) ? e.target.closest('button[data-slow]') : null;
      if (!t) return;
      slowFilter = t.getAttribute('data-slow');
      sBar.querySelectorAll('button[data-slow]').forEach(function (b) { b.classList.toggle('active', b === t); });
      /* 必须重算 list：分页器 getData 闭包持有创建时的 list，仅 reset() 不够 */
      renderSlowSell();
      if (slowPager) slowPager.reset();
    });

    /* ----- 数据导入 Tab 事件 ----- */
    var stockUpload = $('stockUploadArea');
    var stockFile = $('stockExcelFile');
    if (stockUpload && stockFile) {
      stockUpload.addEventListener('click', function () { stockFile.click(); });
      stockFile.addEventListener('change', function (e) {
        if (e.target.files && e.target.files[0]) {
          var mode = getStockImportMode();
          parseStockImport(e.target.files[0], mode);
        }
        e.target.value = '';
      });
      stockUpload.addEventListener('dragover', function (e) { e.preventDefault(); stockUpload.classList.add('dragover'); });
      stockUpload.addEventListener('dragleave', function () { stockUpload.classList.remove('dragover'); });
      stockUpload.addEventListener('drop', function (e) {
        e.preventDefault(); stockUpload.classList.remove('dragover');
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
          var mode = getStockImportMode();
          parseStockImport(e.dataTransfer.files[0], mode);
        }
      });
    }
    var importClear = $('stockImportClear');
    if (importClear) importClear.addEventListener('click', function () {
      confirmClear('清空导入数据', '确定清空已导入的历史与当前数据？消耗分析将回退到系统内置流水。', function () {
        STOCK_IMPORT = { history: null, current: null };
        try { localStorage.removeItem(STOCK_IMPORT_KEY); } catch (e) {}
        /* 清空后同步重建布局与流水，园区/KPI 立即回到空态 */
        rebuildLayouts();
        applyRackCustom();
        rebuildFlows();
        renderStockImportOverview();
        renderConsume();
        renderSlowSell();
        renderStockKpis();
        hideModal();
        toast('已清空导入数据', 'success');
      });
    });
    var importTpl = $('stockImportTemplate');
    if (importTpl) importTpl.addEventListener('click', downloadStockImportTemplate);
  }

  /* 获取当前选中的导入模式 */
  function getStockImportMode() {
    var checked = document.querySelector('input[name="stockImportMode"]:checked');
    return checked ? checked.value : 'history';
  }

  /* 下载导入模板（CSV，UTF-8 BOM 防 Excel 乱码） */
  /* 导入模板：以「库存变更查询」导出的标准表头为准（19 列），
     用 XLSX 生成真正的 .xlsx（而非 CSV），与用户在系统中导出的原始文件格式一致。 */
  var IMPORT_HEADERS = ['仓库', '商品名称', '商品编码', '商品分类', '单位',
    '原数量', '变更数量', '变更后数量', '变更金额', '变更含税金额',
    '变更类型', '摘要', '单号', '备注', '变更时间', '账期',
    '供应商', '操作人', '操作终端'];

  function downloadStockImportTemplate() {
    if (typeof XLSX === 'undefined') { toast('Excel 组件未加载，无法生成模板', 'error'); return; }
    /* 示例行取自真实业务形态：负数=出库消耗，正数=入库 */
    var samples = [
      ['上海中心仓', '中秋团圆礼盒·典藏', '80001388', '礼品/礼盒', '件', '160', '-12', '148', '-3936', '-4418.56', '领用', '销售出库', 'E5924000600052609305345634', '', '2026-09-30 22:34:35', '2026-09-30', '', '露西（王楚）', '礼品兑换处'],
      ['上海中心仓', '精选干红葡萄酒', '80002101', '礼品/酒水', '瓶', '58', '-6', '52', '-828', '-928.00', '领用', '销售出库', 'E5924000600052609305345701', '', '2026-09-30 20:11:08', '2026-09-30', '', '张启明', '礼品兑换处'],
      ['杭州分仓', '商务伴手礼·简约款', '80001502', '礼品/礼盒', '件', '0', '40', '40', '6720', '7526.40', '采购入库', '采购收货', 'E5924000600052609305345822', '首批入库', '2026-09-29 10:02:51', '2026-09-29', '杭州礼品供应商', '李慧敏', '收货区'],
      ['杭州分仓', '每日坚果礼罐', '80003311', '礼品/食品', '罐', '0', '24', '24', '2832', '3171.84', '采购入库', '采购收货', 'E5924000600052609305345901', '', '2026-09-29 09:41:16', '2026-09-29', '杭州食品供应', '王振华', '收货区']
    ];
    var aoa = [IMPORT_HEADERS].concat(samples);
    try {
      var ws = XLSX.utils.aoa_to_sheet(aoa);
      /* 列宽：让模板在 Excel 中可直接阅读，不必手动拉列 */
      ws['!cols'] = IMPORT_HEADERS.map(function (h, i) {
        return { wch: i === 1 ? 24 : (i === 2 ? 14 : (i === 12 ? 26 : Math.max(10, h.length * 2.2))) };
      });
      var wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, '库存变更数据');
      XLSX.writeFile(wb, '库存变更数据导入模板.xlsx');
      toast('模板已下载（.xlsx，含标准 19 列表头）', 'success');
    } catch (err) {
      /* XLSX 不可用时降级为 CSV，保证功能不中断 */
      var csv = '﻿' + aoa.map(function (r) {
        return r.map(function (c) { return /[",\n]/.test(c) ? '"' + c.replace(/"/g, '""') + '"' : c; }).join(',');
      }).join('\n');
      var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url; a.download = '库存变更数据导入模板.csv';
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setTimeout(function () { URL.revokeObjectURL(url); }, 200);
      toast('Excel 组件异常，已降级为 CSV 模板', 'warning');
    }
  }

  /* 页面进入时渲染 */
  function enterPark() {
    bind();
    bindParkToolbar();
    initR3F();
    renderWhSwitch();
    renderLegend();
    /* 重新进入时若 R3F 已就绪但容器已被卸载，需重建 holder 再挂载 */
    if (r3fReady && parkApp) {
      var st = $('parkStage');
      if (st && !st.querySelector('#parkCanvas')) {
        var oldScene2 = st.querySelector('#parkScene');
        if (oldScene2 && oldScene2.parentNode) oldScene2.parentNode.removeChild(oldScene2);
        /* 同步清掉 CSS 3D 降级路径遗留的标签（与 initR3F 同一原因） */
        var oldLabels2 = $('parkLabelLayer');
        if (oldLabels2) oldLabels2.innerHTML = '';
        var h2 = document.createElement('div');
        h2.id = 'parkCanvas';
        st.insertBefore(h2, st.firstChild);
      }
      renderPark();
      bindR3FStageHints(st);
    } else {
      renderPark();
    }
    renderPanelEmpty();
    if (autoRotate && scene) startSpin();
    updateAlertBadge();
  }
  function enterStock() {
    bind();
    renderStockPage();
  }
  function leave() {
    stopSpin();
    stopR3FStageHints();
    hideParkFloat();
    selectedRack = null;
    var hint = $('parkNavHint');
    if (hint) hint.classList.remove('show');
    if (parkApp) { try { parkApp.unmount(); } catch (e) {} }
    r3fMounted = false;
    var stLeave = $('parkStage');
    if (stLeave) { stLeave.classList.remove('r3f-active'); stLeave.removeAttribute('data-render'); }
  }

  /* 数据看板用的仓库侧概览。
     复用与「库存管理」页完全相同的计算函数（computeKpis / computeSlowSell / computeConsume），
     保证看板与库存管理页的数字口径一致，不会出现两处算法漂移。 */
  /* 时间范围边界：thisWeek / lastWeek / thisMonth */
  function getRangeBounds(range) {
    var now = new Date();
    now.setHours(0, 0, 0, 0);
    var start, end, day;
    if (range && typeof range === 'object' && range.start && range.end) {
      start = new Date(range.start);
      end = new Date(range.end);
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      return { start: start, end: end };
    }
    if (range === 'lastWeek') {
      day = now.getDay() || 7;
      end = new Date(now);
      end.setDate(now.getDate() - day);
      start = new Date(end);
      start.setDate(end.getDate() - 6);
    } else if (range === 'last30Days' || range === 'last30') {
      end = new Date(now.getTime());
      start = new Date(now.getTime());
      start.setDate(now.getDate() - 29);
    } else if (range === 'thisMonth') {
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = new Date(now.getTime());
    } else {
      day = now.getDay() || 7;
      start = new Date(now);
      start.setDate(now.getDate() - (day - 1));
      end = new Date(now.getTime());
    }
    end.setHours(23, 59, 59, 999);
    return { start: start, end: end };
  }

  /* 礼品出库趋势：按日落点，支持本周/上周/近30天/本月 */
  var __trendCache = null, __trendKey = '';
  function getConsumeTrend(range) {
    range = range || 'thisWeek';
    var ckey = range + '|' + flowStamp();
    if (__trendCache && __trendKey === ckey) return __trendCache;
    var b = getRangeBounds(range);
    var buckets = [];
    var cur = new Date(b.start.getFullYear(), b.start.getMonth(), b.start.getDate());
    var endDay = new Date(b.end.getFullYear(), b.end.getMonth(), b.end.getDate());
    var guard = 0;
    while (cur.getTime() <= endDay.getTime() && guard < 62) {
      buckets.push({
        key: cur.getFullYear() + '-' + (cur.getMonth() + 1) + '-' + cur.getDate(),
        label: (cur.getMonth() + 1) + '/' + cur.getDate(),
        qty: 0,
        time: cur.getTime()
      });
      cur.setDate(cur.getDate() + 1);
      guard++;
    }
    var map = {};
    buckets.forEach(function (x) { map[x.key] = x; });
    FLOWS.forEach(function (f) {
      if (!f || f.type !== 'out') return;
      var t = f.time instanceof Date ? new Date(f.time.getTime()) : new Date(f.time);
      if (isNaN(t.getTime())) return;
      if (t.getTime() < b.start.getTime() || t.getTime() > b.end.getTime()) return;
      var key = t.getFullYear() + '-' + (t.getMonth() + 1) + '-' + t.getDate();
      var slot = map[key];
      if (slot) slot.qty += (f.qty || 0);
    });
    __trendCache = buckets;
    __trendKey = ckey;
    return buckets;
  }

  var __ovCache = null, __ovKey = '';
  function flowStamp() {
    return FLOWS.length + ':' + (FLOWS[0] && FLOWS[0].id ? FLOWS[0].id : '') + ':' + (STOCK_IMPORT && STOCK_IMPORT.current ? 1 : 0);
  }
  function getOverview() {
    var key = flowStamp() + ':' + WAREHOUSES.length;
    if (__ovCache && __ovKey === key) return __ovCache;

    var cfg = loadAlertCfg();
    var k = computeKpis();
    var slow = computeSlowSell(cfg, buildConsumeMap());
    var slowValue = slow.reduce(function (s, r) { return s + r.value; }, 0);
    var slowQty = slow.reduce(function (s, r) { return s + r.qty; }, 0);
    /* TOP 5 排序口径：有单价按占用金额，无单价（金额恒 0）按滞销数量，
       与看板饼图切分口径保持一致，避免「其他」切片吞掉整张饼图 */
    var top = slow.slice().sort(function (a, b) {
      return slowValue > 0 ? (b.value - a.value) : (b.qty - a.qty);
    }).slice(0, 5);
    var consume = computeConsume();
    /* 近 7 日分仓出入库（看板出入库环形图） */
    var flowMap = {};
    WAREHOUSES.forEach(function (w) { flowMap[w.id] = { name: w.name, inQty: 0, outQty: 0 }; });
    var nowFlow = Date.now();
    FLOWS.forEach(function (f) {
      if (!f || !f.time) return;
      var ts = f.time instanceof Date ? f.time.getTime() : new Date(f.time).getTime();
      if (isNaN(ts) || nowFlow - ts > 7 * 864e5) return;
      var slot = flowMap[f.whId];
      if (!slot) {
        slot = { name: f.whName || f.whId || '未知仓', inQty: 0, outQty: 0 };
        flowMap[f.whId || f.whName || 'x'] = slot;
      }
      if (f.type === 'in') slot.inQty += (f.qty || 0);
      else if (f.type === 'out') slot.outQty += (f.qty || 0);
    });
    var flowByWh = Object.keys(flowMap).map(function (id) { return flowMap[id]; });

    /* 分仓库存：看板环形图「各仓库存占比」数据源（与布局同源，无二次口径） */
    var byWh = WAREHOUSES.map(function (wh) {
      var s = 0;
      LAYOUTS[wh.id].racks.forEach(function (r) {
        r.levels.forEach(function (lv) { s += lv.stock; });
      });
      return { name: wh.name, stock: s };
    });
    __ovKey = key;
    __ovCache = {
      wh: k.wh, rack: k.rack, rate: k.rate, stock: k.stock, cap: k.cap,
      weekIn: k.weekIn, weekOut: k.weekOut, alertCount: k.alertCount,
      slowCount: slow.length, slowValue: slowValue, slowQty: slowQty, topSlow: top,
      giftSku: consume.length, byWh: byWh,
      consumeTrend: getConsumeTrend('thisWeek'),
      flowByWh: flowByWh
    };
    return __ovCache;
  }

  /* 当前 3D 视角状态（相机位置 / 控制器参数）。
     供宿主同步「俯视」按钮态与操作提示，也便于自动化验证平移缩放是否生效。 */
  function getParkView() {
    if (r3fReady && parkApp && parkApp.getView) {
      var v = parkApp.getView();
      v.mode = navMode;
      return v;
    }
    return { pos: null, target: null, cam: cam, mode: navMode, view: 'css3d' };
  }
  /* 当前拖动模式：'rotate' | 'pan' */
  function getNavMode() { return navMode; }

  var api = {
    WAREHOUSES: WAREHOUSES,
    enterPark: enterPark,
    enterStock: enterStock,
    leave: leave,
    updateAlertBadge: updateAlertBadge,
    getOverview: getOverview,
    getConsumeTrend: getConsumeTrend,
    flowStamp: flowStamp,
    getRangeBounds: getRangeBounds,
    getParkView: getParkView,
    getNavMode: getNavMode
  };

  /* 对外桥接：WH 是主 IIFE 内的闭包变量，外部脚本访问不到。
     这里只挂只读查询接口，不暴露任何写操作。 */
  /* 启动时预加载 R3F，避免进入园区时仍卡在 CSS 3D 旧画面 */
  setTimeout(function () { try { initR3F(); } catch (e) {} }, 80);

  window.WH = api;
  return api;
})();


/* ========== js/core/boot-bind.js ========== */
/* js/core/boot-bind.js — 主 IIFE 尾部：事件绑定与启动 */
  /* 首次加载：无 hash / 登录态由 Auth 决定；未登录统一 #/login */
    /* 迁移历史折叠态：双栏布局下收起入口已移除，
   旧 localStorage 值会让面板变窄，这里清空并恢复展开态 */
  (function () {
    var sb = document.getElementById('menuShell') || document.querySelector('.menu-shell');
    if (!sb) return;
    try {
      localStorage.removeItem('cmg_sidebar_collapsed');
      if (localStorage.getItem(SHELL_KEY) === '1') {
        sb.classList.add('is-collapsed');
        sb.setAttribute('data-collapsed', '1');
      } else {
        sb.classList.remove('is-collapsed');
        sb.setAttribute('data-collapsed', '0');
      }
    } catch (e) {}
  })();

(function () {
    var path = (location.hash || '').replace(/^#/, '');
    if (!path || path === '/login' || path === 'login') {
      history.replaceState(null, '', '#/login');
      return;
    }
    var name = PAGE_PATHS[path] || 'dashboard';
    if (name === 'login') return;
    if (name === 'scan-data') {
      currentScanView = _parseScanView(path);
      var canon = '#/scan-data/' + currentScanView;
      if (location.hash !== canon) history.replaceState(null, '', canon);
    }
    if (name === 'machine-profit') {
      currentMachineProfitView = _parseMachineProfitView(path);
      var canonMp = '#/machine-profit/' + currentMachineProfitView;
      if (location.hash !== canonMp) history.replaceState(null, '', canonMp);
    }
    if (name === 'machine-category') {
      currentCategoryView = typeof _parseCategoryView === 'function' ? _parseCategoryView(path) : (currentCategoryView || 'import');
      var canonCat = '#/machine-category/' + currentCategoryView;
      if (location.hash !== canonCat) history.replaceState(null, '', canonCat);
    }
    /* 未登录时仍先应用页面 DOM（被 gate 遮住）；Auth.boot 会校正 hash */
    _applyPage(name);
  })();

  var _btnPrev = $('btnPrev');
  if (_btnPrev) _btnPrev.addEventListener('click', function () {
    if (currentPage > 1) { currentPage--; renderPage(); }
  });
  var _btnNext = $('btnNext');
  if (_btnNext) _btnNext.addEventListener('click', function () {
    currentPage++;
    renderPage();
  });

  /* 盘点明细页筛选条（限定作用域，避免命中「对账对比」筛选条） */
  document.querySelectorAll('#page-detail .filter-bar .btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      currentFilter = btn.getAttribute('data-filter');
      currentPage = 1;
      document.querySelectorAll('.filter-bar .btn').forEach(function (b) {
        b.classList.toggle('active', b === btn);
      });
      renderPage();
    });
  });

  var searchInputEl = $('searchInput');
  if (searchInputEl) {
    searchInputEl.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        searchKeyword = this.value.trim();
        currentPage = 1;
        renderPage();
      }
    });
  }
  var btnSearch = $('btnSearch');
  if (btnSearch) {
    btnSearch.addEventListener('click', function () {
      searchKeyword = searchInputEl ? searchInputEl.value.trim() : '';
      currentPage = 1;
      renderPage();
    });
  }

  /* 盘点数据页搜索：仅按钮 / 回车触发 */
  function bindScanSearch(inputId, btnId, apply) {
    var input = $(inputId);
    var btn = $(btnId);
    if (!input) return;
    function run() { apply(input.value.trim()); }
    /* 仅点击搜索按钮或回车触发，禁止输入过程自动搜索 */
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); run(); }
    });
    if (btn) btn.addEventListener('click', function (e) { e.preventDefault(); run(); });
  }

  /* 盘点前账面库存：搜索过滤（renderPreScan 内部会重置分页并刷新计数） */
  bindScanSearch('preScanSearch', 'btnPreScanSearch', function (kw) {
    preScanKeyword = kw;
    if (preScanPager) preScanPager.reset();
    renderPreScan();
  });
  /* 账面比对结果：在筛选条件之上叠加关键词 */
  bindScanSearch('compareSearch', 'btnCompareSearch', function (kw) {
    compareKeyword = kw;
    if (compareState.pager) compareState.pager.reset();
    else if (compareState.rows.length) renderCompareRows(filteredCompareRows(), filteredCompareRows().length);
  });

  tableBody.addEventListener('change', function (e) {
    var t = e.target;
    if (t && t.classList.contains('qty-input')) onQtyChange(t);
  });

  tableBody.addEventListener('click', function (e) {
    /* 用 closest 命中按钮本身：按钮内已嵌入图标元素，e.target 可能是图标 */
    var raw = e.target;
    var t = (raw && raw.closest) ? raw.closest('.btn-del, .qty-step') : raw;
    if (!t || !t.classList) return;
    if (t.classList.contains('btn-del')) {
      var id = t.getAttribute('data-del-id');
      if (id) deleteItem(id);
      return;
    }
    if (t.classList.contains('qty-step')) {
      var sid = t.getAttribute('data-id');
      var step = parseInt(t.getAttribute('data-step'), 10) || 0;
      var idx = lookup.get(sid);
      if (idx === undefined) return;
      var item = items[idx];
      var val = Math.max(0, item.actualQty + step);
      if (val === item.actualQty) return;
      item.actualQty = val;
      updateDiff(item);
      saveItems();
      lastHighlightId = item.id;
      /* 原地更新单行 + 顶部统计数字，不调用 renderPage，避免整页表格抖动 */
      var ok = updateRowInPlace(item);
      if (!ok) renderPage();
      /* 同步顶部 5 个统计卡数字（只改 textContent，不重建 DOM） */
      var newSur = 0, newDef = 0, newBal = 0, newScanned = 0;
      for (var i = 0; i < items.length; i++) {
        if (items[i].status === 'surplus') newSur++;
        else if (items[i].status === 'deficit') newDef++;
        else newBal++;
        if (items[i].actualQty > 0) newScanned++;
      }
      $('stat-surplus').textContent = newSur;
      $('stat-deficit').textContent = newDef;
      $('stat-balanced').textContent = newBal;
      $('stat-scanned').textContent = newScanned;
      var sb = $('menuScannedBadge');
      if (sb) { sb.textContent = newScanned; sb.style.display = newScanned > 0 ? '' : 'none'; }
    }
  });

  var pageSizeSelect = $('pageSizeSelect');
  if (pageSizeSelect) {
    createBubble(pageSizeSelect, {
      value: PAGE_SIZE,
      options: PAGE_SIZE_OPTIONS.map(function (n) { return { value: n, label: n + ' 条' }; }),
      onChange: function (v) {
        var val = parseInt(v, 10);
        if (!isNaN(val) && PAGE_SIZE_OPTIONS.indexOf(val) !== -1) {
          PAGE_SIZE = val;
          currentPage = 1;
          renderPage();
        }
      }
    });
  }


  var uploadArea = $('uploadArea');
  var excelFile = $('excelFile');
  uploadArea.addEventListener('click', function () { excelFile.click(); });
  excelFile.addEventListener('change', function (e) {
    if (e.target.files && e.target.files[0]) parseExcel(e.target.files[0]);
    e.target.value = '';
  });
  uploadArea.addEventListener('dragover', function (e) {
    e.preventDefault();
    uploadArea.classList.add('dragover');
  });
  uploadArea.addEventListener('dragleave', function () {
    uploadArea.classList.remove('dragover');
  });
  uploadArea.addEventListener('drop', function (e) {
    e.preventDefault();
    uploadArea.classList.remove('dragover');
    if (e.dataTransfer.files && e.dataTransfer.files[0]) parseExcel(e.dataTransfer.files[0]);
  });

  window.addEventListener('load', function () {
    setTimeout(function () {
      if (typeof XLSX === 'undefined') {
        showLibError('Excel 解析库未能加载。请确认 frontend/vendor/xlsx.full.min.js 已随页面正确加载后刷新。');
        toast('解析库加载失败', 'error');
      }
    }, 900);
  });

  
  

  /* 设置 · 二级「修改密码」 */
  (function bindChangePwdMenu() {
    var menu = document.getElementById('sidebarMenu');
    if (!menu || menu.__changePwdBound) return;
    menu.__changePwdBound = true;
    menu.addEventListener('click', function (e) {
      var item = e.target.closest && e.target.closest('.menu-item[data-action="change-pwd"]');
      if (!item) return;
      e.preventDefault();
      e.stopPropagation();
      if (typeof openChangePasswordFromUi === 'function') openChangePasswordFromUi();
      else if (window.Auth && typeof Auth.openChangePwdModal === 'function') Auth.openChangePwdModal(false);
    });
  })();

  function openChangePasswordFromUi() {
    if (window.Auth && typeof Auth.current === 'function' && Auth.current()) {
      if (typeof Auth.closeAccountPanel === 'function') Auth.closeAccountPanel();
      else if (typeof closeAccountPanel === 'function') closeAccountPanel();
      if (typeof Auth.openChangePwdModal === 'function') Auth.openChangePwdModal(false);
      else if (typeof openChangePwdModal === 'function') openChangePwdModal(false);
      else {
        var box = document.getElementById('authChangePwd');
        if (box) {
          box.hidden = false;
          box.removeAttribute('hidden');
          box.classList.add('is-open');
          box.setAttribute('data-forced', '0');
        }
      }
    } else if (typeof toast === 'function') {
      toast('请先登录', 'warning');
    }
  }
  var btnChangePwd = $('btnChangePwd');

  var btnAdminChangePwd = $('btnAdminChangePwd');
  if (btnAdminChangePwd && !btnAdminChangePwd.__bound) {
    btnAdminChangePwd.__bound = true;
    btnAdminChangePwd.addEventListener('click', function (e) {
      e.preventDefault();
      openChangePasswordFromUi();
    });
  }

  if (btnChangePwd) {
    btnChangePwd.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      if (window.Auth && typeof Auth.current === 'function' && Auth.current()) {
        if (typeof Auth.closeAccountPanel === 'function') Auth.closeAccountPanel();
        else if (typeof Auth.closeSidebarAccountPanel === 'function') Auth.closeSidebarAccountPanel();
        if (typeof Auth.openChangePwdModal === 'function') {
          Auth.openChangePwdModal(false);
        } else {
          var box = document.getElementById('authChangePwd');
          var accPanel = document.getElementById('sidebarAccountPanel');
          var accBtn = document.getElementById('sidebarAccountBtn');
          if (accPanel) { accPanel.hidden = true; accPanel.setAttribute('hidden', ''); }
          if (accBtn) accBtn.setAttribute('aria-expanded', 'false');
          if (box) {
            box.hidden = false;
            box.removeAttribute('hidden');
            box.classList.add('is-open');
            box.setAttribute('data-forced', '0');
            var tip = document.getElementById('authChangePwdTip');
            if (tip) tip.textContent = '请设置新密码（至少 8 位，含字母与数字）。';
            var wrap = document.getElementById('authOldPwdWrap');
            if (wrap) wrap.style.display = '';
            ['authOldPwd', 'authNewPwd', 'authNewPwd2'].forEach(function (id) {
              var el = document.getElementById(id);
              if (el) el.value = '';
            });
          }
        }
      }
    });
  }

  if (typeof DeviceManager !== 'undefined') DeviceManager.init();

  calcStats();
  /* 启动恢复后如果有数据，盘点明细工具栏要可见 */
  if (items.length) {
    var itb = $('importToolbar'); if (itb) itb.style.display = 'flex';
    var dtb = $('detailToolbar'); if (dtb) dtb.style.display = 'flex';
    var eb = $('btnExport'); if (eb) eb.disabled = false;
  }

  /* 看板卡片点击跳转：用事件委托替代内联 onclick —— 内联属性需要暴露全局函数，
     委托则只需在容器上挂一个监听器，新增卡片无需改动 JS，也不会引入全局污染。 */
  var dash = $('page-dashboard');
  if (dash) dash.addEventListener('click', function (e) {
    var t = (e.target && e.target.closest) ? e.target.closest('[data-go]') : null;
    if (!t) return;
    var to = t.getAttribute('data-go');
    if (to === 'scan') window.goScanPage();
    else if (to === 'scan-data') window.goScanView('reports');
    else window.switchPage(to);
  });

  /* 全站原生 select → 气泡下拉（统一样式约定） */
  if (typeof upgradeAllSelects === 'function') {
    try { upgradeAllSelects(document); } catch (e) { console.warn('[bubble]', e); }
  }
})();




/* ===== 付费弹窗与账号菜单（订阅卡片 UI） ===== */
(function () {
  function $(id) { return document.getElementById(id); }
  var selectedPlan = 'month';
  var billingCycle = 'month';

  function showPayStep(step) {
    var plans = $('payStepPlans');
    var checkout = $('payStepCheckout');
    if (plans) {
      if (step === 'plans') { plans.hidden = false; plans.removeAttribute('hidden'); }
      else { plans.hidden = true; plans.setAttribute('hidden', ''); }
    }
    if (checkout) {
      if (step === 'checkout') { checkout.hidden = false; checkout.removeAttribute('hidden'); }
      else { checkout.hidden = true; checkout.setAttribute('hidden', ''); }
    }
  }

  function parsePayMethods() {
    var methods = ['wechat', 'alipay', 'other'];
    var labels = { wechat: '微信支付', alipay: '支付宝', other: '其他' };
    try {
      if (typeof _planSettingsCache !== 'undefined' && _planSettingsCache && _planSettingsCache.payMethods) {
        var raw = String(_planSettingsCache.payMethods);
        var parts = raw.split(/[,，\n]+/).map(function (s) { return s.trim(); }).filter(Boolean);
        if (parts.length) {
          return parts.map(function (name, i) {
            var key = 'other';
            if (/微信|wechat/i.test(name)) key = 'wechat';
            else if (/支付宝|alipay/i.test(name)) key = 'alipay';
            else key = 'other_' + i;
            return { key: key, name: name };
          });
        }
      }
    } catch (e) {}
    return [
      { key: 'wechat', name: '微信支付' },
      { key: 'alipay', name: '支付宝' },
      { key: 'other', name: '其他' }
    ];
  }

  function renderPayMethods() {
    var list = $('payMethodList');
    if (!list) return;
    var items = parsePayMethods();
    var icons = { wechat: '微', alipay: '支', other: '⋯' };
    var descs = {
      wechat: '推荐 · 扫码或打开微信完成支付',
      alipay: '扫码或打开支付宝完成支付',
      other: '对公转账或其他方式，按开通说明操作'
    };
    list.innerHTML = items.map(function (it, idx) {
      var k = it.key.indexOf('wechat') === 0 ? 'wechat' : (it.key.indexOf('alipay') === 0 ? 'alipay' : 'other');
      var ico = icons[k] || '⋯';
      var cls = k === 'wechat' ? 'pay-method-wechat' : (k === 'alipay' ? 'pay-method-alipay' : 'pay-method-other');
      var checked = idx === 0 ? ' checked' : '';
      var selected = idx === 0 ? ' is-selected' : '';
      return '<label class="pay-method-card' + selected + '">' +
        '<input type="radio" name="payMethod" value="' + String(it.name).replace(/"/g, '&quot;') + '"' + checked + ' />' +
        '<span class="pay-method-ico ' + cls + '" aria-hidden="true">' + ico + '</span>' +
        '<span class="pay-method-body">' +
          '<span class="pay-method-name">' + String(it.name).replace(/</g, '&lt;') + '</span>' +
          '<span class="pay-method-desc">' + (descs[k] || descs.other) + '</span>' +
        '</span></label>';
    }).join('');
    list.querySelectorAll('.pay-method-card').forEach(function (card) {
      card.addEventListener('click', function () {
        list.querySelectorAll('.pay-method-card').forEach(function (c) { c.classList.remove('is-selected'); });
        card.classList.add('is-selected');
        var inp = card.querySelector('input');
        if (inp) inp.checked = true;
      });
    });
  }

  function fillCheckoutSummary() {
    var card = document.querySelector('#payPlanGrid .pay-plan-card[data-plan="' + selectedPlan + '"]');
    if (!card) card = document.querySelector('#payPlanGrid .pay-plan-card.is-selected');
    if (!card) return;
    var name = (card.querySelector('.pay-plan-name') || {}).textContent || selectedPlan;
    var price = (card.querySelector('[data-price]') || {}).textContent || '';
    var unit = (card.querySelector('.pay-plan-unit') || {}).textContent || '';
    var note = (card.querySelector('.pay-plan-note') || {}).textContent || '';
    var set = function (id, v) { var el = $(id); if (el) el.textContent = v; };
    set('paySumPlanName', name);
    set('paySumPrice', price);
    set('paySumUnit', unit);
    set('paySumNote', note);
    set('paySumPlanLine', name);
    set('paySumCycle', billingCycle === 'year' ? '年度' : '每月');
    set('paySumTotal', '¥' + price);
    var channel = '';
    try {
      if (typeof _planSettingsCache !== 'undefined' && _planSettingsCache) {
        channel = _planSettingsCache.payChannel || '';
        if (_planSettingsCache.footerNote) set('paySumFoot', _planSettingsCache.footerNote);
      }
    } catch (e) {}
    var hint = $('payCheckoutHint');
    if (hint) hint.textContent = channel || '选择支付方式后，按提示完成付款；开通由管理员确认生效。';
  }

  function goCheckout(plan) {
    selectPlan(plan);
    renderPayMethods();
    fillCheckoutSummary();
    showPayStep('checkout');
  }

  window.openPayModal = function () {
    var m = $('payModal');
    if (m) { m.hidden = false; m.removeAttribute('hidden'); }
    showPayStep('plans');
    applyCycle();
  };
  window.closePayModal = function () {
    var m = $('payModal');
    if (m) { m.hidden = true; m.setAttribute('hidden', ''); }
    showPayStep('plans');
  };

  function applyCycle() {
    var grid = $('payPlanGrid');
    if (!grid) return;
    grid.querySelectorAll('.pay-plan-card').forEach(function (card) {
      var pm = card.getAttribute('data-price-m');
      var py = card.getAttribute('data-price-y');
      var priceEl = card.querySelector('[data-price]');
      var unit = card.querySelector('.pay-plan-unit');
      var note = card.querySelector('.pay-plan-note');
      var plan = card.getAttribute('data-plan');
      if (!priceEl) return;
      var useYear = billingCycle === 'year';
      var price = useYear ? (py != null && py !== '' ? py : pm) : pm;
      priceEl.textContent = price || priceEl.textContent;
      if (unit) {
        var um = card.getAttribute('data-unit-m');
        var uy = card.getAttribute('data-unit-y');
        if (useYear) {
          unit.textContent = uy || '/年';
        } else if (um) {
          unit.textContent = um;
        } else {
          unit.textContent = plan === 'week' ? '/周' : plan === 'quarter' ? '/季' : plan === 'year' ? '/年' : '/月';
        }
      }
      if (note) {
        var nm = note.getAttribute('data-note-m');
        var ny = note.getAttribute('data-note-y');
        if (useYear && ny) note.textContent = ny;
        else if (!useYear && nm) note.textContent = nm;
      }
    });
  }

  function selectPlan(plan) {
    selectedPlan = plan || 'month';
    var grid = $('payPlanGrid');
    if (!grid) return;
    grid.querySelectorAll('.pay-plan-card').forEach(function (c) {
      var on = c.getAttribute('data-plan') === selectedPlan;
      c.classList.toggle('is-selected', on);
      var cta = c.querySelector('.pay-plan-cta');
      if (cta) cta.classList.toggle('is-primary', on);
    });
  }

  function bindPay() {
    var toggle = $('payBillingToggle');
    if (toggle) {
      toggle.addEventListener('click', function (e) {
        var btn = e.target.closest('.pay-billing-btn');
        if (!btn) return;
        billingCycle = btn.getAttribute('data-cycle') || 'month';
        toggle.querySelectorAll('.pay-billing-btn').forEach(function (b) {
          b.classList.toggle('is-active', b === btn);
        });
        applyCycle();
      });
    }
    var grid = $('payPlanGrid');
    if (grid) {
      grid.addEventListener('click', function (e) {
        var card = e.target.closest('.pay-plan-card');
        if (!card) return;
        var plan = card.getAttribute('data-plan');
        selectPlan(plan);
        if (e.target.closest('[data-plan-cta]')) {
          goCheckout(plan);
        }
      });
    }
    ['payModalClose', 'payModalBackdrop'].forEach(function (id) {
      var el = $(id);
      if (el) el.addEventListener('click', window.closePayModal);
    });
    var back = $('payCheckoutBack');
    if (back) back.addEventListener('click', function () { showPayStep('plans'); });
    var submit = $('payCheckoutSubmit');
    if (submit) {
      submit.addEventListener('click', function () {
        var checked = document.querySelector('input[name="payMethod"]:checked');
        var method = checked ? checked.value : '微信支付';
        var nameEl = document.querySelector('#payPlanGrid .pay-plan-card.is-selected .pay-plan-name');
        var planName = nameEl ? nameEl.textContent : selectedPlan;
        var msg = '已选择「' + planName + '」· 支付方式：' + method + '。请按提示完成支付，开通由管理员确认。';
        if (typeof toast === 'function') toast(msg, 'success');
        else if (typeof showToast === 'function') showToast(msg, 'success');
        else alert(msg);
        window.closePayModal();
      });
    }
    var up = $('btnUpgradePlan');
    if (up) {
      up.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        window.openPayModal();
      });
    }
    document.querySelectorAll('[data-page-jump]').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        var page = btn.getAttribute('data-page-jump');
        /* 原实现靠点击隐藏的 .menu-item 触发跳转，但「帮助」等页面在侧栏没有对应菜单项，
           点击后无任何反应。这里直接调用 switchPage，不再依赖菜单节点。 */
        var item = document.querySelector('.menu-item[data-page="' + page + '"]');
        if (item && typeof item.click === 'function') item.click();
        if (typeof window.switchPage === 'function') window.switchPage(page);
        var panel = $('sidebarAccountPanel');
        var accBtn = $('sidebarAccountBtn');
        if (panel) panel.hidden = true;
        if (accBtn) accBtn.setAttribute('aria-expanded', 'false');
      });
    });
    selectPlan('month');
  }

  function refreshAccountSubHint() {
    var hint = $('accountSubHint');
    var email = $('accountEmail');
    try {
      var s = typeof getSession === 'function' ? getSession() : null;
      if (email && s) email.textContent = s.username || s.email || '—';
      if (!hint) return;
      if (!s) { hint.textContent = ''; return; }
      if (s.role === 'admin') hint.textContent = '管理员 · 不限期限';
      else if (!s.paid) hint.textContent = '未开通付费';
      else hint.textContent = s.validUntil ? ('有效期至 ' + String(s.validUntil).slice(0, 10)) : '已开通';
    } catch (e) {}
  }

  function boot() {
    bindPay();
    setTimeout(refreshAccountSubHint, 200);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { boot(); try { initAuthCrewEyes(); } catch (e0) {} });
  else boot();
  window.refreshAccountSubHint = refreshAccountSubHint;
})();


/* 登录页密码显示/隐藏（单图标切换） */
(function () {
  function bindPwdToggle() {
    var btn = document.getElementById('authPwdToggle');
    var input = document.getElementById('authPassword');
    if (!btn || !input || btn.__bound) return;
    btn.__bound = true;
    btn.addEventListener('click', function () {
      var show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      var eye = btn.querySelector('.ico-eye');
      if (eye) {
        eye.setAttribute('icon', show ? 'ant-design:eye-outlined' : 'ant-design:eye-invisible-outlined');
      }
      btn.setAttribute('title', show ? '隐藏密码' : '显示密码');
      btn.setAttribute('aria-label', show ? '隐藏密码' : '显示密码');
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bindPwdToggle);
  else bindPwdToggle();
})();


/* Hometown 三维地图：进入页面时初始化 */
(function () {
  var _sp = window.switchPage;
  if (typeof _sp !== 'function' || window.__hometownSwitchWrapped) return;
  window.__hometownSwitchWrapped = true;
  window.switchPage = function (name) {
    var r = _sp.apply(this, arguments);
    try {
      if (name === 'other-demo-1' && window.HometownMap && typeof window.HometownMap.mount === 'function') {
        setTimeout(function () { if (window.HometownMap.remount) window.HometownMap.remount(); else window.HometownMap.mount(); }, 40);
      } else if (window.HometownMap && typeof window.HometownMap.pause === 'function') {
        window.HometownMap.pause();
      }
    } catch (e) {}
    return r;
  };
})();

/* ===== 机台运营概况：上传调拨/库存变更 + 使用分析 ===== */
(function () {
  var DB_NAME = 'cmg_machine_ops_v1';
  var MAX_ROWS = 60000;
  var state = { transfer: [], change: [], ready: false };

  function $(id) { return document.getElementById(id); }
  function num(v) {
    var n = Number(String(v == null ? '' : v).replace(/,/g, ''));
    return isFinite(n) ? n : 0;
  }
  function money(n) { return '¥' + (Math.round(num(n) * 100) / 100).toLocaleString('zh-CN'); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&').replace(/</g, '<').replace(/>/g, '>');
  }
  function openDb() {
    return new Promise(function (resolve, reject) {
      var req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = function () {
        var db = req.result;
        if (!db.objectStoreNames.contains('rows')) db.createObjectStore('rows');
      };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error); };
    });
  }
  function idbGet(key) {
    return openDb().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction('rows', 'readonly');
        var rq = tx.objectStore('rows').get(key);
        rq.onsuccess = function () { resolve(rq.result || []); };
        rq.onerror = function () { reject(rq.error); };
      });
    });
  }
  function idbSet(key, value) {
    return openDb().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction('rows', 'readwrite');
        tx.objectStore('rows').put(value, key);
        tx.oncomplete = function () { resolve(); };
        tx.onerror = function () { reject(tx.error); };
      });
    });
  }
  function slimRows(kind, rows) {
    return (rows || []).map(function (r) {
      if (kind === 'transfer') {
        return {
          '单号': r['单号'] || '', '商品': r['商品'] || '', '数量': r['数量'] || 0, '金额': r['金额'] || 0,
          '转出仓库': r['转出仓库'] || '', '转入仓库': r['转入仓库'] || '', '账期': r['账期'] || '',
          '创建人': r['创建人'] || '', '创建时间': r['创建时间'] || ''
        };
      }
      return {
        '仓库': r['仓库'] || '', '商品名称': r['商品名称'] || '', '变更数量': r['变更数量'] || 0,
        '变更金额': r['变更金额'] || 0, '变更类型': r['变更类型'] || '', '摘要': r['摘要'] || '',
        '单号': r['单号'] || '', '变更时间': r['变更时间'] || '', '账期': r['账期'] || '', '操作人': r['操作人'] || ''
      };
    });
  }
  function saveOps(kind, rows) {
    var slim = slimRows(kind, rows);
    var local = idbSet(kind, slim).catch(function () { return null; });
    if (typeof CMGApi === 'undefined' || !CMGApi.putMachineOps || !CMGApi.getMode || CMGApi.getMode() !== 'http') {
      return local.then(function () { return { ok: true, local: true, count: slim.length }; });
    }
    var size = 500;
    var chain = Promise.resolve();
    for (var i = 0; i < slim.length || i === 0; i += size) {
      (function (start) {
        chain = chain.then(function () {
          return CMGApi.putMachineOps(kind, {
            rows: slim.slice(start, start + size),
            replace: start === 0
          });
        });
      })(i);
      if (!slim.length) break;
    }
    return chain.then(function () { return local; });
  }
  function loadOps(kind) {
    if (typeof CMGApi !== 'undefined' && CMGApi.getMachineOps && CMGApi.getMode && CMGApi.getMode() === 'http') {
      return CMGApi.getMachineOps(kind).then(function (res) {
        var rows = res && Array.isArray(res.rows) ? res.rows : [];
        if (rows.length) idbSet(kind, rows).catch(function () {});
        return rows;
      }).catch(function () { return idbGet(kind); });
    }
    return idbGet(kind);
  }
  function clearOps(kind) {
    var jobs = [idbSet(kind, [])];
    if (typeof CMGApi !== 'undefined' && CMGApi.getMode && CMGApi.getMode() === 'http') {
      if (CMGApi.clearMachineOps) jobs.push(CMGApi.clearMachineOps(kind));
      if (CMGApi.removeKv) jobs.push(CMGApi.removeKv('machine_ops_' + kind, 'global').catch(function () { return null; }));
    }
    return Promise.all(jobs);
  }
  function setProgress(show, pct, text) {
    var box = $('opsProgress'), fill = $('opsProgressFill'), label = $('opsProgressText');
    if (box) box.hidden = !show;
    if (fill) fill.style.width = (pct || 0) + '%';
    if (label && text) label.textContent = text;
  }
  function detectKind(headers) {
    var h = headers.join('|');
    if (/转出仓库/.test(h) && /转入仓库/.test(h)) return 'transfer';
    if (/变更类型/.test(h) || /变更数量/.test(h)) return 'change';
    return '';
  }
  function parseFile(file, expect) {
    return new Promise(function (resolve, reject) {
      if (typeof XLSX === 'undefined') { reject(new Error('Excel 解析库未加载')); return; }
      var reader = new FileReader();
      reader.onload = function () {
        try {
          setProgress(true, 20, '解析 ' + file.name);
          var wb = XLSX.read(reader.result, { type: 'array', cellDates: true });
          var sheet = wb.Sheets[wb.SheetNames[0]];
          var rows = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false });
          if (!rows.length) { reject(new Error('表是空的')); return; }
          var headers = Object.keys(rows[0]);
          var kind = detectKind(headers);
          if (expect && kind && kind !== expect) {
            reject(new Error(expect === 'transfer' ? '这不是调拨资料表' : '这不是库存变更表'));
            return;
          }
          if (!kind) { reject(new Error('无法识别表头，请上传调拨资料或库存变更查询')); return; }
          if (rows.length > MAX_ROWS) rows = rows.slice(0, MAX_ROWS);
          setProgress(true, 80, '写入 ' + rows.length + ' 条');
          resolve({ kind: kind, rows: rows, name: file.name });
        } catch (e) { reject(e); }
      };
      reader.onerror = function () { reject(reader.error); };
      reader.readAsArrayBuffer(file);
    });
  }
  function metaText() {
    return '调拨 ' + state.transfer.length + ' 条 · 库存变更 ' + state.change.length + ' 条';
  }
  function renderMeta() {
    var el = $('opsImportMeta');
    if (el) el.textContent = (state.transfer.length || state.change.length) ? metaText() : '尚未导入';
  }
  function renderPreview(kind) {
    var head = $('opsPreviewHead'), body = $('opsPreviewBody');
    if (!head || !body) return;
    var rows = kind === 'change' ? state.change : state.transfer;
    var cols = kind === 'change'
      ? ['仓库', '商品名称', '变更数量', '变更金额', '变更类型', '单号', '变更时间', '操作人']
      : ['单号', '商品', '数量', '金额', '转出仓库', '转入仓库', '创建人', '创建时间'];
    if (!rows.length) {
      head.innerHTML = '';
      body.innerHTML = '<tr><td class="empty-text">上传后在此预览前 20 条</td></tr>';
      return;
    }
    head.innerHTML = cols.map(function (c) { return '<th>' + c + '</th>'; }).join('');
    body.innerHTML = rows.slice(0, 20).map(function (r) {
      return '<tr>' + cols.map(function (c) { return '<td>' + esc(r[c]) + '</td>'; }).join('') + '</tr>';
    }).join('');
  }
  function machineType(name) {
    var n = String(name || '');
    if (/卡牌|战卡|光辉|共斗|变身|幻战|明耀|三国|卡片机/.test(n)) return '卡片机';
    if (/零食|大乱斗/.test(n)) return '零食机';
    if (/剪刀|勾勾|捞鱼|绘本|马戏团|玩法机/.test(n)) return '玩法机';
    if (/娃娃|爪|玲珑|方舟|飞跃|先行者|盒子/.test(n)) return '爪机';
    if (/礼享|无尽|元气|酷玩|无双|礼品机/.test(n)) return '礼品机';
    return '';
  }
  function radarHtml(types) {
    if (!types.length) return '<div class="empty-text">该时间段暂无数据</div>';
    var n = types.length;
    var cx = 220, cy = 168, R = 108;
    var maxAmt = Math.max.apply(null, types.map(function (t) { return t.amt; }).concat([1]));
    var maxN = Math.max.apply(null, types.map(function (t) { return t.n; }).concat([1]));
    var maxQty = Math.max.apply(null, types.map(function (t) { return t.qty; }).concat([1]));
    function pt(i, ratio) {
      var a = -Math.PI / 2 + (Math.PI * 2 * i / n);
      return [cx + R * ratio * Math.cos(a), cy + R * ratio * Math.sin(a)];
    }
    var grid = '';
    [0.25, 0.5, 0.75, 1].forEach(function (r) {
      var pts = [];
      for (var i = 0; i < n; i++) pts.push(pt(i, r).map(function (v) { return v.toFixed(1); }).join(','));
      grid += '<polygon points="' + pts.join(' ') + '" fill="none" stroke="#e5e5e5" stroke-width="1"/>';
    });
    for (var i = 0; i < n; i++) {
      var end = pt(i, 1);
      grid += '<line x1="' + cx + '" y1="' + cy + '" x2="' + end[0].toFixed(1) + '" y2="' + end[1].toFixed(1) + '" stroke="#e5e5e5"/>';
    }
    function poly(key, max, color) {
      var pts = types.map(function (t, i) {
        var ratio = Math.max(0.06, num(t[key]) / max);
        return pt(i, ratio).map(function (v) { return v.toFixed(1); }).join(',');
      }).join(' ');
      var dots = types.map(function (t, i) {
        var ratio = Math.max(0.06, num(t[key]) / max);
        var p = pt(i, ratio);
        return '<circle cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) + '" r="2.2" fill="' + color + '"/>';
      }).join('');
      return '<polygon points="' + pts + '" fill="' + color + '" fill-opacity="0.08" stroke="' + color + '" stroke-width="1.1"/>' + dots;
    }
    var labels = types.map(function (t, i) {
      var p = pt(i, 1.28);
      var left = p[0] < cx;
      var x = (left ? p[0] - 78 : p[0] + 10).toFixed(1);
      return '<text x="' + x + '" y="' + (p[1] - 16).toFixed(1) + '" text-anchor="start" font-size="12" fill="#171717">' + esc(t.name) + '</text>' +
        '<text x="' + x + '" y="' + p[1].toFixed(1) + '" text-anchor="start" font-size="11" fill="#f97316">' + money(t.amt) + '</text>' +
        '<text x="' + x + '" y="' + (p[1] + 14).toFixed(1) + '" text-anchor="start" font-size="11" fill="#3b82f6">' + t.n + ' 次</text>' +
        '<text x="' + x + '" y="' + (p[1] + 28).toFixed(1) + '" text-anchor="start" font-size="11" fill="#10b981">' + t.qty + ' 件</text>';
    }).join('');
    var hits = types.map(function (t, i) {
      var p = pt(i, 1);
      return '<circle class="ops-radar-hit" cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) + '" r="28" fill="transparent" data-radar="' +
        esc(t.name) + '|' + money(t.amt) + '|' + t.n + ' 次|' + t.qty + ' 件"></circle>';
    }).join('');
    var svg = '<svg viewBox="0 0 440 360" class="ops-radar-svg" role="img">' + grid +
      poly('amt', maxAmt, '#f97316') + poly('n', maxN, '#3b82f6') + poly('qty', maxQty, '#10b981') + labels + hits + '</svg>';
    var legend = '<div class="ops-radar-legend">' +
      '<span><i style="background:#f97316"></i>调入金额</span>' +
      '<span><i style="background:#3b82f6"></i>次数</span>' +
      '<span><i style="background:#10b981"></i>数量</span></div>';
    return '<div class="ops-radar-body">' + svg + '<div class="ops-radar-tip" hidden></div>' + legend + '</div>';
  }
  function isMachine(name) {
    return /爪机|礼品机|零食机|卡片机|玩法机|卡牌|战卡|剪刀|勾勾|捞鱼|马戏团|娃娃盒子|玲珑|方舟|飞跃|礼享|无尽/.test(String(name || ''));
  }
  function rankHtml(list, labelKey, valueKey, fmt) {
    if (!list.length) return '<div class="empty-text">该时间段暂无数据</div>';
    var max = Math.max.apply(null, list.map(function (r) { return num(r[valueKey]); }).concat([1]));
    return list.map(function (r) {
      var pct = Math.max(4, Math.round(num(r[valueKey]) / max * 100));
      return '<div class="ops-rank-row"><span>' + esc(r[labelKey]) + '</span><strong>' + fmt(r[valueKey]) + '</strong><div class="ops-bar"><span style="width:' + pct + '%"></span></div></div>';
    }).join('');
  }
  var OPS_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4', '#84cc16', '#f97316'];
  function donutHtml(list, labelKey, valueKey, fmt) {
    if (!list.length) return '<div class="empty-text">该时间段暂无数据</div>';
    var total = list.reduce(function (s, r) { return s + num(r[valueKey]); }, 0);
    if (total <= 0) return '<div class="empty-text">暂无数据，请先上传</div>';
    var shown = list.slice(0, 6);
    if (list.length > 6) {
      var rest = list.slice(6).reduce(function (s, r) { return s + num(r[valueKey]); }, 0);
      var other = {};
      other[labelKey] = '其他';
      other[valueKey] = rest;
      shown.push(other);
    }
    var size = 168, R = 78, hole = 50, cx = 84, cy = 84;
    var a = -Math.PI / 2;
    var paths = '';
    function pt(rad, ang) {
      return (cx + rad * Math.cos(ang)).toFixed(2) + ' ' + (cy + rad * Math.sin(ang)).toFixed(2);
    }
    shown.forEach(function (r, i) {
      var v = Math.max(0, num(r[valueKey]));
      if (v <= 0) return;
      var frac = v / total;
      var a2 = a + frac * Math.PI * 2;
      var large = frac > 0.5 ? 1 : 0;
      var color = OPS_COLORS[i % OPS_COLORS.length];
      if (frac >= 0.999) {
        paths += '<circle cx="' + cx + '" cy="' + cy + '" r="' + ((R + hole) / 2) + '" fill="none" stroke="' + color + '" stroke-width="' + (R - hole) + '"></circle>';
      } else {
        paths += '<path d="M' + pt(R, a) + ' A' + R + ' ' + R + ' 0 ' + large + ' 1 ' + pt(R, a2) +
          ' L' + pt(hole, a2) + ' A' + hole + ' ' + hole + ' 0 ' + large + ' 0 ' + pt(hole, a) + ' Z" fill="' + color + '" stroke="#fff" stroke-width="1.5"></path>';
      }
      a = a2;
    });
    var svg = '<svg viewBox="0 0 ' + size + ' ' + size + '" class="ops-donut-svg" role="img">' + paths +
      '<text x="' + cx + '" y="' + (cy - 2) + '" text-anchor="middle" font-size="11" fill="#737373">合计</text>' +
      '<text x="' + cx + '" y="' + (cy + 16) + '" text-anchor="middle" font-size="12" font-weight="600" fill="#171717">' + esc(fmt(total)) + '</text></svg>';
    var legend = shown.map(function (r, i) {
      var pct = Math.round(num(r[valueKey]) / total * 100);
      return '<div class="ops-legend-item"><i style="background:' + OPS_COLORS[i % OPS_COLORS.length] + '"></i>' +
        '<span class="ops-legend-name">' + esc(r[labelKey]) + '</span>' +
        '<span class="ops-legend-val">' + fmt(r[valueKey]) + '</span>' +
        '<span class="ops-legend-pct">' + pct + '%</span></div>';
    }).join('');
    return '<div class="ops-donut"><div class="ops-donut-plot">' + svg + '</div><div class="ops-donut-legend">' + legend + '</div></div>';
  }
  var detailPage = 1;
  var DETAIL_SIZE = 20;
  function rowDate(r) {
    return String(r['账期'] || r['创建时间'] || r['变更时间'] || '').slice(0, 10);
  }
  function buildDetails() {
    var seen = {};
    var list = [];
    state.transfer.forEach(function (r) {
      if (String(r['单号']) === '合计') return;
      var machine = String(r['转入仓库'] || '').trim();
      if (!machine || !isMachine(machine)) return;
      var no = String(r['单号'] || '');
      if (no) seen[no] = true;
      list.push({
        date: rowDate(r),
        product: String(r['商品'] || '').trim(),
        machine: machine,
        source: String(r['转出仓库'] || '').trim(),
        user: String(r['创建人'] || '').trim(),
        qty: num(r['数量']),
        amt: num(r['金额'])
      });
    });
    state.change.forEach(function (r) {
      if (String(r['仓库']) === '合计') return;
      var type = String(r['变更类型'] || '');
      var machine = String(r['仓库'] || '').trim();
      if (type.indexOf('调拨转入') < 0 || !isMachine(machine)) return;
      var no = String(r['单号'] || '');
      if (no && seen[no]) return;
      var source = '';
      var m = String(r['摘要'] || '').match(/从\[([^\]]+)\]/);
      if (m) source = m[1];
      list.push({
        date: rowDate(r),
        product: String(r['商品名称'] || '').trim(),
        machine: machine,
        source: source,
        user: String(r['操作人'] || '').trim(),
        qty: Math.abs(num(r['变更数量'])),
        amt: Math.abs(num(r['变更金额']))
      });
    });
    return list;
  }
  function currentFilter() {
    return {
      from: ($('opsFilterStart') && $('opsFilterStart').value) || '',
      to: ($('opsFilterEnd') && $('opsFilterEnd').value) || '',
      product: ($('opsFilterProduct') && $('opsFilterProduct').value.trim()) || '',
      user: ($('opsFilterUser') && $('opsFilterUser').value) || '',
      machine: ($('opsFilterMachine') && $('opsFilterMachine').value) || ''
    };
  }
  function matchFilter(r, f) {
    if (f.from && r.date && r.date < f.from) return false;
    if (f.to && r.date && r.date > f.to) return false;
    if (f.product && String(r.product || '').indexOf(f.product) < 0) return false;
    if (f.user && r.user !== f.user) return false;
    if (f.machine && r.machine !== f.machine) return false;
    return true;
  }
  function fillFilterOptions(list) {
    function fill(id, values) {
      var el = $(id);
      if (!el) return;
      var cur = el.value;
      el.innerHTML = '<option value="">全部</option>' + values.map(function (v) {
        return '<option value="' + esc(v) + '">' + esc(v) + '</option>';
      }).join('');
      if (cur) el.value = cur;
    }
    var users = {}, machines = {};
    list.forEach(function (r) {
      if (r.user) users[r.user] = 1;
      if (r.machine) machines[r.machine] = 1;
    });
    fill('opsFilterUser', Object.keys(users).sort());
    fill('opsFilterMachine', Object.keys(machines).sort());
  }
  var periodState = { user: 'all', day: 'all', radar: 'all' };
  function inPeriod(dateStr, range) {
    if (range === 'all' || !range) return true;
    if (!dateStr) return false;
    var d = new Date(dateStr.replace(/-/g, '/'));
    if (isNaN(d.getTime())) return false;
    var now = new Date();
    now.setHours(0, 0, 0, 0);
    d.setHours(0, 0, 0, 0);
    var diff = Math.round((now - d) / 86400000);
    if (range === 'today') return diff === 0;
    if (range === 'yesterday') return diff === 1;
    if (range === 'week') {
      var day = now.getDay() || 7;
      var start = new Date(now);
      start.setDate(now.getDate() - day + 1);
      return d >= start && d <= now;
    }
    if (range === 'twoWeek') {
      var day2 = now.getDay() || 7;
      var thisStart = new Date(now);
      thisStart.setDate(now.getDate() - day2 + 1);
      var lastStart = new Date(thisStart);
      lastStart.setDate(thisStart.getDate() - 7);
      var lastEnd = new Date(thisStart);
      lastEnd.setDate(thisStart.getDate() - 1);
      return d >= lastStart && d <= lastEnd;
    }
    return true;
  }
  var detailPager = null;
  function renderDetail(list) {
    detailList = list || [];
    var qty = 0, amt = 0;
    detailList.forEach(function (r) { qty += r.qty; amt += r.amt; });
    if ($('opsSumQty')) $('opsSumQty').textContent = qty.toLocaleString('zh-CN');
    if ($('opsSumAmt')) $('opsSumAmt').textContent = money(amt);
    var meta = $('opsDetailMeta');
    if (meta) meta.textContent = '共 ' + detailList.length + ' 条';
    var mount = $('opsDetailPager');
    if (mount && typeof window.createPager === 'function') {
      if (!detailPager) {
        detailPager = window.createPager(mount, {
          pageSize: 20,
          getData: function () { return detailList; },
          onPage: function (rows) {
            var body = $('opsDetailBody');
            if (!body) return;
            body.innerHTML = rows.length
              ? rows.map(function (r) {
                  return '<tr><td>' + esc(r.date) + '</td><td>' + esc(r.product) + '</td><td>' + esc(r.machine) +
                    '</td><td>' + esc(r.source) + '</td><td>' + esc(r.user) + '</td><td>' + r.qty + '</td><td>' + money(r.amt) + '</td></tr>';
                }).join('')
              : '<tr><td colspan="7" class="empty-text">没有符合筛选的商品明细</td></tr>';
          }
        });
      } else {
        detailPager.reset();
      }
    }
  }
  function renderAnalysis() {
    var allDetails = buildDetails();
    fillFilterOptions(allDetails);
    var f = currentFilter();
    var details = allDetails.filter(function (r) { return matchFilter(r, f); });
    var kpis = $('opsKpis');
    var tAmt = 0, tQty = 0;
    details.forEach(function (r) { tAmt += r.amt; tQty += r.qty; });
    var changeHit = state.change.filter(function (r) {
      if (String(r['仓库']) === '合计') return false;
      return matchFilter({
        date: rowDate(r),
        product: String(r['商品名称'] || ''),
        user: String(r['操作人'] || ''),
        machine: String(r['仓库'] || '')
      }, f);
    });
    if (kpis) {
      kpis.innerHTML =
        '<div class="ops-kpi"><span>调入机台</span><strong>' + details.length + '</strong></div>' +
        '<div class="ops-kpi"><span>调入金额</span><strong>' + money(tAmt) + '</strong></div>' +
        '<div class="ops-kpi"><span>调入数量</span><strong>' + tQty.toLocaleString('zh-CN') + '</strong></div>' +
        '<div class="ops-kpi"><span>变更记录</span><strong>' + changeHit.length + '</strong></div>';
    }
    var inMap = {};
    details.forEach(function (r) {
      if (!inMap[r.machine]) inMap[r.machine] = { name: r.machine, amt: 0 };
      inMap[r.machine].amt += r.amt;
    });
    var inList = Object.keys(inMap).map(function (k) { return inMap[k]; })
      .sort(function (a, b) { return b.amt - a.amt; }).slice(0, 8);
    var inEl = $('opsInRank');
    if (inEl) inEl.innerHTML = rankHtml(inList, 'name', 'amt', money);
    var typeMap = {};
    changeHit.forEach(function (r) {
      var tp = String(r['变更类型'] || '未分类').trim() || '未分类';
      if (!typeMap[tp]) typeMap[tp] = { name: tp, n: 0 };
      typeMap[tp].n += 1;
    });
    var typeList = Object.keys(typeMap).map(function (k) { return typeMap[k]; })
      .sort(function (a, b) { return b.n - a.n; }).slice(0, 8);
    var typeEl = $('opsTypeRank');
    if (typeEl) typeEl.innerHTML = rankHtml(typeList, 'name', 'n', function (n) { return n + ' 条'; });
    var userMap = {};
    details.filter(function (r) { return inPeriod(r.date, periodState.user); }).forEach(function (r) {
      if (!r.user) return;
      userMap[r.user] = (userMap[r.user] || 0) + 1;
    });
    var userList = Object.keys(userMap).map(function (k) { return { name: k, n: userMap[k] }; })
      .sort(function (a, b) { return b.n - a.n; }).slice(0, 8);
    var userEl = $('opsUserRank');
    if (userEl) userEl.innerHTML = donutHtml(userList, 'name', 'n', function (n) { return n + ' 次'; });
    var dayMap = {};
    details.filter(function (r) { return inPeriod(r.date, periodState.day); }).forEach(function (r) {
      if (!r.date) return;
      dayMap[r.date] = (dayMap[r.date] || 0) + r.amt;
    });
    var dayList = Object.keys(dayMap).sort().slice(-10).map(function (d) { return { name: d, amt: dayMap[d] }; });
    var dayEl = $('opsDayTrend');
    if (dayEl) dayEl.innerHTML = donutHtml(dayList, 'name', 'amt', money);
    renderDetail(details);
    var typeBuckets = {};
    details.filter(function (r) { return inPeriod(r.date, periodState.radar); }).forEach(function (r) {
      var tp = machineType(r.machine);
      if (!tp) return;
      if (!typeBuckets[tp]) typeBuckets[tp] = { name: tp, amt: 0, n: 0, qty: 0 };
      typeBuckets[tp].amt += r.amt;
      typeBuckets[tp].n += 1;
      typeBuckets[tp].qty += r.qty;
    });
    var radarTypes = ['零食机', '爪机', '卡片机', '玩法机', '礼品机']
      .map(function (name) { return typeBuckets[name]; })
      .filter(function (t) { return t && (t.amt || t.n || t.qty); });
    var radarEl = $('opsTypeRadar');
    if (radarEl) radarEl.innerHTML = radarHtml(radarTypes);
  }
  function ingest(file, expect) {
    setProgress(true, 5, '读取文件');
    parseFile(file, expect).then(function (res) {
      state[res.kind] = res.rows;
      return saveOps(res.kind, res.rows).then(function () { return res; });
    }).then(function (res) {
      setProgress(true, 100, '完成 ' + res.rows.length + ' 条');
      renderMeta();
      renderPreview(res.kind);
      renderAnalysis();
      if (typeof toast === 'function') toast('已导入 ' + res.rows.length + ' 条' + (res.rows.length >= MAX_ROWS ? '（已截断至 60000）' : ''), 'success');
      setTimeout(function () { setProgress(false); }, 800);
    }).catch(function (err) {
      setProgress(false);
      if (typeof toast === 'function') toast((err && err.message) || '导入失败', 'error');
    });
  }
  function bindDrop(areaId, inputId, expect) {
    var area = $(areaId), input = $(inputId);
    if (!area || !input || area.__opsBound) return;
    area.__opsBound = true;
    area.addEventListener('click', function () { input.click(); });
    area.addEventListener('dragover', function (e) { e.preventDefault(); });
    area.addEventListener('drop', function (e) {
      e.preventDefault();
      if (e.dataTransfer && e.dataTransfer.files[0]) ingest(e.dataTransfer.files[0], expect);
    });
    input.addEventListener('change', function () {
      if (input.files && input.files[0]) ingest(input.files[0], expect);
      input.value = '';
    });
  }
  function bind() {
    if (!$('page-machine-ops') || $('page-machine-ops').__opsBound) return;
    $('page-machine-ops').__opsBound = true;
    var nav = $('opsNav');
    if (nav) {
      nav.addEventListener('click', function (e) {
        var btn = e.target.closest && e.target.closest('[data-ops-view]');
        if (!btn) return;
        var view = btn.getAttribute('data-ops-view');
        nav.querySelectorAll('.sub-tab').forEach(function (el) {
          var on = el === btn;
          el.classList.toggle('active', on);
          el.setAttribute('aria-selected', on ? 'true' : 'false');
        });
        document.querySelectorAll('#page-machine-ops [data-ops-panel]').forEach(function (p) {
          p.classList.toggle('active', p.getAttribute('data-ops-panel') === view);
        });
        if (view === 'analysis') renderAnalysis();
      });
    }
    document.querySelectorAll('#page-machine-ops .ops-period').forEach(function (bar) {
      bar.addEventListener('click', function (e) {
        var btn = e.target.closest && e.target.closest('[data-range]');
        if (!btn) return;
        var key = bar.getAttribute('data-ops-period');
        periodState[key] = btn.getAttribute('data-range');
        bar.querySelectorAll('button').forEach(function (el) { el.classList.toggle('is-active', el === btn); });
        renderAnalysis();
      });
    });
    var radarBox = $('opsTypeRadar');
    if (radarBox && !radarBox.__tipBound) {
      radarBox.__tipBound = true;
      radarBox.addEventListener('mousemove', function (e) {
        var hit = e.target.closest && e.target.closest('.ops-radar-hit');
        var tip = radarBox.querySelector('.ops-radar-tip');
        if (!hit || !tip) { if (tip) tip.hidden = true; return; }
        var parts = String(hit.getAttribute('data-radar') || '').split('|');
        tip.innerHTML = '<strong>' + parts[0] + '</strong><span>金额 ' + parts[1] + '</span><span>次数 ' + parts[2] + '</span><span>数量 ' + parts[3] + '</span>';
        tip.hidden = false;
        var box = radarBox.getBoundingClientRect();
        tip.style.left = (e.clientX - box.left + 12) + 'px';
        tip.style.top = (e.clientY - box.top + 12) + 'px';
      });
      radarBox.addEventListener('mouseleave', function () {
        var tip = radarBox.querySelector('.ops-radar-tip');
        if (tip) tip.hidden = true;
      });
    }
    bindDrop('opsTransferArea', 'opsTransferFile', 'transfer');
    bindDrop('opsChangeArea', 'opsChangeFile', 'change');
    ['opsFilterProduct', 'opsFilterUser', 'opsFilterMachine'].forEach(function (id) {
      var el = $(id);
      if (!el) return;
      el.addEventListener('change', function () { detailPage = 1; renderAnalysis(); });
      el.addEventListener('input', function () { detailPage = 1; renderAnalysis(); });
    });
    if (typeof window.bindSharedDatePicker === 'function') {
      window.bindSharedDatePicker({
        rootId: 'opsDatePicker', triggerId: 'opsPeriodTrigger', panelId: 'opsPeriodPanel',
        startId: 'opsFilterStart', endId: 'opsFilterEnd', displayId: 'opsPeriodDisplay',
        presetsId: 'opsPeriodPresets', calDaysL: 'opsCalDaysL', calDaysR: 'opsCalDaysR',
        calTitleL: 'opsCalTitleL', calTitleR: 'opsCalTitleR',
        single: false, stateKey: '__opsDp', placeholder: '请选择日期范围',
        onChange: function () { detailPage = 1; renderAnalysis(); }
      });
    }
    var dpClear = $('opsDpClear');
    if (dpClear) dpClear.addEventListener('click', function () {
      detailPage = 1;
      setTimeout(renderAnalysis, 0);
    });
    if (search) search.addEventListener('click', function () { detailPage = 1; renderAnalysis(); });
    var reset = $('opsFilterReset');
    if (reset) reset.addEventListener('click', function () {
      ['opsFilterProduct', 'opsFilterUser', 'opsFilterMachine', 'opsFilterStart', 'opsFilterEnd'].forEach(function (id) {
        if ($(id)) $(id).value = '';
      });
      var display = $('opsPeriodDisplay');
      if (display) { display.textContent = '请选择日期范围'; display.classList.add('is-placeholder'); }
      if (window.__opsDp) { window.__opsDp.pickStart = null; window.__opsDp.pickEnd = null; }
      detailPage = 1;
      renderAnalysis();
    });
    var ct = $('opsBtnClearTransfer'), cc = $('opsBtnClearChange');
    function bindClear(btn, kind, label) {
      if (!btn || btn.__opsClearBound) return;
      btn.__opsClearBound = true;
      btn.addEventListener('click', function () {
        showConfirm({
          title: '清空' + label,
          message: '将硬删除全部' + label + '数据，数据库和本地缓存都会清除，且不可恢复。',
          confirmText: '确认清空',
          cancelText: '取消',
          danger: true,
          onConfirm: function () {
            state[kind] = [];
            clearOps(kind).then(function () {
              renderMeta();
              renderPreview(kind);
              renderAnalysis();
              toast(label + '已清空', 'success');
            }).catch(function () {
              toast(label + '清空失败，请检查服务端', 'error');
            });
          }
        });
      });
    }
    bindClear(ct, 'transfer', '调拨');
    bindClear(cc, 'change', '库存变更');
    Promise.all([loadOps('transfer'), loadOps('change')]).then(function (pair) {
      state.transfer = pair[0] || [];
      state.change = pair[1] || [];
      state.ready = true;
      renderMeta();
      renderPreview(state.transfer.length ? 'transfer' : 'change');
      renderAnalysis();
    }).catch(function () { state.ready = true; });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind);
  else bind();
})();
