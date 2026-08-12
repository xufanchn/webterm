import { useMemo, useState } from 'react';
import { t } from '../../i18n';

interface Props {
  columns: string[];
  rows: Record<string, any>[];
  rowsAffected?: number;
  onExportCSV: () => void;
}

const PAGE_SIZE = 100;

export default function ResultTable({ columns, rows, rowsAffected, onExportCSV }: Props) {
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(0);

  const sortedRows = useMemo(() => {
    if (!sortCol) return rows;
    const dir = sortDir === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => {
      const va = a[sortCol];
      const vb = b[sortCol];
      if (va === vb) return 0;
      if (va === null || va === undefined) return 1;
      if (vb === null || vb === undefined) return -1;
      if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * dir;
      return String(va).localeCompare(String(vb)) * dir;
    });
  }, [rows, sortCol, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sortedRows.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const pageRows = sortedRows.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

  const toggleSort = (col: string) => {
    if (sortCol === col) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortCol(col); setSortDir('asc'); }
    setPage(0);
  };

  if (columns.length === 0 && rowsAffected !== undefined) {
    return (
      <div style={{ padding: 12, color: '#ccc', fontSize: 14 }}>
        查询成功:{t("db_affected")} {rowsAffected}
      </div>
    );
  }

  const btnStyle = { background: '#3b4261', border: 'none', color: '#fff', padding: '2px 10px', borderRadius: 3, cursor: 'pointer', fontSize: 12 };
  const btnDisabled = { ...btnStyle, opacity: 0.4, cursor: 'default' };

  return (
    <div style={{ fontSize: 13, overflow: 'auto', height: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 8px', background: '#333', alignItems: 'center' }}>
        <span style={{ color: '#ccc' }}>{rows.length} {t("db_rows")} {columns.length} {t("db_cols")}</span>
        <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={safePage === 0}
            style={safePage === 0 ? btnDisabled : btnStyle}>{t("db_prev")}</button>
          <span style={{ color: '#ccc', fontSize: 13 }}>{safePage + 1}/{totalPages}</span>
          <button onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={safePage >= totalPages - 1}
            style={safePage >= totalPages - 1 ? btnDisabled : btnStyle}>{t("db_next")}</button>
          <button onClick={onExportCSV} style={{
            background: '#007acc', border: 'none', color: '#fff', padding: '2px 10px', borderRadius: 3, cursor: 'pointer', fontSize: 12,
          }}>{t("db_export")}</button>
        </span>
      </div>
      <div style={{ overflow: 'auto', maxHeight: '300px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr>
              {columns.map((col) => (
                <th key={col} onClick={() => toggleSort(col)} style={{
                  padding: '4px 8px', background: '#2d2d2d', color: '#7aa2f7',
                  borderBottom: '1px solid #3b4261', textAlign: 'left', whiteSpace: 'nowrap',
                  position: 'sticky', top: 0, zIndex: 1, cursor: 'pointer', userSelect: 'none',
                }}>{col}{sortCol === col ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ''}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageRows.map((row, i) => (
              <tr key={i} style={{ background: i % 2 === 0 ? '#1e1e1e' : '#252526' }}>
                {columns.map((col) => (
                  <td key={col} style={{
                    padding: '2px 8px', color: '#ccc', borderBottom: '1px solid #333',
                    whiteSpace: 'nowrap', maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>
                    {row[col] === null ? <span style={{ color: '#888' }}>NULL</span> : String(row[col])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
