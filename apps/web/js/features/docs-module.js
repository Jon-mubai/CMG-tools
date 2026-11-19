/**
 * Author: zcl (MuBai)
 * Date: 2026-10-14
 * Role: Full-Stack Developer
 */
/* js/features/docs-module.js — 单据：内容哈希去重 + 文件名唯一 + 勾选下载 + 灯箱预览 */
(function () {
  'use strict';
  var STORAGE_KEY = 'warehouse_docs_v1';
  var docs = [];
  var pager = null;
  var bound = false;
  var editingId = null;
  var editImages = [];
  var selected = {};
  var lbList = [];
  var lbIndex = 0;
  var lbScale = 1;
  var searchKw = '';
  var MAX_DATA_URL = 1.8 * 1024 * 1024;
  var MAX_FILE_BYTES = 5 * 1024 * 1024;
  var ALLOWED_IMAGE_TYPES = {
    'image/jpeg': true,
    'image/jpg': true,
    'image/png': true,
    'image/webp': true,
    'image/gif': true,
    'image/bmp': true
  };

  function isAllowedImageFile(file) {
    if (!file) return false;
    var t = String(file.type || '').toLowerCase();
    if (!ALLOWED_IMAGE_TYPES[t]) return false;
    if (file.size > MAX_FILE_BYTES) return false;
    var name = String(file.name || '').toLowerCase();
    if (/\.(jpe?g|png|webp|gif|bmp)$/.test(name) === false && t.indexOf('image/') === 0) {
      /* 允许 type 正确但扩展名异常的少数情况 */
      return true;
    }
    if (name && !/\.(jpe?g|png|webp|gif|bmp)$/.test(name)) return false;
    return true;
  }

  function $(id) { return document.getElementById(id); }
  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
  function confirmDelete(message, onYes) {
    var msg = (message || '确认删除？') + '\n\n删除后数据不可恢复，请谨慎操作。';
    if (typeof showModal === 'function') {
      showModal(msg, 'confirm', function (ok) { if (ok && onYes) onYes(); });
      return;
    }
    if (window.confirm(msg) && onYes) onYes();
  }
  function alertDup(message) {
    var msg = message || '检测到重复文件';
    if (typeof showModal === 'function') {
      showModal(msg, 'alert');
      return;
    }
    if (typeof toast === 'function') toast(msg, 'warning');
    else window.alert(msg);
  }
  function load() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      var data = raw ? JSON.parse(raw) : null;
      docs = data && Array.isArray(data.docs) ? data.docs : [];
      docs.forEach(function (d) {
        if (!Array.isArray(d.images) && d.dataUrl) {
          d.images = [{ dataUrl: d.dataUrl, fileName: d.fileName || '', hash: d.contentHash || '' }];
        }
        if (!Array.isArray(d.images)) d.images = [];
        if (d.images[0] && !d.dataUrl) d.dataUrl = d.images[0].dataUrl;
      });
    } catch (e) { docs = []; }
  }
  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, updatedAt: Date.now(), docs: docs }));
    } catch (e) {
      if (typeof toast === 'function') toast('存储空间不足，请删除旧单据后重试', 'warning');
    }
  }
  function parseDate(v) {
    if (v instanceof Date && !isNaN(v.getTime())) return v;
    var s = String(v || '').trim();
    if (!s) return null;
    var t = Date.parse(s.replace(/\./g, '-').replace(/\//g, '-'));
    return isNaN(t) ? null : new Date(t);
  }
  function periodRange() {
    var sEl = $('docsPeriodStart'), eEl = $('docsPeriodEnd');
    var start = sEl && sEl.value ? parseDate(sEl.value) : null;
    var end = eEl && eEl.value ? parseDate(eEl.value) : null;
    var now = new Date(); now.setHours(0, 0, 0, 0);
    if (!start) start = now;
    if (!end) end = start;
    if (end < start) { var tmp = start; start = end; end = tmp; }
    return { start: start, end: end };
  }
  function filtered() {
    var range = periodRange();
    var kw = searchKw;
    var startMs = range.start.getTime();
    var endMs = range.end.getTime() + 86400000 - 1;
    return docs.filter(function (d) {
      var dt = parseDate(d.periodStart) || parseDate(d.createdAt);
      if (dt) {
        var t = dt.getTime();
        if (t < startMs || t > endMs) return false;
      }
      if (!kw) return true;
      return (d.poNo + ' ' + d.supplier + ' ' + d.fileName + ' ' + (d.remark || '')).toLowerCase().indexOf(kw) >= 0;
    }).sort(function (a, b) {
      return String(b.createdAt).localeCompare(String(a.createdAt));
    });
  }
  function normalizeKey(s) {
    return String(s || '').trim().toLowerCase();
  }
  function hashFile(file) {
    return new Promise(function (resolve) {
      if (!file) { resolve(''); return; }
      var reader = new FileReader();
      reader.onload = function (e) {
        var buf = e.target.result;
        function fallback() {
          try {
            var u8 = new Uint8Array(buf);
            var step = Math.max(1, Math.floor(u8.length / 64));
            var h = (file.size || 0) >>> 0;
            for (var i = 0; i < u8.length; i += step) h = ((h << 5) - h + u8[i]) >>> 0;
            resolve('fb_' + (file.size || 0) + '_' + h.toString(16));
          } catch (err) {
            resolve('fb_' + (file.size || 0) + '_' + encodeURIComponent(file.name || ''));
          }
        }
        if (window.crypto && crypto.subtle && buf) {
          crypto.subtle.digest('SHA-256', buf).then(function (digest) {
            var arr = Array.from(new Uint8Array(digest));
            resolve(arr.map(function (b) { return b.toString(16).padStart(2, '0'); }).join(''));
          }).catch(fallback);
        } else fallback();
      };
      reader.onerror = function () {
        resolve('err_' + (file.size || 0) + '_' + encodeURIComponent(file.name || ''));
      };
      reader.readAsArrayBuffer(file);
    });
  }
  function isPoTaken(poNo, excludeId) {
    var key = normalizeKey(poNo);
    if (!key) return false;
    return docs.some(function (d) {
      return d.id !== excludeId && normalizeKey(d.poNo) === key;
    });
  }
  function isFileNameTaken(fileName, excludeId) {
    var key = normalizeKey(fileName);
    if (!key) return false;
    return docs.some(function (d) {
      if (d.id === excludeId) return false;
      if (normalizeKey(d.fileName) === key) return true;
      if (d.images && d.images.some(function (im) { return normalizeKey(im.fileName) === key; })) return true;
      return false;
    });
  }
  function isHashTaken(hash, excludeId) {
    var key = String(hash || '').trim();
    if (!key) return false;
    return docs.some(function (d) {
      if (d.id === excludeId) return false;
      if (d.contentHash && d.contentHash === key) return true;
      if (d.images && d.images.some(function (im) { return im.hash && im.hash === key; })) return true;
      return false;
    });
  }
  function thumbSrc(d) {
    if (d.images && d.images[0] && d.images[0].dataUrl) return d.images[0].dataUrl;
    return d.dataUrl || '';
  }
  function rowHtml(d, idx) {
    var src = thumbSrc(d);
    var checked = selected[d.id] ? ' checked' : '';
    var preview = src
      ? '<img class="docs-thumb" src="' + src + '" alt="" data-docs-preview="' + escapeHtml(d.id) + '" title="预览" />'
      : '<span class="card-hint">—</span>';
    return '<tr data-docs-id="' + escapeHtml(d.id) + '">' +
      '<td class="docs-col-check"><input type="checkbox" class="docs-check" data-docs-check="' + escapeHtml(d.id) + '"' + checked + ' /></td>' +
      '<td class="num">' + (idx + 1) + '</td>' +
      '<td>' + preview + '</td>' +
      '<td>' + escapeHtml(d.poNo || '—') + '</td>' +
      '<td>' + escapeHtml(d.supplier || '—') + '</td>' +
      '<td>' + escapeHtml((d.periodStart || '') + (d.periodEnd ? ' ~ ' + d.periodEnd : '')) + '</td>' +
      '<td><div class="docs-file-cell"><span title="' + escapeHtml(d.fileName) + '">' + escapeHtml(d.fileName || '—') + '</span></div></td>' +
      '<td>' + escapeHtml(d.createdAt || '') + '</td>' +
      '<td class="docs-ops">' +
        '<button type="button" data-docs-edit="' + escapeHtml(d.id) + '">编辑</button>' +
        '<button type="button" class="docs-op-danger" data-docs-del="' + escapeHtml(d.id) + '">删除</button>' +
      '</td>' +
      '</tr>';
  }
  function syncCheckAll() {
    var all = $('docsCheckAll');
    if (!all) return;
    var list = filtered();
    if (!list.length) { all.checked = false; all.indeterminate = false; return; }
    var n = 0;
    list.forEach(function (d) { if (selected[d.id]) n++; });
    all.checked = n === list.length;
    all.indeterminate = n > 0 && n < list.length;
  }
  function renderList() {
    var body = $('docsTableBody');
    var hint = $('docsListHint');
    var list = filtered();
    var selCount = 0;
    list.forEach(function (d) { if (selected[d.id]) selCount++; });
    if (hint) {
      hint.textContent = docs.length
        ? ('共 ' + docs.length + ' 份 · 当前筛选 ' + list.length + ' 份' + (selCount ? ' · 已选 ' + selCount + ' 份' : ''))
        : '按账期上传采购单据（单号/文件名/图片内容均不可重复）';
    }
    if (!list.length) {
      if (body) body.innerHTML = '<tr><td colspan="9" class="empty-cell">暂无单据，请先填写采购单号与供应商并上传图片</td></tr>';
      var pg = $('docsPager');
      if (pg) pg.style.display = 'none';
      syncCheckAll();
      return;
    }
    if (typeof createPager === 'function' && $('docsPager')) {
      if (!pager) {
        pager = createPager($('docsPager'), {
          pageSize: 15,
          getData: function () { return filtered(); },
          onPage: function (pageRows, page, size) {
            var base = ((page || 1) - 1) * (size || 15);
            if (body) body.innerHTML = pageRows.map(function (r, i) { return rowHtml(r, base + i); }).join('');
            syncCheckAll();
          }
        });
      }
      if (pager.reset) pager.reset(); else pager.draw();
    } else if (body) {
      body.innerHTML = list.map(function (r, i) { return rowHtml(r, i); }).join('');
    }
    syncCheckAll();
  }

  function readImageAsDataUrl(file, cb) {
    if (!isAllowedImageFile(file)) {
      cb(new Error('请上传图片文件'));
      return;
    }
    var startRead = function () {
      var reader = new FileReader();
      reader.onload = function (e) {
        var url = e.target.result;
        if (url && url.length > MAX_DATA_URL) {
          compressImage(url, function (small) {
            if (!small || small.length > MAX_DATA_URL) cb(new Error('图片过大，请压缩后上传'));
            else cb(null, small);
          });
        } else cb(null, url);
      };
      reader.onerror = function () { cb(new Error('读取图片失败')); };
      reader.readAsDataURL(file);
    };
    /* S4：魔数校验 */
    if (typeof CMGFileMagic !== 'undefined' && CMGFileMagic.validateImageFile) {
      CMGFileMagic.validateImageFile(file).then(function (r) {
        if (!r || !r.ok) {
          cb(new Error((r && r.error) || '文件内容校验失败'));
          return;
        }
        startRead();
      }).catch(function () { cb(new Error('文件校验异常')); });
    } else {
      startRead();
    }
  }
  function compressImage(dataUrl, cb) {
    var img = new Image();
    img.onload = function () {
      var maxW = 1280;
      var scale = img.width > maxW ? maxW / img.width : 1;
      var canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      try { cb(canvas.toDataURL('image/jpeg', 0.72)); } catch (e) { cb(null); }
    };
    img.onerror = function () { cb(null); };
    img.src = dataUrl;
  }

  function addDocs(fileList) {
    var files = Array.prototype.slice.call(fileList || []).filter(isAllowedImageFile);
    if (!files.length) {
      alertDup('仅支持 JPG/PNG/WebP/GIF/BMP，单张不超过 5MB');
      return;
    }
    var po = (($('docsPoNo') && $('docsPoNo').value) || '').trim();
    var sup = (($('docsSupplier') && $('docsSupplier').value) || '').trim();
    if (!po) { alertDup('请填写采购单号'); return; }
    if (!sup) { alertDup('请填写供应商'); return; }
    if (isPoTaken(po)) {
      alertDup('采购单号「' + po + '」已存在，不可重复上传。\n请更换单号或编辑已有单据。');
      return;
    }
    Promise.all(files.map(function (file) {
      return hashFile(file).then(function (hash) { return { file: file, hash: hash }; });
    })).then(function (items) {
      var nameDup = [];
      var hashDup = [];
      var seenName = {};
      var seenHash = {};
      items.forEach(function (it) {
        var nk = normalizeKey(it.file.name);
        if (seenName[nk] || isFileNameTaken(it.file.name)) nameDup.push(it.file.name);
        seenName[nk] = 1;
        if (it.hash && (seenHash[it.hash] || isHashTaken(it.hash))) hashDup.push(it.file.name);
        if (it.hash) seenHash[it.hash] = 1;
      });
      if (nameDup.length) {
        alertDup('检测到重复文件名，已阻止上传：\n\n' + nameDup.slice(0, 8).join('\n') +
          (nameDup.length > 8 ? '\n…' : '') + '\n\n请重命名后再试。');
        return;
      }
      if (hashDup.length) {
        alertDup('检测到图片内容与已有单据重复（内容指纹相同），已阻止上传：\n\n' +
          hashDup.slice(0, 8).join('\n') +
          (hashDup.length > 8 ? '\n…' : '') +
          '\n\n即使文件名不同，相同图片也不能重复入库。');
        return;
      }
      var loaded = [];
      var pending = items.length;
      var failed = 0;
      items.forEach(function (it) {
        readImageAsDataUrl(it.file, function (err, dataUrl) {
          if (err || !dataUrl) failed++;
          else loaded.push({
            dataUrl: dataUrl,
            fileName: it.file.name,
            fileSize: it.file.size || 0,
            hash: it.hash
          });
          pending--;
          if (pending > 0) return;
          if (!loaded.length) { alertDup('图片读取失败，请重试'); return; }
          var range = periodRange();
          docs.unshift({
            id: 'doc_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
            poNo: po,
            supplier: sup,
            periodStart: range.start.toISOString().slice(0, 10),
            periodEnd: range.end.toISOString().slice(0, 10),
            fileName: loaded.length === 1 ? loaded[0].fileName : (loaded[0].fileName + ' 等' + loaded.length + '张'),
            fileSize: loaded.reduce(function (s, x) { return s + (x.fileSize || 0); }, 0),
            dataUrl: loaded[0].dataUrl,
            contentHash: loaded[0].hash || '',
            images: loaded.map(function (x) {
              return { dataUrl: x.dataUrl, fileName: x.fileName, hash: x.hash };
            }),
            remark: '',
            createdAt: new Date().toLocaleString('zh-CN', { hour12: false })
          });
          save();
          renderList();
          if (typeof toast === 'function') {
            var msg = '已添加单据「' + po + '」· ' + loaded.length + ' 张图片';
            if (failed) msg += '（' + failed + ' 张失败）';
            toast(msg, 'success');
          }
          if ($('docsFile')) $('docsFile').value = '';
        });
      });
    });
  }

  function loadExcelJS(cb) {
    if (window.ExcelJS) { cb(null, window.ExcelJS); return; }
    var s = document.createElement('script');
    s.src = 'vendor/exceljs.min.js';
    s.onload = function () { cb(null, window.ExcelJS); };
    s.onerror = function () {
      cb(new Error('ExcelJS 本地库加载失败，请确认 frontend/vendor/exceljs.min.js 存在'));
    };
    document.head.appendChild(s);
  }
  function dataUrlParts(dataUrl) {
    var parts = String(dataUrl || '').split(',');
    var mime = (parts[0].match(/:(.*?);/) || [])[1] || 'image/png';
    var b64 = parts[1] || '';
    var ext = (mime.split('/')[1] || 'png').toLowerCase().replace('jpeg', 'jpg');
    var excelExt = (ext === 'jpg') ? 'jpeg' : ext;
    if (excelExt !== 'png' && excelExt !== 'jpeg' && excelExt !== 'gif') excelExt = 'png';
    return { base64: b64, mime: mime, excelExt: excelExt };
  }
  function exportList() {
    var list = filtered();
    var picked = list.filter(function (d) { return selected[d.id]; });
    return picked.length ? picked : list;
  }
  function exportExcel(withImages) {
    var list = exportList();
    if (!list.length) {
      alertDup('暂无单据可下载（请先勾选或调整筛选）');
      return;
    }
    withImages = !!withImages;
    if (typeof toast === 'function') {
      toast('正在导出 ' + list.length + ' 条' + (withImages ? '（含图片）' : '（仅数据）') + '…', 'info');
    }

    if (!withImages) {
      if (typeof XLSX === 'undefined') { alertDup('导出库未加载'); return; }
      var aoa = [['序号', '采购单号', '供应商', '账期开始', '账期结束', '文件名', '备注', '上传时间']];
      list.forEach(function (d, i) {
        aoa.push([i + 1, d.poNo || '', d.supplier || '', d.periodStart || '', d.periodEnd || '', d.fileName || '', d.remark || '', d.createdAt || '']);
      });
      var wb0 = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb0, XLSX.utils.aoa_to_sheet(aoa), '采购单据');
      XLSX.writeFile(wb0, '采购单据_' + new Date().toISOString().slice(0, 10) + '.xlsx');
      if (typeof toast === 'function') toast('已导出 ' + list.length + ' 条表格数据', 'success');
      return;
    }

    loadExcelJS(function (err, ExcelJS) {
      if (err || !ExcelJS) {
        if (typeof XLSX === 'undefined') { alertDup('导出库未加载'); return; }
        var aoa2 = [['序号', '采购单号', '供应商', '账期开始', '账期结束', '文件名', '备注', '上传时间']];
        list.forEach(function (d, i) {
          aoa2.push([i + 1, d.poNo || '', d.supplier || '', d.periodStart || '', d.periodEnd || '', d.fileName || '', d.remark || '', d.createdAt || '']);
        });
        var wb1 = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb1, XLSX.utils.aoa_to_sheet(aoa2), '采购单据');
        XLSX.writeFile(wb1, '采购单据_' + new Date().toISOString().slice(0, 10) + '.xlsx');
        if (typeof toast === 'function') toast('已导出 Excel（图片库加载失败，未嵌入图片）', 'warning');
        return;
      }
      var wb = new ExcelJS.Workbook();
      var ws = wb.addWorksheet('采购单据', { views: [{ state: 'frozen', ySplit: 1 }] });
      var maxImgs = 1;
      list.forEach(function (d) {
        var n = (d.images && d.images.length) ? d.images.length : (d.dataUrl ? 1 : 0);
        if (n > maxImgs) maxImgs = n;
      });
      if (maxImgs > 5) maxImgs = 5;
      var cols = [
        { header: '序号', width: 8 }, { header: '采购单号', width: 14 }, { header: '供应商', width: 16 },
        { header: '账期开始', width: 12 }, { header: '账期结束', width: 12 }, { header: '文件名', width: 26 },
        { header: '备注', width: 14 }, { header: '上传时间', width: 18 }
      ];
      for (var c = 0; c < maxImgs; c++) cols.push({ header: maxImgs === 1 ? '单据图片' : ('图片' + (c + 1)), width: 16 });
      ws.columns = cols;
      ws.getRow(1).font = { bold: true };
      ws.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };
      var embedCount = 0;
      list.forEach(function (d, i) {
        var rowIndex = i + 2;
        var row = ws.getRow(rowIndex);
        var vals = [i + 1, d.poNo || '', d.supplier || '', d.periodStart || '', d.periodEnd || '', d.fileName || '', d.remark || '', d.createdAt || ''];
        while (vals.length < 8 + maxImgs) vals.push('');
        row.values = vals;
        row.alignment = { vertical: 'middle' };
        row.height = 78;
        var imgs = (d.images && d.images.length) ? d.images : (d.dataUrl ? [{ dataUrl: d.dataUrl }] : []);
        var limit = Math.min(imgs.length, maxImgs);
        for (var j = 0; j < limit; j++) {
          var im = imgs[j];
          if (!im || !im.dataUrl) continue;
          try {
            var parts = dataUrlParts(im.dataUrl);
            if (!parts.base64) continue;
            var imageId = wb.addImage({ base64: parts.base64, extension: parts.excelExt });
            ws.addImage(imageId, { tl: { col: 8 + j, row: rowIndex - 1 }, ext: { width: 110, height: 72 }, editAs: 'oneCell' });
            embedCount++;
          } catch (e) { row.getCell(9 + j).value = '嵌入失败'; }
        }
        if (!limit) row.getCell(9).value = '无';
      });
      wb.xlsx.writeBuffer().then(function (buffer) {
        var blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        var a = document.createElement('a');
        var url = URL.createObjectURL(blob);
        a.href = url;
        a.download = '采购单据_' + new Date().toISOString().slice(0, 10) + '.xlsx';
        document.body.appendChild(a);
        a.click();
        setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 800);
        if (typeof toast === 'function') toast('已导出 ' + list.length + ' 条，嵌入 ' + embedCount + ' 张图片', 'success');
      }).catch(function () { alertDup('导出失败'); });
    });
  }

  function paintLightbox() {
    var img = $('docsLightboxImg');
    var counter = $('docsLbCounter');
    var prev = $('docsLbPrev');
    var next = $('docsLbNext');
    if (!lbList.length) return;
    if (lbIndex < 0) lbIndex = 0;
    if (lbIndex >= lbList.length) lbIndex = lbList.length - 1;
    if (img) {
      img.src = lbList[lbIndex].dataUrl || '';
      img.style.transform = 'scale(' + lbScale + ')';
    }
    if (counter) counter.textContent = (lbIndex + 1) + ' / ' + lbList.length;
    /* 始终可点：单图时点击仍循环（等同不切换） */
    if (prev) prev.disabled = false;
    if (next) next.disabled = false;
  }
  function openLightbox(list, index) {
    lbList = (list || []).filter(function (x) { return x && x.dataUrl; });
    if (!lbList.length) { alertDup('暂无图片可预览'); return; }
    lbIndex = index || 0;
    lbScale = 1;
    var lb = $('docsLightbox');
    if (lb) {
      lb.hidden = false;
      lb.removeAttribute('hidden');
      lb.classList.add('is-open');
      lb.style.cssText = 'display:flex;pointer-events:auto;z-index:400;';
      paintLightbox();
    }
  }
  function closeLightbox() {
    var lb = $('docsLightbox');
    if (lb) {
      lb.classList.remove('is-open');
      lb.hidden = true;
      lb.setAttribute('hidden', '');
      lb.style.cssText = 'display:none;pointer-events:none;';
    }
    var img = $('docsLightboxImg');
    if (img) { img.removeAttribute('src'); img.style.transform = ''; }
    lbList = [];
    lbScale = 1;
  }
  function openLightboxForDoc(id, index) {
    var doc = docs.find(function (d) { return d.id === id; });
    if (!doc) return;
    var list = (doc.images && doc.images.length) ? doc.images : (doc.dataUrl ? [{ dataUrl: doc.dataUrl, fileName: doc.fileName }] : []);
    openLightbox(list, index || 0);
  }

  function openDrawer(id) {
    var doc = docs.find(function (d) { return d.id === id; });
    if (!doc) return;
    editingId = id;
    if ($('docsDrawerTitle')) $('docsDrawerTitle').textContent = '编辑单据';
    function setField(fid, val) {
      var el = $(fid);
      if (!el) return;
      el.value = val == null ? '' : val;
      el.disabled = false;
      el.readOnly = false;
    }
    setField('docsEditPoNo', doc.poNo || '');
    setField('docsEditSupplier', doc.supplier || '');
    setField('docsEditRemark', doc.remark || '');
    if ($('docsEditStart')) $('docsEditStart').value = doc.periodStart || '';
    if ($('docsEditEnd')) $('docsEditEnd').value = doc.periodEnd || '';
    var disp = $('docsEditPeriodDisplay');
    var s = doc.periodStart || '', e = doc.periodEnd || s;
    if (disp) {
      if (s) {
        function cn(v) {
          var p = String(v).split('-');
          if (p.length < 3) return v;
          return p[0] + '/' + parseInt(p[1], 10) + '/' + parseInt(p[2], 10);
        }
        disp.textContent = cn(s) + '  →  ' + cn(e);
        disp.classList.remove('is-placeholder');
      } else {
        disp.textContent = '请选择账期';
        disp.classList.add('is-placeholder');
      }
    }
    var st = window.__docsEditDp;
    if (st && s) {
      var sd = parseDate(s), ed = parseDate(e) || sd;
      if (sd) {
        st.pickStart = sd; st.pickEnd = ed;
        st.view = new Date(sd.getFullYear(), sd.getMonth(), 1);
        st.picking = false;
      }
    }
    var trig = $('docsEditPeriodTrigger');
    if (trig) { trig.disabled = false; trig.style.pointerEvents = 'auto'; trig.style.opacity = '1'; }
    editImages = (doc.images && doc.images.length)
      ? doc.images.map(function (x) { return { dataUrl: x.dataUrl, fileName: x.fileName, hash: x.hash || '' }; })
      : (doc.dataUrl ? [{ dataUrl: doc.dataUrl, fileName: doc.fileName || '', hash: doc.contentHash || '' }] : []);
    renderEditImages(true);
    if ($('docsDrawerSave')) { $('docsDrawerSave').style.display = ''; $('docsDrawerSave').disabled = false; }
    var overlay = $('docsDrawerOverlay');
    if (overlay) {
      overlay.hidden = false;
      overlay.removeAttribute('hidden');
      overlay.classList.add('is-open');
      overlay.style.cssText = 'display:flex;pointer-events:auto;z-index:200;';
    }
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
  }
  function closeDrawer() {
    var overlay = $('docsDrawerOverlay');
    if (overlay) {
      overlay.classList.remove('is-open');
      overlay.hidden = true;
      overlay.setAttribute('hidden', '');
      overlay.style.cssText = 'display:none;pointer-events:none;';
    }
    var editRoot = $('docsEditDatePicker');
    if (editRoot) {
      editRoot.classList.remove('open');
      var ep = $('docsEditPeriodPanel');
      if (ep) { ep.hidden = true; ep.setAttribute('hidden', ''); }
    }
    document.body.style.overflow = '';
    document.documentElement.style.overflow = '';
    editingId = null;
    editImages = [];
  }
  function renderEditImages(canEdit) {
    var box = $('docsEditImgList');
    if (!box) return;
    var html = editImages.map(function (img, i) {
      return '<div class="docs-img-item">' +
        '<img src="' + img.dataUrl + '" alt="" data-edit-preview="' + i + '" />' +
        (canEdit ? '<button type="button" class="docs-img-del" data-img-idx="' + i + '">×</button>' : '') +
        '</div>';
    }).join('');
    if (canEdit) {
      html += '<button type="button" class="docs-img-add" id="docsImgAddBtn"><span style="font-size:18px;line-height:1;">+</span>添加图片</button>';
    }
    box.innerHTML = html;
  }
  function saveDrawer() {
    if (!editingId) return;
    var po = (($('docsEditPoNo') && $('docsEditPoNo').value) || '').trim();
    var sup = (($('docsEditSupplier') && $('docsEditSupplier').value) || '').trim();
    if (!po || !sup) { alertDup('请填写采购单号与供应商'); return; }
    if (isPoTaken(po, editingId)) {
      alertDup('采购单号「' + po + '」已存在，不可重复。\n请更换单号。');
      return;
    }
    for (var i = 0; i < editImages.length; i++) {
      var fn = editImages[i].fileName || '';
      if (fn && isFileNameTaken(fn, editingId)) {
        alertDup('文件名「' + fn + '」已存在，不可重复。');
        return;
      }
      if (editImages[i].hash && isHashTaken(editImages[i].hash, editingId)) {
        alertDup('图片「' + (fn || ('#' + (i + 1))) + '」内容与已有单据重复，不可保存。');
        return;
      }
      for (var j = i + 1; j < editImages.length; j++) {
        if (normalizeKey(editImages[i].fileName) && normalizeKey(editImages[i].fileName) === normalizeKey(editImages[j].fileName)) {
          alertDup('编辑中存在重复文件名，请删除多余图片。');
          return;
        }
        if (editImages[i].hash && editImages[j].hash && editImages[i].hash === editImages[j].hash) {
          alertDup('编辑中存在内容相同的图片，请删除重复项。');
          return;
        }
      }
    }
    var idx = docs.findIndex(function (d) { return d.id === editingId; });
    if (idx < 0) return;
    docs[idx].poNo = po;
    docs[idx].supplier = sup;
    docs[idx].periodStart = ($('docsEditStart') && $('docsEditStart').value) || docs[idx].periodStart;
    docs[idx].periodEnd = ($('docsEditEnd') && $('docsEditEnd').value) || docs[idx].periodEnd;
    docs[idx].remark = (($('docsEditRemark') && $('docsEditRemark').value) || '').trim();
    docs[idx].images = editImages.slice();
    docs[idx].dataUrl = editImages[0] ? editImages[0].dataUrl : '';
    docs[idx].contentHash = editImages[0] ? (editImages[0].hash || '') : '';
    docs[idx].fileName = editImages[0]
      ? (editImages.length === 1 ? editImages[0].fileName : (editImages[0].fileName + ' 等' + editImages.length + '张'))
      : '';
    save();
    closeDrawer();
    renderList();
    if (typeof toast === 'function') toast('已保存修改', 'success');
  }

  function bind() {
    if (typeof window.bindSharedDatePicker === 'function') {
      try {
        window.bindSharedDatePicker({
          rootId: 'docsDatePicker', triggerId: 'docsPeriodTrigger', panelId: 'docsPeriodPanel',
          startId: 'docsPeriodStart', endId: 'docsPeriodEnd', displayId: 'docsPeriodDisplay',
          presetsId: 'docsPeriodPresets', calDaysL: 'docsCalDaysL', calDaysR: 'docsCalDaysR',
          calTitleL: 'docsCalTitleL', calTitleR: 'docsCalTitleR',
          defaultPreset: 'last7', stateKey: '__docsDp', onChange: function () { renderList(); }
        });
      } catch (err) { console.warn('[docs] datepicker', err); }
      try {
        window.bindSharedDatePicker({
          rootId: 'docsEditDatePicker', triggerId: 'docsEditPeriodTrigger', panelId: 'docsEditPeriodPanel',
          startId: 'docsEditStart', endId: 'docsEditEnd', displayId: 'docsEditPeriodDisplay',
          presetsId: 'docsEditPeriodPresets', calDaysL: 'docsEditCalDaysL', calDaysR: 'docsEditCalDaysR',
          calTitleL: 'docsEditCalTitleL', calTitleR: 'docsEditCalTitleR',
          defaultPreset: null, stateKey: '__docsEditDp'
        });
      } catch (err) { console.warn('[docs] edit datepicker', err); }
    }
    if (bound) return;
    bound = true;

    var file = $('docsFile');
    var btn = $('docsBtnUpload');
    if (btn && file) {
      btn.addEventListener('click', function (e) { e.preventDefault(); file.click(); });
      file.addEventListener('change', function (e) {
        if (e.target.files && e.target.files.length) addDocs(e.target.files);
        e.target.value = '';
      });
    }
    (function bindExportMenu() {
      var btn = $('docsBtnExport');
      var menu = $('docsExportMenu');
      var wrap = $('docsExportWrap');
      if (!btn || !menu) return;
      function closeMenu() {
        menu.hidden = true;
        menu.setAttribute('hidden', '');
      }
      function openMenu() {
        menu.hidden = false;
        menu.removeAttribute('hidden');
      }
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        if (menu.hidden) openMenu(); else closeMenu();
      });
      menu.addEventListener('click', function (e) {
        var item = e.target.closest && e.target.closest('[data-export-mode]');
        if (!item) return;
        e.preventDefault();
        e.stopPropagation();
        closeMenu();
        var mode = item.getAttribute('data-export-mode');
        exportExcel(mode === 'with-images');
      });
      document.addEventListener('click', function (e) {
        if (!wrap) return;
        if (wrap.contains(e.target)) return;
        closeMenu();
      });
    })();
    var docsSearchBtn = $('btnDocsSearch');
    var docsSearchInput = $('docsSearch');
    if (docsSearchBtn) {
      docsSearchBtn.addEventListener('click', function (e) {
        e.preventDefault();
        searchKw = docsSearchInput ? (docsSearchInput.value || '').trim().toLowerCase() : '';
        renderList();
      });
    }
    if (docsSearchInput) {
      docsSearchInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
          e.preventDefault();
          searchKw = (docsSearchInput.value || '').trim().toLowerCase();
          renderList();
        }
      });
    }
    var checkAll = $('docsCheckAll');
    if (checkAll) {
      checkAll.addEventListener('change', function () {
        var on = !!checkAll.checked;
        filtered().forEach(function (d) {
          if (on) selected[d.id] = true;
          else delete selected[d.id];
        });
        renderList();
      });
    }

    var page = $('page-wh-docs');
    if (page) {
      page.addEventListener('click', function (e) {
        var previewBtn = e.target.closest && e.target.closest('[data-docs-preview]');
        if (previewBtn) { openLightboxForDoc(previewBtn.getAttribute('data-docs-preview'), 0); return; }
        var del = e.target.closest && e.target.closest('[data-docs-del]');
        if (del) {
          var id = del.getAttribute('data-docs-del');
          confirmDelete('确认删除该单据？', function () {
            docs = docs.filter(function (d) { return d.id !== id; });
            delete selected[id];
            save();
            renderList();
            if (typeof toast === 'function') toast('已删除', 'success');
          });
          return;
        }
        var edit = e.target.closest && e.target.closest('[data-docs-edit]');
        if (edit) openDrawer(edit.getAttribute('data-docs-edit'));
      });
      page.addEventListener('change', function (e) {
        var cb = e.target.closest && e.target.closest('[data-docs-check]');
        if (!cb) return;
        var id = cb.getAttribute('data-docs-check');
        if (cb.checked) selected[id] = true;
        else delete selected[id];
        syncCheckAll();
        renderList();
      });
    }

    if (!window.__docsDrawerDelegate) {
      window.__docsDrawerDelegate = true;
      document.addEventListener('click', function (e) {
        var overlay = $('docsDrawerOverlay');
        if (!overlay || overlay.hidden || !overlay.classList.contains('is-open')) return;
        if (e.target === overlay) { e.preventDefault(); closeDrawer(); return; }
        var t = e.target;
        if (!t || !t.closest || !overlay.contains(t)) return;
        if (t.closest('#docsDrawerClose') || t.closest('#docsDrawerCancel')) {
          e.preventDefault(); e.stopPropagation(); closeDrawer(); return;
        }
        if (t.closest('#docsDrawerSave')) {
          e.preventDefault(); e.stopPropagation();
          try { saveDrawer(); } catch (err) { console.warn(err); closeDrawer(); }
          return;
        }
        if (t.closest('#docsImgAddBtn')) {
          e.preventDefault(); e.stopPropagation();
          if ($('docsEditFile')) $('docsEditFile').click();
          return;
        }
        var delImg = t.closest('[data-img-idx]');
        if (delImg) {
          e.preventDefault(); e.stopPropagation();
          var i = parseInt(delImg.getAttribute('data-img-idx'), 10);
          confirmDelete('确认删除该图片？', function () {
            if (!isNaN(i)) { editImages.splice(i, 1); renderEditImages(true); }
          });
          return;
        }
        var pv = t.closest('[data-edit-preview]');
        if (pv) {
          e.preventDefault();
          var pi = parseInt(pv.getAttribute('data-edit-preview'), 10);
          openLightbox(editImages, isNaN(pi) ? 0 : pi);
        }
      }, true);

      var editFile = $('docsEditFile');
      if (editFile && !editFile.__docsBound) {
        editFile.__docsBound = true;
        editFile.addEventListener('change', function (e) {
          var files = e.target.files ? Array.prototype.slice.call(e.target.files) : [];
          e.target.value = '';
          if (!files.length) return;
          var skipped = [];
          Promise.all(files.map(function (f) {
            return hashFile(f).then(function (hash) { return { file: f, hash: hash }; });
          })).then(function (items) {
            var pending = items.length;
            if (!pending) return;
            function finish() {
              renderEditImages(true);
              if (skipped.length) {
                alertDup('以下图片未添加：\n\n' + skipped.slice(0, 10).join('\n') + (skipped.length > 10 ? '\n…' : ''));
              }
            }
            items.forEach(function (it) {
              var f = it.file;
              if (isFileNameTaken(f.name, editingId) ||
                  editImages.some(function (im) { return normalizeKey(im.fileName) === normalizeKey(f.name); })) {
                skipped.push(f.name + '（文件名重复）');
                pending--;
                if (pending === 0) finish();
                return;
              }
              if (it.hash && (isHashTaken(it.hash, editingId) ||
                  editImages.some(function (im) { return im.hash && im.hash === it.hash; }))) {
                skipped.push(f.name + '（图片内容重复）');
                pending--;
                if (pending === 0) finish();
                return;
              }
              readImageAsDataUrl(f, function (err, dataUrl) {
                pending--;
                if (!err && dataUrl) editImages.push({ dataUrl: dataUrl, fileName: f.name, hash: it.hash });
                if (pending === 0) finish();
              });
            });
          });
        });
      }
    }

    if (!window.__docsLightboxDelegate) {
      window.__docsLightboxDelegate = true;
      document.addEventListener('click', function (e) {
        var lb = $('docsLightbox');
        if (!lb || lb.hidden || !lb.classList.contains('is-open')) return;
        var t = e.target;
        if (!t || !t.closest) return;
        /* 关闭 */
        if (t.closest('#docsLbClose')) {
          e.preventDefault(); e.stopPropagation();
          closeLightbox();
          return;
        }
        if (t.closest('#docsLbPrev')) {
          e.preventDefault(); e.stopPropagation();
          if (!lbList.length) return;
          lbIndex = (lbIndex - 1 + lbList.length) % lbList.length;
          lbScale = 1; paintLightbox();
          return;
        }
        if (t.closest('#docsLbNext')) {
          e.preventDefault(); e.stopPropagation();
          if (!lbList.length) return;
          lbIndex = (lbIndex + 1) % lbList.length;
          lbScale = 1; paintLightbox();
          return;
        }
        if (t.closest('#docsLbZoomIn')) {
          e.preventDefault(); e.stopPropagation();
          lbScale = Math.min(4, Math.round((lbScale + 0.25) * 100) / 100);
          paintLightbox();
          return;
        }
        if (t.closest('#docsLbZoomOut')) {
          e.preventDefault(); e.stopPropagation();
          lbScale = Math.max(0.5, Math.round((lbScale - 0.25) * 100) / 100);
          paintLightbox();
          return;
        }
        if (t.closest('#docsLbZoomReset')) {
          e.preventDefault(); e.stopPropagation();
          lbScale = 1; paintLightbox();
          return;
        }
        /* 点遮罩空白关闭（避开按钮与图片） */
        if (t === lb) {
          e.preventDefault();
          closeLightbox();
        }
      }, true);

      document.addEventListener('keydown', function (e) {
        var lbEl = $('docsLightbox');
        if (lbEl && !lbEl.hidden && lbEl.classList.contains('is-open')) {
          if (e.key === 'Escape') { closeLightbox(); return; }
          if (e.key === 'ArrowLeft') {
            if (!lbList.length) return;
            lbIndex = (lbIndex - 1 + lbList.length) % lbList.length;
            lbScale = 1; paintLightbox(); return;
          }
          if (e.key === 'ArrowRight') {
            if (!lbList.length) return;
            lbIndex = (lbIndex + 1) % lbList.length;
            lbScale = 1; paintLightbox(); return;
          }
        }
        if (e.key === 'Escape' && $('docsDrawerOverlay') && !$('docsDrawerOverlay').hidden &&
            $('docsDrawerOverlay').classList.contains('is-open')) closeDrawer();
      });

      var lbRoot = $('docsLightbox');
      if (lbRoot && !lbRoot.__wheelBound) {
        lbRoot.__wheelBound = true;
        lbRoot.addEventListener('wheel', function (e) {
          if (lbRoot.hidden) return;
          e.preventDefault();
          if (e.deltaY < 0) lbScale = Math.min(4, lbScale + 0.1);
          else lbScale = Math.max(0.5, lbScale - 0.1);
          paintLightbox();
        }, { passive: false });
      }
    }
  }

  function render() {
    load();
    bind();
    renderList();
  }

  window.DocsModule = { render: render };
})();
