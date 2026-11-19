import { useEffect, useMemo, useState } from 'react';
import { api } from '@/api/client';

type Props = { token: string | null };
type Item = { warehouse?: string; name?: string; qty?: number; sku?: string };

export function WhParkPage({ token }: Props) {
  const [items, setItems] = useState<Item[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get<{ items?: Item[] }>('/api/v1/inventory/items?page=1&pageSize=5000', token)
      .then((d) => setItems(d.items || []))
      .catch((e) => setError(e instanceof Error ? e.message : '仓库数据加载失败'));
  }, [token]);

  const warehouses = useMemo(() => {
    const map = new Map<string, { qty: number; sku: number }>();
    for (const it of items) {
      const name = it.warehouse || '未分仓';
      const cur = map.get(name) || { qty: 0, sku: 0 };
      cur.qty += Number(it.qty) || 0;
      cur.sku += 1;
      map.set(name, cur);
    }
    return [...map.entries()].map(([name, v]) => ({ name, ...v })).sort((a, b) => b.qty - a.qty);
  }, [items]);

  return (
    <div id="page-wh-park" className="page-section active">
      {error && <div className="empty">{error}</div>}
      <div className="park-toolbar">
        <div className="park-wh-switch" role="tablist" aria-label="仓库切换">
          {warehouses.map((w) => <button key={w.name} type="button" className="park-wh-tab">{w.name}</button>)}
        </div>
        <div className="park-toolbar-right">
          <div className="park-viewctl">
            <button type="button" className="btn btn-outline btn-sm" disabled>环绕</button>
            <button type="button" className="btn btn-outline btn-sm" disabled>全园</button>
            <button type="button" className="btn btn-outline btn-sm" disabled>俯视</button>
          </div>
        </div>
      </div>
      <div className="park-stage-wrap">
        <div className="park-stage">
          <div className="park-scene" style={{ minHeight: 360, display: 'grid', placeItems: 'center', color: '#8a8a8a' }}>
            3D 园区仍在经典前端，这里先展示各仓结存
          </div>
          <div className="park-hud">
            {warehouses.map((w) => (
              <div className="park-hud-item" key={w.name}>
                <span className="park-hud-k">{w.name}</span>
                <span className="park-hud-v">{w.qty}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
