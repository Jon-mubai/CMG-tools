/* 验证：① 侧边栏双栏拆分 ② 审批流程节点与真实数据交互 */
const puppeteer = require('puppeteer-core');
const fs = require('fs');
const OUT = 'D:/ProgramData/others/cucumber-inventory-project/apps/web/_verify';
fs.mkdirSync(OUT, { recursive: true });

const KEY = 'cmg_finance_ledger_v1__u_u_admin';
const SEED = {
  reserve: 3000,
  sources: [{ id: 's1', name: '财务拨付' }],
  records: [
    { id: 'r1', item: '机台换新调拨运费', amount: 121, dateStart: '2026-10-15', dateEnd: '2026-10-15', userName: '商婷', auditor: 'mubai', operator: 'admin', remark: '已付款', images: [], reviewStatus: 'pending' },
    { id: 'r2', item: '采购办公耗材', amount: 340, dateStart: '2026-10-16', dateEnd: '2026-10-16', userName: '商婷', auditor: 'mubai', operator: 'admin', remark: '', images: [], reviewStatus: 'passed', reviewedAt: '2026-10-20T02:00:00.000Z' },
    { id: 'r3', item: '仓库物流费', amount: 260, dateStart: '2026-10-18', dateEnd: '2026-10-18', userName: '李明', auditor: '张伟', operator: 'admin', remark: '加急', images: [], reviewStatus: 'rejected', reviewedAt: '2026-10-19T02:00:00.000Z' },
    { id: 'r4', item: '清洁用品补给', amount: 90, dateStart: '2026-10-19', dateEnd: '2026-10-19', userName: '李明', auditor: '张伟', operator: 'mubai', remark: '', images: [], reviewStatus: 'pending' },
    { id: 'r5', item: '设备零件采购', amount: 480, dateStart: '2026-10-21', dateEnd: '2026-10-21', userName: '商婷', auditor: '张伟', operator: 'admin', remark: '大额', images: [], reviewStatus: 'pending' },
    { id: 'r6', item: '临时快递费', amount: 55, dateStart: '2026-10-22', dateEnd: '2026-10-22', userName: '王芳', auditor: 'mubai', operator: 'admin', remark: '', images: [], reviewStatus: 'pending' },
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

  await page.goto('http://127.0.0.1:8080/', { waitUntil: 'domcontentloaded' });
  await page.evaluate((seed) => {
    sessionStorage.setItem('cmg_session_v1', JSON.stringify({
      token: 't', userId: 'u_admin', username: 'admin', role: 'admin',
      features: ['finance-ledger'], mustChangePwd: false,
      exp: Date.now() + 86400000, lastSeen: Date.now(),
    }));
    localStorage.setItem('cmg_finance_ledger_v1__u_u_admin', JSON.stringify(seed));
    localStorage.removeItem('cmg_rail_active_group');
  }, SEED);
  await page.goto('http://127.0.0.1:8080/#/review-pending', { waitUntil: 'networkidle2' });
  await wait(2500);
  await page.evaluate(() => {
    const g = document.getElementById('authGate'); if (g) g.remove();
    document.querySelectorAll('.modal-overlay').forEach((m) => { m.classList.remove('show'); m.style.display = ''; });
    document.documentElement.classList.remove('auth-need-login');
    const a = document.querySelector('.app-layout');
    if (a) { a.style.visibility = 'visible'; a.style.opacity = '1'; a.style.pointerEvents = ''; }
  });
  await wait(1000);

  const R = {};

  // ---- ① 侧边栏双栏 ----
  R.rail = await page.evaluate(() => {
    const rail = document.getElementById('appRail');
    const rr = rail ? rail.getBoundingClientRect() : null;
    /* 统一外壳：图标栏与名称栏同属 .menu-shell-body，彼此紧邻 */
    const shell = document.getElementById('menuShell');
    const sr = shell ? shell.getBoundingClientRect() : null;
    const menu = document.getElementById('sidebarMenu');
    const mr = menu ? menu.getBoundingClientRect() : null;
    const main = document.querySelector('.main-content');
    const mrMain = main ? main.getBoundingClientRect() : null;
    return {
      exists: !!rail,
      width: rr ? Math.round(rr.width) : 0,
      x: rr ? Math.round(rr.left) : 0,
      items: rail ? rail.querySelectorAll('.app-rail-item').length : 0,
      labels: rail ? Array.from(rail.querySelectorAll('.app-rail-item')).map((b) => b.getAttribute('data-rail-label')) : [],
      activeGroup: rail ? (rail.querySelector('.app-rail-item.is-active') || {}).dataset?.railGroup : null,
      shellX: sr ? Math.round(sr.left) : 0,
      shellW: sr ? Math.round(sr.width) : 0,
      /* 两栏必须同属一个容器且紧邻（无间隙），即「两个模块不能拆开」 */
      sameShell: !!(rail && menu && rail.parentElement === menu.parentElement),
      adjacent: rr && mr ? Math.abs(mr.left - rr.right) < 2 : false,
      mainX: mrMain ? Math.round(mrMain.left) : 0,
      railBadge: (() => {
        const b = document.querySelector('[data-rail-badge="finance"]');
        return b ? { text: b.textContent, hidden: b.hidden } : null;
      })(),
      visibleGroups: Array.from(document.querySelectorAll('#sidebarMenu .menu-group')).filter((g) => !g.hidden).map((g) => g.getAttribute('data-group')),
      panelTitle: (document.getElementById('sidebarPanelTitle') || {}).textContent,
    };
  });
  await page.screenshot({ path: `${OUT}/v3-rail-finance.png` });

  // 点击「仓库管理」图标 → 面板切换
  await page.evaluate(() => {
    const b = document.querySelector('.app-rail-item[data-rail-group="wh"]');
    if (b) b.click();
  });
  await wait(1000);
  R.railAfterSwitch = await page.evaluate(() => ({
    activeGroup: (document.querySelector('.app-rail-item.is-active') || {}).dataset?.railGroup,
    visibleGroups: Array.from(document.querySelectorAll('#sidebarMenu .menu-group')).filter((g) => !g.hidden).map((g) => g.getAttribute('data-group')),
    visibleItems: Array.from(document.querySelectorAll('#sidebarMenu .menu-group:not([hidden]) .menu-item')).map((i) => i.textContent.trim().replace(/\s+/g, ' ')),
    pageTitle: document.getElementById('pageTitle').textContent,
    panelTitle: (document.getElementById('sidebarPanelTitle') || {}).textContent,
  }));
  await page.screenshot({ path: `${OUT}/v3-rail-wh.png` });

  // ---- ② 审批流程节点 ----
  await page.goto('http://127.0.0.1:8080/#/review-pending', { waitUntil: 'networkidle2' });
  await wait(2000);
  await page.evaluate(() => {
    const g = document.getElementById('authGate'); if (g) g.remove();
    const a = document.querySelector('.app-layout'); if (a) { a.style.visibility = 'visible'; a.style.opacity = '1'; }
  });
  await wait(1000);

  const readFlow = () => page.evaluate(() => Array.from(document.querySelectorAll('#flowSteps .flow-step')).map((b) => ({
    flow: b.getAttribute('data-flow'),
    count: (b.querySelector('[data-flow-count]') || {}).textContent,
    done: b.classList.contains('is-done'),
    current: b.classList.contains('is-current'),
    empty: b.classList.contains('is-empty'),
    rejected: b.classList.contains('is-rejected'),
  })));
  R.flowPending = await readFlow();
  await page.screenshot({ path: `${OUT}/v3-flow-pending.png` });

  // 点击「已通过」节点 → 应真实切页
  await page.evaluate(() => { const b = document.querySelector('#flowSteps .flow-step[data-flow="passed"]'); if (b) b.click(); });
  await wait(1200);
  R.afterFlowClick = await page.evaluate(() => ({
    hash: location.hash,
    pageTitle: document.getElementById('pageTitle').textContent,
    visibleView: (document.querySelector('#page-review-center .fin-view:not([hidden])') || {}).dataset?.reviewView,
    rows: document.querySelectorAll('#reviewPassedBody tr').length,
  }));
  R.flowPassed = await readFlow();
  await page.screenshot({ path: `${OUT}/v3-flow-passed.png` });

  // 真实数据交互：通过一条待审核 → 各节点计数应同步变化
  await page.goto('http://127.0.0.1:8080/#/review-pending', { waitUntil: 'networkidle2' });
  await wait(2000);
  await page.evaluate(() => {
    const g = document.getElementById('authGate'); if (g) g.remove();
    const a = document.querySelector('.app-layout'); if (a) { a.style.visibility = 'visible'; a.style.opacity = '1'; a.style.pointerEvents = ''; }
  });
  await wait(900);
  const before = await page.evaluate(() => document.querySelectorAll('#reviewPendingBody tr').length);
  await page.evaluate(() => { const b = document.querySelector('#reviewPendingBody [data-review-pass]'); if (b) b.click(); });
  await wait(700);
  await page.evaluate(() => { const b = document.getElementById('modalOk'); if (b) b.click(); });
  await wait(1000);
  R.dataInteraction = await page.evaluate((b) => ({
    pendingBefore: b,
    pendingAfter: document.querySelectorAll('#reviewPendingBody tr').length,
    counts: Array.from(document.querySelectorAll('#flowSteps .flow-step')).map((s) => s.getAttribute('data-flow') + '=' + s.querySelector('[data-flow-count]').textContent),
    railBadge: (() => { const x = document.querySelector('[data-rail-badge="finance"]'); return x ? x.textContent + (x.hidden ? '(hidden)' : '') : null; })(),
    menuBadge: (document.getElementById('reviewPendingBadge') || {}).textContent,
    stored: JSON.parse(localStorage.getItem('cmg_finance_ledger_v1__u_u_admin')).records.filter((r) => r.reviewStatus === 'passed').length,
  }), before);
  await page.screenshot({ path: `${OUT}/v3-flow-after-pass.png` });

  R.jsErrors = errors;
  R.pass = R.rail.exists && R.rail.items >= 5 && R.rail.sameShell && R.rail.adjacent
    && R.railAfterSwitch.activeGroup === 'wh' && R.railAfterSwitch.visibleGroups.length === 1
    && R.flowPending.length === 4
    && R.afterFlowClick.visibleView === 'passed' && R.afterFlowClick.pageTitle === '已通过'
    && R.dataInteraction.pendingAfter === R.dataInteraction.pendingBefore - 1
    && errors.length === 0;
  console.log(JSON.stringify(R, null, 2));
  await browser.close();
  process.exit(R.pass ? 0 : 1);
})().catch((e) => { console.error('ERR', e); process.exit(1); });