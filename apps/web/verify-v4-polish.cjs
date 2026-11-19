/* 验证：① 黑栏显示一级菜单名称 ② 审核页图标居中 ③ 日期面板无滚动条 + 右间距翻倍 */
const puppeteer = require('puppeteer-core');
const fs = require('fs');
const OUT = 'D:/ProgramData/others/cucumber-inventory-project/apps/web/_verify';
fs.mkdirSync(OUT, { recursive: true });

const SEED = {
  reserve: 3000,
  sources: [{ id: 's1', name: '财务拨付' }],
  records: [
    { id: 'r1', item: '机台换新，其他店铺调拨运费', amount: 121, dateStart: '2026-10-15', dateEnd: '2026-10-21', userName: '商婷', auditor: 'mubai', operator: 'admin', remark: '已付款', images: [], reviewStatus: 'pending' },
    { id: 'r2', item: '采购办公耗材', amount: 340, dateStart: '2026-10-16', dateEnd: '', userName: '商婷', auditor: 'mubai', operator: 'admin', remark: '', images: [], reviewStatus: 'passed', reviewedAt: '2026-10-20T02:00:00.000Z' },
    { id: 'r3', item: '仓库物流费', amount: 260, dateStart: '2026-10-18', dateEnd: '', userName: '李明', auditor: '张伟', operator: 'admin', remark: '加急', images: [], reviewStatus: 'rejected', reviewedAt: '2026-10-19T02:00:00.000Z' },
    { id: 'r4', item: '清洁用品补给', amount: 90, dateStart: '2026-10-19', dateEnd: '', userName: '李明', auditor: '张伟', operator: 'mubai', remark: '', images: [], reviewStatus: 'pending' },
  ],
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const browser = await puppeteer.launch({
    executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    headless: 'new', args: ['--window-size=1600,1000', '--no-sandbox'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1600, height: 1000 });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)));

  const seed = () => page.evaluate((s) => {
    sessionStorage.setItem('cmg_session_v1', JSON.stringify({
      token: 't', userId: 'u_admin', username: 'admin', role: 'admin',
      features: ['finance-ledger'], mustChangePwd: false,
      exp: Date.now() + 86400000, lastSeen: Date.now(),
    }));
    localStorage.setItem('cmg_finance_ledger_v1__u_u_admin', JSON.stringify(s));
    localStorage.removeItem('cmg_rail_active_group');
  }, SEED);
  const open = () => page.evaluate(() => {
    const g = document.getElementById('authGate'); if (g) g.remove();
    document.querySelectorAll('.modal-overlay').forEach((m) => { m.classList.remove('show'); m.style.display = ''; });
    document.documentElement.classList.remove('auth-need-login');
    const a = document.querySelector('.app-layout');
    if (a) { a.style.visibility = 'visible'; a.style.opacity = '1'; a.style.pointerEvents = ''; }
  });

  await page.goto('http://127.0.0.1:8080/', { waitUntil: 'domcontentloaded' });
  await seed();
  await page.goto('http://127.0.0.1:8080/#/finance-records', { waitUntil: 'networkidle2' });
  await wait(2300);
  await open();
  await wait(900);

  const R = {};

  // ---- ① 黑栏一级菜单名称 ----
  R.rail = await page.evaluate(() => {
    const rail = document.getElementById('appRail');
    const rr = rail.getBoundingClientRect();
    const items = Array.from(rail.querySelectorAll('.app-rail-item'));
    return {
      width: Math.round(rr.width),
      count: items.length,
      /* 第八轮需求：固定栏需同时显示图标与一级菜单名称 */
      namesInRail: items.filter((b) => {
        const t = b.querySelector('.app-rail-text');
        return t && getComputedStyle(t).display !== 'none' && t.getBoundingClientRect().height > 0;
      }).length,
      panelHead: (document.getElementById('sidebarPanelTitle') || {}).textContent || '',
      items: items.map((b) => {
        const t = b.querySelector('.app-rail-text');
        const ico = b.querySelector('.app-rail-ico');
        return {
          group: b.getAttribute('data-rail-group'),
          label: t ? t.textContent.trim() : null,
          labelVisible: t ? getComputedStyle(t).display !== 'none' && t.getBoundingClientRect().height > 0 : false,
          hasIcon: !!ico,
          iconAboveLabel: (() => {
            if (!t || !ico) return false;
            return ico.getBoundingClientRect().bottom <= t.getBoundingClientRect().top + 1;
          })(),
        };
      }),
      railX: Math.round(rr.left),
    };
  });
  await page.screenshot({ path: `${OUT}/v4-rail-labels.png`, clip: { x: 0, y: 0, width: 460, height: 720 } });

  // ---- ③ 日期面板 ----
  await page.evaluate(() => { const t = document.getElementById('finFilterPeriodTrigger'); if (t) t.click(); });
  await wait(900);
  R.datePanel = await page.evaluate(() => {
    const panel = document.getElementById('finFilterPeriodPanel');
    if (!panel) return { err: 'no panel' };
    const cals = panel.querySelector('.mp-dp-calendars');
    const pr = panel.getBoundingClientRect();
    const over = [];
    panel.querySelectorAll('*').forEach((el) => {
      if (el.scrollWidth > el.clientWidth + 1 && el.clientWidth > 0) over.push(el.className);
    });
    return {
      scrollable: panel.scrollWidth > panel.clientWidth + 1,
      overflowing: over,
      panelW: Math.round(pr.width),
      scrollW: panel.scrollWidth,
      clientW: panel.clientWidth,
      overflowX: getComputedStyle(panel).overflowX,
      padRight: cals ? getComputedStyle(cals).paddingRight : null,
      padLeft: cals ? getComputedStyle(cals).paddingLeft : null,
    };
  });
  await page.screenshot({ path: `${OUT}/v4-date-panel.png` });
  await page.evaluate(() => { document.body.click(); const t = document.getElementById('finFilterPeriodTrigger'); if (t) t.click(); });

  // ---- ② 审核页图标居中 ----
  await page.goto('http://127.0.0.1:8080/#/review-pending', { waitUntil: 'networkidle2' });
  await wait(2000);
  await open();
  await wait(1000);
  R.flowIcons = await page.evaluate(() => {
    const out = [];
    document.querySelectorAll('#flowSteps .flow-step').forEach((step) => {
      const node = step.querySelector('.flow-node');
      const nr = node.getBoundingClientRect();
      const ncx = nr.left + nr.width / 2, ncy = nr.top + nr.height / 2;
      // 两个图标容器都要与圆心重合
      const hosts = Array.from(node.querySelectorAll('.flow-ico-done, .flow-ico-lock'));
      const hostsAligned = hosts.every((h) => {
        const r = h.getBoundingClientRect();
        return Math.abs(r.left + r.width / 2 - ncx) < 0.6 && Math.abs(r.top + r.height / 2 - ncy) < 0.6;
      });
      // 内部 svg（shadow DOM）也要居中
      const svgs = hosts.map((h) => (h.shadowRoot ? h.shadowRoot.querySelector('svg') : h.querySelector('svg'))).filter(Boolean);
      const svgsAligned = svgs.every((s) => {
        const r = s.getBoundingClientRect();
        return Math.abs(r.left + r.width / 2 - ncx) < 0.6 && Math.abs(r.top + r.height / 2 - ncy) < 0.6;
      });
      out.push({
        flow: step.getAttribute('data-flow'),
        nodeSize: Math.round(nr.width) + 'x' + Math.round(nr.height),
        hostsAligned, svgsAligned,
        svgCount: svgs.length,
        svgSizes: svgs.map((s) => Math.round(s.getBoundingClientRect().width)),
      });
    });
    return out;
  });
  await page.screenshot({ path: `${OUT}/v4-flow-centered.png` });

  R.jsErrors = errors;
  const labels = R.rail.items.map((i) => i.label);
  R.pass = R.rail.count >= 5 && labels.every(Boolean) && !!R.rail.panelHead
    && R.rail.namesInRail === R.rail.count
    && !R.datePanel.scrollable && R.datePanel.overflowing.length === 0
    && parseInt(R.datePanel.padRight, 10) === 2 * parseInt(R.datePanel.padLeft, 10)
    && R.flowIcons.every((f) => f.hostsAligned && f.svgsAligned)
    && errors.length === 0;
  console.log(JSON.stringify(R, null, 2));
  await browser.close();
  process.exit(R.pass ? 0 : 1);
})().catch((e) => { console.error('ERR', e); process.exit(1); });