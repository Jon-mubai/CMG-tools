import type { InputHTMLAttributes } from 'react';

type Props = InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
};

/** 复用 .field-control，与全站表单边框一致 */
export function Input({ label, className = '', id, ...rest }: Props) {
  const input = (
    <input id={id} className={['field-control', className].filter(Boolean).join(' ')} {...rest} />
  );
  if (!label) return input;
  return (
    <label className="fin-field" htmlFor={id}>
      <span className="fin-label">{label}</span>
      {input}
    </label>
  );
}
