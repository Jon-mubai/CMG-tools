/* 临时预览服务器：仅用于渲染 SVG banner 截图，不属于交付物 */
const http = require('http');
const fs = require('fs');
const p = require('path');
const PORT = 8123;
const DIR = __dirname;

http.createServer((q, s) => {
  const f = q.url === '/' ? '/_preview.html' : q.url.split('?')[0];
  const fp = p.join(DIR, decodeURIComponent(f));
  fs.readFile(fp, (e, d) => {
    if (e) { s.writeHead(404); return s.end('nf'); }
    const ext = p.extname(fp);
    const T = { '.html': 'text/html;charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png' };
    s.writeHead(200, { 'Content-Type': T[ext] || 'application/octet-stream' });
    s.end(d);
  });
}).listen(PORT, '127.0.0.1', () => console.log('preview server on http://127.0.0.1:' + PORT));