import React, { useState, useRef, useEffect } from 'react';

interface Props {
  value: string;
  onChange: (value: string) => void;
  style?: React.CSSProperties;
  children: React.ReactNode;
}

export default function CustomSelect({ value, onChange, style, children }: Props) {
  const [open, setOpen] = useState(false);
  const [focusIdx, setFocusIdx] = useState(-1);
  const ref = useRef<HTMLDivElement>(null);
  const opts = React.Children.toArray(children)
    .filter((o: any) => o && o.props && 'value' in o.props);
  const currentOpt = opts.find((o: any) => String(o.props.value) === String(value)) as any;
  const label = currentOpt?.props?.children ?? (value || '');
  const optStyle = currentOpt?.props?.style;

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleKey = (e: React.KeyboardEvent) => {
    if (!open) { if (e.key === 'Enter' || e.key === ' ') { setOpen(true); e.preventDefault(); } return; }
    if (e.key === 'Escape') { setOpen(false); return; }
    if (e.key === 'ArrowDown') { setFocusIdx((i) => Math.min(i + 1, opts.length - 1)); e.preventDefault(); }
    else if (e.key === 'ArrowUp') { setFocusIdx((i) => Math.max(i - 1, 0)); e.preventDefault(); }
    else if (e.key === 'Enter') {
      if (focusIdx >= 0 && opts[focusIdx]) {
        const v = (opts[focusIdx] as any).props.value;
        onChange(v); setOpen(false); setFocusIdx(-1);
      }
      e.preventDefault();
    }
  };

  const selectValue = (v: string) => { onChange(v); setOpen(false); setFocusIdx(-1); };

  return (
    <div ref={ref} tabIndex={0} onKeyDown={handleKey}
      onClick={() => setOpen(!open)}
      style={{
        position: 'relative', outline: 'none', cursor: 'pointer', ...style,
        display: 'flex', alignItems: 'center', userSelect: 'none',
      }}>
      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', ...(optStyle || {}) }}>{label}</span>
      <span style={{ fontSize: 12, color: '#565f89', marginLeft: 4 }}>{open ? '▲' : '▼'}</span>
      {open && (
        <div style={{
          position: 'fixed', zIndex: 10001,
          background: '#1f2335', border: '1px solid #3b4261', borderRadius: 4,
          overflow: 'overlay', maxHeight: 200, boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
        }} ref={(el) => {
          if (el && ref.current) {
            const rect = ref.current.getBoundingClientRect();
            el.style.left = `${rect.left}px`;
            el.style.top = `${rect.bottom + 2}px`;
            el.style.width = `${rect.width}px`;
          }
        }}>
          {opts.map((opt: any, i: number) => (
            <div key={i}
              onClick={(e) => { e.stopPropagation(); selectValue(opt.props.value); }}
              onMouseEnter={() => setFocusIdx(i)}
              style={{
                padding: '6px 12px', fontSize: 15, cursor: 'pointer',
                background: i === focusIdx ? '#7aa2f7' : 'transparent',
                color: i === focusIdx ? '#1a1b26' : (opt.props.style?.color || '#c0caf5'),
              }}>
              {opt.props.children}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
