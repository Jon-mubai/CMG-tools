/* 临时诊断：直接验证 SVG 能否加载，以及 img 为何不可见 */
const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const P = 8126, D = 9336;
const PROF = path.join(os.tmpdir(), 'diag-' + Date.now());
const ROOT = path.resolve(__dirname, '..');
const MIME = {
  '.html': 'text/html;charset=utf-8', '.js': 'text/javascript', '.css': 'text/css',
  '.svg': 'image/svg+xml', '.json': 'application/json', '.png': 'image/png'
};
const wait = (port, p, n) => new Promise((res, rej) => {
  const f = (k) => {
    if (k <= 0) return rej(new Error('timeout'));
    http.get({ host: '127.0.0.1', port, path: p }, (r) => { r.resume(); res(); })
      .on('error', () => setTimeout(() => f(k - 1), 400));
  };
  f(n);
});

(async () => {
  const srv = http.createServer((q, s) => {
    let f = q.url === '/' ? '/index.html' : decodeURIComponent(q.url.split('?')[0]);
    const fp = path.join(ROOT, 'dist', f);
    fs.readFile(fp, (e, d) => {
      if (e) { s.writeHead(404); return s.end('nf'); }
      s.writeHead(200, { 'Content-Type': MIME[path.extname(fp)] || 'application/octet-stream' });
      s.end(d);
    });
  });
  await new Promise((r) => srv.listen(P, '127.0.0.1', r));
  const c = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-sandbox',
    '--remote-debugging-port=' + D, '--user-data-dir=' + PROF,
    'http://127.0.0.1:' + P + '/'], { stdio: 'ignore' });

  try {
    await wait(D, '/json/version', 25);
    const l = await new Promise((res, rej) => {
      http.get({ host: '127.0.0.1', port: D, path: '/json/list' }, (r) => {
        let d = ''; r.on('data', (x) => d += x); r.on('end', () => res(JSON.parse(d)));
      }).on('error', rej);
    });
    const pg = l.find((t) => t.type === 'page');
    const WebSocket = require('ws');
    const ws = new WebSocket(pg.webSocketDebuggerUrl, { perMessageDeflate: false });
    let id = 0; const pend = new Map();
    ws.on('message', (raw) => {
      const m = JSON.parse(raw.toString());
      if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); }
    });
    const send = (me, p = {}) => new Promise((r) => {
      const i = ++id; pend.set(i, r);
      ws.send(JSON.stringify({ id: i, method: me, params: p }));
    });
    await new Promise((r) => ws.on('open', r));
    await send('Page.enable');
    await send('Log.enable');
    await send('Network.enable');
    const logs=[];const reqs=[];
    ws.on('message',(raw)=>{const m=JSON.parse(raw.toString());
      if(m.method==='Log.entryAdded')logs.push(m.params.entry.level+': '+m.params.entry.text.slice(0,110));
      if(m.method==='Network.responseReceived'&&m.params.response.url.includes('svg'))reqs.push(m.params.response.status+' '+m.params.response.mimeType+' '+m.params.response.url.slice(-30));
    });
    await send('Runtime.enable');
    await send('Page.navigate', { url: 'http://127.0.0.1:' + P + '/' });
    await new Promise((r) => setTimeout(r, 3500));

    /* 分三步查，避免单条表达式出错导致无输出 */
    const steps = [
      ['img 属性', `(function(){var i=document.querySelector('.auth-banner-img');return i?i.getAttribute('src'):'NOT FOUND';})()`],
      ['img style 属性', `(function(){var i=document.querySelector('.auth-banner-img');return i?String(i.getAttribute('style')):'NONE';})()`],
      ['naturalWidth', `(function(){var i=document.querySelector('.auth-banner-img');return i?String(i.naturalWidth):'NONE';})()`],
      ['computed display', `(function(){var i=document.querySelector('.auth-banner-img');return i?getComputedStyle(i).display:'NONE';})()`],
      ['新建img测试加载', `(function(){
        var n=document.createElement('img');
        n.src='./assets/auth-banner-BRhjGYTb.svg';
        document.body.appendChild(n);
        return new Promise(function(res){
          n.onload=function(){res('LOADED '+n.naturalWidth+'x'+n.naturalHeight);};
          n.onerror=function(e){res('ERROR');};
          setTimeout(function(){res('TIMEOUT complete='+n.complete+' w='+n.naturalWidth);},3000);
        });
      })()`],
      ['DOMParser 解析', `(function(){
        return fetch('./assets/auth-banner-Rv1wc6wS.svg').then(function(r){return r.text()}).then(function(t){
          var d=new DOMParser().parseFromString(t,'image/svg+xml');
          var err=d.querySelector('parsererror');
          return err?('PARSE_ERROR: '+err.textContent.slice(0,120)):('OK root='+d.documentElement.nodeName+' viewBox='+d.documentElement.getAttribute('viewBox'));
        });
      })()`],
      ['手动态test SVG 可加载性', `fetch('./assets/auth-banner-Rv1wc6wS.svg').then(function(r){return r.status+' '+(r.headers.get('content-type')||'-');})`]
    ];
    for (const [label, expr] of steps) {
      const r = await send('Runtime.evaluate',
        { expression: expr, returnByValue: true, awaitPromise: expr.indexOf('fetch') > 0 || expr.indexOf('createElement') > 0 });
      console.log(label + ':', r.result.result.value !== undefined ? r.result.result.value : JSON.stringify(r.result));
    }
    console.log('SVG 网络响应:', reqs.length?reqs.join(' | '):'(无请求)');
    console.log('CSP 日志:'); logs.filter(l=>l.indexOf('Content Security')>=0||l.indexOf('error')>=0).slice(0,4).forEach(l=>console.log('  '+l));
    ws.close();
  } catch (e) { console.log('失败:', e.message); }
  finally {
    try { c.kill(); } catch (e) {}
    srv.close();
    try { fs.rmSync(PROF, { recursive: true, force: true }); } catch (e) {}
    setTimeout(() => process.exit(0), 300);
  }
})();