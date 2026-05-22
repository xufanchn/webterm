import { useState, useEffect } from 'react';
import Modal from '../common/Modal';
import { apiPost, apiPut, apiGet } from '../../api/client';

interface Group {
  id: number;
  name: string;
  type: string;
}

interface Props {
  connection?: any;
  onClose: () => void;
  onSaved: () => void;
}

export default function ConnectionForm({ connection, onClose, onSaved }: Props) {
  const [groups, setGroups] = useState<Group[]>([]);
  const [form, setForm] = useState({
    name: connection?.name || '',
    host: connection?.host || '',
    port: connection?.port || 22,
    username: connection?.username || '',
    auth_method: connection?.auth_method || 'password',
    password: '',
    private_key: '',
    passphrase: '',
    group_id: connection?.group_id || 0,
    shared: connection?.shared || false,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    apiGet('/api/groups?type=ssh').then((data) => setGroups(data || [])).catch(() => {});
  }, []);

  const handleSubmit = async () => {
    setSaving(true);
    setError('');
    try {
      if (connection?.id) {
        await apiPut(`/api/connections/${connection.id}`, form);
      } else {
        await apiPost('/api/connections', form);
      }
      onSaved();
      onClose();
    } catch (e: any) {
      setError(e.message || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const update = (key: string, value: any) => setForm({ ...form, [key]: value });

  return (
    <Modal title={connection ? '编辑连接' : '新建 SSH 连接'} onClose={onClose} width={480}>
      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12, overflow: 'auto', maxHeight: '60vh' }}>
        {error && <div style={{ color: '#f44747', fontSize: 12, padding: '6px 10px', background: '#2d1b1b', borderRadius: 4 }}>{error}</div>}

        <FormField label="名称" value={form.name} onChange={(v) => update('name', v)} />
        <FormField label="主机地址" value={form.host} onChange={(v) => update('host', v)} placeholder="192.168.1.1" />
        <FormField label="端口" value={String(form.port)} onChange={(v) => update('port', Number(v) || 22)} type="number" />
        <FormField label="用户名" value={form.username} onChange={(v) => update('username', v)} placeholder="root" />

        <div>
          <label style={labelStyle}>认证方式</label>
          <select value={form.auth_method} onChange={(e) => update('auth_method', e.target.value)}
            style={inputStyle}>
            <option value="password">密码</option>
            <option value="private_key">私钥</option>
          </select>
        </div>

        {form.auth_method === 'password' && (
          <FormField label="密码" value={form.password} onChange={(v) => update('password', v)} type="password" />
        )}
        {form.auth_method === 'private_key' && (
          <>
            <div>
              <label style={labelStyle}>私钥（粘贴内容）</label>
              <textarea value={form.private_key} onChange={(e) => update('private_key', e.target.value)}
                style={{ ...inputStyle, minHeight: 80, fontFamily: 'monospace', fontSize: 11 }}
                placeholder="-----BEGIN OPENSSH PRIVATE KEY-----" />
            </div>
            <FormField label="私钥口令" value={form.passphrase} onChange={(v) => update('passphrase', v)} type="password" />
          </>
        )}

        <div>
          <label style={labelStyle}>分组</label>
          <select value={form.group_id} onChange={(e) => update('group_id', Number(e.target.value))} style={inputStyle}>
            <option value={0}>未分组</option>
            {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        </div>

        <label style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#ccc', fontSize: 12 }}>
          <input type="checkbox" checked={form.shared} onChange={(e) => update('shared', e.target.checked)} />
          共享连接（所有用户可见）
        </label>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
          <button onClick={onClose} style={btnSecondary}>取消</button>
          <button onClick={handleSubmit} disabled={saving || !form.name || !form.host} style={btnPrimary(saving)}>
            {saving ? '保存中...' : '保存'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function FormField({ label, value, onChange, type = 'text', placeholder }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string;
}) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder} style={inputStyle} />
    </div>
  );
}

const labelStyle: React.CSSProperties = { color: '#ccc', fontSize: 12, display: 'block', marginBottom: 4 };
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '6px 10px', background: '#3c3c3c', border: '1px solid #555',
  borderRadius: 4, color: '#fff', fontSize: 12, boxSizing: 'border-box',
};
const btnSecondary: React.CSSProperties = { padding: '6px 16px', background: '#555', border: 'none', color: '#fff', borderRadius: 4, cursor: 'pointer', fontSize: 12 };
const btnPrimary = (saving: boolean): React.CSSProperties => ({
  padding: '6px 16px', background: saving ? '#555' : '#007acc', border: 'none', color: '#fff',
  borderRadius: 4, cursor: saving ? 'default' : 'pointer', fontSize: 12,
});
