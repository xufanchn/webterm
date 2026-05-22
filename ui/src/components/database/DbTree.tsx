import { useState } from 'react';

interface Props {
  ws: WebSocket | null;
  onQuery: (sql: string) => void;
}

export default function DbTree({ ws, onQuery }: Props) {
  const [dbs, setDbs] = useState<string[]>([]);
  const [tables, setTables] = useState<Record<string, string[]>>({});
  const [expandedDb, setExpandedDb] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchDbs = () => {
    if (!ws) return;
    setLoading(true);
    ws.send(JSON.stringify({ action: 'databases' }));
    const handler = (e: MessageEvent) => {
      const msg = JSON.parse(e.data);
      if (msg.type === 'database_list') {
        setDbs(msg.databases || []);
        setLoading(false);
        ws.removeEventListener('message', handler);
      }
    };
    ws.addEventListener('message', handler);
  };

  const fetchTables = (db: string) => {
    if (!ws) return;
    if (expandedDb === db) { setExpandedDb(null); return; }
    setExpandedDb(db);
    ws.send(JSON.stringify({ action: 'tables', database: db }));
    const handler = (e: MessageEvent) => {
      const msg = JSON.parse(e.data);
      if (msg.type === 'table_list' && msg.database === db) {
        setTables((prev) => ({ ...prev, [db]: msg.tables || [] }));
        ws.removeEventListener('message', handler);
      }
    };
    ws.addEventListener('message', handler);
  };

  const handleTableDblClick = (_db: string, table: string) => {
    onQuery(`SELECT * FROM \`${_db}\`.\`${table}\` LIMIT 100`);
  };

  return (
    <div style={{ fontSize: 11, overflow: 'auto', height: '100%' }}>
      <div style={{ padding: '4px 8px', cursor: 'pointer', color: '#4fc3f7' }} onClick={fetchDbs}>
        {loading ? '加载中...' : '🔄 刷新数据库列表'}
      </div>
      {dbs.map((db) => (
        <div key={db}>
          <div onClick={() => fetchTables(db)} style={{ padding: '3px 8px', cursor: 'pointer', color: '#ccc', display: 'flex', alignItems: 'center', gap: 4 }}>
            <span>{expandedDb === db ? '▼' : '▶'}</span> 🗄 {db}
          </div>
          {expandedDb === db && (tables[db] || []).map((table) => (
            <div key={table} onDoubleClick={() => handleTableDblClick(db, table)}
              style={{ padding: '2px 8px 2px 28px', cursor: 'pointer', color: '#888' }}>
              📋 {table}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
