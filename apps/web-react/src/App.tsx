import { useEffect, useState } from 'react';
import { AppShell } from '@/layouts/AppShell';
import { LoginPage } from '@/pages/LoginPage';
import { PlaceholderPage } from '@/pages/PlaceholderPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { HelpPage } from '@/pages/HelpPage';
import { FinanceBoardPage } from '@/pages/FinanceBoardPage';
import { WhParkPage } from '@/pages/WhParkPage';
import { WhStockPage } from '@/pages/WhStockPage';
import { FinanceRecordsPage } from '@/pages/FinanceRecordsPage';
import { FinanceRegisterPage } from '@/pages/FinanceRegisterPage';
import { FinanceAmountPage } from '@/pages/FinanceAmountPage';
import { clearSession, loadSession, type Session } from '@/session';
import type { PageId } from '@/menu';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { setUnauthorizedHandler } from '@/api/client';

function tokenOf(s: Session) {
  return s.token === 'demo' ? null : s.token;
}

export default function App() {
  const [session, setSession] = useState<Session | null>(() => loadSession());
  const [page, setPage] = useState<PageId>('dashboard');

  useEffect(() => {
    setUnauthorizedHandler(() => {
      clearSession();
      setSession(null);
    });
    return () => setUnauthorizedHandler(null);
  }, []);

  if (!session) return <LoginPage onLogin={setSession} />;
  const token = tokenOf(session);

  let body = <PlaceholderPage page={page} />;
  if (page === 'dashboard') body = <DashboardPage token={token} />;
  if (page === 'help') body = <HelpPage />;
  if (page === 'finance-board') body = <FinanceBoardPage token={token} />;
  if (page === 'finance-records') body = <FinanceRecordsPage token={token} />;
  if (page === 'finance-register') body = <FinanceRegisterPage token={token} />;
  if (page === 'finance-amount') body = <FinanceAmountPage token={token} />;
  if (page === 'wh-park') body = <WhParkPage token={token} />;
  if (page === 'wh-stock') body = <WhStockPage token={token} />;

  return (
    <AppShell
      session={session}
      page={page}
      onNavigate={setPage}
      onLogout={() => {
        clearSession();
        setSession(null);
      }}
    >
      <ErrorBoundary>{body}</ErrorBoundary>
    </AppShell>
  );
}
