import { lazy, Suspense, useEffect, useState, useCallback, useRef } from 'react';
import FileList from './FileList';
import { t } from '../../i18n';
const FileEditor = lazy(() => import('../common/FileEditor'));
import { useLayoutStore } from '../../store/layout';
import { useAuthStore } from '../../store/auth';
import Icon from '../common/Icon';
import { colors, font } from '../../theme/tokens';

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
  const [homePath, setHomePath] = useState(defaultPath);
  const [files, setFiles] = useState<SftpFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [disconnected, setDisconnected] = useState(false);
  const [followCd, setFollowCd] = useState(true);
  const [editFile, setEditFile] = useState<{ path: string; name: string } | null>(null);
  const sessionKey = tabId || String(connId ?? 'local');
  const cacheRef = useRef<Map<string, { path: string; files: SftpFile[] }>>(new Map());
  const navRef = useRef({ history: [defaultPath], index: 0 });
  const [, setNavTick] = useState(0);

  const wsRef = useRef<WebSocket | null>(null);
  const authToken = useAuthStore((s) => s.token);
  const [wsNonce, setWsNonce] = useState(0);
  // Auto-reconnect: at most SFTP_MAX_RETRIES attempts after an unexpected close
  const SFTP_MAX_RETRIES = 3;
  const retryRef = useRef(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [retryAttempt, setRetryAttempt] = useState(0);
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
    if (connId == null && !localMode) return;
    const poolKey = localMode || connId == null ? -1 : connId; // local pane shares one pooled socket
    const prevId = connKeyRef.current;
    connKeyRef.current = poolKey;
    if (prevId !== poolKey) {
      // switching connection: fresh reconnect budget, drop any pending retry
      retryRef.current = 0;
      setRetryAttempt(0);
      clearTimeout(retryTimerRef.current);
    }

    // If we have a socket for the new connId, reuse it
    const existing = poolRef.current.get(poolKey);
    if (existing && existing.readyState !== WebSocket.OPEN) {
      poolRef.current.delete(poolKey);
    }
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

    // Save old socket to pool if old connId still has SSH tabs; otherwise close it
    if (prevId != null && prevId !== connId) {
      if (connIsAlive(prevId)) {
        poolRef.current.set(prevId, wsRef.current!);
      } else {
        wsRef.current?.close();
        wsRef.current = null;
      }
    }

    if (!authToken) return; // panels mount pre-login (modules stay mounted); reconnect once auth arrives
    setDisconnected(false);
    const cached = cacheRef.current.get(sessionKey);
    const cdPaths = useLayoutStore.getState().sftpCdPaths;
    const trackedPath = tabId ? cdPaths[tabId] : undefined;
    const initPath = trackedPath || cached?.path || defaultPath;
    if (cached) setFiles(cached.files);
    setPath(initPath);
    setLoading(!cached);
    setError('');

    const wsUrl = localMode
      ? `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/ws/local-fs?token=${authToken}`
      : `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/ws/sftp/${connId}?token=${authToken}`;
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
    socket.onclose = () => {
      setDisconnected(true);
      setLoading(false);
      // auto-reconnect with backoff, capped at SFTP_MAX_RETRIES attempts
      if (authToken && retryRef.current < SFTP_MAX_RETRIES) {
        const attempt = retryRef.current + 1;
        retryRef.current = attempt;
        setRetryAttempt(attempt);
        retryTimerRef.current = setTimeout(() => setWsNonce((n) => n + 1), 1000 * attempt);
      } else {
        setRetryAttempt(0); // budget exhausted: fall back to the manual button
      }
    };
    socket.onerror = () => socket.close();
    socket.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'file_list') {
          retryRef.current = 0; // server answered: session proven alive, restore retry budget
          setRetryAttempt(0);
          setFiles(msg.files || []);
          setPath(msg.path || path);
          setLoading(false);
        } else if (msg.type === 'error') {
          setError(msg.error);
          setLoading(false);
        } else if (msg.type === 'pwd') {
          retryRef.current = 0; // server answered: session proven alive
          setRetryAttempt(0);
          setPath(msg.path);
          setHomePath(msg.path); // server-reported home (Windows profile for local mode under WSL)
          fetchDir(msg.path);
        } else if (msg.type === 'delete_done' || msg.type === 'mkdir_done' || msg.type === 'rename_done') {
          fetchDir(pathRef.current, true);
        }
      } catch {}
    };
  }, [connId, wsNonce, authToken]);

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
      clearTimeout(retryTimerRef.current);
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
  const handleHome = () => navigateTo(homePath, true);
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
  const handleChmod = (filePath: string, mode: string) => {
    wsRef.current?.send(JSON.stringify({ action: 'chmod', path: filePath, mode }));
  };

  // Toolbar action signals forwarded into FileList (which owns the input row / file picker)
  const [uploadTick, setUploadTick] = useState(0);
  const [newFolderTick, setNewFolderTick] = useState(0);

  const toolBtn = (icon: string, title: string, onClick: () => void, opts?: { disabled?: boolean; active?: boolean }) => (
    <button onClick={onClick} title={title} disabled={opts?.disabled}
      style={{
        background: opts?.active ? colors.accentSoft : 'none', border: 'none',
        color: opts?.disabled ? colors.border : opts?.active ? colors.accent : colors.textGray,
        cursor: opts?.disabled ? 'default' : 'pointer', padding: 4, borderRadius: 4,
        display: 'flex', alignItems: 'center', transition: 'background 0.1s ease, color 0.1s ease',
      }}
      onMouseEnter={(e) => { if (!opts?.disabled) { e.currentTarget.style.background = colors.bgHover; e.currentTarget.style.color = colors.text; } }}
      onMouseLeave={(e) => { e.currentTarget.style.background = opts?.active ? colors.accentSoft : 'none'; e.currentTarget.style.color = opts?.disabled ? colors.border : opts?.active ? colors.accent : colors.textGray; }}>
      <Icon name={icon} size={15} />
    </button>
  );

  return (
    <div style={{ background: colors.bg, fontSize: font.sm, display: 'flex', flexDirection: 'column', height: '100%', ...style }}>
      <div style={{ height: 38, padding: '0 6px', background: colors.bg, display: 'flex', gap: 1, alignItems: 'center', borderBottom: '1px solid var(--c-border-soft)', flexShrink: 0 }}>
        {toolBtn('chevron-left', t('sftp_back'), handleBack, { disabled: !canGoBack })}
        {toolBtn('chevron-right', t('sftp_forward'), handleForward, { disabled: !canGoForward })}
        {toolBtn('corner-left-up', t('sftp_parent'), handleGoParent)}
        {toolBtn('home', t('sftp_home'), handleHome)}
        <input value={path} onChange={(e) => setPath(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleNavigate(path); }}
          spellCheck={false}
          style={{ flex: 1, padding: '4px 8px', margin: '0 4px', background: colors.bgInput, border: '1px solid var(--c-border-soft)', borderRadius: 4, color: colors.text, fontSize: font.sm, fontFamily: '"JetBrains Mono", Consolas, monospace', minWidth: 0 }} />
        {toolBtn('refresh-cw', t('sftp_refresh'), () => fetchDir(path, true))}
        {connId != null && toolBtn('upload', t('sftp_upload'), () => setUploadTick((n) => n + 1))}
        {toolBtn('folder-plus', t('sftp_new_folder'), () => setNewFolderTick((n) => n + 1))}
        {toolBtn('link', followCd ? t('sftp_fixed') : t('sftp_follow'), () => setFollowCd(!followCd), { active: followCd })}
      </div>
      {error && <div style={{ padding: '4px 10px', color: colors.dangerBright, fontSize: font.xs, background: colors.dangerSoft }}>{error}</div>}
      {disconnected ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 10, color: colors.textDim }}>
          <Icon name="folder-open" size={30} />
          <div style={{ fontSize: font.md }}>{t('sftp_disconnected')}</div>
          {retryAttempt > 0 ? (
            <div style={{ color: colors.textMuted, fontSize: font.sm }}>{t('sftp_reconnecting')} ({retryAttempt}/{SFTP_MAX_RETRIES})</div>
          ) : (
            <button onClick={() => { retryRef.current = 0; setRetryAttempt(0); setError(''); setFiles([]); setDisconnected(false); setWsNonce((n) => n + 1); }} style={{
              background: colors.accent, border: 'none', color: colors.bg, fontWeight: 600, padding: '5px 16px',
              borderRadius: 4, cursor: 'pointer', fontSize: font.sm,
            }}>{t('sftp_reconnect')}</button>
          )}
        </div>
      ) : (<>
        <FileList
          files={files} loading={loading}
          onNavigate={handleNavigate} onDelete={handleDelete}
          onRename={handleRename} connId={connId} currentPath={path}
          onUpload={() => fetchDir(path)} onEdit={handleEditFile} onChmod={handleChmod}
          onMkdir={(name) => handleMkdir(name)} onGoParent={handleGoParent}
          onToggleFollow={() => setFollowCd(!followCd)} followCd={followCd}
          uploadTick={uploadTick} newFolderTick={newFolderTick}
        />
        {editFile && (
          <Suspense fallback={<div style={{ padding: 12, fontSize: font.md, color: colors.textMuted }}>Loading…</div>}>
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
