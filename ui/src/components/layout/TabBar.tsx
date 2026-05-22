import { useState, useRef, useEffect } from 'react';
import { useLayoutStore } from '../../store/layout';
import type { Tab, BroadcastScope } from '../../store/layout';

interface Props {
  tabs: Tab[];
  activeTabId: string | null;
  onSelectTab: (id: string) => void;
  onCloseTab: (id: string) => void;
  onAddTab?: (connId: number, name: string, type: string) => void;
  onReceiveTab?: (tab: Tab) => void;
  filterType?: string;
  connections?: { id: number; name: string }[];
}

const scopeLabels: Record<BroadcastScope, string> = {
  off: '⚟ 广播',
  pane: '⚟ 当前分屏',
  all: '⚟ 所有标签',
};

export default function TabBar({ tabs, activeTabId, onSelectTab, onCloseTab, onAddTab, onReceiveTab, filterType, connections }: Props) {
  const filtered = filterType ? tabs.filter((t) => t.type === filterType) : tabs;
  const broadcastScope = useLayoutStore((s) => s.broadcastScope);
  const setBroadcastScope = useLayoutStore((s) => s.setBroadcastScope);
  const [showPicker, setShowPicker] = useState(false);
  const [dragOverAdd, setDragOverAdd] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showPicker) return;
    const handler = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) setShowPicker(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showPicker]);

  const cycleScope = () => {
    const order: BroadcastScope[] = ['off', 'pane', 'all'];
    const idx = order.indexOf(broadcastScope);
    setBroadcastScope(order[(idx + 1) % order.length]);
  };

  return (
    <div style={{ display: 'flex', background: '#2d2d2d', height: 30, alignItems: 'center', padding: '0 4px', gap: 2, flexShrink: 0, overflow: 'visible' }}>
      {filtered.map((tab) => (
        <div key={tab.id}
          draggable
          onDragStart={(e) => {
            e.dataTransfer.setData('text/plain', JSON.stringify({ id: tab.id, title: tab.title, type: tab.type, connId: tab.connId }));
            e.dataTransfer.effectAllowed = 'move';
          }}
          onClick={() => onSelectTab(tab.id)}
          style={{
            padding: '2px 12px', fontSize: 11, borderRadius: '2px 2px 0 0', cursor: 'pointer',
            background: activeTabId === tab.id ? '#1e1e1e' : 'transparent',
            color: activeTabId === tab.id ? '#4fc3f7' : '#999',
            borderBottom: activeTabId === tab.id ? '2px solid #4fc3f7' : 'none',
            display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap',
          }}>
          {tab.title}
          <span onClick={(e) => { e.stopPropagation(); onCloseTab(tab.id); }}
            style={{ fontSize: 10, color: '#888', cursor: 'pointer' }}>✕</span>
        </div>
      ))}
      {/* Add tab button with connection picker */}
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <span onClick={() => setShowPicker(!showPicker)} title="新建标签"
          style={{ padding: '2px 6px', cursor: 'pointer', color: showPicker ? '#4fc3f7' : '#888', fontSize: 14, borderRadius: 3 }}>
          +
        </span>
        {showPicker && connections && connections.length > 0 && (
          <div ref={pickerRef} style={{
            position: 'absolute', top: '100%', left: 0, zIndex: 1000,
            background: '#2d2d2d', border: '1px solid #555', borderRadius: 4,
            minWidth: 160, maxHeight: 200, overflow: 'auto', padding: '4px 0',
            boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
          }}>
            {connections.map((c) => (
              <div key={c.id} onClick={() => { onAddTab?.(c.id, c.name, 'ssh'); setShowPicker(false); }}
                style={{
                  padding: '6px 12px', cursor: 'pointer', color: '#ccc', fontSize: 11,
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#094771'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
                🟢 {c.name}
              </div>
            ))}
          </div>
        )}
      </div>
      {/* Flex spacer & drop zone for receiving tabs from other panes */}
      <div
        onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDragOverAdd(true); }}
        onDragLeave={() => setDragOverAdd(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOverAdd(false);
          try {
            const data = JSON.parse(e.dataTransfer.getData('text/plain'));
            if (data.id && onReceiveTab) onReceiveTab(data as Tab);
          } catch {}
        }}
        style={{ flex: 1, alignSelf: 'stretch', minWidth: 4, background: dragOverAdd ? 'rgba(0,122,204,0.3)' : 'transparent' }}
      />
      <span onClick={cycleScope} title="点击切换广播范围"
        style={{
          padding: '2px 8px', cursor: 'pointer',
          background: broadcastScope !== 'off' ? '#d32f2f' : 'transparent',
          color: broadcastScope !== 'off' ? '#fff' : '#888',
          borderRadius: 3, fontSize: 11, flexShrink: 0,
        }}>
        {scopeLabels[broadcastScope]}
      </span>
    </div>
  );
}
