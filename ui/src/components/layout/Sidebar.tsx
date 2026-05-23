import { useState, useEffect } from 'react';
import { useLayoutStore } from '../../store/layout';
import { useConnectionStore } from '../../store/connections';
import { useAuthStore } from '../../store/auth';
import type { Connection, DbConnection, Group } from '../../store/connections';
import ConnectionForm from '../config/ConnectionForm';
import DbConnectionForm from '../config/DbConnectionForm';
import ContextMenu from '../common/ContextMenu';
import CustomSelect from '../common/CustomSelect';
import { apiPost, apiPut, apiDelete } from '../../api/client';
import { t } from '../../i18n';
import Icon from '../common/Icon';

export default function Sidebar({ collapsed, width }: { collapsed: boolean; width: number }) {
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
  const [tagFilter, setTagFilter] = useState('');
  const [multiMode, setMultiMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
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

  const token = useAuthStore((s) => s.token);
  useEffect(() => {
    if (!token) return;
    if (activeModule === 'ssh' || activeModule === 'sftp') {
      fetchGroups('ssh');
      fetchConnections();
    } else if (activeModule === 'database') {
      fetchGroups('database');
      fetchDbConnections();
    }
  }, [activeModule, token]);

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

  const handleBatchDelete = async () => {
    for (const id of selectedIds) {
      await apiDelete(`/api/connections/${id}`).catch(() => {});
    }
    setSelectedIds(new Set());
    fetchConnections();
  };
  const handleMoveConn = async (connId: number, groupId: number) => {
    await apiPut(`/api/connections/${connId}`, { group_id: groupId });
    fetchConnections();
    setConnMenu(null);
  };
  const handleBatchMove = async (groupId: number) => {
    for (const id of selectedIds) {
      await apiPut(`/api/connections/${id}`, { group_id: groupId }).catch(() => {});
    }
    setSelectedIds(new Set());
    fetchConnections();
  };

  const filtered = connections.filter((c) => {
    if (tagFilter && (c as any).tag !== tagFilter) return false;
    return true;
  });

  const groupMap: Record<number, Connection[]> = {};
  filtered.forEach((c) => {
    const gid = c.group_id || 0;
    if (!groupMap[gid]) groupMap[gid] = [];
    groupMap[gid].push(c);
  });

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const renderConnItem = (c: any, isDbConn: boolean, indent = false) => (
    <div key={c.id} data-sidebar-item
      draggable
      onDragStart={() => setDragConn(c.id)}
      onDragEnd={() => setDragConn(null)}
      onDoubleClick={() => isDbConn
        ? requestTab({ id: `db-${c.id}-${Date.now()}`, type: 'database', title: c.name, connId: c.id })
        : handleDblClick(c)}
      onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); setConnMenu({ x: e.clientX, y: e.clientY, conn: c }); }}
      style={{
        padding: indent ? '3px 8px 3px 22px' : '3px 8px 3px 10px', color: '#ccc', cursor: 'pointer',
        display: 'flex', alignItems: 'center', gap: 4,
        opacity: dragConn === c.id ? 0.3 : 1,
      }}
      onMouseEnter={(e) => e.currentTarget.style.background = '#3b4261'}
      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
      {multiMode && (
        <span onClick={(e) => { e.stopPropagation(); toggleSelect(c.id); }}
          style={{ flexShrink: 0, display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
          <span style={{
            width: 13, height: 13, borderRadius: 2, display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: '1px solid #3b4261', background: selectedIds.has(c.id) ? '#7aa2f7' : 'rgba(31,35,53,0.5)',
          }}>
            {selectedIds.has(c.id) && <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#1a1b26" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
          </span>
        </span>
      )}
      <span style={{ color: (c as any).color || '#ccc', fontSize: 12, lineHeight: 1 }}>●</span>
      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</span>
      {(c as any).tag && (
        <span onClick={(e) => { e.stopPropagation(); setTagFilter(tagFilter === (c as any).tag ? '' : (c as any).tag); }}
          style={{
            padding: '1px 4px', borderRadius: 4, fontSize: 9, background: tagFilter === (c as any).tag ? '#7aa2f740' : '#333',
            color: tagFilter === (c as any).tag ? '#7aa2f7' : '#888', whiteSpace: 'nowrap', flexShrink: 0,
          }}>{(c as any).tag}</span>
      )}
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
              onBlur={(e) => { handleRenameGroup(g.id, e.currentTarget.value); }}
              autoFocus
              style={{ flex: 1, padding: '2px 6px', background: '#1f2335', border: '1px solid #3b4261', borderRadius: 4, color: '#fff', fontSize: 11 }} />
          </div>
        ) : (
          <div data-sidebar-item
            onClick={() => toggleGroup(g.id)}
            onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); setGroupMenu({ x: e.clientX, y: e.clientY, group: g }); }}
            style={{ padding: '4px 10px', color: '#ccc', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
            {collapsedGroups.has(g.id) ? <Icon name="chevron-right" size={12} /> : <Icon name="chevron-down" size={12} />}
            <Icon name="folder" size={12} /> {g.name}
          </div>
        )}
        {!collapsedGroups.has(g.id) && childConns.map((c) => renderConnItem(c, false, true))}
      </div>
    );
  };

  return (
    <div style={{ width: collapsed ? 0 : width, flexShrink: 0, fontSize: 12, display: 'flex', flexDirection: 'column', background: '#1a1b26', borderRight: '1px solid #3b4261', overflow: 'hidden' }}
      onContextMenu={(e) => {
        if ((e.target as HTMLElement).closest('[data-sidebar-item]')) return;
        e.preventDefault();
        setBlankMenu({ x: e.clientX, y: e.clientY });
      }}>
      <div style={{ height: 36, padding: '0 10px', color: '#c0caf5', fontWeight: 600, borderBottom: '1px solid #3b4261', flexShrink: 0, whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 6, boxSizing: 'border-box' }}>
        {activeModule === 'ssh' ? <Icon name="terminal" size={14} /> : activeModule === 'sftp' ? <Icon name="folder-open" size={14} /> : activeModule === 'database' ? <Icon name="database" size={14} /> : <Icon name="settings" size={14} />}
        <span style={{ flex: 1 }}>{activeModule === 'ssh' ? t('sidebar_ssh') : activeModule === 'sftp' ? t('sidebar_sftp') : activeModule === 'database' ? t('sidebar_database') : t('activity_config')}</span>
        {!collapsed && (
          <span title={t("multi_mode")} onClick={() => { setMultiMode(!multiMode); setSelectedIds(new Set()); }}
            style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
            <span style={{
              width: 13, height: 13, borderRadius: 2, display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: '1px solid #3b4261', background: multiMode ? '#7aa2f7' : 'rgba(31,35,53,0.5)', flexShrink: 0,
            }}>
              {multiMode && <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#1a1b26" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
            </span>
          </span>
        )}
      </div>
      {!collapsed && (<>
        {tagFilter && (
          <div style={{ padding: '0 8px 4px', display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ fontSize: 10, color: '#7aa2f7', background: '#7aa2f720', padding: '1px 6px', borderRadius: 4 }}>
              {t("batch_label")} {tagFilter}
              <span onClick={() => setTagFilter('')} style={{ cursor: 'pointer', marginLeft: 4, color: '#888', display: 'flex', alignItems: 'center' }}><Icon name="x" size={10} /></span>
            </span>
          </div>
        )}
        {selectedIds.size > 0 && (
          <div style={{ padding: '4px 8px', background: '#7aa2f720', display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
            <span style={{ color: '#7aa2f7', fontSize: 11 }}>{t("multi_selected")} {selectedIds.size} {t("multi_items")}</span>
            <CustomSelect value="-1" onChange={(v) => { const n = Number(v); if (n >= 0) handleBatchMove(n); }}
              style={{ background: '#1f2335', border: '1px solid #3b4261', color: '#ccc', borderRadius: 4, padding: '2px 4px', fontSize: 10 }}>
              <option value={-1}>{t("multi_move")}</option>
              <option value={0}>{t("conn_ungrouped")}</option>
              {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </CustomSelect>
            <button onClick={handleBatchDelete} style={{ background: '#d32f2f', border: 'none', color: '#fff', borderRadius: 4, padding: '2px 8px', cursor: 'pointer', fontSize: 10 }}>{t("multi_delete")}</button>
            <button onClick={() => setSelectedIds(new Set())} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: 10, marginLeft: 'auto' }}>{t("multi_cancel")}</button>
          </div>
        )}
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
          <div style={{ borderTop: '1px solid #3b4261', padding: '4px 8px', marginTop: 'auto' }}>
            <div onClick={() => { if (isSsh) { setEditingConn(null); setShowConnForm(true); } else { setEditingDbConn(null); setShowDbForm(true); } }}
            style={{ padding: '4px 8px', color: '#ccc', cursor: 'pointer', fontSize: 11 }}>{t("sidebar_new_conn")}</div>
          {showGroupInput ? (
            <div style={{ display: 'flex', gap: 4, padding: '4px 0' }}>
              <input value={newGroupName} onChange={(e) => setNewGroupName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreateGroup(newGroupName);
                  if (e.key === 'Escape') { setShowGroupInput(false); setNewGroupName(''); }
                }}
                onBlur={() => { setShowGroupInput(false); setNewGroupName(''); }}
                placeholder={t("sidebar_group_name")} autoFocus
                style={{ flex: 1, padding: '2px 6px', background: '#1f2335', border: '1px solid #3b4261', borderRadius: 4, color: '#fff', fontSize: 10 }} />
              <button onClick={() => handleCreateGroup(newGroupName)}
                style={{ background: '#7aa2f7', border: 'none', color: '#1a1b26', fontWeight: 600, borderRadius: 4, padding: '2px 6px', cursor: 'pointer', fontSize: 10 }}>{t("config_create")}</button>
              <button onClick={() => { setShowGroupInput(false); setNewGroupName(''); }}
                style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', padding: '2px 4px', display: 'flex', alignItems: 'center' }}><Icon name="x" size={10} /></button>
            </div>
          ) : (
            <div onClick={() => setShowGroupInput(true)}
              style={{ padding: '4px 8px', color: '#888', cursor: 'pointer', fontSize: 11 }}>{t("sidebar_new_group")}</div>
          )}
        </div>
      )}
      </>)}
      {/* Blank area context menu */}
      {blankMenu && (
        <ContextMenu x={blankMenu.x} y={blankMenu.y} onClose={() => setBlankMenu(null)}
          items={[
            { label: t('sidebar_new_conn'), action: () => {
              if (isDb) { setEditingDbConn(null); setShowDbForm(true); }
              else { setEditingConn(null); setShowConnForm(true); }
              setBlankMenu(null);
            }},
            { label: t('sidebar_new_group'), action: () => { setShowGroupInput(true); setBlankMenu(null); } },
          ]} />
      )}

      {/* Group context menu */}
      {groupMenu && (
        <ContextMenu x={groupMenu.x} y={groupMenu.y} onClose={() => setGroupMenu(null)}
          items={[
            { label: t('sidebar_new_conn_in_group'), action: () => {
              if (isDb) { setEditingDbConn({ group_id: groupMenu.group.id }); setShowDbForm(true); }
              else { setEditingConn({ group_id: groupMenu.group.id }); setShowConnForm(true); }
              setGroupMenu(null);
            }},
            { label: t('menu_rename_group'), action: () => { setEditingGroupId(groupMenu.group.id); setGroupMenu(null); } },
            { label: t('menu_delete_group'), action: () => handleDeleteGroup(groupMenu.group.id) },
          ]} />
      )}

      {/* Connection context menu */}
      {connMenu && (() => {
        const isDbConn = 'database_name' in connMenu.conn;
        const moveItems = groups.map((g) => ({
          label: `  ${g.name}`,
          action: () => handleMoveConn(connMenu.conn.id, g.id),
        }));
        return (
          <ContextMenu x={connMenu.x} y={connMenu.y} onClose={() => setConnMenu(null)}
            items={[
              { label: t('menu_edit'), action: () => {
                if (isDbConn) { setEditingDbConn(connMenu.conn); setShowDbForm(true); }
                else { setEditingConn(connMenu.conn); setShowConnForm(true); }
                setConnMenu(null);
              }},
              ...(!isDbConn ? [{ label: t('menu_copy'), action: () => {
                const c = connMenu.conn;
                setEditingConn({ ...c, id: 0, name: c.name + ' (1)' });
                setShowConnForm(true);
                setConnMenu(null);
              }}] : []),
              ...(isDbConn ? [] : [
                ...(groups.length > 0 ? [{ label: t('menu_move_to'), action: () => {} }, ...moveItems] : []),
              ]),
              { label: t('multi_delete'), action: () => {
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
