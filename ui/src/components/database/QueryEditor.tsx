import { useEffect, useRef, useState } from 'react';
import { EditorView, keymap } from '@codemirror/view';
import { sql, MySQL } from '@codemirror/lang-sql';
import { basicSetup } from 'codemirror';
import { format } from 'sql-formatter';
import ResultTable from './ResultTable';
import DbTree from './DbTree';

interface Props {
  connId: number;
}

export default function QueryEditor({ connId }: Props) {
  const editorRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [result, setResult] = useState<{ columns: string[]; rows: Record<string,any>[]; rowsAffected?: number } | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('token') || '';
    const socket = new WebSocket(`${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/ws/db/${connId}?token=${token}`);
    socket.onopen = () => setWs(socket);
    socket.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.type === 'query_result') {
        setResult(msg.result);
        setError('');
      } else if (msg.type === 'error') {
        setError(msg.error);
      }
    };
    return () => socket.close();
  }, [connId]);

  useEffect(() => {
    if (!editorRef.current) return;
    const executeQuery = () => {
      const query = viewRef.current?.state.doc.toString() || '';
      const selection = viewRef.current?.state.sliceDoc(
        viewRef.current.state.selection.main.from,
        viewRef.current.state.selection.main.to
      );
      const sqlToRun = selection || query;
      if (sqlToRun.trim() && ws) {
        ws.send(JSON.stringify({ action: 'query', query: sqlToRun }));
      }
    };

    const formatSql = () => {
      const doc = viewRef.current?.state.doc.toString() || '';
      try {
        const formatted = format(doc, { language: 'mysql' });
        viewRef.current?.dispatch({
          changes: { from: 0, to: doc.length, insert: formatted }
        });
      } catch {
        // ignore format errors
      }
    };

    const view = new EditorView({
      doc: '-- Ctrl+Enter 执行 SQL\n-- Ctrl+Shift+F 格式化\n',
      extensions: [
        basicSetup,
        sql({ dialect: MySQL }),
        keymap.of([
          { key: 'Ctrl-Enter', run: () => { executeQuery(); return true; } },
          { key: 'Ctrl-Shift-f', run: () => { formatSql(); return true; } },
        ]),
        EditorView.theme({
          '&': { height: '100%' },
          '.cm-scroller': { overflow: 'auto' },
          '.cm-content': { fontFamily: 'Menlo, Monaco, monospace', fontSize: '13px' },
          '.cm-gutters': { background: '#1e1e1e', color: '#888', border: 'none' },
        }, { dark: true }),
      ],
      parent: editorRef.current,
    });
    viewRef.current = view;

    return () => view.destroy();
  }, [ws]);

  const exportCSV = () => {
    if (!result || !result.columns.length) return;
    const header = result.columns.join(',');
    const body = result.rows.map((row) =>
      result.columns.map((col) => {
        const val = row[col];
        if (val === null) return '';
        const str = String(val);
        return str.includes(',') || str.includes('"') ? `"${str.replace(/"/g, '""')}"` : str;
      }).join(',')
    ).join('\n');
    const blob = new Blob([header + '\n' + body], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'query_result.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ display: 'flex', height: '100%' }}>
      <div style={{ width: 200, background: '#252526', borderRight: '1px solid #383838', flexShrink: 0 }}>
        <DbTree ws={ws} onQuery={(sql) => {
          if (viewRef.current) {
            viewRef.current.dispatch({
              changes: { from: 0, to: viewRef.current.state.doc.length, insert: sql }
            });
          }
        }} />
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <div style={{ flex: 1, minHeight: 0 }} ref={editorRef} />
        {error && <div style={{ padding: '8px 12px', color: '#f44747', fontSize: 12, background: '#2d1b1b' }}>{error}</div>}
        {result && (
          <div style={{ flex: 1, minHeight: 0, overflow: 'auto', borderTop: '1px solid #444' }}>
            <ResultTable columns={result.columns} rows={result.rows} rowsAffected={result.rowsAffected} onExportCSV={exportCSV} />
          </div>
        )}
      </div>
    </div>
  );
}
