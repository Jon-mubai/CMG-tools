/**
 * Author: zcl (MuBai)
 * Date: 2026-10-14
 * Role: Full-Stack Developer
 */
/* js/core/boot-bind.js — 主 IIFE 尾部：事件绑定与启动 */
  /* 首次加载：无 hash / 登录态由 Auth 决定；未登录统一 #/login */
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

  
  var btnChangePwd = $('btnChangePwd');
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
