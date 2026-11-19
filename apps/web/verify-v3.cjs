/* 验证：①日期范围选择 ②数字输入框无上下箭头 ③输入框宽度统一 */
const puppeteer = require('puppeteer-core');
const fs = require('fs');
const OUT = process.env.OUT_DIR || 'D:/ProgramData/others/cucumber-inventory-project/apps/web/_verify';
fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const browser = await puppeteer.launch({
    executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    headless: 'new',
    args: ['--window-size=1600,1000'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1600, height: 1000 });
  await page.goto('http://127.0.0.1:8080/#/finance-ledger', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 2500));

  // 关闭登录遮罩（若存在）
  await page.evaluate(() => {
    document.querySelectorAll('.modal-overlay, #loginOverlay, .login-overlay').forEach(el => { el.style.display = 'none'; });
    const s = document.getElementById('page-finance-ledger');
    if (s) { s.classList.add('active'); s.style.display = 'block'; }
  });
  await new Promise(r => setTimeout(r, 800));

  // ① 日期范围选择测试
  await page.click('#finPeriodTrigger');
  await new Promise(r => setTimeout(r, 600));
  // 点击左日历 10 号
  await page.evaluate(() => {
    const days = document.querySelectorAll('#finCalDaysL .mp-dp-day:not(.is-other)');
    for (const d of days) { if (d.textContent.trim() === '10') { d.click(); break; } }
  });
  await new Promise(r => setTimeout(r, 400));
  const afterFirst = await page.evaluate(() => ({
    panelOpen: !document.getElementById('finPeriodPanel').hidden,
    start: document.getElementById('finPeriodStart').value,
  }));
  console.log('第一次点击后（面板应保持打开等待选终点）:', JSON.stringify(afterFirst));
  // 点击 20 号作为终点
  await page.evaluate(() => {
    const days = document.querySelectorAll('#finCalDaysL .mp-dp-day:not(.is-other)');
    for (const d of days) { if (d.textContent.trim() === '20') { d.click(); break; } }
  });
  await new Promise(r => setTimeout(r, 400));
  const afterSecond = await page.evaluate(() => ({
    panelOpen: !document.getElementById('finPeriodPanel').hidden,
    start: document.getElementById('finPeriodStart').value,
    end: document.getElementById('finPeriodEnd').value,
    display: document.getElementById('finPeriodDisplay').textContent,
  }));
  console.log('第二次点击后（应形成范围并关闭）:', JSON.stringify(afterSecond));

  // ② 数字输入框箭头检查
  const spinner = await page.evaluate(() => {
    const el = document.getElementById('finAmount');
    const cs = getComputedStyle(el);
    // 创建测试元素读取伪元素样式不可行，改检查 CSS 规则是否存在
    const sheets = Array.from(document.styleSheets);
    let found = false;
    for (const sh of sheets) {
      try {
        for (const r of sh.cssRules) {
          if (r.cssText && r.cssText.indexOf('inner-spin-button') >= 0) { found = true; break; }
        }
      } catch (e) {}
      if (found) break;
    }
    return { mozAppearance: cs.MozAppearance || cs.appearance, ruleFound: found };
  });
  console.log('数字输入框箭头隐藏规则:', JSON.stringify(spinner));

  // ③ 输入框宽度统一检查
  const widths = await page.evaluate(() => {
    const ids = ['finItem', 'finAmount', 'finUser', 'finAuditor', 'finRemark'];
    const r = {};
    ids.forEach(id => { const el = document.getElementById(id); if (el) r[id] = Math.round(el.getBoundingClientRect().width); });
    const trg = document.getElementById('finPeriodTrigger');
    if (trg) r['finPeriodTrigger'] = Math.round(trg.getBoundingClientRect().width);
    return r;
  });
  console.log('各输入框宽度:', JSON.stringify(widths));

  await page.screenshot({ path: OUT + '/v3_form.png' });
  await browser.close();
  console.log('DONE');
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
