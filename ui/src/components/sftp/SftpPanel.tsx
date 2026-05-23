import { useEffect, useState, useCallback, useRef } from 'react';
import FileList from './FileList';
import FileEditor from '../common/FileEditor';
import { useLayoutStore } from '../../store/layout';

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
  connId?: number;
  tabId?: string;
  localMode?: boolean;
  currentPath?: string;
  onPathChange?: (path: string) => void;
  style?: React.CSSProperties;
  showFollowButton?: boolean;
}

export default function SftpPanel({ connId, tabId, localMode, currentPath, onPathChange, style, showFollowButton }: Props) {
  const defaultPath = currentPath || (localMode ? '/home' : '/');
  const [path, setPath] = useState(defaultPath);
  const [files, setFiles] = useState<SftpFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [disconnected, setDisconnected] = useState(false);
  const [reconnectKey, setReconnectKey] = useState(0);
  const [followCd, setFollowCd] = useState(true);
  const [editFile, setEditFile] = useState<{ path: string; name: string } | null>(null);
  const sessionKey = tabId || String(connId);
  const cacheRef = useRef<Map<string, { path: string; files: SftpFile[] }>>(new Map());
  const navRef = useRef({ history: [defaultPath], index: 0 });
  const [, setNavTick] = useState(0);


  const wsRef = useRef<WebSocket | null>(null);
  const pathRef = useRef(path);
  pathRef.current = path;
  const prevKeyRef = useRef(sessionKey);

  // Save cache for old session before switching to new one
  if (prevKeyRef.current !== sessionKey) {
    if (prevKeyRef.current != null) {
      cacheRef.current.set(prevKeyRef.current, { path: pathRef.current, files });
    }
    prevKeyRef.current = sessionKey;
  }

  const fetchDir = useCallback((dirPath: string, force = false) => {
    const socket = wsRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) return;
    if (!force && dirPath === pathRef.current) return; // same dir, skip
    setLoading(true);
    setError('');
    socket.send(JSON.stringify({ action: 'list', path: dirPath }));
  }, []);

  useEffect(() => {
    if (connId == null) return;
    setDisconnected(false);

    // Restore cached state for this session; prefer OSC 7 tracked path
    const cached = cacheRef.current.get(sessionKey);
    const cdPaths = useLayoutStore.getState().sftpCdPaths;
    const trackedPath = tabId ? cdPaths[tabId] : undefined;
    const initPath = trackedPath || cached?.path || defaultPath;
    if (cached) {
      setFiles(cached.files);
    } else if (prevKeyRef.current == null) {
      setFiles([]);
    }
    setPath(initPath);
    setLoading(!cached);
    setError('');

    const token = localStorage.getItem('token') || '';
    const wsUrl = localMode
      ? `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/ws/local-fs?token=${token}`
      : `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/ws/sftp/${connId}?token=${token}`;
    const socket = new WebSocket(wsUrl);
    wsRef.current = socket;
    setWs(socket);

    socket.onopen = () => {
      setDisconnected(false);
      if (cached) {
        // Already have cached data, just refresh
        socket.send(JSON.stringify({ action: 'list', path: cached.path }));
      } else {
        socket.send(JSON.stringify({ action: 'getwd' }));
      }
    };
    socket.onclose = () => {
      setDisconnected(true);
      setLoading(false);
    };
    socket.onerror = () => {
      socket.close();
    };
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
          fetchDir(pathRef.current, true);
        }
      } catch {}
    };

    return () => { socket.close(); };
  }, [connId, reconnectKey]); // only reconnect on connId change, not tabId

  // When tabId changes within same connId, refresh without reconnecting
  const tabInitRef = useRef(false);
  useEffect(() => {
    if (!tabInitRef.current) { tabInitRef.current = true; return; }
    const socket = wsRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) return;
    const cached = cacheRef.current.get(sessionKey);
    if (cached) {
      fetchDir(cached.path);
    } else {
      socket.send(JSON.stringify({ action: 'getwd' }));
    }
  }, [tabId]);

  // Follow currentPath changes from parent (SSH terminal)
  useEffect(() => {
    if (currentPath && currentPath !== path) {
      setPath(currentPath);
      fetchDir(currentPath);
    }
  }, [currentPath]);

  // Follow SSH disconnect signal (only act if currently connected)
  const sftpDisconnectSignal = useLayoutStore((s) => s.sftpDisconnectSignal);
  const prevSignalRef = useRef(0);
  useEffect(() => {
    if (sftpDisconnectSignal > prevSignalRef.current && !disconnected) {
      setDisconnected(true);
      setLoading(false);
    }
    prevSignalRef.current = sftpDisconnectSignal;
  }, [sftpDisconnectSignal]);

  // Follow SSH shell cd via OSC 7 (per-tab paths)
  const sftpCdPaths = useLayoutStore((s) => s.sftpCdPaths);
  const cdPath = tabId ? sftpCdPaths[tabId] : undefined;
  useEffect(() => {
    if (!followCd || !cdPath || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    if (cdPath === path) return; // already there
    setPath(cdPath);
    fetchDir(cdPath);
  }, [followCd, cdPath]);

  const navigateTo = useCallback((newPath: string, pushHistory = true) => {
    setPath(newPath);
    fetchDir(newPath);
    onPathChange?.(newPath);
    if (pushHistory) {
      const nav = navRef.current;
      const next = nav.history.slice(0, nav.index + 1);
      if (next[next.length - 1] !== newPath) next.push(newPath);
      nav.history = next;
      nav.index = next.length - 1;
      setNavTick((t) => t + 1);
    }
  }, [fetchDir, onPathChange]);

  const handleNavigate = useCallback((newPath: string) => navigateTo(newPath, true), [navigateTo]);

  const handleBack = () => {
    const nav = navRef.current;
    if (nav.index > 0) {
      nav.index--;
      navigateTo(nav.history[nav.index], false);
    }
  };

  const handleForward = () => {
    const nav = navRef.current;
    if (nav.index < nav.history.length - 1) {
      nav.index++;
      navigateTo(nav.history[nav.index], false);
    }
  };

  const handleHome = () => navigateTo(defaultPath, true);

  const handleGoParent = () => {
    if (path === '/') return;
    const parent = path.substring(0, path.lastIndexOf('/')) || '/';
    navigateTo(parent, true);
  };

  const canGoBack = navRef.current.index > 0;
  const canGoForward = navRef.current.index < navRef.current.history.length - 1;

  const handleDelete = (filePath: string) => {
    wsRef.current?.send(JSON.stringify({ action: 'delete', path: filePath }));
  };

  const handleRename = (filePath: string, newName: string) => {
    const dir = filePath.substring(0, filePath.lastIndexOf('/') + 1);
    wsRef.current?.send(JSON.stringify({ action: 'rename', path: filePath, new_path: dir + newName }));
  };

  const handleMkdir = (name: string) => {
    wsRef.current?.send(JSON.stringify({ action: 'mkdir', path: path + '/' + name }));
  };

  const handleEditFile = (filePath: string, fileName: string) => {
    setEditFile({ path: filePath, name: fileName });
  };

  return (
    <div style={{ background: '#252526', fontSize: 11, display: 'flex', flexDirection: 'column', height: '100%', ...style }}>
      {/* XFTP-style address bar */}
      <div style={{ padding: '2px 4px', background: '#2d2d2d', display: 'flex', gap: 2, alignItems: 'center', borderBottom: '1px solid #383838', flexShrink: 0 }}>
        <button onClick={handleBack} title="后退"
          style={{ background: 'none', border: 'none', color: canGoBack ? '#ccc' : '#555', cursor: canGoBack ? 'pointer' : 'default', fontSize: 11, padding: '0 1px' }}>◀</button>
        <button onClick={handleForward} title="前进"
          style={{ background: 'none', border: 'none', color: canGoForward ? '#ccc' : '#555', cursor: canGoForward ? 'pointer' : 'default', fontSize: 11, padding: '0 1px' }}>▶</button>
        <button onClick={handleGoParent} title="上级目录"
          style={{ background: 'none', border: 'none', color: '#ccc', cursor: 'pointer', fontSize: 12, padding: '0 2px' }}>⟰</button>
        <button onClick={handleHome} title="主目录"
          style={{ background: 'none', border: 'none', color: '#ccc', cursor: 'pointer', fontSize: 11, padding: '0 2px' }}>⌂</button>
        <input value={path} onChange={(e) => setPath(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleNavigate(path); }}
          style={{ flex: 1, padding: '2px 6px', background: '#3c3c3c', border: '1px solid #555', borderRadius: 3, color: '#fff', fontSize: 11, fontFamily: 'Consolas, monospace', minWidth: 0 }} />
        {showFollowButton && (
          <button onClick={() => setFollowCd(!followCd)} title={followCd ? '跟随终端目录' : '固定目录'}
            style={{ background: 'none', border: 'none', color: followCd ? '#4fc3f7' : '#888', cursor: 'pointer', fontSize: 12, padding: '0 2px', flexShrink: 0 }}>
            {followCd ? '⊚' : '◯'}
          </button>
        )}
        <button onClick={() => fetchDir(path, true)} title="刷新"
          style={{ background: 'none', border: 'none', color: '#4fc3f7', cursor: 'pointer', fontSize: 12, padding: '0 2px', flexShrink: 0 }}>⟳</button>
      </div>
      {error && <div style={{ padding: '4px 8px', color: '#f44747', fontSize: 10 }}>{error}</div>}
      {disconnected ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 8, color: '#888' }}>
          <div style={{ fontSize: 24, opacity: 0.3 }}>◧</div>
          <div style={{ fontSize: 12 }}>SFTP 连接已断开</div>
          <button onClick={() => setReconnectKey((k) => k + 1)} style={{
            background: '#007acc', border: 'none', color: '#fff', padding: '4px 12px',
            borderRadius: 3, cursor: 'pointer', fontSize: 11,
          }}>重新连接</button>
        </div>
      ) : (<>
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
          onGoParent={handleGoParent}
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
      </>)}
    </div>
  );
}

