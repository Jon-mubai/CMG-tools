/**
 * Author: zcl (MuBai)
 * Date: 2026-10-14
 * Role: Full-Stack Developer
 */
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
      var raw = localStorage.getItem(STORAGE_KEY);
      var data = raw ? JSON.parse(raw) : null;
      rows = data && Array.isArray(data.rows) ? data.rows : (Array.isArray(data) ? data : []);
    } catch (e) { rows = []; }
  }
  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, updatedAt: Date.now(), rows: rows }));
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
      placeholder: '请选择',
      value: catVal,
      options: [{ value: '', label: '全部分类' }].concat(catKeys.map(function (k) { return { value: k, label: k }; })),
      onChange: function (v) { catVal = v; renderAnalysis(); }
    });
    supSelect = createSelectSearch($('catFilterSupBubble'), {
      placeholder: '请选择',
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
        '<input type="text" class="select-search-input" placeholder="" autocomplete="off" />' +
        '<iconify-icon class="select-search-ico" icon="ant-design:search-outlined" width="14" height="14"></iconify-icon>' +
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

  function renderAnalysis() {
    var body = $('catAnalysisBody');
    var hint = $('catAnalysisHint');
    var list = filteredRows();
    if (hint) hint.textContent = rows.length ? ('共 ' + rows.length + ' 条 · 筛选 ' + list.length + ' 条') : '请先导入零售商品数据';
    fillFilters();
    if (!list.length) {
      if (body) body.innerHTML = '<tr><td colspan="6" class="empty-cell">暂无数据</td></tr>';
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
    var btnCat = $('btnCatSearch');
    if (btnCat && !btnCat.__bound) {
      btnCat.__bound = true;
      btnCat.addEventListener('click', function (e) {
        e.preventDefault();
        searchKw = search ? (search.value || '').trim().toLowerCase() : '';
        renderAnalysis();
      });
    }
    if (search && !search.__bound) {
      search.__bound = true;
      search.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
          e.preventDefault();
          searchKw = (search.value || '').trim().toLowerCase();
          renderAnalysis();
        }
      });
    }
  }

  function render(view) {
    load();
    bind();
    updateImportMeta();
    if (view === 'analysis' || !view) renderAnalysis();
  }

  window.CategoryModule = { render: render, getRows: function () { return rows.slice(); } };
})();
