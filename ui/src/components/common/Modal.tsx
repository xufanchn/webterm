import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import Icon from './Icon';
import { colors, font, radius, shadow, space, transition } from '../../theme/tokens';

interface Props {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  width?: number;
  height?: number;
  unscaled?: boolean;
}

export default function Modal({ title, onClose, children, width = 600, height = 400, unscaled }: Props) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  return createPortal(
    <div style={{
      position: 'fixed', inset: 0, zIndex: 10000,
      background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }} onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{
        background: colors.bgOverlay, borderRadius: radius.xl, width, height, ['--ui-scale' as any]: unscaled ? 1 : undefined,
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
        boxShadow: shadow.overlay,
        animation: 'wt-modal-in 0.16s ease',
      }} onClick={(e) => e.stopPropagation()}>
        <div style={{
          padding: `${space.md + 2}px ${space.xxl} ${space.md + 2}px ${space.xxl}`, display: 'flex',
          justifyContent: 'space-between', alignItems: 'center', fontSize: font.xl2,
          borderBottom: '1px solid var(--c-border-soft)', background: colors.bgHeader, flexShrink: 0,
        }}>
          <span style={{ color: colors.accent, fontWeight: 600, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</span>
          <button onClick={onClose} title="Esc" style={{
            background: 'none', border: 'none', color: colors.textMuted, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 24, height: 24, borderRadius: radius.sm, transition: `background ${transition.fast}, color ${transition.fast}`,
          }}
            onMouseEnter={(e) => { e.currentTarget.style.background = colors.bgHover; e.currentTarget.style.color = colors.text; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = colors.textMuted; }}>
            <Icon name="x" size={18} />
          </button>
        </div>
        <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
}
