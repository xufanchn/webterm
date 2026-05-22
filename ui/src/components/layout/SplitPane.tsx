import { useState, useRef, useEffect } from 'react';
import { useLayoutStore } from '../../store/layout';
import ContextMenu from '../common/ContextMenu';
import TabBar from './TabBar';
import TerminalTab from '../terminal/TerminalTab';
import QueryEditor from '../database/QueryEditor';

type Direction = 'horizontal' | 'vertical';

interface SplitNode {
  id: string;
  direction?: Direction;
  splitPercent?: number; // size of first child as percentage
  children?: [SplitNode, SplitNode];
}

// Generate unique IDs
let nodeId = 0;
function newNode(): SplitNode {
  return { id: `node-${++nodeId}` };
}

// Simple split state persisted at module level
const STORAGE_KEY = 'wshell-split';
let rootNode: SplitNode = (() => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch {}
  return { id: 'root' };
})();
let listeners: Array<() => void> = [];

function saveRoot(node: SplitNode) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(node)); } catch {}
}

function getRoot(): SplitNode { return rootNode; }
function subscribe(fn: () => void) {
  listeners.push(fn);
  return () => { listeners = listeners.filter(l => l !== fn); };
}
function updateRoot(node: SplitNode) {
  rootNode = node;
  saveRoot(node);
  listeners.forEach(fn => fn());
}

function findNode(node: SplitNode, id: string): SplitNode | null {
  if (node.id === id) return node;
  if (node.children) {
    return findNode(node.children[0], id) || findNode(node.children[1], id);
  }
  return null;
}

function replaceNode(root: SplitNode, targetId: string, replacement: SplitNode): SplitNode {
  if (root.id === targetId) return replacement;
  if (root.children) {
    return {
      ...root,
      children: [
        replaceNode(root.children[0], targetId, replacement),
        replaceNode(root.children[1], targetId, replacement),
      ] as [SplitNode, SplitNode],
    };
  }
  return root;
}

function removeChild(root: SplitNode, childId: string): SplitNode {
  if (!root.children) return root;
  if (root.children[0].id === childId) return root.children[1];
  if (root.children[1].id === childId) return root.children[0];
  return {
    ...root,
    children: [
      removeChild(root.children[0], childId),
      removeChild(root.children[1], childId),
    ] as [SplitNode, SplitNode],
  };
}

function splitNode(root: SplitNode, targetId: string, direction: Direction): SplitNode {
  const target = findNode(root, targetId);
  if (!target) return root;
  if (target.children) return root; // already split, no-op

  return replaceNode(root, targetId, {
    id: targetId + '-split',
    direction,
    splitPercent: 50,
    children: [target, newNode()],
  });
}

// Leaf pane component - renders a terminal area with tab bar
function LeafPane({ nodeId }: { nodeId: string }) {
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const tabs = useLayoutStore((s) => s.tabs);
  const activeTabId = useLayoutStore((s) => s.activeTabId);
  const activeTab = tabs.find(t => t.id === activeTabId);

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setMenu({ x: e.clientX, y: e.clientY });
  };

  const handleSplit = (dir: Direction) => {
    updateRoot(splitNode(getRoot(), nodeId, dir));
    setMenu(null);
  };

  const handleClosePane = () => {
    if (getRoot().id === nodeId) return; // Can't close root
    const newRoot = removeChild(getRoot(), nodeId);
    updateRoot(newRoot);
    setMenu(null);
  };

  const isRoot = getRoot().id === nodeId;
  const menuItems = [
    { label: '横向分屏', action: () => handleSplit('horizontal') },
    { label: '纵向分屏', action: () => handleSplit('vertical') },
    ...(isRoot ? [] : [{ label: '关闭分屏', action: handleClosePane }]),
  ];

  return (
    <div onContextMenu={handleContextMenu} style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0, minHeight: 0 }}>
      <TabBar />
      <div style={{ flex: 1, overflow: 'hidden' }}>
        {activeTab && activeTab.type === 'ssh' && activeTab.connId && (
          <TerminalTab connId={activeTab.connId} />
        )}
        {activeTab && activeTab.type === 'database' && activeTab.connId && (
          <QueryEditor connId={activeTab.connId} />
        )}
        {!activeTab && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#666', fontSize: 12, flexDirection: 'column', gap: 4 }}>
            <div>右键 → 分屏</div>
            <div style={{ fontSize: 10, color: '#888' }}>双击左侧连接打开终端</div>
          </div>
        )}
      </div>
      {menu && (
        <ContextMenu x={menu.x} y={menu.y} items={menuItems} onClose={() => setMenu(null)} />
      )}
    </div>
  );
}

// Recursive split container
function SplitContainer({ node }: { node: SplitNode }) {
  const [dragging, setDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  if (!node.children) {
    return <LeafPane nodeId={node.id} />;
  }

  const isHorizontal = node.direction === 'horizontal';
  const percent = node.splitPercent || 50;

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setDragging(true);
  };

  useEffect(() => {
    if (!dragging) return;
    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const pct = isHorizontal
        ? ((e.clientX - rect.left) / rect.width) * 100
        : ((e.clientY - rect.top) / rect.height) * 100;
      const clamped = Math.max(10, Math.min(90, pct));
      const updated = replaceNode(getRoot(), node.id, { ...node, splitPercent: clamped });
      updateRoot(updated);
    };
    const handleMouseUp = () => setDragging(false);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragging, isHorizontal, node]);

  return (
    <div ref={containerRef} style={{ display: 'flex', flexDirection: isHorizontal ? 'row' : 'column', flex: 1, overflow: 'hidden', minWidth: 0, minHeight: 0 }}>
      <div style={{ flex: percent / 100, overflow: 'hidden', display: 'flex', minWidth: 0, minHeight: 0 }}>
        <SplitContainer node={node.children[0]} />
      </div>
      <div
        onMouseDown={handleMouseDown}
        style={{
          flexShrink: 0,
          [isHorizontal ? 'width' : 'height']: '4px',
          cursor: isHorizontal ? 'col-resize' : 'row-resize',
          background: dragging ? '#007acc' : '#555',
        }}
      />
      <div style={{ flex: 1 - percent / 100, overflow: 'hidden', display: 'flex', minWidth: 0, minHeight: 0 }}>
        <SplitContainer node={node.children[1]} />
      </div>
    </div>
  );
}

export default function SplitPane() {
  const [, forceUpdate] = useState(0);

  useEffect(() => {
    return subscribe(() => forceUpdate(n => n + 1));
  }, []);

  return <SplitContainer node={getRoot()} />;
}
