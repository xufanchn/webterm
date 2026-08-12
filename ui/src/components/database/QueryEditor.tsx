import { useEffect, useRef, useState } from 'react';
import { EditorView, keymap } from '@codemirror/view';
import { t } from '../../i18n';
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
  const wsRef = useRef<WebSocket | null>(null);
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [result, setResult] = useState<{ columns: string[]; rows: Record<string,any>[]; rowsAffected?: number } | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    setWs(null);
    wsRef.current = null;
    let closed = false;
    let retries = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const token = localStorage.getItem('token') || '';

    const connect = () => {
      const socket = new WebSocket(`${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/ws/db/${connId}?token=${token}`);
      wsRef.current = socket;
      socket.onopen = () => { retries = 0; setWs(socket); };
      socket.onmessage = (e) => {
        const msg = JSON.parse(e.data);
        if (msg.type === 'query_result') {
          setResult(msg.result);
          setError('');
        } else if (msg.type === 'error') {
          setError(msg.error);
        }
      };
      socket.onclose = () => {
        if (wsRef.current === socket) wsRef.current = null;
        setWs((cur) => (cur === socket ? null : cur));
        if (!closed && retries < 3) {
          const delay = Math.min(1000 * Math.pow(2, retries), 8000);
          retries++;
          timer = setTimeout(connect, delay);
        }
      };
      socket.onerror = () => socket.close();
    };
    connect();

    return () => {
      closed = true;
      clearTimeout(timer);
      wsRef.current?.close();
      wsRef.current = null;
    };
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
      if (sqlToRun.trim() && wsRef.current) {
        wsRef.current.send(JSON.stringify({ action: 'query', query: sqlToRun }));
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
      doc: t('db_hint'),
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
  }, []);

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
      <div style={{ width: 200, background: '#252526', borderRight: '1px solid #3b4261', flexShrink: 0 }}>
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
          <div style={{ flex: 1, minHeight: 0, overflow: 'auto', borderTop: '1px solid #3b4261' }}>
            <ResultTable columns={result.columns} rows={result.rows} rowsAffected={result.rowsAffected} onExportCSV={exportCSV} />
          </div>
        )}
      </div>
    </div>
  );
}
