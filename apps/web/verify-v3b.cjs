/* 用真实鼠标事件验证范围选择两步交互 */
const puppeteer = require('puppeteer-core');
(async () => {
  const browser = await puppeteer.launch({
    executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    headless: 'new',
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1600, height: 1000 });
  await page.goto('http://127.0.0.1:8080/#/finance-ledger', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 2500));
  await page.evaluate(() => {
    document.querySelectorAll('.modal-overlay, #loginOverlay, .login-overlay').forEach(el => { el.style.display = 'none'; });
    const s = document.getElementById('page-finance-ledger');
    if (s) { s.classList.add('active'); s.style.display = 'block'; }
  });
  await new Promise(r => setTimeout(r, 600));

  await page.click('#finPeriodTrigger');
  await new Promise(r => setTimeout(r, 500));

  // 真实鼠标点击左日历 10 号
  const clickDay = async (n) => {
    const box = await page.evaluate((num) => {
      const days = document.querySelectorAll('#finCalDaysL .mp-dp-day:not(.is-other)');
      for (const d of days) {
        if (d.textContent.trim() === String(num)) {
          const r = d.getBoundingClientRect();
          return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
        }
      }
      return null;
    }, n);
    if (box) await page.mouse.click(box.x, box.y);
    await new Promise(r => setTimeout(r, 400));
  };

  await clickDay(10);
  const s1 = await page.evaluate(() => {
    const p = document.getElementById('finPeriodPanel');
    const r = p.getBoundingClientRect();
    return { visible: r.width > 0 && r.height > 0, picking: window.__finDp && window.__finDp.picking };
  });
  console.log('点击10号后: 面板可见=%s, 等待选终点=%s', s1.visible, s1.picking);

  await clickDay(20);
  const s2 = await page.evaluate(() => {
    const p = document.getElementById('finPeriodPanel');
    const r = p.getBoundingClientRect();
    return {
      visible: r.width > 0 && r.height > 0,
      start: document.getElementById('finPeriodStart').value,
      end: document.getElementById('finPeriodEnd').value,
      display: document.getElementById('finPeriodDisplay').textContent.trim(),
    };
  });
  console.log('点击20号后:', JSON.stringify(s2));

  // 再验证同一天显示：重开面板点同一天两次
  await page.click('#finPeriodTrigger');
  await new Promise(r => setTimeout(r, 500));
  await clickDay(15);
  await clickDay(15);
  const s3 = await page.evaluate(() => document.getElementById('finPeriodDisplay').textContent.trim());
  console.log('同一天两次点击显示:', s3);

  await browser.close();
  console.log('DONE');
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
