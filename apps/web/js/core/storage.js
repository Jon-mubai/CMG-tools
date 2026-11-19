/**
 * Author: zcl (MuBai)
 * Date: 2026-10-14
 * Role: Full-Stack Developer
 */
/* js/core/storage.js */
/* ===== 持久化存储（localStorage）===== */
  var _SK = (typeof CMGShared !== 'undefined' && CMGShared.STORAGE_KEYS) ? CMGShared.STORAGE_KEYS : null;
  var STORAGE_KEY = (_SK && _SK.INVENTORY) ? _SK.INVENTORY : 'inventory_check_v1';
  var STORAGE_VERSION = (typeof CMGShared !== 'undefined' && CMGShared.STORAGE_VERSION) ? CMGShared.STORAGE_VERSION : 1;
  function saveItems() {
    /* 建议1：经 CMGInventory 门面，Http 模式自动 bulk 同步 */
    if (typeof CMGInventory !== 'undefined' && CMGInventory.save) {
      CMGInventory.save(items);
      return;
    }
    try {
      var payload = { v: STORAGE_VERSION, items: items, t: Date.now() };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch (err) {
      console.warn('保存失败：', err);
    }
  }
  function loadItems() {
    if (typeof CMGInventory !== 'undefined' && CMGInventory.readLocal) {
      return CMGInventory.readLocal();
    }
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      var data = JSON.parse(raw);
      if (!data || data.v !== STORAGE_VERSION || !Array.isArray(data.items)) return [];
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
  /* 启动恢复（rebuildLookup 在文件下方定义，函数声明已提升） */
  (function () {
    var restored = loadItems();
    if (restored.length) {
      items = restored;
      rebuildLookup();
    }
    savedSnapshots = loadSnapshots();
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
