import { useEffect, useMemo, useState } from 'react';
import { api } from '@/api/client';

type Props = { token: string | null };
type Item = { id?: string; warehouse?: string; name?: string; sku?: string; category?: string; qty?: number; unit?: string };
type Tab = 'list' | 'alert' | 'warehouse';

export function WhStockPage({ token }: Props) {
  const [items, setItems] = useState<Item[]>([]);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<Tab>('list');
  const [q, setQ] = useState('');

  useEffect(() => {
    api.get<{ items?: Item[] }>('/api/v1/inventory/items?page=1&pageSize=5000', token)
      .then((d) => setItems(d.items || []))
      .catch((e) => setError(e instanceof Error ? e.message : '库存加载失败'));
  }, [token]);

  const filtered = useMemo(() => {
    const key = q.trim().toLowerCase();
    return items.filter((it) => {
      if (tab === 'alert' && (Number(it.qty) || 0) > 10) return false;
      if (!key) return true;
      return [it.name, it.sku, it.warehouse, it.category].some((v) => String(v || '').toLowerCase().includes(key));
    });
  }, [items, q, tab]);

  const totalQty = items.reduce((s, it) => s + (Number(it.qty) || 0), 0);
  const low = items.filter((it) => (Number(it.qty) || 0) <= 10).length;
  const warehouses = new Set(items.map((it) => it.warehouse || '未分仓')).size;

  return (
    <div id="page-wh-stock" className="page-section active">
      <div className="stock-kpis">
        <div className="dash-kpi"><span className="dash-kpi-k">SKU</span><strong className="dash-kpi-v">{items.length}</strong></div>
        <div className="dash-kpi"><span className="dash-kpi-k">结存数量</span><strong className="dash-kpi-v">{totalQty}</strong></div>
        <div className="dash-kpi"><span className="dash-kpi-k">低库存</span><strong className="dash-kpi-v">{low}</strong></div>
        <div className="dash-kpi"><span className="dash-kpi-k">仓库数</span><strong className="dash-kpi-v">{warehouses}</strong></div>
      </div>
      <nav className="sub-tabs" role="tablist" aria-label="库存管理分区">
        {([['list', '库存列表'], ['alert', '库存预警'], ['warehouse', '按仓库']] as const).map(([id, label]) => (
          <button key={id} type="button" className={`sub-tab${tab === id ? ' active' : ''}`} onClick={() => setTab(id)}>{label}</button>
        ))}
      </nav>
      {tab !== 'warehouse' && (
        <div className="tab-panel active">
          <div className="card card-table-fixed">
            <div className="card-title">
              <iconify-icon icon="ant-design:database-outlined" width="18" height="18" />
              {tab === 'alert' ? '库存预警' : '库存列表'}
            </div>
            <div className="toolbar">
              <input className="search-input" placeholder="搜索名称 / 编码 / 仓库" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <div className="table-wrap">
              <table>
                <thead><tr><th>商品</th><th>编码</th><th>分类</th><th>仓库</th><th>数量</th></tr></thead>
                <tbody>
                  {filtered.length === 0 ? <tr><td colSpan={5} className="empty">暂无数据</td></tr> : filtered.slice(0, 200).map((it, i) => (
                    <tr key={it.id || i}><td>{it.name || '—'}</td><td>{it.sku || '—'}</td><td>{it.category || '—'}</td><td>{it.warehouse || '—'}</td><td>{it.qty ?? '—'}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
      {tab === 'warehouse' && (
        <div className="tab-panel active">
          <div className="stock-kpis">
            {[...items.reduce((m, it) => {
              const k = it.warehouse || '未分仓';
              m.set(k, (m.get(k) || 0) + (Number(it.qty) || 0));
              return m;
            }, new Map<string, number>())].map(([name, qty]) => (
              <div className="dash-kpi" key={name}><span className="dash-kpi-k">{name}</span><strong className="dash-kpi-v">{qty}</strong></div>
            ))}
          </div>
        </div>
      )}
      {error && <div className="empty">{error}</div>}
    </div>
  );
}
