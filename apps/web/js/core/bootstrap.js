/**
 * Author: zcl (MuBai)
 * Date: 2026-10-14
 * Role: Full-Stack Developer
 */
/* js/core/bootstrap.js — 全局工具与初始化入口 */
(function () {
  'use strict';

  var PAGE_SIZE = 20;
  var PAGE_SIZE_OPTIONS = [10, 20, 50, 100, 200];
  var CODE_KEYS = ['商品编号', '编号', '编码', 'SKU', 'code', '货号', '物料编码'];
  var NAME_KEYS = ['商品名称', '名称', 'name', '品名', '物料名称'];
  var QTY_KEYS  = ['库存数量', '系统库存', '账面库存', '库存', '系统库存数量', '数量'];
  var BAR_KEYS  = ['条形码', '条码', 'barcode', '商品条码'];
  var CAT_KEYS  = ['商品分类', '分类', 'category'];

  var PAGE_INFO = {
    dashboard:  { title: '数据看板',   subtitle: '汇总盘点执行、仓库库存与滞销消耗的全局实时数据' },
    scan:       { title: '扫码盘点',   subtitle: '导入账面库存，再通过 USB 扫码枪或摄像头录入实盘' },
    'scan-data':{ title: '盘点数据',   subtitle: '明细核对、账面基线、盘点报告与比对' },
    'wh-park':  { title: '仓库可视化', subtitle: 'R3F 3D 园区：拖拽旋转/平移 · 滚轮缩放 · 点层查看商品库存 · 仓库设置可增删改' },
    'wh-docs': { title: '单据设置', subtitle: '按账期上传采购单据，关联采购单号与供应商' },
    'wh-stock': { title: '库存管理',   subtitle: '出入库动态监控、库存预警配置与礼品消耗分析' },
    help:       { title: '系统说明',   subtitle: '使用指南、设计初衷与最佳实践' },
    'admin-users': { title: '账号与权限', subtitle: '管理员分配账号、重置密码与功能访问权限（密码不可查看）' },
    'machine-profit':   { title: '机台毛利',   subtitle: '按周/月查看机台毛利，数据来自数据源导入' },
    'machine-ops':      { title: '运营数据',   subtitle: '机台运营指标与运行概况' },
    'machine-category': { title: '品类统计',   subtitle: '按品类汇总机台经营数据' }
  };
  /* 路径白名单（所有合法跳转目标，唯一对应一个页面） */
  var PAGE_PATHS = {
    '/login': 'login',
    '/dashboard': 'dashboard',
    '/import': 'scan',
    '/scan': 'scan',
    '/scan/import': 'scan',
    '/scan/entry': 'scan',
    '/detail': 'scan-data',
    '/scan-data': 'scan-data',
    '/scan-data/detail': 'scan-data',
    '/scan-data/pre': 'scan-data',
    '/scan-data/reports': 'scan-data',
    '/scan-data/compare': 'scan-data',
    '/wh-park': 'wh-park',
    '/wh-stock': 'wh-stock',
    '/wh-docs': 'wh-docs',
    '/help': 'help',
    '/admin-users': 'admin-users',
    '/machine-profit': 'machine-profit',
    '/machine-profit/week': 'machine-profit',
    '/machine-profit/month': 'machine-profit',
    '/machine-profit/import': 'machine-profit',
    '/machine-ops': 'machine-ops',
    '/machine-category': 'machine-category'
  };
  /* 扫码盘点页子导航（数据导入 + 扫码录入，复用 sub-tabs） */
  var WORK_VIEWS = ['import', 'entry'];
  var WORK_VIEW_DEFAULT = 'import';
  var WORK_VIEW_INFO = {
    import: { title: '数据导入', subtitle: '从 Excel 导入账面库存，作为盘点的比对基线' },
    entry:  { title: '扫码录入', subtitle: '通过 USB 扫码枪或摄像头录入实盘数量' }
  };
  var currentWorkView = WORK_VIEW_DEFAULT;
  /* 盘点数据页子导航：明细 + 账面 + 报告 + 比对 */
  var SCAN_VIEWS = ['detail', 'pre', 'reports', 'compare'];
  var SCAN_VIEW_DEFAULT = 'detail';
  var SCAN_VIEW_INFO = {
    detail:  { title: '盘点明细',         subtitle: '查看、筛选和编辑所有商品盘点数据' },
    pre:     { title: '盘点前账面库存', subtitle: '导入时的原始账面数据，可作为比对基线随时导出' },
    reports: { title: '已保存盘点报告',   subtitle: '每次盘点保存的结果，可查看、导出、删除或直接发起比对' },
    compare: { title: '账面比对',         subtitle: '盘点前账面 vs 盘点后实盘，自动输出差异与准确率' }
  };
  var currentScanView = SCAN_VIEW_DEFAULT;
  /* 机台毛利子导航 */
  var MACHINE_PROFIT_VIEWS = ['week', 'month', 'import'];
  var MACHINE_PROFIT_VIEW_DEFAULT = 'week';
  var MACHINE_PROFIT_VIEW_INFO = {
    week:   { title: '周毛利数据', subtitle: '按自然周汇总各机台收入、成本与毛利' },
    month:  { title: '月毛利数据', subtitle: '按自然月汇总各机台收入、成本与毛利' },
    import: { title: '数据源导入', subtitle: '导入机台流水 Excel，作为毛利分析的唯一数据来源' }
  };
  var currentMachineProfitView = MACHINE_PROFIT_VIEW_DEFAULT;
  var CATEGORY_VIEWS = ['import', 'analysis'];
  var CATEGORY_VIEW_DEFAULT = 'import';
  var CATEGORY_VIEW_INFO = {
    import: { title: '数据导入', subtitle: '导入零售商品表，作为品类分析数据源' },
    analysis: { title: '品类分析', subtitle: '按商品名称、估算成本、供应商、分类与创建时间分析' }
  };
  var currentCategoryView = CATEGORY_VIEW_DEFAULT;

  var items = [];
  var lookup = new Map();
  /* 已保存的盘点历史快照（用户在盘点明细页「保存为盘点报告」后生成）
     [{ id, name, savedAt, itemCount, items: [...] }] */
  var SNAPSHOTS_KEY = (typeof CMGShared !== 'undefined' && CMGShared.STORAGE_KEYS && CMGShared.STORAGE_KEYS.SNAPSHOTS)
    ? CMGShared.STORAGE_KEYS.SNAPSHOTS
    : 'inventory_check_snapshots_v1';
  var savedSnapshots = [];
  var currentFilter = 'all';
  var searchKeyword = '';
  var currentPage = 1;
  var filteredIndexes = [];
  var lastHighlightId = null;
  var html5QrCode = null;
  var cameraRunning = false;
  var currentPageName = 'dashboard';

  function loadSnapshots() {
    if (typeof CMGStocktake !== 'undefined' && CMGStocktake.readLocal) {
      return CMGStocktake.readLocal();
    }
    try {
      var raw = localStorage.getItem(SNAPSHOTS_KEY);
      var arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch (err) { return []; }
  }
  function saveSnapshotsList() {
    if (typeof CMGStocktake !== 'undefined' && CMGStocktake.writeLocal) {
      CMGStocktake.writeLocal(savedSnapshots);
    } else {
      try { localStorage.setItem(SNAPSHOTS_KEY, JSON.stringify(savedSnapshots)); } catch (err) {}
    }
    /* 侧栏「盘点数据」徽标始终跟随报告份数（不依赖当前子页是否渲染） */
    var badge = $('menuScanDataBadge');
    if (badge) {
      badge.textContent = savedSnapshots.length;
      badge.style.display = savedSnapshots.length > 0 ? '' : 'none';
    }
  }
  var scanMode = 'none'; /* 'usb' | 'camera' | 'none' —— 扫码互斥 */

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
  window.escapeHtml = escapeHtml;

