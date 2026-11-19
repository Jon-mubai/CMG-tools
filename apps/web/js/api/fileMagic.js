/**
 * Author: zcl (MuBai)
 * Date: 2026-10-14
 * Role: Full-Stack Developer
 */
(function () {
  'use strict';

  var SIGS = [
    { mime: 'image/jpeg', ext: ['jpg', 'jpeg'], bytes: [0xFF, 0xD8, 0xFF] },
    { mime: 'image/png', ext: ['png'], bytes: [0x89, 0x50, 0x4E, 0x47] },
    { mime: 'image/gif', ext: ['gif'], bytes: [0x47, 0x49, 0x46, 0x38] },
    { mime: 'image/webp', ext: ['webp'], bytes: [0x52, 0x49, 0x46, 0x46], webp: true },
    { mime: 'image/bmp', ext: ['bmp'], bytes: [0x42, 0x4D] }
  ];

  function matchSig(arr, sig) {
    for (var i = 0; i < sig.bytes.length; i++) {
      if (arr[i] !== sig.bytes[i]) return false;
    }
    if (sig.webp) {
      /* RIFF....WEBP */
      if (arr.length < 12) return false;
      return arr[8] === 0x57 && arr[9] === 0x45 && arr[10] === 0x42 && arr[11] === 0x50;
    }
    return true;
  }

  function detectMimeFromBytes(u8) {
    for (var i = 0; i < SIGS.length; i++) {
      if (matchSig(u8, SIGS[i])) return SIGS[i].mime;
    }
    return '';
  }

  function readFileHead(file, n) {
    n = n || 16;
    return new Promise(function (resolve, reject) {
      var blob = file.slice(0, n);
      var reader = new FileReader();
      reader.onload = function () {
        resolve(new Uint8Array(reader.result));
      };
      reader.onerror = function () { reject(reader.error); };
      reader.readAsArrayBuffer(blob);
    });
  }

  /** @returns {Promise<{ok:boolean, mime?:string, error?:string}>} */
  function validateImageFile(file) {
    if (!file) return Promise.resolve({ ok: false, error: '无文件' });
    return readFileHead(file, 16).then(function (u8) {
      var mime = detectMimeFromBytes(u8);
      if (!mime) return { ok: false, error: '文件内容不是允许的图片格式' };
      var declared = String(file.type || '').toLowerCase();
      if (declared && declared !== mime && !(declared === 'image/jpg' && mime === 'image/jpeg')) {
        /* 声明与魔数不一致时以魔数为准，仍允许（防错误 MIME） */
      }
      return { ok: true, mime: mime };
    }).catch(function () {
      return { ok: false, error: '无法读取文件头' };
    });
  }

  window.CMGFileMagic = {
    detectMimeFromBytes: detectMimeFromBytes,
    validateImageFile: validateImageFile,
    readFileHead: readFileHead
  };
})();
