/**
 * Author: zcl (MuBai)
 * Date: 2026-10-14
 * Role: Full-Stack Developer
 */
/* js/core/router.js */
/* ===== 页面切换（基于 hash 路由，路径唯一） ===== */
  function _applyPage(name) {
    /* login 仅为门禁路由，不对应业务 page-section */
    if (name === 'login') return;
    /* 业务页必须绑定有效会话：路径可相同，凭证不可跨会话复用 */
    if (typeof Auth !== 'undefined' && typeof Auth.requireAuth === 'function' && !Auth.requireAuth()) {
      try { history.replaceState(null, '', '#/login'); } catch (e0) {}
      document.documentElement.classList.add('auth-need-login');
      document.documentElement.classList.remove('auth-has-session');
      var gateEl = document.getElementById('authGate');
      if (gateEl) gateEl.hidden = false;
      if (typeof toast === 'function') toast('请先登录后再访问业务页面', 'warning');
      return;
    }
    if (typeof Auth !== 'undefined' && typeof Auth.hasFeature === 'function' && name !== 'help' && !Auth.hasFeature(name)) {
      if (typeof toast === 'function') toast('当前账号无权限访问该功能（401）', 'warning');
      name = 'dashboard';
      try { history.replaceState(null, '', '#/dashboard'); } catch (e1) {}
    }
    if (!PAGE_INFO[name]) name = 'dashboard';
    var prevName = currentPageName;   /* 记录切页前的页面，供「是否离开园区」判断 */
    currentPageName = name;
    document.querySelectorAll('.page-section').forEach(function (s) {
      s.classList.toggle('active', s.id === 'page-' + name);
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
    else if (name === 'wh-docs') {
      if (typeof DocsModule !== 'undefined' && DocsModule.render) {
        try { DocsModule.render(); } catch (e) { console.warn('[docs]', e); }
      }
    } else if (name === 'machine-category') {
      if (typeof CategoryModule !== 'undefined' && CategoryModule.render) {
        try { CategoryModule.render(typeof currentCategoryView !== 'undefined' ? currentCategoryView : 'import'); } catch (e) { console.warn('[category]', e); }
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

  window.switchPage = function (name) {
    if (!PAGE_INFO[name]) return;
    /* 带子页的页面保证路径唯一、可直达与前进后退 */
    var target;
    if (name === 'scan-data') target = '/scan-data/' + currentScanView;
    else if (name === 'scan') target = '/scan/' + currentWorkView;
    else if (name === 'machine-profit') target = '/machine-profit/' + currentMachineProfitView;
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
    /* 安全：路径复制/直达不得绕过登录与功能权限 */
    if (typeof Auth !== 'undefined') {
      if (typeof Auth.requireAuth === 'function' && !Auth.requireAuth()) {
        try { history.replaceState(null, '', '#/login'); } catch (eAuth) {}
        if (typeof Auth.logout === 'function') {
          /* 不调 logout 以免循环；仅确保门禁 */
        }
        document.documentElement.classList.add('auth-need-login');
        document.documentElement.classList.remove('auth-has-session');
        var gate = document.getElementById('authGate');
        if (gate) gate.hidden = false;
        return;
      }
      var nameCheck = (typeof PAGE_PATHS !== 'undefined' && PAGE_PATHS[path]) ? PAGE_PATHS[path] : 'dashboard';
      if (typeof Auth.hasFeature === 'function' && nameCheck !== 'help' && !Auth.hasFeature(nameCheck)) {
        if (typeof toast === 'function') toast('当前账号无权限访问该功能', 'warning');
        try { history.replaceState(null, '', '#/dashboard'); } catch (eFeat) {}
        _applyPage('dashboard');
        closeSidebar();
        return;
      }
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
      var d = $('scanInputDesktop');
      if (d && window.innerWidth >= 768) {
        try { d.focus({ preventScroll: true }); } catch (err) { d.focus(); }
      }
    }, delay || 100);
  }
  window.goScanPage = function () { window.goWork('entry'); };

  document.querySelectorAll('.menu-item').forEach(function (item) {
    item.addEventListener('click', function () {
      switchPage(item.getAttribute('data-page'));
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

  /* 菜单组标题：展开态折叠分组；收起态点击一级图标进入该组第一个页面 */
  document.querySelectorAll('.menu-group-head').forEach(function (head) {
    head.addEventListener('click', function () {
      var group = head.parentElement;
      if (!group || !group.classList.contains('menu-group')) return;
      var sidebar = document.getElementById('sidebar');
      if (sidebar && sidebar.classList.contains('collapsed')) {
        var first = group.querySelector('.menu-item[data-page]');
        if (first) switchPage(first.getAttribute('data-page'));
        return;
      }
      var collapsed = group.classList.toggle('collapsed');
      head.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
    });
  });
