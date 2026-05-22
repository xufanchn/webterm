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

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '6px 10px', background: '#3c3c3c', border: '1px solid #555',
    borderRadius: 4, color: '#fff', fontSize: 12, boxSizing: 'border-box',
  };
  const labelStyle: React.CSSProperties = { color: '#ccc', fontSize: 12, display: 'block', marginBottom: 4 };

  return (
    <Modal title={connection ? '编辑数据库连接' : '新建数据库连接'} onClose={onClose} width={480}>
      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12, overflow: 'auto', maxHeight: '60vh' }}>
        {error && <div style={{ color: '#f44747', fontSize: 12, padding: '6px 10px', background: '#2d1b1b', borderRadius: 4 }}>{error}</div>}

        <div><label style={labelStyle}>名称</label><input value={form.name} onChange={(e) => update('name', e.target.value)} style={inputStyle} /></div>
        <div><label style={labelStyle}>主机地址</label><input value={form.host} onChange={(e) => update('host', e.target.value)} placeholder="127.0.0.1" style={inputStyle} /></div>
        <div><label style={labelStyle}>端口</label><input type="number" value={String(form.port)} onChange={(e) => update('port', Number(e.target.value) || 3306)} style={inputStyle} /></div>
        <div><label style={labelStyle}>用户名</label><input value={form.username} onChange={(e) => update('username', e.target.value)} placeholder="root" style={inputStyle} /></div>
        <div><label style={labelStyle}>密码</label><input type="password" value={form.password} onChange={(e) => update('password', e.target.value)} placeholder={connection ? '留空则不修改' : ''} style={inputStyle} /></div>
        <div><label style={labelStyle}>数据库名</label><input value={form.database_name} onChange={(e) => update('database_name', e.target.value)} placeholder="可选，连接后可切换" style={inputStyle} /></div>

        <div>
          <label style={labelStyle}>分组</label>
          <select value={form.group_id} onChange={(e) => update('group_id', Number(e.target.value))} style={inputStyle}>
            <option value={0}>未分组</option>
            {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        </div>

        <label style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#ccc', fontSize: 12 }}>
          <input type="checkbox" checked={form.shared} onChange={(e) => update('shared', e.target.checked)} />
          共享连接
        </label>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
          <button onClick={onClose} style={{ padding: '6px 16px', background: '#555', border: 'none', color: '#fff', borderRadius: 4, cursor: 'pointer', fontSize: 12 }}>取消</button>
          <button onClick={handleSubmit} disabled={saving || !form.name || !form.host}
            style={{ padding: '6px 16px', background: saving ? '#555' : '#007acc', border: 'none', color: '#fff', borderRadius: 4, cursor: saving ? 'default' : 'pointer', fontSize: 12 }}>
            {saving ? '保存中...' : '保存'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
