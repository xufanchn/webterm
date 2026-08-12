import { useState, useRef, useCallback, useEffect } from 'react';
import ActivityBar from './ActivityBar';
import Sidebar from './Sidebar';
import MainArea from './MainArea';
import SettingsPanel from '../config/SettingsPanel';
import HeaderSearch from './HeaderSearch';
import Icon from '../common/Icon';
import { useAuthStore } from '../../store/auth';
import { useLayoutStore } from '../../store/layout';
import { t, getLang, setLang } from '../../i18n';

export default function Workspace() {
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  const logout = useAuthStore((s) => s.logout);
  const [showSettings, setShowSettings] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);

  useEffect(() => {
    if (token) setSidebarCollapsed(false);
  }, [token]);
  const statusConn = useLayoutStore((s) => s.statusConn);
  const [sidebarWidth, setSidebarWidth] = useState(210);
  const dragRef = useRef({ startX: 0, startW: 0, dragging: false });

  const onSidebarResizeStart = useCallback((e: React.MouseEvent) => {
    dragRef.current = { startX: e.clientX, startW: sidebarWidth, dragging: true };
    const onMove = (ev: MouseEvent) => {
      if (!dragRef.current.dragging) return;
      const w = Math.max(120, Math.min(500, dragRef.current.startW + ev.clientX - dragRef.current.startX));
      setSidebarWidth(w);
    };
    const onUp = () => { dragRef.current.dragging = false; document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [sidebarWidth]);

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <div style={{ height: 36, padding: '0 12px', background: '#1a1b26', borderBottom: '1px solid #3b4261', display: 'flex', alignItems: 'center', flexShrink: 0, fontSize: 14 }}>
        <span style={{ color: '#7aa2f7', fontWeight: 700, fontSize: 15, fontFamily: '"JetBrains Mono", "JetBrains Maple Mono", Consolas, monospace', textShadow: '0 0 8px #7aa2f766', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
          <Icon name="terminal" size={16} color="#7aa2f7" style={{ filter: 'drop-shadow(0 0 6px #7aa2f766)' }} /> WEBTERM
        </span>
        <HeaderSearch />
        {/* Right side */}
        <span style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <span onClick={() => { const lang = getLang() === 'zh' ? 'en' : 'zh'; setLang(lang); window.location.reload(); }}
            className="header-btn"
            style={{ color: '#565f89', cursor: 'pointer', userSelect: 'none', padding: '2px 8px', borderRadius: 4, border: '1px solid #3b4261', textAlign: 'center', flexShrink: 0 }}>
            {getLang() === 'zh' ? 'EN' : '中'}
          </span>
          <span className="header-btn"
            style={{ color: user ? '#c0caf5' : '#565f89', flexShrink: 0, padding: '2px 8px', borderRadius: 4, border: '1px solid #3b4261' }}>
            {user?.username || t('login_submit')}
          </span>
          <button onClick={token ? logout : undefined} className="header-btn logout-btn"
            style={{ background: 'transparent', color: token ? '#565f89' : '#3b4261', border: '1px solid #3b4261', padding: '2px 10px', borderRadius: 4, cursor: token ? 'pointer' : 'default', flexShrink: 0, opacity: token ? 1 : 0.4 }}>
            {t('logout')}
          </button>
        </span>
      </div>
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>
        <ActivityBar onOpenSettings={() => setShowSettings(true)} sidebarCollapsed={sidebarCollapsed} onToggleSidebar={() => setSidebarCollapsed(!sidebarCollapsed)} />
        <Sidebar collapsed={sidebarCollapsed} width={sidebarWidth} />
        <MainArea />
        {/* Resize handle overlaid on sidebar right edge */}
        {!sidebarCollapsed && (
          <div onMouseDown={onSidebarResizeStart}
            style={{
              position: 'absolute', left: 44 + sidebarWidth - 3, top: 0, bottom: 0,
              width: 6, cursor: 'col-resize', zIndex: 10,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
            onMouseEnter={(e) => {
              const line = e.currentTarget.firstChild as HTMLElement;
              line.style.width = '2px'; line.style.background = '#3b4261';
              (e.currentTarget.lastChild as HTMLElement).style.opacity = '1';
            }}
            onMouseLeave={(e) => {
              const line = e.currentTarget.firstChild as HTMLElement;
              line.style.width = '0px';
              (e.currentTarget.lastChild as HTMLElement).style.opacity = '0';
            }}>
            <div style={{ width: 0, height: '100%', background: '#7aa2f7', transition: 'width 0.1s' }} />
            <span style={{ position: 'absolute', color: '#7aa2f7', userSelect: 'none', background: '#1a1b26', padding: '2px 0', opacity: 0, transition: 'opacity 0.1s', display: 'flex', alignItems: 'center' }}><Icon name="grip-vertical" size={12} /></span>
          </div>
        )}
      </div>
      {showSettings && (
        <SettingsPanel onClose={() => setShowSettings(false)} />
      )}
      {/* Global status bar */}
      <div style={{
        height: 22, flexShrink: 0, background: '#1a1b26', borderTop: '1px solid #3b4261',
        display: 'flex', alignItems: 'center', padding: '0 10px',
        fontSize: 13, color: '#7aa2f7', gap: 10, lineHeight: '22px',
      }}>
        <span style={{ opacity: 0.7, flexShrink: 0 }}>webterm</span>
        <span style={{ flex: 1 }} />
        {statusConn ? (
          <>
            <span style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
              background: statusConn.connected ? '#4caf50' : '#f44747',
            }} />
            <span style={{ width: 40, textAlign: 'center', flexShrink: 0 }}>{statusConn.connected ? t('status_connected') : t('status_disconnected')}</span>
            <span style={{ flexShrink: 0 }}>{statusConn.name}{statusConn.host ? ` (${statusConn.host})` : ''}</span>
          </>
        ) : (
          <span style={{ color: '#888', flexShrink: 0 }}>{t('status_disconnected')}</span>
        )}
      </div>
    </div>
  );
}
