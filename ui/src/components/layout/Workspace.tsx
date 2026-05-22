import { useState } from 'react';
import ActivityBar from './ActivityBar';
import Sidebar from './Sidebar';
import MainArea from './MainArea';
import { useAuthStore } from '../../store/auth';
import SettingsPanel from '../config/SettingsPanel';

export default function Workspace() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const [showSettings, setShowSettings] = useState(false);

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '6px 16px', background: '#007acc', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
        <span style={{ color: '#fff', fontWeight: 600 }}>WShell</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ color: '#ddd', fontSize: 13 }}>{user?.username}</span>
          <button onClick={() => setShowSettings(true)} style={{ background: 'rgba(255,255,255,0.2)', color: '#fff', border: 'none', padding: '2px 10px', borderRadius: 3, cursor: 'pointer', fontSize: 12 }}>⚙ 设置</button>
          <button onClick={logout} style={{ background: 'rgba(255,255,255,0.2)', color: '#fff', border: 'none', padding: '2px 10px', borderRadius: 3, cursor: 'pointer', fontSize: 12 }}>退出</button>
        </span>
      </div>
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <ActivityBar />
        <Sidebar />
        <MainArea />
      </div>
      {showSettings && (
        <SettingsPanel
          themeName="Dracula"
          fontSize={13}
          onThemeChange={(name) => { /* TODO: persist to localStorage */ }}
          onFontSizeChange={(size) => { /* TODO: persist */ }}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
}
