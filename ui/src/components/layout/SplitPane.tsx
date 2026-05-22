import { useState, useEffect, useMemo } from 'react';
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
function doSplit(targetId: string, direction: Direction) {
  const newId = `pane-${Date.now()}`;
  allPaneIds.add(newId);

  if ((layoutRoot as any).id === targetId && layoutRoot.type === 'leaf') {
    // Splitting root
    layoutRoot = {
      type: 'split',
      direction,
      children: [
        { type: 'leaf', id: targetId },
        { type: 'leaf', id: newId },
      ],
      ratios: [0.5, 0.5],
    };
  } else {
    const path = findLeaf(layoutRoot, targetId, []);
    if (!path || path.length < 2) return;
    const parent = path[path.length - 2];
    if (parent.type !== 'split') return;

    if (parent.direction === direction) {
      // Same direction — add sibling, redistribute ratios
      const n = parent.children.length + 1;
      parent.ratios = parent.children.map(() => 1 / n);
      parent.ratios.push(1 / n);
      parent.children.push({ type: 'leaf', id: newId });
    } else {
      // Different direction — wrap this leaf in a sub-split
      const idx = parent.children.findIndex((c: any) => c.id === targetId);
      if (idx < 0) return;
      parent.children[idx] = {
        type: 'split',
        direction,
        children: [
          { type: 'leaf', id: targetId },
          { type: 'leaf', id: newId },
        ],
        ratios: [0.5, 0.5],
      };
    }
  }
  notify();
  return newId;
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

// Flatten tree into grid cells
function flattenTree(node: LayoutNode, row: number, col: number, rowSpan: number, colSpan: number): GridCell[] {
  if (node.type === 'leaf') {
    return [{ id: node.id, row, col, rowSpan, colSpan }];
  }
  const cells: GridCell[] = [];
  if (node.direction === 'horizontal') {
    let c = col;
    node.children.forEach((child, i) => {
      const span = Math.max(1, Math.round(colSpan * node.ratios[i]));
      cells.push(...flattenTree(child, row, c, rowSpan, span));
      c += span;
    });
  } else {
    let r = row;
    node.children.forEach((child, i) => {
      const span = Math.max(1, Math.round(rowSpan * node.ratios[i]));
      cells.push(...flattenTree(child, r, col, span, colSpan));
      r += span;
    });
  }
  return cells;
}

// Compute the total extents of the tree
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

// Compute grid dimensions
function computeGrid(node: LayoutNode): { cols: number; rows: number; cells: GridCell[] } {
  if (node.type === 'leaf') return { cols: 1, rows: 1, cells: [{ id: node.id, row: 1, col: 1, rowSpan: 1, colSpan: 1 }] };

  const extents = treeExtents(node);
  const cells = flattenTree(node, 1, 1, extents.rows, extents.cols);

  return { cols: extents.cols, rows: extents.rows, cells };
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
    const cached = paneTabsCache.get(nodeId);
    if (cached) return cached;
    if (pendingSplitTabs) { const copy = pendingSplitTabs; pendingSplitTabs = null; return copy.tabs; }
    return [];
  });
  const [activeTabId, setActiveTabId] = useState<string | null>(() => {
    const cached = paneActiveCache.get(nodeId);
    if (cached) return cached;
    if (pendingSplitTabs) return pendingSplitTabs.activeTabId;
    return null;
  });
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
    pendingSplitTabs = { tabs: activeTab ? [activeTab] : [], activeTabId };
    const newId = doSplit(nodeId, dir);
    if (newId) setTimeout(() => setFocusedPane(newId), 100);
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
  const [, forceUpdate] = useState(0);

  useEffect(() => subscribe(() => forceUpdate((n) => n + 1)), []);

  const { cols, rows, cells } = useMemo(() => computeGrid(layoutRoot), [forceUpdate]);
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
