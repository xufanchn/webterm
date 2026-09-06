import { useCallback, useEffect, useRef, useState } from 'react';
import SftpPanel from './SftpPanel';
import CustomSelect from '../common/CustomSelect';
import Icon from '../common/Icon';
import { t } from '../../i18n';
import { colors, font, radius, transition } from '../../theme/tokens';

interface Props {
  connections: Array<{ id: number; name: string }>;
}

const MIN_PCT = 25;
const MAX_PCT = 75;

export default function DualPaneSftp({ connections }: Props) {
  const [leftConnId, setLeftConnId] = useState<number | null>(connections[0]?.id || null);
  const [rightConnId, setRightConnId] = useState<number | null>(null);

  // connections arrive async on first mount — pick the first once loaded
  useEffect(() => {
    setLeftConnId((cur) => cur ?? connections[0]?.id ?? null);
  }, [connections]);
  const [leftPct, setLeftPct] = useState(50);
  const [dragging, setDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const onDividerDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setDragging(true);
    const onMove = (ev: MouseEvent) => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect || rect.width === 0) return;
      const pct = ((ev.clientX - rect.left) / rect.width) * 100;
      setLeftPct(Math.max(MIN_PCT, Math.min(MAX_PCT, pct)));
    };
    const onUp = () => {
      setDragging(false);
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, []);

  const paneHeader = (icon: string, label: string, select: React.ReactNode) => (
    <div style={{
      height: 36, padding: '0 8px', background: colors.bgHeader, display: 'flex', gap: 8,
      alignItems: 'center', fontSize: font.sm, flexShrink: 0, borderBottom: '1px solid var(--c-border-soft)',
    }}>
      <span style={{ color: colors.accent, display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
        <Icon name={icon} size={13} /> <span style={{ color: colors.textMuted, fontWeight: 600 }}>{label}</span>
      </span>
      {select}
    </div>
  );

  const selectStyle = {
    flex: 1, minWidth: 0, background: 'rgba(31,35,53,0.5)', color: colors.textLight,
    border: '1px solid var(--c-border-soft)', borderRadius: radius.sm, fontSize: font.sm, padding: '3px 6px',
  };

  return (
    <div ref={containerRef} style={{ display: 'flex', height: '100%', gap: 0 }}>
      {/* Left pane */}
      <div style={{ width: `${leftPct}%`, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {paneHeader('monitor', t('sftp_remote'),
          <CustomSelect value={String(leftConnId || '')} onChange={(v) => setLeftConnId(Number(v) || null)} style={selectStyle}>
            {connections.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </CustomSelect>
        )}
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          {leftConnId ? <SftpPanel connId={leftConnId} /> : <EmptyPane />}
        </div>
      </div>

      {/* Draggable divider */}
      <div onMouseDown={onDividerDown} style={{
        width: 4, flexShrink: 0, cursor: 'col-resize', background: dragging ? colors.accent : 'var(--c-border-soft)',
        transition: dragging ? 'none' : `background ${transition.fast}`,
      }} />

      {/* Right pane: Local (default) or another remote */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {paneHeader(rightConnId === null ? 'laptop' : 'monitor', rightConnId === null ? t('sftp_local') : t('sftp_remote'),
          <CustomSelect value={rightConnId === null ? 'local' : String(rightConnId)}
            onChange={(v) => setRightConnId(v === 'local' ? null : Number(v))} style={selectStyle}>
            <option value="local">{t('sftp_local')}</option>
            {connections.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </CustomSelect>
        )}
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          {rightConnId ? <SftpPanel connId={rightConnId} /> : <SftpPanel localMode />}
        </div>
      </div>
    </div>
  );
}

function EmptyPane() {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, color: colors.textFaint }}>
      <Icon name="monitor" size={28} />
      <div style={{ fontSize: font.md }}>{t('sftp_pick_connection')}</div>
    </div>
  );
}
