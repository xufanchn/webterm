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

export default function DbConnectionForm({ connection, onClose, onSaved }: Props) {
  const [groups, setGroups] = useState<Group[]>([]);
  const [form, setForm] = useState({
    name: connection?.name || '',
    host: connection?.host || '',
    port: connection?.port || 3306,
    username: connection?.username || '',
    password: '',
    database_name: connection?.database_name || '',
    group_id: connection?.group_id || 0,
    shared: connection?.shared || false,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    apiGet('/api/groups?type=database').then((data) => setGroups(data || [])).catch(() => {});
  }, []);

  const handleSubmit = async () => {
    setSaving(true);
    setError('');
    try {
      if (connection?.id) {
        await apiPut(`/api/db_connections/${connection.id}`, form);
      } else {
        await apiPost('/api/db_connections', form);
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
    <Modal title={connection ? '编辑数据库连接' : '新建数据库连接'} onClose={onClose} width={550} height={460}>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        {error && <div style={{ color: '#f44747', fontSize: 12, padding: '6px 10px', background: '#2d1b1b', borderRadius: 4, margin: '8px 16px 0' }}>{error}</div>}

        <div style={{ flex: 1, overflow: 'auto', padding: '8px 16px 0', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <FormField label="名称" value={form.name} onChange={(v) => update('name', v)} required />
          <div style={{ display: 'flex', gap: 12 }}>
            <div style={{ flex: 2 }}><FormField label="主机地址" value={form.host} onChange={(v) => update('host', v)} placeholder="127.0.0.1" required /></div>
            <div style={{ flex: 1 }}><FormField label="端口" value={String(form.port)} onChange={(v) => update('port', Number(v) || 3306)} type="number" /></div>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <div style={{ flex: 1 }}><FormField label="用户名" value={form.username} onChange={(v) => update('username', v)} placeholder="root" /></div>
            <div style={{ flex: 1 }}><FormField label="密码" value={form.password} onChange={(v) => update('password', v)} type="password" placeholder={connection ? '留空不修改' : ''} /></div>
          </div>
          <FormField label="数据库名" value={form.database_name} onChange={(v) => update('database_name', v)} placeholder="可选，连接后可切换" />

          <div>
            <label style={labelStyle}>分组</label>
            <select value={form.group_id} onChange={(e) => update('group_id', Number(e.target.value))} style={inputStyle}>
              <option value={0}>未分组</option>
              {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#ccc', fontSize: 12, paddingBottom: 8 }}>
            <input type="checkbox" checked={form.shared} onChange={(e) => update('shared', e.target.checked)} />
            共享连接
          </label>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '12px 16px', borderTop: '1px solid #383838', flexShrink: 0, background: '#252526' }}>
          <button onClick={onClose} style={btnSecondary}>取消</button>
          <button onClick={handleSubmit} disabled={saving || !form.name || !form.host}
            style={saving ? { ...btnPrimary, background: '#555', cursor: 'default' } : btnPrimary}>
            {saving ? '保存中...' : '保存'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function FormField({ label, value, onChange, type = 'text', placeholder, required }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string; required?: boolean;
}) {
  return (
    <div>
      <label style={labelStyle}>{label}{required ? ' *' : ''}</label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder} style={inputStyle} />
    </div>
  );
}

const labelStyle: React.CSSProperties = { color: '#ccc', fontSize: 12, display: 'block', marginBottom: 4 };
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 10px', background: '#3c3c3c', border: '1px solid #555',
  borderRadius: 4, color: '#fff', fontSize: 13, boxSizing: 'border-box',
};
const btnSecondary: React.CSSProperties = { padding: '8px 20px', background: '#555', border: 'none', color: '#fff', borderRadius: 4, cursor: 'pointer', fontSize: 13 };
const btnPrimary: React.CSSProperties = { padding: '8px 20px', background: '#007acc', border: 'none', color: '#fff', borderRadius: 4, cursor: 'pointer', fontSize: 13 };
