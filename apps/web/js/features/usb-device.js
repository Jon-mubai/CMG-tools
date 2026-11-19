/**
 * Author: zcl (MuBai)
 * Date: 2026-10-14
 * Role: Full-Stack Developer
 */
/* js/features/usb-device.js */
/* ===== USB扫码设备接入状态管理 ===== */
  var DeviceManager = (function () {
    var statusEl = null;
    var dotEl = null;
    var textEl = null;
    var hidDevice = null;
    var kbConnected = false;
    var kbResetTimer = null;
    var currentState = 'disconnected';

    var STATES = {
      disconnected:  { cls: 'disconnected',  text: '等待扫码设备接入' },
      detecting:     { cls: 'detecting',     text: '正在检测扫码设备…' },
      connected_kb:  { cls: 'connected-kb',  text: '扫码枪已连接（键盘模式）' },
      connected_hid: { cls: 'connected-hid', text: 'USB设备已连接（直连模式）' },
      unsupported:   { cls: 'unsupported',   text: '当前浏览器不支持WebHID，使用键盘模式' }
    };

    function init() {
      statusEl = $('deviceStatus');
      if (!statusEl) return;
      dotEl = $('statusDot');
      textEl = $('statusText');
      setState('disconnected');

      if (!('hid' in navigator)) {
        setState('unsupported');
        var btn = $('btnConnectUsb');
        if (btn) { btn.style.display = 'none'; }
      } else {
        navigator.hid.addEventListener('disconnect', function (e) {
          if (hidDevice && e.device === hidDevice) {
            hidDevice = null;
            setState('disconnected');
            toast('USB扫码设备已断开', 'warning');
          }
        });
        navigator.hid.addEventListener('connect', function (e) {
          tryConnectHid(e.device);
        });
        navigator.hid.getDevices().then(function (devices) {
          if (devices && devices.length > 0) {
            tryConnectHid(devices[0]);
          }
        }).catch(function () {});
      }

      var connectBtn = $('btnConnectUsb');
      if (connectBtn) {
        connectBtn.addEventListener('click', requestHidDevice);
      }
    }

    function setState(state) {
      if (!statusEl || !STATES[state]) return;
      currentState = state;
      var s = STATES[state];
      statusEl.className = 'device-status ' + s.cls;
      if (textEl) textEl.textContent = s.text;
    }

    function getState() { return currentState; }

    /* --- WebHID 直连模式 --- */
    function requestHidDevice() {
      if (!('hid' in navigator)) {
        toast('当前浏览器不支持WebHID，请使用Chrome/Edge', 'warning');
        return;
      }
      setState('detecting');
      navigator.hid.requestDevice({ filters: [] }).then(function (devices) {
        if (devices && devices.length > 0) {
          tryConnectHid(devices[0]);
        } else {
          setState('disconnected');
        }
      }).catch(function (err) {
        setState('disconnected');
      });
    }

    function tryConnectHid(device) {
      if (!device) return;
      /* 互斥：若摄像头在跑，先停掉 */
      if (cameraRunning) {
        try { if (html5QrCode) html5QrCode.stop(); } catch (e) {}
        cameraRunning = false;
        var reader = $('reader'); if (reader) reader.classList.remove('active');
        var placeholder = $('cameraPlaceholder'); if (placeholder) placeholder.classList.remove('hidden');
        var btns = [$('btnCamera'), $('btnCameraMobile')];
        btns.forEach(function (b) {
          if (!b) return;
          var txt = b.querySelector('.btn-camera-text');
          if (txt) txt.textContent = b.id === 'btnCameraMobile' ? '摄像头' : '开启摄像头扫码';
          b.classList.remove('btn-danger'); b.classList.add('btn-primary');
        });
      }
      setState('detecting');
      device.open().then(function () {
        hidDevice = device;
        setState('connected_hid');
        var name = device.productName || 'USB扫码设备';
        toast('已连接：' + name, 'success');
        setScanMode('usb');
        device.addEventListener('inputreport', function (e) {
          var data = new Uint8Array(e.data.buffer);
          var code = parseHidReport(data);
          if (code) {
            handleScan(code);
            markKbActive();
          }
        });
      }).catch(function () {
        setState('disconnected');
        toast('设备连接失败，请重试', 'error');
      });
    }

    /* 解析HID报告为条码字符串（键盘楔入式HID设备通常发送键盘使用码） */
    var _hidBuf = '';
    var HID_KEYMAP = {
      4:'a',5:'b',6:'c',7:'d',8:'e',9:'f',10:'g',11:'h',12:'i',13:'j',
      14:'k',15:'l',16:'m',17:'n',18:'o',19:'p',20:'q',21:'r',22:'s',23:'t',
      24:'u',25:'v',26:'w',27:'x',28:'y',29:'z',30:'1',31:'2',32:'3',33:'4',
      34:'5',35:'6',36:'7',37:'8',38:'9',39:'0',44:' ',45:'-',46:'=',47:'[',
      48:']',49:'\\',51:';',52:"'",53:'`',54:',',55:'.',56:'/'
    };
    var HID_SHIFTMAP = {
      30:'!',31:'@',32:'#',33:'$',34:'%',35:'^',36:'&',37:'*',38:'(',39:')',
      45:'_',46:'+',47:'{',48:'}',49:'|',51:':',52:'"',53:'~',54:'<',55:'>',56:'?'
    };
    function parseHidReport(data) {
      if (!data || data.length < 3) return null;
      var modifier = data[0];
      var key = data[2];
      if (key === 0) return null;
      var shift = !!(modifier & 0x22);
      if (key === 40 || key === 43) {
        var code = _hidBuf;
        _hidBuf = '';
        return code.length >= 3 ? code : null;
      }
      var ch = shift ? (HID_SHIFTMAP[key] || HID_KEYMAP[key] || '') : (HID_KEYMAP[key] || '');
      if (ch) _hidBuf += ch;
      return null;
    }

    /* --- 键盘楔入模式检测 --- */
    function markKbActive() {
      kbConnected = true;
      if (currentState !== 'connected_hid') {
        setState('connected_kb');
      }
      clearTimeout(kbResetTimer);
      kbResetTimer = setTimeout(function () {
        if (currentState === 'connected_kb') {
          setState('disconnected');
          kbConnected = false;
        }
      }, 60000);
    }

    return {
      init: init,
      setState: setState,
      getState: getState,
      markKbActive: markKbActive,
      requestHidDevice: requestHidDevice
    };
  })();

  $('btnCamera').addEventListener('click', toggleCamera);
  $('btnCameraMobile').addEventListener('click', toggleCamera);
  $('btnClear').addEventListener('click', clearAll);
  $('btnExport').addEventListener('click', exportResult);
  var btnTemplate = $('btnTemplate');
  if (btnTemplate) btnTemplate.addEventListener('click', downloadTemplate);
  /* 盘点明细页顶部工具栏 */
  $('btnClearDetail').addEventListener('click', clearAll);
  $('btnExportDetail').addEventListener('click', exportResult);
  $('btnSaveSnapshot').addEventListener('click', saveCurrentSnapshot);
  $('btnExportPreScan').addEventListener('click', exportPreScan);
  $('btnClearPreScan').addEventListener('click', clearPreScan);
  $('btnClearSnapshots').addEventListener('click', clearAllSnapshots);

  /* 快照列表操作委托 */
  var snapshotsListEl = $('snapshotsList');
  if (snapshotsListEl) {
    snapshotsListEl.addEventListener('click', function (e) {
      var t = (e.target && e.target.closest) ? e.target.closest('button[data-act]') : null;
      if (!t) return;
      var act = t.getAttribute('data-act');
      var sid = t.getAttribute('data-sid');
      if (act === 'view')   viewSnapshot(sid);
      if (act === 'compare') compareSnapshot(sid);
      if (act === 'export') exportSnapshot(sid);
      if (act === 'delete') deleteSnapshot(sid);
    });
  }

  /* 对账对比：运行 / 导出 / 筛选 */
  var btnCompareRunEl = $('btnCompareRun');
  if (btnCompareRunEl) btnCompareRunEl.addEventListener('click', function () { runCompare(); });
  var btnExportCompareEl = $('btnExportCompare');
  if (btnExportCompareEl) btnExportCompareEl.addEventListener('click', exportCompare);
  var compareFiltersEl = $('compareFilters');
  if (compareFiltersEl) {
    compareFiltersEl.addEventListener('click', function (e) {
      var t = (e.target && e.target.closest) ? e.target.closest('button[data-cfilter]') : null;
      if (!t) return;
      compareState.filter = t.getAttribute('data-cfilter');
      /* 只切换筛选按钮的 active，搜索按钮不参与 */
      compareFiltersEl.querySelectorAll('button[data-cfilter]').forEach(function (b) {
        b.classList.toggle('active', b === t);
      });
      if (compareState.pager) compareState.pager.reset();
    });
  }
