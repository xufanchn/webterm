import ActivityBar from './ActivityBar';
import Sidebar from './Sidebar';
import MainArea from './MainArea';
import { useAuthStore } from '../../store/auth';

export default function Workspace() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '6px 16px', background: '#007acc', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
        <span style={{ color: '#fff', fontWeight: 600 }}>WShell</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ color: '#ddd', fontSize: 13 }}>{user?.username}</span>
          <button onClick={logout} style={{ background: 'rgba(255,255,255,0.2)', color: '#fff', border: 'none', padding: '2px 10px', borderRadius: 3, cursor: 'pointer', fontSize: 12 }}>退出</button>
        </span>
      </div>
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <ActivityBar />
        <Sidebar />
        <MainArea />
      </div>
    </div>
  );
}
