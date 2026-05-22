import { useLayoutStore } from '../../store/layout';
import { useConnectionStore } from '../../store/connections';
import SplitPane from './SplitPane';
import DualPaneSftp from '../sftp/DualPaneSftp';
import SftpPanel from '../sftp/SftpPanel';
import ConfigPage from '../config/ConfigPage';
import QueryEditor from '../database/QueryEditor';
import TabBar from './TabBar';

export default function MainArea() {
  const activeModule = useLayoutStore((s) => s.activeModule);
  const tabs = useLayoutStore((s) => s.tabs);
  const activeTabId = useLayoutStore((s) => s.activeTabId);
  const connections = useConnectionStore((s) => s.connections);
  const activeTab = tabs.find((t) => t.id === activeTabId);

  // SFTP standalone mode
  if (activeModule === 'sftp') {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <DualPaneSftp connections={connections} />
      </div>
    );
  }

  // Database mode
  if (activeModule === 'database' && activeTab?.type === 'database' && activeTab.connId) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <TabBar />
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <QueryEditor connId={activeTab.connId} />
        </div>
      </div>
    );
  }

  // Config mode
  if (activeModule === 'config') {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <ConfigPage />
      </div>
    );
  }

  // SSH mode: split panes on left, SFTP panel fixed on right
  const sshConnId = activeTab?.type === 'ssh' ? activeTab.connId : undefined;
  return (
    <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
        <SplitPane />
      </div>
      {sshConnId && (
        <div style={{ width: 260, flexShrink: 0, borderLeft: '1px solid #383838' }}>
          <SftpPanel connId={sshConnId} />
        </div>
      )}
    </div>
  );
}
