import { useState } from 'react';
import { Button, DateRangePicker, Input, Modal, Pager, Select, Table, Toast } from '@/components/ui';

type Row = { id: string; name: string; amount: string };

const demoRows: Row[] = [
  { id: '1', name: '示例物料 A', amount: '120.00' },
  { id: '2', name: '示例物料 B', amount: '86.50' },
];

/** 阶段 0 预览：验证基础组件与现有样式是否对齐，不含业务写入 */
export default function Phase0Preview() {
  const [range, setRange] = useState({ start: '', end: '' });
  const [modalOpen, setModalOpen] = useState(false);
  const [toast, setToast] = useState('');
  const [page, setPage] = useState(1);

  return (
    <div className="phase0-page">
      <h1>阶段 0 · React 重构底座</h1>
      <p className="hint">组件复用经典前端 CSS class。现有 apps/web 未改动，可并行运行。</p>

      <section className="phase0-block">
        <h2>按钮</h2>
        <div className="phase0-row">
          <Button variant="primary">搜索</Button>
          <Button>重置</Button>
          <Button variant="ghost" size="sm">次要</Button>
        </div>
      </section>

      <section className="phase0-block">
        <h2>表单</h2>
        <div className="phase0-row">
          <Input label="关键字" placeholder="请输入" />
          <Select label="状态" options={[{ value: '', label: '全部' }, { value: 'ok', label: '正常' }]} />
        </div>
      </section>

      <section className="phase0-block">
        <h2>日期范围（仅确定/清空关闭）</h2>
        <DateRangePicker value={range} onChange={setRange} />
      </section>

      <section className="phase0-block">
        <h2>表格与分页</h2>
        <Table
          columns={[
            { key: 'name', title: '名称', render: (r) => r.name },
            { key: 'amount', title: '金额', render: (r) => r.amount },
          ]}
          rows={demoRows}
          rowKey={(r) => r.id}
        />
        <Pager page={page} pageSize={10} total={24} onPage={setPage} />
      </section>

      <section className="phase0-block">
        <h2>弹层</h2>
        <Button onClick={() => setModalOpen(true)}>打开模态</Button>
        <Modal
          open={modalOpen}
          title="确认"
          onClose={() => setModalOpen(false)}
          onConfirm={() => {
            setModalOpen(false);
            setToast('已确认（演示，未写入业务数据）');
            setTimeout(() => setToast(''), 2000);
          }}
        >
          这是阶段 0 的模态预览，不触发业务保存。
        </Modal>
        <Toast message={toast} visible={!!toast} />
      </section>
    </div>
  );
}
