import { t } from '../../i18n';

interface Props {
  columns: string[];
  rows: Record<string, any>[];
  rowsAffected?: number;
  onExportCSV: () => void;
}

export default function ResultTable({ columns, rows, rowsAffected, onExportCSV }: Props) {
  if (columns.length === 0 && rowsAffected !== undefined) {
    return (
      <div style={{ padding: 12, color: '#ccc', fontSize: 12 }}>
        查询成功:{t("db_affected")} {rowsAffected}
      </div>
    );
  }

  return (
    <div style={{ fontSize: 11, overflow: 'auto', height: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 8px', background: '#333', alignItems: 'center' }}>
        <span style={{ color: '#ccc' }}>{rows.length} {t("db_rows")} {columns.length} {t("db_cols")}</span>
        <button onClick={onExportCSV} style={{
          background: '#007acc', border: 'none', color: '#fff', padding: '2px 10px', borderRadius: 3, cursor: 'pointer', fontSize: 10
        }}>{t("db_export")}</button>
      </div>
      <div style={{ overflow: 'auto', maxHeight: '300px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
          <thead>
            <tr>
              {columns.map((col) => (
                <th key={col} style={{
                  padding: '4px 8px', background: '#2d2d2d', color: '#7aa2f7',
                  borderBottom: '1px solid #3b4261', textAlign: 'left', whiteSpace: 'nowrap',
                  position: 'sticky', top: 0, zIndex: 1,
                }}>{col}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
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
