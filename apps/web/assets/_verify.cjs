/* 临时验证：确认 dist 产物中 banner 正常加载、与 CSS 版互斥、登录表单不受影响 */
const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const SERVE_PORT = 8124;
const DBG_PORT = 9334;
const PROFILE = path.join(os.tmpdir(), 'banner-verify-' + Date.now());
const ROOT = path.resolve(__dirname, '..');

const MIME = {
  '.html': 'text/html;charset=utf-8', '.js': 'text/javascript', '.css': 'text/css',
  '.svg': 'image/svg+xml', '.json': 'application/json', '.png': 'image/png',
  '.woff2': 'font/woff2', '.map': 'application/json'
};

function waitPort(p, path_, tries) {
  return new Promise((res, rej) => {
    const probe = (n) => {
      if (n <= 0) return rej(new Error('端口 ' + p + ' 未就绪'));
      http.get({ host: '127.0.0.1', port: p, path: path_ }, (r) => { r.resume(); res(); })
        .on('error', () => setTimeout(() => probe(n - 1), 400));
    };
    probe(tries);
  });
}

(async () => {
  /* 静态服务 dist */
  const server = http.createServer((q, s) => {
    let f = decodeURIComponent(q.url.split('?')[0]);
    if (f === '/') f = '/index.html';
    const fp = path.join(ROOT, 'dist', f);
    fs.readFile(fp, (e, d) => {
      if (e) { s.writeHead(404); return s.end('nf'); }
      s.writeHead(200, { 'Content-Type': MIME[path.extname(fp)] || 'application/octet-stream' });
      s.end(d);
    });
  });
  await new Promise((r) => server.listen(SERVE_PORT, '127.0.0.1', r));

  const child = spawn(EDGE, [
    '--headless=new', '--disable-gpu', '--no-sandbox',
    '--remote-debugging-port=' + DBG_PORT,
    '--user-data-dir=' + PROFILE,
    '--window-size=1200,860',
    'http://127.0.0.1:' + SERVE_PORT + '/'
  ], { stdio: 'ignore' });

  let code = 1;
  try {
    await waitPort(DBG_PORT, '/json/version', 25);
    const list = await new Promise((res, rej) => {
      http.get({ host: '127.0.0.1', port: DBG_PORT, path: '/json/list' }, (r) => {
        let d = ''; r.on('data', (c) => d += c); r.on('end', () => res(JSON.parse(d)));
      }).on('error', rej);
    });
    const page = list.find((t) => t.type === 'page');

    const WebSocket = require('ws');
    const ws = new WebSocket(page.webSocketDebuggerUrl, { perMessageDeflate: false });
    let id = 0; const pend = new Map(); const errs = [];
    ws.on('message', (raw) => {
      const m = JSON.parse(raw.toString());
      if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error') {
        errs.push(m.params.entry.text.slice(0, 80));
      }
      if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); }
    });
    const send = (method, params = {}) => new Promise((r) => {
      const i = ++id; pend.set(i, r);
      ws.send(JSON.stringify({ id: i, method, params }));
    });
    await new Promise((r) => ws.on('open', r));
    await send('Page.enable');
    await send('Runtime.enable');
    await send('Log.enable');
    await send('Page.navigate', { url: 'http://127.0.0.1:' + SERVE_PORT + '/' });
    await new Promise((r) => setTimeout(r, 4000));

    const r1 = await send('Runtime.evaluate', {
      expression: `(function(){
        var img = document.querySelector('.auth-banner-img');
        var cssVersion = document.querySelector('.w3-orbit');
        var pane = document.querySelector('.auth-pane-brand');
        var out = {
          imgExists: !!img,
          imgLoaded: img ? img.complete && img.naturalWidth > 0 : false,
          imgNatural: img ? img.naturalWidth + 'x' + img.naturalHeight : '-',
          imgBox: img ? Math.round(img.getBoundingClientRect().width) + 'x'
                       + Math.round(img.getBoundingClientRect().height) : '-',
          cssFallbackHidden: cssVersion ? getComputedStyle(cssVersion).display === 'none' : 'n/a',
          paneBg: pane ? getComputedStyle(pane).backgroundImage.slice(0, 46) : '-'
        };
        /* 登录表单可用性 */
        out.hasAccount = !!document.querySelector('#loginUsername, [id*=ccount]');
        out.hasPassword = !!document.querySelector('#loginPassword, [id*=assword]');
        out.hasSubmit = !!document.querySelector('#loginBtn, [id*=ogin][type=submit], .auth-login-btn');
        out.inputs = document.querySelectorAll('.auth-gate input').length;
        return JSON.stringify(out);
      })()`,
      returnByValue: true
    });
    console.log('页面状态:', r1.result.result.value);

    const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    fs.writeFileSync(path.join(__dirname, '_loginpage.png'),
      Buffer.from(shot.result.data, 'base64'));
    console.log('登录页截图已保存');
    console.log('控制台错误:', errs.length, errs.slice(0, 3).join(' | '));
    code = 0;
    ws.close();
  } catch (e) {
    console.log('验证失败:', e.message);
  } finally {
    try { child.kill(); } catch (e) {}
    server.close();
    try { fs.rmSync(PROFILE, { recursive: true, force: true }); } catch (e) {}
    setTimeout(() => process.exit(code), 300);
  }
})();