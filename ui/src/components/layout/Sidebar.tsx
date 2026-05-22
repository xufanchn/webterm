import { useState, useEffect } from 'react';
import { useLayoutStore } from '../../store/layout';
import { useConnectionStore } from '../../store/connections';
import type { Connection, DbConnection } from '../../store/connections';
import ConnectionForm from '../config/ConnectionForm';
import { apiPost, apiDelete } from '../../api/client';

export default function Sidebar() {
  const activeModule = useLayoutStore((s) => s.activeModule);
  const { connections, groups, dbConnections, fetchConnections, fetchDbConnections, fetchGroups } = useConnectionStore();
  const openTab = useLayoutStore((s) => s.openTab);
  const [showConnForm, setShowConnForm] = useState(false);
  const [editingConn, setEditingConn] = useState<any>(null);
  const [showGroupInput, setShowGroupInput] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [contextMenu, setContextMenu] = useState<{x: number; y: number; conn: any} | null>(null);

  useEffect(() => {
    if (activeModule === 'ssh' || activeModule === 'sftp') {
      fetchGroups('ssh');
      fetchConnections();
    } else if (activeModule === 'database') {
      fetchGroups('database');
      fetchDbConnections();
    }
  }, [activeModule]);

  const handleDblClick = (conn: Connection) => {
    openTab({
      id: `ssh-${conn.id}`, type: 'ssh',
      title: conn.name, connId: conn.id,
    });
  };

  const handleCreateGroup = async () => {
    if (!newGroupName.trim()) return;
    await apiPost('/api/groups', { name: newGroupName.trim(), type: 'ssh', parent_id: 0 });
    setNewGroupName('');
    setShowGroupInput(false);
    fetchGroups('ssh');
  };

  const handleDeleteConn = async (id: number) => {
    await apiDelete(`/api/connections/${id}`);
    fetchConnections();
    setContextMenu(null);
  };

  const groupMap: Record<number, Connection[]> = {};
  connections.forEach((c) => {
    const gid = c.group_id || 0;
    if (!groupMap[gid]) groupMap[gid] = [];
    groupMap[gid].push(c);
  });

  return (
    <div style={{ width: 210, background: '#252526', flexShrink: 0, fontSize: 12, display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '8px 10px', color: '#fff', fontWeight: 600, borderBottom: '1px solid #383838' }}>
        {activeModule === 'ssh' ? '▣ SSH 主机' : activeModule === 'sftp' ? '◧ SFTP 文件' : activeModule === 'database' ? '🗄 数据库' : '⚙ 配置'}
      </div>
      <div style={{ overflow: 'auto', flex: 1 }}>
      {groups.map((g) => (
        <div key={g.id}>
          <div style={{ padding: '4px 10px', color: '#4fc3f7', cursor: 'pointer' }}>
            ▼ 📁 {g.name}
          </div>
          {(groupMap[g.id] || []).map((c) => (
            <div key={c.id} onDoubleClick={() => handleDblClick(c)}
              onContextMenu={(e) => { e.preventDefault(); setContextMenu({ x: e.clientX, y: e.clientY, conn: c }); }}
              style={{ padding: '3px 10px 3px 28px', color: '#ccc', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
              <span>🟢</span> {c.name}
            </div>
          ))}
        </div>
      ))}
      {(groupMap[0] || []).map((c) => (
        <div key={c.id} onDoubleClick={() => handleDblClick(c)}
          onContextMenu={(e) => { e.preventDefault(); setContextMenu({ x: e.clientX, y: e.clientY, conn: c }); }}
          style={{ padding: '3px 10px 3px 28px', color: '#ccc', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
          <span>🟢</span> {c.name}
        </div>
      ))}
      {activeModule === 'database' && dbConnections.length > 0 && (
        <>
          {dbConnections.map((c: DbConnection) => (
            <div key={c.id} onDoubleClick={() => openTab({ id: `db-${c.id}`, type: 'database', title: c.name, connId: c.id })}
              style={{ padding: '3px 10px 3px 28px', color: '#ccc', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
              <span>🗄</span> {c.name}
            </div>
          ))}
        </>
      )}
      </div>
      <div style={{ borderTop: '1px solid #383838', padding: '4px 8px', marginTop: 'auto' }}>
        <div onClick={() => { setEditingConn(null); setShowConnForm(true); }}
          style={{ padding: '4px 8px', color: '#4fc3f7', cursor: 'pointer', fontSize: 11 }}>
          + 新建连接
        </div>
        {showGroupInput ? (
          <div style={{ display: 'flex', gap: 4, padding: '4px 0' }}>
            <input value={newGroupName} onChange={(e) => setNewGroupName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreateGroup()}
              placeholder="分组名称" style={{ flex: 1, padding: '2px 6px', background: '#3c3c3c', border: '1px solid #555', borderRadius: 3, color: '#fff', fontSize: 10 }} />
            <button onClick={handleCreateGroup} style={{ background: '#007acc', border: 'none', color: '#fff', borderRadius: 3, padding: '2px 6px', cursor: 'pointer', fontSize: 10 }}>创建</button>
          </div>
        ) : (
          <div onClick={() => setShowGroupInput(true)}
            style={{ padding: '4px 8px', color: '#888', cursor: 'pointer', fontSize: 11 }}>
            + 新建分组
          </div>
        )}
      </div>
      {contextMenu && (
        <div style={{ position: 'fixed', left: contextMenu.x, top: contextMenu.y, zIndex: 1000, background: '#2d2d2d', border: '1px solid #555', borderRadius: 4, padding: '4px 0', minWidth: 120 }}
          onClick={() => setContextMenu(null)}>
          <div onClick={() => { setEditingConn(contextMenu.conn); setShowConnForm(true); setContextMenu(null); }}
            style={{ padding: '6px 12px', cursor: 'pointer', color: '#ccc', fontSize: 12 }}>编辑</div>
          <div onClick={() => handleDeleteConn(contextMenu.conn.id)}
            style={{ padding: '6px 12px', cursor: 'pointer', color: '#f44747', fontSize: 12 }}>删除</div>
        </div>
      )}
      {showConnForm && (
        <ConnectionForm
          connection={editingConn}
          onClose={() => { setShowConnForm(false); setEditingConn(null); }}
          onSaved={() => { fetchConnections(); fetchGroups('ssh'); }}
        />
      )}
    </div>
  );
}
