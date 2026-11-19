import { useEffect, useState } from 'react';
import { DateRangePicker } from '@/components/ui';
import { donutPaths, linePoints, loadDashStats, type DashStats } from '@/dash';

type Props = { token: string | null };

export function DashboardPage({ token }: Props) {
  const [range, setRange] = useState({ start: '', end: '' });
  const [stats, setStats] = useState<DashStats | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    loadDashStats(token)
      .then((s) => { if (alive) setStats(s); })
      .catch((e) => { if (alive) setError(e instanceof Error ? e.message : '看板数据加载失败'); });
    return () => { alive = false; };
  }, [token]);

  const kpis = [
    { label: '账面商品', value: stats?.total ?? 0, sub: '库存商品数' },
    { label: '对平', value: stats?.balanced ?? 0, sub: '账实一致', cls: 'ok' },
    { label: '盘盈', value: stats?.surplus ?? 0, sub: '实盘多于账面', cls: 'up' },
    { label: '盘亏', value: stats?.deficit ?? 0, sub: '实盘少于账面', cls: 'down' },
    { label: '已扫', value: stats?.scanned ?? 0, sub: '扫码盘点进度' },
  ];
  const wh = donutPaths(stats?.warehouses || []);
  const slow = donutPaths(stats?.slow || [], 160, 0);
  const pts = linePoints(stats?.trend || []);
  const line = pts.map((p) => `${p.x},${p.y}`).join(' ');

  return (
    <>
      <div className="dash-kpi-row" aria-label="盘点执行概览">
        {kpis.map((k) => (
          <div className={`dash-kpi${k.cls ? ` ${k.cls}` : ''}`} key={k.label}>
            <div className="dash-kpi-label">{k.label}</div>
            <div className="dash-kpi-num">{k.value}</div>
            <div className="dash-kpi-sub">{k.sub}</div>
          </div>
        ))}
      </div>
      {error && <div className="empty">{error}（请确认已登录且后端已启动）</div>}
      <div className="dash-twin-row">
        <div className="card">
          <div className="card-title dash-panel-title">仓库与库存<span className="card-hint">来自库存接口</span></div>
          {wh.length ? (
            <div className="dash-chart-row">
              <svg width="160" height="160" viewBox="0 0 160 160" aria-label="仓库占比">
                {wh.map((s) => <path key={s.name} d={s.d} fill={s.color} />)}
              </svg>
              <div className="dash-chart-legend">
                {wh.map((s) => <span className="dcl-item" key={s.name}><i className="dcl-dot" style={{ background: s.color }} />{s.name} {s.qty}</span>)}
              </div>
            </div>
          ) : <div className="empty">暂无分仓数据</div>}
        </div>
        <div className="card">
          <div className="card-title dash-panel-title">滞销与占用</div>
          {slow.length ? (
            <div className="dash-chart-row">
              <svg width="160" height="160" viewBox="0 0 160 160" aria-label="滞销占比">
                {slow.map((s) => <path key={s.name} d={s.d} fill={s.color} />)}
              </svg>
              <div className="dash-top-list">
                {slow.map((s, i) => (
                  <div className="dash-top-item" key={s.name}>
                    <span className="dash-top-idx">{i + 1}</span>
                    <span className="dash-top-n">{s.name}</span>
                    <span className="dash-top-v">{s.qty}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : <div className="empty">暂无占用数据</div>}
        </div>
      </div>
      <div className="card dash-card">
        <div className="card-title dash-panel-title">
          礼品消耗趋势
          <div style={{ marginLeft: 12 }}>
            <DateRangePicker value={range} onChange={setRange} placeholder="请选择时间范围" />
          </div>
        </div>
        {pts.length ? (
          <svg width="100%" height="180" viewBox="0 0 520 160" preserveAspectRatio="none" aria-label="消耗趋势">
            <polyline fill="none" stroke="#171717" strokeWidth="2" points={line} />
            {pts.map((p) => <circle key={p.date} cx={p.x} cy={p.y} r="3" fill="#171717" />)}
          </svg>
        ) : <div className="empty">暂无趋势数据</div>}
      </div>
    </>
  );
}
