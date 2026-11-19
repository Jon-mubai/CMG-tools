export function HelpPage() {
  return (
    <div className="card">
      <div className="card-title">
        <iconify-icon icon="ant-design:bulb-outlined" width="18" height="18" />
        使用指南
      </div>
      <div className="help-prose">
        <h3>这是什么</h3>
        <p>这是一个面向仓储、门店、小型团队的<strong>轻量级盘点与运营工具</strong>。支持 Excel 导入账面库存、扫码/摄像头录入实盘、仓库可视化、机台毛利与品类分析，并自动计算差异与导出报告。</p>
        <h3>为什么做这个</h3>
        <p>传统盘点要么人工抄写 Excel，要么部署一套动辄几万块的 WMS。我们见过太多老板最后用「纸 + 计算器」凑合，于是做了这个<strong>零部署、零成本、双击就能用</strong>的工具。</p>
        <ul>
          <li>缓解手动盘点带来的<strong>数据准确性</strong>问题</li>
          <li>提升<strong>盘点效率</strong></li>
          <li>导出结果直接给财务、店长复核</li>
        </ul>
        <h3>推荐工作流</h3>
        <ol>
          <li><strong>仓库看板</strong>：汇总盘点执行、仓库库存、滞销消耗</li>
          <li><strong>数据导入</strong> → <strong>扫码盘点</strong></li>
          <li><strong>盘点明细</strong>：逐条核对实盘数量</li>
          <li><strong>盘点数据</strong>：账面、报告、比对</li>
          <li><strong>仓库管理 / 机台数据</strong>：可视化、单据、毛利与品类</li>
        </ol>
        <h3>数据与隐私</h3>
        <p>业务数据以服务端 PostgreSQL 为准。本页为只读说明，不写入任何业务数据。</p>
      </div>
    </div>
  );
}
