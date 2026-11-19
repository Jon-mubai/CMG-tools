import { Button } from './Button';

type Props = {
  page: number;
  pageSize: number;
  total: number;
  onPage: (page: number) => void;
};

export function Pager({ page, pageSize, total, onPage }: Props) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <div className="pager phase0-row">
      <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
        共 {total} 条 · 第 {page}/{pages} 页
      </span>
      <Button size="sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>
        上一页
      </Button>
      <Button size="sm" disabled={page >= pages} onClick={() => onPage(page + 1)}>
        下一页
      </Button>
    </div>
  );
}
