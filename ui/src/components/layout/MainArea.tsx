import { useState, useEffect } from 'react';
import { useLayoutStore } from '../../store/layout';
import type { Tab } from '../../store/layout';
import { useConnectionStore } from '../../store/connections';
import SplitPane from './SplitPane';
import DualPaneSftp from '../sftp/DualPaneSftp';
import SftpPanel from '../sftp/SftpPanel';
import ConfigPage from '../config/ConfigPage';
import QueryEditor from '../database/QueryEditor';
import TabBar from './TabBar';

export default function MainArea() {
  const activeModule = useLayoutStore((s) => s.activeModule);
  const connections = useConnectionStore((s) => s.connections);
  const drainTabQueue = useLayoutStore((s) => s.drainTabQueue);
  const [sftpCollapsed, setSftpCollapsed] = useState(false);
  const [sftpConnId, setSftpConnId] = useState<number | undefined>(undefined);
  const [dbTabs, setDbTabs] = useState<Tab[]>([]);
  const [dbActiveTabId, setDbActiveTabId] = useState<string | null>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      const queue = drainTabQueue();
      if (queue.length > 0) {
        const newDb = queue.filter((t) => t.type === 'database');
        if (newDb.length > 0) {
          setDbTabs((prev) => {
            const ids = new Set(prev.map((t) => t.id));
            return [...prev, ...newDb.filter((t) => !ids.has(t.id))];
          });
          setDbActiveTabId(newDb[newDb.length - 1].id);
        }
      }
    }, 100);
    return () => clearInterval(interval);
  }, [drainTabQueue]);

  const dbCloseTab = (id: string) => {
    setDbTabs((prev) => {
      const next = prev.filter((t) => t.id !== id);
      if (dbActiveTabId === id) {
        setDbActiveTabId(next.length > 0 ? next[next.length - 1].id : null);
      }
      return next;
    });
  };

  const dbActiveTab = dbTabs.find((t) => t.id === dbActiveTabId);
  const show = (m: string) => activeModule === m ? 'flex' : 'none';

  return (
    <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
      {/* SSH module */}
      <div style={{ flex: 1, display: show('ssh'), overflow: 'hidden' }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
          <SplitPane onActiveSshChange={setSftpConnId} />
        </div>
        {sftpConnId ? (
          <>
            <div style={{ width: sftpCollapsed ? 0 : 260, flexShrink: 0, borderLeft: sftpCollapsed ? 'none' : '1px solid #383838', overflow: 'hidden', transition: 'width 0.15s' }}>
              <SftpPanel connId={sftpConnId} showFollowButton />
            </div>
            <button onClick={() => setSftpCollapsed(!sftpCollapsed)} title={sftpCollapsed ? '展开 SFTP' : '收起 SFTP'}
              style={{
                width: 20, flexShrink: 0, background: '#333', border: 'none',
                borderLeft: '1px solid #383838', color: '#999', cursor: 'pointer',
                fontSize: 10, padding: 0,
              }}>
              {sftpCollapsed ? '▶' : '◀'}
            </button>
          </>
        ) : null}
      </div>

      {/* SFTP module */}
      <div style={{ flex: 1, display: show('sftp'), flexDirection: 'column', overflow: 'hidden' }}>
        <DualPaneSftp connections={connections} />
      </div>

      {/* Database module */}
      <div style={{ flex: 1, display: show('database'), flexDirection: 'column', overflow: 'hidden' }}>
        <TabBar tabs={dbTabs} activeTabId={dbActiveTabId} onSelectTab={setDbActiveTabId} onCloseTab={dbCloseTab} filterType="database" />
        <div style={{ flex: 1, overflow: 'hidden' }}>
          {dbActiveTab?.type === 'database' && dbActiveTab.connId ? (
            <QueryEditor connId={dbActiveTab.connId} />
          ) : null}
        </div>
      </div>

      {/* Config module */}
      <div style={{ flex: 1, display: show('config'), flexDirection: 'column', overflow: 'hidden' }}>
        <ConfigPage />
      </div>
    </div>
  );
}
