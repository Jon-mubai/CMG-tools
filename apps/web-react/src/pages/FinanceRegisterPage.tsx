import { useState } from 'react';
import { DateRangePicker, Select } from '@/components/ui';
import { loadLedger, saveLedger } from '@/finance';

type Props = { token: string | null };

const PAY_TYPES = ['现金', '转账', '微信', '支付宝', '其他'];
const TICKET_TYPES = ['发票', '收据', '无票', '其他'];

export function FinanceRegisterPage({ token }: Props) {
  const [form, setForm] = useState({
    item: '', purpose: '', description: '', qty: '', amount: '',
    userName: '', auditor: '', payType: '', ticketType: '', inboundNo: '', remark: '',
    dateStart: new Date().toISOString().slice(0, 10), dateEnd: '',
  });
  const [images, setImages] = useState<{ pay: string[]; invoice: string[]; order: string[] }>({ pay: [], invoice: [], order: [] });
  const [msg, setMsg] = useState('');
  const [saving, setSaving] = useState(false);
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  function reset() {
    setForm({
      item: '', purpose: '', description: '', qty: '', amount: '',
      userName: '', auditor: '', payType: '', ticketType: '', inboundNo: '', remark: '',
      dateStart: new Date().toISOString().slice(0, 10), dateEnd: '',
    });
    setImages({ pay: [], invoice: [], order: [] });
    setMsg('');
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg('');
    const n = Number(form.amount);
    if (!form.item.trim() || !Number.isFinite(n) || n <= 0 || !form.auditor.trim() || !form.dateStart) {
      setMsg('请填写日期、项目、金额和审核人');
      return;
    }
    setSaving(true);
    try {
      const ledger = await loadLedger(token);
      const rec = {
        id: `r_${Date.now()}`,
        item: form.item.trim(),
        purpose: form.purpose.trim(),
        description: form.description.trim(),
        qty: form.qty ? Number(form.qty) : undefined,
        amount: n,
        userName: form.userName.trim(),
        auditor: form.auditor.trim(),
        payType: form.payType,
        ticketType: form.ticketType,
        inboundNo: form.inboundNo.trim(),
        remark: form.remark.trim(),
        payImages: images.pay,
        invoiceImages: images.invoice,
        otherImages: images.order,
        dateStart: form.dateStart,
        dateEnd: form.dateEnd || form.dateStart,
        reviewStatus: 'pending',
        createdAt: new Date().toISOString(),
      };
      await saveLedger(token, { ...ledger, records: [rec, ...ledger.records] });
      reset();
      setMsg('已保存到账本');
    } catch (err) {
      setMsg(err instanceof Error ? err.message : '保存失败');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="fin-view" data-fin-view="register" onSubmit={submit}>
      <div className="fin-form-grid fin-form-grid-4">
        <div className="fin-field">
          <span className="fin-label">使用日期 <i className="req">*</i></span>
          <DateRangePicker value={{ start: form.dateStart, end: form.dateEnd }} onChange={(v) => { set('dateStart', v.start); set('dateEnd', v.end); }} placeholder="请选择使用日期" />
        </div>
        <label className="fin-field">
          <span className="fin-label">商品名称 <i className="req">*</i></span>
          <input className="field-control fin-input" value={form.item} onChange={(e) => set('item', e.target.value)} placeholder="请输入商品名称" />
        </label>
        <label className="fin-field">
          <span className="fin-label">用途</span>
          <input className="field-control fin-input" value={form.purpose} onChange={(e) => set('purpose', e.target.value)} />
        </label>
        <label className="fin-field">
          <span className="fin-label">说明</span>
          <input className="field-control fin-input" value={form.description} onChange={(e) => set('description', e.target.value)} placeholder="补充说明" />
        </label>
        <label className="fin-field">
          <span className="fin-label">数量</span>
          <input className="field-control fin-input" type="number" value={form.qty} onChange={(e) => set('qty', e.target.value)} />
        </label>
        <label className="fin-field">
          <span className="fin-label">使用金额（元） <i className="req">*</i></span>
          <input className="field-control fin-input" type="number" step="0.01" value={form.amount} onChange={(e) => set('amount', e.target.value)} placeholder="本次支出金额" />
        </label>
        <label className="fin-field">
          <span className="fin-label">操办人</span>
          <input className="field-control fin-input" value={form.userName} onChange={(e) => set('userName', e.target.value)} />
        </label>
        <label className="fin-field">
          <span className="fin-label">审核人 <i className="req">*</i></span>
          <input className="field-control fin-input" value={form.auditor} onChange={(e) => set('auditor', e.target.value)} placeholder="须填写审核人登录账号名称" />
        </label>
        <div className="fin-field">
          <span className="fin-label">支付类型</span>
          <Select value={form.payType} onChange={(v) => set('payType', v)} options={PAY_TYPES} placeholder="请选择" />
        </div>
        <div className="fin-field">
          <span className="fin-label">票据类型</span>
          <Select value={form.ticketType} onChange={(v) => set('ticketType', v)} options={TICKET_TYPES} placeholder="请选择" />
        </div>
        <label className="fin-field">
          <span className="fin-label">入库单号</span>
          <input className="field-control fin-input" value={form.inboundNo} onChange={(e) => set('inboundNo', e.target.value)} placeholder="关联入库单号" />
        </label>
        <label className="fin-field">
          <span className="fin-label">备注</span>
          <input className="field-control fin-input" value={form.remark} onChange={(e) => set('remark', e.target.value)} />
        </label>
      </div>
      <div className="fin-upload-row-3">
        {([['pay', '上传付款截图'], ['invoice', '上传发票'], ['order', '订单截图']] as const).map(([key, label]) => (
          <div className="fin-field fin-upload-card" key={key}>
            <span className="fin-label">{label}</span>
            <label className="fin-upload-zone fin-upload-zone-sm">
              <input type="file" accept="image/*" multiple hidden onChange={(e) => {
                const files = [...(e.target.files || [])].slice(0, 6);
                Promise.all(files.map((f) => new Promise<string>((resolve) => {
                  const reader = new FileReader();
                  reader.onload = () => resolve(String(reader.result || ''));
                  reader.readAsDataURL(f);
                }))).then((urls) => setImages((prev) => ({ ...prev, [key]: [...prev[key], ...urls].slice(0, 6) })));
              }} />
              <div className="fin-upload-hint"><iconify-icon icon="ant-design:cloud-upload-outlined" width="16" height="16" /><span>点击或拖拽上传</span><em>最多 6 张</em></div>
              <div className="fin-img-preview">{images[key].map((src) => <img key={src.slice(0, 40)} src={src} alt="" />)}</div>
            </label>
          </div>
        ))}
      </div>
      <div className="fin-form-actions">
        <button type="button" className="btn btn-outline fin-btn" onClick={reset}>重置</button>
        <button type="submit" className="btn btn-primary fin-btn" disabled={saving}>{saving ? '保存中…' : '提交登记'}</button>
      </div>
      {msg && <p className="hint">{msg}</p>}
    </form>
  );
}
