import { t } from '../../i18n';
import { useState, useEffect } from 'react';
import { apiGet, apiDelete } from '../../api/client';
import { useAuthStore } from '../../store/auth';
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

  const token = useAuthStore((s) => s.token);

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
      setError(t('config_load_failed'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (token) fetchData(); }, [token]);

  const handleDelete = async (id: number) => {
    if (!confirm(t('config_confirm_delete_conn'))) return;
    try {
      await apiDelete(`${apiPrefix}/${id}`);
      fetchData();
    } catch {
      setError(t('config_delete_failed'));
    }
  };

  const groupMap: Record<number, string> = {};
  groups.forEach((g: any) => { groupMap[g.id] = g.name; });

  if (loading) return <div style={{ padding: 24, color: '#565f89' }}>{t("file_loading")}</div>;

  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h3 style={{ color: '#ccc', margin: 0, fontSize: 18 }}>{title} <span style={{ color: '#565f89', fontSize: 14, fontWeight: 400 }}>{t("config_total")} {items.length} {t("config_items")}</span></h3>
        <button onClick={() => { setEditingItem(null); setShowForm(true); }}
          style={{ padding: '6px 16px', background: '#7aa2f7', border: 'none', color: '#1a1b26', borderRadius: 4, cursor: 'pointer', fontSize: 14 }}>
          {t("config_create")}{type === 'ssh' ? 'SSH' : t("config_database")}{t("config_conn")}
        </button>
      </div>

      {error && <div style={{ color: '#f44747', fontSize: 14, padding: '6px 10px', background: '#2d1b1b', borderRadius: 4, marginBottom: 12 }}>{error}</div>}

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
        <thead>
          <tr style={{ background: '#1a1b26' }}>
            {columns.map((col) => (
              <th key={col.key} style={{ padding: '8px 12px', textAlign: 'left', color: '#7aa2f7', borderBottom: '1px solid #3b4261', width: col.width }}>{col.label}</th>
            ))}
            <th style={{ padding: '8px 12px', textAlign: 'center', color: '#7aa2f7', borderBottom: '1px solid #3b4261', width: '120px' }}>{t("config_actions")}</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item: any, i: number) => (
            <tr key={item.id} style={{ background: i % 2 === 0 ? '#1a1b26' : '#1f2335' }}
              onDoubleClick={() => { setEditingItem(item); setShowForm(true); }}>
              {columns.map((col) => (
                <td key={col.key} style={{ padding: '6px 12px', color: '#ccc', borderBottom: '1px solid #3b4261' }}>
                  {col.render ? col.render(item[col.key]) : String(item[col.key] ?? '')}
                </td>
              ))}
              <td style={{ padding: '6px 12px', borderBottom: '1px solid #3b4261', textAlign: 'center' }}>
                <button onClick={() => { setEditingItem(item); setShowForm(true); }}
                  style={{ background: 'none', border: 'none', color: '#7aa2f7', cursor: 'pointer', fontSize: 13, marginRight: 8 }}>{t("menu_edit")}</button>
                <button onClick={() => handleDelete(item.id)}
                  style={{ background: 'none', border: 'none', color: '#f44747', cursor: 'pointer', fontSize: 13 }}>{t("menu_delete")}</button>
              </td>
            </tr>
          ))}
          {items.length === 0 && (
            <tr><td colSpan={columns.length + 1} style={{ padding: 24, textAlign: 'center', color: '#565f89' }}>{t("config_no_data")}</td></tr>
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
