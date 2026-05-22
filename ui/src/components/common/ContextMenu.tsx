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
      background: '#2d2d2d', border: '1px solid #555', borderRadius: 4,
      minWidth: 140, padding: '4px 0', boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
    }}>
      {items.map((item, i) => (
        <div key={i} onClick={() => { item.action(); onClose(); }}
          style={{
            padding: '6px 16px', fontSize: 12, color: '#ccc', cursor: 'pointer',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = '#094771')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
          {item.label}
        </div>
      ))}
    </div>
  );
}
