import { useEffect } from 'react';
import { useLayoutStore } from '../../store/layout';
import { useConnectionStore } from '../../store/connections';
import type { Connection, DbConnection } from '../../store/connections';

export default function Sidebar() {
  const activeModule = useLayoutStore((s) => s.activeModule);
  const { connections, groups, dbConnections, fetchConnections, fetchDbConnections, fetchGroups } = useConnectionStore();
  const openTab = useLayoutStore((s) => s.openTab);

  useEffect(() => {
    if (activeModule === 'ssh') {
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

  const groupMap: Record<number, Connection[]> = {};
  connections.forEach((c) => {
    const gid = c.group_id || 0;
    if (!groupMap[gid]) groupMap[gid] = [];
    groupMap[gid].push(c);
  });

  return (
    <div style={{ width: 210, background: '#252526', flexShrink: 0, overflow: 'auto', fontSize: 12 }}>
      <div style={{ padding: '8px 10px', color: '#fff', fontWeight: 600, borderBottom: '1px solid #383838' }}>
        {activeModule === 'ssh' ? '▣ SSH 主机' : activeModule === 'sftp' ? '◧ SFTP 文件' : activeModule === 'database' ? '🗄 数据库' : '⚙ 配置'}
      </div>
      {groups.map((g) => (
        <div key={g.id}>
          <div style={{ padding: '4px 10px', color: '#4fc3f7', cursor: 'pointer' }}>
            ▼ 📁 {g.name}
          </div>
          {(groupMap[g.id] || []).map((c) => (
            <div key={c.id} onDoubleClick={() => handleDblClick(c)}
              style={{ padding: '3px 10px 3px 28px', color: '#ccc', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
              <span>🟢</span> {c.name}
            </div>
          ))}
        </div>
      ))}
      {(groupMap[0] || []).map((c) => (
        <div key={c.id} onDoubleClick={() => handleDblClick(c)}
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
  );
}
