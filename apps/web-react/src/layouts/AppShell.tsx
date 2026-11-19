import { useEffect, useState } from 'react';
import { MENU, findPage, type PageId } from '@/menu';
import type { Session } from '@/session';
import { loadDashStats } from '@/dash';

type Props = {
  session: Session;
  page: PageId;
  onNavigate: (id: PageId) => void;
  onLogout: () => void;
  children: React.ReactNode;
};

const COLLAPSE_KEY = 'cmg_sidebar_collapsed';

export function AppShell({ session, page, onNavigate, onLogout, children }: Props) {
  const current = findPage(page);
  const [openGroup, setOpenGroup] = useState(current?.group.id || 'work');
  const [accountOpen, setAccountOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(COLLAPSE_KEY) === '1');
  const [badges, setBadges] = useState({ total: 0, scanned: 0, alert: 0 });
  const meta = findPage(page);

  useEffect(() => {
    localStorage.setItem(COLLAPSE_KEY, collapsed ? '1' : '0');
  }, [collapsed]);

  useEffect(() => {
    loadDashStats(session.token === 'demo' ? null : session.token)
      .then((s) => setBadges({ total: s.total, scanned: s.scanned, alert: s.alert }))
      .catch(() => {});
  }, [session.token]);

  function badgeFor(id: PageId) {
    if (id === 'scan-data' && badges.total > 0) return badges.total;
    if (id === 'scan' && badges.scanned > 0) return badges.scanned;
    if (id === 'wh-stock' && badges.alert > 0) return badges.alert;
    return 0;
  }

  return (
    <div className="app-layout">
      <aside className={`menu-shell${collapsed ? ' is-collapsed' : ''}`} id="menuShell">
        <div className="menu-shell-top">
          <div className="sidebar-logo">
            <span className="logo-icon" aria-hidden="true">
              <iconify-icon icon="ant-design:home-filled" width="18" height="18" />
            </span>
            <span className="logo-text">WMS-Tec</span>
          </div>
          <button type="button" className="sidebar-collapse-btn" title={collapsed ? '展开侧边菜单' : '收起侧边菜单'} aria-expanded={!collapsed} onClick={() => setCollapsed((v) => !v)}>
            <iconify-icon icon={collapsed ? 'ant-design:menu-unfold-outlined' : 'ant-design:menu-fold-outlined'} width="18" height="18" />
          </button>
        </div>
        <nav className="sidebar-menu sidebar-single" aria-label="模块导航">
          {MENU.map((g) => {
            const open = openGroup === g.id;
            return (
              <div className={`menu-group${open ? ' is-open' : ''}`} data-group={g.id} key={g.id}>
                <button type="button" className="menu-group-head" onClick={() => setOpenGroup(open ? '' : g.id)}>
                  <iconify-icon icon={g.icon} width="16" height="16" />
                  <span className="menu-group-label">{g.label}</span>
                  <iconify-icon className="menu-caret" icon={open ? 'ant-design:up-outlined' : 'ant-design:down-outlined'} width="12" height="12" />
                </button>
                {open && (
                  <div className="menu-group-body">
                    {g.items.map((item) => {
                      const n = badgeFor(item.id);
                      return (
                        <div key={item.id} className={`menu-item${page === item.id ? ' active' : ''}`} role="button" tabIndex={0} onClick={() => onNavigate(item.id)}>
                          <span>{item.label}</span>
                          {n > 0 && <span className="menu-badge">{n}</span>}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-account">
            <button type="button" className="sidebar-account-btn" aria-expanded={accountOpen} onClick={() => setAccountOpen((v) => !v)}>
              <span className="account-avatar" aria-hidden="true">{(session.displayName || 'A').slice(0, 1).toUpperCase()}</span>
              <span className="account-label">{session.displayName}</span>
              <iconify-icon className="account-caret" icon="ant-design:up-outlined" width="12" height="12" />
            </button>
            {accountOpen && (
              <div className="sidebar-account-panel">
                <div className="account-actions">
                  <button type="button" className="account-action" onClick={() => { onNavigate('help'); setAccountOpen(false); }}>
                    <iconify-icon className="account-action-ico" icon="ant-design:question-circle-outlined" width="16" height="16" />
                    <span>帮助</span>
                  </button>
                  <button type="button" className="account-action" disabled title="阶段 6 迁移">
                    <iconify-icon className="account-action-ico" icon="ant-design:setting-outlined" width="16" height="16" />
                    <span>账号与权限</span>
                  </button>
                  <button type="button" className="account-action" disabled title="阶段 6 迁移">
                    <iconify-icon className="account-action-ico" icon="ant-design:lock-outlined" width="16" height="16" />
                    <span>修改密码</span>
                  </button>
                  <button type="button" className="account-action account-action-danger" onClick={onLogout}>
                    <iconify-icon className="account-action-ico" icon="ant-design:logout-outlined" width="16" height="16" />
                    <span>退出登录</span>
                  </button>
                </div>
              </div>
            )}
          </div>
          <div className="sidebar-credit" title="系统由 MuBai | Archie 提供技术支持">系统由 <a className="sidebar-credit-link" href="https://github.com/Jon-mubai/CMG-tools" target="_blank" rel="noopener noreferrer">MuBai</a> | Archie 提供技术支持</div>
        </div>
      </aside>
      <main className="main-content">
        <header className="topbar">
          <div className="topbar-left">
            <div>
              <div className="page-title">{meta?.item.label || 'WMS-Tec'}</div>
              <div className="page-subtitle">{meta?.item.title || meta?.group.label || ''}</div>
            </div>
          </div>
        </header>
        <div className="content-area">
          <section className="page-section active" id={page.startsWith("finance-") ? "page-finance-ledger" : undefined}>{children}</section>
        </div>
      </main>
    </div>
  );
}
