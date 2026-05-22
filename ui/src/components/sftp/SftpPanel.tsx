import { useEffect, useState, useCallback } from 'react';
import FileList from './FileList';
import FileEditor from '../common/FileEditor';

export interface SftpFile {
  name: string;
  path: string;
  size: number;
  mode: number;
  mod_time: string;
  is_dir: boolean;
  is_link: boolean;
  link_to?: string;
}

interface Props {
  connId: number;
  currentPath?: string;
  onPathChange?: (path: string) => void;
  style?: React.CSSProperties;
}

export default function SftpPanel({ connId, currentPath, onPathChange, style }: Props) {
  const [path, setPath] = useState(currentPath || '/');
  const [files, setFiles] = useState<SftpFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [editFile, setEditFile] = useState<{ path: string; name: string } | null>(null);
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  const uploadFile = (file: File) => {
    const token = localStorage.getItem('token') || '';
    const formData = new FormData();
    formData.append('file', file);
    formData.append('conn_id', String(connId));
    formData.append('path', path + '/' + file.name);
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/sftp/upload');
    xhr.setRequestHeader('Authorization', 'Bearer ' + token);
    xhr.onload = () => fetchDir(path);
    xhr.send(formData);
  };

  const fetchDir = useCallback((dirPath: string) => {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    setLoading(true);
    setError('');
    ws.send(JSON.stringify({ action: 'list', path: dirPath }));
  }, [ws]);

  useEffect(() => {
    const token = localStorage.getItem('token') || '';
    const wsUrl = `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/ws/sftp/${connId}?token=${token}`;
    const socket = new WebSocket(wsUrl);
    setWs(socket);

    socket.onopen = () => fetchDir(path);
    socket.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'file_list') {
          setFiles(msg.files || []);
          setPath(msg.path || path);
          setLoading(false);
        } else if (msg.type === 'error') {
          setError(msg.error);
          setLoading(false);
        } else if (msg.type === 'pwd') {
          setPath(msg.path);
          fetchDir(msg.path);
        } else if (msg.type === 'delete_done' || msg.type === 'mkdir_done' || msg.type === 'rename_done') {
          fetchDir(path);
        }
      } catch {}
    };

    return () => { socket.close(); };
  }, [connId]);

  // Follow currentPath changes from parent (SSH terminal)
  useEffect(() => {
    if (currentPath && currentPath !== path) {
      setPath(currentPath);
      fetchDir(currentPath);
    }
  }, [currentPath]);

  const handleNavigate = (newPath: string) => {
    setPath(newPath);
    fetchDir(newPath);
    onPathChange?.(newPath);
  };

  const handleDelete = (filePath: string) => {
    if (ws) ws.send(JSON.stringify({ action: 'delete', path: filePath }));
  };

  const handleRename = (filePath: string, newName: string) => {
    const dir = filePath.substring(0, filePath.lastIndexOf('/') + 1);
    if (ws) ws.send(JSON.stringify({ action: 'rename', path: filePath, new_path: dir + newName }));
  };

  const handleMkdir = (name: string) => {
    if (ws) ws.send(JSON.stringify({ action: 'mkdir', path: path + '/' + name }));
  };

  const handleEditFile = (filePath: string, fileName: string) => {
    setEditFile({ path: filePath, name: fileName });
  };

  return (
    <div style={{ background: '#252526', fontSize: 11, display: 'flex', flexDirection: 'column', height: '100%', ...style }}>
      {/* XFTP-style address bar */}
      <div style={{ padding: '4px 6px', background: '#2d2d2d', display: 'flex', gap: 4, alignItems: 'center', borderBottom: '1px solid #383838', flexShrink: 0 }}>
        <button onClick={() => handleNavigate('..')} title="上级目录"
          style={{ background: 'none', border: 'none', color: '#ccc', cursor: 'pointer', fontSize: 14, padding: '0 4px' }}>⟰</button>
        <input value={path} onChange={(e) => setPath(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') fetchDir(path); }}
          style={{ flex: 1, padding: '3px 8px', background: '#3c3c3c', border: '1px solid #555', borderRadius: 3, color: '#fff', fontSize: 11, fontFamily: 'Consolas, monospace' }} />
        <button onClick={() => fetchDir(path)} title="刷新"
          style={{ background: 'none', border: 'none', color: '#4fc3f7', cursor: 'pointer', fontSize: 12 }}>⟳</button>
      </div>
      {/* XFTP-style toolbar */}
      <div style={{ display: 'flex', gap: 2, padding: '2px 4px', background: '#2d2d2d', borderBottom: '1px solid #383838', flexShrink: 0 }}>
        <ToolBtn title="上传" onClick={() => {
          const input = document.createElement('input');
          input.type = 'file'; input.multiple = true;
          input.onchange = (e) => {
            const files = (e.target as HTMLInputElement).files;
            if (files) { for (let i = 0; i < files.length; i++) uploadFile(files[i]); }
          };
          input.click();
        }}>⬆</ToolBtn>
        <ToolBtn title="新建文件夹" onClick={() => setShowNewFolder(true)}>📁+</ToolBtn>
        <span style={{ flex: 1 }} />
        <span style={{ color: '#888', fontSize: 10, padding: '2px 6px', alignSelf: 'center' }}>{files.length} 项</span>
      </div>
      {/* New folder inline input */}
      {showNewFolder && (
        <div style={{ display: 'flex', gap: 4, padding: '4px 8px', background: '#333' }}>
          <input value={newFolderName} onChange={(e) => setNewFolderName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { handleMkdir(newFolderName); setNewFolderName(''); setShowNewFolder(false); }
              if (e.key === 'Escape') { setNewFolderName(''); setShowNewFolder(false); }
            }}
            autoFocus placeholder="文件夹名称"
            style={{ flex: 1, padding: '3px 8px', background: '#3c3c3c', border: '1px solid #555', borderRadius: 3, color: '#fff', fontSize: 11 }} />
          <button onClick={() => { handleMkdir(newFolderName); setNewFolderName(''); setShowNewFolder(false); }}
            style={{ background: '#007acc', border: 'none', color: '#fff', borderRadius: 3, padding: '3px 10px', cursor: 'pointer', fontSize: 11 }}>创建</button>
          <button onClick={() => { setNewFolderName(''); setShowNewFolder(false); }}
            style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: 11 }}>✕</button>
        </div>
      )}
      {error && <div style={{ padding: '4px 8px', color: '#f44747', fontSize: 10 }}>{error}</div>}
      <FileList
        files={files}
        loading={loading}
        onNavigate={handleNavigate}
        onDelete={handleDelete}
        onRename={handleRename}
        connId={connId}
        currentPath={path}
        onUpload={() => fetchDir(path)}
        onEdit={handleEditFile}
        onMkdir={(name) => handleMkdir(name)}
      />
      {editFile && (
        <FileEditor
          filePath={editFile.path}
          fileName={editFile.name}
          ws={ws}
          onClose={() => setEditFile(null)}
          onSaved={() => fetchDir(path)}
        />
      )}
    </div>
  );
}

function ToolBtn({ title, onClick, children }: { title: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} title={title}
      style={{ background: 'none', border: '1px solid transparent', color: '#ccc', cursor: 'pointer', fontSize: 12, padding: '2px 6px', borderRadius: 3 }}
      onMouseEnter={(e) => { e.currentTarget.style.background = '#444'; e.currentTarget.style.borderColor = '#555'; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; e.currentTarget.style.borderColor = 'transparent'; }}>
      {children}
    </button>
  );
}
