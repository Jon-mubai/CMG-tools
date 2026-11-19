export type PageId =
  | 'dashboard'
  | 'help'
  | 'wh-park'
  | 'wh-stock'
  | 'wh-docs'
  | 'scan'
  | 'scan-data'
  | 'machine-profit'
  | 'machine-ops'
  | 'machine-category'
  | 'finance-board'
  | 'finance-register'
  | 'finance-records'
  | 'finance-amount';

export type MenuItem = { id: PageId; label: string; title?: string };
export type MenuGroup = {
  id: string;
  label: string;
  rail: string;
  icon: string;
  items: MenuItem[];
};

export const MENU: MenuGroup[] = [
  {
    id: 'work',
    label: '统计看板',
    rail: '看板',
    icon: 'ant-design:appstore-outlined',
    items: [
      { id: 'dashboard', label: '仓库看板', title: '实时查看盘点进度与差异统计' },
      { id: 'help', label: '系统说明', title: '使用指南与常见问题' },
    ],
  },
  {
    id: 'wh',
    label: '仓库管理',
    rail: '仓库',
    icon: 'ant-design:home-outlined',
    items: [
      { id: 'wh-park', label: '仓库可视化' },
      { id: 'wh-stock', label: '库存管理' },
      { id: 'wh-docs', label: '单据设置' },
      { id: 'scan', label: '扫码盘点' },
      { id: 'scan-data', label: '盘点数据' },
    ],
  },
  {
    id: 'machine',
    label: '机台数据',
    rail: '机台',
    icon: 'ant-design:desktop-outlined',
    items: [
      { id: 'machine-profit', label: '机台毛利' },
      { id: 'machine-ops', label: '运营数据' },
      { id: 'machine-category', label: '品类统计' },
    ],
  },
  {
    id: 'finance',
    label: '额度管理',
    rail: '账务',
    icon: 'ant-design:account-book-outlined',
    items: [
      { id: 'finance-board', label: '额度看板' },
      { id: 'finance-register', label: '新增使用信息' },
      { id: 'finance-records', label: '使用记录' },
      { id: 'finance-amount', label: '备用金设置' },
    ],
  },
];

export function findPage(id: PageId) {
  for (const g of MENU) {
    const item = g.items.find((i) => i.id === id);
    if (item) return { group: g, item };
  }
  return null;
}
