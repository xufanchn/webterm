import { useEffect, useState, useCallback } from 'react';
import FileList from './FileList';

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

  return (
    <div style={{ background: '#252526', fontSize: 11, display: 'flex', flexDirection: 'column', height: '100%', ...style }}>
      <div style={{ padding: '4px 8px', background: '#333', color: '#888', fontSize: 10, display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>◧ {path}</span>
        <button onClick={() => handleNavigate('..')} style={{ background: 'none', border: 'none', color: '#ccc', cursor: 'pointer', fontSize: 10 }}>⟰</button>
      </div>
      {error && <div style={{ padding: '4px 8px', color: '#f44747', fontSize: 10 }}>{error}</div>}
      <FileList
        files={files}
        loading={loading}
        onNavigate={handleNavigate}
        onDelete={handleDelete}
        onRename={handleRename}
        onMkdir={handleMkdir}
      />
    </div>
  );
}
