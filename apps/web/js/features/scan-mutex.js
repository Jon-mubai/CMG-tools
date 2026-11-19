/**
 * Author: zcl (MuBai)
 * Date: 2026-10-14
 * Role: Full-Stack Developer
 */
/* js/features/scan-mutex.js */
/* ===== 扫码互斥（USB / 摄像头 二选一） ===== */
  function setScanMode(mode) {
    scanMode = mode;
    var usbCard = document.querySelector('.scan-card-usb');
    var camCard = document.querySelector('.scan-card-cam');
    if (usbCard) usbCard.classList.toggle('locked', mode === 'camera');
    if (camCard) camCard.classList.toggle('locked', mode === 'usb');
    var inputs = [$('scanInputDesktop'), $('scanInputMobile')];
    var camBtns = [$('btnCamera'), $('btnCameraMobile')];
    inputs.forEach(function (i) {
      if (!i) return;
      i.disabled = mode === 'camera';
      i.placeholder = mode === 'camera' ? '摄像头模式已激活，USB 输入已锁定' : '将光标移至此框后扫码或按回车';
    });
    camBtns.forEach(function (b) {
      if (!b) return;
      b.disabled = mode === 'usb';
      b.title = mode === 'usb' ? 'USB 扫码枪已激活，摄像头已锁定' : '';
    });
    /* 互斥提示徽章 */
    var usbTitle = usbCard ? usbCard.querySelector('.card-title') : null;
    var camTitle = camCard ? camCard.querySelector('.card-title') : null;
    if (usbTitle && mode === 'camera') {
      usbTitle.classList.add('muted'); usbTitle.classList.remove('active');
    } else if (usbTitle && mode === 'usb') {
      usbTitle.classList.add('active'); usbTitle.classList.remove('muted');
    } else if (usbTitle) {
      usbTitle.classList.remove('active', 'muted');
    }
    if (camTitle && mode === 'usb') {
      camTitle.classList.add('muted'); camTitle.classList.remove('active');
    } else if (camTitle && mode === 'camera') {
      camTitle.classList.add('active'); camTitle.classList.remove('muted');
    } else if (camTitle) {
      camTitle.classList.remove('active', 'muted');
    }
  }

  function bindScanInput(el) {
    if (!el) return;
    var autoTimer = null;
    var typeStartTime = 0;

    function tryAutoSubmit() {
      var v = el.value;
      if (!v || !v.trim()) return;
      var duration = Date.now() - typeStartTime;
      if (duration < 1000 && v.trim().length >= 3) {
        el.value = '';
        typeStartTime = 0;
        handleScan(v);
        el.focus();
      }
    }

    el.addEventListener('input', function () {
      var v = el.value;
      if (!v) { typeStartTime = 0; clearTimeout(autoTimer); return; }
      if (typeStartTime === 0) typeStartTime = Date.now();
      clearTimeout(autoTimer);
      autoTimer = setTimeout(tryAutoSubmit, 150);
    });

    el.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        clearTimeout(autoTimer);
        typeStartTime = 0;
        var v = el.value;
        if (!v || !v.trim()) { el.focus(); return; }
        el.value = '';
        handleScan(v);
        el.focus();
      }
    });

    el.addEventListener('blur', function () {
      clearTimeout(autoTimer);
      typeStartTime = 0;
    });
  }
  bindScanInput($('scanInputDesktop'));
  bindScanInput($('scanInputMobile'));

  /* 全局扫码兜底 */
  var _scannerBuf = '';
  var _scannerLast = 0;
  var _scannerTimer = null;
  document.addEventListener('keydown', function (e) {
    var t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
    var now = Date.now();
    if (now - _scannerLast > 120) _scannerBuf = '';
    _scannerLast = now;
    if (e.key && e.key.length === 1) {
      _scannerBuf += e.key;
      clearTimeout(_scannerTimer);
      _scannerTimer = setTimeout(function () {
        if (_scannerBuf.length >= 3) {
          var code = _scannerBuf;
          _scannerBuf = '';
          handleScan(code);
        }
      }, 150);
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      clearTimeout(_scannerTimer);
      if (_scannerBuf.length >= 3) {
        e.preventDefault();
        var code = _scannerBuf;
        _scannerBuf = '';
        handleScan(code);
      } else {
        _scannerBuf = '';
      }
    }
  });
