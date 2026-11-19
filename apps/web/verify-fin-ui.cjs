/* 备用金模块 UI 验证：注入样例数据，逐屏截图并断言布局 */
const puppeteer = require('puppeteer-core');
const fs = require('fs');
const OUT = 'D:/ProgramData/others/cucumber-inventory-project/apps/web/_verify';
fs.mkdirSync(OUT, { recursive: true });

const SEED = {
  reserve: 3000,
  sources: [{ id: 's1', name: '财务拨付' }, { id: 's2', name: '项目结余' }],
  records: [
    { id: 'r1', item: '机台换新，其他店铺调拨运费', amount: 121, dateStart: '2026-10-15', dateEnd: '2026-10-21', userName: '商婷', auditor: 'mubai', operator: 'admin', remark: '已付款', images: [] },
    { id: 'r2', item: '采购办公耗材', amount: 340, dateStart: '2026-10-16', dateEnd: '', userName: '商婷', auditor: 'mubai', operator: 'admin', remark: '', images: [] },
    { id: 'r3', item: '仓库物流费', amount: 260, dateStart: '2026-10-18', dateEnd: '', userName: '李明', auditor: '张伟', operator: 'admin', remark: '加急', images: [] },
    { id: 'r4', item: '清洁用品补给', amount: 90, dateStart: '2026-10-19', dateEnd: '', userName: '李明', auditor: '张伟', operator: 'mubai', remark: '', images: [] },
    { id: 'r5', item: '临时快递费', amount: 55, dateStart: '2026-10-20', dateEnd: '', userName: '王芳', auditor: 'mubai', operator: 'admin', remark: '', images: [] },
    { id: 'r6', item: '设备零件采购', amount: 480, dateStart: '2026-10-21', dateEnd: '', userName: '商婷', auditor: '张伟', operator: 'admin', remark: '大额', images: [] },
  ],
};

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/* 强制关闭登录闸门与初始化弹窗：
   boot 的异步 vault 会再次打开 gate 并弹出「本地演示库已初始化」模态框。
   样式覆盖会被内联样式击穿，因此直接移除节点——showGate() 里 $('authGate')
   取不到元素后即为 no-op。 */
async function forceOpen(page) {
  await page.evaluate(() => {
    ['authGate', 'modalOverlay'].forEach((id) => {
      const el = document.getElementById(id);
      if (el && el.parentNode) el.parentNode.removeChild(el);
    });
    document.querySelectorAll('.modal-overlay').forEach((m) => {
      if (m.parentNode) m.parentNode.removeChild(m);
    });
    const html = document.documentElement;
    html.classList.remove('auth-need-login', 'auth-boot', 'auth-settling');
    html.classList.add('auth-has-session', 'auth-ready');
    const app = document.querySelector('.app-layout');
    if (app) { app.style.visibility = 'visible'; app.style.opacity = '1'; app.style.pointerEvents = ''; }
    // 仅显示备用金页面
    document.querySelectorAll('.page-section').forEach((s) => {
      const on = s.id === 'page-finance-ledger';
      s.classList.toggle('active', on);
      s.style.display = on ? 'block' : 'none';
    });
  });
}

(async () => {
  const browser = await puppeteer.launch({
    executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    headless: 'new',
    args: ['--window-size=1600,1000', '--no-sandbox'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1600, height: 1000 });

  await page.goto('http://127.0.0.1:8080/', { waitUntil: 'domcontentloaded' });
  await page.evaluate((seed) => {
    sessionStorage.setItem('cmg_session_v1', JSON.stringify({
      token: 'testtoken0123456789abcdef', userId: 'u_admin', username: 'admin', role: 'admin',
      features: ['finance-ledger'], mustChangePwd: false,
      exp: Date.now() + 86400000, lastSeen: Date.now(),
    }));
    // 备用金数据按用户命名空间存储：cmg_finance_ledger_v1__u_<userId>
    localStorage.setItem('cmg_finance_ledger_v1__u_u_admin', JSON.stringify(seed));
    localStorage.setItem('cmg_finance_ledger_v1', JSON.stringify(seed));
  }, SEED);

  await page.goto('http://127.0.0.1:8080/#/finance-board', { waitUntil: 'networkidle2' });
  await wait(2500);
  await forceOpen(page);
  await wait(500);

  const views = ['board', 'register', 'records', 'source', 'amount'];
  const report = [];

  for (const v of views) {
    // 直接调用模块 API，绕开鉴权路由
    await page.evaluate((view) => {
      if (window.FinanceModule && window.FinanceModule.showView) window.FinanceModule.showView(view);
    }, v);
    await forceOpen(page);
    await wait(900);
    await page.screenshot({ path: `${OUT}/fin-${v}.png`, fullPage: false });

    const metrics = await page.evaluate((view) => {
      const el = document.querySelector('#page-finance-ledger .fin-view[data-fin-view="' + view + '"]');
      if (!el || el.hidden) return { view, visible: false };
      const cs = getComputedStyle(el);
      const out = { view, visible: true, gap: cs.gap, dupTitles: el.querySelectorAll('.fin-section-title').length, charts: {}, fields: {}, overflow: el.scrollWidth > el.clientWidth + 2 };

      el.querySelectorAll('.fin-chart-plot').forEach((p) => {
        const svg = p.querySelector('svg');
        if (!svg) { out.charts[p.id] = 'NO_SVG'; return; }
        const r = svg.getBoundingClientRect();
        out.charts[p.id] = { w: Math.round(r.width), h: Math.round(r.height) };
      });
      el.querySelectorAll('.fin-filter-field, .fin-source-row .fin-field, .fin-field-reserve').forEach((f) => {
        const c = f.querySelector('.fin-input, .mp-dp-trigger');
        if (c) out.fields[(f.className || '').replace('fin-field', '').trim() || 'field'] = Math.round(c.getBoundingClientRect().width);
      });
      // 图例条目数
      out.legendItems = el.querySelectorAll('.fin-legend-item').length;
      return out;
    }, v);
    report.push(metrics);
  }

  console.log(JSON.stringify(report, null, 2));
  await browser.close();
})().catch((e) => { console.error('ERR', e); process.exit(1); });