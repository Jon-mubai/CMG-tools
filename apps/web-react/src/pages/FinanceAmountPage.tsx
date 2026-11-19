import { useEffect, useState } from 'react';
import { DateRangePicker } from '@/components/ui';
import { loadLedger, money, saveLedger, type FinSource } from '@/finance';

type Props = { token: string | null };
type Tab = 'reserve' | 'source';

export function FinanceAmountPage({ token }: Props) {
  const [tab, setTab] = useState<Tab>('reserve');
  const [reserve, setReserve] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [sources, setSources] = useState<FinSource[]>([]);
  const [used, setUsed] = useState(0);
  const [msg, setMsg] = useState('');
  const [src, setSrc] = useState({ name: '', amount: '', payer: '', receiver: '', start: '', end: '' });

  async function reload() {
    const d = await loadLedger(token);
    setReserve(String(d.reserve || ''));
    const period = d.reservePeriods[0];
    setStart(period?.start || '');
    setEnd(period?.end || '');
    setSources(d.sources.filter((s) => !s.deleted));
    setUsed(d.records.filter((r) => !r.deleted).reduce((s, r) => s + (Number(r.amount) || 0), 0));
  }

  useEffect(() => { reload().catch((e) => setMsg(e instanceof Error ? e.message : '加载失败')); }, [token]);

  async function saveReserve() {
    const n = Number(reserve);
    if (!Number.isFinite(n) || n < 0) { setMsg('请填写有效额度'); return; }
    const ledger = await loadLedger(token);
    await saveLedger(token, {
      ...ledger,
      reserve: n,
      reservePeriods: [{ id: ledger.reservePeriods[0]?.id || `p_${Date.now()}`, amount: n, start, end: end || start }],
    });
    setMsg('额度已保存');
    await reload();
  }

  async function addSource() {
    const n = Number(src.amount);
    if (!src.name.trim() || !Number.isFinite(n) || n <= 0) { setMsg('请填写来源和金额'); return; }
    const ledger = await loadLedger(token);
    const row: FinSource = {
      id: `s_${Date.now()}`,
      name: src.name.trim(),
      amount: n,
      payer: src.payer.trim(),
      receiver: src.receiver.trim(),
      start: src.start,
      end: src.end || src.start,
    };
    await saveLedger(token, { ...ledger, sources: [row, ...ledger.sources] });
    setSrc({ name: '', amount: '', payer: '', receiver: '', start: '', end: '' });
    setMsg('来源已添加');
    await reload();
  }

  async function removeSource(id: string) {
    const ledger = await loadLedger(token);
    await saveLedger(token, { ...ledger, sources: ledger.sources.map((s) => s.id === id ? { ...s, deleted: true } : s) });
    await reload();
  }

  const balance = (Number(reserve) || 0) - used;

  return (
    <div className="fin-view" data-fin-view="amount">
      <nav className="sub-tabs fin-settings-tabs" role="tablist" aria-label="备用金设置">
        <button type="button" className={`sub-tab${tab === 'reserve' ? ' active' : ''}`} onClick={() => setTab('reserve')}>备用金额度</button>
        <button type="button" className={`sub-tab${tab === 'source' ? ' active' : ''}`} onClick={() => setTab('source')}>备用金来源</button>
      </nav>
      {msg && <p className="hint">{msg}</p>}
      {tab === 'reserve' && (
        <div className="tab-panel active">
          <div className="fin-settings-block">
            <div className="fin-reserve-row fin-reserve-row-ext">
              <label className="fin-field fin-field-reserve">
                <span className="fin-label">备用金总额度</span>
                <input type="number" className="field-control fin-input" min="0" step="0.01" placeholder="请输入备用金总额度" value={reserve} onChange={(e) => setReserve(e.target.value)} />
              </label>
              <div className="fin-field fin-field-period">
                <span className="fin-label">生效日期</span>
                <DateRangePicker value={{ start, end }} onChange={(v) => { setStart(v.start); setEnd(v.end); }} placeholder="请选择日期" />
              </div>
              <div className="fin-reserve-actions">
                <button type="button" className="btn btn-outline fin-btn" onClick={() => { setReserve(''); setStart(''); setEnd(''); }}>重置</button>
                <button type="button" className="btn btn-primary fin-btn" onClick={saveReserve}>保存额度</button>
              </div>
            </div>
            <div className="fin-rsv-cards" role="group" aria-label="额度汇总与周期">
              <div className="fin-rsv-card fin-rsv-card-balance">
                <div className="fin-rsv-card-main">
                  <span className="fin-rsv-card-k">当前剩余余额</span>
                  <strong className="fin-rsv-card-amt">{money(balance)}</strong>
                  <span className="fin-rsv-card-sub">定额 − 累计支出</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      {tab === 'source' && (
        <div className="tab-panel active">
          <div className="fin-settings-block">
            <div className="fin-source-form">
              <div className="fin-source-row fin-source-row-top">
                <label className="fin-field fin-field-source"><span className="fin-label">金额来源 <i className="req">*</i></span><input className="field-control fin-input" value={src.name} onChange={(e) => setSrc({ ...src, name: e.target.value })} placeholder="如：财务拨付、项目结余" /></label>
                <label className="fin-field"><span className="fin-label">金额 <i className="req">*</i></span><input className="field-control fin-input" type="number" value={src.amount} onChange={(e) => setSrc({ ...src, amount: e.target.value })} placeholder="请输入金额" /></label>
                <label className="fin-field"><span className="fin-label">拨款人 / 付款人</span><input className="field-control fin-input" value={src.payer} onChange={(e) => setSrc({ ...src, payer: e.target.value })} /></label>
                <label className="fin-field"><span className="fin-label">接收人 / 收款人</span><input className="field-control fin-input" value={src.receiver} onChange={(e) => setSrc({ ...src, receiver: e.target.value })} /></label>
              </div>
              <div className="fin-source-row fin-source-row-mid">
                <div className="fin-field fin-field-bind">
                  <span className="fin-label">额度绑定周期</span>
                  <DateRangePicker value={{ start: src.start, end: src.end }} onChange={(v) => setSrc({ ...src, start: v.start, end: v.end })} placeholder="不绑定" />
                </div>
                <div className="fin-field fin-field-act">
                  <button type="button" className="btn btn-outline fin-btn" onClick={() => setSrc({ name: '', amount: '', payer: '', receiver: '', start: '', end: '' })}>重置</button>
                  <button type="button" className="btn btn-primary fin-btn" onClick={addSource}>添加来源</button>
                </div>
              </div>
            </div>
            <div className="fin-table-wrap">
              <table className="data-table fin-table">
                <thead>
                  <tr>
                    <th style={{ width: 110 }}>序号</th>
                    <th>金额来源</th>
                    <th className="num">金额</th>
                    <th>付款人</th>
                    <th>收款人</th>
                    <th>额度绑定周期</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {sources.length === 0 ? <tr><td colSpan={7} className="fin-empty-cell">暂无来源</td></tr> : sources.map((s, i) => (
                    <tr key={s.id}>
                      <td>{i + 1}</td>
                      <td>{s.name || '—'}</td>
                      <td className="num">{money(Number(s.amount) || 0)}</td>
                      <td>{s.payer || '—'}</td>
                      <td>{s.receiver || '—'}</td>
                      <td>{[s.start, s.end].filter(Boolean).join(' ~ ') || '—'}</td>
                      <td><button type="button" className="btn btn-outline btn-sm" onClick={() => removeSource(s.id)}>删除</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
