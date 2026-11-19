/*
 * 作者：zcl（沐白）
 * 时间：2026-10-14
 * 职位：全栈开发
 * 本地二维码适配：用 qrcode-generator 提供与 node-qrcode 类似的 toCanvas API
 */
(function (global) {
  'use strict';
  if (global.QRCode && typeof global.QRCode.toCanvas === 'function') return;

  function toCanvas(canvas, text, opts, cb) {
    opts = opts || {};
    if (typeof opts === 'function') { cb = opts; opts = {}; }
    try {
      if (typeof qrcode === 'undefined') throw new Error('qrcode-generator not loaded');
      var typeNumber = 0;
      var errorCorrectionLevel = 'M';
      var qr = qrcode(typeNumber, errorCorrectionLevel);
      qr.addData(String(text || ''));
      qr.make();
      var cell = opts.width ? Math.floor(opts.width / qr.getModuleCount()) : 4;
      if (cell < 2) cell = 2;
      var margin = opts.margin != null ? opts.margin : 2;
      var size = qr.getModuleCount() * cell + margin * 2 * cell;
      canvas = canvas || document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      var ctx = canvas.getContext('2d');
      ctx.fillStyle = (opts.color && opts.color.light) || '#ffffff';
      ctx.fillRect(0, 0, size, size);
      ctx.fillStyle = (opts.color && opts.color.dark) || '#000000';
      for (var r = 0; r < qr.getModuleCount(); r++) {
        for (var c = 0; c < qr.getModuleCount(); c++) {
          if (qr.isDark(r, c)) {
            ctx.fillRect((c + margin) * cell, (r + margin) * cell, cell, cell);
          }
        }
      }
      if (typeof cb === 'function') cb(null, canvas);
      return Promise.resolve(canvas);
    } catch (e) {
      if (typeof cb === 'function') cb(e);
      return Promise.reject(e);
    }
  }

  global.QRCode = global.QRCode || {};
  global.QRCode.toCanvas = toCanvas;
})(typeof window !== 'undefined' ? window : this);
