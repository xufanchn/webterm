import { useLayoutStore } from '../../store/layout';
import TerminalTab from '../terminal/TerminalTab';
import TabBar from './TabBar';

export default function MainArea() {
  const tabs = useLayoutStore((s) => s.tabs);
  const activeTabId = useLayoutStore((s) => s.activeTabId);
  const activeTab = tabs.find((t) => t.id === activeTabId);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <TabBar />
      <div style={{ flex: 1, overflow: 'hidden' }}>
        {activeTab && activeTab.type === 'ssh' && activeTab.connId && (
          <TerminalTab connId={activeTab.connId} />
        )}
        {!activeTab && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#666' }}>
            双击左侧连接开始
          </div>
        )}
      </div>
    </div>
  );
}
