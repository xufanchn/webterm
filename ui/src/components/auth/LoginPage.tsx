import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/auth';
import { apiPost } from '../../api/client';
import { t, getLang, setLang } from '../../i18n';
import MatrixRain from '../common/MatrixRain';
import Icon from '../common/Icon';

export default function LoginPage() {
  const [username, setUsername] = useState(localStorage.getItem('webterm-rm-user') || '');
  const [password, setPassword] = useState(localStorage.getItem('webterm-rm-pwd') || '');
  const [showPwd, setShowPwd] = useState(false);
  const [remember, setRemember] = useState(!!localStorage.getItem('webterm-rm-user'));
  const [error, setError] = useState('');
  const [tick, setTick] = useState(0);
  const setAuth = useAuthStore((s) => s.setAuth);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const data = await apiPost('/api/auth/login', { username, password });
      if (remember) {
        localStorage.setItem('webterm-rm-user', username);
        localStorage.setItem('webterm-rm-pwd', password);
      } else {
        localStorage.removeItem('webterm-rm-user');
        localStorage.removeItem('webterm-rm-pwd');
      }
      setAuth(data.user, data.token);
      navigate('/');
    } catch {
      setError(t('login_error'));
    }
  };

  const inputStyle: React.CSSProperties = {
    padding: '10px 14px', border: '1px solid #3b4261', height: 42,
    background: 'rgba(31,35,53,0.6)', color: '#c0caf5', fontSize: 16,
    width: '100%', boxSizing: 'border-box', outline: 'none', borderRadius: 4,
  };

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      height: '100vh', background: '#1a1b26', position: 'relative', overflow: 'hidden', cursor: 'default',
    }} onClick={() => setTick((n) => n + 1)}>
      <MatrixRain key={tick} fontSize={22} radial />
      <form onSubmit={handleSubmit} onClick={(e) => e.stopPropagation()} style={{
        background: 'rgba(36,40,59,0.82)', borderRadius: 12, backdropFilter: 'blur(8px)',
        padding: 44, width: 400, height: 400,
        display: 'flex', flexDirection: 'column', gap: 16,
        boxShadow: '0 4px 24px rgba(0,0,0,0.3)',
        boxSizing: 'border-box', zIndex: 1,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
          <div>
            <div style={{ fontSize: 25, fontWeight: 700, color: '#7aa2f7', letterSpacing: 1, whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Icon name="terminal" size={22} color="#7aa2f7" /> WebTerm
            </div>
            <div style={{ color: '#565f89', fontSize: 13, marginTop: 2 }}>{t('app_slogan')}</div>
          </div>
          <span onClick={() => { const lang = getLang() === 'zh' ? 'en' : 'zh'; setLang(lang); window.location.reload(); }}
            style={{ color: '#565f89', fontSize: 14, cursor: 'pointer', userSelect: 'none', padding: '2px 6px', borderRadius: 3, background: '#1f2335' }}>
            {getLang() === 'zh' ? 'EN' : '中'}
          </span>
        </div>

        {error && (
          <div style={{ color: '#f7768e', fontSize: 15, padding: '8px 12px', background: '#f7768e15', borderRadius: 4 }}>
            {error}
          </div>
        )}

        <input style={inputStyle} placeholder={t('login_username')}
          value={username} onChange={(e) => setUsername(e.target.value)} autoFocus />

        <div style={{ position: 'relative' }}>
          <input type={showPwd ? 'text' : 'password'}
            style={{ ...inputStyle, paddingRight: 40 }}
            placeholder={t('login_password')} value={password} onChange={(e) => setPassword(e.target.value)} />
          <span onClick={() => setShowPwd(!showPwd)}
            style={{ position: 'absolute', right: 12, top: 11, cursor: 'pointer', color: '#565f89', userSelect: 'none', display: 'flex', alignItems: 'center' }}>
            {showPwd ? <Icon name="eye-off" size={16} /> : <Icon name="eye" size={16} />}
          </span>
        </div>

        <label style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#565f89', fontSize: 15, cursor: 'pointer' }}>
          <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)}
            style={{ accentColor: '#7aa2f7' }} />
          {t('login_remember')}
        </label>

        <button type="submit" style={{
          padding: '10px', border: 'none', borderRadius: 4, height: 40,
          background: '#7aa2f7', color: '#1a1b26', cursor: 'pointer', fontSize: 16,
          fontWeight: 600, letterSpacing: 1, boxSizing: 'border-box',
        }}>
          {t('login_submit')}
        </button>
      </form>
    </div>
  );
}
