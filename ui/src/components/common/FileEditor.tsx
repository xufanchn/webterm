import { useEffect, useRef, useState } from 'react';
import { EditorView, keymap } from '@codemirror/view';
import { t } from '../../i18n';
import { defaultKeymap } from '@codemirror/commands';
import { basicSetup } from 'codemirror';
import { sql } from '@codemirror/lang-sql';
import { json } from '@codemirror/lang-json';
import { javascript } from '@codemirror/lang-javascript';
import { python } from '@codemirror/lang-python';
import Modal from './Modal';

interface Props {
  filePath: string;
  fileName: string;
  ws: WebSocket | null;
  onClose: () => void;
  onSaved: () => void;
}

function detectLanguage(fileName: string): any {
  const ext = fileName.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'sql': return sql();
    case 'json': return json();
    case 'js': case 'ts': case 'jsx': case 'tsx': return javascript();
    case 'py': return python();
    case 'yaml': case 'yml':
    case 'sh': case 'bash':
    case 'conf': case 'ini': case 'cfg':
    case 'xml': case 'html': case 'css':
    default: return []; // plain text
  }
}

export default function FileEditor({ filePath, fileName, ws, onClose, onSaved }: Props) {
  const editorRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [backup, setBackup] = useState(true);
  const origContentRef = useRef('');
  const saveHandlerRef = useRef<() => void>(() => {});

  // Read file from remote
  useEffect(() => {
    if (!ws) return;
    ws.send(JSON.stringify({ action: 'read', path: filePath }));

    const handler = (e: MessageEvent) => {
      const msg = JSON.parse(e.data);
      if (msg.type === 'file_content' && msg.path === filePath) {
        setContent(msg.content || '');
        origContentRef.current = msg.content || '';
        setLoading(false);
        ws.removeEventListener('message', handler);
      } else if (msg.type === 'error') {
        setError(msg.error);
        setLoading(false);
        ws.removeEventListener('message', handler);
      }
    };
    ws.addEventListener('message', handler);

    return () => ws.removeEventListener('message', handler);
  }, [filePath, ws]);

  // Create CodeMirror editor
  useEffect(() => {
    if (loading || !editorRef.current) return;

    const lang = detectLanguage(fileName);

    const extensions: any[] = [
      basicSetup,
      keymap.of([
        ...defaultKeymap,
        { key: 'Ctrl-s', run: () => { saveHandlerRef.current(); return true; } },
      ]),
      EditorView.theme({
        '&': { height: '100%' },
        '.cm-scroller': { overflow: 'auto' },
        '.cm-content': { fontFamily: 'Menlo, Monaco, monospace', fontSize: '15px' },
        '.cm-gutters': { background: '#1e1e1e', color: '#888', border: 'none' },
      }, { dark: true }),
    ];

    if (Array.isArray(lang)) {
      extensions.push(...lang);
    } else if (lang) {
      extensions.push(lang);
    }

    const view = new EditorView({
      doc: content,
      extensions,
      parent: editorRef.current,
    });

    viewRef.current = view;

    return () => view.destroy();
  }, [loading]);

  const handleSave = () => {
    if (!ws || !viewRef.current) return;
    const text = viewRef.current.state.doc.toString();
    const bakPath = filePath + '.bak';
    setSaving(true);
    setError('');

    const handler = (e: MessageEvent) => {
      const msg = JSON.parse(e.data);
      if (msg.type === 'write_done' && msg.path === filePath) {
        setSaving(false);
        onSaved();
        onClose();
        ws.removeEventListener('message', handler);
      } else if (msg.type === 'error') {
        setError(msg.error);
        setSaving(false);
        ws.removeEventListener('message', handler);
      } else if (backup && msg.type === 'write_done' && msg.path === bakPath) {
        ws.send(JSON.stringify({ action: 'write', path: filePath, content: text }));
      }
    };
    ws.addEventListener('message', handler);

    if (backup) {
      ws.send(JSON.stringify({ action: 'write', path: bakPath, content: origContentRef.current }));
    } else {
      ws.send(JSON.stringify({ action: 'write', path: filePath, content: text }));
    }
  };

  // Keep saveHandlerRef up to date
  saveHandlerRef.current = handleSave;

  return (
    <Modal title={`${t('file_edit')}: ${fileName}`} onClose={onClose} width={800} height={600}>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        {loading && <div style={{ padding: 16, color: '#888' }}>{t("file_loading")}</div>}
        {error && (
          <div style={{ padding: '6px 12px', color: '#f44747', background: '#2d1b1b', fontSize: 14 }}>{error}</div>
        )}
        <div ref={editorRef} style={{ flex: 1, minHeight: 0 }} />
        <div style={{
          padding: '8px 16px', background: '#333', display: 'flex',
          justifyContent: 'space-between', alignItems: 'center',
        }}>
          <span style={{ color: '#888', fontSize: 13, display: 'flex', alignItems: 'center', gap: 10 }}>
            <span>{filePath} — Ctrl+S {t("conn_save")}</span>
            <label style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
              <input type="checkbox" checked={backup} onChange={(e) => setBackup(e.target.checked)} />
              {t('file_bak')}
            </label>
          </span>
          <button onClick={handleSave} disabled={saving} style={{
            background: saving ? '#3b4261' : '#007acc', border: 'none',
            color: '#fff', padding: '6px 16px', borderRadius: 4, cursor: 'pointer', fontSize: 14,
          }}>
            {saving ? t('conn_saving') : t('conn_save')}
          </button>
        </div>
      </div>
    </Modal>
  );
}
