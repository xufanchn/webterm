import { useState, useEffect } from 'react';
import { useLayoutStore } from '../../store/layout';
import { useConnectionStore } from '../../store/connections';
import type { Connection, DbConnection, Group } from '../../store/connections';
import ConnectionForm from '../config/ConnectionForm';
import DbConnectionForm from '../config/DbConnectionForm';
import ContextMenu from '../common/ContextMenu';
import { apiPost, apiPut, apiDelete } from '../../api/client';

export default function Sidebar({ collapsed }: { collapsed: boolean }) {
  const activeModule = useLayoutStore((s) => s.activeModule);
  const { connections, groups, dbConnections, fetchConnections, fetchDbConnections, fetchGroups } = useConnectionStore();
  const requestTab = useLayoutStore((s) => s.requestTab);
  const [showConnForm, setShowConnForm] = useState(false);
  const [editingConn, setEditingConn] = useState<any>(null);
  const [showDbForm, setShowDbForm] = useState(false);
  const [editingDbConn, setEditingDbConn] = useState<any>(null);
  const [showGroupInput, setShowGroupInput] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [editingGroupId, setEditingGroupId] = useState<number | null>(null);
  const [blankMenu, setBlankMenu] = useState<{x: number; y: number} | null>(null);
  const [groupMenu, setGroupMenu] = useState<{x: number; y: number; group: Group} | null>(null);
  const [connMenu, setConnMenu] = useState<{x: number; y: number; conn: any} | null>(null);
  const [dragConn, setDragConn] = useState<number | null>(null);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<number>>(new Set());

  const toggleGroup = (gid: number) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(gid)) next.delete(gid); else next.add(gid);
      return next;
    });
  };

  const isSsh = activeModule === 'ssh';
  const isDb = activeModule === 'database';
  const typeStr = isSsh ? 'ssh' : 'database';

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
    requestTab({ id: `ssh-${conn.id}-${Date.now()}`, type: 'ssh', title: conn.name, connId: conn.id });
  };

  const handleCreateGroup = async (name: string) => {
    if (!name.trim()) return;
    await apiPost('/api/groups', { name: name.trim(), type: typeStr, parent_id: 0 });
    setShowGroupInput(false);
    setNewGroupName('');
    if (isSsh) fetchGroups('ssh');
    else fetchGroups('database');
  };

  const handleRenameGroup = async (id: number, name: string) => {
    if (!name.trim()) return;
    await apiPut(`/api/groups/${id}`, { name: name.trim() });
    setEditingGroupId(null);
    if (isSsh) fetchGroups('ssh');
    else fetchGroups('database');
  };

  const handleDeleteGroup = async (id: number) => {
    await apiDelete(`/api/groups/${id}`);
    if (isSsh) { fetchGroups('ssh'); fetchConnections(); }
    else { fetchGroups('database'); fetchDbConnections(); }
    setGroupMenu(null);
  };

  const handleDeleteConn = async (id: number) => {
    await apiDelete(`/api/connections/${id}`);
    fetchConnections();
    setConnMenu(null);
  };

  const handleDeleteDbConn = async (id: number) => {
    await apiDelete(`/api/db_connections/${id}`);
    fetchDbConnections();
    setConnMenu(null);
  };

  const handleMoveConn = async (connId: number, groupId: number) => {
    await apiPut(`/api/connections/${connId}`, { group_id: groupId });
    fetchConnections();
    setConnMenu(null);
  };

  const groupMap: Record<number, Connection[]> = {};
  connections.forEach((c) => {
    const gid = c.group_id || 0;
    if (!groupMap[gid]) groupMap[gid] = [];
    groupMap[gid].push(c);
  });

  const renderConnItem = (c: any, isDbConn: boolean) => (
    <div key={c.id} data-sidebar-item
      draggable
      onDragStart={() => setDragConn(c.id)}
      onDragEnd={() => setDragConn(null)}
      onDoubleClick={() => isDbConn
        ? requestTab({ id: `db-${c.id}-${Date.now()}`, type: 'database', title: c.name, connId: c.id })
        : handleDblClick(c)}
      onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); setConnMenu({ x: e.clientX, y: e.clientY, conn: c }); }}
      style={{
        padding: '3px 10px 3px 28px', color: '#ccc', cursor: 'pointer',
        display: 'flex', alignItems: 'center', gap: 4,
        opacity: dragConn === c.id ? 0.3 : 1,
      }}
      onMouseEnter={(e) => e.currentTarget.style.background = '#2a2d2e'}
      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
      <span>{isDbConn ? '🗄' : '🟢'}</span> {c.name}
    </div>
  );

  const renderGroup = (g: Group) => {
    const childConns = groupMap[g.id] || [];
    return (
      <div key={g.id}
        onDragOver={(e) => { e.preventDefault(); }}
        onDrop={() => { if (dragConn) handleMoveConn(dragConn, g.id); }}
        style={{ background: dragConn ? 'rgba(0,122,204,0.15)' : 'transparent' }}>
        {editingGroupId === g.id ? (
          <div style={{ padding: '2px 10px', display: 'flex', gap: 4 }}>
            <input
              defaultValue={g.name}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleRenameGroup(g.id, e.currentTarget.value);
                if (e.key === 'Escape') setEditingGroupId(null);
              }}
              onBlur={() => setEditingGroupId(null)}
              autoFocus
              style={{ flex: 1, padding: '2px 6px', background: '#3c3c3c', border: '1px solid #555', borderRadius: 3, color: '#fff', fontSize: 11 }} />
          </div>
        ) : (
          <div data-sidebar-item
            onClick={() => toggleGroup(g.id)}
            onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); setGroupMenu({ x: e.clientX, y: e.clientY, group: g }); }}
            style={{ padding: '4px 10px', color: '#4fc3f7', cursor: 'pointer' }}>
            {collapsedGroups.has(g.id) ? '▶' : '▼'} 📁 {g.name}
          </div>
        )}
        {!collapsedGroups.has(g.id) && childConns.map((c) => renderConnItem(c, false))}
      </div>
    );
  };

  return (
    <div style={{ width: collapsed ? 0 : 210, flexShrink: 0, fontSize: 12, display: 'flex', flexDirection: 'column', background: '#252526', overflow: 'hidden', transition: 'width 0.15s' }}
      onContextMenu={(e) => {
        if ((e.target as HTMLElement).closest('[data-sidebar-item]')) return;
        e.preventDefault();
        setBlankMenu({ x: e.clientX, y: e.clientY });
      }}>
      <div style={{ padding: '8px 10px', color: '#fff', fontWeight: 600, borderBottom: '1px solid #383838', flexShrink: 0, whiteSpace: 'nowrap' }}>
        {activeModule === 'ssh' ? '▣ SSH 主机' : activeModule === 'sftp' ? '◧ SFTP 文件' : activeModule === 'database' ? '🗄 数据库' : '⚙ 配置'}
      </div>
      {!collapsed && (<>
        <div style={{ overflow: 'auto', flex: 1 }}>
          {(isSsh || activeModule === 'sftp') && (
            <>
              {groups.map((g) => renderGroup(g))}
              {(groupMap[0] || []).map((c) => renderConnItem(c, false))}
            </>
          )}
          {isDb && dbConnections.map((c: DbConnection) => renderConnItem(c, true))}
        </div>
        {(isSsh || isDb) && (
          <div style={{ borderTop: '1px solid #383838', padding: '4px 8px', marginTop: 'auto' }}>
            <div onClick={() => { if (isSsh) { setEditingConn(null); setShowConnForm(true); } else { setEditingDbConn(null); setShowDbForm(true); } }}
            style={{ padding: '4px 8px', color: '#4fc3f7', cursor: 'pointer', fontSize: 11 }}>+ 新建连接</div>
          {showGroupInput ? (
            <div style={{ display: 'flex', gap: 4, padding: '4px 0' }}>
              <input value={newGroupName} onChange={(e) => setNewGroupName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreateGroup(newGroupName);
                  if (e.key === 'Escape') { setShowGroupInput(false); setNewGroupName(''); }
                }}
                onBlur={() => { setShowGroupInput(false); setNewGroupName(''); }}
                placeholder="分组名称" autoFocus
                style={{ flex: 1, padding: '2px 6px', background: '#3c3c3c', border: '1px solid #555', borderRadius: 3, color: '#fff', fontSize: 10 }} />
              <button onClick={() => handleCreateGroup(newGroupName)}
                style={{ background: '#007acc', border: 'none', color: '#fff', borderRadius: 3, padding: '2px 6px', cursor: 'pointer', fontSize: 10 }}>创建</button>
              <button onClick={() => { setShowGroupInput(false); setNewGroupName(''); }}
                style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: 10, padding: '2px 4px' }}>✕</button>
            </div>
          ) : (
            <div onClick={() => setShowGroupInput(true)}
              style={{ padding: '4px 8px', color: '#888', cursor: 'pointer', fontSize: 11 }}>+ 新建分组</div>
          )}
        </div>
      )}
      </>)}
      {/* Blank area context menu */}
      {blankMenu && (
        <ContextMenu x={blankMenu.x} y={blankMenu.y} onClose={() => setBlankMenu(null)}
          items={[
            { label: '新建连接', action: () => {
              if (isDb) { setEditingDbConn(null); setShowDbForm(true); }
              else { setEditingConn(null); setShowConnForm(true); }
              setBlankMenu(null);
            }},
            { label: '新建分组', action: () => { setShowGroupInput(true); setBlankMenu(null); } },
          ]} />
      )}

      {/* Group context menu */}
      {groupMenu && (
        <ContextMenu x={groupMenu.x} y={groupMenu.y} onClose={() => setGroupMenu(null)}
          items={[
            { label: '在此分组新建连接', action: () => {
              if (isDb) { setEditingDbConn({ group_id: groupMenu.group.id }); setShowDbForm(true); }
              else { setEditingConn({ group_id: groupMenu.group.id }); setShowConnForm(true); }
              setGroupMenu(null);
            }},
            { label: '重命名分组', action: () => { setEditingGroupId(groupMenu.group.id); setGroupMenu(null); } },
            { label: '删除分组', action: () => handleDeleteGroup(groupMenu.group.id) },
          ]} />
      )}

      {/* Connection context menu */}
      {connMenu && (() => {
        const isDbConn = 'database_name' in connMenu.conn;
        const moveItems = groups.map((g) => ({
          label: `→ ${g.name}`,
          action: () => handleMoveConn(connMenu.conn.id, g.id),
        }));
        return (
          <ContextMenu x={connMenu.x} y={connMenu.y} onClose={() => setConnMenu(null)}
            items={[
              { label: '编辑', action: () => {
                if (isDbConn) { setEditingDbConn(connMenu.conn); setShowDbForm(true); }
                else { setEditingConn(connMenu.conn); setShowConnForm(true); }
                setConnMenu(null);
              }},
              ...(isDbConn ? [] : [
                ...(groups.length > 0 ? [{ label: '移动到分组', action: () => {} }, ...moveItems] : []),
              ]),
              { label: '删除', action: () => {
                if (isDbConn) handleDeleteDbConn(connMenu.conn.id);
                else handleDeleteConn(connMenu.conn.id);
              }},
            ]} />
        );
      })()}

      {showConnForm && (
        <ConnectionForm
          connection={editingConn}
          onClose={() => { setShowConnForm(false); setEditingConn(null); }}
          onSaved={() => { fetchConnections(); fetchGroups('ssh'); }}
        />
      )}
      {showDbForm && (
        <DbConnectionForm
          connection={editingDbConn}
          onClose={() => { setShowDbForm(false); setEditingDbConn(null); }}
          onSaved={() => { fetchDbConnections(); fetchGroups('database'); }}
        />
      )}
    </div>
  );
}
