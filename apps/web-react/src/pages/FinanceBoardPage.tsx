import { useEffect, useMemo, useState } from 'react';
import { loadLedger, money, type FinRecord } from '@/finance';

type Props = { token: string | null };
const USER_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4'];
const AUDITOR_COLORS = ['#6366f1', '#14b8a6', '#eab308', '#ec4899', '#0ea5e9', '#22c55e'];

function donut(segments: { name: string; qty: number }[], colors: string[]) {
  const total = segments.reduce((s, x) => s + x.qty, 0) || 1;
  const size = 200;
  const cx = 100;
  const cy = 100;
  const r = 96;
  const ir = 60;
  let angle = -Math.PI / 2;
  return segments.map((seg, i) => {
    const sweep = (seg.qty / total) * Math.PI * 2;
    const a1 = angle;
    const a2 = angle + Math.max(sweep, 0.001);
    angle = a2;
    const large = sweep > Math.PI ? 1 : 0;
    const p = (a: number, rad: number) => [cx + Math.cos(a) * rad, cy + Math.sin(a) * rad];
    const [x1, y1] = p(a1, r);
    const [x2, y2] = p(a2, r);
    const [x3, y3] = p(a2, ir);
    const [x4, y4] = p(a1, ir);
    const d = `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} L ${x3} ${y3} A ${ir} ${ir} 0 ${large} 0 ${x4} ${y4} Z`;
    return { d, color: colors[i % colors.length], ...seg };
  });
}
function groupBy(rows: FinRecord[], key: (r: FinRecord) => string) {
  const map = new Map<string, number>();
  for (const r of rows) {
    const k = key(r) || '未填写';
    map.set(k, (map.get(k) || 0) + 1);
  }
  return [...map.entries()].map(([name, qty]) => ({ name, qty })).sort((a, b) => b.qty - a.qty);
}

const HEAT_MONTHS = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'];
const HEAT_DAYS = ['一','二','三','四','五','六','日'];

function heatLevel(n: number) {
  if (n <= 0) return 0;
  if (n <= 2) return 1;
  if (n <= 5) return 2;
  if (n <= 9) return 3;
  return 4;
}

function heatFor(rows: FinRecord[], year: number) {
  const counts = new Map<string, number>();
  for (const r of rows) {
    const d = String(r.dateStart || r.createdAt || '').slice(0, 10);
    if (d.startsWith(String(year))) counts.set(d, (counts.get(d) || 0) + 1);
  }
  const first = new Date(year, 0, 1);
  const lead = (first.getDay() + 6) % 7;
  const cursor = new Date(year, 0, 1 - lead);
  const weeks: { date: string; n: number; out: boolean; lv: number }[][] = [];
  const months: { label: string; week: number }[] = [];
  for (let guard = 0; guard < 60; guard++) {
    const cells = [];
    let monthMark = '';
    for (let d = 0; d < 7; d++) {
      const y = cursor.getFullYear();
      const m = cursor.getMonth();
      const day = cursor.getDate();
      const iso = `${y}-${String(m + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const out = y !== year;
      const n = counts.get(iso) || 0;
      if (!out && day === 1) monthMark = HEAT_MONTHS[m];
      cells.push({ date: out ? '' : iso, n, out, lv: heatLevel(n) });
      cursor.setDate(cursor.getDate() + 1);
    }
    if (monthMark) months.push({ label: monthMark, week: weeks.length });
    weeks.push(cells);
    if (cursor.getFullYear() > year && cursor.getMonth() === 0) break;
  }
  return { weeks, months };
}

export function FinanceBoardPage({ token }: Props) {
  const [rows, setRows] = useState<FinRecord[]>([]);
  const [reserve, setReserve] = useState(0);
  const [error, setError] = useState('');
  const [year, setYear] = useState(new Date().getFullYear());
  const [tip, setTip] = useState<{ text: string; x: number; y: number } | null>(null);

  useEffect(() => {
    loadLedger(token)
      .then((d) => { setRows(d.records); setReserve(d.reserve); })
      .catch((e) => setError(e instanceof Error ? e.message : '额度数据加载失败'));
  }, [token]);

  const used = rows.reduce((s, r) => s + (Number(r.amount) || 0), 0);
  const balance = reserve - used;
  const users = useMemo(() => groupBy(rows, (r) => r.userName || ''), [rows]);
  const auditors = useMemo(() => groupBy(rows, (r) => r.auditor || ''), [rows]);
  const userSeg = donut(users, USER_COLORS);
  const auditorSeg = donut(auditors, AUDITOR_COLORS);
  const showTip = (text: string, e: React.MouseEvent) => {
    setTip({ text, x: e.clientX + 12, y: e.clientY + 14 });
  };
  const heat = useMemo(() => heatFor(rows, year), [rows, year]);
  const heatStats = useMemo(() => {
    const days = heat.weeks.flat().filter((c) => c.date);
    const byMonth = new Map<string, number>();
    let bestDay = { date: '', n: 0 };
    let longest = 0;
    let current = 0;
    let run = 0;
    for (const c of days) {
      const month = c.date.slice(0, 7);
      byMonth.set(month, (byMonth.get(month) || 0) + c.n);
      if (c.n > bestDay.n) bestDay = { date: c.date, n: c.n };
      if (c.n > 0) { run += 1; longest = Math.max(longest, run); }
      else run = 0;
    }
    for (let i = days.length - 1; i >= 0 && days[i].n > 0; i--) current += 1;
    const topMonth = [...byMonth.entries()].sort((a, b) => b[1] - a[1])[0];
    return {
      month: topMonth && topMonth[1] ? topMonth[0] : '—',
      day: bestDay.n ? bestDay.date : '—',
      longest: longest || '—',
      current: current || '—',
    };
  }, [heat]);

  return (
    <div className="fin-page fin-flow">
      <div className="fin-view" data-fin-view="board">
        {error && <div className="empty">{error}</div>}
        <div className="fin-stats" role="group" aria-label="备用金汇总统计">
          <div className="fin-stat">
            <span className="fin-stat-label"><iconify-icon icon="ant-design:wallet-outlined" width="14" height="14" />备用金定额总额</span>
            <strong className="fin-stat-value">{money(reserve)}</strong>
          </div>
          <div className="fin-stat">
            <span className="fin-stat-label"><iconify-icon icon="ant-design:rise-outlined" width="14" height="14" />累计支出金额</span>
            <strong className="fin-stat-value">{money(used)}</strong>
          </div>
          <div className={`fin-stat fin-stat-primary${balance < 0 ? ' is-low' : ''}`} id="finStatBalanceCard">
            <span className="fin-stat-label"><iconify-icon icon="ant-design:account-book-outlined" width="14" height="14" />当前剩余余额</span>
            <strong className="fin-stat-value">{money(balance)}</strong>
          </div>
        </div>

        <div className="fin-charts">
          <div className="fin-chart-card">
            <div className="fin-chart-title">使用人统计</div>
            <div className="fin-chart-split">
              <div className="fin-chart-body fin-chart-donut">
                <div className="fin-chart-plot">
                  <svg width="200" height="200" viewBox="0 0 200 200">
                    {userSeg.map((s) => (
                      <path
                        key={s.name}
                        d={s.d}
                        fill={s.color}
                        stroke="#fff"
                        strokeWidth="2"
                        onMouseMove={(e) => showTip(`${s.name} ${s.qty} 笔`, e)}
                        onMouseLeave={() => setTip(null)}
                      />
                    ))}
                  </svg>
                </div>
              </div>
              <div className="fin-chart-legend">
                {users.map((u, i) => (
                  <span className="fin-legend-item" key={u.name}>
                    <i className="fin-legend-dot" style={{ background: USER_COLORS[i % USER_COLORS.length] }} />
                    <span className="fin-legend-name">{u.name}</span>
                    <span className="fin-legend-value">{u.qty}</span>
                  </span>
                ))}
              </div>
            </div>
          </div>
          <div className="fin-chart-card">
            <div className="fin-chart-title">审核人统计</div>
            <div className="fin-chart-split">
              <div className="fin-chart-body fin-chart-donut">
                <div className="fin-chart-plot">
                  <svg width="200" height="200" viewBox="0 0 200 200">
                    {auditorSeg.map((s) => (
                      <path
                        key={s.name}
                        d={s.d}
                        fill={s.color}
                        stroke="#fff"
                        strokeWidth="2"
                        onMouseMove={(e) => showTip(`${s.name} ${s.qty} 笔`, e)}
                        onMouseLeave={() => setTip(null)}
                      />
                    ))}
                  </svg>
                </div>
              </div>
              <div className="fin-chart-legend">
                {auditors.map((u, i) => (
                  <span className="fin-legend-item" key={u.name}>
                    <i className="fin-legend-dot" style={{ background: AUDITOR_COLORS[i % AUDITOR_COLORS.length] }} />
                    <span className="fin-legend-name">{u.name}</span>
                    <span className="fin-legend-value">{u.qty}</span>
                  </span>
                ))}
              </div>
            </div>
          </div>
          <div className="fin-chart-card fin-chart-wide">
            <div className="fin-chart-title">
              使用时间频率统计
              <div className="fin-heat-years">
                {[0, 1, 2].map((off) => {
                  const y = new Date().getFullYear() - off;
                  return <button key={y} type="button" className={`fin-heat-year${y === year ? ' is-active' : ''}`} onClick={() => setYear(y)}>{y}</button>;
                })}
              </div>
            </div>
            <div className="fin-chart-body fin-chart-heat">
              <div className="fin-heat">
                <div className="fin-heat-scroll">
                  <div className="fin-heat-track">
                    <div className="fin-heat-months">
                      {heat.months.map((m) => (
                        <span
                          key={m.label}
                          className="fin-heat-month"
                          style={{ left: `${(m.week / Math.max(1, heat.weeks.length)) * 100}%` }}
                        >
                          {m.label}
                        </span>
                      ))}
                    </div>
                    <div className="fin-heat-body">
                      <div className="fin-heat-days">
                        {HEAT_DAYS.map((d, i) => <span key={d}>{i === 0 || i === 2 || i === 4 ? d : ''}</span>)}
                      </div>
                      <div className="fin-heat-weeks" style={{ ['--heat-weeks' as string]: heat.weeks.length }}>
                        {heat.weeks.map((w, wi) => (
                          <div className="fin-heat-week" key={wi}>
                            {w.map((c, di) => (
                              <i
                                key={c.date || `${wi}-${di}`}
                                className={`fin-heat-cell lv${c.lv}${c.out ? ' is-out' : ''}`}
                                onMouseMove={c.date ? (e) => showTip(`${c.date} · ${c.n} 笔登记`, e) : undefined}
                                onMouseLeave={() => setTip(null)}
                              />
                            ))}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="fin-heat-foot">
                  <div className="fin-heat-stats">
                    <div><span>最活跃月份</span><strong>{heatStats.month}</strong></div>
                    <div><span>最活跃日期</span><strong>{heatStats.day}</strong></div>
                    <div><span>最长连续</span><strong>{heatStats.longest}</strong></div>
                    <div><span>当前连续</span><strong>{heatStats.current}</strong></div>
                  </div>
                  <span className="fin-heat-scale">少{[0, 1, 2, 3, 4].map((lv) => <i key={lv} className={`fin-heat-cell lv${lv}`} />)}多</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      {tip && <div className="fin-tip" style={{ left: tip.x, top: tip.y }}>{tip.text}</div>}
    </div>
  );
}
