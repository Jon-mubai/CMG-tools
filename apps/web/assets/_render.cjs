/* 临时渲染验证：自启动无头浏览器并抓图，脚本退出即清理，不留残留进程 */
const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const PORT = 9333;
const PROFILE = path.join(require('os').tmpdir(), 'svg-render-' + Date.now());
const TARGET = 'http://127.0.0.1:8123/';
const OUT = path.join(__dirname, '_banner_render.png');

function waitPort(p, tries) {
  return new Promise((res, rej) => {
    const probe = (n) => {
      if (n <= 0) return rej(new Error('调试端口未就绪'));
      http.get({ host: '127.0.0.1', port: p, path: '/json/version' }, (r) => {
        r.resume(); res();
      }).on('error', () => setTimeout(() => probe(n - 1), 400));
    };
    probe(tries);
  });
}

function getTargets() {
  return new Promise((res, rej) => {
    http.get({ host: '127.0.0.1', port: PORT, path: '/json/list' }, (r) => {
      let d = ''; r.on('data', (c) => d += c);
      r.on('end', () => res(JSON.parse(d)));
    }).on('error', rej);
  });
}

(async () => {
  const child = spawn(EDGE, [
    '--headless=new', '--disable-gpu', '--no-sandbox',
    '--remote-debugging-port=' + PORT,
    '--user-data-dir=' + PROFILE,
    '--window-size=680,580',
    TARGET
  ], { stdio: 'ignore', detached: false });

  let exitCode = 1;
  try {
    await waitPort(PORT, 25);
    const targets = await getTargets();
    const page = targets.find((t) => t.type === 'page');
    if (!page) throw new Error('无页面目标');

    const WebSocket = require('ws');
    const ws = new WebSocket(page.webSocketDebuggerUrl, { perMessageDeflate: false });
    let id = 0; const pend = new Map(); const errs = [];
    ws.on('message', (raw) => {
      const m = JSON.parse(raw.toString());
      if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error') {
        errs.push(m.params.entry.text.slice(0, 90));
      }
      if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); }
    });
    const send = (method, params = {}) => new Promise((r) => {
      const i = ++id; pend.set(i, r);
      ws.send(JSON.stringify({ id: i, method, params }));
    });
    await new Promise((r) => ws.on('open', r));

    await send('Page.enable');
    await send('Log.enable');
    await send('Emulation.setDeviceMetricsOverride',
      { width: 680, height: 580, deviceScaleFactor: 2, mobile: false });
    await send('Page.navigate', { url: TARGET });
    await new Promise((r) => setTimeout(r, 3000));

    const shot = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(OUT, Buffer.from(shot.result.data, 'base64'));

    // 同时报告 SVG 是否真的被解析
    const probe = await send('Runtime.evaluate', {
      expression: `(function(){
        var s = document.querySelector('.wrap svg');
        if(!s) return JSON.stringify({svg:false});
        var bb = s.getBoundingClientRect();
        return JSON.stringify({
          svg:true,
          viewBox: s.getAttribute('viewBox'),
          rendered: Math.round(bb.width)+'x'+Math.round(bb.height),
          gradients: s.querySelectorAll('linearGradient,radialGradient').length,
          filters: s.querySelectorAll('filter').length,
          paths: s.querySelectorAll('path,circle,rect,ellipse,text').length
        });
      })()`,
      returnByValue: true
    });
    console.log('SVG 状态:', probe.result.result.value);
    console.log('控制台错误:', errs.length, errs.slice(0, 3).join(' | '));
    console.log('截图:', OUT, fs.statSync(OUT).size, '字节');
    exitCode = errs.length ? 1 : 0;
    ws.close();
  } catch (e) {
    console.log('渲染失败:', e.message);
  } finally {
    try { child.kill(); } catch (e) {}
    try { fs.rmSync(PROFILE, { recursive: true, force: true }); } catch (e) {}
    setTimeout(() => process.exit(exitCode), 300);
  }
})();