/**
 * Author: zcl (MuBai)
 * Date: 2026-10-14
 * Role: Full-Stack Developer
 */
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
      if (it.code) lookup.set(it.code, i);
      if (it.barcode && it.barcode !== it.code) lookup.set(it.barcode, i);
    }
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

    /* 顶栏「总商品」徽标已移除（库存总数仅属于盘点模块） */
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
          paths += '<circle cx="' + cx + '" cy="' + cy + '" r="' + midR + '" fill="none" stroke="' + color + '" stroke-width="' + w + '"><title>' + label + '</title></circle>';
        } else {
          paths += '<circle cx="' + cx + '" cy="' + cy + '" r="' + (R - 1) + '" fill="' + color + '"><title>' + label + '</title></circle>';
        }
      } else if (hole > 0) {
        paths += '<path d="M' + pt(R, a) + ' A' + R + ' ' + R + ' 0 ' + large + ' 1 ' + pt(R, a2) +
          ' L' + pt(hole, a2) + ' A' + hole + ' ' + hole + ' 0 ' + large + ' 0 ' + pt(hole, a) + ' Z' +
          '" fill="' + color + '" stroke="#fff" stroke-width="1.5"><title>' + label + '</title></path>';
      } else {
        paths += '<path d="M' + cx + ' ' + cy + ' L' + pt(R, a) + ' A' + R + ' ' + R + ' 0 ' + large + ' 1 ' + pt(R, a2) +
          ' Z" fill="' + color + '" stroke="#fff" stroke-width="1.5"><title>' + label + '</title></path>';
      }
      a = a2;
    });
    return '<svg viewBox="0 0 ' + size + ' ' + size + '" role="img" style="width:100%;height:100%">' + paths + '</svg>';
  }


  /* 折线图：数组拼接 + 点位抽样，减少字符串与 DOM 节点 */
  function drawLineChart(points, w, h) {
    w = w || 640; h = h || 220;
    var pad = { t: 20, r: 16, b: 36, l: 44 };
    var iw = w - pad.l - pad.r, ih = h - pad.t - pad.b;
    var pts = points || [];
    if (!pts.length) {
      return '<svg viewBox="0 0 ' + w + ' ' + h + '" class="dash-line-svg" preserveAspectRatio="none" role="img">' +
        '<text x="' + pad.l + '" y="' + (h / 2) + '" text-anchor="start" fill="#94a3b8" font-size="13">暂无消耗数据</text></svg>';
    }
    var max = 0, i, n = pts.length;
    for (i = 0; i < n; i++) if (pts[i].qty > max) max = pts[i].qty;
    if (max <= 0) max = 1;
    max = max * 1.08;
    function xAt(idx) { return pad.l + (n === 1 ? 0 : (idx / (n - 1)) * iw); }
    function yAt(v) { return pad.t + ih - (Math.max(0, v) / max) * ih; }

    var parts = [];
    parts.push('<svg viewBox="0 0 ', w, ' ', h, '" class="dash-line-svg" preserveAspectRatio="none" role="img">');
    parts.push('<defs><linearGradient id="dashLineGrad" x1="0" y1="0" x2="0" y2="1">');
    parts.push('<stop offset="0%" stop-color="#3b82f6" stop-opacity="0.28"/>');
    parts.push('<stop offset="100%" stop-color="#3b82f6" stop-opacity="0.02"/>');
    parts.push('</linearGradient></defs>');

    var ticks = 4, ti, gy, gv;
    for (ti = 0; ti <= ticks; ti++) {
      gy = pad.t + (ih * ti / ticks);
      gv = Math.round(max * (1 - ti / ticks));
      parts.push('<line x1="', pad.l, '" y1="', gy.toFixed(1), '" x2="', (pad.l + iw), '" y2="', gy.toFixed(1),
        '" stroke="#e2e8f0" stroke-width="1" stroke-dasharray="4 4"/>');
      parts.push('<text x="', (pad.l - 8), '" y="', (gy + 3.5).toFixed(1),
        '" text-anchor="end" font-size="11" fill="#94a3b8">', gv, '</text>');
    }

    var labelStep = n > 16 ? Math.ceil(n / 8) : (n > 10 ? 2 : 1);
    var dotStep = n > 20 ? Math.ceil(n / 12) : 1;
    var lineCmds = [];
    var x0 = xAt(0), y0 = yAt(pts[0].qty);
    for (i = 0; i < n; i++) {
      var x = xAt(i), y = yAt(pts[i].qty);
      lineCmds.push((i ? 'L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1));
    }
    var lineD = lineCmds.join('');
    var xn = xAt(n - 1);
    parts.push('<path d="', lineD, ' L', xn.toFixed(1), ' ', (pad.t + ih), ' L', x0.toFixed(1), ' ', (pad.t + ih), ' Z" fill="url(#dashLineGrad)"/>');
    parts.push('<path d="', lineD, '" fill="none" stroke="#3b82f6" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>');

    for (i = 0; i < n; i++) {
      var showDot = (i % dotStep === 0) || i === n - 1;
      var showLab = (i % labelStep === 0) || i === n - 1;
      if (showLab && i === n - 1 && n > 3) {
        var prev = Math.floor((n - 2) / labelStep) * labelStep;
        if ((n - 1) - prev < Math.max(1, (labelStep >> 1))) showLab = false;
      }
      x = xAt(i); y = yAt(pts[i].qty);
      if (showDot) {
        parts.push('<circle cx="', x.toFixed(1), '" cy="', y.toFixed(1),
          '" r="4" fill="#3b82f6" stroke="#fff" stroke-width="1.5"/>');
      }
      if (showLab) {
        parts.push('<text x="', x.toFixed(1), '" y="', (h - 10),
          '" text-anchor="middle" font-size="10" fill="#64748b">', String(pts[i].label || ''), '</text>');
      }
    }
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
  function renderDashConsumeTrend(range) {
    range = range || window.__dashConsumeRange || 'thisWeek';
    window.__dashConsumeRange = range;
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
      /* 不跳过重绘，确保切换范围后点位数量与坐标轴一定更新 */
      lineEl.removeAttribute('data-sig');
      lineEl.innerHTML = drawLineChart(trend, cw, ch);
    }
    putLocal('dashConsumeSum', sum);
    putLocal('dashConsumeAvg', trend.length ? Math.round(sum / trend.length) : 0);
    var sumLab = $('dashConsumeSumLabel');
    if (sumLab) sumLab.textContent = DASH_RANGE_SUM_LABEL[range] || '合计';
    /* 标题旁时间说明已去掉，范围由右侧 Tab 与汇总卡片表达 */
    var peakEl = $('dashConsumePeak');
    if (peakEl) peakEl.textContent = peak && peak.qty > 0 ? (peak.label + ' · ' + peak.qty + ' 件') : '—';
    var tabs = $('dashConsumeRange');
    if (tabs) {
      tabs.querySelectorAll('.dash-range-tab').forEach(function (btn) {
        var on = btn.getAttribute('data-range') === range;
        btn.classList.toggle('active', on);
        btn.setAttribute('aria-selected', on ? 'true' : 'false');
      });
    }
  }

  /* 时间范围切换：事件委托，避免 put 作用域/重复绑定问题 */
  document.addEventListener('click', function (e) {
    var btn = e.target && e.target.closest ? e.target.closest('#dashConsumeRange .dash-range-tab') : null;
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();
    var range = btn.getAttribute('data-range') || 'thisWeek';
    renderDashConsumeTrend(range);
  });

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
        var skipEmpty = 0;
        var skipDup = 0;

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
          if (codeSet[code]) {
            skipDup++;
            continue;
          }
          codeSet[code] = 1;

          var name = colName >= 0 ? String(row[colName] != null ? row[colName] : '').trim() : '';
          var barcode = colBar >= 0 ? String(row[colBar] != null ? row[colBar] : '').trim() : '';
          if (/e\+/i.test(barcode)) {
            try {
              var bn = Number(barcode);
              if (isFinite(bn) && bn > 1e10) barcode = bn.toFixed(0);
            } catch (ex) {}
          }
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

  function handleScan(raw) {
    var code = String(raw || '').trim();
    if (!code) return;
    /* 扫码成功输入，标记USB扫码设备（键盘模式）为活跃状态 */
    if (typeof DeviceManager !== 'undefined') DeviceManager.markKbActive();

    if (items.length === 0) {
      toast('请先导入 Excel', 'warning');
      return;
    }

    /* === 等待补条形码分支 === */
    if (_pendingBarcode) {
      var pendingIdx = lookup.get(_pendingBarcode.id);
      if (pendingIdx !== undefined) {
        var pi = items[pendingIdx];
        /* 校验：不能把条形码写成与商品编号相同的字符串（除非用户故意） */
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

    var isNew = false;
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
        hint.textContent = '「' + item.name + '」（编号 ' + item.code + '）尚无条形码 → 请扫描条形码以补录';
        hint.classList.add('show');
      }
      var pi = $('scanInputDesktop'); if (pi) pi.placeholder = '请扫描条形码，将自动写入「' + item.name + '」';
      var mi = $('scanInputMobile'); if (mi) mi.placeholder = '请扫描条形码，将自动写入「' + item.name + '」';
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
    showModal('确定删除「' + item.name + '」（编号：' + item.code + '）？', 'confirm', function (ok) {
      if (!ok) return;
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
    });
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

    if (items.length === 0) {
      toast('请先导入 Excel', 'warning');
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
