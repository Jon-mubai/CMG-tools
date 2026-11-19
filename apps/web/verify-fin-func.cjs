/* 备用金模块功能回归：提交登记 / 筛选 / 来源增删 / 额度保存 / 图表随数据更新 */
const puppeteer = require('puppeteer-core');
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
  await page.evaluate(() => {
    sessionStorage.setItem('cmg_session_v1', JSON.stringify({
      token: 't', userId: 'u_admin', username: 'admin', role: 'admin',
      features: ['finance-ledger'], mustChangePwd: false,
      exp: Date.now() + 86400000, lastSeen: Date.now(),
    }));
  });
  await page.goto('http://127.0.0.1:8080/#/finance-board', { waitUntil: 'networkidle2' });
  await wait(2500);
  await page.evaluate(() => {
    ['authGate', 'modalOverlay'].forEach((id) => { const e = document.getElementById(id); if (e) e.remove(); });
    document.documentElement.classList.remove('auth-need-login');
    // 关键：闸门关闭时会把 .app-layout 置为 visibility:hidden，
    // 不恢复则按钮尺寸为 0，page.click 点了空气
    const app = document.querySelector('.app-layout');
    if (app) { app.style.visibility = 'visible'; app.style.opacity = '1'; app.style.pointerEvents = ''; }
    document.querySelectorAll('.page-section').forEach((s) => {
      const on = s.id === 'page-finance-ledger';
      s.classList.toggle('active', on); s.style.display = on ? 'block' : 'none';
    });
  });
  await wait(600);
  // 鉴权被绕过时 enterApp 不会调用 bind()，此处显式绑定一次
  await page.evaluate(() => { if (window.FinanceModule && window.FinanceModule.bind) window.FinanceModule.bind(); });
  await wait(300);

  const out = {};
  const view = (v) => page.evaluate((x) => window.FinanceModule.showView(x), v);

  // ① 提交一条登记 → 记录数 +1，余额扣减
  await view('register');
  await page.evaluate(() => {
    const set = (id, val) => { const e = document.getElementById(id); e.value = val; e.dispatchEvent(new Event('input', { bubbles: true })); };
    set('finItem', '回归测试支出'); set('finAmount', '200'); set('finUser', '测试员'); set('finAuditor', '审核员');
    // 使用日期为必填项：直接写入隐藏域（等价于日期选择器选中今天）
    set('finPeriodStart', '2026-10-22'); set('finPeriodEnd', '2026-10-22');
  });
  const before = await page.evaluate(() => JSON.parse(localStorage.getItem('cmg_finance_ledger_v1__u_u_admin') || '{"records":[]}').records.length);
  await page.click('#finBtnAdd');
  await wait(900);
  const after = await page.evaluate(() => {
    const d = JSON.parse(localStorage.getItem('cmg_finance_ledger_v1__u_u_admin') || '{"records":[]}');
    return { n: d.records.length, item: d.records[d.records.length - 1] && d.records[d.records.length - 1].item };
  });
  out.submit = { before, after: after.n, saved: after.item === '回归测试支出', pass: after.n === before + 1 };

  // ② 额度保存
  await view('amount');
  await page.evaluate(() => {
    const e = document.getElementById('finReserveAmount');
    e.value = '5000'; e.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await page.click('#finBtnSaveReserve');
  await wait(700);
  out.reserve = await page.evaluate(() => JSON.parse(localStorage.getItem('cmg_finance_ledger_v1__u_u_admin') || '{}').reserve === 5000);

  // ③ 来源新增
  await view('source');
  await page.evaluate(() => {
    const e = document.getElementById('finSourceName');
    e.value = '回归测试来源'; e.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await page.click('#finBtnAddSource');
  await wait(700);
  out.source = await page.evaluate(() => {
    const d = JSON.parse(localStorage.getItem('cmg_finance_ledger_v1__u_u_admin') || '{}');
    return (d.sources || []).some((s) => s.name === '回归测试来源');
  });

  // ④ 记录列表渲染 + 筛选
  await view('records');
  await wait(700);
  out.rows = await page.evaluate(() => document.querySelectorAll('#finTableBody tr').length);
  await page.evaluate(() => { const s = document.getElementById('finFilterOperator'); s.value = 'admin'; });
  await page.click('#finBtnFilter');
  await wait(700);
  out.filteredRows = await page.evaluate(() => document.querySelectorAll('#finTableBody tr').length);

  // ⑤ 看板图表随数据刷新（时间序列已由折线图改为热力图）
  await view('board');
  await wait(1000);
  out.charts = await page.evaluate(() => {
    const g = (id) => { const s = document.querySelector('#' + id + ' svg'); return s ? Math.round(s.getBoundingClientRect().width) : 'NONE'; };
    return {
      user: g('finChartUser'),
      auditor: g('finChartAuditor'),
      heatCells: document.querySelectorAll('#finChartTime .fin-heat-cell').length,
    };
  });

  // ⑥ 空态：清空数据后不得抛错
  await page.evaluate(() => localStorage.removeItem('cmg_finance_ledger_v1__u_u_admin'));
  await page.evaluate(() => window.FinanceModule.reload());
  await wait(900);
  out.emptyState = await page.evaluate(() => {
    window.FinanceModule.showView('board');
    return document.querySelectorAll('#finChartUser svg').length > 0;
  });

  out.jsErrors = errors;
  out.pass = out.submit.pass && out.reserve && out.source && out.charts.heatCells > 300 && errors.length === 0;
  console.log(JSON.stringify(out, null, 2));
  await browser.close();
  process.exit(out.pass ? 0 : 1);
})().catch((e) => { console.error('ERR', e); process.exit(1); });