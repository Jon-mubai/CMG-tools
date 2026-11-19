/**
 * Author: zcl (MuBai)
 * Date: 2026-10-14
 * Role: Full-Stack Developer
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
      var raw = localStorage.getItem(KEY) || localStorage.getItem(LEGACY_KEY);
      var arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch (e) {
      return [];
    }
  }

  function writeLocal(list) {
    try {
      localStorage.setItem(KEY, JSON.stringify(list || []));
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
