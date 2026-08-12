import { lazy, Suspense, useState, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useLayoutStore } from '../../store/layout';
import type { Tab } from '../../store/layout';
import { useConnectionStore } from '../../store/connections';
import TabBar from './TabBar';
const TerminalTab = lazy(() => import('../terminal/TerminalTab'));
const QueryEditor = lazy(() => import('../database/QueryEditor'));
import { t } from '../../i18n';
import MatrixRain from '../common/MatrixRain';
import { useAuthStore } from '../../store/auth';
import { apiPost } from '../../api/client';
import { colors, font } from '../../theme/tokens';
type Direction = 'horizontal' | 'vertical';

// Tree node for layout computation only (NOT used for rendering)
type LayoutNode = {
  type: 'leaf';
  id: string;
} | {
  type: 'split';
  direction: Direction;
  children: LayoutNode[];
  ratios: number[];
};

// Grid cell — computed from the tree
interface GridCell {
  id: string;       // pane id
  row: number;
  col: number;
  rowSpan: number;
  colSpan: number;
}

// Module-level state
let layoutRoot: LayoutNode = { type: 'leaf', id: 'root' };
let listeners: Array<() => void> = [];

// Registry of all pane IDs ever created (panes never removed from DOM, just hidden)
const allPaneIds = new Set<string>(['root']);

function subscribe(fn: () => void) {
  listeners.push(fn);
  return () => { listeners = listeners.filter((l) => l !== fn); };
}
function notify() { listeners.forEach((fn) => fn()); }


// Find a leaf node by ID and return its path
function findLeaf(node: LayoutNode, id: string, path: LayoutNode[]): LayoutNode[] | null {
  if (node.type === 'leaf') return node.id === id ? [...path, node] : null;
  for (const child of node.children) {
    const result = findLeaf(child, id, [...path, node]);
    if (result) return result;
  }
  return null;
}

// Add a split: wraps the target leaf in a split, or adds sibling if same direction
// If newId is provided, uses it instead of generating one
function doSplit(targetId: string, direction: Direction, newId?: string) {
  const id = newId || `pane-${Date.now()}`;
  allPaneIds.add(id);

  if ((layoutRoot as any).id === targetId && layoutRoot.type === 'leaf') {
    // Splitting root
    layoutRoot = {
      type: 'split',
      direction,
      children: [
        { type: 'leaf', id: targetId },
        { type: 'leaf', id },
      ],
      ratios: [0.5, 0.5],
    };
  } else {
    const path = findLeaf(layoutRoot, targetId, []);
    if (!path || path.length < 2) return;
    const parent = path[path.length - 2];
    if (parent.type !== 'split') return;

    if (parent.direction === direction) {
      // Same direction — split only the target pane's space in half
      const idx = parent.children.findIndex((c: any) => c.id === targetId);
      if (idx < 0) return;
      const half = parent.ratios[idx] / 2;
      parent.ratios[idx] = half;
      parent.ratios.splice(idx + 1, 0, half);
      parent.children.splice(idx + 1, 0, { type: 'leaf', id });
    } else {
      // Different direction — wrap this leaf in a sub-split
      const idx = parent.children.findIndex((c: any) => c.id === targetId);
      if (idx < 0) return;
      parent.children[idx] = {
        type: 'split',
        direction,
        children: [
          { type: 'leaf', id: targetId },
          { type: 'leaf', id },
        ],
        ratios: [0.5, 0.5],
      };
    }
  }
  notify();
  return id;
}

// Remove a pane from the layout
function doRemovePane(paneId: string) {
  // Only refuse to remove root when it's the sole pane
  if (paneId === 'root' && layoutRoot.type === 'leaf') return;

  function removeFrom(node: LayoutNode): LayoutNode | null {
    if (node.type === 'leaf') return node.id === paneId ? null : node;
    const filtered = node.children
      .map((c) => removeFrom(c))
      .filter((c): c is LayoutNode => c !== null);
    if (filtered.length === 1) return filtered[0];
    if (filtered.length === 0) return null;
    node.children = filtered;
    // Redistribute ratios
    node.ratios = filtered.map(() => 1 / filtered.length);
    return node;
  }

  const result = removeFrom(layoutRoot);
  if (result) {
    layoutRoot = result;
    allPaneIds.delete(paneId);
  }
  notify();
}

// Helper: greatest common divisor
function gcd(a: number, b: number): number { return b === 0 ? a : gcd(b, a % b); }

// Largest remainder method for distributing integer spans proportional to ratios
function allocateSpans(total: number, ratios: number[]): number[] {
  const raw = ratios.map((r) => r * total);
  const spans = raw.map((s) => Math.max(0, Math.floor(s)));
  const remainders = raw.map((r, i) => ({ idx: i, rem: r - spans[i] }));
  let allocated = spans.reduce((a, b) => a + b, 0);
  const deficit = total - allocated;
  remainders.sort((a, b) => b.rem - a.rem);
  for (let i = 0; i < deficit; i++) {
    spans[remainders[i % remainders.length].idx]++;
  }
  return spans.map((s) => Math.max(1, s));
}

// Normalize cells: scale spans and positions down by their global GCD
function normalizeCells(cells: GridCell[]): { cells: GridCell[]; cols: number; rows: number } {
  let colGcd = 0, rowGcd = 0;
  for (const c of cells) {
    colGcd = colGcd === 0 ? c.colSpan : gcd(colGcd, c.colSpan);
    rowGcd = rowGcd === 0 ? c.rowSpan : gcd(rowGcd, c.rowSpan);
  }
  if (colGcd < 1) colGcd = 1;
  if (rowGcd < 1) rowGcd = 1;

  const normalized = cells.map((c) => ({
    ...c,
    col: ((c.col - 1) / colGcd) + 1,
    row: ((c.row - 1) / rowGcd) + 1,
    colSpan: c.colSpan / colGcd,
    rowSpan: c.rowSpan / rowGcd,
  }));

  const maxCol = normalized.reduce((m, c) => Math.max(m, c.col + c.colSpan - 1), 0);
  const maxRow = normalized.reduce((m, c) => Math.max(m, c.row + c.rowSpan - 1), 0);

  return { cells: normalized, cols: maxCol, rows: maxRow };
}

// Flatten tree into grid cells using precise integer span allocation
const PRECISION = 100;
function flattenTree(node: LayoutNode, row: number, col: number, rowSpan: number, colSpan: number): GridCell[] {
  if (node.type === 'leaf') {
    return [{ id: node.id, row, col, rowSpan, colSpan }];
  }
  const cells: GridCell[] = [];
  if (node.direction === 'horizontal') {
    const spans = allocateSpans(colSpan, node.ratios);
    let c = col;
    node.children.forEach((child, i) => {
      cells.push(...flattenTree(child, row, c, rowSpan, spans[i]));
      c += spans[i];
    });
  } else {
    const spans = allocateSpans(rowSpan, node.ratios);
    let r = row;
    node.children.forEach((child, i) => {
      cells.push(...flattenTree(child, r, col, spans[i], colSpan));
      r += spans[i];
    });
  }
  return cells;
}

// Compute the total extents of the tree (ignoring ratios, just leaf count)
function treeExtents(node: LayoutNode): { cols: number; rows: number } {
  if (node.type === 'leaf') return { cols: 1, rows: 1 };
  if (node.direction === 'horizontal') {
    let cols = 0, rows = 1;
    for (const child of node.children) {
      const e = treeExtents(child);
      cols += e.cols;
      rows = Math.max(rows, e.rows);
    }
    return { cols: Math.max(1, cols), rows };
  } else {
    let rows = 0, cols = 1;
    for (const child of node.children) {
      const e = treeExtents(child);
      rows += e.rows;
      cols = Math.max(cols, e.cols);
    }
    return { rows: Math.max(1, rows), cols };
  }
}

// Compute grid dimensions with precise ratio encoding
function computeGrid(node: LayoutNode): { cols: number; rows: number; cells: GridCell[] } {
  if (node.type === 'leaf') return { cols: 1, rows: 1, cells: [{ id: node.id, row: 1, col: 1, rowSpan: 1, colSpan: 1 }] };

  const extents = treeExtents(node);
  const rawCells = flattenTree(node, 1, 1, extents.rows * PRECISION, extents.cols * PRECISION);
  return normalizeCells(rawCells);
}

// Cache tabs per pane
const paneTabsCache = new Map<string, Tab[]>();
const paneActiveCache = new Map<string, string | null>();
let pendingSplitTabs: { tabs: Tab[]; activeTabId: string | null } | null = null;

// Leaf pane component — always mounted, just hidden when not in layout
function LeafPane({ nodeId, onActiveSshChange, isInSplit }: {
  nodeId: string; onActiveSshChange?: (connId: number | null, tabId: string | null) => void; isInSplit: boolean;
}) {
  const [tabs, setTabs] = useState<Tab[]>(() => {
    return paneTabsCache.get(nodeId) || [];
  });
  const [activeTabId, setActiveTabId] = useState<string | null>(() => {
    return paneActiveCache.get(nodeId) || null;
  });
  // Fallback: apply pendingSplitTabs if cache missed (safety net)
  useLayoutEffect(() => {
    if (pendingSplitTabs) {
      const { tabs: newTabs, activeTabId: newActiveId } = pendingSplitTabs;
      pendingSplitTabs = null;
      setTabs(newTabs);
      setActiveTabId(newActiveId);
    }
  }, []);
  const drainTabQueue = useLayoutStore((s) => s.drainTabQueue);
  const focusedPaneId = useLayoutStore((s) => s.focusedPaneId);
  const setFocusedPane = useLayoutStore((s) => s.setFocusedPane);
  const setStatusConn = useLayoutStore((s) => s.setStatusConn);
  const drainRemovedTabs = useLayoutStore((s) => s.drainRemovedTabs);
  const notifyTabMoved = useLayoutStore((s) => s.notifyTabMoved);
  const connections = useConnectionStore((s) => s.connections);

  useEffect(() => { paneTabsCache.set(nodeId, tabs); paneActiveCache.set(nodeId, activeTabId); }, [tabs, activeTabId, nodeId]);

  useEffect(() => {
    const iv = setInterval(() => {
      if (focusedPaneId === nodeId) {
        const queue = drainTabQueue();
        if (queue.length > 0) {
          setTabs((prev) => { const ids = new Set(prev.map((t) => t.id)); return [...prev, ...queue.filter((t) => !ids.has(t.id))]; });
          setActiveTabId(queue[queue.length - 1].id);
        }
      }
      const removed = drainRemovedTabs();
      if (removed.length > 0) setTabs((prev) => prev.filter((t) => !removed.includes(t.id)));
    }, 100);
    return () => clearInterval(iv);
  }, [drainTabQueue, drainRemovedTabs, focusedPaneId, nodeId]);

  const handleAddTab = (connId: number, name: string, type: string) => {
    const tab: Tab = { id: `${type}-${connId}-${Date.now()}`, type: type as any, title: name, connId };
    setTabs((prev) => [...prev, tab]); setActiveTabId(tab.id);
  };
  const handleReceiveTab = (tab: Tab) => {
    setTabs((prev) => { if (prev.find((t) => t.id === tab.id)) return prev; return [...prev, tab]; });
    setActiveTabId(tab.id); notifyTabMoved(tab.id);
  };
  const closeTab = (id: string) => {
    setTabs((prev) => {
      const next = prev.filter((t) => t.id !== id);
      if (next.length === 0 && isInSplit) {
          setTimeout(() => {
            doRemovePane(nodeId);
            setFocusedPane(layoutRoot.type === 'leaf' ? layoutRoot.id : 'root');
          }, 0);
          return next;
        }
      if (activeTabId === id) setActiveTabId(next.length > 0 ? next[next.length - 1].id : null);
      return next;
    });
  };
  const handleSplit = (dir: Direction) => {
    const activeTab = tabs.find((t) => t.id === activeTabId);
    if (!activeTab?.connId) return;

    const newPaneId = `pane-${Date.now()}`;
    const newTab: Tab = { ...activeTab, id: `${activeTab.type}-${activeTab.connId}-${Date.now()}` };
    // Pre-cache tab BEFORE doSplit so the new LeafPane finds it on first mount
    paneTabsCache.set(newPaneId, [newTab]);
    paneActiveCache.set(newPaneId, newTab.id);
    pendingSplitTabs = { tabs: [newTab], activeTabId: newTab.id };

    const resultId = doSplit(nodeId, dir, newPaneId);
    if (resultId) setTimeout(() => setFocusedPane(resultId), 100);
  };
  const handleClosePane = () => { if (isInSplit) doRemovePane(nodeId); };
  const handleQuadSplit = () => {
    const activeTab = tabs.find((t) => t.id === activeTabId);
    if (!activeTab?.connId) return;
    const ts = Date.now();
    const vId1 = `pane-${ts}-1`;
    const vId2 = `pane-${ts}-2`;
    const tab1: Tab = { ...activeTab, id: `${activeTab.type}-${activeTab.connId}-${ts}-1` };
    const tab2: Tab = { ...activeTab, id: `${activeTab.type}-${activeTab.connId}-${ts}-2` };
    paneTabsCache.set(vId1, [tab1]);
    paneTabsCache.set(vId2, [tab2]);
    paneActiveCache.set(vId1, tab1.id);
    paneActiveCache.set(vId2, tab2.id);
    const horizId = doSplit(nodeId, 'horizontal');
    if (!horizId) return;
    pendingSplitTabs = { tabs: [tab1], activeTabId: tab1.id };
    setTimeout(() => {
      doSplit(nodeId, 'vertical', vId1);
      pendingSplitTabs = { tabs: [tab2], activeTabId: tab2.id };
      doSplit(horizId, 'vertical', vId2);
    }, 0);
  };

  const activeTab = tabs.find((t) => t.id === activeTabId);
  // Helper: check if a connId still has any active tab across all panes
  const connHasTabs = (cId: number) => {
    for (const t of paneTabsCache.values()) {
      if (t.some((tab) => tab.connId === cId)) return true;
    }
    return false;
  };

  const prevConnRef = useRef<number | null>(null);
  useEffect(() => {
    if (activeTab?.connId) {
      onActiveSshChange?.(activeTab.connId, activeTab.id);
      const conn = connections.find((c) => c.id === activeTab.connId);
      if (conn) setStatusConn({ name: conn.name, host: conn.host, connected: true });
      prevConnRef.current = activeTab.connId;
    } else if (tabs.length === 0 && !isInSplit) {
      // Root pane empty — check if any pane still has tabs
      for (const t of paneTabsCache.values()) { if (t.length > 0) return; }
      onActiveSshChange?.(null, null);
      prevConnRef.current = null;
    } else if (prevConnRef.current != null && !connHasTabs(prevConnRef.current)) {
      // Last tab for this connId was closed — notify SFTP to release this connId
      useLayoutStore.getState().pruneSftpConn(prevConnRef.current);
      onActiveSshChange?.(-prevConnRef.current, null);
      prevConnRef.current = null;
    }
  }, [activeTab?.connId, activeTab?.id, tabs.length, isInSplit, onActiveSshChange]);
  // Also sync SFTP when this pane gains focus
  useEffect(() => {
    if (focusedPaneId === nodeId && activeTab?.connId) {
      onActiveSshChange?.(activeTab.connId, activeTab.id);
      const conn = connections.find((c) => c.id === activeTab.connId);
      if (conn) setStatusConn({ name: conn.name, host: conn.host, connected: true });
    }
  }, [focusedPaneId, nodeId, activeTab?.connId, activeTab?.id, onActiveSshChange, connections, setStatusConn]);

  return (
    <div onClick={() => setFocusedPane(nodeId)} style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0, minHeight: 0 }}>
      {tabs.length > 0 && (
        <TabBar tabs={tabs} activeTabId={activeTabId} onSelectTab={setActiveTabId} onCloseTab={closeTab} filterType="ssh"
          connections={connections} onAddTab={handleAddTab} onReceiveTab={handleReceiveTab} />
      )}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {tabs.map((tab) => (
          <div key={tab.id} style={{ flex: 1, display: tab.id === activeTabId ? 'flex' : 'none', overflow: 'hidden' }}>
            {tab.type === 'ssh' && tab.connId && (
              <Suspense fallback={<div style={{ padding: 12, fontSize: font.md, color: colors.textMuted }}>Loading…</div>}>
                <TerminalTab connId={tab.connId} myTabId={tab.id} paneTabs={tabs} extraMenuItems={[
                  { label: t('term_split_h'), action: () => handleSplit('horizontal') },
                  { label: t('term_split_v'), action: () => handleSplit('vertical') },
                  { label: t('term_split_quad'), action: handleQuadSplit },
                  ...(isInSplit ? [{ label: t('term_close_pane'), action: handleClosePane }] : []),
                ]} />
              </Suspense>
            )}
            {tab.type === 'database' && tab.connId && (
              <Suspense fallback={<div style={{ padding: 12, fontSize: font.md, color: colors.textMuted }}>Loading…</div>}>
                <QueryEditor connId={tab.connId} />
              </Suspense>
            )}
          </div>
        ))}
        {tabs.length === 0 && <SessionWelcome />}
      </div>
    </div>
  );
}

// Top-level grid container — ALL panes are direct children with stable keys
function GridContainer({ onActiveSshChange }: { onActiveSshChange?: (connId: number | null, tabId: string | null) => void }) {
  const [tick, forceUpdate] = useState(0);

  useEffect(() => subscribe(() => forceUpdate((n) => n + 1)), []);

  const { cols, rows, cells } = useMemo(() => computeGrid(layoutRoot), [tick]);
  const cellMap = new Map(cells.map((c) => [c.id, c]));
  const paneIds = Array.from(allPaneIds);
  const isInSplit = layoutRoot.type !== 'leaf';

  // Build grid-template-areas
  const grid: string[][] = Array.from({ length: rows }, () => Array(cols).fill('.'));
  for (const cell of cells) {
    for (let r = cell.row - 1; r < cell.row - 1 + cell.rowSpan; r++) {
      for (let c = cell.col - 1; c < cell.col - 1 + cell.colSpan; c++) {
        if (r < rows && c < cols) grid[r][c] = cell.id;
      }
    }
  }
  const gridTemplateAreas = grid.map((row) => `"${row.join(' ')}"`).join(' ');

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: `repeat(${cols}, 1fr)`,
      gridTemplateRows: `repeat(${rows}, 1fr)`,
      gridTemplateAreas,
      flex: 1, overflow: 'hidden', minWidth: 0, minHeight: 0,
      gap: 1, background: colors.border,
    }}>
      {paneIds.map((id) => {
        const cell = cellMap.get(id);
        return (
          <div key={id} style={{
            gridArea: cell ? id : undefined,
            display: cell ? 'flex' : 'none',
            overflow: 'hidden',
          }}>
            <LeafPane nodeId={id} onActiveSshChange={onActiveSshChange} isInSplit={isInSplit && cellMap.has(id)} />
          </div>
        );
      })}
    </div>
  );
}

const banner = [
  ' _    _  _____  _____  _____  _____  _____  __  __ ',
  '| |  | ||  ___||  __ \\|_   _||  ___||  __ \\|  \\/  |',
  '| |  | || |__  | |__) | | |  | |__  | |__) | \\  / |',
  '| |/\\| ||  __| |  _  /  | |  |  __| |  _  /| |\\/| |',
  '\\  /\\  /| |___ | | \\ \\  | |  | |___ | | \\ \\| |  | |',
  ' \\/  \\/ |_____||_|  \\_\\ \\_/  |_____||_|  \\_\\|_|  |_|',
];

function SessionWelcome() {
  const [tick, setTick] = useState(0);
  const token = useAuthStore((s) => s.token);
  const setAuth = useAuthStore((s) => s.setAuth);
  const [step, setStep] = useState<'user' | 'pass' | 'done'>('user');
  const [username, setUsername] = useState(localStorage.getItem('webterm-rm-user') || '');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [lines, setLines] = useState<string[]>([]);
  const [remember, setRemember] = useState(!!localStorage.getItem('webterm-rm-user'));
  const inputRef = useRef<HTMLInputElement>(null);
  const savedPwd = localStorage.getItem('webterm-rm-pwd') || '';

  const append = (text: string) => setLines((l) => [...l, text]);

  const handleLogin = async (user: string, pass: string) => {
    setError('');
    try {
      const data = await apiPost('/api/auth/login', { username: user, password: pass });
      if (remember) {
        localStorage.setItem('webterm-rm-user', user);
        localStorage.setItem('webterm-rm-pwd', pass);
      } else {
        localStorage.removeItem('webterm-rm-user');
        localStorage.removeItem('webterm-rm-pwd');
      }
      setStep('done');
      setLines([
        `<span style="color:var(--c-accent)">login:</span> ${user}`,
        `<span style="color:var(--c-accent)">password:</span>`,
        `<span style="color:#9ece6a">Welcome, ${data.user.username}!</span>`,
      ]);
      setTimeout(() => {
        // Clear all connection state before setting new auth
        useConnectionStore.getState().connections.length > 0 &&
          useConnectionStore.setState({ connections: [], groups: [], dbConnections: [] });
        setAuth(data.user, data.token);
      }, 1000);
    } catch {
      setStep('done');
      setLines([
        `<span style="color:var(--c-accent)">login:</span> ${user}`,
        `<span style="color:var(--c-accent)">password:</span>`,
        `<span style="color:var(--c-danger-bright)">${t('login_error')}</span>`,
      ]);
      setTimeout(() => { setLines([]); setStep('user'); setUsername(''); setPassword(''); }, 1000);
    }
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key !== 'Enter' && e.key !== 'Tab') return;
    e.preventDefault();
    if (step === 'user') {
      const u = username.trim();
      if (!u) return;
      append(`<span style="color:var(--c-accent)">login:</span> ${u}`);
      if (remember && savedPwd && u === localStorage.getItem('webterm-rm-user')) {
        handleLogin(u, savedPwd);
        return;
      }
      setStep('pass');
    } else {
      handleLogin(username.trim(), password);
    }
  };

  // Focus input when step changes
  useEffect(() => { inputRef.current?.focus(); }, [step]);

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', flexDirection: 'column', background: colors.bg, position: 'relative', overflow: 'hidden' }}>
      <MatrixRain key={tick} fontSize={22} columns={24} opacity={0.5} />
      <div onClick={() => setTick((n) => n + 1)}
        style={{ position: 'absolute', top: '60%', left: '50%', transform: 'translate(-50%, -50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, cursor: 'pointer', zIndex: 1, fontFamily: '"JetBrains Maple Mono", "JetBrains Mono", "Courier New", monospace' }}>
          <pre style={{
            margin: 0, fontSize: font.xl3, lineHeight: 1.25, fontWeight: 700,
            color: colors.accent,
            textShadow: `
              1px 1px 0 var(--c-purple),
              2px 2px 0 var(--c-accent),
              3px 3px 0 var(--c-accent80),
              4px 4px 0 var(--c-accent60),
              5px 5px 0 var(--c-accent-mid),
              6px 6px 0 var(--c-accent-faint),
              0 0 20px var(--c-accent-mid)
            `,
          }}>
            {banner.join('\n')}
          </pre>
          <div style={{ color: colors.textMuted, fontSize: font.xl, letterSpacing: 1 }}>{t('app_slogan')}</div>
        </div>

        {!token && (
          <div onClick={() => inputRef.current?.focus()}
            style={{
              position: 'absolute', top: '70%', left: '50%', transform: 'translateX(-50%)',
              fontFamily: '"JetBrains Maple Mono", "JetBrains Mono", "Courier New", monospace',
              fontSize: font.xl, color: colors.text, width: 320, zIndex: 1,
              padding: '16px 20px', cursor: 'text',
            }}>
            {lines.map((l, i) => (
              <div key={i} style={{ lineHeight: 1.8 }} dangerouslySetInnerHTML={{ __html: l }} />
            ))}
            {error && <div style={{ color: colors.dangerBright, lineHeight: 1.8 }}>{error}</div>}
            {step !== 'done' && (
            <div style={{ display: 'flex', alignItems: 'center', lineHeight: 1.8 }}>
              <span style={{ color: colors.accent, marginRight: 8 }}>
                {step === 'user' ? 'login:' : 'password:'}
              </span>
              <input ref={inputRef}
                className="login-input"
                type={step === 'user' ? 'text' : 'password'}
                value={step === 'user' ? username : password}
                onChange={(e) => step === 'user' ? setUsername(e.target.value) : setPassword(e.target.value)}
                onKeyDown={onKey}
                autoFocus
                style={{
                  flex: 1, background: 'none', border: 'none', color: colors.text,
                  fontSize: font.xl, outline: 'none', fontFamily: 'inherit',
                  caretColor: colors.accent, caretShape: 'block',
                }} />
            </div>
            )}
            {step !== 'done' && (
            <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}
              onClick={() => setRemember(!remember)}>
              <span style={{
                width: 13, height: 13, borderRadius: 2, display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: '1px solid var(--c-border)', background: remember ? colors.accent : 'rgba(31,35,53,0.5)', flexShrink: 0,
              }}>
                {remember && <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke={colors.bg} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
              </span>
              <span style={{ color: colors.textMuted, fontSize: font.md, userSelect: 'none' }}>
                remember
              </span>
            </div>
            )}
          </div>
        )}
    </div>
  );
}


// Expose for SFTP panel to check active connIds
(window as any).__paneTabsCache = paneTabsCache;

export default function SplitPane({ onActiveSshChange }: { onActiveSshChange?: (connId: number | null, tabId: string | null) => void }) {
  return <GridContainer onActiveSshChange={onActiveSshChange} />;
}
