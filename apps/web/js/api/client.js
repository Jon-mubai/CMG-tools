/**
 * Author: zcl (MuBai)
 * Date: 2026-10-14
 * Role: Full-Stack Developer
 */
(function () {
  'use strict';

  var MODE_KEY = (typeof CMGShared !== 'undefined' && CMGShared.STORAGE_KEYS && CMGShared.STORAGE_KEYS.API_MODE)
    ? CMGShared.STORAGE_KEYS.API_MODE
    : 'cmg_api_mode';
  var TOKEN_KEY = 'cmg_api_token';
  var DEFAULT_BASE = '/api/v1';

  function getMode() {
    /* 统一服务端模式：业务与登录均走 API → PostgreSQL */
    try { localStorage.setItem(MODE_KEY, 'http'); } catch (e0) {}
    return 'http';
  }
  function setMode(mode) {
    try { localStorage.setItem(MODE_KEY, 'http'); } catch (e) {}
  }
  function getBase() {
    if (typeof window !== 'undefined' && window.CMG_API_BASE) return window.CMG_API_BASE;
    if (typeof CMGShared !== 'undefined' && CMGShared.API_PREFIX) return CMGShared.API_PREFIX;
    return DEFAULT_BASE;
  }
  function getToken() {
    try { return sessionStorage.getItem(TOKEN_KEY) || ''; } catch (e) { return ''; }
  }
  function setToken(t) {
    try {
      if (t) sessionStorage.setItem(TOKEN_KEY, t);
      else sessionStorage.removeItem(TOKEN_KEY);
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
      if (token && String(token).split('.').length === 3) {
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
      return this.request('PUT', '/data/kv/' + encodeURIComponent(key), {
        payload: payload,
        scope: scope || 'global'
      });
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
    }
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
    getKv: function (key, scope) {
      return getMode() === 'http' ? HttpAdapter.getKv(key, scope) : Promise.resolve({ payload: null });
    },
    putKv: function (key, payload, scope) {
      return getMode() === 'http' ? HttpAdapter.putKv(key, payload, scope) : Promise.resolve({ payload: payload });
    },
    removeKv: function (key, scope) {
      return getMode() === 'http' ? HttpAdapter.removeKv(key, scope) : Promise.resolve({ ok: true });
    },
    adapter: adapter
  };
})();
