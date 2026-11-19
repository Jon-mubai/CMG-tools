/**
 * Author: zcl (MuBai)
 * Date: 2026-10-14
 * Role: Full-Stack Developer
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
      var raw = localStorage.getItem(KEY);
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
      localStorage.setItem(KEY, JSON.stringify({ v: VER, items: items || [], t: Date.now() }));
      return true;
    } catch (e) {
      console.warn('[CMGInventory] 本地保存失败', e);
      return false;
    }
  }

  function save(items) {
    items = normalizeList(items);
    if (forceApiWrite()) {
      return CMGApi.bulkInventory(items).then(function (res) {
        writeLocal(items);
        return { ok: true, count: (res && res.count) || items.length, server: true };
      }).catch(function (err) {
        var msg = (err && err.message) || '保存失败';
        if (typeof window.toast === 'function') window.toast('同步失败：' + msg, 'error');
        return { ok: false, error: msg, server: false };
      });
    }
    writeLocal(items);
    return Promise.resolve({ ok: true, local: true, count: items.length });
  }

  function load() {
    if (isHttp()) {
      return CMGApi.listInventory({ page: 1, pageSize: 200 }).then(function (page) {
        var items = normalizeList((page && page.items) || []);
        writeLocal(items);
        return items;
      }).catch(function () {
        return readLocal();
      });
    }
    return Promise.resolve(readLocal());
  }

  function clear() {
    try { localStorage.removeItem(KEY); } catch (e) {}
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
