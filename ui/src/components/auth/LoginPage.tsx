import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/auth';
import { apiPost } from '../../api/client';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const setAuth = useAuthStore((s) => s.setAuth);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const data = await apiPost('/api/auth/login', { username, password });
      setAuth(data.user, data.token);
      navigate('/');
    } catch {
      setError('用户名或密码错误');
    }
  };

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      height: '100vh', background: '#1e1e1e',
    }}>
      <form onSubmit={handleSubmit} style={{
        background: '#2d2d2d', padding: 40, borderRadius: 8,
        width: 360, display: 'flex', flexDirection: 'column', gap: 16,
      }}>
        <h1 style={{ textAlign: 'center', color: '#fff', marginBottom: 8 }}>WShell</h1>
        {error && <div style={{ color: '#f44336', textAlign: 'center', fontSize: 14 }}>{error}</div>}
        <input
          style={{ padding: 10, borderRadius: 4, border: '1px solid #555', background: '#3c3c3c', color: '#fff' }}
          placeholder="用户名"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoFocus
        />
        <input
          type="password"
          style={{ padding: 10, borderRadius: 4, border: '1px solid #555', background: '#3c3c3c', color: '#fff' }}
          placeholder="密码"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <button type="submit" style={{
          padding: 10, borderRadius: 4, border: 'none',
          background: '#007acc', color: '#fff', cursor: 'pointer', fontSize: 14,
        }}>
          登录
        </button>
      </form>
    </div>
  );
}
