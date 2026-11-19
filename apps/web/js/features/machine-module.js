/**
 * Author: zcl (MuBai)
 * Date: 2026-10-14
 * Role: Full-Stack Developer
 */
/* js/features/machine-module.js — 机台数据：对接「经营报表 / 返奖概率 / 运营参数」 */
(function () {
  'use strict';
  var STORAGE_KEY = 'machine_profit_source_v2';
  var COIN_VALUE_DEFAULT = 0.33;
  /* rows: 合并后的运营行 */
  var rows = [];
  var META_TYPES = ['爪机', '零食爪机', '礼品机', '玩法机']; /* 毛利合并不含卡牌机，对齐运营参数 */
  var weekPager = null, monthPager = null, importPager = null;

  function $(id) { return document.getElementById(id); }
  function load() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      var data = raw ? JSON.parse(raw) : null;
      if (Array.isArray(data)) rows = data;
      else if (data && Array.isArray(data.rows)) rows = data.rows;
      else rows = [];
    } catch (e) { rows = []; }
  }
  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
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
    /* 已绑定且触发器仍有监听则跳过；否则允许重新绑定（修复抽屉内无响应） */
    if (window[key] && window[key].bound && rootCheck && rootCheck.getAttribute('data-dp-bound') === '1') {
      var tr = el(cfg.triggerId);
      if (tr && tr.__dpClick) return;
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

    function updateDisplay() {
      if (!display) return;
      if (!startEl || !startEl.value) {
        display.textContent = '请选择账期';
        display.classList.add('is-placeholder');
        return;
      }
      var s = parseD(startEl.value), e = parseD(endEl && endEl.value);
      display.textContent = fmtCN(s) + '  →  ' + fmtCN(e || s);
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
      else if (pkey === 'last7') { start = new Date(now); start.setDate(now.getDate()-6); end = now; }
      else if (pkey === 'last30') { start = new Date(now); start.setDate(now.getDate()-29); end = now; }
      else if (pkey === 'thisMonth') { start = new Date(now.getFullYear(), now.getMonth(), 1); end = now; }
      else if (pkey === 'lastMonth') {
        start = new Date(now.getFullYear(), now.getMonth()-1, 1);
        end = new Date(now.getFullYear(), now.getMonth(), 0);
      } else if (pkey === 'thisYear') { start = new Date(now.getFullYear(), 0, 1); end = now; }
      else if (pkey === 'lastYear') {
        start = new Date(now.getFullYear()-1, 0, 1);
        end = new Date(now.getFullYear()-1, 11, 31);
      }
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
        html += '<button type="button" class="' + cls + '" data-date="' + fmt(d) + '">' + day + '</button>';
      }
      box.innerHTML = html;
    }
    function paint() {
      var st = window[key];
      if (!st) return;
      var y = st.view.getFullYear(), m = st.view.getMonth();
      var r2 = new Date(y, m + 1, 1);
      paintOne(cfg.calDaysL, cfg.calTitleL, y, m, st.pickStart, st.pickEnd);
      paintOne(cfg.calDaysR, cfg.calTitleR, r2.getFullYear(), r2.getMonth(), st.pickStart, st.pickEnd);
    }
    function placePanelFixed() {
      if (!panel || !trigger) return;
      var inDrawer = !!(root.closest && root.closest('.drawer-panel, .drawer-overlay, .admin-drawer'));
      if (!inDrawer) {
        panel.style.position = '';
        panel.style.top = '';
        panel.style.left = '';
        panel.style.right = '';
        panel.style.width = '';
        panel.style.maxWidth = '';
        panel.style.zIndex = '';
        return;
      }
      /* 抽屉 overflow:auto 会裁切 absolute 面板 → 改为 fixed 贴触发器展开 */
      var rect = trigger.getBoundingClientRect();
      var vw = window.innerWidth || document.documentElement.clientWidth;
      var vh = window.innerHeight || document.documentElement.clientHeight;
      var panelW = Math.min(560, Math.max(300, vw - 24));
      var left = rect.left;
      if (left + panelW > vw - 12) left = Math.max(12, vw - panelW - 12);
      if (left < 12) left = 12;
      var top = rect.bottom + 6;
      panel.style.position = 'fixed';
      panel.style.zIndex = '6000';
      panel.style.width = panelW + 'px';
      panel.style.maxWidth = 'calc(100vw - 24px)';
      panel.style.left = left + 'px';
      panel.style.right = 'auto';
      /* 先显示再量高度，避免底部被裁 */
      panel.style.top = top + 'px';
      panel.style.visibility = 'hidden';
      panel.hidden = false;
      var ph = panel.offsetHeight || 320;
      if (top + ph > vh - 12) {
        var above = rect.top - 6 - ph;
        if (above >= 12) panel.style.top = above + 'px';
        else panel.style.top = Math.max(12, vh - ph - 12) + 'px';
      }
      panel.style.visibility = '';
    }
    function open() {
      root.classList.add('open');
      panel.hidden = false;
      if (trigger) trigger.setAttribute('aria-expanded', 'true');
      paint();
      placePanelFixed();
      requestAnimationFrame(function () { placePanelFixed(); });
    }
    function close() {
      root.classList.remove('open');
      panel.hidden = true;
      if (trigger) trigger.setAttribute('aria-expanded', 'false');
      if (panel) {
        panel.style.position = '';
        panel.style.top = '';
        panel.style.left = '';
        panel.style.right = '';
        panel.style.width = '';
        panel.style.maxWidth = '';
        panel.style.zIndex = '';
        panel.style.visibility = '';
      }
    }
    var now = sod(new Date());
    window[key] = {
      bound: true,
      view: new Date(now.getFullYear(), now.getMonth(), 1),
      pickStart: null,
      pickEnd: null,
      picking: false
    };
    if (root) root.setAttribute('data-dp-bound', '1');
    if (trigger && !trigger.__dpClick) {
      trigger.__dpClick = true;
      trigger.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        if (root.classList.contains('open')) close(); else open();
      });
    }
    panel.addEventListener('click', function (e) {
      e.stopPropagation();
      var nav = e.target.closest && e.target.closest('.mp-dp-nav');
      if (nav) {
        var act = nav.getAttribute('data-nav');
        var v = window[key].view;
        if (act === 'prev-month') window[key].view = new Date(v.getFullYear(), v.getMonth() - 1, 1);
        if (act === 'next-month') window[key].view = new Date(v.getFullYear(), v.getMonth() + 1, 1);
        if (act === 'prev-year') window[key].view = new Date(v.getFullYear() - 1, v.getMonth(), 1);
        if (act === 'next-year') window[key].view = new Date(v.getFullYear() + 1, v.getMonth(), 1);
        paint();
        return;
      }
      var dayBtn = e.target.closest && e.target.closest('.mp-dp-day');
      if (dayBtn && dayBtn.getAttribute('data-date')) {
        var d = sod(parseD(dayBtn.getAttribute('data-date')));
        if (!window[key].picking || !window[key].pickStart) {
          window[key].pickStart = d;
          window[key].pickEnd = d;
          window[key].picking = true;
          paint();
        } else {
          var a = window[key].pickStart, b = d;
          if (b < a) { var t0 = a; a = b; b = t0; }
          setRange(a, b, null);
          window[key].picking = false;
          close();
        }
      }
    });
    var presets = el(cfg.presetsId);
    if (presets) {
      presets.addEventListener('click', function (e) {
        var b = e.target.closest && e.target.closest('.mp-preset');
        if (!b) return;
        applyPreset(b.getAttribute('data-preset'));
        close();
      });
    }
    document.addEventListener('click', function (e) {
      if (!root.classList.contains('open')) return;
      if (root.contains(e.target)) return;
      close();
    });
    if (!startEl.value && cfg.defaultPreset) applyPreset(cfg.defaultPreset);
    else updateDisplay();
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
    /* 最终毛利表：项目 + 投币数 + 出礼品价值/成本比例 */
    if (/投币数/.test(h) && /出礼品价值|成本比例/.test(h) && !/总入币|项目编号/.test(h)) {
      return 'profit';
    }
    if (/毛利/.test(fn) && /投币数/.test(h)) return 'profit';
    if (/返奖|礼品概率|按端口汇总记录/.test(fn) || (/出礼品价值/.test(h) && /端口/.test(h) && /入币/.test(h) && !/投币数/.test(h))) return 'reward';
    if (/经营报表|p位汇总/.test(fn) || (/总入币|净入币/.test(h) && /端口/.test(h))) return 'ops_report';
    if (/运营参数/.test(fn) || (/运营参数|机台类型/.test(h) && !/投币|入币/.test(h))) return 'ops';
    if (/出礼品|返奖/.test(h)) return 'reward';
    if (/投币/.test(h)) return 'ops_report';
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
      : ['投币数', '净入币', '总入币', '入币', '投币', '投币次数', 'coins']);
    var iGifts = find(headers, exact ? ['出礼品数'] : ['出礼品数', '出礼品', '礼品数', '返奖数', 'gifts']);
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
    var FILL_ORANGE = themeFill(9, 0.6);  /* 项目名分组 */
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

      if (name !== prevName) {
        alt = !alt;
        prevName = name;
      }
      if (alt) {
        ws.getCell('A' + rowNum).fill = FILL_ORANGE;
      }
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
      apply('H' + r, FILL_GRAY, '0.00%', fontData);       /* 成本比例 必须有填充 */
      /* 保留项目名橙色分组 */
      if (list[r - 2]) {
        /* already set orange above for alt names */
      }
    }

    /* 橙色项目名再刷一次，避免被 apply(A) 清掉 */
    prevName = '';
    alt = false;
    list.forEach(function (r, i) {
      var name = r.name || r.code || '';
      if (name !== prevName) {
        alt = !alt;
        prevName = name;
      }
      if (alt) {
        ws.getCell('A' + (i + 2)).fill = FILL_ORANGE;
      }
    });

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

  function handleFiles(fileList) {
    var files = Array.prototype.slice.call(fileList || []).filter(function (f) {
      return f && /\.(xlsx|xls|csv)$/i.test(f.name || '');
    });
    if (!files.length) {
      if (typeof toast === 'function') toast('请选择 .xlsx / .xls / .csv 文件', 'warning');
      return;
    }
    if (typeof toast === 'function') toast('正在解析 ' + files.length + ' 个文件…', 'info');
    Promise.all(files.map(function (f) { return readSheetAoa(f); }))
      .then(function (sheets) {
        var parts = [];
        var unknown = [];
        sheets.forEach(function (s) {
          if (!s.aoa || s.aoa.length < 2) {
            unknown.push(s.name + '（空表）');
            return;
          }
          var headers = s.aoa[0] || [];
          var kind = detectSheetKind(headers, s.name);
          if (kind === 'unknown') {
            /* 尝试按经营报表兜底 */
            kind = 'ops_report';
          }
          var mapped = mapRowsFromAoa(s.aoa, kind);
          if (!mapped.length) {
            unknown.push(s.name + '（未识别到有效行）');
            return;
          }
          parts.push({ kind: kind, name: s.name, rows: mapped });
        });
        if (!parts.length) {
          if (typeof toast === 'function') toast('未能解析出有效数据，请检查表头是否含「项目编号 / 端口 / 投币数」等列', 'error');
          return;
        }
        var merged = mergeImported(parts);
        if (!merged.length) {
          if (typeof toast === 'function') toast('合并后无有效机台行（可能全部为卡牌机或缺少编号）', 'warning');
          return;
        }
        rows = merged;
        save();
        updateImportMeta();
        renderTable('mpWeekBody', 'mpWeekHint', 'week');
        renderTable('mpMonthBody', 'mpMonthHint', 'month');
        var msg = '已导入 ' + merged.length + ' 条（' + parts.length + ' 个文件）';
        if (unknown.length) msg += '；跳过：' + unknown.join('、');
        if (typeof toast === 'function') toast(msg, 'success');
      })
      .catch(function (err) {
        if (typeof toast === 'function') toast((err && err.message) || '导入失败', 'error');
      });
  }

  function bindUpload() {
    var area = $('mpUploadArea');
    var input = $('mpExcelFile');
    bindDatePicker();
    if ($('mpPeriodStart') && !$('mpPeriodStart').value) applyPreset('last7');
    else updatePeriodDisplay();
    if (!area || !input || area.__bound) return;
    area.__bound = true;
    area.addEventListener('click', function () { input.click(); });
    input.addEventListener('change', function (e) {
      if (e.target.files && e.target.files.length) handleFiles(e.target.files);
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
      if (e.dataTransfer.files && e.dataTransfer.files.length) handleFiles(e.dataTransfer.files);
    });
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
