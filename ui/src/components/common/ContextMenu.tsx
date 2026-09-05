import { useEffect, useRef } from 'react';
import { colors, font, radius, shadow, space } from '../../theme/tokens';

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
      background: colors.bgInput, border: '1px solid var(--c-border-soft)', borderRadius: radius.sm, overflow: 'hidden',
      minWidth: 150, padding: `${space.xs}px 0`, boxShadow: shadow.menu,
    }}>
      {items.map((item, i) => (
        <div key={i} className="wt-menu-item" onClick={() => { item.action(); onClose(); }}
          style={{
            padding: '7px 16px', fontSize: font.md, color: colors.text, whiteSpace: 'nowrap',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = colors.bgHover)}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
          {item.label}
        </div>
      ))}
    </div>
  );
}
