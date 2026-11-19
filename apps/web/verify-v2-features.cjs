/* 验证本轮 5 项需求：热力图 / 顶栏徽标移除 / 抽屉样式 / 审核菜单 / 软删除+居中确认弹窗 */
const puppeteer = require('puppeteer-core');
const fs = require('fs');
const OUT = 'D:/ProgramData/others/cucumber-inventory-project/apps/web/_verify';
fs.mkdirSync(OUT, { recursive: true });

const KEY = 'cmg_finance_ledger_v1__u_u_admin';
const SEED = {
  reserve: 3000,
  sources: [{ id: 's1', name: '财务拨付' }, { id: 's2', name: '项目结余' }],
  records: [
    { id: 'r1', item: '机台换新调拨运费', amount: 121, dateStart: '2026-10-15', dateEnd: '2026-10-15', userName: '商婷', auditor: 'mubai', operator: 'admin', remark: '已付款', images: [] },
    { id: 'r2', item: '采购办公耗材', amount: 340, dateStart: '2026-10-16', dateEnd: '2026-10-16', userName: '商婷', auditor: 'mubai', operator: 'admin', remark: '', images: [] },
    { id: 'r3', item: '仓库物流费', amount: 260, dateStart: '2026-10-18', dateEnd: '2026-10-18', userName: '李明', auditor: '张伟', operator: 'admin', remark: '加急', images: [] },
    { id: 'r4', item: '清洁用品补给', amount: 90, dateStart: '2025-06-19', dateEnd: '2025-06-19', userName: '李明', auditor: '张伟', operator: 'mubai', remark: '', images: [] },
    { id: 'r5', item: '临时快递费', amount: 55, dateStart: '2026-10-20', dateEnd: '2026-10-20', userName: '王芳', auditor: 'mubai', operator: 'admin', remark: '', images: [] },
    { id: 'r6', item: '设备零件采购', amount: 480, dateStart: '2026-10-21', dateEnd: '2026-10-21', userName: '商婷', auditor: '张伟', operator: 'admin', remark: '大额', images: [] },
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
  }, SEED);
  await page.goto('http://127.0.0.1:8080/#/finance-board', { waitUntil: 'networkidle2' });
  await wait(2500);

  async function forceOpen() {
    await page.evaluate(() => {
      /* 登录闸门会被异步 vault 反复重开且带内联样式，只能移除节点 */
      const gate = document.getElementById('authGate');
      if (gate) gate.remove();
      /* 注意：初始化弹窗只能清 class，不能删节点——
         删除后 showConfirm 无处渲染，会导致确认流程测不到 */
      document.querySelectorAll('.modal-overlay').forEach((m) => {
        m.classList.remove('show');
        m.style.display = '';
      });
      document.documentElement.classList.remove('auth-need-login');
      const app = document.querySelector('.app-layout');
      if (app) { app.style.visibility = 'visible'; app.style.opacity = '1'; app.style.pointerEvents = ''; }
      document.querySelectorAll('.page-section').forEach((s) => {
        const on = s.id === 'page-finance-ledger' || s.id === 'page-review-center';
        s.classList.toggle('active', on); s.style.display = on ? 'block' : 'none';
      });
    });
    await page.evaluate(() => { if (window.FinanceModule && window.FinanceModule.bind) window.FinanceModule.bind(); });
    await wait(400);
  }
  await forceOpen();

  const R = {};
  const view = (v) => page.evaluate((x) => window.FinanceModule.showView(x), v);

  // ---- ① 热力图 ----
  await view('board');
  await wait(1200);
  await page.screenshot({ path: `${OUT}/v2-board-heat.png` });
  R.heat = await page.evaluate(() => {
    const cells = document.querySelectorAll('#finChartTime .fin-heat-cell:not(.is-out)');
    const weeks = document.querySelectorAll('#finChartTime .fin-heat-week');
    const years = document.querySelectorAll('#finHeatYears .fin-heat-year');
    const lv = {};
    cells.forEach((c) => { const k = c.className.match(/lv(\d)/)[1]; lv[k] = (lv[k] || 0) + 1; });
    return {
      cells: cells.length, weeks: weeks.length, years: years.length,
      monthLabels: document.querySelectorAll('#finChartTime .fin-heat-month').length,
      dayLabels: document.querySelectorAll('#finChartTime .fin-heat-days span').length,
      levels: lv,
      summary: (document.querySelector('#finChartTime .fin-heat-summary') || {}).textContent || '',
      lineSvg: document.querySelectorAll('#finChartTime svg').length,
    };
  });

  // 年份切换
  await page.evaluate(() => {
    const btns = document.querySelectorAll('#finHeatYears .fin-heat-year');
    const target = Array.from(btns).find((b) => b.textContent === '2025') || btns[btns.length - 1];
    if (target) target.click();
  });
  await wait(700);
  R.heatAfterSwitch = await page.evaluate(() => ({
    summary: (document.querySelector('#finChartTime .fin-heat-summary') || {}).textContent || '',
    active: (document.querySelector('#finHeatYears .fin-heat-year.is-active') || {}).textContent || '',
  }));
  await page.screenshot({ path: `${OUT}/v2-board-heat-2025.png` });

  // ---- ② 顶栏总商品徽标 ----
  R.topbar = await page.evaluate(() => ({
    topbarStat: !!document.getElementById('topbarStat'),
    totalText: (document.body.innerText.match(/总商品/g) || []).length,
  }));

  // ---- ③ 抽屉样式 ----
  await view('records');
  await wait(900);
  await page.evaluate(() => {
    const b = document.querySelector('#finTableBody [data-fin-edit]');
    if (b) b.click();
  });
  await wait(900);
  await page.screenshot({ path: `${OUT}/v2-drawer.png` });
  R.drawer = await page.evaluate(() => {
    const d = document.getElementById('finDrawer');
    const secs = d ? d.querySelectorAll('.drawer-section') : [];
    return {
      open: !!(d && (d.offsetWidth > 0 || d.parentElement.classList.contains('is-open'))),
      sections: secs.length,
      titles: Array.from(d ? d.querySelectorAll('.drawer-section-title') : []).map((e) => e.textContent.trim()),
      bodyPad: d ? getComputedStyle(d.querySelector('.drawer-body')).padding : '',
      ftBg: d ? getComputedStyle(d.querySelector('.drawer-ft')).backgroundColor : '',
    };
  });
  await page.evaluate(() => { const c = document.getElementById('finDrawerClose'); if (c) c.click(); });
  await wait(500);

  // ---- ④ 审核中心 ----
  const revViews = ['pending', 'done', 'passed', 'rejected'];
  await view('pending');
  await wait(900);
  await page.screenshot({ path: `${OUT}/v2-review-pending.png` });
  R.review = {};
  const META = { pending: 'reviewPendingMeta', done: 'reviewDoneMeta', passed: 'reviewPassedMeta', rejected: 'reviewRejectedMeta' };
  for (const v of revViews) {
    await view(v);
    await wait(700);
    const bodyId = { pending: 'reviewPendingBody', done: 'reviewDoneBody', passed: 'reviewPassedBody', rejected: 'reviewRejectedBody' }[v];
    R.review[v] = await page.evaluate((id, mid) => {
      const b = document.getElementById(id);
      const vis = document.querySelector('#page-review-center .fin-view[data-review-view="' +
        ({ reviewPendingBody: 'pending', reviewDoneBody: 'done', reviewPassedBody: 'passed', reviewRejectedBody: 'rejected' })[id] + '"]');
      return {
        rows: b ? b.querySelectorAll('tr').length : 0,
        visible: !!(vis && !vis.hidden),
        meta: (document.getElementById(mid) || {}).textContent || '',
      };
    }, bodyId, META[v]);
    if (v !== 'pending') await page.screenshot({ path: `${OUT}/v2-review-${v}.png` });
  }
  await view('pending');
  await wait(800);

  // 审核操作：通过第一条
  const passBefore = R.review.pending.rows;
  await page.evaluate(() => { const b = document.querySelector('#reviewPendingBody [data-review-pass]'); if (b) b.click(); });
  await wait(700);
  R.confirmDialog = await page.evaluate(() => {
    const ov = document.getElementById('modalOverlay');
    if (!ov) return { shown: false };
    const box = document.getElementById('modalBox');
    const r = box.getBoundingClientRect();
    const cs = getComputedStyle(ov);
    return {
      shown: ov.classList.contains('show'),
      title: (document.getElementById('modalTitle') || {}).textContent || '',
      content: (document.getElementById('modalContent') || {}).textContent.slice(0, 40) || '',
      ok: (document.getElementById('modalOk') || {}).textContent || '',
      cancel: (document.getElementById('modalCancel') || {}).textContent || '',
      centered: Math.abs((r.left + r.right) / 2 - window.innerWidth / 2) < 3 && Math.abs((r.top + r.bottom) / 2 - window.innerHeight / 2) < 3,
      justify: cs.justifyContent + '/' + cs.alignItems,
      danger: box.classList.contains('modal-danger'),
    };
  });
  await page.screenshot({ path: `${OUT}/v2-confirm.png` });
  await page.evaluate(() => { const b = document.getElementById('modalOk'); if (b) b.click(); });
  await wait(800);
  R.reviewAfterPass = await page.evaluate(() => ({
    pendingRows: document.querySelectorAll('#reviewPendingBody tr').length,
    passedText: (document.getElementById('reviewPassedMeta') || {}).textContent || '',
    badge: (document.getElementById('reviewPendingBadge') || {}).textContent || '',
  }));
  await page.screenshot({ path: `${OUT}/v2-review-passed.png` });

  // ---- ⑤ 软删除 ----
  await view('records');
  await wait(900);
  const rowsBefore = await page.evaluate(() => document.querySelectorAll('#finTableBody tr').length);
  await page.evaluate(() => { const b = document.querySelector('#finTableBody [data-fin-del]'); if (b) b.click(); });
  await wait(600);
  const delTitle = await page.evaluate(() => (document.getElementById('modalTitle') || {}).textContent || '');
  await page.evaluate(() => { const b = document.getElementById('modalOk'); if (b) b.click(); });
  await wait(900);
  R.softDelete = await page.evaluate((before) => {
    const stored = JSON.parse(localStorage.getItem('cmg_finance_ledger_v1__u_u_admin') || '{}');
    const all = stored.records || [];
    return {
      rowsBefore: before,
      rowsAfter: document.querySelectorAll('#finTableBody tr').length,
      storedTotal: all.length,
      activeCount: all.filter((r) => !r.deleted).length,
      deletedCount: all.filter((r) => r.deleted).length,
      hasDeletedAt: all.some((r) => r.deleted && !!r.deletedAt),
      quotaText: (document.getElementById('finStatUsed') || {}).textContent || '',
    };
  }, rowsBefore);
  R.softDelete.delTitle = delTitle;

  R.jsErrors = errors;
  R.pass = R.heat.cells > 300 && R.heat.years >= 3 && !R.topbar.topbarStat
    && R.drawer.sections === 2 && R.confirmDialog.shown && R.confirmDialog.centered
    && R.softDelete.deletedCount === 1 && R.softDelete.storedTotal === rowsBefore
    && errors.length === 0;
  console.log(JSON.stringify(R, null, 2));
  await browser.close();
  process.exit(R.pass ? 0 : 1);
})().catch((e) => { console.error('ERR', e); process.exit(1); });