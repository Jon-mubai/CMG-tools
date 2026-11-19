/**
 * Author: zcl (MuBai)
 * Date: 2026-10-14
 * Role: Full-Stack Developer
 */
/* js/core/auth.js — 高安全登录门禁 · 双角色 · 权限分配 · 密码哈希永不回显 */
(function () {
  'use strict';

  /* 优先使用 shared 层（构建时已拼入）；缺失时回退本地定义 */
  var _S = (typeof CMGShared !== 'undefined') ? CMGShared : {};
  var AUTH_STORE = _S.AUTH_STORE || 'cmg_auth_vault_v1';
  var SESSION_KEY = _S.SESSION_KEY || 'cmg_session_v1';
  /* 全局会话锁：同一浏览器仅允许一个活跃登录，防止路径复制/多标签并行多账号 */
  var SESSION_LOCK_KEY = _S.SESSION_LOCK_KEY || 'cmg_session_lock_v1';
  var PBKDF2_ITERS = _S.PBKDF2_ITERS || 120000;
  var SALT_BYTES = _S.SALT_BYTES || 16;
  var MAX_FAIL = _S.MAX_FAIL || 5;
  var LOCK_MS = _S.LOCK_MS || (5 * 60 * 1000);
  var SESSION_TTL_MS = _S.SESSION_TTL_MS || (8 * 60 * 60 * 1000);

  /** 功能权限键 — 与 shared/permissions.js、docs/openapi 对齐 */
  var FEATURES = _S.FEATURES || [
    { key: 'dashboard', label: '数据看板' },
    { key: 'scan', label: '扫码盘点（盘点设置）' },
    { key: 'scan-data', label: '盘点数据（盘点设置）' },
    { key: 'wh-park', label: '仓库可视化' },
    { key: 'wh-docs', label: '单据设置' },
    { key: 'wh-stock', label: '库存管理' },
    { key: 'machine-profit', label: '机台毛利' },
    { key: 'machine-ops', label: '运营数据' },
    { key: 'machine-category', label: '品类统计' },
    { key: 'finance-ledger', label: '财务管理' },
    { key: 'help', label: '系统说明' },
    { key: 'admin-users', label: '账号与权限（仅超级管理员）' }
  ];

  /** 仅超级管理员可管理账号/权限；普通管理员与用户均无此权限 */
  function isSuperAdminSession(s) {
    if (!s) return false;
    if (s.role === 'super_admin') return true;
    try {
      var vault = loadVault();
      if (!vault) return false;
      var u = (vault.users || []).find(function (x) { return x && x.id === s.userId && !x.deleted; });
      return !!(u && u.role === 'super_admin');
    } catch (e) { return false; }
  }
  function isPrivilegedRole(role) {
    return role === 'super_admin' || role === 'admin';
  }
  /** 存量库：若无 super_admin，将最早的 admin 提升为超级管理员 */
  function migrateVaultRoles(vault) {
    if (!vault || !Array.isArray(vault.users)) return vault;
    var hasSuper = vault.users.some(function (u) {
      return u && !u.deleted && u.role === 'super_admin';
    });
    if (hasSuper) return vault;
    var admins = vault.users.filter(function (u) {
      return u && !u.deleted && u.role === 'admin';
    }).sort(function (a, b) {
      return (a.createdAt || 0) - (b.createdAt || 0);
    });
    if (admins.length) {
      var pick = admins.find(function (u) { return u.username === 'admin' || u.id === 'u_admin'; }) || admins[0];
      pick.role = 'super_admin';
      pick.features = allFeatureKeys('super_admin');
      pick.updatedAt = Date.now();
      saveVault(vault);
    }
    return vault;
  }

  function $(id) { return document.getElementById(id); }

  function bufToHex(buf) {
    return Array.from(new Uint8Array(buf)).map(function (b) {
      return b.toString(16).padStart(2, '0');
    }).join('');
  }
  function hexToBuf(hex) {
    var len = hex.length / 2;
    var out = new Uint8Array(len);
    for (var i = 0; i < len; i++) out[i] = parseInt(hex.substr(i * 2, 2), 16);
    return out.buffer;
  }
  function randomHex(bytes) {
    var a = new Uint8Array(bytes);
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      crypto.getRandomValues(a);
    } else {
      for (var i = 0; i < bytes; i++) a[i] = Math.floor(Math.random() * 256);
    }
    return bufToHex(a);
  }

  function getSubtle() {
    try {
      if (typeof crypto !== 'undefined' && crypto.subtle && typeof crypto.subtle.importKey === 'function') {
        return crypto.subtle;
      }
    } catch (e) {}
    return null;
  }

  /** 纯 JS SHA-256（仅作 subtle 不可用时的回退，如 file:// 或非安全 HTTP） */
  function sha256Bytes(dataBytes) {
    function rotr(n, x) { return (x >>> n) | (x << (32 - n)); }
    var K = [
      0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
      0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
      0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
      0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
      0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
      0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
      0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
      0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2
    ];
    var h0 = 0x6a09e667, h1 = 0xbb67ae85, h2 = 0x3c6ef372, h3 = 0xa54ff53a;
    var h4 = 0x510e527f, h5 = 0x9b05688c, h6 = 0x1f83d9ab, h7 = 0x5be0cd19;
    var l = dataBytes.length;
    var withOne = new Uint8Array(((l + 9 + 63) & ~63));
    withOne.set(dataBytes);
    withOne[l] = 0x80;
    var bitLen = l * 8;
    withOne[withOne.length - 1] = bitLen & 0xff;
    withOne[withOne.length - 2] = (bitLen >>> 8) & 0xff;
    withOne[withOne.length - 3] = (bitLen >>> 16) & 0xff;
    withOne[withOne.length - 4] = (bitLen >>> 24) & 0xff;
    var w = new Uint32Array(64);
    for (var i = 0; i < withOne.length; i += 64) {
      for (var j = 0; j < 16; j++) {
        var o = i + j * 4;
        w[j] = (withOne[o] << 24) | (withOne[o + 1] << 16) | (withOne[o + 2] << 8) | withOne[o + 3];
      }
      for (var j = 16; j < 64; j++) {
        var s0 = rotr(7, w[j - 15]) ^ rotr(18, w[j - 15]) ^ (w[j - 15] >>> 3);
        var s1 = rotr(17, w[j - 2]) ^ rotr(19, w[j - 2]) ^ (w[j - 2] >>> 10);
        w[j] = (w[j - 16] + s0 + w[j - 7] + s1) | 0;
      }
      var a = h0, b = h1, c = h2, d = h3, e = h4, f = h5, g = h6, h = h7;
      for (var j = 0; j < 64; j++) {
        var S1 = rotr(6, e) ^ rotr(11, e) ^ rotr(25, e);
        var ch = (e & f) ^ (~e & g);
        var t1 = (h + S1 + ch + K[j] + w[j]) | 0;
        var S0 = rotr(2, a) ^ rotr(13, a) ^ rotr(22, a);
        var maj = (a & b) ^ (a & c) ^ (b & c);
        var t2 = (S0 + maj) | 0;
        h = g; g = f; f = e; e = (d + t1) | 0;
        d = c; c = b; b = a; a = (t1 + t2) | 0;
      }
      h0 = (h0 + a) | 0; h1 = (h1 + b) | 0; h2 = (h2 + c) | 0; h3 = (h3 + d) | 0;
      h4 = (h4 + e) | 0; h5 = (h5 + f) | 0; h6 = (h6 + g) | 0; h7 = (h7 + h) | 0;
    }
    var out = new Uint8Array(32);
    var hs = [h0, h1, h2, h3, h4, h5, h6, h7];
    for (var i = 0; i < 8; i++) {
      out[i * 4] = (hs[i] >>> 24) & 0xff;
      out[i * 4 + 1] = (hs[i] >>> 16) & 0xff;
      out[i * 4 + 2] = (hs[i] >>> 8) & 0xff;
      out[i * 4 + 3] = hs[i] & 0xff;
    }
    return out;
  }

  function pbkdf2Sha256Fallback(password, saltHex, iterations, dkLen) {
    var enc = new TextEncoder();
    var pwd = enc.encode(String(password));
    var salt = new Uint8Array(hexToBuf(saltHex));
    var blockCount = Math.ceil(dkLen / 32);
    var result = new Uint8Array(blockCount * 32);
    for (var block = 1; block <= blockCount; block++) {
      var blockBytes = new Uint8Array(4);
      blockBytes[0] = (block >>> 24) & 0xff;
      blockBytes[1] = (block >>> 16) & 0xff;
      blockBytes[2] = (block >>> 8) & 0xff;
      blockBytes[3] = block & 0xff;
      var asalt = new Uint8Array(salt.length + 4);
      asalt.set(salt);
      asalt.set(blockBytes, salt.length);
      /* HMAC-SHA256(password, asalt) via hash(o_key XOR opad || hash(i_key XOR ipad || msg)) simplified: use sha256(pwd||msg) chain */
      /* 简化版：迭代 sha256(pwd || salt || counter || prev) —— 与 WebCrypto PBKDF2 不互通，仅用于非安全上下文本地库 */
      var prev = sha256Bytes(function () {
        var x = new Uint8Array(pwd.length + asalt.length);
        x.set(pwd); x.set(asalt, pwd.length); return x;
      }());
      var out = prev.slice();
      for (var i = 1; i < iterations; i++) {
        var mixed = new Uint8Array(pwd.length + prev.length);
        mixed.set(pwd); mixed.set(prev, pwd.length);
        prev = sha256Bytes(mixed);
        for (var j = 0; j < 32; j++) out[j] ^= prev[j];
      }
      result.set(out, (block - 1) * 32);
    }
    return bufToHex(result.subarray(0, dkLen).buffer);
  }

  function hashPassword(password, saltHex) {
    var subtle = getSubtle();
    if (subtle) {
      var enc = new TextEncoder();
      var salt = hexToBuf(saltHex);
      return subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits'])
        .then(function (key) {
          return subtle.deriveBits(
            { name: 'PBKDF2', salt: salt, iterations: PBKDF2_ITERS, hash: 'SHA-256' },
            key,
            256
          );
        })
        .then(function (bits) { return bufToHex(bits); });
    }
    /* S1：默认禁止弱回退；仅演示开关 window.__CMG_ALLOW_INSECURE_CRYPTO__ = true */
    if (typeof window !== 'undefined' && window.__CMG_ALLOW_INSECURE_CRYPTO__) {
      var iters = Math.min(PBKDF2_ITERS, 12000);
      return new Promise(function (resolve) {
        setTimeout(function () {
          resolve(pbkdf2Sha256Fallback(password, saltHex, iters, 32));
        }, 0);
      });
    }
    return Promise.reject(new Error('当前非安全上下文，无法加密密码。请使用 http://localhost 访问，或启动 backend 使用服务端登录。'));
  }

  function timingSafeEqual(a, b) {
    if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
    var diff = 0;
    for (var i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
    return diff === 0;
  }

  function loadVault() {
    try {
      var raw = localStorage.getItem(AUTH_STORE);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) {
      console.warn('[Auth] localStorage 不可用（Tracking Prevention / 隐私模式）', e);
      return null;
    }
  }
  function saveVault(vault) {
    try {
      localStorage.setItem(AUTH_STORE, JSON.stringify(vault));
    } catch (e) {
      console.warn('[Auth] 无法写入 localStorage', e);
    }
  }

  function allFeatureKeys(role) {
    return FEATURES.map(function (f) {
      /* admin-users 仅超级管理员拥有 */
      if (f.key === 'admin-users' && role !== 'super_admin') return null;
      return f.key;
    }).filter(Boolean);
  }

  function ensureVault() {
    var v = loadVault();
    if (v && Array.isArray(v.users) && v.users.length) {
      migrateVaultRoles(v);
      return Promise.resolve(v);
    }
    var salt = randomHex(SALT_BYTES);
    /* S1：禁止源码固定口令；首次生成随机密码，仅弹窗展示一次 */
    var bootstrapPwd = (function () {
      var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$';
      var a = new Uint8Array(16);
      if (typeof crypto !== 'undefined' && crypto.getRandomValues) crypto.getRandomValues(a);
      else for (var i = 0; i < 16; i++) a[i] = Math.floor(Math.random() * 256);
      var s = '';
      for (var j = 0; j < 16; j++) s += chars[a[j] % chars.length];
      return s;
    })();
    return hashPassword(bootstrapPwd, salt).then(function (hash) {
      v = {
        version: 1,
        createdAt: Date.now(),
        users: [{
          id: 'u_admin',
          username: 'admin',
          role: 'super_admin',
          salt: salt,
          hash: hash,
          mustChangePwd: true,
          enabled: true,
          isBootstrap: true,
          features: allFeatureKeys('super_admin'),
          createdAt: Date.now(),
          updatedAt: Date.now()
        }],
        failLog: {},
        bootstrapActive: true
      };
      saveVault(v);
      /* 服务端登录为主：不再弹窗展示本地演示库初始密码 */
      try { console.info('[Auth] local vault ready (silent)'); } catch (e) {}
      return v;
    }).catch(function (err) {
      console.error('[Auth] ensureVault 失败:', err);
      try {
        if (typeof window.showModal === 'function') {
          window.showModal(String(err && err.message || err), 'alert');
        }
      } catch (e2) {}
      return { version: 1, users: [], createdAt: Date.now(), failLog: {}, _broken: true };
    });
  }

  var IDLE_MS = 30 * 60 * 1000;

  function readSessionLock() {
    try {
      var raw = localStorage.getItem(SESSION_LOCK_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) { return null; }
  }
  function writeSessionLock(s) {
    try {
      localStorage.setItem(SESSION_LOCK_KEY, JSON.stringify({
        sessionId: s.sessionId,
        userId: s.userId,
        username: s.username,
        token: s.token,
        at: Date.now()
      }));
    } catch (e) {}
  }
  function clearSessionLock() {
    try { localStorage.removeItem(SESSION_LOCK_KEY); } catch (e) {}
  }
  /** 从用户库同步角色等到会话，避免迁移后仍按旧 role 鉴权 */
  function syncSessionWithVault(s) {
    if (!s || !s.userId) return s;
    /* 服务端会话不依赖本地 vault */
    if (s.source === 'server') return s;
    try {
      var vault = loadVault();
      if (!vault || !Array.isArray(vault.users)) return s;
      var u = vault.users.find(function (x) { return x && x.id === s.userId && !x.deleted; });
      if (!u) return s;
      if (!u.enabled) return null;
      s.role = u.role;
      s.username = u.username;
      s.features = (u.features || []).slice();
      s.mustChangePwd = !!u.mustChangePwd;
    } catch (e) {}
    return s;
  }
  function getSession() {
    try {
      var raw = sessionStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      var s = JSON.parse(raw);
      if (!s || !s.token || !s.exp || Date.now() > s.exp) {
        sessionStorage.removeItem(SESSION_KEY);
        return null;
      }
      if (s.lastSeen && Date.now() - s.lastSeen > IDLE_MS) {
        sessionStorage.removeItem(SESSION_KEY);
        return null;
      }
      /* 兼容旧会话：补全 sessionId */
      if (!s.sessionId) {
        s.sessionId = randomHex(16);
      }
      var lock = readSessionLock();
      if (!lock) {
        /* 无全局锁时重建（隐私模式/首次），不踢掉本页合法会话 */
        writeSessionLock(s);
      } else if (lock.sessionId !== s.sessionId || (lock.token && lock.token !== s.token)) {
        /* 其它标签页已登录不同会话 → 本页作废 */
        try { sessionStorage.removeItem(SESSION_KEY); } catch (e0) {}
        return null;
      }
      s = syncSessionWithVault(s);
      if (!s) {
        try { sessionStorage.removeItem(SESSION_KEY); } catch (e1) {}
        return null;
      }
      s.lastSeen = Date.now();
      try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(s)); } catch (e2) {}
      return s;
    } catch (e) {
      try { sessionStorage.removeItem(SESSION_KEY); } catch (e3) {}
      return null;
    }
  }
  function setSession(user) {
    var s = {
      token: randomHex(32),
      sessionId: randomHex(16),
      userId: user.id,
      username: user.username,
      role: user.role,
      features: (user.features || []).slice(),
      mustChangePwd: !!user.mustChangePwd,
      exp: Date.now() + SESSION_TTL_MS,
      lastSeen: Date.now()
    };
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(s));
    /* 写入全局锁：同一浏览器仅一个活跃会话，换账号登录会覆盖锁 */
    writeSessionLock(s);
    return s;
  }
  function clearSession() {
    try {
      var raw = sessionStorage.getItem(SESSION_KEY);
      if (raw) {
        var s = JSON.parse(raw);
        var lock = readSessionLock();
        /* 仅当本页持有当前锁时才清全局锁，避免误清其它标签新登录 */
        if (lock && s && lock.sessionId === s.sessionId) clearSessionLock();
      }
    } catch (e) {}
    try { sessionStorage.removeItem(SESSION_KEY); } catch (e2) {}
  }

  function publicUser(u) {
    return {
      id: u.id,
      username: u.username,
      role: u.role,
      enabled: !!u.enabled,
      mustChangePwd: !!u.mustChangePwd,
      features: (u.features || []).slice(),
      createdAt: u.createdAt,
      updatedAt: u.updatedAt
    };
  }

  function findUser(vault, username) {
    var name = String(username || '').trim().toLowerCase();
    return (vault.users || []).find(function (u) {
      return String(u.username || '').toLowerCase() === name;
    }) || null;
  }

  function isLocked(vault, username) {
    var key = String(username || '').trim().toLowerCase();
    var log = (vault.failLog && vault.failLog[key]) || null;
    if (!log) return false;
    if (log.count >= MAX_FAIL && log.until && Date.now() < log.until) return true;
    if (log.until && Date.now() >= log.until) {
      delete vault.failLog[key];
      saveVault(vault);
      return false;
    }
    return false;
  }
  function recordFail(vault, username) {
    var key = String(username || '').trim().toLowerCase();
    if (!vault.failLog) vault.failLog = {};
    var log = vault.failLog[key] || { count: 0, until: 0 };
    log.count += 1;
    if (log.count >= MAX_FAIL) log.until = Date.now() + LOCK_MS;
    vault.failLog[key] = log;
    saveVault(vault);
    return log;
  }
  function clearFail(vault, username) {
    var key = String(username || '').trim().toLowerCase();
    if (vault.failLog && vault.failLog[key]) {
      delete vault.failLog[key];
      saveVault(vault);
    }
  }

  function loginLocal(username, password) {
    return ensureVault().then(function (vault) {
      username = String(username || '').trim();
      password = String(password || '');
      if (!username || !password) return { ok: false, error: '请输入账号名称和密码' };
      if (isLocked(vault, username)) {
        return { ok: false, error: '尝试次数过多，账号已临时锁定，请约 5 分钟后再试' };
      }
      var user = findUser(vault, username);
      if (!user || !user.enabled) {
        recordFail(vault, username);
        return { ok: false, error: '账号或密码错误' };
      }
      return hashPassword(password, user.salt).then(function (h) {
        if (!timingSafeEqual(h, user.hash)) {
          var log = recordFail(vault, username);
          var left = Math.max(0, MAX_FAIL - log.count);
          return {
            ok: false,
            error: left > 0
              ? ('账号或密码错误（还可尝试 ' + left + ' 次）')
              : '尝试次数过多，账号已临时锁定约 5 分钟'
          };
        }
        clearFail(vault, username);
        var session = setSession(user);
        /* 本地登录无 JWT：清掉可能残留的伪 token，避免 401 */
        try {
          if (typeof CMGApi !== 'undefined') {
            if (CMGApi.setToken) CMGApi.setToken('');
            if (CMGApi.setMode) CMGApi.setMode('local');
          }
        } catch (eClr) {}
        return { ok: true, session: session, mustChangePwd: !!user.mustChangePwd, source: 'local' };
      });
    });
  }

  /** 服务端登录：CMGApi.login → 写入本地会话形态，便于现有菜单权限复用 */
  var BACKEND_DOWN_MSG = '系统服务暂不可用，请稍后重试或联系管理员。';

  function notifyBackendDown(msg) {
    msg = msg || BACKEND_DOWN_MSG;
    if (typeof window.showModal === 'function') {
      window.showModal(msg, 'alert');
    } else if (typeof showModal === 'function') {
      showModal(msg, 'alert');
    } else if (typeof window.toast === 'function') {
      window.toast(msg, 'error');
    } else {
      try { alert(msg); } catch (e) {}
    }
  }

  /** 探测 backend /health，超时视为未启动 */
  function checkBackendReady(timeoutMs) {
    timeoutMs = timeoutMs || 2500;
    var bases = [];
    if (typeof CMGApi !== 'undefined' && CMGApi.getBase) bases.push(CMGApi.getBase());
    /* 静态站在 :8080 时 /api 常无反代，回退直连 backend :3001 */
    bases.push('http://127.0.0.1:3001/api/v1');
    bases.push('http://localhost:3001/api/v1');
    var uniq = [];
    bases.forEach(function (b) {
      if (b && uniq.indexOf(b) < 0) uniq.push(b);
    });
    function tryOne(i) {
      if (i >= uniq.length) return Promise.resolve(false);
      var base = uniq[i];
      var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
      var timer = setTimeout(function () {
        if (ctrl) try { ctrl.abort(); } catch (e) {}
      }, timeoutMs);
      var opts = { method: 'GET', credentials: 'omit' };
      if (ctrl) opts.signal = ctrl.signal;
      return fetch(base + '/health', opts)
        .then(function (res) {
          clearTimeout(timer);
          /* 能连上端口即视为后端已启动（2xx/4xx 均可；仅网络失败才重试） */
          if (res.status > 0) {
            if (typeof window !== 'undefined') window.CMG_API_BASE = base;
            return true;
          }
          return tryOne(i + 1);
        })
        .catch(function () {
          clearTimeout(timer);
          return tryOne(i + 1);
        });
    }
    return tryOne(0);
  }

  function loginServer(username, password) {
    username = String(username || '').trim();
    password = String(password || '');
    if (!username || !password) {
      return Promise.resolve({ ok: false, error: '请输入账号名称和密码' });
    }
    if (typeof CMGApi === 'undefined' || !CMGApi.login) {
      notifyBackendDown('登录服务暂不可用');
      return Promise.resolve({ ok: false, error: '登录服务暂不可用' });
    }
    var prevMode = CMGApi.getMode ? CMGApi.getMode() : 'local';
    return checkBackendReady(2500).then(function (ok) {
      if (!ok) {
        notifyBackendDown(BACKEND_DOWN_MSG);
                if (CMGApi.setMode) CMGApi.setMode(prevMode === 'http' ? 'local' : prevMode);
        return { ok: false, error: BACKEND_DOWN_MSG };
      }
      if (CMGApi.setMode) CMGApi.setMode('http');
      return CMGApi.login(username, password).then(function (data) {
        if (!data || !data.user) {
          return { ok: false, error: '登录失败，请稍后重试' };
        }
        var u = data.user;
        var session = {
          token: data.token || randomHex(24),
          sessionId: randomHex(16),
          userId: u.userId,
          username: u.username,
          role: u.role,
          features: u.features || [],
          mustChangePwd: !!u.mustChangePwd,
          exp: Date.now() + SESSION_TTL_MS,
          lastSeen: Date.now(),
          source: 'server'
        };
        try {
          sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
          writeSessionLock(session);
        } catch (e) {}
        if (data.token && CMGApi.setToken) CMGApi.setToken(data.token);
        return { ok: true, session: session, mustChangePwd: !!u.mustChangePwd, source: 'server' };
      }).catch(function (err) {
        if (CMGApi.setMode) CMGApi.setMode(prevMode);
        var msg = (err && err.data && (err.data.message || err.data.error)) || (err && err.message) || '登录失败';
        if (Array.isArray(msg)) msg = msg.join('; ');
        if (/^Unauthorized$/i.test(String(msg))) msg = '账号或密码错误';
        if (err && (err.status === 0 || err.name === 'TypeError')) {
          msg = BACKEND_DOWN_MSG;
          notifyBackendDown(msg);
                  } else if (err && err.status === 501) {
          msg = '登录服务异常，请稍后重试';
          notifyBackendDown(msg);
        }
        return { ok: false, error: msg };
      });
    });
  }

  /**
   * @param {string} username
   * @param {string} password
   * @param {{ useServer?: boolean }} [opts]
   */
  function login(username, password, opts) {
    opts = opts || {};
    /* 统一走服务端登录：账号与业务数据写入 PostgreSQL，不再提供本地登录开关 */
    return loginServer(username, password);
  }

  function logout() {
    closeAccountPanel();
    clearSession();
    if (typeof CMGApi !== 'undefined' && CMGApi.logout) {
      try { CMGApi.logout(); } catch (e) {}
    }
    if (typeof CMGApi !== 'undefined' && CMGApi.setToken) CMGApi.setToken('');
    showGate(true);
    try {
      if (location.hash !== '#/login') history.replaceState(null, '', '#/login');
    } catch (e2) {}
  }

  /** 其它标签页登录/登出时同步：强制单一活跃会话 */
  function onSessionLockChanged() {
    var s = null;
    try {
      var raw = sessionStorage.getItem(SESSION_KEY);
      if (raw) s = JSON.parse(raw);
    } catch (e) { s = null; }
    var lock = readSessionLock();
    if (!s) {
      if (!requireAuth()) {
        showGate(true);
        try { if (location.hash !== '#/login') history.replaceState(null, '', '#/login'); } catch (e1) {}
      }
      return;
    }
    if (!lock || lock.sessionId !== s.sessionId || lock.token !== s.token) {
      try { sessionStorage.removeItem(SESSION_KEY); } catch (e2) {}
      showGate(true);
      try { if (location.hash !== '#/login') history.replaceState(null, '', '#/login'); } catch (e3) {}
      if (typeof toast === 'function') {
        toast('账号已在其它标签页登录或登出，本页会话已失效，请重新登录', 'warning');
      }
    }
  }
  if (!window.__cmgSessionLockBound) {
    window.__cmgSessionLockBound = true;
    window.addEventListener('storage', function (e) {
      if (e.key === SESSION_LOCK_KEY) onSessionLockChanged();
    });
  }

  function current() {
    return getSession();
  }

  function hasFeature(key) {
    var s = getSession();
    if (!s) return false;
    /* 超级管理员 / 普通管理员：业务功能全开；账号管理仅超管 */
    if (key === 'admin-users') return isSuperAdminSession(s);
    if (isPrivilegedRole(s.role)) return true;
    var feats = s.features || [];
    if (feats.indexOf(key) >= 0) return true;
    /* 勾选「财务管理」后，全部子页与审核中心均可使用 */
    if (key && (String(key).indexOf('finance-') === 0 || String(key).indexOf('review-') === 0)) {
      return feats.indexOf('finance-ledger') >= 0;
    }
    return false;
  }

  function requireAuth() {
    return !!getSession();
  }

  /* —— UI —— */
  function markAuthReady(needLogin) {
    var html = document.documentElement;
    /* 先进入 settling：继续禁止过渡，再切 ready，避免闪屏抖动 */
    html.classList.add('auth-settling');
    html.classList.remove('auth-boot', 'auth-need-login', 'auth-has-session');
    html.classList.add('auth-ready');
    html.classList.add(needLogin ? 'auth-need-login' : 'auth-has-session');
    document.body.classList.remove('auth-pending');
    /* 双 rAF + 短延时后解除 settling，再允许过渡 */
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        setTimeout(function () {
          html.classList.remove('auth-settling', 'sidebar-boot-collapsed');
        }, 120);
      });
    });
  }

  function setLoginRoute() {
    try {
      if (location.hash !== '#/login') history.replaceState(null, '', '#/login');
    } catch (e) {
      location.hash = '#/login';
    }
  }
  function setDefaultAppRoute() {
    var h = (location.hash || '').replace(/^#/, '');
    if (!h || h === '/login' || h === 'login') {
      try {
        history.replaceState(null, '', '#/dashboard');
      } catch (e) {
        location.hash = '#/dashboard';
      }
      if (typeof window.switchPage === 'function') {
        try { window.switchPage('dashboard'); } catch (e2) {}
      } else if (typeof _applyPage === 'function') {
        try { _applyPage('dashboard'); } catch (e3) {}
      }
    }
  }
  function showGate(show) {
    if (show) setLoginRoute();
    var html = document.documentElement;
    html.classList.add('auth-settling');
    var gate = $('authGate');
    var app = document.querySelector('.app-layout');
    if (gate) {
      if (show) {
        gate.hidden = false;
        gate.removeAttribute('hidden');
        gate.classList.add('is-open');
        gate.style.display = 'flex';
        gate.style.visibility = 'visible';
        gate.style.opacity = '1';
      } else {
        gate.hidden = true;
        gate.setAttribute('hidden', '');
        gate.classList.remove('is-open');
        gate.style.display = 'none';
        gate.style.visibility = 'hidden';
        gate.style.opacity = '0';
      }
    }
    if (app) {
      if (show) {
        app.style.visibility = 'hidden';
        app.style.opacity = '0';
        app.style.pointerEvents = 'none';
      } else {
        app.style.visibility = 'visible';
        app.style.opacity = '1';
        app.style.pointerEvents = '';
      }
    }
    document.body.classList.toggle('auth-locked', !!show);
    if (!show) {
      document.body.style.background = '#ffffff';
    } else {
      document.body.style.background = '#0a0a0a';
    }
    markAuthReady(!!show);
  }

  var _contactUrlCache = '';
  function getContactUrl() {
    /* 建议6：优先使用服务端 /meta/config 下发；否则回退本地混淆串 */
    if (_contactUrlCache) return _contactUrlCache;
    if (typeof window !== 'undefined' && window.__CMG_CONTACT_URL__) {
      _contactUrlCache = String(window.__CMG_CONTACT_URL__);
      return _contactUrlCache;
    }
    var parts = [104,116,116,112,115,58,47,47,113,109,46,113,113,46,99,111,109,47,113,47,99,106,53,120,111,98,55,68,109,85];
    return String.fromCharCode.apply(null, parts);
  }

  function refreshContactConfig() {
    if (typeof CMGApi === 'undefined' || !CMGApi.getMode || CMGApi.getMode() !== 'http') return;
    var base = CMGApi.getBase ? CMGApi.getBase() : '/api/v1';
    fetch(base + '/meta/config').then(function (r) { return r.json(); }).then(function (cfg) {
      if (cfg && cfg.contactAdminUrl) {
        _contactUrlCache = String(cfg.contactAdminUrl);
        window.__CMG_CONTACT_URL__ = _contactUrlCache;
      }
    }).catch(function () {});
  }

  var authQrRefreshTimer = null;
  var AUTH_QR_REFRESH_SEC = 12;

  function clearAuthQrTimer() {
    if (authQrRefreshTimer) {
      clearTimeout(authQrRefreshTimer);
      authQrRefreshTimer = null;
    }
    if (typeof clearAuthQrCountdown === 'function') clearAuthQrCountdown();
  }

  function renderAdminContactQr(fromRefresh) {
    var canvas = $('authAdminQrCanvas');
    var fallback = $('authQrFallback');
    var tip = $('authQrTip');
    if (!canvas) return;
    var url = getContactUrl();
    /* 带时间戳，保证每次绘制内容变化（防缓存、可感知刷新） */
    try {
      var sep = url.indexOf('?') >= 0 ? '&' : '?';
      url = url + sep + '_t=' + Date.now();
    } catch (eT) {}
    function fail() {
      if (fallback) fallback.hidden = false;
      canvas.style.display = 'none';
      if (tip) tip.textContent = '二维码加载失败，请切换页签后重试';
    }
    function ok() {
      canvas.style.display = 'block';
      if (fallback) fallback.hidden = true;
      if (tip) {
        var base = fromRefresh
          ? '二维码已自动刷新，请使用手机扫描'
          : '请使用手机扫描二维码联系管理员';
        tip.innerHTML = base + ' · <span id="authQrCountdown">' + AUTH_QR_REFRESH_SEC + '</span>s 后刷新';
      }
      /* 绘制成功后重新启动倒计时循环 */
      scheduleAuthQrRefreshLoop();
    }
    try {
      if (typeof QRCode !== 'undefined' && QRCode.toCanvas) {
        QRCode.toCanvas(canvas, url, {
          width: 200,
          margin: 1,
          color: { dark: '#0f172a', light: '#ffffff' }
        }, function (err) {
          if (err) fail();
          else ok();
        });
      } else {
        console.warn('[Auth] QRCode.toCanvas 不可用，请确认已加载 vendor/qrcode-adapter.js');
        fail();
      }
    } catch (e) {
      fail();
    }
  }

  var authQrCountdownTimer = null;

  function clearAuthQrCountdown() {
    if (authQrCountdownTimer) {
      clearInterval(authQrCountdownTimer);
      authQrCountdownTimer = null;
    }
  }

  /** 每 12 秒循环刷新二维码；倒计时归零后立即重绘并重新计时 */
  function scheduleAuthQrRefreshLoop() {
    clearAuthQrTimer();
    clearAuthQrCountdown();
    var left = AUTH_QR_REFRESH_SEC;
    function paint() {
      var el = $('authQrCountdown');
      if (el) el.textContent = String(Math.max(0, left));
    }
    paint();
    authQrCountdownTimer = setInterval(function () {
      left -= 1;
      if (left <= 0) {
        clearAuthQrCountdown();
        paint();
        return;
      }
      paint();
    }, 1000);
    authQrRefreshTimer = setTimeout(function () {
      authQrRefreshTimer = null;
      clearAuthQrCountdown();
      renderAdminContactQr(true);
    }, AUTH_QR_REFRESH_SEC * 1000);
  }

  function switchAuthView(name) {
    document.querySelectorAll('[data-auth-view]').forEach(function (el) {
      el.hidden = el.getAttribute('data-auth-view') !== name;
    });
    document.querySelectorAll('[data-auth-tab]').forEach(function (btn) {
      btn.classList.toggle('active', btn.getAttribute('data-auth-tab') === name);
    });
    if (name === 'contact') {
      clearAuthQrTimer();
      renderAdminContactQr(false);
    } else {
      clearAuthQrTimer();
    }
  }

  function applyMenuPermissions() {
    var s = getSession();
    if (!s) return;
    document.querySelectorAll('#sidebarMenu .menu-item[data-page]').forEach(function (item) {
      var page = item.getAttribute('data-page');
      var allow = hasFeature(page);
      item.style.display = allow ? '' : 'none';
    });
    document.querySelectorAll('#sidebarMenu .menu-group').forEach(function (grp) {
      var visible = Array.prototype.some.call(grp.querySelectorAll('.menu-item[data-page]'), function (it) {
        return it.style.display !== 'none';
      });
      grp.style.display = visible ? '' : 'none';
    });
    var adminItem = document.querySelector('.menu-item[data-page="admin-users"]');
    if (adminItem) adminItem.style.display = isSuperAdminSession(s) ? '' : 'none';
    var roleLabel = s.role === 'super_admin' ? '超级管理员' : (s.role === 'admin' ? '管理员' : '普通用户');
    var label = $('accountLabel');
    if (label) label.textContent = s.username + ' · ' + roleLabel;
    var email = document.querySelector('.account-email');
    if (email) email.textContent = s.username;
    var hint = document.querySelector('.account-hint');
    if (hint) hint.textContent = roleLabel;
  }

  function closeAccountPanel() {
    var accBtn = $('sidebarAccountBtn');
    var accPanel = $('sidebarAccountPanel');
    var accRoot = $('sidebarAccount');
    if (accBtn) accBtn.setAttribute('aria-expanded', 'false');
    if (accPanel) {
      accPanel.setAttribute('hidden', '');
      accPanel.hidden = true;
      accPanel.style.display = 'none';
    }
    if (accRoot) accRoot.classList.remove('is-open');
  }
  /** 兼容旧调用名 */
  function closeSidebarAccountPanel() {
    closeAccountPanel();
  }

  function openChangePwdModal(forced) {
    var box = $('authChangePwd');
    if (!box) return;
    closeAccountPanel();
    closeSidebarAccountPanel();
    box.hidden = false;
    box.removeAttribute('hidden');
    box.classList.add('is-open');
    box.setAttribute('data-forced', forced ? '1' : '0');
    var tip = $('authChangePwdTip');
    if (tip) tip.textContent = forced
      ? '首次登录或密码已重置，必须修改密码后才能继续使用。'
      : '请设置新密码（至少 8 位，含字母与数字）。';
    ['authOldPwd', 'authNewPwd', 'authNewPwd2'].forEach(function (id) {
      var el = $(id);
      if (el) el.value = '';
    });
    var err = $('authChangePwdError');
    if (err) err.textContent = '';
    if ($('authOldPwdWrap')) $('authOldPwdWrap').style.display = forced ? 'none' : '';
    /* 强制改密时取消 = 退出；主动改密可取消关闭 */
    var cancelBtn = $('authChangePwdCancel');
    if (cancelBtn) cancelBtn.style.display = '';
  }
  function closeChangePwdModal() {
    var box = $('authChangePwd');
    if (!box) return;
    box.classList.remove('is-open');
    box.hidden = true;
    box.setAttribute('hidden', '');
    box.removeAttribute('data-forced');
    ['authOldPwd', 'authNewPwd', 'authNewPwd2'].forEach(function (id) {
      var el = $(id);
      if (el) el.value = '';
    });
    var err = $('authChangePwdError');
    if (err) err.textContent = '';
    closeAccountPanel();
  }

  function changePassword(oldPwd, newPwd, newPwd2, forced) {
    var s = getSession();
    if (!s) return Promise.resolve({ ok: false, error: '未登录' });
    newPwd = String(newPwd || '');
    newPwd2 = String(newPwd2 || '');
    if (newPwd.length < 8 || !/[A-Za-z]/.test(newPwd) || !/[0-9]/.test(newPwd)) {
      return Promise.resolve({ ok: false, error: '新密码至少 8 位，且需同时包含字母和数字' });
    }
    if (newPwd !== newPwd2) return Promise.resolve({ ok: false, error: '两次输入的新密码不一致' });
    if (s.source === 'server' || (s.token && String(s.token).split('.').length === 3)) {
      if (typeof CMGApi === 'undefined' || !CMGApi.getToken || !CMGApi.getToken()) {
        return Promise.resolve({ ok: false, error: '登录已失效，请重新登录' });
      }
      var base = (CMGApi.getBase && CMGApi.getBase()) || '/api/v1';
      return fetch(base + '/auth/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + CMGApi.getToken()
        },
        credentials: 'include',
        body: JSON.stringify({ oldPassword: String(oldPwd || ''), newPassword: newPwd })
      }).then(function (res) {
        return res.text().then(function (text) {
          var data = null;
          try { data = text ? JSON.parse(text) : null; } catch (e) { data = { message: text }; }
          if (!res.ok) {
            var msg = (data && (data.message || data.error)) || '修改失败';
            if (Array.isArray(msg)) msg = msg.join('; ');
            if (/unauthor/i.test(String(msg))) msg = '原密码不正确或登录已失效';
            return { ok: false, error: String(msg) };
          }
          s.mustChangePwd = false;
          try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(s)); } catch (e2) {}
          return { ok: true };
        });
      }).catch(function () {
        return { ok: false, error: '网络异常，请稍后重试' };
      });
    }
    return ensureVault().then(function (vault) {
      var user = vault.users.find(function (u) { return u.id === s.userId; });
      if (!user) return { ok: false, error: '用户不存在' };
      var chain = Promise.resolve(true);
      if (!forced) {
        chain = hashPassword(String(oldPwd || ''), user.salt).then(function (h) {
          return timingSafeEqual(h, user.hash);
        });
      }
      return chain.then(function (okOld) {
        if (!okOld) return { ok: false, error: '原密码不正确' };
        var salt = randomHex(SALT_BYTES);
        return hashPassword(newPwd, salt).then(function (hash) {
          var wasBootstrap = !!(user.isBootstrap || vault.bootstrapActive);
          user.salt = salt;
          user.hash = hash;
          user.mustChangePwd = false;
          user.updatedAt = Date.now();
          /* 首次改密后销毁示例超级管理员凭据：清除引导标记，旧初始密码永久失效 */
          if (wasBootstrap) {
            user.isBootstrap = false;
            vault.bootstrapActive = false;
            vault.bootstrapDestroyedAt = Date.now();
            /* 轮换用户 id，使旧会话/缓存中的示例身份彻底失效 */
            var oldId = user.id;
            user.id = 'u_' + Date.now().toString(36) + randomHex(4);
            user.bootstrapDestroyed = true;
            /* 清理其它可能残留的引导会话字段 */
            if (vault.users) {
              vault.users.forEach(function (u) {
                if (u && u.id === oldId) { /* already same ref */ }
              });
            }
          }
          saveVault(vault);
          setSession(user);
          return {
            ok: true,
            bootstrapDestroyed: wasBootstrap,
            message: wasBootstrap ? '示例超级管理员凭据已销毁，请使用新密码登录' : undefined
          };
        });
      });
    });
  }

  /* —— 管理员：账号与权限（密码永不回显） —— */
  function listUsersPublic() {
    var s = getSession();
    if (!isSuperAdminSession(s)) return [];
    var v = loadVault();
    if (!v) return [];
    return v.users.map(publicUser);
  }

  function createUser(username, password, role, features) {
    var s = getSession();
    if (!isSuperAdminSession(s)) return Promise.resolve({ ok: false, error: '仅超级管理员可新增账号' });
    username = String(username || '').trim();
    password = String(password || '');
    /* 不可通过界面创建第二个超级管理员 */
    role = role === 'admin' ? 'admin' : 'user';
    if (!/^[a-zA-Z0-9_\u4e00-\u9fa5.-]{2,32}$/.test(username)) {
      return Promise.resolve({ ok: false, error: '账号名 2–32 位，支持中英文、数字、_.-' });
    }
    if (password.length < 8 || !/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
      return Promise.resolve({ ok: false, error: '密码至少 8 位，且需同时包含字母和数字' });
    }
    return ensureVault().then(function (vault) {
      if (findUser(vault, username)) return { ok: false, error: '账号已存在' };
      var salt = randomHex(SALT_BYTES);
      return hashPassword(password, salt).then(function (hash) {
        var feats = isPrivilegedRole(role)
          ? allFeatureKeys(role)
          : (Array.isArray(features) ? features.filter(function (k) { return k !== 'admin-users'; }) : allFeatureKeys('user').filter(function (k) { return k !== 'admin-users'; }));
        vault.users.push({
          id: 'u_' + Date.now().toString(36) + randomHex(3),
          username: username,
          role: role,
          salt: salt,
          hash: hash,
          mustChangePwd: true,
          enabled: true,
          features: feats,
          createdAt: Date.now(),
          updatedAt: Date.now()
        });
        saveVault(vault);
        return { ok: true };
      });
    });
  }

  function resetUserPassword(userId, newPassword) {
    var s = getSession();
    if (!isSuperAdminSession(s)) return Promise.resolve({ ok: false, error: '仅超级管理员可重置密码' });
    newPassword = String(newPassword || '');
    if (newPassword.length < 8 || !/[A-Za-z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      return Promise.resolve({ ok: false, error: '密码至少 8 位，且需同时包含字母和数字' });
    }
    return ensureVault().then(function (vault) {
      var user = vault.users.find(function (u) { return u.id === userId; });
      if (!user) return { ok: false, error: '用户不存在' };
      var salt = randomHex(SALT_BYTES);
      return hashPassword(newPassword, salt).then(function (hash) {
        user.salt = salt;
        user.hash = hash;
        user.mustChangePwd = true;
        user.updatedAt = Date.now();
        saveVault(vault);
        return { ok: true };
      });
    });
  }

  function updateUserMeta(userId, patch) {
    var s = getSession();
    if (!isSuperAdminSession(s)) return { ok: false, error: '仅超级管理员可编辑账号与权限' };
    var vault = loadVault();
    if (!vault) return { ok: false, error: '数据异常' };
    var user = vault.users.find(function (u) { return u.id === userId; });
    if (!user) return { ok: false, error: '用户不存在' };
    if (user.role === 'super_admin' && user.id === s.userId) {
      if (patch.role && patch.role !== 'super_admin') {
        return { ok: false, error: '不能取消自己的超级管理员身份' };
      }
      if (typeof patch.enabled === 'boolean' && !patch.enabled) {
        return { ok: false, error: '不能禁用当前超级管理员账号' };
      }
    }
    if (patch.role === 'admin' || patch.role === 'user') {
      if (user.role === 'super_admin') {
        return { ok: false, error: '不能降级超级管理员' };
      }
      user.role = patch.role;
      if (isPrivilegedRole(user.role)) user.features = allFeatureKeys(user.role);
    }
    if (typeof patch.enabled === 'boolean') {
      if (user.id === s.userId && !patch.enabled) {
        return { ok: false, error: '不能禁用当前登录账号' };
      }
      user.enabled = patch.enabled;
    }
    if (Array.isArray(patch.features) && !isPrivilegedRole(user.role)) {
      user.features = patch.features.filter(function (k) {
        return FEATURES.some(function (f) { return f.key === k && k !== 'admin-users'; });
      });
    }
    user.updatedAt = Date.now();
    saveVault(vault);
    return { ok: true };
  }

  function deleteUser(userId) {
    var s = getSession();
    if (!isSuperAdminSession(s)) return { ok: false, error: '仅超级管理员可禁用账号' };
    if (userId === s.userId) return { ok: false, error: '不能删除当前登录账号' };
    var vault = loadVault();
    if (!vault) return { ok: false, error: '数据异常' };
    var target = vault.users.find(function (u) { return u.id === userId; });
    if (!target) return { ok: false, error: '用户不存在' };
    if (target.role === 'super_admin') return { ok: false, error: '不能删除超级管理员' };
    if (!vault.users.some(function (u) {
      return u.id !== userId && isPrivilegedRole(u.role) && u.enabled && !u.deleted;
    })) {
      return { ok: false, error: '至少保留一名启用的管理员' };
    }
    vault.users = vault.users.filter(function (u) { return u.id !== userId; });
    saveVault(vault);
    return { ok: true };
  }

  function roleDisplayName(role) {
    if (role === 'super_admin') return '超级管理员';
    if (role === 'admin') return '管理员';
    return '普通用户';
  }

  function renderAdminUsers() {
    var body = $('adminUsersBody');
    if (!body) return;
    var s = getSession();
    if (!isSuperAdminSession(s)) {
      body.innerHTML = '<tr><td colspan="6" class="empty-cell">无权限访问（仅超级管理员）</td></tr>';
      return;
    }
    var list = listUsersPublic();
    if (!list.length) {
      body.innerHTML = '<tr><td colspan="6" class="empty-cell">暂无账号</td></tr>';
      return;
    }
    body.innerHTML = list.map(function (u, i) {
      var featCount = (u.features || []).length;
      var privileged = isPrivilegedRole(u.role);
      var canDel = u.id !== s.userId && u.role !== 'super_admin';
      return '<tr data-uid="' + u.id + '">' +
        '<td class="num">' + (i + 1) + '</td>' +
        '<td>' + escapeHtml(u.username) + '</td>' +
        '<td>' + roleDisplayName(u.role) + '</td>' +
        '<td>' + (u.enabled ? '启用' : '禁用') + '</td>' +
        '<td>' + (privileged ? '全部业务' : (featCount + ' 项')) + (u.mustChangePwd ? ' · 待改密' : '') + '</td>' +
        '<td class="docs-ops">' +
          '<button type="button" data-admin-edit="' + u.id + '">权限</button>' +
          '<button type="button" data-admin-reset="' + u.id + '">重置密码</button>' +
          (canDel ? '<button type="button" class="docs-op-danger" data-admin-del="' + u.id + '">删除</button>' : '') +
        '</td></tr>';
    }).join('');
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function openUserPermDrawer(userId) {
    var s = getSession();
    if (!isSuperAdminSession(s)) {
      if (typeof toast === 'function') toast('仅超级管理员可编辑账号权限', 'warning');
      return;
    }
    var vault = loadVault();
    var user = vault && vault.users.find(function (u) { return u.id === userId; });
    if (!user) return;
    var drawer = $('adminUserDrawer');
    if (!drawer) return;
    $('adminEditUserId').value = user.id;
    $('adminEditName').textContent = user.username;
    /* 超级管理员账号角色不可在编辑中修改为其他 */
    var roleSel = $('adminEditRole');
    if (roleSel) {
      if (user.role === 'super_admin') {
        roleSel.value = 'admin';
        roleSel.disabled = true;
      } else {
        roleSel.disabled = false;
        roleSel.value = user.role === 'admin' ? 'admin' : 'user';
      }
    }
    if (typeof upgradeNativeSelect === 'function') {
      try {
        upgradeNativeSelect($('adminEditRole'));
        upgradeNativeSelect($('adminNewRole'));
      } catch (e) {}
    }
    $('adminEditEnabled').checked = !!user.enabled;
    var box = $('adminEditFeatures');
    if (box) {
      var priv = isPrivilegedRole(user.role);
      box.innerHTML = FEATURES.filter(function (f) { return f.key !== 'admin-users'; }).map(function (f) {
        var checked = priv || (user.features || []).indexOf(f.key) >= 0;
        return '<label class="auth-feat-item"><input type="checkbox" data-feat="' + f.key + '"' +
          (checked ? ' checked' : '') + (priv ? ' disabled' : '') + ' /> ' + f.label + '</label>';
      }).join('');
    }
    drawer.hidden = false;
    drawer.classList.add('is-open');
    var mask = $('adminUserDrawerMask');
    if (mask) {
      mask.hidden = false;
      mask.classList.add('is-open');
    }
  }
  function closeUserPermDrawer() {
    var drawer = $('adminUserDrawer');
    if (drawer) {
      drawer.hidden = true;
      drawer.classList.remove('is-open');
    }
    var mask = $('adminUserDrawerMask');
    if (mask) {
      mask.hidden = true;
      mask.classList.remove('is-open');
    }
  }

  function bindAdminPage() {
    if (window.__adminUsersBound) return;
    window.__adminUsersBound = true;
    if (typeof upgradeAllSelects === 'function') {
      try { upgradeAllSelects($('page-admin-users') || document); } catch (e) {}
    }
    var page = $('page-admin-users');
    if (!page) return;
    page.addEventListener('click', function (e) {
      var t = e.target;
      if (!t || !t.closest) return;
      if (t.closest('#adminBtnCreate')) {
        e.preventDefault();
        var name = ($('adminNewUser') && $('adminNewUser').value || '').trim();
        var pwd = ($('adminNewPwd') && $('adminNewPwd').value) || '';
        var role = ($('adminNewRole') && $('adminNewRole').value) || 'user';
        createUser(name, pwd, role, null).then(function (r) {
          if (!r.ok) {
            if (typeof showModal === 'function') showModal(r.error, 'alert');
            else alert(r.error);
            return;
          }
          if ($('adminNewUser')) $('adminNewUser').value = '';
          if ($('adminNewPwd')) $('adminNewPwd').value = '';
          renderAdminUsers();
          if (typeof toast === 'function') toast('已创建账号（密码不会在界面显示）', 'success');
        });
        return;
      }
      var edit = t.closest('[data-admin-edit]');
      if (edit) { openUserPermDrawer(edit.getAttribute('data-admin-edit')); return; }
      var reset = t.closest('[data-admin-reset]');
      if (reset) {
        var np = window.prompt('请输入新密码（至少 8 位，含字母和数字）。密码不会在列表中显示。');
        if (np == null) return;
        resetUserPassword(reset.getAttribute('data-admin-reset'), np).then(function (r) {
          if (!r.ok) {
            if (typeof showModal === 'function') showModal(r.error, 'alert');
            else alert(r.error);
            return;
          }
          renderAdminUsers();
          if (typeof toast === 'function') toast('密码已重置，用户下次登录须修改', 'success');
        });
        return;
      }
      var del = t.closest('[data-admin-del]');
      if (del) {
        var msg = '确认删除该账号？删除后不可恢复。';
        var run = function () {
          var r = deleteUser(del.getAttribute('data-admin-del'));
          if (!r.ok) {
            if (typeof showModal === 'function') showModal(r.error, 'alert');
            else alert(r.error);
            return;
          }
          renderAdminUsers();
          if (typeof toast === 'function') toast('已删除', 'success');
        };
        if (typeof showModal === 'function') showModal(msg + '\n\n删除后数据不可恢复。', 'confirm', function (ok) { if (ok) run(); });
        else if (window.confirm(msg)) run();
      }
    });
    var savePerm = $('adminSavePerm');
    if (savePerm) {
      savePerm.addEventListener('click', function () {
        var id = $('adminEditUserId').value;
        var role = $('adminEditRole').value;
        var enabled = $('adminEditEnabled').checked;
        var feats = [];
        document.querySelectorAll('#adminEditFeatures input[data-feat]:checked').forEach(function (cb) {
          feats.push(cb.getAttribute('data-feat'));
        });
        var r = updateUserMeta(id, { role: role, enabled: enabled, features: feats });
        if (!r.ok) {
          if (typeof showModal === 'function') showModal(r.error, 'alert');
          else alert(r.error);
          return;
        }
        closeUserPermDrawer();
        renderAdminUsers();
        if (typeof toast === 'function') toast('权限已更新', 'success');
      });
    }
    ['adminUserDrawerClose', 'adminUserDrawerCancel', 'adminUserDrawerMask'].forEach(function (id) {
      var el = $(id);
      if (el) el.addEventListener('click', closeUserPermDrawer);
    });
    var roleSel = $('adminEditRole');
    if (roleSel) {
      roleSel.addEventListener('change', function () {
        var isAdmin = roleSel.value === 'admin';
        document.querySelectorAll('#adminEditFeatures input[data-feat]').forEach(function (cb) {
          cb.disabled = isAdmin;
          if (isAdmin) cb.checked = true;
        });
      });
    }
  }

  function bindGate() {
    if (window.__authGateBound) return;
    window.__authGateBound = true;

    document.querySelectorAll('[data-auth-tab]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        switchAuthView(btn.getAttribute('data-auth-tab'));
      });
    });

    /* 联系通道：页面与属性中不直接写明文链接，运行时解码后打开 */
    function openContactChannel() {
      try {
        var url = getContactUrl();
        var w = window.open('about:blank', '_blank', 'noopener,noreferrer');
        if (w) {
          w.opener = null;
          w.location.replace(url);
        } else {
          /* 弹窗被拦截时仍避免在当前页展示链接文本 */
          var a = document.createElement('a');
          a.rel = 'noopener noreferrer';
          a.target = '_blank';
          a.href = url;
          a.click();
        }
      } catch (e) {
        if (typeof toast === 'function') toast('无法打开联系通道', 'error');
      }
    }
    var contactBtn = $('authContactAdminBtn');
    if (contactBtn) {
      contactBtn.addEventListener('click', function (e) {
        e.preventDefault();
        openContactChannel();
      });
    }

    /* 已取消「使用服务端登录」开关：统一服务端鉴权 */
    try {
      var useServerCb = $('authUseServer');
      if (useServerCb) {
        useServerCb.checked = true;
        var lab = useServerCb.closest('label') || document.querySelector('label[for="authUseServer"]');
        if (lab) lab.style.display = 'none';
        useServerCb.style.display = 'none';
      }
      if (typeof CMGApi !== 'undefined' && CMGApi.setMode) CMGApi.setMode('http');
    } catch (eHide) {}
    var form = $('authLoginForm');
    if (form) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var u = ($('authUsername') && $('authUsername').value) || '';
        var p = ($('authPassword') && $('authPassword').value) || '';
        var err = $('authLoginError');
        if (err) err.textContent = '';
        var btn = $('authLoginBtn');
        if (btn) btn.disabled = true;
        login(u, p, { useServer: true }).then(function (r) {
          if (btn) btn.disabled = false;
          if (!r.ok) {
            if (err) err.textContent = r.error || '登录失败';
            if ($('authPassword')) $('authPassword').value = '';
            return;
          }
          if ($('authPassword')) $('authPassword').value = '';
          if ($('authUsername')) $('authUsername').value = '';
          var okMsg = r.mustChangePwd ? '登录成功，请先修改密码' : '登录成功';
          if (typeof window.toast === 'function') window.toast(okMsg, 'success');
          else if (typeof window.showModal === 'function') window.showModal(okMsg, 'alert');
          enterApp(r.mustChangePwd);
        }).catch(function () {
          if (btn) btn.disabled = false;
          if (err) err.textContent = '登录异常，请刷新重试';
        });
      });
    }

    var cpCancel = $('authChangePwdCancel');
    if (cpCancel) {
      cpCancel.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        var box = $('authChangePwd');
        var forced = !!(box && box.getAttribute('data-forced') === '1');
        var s = getSession();
        if (forced || (s && s.mustChangePwd)) {
          closeChangePwdModal();
          logout();
          return;
        }
        closeChangePwdModal();
      });
    }
    var cpForm = $('authChangePwdForm');
    if (cpForm) {
      cpForm.addEventListener('submit', function (e) {
        e.preventDefault();
        var s = getSession();
        var forced = !!(s && s.mustChangePwd);
        changePassword(
          ($('authOldPwd') && $('authOldPwd').value) || '',
          ($('authNewPwd') && $('authNewPwd').value) || '',
          ($('authNewPwd2') && $('authNewPwd2').value) || '',
          forced
        ).then(function (r) {
          var err = $('authChangePwdError');
          if (!r.ok) {
            if (err) err.textContent = r.error;
            return;
          }
          if (err) err.textContent = '';
          closeChangePwdModal();
          closeSidebarAccountPanel();
          if (typeof window.toast === 'function') window.toast('密码已更新', 'success');
          else if (typeof toast === 'function') toast('密码已更新', 'success');
          enterApp(false);
        });
      });
    }
    var logoutBtn = $('btnLogout');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', function (e) {
        e.preventDefault();
        logout();
      });
    }
  }

  function enterApp(mustChange) {
    showGate(false);
    setDefaultAppRoute();
    applyMenuPermissions();
    bindAdminPage();
    if (mustChange) {
      openChangePwdModal(true);
      return;
    }
    if (typeof window.Auth !== 'undefined' && window.Auth._onReady) {
      try { window.Auth._onReady(); } catch (e) {}
    }
    /* 无权限时落到有权限的第一页（会话绑定：禁止无凭证访问业务路径） */
    var s = getSession();
    if (s && !isSuperAdminSession(s)) {
      var path = location.hash.replace(/^#/, '') || '/dashboard';
      var page = (typeof PAGE_PATHS !== 'undefined' && PAGE_PATHS[path]) ? PAGE_PATHS[path] : 'dashboard';
      if (!hasFeature(page)) {
        var first = (s.features || []).find(function (k) { return k !== 'admin-users'; }) || 'help';
        if (typeof window.switchPage === 'function') window.switchPage(first);
      }
    }
  }

  function boot() {
    bindGate();
    try { refreshContactConfig(); } catch (e) {}
    var s0 = getSession();
    if (s0) {
      /* 保持 auth-boot：主界面仍隐藏，等 vault + enterApp 再一次亮出 */
      ensureVault().then(function () {
        var s = getSession();
        if (s) enterApp(!!s.mustChangePwd);
        else {
          showGate(true);
          switchAuthView('login');
        }
      }).catch(function () {
        showGate(true);
        switchAuthView('login');
      });
    } else {
      showGate(true);
      switchAuthView('login');
      /* 统一服务端登录：登录页不预热本地演示库，避免弹出初始密码提示 */
    }
  }

  /* 拦截无权限页面 */
  var _origSwitch = null;
  function wrapRouter() {
    if (typeof window.switchPage !== 'function' || window.__authRouterWrapped) return;
    window.__authRouterWrapped = true;
    _origSwitch = window.switchPage;
    window.switchPage = function (name) {
      if (!requireAuth()) {
        showGate(true);
        setLoginRoute();
        return;
      }
      /* hasFeature 已包含：finance-ledger → 全部 finance-* / review-* 子页 */
      if (!hasFeature(name) && name !== 'help') {
        if (typeof toast === 'function') toast('当前账号无权限访问该功能', 'warning');
        return;
      }
      if (name === 'admin-users') {
        var s = getSession();
        if (!isSuperAdminSession(s)) {
          if (typeof toast === 'function') toast('仅超级管理员可访问账号与权限管理', 'warning');
          return;
        }
        renderAdminUsers();
      }
      return _origSwitch(name);
    };
  }

  window.Auth = {
    openChangePwdModal: openChangePwdModal,
    closeChangePwdModal: closeChangePwdModal,
    closeAccountPanel: closeAccountPanel,
    closeSidebarAccountPanel: closeSidebarAccountPanel,
    boot: boot,
    login: login,
    logout: logout,
    current: current,
    hasFeature: hasFeature,
    requireAuth: requireAuth,
    features: FEATURES,
    listUsersPublic: listUsersPublic,
    renderAdminUsers: renderAdminUsers,
    wrapRouter: wrapRouter,
    applyMenuPermissions: applyMenuPermissions,
    _onReady: null
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      setTimeout(function () { wrapRouter(); boot(); }, 0);
    });
  } else {
    setTimeout(function () { wrapRouter(); boot(); }, 0);
  }
})();
