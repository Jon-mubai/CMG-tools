import { useEffect, useMemo, useState, useRef } from 'react';
import { DateRangePicker, Select, Modal } from '@/components/ui';
import { loadLedger, money, saveLedger, type FinRecord } from '@/finance';

type Props = { token: string | null };
type Status = '' | 'pending' | 'in_review' | 'passed' | 'rejected';

const TABS: { id: Status; label: string }[] = [
  { id: '', label: '全部' },
  { id: 'pending', label: '待审核' },
  { id: 'in_review', label: '审核中' },
  { id: 'passed', label: '已通过' },
  { id: 'rejected', label: '已驳回' },
];

const STATUS_LABEL: Record<string, string> = {
  pending: '待审核',
  in_review: '审核中',
  passed: '已通过',
  rejected: '已驳回',
};

export function FinanceRecordsPage({ token }: Props) {
  const [rows, setRows] = useState<FinRecord[]>([]);
  const [error, setError] = useState('');
  const [status, setStatus] = useState<Status>('');
  const [draftOp, setDraftOp] = useState('');
  const [draftRange, setDraftRange] = useState({ start: '', end: '' });
  const [op, setOp] = useState('');
  const [range, setRange] = useState({ start: '', end: '' });
  const [pageNo, setPageNo] = useState(1);
  const pageSize = 20;
  const [editing, setEditing] = useState<FinRecord | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [batchOpen, setBatchOpen] = useState(false);
  const [batchRemarkOpen, setBatchRemarkOpen] = useState(false);
  const [batchRemarkText, setBatchRemarkText] = useState('');
  const batchRef = useRef<HTMLDivElement>(null);

  useEffect(() => { reload(); }, [token]);

  async function reload() {
    try {
      const d = await loadLedger(token);
      setRows(d.records.filter((r) => !r.deleted));
    } catch (e) {
      setError(e instanceof Error ? e.message : '使用记录加载失败');
    }
  }

  async function patch(id: string, next: Partial<FinRecord>) {
    const ledger = await loadLedger(token);
    await saveLedger(token, {
      ...ledger,
      records: ledger.records.map((r) => r.id === id ? { ...r, ...next } : r),
    });
    await reload();
  }

  function exportCsv() {
    const head = ['日期', '商品', '用途', '数量', '金额', '操办人', '审核人', '支付类型', '票据', '入库单号', '状态', '备注'];
    const lines = filtered.map((r) => [
      String(r.dateStart || '').slice(0, 10), r.item, r.purpose, r.qty, r.amount,
      r.userName, r.auditor, r.payType, r.ticketType, r.inboundNo, r.reviewStatus, r.remark,
    ].map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','));
    const blob = new Blob(['\ufeff' + [head.join(','), ...lines].join('\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'finance-records.csv';
    a.click();
  }

  async function batchDelete() {
    if (!selected.size) return;
    if (!window.confirm(`确定删除选中的 ${selected.size} 条记录？`)) return;
    const ledger = await loadLedger(token);
    await saveLedger(token, {
      ...ledger,
      records: ledger.records.map((r) => selected.has(r.id) ? { ...r, deleted: true } : r),
    });
    setSelected(new Set());
    await reload();
  }

  async function applyBatchRemark() {
    if (!selected.size || !batchRemarkText.trim()) return;
    const ledger = await loadLedger(token);
    await saveLedger(token, {
      ...ledger,
      records: ledger.records.map((r) => selected.has(r.id) ? { ...r, remark: batchRemarkText.trim() } : r),
    });
    setSelected(new Set());
    setBatchRemarkOpen(false);
    setBatchRemarkText('');
    await reload();
  }

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (batchRef.current && !batchRef.current.contains(e.target as Node)) setBatchOpen(false);
    }
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  }, []);

  const operators = useMemo(() => {
    const set = new Set(rows.map((r) => r.userName).filter(Boolean) as string[]);
    return [...set];
  }, [rows]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (status && r.reviewStatus !== status) return false;
      if (op && r.userName !== op) return false;
      if (range.start) {
        const d = String(r.dateStart || r.createdAt || '').slice(0, 10);
        const end = range.end || range.start;
        if (d < range.start || d > end) return false;
      }
      return true;
    });
  }, [rows, status, op, range]);

  const totalAmt = filtered.reduce((s, r) => s + (Number(r.amount) || 0), 0);
  const totalQty = filtered.reduce((s, r) => s + (Number(r.qty) || 0), 0);
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageRows = filtered.slice((pageNo - 1) * pageSize, pageNo * pageSize);

  function thumbs(list?: unknown) {
    const imgs = Array.isArray(list) ? list.map((x) => typeof x === 'string' ? x : String((x as { url?: string })?.url || '')).filter(Boolean) : [];
    if (!imgs.length) return '—';
    return <span className="fin-img-thumbs">{imgs.slice(0, 3).map((src, i) => <img key={`${i}-${src.slice(0, 16)}`} src={src} alt="" />)}</span>;
  }

  return (
    <div className="fin-page fin-flow">
      <div className="fin-view" data-fin-view="records">
        <div className="fin-records-toolbar">
          <nav className="fin-status-tabs" role="tablist" aria-label="记录状态">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                className={`fin-status-tab${status === t.id ? ' is-active' : ''}`}
                role="tab"
                aria-selected={status === t.id}
                onClick={() => { setStatus(t.id); setPageNo(1); setSelected(new Set()); }}
              >
                {t.label}
              </button>
            ))}
          </nav>
          <div className="fin-records-toolbar-actions">
            <span className="fin-records-meta">共 {filtered.length} 条 · 累计使用 {money(totalAmt)}</span>
            <div className="fin-batch-wrap" ref={batchRef} style={{ position: 'relative', display: 'inline-block' }}>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={(e) => { e.stopPropagation(); setBatchOpen((v) => !v); }}
              >
                <iconify-icon icon="ant-design:more-outlined" width="14" height="14" />
                批量操作
              </button>
              {batchOpen && (
                <div
                  className="fin-batch-popover"
                  style={{
                    position: 'absolute',
                    right: 0,
                    top: 'calc(100% + 4px)',
                    background: '#fff',
                    border: '1px solid #e5e5e5',
                    borderRadius: 8,
                    boxShadow: '0 4px 12px rgba(0,0,0,.08)',
                    zIndex: 20,
                    minWidth: 148,
                    padding: '4px 0',
                  }}
                >
                  <button
                    type="button"
                    className="fin-batch-item"
                    style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 14px', background: 'none', border: 0, fontSize: 13, cursor: 'pointer' }}
                    onClick={() => { exportCsv(); setBatchOpen(false); }}
                  >
                    数据导出
                  </button>
                  <button
                    type="button"
                    className="fin-batch-item"
                    style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 14px', background: 'none', border: 0, fontSize: 13, cursor: 'pointer' }}
                    onClick={() => {
                      if (!selected.size) { window.alert('请先选择要修改的记录'); return; }
                      setBatchRemarkOpen(true);
                      setBatchOpen(false);
                    }}
                  >
                    批量修改备注
                  </button>
                  <button
                    type="button"
                    className="fin-batch-item"
                    style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 14px', background: 'none', border: 0, fontSize: 13, cursor: 'pointer', color: '#dc2626' }}
                    onClick={() => {
                      if (!selected.size) { window.alert('请先选择要删除的记录'); return; }
                      batchDelete();
                      setBatchOpen(false);
                    }}
                  >
                    批量删除
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="fin-filter-bar">
          <div className="fin-field fin-filter-field">
            <span className="fin-label">操办人</span>
            <Select value={draftOp} onChange={setDraftOp} options={operators} placeholder="全部" />
          </div>
          <div className="fin-field fin-filter-field">
            <span className="fin-label">时间范围</span>
            <DateRangePicker value={draftRange} onChange={setDraftRange} placeholder="日期" />
          </div>
          <div className="fin-filter-actions fin-filter-actions-search">
            <button type="button" className="btn btn-primary btn-sm fin-filter-btn" onClick={() => { setOp(draftOp); setRange(draftRange); }}>搜索</button>
            <button type="button" className="btn btn-outline btn-sm fin-filter-btn" onClick={() => { setDraftOp(''); setDraftRange({ start: '', end: '' }); setOp(''); setRange({ start: '', end: '' }); }}>重置</button>
          </div>
        </div>

        {error && <div className="empty">{error}</div>}

        <div className="fin-table-wrap">
          <table className="data-table fin-table">
            <thead>
              <tr>
                <th style={{ width: 44, textAlign: 'center' }}>
                  <input
                    type="checkbox"
                    aria-label="全选当前页"
                    checked={pageRows.length > 0 && pageRows.every((r) => selected.has(r.id))}
                    onChange={(e) => {
                      const next = new Set(selected);
                      if (e.target.checked) pageRows.forEach((r) => next.add(r.id));
                      else pageRows.forEach((r) => next.delete(r.id));
                      setSelected(next);
                    }}
                  />
                </th>
                <th>使用日期</th>
                <th>商品名称</th>
                <th>用途</th>
                <th>数量</th>
                <th>使用金额</th>
                <th>操办人</th>
                <th>审核人</th>
                <th>支付类型</th>
                <th>票据类型</th>
                <th>入库单号</th>
                <th className="fin-col-remark">备注</th>
                <th>付款截图</th>
                <th>发票图片</th>
                <th>订单截图</th>
                <th className="fin-col-status">状态</th>
                <th className="fin-ops-col">操作</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={17} className="fin-empty-cell">暂无记录</td></tr>
              ) : pageRows.map((r) => (
                <tr key={r.id}>
                  <td style={{ textAlign: 'center' }}>
                    <input
                      type="checkbox"
                      aria-label="选择记录"
                      checked={selected.has(r.id)}
                      onChange={(e) => {
                        const next = new Set(selected);
                        if (e.target.checked) next.add(r.id);
                        else next.delete(r.id);
                        setSelected(next);
                      }}
                    />
                  </td>
                  <td>{String(r.dateStart || r.createdAt || '').slice(0, 10).replace(/-/g, '/') || '—'}</td>
                  <td>{r.item || '—'}</td>
                  <td>{r.purpose || '—'}</td>
                  <td>{r.qty ?? '—'}</td>
                  <td>{money(Number(r.amount) || 0)}</td>
                  <td>{r.userName || '—'}</td>
                  <td>{r.auditor || '—'}</td>
                  <td>{r.payType || '—'}</td>
                  <td>{r.ticketType || '—'}</td>
                  <td>{r.inboundNo || '—'}</td>
                  <td>{r.remark || '—'}</td>
                  <td>{thumbs(r.payImages)}</td>
                  <td>{thumbs(r.invoiceImages)}</td>
                  <td>{thumbs(r.otherImages)}</td>
                  <td className="fin-col-status"><span className={`fin-dot is-${r.reviewStatus || 'pending'}`} title={STATUS_LABEL[r.reviewStatus || ''] || r.reviewStatus || ''} /></td>
                  <td>
                    <div className="fin-ops">
                      <button type="button" className="link-btn" onClick={() => setEditing(r)}>编辑</button>
                      <button type="button" className="link-btn" onClick={() => patch(r.id, { deleted: true })}>删除</button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length > 0 && (
                <tr className="fin-sum-row">
                  <td />
                  <td colSpan={3}>合计</td>
                  <td>{totalQty.toLocaleString()}</td>
                  <td>{money(totalAmt)}</td>
                  <td colSpan={11} />
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="pager pager-pinned">
          <div className="pager-left">
            <span className="pager-info">共 {filtered.length} 条，第 {pageNo}/{pageCount} 页</span>
            <span>每页 {pageSize} 条</span>
          </div>
          <div className="pager-right">
            <button type="button" className="btn btn-outline btn-sm" disabled={pageNo <= 1} onClick={() => setPageNo((p) => Math.max(1, p - 1))}>上一页</button>
            <span>{pageNo} / {pageCount}</span>
            <button type="button" className="btn btn-outline btn-sm" disabled={pageNo >= pageCount} onClick={() => setPageNo((p) => Math.min(pageCount, p + 1))}>下一页</button>
          </div>
        </div>
        {editing && (
          <div className="drawer-overlay is-open" onClick={() => setEditing(null)}>
            <aside className="drawer-panel fin-modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
              <div className="drawer-header">
                <h3>编辑使用记录</h3>
                <button type="button" className="drawer-close" onClick={() => setEditing(null)} aria-label="关闭">
                  <iconify-icon icon="ant-design:close-outlined" width="16" height="16" />
                </button>
              </div>
              <div className="drawer-body">
                <div className="drawer-section">
                  <div className="drawer-section-title">基本信息</div>
                  <div className="fin-form-grid fin-edit-grid">
                    <label className="fin-field"><span className="fin-label">商品名称</span><input className="field-control fin-input" value={editing.item || ''} onChange={(e) => setEditing({ ...editing, item: e.target.value })} /></label>
                    <label className="fin-field"><span className="fin-label">金额</span><input className="field-control fin-input" type="number" value={editing.amount ?? ''} onChange={(e) => setEditing({ ...editing, amount: Number(e.target.value) })} /></label>
                    <label className="fin-field"><span className="fin-label">备注</span><input className="field-control fin-input" value={editing.remark || ''} onChange={(e) => setEditing({ ...editing, remark: e.target.value })} /></label>
                  </div>
                </div>
              </div>
              <div className="drawer-footer">
                <button type="button" className="btn btn-outline" onClick={() => setEditing(null)}>取消</button>
                <button type="button" className="btn btn-primary" onClick={async () => { await patch(editing.id, editing); setEditing(null); }}>保存</button>
              </div>
            </aside>
          </div>
        )}
        <Modal
          open={batchRemarkOpen}
          title="批量修改备注"
          onClose={() => { setBatchRemarkOpen(false); setBatchRemarkText(''); }}
          onConfirm={applyBatchRemark}
          confirmText="应用"
        >
          <label className="fin-field">
            <span className="fin-label">新备注（将覆盖选中的 {selected.size} 条记录）</span>
            <input
              className="field-control fin-input"
              value={batchRemarkText}
              onChange={(e) => setBatchRemarkText(e.target.value)}
              placeholder="请输入备注内容"
              autoFocus
            />
          </label>
        </Modal>
      </div>
    </div>
  );
}
