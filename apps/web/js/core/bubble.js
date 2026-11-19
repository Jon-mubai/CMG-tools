/**
 * Author: zcl (MuBai)
 * Date: 2026-10-14
 * Role: Full-Stack Developer
 */
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
      if (isInfo) return;
      var rect = trigger.getBoundingClientRect();
      var below = window.innerHeight - rect.bottom;
      menu.classList.toggle('up', below < 200 && rect.top > below);
    }
    function open() {
      if (api) {
        _openBubbles.forEach(function (b) { if (b !== api) b.close(); });
        _openBubbles = [api];
      }
      mount.classList.add('open');
      trigger.setAttribute('aria-expanded', 'true');
      place();
    }
    function close() {
      mount.classList.remove('open');
      trigger.setAttribute('aria-expanded', 'false');
    }
    function isOpen() { return mount.classList.contains('open'); }

    trigger.addEventListener('click', function (e) {
      e.stopPropagation();
      if (isOpen()) { close(); return; }
      render();
      open();
    });
    menu.addEventListener('click', function (e) {
      var it = (e.target && e.target.closest) ? e.target.closest('.bubble-item') : null;
      if (!it) return;
      value = it.getAttribute('data-value');
      close();
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
    _openBubbles.forEach(function (b) { b.close(); });
    _openBubbles = [];
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

  /* 说明类提示已统一改为 tooltip 组件（纯 CSS 悬停/聚焦显示），
     此处无需 JS 初始化；保留此处作为后续新增 tooltip 的挂载点。 */

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
          '<button type="button" class="btn btn-outline btn-sm pg-prev"><iconify-icon icon="ant-design:arrow-left-outlined" width="14" height="14"></iconify-icon>上一页</button>' +
          '<span class="pg-num" style="font-weight:700;color:var(--text);min-width:50px;text-align:center;font-variant-numeric:tabular-nums;">1</span>' +
          '<button type="button" class="btn btn-outline btn-sm pg-next">下一页<iconify-icon icon="ant-design:arrow-right-outlined" width="14" height="14"></iconify-icon></button>' +
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
