import type { PageId } from '@/menu';
import { findPage } from '@/menu';

type Props = { page: PageId };

export function PlaceholderPage({ page }: Props) {
  const meta = findPage(page);
  return (
    <div className="card">
      <div className="card-title">{meta?.item.label || page}</div>
      <div className="empty">该模块尚未迁移，现有 apps/web 仍可使用。</div>
    </div>
  );
}
