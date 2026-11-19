import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'outline' | 'ghost' | 'danger';

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: 'md' | 'sm';
  children?: ReactNode;
};

/** 复用经典前端 .btn 系列 class，不另写视觉 */
export function Button({ variant = 'outline', size = 'md', className = '', children, ...rest }: Props) {
  const v = variant === 'primary' ? 'btn-primary' : variant === 'ghost' ? 'btn-ghost' : variant === 'danger' ? 'btn-danger' : 'btn-outline';
  const s = size === 'sm' ? 'btn-sm' : '';
  return (
    <button type="button" className={['btn', v, s, className].filter(Boolean).join(' ')} {...rest}>
      {children}
    </button>
  );
}
