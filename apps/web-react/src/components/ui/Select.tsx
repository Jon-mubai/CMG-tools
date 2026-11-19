import { useEffect, useRef, useState } from 'react';

type Props = { value: string; onChange: (v: string) => void; options: string[]; placeholder?: string };

export function Select({ value, onChange, options, placeholder = '请选择' }: Props) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 });
  const ref = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  function place() {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    setPos({ top: r.bottom + 4, left: r.left, width: r.width });
  }

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      const t = e.target as Node;
      if (ref.current?.contains(t) || menuRef.current?.contains(t)) return;
      setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  return (
    <div className="fin-select" ref={ref}>
      <button
        type="button"
        className="field-control fin-input"
        style={{ textAlign: 'left' }}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={() => { place(); setOpen((v) => !v); }}
      >
        {value || placeholder}
      </button>
      {open && (
        <div
          ref={menuRef}
          className="fin-select-menu is-fixed"
          style={{ top: pos.top, left: pos.left, width: pos.width }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <button type="button" className={`fin-select-item${!value ? ' is-active' : ''}`} onMouseDown={(e) => e.preventDefault()} onClick={() => { onChange(''); setOpen(false); }}>{placeholder}</button>
          {options.map((opt) => (
            <button key={opt} type="button" className={`fin-select-item${value === opt ? ' is-active' : ''}`} onMouseDown={(e) => e.preventDefault()} onClick={() => { onChange(opt); setOpen(false); }}>{opt}</button>
          ))}
        </div>
      )}
    </div>
  );
}
