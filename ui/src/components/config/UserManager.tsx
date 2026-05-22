import { useEffect, useState } from 'react';
import { apiGet, apiPost, apiPut, apiDelete } from '../../api/client';
import Modal from '../common/Modal';

interface User {
  id: number;
  username: string;
  role: string;
  disabled: boolean;
  created_at: string;
  updated_at: string;
}

export default function UserManager() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [formData, setFormData] = useState({ username: '', password: '', role: 'user', disabled: false });

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const data = await apiGet('/api/users');
      setUsers(data || []);
    } catch (e) {
      setError('加载用户列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchUsers(); }, []);

  const handleCreate = async () => {
    try {
      await apiPost('/api/users', formData);
      setShowForm(false);
      resetForm();
      fetchUsers();
    } catch (e) { setError('创建失败'); }
  };

  const handleUpdate = async () => {
    if (!editingUser) return;
    try {
      await apiPut(`/api/users/${editingUser.id}`, formData);
      setShowForm(false);
      setEditingUser(null);
      resetForm();
      fetchUsers();
    } catch (e) { setError('更新失败'); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('确定要删除此用户吗？')) return;
    try {
      await apiDelete(`/api/users/${id}`);
      fetchUsers();
    } catch (e) { setError('删除失败'); }
  };

  const resetForm = () => {
    setFormData({ username: '', password: '', role: 'user', disabled: false });
  };

  const openEdit = (user: User) => {
    setEditingUser(user);
    setFormData({ username: user.username, password: '', role: user.role, disabled: user.disabled });
    setShowForm(true);
  };

  return (
    <div style={{ padding: 16, overflow: 'auto', height: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h3 style={{ color: '#fff', margin: 0, fontSize: 16 }}>用户管理</h3>
        <button onClick={() => { resetForm(); setEditingUser(null); setShowForm(true); }}
          style={{
            background: '#007acc', border: 'none', color: '#fff', padding: '6px 16px',
            borderRadius: 4, cursor: 'pointer', fontSize: 12,
          }}>+ 新建用户</button>
      </div>

      {error && (
        <div style={{ padding: '8px 12px', color: '#f44747', background: '#2d1b1b', borderRadius: 4, marginBottom: 12, fontSize: 12 }}>
          {error}
          <button onClick={() => setError('')} style={{ marginLeft: 8, background: 'none', border: 'none', color: '#f44747', cursor: 'pointer' }}>✕</button>
        </div>
      )}

      {loading ? (
        <div style={{ color: '#888' }}>加载中...</div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ background: '#2d2d2d' }}>
              <th style={{ padding: '8px 12px', textAlign: 'left', color: '#4fc3f7', borderBottom: '1px solid #444' }}>ID</th>
              <th style={{ padding: '8px 12px', textAlign: 'left', color: '#4fc3f7', borderBottom: '1px solid #444' }}>用户名</th>
              <th style={{ padding: '8px 12px', textAlign: 'left', color: '#4fc3f7', borderBottom: '1px solid #444' }}>角色</th>
              <th style={{ padding: '8px 12px', textAlign: 'left', color: '#4fc3f7', borderBottom: '1px solid #444' }}>状态</th>
              <th style={{ padding: '8px 12px', textAlign: 'left', color: '#4fc3f7', borderBottom: '1px solid #444' }}>创建时间</th>
              <th style={{ padding: '8px 12px', textAlign: 'center', color: '#4fc3f7', borderBottom: '1px solid #444' }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} style={{ background: u.id % 2 === 0 ? '#1e1e1e' : '#252526' }}>
                <td style={{ padding: '6px 12px', color: '#ccc', borderBottom: '1px solid #333' }}>{u.id}</td>
                <td style={{ padding: '6px 12px', color: '#ccc', borderBottom: '1px solid #333' }}>{u.username}</td>
                <td style={{ padding: '6px 12px', color: u.role === 'admin' ? '#4fc3f7' : '#ccc', borderBottom: '1px solid #333' }}>{u.role}</td>
                <td style={{ padding: '6px 12px', borderBottom: '1px solid #333' }}>
                  <span style={{ color: u.disabled ? '#f44747' : '#6a9955' }}>{u.disabled ? '已禁用' : '正常'}</span>
                </td>
                <td style={{ padding: '6px 12px', color: '#888', borderBottom: '1px solid #333', fontSize: 11 }}>{u.created_at}</td>
                <td style={{ padding: '6px 12px', borderBottom: '1px solid #333', textAlign: 'center' }}>
                  <button onClick={() => openEdit(u)}
                    style={{ background: 'none', border: 'none', color: '#4fc3f7', cursor: 'pointer', fontSize: 11, marginRight: 8 }}>编辑</button>
                  <button onClick={() => handleDelete(u.id)}
                    style={{ background: 'none', border: 'none', color: '#f44747', cursor: 'pointer', fontSize: 11 }}>删除</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {showForm && (
        <Modal title={editingUser ? '编辑用户' : '新建用户'} onClose={() => { setShowForm(false); setEditingUser(null); }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 16 }}>
            <div>
              <label style={{ color: '#ccc', fontSize: 12, display: 'block', marginBottom: 4 }}>用户名</label>
              <input value={formData.username} onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                style={{
                  width: '100%', padding: '6px 10px', background: '#3c3c3c', border: '1px solid #555',
                  borderRadius: 4, color: '#fff', fontSize: 12, boxSizing: 'border-box',
                }} />
            </div>
            <div>
              <label style={{ color: '#ccc', fontSize: 12, display: 'block', marginBottom: 4 }}>
                密码{editingUser ? '（留空则不修改）' : ''}
              </label>
              <input type="password" value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                style={{
                  width: '100%', padding: '6px 10px', background: '#3c3c3c', border: '1px solid #555',
                  borderRadius: 4, color: '#fff', fontSize: 12, boxSizing: 'border-box',
                }} />
            </div>
            <div>
              <label style={{ color: '#ccc', fontSize: 12, display: 'block', marginBottom: 4 }}>角色</label>
              <select value={formData.role} onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                style={{
                  width: '100%', padding: '6px 10px', background: '#3c3c3c', border: '1px solid #555',
                  borderRadius: 4, color: '#fff', fontSize: 12,
                }}>
                <option value="user">user</option>
                <option value="admin">admin</option>
              </select>
            </div>
            {editingUser && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input type="checkbox" checked={formData.disabled} onChange={(e) => setFormData({ ...formData, disabled: e.target.checked })}
                  id="user-disabled" />
                <label htmlFor="user-disabled" style={{ color: '#ccc', fontSize: 12 }}>禁用账号</label>
              </div>
            )}
            <button onClick={editingUser ? handleUpdate : handleCreate}
              style={{
                padding: '8px 16px', background: '#007acc', border: 'none', color: '#fff',
                borderRadius: 4, cursor: 'pointer', fontSize: 12, alignSelf: 'flex-end',
              }}>
              {editingUser ? '保存' : '创建'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
