import { useState, useCallback, useRef, useEffect } from 'react';
import { useLayoutStore } from '../../store/layout';
import ContextMenu from '../common/ContextMenu';
import TabBar from './TabBar';
import TerminalTab from '../terminal/TerminalTab';

type SplitDirection = 'horizontal' | 'vertical';

interface SplitPaneData {
  id: string;
  direction: SplitDirection | null;
  splitPercent: number;
  children: SplitPaneData[];
}

function PaneContent({ pane, rootPane, onUpdate }: {
  pane: SplitPaneData;
  rootPane: SplitPaneData;
  onUpdate: (root: SplitPaneData) => void;
}) {
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const tabs = useLayoutStore((s) => s.tabs);
  const activeTabId = useLayoutStore((s) => s.activeTabId);

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY });
  };

  const splitPane = useCallback((direction: SplitDirection) => {
    const newChild: SplitPaneData = {
      id: crypto.randomUUID(),
      direction: null,
      splitPercent: 50,
      children: [],
    };
    const updated: SplitPaneData = {
      ...pane,
      direction,
      splitPercent: 50,
      children: [
        { ...pane, direction: null, splitPercent: 50, children: [] },
        newChild,
      ],
    };
    const replacePane = (node: SplitPaneData): SplitPaneData => {
      if (node.id === pane.id) return updated;
      return { ...node, children: node.children.map(replacePane) };
    };
    onUpdate(replacePane(rootPane));
  }, [pane, rootPane, onUpdate]);

  const menuItems = [
    { label: '横向分屏', action: () => splitPane('horizontal') },
    { label: '纵向分屏', action: () => splitPane('vertical') },
  ];

  const activeTab = tabs.find((t) => t.id === activeTabId);

  return (
    <div onContextMenu={handleContextMenu} style={{
      flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0, minHeight: 0,
    }}>
      <TabBar />
      <div style={{ flex: 1, overflow: 'hidden' }}>
        {activeTab && activeTab.type === 'ssh' && activeTab.connId && (
          <TerminalTab connId={activeTab.connId} />
        )}
        {!activeTab && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            height: '100%', color: '#666', fontSize: 12,
          }}>
            右键 → 分屏
          </div>
        )}
      </div>
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={menuItems}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  );
}

function SplitPaneInternal({ pane, rootPane, onUpdate }: {
  pane: SplitPaneData;
  rootPane: SplitPaneData;
  onUpdate: (root: SplitPaneData) => void;
}) {
  if (!pane.direction || pane.children.length < 2) {
    return <PaneContent pane={pane} rootPane={rootPane} onUpdate={onUpdate} />;
  }

  const isHorizontal = pane.direction === 'horizontal';
  const [dragging, setDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setDragging(true);
  };

  useEffect(() => {
    if (!dragging) return;
    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const percent = isHorizontal
        ? ((e.clientX - rect.left) / rect.width) * 100
        : ((e.clientY - rect.top) / rect.height) * 100;
      const clamped = Math.max(10, Math.min(90, percent));
      const updatePane = (node: SplitPaneData): SplitPaneData => {
        if (node.id === pane.id) return { ...node, splitPercent: clamped };
        return { ...node, children: node.children.map(updatePane) };
      };
      onUpdate(updatePane(rootPane));
    };
    const handleMouseUp = () => setDragging(false);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragging, isHorizontal, pane, rootPane, onUpdate]);

  return (
    <div ref={containerRef} style={{
      display: 'flex', flexDirection: isHorizontal ? 'row' : 'column',
      flex: 1, overflow: 'hidden', minWidth: 0, minHeight: 0,
    }}>
      <div style={{
        flex: pane.splitPercent / 100, overflow: 'hidden', display: 'flex', minWidth: 0, minHeight: 0,
      }}>
        <SplitPaneInternal pane={pane.children[0]} rootPane={rootPane} onUpdate={onUpdate} />
      </div>
      <div
        onMouseDown={handleMouseDown}
        style={{
          flexShrink: 0,
          [isHorizontal ? 'width' : 'height']: '4px',
          cursor: isHorizontal ? 'col-resize' : 'row-resize',
          background: dragging ? '#007acc' : '#555',
          transition: dragging ? 'none' : 'background 0.15s',
        }}
      />
      <div style={{
        flex: 1 - pane.splitPercent / 100, overflow: 'hidden', display: 'flex', minWidth: 0, minHeight: 0,
      }}>
        <SplitPaneInternal pane={pane.children[1]} rootPane={rootPane} onUpdate={onUpdate} />
      </div>
    </div>
  );
}

export default function SplitPane() {
  const [rootPane, setRootPane] = useState<SplitPaneData>({
    id: 'root',
    direction: null,
    splitPercent: 50,
    children: [],
  });

  return (
    <SplitPaneInternal
      pane={rootPane}
      rootPane={rootPane}
      onUpdate={(root) => setRootPane(root)}
    />
  );
}
