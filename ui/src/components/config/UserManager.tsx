import { t } from '../../i18n';
import { useEffect, useState } from 'react';
import { apiGet, apiPost, apiPut, apiDelete } from '../../api/client';
import { useAuthStore } from '../../store/auth';
import Modal from '../common/Modal';
import CustomSelect from '../common/CustomSelect';
import Icon from '../common/Icon';

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

  const token = useAuthStore((s) => s.token);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const data = await apiGet('/api/users');
      setUsers(data || []);
    } catch (e) {
      setError(t('config_load_failed'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (token) fetchUsers(); }, [token]);

  const handleCreate = async () => {
    try {
      await apiPost('/api/users', formData);
      setShowForm(false);
      resetForm();
      fetchUsers();
    } catch (e) { setError(t('config_create_failed')); }
  };

  const handleUpdate = async () => {
    if (!editingUser) return;
    try {
      await apiPut(`/api/users/${editingUser.id}`, formData);
      setShowForm(false);
      setEditingUser(null);
      resetForm();
      fetchUsers();
    } catch (e) { setError(t('config_update_failed')); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm(t('config_confirm_delete'))) return;
    try {
      await apiDelete(`/api/users/${id}`);
      fetchUsers();
    } catch (e) { setError(t('config_delete_failed')); }
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
        <h3 style={{ color: '#ccc', margin: 0, fontSize: 18 }}>{t("config_users")}</h3>
        <button onClick={() => { resetForm(); setEditingUser(null); setShowForm(true); }}
          style={{
            background: '#7aa2f7', border: 'none', color: '#1a1b26', padding: '6px 16px',
            borderRadius: 4, cursor: 'pointer', fontSize: 14,
          }}>{t("config_new_user")}</button>
      </div>

      {error && (
        <div style={{ padding: '8px 12px', color: '#f44747', background: '#2d1b1b', borderRadius: 4, marginBottom: 12, fontSize: 14 }}>
          {error}
          <button onClick={() => setError('')} style={{ marginLeft: 8, background: 'none', border: 'none', color: '#f44747', cursor: 'pointer', display: 'flex', alignItems: 'center' }}><Icon name="x" size={14} /></button>
        </div>
      )}

      {loading ? (
        <div style={{ color: '#565f89' }}>{t("file_loading")}</div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr style={{ background: '#1a1b26' }}>
              <th style={{ padding: '8px 12px', textAlign: 'left', color: '#7aa2f7', borderBottom: '1px solid #3b4261' }}>ID</th>
              <th style={{ padding: '8px 12px', textAlign: 'left', color: '#7aa2f7', borderBottom: '1px solid #3b4261' }}>{t("config_user")}</th>
              <th style={{ padding: '8px 12px', textAlign: 'left', color: '#7aa2f7', borderBottom: '1px solid #3b4261' }}>{t("config_role")}</th>
              <th style={{ padding: '8px 12px', textAlign: 'left', color: '#7aa2f7', borderBottom: '1px solid #3b4261' }}>{t("config_status")}</th>
              <th style={{ padding: '8px 12px', textAlign: 'left', color: '#7aa2f7', borderBottom: '1px solid #3b4261' }}>{t("config_created")}</th>
              <th style={{ padding: '8px 12px', textAlign: 'center', color: '#7aa2f7', borderBottom: '1px solid #3b4261' }}>{t("config_actions")}</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} style={{ background: u.id % 2 === 0 ? '#1a1b26' : '#1f2335' }}>
                <td style={{ padding: '6px 12px', color: '#ccc', borderBottom: '1px solid #3b4261' }}>{u.id}</td>
                <td style={{ padding: '6px 12px', color: '#ccc', borderBottom: '1px solid #3b4261' }}>{u.username}</td>
                <td style={{ padding: '6px 12px', color: u.role === 'admin' ? '#7aa2f7' : '#ccc', borderBottom: '1px solid #3b4261' }}>{u.role}</td>
                <td style={{ padding: '6px 12px', borderBottom: '1px solid #3b4261' }}>
                  <span style={{ color: u.disabled ? '#f44747' : '#6a9955' }}>{u.disabled ? t('config_disabled') : t('config_active')}</span>
                </td>
                <td style={{ padding: '6px 12px', color: '#888', borderBottom: '1px solid #3b4261', fontSize: 13 }}>{u.created_at}</td>
                <td style={{ padding: '6px 12px', borderBottom: '1px solid #3b4261', textAlign: 'center' }}>
                  <button onClick={() => openEdit(u)}
                    style={{ background: 'none', border: 'none', color: '#7aa2f7', cursor: 'pointer', fontSize: 13, marginRight: 8 }}>{t("menu_edit")}</button>
                  <button onClick={() => handleDelete(u.id)}
                    style={{ background: 'none', border: 'none', color: '#f44747', cursor: 'pointer', fontSize: 13 }}>{t("menu_delete")}</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {showForm && (
        <Modal title={editingUser ? t('config_edit_user') : t('config_new_user')} onClose={() => { setShowForm(false); setEditingUser(null); }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 16 }}>
            <div>
              <label style={{ color: '#ccc', fontSize: 14, display: 'block', marginBottom: 4 }}>{t("config_user")}</label>
              <input value={formData.username} onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                style={{
                  width: '100%', padding: '6px 10px', background: '#1f2335', border: '1px solid #3b4261',
                  borderRadius: 4, color: '#ccc', fontSize: 14, boxSizing: 'border-box',
                }} />
            </div>
            <div>
              <label style={{ color: '#ccc', fontSize: 14, display: 'block', marginBottom: 4 }}>
                {t("conn_password")}{editingUser ? t('config_keep_pwd') : ''}
              </label>
              <input type="password" value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                style={{
                  width: '100%', padding: '6px 10px', background: '#1f2335', border: '1px solid #3b4261',
                  borderRadius: 4, color: '#ccc', fontSize: 14, boxSizing: 'border-box',
                }} />
            </div>
            <div>
              <label style={{ color: '#ccc', fontSize: 14, display: 'block', marginBottom: 4 }}>{t("config_role")}</label>
              <CustomSelect value={formData.role} onChange={(v) => setFormData({ ...formData, role: v })}
                style={{
                  width: '100%', padding: '6px 10px', background: '#1f2335', border: '1px solid #3b4261',
                  borderRadius: 4, color: '#ccc', fontSize: 14,
                }}>
                <option value="user">user</option>
                <option value="admin">admin</option>
              </CustomSelect>
            </div>
            {editingUser && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input type="checkbox" checked={formData.disabled} onChange={(e) => setFormData({ ...formData, disabled: e.target.checked })}
                  id="user-disabled" />
                <label htmlFor="user-disabled" style={{ color: '#ccc', fontSize: 14 }}>{t("config_disable")}</label>
              </div>
            )}
            <button onClick={editingUser ? handleUpdate : handleCreate}
              style={{
                padding: '8px 16px', background: '#7aa2f7', border: 'none', color: '#1a1b26',
                borderRadius: 4, cursor: 'pointer', fontSize: 14, alignSelf: 'flex-end',
              }}>
              {editingUser ? t('conn_save') : t('config_create')}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
