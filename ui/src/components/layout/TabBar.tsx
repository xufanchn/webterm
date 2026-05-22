import { useLayoutStore } from '../../store/layout';

export default function TabBar() {
  const tabs = useLayoutStore((s) => s.tabs);
  const activeTabId = useLayoutStore((s) => s.activeTabId);
  const setActiveTab = useLayoutStore((s) => s.setActiveTab);
  const closeTab = useLayoutStore((s) => s.closeTab);
  const broadcastMode = useLayoutStore((s) => s.broadcastMode);
  const setBroadcastMode = useLayoutStore((s) => s.setBroadcastMode);

  return (
    <div style={{ display: 'flex', background: '#2d2d2d', height: 30, alignItems: 'center', padding: '0 4px', gap: 2, flexShrink: 0, overflow: 'auto' }}>
      {tabs.map((tab) => (
        <div key={tab.id} onClick={() => setActiveTab(tab.id)}
          style={{
            padding: '2px 12px', fontSize: 11, borderRadius: '2px 2px 0 0', cursor: 'pointer',
            background: activeTabId === tab.id ? '#1e1e1e' : 'transparent',
            color: activeTabId === tab.id ? '#4fc3f7' : '#999',
            borderBottom: activeTabId === tab.id ? '2px solid #4fc3f7' : 'none',
            display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap',
          }}>
          {tab.title}
          <span onClick={(e) => { e.stopPropagation(); closeTab(tab.id); }}
            style={{ fontSize: 10, color: '#888', cursor: 'pointer' }}>✕</span>
        </div>
      ))}
      <span onClick={() => setBroadcastMode(!broadcastMode)}
        style={{
          marginLeft: 'auto', padding: '2px 8px', cursor: 'pointer',
          background: broadcastMode ? '#d32f2f' : 'transparent',
          color: broadcastMode ? '#fff' : '#888',
          borderRadius: 3, fontSize: 11,
        }}>
        {broadcastMode ? '⚟ 广播中' : '⚟ 广播'}
      </span>
    </div>
  );
}
