/**
 * Author: zcl (MuBai)
 * Date: 2026-10-14
 * Role: Full-Stack Developer
 */
/* js/features/compare.js */
/* ===== 对账对比（盘点前账面 vs 盘点后实盘） ===== */
  var compareState = { rows: [], filter: 'all', pager: null, source: null };
  var compareBubble = null;

  /* 刷新对账数据源下拉（已保存报告 + 当前未保存数据） */
  function refreshCompareSelect() {
    var sel = $('compareSelect');
    if (!sel) return;
    var opts = [];
    if (items.length) {
      opts.push({ value: '__current__', label: '当前盘点数据（未保存 · ' + items.length + ' 件）' });
    }
    for (var i = 0; i < savedSnapshots.length; i++) {
      var s = savedSnapshots[i];
      opts.push({ value: s.id, label: s.name + '（' + s.savedAt + '）' });
    }
    var runBtn = $('btnCompareRun');
    if (!opts.length) {
      opts = [{ value: '', label: '— 暂无可用数据 —' }];
      if (runBtn) runBtn.disabled = true;
    } else if (runBtn) {
      runBtn.disabled = false;
    }
    if (!compareBubble) {
      compareBubble = createBubble(sel, { value: '', options: opts });
    } else {
      compareBubble.setOptions(opts);
    }
  }

  /* 按商品编号合并账面与报告，生成对账行 */
  function buildCompareRows(reportItems, reportName) {
    var orig = loadOriginalSnapshot() || [];
    var bookMap = {};
    var i, it;
    for (i = 0; i < orig.length; i++) {
      if (orig[i] && orig[i].code != null) bookMap[String(orig[i].code)] = { item: orig[i], used: false };
    }
    var useEmbeddedBook = orig.length === 0; /* 账面缺失时退回报告自带的账面数 */
    var rows = [];
    for (i = 0; i < reportItems.length; i++) {
      it = reportItems[i];
      var o = it && it.code != null ? bookMap[String(it.code)] : null;
      var actual = it && it.actualQty != null ? it.actualQty : 0;
      if (o) {
        o.used = true;
        var book = o.item.systemQty != null ? o.item.systemQty : 0;
        var diff = actual - book;
        rows.push({
          code: it.code,
          barcode: it.barcode || o.item.barcode || '',
          name: it.name || o.item.name || '',
          category: it.category || o.item.category || '',
          book: book, actual: actual, diff: diff,
          status: diff > 0 ? 'surplus' : (diff < 0 ? 'deficit' : 'balanced')
        });
      } else {
        var eb = useEmbeddedBook && it && it.systemQty != null ? it.systemQty : null;
        rows.push({
          code: it ? it.code : '',
          barcode: it && it.barcode ? it.barcode : '',
          name: it && it.name ? it.name : '',
          category: it && it.category ? it.category : '',
          book: eb, actual: actual,
          diff: eb != null ? actual - eb : null,
          status: 'no-book'
        });
      }
    }
    for (var key in bookMap) {
      if (!bookMap.hasOwnProperty(key)) continue;
      if (!bookMap[key].used) {
        var ob = bookMap[key].item;
        rows.push({
          code: ob.code,
          barcode: ob.barcode || '',
          name: ob.name || '',
          category: ob.category || '',
          book: ob.systemQty != null ? ob.systemQty : 0,
          actual: null, diff: null,
          status: 'no-count'
        });
      }
    }
    return rows;
  }

  /* 对账行 → 展示状态标签 */
  function compareStatusHtml(row) {
    if (row.status === 'balanced') return '<span class="tag tag-ok">对平</span>';
    if (row.status === 'surplus')   return '<span class="tag tag-up">盘盈 +' + row.diff + '</span>';
    if (row.status === 'deficit')   return '<span class="tag tag-down">盘亏 ' + row.diff + '</span>';
    if (row.status === 'no-count')  return '<span class="tag tag-mute">未盘点</span>';
    return '<span class="tag tag-mute">账面缺失</span>';
  }
  function compareStatusLabel(row) {
    if (row.status === 'balanced') return '对平';
    if (row.status === 'surplus') return '盘盈';
    if (row.status === 'deficit') return '盘亏';
    if (row.status === 'no-count') return '未盘点';
    return '账面缺失';
  }

  /* 执行对账 */
  function runCompare(sourceId) {
    var sid = sourceId != null ? sourceId : (compareBubble ? compareBubble.getValue() : '');
    var result = $('compareResult');
    if (!result) return;
    var reportItems = null, sourceName = '';
    if (sid === '__current__') {
      if (!items.length) { toast('当前无盘点数据', 'warning'); return; }
      reportItems = items;
      sourceName = '当前盘点数据（未保存）';
    } else if (sid) {
      var s = savedSnapshots.find(function (x) { return x.id === sid; });
      if (!s) { toast('报告不存在或已被删除', 'error'); return; }
      reportItems = s.items;
      sourceName = s.name + '（' + s.savedAt + '）';
    } else {
      toast('请先选择要对比的盘点数据', 'warning');
      return;
    }
    if (compareBubble && sid) compareBubble.setValue(sid);
    compareState.rows = buildCompareRows(reportItems, sourceName);
    compareState.source = sourceName;
    compareState.filter = 'all';
    var fbs = $('compareFilters');
    if (fbs) {
      fbs.querySelectorAll('button').forEach(function (b) {
        b.classList.toggle('active', b.getAttribute('data-cfilter') === 'all');
      });
    }
    renderCompareStats();
    result.style.display = '';
    var cmpEmpty = $('compareEmpty');
    if (cmpEmpty) cmpEmpty.style.display = 'none';
    var exBtn = $('btnExportCompare');
    if (exBtn) exBtn.style.display = '';
    if (!compareState.pager) {
      var mount = $('comparePager');
      if (mount) {
        compareState.pager = createPager(mount, {
          pageSize: 20,
          getData: function () { return filteredCompareRows(); },
          onPage: function (rows, page, size, total) {
            renderCompareRows(rows, total);
          }
        });
      }
    }
    if (compareState.pager) compareState.pager.reset();
    else renderCompareRows(filteredCompareRows(), filteredCompareRows().length);
    /* 对账结果为独立子页：若不在该子页则切换过去（结果已就绪，无需滚动定位） */
    if (currentPageName !== 'scan-data' || currentScanView !== 'compare') {
      location.hash = '#/scan-data/compare';
    }
  }

  /* 账面比对结果搜索：在筛选结果之上叠加关键词过滤 */
  var compareKeyword = '';
  function filteredCompareRows() {
    var f = compareState.filter;
    var base;
    if (f === 'all') base = compareState.rows;
    else {
      base = compareState.rows.filter(function (r) {
        if (f === 'diff') return r.status === 'surplus' || r.status === 'deficit' || r.status === 'no-book';
        return r.status === f;
      });
    }
    var kw = compareKeyword.trim().toLowerCase();
    if (!kw) return base;
    return base.filter(function (r) {
      return (r.code && r.code.toLowerCase().indexOf(kw) !== -1) ||
             (r.barcode && r.barcode.toLowerCase().indexOf(kw) !== -1) ||
             (r.name && r.name.toLowerCase().indexOf(kw) !== -1);
    });
  }

  function renderCompareStats() {
    var box = $('compareStats');
    if (!box) return;
    var rows = compareState.rows || [];
    var bookSum = 0, actualSum = 0, diffSum = 0;
    var bal = 0, sur = 0, def = 0, nc = 0, nb = 0, matched = 0;
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      if (r.status === 'balanced') bal++;
      else if (r.status === 'surplus') sur++;
      else if (r.status === 'deficit') def++;
      else if (r.status === 'no-count') nc++;
      else nb++;
      if (r.book != null) bookSum += r.book;
      if (r.actual != null) actualSum += r.actual;
      if (r.status === 'balanced' || r.status === 'surplus' || r.status === 'deficit') {
        matched++;
        diffSum += r.diff;
      }
    }
    var accuracy = matched > 0 ? Math.round(bal / matched * 1000) / 10 : 0;
    var diffStr = (diffSum > 0 ? '+' : '') + diffSum;
    box.innerHTML =
      '<div class="cstat"><div class="cs-label">对比对象</div><div class="cs-value is-text" title="' + escapeAttr(compareState.source || '') + '">' + escapeHtml(compareState.source || '-') + '</div><div class="cs-sub">按商品编号逐条比对</div></div>' +
      '<div class="cstat"><div class="cs-label">账面库存合计</div><div class="cs-value">' + bookSum + '</div><div class="cs-sub">盘点前 · ' + (rows.length - nb) + ' 条</div></div>' +
      '<div class="cstat"><div class="cs-label">实盘数量合计</div><div class="cs-value">' + actualSum + '</div><div class="cs-sub">盘点后 · ' + (rows.length - nc) + ' 条</div></div>' +
      '<div class="cstat"><div class="cs-label">数量总差异</div><div class="cs-value">' + diffStr + '</div><div class="cs-sub">实盘 − 账面（已盘点部分）</div></div>' +
      '<div class="cstat"><div class="cs-label">盘点准确率</div><div class="cs-value">' + accuracy + '%</div><div class="cs-sub">对平 ' + bal + ' / 已盘点 ' + matched + '</div></div>' +
      '<div class="cstat"><div class="cs-label">差异分布</div><div class="cs-value is-text">盘盈 ' + sur + ' · 盘亏 ' + def + '</div><div class="cs-sub">未盘点 ' + nc + ' · 账面缺失 ' + nb + '</div></div>';
  }

  function renderCompareRows(rows, total) {
    var body = $('compareBody');
    if (!body) return;
    if (!total) {
      body.innerHTML = '<tr><td colspan="7" class="empty">当前筛选条件下没有数据</td></tr>';
      return;
    }
    var html = [];
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      var diffCell;
      if (r.diff == null) diffCell = '<span style="color:var(--muted);">—</span>';
      else {
        var cls = r.diff > 0 ? 'diff-pos' : (r.diff < 0 ? 'diff-neg' : 'diff-zero');
        diffCell = '<span class="' + cls + '">' + (r.diff > 0 ? '+' + r.diff : r.diff) + '</span>';
      }
      html.push(
        '<tr>' +
        '<td class="code-cell">' + escapeHtml(r.code) + '</td>' +
        '<td class="code-cell">' + escapeHtml(r.barcode || '-') + '</td>' +
        '<td class="name-cell">' + escapeHtml(r.name || '') + '</td>' +
        '<td class="num">' + (r.book != null ? r.book : '—') + '</td>' +
        '<td class="num">' + (r.actual != null ? r.actual : '—') + '</td>' +
        '<td class="num">' + diffCell + '</td>' +
        '<td>' + compareStatusHtml(r) + '</td>' +
        '</tr>'
      );
    }
    body.innerHTML = html.join('');
  }

  /* 导出对账结果 Excel */
  function exportCompare() {
    if (!compareState.rows.length) { toast('请先执行账面比对', 'warning'); return; }
    if (typeof XLSX === 'undefined') { toast('导出库未加载', 'error'); return; }
    /* 导出遵循当前筛选 + 搜索结果 */
    var list = filteredCompareRows();
    if (!list.length) { toast('当前筛选/搜索没有匹配的数据', 'warning'); return; }
    var rows = [['商品编号', '条形码', '商品名称', '账面库存', '实盘数量', '差异', '比对结果']];
    for (var i = 0; i < list.length; i++) {
      var r = list[i];
      rows.push([
        r.code, r.barcode || '', r.name || '',
        r.book != null ? r.book : '',
        r.actual != null ? r.actual : '',
        r.diff != null ? r.diff : '',
        compareStatusLabel(r)
      ]);
    }
    var ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [{ wch: 14 }, { wch: 18 }, { wch: 24 }, { wch: 10 }, { wch: 10 }, { wch: 8 }, { wch: 10 }];
    var wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '账面比对');
    var name = '账面比对结果_' + new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-') + '.xlsx';
    XLSX.writeFile(wb, name);
    toast('已导出 ' + list.length + ' 条（全部 ' + compareState.rows.length + ' 条）', 'success');
  }

  /* 通过报告卡片上的「对账」按钮进入（自动切到对账子页） */
  function compareSnapshot(sid) {
    if (!sid) return;
    window.goScanView('compare');
    /* 路由切换是异步的，等子页就位后再执行对账 */
    setTimeout(function () { runCompare(sid); }, 60);
  }

  /* 第一段：导出账面 */
  function exportPreScan() {
    var orig = loadOriginalSnapshot();
    if (!orig || !orig.length) { toast('暂无账面数据', 'warning'); return; }
    if (typeof XLSX === 'undefined') { toast('导出库未加载', 'error'); return; }
    /* 有关键词时仅导出当前搜索结果，并在提示中说明范围 */
    var list = preScanKeyword.trim() ? filterPreScan(orig) : orig;
    if (!list.length) { toast('当前搜索没有匹配的数据', 'warning'); return; }
    var rows = [['商品编号', '条形码', '商品分类', '商品名称', '账面库存']];
    for (var i = 0; i < list.length; i++) {
      var it = list[i];
      rows.push([it.code, it.barcode || '', it.category || '', it.name || '', it.systemQty != null ? it.systemQty : 0]);
    }
    var ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [{ wch: 14 }, { wch: 18 }, { wch: 14 }, { wch: 24 }, { wch: 12 }];
    var wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '盘点前账面');
    var suffix = preScanKeyword.trim() ? '_搜索_' + preScanKeyword.trim().slice(0, 12) : '';
    var name = '盘点前账面' + suffix + '_' + new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-') + '.xlsx';
    XLSX.writeFile(wb, name);
    toast(preScanKeyword.trim()
      ? ('已按搜索条件导出 ' + list.length + ' 条（全部 ' + orig.length + ' 条）')
      : ('已导出 ' + name), 'success');
  }

  function clearPreScan() {
    showModal('确定清空「盘点前账面」？此操作不影响已保存的盘点报告。', 'confirm', function (ok) {
      if (!ok) return;
      clearOriginalSnapshot();
      /* 清空后同步重置搜索框与分页，避免残留旧关键词 */
      preScanKeyword = '';
      var si = $('preScanSearch');
      if (si) si.value = '';
      renderPreScan();
      toast('已清空账面数据', 'success');
    });
  }

  /* 第二段：快照操作 */
  function exportSnapshot(sid) {
    var s = savedSnapshots.find(function (x) { return x.id === sid; });
    if (!s) { toast('报告不存在', 'error'); return; }
    if (typeof XLSX === 'undefined') { toast('导出库未加载', 'error'); return; }
    var rows = [['商品编号', '条形码', '商品分类', '商品名称', '账面库存', '实盘数量', '差异', '状态']];
    for (var i = 0; i < s.items.length; i++) {
      var it = s.items[i];
      var st = it.status === 'balanced' ? '对平' : (it.status === 'surplus' ? '盘盈' : '盘亏');
      rows.push([it.code, it.barcode || '', it.category || '', it.name || '',
                 it.systemQty, it.actualQty, (it.diff > 0 ? '+' : '') + it.diff, st]);
    }
    var ws = XLSX.utils.aoa_to_sheet(rows);
    var wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '盘点报告');
    var name = s.name + '_' + new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-') + '.xlsx';
    XLSX.writeFile(wb, name);
    toast('已导出 ' + name, 'success');
  }

  function deleteSnapshot(sid) {
    var s = savedSnapshots.find(function (x) { return x.id === sid; });
    if (!s) return;
    showModal('确定删除报告「' + s.name + '」？此操作不可撤销。', 'confirm', function (ok) {
      if (!ok) return;
      savedSnapshots = savedSnapshots.filter(function (x) { return x.id !== sid; });
      saveSnapshotsList();
      renderSnapshots();
      toast('已删除报告', 'success');
    });
  }

  function clearAllSnapshots() {
    if (!savedSnapshots.length) { toast('暂无报告', 'warning'); return; }
    showModal('确定清空全部 ' + savedSnapshots.length + ' 份报告？此操作不可撤销。', 'confirm', function (ok) {
      if (!ok) return;
      savedSnapshots = [];
      saveSnapshotsList();
      renderSnapshots();
      toast('已清空全部报告', 'success');
    });
  }

  /* 查看快照详情（弹窗显示完整表格，接入通用分页器） */
  function viewSnapshot(sid) {
    var s = savedSnapshots.find(function (x) { return x.id === sid; });
    if (!s) return;
    var html =
      '<div class="snap-view">' +
        '<div class="snap-view-meta">保存时间：' + escapeHtml(s.savedAt) + ' · 共 ' + s.itemCount + ' 条</div>' +
        '<div class="table-wrap snap-view-table">' +
          '<table class="data-table">' +
            '<thead><tr><th>编号</th><th>条码</th><th>名称</th><th class="num">账面</th><th class="num">实盘</th><th class="num">差异</th><th>状态</th></tr></thead>' +
            '<tbody id="snapViewBody"></tbody>' +
          '</table>' +
        '</div>' +
        '<div id="snapViewPager"></div>' +
      '</div>';
    showModal(html, 'alert', null);
    /* 报告详情表格较宽，给弹窗加宽（参考盘点明细页表格宽度） */
    var overlay = document.querySelector('.modal-overlay');
    if (overlay) overlay.classList.add('modal-wide');
    var body = $('snapViewBody');
    var mount = $('snapViewPager');
    if (!body || !mount) return;
    createPager(mount, {
      pageSize: 20,
      getData: function () { return s.items; },
      onPage: function (rows, page, size, total) {
        if (!total) {
          body.innerHTML = '<tr><td colspan="7" class="empty">无数据</td></tr>';
          return;
        }
        var trs = [];
        for (var i = 0; i < rows.length; i++) {
          var it = rows[i];
          var diffCls = it.diff > 0 ? 'diff-pos' : (it.diff < 0 ? 'diff-neg' : 'diff-zero');
          var sign = it.diff > 0 ? '+' : '';
          var stLabel = it.status === 'balanced' ? '对平' : (it.status === 'surplus' ? '盘盈' : '盘亏');
          trs.push(
            '<tr>' +
            '<td>' + escapeHtml(it.code) + '</td>' +
            '<td>' + escapeHtml(it.barcode || '-') + '</td>' +
            '<td>' + escapeHtml(it.name || '') + '</td>' +
            '<td class="num">' + it.systemQty + '</td>' +
            '<td class="num">' + it.actualQty + '</td>' +
            '<td class="num ' + diffCls + '">' + sign + it.diff + '</td>' +
            '<td>' + stLabel + '</td>' +
            '</tr>'
          );
        }
        body.innerHTML = trs.join('');
      }
    }).draw();
  }

  /* 保存当前盘点为快照报告 */
  function saveCurrentSnapshot() {
    if (!items.length) { toast('暂无数据可保存', 'warning'); return; }
    /* 统计当前数据概况，给用户一个清晰反馈 */
    var sur = 0, def = 0, bal = 0;
    for (var i = 0; i < items.length; i++) {
      if (items[i].status === 'surplus') sur++;
      else if (items[i].status === 'deficit') def++;
      else bal++;
    }
    var now = new Date();
    var pad = function (n) { return n < 10 ? '0' + n : '' + n; };
    var defaultName = '盘点报告_' + now.getFullYear() + '-' + pad(now.getMonth() + 1) + '-' + pad(now.getDate()) +
      '_' + pad(now.getHours()) + ':' + pad(now.getMinutes());
    /* 借用 showModal 弹一个输入对话框 */
    showSnapshotNameDialog(defaultName, function (name) {
      if (name === null) return; /* 用户取消 */
      name = (name || '').trim() || defaultName;
      var snapshot = {
        id: 'snap_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
        name: name,
        savedAt: now.toISOString().slice(0, 19).replace('T', ' '),
        itemCount: items.length,
        items: items.map(function (it) { return JSON.parse(JSON.stringify(it)); })
      };
      /* 统一走 CMGStocktake：本地 +（Http 时）stocktake API */
      var finish = function (msg) {
        savedSnapshots = (typeof CMGStocktake !== 'undefined' && CMGStocktake.readLocal)
          ? CMGStocktake.readLocal()
          : (function () { savedSnapshots.unshift(snapshot); saveSnapshotsList(); return savedSnapshots; })();
        if (!savedSnapshots.length || savedSnapshots[0].id !== snapshot.id) {
          /* 门面未加载时的回退已在上面 IIFE 处理 */
        }
        saveSnapshotsList();
        toast(msg, 'success');
        window.goScanView('reports');
      };
      if (typeof CMGStocktake !== 'undefined' && CMGStocktake.saveReport) {
        CMGStocktake.saveReport(snapshot).then(function (r) {
          if (r && r.ok === false) {
            toast(r.error || '盘点报告保存失败', 'error');
            return;
          }
          savedSnapshots = CMGStocktake.readLocal();
          saveSnapshotsList();
          var tip = '已保存「' + name + '」（' + items.length + ' 件）';
          if (r && r.server && r.server.session) tip += ' · 已同步服务端';
          else if (r && r.localOnly) tip += ' · 本地';
          toast(tip, 'success');
          window.goScanView('reports');
        }).catch(function () {
          savedSnapshots.unshift(snapshot);
          saveSnapshotsList();
          toast('已保存「' + name + '」（本地）', 'success');
          window.goScanView('reports');
        });
      } else {
        savedSnapshots.unshift(snapshot);
        saveSnapshotsList();
        toast('已保存「' + name + '」（' + items.length + ' 件）', 'success');
        window.goScanView('reports');
      }
    }, items.length, items.length);
  }

  /* 自定义弹窗：输入快照名称 */
  function showSnapshotNameDialog(defaultName, onDone, total, count) {
    var overlay = document.createElement('div');
    overlay.className = 'modal-overlay show';
    overlay.innerHTML =
      '<div class="modal-box" role="dialog" aria-modal="true">' +
        '<div class="modal-title">保存盘点报告</div>' +
        '<div class="modal-content">' +
          '<p style="margin:0 0 10px;color:#525252;font-size:13px;">' +
            '当前共 <b>' + total + '</b> 件盘点数据（对平/盘盈/盘亏 见底部统计）。' +
            '保存后会出现在「盘点数据 → 已保存盘点报告」中，原工作区数据不变。' +
          '</p>' +
          '<label style="display:block;font-size:13px;color:#525252;margin-bottom:6px;">报告名称</label>' +
          '<input id="snapNameInput" type="text" maxlength="40" ' +
            'style="width:100%;padding:10px 12px;border:1px solid #d4d4d4;border-radius:6px;font-size:14px;outline:none;" ' +
            'value="' + escapeAttr(defaultName) + '" />' +
        '</div>' +
        '<div class="modal-actions">' +
          '<button class="btn btn-outline btn-sm" id="snapCancel">取消</button>' +
          '<button class="btn btn-primary btn-sm" id="snapConfirm">保存</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(overlay);
    var input = overlay.querySelector('#snapNameInput');
    setTimeout(function () { input.focus(); input.select(); }, 30);
    function close(value) {
      document.body.removeChild(overlay);
      document.removeEventListener('keydown', onKey);
      onDone(value);
    }
    function onKey(e) {
      if (e.key === 'Escape') close(null);
      if (e.key === 'Enter')  close(input.value);
    }
    document.addEventListener('keydown', onKey);
    overlay.querySelector('#snapCancel').addEventListener('click', function () { close(null); });
    overlay.querySelector('#snapConfirm').addEventListener('click', function () { close(input.value); });
    overlay.addEventListener('click', function (e) { if (e.target === overlay) close(null); });
  }

  function downloadTemplate() {
    if (typeof XLSX === 'undefined') {
      toast('导出库未加载', 'error');
      return;
    }
    var rows = [
      ['商品编号', '商品名称', '条形码', '商品分类', '库存数量'],
      ['SKU0001', '示例商品 A', '6901234567890', '日用百货', 120],
      ['SKU0002', '示例商品 B', '6901234567891', '食品饮料', 36],
      ['SKU0003', '示例商品 C', '', '办公用品', 8]
    ];
    var ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [{ wch: 14 }, { wch: 22 }, { wch: 18 }, { wch: 14 }, { wch: 12 }];
    var wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '库存模板');
    XLSX.writeFile(wb, '库存导入模板.xlsx');
    toast('模板已下载', 'success');
  }

  function clearAll() {
    showModal('确定清空全部数据？', 'confirm', function (ok) {
      if (!ok) return;
      if (cameraRunning) toggleCamera();
      items = [];
      lookup.clear();
      lastHighlightId = null;
      currentPage = 1;
      searchKeyword = '';
      var si = $('searchInput');
      if (si) si.value = '';
      $('importToolbar').style.display = 'none';
      /* 无数据时「导出结果」不可用（它始终可见，故需显式禁用） */
      var expBtn = $('btnExport');
      if (expBtn) expBtn.disabled = true;
      var dtb = $('detailToolbar');
      if (dtb) dtb.style.display = 'none';
      var last = $('lastScan');
      if (last) { last.textContent = ''; last.classList.remove('show'); }
      renderPage();
      calcStats();
      saveItems();
      toast('已清空', 'success');
    });
  }

  function showLibError(msg) {
    var el = $('libError');
    el.textContent = msg;
    el.classList.add('show');
  }
