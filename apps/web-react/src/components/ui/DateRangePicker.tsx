import { useMemo, useState } from 'react';

type Range = { start: string; end: string };
type Tab = 'custom' | 'day' | 'month' | 'year';
type Props = { value: Range; onChange: (next: Range) => void; placeholder?: string };

function fmt(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function monthCells(year: number, month: number) {
  const first = new Date(year, month, 1);
  const lead = (first.getDay() + 6) % 7;
  const days = new Date(year, month + 1, 0).getDate();
  const cells: { date: string; day: number; out: boolean }[] = [];
  for (let i = 0; i < lead; i++) cells.push({ date: '', day: 0, out: true });
  for (let d = 1; d <= days; d++) cells.push({ date: fmt(new Date(year, month, d)), day: d, out: false });
  while (cells.length % 7) cells.push({ date: '', day: 0, out: true });
  return cells;
}
function presetRange(key: string): Range {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const end = fmt(now);
  const s = new Date(now);
  if (key === 'today') return { start: end, end };
  if (key === 'yesterday') { s.setDate(now.getDate() - 1); const d = fmt(s); return { start: d, end: d }; }
  if (key === 'last24') return { start: end, end };
  if (key === 'last72') { s.setDate(now.getDate() - 2); return { start: fmt(s), end }; }
  if (key === 'last7') { s.setDate(now.getDate() - 6); return { start: fmt(s), end }; }
  if (key === 'thisWeek') { s.setDate(now.getDate() - ((now.getDay() + 6) % 7)); return { start: fmt(s), end }; }
  if (key === 'lastWeek') {
    const endD = new Date(now); endD.setDate(now.getDate() - ((now.getDay() + 6) % 7) - 1);
    const startD = new Date(endD); startD.setDate(endD.getDate() - 6);
    return { start: fmt(startD), end: fmt(endD) };
  }
  if (key === 'thisMonth') return { start: fmt(new Date(now.getFullYear(), now.getMonth(), 1)), end };
  if (key === 'lastMonth') return { start: fmt(new Date(now.getFullYear(), now.getMonth() - 1, 1)), end: fmt(new Date(now.getFullYear(), now.getMonth(), 0)) };
  if (key === 'thisQuarter') {
    const q = Math.floor(now.getMonth() / 3) * 3;
    return { start: fmt(new Date(now.getFullYear(), q, 1)), end };
  }
  if (key === 'lastQuarter') {
    const q = Math.floor(now.getMonth() / 3) * 3 - 3;
    const startD = new Date(now.getFullYear(), q, 1);
    return { start: fmt(startD), end: fmt(new Date(startD.getFullYear(), startD.getMonth() + 3, 0)) };
  }
  return { start: end, end };
}

const PRESETS = [
  ['today', '今天'], ['yesterday', '昨天'], ['last7', '过去7天'],
  ['thisWeek', '本周'], ['lastWeek', '上周'], ['thisMonth', '本月'], ['lastMonth', '上月'],
] as const;
const TABS: { id: Tab; label: string }[] = [
  { id: 'custom', label: '自定义' }, { id: 'day', label: '按日查询' },
  { id: 'month', label: '按月查询' }, { id: 'year', label: '按年查询' },
];

export function DateRangePicker({ value, onChange, placeholder = '请选择日期范围' }: Props) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Range>(value);
  const [cursor, setCursor] = useState(() => new Date());
  const [tab, setTab] = useState<Tab>('custom');

  const label = useMemo(() => {
    if (!value.start) return placeholder;
    if (!value.end || value.start === value.end) return value.start.replace(/-/g, '/');
    return `${value.start.replace(/-/g, '/')}  →  ${value.end.replace(/-/g, '/')}`;
  }, [value, placeholder]);

  const left = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const right = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
  const months = [
    { title: `${left.getFullYear()}年${left.getMonth() + 1}月`, cells: monthCells(left.getFullYear(), left.getMonth()) },
    { title: `${right.getFullYear()}年${right.getMonth() + 1}月`, cells: monthCells(right.getFullYear(), right.getMonth()) },
  ];
  const yearBase = Math.floor(cursor.getFullYear() / 12) * 12;
  const yearCols = [yearBase, yearBase + 12];

  function pick(date: string) {
    if (!draft.start || (draft.start && draft.end && draft.start !== draft.end)) {
      setDraft({ start: date, end: date });
      return;
    }
    setDraft(date < draft.start ? { start: date, end: draft.start } : { start: draft.start, end: date });
  }
  function inRange(date: string) {
    if (!date || !draft.start) return false;
    const end = draft.end || draft.start;
    return date >= draft.start && date <= end;
  }

  return (
    <div className={`mp-datepicker${open ? ' open' : ''}`}>
      <button type="button" className="mp-dp-trigger" style={{ justifyContent: 'flex-start', textAlign: 'left' }} aria-expanded={open} onClick={() => { setDraft(value); setOpen((v) => !v); }}>
        <iconify-icon icon="ant-design:calendar-outlined" width="15" height="15" />
        <span className={`mp-dp-text${!value.start ? ' is-placeholder' : ''}`}>{label}</span>
        <iconify-icon className="mp-dp-caret" icon="ant-design:down-outlined" width="12" height="12" />
      </button>
      {open && (
        <div className="mp-dp-panel" role="dialog" aria-label="日期范围">
          <div className="mp-dp-presets">
            <div className="mp-dp-presets-title">快捷查询</div>
            {PRESETS.map(([k, name]) => (
              <button key={k} type="button" className="mp-preset" onClick={() => setDraft(presetRange(k))}>{name}</button>
            ))}
          </div>
          <div className="mp-dp-main">
            <div className="mp-dp-tabs">
              {TABS.map((t) => (
                <button key={t.id} type="button" className={`mp-dp-tab${tab === t.id ? ' active' : ''}`} onClick={() => setTab(t.id)}>{t.label}</button>
              ))}
            </div>
            {(tab === 'custom' || tab === 'day') && (
              <div className="mp-dp-calendars">
                {months.map((m, i) => (
                  <div className="mp-dp-cal" key={m.title}>
                    <div className="mp-dp-cal-hd">
                      {i === 0 && <button type="button" className="mp-dp-nav" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}>‹</button>}
                      <span className="mp-dp-cal-title">{m.title}</span>
                      {i === 1 && <button type="button" className="mp-dp-nav" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}>›</button>}
                    </div>
                    <div className="mp-dp-week"><span>一</span><span>二</span><span>三</span><span>四</span><span>五</span><span>六</span><span>日</span></div>
                    <div className="mp-dp-days">
                      {m.cells.map((c, idx) => c.out ? <span key={`o-${idx}`} className="mp-dp-day is-out" /> : (
                        <button key={c.date} type="button" className={`mp-dp-day${inRange(c.date) ? ' in-range' : ''}${c.date === draft.start ? ' range-start' : ''}${c.date === draft.end ? ' range-end' : ''}`} onClick={() => pick(c.date)}>{c.day}</button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
            {tab === 'month' && (
              <div className="mp-year-grid">
                {[left.getFullYear(), left.getFullYear() + 1].map((y, i) => (
                  <div className="mp-year-col" key={y}>
                    <div className="mp-dp-cal-hd">
                      {i === 0 && <button type="button" className="mp-dp-nav" onClick={() => setCursor(new Date(cursor.getFullYear() - 1, 0, 1))}>‹</button>}
                      <span>{y}年</span>
                      {i === 1 && <button type="button" className="mp-dp-nav" onClick={() => setCursor(new Date(cursor.getFullYear() + 1, 0, 1))}>›</button>}
                    </div>
                    {Array.from({ length: 12 }, (_, m) => {
                      const start = `${y}-${String(m + 1).padStart(2, '0')}-01`;
                      const end = fmt(new Date(y, m + 1, 0));
                      const on = draft.start === start;
                      return <button key={start} type="button" className={`mp-year-btn${on ? ' selected' : ''}`} onClick={() => setDraft({ start, end })}>{m + 1}月</button>;
                    })}
                  </div>
                ))}
              </div>
            )}
            {tab === 'year' && (
              <div className="mp-year-grid">
                {yearCols.map((base, i) => (
                  <div className="mp-year-col" key={base}>
                    <div className="mp-dp-cal-hd">
                      {i === 0 && <button type="button" className="mp-dp-nav" onClick={() => setCursor(new Date(cursor.getFullYear() - 12, 0, 1))}>«</button>}
                      <span>{base}年</span>
                      {i === 1 && <button type="button" className="mp-dp-nav" onClick={() => setCursor(new Date(cursor.getFullYear() + 12, 0, 1))}>»</button>}
                    </div>
                    {Array.from({ length: 12 }, (_, n) => {
                      const y = base + n;
                      const start = `${y}-01-01`;
                      const on = draft.start.startsWith(`${y}-`);
                      return <button key={y} type="button" className={`mp-year-btn${on ? ' selected' : ''}`} onClick={() => setDraft({ start, end: `${y}-12-31` })}>{y}</button>;
                    })}
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="mp-dp-footer">
            <button type="button" className="btn mp-dp-clear" onClick={() => { setDraft({ start: '', end: '' }); onChange({ start: '', end: '' }); setOpen(false); }}>清空</button>
            <button type="button" className="btn mp-dp-ok" onClick={() => { onChange(draft); setOpen(false); }}>确定</button>
          </div>
        </div>
      )}
    </div>
  );
}
