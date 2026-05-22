import { useAuthStore } from '../../store/auth';

export default function Workspace() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '8px 16px', background: '#333', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ color: '#fff' }}>WShell</span>
        <span>
          <span style={{ marginRight: 16, color: '#ccc' }}>{user?.username} ({user?.role})</span>
          <button onClick={logout} style={{ background: '#555', color: '#fff', border: 'none', padding: '4px 12px', borderRadius: 4, cursor: 'pointer' }}>退出</button>
        </span>
      </div>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#666' }}>
        选择左侧连接开始工作
      </div>
    </div>
  );
}
