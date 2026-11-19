import type { ReactNode } from 'react';
import { Button } from './Button';

type Props = {
  open: boolean;
  title: string;
  children?: ReactNode;
  onClose: () => void;
  onConfirm?: () => void;
  confirmText?: string;
};

/** 复用现有模态结构 class，行为由调用方控制 */
export function Modal({ open, title, children, onClose, onConfirm, confirmText = '确定' }: Props) {
  if (!open) return null;
  return (
    <div className="modal-mask" role="presentation" style={{ display: 'flex' }}>
      <div className="modal" role="dialog" aria-label={title}>
        <div className="modal-hd">{title}</div>
        <div className="modal-bd">{children}</div>
        <div className="modal-ft">
          <Button onClick={onClose}>取消</Button>
          {onConfirm && (
            <Button variant="primary" onClick={onConfirm}>
              {confirmText}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
