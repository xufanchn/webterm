import { useState, useEffect, useLayoutEffect, useMemo } from 'react';
import { useLayoutStore } from '../../store/layout';
import type { Tab } from '../../store/layout';
import { useConnectionStore } from '../../store/connections';
import TabBar from './TabBar';
import TerminalTab from '../terminal/TerminalTab';
import QueryEditor from '../database/QueryEditor';

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
  if (paneId === 'root') return;

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
  if (result && result.type === 'leaf' && result.id === 'root') {
    layoutRoot = result;
  } else if (result) {
    layoutRoot = result;
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
  nodeId: string; onActiveSshChange?: (connId: number) => void; isInSplit: boolean;
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
  const drainRemovedTabs = useLayoutStore((s) => s.drainRemovedTabs);
  const notifyTabMoved = useLayoutStore((s) => s.notifyTabMoved);
  const connections = useConnectionStore((s) => s.connections);

  useEffect(() => { paneTabsCache.set(nodeId, tabs); paneActiveCache.set(nodeId, activeTabId); }, [tabs, activeTabId, nodeId]);

  useEffect(() => {
    const iv = setInterval(() => {
      const queue = drainTabQueue();
      if (queue.length > 0 && focusedPaneId === nodeId) {
        setTabs((prev) => { const ids = new Set(prev.map((t) => t.id)); return [...prev, ...queue.filter((t) => !ids.has(t.id))]; });
        setActiveTabId(queue[queue.length - 1].id);
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
      if (next.length === 0 && isInSplit) { setTimeout(() => doRemovePane(nodeId), 0); return next; }
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

  const activeTab = tabs.find((t) => t.id === activeTabId);
  useEffect(() => { if (activeTab?.connId) onActiveSshChange?.(activeTab.connId); }, [activeTab?.connId, onActiveSshChange]);

  return (
    <div onClick={() => setFocusedPane(nodeId)} style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0, minHeight: 0 }}>
      <TabBar tabs={tabs} activeTabId={activeTabId} onSelectTab={setActiveTabId} onCloseTab={closeTab} filterType="ssh"
        connections={connections} onAddTab={handleAddTab} onReceiveTab={handleReceiveTab} />
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {tabs.map((tab) => (
          <div key={tab.id} style={{ flex: 1, display: tab.id === activeTabId ? 'flex' : 'none', overflow: 'hidden' }}>
            {tab.type === 'ssh' && tab.connId && (
              <TerminalTab connId={tab.connId} myTabId={tab.id} paneTabs={tabs} extraMenuItems={[
                { label: '横向分屏', action: () => handleSplit('horizontal') },
                { label: '纵向分屏', action: () => handleSplit('vertical') },
                ...(isInSplit ? [{ label: '关闭分屏', action: handleClosePane }] : []),
              ]} />
            )}
            {tab.type === 'database' && tab.connId && <QueryEditor connId={tab.connId} />}
          </div>
        ))}
        {tabs.length === 0 && <SessionWelcome />}
      </div>
    </div>
  );
}

// Top-level grid container — ALL panes are direct children with stable keys
function GridContainer({ onActiveSshChange }: { onActiveSshChange?: (connId: number) => void }) {
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
      gap: 1, background: '#555',
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

function SessionWelcome() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', flexDirection: 'column', gap: 8 }}>
      <div style={{ fontSize: 48, opacity: 0.15 }}>▣</div>
      <div style={{ color: '#888', fontSize: 14 }}>没有打开的会话</div>
      <div style={{ color: '#666', fontSize: 11 }}>双击左侧面板中的连接开始，或右键此处分屏</div>
    </div>
  );
}


export default function SplitPane({ onActiveSshChange }: { onActiveSshChange?: (connId: number) => void }) {
  return <GridContainer onActiveSshChange={onActiveSshChange} />;
}
