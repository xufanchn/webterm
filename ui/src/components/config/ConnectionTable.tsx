import { useState, useEffect } from 'react';
import { apiGet, apiDelete } from '../../api/client';
import ConnectionForm from './ConnectionForm';
import DbConnectionForm from './DbConnectionForm';

interface Column {
  key: string;
  label: string;
  width: string;
  render?: (v: any) => string;
}

interface Props {
  type: 'ssh' | 'db';
  title: string;
  apiPrefix: string;
  groupType: string;
  columns: Column[];
}

export default function ConnectionTable({ type, title, apiPrefix, groupType, columns }: Props) {
  const [items, setItems] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [data, groupData] = await Promise.all([
        apiGet(apiPrefix),
        apiGet(`/api/groups?type=${groupType}`),
      ]);
      setItems(data || []);
      setGroups(groupData || []);
    } catch {
      setError('加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleDelete = async (id: number) => {
    if (!confirm('确定删除？')) return;
    try {
      await apiDelete(`${apiPrefix}/${id}`);
      fetchData();
    } catch {
      setError('删除失败');
    }
  };

  const groupMap: Record<number, string> = {};
  groups.forEach((g: any) => { groupMap[g.id] = g.name; });

  if (loading) return <div style={{ padding: 24, color: '#888' }}>加载中...</div>;

  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h3 style={{ color: '#fff', margin: 0, fontSize: 16 }}>{title} <span style={{ color: '#888', fontSize: 12, fontWeight: 400 }}>共 {items.length} 项</span></h3>
        <button onClick={() => { setEditingItem(null); setShowForm(true); }}
          style={{ padding: '6px 16px', background: '#007acc', border: 'none', color: '#fff', borderRadius: 4, cursor: 'pointer', fontSize: 12 }}>
          + 新建{type === 'ssh' ? 'SSH' : '数据库'}连接
        </button>
      </div>

      {error && <div style={{ color: '#f44747', fontSize: 12, padding: '6px 10px', background: '#2d1b1b', borderRadius: 4, marginBottom: 12 }}>{error}</div>}

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr style={{ background: '#2d2d2d' }}>
            {columns.map((col) => (
              <th key={col.key} style={{ padding: '8px 12px', textAlign: 'left', color: '#4fc3f7', borderBottom: '1px solid #444', width: col.width }}>{col.label}</th>
            ))}
            <th style={{ padding: '8px 12px', textAlign: 'center', color: '#4fc3f7', borderBottom: '1px solid #444', width: '120px' }}>操作</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item: any, i: number) => (
            <tr key={item.id} style={{ background: i % 2 === 0 ? '#1e1e1e' : '#252526' }}
              onDoubleClick={() => { setEditingItem(item); setShowForm(true); }}>
              {columns.map((col) => (
                <td key={col.key} style={{ padding: '6px 12px', color: '#ccc', borderBottom: '1px solid #333' }}>
                  {col.render ? col.render(item[col.key]) : String(item[col.key] ?? '')}
                </td>
              ))}
              <td style={{ padding: '6px 12px', borderBottom: '1px solid #333', textAlign: 'center' }}>
                <button onClick={() => { setEditingItem(item); setShowForm(true); }}
                  style={{ background: 'none', border: 'none', color: '#4fc3f7', cursor: 'pointer', fontSize: 11, marginRight: 8 }}>编辑</button>
                <button onClick={() => handleDelete(item.id)}
                  style={{ background: 'none', border: 'none', color: '#f44747', cursor: 'pointer', fontSize: 11 }}>删除</button>
              </td>
            </tr>
          ))}
          {items.length === 0 && (
            <tr><td colSpan={columns.length + 1} style={{ padding: 24, textAlign: 'center', color: '#666' }}>暂无数据，点击上方按钮新建</td></tr>
          )}
        </tbody>
      </table>

      {showForm && type === 'ssh' && (
        <ConnectionForm connection={editingItem} onClose={() => { setShowForm(false); setEditingItem(null); }} onSaved={fetchData} />
      )}
      {showForm && type === 'db' && (
        <DbConnectionForm connection={editingItem} onClose={() => { setShowForm(false); setEditingItem(null); }} onSaved={fetchData} />
      )}
    </div>
  );
}
