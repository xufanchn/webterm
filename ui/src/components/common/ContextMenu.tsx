import { useEffect, useRef } from 'react';

interface MenuItem {
  label: string;
  action: () => void;
}

interface Props {
  x: number;
  y: number;
  items: MenuItem[];
  onClose: () => void;
}

export default function ContextMenu({ x, y, items, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  return (
    <div ref={ref} style={{
      position: 'fixed', left: x, top: y, zIndex: 1000,
      background: '#1f2335', border: '1px solid #3b4261', borderRadius: 4, overflow: 'hidden',
      minWidth: 140, boxShadow: '0 0 16px rgba(0,0,0,0.6), 0 0 4px rgba(0,255,255,0.1)',
    }}>
      {items.map((item, i) => (
        <div key={i} onClick={() => { item.action(); onClose(); }}
          style={{
            padding: '8px 16px', fontSize: 14, color: '#c0caf5', cursor: 'pointer',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = '#3b4261')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
          {item.label}
        </div>
      ))}
    </div>
  );
}
