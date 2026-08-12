import { lazy, Suspense, useEffect, useState, useCallback, useRef } from 'react';
import FileList from './FileList';
import { t } from '../../i18n';
const FileEditor = lazy(() => import('../common/FileEditor'));
import { useLayoutStore } from '../../store/layout';
import Icon from '../common/Icon';

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

}

export default function SftpPanel({ connId, tabId, localMode, currentPath, onPathChange, style }: Props) {
  const defaultPath = currentPath || (localMode ? '/home' : '/');
  const [path, setPath] = useState(defaultPath);
  const [files, setFiles] = useState<SftpFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [disconnected, setDisconnected] = useState(false);
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
    if (!force && dirPath === pathRef.current) return;
    setLoading(true);
    setError('');
    socket.send(JSON.stringify({ action: 'list', path: dirPath }));
  }, []);

  // Pool of SFTP sockets per connId — released only when SSH tabs for that connId are gone
  const poolRef = useRef<Map<number, WebSocket>>(new Map());
  const connKeyRef = useRef<number | null>(null);

  // Helper: check if connId still has active SSH tabs
  const connIsAlive = (cId: number) => {
    const cache = (window as any).__paneTabsCache as Map<string, import('../../store/layout').Tab[]> | undefined;
    if (!cache) return false;
    for (const tabs of cache.values()) {
      if (tabs.some((t) => t.connId === cId)) return true;
    }
    return false;
  };

  // Create or reuse WebSocket for current connId
  useEffect(() => {
    if (connId == null) return;
    const prevId = connKeyRef.current;
    connKeyRef.current = connId;

    // If we have a socket for the new connId, reuse it
    const existing = poolRef.current.get(connId);
    if (existing && existing.readyState === WebSocket.OPEN) {
      wsRef.current = existing;
      setDisconnected(false);
      const cached = cacheRef.current.get(sessionKey);
      const cdPaths = useLayoutStore.getState().sftpCdPaths;
      const trackedPath = tabId ? cdPaths[tabId] : undefined;
      const initPath = trackedPath || cached?.path || defaultPath;
      if (cached) setFiles(cached.files);
      setPath(initPath);
      setLoading(!cached);
      return;
    }

    // Save old socket to pool if old connId still has SSH tabs
    if (prevId != null && prevId !== connId && connIsAlive(prevId)) {
      poolRef.current.set(prevId, wsRef.current!);
    }

    setDisconnected(false);
    const cached = cacheRef.current.get(sessionKey);
    const cdPaths = useLayoutStore.getState().sftpCdPaths;
    const trackedPath = tabId ? cdPaths[tabId] : undefined;
    const initPath = trackedPath || cached?.path || defaultPath;
    if (cached) setFiles(cached.files);
    setPath(initPath);
    setLoading(!cached);
    setError('');

    const token = localStorage.getItem('token') || '';
    const wsUrl = localMode
      ? `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/ws/local-fs?token=${token}`
      : `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/ws/sftp/${connId}?token=${token}`;
    const socket = new WebSocket(wsUrl);
    wsRef.current = socket;

    socket.onopen = () => {
      setDisconnected(false);
      if (cached) {
        socket.send(JSON.stringify({ action: 'list', path: initPath }));
      } else {
        socket.send(JSON.stringify({ action: 'getwd' }));
      }
    };
    socket.onclose = () => { setDisconnected(true); setLoading(false); };
    socket.onerror = () => socket.close();
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
  }, [connId]);

  // Prune a specific connId from the pool when all its SSH tabs are gone
  const sftpPruneConn = useLayoutStore((s) => s.sftpPruneConn);
  useEffect(() => {
    if (sftpPruneConn == null) return;
    const socket = poolRef.current.get(sftpPruneConn);
    if (socket) { socket.close(); poolRef.current.delete(sftpPruneConn); }
    // Also clear caches for this connId
    for (const [key] of cacheRef.current) {
      if (key.startsWith(String(sftpPruneConn))) cacheRef.current.delete(key);
    }
  }, [sftpPruneConn]);

  // Clean up pool on unmount
  useEffect(() => {
    return () => {
      poolRef.current.forEach((s) => { try { s.close(); } catch {} });
      poolRef.current.clear();
    };
  }, []);

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

  // Follow SSH shell cd via OSC 7 (per-tab paths)
  const sftpCdPaths = useLayoutStore((s) => s.sftpCdPaths);
  const cdPath = tabId ? sftpCdPaths[tabId] : undefined;
  useEffect(() => {
    if (!followCd || !cdPath) return;
    const socket = wsRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) return;
    if (cdPath === path) return;
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
    if (nav.index > 0) { nav.index--; navigateTo(nav.history[nav.index], false); }
  };
  const handleForward = () => {
    const nav = navRef.current;
    if (nav.index < nav.history.length - 1) { nav.index++; navigateTo(nav.history[nav.index], false); }
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
    <div style={{ background: '#1a1b26', fontSize: 11, display: 'flex', flexDirection: 'column', height: '100%', ...style }}>
      <div style={{ height: 36, padding: '0 4px', background: '#1a1b26', display: 'flex', gap: 2, alignItems: 'center', borderBottom: '1px solid #3b4261', flexShrink: 0 }}>
        <button onClick={handleBack} title={t("sftp_back")}
          style={{ background: 'none', border: 'none', color: canGoBack ? '#ccc' : '#3b4261', cursor: canGoBack ? 'pointer' : 'default', padding: '2px', display: 'flex', alignItems: 'center' }}><Icon name="chevron-left" size={14} /></button>
        <button onClick={handleForward} title={t("sftp_forward")}
          style={{ background: 'none', border: 'none', color: canGoForward ? '#ccc' : '#3b4261', cursor: canGoForward ? 'pointer' : 'default', padding: '2px', display: 'flex', alignItems: 'center' }}><Icon name="chevron-right" size={14} /></button>
        <button onClick={handleGoParent} title={t("sftp_parent")}
          style={{ background: 'none', border: 'none', color: '#ccc', cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center' }}><Icon name="corner-left-up" size={14} /></button>
        <button onClick={handleHome} title={t("sftp_home")}
          style={{ background: 'none', border: 'none', color: '#ccc', cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center' }}><Icon name="home" size={14} /></button>
        <input value={path} onChange={(e) => setPath(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleNavigate(path); }}
          style={{ flex: 1, padding: '2px 6px', background: '#1a1b26', border: '1px solid #3b4261', borderRadius: 4, color: '#fff', fontSize: 11, fontFamily: 'Consolas, monospace', minWidth: 0 }} />


      </div>
      {error && <div style={{ padding: '4px 8px', color: '#f44747', fontSize: 10 }}>{error}</div>}
      {disconnected ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 8, color: '#888' }}>
          <div style={{ fontSize: 24, opacity: 0.3 }}>◧</div>
          <div style={{ fontSize: 12 }}>{t("sftp_disconnected")}</div>
          <button onClick={() => setFiles([])} style={{
            background: '#7aa2f7', border: 'none', color: '#1a1b26', fontWeight: 600, padding: '4px 12px',
            borderRadius: 4, cursor: 'pointer', fontSize: 11,
          }}>{t("sftp_reconnect")}</button>
        </div>
      ) : (<>
        <FileList
          files={files} loading={loading}
          onNavigate={handleNavigate} onDelete={handleDelete}
          onRename={handleRename} connId={connId} currentPath={path}
          onUpload={() => fetchDir(path)} onEdit={handleEditFile}
          onMkdir={(name) => handleMkdir(name)} onGoParent={handleGoParent}
          onToggleFollow={() => setFollowCd(!followCd)} followCd={followCd}
        />
        {editFile && (
          <Suspense fallback={<div style={{ padding: 12, fontSize: 12, color: '#565f89' }}>Loading…</div>}>
            <FileEditor
              filePath={editFile.path} fileName={editFile.name}
              ws={wsRef.current}
              onClose={() => setEditFile(null)} onSaved={() => fetchDir(path)}
            />
          </Suspense>
        )}
      </>)}
    </div>
  );
}
