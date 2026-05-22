import { useState, useEffect } from 'react';
import UserManager from './UserManager';
import ConnectionTable from './ConnectionTable';
import { apiGet, apiPost, apiDelete } from '../../api/client';

const tabs = [
  { key: 'users', label: '用户管理' },
  { key: 'ssh', label: 'SSH 连接' },
  { key: 'database', label: '数据库连接' },
  { key: 'groups', label: '分组管理' },
];

export default function ConfigPage() {
  const [activeTab, setActiveTab] = useState('users');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', background: '#252526', borderBottom: '1px solid #383838', flexShrink: 0 }}>
        {tabs.map((tab) => (
          <div key={tab.key} onClick={() => setActiveTab(tab.key)}
            style={{
              padding: '8px 20px', cursor: 'pointer', fontSize: 13,
              color: activeTab === tab.key ? '#fff' : '#999',
              borderBottom: activeTab === tab.key ? '2px solid #007acc' : '2px solid transparent',
              background: activeTab === tab.key ? '#1e1e1e' : 'transparent',
            }}>
            {tab.label}
          </div>
        ))}
      </div>
      <div style={{ flex: 1, overflow: 'auto' }}>
        {activeTab === 'users' && <UserManager />}
        {activeTab === 'ssh' && (
          <ConnectionTable
            type="ssh"
            title="SSH 连接"
            apiPrefix="/api/connections"
            groupType="ssh"
            columns={[
              { key: 'name', label: '名称', width: '2fr' },
              { key: 'host', label: '主机', width: '2fr' },
              { key: 'port', label: '端口', width: '1fr' },
              { key: 'username', label: '用户', width: '1fr' },
              { key: 'shared', label: '共享', width: '1fr', render: (v: boolean) => v ? '是' : '否' },
            ]}
          />
        )}
        {activeTab === 'database' && (
          <ConnectionTable
            type="db"
            title="数据库连接"
            apiPrefix="/api/db_connections"
            groupType="database"
            columns={[
              { key: 'name', label: '名称', width: '2fr' },
              { key: 'host', label: '主机', width: '2fr' },
              { key: 'port', label: '端口', width: '1fr' },
              { key: 'username', label: '用户', width: '1fr' },
              { key: 'database_name', label: '数据库', width: '1fr' },
              { key: 'shared', label: '共享', width: '1fr', render: (v: boolean) => v ? '是' : '否' },
            ]}
          />
        )}
        {activeTab === 'groups' && <GroupManager />}
      </div>
    </div>
  );
}

function GroupManager() {
  const [groups, setGroups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState('ssh');
  const [error, setError] = useState('');

  const fetchGroups = async () => {
    try {
      const all: any[] = [];
      for (const t of ['ssh', 'database', 'sftp_bookmark']) {
        const data = await apiGet(`/api/groups?type=${t}`);
        all.push(...(data || []).map((g: any) => ({ ...g, type: t })));
      }
      setGroups(all);
    } catch { setError('加载失败'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchGroups(); }, []);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    try {
      await apiPost('/api/groups', { name: newName.trim(), type: newType, parent_id: 0 });
      setNewName('');
      fetchGroups();
    } catch { setError('创建失败'); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('确定删除此分组？')) return;
    try { await apiDelete(`/api/groups/${id}`); fetchGroups(); }
    catch { setError('删除失败'); }
  };

  if (loading) return <div style={{ padding: 16, color: '#888' }}>加载中...</div>;

  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h3 style={{ color: '#fff', margin: 0, fontSize: 16 }}>分组管理</h3>
      </div>
      {error && <div style={{ color: '#f44747', fontSize: 12, padding: '6px 10px', background: '#2d1b1b', borderRadius: 4, marginBottom: 12 }}>{error}</div>}

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center' }}>
        <input value={newName} onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
          placeholder="分组名称" style={{ padding: '6px 10px', background: '#3c3c3c', border: '1px solid #555', borderRadius: 4, color: '#fff', fontSize: 12, width: 200 }} />
        <select value={newType} onChange={(e) => setNewType(e.target.value)}
          style={{ padding: '6px 10px', background: '#3c3c3c', border: '1px solid #555', borderRadius: 4, color: '#fff', fontSize: 12 }}>
          <option value="ssh">SSH</option>
          <option value="database">数据库</option>
          <option value="sftp_bookmark">SFTP 书签</option>
        </select>
        <button onClick={handleCreate} style={{ padding: '6px 16px', background: '#007acc', border: 'none', color: '#fff', borderRadius: 4, cursor: 'pointer', fontSize: 12 }}>新建</button>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr style={{ background: '#2d2d2d' }}>
            <th style={thStyle}>ID</th>
            <th style={thStyle}>名称</th>
            <th style={thStyle}>类型</th>
            <th style={{ ...thStyle, textAlign: 'center' }}>操作</th>
          </tr>
        </thead>
        <tbody>
          {groups.map((g, i) => (
            <tr key={g.id} style={{ background: i % 2 === 0 ? '#1e1e1e' : '#252526' }}>
              <td style={tdStyle}>{g.id}</td>
              <td style={tdStyle}>{g.name}</td>
              <td style={tdStyle}>{g.type}</td>
              <td style={{ ...tdStyle, textAlign: 'center' }}>
                <button onClick={() => handleDelete(g.id)} style={{ background: 'none', border: 'none', color: '#f44747', cursor: 'pointer', fontSize: 11 }}>删除</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const thStyle: React.CSSProperties = { padding: '8px 12px', textAlign: 'left', color: '#4fc3f7', borderBottom: '1px solid #444' };
const tdStyle: React.CSSProperties = { padding: '6px 12px', color: '#ccc', borderBottom: '1px solid #333' };
