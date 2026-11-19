import { api } from '@/api/client';

export type InvItem = {
  id?: string;
  code?: string;
  name?: string;
  warehouse?: string;
  category?: string;
  bookQty?: number;
  actualQty?: number;
  qty?: number;
  status?: string;
  updatedAt?: string;
};

export type DashStats = {
  total: number;
  balanced: number;
  surplus: number;
  deficit: number;
  scanned: number;
  alert: number;
  warehouses: { name: string; qty: number }[];
  slow: { name: string; qty: number }[];
  trend: { date: string; value: number }[];
};

function num(v: unknown) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function statusOf(it: InvItem) {
  if (it.status === 'balanced' || it.status === 'surplus' || it.status === 'deficit') return it.status;
  const book = num(it.bookQty);
  const actual = num(it.actualQty);
  if (actual === 0 && book === 0) return 'balanced';
  if (actual > book) return 'surplus';
  if (actual < book) return 'deficit';
  return 'balanced';
}

export async function loadDashStats(token: string | null): Promise<DashStats> {
  const data = await api.get<{ items?: InvItem[]; total?: number }>('/api/v1/inventory/items?page=1&pageSize=5000', token);
  const items = Array.isArray(data.items) ? data.items : [];
  let balanced = 0, surplus = 0, deficit = 0, scanned = 0, alert = 0;
  const wh = new Map<string, number>();
  const slow: { name: string; qty: number }[] = [];

  for (const it of items) {
    const st = statusOf(it);
    if (st === 'balanced') balanced += 1;
    else if (st === 'surplus') surplus += 1;
    else deficit += 1;
    if (num(it.actualQty) > 0) scanned += 1;
    const qty = num(it.qty ?? it.bookQty);
    if (qty <= 0) alert += 1;
    const w = String(it.warehouse || '未分仓');
    wh.set(w, (wh.get(w) || 0) + qty);
    if (qty > 0) slow.push({ name: String(it.name || it.code || '未命名'), qty });
  }

  slow.sort((a, b) => b.qty - a.qty);
  const warehouses = [...wh.entries()].map(([name, qty]) => ({ name, qty })).sort((a, b) => b.qty - a.qty).slice(0, 6);
  const trend = buildTrend(items);

  return {
    total: data.total ?? items.length,
    balanced,
    surplus,
    deficit,
    scanned,
    alert,
    warehouses,
    slow: slow.slice(0, 5),
    trend,
  };
}

function buildTrend(items: InvItem[]) {
  const days: { date: string; value: number }[] = [];
  const now = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    const key = `${d.getMonth() + 1}/${d.getDate()}`;
    days.push({ date: key, value: 0 });
  }
  for (const it of items) {
    if (!it.updatedAt) continue;
    const dt = new Date(it.updatedAt);
    if (Number.isNaN(dt.getTime())) continue;
    const key = `${dt.getMonth() + 1}/${dt.getDate()}`;
    const hit = days.find((d) => d.date === key);
    if (hit) hit.value += num(it.actualQty || it.qty);
  }
  return days;
}

export function donutPaths(segments: { name: string; qty: number }[], size = 160, hole = 0.58) {
  const total = segments.reduce((s, x) => s + x.qty, 0) || 1;
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 4;
  const ir = r * hole;
  let angle = -Math.PI / 2;
  const colors = ['#171717', '#525252', '#737373', '#a3a3a3', '#d4d4d4', '#e5e5e5'];
  return segments.map((seg, i) => {
    const sweep = (seg.qty / total) * Math.PI * 2;
    const a1 = angle;
    const a2 = angle + sweep;
    angle = a2;
    const large = sweep > Math.PI ? 1 : 0;
    const p = (a: number, rad: number) => [cx + Math.cos(a) * rad, cy + Math.sin(a) * rad];
    const [x1, y1] = p(a1, r);
    const [x2, y2] = p(a2, r);
    const [x3, y3] = p(a2, ir);
    const [x4, y4] = p(a1, ir);
    const d = `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} L ${x3} ${y3} A ${ir} ${ir} 0 ${large} 0 ${x4} ${y4} Z`;
    return { d, color: colors[i % colors.length], name: seg.name, qty: seg.qty };
  });
}

export function linePoints(trend: { date: string; value: number }[], w = 520, h = 160) {
  const max = Math.max(1, ...trend.map((t) => t.value));
  const step = trend.length > 1 ? w / (trend.length - 1) : w;
  return trend.map((t, i) => {
    const x = i * step;
    const y = h - (t.value / max) * (h - 16) - 8;
    return { x, y, ...t };
  });
}
